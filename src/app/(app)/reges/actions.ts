// src/app/(app)/reges/actions.ts
"use server";

import { businessRule, mapPostgrestError, notFound } from "@/lib/actions/errors";
import type { ActionResult } from "@/lib/actions/types";
import { createAction } from "@/lib/actions/create-action";
import { todayInBucharest } from "@/lib/format/date";
import { idOrganizatie } from "@/lib/queries/reges";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  construiesteExport,
  laCsv,
  numeFisierExport,
  type IntrareExport,
} from "@/domain/reges/export";
import type { TipEvenimentReges } from "@/domain/reges/evenimente";

import {
  exportaSchema,
  marcheazaTransmisSchema,
  type ExportaInput,
  type MarcheazaTransmisInput,
} from "./constante";

const actiuneMarcheazaTransmis = createAction<typeof marcheazaTransmisSchema, { id: string }>({
  name: "reges.marcheaza_transmis",
  feature: "reges",
  // A DECLARAT `compliance:read` până la 0087, deși pagina ținea butonul în
  // spatele lui `compliance:update`. Cine avea doar citire putea chema Server
  // Action-ul direct și marca drept transmis orice eveniment — o falsificare a
  // registrului, nu o scăpare cosmetică. Acțiunea cere acum exact ce gatează
  // pagina. (`docs/design/faza-2/2-vanatoare.md:558`)
  permission: "reges:update",
  minScope: "all", // S3: fără scope suficient, refuz explicit
  input: marcheazaTransmisSchema,
  audit: {
    action: "update",
    entityType: "reges_evenimente",
    entityId: (input) => input.evenimentId,
    allow: ["evenimentId", "transmisLa", "numarInregistrare", "observatii"],
  },
  revalidate: ["/reges"],
  handler: async (ctx, input) => {
    const supabase = await createServerSupabase();
    const organizationId = idOrganizatie(ctx.tenant);

    if (input.transmisLa > todayInBucharest()) {
      throw businessRule("Data transmiterii nu poate fi în viitor.");
    }

    const { data: eveniment, error: eroareCitire } = await supabase
      .from("reges_evenimente")
      .select("id, status")
      .eq("id", input.evenimentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (eroareCitire) throw mapPostgrestError(eroareCitire, ctx.requestId);
    if (eveniment === null) throw notFound("Evenimentul REGES nu a fost găsit.");
    if (eveniment.status === "anulat") {
      throw businessRule("Evenimentul este anulat și nu mai poate fi marcat ca transmis.");
    }
    if (eveniment.status === "transmis" || eveniment.status === "confirmat") {
      throw businessRule("Evenimentul este deja marcat ca transmis.");
    }

    // Coloana e timestamptz; păstrăm ora 00:00 UTC pentru ca ziua afișată la București
    // să rămână ziua aleasă de operator.
    const { data, error } = await supabase
      .from("reges_evenimente")
      .update({
        status: "transmis",
        transmis_la: `${input.transmisLa}T00:00:00Z`,
        transmis_de: ctx.user.id,
        numar_inregistrare: input.numarInregistrare,
        eroare: null,
        ...(input.observatii === undefined ? {} : { observatii: input.observatii }),
        updated_by: ctx.user.id,
      })
      .eq("id", input.evenimentId)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();

    if (error) throw mapPostgrestError(error, ctx.requestId);
    // Netransmiterea în termen la Inspecția Muncii e contravenție PER SALARIAT.
    // Un UPDATE respins de `USING` afectează zero rânduri fără eroare (capcana
    // 17): ecranul ar arăta evenimentul ca transmis, evidența ar rămâne
    // netransmisă, iar nimeni n-ar afla până la control.
    if (data === null) {
      throw businessRule("Marcarea ca transmis a fost respinsă. Evenimentul a rămas netransmis.");
    }

    return { id: input.evenimentId };
  },
});

export async function marcheazaTransmis(
  input: MarcheazaTransmisInput,
): Promise<ActionResult<{ id: string }>> {
  return actiuneMarcheazaTransmis(input);
}

export interface ExportReges {
  readonly numeFisier: string;
  readonly continut: string;
  readonly totalIntrari: number;
  readonly gataDeTransmis: number;
  readonly probleme: readonly { readonly mesaj: string; readonly blocant: boolean }[];
}

const actiuneExporta = createAction<typeof exportaSchema, ExportReges>({
  name: "reges.export",
  feature: "reges",
  // Idem: pagina gata butonul pe `compliance:export`, acțiunea cerea `read`.
  permission: "reges:export",
  minScope: "all",
  input: exportaSchema,
  audit: { action: "export", entityType: "reges_evenimente", allow: ["doarNetransmise"] },
  handler: async (ctx, input) => {
    const supabase = await createServerSupabase();
    const organizationId = idOrganizatie(ctx.tenant);
    const azi = todayInBucharest();

    let cerere = supabase
      .from("reges_evenimente")
      .select("id, event_type, data_evenimentului, termen_transmitere, employee_id, contract_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("termen_transmitere", { ascending: true })
      .limit(2000);
    if (input.doarNetransmise) cerere = cerere.in("status", ["de_pregatit", "pregatit", "respins"]);

    const { data: evenimente, error } = await cerere;
    if (error) throw mapPostgrestError(error, ctx.requestId);
    if ((evenimente ?? []).length === 0) {
      throw businessRule("Nu există evenimente de exportat pentru filtrul ales.");
    }

    const idAngajati = [...new Set((evenimente ?? []).map((e) => e.employee_id))];
    const idContracte = [
      ...new Set(
        (evenimente ?? []).map((e) => e.contract_id).filter((v): v is string => v !== null),
      ),
    ];

    const [angajati, sensibile, contracte, organizatie] = await Promise.all([
      supabase
        .from("employees")
        .select("id, marca, first_name, last_name, cetatenie")
        .in("id", idAngajati),
      supabase
        .from("employee_sensitive_data")
        .select("employee_id, cnp_last4")
        .in("employee_id", idAngajati),
      idContracte.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("employment_contracts")
            .select(
              "id, numar, data_contract, valabil_de_la, valabil_pana, contract_duration, norma_ore_saptamana, norma_ore_zi, functie, cod_cor, conditii_munca, salariu_baza, moneda, cod_revisal, temei_incetare, incetat_la",
            )
            .in("id", idContracte),
      supabase
        .from("organizations")
        .select("id, name, cui, reg_com")
        .eq("id", organizationId)
        .single(),
    ]);

    if (angajati.error) throw mapPostgrestError(angajati.error, ctx.requestId);
    if (sensibile.error) throw mapPostgrestError(sensibile.error, ctx.requestId);
    if (contracte.error) throw mapPostgrestError(contracte.error, ctx.requestId);
    if (organizatie.error) throw mapPostgrestError(organizatie.error, ctx.requestId);

    // Nicio interogare pentru funcție: după migrarea 0110, denumirea și codul
    // COR stau PE CONTRACT, înghețate la semnare. Înainte se citea
    // nomenclatorul, deci o corectare de cod rescria retroactiv ce se
    // declarase la ITM pentru toate contractele de pe acea funcție.
    const hartaAngajati = new Map((angajati.data ?? []).map((a) => [a.id, a]));
    const hartaCnp = new Map((sensibile.data ?? []).map((s) => [s.employee_id, s.cnp_last4]));
    const hartaContracte = new Map((contracte.data ?? []).map((c) => [c.id, c]));

    const intrari: IntrareExport[] = (evenimente ?? []).flatMap((eveniment) => {
      const angajat = hartaAngajati.get(eveniment.employee_id);
      if (angajat === undefined) return [];
      const contract =
        eveniment.contract_id === null ? undefined : hartaContracte.get(eveniment.contract_id);
      return [
        {
          evenimentId: eveniment.id,
          tip: eveniment.event_type as TipEvenimentReges,
          codEveniment: null,
          dataEvenimentului: eveniment.data_evenimentului,
          termenTransmitere: eveniment.termen_transmitere,
          salariat: {
            employeeId: angajat.id,
            marca: angajat.marca,
            nume: angajat.last_name,
            prenume: angajat.first_name,
            cnpUltimele4: hartaCnp.get(angajat.id) ?? null,
            cetatenie: angajat.cetatenie,
          },
          contract:
            contract === undefined
              ? null
              : {
                  contractId: contract.id,
                  numar: contract.numar,
                  dataContract: contract.data_contract,
                  valabilDeLa: contract.valabil_de_la,
                  valabilPana: contract.valabil_pana,
                  durata: contract.contract_duration,
                  normaOreSaptamana: Number(contract.norma_ore_saptamana),
                  normaOreZi: Number(contract.norma_ore_zi),
                  codCor: contract?.cod_cor ?? null,
                  denumireFunctie: contract?.functie ?? null,
                  conditiiMunca: contract.conditii_munca,
                  salariuBaza: Number(contract.salariu_baza),
                  moneda: contract.moneda,
                  codRevisal: contract.cod_revisal,
                  temeiIncetare: contract.temei_incetare,
                  dataIncetare: contract.incetat_la,
                },
        },
      ];
    });

    const rezultat = construiesteExport({
      angajator: {
        cui: organizatie.data.cui,
        denumire: organizatie.data.name,
        registruComert: organizatie.data.reg_com,
      },
      intrari,
      azi,
    });

    return {
      numeFisier: numeFisierExport(organizatie.data.cui, azi),
      continut: laCsv(rezultat),
      totalIntrari: rezultat.intrari.length,
      gataDeTransmis: rezultat.gataDeTransmis.length,
      probleme: rezultat.probleme.map((p) => ({ mesaj: p.mesaj, blocant: p.blocant })),
    } satisfies ExportReges;
  },
});

export async function exportaEvenimente(input: ExportaInput): Promise<ActionResult<ExportReges>> {
  return actiuneExporta(input);
}
