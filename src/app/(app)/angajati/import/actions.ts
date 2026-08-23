// src/app/(app)/angajati/import/actions.ts
"use server";
//
// DE CE TREI ACȚIUNI ȘI NU UNA
// 1) Limita de corp a unui Server Action (implicit 1 MB) ar respinge un .xlsx de câteva MB.
//    Fișierul NU trece prin acțiune: acțiunea emite un URL de încărcare semnat, iar browserul
//    urcă direct în Storage. Prin acțiune circulă doar calea (câteva zeci de octeți).
// 2) Parsarea și validarea se fac o singură dată, pe server; lotul validat se salvează ca JSON
//    lângă fișier. Clientul primește doar sumarul + erorile + un eșantion, nu cele 300 de rânduri.
// 3) Aplicarea se face în loturi de LOT_IMPORT rânduri, apelate secvențial de client. Fiecare
//    invocare rămâne mult sub limita de timp a funcției și sub cea de răspuns, iar progresul e
//    vizibil. Reluarea după o eroare de rețea se face de la același offset.
//
// ATOMICITATE PER RÂND: un rând înseamnă până la trei inserturi (fișă, date sensibile, contract).
// Nu există tranzacție între apeluri PostgREST, așa că folosim compensare: dacă un pas ulterior
// eșuează, fișa tocmai creată primește deleted_at = now(). Indexurile unice sunt parțiale
// (where deleted_at is null), deci marca și numărul de contract redevin libere imediat, iar
// rândul poate fi reimportat după corectură. Restul rândurilor din lot nu sunt afectate.
import { z } from "zod";
import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput } from "@/lib/actions/errors";
import { citesteExcelDinBuffer, LOT_IMPORT, verificaFisierImport } from "@/lib/import/excel";
import { etichetaCampImport, mapeazaColoane, mapeazaRand } from "@/domain/import/mapare";
import { schemaLotImport, valideazaRanduri, type AngajatProtejat } from "@/domain/import/validare";
import { BUCKET_DOCUMENTE, caleLotImport, construiesteCaleDocument } from "@/lib/documents/cale";
import type { ActionContext } from "@/lib/actions/types";

const PERMISIUNE = "employees:create";

export const pregatesteIncarcareaImportului = createAction({
  name: "angajati.import.pregateste",
  permission: PERMISIUNE,
  minScope: "all",
  audit: { entityType: "employees", action: "import", allow: ["numeFisier", "dimensiune"] },
  input: z.object({
    numeFisier: z.string().min(1).max(255),
    dimensiune: z.number().int().positive(),
  }),
  handler: async (ctx: ActionContext, input) => {
    const problema = verificaFisierImport(input.numeFisier, input.dimensiune);
    if (problema !== null) throw invalidInput(problema, {});

    const batchId = crypto.randomUUID();
    const cale = construiesteCaleDocument({
      organizationId: ctx.tenant.organizationId,
      entitate: "import",
      entitateId: batchId,
      numeFisier: input.numeFisier,
    });
    const { data, error } = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .createSignedUploadUrl(cale);
    if (error !== null || data === null) {
      throw businessRule(
        "Nu am putut pregăti încărcarea fișierului. Încearcă din nou în câteva secunde.",
      );
    }
    return { batchId, cale, token: data.token };
  },
});

