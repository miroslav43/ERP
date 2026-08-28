// src/app/(app)/angajati/[id]/documente/actions.ts
"use server";
import { z } from "zod";
import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import { readRequestMeta, writeAuditLog } from "@/lib/actions/audit";
import {
  BUCKET_DOCUMENTE,
  construiesteCaleDocument,
  prefixCaleDocument,
  verificaDocument,
} from "@/lib/documents/cale";
import { genereazaDocumenteInrolare } from "@/lib/documents/inrolare";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import type { ActionContext } from "@/lib/actions/types";

import { ETICHETE_MOD_LUCRU } from "../../etichete";

const idAngajat = z.object({ employeeId: z.uuid() });

/**
 * Cele cinci coduri de șablon ale înrolării.
 *
 * NEEXPORTAT: fișierul e `"use server"`, iar o constantă exportată de aici rupe
 * build-ul — `tsc` tace, doar `pnpm build` o prinde.
 */
const TOATE_CODURILE: readonly string[] = [
  "contract_munca",
  "fisa_postului",
  "nda",
  "anexa_proprietate_intelectuala",
  "act_aditional_telemunca",
];

async function verificaAngajatul(ctx: ActionContext, employeeId: string): Promise<void> {
  const { data } = await ctx.supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (data === null) throw notFound("Fișa de angajat nu există sau nu îți este accesibilă.");
}

export const pregatesteIncarcareDocument = createAction({
  name: "angajati.documente.pregateste",
  permission: "employees:update",
  minScope: "team",
  audit: {
    entityType: "employee_documents",
    action: "import",
    allow: ["employeeId", "numeFisier", "dimensiune", "mime"],
  },
  input: idAngajat.extend({
    numeFisier: z.string().min(1).max(255),
    dimensiune: z.number().int().positive(),
    mime: z.string().min(3).max(120),
  }),
  handler: async (ctx: ActionContext, input) => {
    const problema = verificaDocument(input.mime, input.dimensiune);
    if (problema !== null) throw invalidInput(problema, {});
    await verificaAngajatul(ctx, input.employeeId);
    const cale = construiesteCaleDocument({
      organizationId: ctx.tenant.organizationId,
      entitate: "employees",
      entitateId: input.employeeId,
      numeFisier: input.numeFisier,
    });
    const { data, error } = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .createSignedUploadUrl(cale);
    if (error !== null || data === null)
      throw businessRule("Nu am putut pregăti încărcarea documentului.");
    return { cale, token: data.token };
  },
});

export const salveazaDocument = createAction({
  name: "angajati.documente.salveaza",
  permission: "employees:update",
  minScope: "team",
  audit: {
    entityType: "employee_documents",
    action: "create",
    allow: [
      "employeeId",
      "documentTypeId",
      "titlu",
      "numeFisier",
      "dimensiune",
      "mime",
      "numarDocument",
      "dataDocument",
      "valabilPanaLa",
      "confidential",
      "vizibilAngajatului",
    ],
  },
  input: idAngajat.extend({
    documentTypeId: z.uuid(),
    titlu: z.string().trim().min(2, "Titlul are minimum 2 caractere.").max(200),
    cale: z.string().min(1).max(400),
    numeFisier: z.string().min(1).max(255),
    dimensiune: z.number().int().min(0).max(52_428_800),
    mime: z.string().min(3).max(120),
    numarDocument: z.string().max(60).optional(),
    dataDocument: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    valabilPanaLa: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    confidential: z.boolean(),
    vizibilAngajatului: z.boolean(),
  }),
  handler: async (ctx: ActionContext, input) => {
    await verificaAngajatul(ctx, input.employeeId);
    const prefix = prefixCaleDocument(ctx.tenant.organizationId, "employees", input.employeeId);
    if (!input.cale.startsWith(prefix)) {
      const mesaj = "Calea fișierului nu corespunde acestui angajat.";
      throw invalidInput(mesaj, { cale: [mesaj] });
    }

    const { data, error } = await ctx.supabase
      .from("employee_documents")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: input.employeeId,
        document_type_id: input.documentTypeId,
        titlu: input.titlu,
        fisier_path: input.cale,
        fisier_nume: input.numeFisier,
        fisier_marime_bytes: input.dimensiune,
        fisier_mime: input.mime,
        confidential: input.confidential,
        vizibil_angajatului: input.vizibilAngajatului,
        ...(input.numarDocument === undefined ? {} : { numar_document: input.numarDocument }),
        ...(input.dataDocument === undefined ? {} : { data_document: input.dataDocument }),
        ...(input.valabilPanaLa === undefined ? {} : { valabil_pana: input.valabilPanaLa }),
      })
      .select("id")
      .single();
    if (error !== null || data === null)
      throw businessRule("Documentul nu a putut fi înregistrat. Încearcă din nou.");
    return { id: data.id };
  },
});

