"use server";

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  cheltuialaNouaSchema,
  decizieCheltuialaSchema,
  decizieDeplasareSchema,
  deconteazaDeplasareSchema,
  deplasareNouaSchema,
  etapaNouaSchema,
  politicaNouaSchema,
  stergeCiornaDeplasareSchema,
  trimiteDeplasareSchema,
} from "@/schemas/per-diem";

/**
 * Rutele de portal atinse de orice mișcare pe o deplasare.
 *
 * Angajatul își urmărește deplasarea din portal; fără căile astea, adaugă o
 * etapă și se întoarce la o pagină din care lipsește. Nu e o eroare — e cache-ul
 * de Router, iar tăcerea lui e felul în care defectul trece de review.
 */
const CAI_PORTAL_DIURNA: readonly string[] = ["/portal", "/portal/diurna-mea"];

import { traduEroare } from "./erori";

/**
 * Fișa proprie de angajat, rezolvată cu clientul admin.
 *
 * Rolul `employee` are `employees:read = none` — politica `employees_select`
 * cade pe ELSE false, deci nici propria fișă nu e vizibilă prin clientul
 * utilizatorului. Filtru explicit pe organizație + utilizator + fișă
 * principală, exact ca în `concedii/actions.ts`.
 */
async function fisaProprie(organizationId: string, userId: string): Promise<string> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("employees")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  if (data === null) {
    throw businessRule(
      "Contul dvs. nu este legat de o fișă de angajat activă în această organizație. Contactați administratorul.",
    );
  }
  return data.id;
}

export const creeazaDeplasare = createAction({
  name: "per_diem.trip.create",
  feature: "per_diem",
  permission: "per_diem:create",
  minScope: "own",
  input: deplasareNouaSchema,
  audit: {
    action: "create",
    entityType: "business_trip",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "employee_id",
      "scop",
      "country_id",
      "plecare_la",
      "sosire_la",
      "mijloc_transport",
      "avans_acordat",
      "moneda_avans",
      "detasare_transnationala",
    ],
  },
  revalidate: ["/diurna", ...CAI_PORTAL_DIURNA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Cu scope „own” (angajatul), un `employee_id` explicit ar însemna o
    // cerere pentru altcineva — respins înainte de a atinge baza.
    if (ctx.scope !== "all" && input.employee_id !== null) {
      throw businessRule("Nu aveți dreptul să creați o deplasare pentru alt angajat.");
    }

    const employeeId =
      input.employee_id ?? (await fisaProprie(ctx.tenant.organizationId, ctx.user.id));

    // NU se trimit: `status` (WITH CHECK cere „ciorna”), `approval_task_id`,
    // `numar_document` (WITH CHECK cere NULL pentru amândouă), `vehicle_id`
    // (legarea la un vehicul rămâne în afara acestei faze), `created_by` /
    // `updated_by` (le pune `internal.set_actor()`).
    const { data, error } = await ctx.supabase
      .from("business_trips")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: employeeId,
        scop: input.scop,
        country_id: input.country_id,
        localitate: input.localitate,
        plecare_la: input.plecare_la,
        sosire_la: input.sosire_la,
        mijloc_transport: input.mijloc_transport,
        km_parcursi: input.km_parcursi,
        avans_acordat: input.avans_acordat,
        moneda_avans: input.moneda_avans,
        curs_diurna: input.curs_diurna,
        observatii: input.observatii,
        detasare_transnationala: input.detasare_transnationala,
        stat_gazda_country_id: input.stat_gazda_country_id,
        salariu_minim_stat_gazda: input.salariu_minim_stat_gazda,
        moneda_salariu_minim: input.moneda_salariu_minim,
        status: "ciorna",
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const trimiteDeplasare = createAction({
  name: "per_diem.trip.submit",
  feature: "per_diem",
  permission: "per_diem:update",
  minScope: "own",
  input: trimiteDeplasareSchema,
  audit: {
    action: "update",
    entityType: "business_trip",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/diurna", "/diurna/aprobari", ...CAI_PORTAL_DIURNA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("business_trips")
      .update({ status: "in_aprobare" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .in("status", ["ciorna", "respinsa"])
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    // Un UPDATE respins de clauza USING a RLS nu produce eroare — afectează
    // ZERO rânduri, tăcut (ex. cineva a trimis-o deja din altă filă). Rândul
    // gol trebuie tratat explicit ca CONFLICT, nu ca succes silențios.
    if (data === null) {
      throw businessRule(
        "Deplasarea nu mai poate fi trimisă spre aprobare: fie nu a fost găsită, fie starea ei s-a schimbat între timp.",
      );
    }
    return { id: data.id };
  },
});

export const stergeCiornaDeplasare = createAction({
  name: "per_diem.trip.discard",
  feature: "per_diem",
  permission: "per_diem:delete",
  minScope: "own",
  input: stergeCiornaDeplasareSchema,
  audit: {
    action: "delete",
    entityType: "business_trip",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/diurna", ...CAI_PORTAL_DIURNA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("business_trips")
      .update({ deleted_at: ctx.now.toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "ciorna")
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Ciorna nu poate fi ștearsă: fie nu a fost găsită, fie a fost între timp trimisă spre aprobare.",
      );
    }
    return { id: data.id };
  },
});

export const decideDeplasare = createAction({
  name: "per_diem.trip.decide",
  feature: "per_diem",
  permission: "per_diem:approve",
  minScope: "team",
  input: decizieDeplasareSchema,
  audit: {
    // Decizia e un UPDATE de status; nu există `audit_action = "approve"`.
    action: "update",
    entityType: "business_trip",
    entityId: (input) => input.id,
    allow: ["id", "decizie"],
  },
  revalidate: ["/diurna", "/diurna/aprobari", ...CAI_PORTAL_DIURNA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("business_trips")
      .update({ status: input.decizie })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "in_aprobare")
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Decizia nu a putut fi înregistrată: deplasarea nu mai este în aprobare — poate a fost deja decisă din altă parte.",
      );
    }
    return { id: data.id };
  },
});

