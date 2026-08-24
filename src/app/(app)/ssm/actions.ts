"use server";

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { notFound } from "@/lib/actions/errors";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  accidentNouSchema,
  actualizeazaStingatorSchema,
  autorizatieNominalaSchema,
  comunicaItmSchema,
  eipSchema,
  finalizeazaCercetareSchema,
  fisaAptitudineSchema,
  instruireBlocSchema,
  stingatorSchema,
  verificareStingatorSchema,
} from "@/schemas/ssm";

import { traduEroare } from "./erori";

/**
 * Toate acțiunile de mai jos NU trimit `created_by`/`updated_by`: spre
 * deosebire de `vehicles`/`vehicle_documents` din flotă, aici triggerul
 * `internal.set_actor` (atașat pe toate cele 26 de tabele din 0011, la
 * finalul migrării) le completează singur din `auth.uid()`. Politica de
 * INSERT nu le cere nominal în `WITH CHECK`. La fel, `organization_id` îl pune
 * mereu acțiunea din `ctx.tenant.organizationId`, niciodată clientul.
 */

export const inregistreazaInstruireBloc = createAction({
  name: "ssm.training.bulkCreate",
  feature: "ssm",
  permission: "ssm:create",
  minScope: "team",
  input: instruireBlocSchema,
  audit: {
    action: "create",
    entityType: "ssm_training",
    // Batch: nu există UN singur id de entitate. Lista de angajați rămâne în
    // `after`, prin allow-list.
    allow: [
      "training_type_id",
      "data_instruirii",
      "durata_ore",
      "lector_employee_id",
      "lector_extern",
      "employee_ids",
    ],
  },
  revalidate: ["/ssm", "/ssm/instruiri"],
  handler: async (ctx, input): Promise<Readonly<{ ids: readonly string[] }>> => {
    const db = await createServerSupabase();
    // NU se trimite `urmatoarea_scadenta`: triggerul BEFORE
    // `internal.ssm_training_calc` o calculează DOAR când primește `null` —
    // trimisă din client, ar bloca periodicitatea legală configurată.
    const { data, error } = await db
      .from("ssm_trainings")
      .insert(
        input.employee_ids.map((employeeId) => ({
          organization_id: ctx.tenant.organizationId,
          employee_id: employeeId,
          training_type_id: input.training_type_id,
          data_instruirii: input.data_instruirii,
          durata_ore: input.durata_ore,
          lector_employee_id: input.lector_employee_id,
          lector_extern: input.lector_extern,
          tematica: input.tematica,
          materiale: input.materiale,
          test_punctaj: input.test_punctaj,
          observatii: input.observatii,
        })),
      )
      .select("id");
    if (error !== null) traduEroare(error);

    return { ids: (data ?? []).map((r) => r.id) };
  },
});