export const analizeazaImportAngajati = createAction({
  name: "angajati.import.analizeaza",
  permission: PERMISIUNE,
  minScope: "all",
  audit: { entityType: "employees", action: "import", allow: ["batchId", "cale"] },
  input: z.object({ batchId: z.uuid(), cale: z.string().min(1).max(400) }),
  handler: async (ctx: ActionContext, input) => {
    const prefix = `${ctx.tenant.organizationId}/import/${input.batchId}/`;
    if (!input.cale.startsWith(prefix)) {
      const mesaj = "Calea fișierului nu corespunde acestui import.";
      throw invalidInput(mesaj, { cale: [mesaj] });
    }

    const descarcare = await ctx.supabase.storage.from(BUCKET_DOCUMENTE).download(input.cale);
    if (descarcare.error !== null || descarcare.data === null) {
      throw businessRule("Fișierul încărcat nu mai este disponibil. Reia încărcarea.");
    }
    const citire = await citesteExcelDinBuffer(await descarcare.data.arrayBuffer());
    if (!citire.ok) throw invalidInput(citire.mesaj, {});

    const mapare = mapeazaColoane(citire.foaie.antet);
    if (mapare.campuriLipsa.length > 0) {
      const lipsa = mapare.campuriLipsa.map(etichetaCampImport).join(", ");
      throw invalidInput(
        `Fișierul nu conține coloanele obligatorii: ${lipsa}. Adaugă-le pe primul rând și reîncarcă.`,
        {},
      );
    }
    const rezultat = valideazaRanduri(
      citire.foaie.randuri.map((brut) => mapeazaRand(brut, mapare)),
    );

    // CNP-ul și IBAN-ul NU se scriu niciodată în clar.
    //
    // Lotul validat trebuie să supraviețuiască între previzualizare și aplicare,
    // deci ajunge într-un fișier în Storage. Varianta anterioară serializa
    // rândurile așa cum veniseau din Excel — adică urca într-un bucket, în text
    // simplu, CNP-urile și IBAN-urile a sute de angajați. Un fișier de import
    // uitat acolo ar fi fost o breșă completă, fără să atingă nicio politică RLS.
    //
    // Criptăm la parsare, o singură dată. Din acest punct, textul clar nu mai
    // există nicăieri: nici în Storage, nici în memoria pasului de aplicare.
    const { encrypt, amprentaSensibila, catreBytea, versiuneCaNumar } =
      await import("@/lib/crypto/aes-gcm");
    const protejeaza = (valoare: string) => {
      const c = encrypt(valoare);
      return {
        ciphertext: catreBytea(c.ciphertext),
        iv: catreBytea(c.iv),
        tag: catreBytea(c.tag),
        keyVersion: versiuneCaNumar(c.keyVersion),
        last4: valoare.slice(-4),
        hash: amprentaSensibila(valoare),
      };
    };
    const valideProtejate = rezultat.valide.map(({ cnp, iban, ...rest }) => ({
      ...rest,
      ...(cnp === undefined ? {} : { cnpProtejat: protejeaza(cnp) }),
      ...(iban === undefined ? {} : { ibanProtejat: protejeaza(iban) }),
    }));

    const lot = new Blob([JSON.stringify(valideProtejate)], { type: "application/json" });
    const salvare = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .upload(caleLotImport(ctx.tenant.organizationId, input.batchId), lot, {
        upsert: true,
        contentType: "application/json",
      });
    if (salvare.error !== null)
      throw businessRule("Nu am putut salva previzualizarea importului. Încearcă din nou.");

    return {
      batchId: input.batchId,
      numeFoaie: citire.foaie.numeFoaie,
      totalRanduri: citire.foaie.randuri.length,
      trunchiat: citire.foaie.trunchiat,
      coloaneRecunoscute: mapare.potriviri.map((p) => ({
        coloana: p.coloana,
        camp: etichetaCampImport(p.camp),
      })),
      coloaneIgnorate: mapare.coloaneIgnorate,
      numarValide: rezultat.valide.length,
      esantion: rezultat.valide.slice(0, 20),
      invalide: rezultat.invalide,
      dimensiuneLot: LOT_IMPORT,
    };
  },
});