export const linkDescarcareDocument = createAction({
  name: "angajati.documente.descarca",
  permission: "employees:read",
  minScope: "team",
  audit: { entityType: "employee_documents", action: "export", allow: ["documentId"] },
  input: z.object({ documentId: z.uuid() }),
  handler: async (ctx: ActionContext, input) => {
    const { data } = await ctx.supabase
      .from("employee_documents")
      .select("id, employee_id, fisier_path, fisier_nume, confidential")
      .eq("id", input.documentId)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (data === null) throw notFound("Documentul nu există sau nu îți este accesibil.");

    const { data: semnat, error } = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .createSignedUrl(data.fisier_path, 120, { download: data.fisier_nume });
    if (error !== null || semnat === null)
      throw businessRule("Fișierul nu mai este disponibil în arhivă.");

    // Accesul la documentele confidențiale se auditează explicit, cu rând vizibil în jurnal.
    if (data.confidential) {
      await writeAuditLog(ctx.supabase, {
        organizationId: ctx.tenant.organizationId,
        action: "export",
        status: "success",
        entityType: "employee_documents",
        entityId: data.id,
        before: null,
        after: { employeeId: data.employee_id, motiv: "descarcare_document_confidential" },
        errorCode: null,
        requestId: ctx.requestId,
        meta: await readRequestMeta(),
      });
    }
    return { url: semnat.signedUrl, expiraSecunde: 120 };
  },
});

export const stergeDocument = createAction({
  name: "angajati.documente.sterge",
  permission: "employees:delete",
  minScope: "all",
  audit: { entityType: "employee_documents", action: "delete", allow: ["documentId", "motiv"] },
  input: z.object({
    documentId: z.uuid(),
    motiv: z.string().trim().min(3, "Scrie motivul ștergerii.").max(200),
  }),
  handler: async (ctx: ActionContext, input) => {
    // Ștergere logică: nu există politici DELETE, iar dosarul de personal trebuie păstrat.
    const { data, error } = await ctx.supabase
      .from("employee_documents")
      .update({ deleted_at: new Date().toISOString(), observatii: input.motiv })
      .eq("id", input.documentId)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw businessRule("Documentul nu a putut fi retras din dosar.");
    if (data === null) throw notFound("Documentul nu există sau a fost deja retras.");
    return { id: data.id };
  },
});

/**
 * Emite documentele care LIPSESC din dosarul unui angajat.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Fiecare avertisment al înrolării spunea „Îl puteți emite din fișa
 * angajatului, secțiunea Documente" — o cale care NU exista: singurul apelant
 * al generatorului era acțiunea de înrolare. Textul trimitea omul către un
 * buton imaginar, exact în situația în care avea nevoie de el.
 *
 * ── DE CE „LIPSĂ", NU „DIN NOU" ────────────────────────────────────────────
 * Fiecare emitere consumă un număr din registrul seriei, iar
 * `hr_issued_documents` nu are politică DELETE: un al doilea contract de muncă
 * pentru același om nu se poate șterge din interfață, doar anula. Acțiunea
 * calculează deci ce lipsește și emite exact atât. Rulată de două ori la rând,
 * a doua oară nu face nimic.
 */