export const adaugaFisaAptitudine = createAction({
  name: "ssm.healthExam.create",
  feature: "ssm",
  permission: "ssm:create",
  minScope: "team",
  input: fisaAptitudineSchema,
  audit: {
    action: "create",
    entityType: "occupational_health_exam",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    // Art. 9 GDPR: `rezultat`, `medic`, `unitate_medicala`, `cost` NU intră în
    // audit_logs — allow-list STRICTĂ, nu deny-list.
    allow: ["employee_id", "tip", "data_examinarii", "valabil_pana", "numar_fisa"],
  },
  revalidate: ["/ssm", "/ssm/medicina-muncii"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // NU se trimite `observatii`: schema deja nu-l are (art. 9 GDPR — fără
    // diagnostic). Restricția de muncă se scrie SINGURĂ de triggerul AFTER
    // `internal.ssm_exam_sync` — nu se inserează manual în
    // `employee_work_restrictions`, altfel 23505 pe indexul unic parțial.
    const { data, error } = await db
      .from("occupational_health_exams")
      .insert({ ...input, organization_id: ctx.tenant.organizationId })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const inregistreazaAccident = createAction({
  name: "ssm.accident.create",
  feature: "ssm",
  permission: "ssm:create",
  minScope: "team",
  input: accidentNouSchema,
  audit: {
    action: "create",
    entityType: "work_accident",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "numar_intern",
      "employee_id",
      "data_producerii",
      "ora_producerii",
      "tip",
      "zile_incapacitate",
    ],
  },
  revalidate: ["/ssm", "/ssm/accidente"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // NU se trimite `termen_comunicare_ore`: triggerul BEFORE
    // `internal.ssm_accident_guard` îl completează din parametrii legali
    // (implicit 24 de ore), DOAR când primește `null`.
    const { data, error } = await db
      .from("work_accidents")
      .insert({ ...input, organization_id: ctx.tenant.organizationId })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const comunicaAccidentLaItm = createAction({
  name: "ssm.accident.communicateItm",
  feature: "ssm",
  permission: "ssm:update",
  minScope: "team",
  input: comunicaItmSchema,
  audit: {
    action: "update",
    entityType: "work_accident",
    entityId: (input) => input.id,
    allow: ["id", "comunicat_la_itm_la", "numar_proces_verbal"],
  },
  revalidate: ["/ssm", "/ssm/accidente"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("work_accidents")
      .update({
        comunicat_la_itm_la: input.comunicat_la_itm_la,
        numar_proces_verbal: input.numar_proces_verbal,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    // Un UPDATE respins de USING-ul politicii RLS nu aruncă eroare — afectează
    // ZERO rânduri, tăcut. Un rezultat gol aici înseamnă că accidentul nu
    // există sau nu e vizibil pentru scope-ul „team" al apelantului, nu că
    // „a mers".
    if (data === null) throw notFound("Accidentul nu a fost găsit sau nu aveți acces la el.");

    return { id: data.id };
  },
});

export const finalizeazaCercetare = createAction({
  name: "ssm.accident.finalizeInvestigation",
  feature: "ssm",
  permission: "ssm:update",
  minScope: "team",
  input: finalizeazaCercetareSchema,
  audit: {
    action: "update",
    entityType: "work_accident",
    entityId: (input) => input.id,
    allow: ["id", "cercetare_finalizata_la", "zile_incapacitate"],
  },
  revalidate: ["/ssm", "/ssm/accidente"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("work_accidents")
      .update({
        cercetare_finalizata_la: input.cercetare_finalizata_la,
        urmari: input.urmari,
        zile_incapacitate: input.zile_incapacitate,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Accidentul nu a fost găsit sau nu aveți acces la el.");

    return { id: data.id };
  },
});

export const adaugaStingator = createAction({
  name: "ssm.extinguisher.create",
  feature: "ssm",
  permission: "ssm:create",
  minScope: "team",
  input: stingatorSchema,
  audit: {
    action: "create",
    entityType: "fire_extinguisher",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["cod", "tip", "cladire", "locatie", "status"],
  },
  revalidate: ["/ssm", "/ssm/stingatoare"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // NU se trimit cele trei `scadenta_*`: triggerul BEFORE
    // `internal.ssm_extinguisher_calc` le rescrie INTEGRAL la fiecare
    // INSERT/UPDATE, din `ultima_*` și periodicitățile legale.
    const { data, error } = await db
      .from("fire_extinguishers")
      .insert({ ...input, organization_id: ctx.tenant.organizationId })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const actualizeazaStingator = createAction({
  name: "ssm.extinguisher.update",
  feature: "ssm",
  permission: "ssm:update",
  minScope: "team",
  input: actualizeazaStingatorSchema,
  audit: {
    action: "update",
    entityType: "fire_extinguisher",
    entityId: (input) => input.id,
    allow: ["id", "cod", "tip", "cladire", "locatie", "status"],
  },
  revalidate: ["/ssm", "/ssm/stingatoare"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { id, ...camp } = input;
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("fire_extinguishers")
      .update(camp)
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Stingătorul nu a fost găsit sau nu aveți acces la el.");

    return { id: data.id };
  },
});

export const inregistreazaVerificareStingator = createAction({
  name: "ssm.extinguisher.check",
  feature: "ssm",
  permission: "ssm:create",
  minScope: "team",
  input: verificareStingatorSchema,
  audit: {
    action: "create",
    entityType: "fire_extinguisher_check",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["extinguisher_id", "tip_verificare", "data", "firma_autorizata", "rezultat"],
  },
  revalidate: ["/ssm", "/ssm/stingatoare"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // Se inserează DOAR aici, în `fire_extinguisher_checks`. Triggerul AFTER
    // `internal.ssm_check_apply` actualizează singur `ultima_*` pe
    // `fire_extinguishers` (și, prin triggerul lui BEFORE, scadențele) — fără
    // un al doilea UPDATE din acțiune.
    const { data, error } = await db
      .from("fire_extinguisher_checks")
      .insert({ ...input, organization_id: ctx.tenant.organizationId })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const predaEip = createAction({
  name: "ssm.ppe.issue",
  feature: "ssm",
  permission: "ssm:create",
  minScope: "team",
  input: eipSchema,
  audit: {
    action: "create",
    entityType: "ppe_issuance",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["employee_id", "articol", "cod_articol", "cantitate", "data_predarii"],
  },
  revalidate: ["/ssm", "/ssm/eip"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // NU se trimite `data_inlocuirii`: triggerul BEFORE `internal.ssm_ppe_calc`
    // o calculează din durata de utilizare (a articolului sau, implicit, din
    // parametrul legal), DOAR când primește `null`.
    const { data, error } = await db
      .from("ppe_issuances")
      .insert({ ...input, organization_id: ctx.tenant.organizationId })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

/**
 * Cele două coloane ale registrului EIP care se CITEAU și nu se puteau scrie
 * din nicio parte a aplicației.
 *
 * `ppe_issuances.returnat_la` și `ppe_issuances.semnatura_confirmata` intră
 * amândouă în `COLOANE_EIP` (`src/lib/queries/ssm.ts`) și se randau în listă,
 * dar singura acțiune pe tabelă era `ssm.ppe.issue`, care trimite mereu
 * `semnatura_confirmata: false` și nu atinge `returnat_la`. Rezultatul: două
 * coloane care rămâneau „—" și „Nesemnat" pe toate rândurile, la infinit.
 *
 * Amândouă primesc valoarea ca INTRARE, nu ca fapt implicit („azi", „true"):
 * o predare se returnează la data reală de pe bon, iar o bifă pusă din greșeală
 * pe omul greșit trebuie să se poată da înapoi. De aceea `returnat_la` acceptă
 * `null` și `confirmata` e boolean, nu un simplu „marchează".
 */
const returnareEipSchema = z.object({
  id: z.uuid(),
  returnat_la: z
    .union([z.iso.date(), z.literal(""), z.null()])
    .transform((v) => (v === "" ? null : v))
    .default(null),
});

export const marcheazaEipReturnat = createAction({
  name: "ssm.ppe.return",
  feature: "ssm",
  permission: "ssm:update",
  minScope: "team",
  input: returnareEipSchema,
  audit: {
    action: "update",
    entityType: "ppe_issuance",
    entityId: (input) => input.id,
    allow: ["id", "returnat_la"],
  },
  revalidate: ["/ssm", "/ssm/eip"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("ppe_issuances")
      .update({ returnat_la: input.returnat_la })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    // Un UPDATE respins de USING-ul politicii afectează ZERO rânduri, fără
    // eroare: fără `.select()` ecranul ar anunța o returnare care nu s-a scris.
    if (data === null) {
      throw notFound("Predarea de echipament nu a fost găsită sau nu aveți acces la ea.");
    }

    return { id: data.id };
  },
});

const confirmarePrimireEipSchema = z.object({
  id: z.uuid(),
  confirmata: z.boolean(),
});

export const confirmaPrimireaEip = createAction({
  name: "ssm.ppe.confirmSignature",
  feature: "ssm",
  permission: "ssm:update",
  minScope: "team",
  input: confirmarePrimireEipSchema,
  audit: {
    action: "update",
    entityType: "ppe_issuance",
    entityId: (input) => input.id,
    allow: ["id", "confirmata"],
  },
  revalidate: ["/ssm", "/ssm/eip"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("ppe_issuances")
      .update({ semnatura_confirmata: input.confirmata })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Predarea de echipament nu a fost găsită sau nu aveți acces la ea.");
    }

    return { id: data.id };
  },
});

export const adaugaAutorizatieNominala = createAction({
  name: "ssm.personnelAuth.create",
  feature: "ssm",
  permission: "ssm:create",
  minScope: "team",
  input: autorizatieNominalaSchema,
  audit: {
    action: "create",
    entityType: "personnel_authorization",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["employee_id", "tip", "grupa", "numar", "emitent", "valabil_pana"],
  },
  revalidate: ["/ssm", "/ssm/autorizatii"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("personnel_authorizations")
      .insert({ ...input, organization_id: ctx.tenant.organizationId })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

/**
 * Suspendarea unei autorizații nominale și ridicarea ei.
 *
 * `personnel_authorizations.suspendata_la` se citea în listă („Suspendată
 * 12.05.2026") și nu se putea scrie de nicăieri: formularul de adăugare trimite
 * mereu `null`, iar altă acțiune pe tabelă nu exista. O autorizație suspendată
 * e o interdicție de lucru — și e folosită ca atare de baza de date: funcția
 * `app.iscir_valid` din 0011 cere `a.suspendata_la is null` ca să accepte
 * desemnarea unui angajat pe un echipament ISCIR. Cât timp coloana nu se putea
 * scrie, interdicția nu se putea pune.
 *
 * O singură acțiune pentru amândouă sensurile, cu data ca intrare: ridicarea e
 * `suspendata_la: null`. Două acțiuni ar fi însemnat două locuri de ținut în
 * sincron pentru aceeași coloană.
 */
const suspendareAutorizatieSchema = z.object({
  id: z.uuid(),
  suspendata_la: z
    .union([z.iso.date(), z.literal(""), z.null()])
    .transform((v) => (v === "" ? null : v))
    .default(null),
});

export const schimbaSuspendareaAutorizatiei = createAction({
  name: "ssm.personnelAuth.suspend",
  feature: "ssm",
  permission: "ssm:update",
  minScope: "team",
  input: suspendareAutorizatieSchema,
  audit: {
    action: "update",
    entityType: "personnel_authorization",
    entityId: (input) => input.id,
    allow: ["id", "suspendata_la"],
  },
  revalidate: ["/ssm", "/ssm/autorizatii"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("personnel_authorizations")
      .update({ suspendata_la: input.suspendata_la })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Autorizația nu a fost găsită sau nu aveți acces la ea.");
    }

    return { id: data.id };
  },
});

export interface TipInstruireNomenclator {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly domeniu: "ssm" | "psi";
  readonly obligatoriu: boolean;
}

/**
 * Nomenclatorul de tipuri de instruire, ocolind RLS cu `createAdminSupabase`.
 *
 * Necesar pentru scope-ul „own": `ssm_training_types` are `col = null`, deci
 * `app.ssm_acces` cere scope ≥ „team" — un `employee` obișnuit (own) nu poate
 * citi tabela direct, iar fără denumiri dosarul propriu ar afișa doar UUID-uri.
 * Filtru explicit pe `organization_id`, ca la orice folosire a clientului
 * `service_role`. FĂRĂ `revalidate`: `DosarulMeu` o apelează direct dintr-un
 * Server Component, iar `revalidatePath` în timpul randării aruncă.
 */
export const nomenclatorInstruiri = createAction({
  name: "ssm.trainingTypes.read",
  feature: "ssm",
  permission: "ssm:read",
  minScope: "own",
  input: z.object({}),
  audit: {
    action: "view",
    entityType: "ssm_training_type",
    allow: [],
  },
  handler: async (ctx): Promise<readonly TipInstruireNomenclator[]> => {
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("ssm_training_types")
      .select("id, cod, denumire, domeniu, obligatoriu")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("domeniu", { ascending: true })
      .order("denumire", { ascending: true })
      .returns<TipInstruireNomenclator[]>();
    if (error !== null) throw error;

    return data ?? [];
  },
});