async function idDupaCheie(
  ctx: ActionContext,
  tabel: "departments" | "job_positions",
  denumire: string,
): Promise<string | null> {
  const { data } = await ctx.supabase
    .from(tabel)
    .select("id")
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .or(`cod.ilike.${denumire},denumire.ilike.${denumire}`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function importaUnRand(ctx: ActionContext, angajat: AngajatProtejat): Promise<string | null> {
  const organizationId = ctx.tenant.organizationId;
  const departmentId =
    angajat.departament === undefined
      ? null
      : await idDupaCheie(ctx, "departments", angajat.departament);
  if (angajat.departament !== undefined && departmentId === null) {
    return `Departamentul „${angajat.departament}" nu există. Creează-l întâi în Structura organizatorică.`;
  }
  const jobPositionId =
    angajat.functie === undefined ? null : await idDupaCheie(ctx, "job_positions", angajat.functie);
  if (angajat.functie !== undefined && jobPositionId === null) {
    return `Funcția „${angajat.functie}" nu există în nomenclator. Adaug-o întâi din ecranul Funcții (/functii).`;
  }

  // Marca lipsă din fișier o atribuie contorul organizației — același drum ca
  // la înrolare (`urmatoarea_marca`). Până în 0069 importul cerea marca și avea
  // deci un regim de numerotare PARALEL cu al contorului: un import de
  // 0001–0200 urmat de o înrolare producea „0001" a doua oară.
  let marca = angajat.marca;
  if (marca === undefined) {
    const { data: atribuita, error: eroareMarca } = await ctx.supabase.rpc("urmatoarea_marca", {
      p_organization_id: organizationId,
    });
    if (eroareMarca !== null) {
      return "Marca nu a putut fi atribuită automat. Completați coloana „Marcă” în fișier.";
    }
    marca = atribuita;
  }

  const inserare = await ctx.supabase
    .from("employees")
    .insert({
      organization_id: organizationId,
      marca,
      last_name: angajat.last_name,
      first_name: angajat.first_name,
      hired_on: angajat.hired_on,
      status: "candidat", // stare inițială fixă: activarea se face la înregistrarea contractului
      ...(angajat.email_personal === undefined ? {} : { email_personal: angajat.email_personal }),
      ...(angajat.telefon === undefined ? {} : { telefon: angajat.telefon }),
      ...(angajat.data_nasterii === undefined ? {} : { data_nasterii: angajat.data_nasterii }),
      ...(angajat.gen === undefined ? {} : { gen: angajat.gen }),
      ...(angajat.cetatenie === undefined ? {} : { cetatenie: angajat.cetatenie }),
      ...(angajat.adresa_strada === undefined ? {} : { adresa_strada: angajat.adresa_strada }),
      ...(angajat.adresa_oras === undefined ? {} : { adresa_oras: angajat.adresa_oras }),
      ...(angajat.adresa_judet === undefined ? {} : { adresa_judet: angajat.adresa_judet }),
      ...(angajat.adresa_cod_postal === undefined
        ? {}
        : { adresa_cod_postal: angajat.adresa_cod_postal }),
      ...(angajat.persoane_intretinere === undefined
        ? {}
        : { nr_persoane_intretinere: angajat.persoane_intretinere }),
      ...(departmentId === null ? {} : { department_id: departmentId }),
      ...(jobPositionId === null ? {} : { job_position_id: jobPositionId }),
    })
    .select("id")
    .single();

  if (inserare.error !== null || inserare.data === null) {
    return inserare.error?.code === "23505"
      ? `Există deja un angajat cu marca „${angajat.marca}".`
      : (inserare.error?.message ?? "Fișa nu a putut fi creată.");
  }
  const employeeId = inserare.data.id;

  // Compensare: orice pas ulterior eșuat anulează logic fișa, eliberând marca.
  const anuleaza = async (motiv: string): Promise<string> => {
    await ctx.supabase
      .from("employees")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", employeeId);
    return motiv;
  };

  if (angajat.cnpProtejat !== undefined || angajat.ibanProtejat !== undefined) {
    const sensibile = await salveazaDateSensibile(ctx, employeeId, angajat);
    if (sensibile !== null) return anuleaza(sensibile);
  }

  if (angajat.numar_contract !== undefined && angajat.salariu !== undefined) {
    const contract = await ctx.supabase.from("employment_contracts").insert({
      organization_id: organizationId,
      employee_id: employeeId,
      numar: angajat.numar_contract,
      data_contract: angajat.data_contract ?? angajat.hired_on,
      valabil_de_la: angajat.hired_on,
      salariu_baza: angajat.salariu,
      status: "proiect", // niciodată „activ" din import: activarea trece prin REVISAL
      ...(angajat.tip_contract === undefined ? {} : { contract_duration: angajat.tip_contract }),
      ...(angajat.contract_pana_la === undefined ? {} : { valabil_pana: angajat.contract_pana_la }),
      ...(angajat.norma_ore === undefined ? {} : { norma_ore_saptamana: angajat.norma_ore }),
      ...(angajat.zile_concediu === undefined
        ? {}
        : { zile_concediu_anual: angajat.zile_concediu }),
      ...(departmentId === null ? {} : { department_id: departmentId }),
      ...(jobPositionId === null ? {} : { job_position_id: jobPositionId }),
    });
    if (contract.error !== null) {
      return anuleaza(
        contract.error.code === "23505"
          ? `Numărul de contract „${angajat.numar_contract}" este deja folosit.`
          : contract.error.message,
      );
    }
  }
  return null;
}

async function salveazaDateSensibile(
  ctx: ActionContext,
  employeeId: string,
  angajat: AngajatProtejat,
): Promise<string | null> {
  // Valorile sosesc DEJA criptate, din pasul de previzualizare. Aici nu se mai
  // face criptare: dacă am recripta, ar însemna că textul clar a călătorit până
  // aici — adică prin fișierul din Storage, exact ce am eliminat.
  const { error } = await ctx.supabase.from("employee_sensitive_data").insert({
    employee_id: employeeId,
    organization_id: ctx.tenant.organizationId,
    ...(angajat.cnpProtejat === undefined
      ? {}
      : {
          cnp_ciphertext: angajat.cnpProtejat.ciphertext,
          cnp_iv: angajat.cnpProtejat.iv,
          cnp_tag: angajat.cnpProtejat.tag,
          cnp_key_version: angajat.cnpProtejat.keyVersion,
          cnp_last4: angajat.cnpProtejat.last4,
          cnp_hash: angajat.cnpProtejat.hash,
        }),
    ...(angajat.ibanProtejat === undefined
      ? {}
      : {
          iban_ciphertext: angajat.ibanProtejat.ciphertext,
          iban_iv: angajat.ibanProtejat.iv,
          iban_tag: angajat.ibanProtejat.tag,
          iban_key_version: angajat.ibanProtejat.keyVersion,
          iban_last4: angajat.ibanProtejat.last4,
          iban_hash: angajat.ibanProtejat.hash,
        }),
    ...(angajat.banca === undefined ? {} : { banca: angajat.banca }),
  });
  if (error === null) return null;
  return error.code === "23505"
    ? "CNP-ul există deja la un alt angajat din organizație."
    : error.message;
}

export const aplicaImportAngajati = createAction({
  name: "angajati.import.aplica",
  permission: PERMISIUNE,
  minScope: "all",
  audit: { entityType: "employees", action: "create", allow: ["batchId", "offset"] },
  input: z.object({ batchId: z.uuid(), offset: z.number().int().min(0).max(1000) }),
  handler: async (ctx: ActionContext, input) => {
    const descarcare = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .download(caleLotImport(ctx.tenant.organizationId, input.batchId));
    if (descarcare.error !== null || descarcare.data === null) {
      throw businessRule("Previzualizarea a expirat. Reia importul de la încărcarea fișierului.");
    }
    // Conținutul din Storage e tratat ca date externe: se revalidează la graniță.
    const lot = schemaLotImport.safeParse(JSON.parse(await descarcare.data.text()));
    if (!lot.success) throw businessRule("Lotul salvat nu mai poate fi citit. Reia importul.");

    const felie = lot.data.slice(input.offset, input.offset + LOT_IMPORT);
    const esuate: { rand: number; marca: string; mesaj: string }[] = [];
    let reusite = 0;
    for (const angajat of felie) {
      const eroare = await importaUnRand(ctx, angajat);
      if (eroare === null) reusite += 1;
      else
        esuate.push({
          rand: angajat.rand,
          marca: angajat.marca ?? "(atribuită automat)",
          mesaj: eroare,
        });
    }
    const urmator = input.offset + felie.length;
    return {
      procesate: felie.length,
      reusite,
      esuate,
      urmator,
      total: lot.data.length,
      gata: urmator >= lot.data.length,
    };
  },
});