export const deconteazaDeplasare = createAction({
  name: "per_diem.trip.settle",
  feature: "per_diem",
  permission: "per_diem:approve",
  minScope: "team",
  input: deconteazaDeplasareSchema,
  audit: {
    action: "update",
    entityType: "business_trip",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/diurna", "/diurna/aprobari", ...CAI_PORTAL_DIURNA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("business_trips")
      .update({ status: "decontata" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "aprobata")
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Deplasarea nu poate fi marcată decontată: fie nu a fost găsită, fie nu mai e în starea „aprobată”.",
      );
    }
    return { id: data.id };
  },
});

export const adaugaEtapa = createAction({
  name: "per_diem.leg.add",
  feature: "per_diem",
  permission: "per_diem:update",
  minScope: "own",
  input: etapaNouaSchema,
  audit: {
    action: "create",
    entityType: "business_trip_leg",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["business_trip_id", "from_country_id", "to_country_id", "plecare_la", "sosire_la"],
  },
  revalidate: ["/diurna", ...CAI_PORTAL_DIURNA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // `ordine` nu vine din formular: se calculează din etapele existente,
    // exact ca numărul curent + 1. Indexul unic `business_trip_legs_ordine_uk`
    // rămâne plasa de siguranță pentru o cursă concurentă.
    const { data: ultima, error: eroareUltima } = await ctx.supabase
      .from("business_trip_legs")
      .select("ordine")
      .eq("business_trip_id", input.business_trip_id)
      .is("deleted_at", null)
      .order("ordine", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eroareUltima !== null) throw eroareUltima;
    const ordineUrmatoare = (ultima?.ordine ?? 0) + 1;

    const { data, error } = await ctx.supabase
      .from("business_trip_legs")
      .insert({
        organization_id: ctx.tenant.organizationId,
        business_trip_id: input.business_trip_id,
        ordine: ordineUrmatoare,
        from_country_id: input.from_country_id,
        to_country_id: input.to_country_id,
        plecare_la: input.plecare_la,
        sosire_la: input.sosire_la,
        mijloc_transport: input.mijloc_transport,
        localitate_sosire: input.localitate_sosire,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const adaugaCheltuiala = createAction({
  name: "per_diem.expense.add",
  feature: "per_diem",
  permission: "per_diem:update",
  minScope: "own",
  input: cheltuialaNouaSchema,
  audit: {
    action: "create",
    entityType: "trip_expense",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["business_trip_id", "tip", "data_cheltuielii", "suma", "moneda", "curs_valutar"],
  },
  revalidate: ["/diurna", ...CAI_PORTAL_DIURNA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // NU se trimit: `suma_lei` (GENERATED ALWAYS), `aprobata`, `aprobata_de`,
    // `aprobata_la`, `motiv_respingere` (WITH CHECK le cere false/NULL la
    // inserare) — decizia asupra cheltuielii e o operațiune separată, a unui
    // aprobator.
    const { data, error } = await ctx.supabase
      .from("trip_expenses")
      .insert({
        organization_id: ctx.tenant.organizationId,
        business_trip_id: input.business_trip_id,
        tip: input.tip,
        descriere: input.descriere,
        data_cheltuielii: input.data_cheltuielii,
        suma: input.suma,
        moneda: input.moneda,
        curs_valutar: input.curs_valutar,
        document_tip: input.document_tip,
        document_numar: input.document_numar,
        document_cale: input.document_cale,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

/**
 * O versiune nouă de politică. NU e un UPDATE peste cea veche: politica e
 * versionată prin `valabil_de_la`, exact ca baremul pe țări — vechea versiune
 * rămâne, ca deplasările trecute să se calculeze în continuare cu regulile de
 * atunci. `valabil_pana` rămâne NULL: e capătul deschis, valabil până la
 * următoarea versiune (sau la nesfârșit).
 */
export const creeazaPolitica = createAction({
  name: "per_diem.policy.create",
  feature: "per_diem",
  permission: "per_diem:update",
  minScope: "all",
  input: politicaNouaSchema,
  audit: {
    action: "create",
    entityType: "per_diem_policy",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "denumire",
      "country_id_intern",
      "moneda_interna",
      "diurna_interna_zi",
      "prag_ore_minim",
      "prag_ore_zi_intreaga",
      "valabil_de_la",
    ],
  },
  revalidate: [
    "/diurna/politica",
    "/diurna",
    "/diurna/noua",
    ...CAI_PORTAL_DIURNA,
    "/portal/diurna-mea/noua",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("per_diem_policies")
      .insert({
        organization_id: ctx.tenant.organizationId,
        denumire: input.denumire,
        country_id_intern: input.country_id_intern,
        moneda_interna: input.moneda_interna,
        diurna_interna_zi: input.diurna_interna_zi,
        diurna_baza_legala_interna: input.diurna_baza_legala_interna,
        multiplu_plafon_neimpozabil: input.multiplu_plafon_neimpozabil,
        multiplu_diurna_externa: input.multiplu_diurna_externa,
        categorie_barem: input.categorie_barem,
        prag_ore_minim: input.prag_ore_minim,
        prag_ore_zi_intreaga: input.prag_ore_zi_intreaga,
        fractiune_zi_partiala: input.fractiune_zi_partiala,
        acorda_diurna_ziua_trecerii: input.acorda_diurna_ziua_trecerii,
        regula_tara_trecere: input.regula_tara_trecere,
        tarif_km_auto_personal: input.tarif_km_auto_personal,
        moneda_tarif_km: input.moneda_tarif_km,
        plafon_salarii_baza_luna: input.plafon_salarii_baza_luna,
        valabil_de_la: input.valabil_de_la,
        observatii: input.observatii,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

// ── Corectarea a ce s-a scris deja ───────────────────────────────────────
//
// Cele patru acțiuni de mai jos închid fundătura semnalată de audit: până
// acum o deplasare salvată nu putea fi CORECTATĂ niciodată (opt acțiuni,
// niciun UPDATE de câmpuri), o etapă cu țările inversate rămânea pe fișă
// pentru totdeauna și schimba calculul, iar `decizieCheltuialaSchema` era un
// contract mort — nicio cheltuială nu putea deveni „aprobată”, deci suma
// cheltuielilor din decont era STRUCTURAL zero.
//
// Schemele locale stau AICI, nu în `src/schemas/per-diem.ts`: un fișier
// `"use server"` nu poate exporta decât funcții asincrone — Next refuză
// build-ul la prima constantă exportată, iar `tsc` tace. Neexportate, sunt
// contracte private ale acestor acțiuni.

/**
 * Aceleași câmpuri ca la creare, plus `id`.
 *
 * Intersecție, nu o listă rescrisă: `deplasareNouaSchema` poartă și regulile
 * încrucișate (sosirea după plecare, moneda obligatorie când există avans,
 * tripletul detașării) — rescrise aici, ar fi divergat la prima schimbare de
 * validare, iar divergența ar fi fost tăcută.
 */
const actualizeazaDeplasareSchema = z
  .object({ id: z.uuid("Deplasarea selectată nu este validă.") })
  .and(deplasareNouaSchema);

const stergeEtapaSchema = z.object({ id: z.uuid("Etapa selectată nu este validă.") });

const stergeCheltuialaSchema = z.object({ id: z.uuid("Cheltuiala selectată nu este validă.") });

export const actualizeazaDeplasare = createAction({
  name: "per_diem.trip.update",
  feature: "per_diem",
  permission: "per_diem:update",
  minScope: "own",
  input: actualizeazaDeplasareSchema,
  audit: {
    action: "update",
    entityType: "business_trip",
    entityId: (input) => input.id,
    allow: [
      "id",
      "scop",
      "country_id",
      "plecare_la",
      "sosire_la",
      "mijloc_transport",
      "km_parcursi",
      "avans_acordat",
      "moneda_avans",
      "curs_diurna",
      "detasare_transnationala",
    ],
  },
  revalidate: (input) => [
    "/diurna",
    `/diurna/${input.id}`,
    `/diurna/${input.id}/decont`,
    ...CAI_PORTAL_DIURNA,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // `employee_id` NU se rescrie, deși schema îl conține (e aceeași cu cea de
    // creare, unde `null` înseamnă „pentru mine”). Mutarea unei deplasări de
    // la un angajat la altul e o schimbare de proprietar, nu o corectură de
    // date, și ar trece pe lângă verificarea de scope făcută la creare.
    // La fel `status`, `numar_document` și `approval_task_id`: starea se
    // schimbă prin acțiunile ei, nu printr-un formular de editare.
    const { data, error } = await ctx.supabase
      .from("business_trips")
      .update({
        scop: input.scop,
        country_id: input.country_id,
        localitate: input.localitate,
        plecare_la: input.plecare_la,
        sosire_la: input.sosire_la,
        mijloc_transport: input.mijloc_transport,
        km_parcursi: input.km_parcursi,
        avans_acordat: input.avans_acordat,
        moneda_avans: input.moneda_avans,
        curs_diurna: input.curs_diurna,
        observatii: input.observatii,
        detasare_transnationala: input.detasare_transnationala,
        stat_gazda_country_id: input.stat_gazda_country_id,
        salariu_minim_stat_gazda: input.salariu_minim_stat_gazda,
        moneda_salariu_minim: input.moneda_salariu_minim,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .in("status", ["ciorna", "respinsa"])
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    // Politica `business_trips_update` lasă UPDATE-ul doar pe „ciorna” și
    // „respinsa” pentru cine are `per_diem:update`; un rând respins de clauza
    // USING nu produce eroare, ci ZERO rânduri. Fără verificarea asta,
    // ecranul ar anunța o corectură care nu s-a scris niciodată.
    if (data === null) {
      throw businessRule(
        "Deplasarea nu mai poate fi modificată: fie nu a fost găsită, fie a ieșit între timp din starea de ciornă sau de deplasare respinsă.",
      );
    }
    return { id: data.id };
  },
});

export const stergeEtapa = createAction({
  name: "per_diem.leg.remove",
  feature: "per_diem",
  permission: "per_diem:update",
  minScope: "own",
  input: stergeEtapaSchema,
  audit: {
    action: "delete",
    entityType: "business_trip_leg",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/diurna", ...CAI_PORTAL_DIURNA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Ștergere logică: indexul unic pe `ordine` e parțial
    // (`where deleted_at is null`), deci numărul de ordine se eliberează
    // singur, iar etapa următoare adăugată nu se ciocnește de cea scoasă.
    const { data, error } = await ctx.supabase
      .from("business_trip_legs")
      .update({ deleted_at: ctx.now.toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Etapa nu a putut fi ștearsă: fie a fost deja scoasă, fie deplasarea a ieșit din starea în care traseul se mai poate modifica.",
      );
    }
    return { id: data.id };
  },
});

export const stergeCheltuiala = createAction({
  name: "per_diem.expense.remove",
  feature: "per_diem",
  permission: "per_diem:update",
  minScope: "own",
  input: stergeCheltuialaSchema,
  audit: {
    action: "delete",
    entityType: "trip_expense",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/diurna", ...CAI_PORTAL_DIURNA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // `aprobata = false` explicit, deși politica o cere oricum pentru cine are
    // doar `update`: o cheltuială aprobată INTRĂ în totalul decontului, iar
    // scoaterea ei ar schimba tăcut o sumă deja semnată. Se respinge întâi
    // aprobarea, apoi se șterge.
    const { data, error } = await ctx.supabase
      .from("trip_expenses")
      .update({ deleted_at: ctx.now.toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("aprobata", false)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Cheltuiala nu a putut fi ștearsă: fie a fost deja scoasă, fie e aprobată și intră în total. Respingeți întâi aprobarea, apoi ștergeți-o.",
      );
    }
    return { id: data.id };
  },
});

/**
 * Decizia asupra unei cheltuieli — aprobare sau respingere cu motiv.
 *
 * Fără ea, `decont/page.tsx` însuma doar rândurile cu `aprobata = true`, iar
 * nimic din produs nu putea pune vreodată steagul: decontul arăta permanent
 * „Nicio cheltuială aprobată” și un total mai mic cu exact suma cheltuielilor.
 *
 * ATENȚIE la granița bazei: `trip_expenses_update` cere în clauza WITH CHECK
 * `per_diem:update`, nu `per_diem:approve`. Un `manager` are din seed
 * `per_diem = team {read, approve}` și NICIUN `update` — pentru el UPDATE-ul
 * trece de USING și cade pe WITH CHECK, adică zero rânduri, fără eroare.
 * Ecranul nu-i mai arată butoanele, iar mesajul de mai jos numește cauza în
 * loc să lase impresia unui defect.
 */
export const decideCheltuiala = createAction({
  name: "per_diem.expense.decide",
  feature: "per_diem",
  permission: "per_diem:approve",
  minScope: "team",
  input: decizieCheltuialaSchema,
  audit: {
    action: "update",
    entityType: "trip_expense",
    entityId: (input) => input.id,
    allow: ["id", "decizie", "motiv_respingere"],
  },
  revalidate: ["/diurna", ...CAI_PORTAL_DIURNA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const aproba = input.decizie === "aproba";
    if (!aproba && (input.motiv_respingere ?? "").trim().length === 0) {
      throw businessRule(
        "Respingerea unei cheltuieli cere un motiv scris — el ajunge pe fișa deplasării, la angajatul care a înregistrat-o.",
      );
    }

    // `trip_expenses_aprobare_ck` cere tripletul complet sau tripletul gol:
    // `aprobata = true` fără `aprobata_de` și `aprobata_la` e respins de bază.
    const modificari = aproba
      ? {
          aprobata: true,
          aprobata_de: ctx.user.id,
          aprobata_la: ctx.now.toISOString(),
          motiv_respingere: null,
        }
      : {
          aprobata: false,
          aprobata_de: null,
          aprobata_la: null,
          motiv_respingere: input.motiv_respingere,
        };

    const { data, error } = await ctx.supabase
      .from("trip_expenses")
      .update(modificari)
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Decizia nu a putut fi înregistrată: fie cheltuiala nu a fost găsită, fie baza cere pentru scrierea ei și dreptul de modificare a deplasărilor, nu doar cel de aprobare. Cereți administratorului organizației să decidă.",
      );
    }
    return { id: data.id };
  },
});
