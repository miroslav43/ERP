// src/app/(app)/angajati/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { readRequestMeta, writeAuditLog } from "@/lib/actions/audit";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { createServerSupabase } from "@/lib/supabase/server";
import { amprenta, cripteaza, decripteaza } from "@/lib/hr/criptare";
import { ultimeleCifreCnp } from "@/domain/hr/cnp";
import { ultimeleCifreIban } from "@/domain/hr/iban";
import {
  actualizeazaAngajatSchema,
  creeazaAngajatSchema,
  creeazaContractSchema,
  dezvaluieDateSensibileSchema,
  incetareContractSchema,
} from "@/schemas/employee";

interface RandSensibil {
  readonly cnp_ciphertext: string | null;
  readonly cnp_iv: string | null;
  readonly cnp_tag: string | null;
  readonly cnp_key_version: number | null;
  readonly iban_ciphertext: string | null;
  readonly iban_iv: string | null;
  readonly iban_tag: string | null;
  readonly iban_key_version: number | null;
}

/** Scrie sau actualizează blocul criptat; se apelează doar dacă utilizatorul a trimis valori noi. */
async function salveazaDateSensibile(
  organizationId: string,
  employeeId: string,
  actorId: string,
  cnp: string | null,
  iban: string | null,
  banca: string | null,
): Promise<void> {
  if (cnp === null && iban === null && banca === null) return;
  const db = await createServerSupabase();

  const bucataCnp =
    cnp === null
      ? {}
      : (() => {
          const criptat = cripteaza(cnp);
          return {
            cnp_ciphertext: criptat.ciphertext,
            cnp_iv: criptat.iv,
            cnp_tag: criptat.tag,
            cnp_key_version: criptat.keyVersion,
            cnp_last4: ultimeleCifreCnp(cnp),
            cnp_hash: amprenta(cnp),
          };
        })();

  const bucataIban =
    iban === null
      ? {}
      : (() => {
          const criptat = cripteaza(iban);
          return {
            iban_ciphertext: criptat.ciphertext,
            iban_iv: criptat.iv,
            iban_tag: criptat.tag,
            iban_key_version: criptat.keyVersion,
            iban_last4: ultimeleCifreIban(iban),
            iban_hash: amprenta(iban),
          };
        })();

  const { error } = await db.from("employee_sensitive_data").upsert(
    {
      employee_id: employeeId,
      organization_id: organizationId,
      ...bucataCnp,
      ...bucataIban,
      ...(banca === null ? {} : { banca }),
      updated_by: actorId,
    },
    { onConflict: "employee_id" },
  );
  if (error !== null) throw error;
}

export const creeazaAngajat = createAction({
  name: "employees.create",
  permission: "employees:create",
  minScope: "all",
  input: creeazaAngajatSchema,
  audit: {
    action: "create",
    entityType: "employee",
    entityId: (_input, data: Readonly<{ id: string; full_name: string | null }>) => data.id,
    allow: [
      "marca",
      "last_name",
      "first_name",
      "email_personal",
      "telefon",
      "adresa_strada",
      "adresa_oras",
      "adresa_judet",
      "adresa_cod_postal",
      "data_nasterii",
      "gen",
      "cetatenie",
      "tip_act_identitate",
      "serie_act",
      "numar_act",
      "act_valabil_pana",
      "department_id",
      "job_position_id",
      "manager_employee_id",
      "hired_on",
      "conditii_munca",
      "grad_handicap",
      "nr_persoane_intretinere",
      "optiune_pilon_ii",
      "is_primary",
      "contact_urgenta_nume",
      "contact_urgenta_telefon",
      "contact_urgenta_relatie",
      "observatii",
    ],
  },
  handler: async (ctx, input): Promise<Readonly<{ id: string; full_name: string | null }>> => {
    const db = await createServerSupabase();
    const { cnp, iban, banca, ...fisa } = input;

    const { data, error } = await db
      .from("employees")
      .insert({
        ...fisa,
        organization_id: ctx.tenant.organizationId,
        status: "candidat",
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, full_name")
      .single();
    if (error !== null) throw error;

    await salveazaDateSensibile(ctx.tenant.organizationId, data.id, ctx.user.id, cnp, iban, banca);
    revalidatePath("/angajati");
    return { id: data.id, full_name: data.full_name };
  },
});

export const actualizeazaAngajat = createAction({
  name: "employees.update",
  permission: "employees:update",
  minScope: "team",
  input: actualizeazaAngajatSchema,
  audit: {
    action: "update",
    entityType: "employee",
    entityId: (input) => input.id,
    allow: [
      "id",
      "last_name",
      "first_name",
      "email_personal",
      "telefon",
      "adresa_strada",
      "adresa_oras",
      "adresa_judet",
      "adresa_cod_postal",
      "data_nasterii",
      "gen",
      "cetatenie",
      "tip_act_identitate",
      "serie_act",
      "numar_act",
      "act_valabil_pana",
      "department_id",
      "job_position_id",
      "manager_employee_id",
      "hired_on",
      "conditii_munca",
      "grad_handicap",
      "nr_persoane_intretinere",
      "optiune_pilon_ii",
      "contact_urgenta_nume",
      "contact_urgenta_telefon",
      "contact_urgenta_relatie",
      "observatii",
    ],
  },
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, cnp, iban, banca, ...fisa } = input;

    const { data, error } = await db
      .from("employees")
      .update({ ...fisa, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw error;
    if (data === null)
      throw notFound("Fișa de angajat nu a fost găsită sau nu vă este accesibilă.");

    await salveazaDateSensibile(ctx.tenant.organizationId, id, ctx.user.id, cnp, iban, banca);
    revalidatePath("/angajati");
    revalidatePath(`/angajati/${id}`);
    return { id };
  },
});

export const creeazaContract = createAction({
  name: "employees.contract.create",
  permission: "employees:create",
  minScope: "all",
  input: creeazaContractSchema,
  audit: {
    action: "create",
    entityType: "employment_contract",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "employee_id",
      "parent_contract_id",
      "este_act_aditional",
      "numar",
      "data_contract",
      "valabil_de_la",
      "valabil_pana",
      "contract_duration",
      "motiv_determinat",
      "norma_ore_saptamana",
      "norma_ore_zi",
      "work_mode",
      "special_regime",
      "loc_telemunca",
      "loc_munca",
      "department_id",
      "job_position_id",
      "conditii_munca",
      "moneda",
      "zile_concediu_anual",
      "perioada_proba_zile",
      "preaviz_zile",
    ],
  },
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("employment_contracts")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        status: "proiect",
        cod_revisal: null,
        incetat_la: null,
        motiv_incetare: null,
        temei_incetare: null,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) throw error;

    revalidatePath(`/angajati/${input.employee_id}`);
    return { id: data.id };
  },
});

