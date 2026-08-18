"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  cheltuialaNouaSchema,
  decizieDeplasareSchema,
  deconteazaDeplasareSchema,
  deplasareNouaSchema,
  etapaNouaSchema,
  politicaNouaSchema,
  stergeCiornaDeplasareSchema,
  trimiteDeplasareSchema,
} from "@/schemas/per-diem";

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
  revalidate: ["/diurna"],
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
  audit: { action: "update", entityType: "business_trip", entityId: (input) => input.id, allow: ["id"] },
  revalidate: ["/diurna", "/diurna/aprobari"],
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
  audit: { action: "delete", entityType: "business_trip", entityId: (input) => input.id, allow: ["id"] },
  revalidate: ["/diurna"],
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
  revalidate: ["/diurna", "/diurna/aprobari"],
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
  audit: { action: "update", entityType: "business_trip", entityId: (input) => input.id, allow: ["id"] },
  revalidate: ["/diurna", "/diurna/aprobari"],
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
  revalidate: ["/diurna"],
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
  revalidate: ["/diurna"],
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
  revalidate: ["/diurna/politica", "/diurna", "/diurna/noua"],
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