export const emiteDocumenteLipsa = createAction({
  name: "angajati.documente.emite_lipsa",
  permission: "employees:create",
  minScope: "all",
  audit: { entityType: "hr_issued_documents", action: "create", allow: ["employeeId"] },
  input: idAngajat,
  revalidate: ["/angajati"],
  handler: async (ctx: ActionContext, input) => {
    const { data: angajat } = await ctx.supabase
      .from("employees")
      // Un singur literal, fără concatenare: clientul Supabase deduce tipul
      // rândului DIN ȘIRUL de selecție, iar o expresie `"a" + "b"` îl face să
      // cadă pe `GenericStringError` — adică pe `any` cu alt nume.
      .select(
        "id, full_name, adresa_strada, adresa_oras, adresa_judet, serie_act, numar_act, act_eliberat_de, act_eliberat_la, job_position_id, department_id",
      )
      .eq("id", input.employeeId)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (angajat === null) throw notFound("Fișa de angajat nu există sau nu îți este accesibilă.");

    // Contractul de bază activ. `contracts_employee_activ_uniq` garantează că e
    // cel mult unul, deci nu e nevoie de nicio departajare aici.
    const { data: contract } = await ctx.supabase
      .from("employment_contracts")
      .select(
        "id, numar, data_contract, valabil_de_la, valabil_pana, contract_duration, norma_ore_saptamana, norma_ore_zi, work_mode, loc_munca, loc_telemunca, salariu_baza, zile_concediu_anual",
      )
      .eq("employee_id", input.employeeId)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("este_act_aditional", false)
      .is("deleted_at", null)
      .order("valabil_de_la", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (contract === null) {
      throw businessRule("Angajatul nu are contract, deci nu se poate emite niciun document.");
    }

    const [emise, functie, departament, fisaPost] = await Promise.all([
      ctx.supabase
        .from("hr_issued_documents")
        .select("template_id, hr_document_templates(cod)")
        .eq("employee_id", input.employeeId)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("deleted_at", null),
      angajat.job_position_id === null
        ? Promise.resolve(null)
        : ctx.supabase
            .from("job_positions")
            .select("denumire")
            .eq("id", angajat.job_position_id)
            .maybeSingle(),
      angajat.department_id === null
        ? Promise.resolve(null)
        : ctx.supabase
            .from("departments")
            .select("denumire")
            .eq("id", angajat.department_id)
            .maybeSingle(),
      ctx.supabase
        .from("job_descriptions")
        .select("subordonare, atributii, competente")
        .eq("employee_id", input.employeeId)
        .is("deleted_at", null)
        .order("valabil_de_la", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const codEmis = new Set(
      (emise.data ?? [])
        .map((rand) => rand.hr_document_templates?.cod)
        .filter((cod): cod is string => typeof cod === "string"),
    );
    const lipsa = TOATE_CODURILE.filter((cod) => !codEmis.has(cod));
    if (lipsa.length === 0) {
      throw businessRule("Toate documentele au fost deja emise pentru acest angajat.");
    }

    const rezultat = await genereazaDocumenteInrolare(ctx.supabase, {
      organizationId: ctx.tenant.organizationId,
      employeeId: angajat.id,
      contractId: contract.id,
      emisDe: ctx.user.id,
      azi: todayInBucharest(),
      angajat: {
        nume: angajat.full_name ?? "",
        adresa: [angajat.adresa_strada, angajat.adresa_oras, angajat.adresa_judet]
          .filter((parte): parte is string => parte !== null)
          .join(", "),
        serieAct: angajat.serie_act,
        numarAct: angajat.numar_act,
        actEliberatDe: angajat.act_eliberat_de,
        actEliberatLa: angajat.act_eliberat_la,
        functie: functie?.data?.denumire ?? null,
        departament: departament?.data?.denumire ?? null,
      },
      contract: {
        numar: contract.numar,
        dataContract: contract.data_contract,
        dataAngajarii: contract.valabil_de_la,
        durata:
          contract.contract_duration === "determinat" && contract.valabil_pana !== null
            ? `determinată, până la ${formatDate(contract.valabil_pana)}`
            : "nedeterminată",
        normaOreSaptamana: Number(contract.norma_ore_saptamana),
        normaOreZi: Number(contract.norma_ore_zi),
        modLucru: ETICHETE_MOD_LUCRU[contract.work_mode] ?? contract.work_mode,
        locMunca: contract.loc_munca,
        locTelemunca: contract.loc_telemunca,
        salariuBrut: Number(contract.salariu_baza),
        zileConcediuAnual: contract.zile_concediu_anual,
      },
      codModLucru: contract.work_mode,
      fisaPostului:
        fisaPost.data === null
          ? null
          : {
              subordonare: fisaPost.data.subordonare,
              atributii: (fisaPost.data.atributii as string[] | null) ?? [],
              competente: (fisaPost.data.competente as string[] | null) ?? [],
            },
      doarCodurile: lipsa,
    });

    return { documente: rezultat.documente, avertismente: rezultat.avertismente };
  },
});