export const inceteazaContract = createAction({
  name: "employees.contract.terminate",
  permission: "employees:update",
  minScope: "all",
  input: incetareContractSchema,
  audit: {
    action: "update",
    entityType: "employment_contract",
    entityId: (input) => input.contract_id,
    allow: ["contract_id", "incetat_la", "temei_incetare", "motiv_incetare", "arhiveaza_fisa"],
  },
  handler: async (ctx, input): Promise<Readonly<{ id: string; employee_id: string }>> => {
    const db = await createServerSupabase();
    const { data: contract, error: eroareCitire } = await db
      .from("employment_contracts")
      .select("id, employee_id, status, valabil_de_la, este_act_aditional")
      .eq("id", input.contract_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) throw eroareCitire;
    if (contract === null) throw notFound("Contractul selectat nu a fost găsit.");
    if (contract.status === "incetat") {
      throw businessRule("Contractul este deja încetat. Consultați istoricul angajatului.");
    }
    if (input.incetat_la < contract.valabil_de_la) {
      throw businessRule("Data încetării nu poate fi anterioară datei de început a contractului.");
    }

    const { error: eroareContract } = await db
      .from("employment_contracts")
      .update({
        status: "incetat",
        incetat_la: input.incetat_la,
        motiv_incetare: input.motiv_incetare,
        temei_incetare: input.temei_incetare,
        updated_by: ctx.user.id,
      })
      .eq("id", contract.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (eroareContract !== null) throw eroareContract;

    // Fișa NU se șterge: rămâne cu istoricul complet, doar iese din efectiv.
    const { count, error: eroareRamase } = await db
      .from("employment_contracts")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", contract.employee_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "activ")
      .eq("este_act_aditional", false)
      .is("deleted_at", null);
    if (eroareRamase !== null) throw eroareRamase;

    if ((count ?? 0) === 0) {
      const { error: eroareFisa } = await db
        .from("employees")
        .update({
          status: input.arhiveaza_fisa ? "arhivat" : "incetat",
          terminated_on: input.incetat_la,
          updated_by: ctx.user.id,
        })
        .eq("id", contract.employee_id)
        .eq("organization_id", ctx.tenant.organizationId);
      if (eroareFisa !== null) throw eroareFisa;
    }

    revalidatePath("/angajati");
    revalidatePath(`/angajati/${contract.employee_id}`);
    return { id: contract.id, employee_id: contract.employee_id };
  },
});

export const dezvaluieDateSensibile = createAction({
  name: "employees.sensitive.reveal",
  permission: "employees:read",
  minScope: "all",
  input: dezvaluieDateSensibileSchema,
  audit: {
    action: "view",
    entityType: "employee_sensitive_data",
    entityId: (input) => input.employee_id,
    allow: ["employee_id", "camp", "motiv"],
  },
  handler: async (ctx, input): Promise<Readonly<{ camp: "cnp" | "iban"; valoare: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("employee_sensitive_data")
      .select(
        "cnp_ciphertext, cnp_iv, cnp_tag, cnp_key_version, iban_ciphertext, iban_iv, iban_tag, iban_key_version",
      )
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", input.employee_id)
      .is("deleted_at", null)
      .maybeSingle<RandSensibil>();
    if (error !== null) throw error;
    if (data === null) throw notFound("Angajatul nu are date de identificare înregistrate.");

    const valoare =
      input.camp === "cnp"
        ? decripteaza({
            ciphertext: data.cnp_ciphertext,
            iv: data.cnp_iv,
            tag: data.cnp_tag,
            keyVersion: data.cnp_key_version,
          })
        : decripteaza({
            ciphertext: data.iban_ciphertext,
            iv: data.iban_iv,
            tag: data.iban_tag,
            keyVersion: data.iban_key_version,
          });
    if (valoare === null) {
      throw notFound(
        input.camp === "cnp"
          ? "CNP-ul nu este completat pentru acest angajat."
          : "IBAN-ul nu este completat pentru acest angajat.",
      );
    }

    // Tabela cu criptotext nu are trigger generic de audit (S10) — rândul se scrie explicit.
    await writeAuditLog(ctx.supabase, {
      organizationId: ctx.tenant.organizationId,
      action: "view",
      status: "success",
      entityType: "employee_sensitive_data",
      entityId: input.employee_id,
      before: null,
      after: { camp: input.camp, motiv: input.motiv },
      errorCode: null,
      requestId: ctx.requestId,
      meta: await readRequestMeta(),
    });

    return { camp: input.camp, valoare };
  },
});
