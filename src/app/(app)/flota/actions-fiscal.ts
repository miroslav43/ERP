// src/app/(app)/flota/actions-fiscal.ts
"use server";

/**
 * Fiscalul flotei (0202, F10): regimul fiscal al vehiculului și norma proprie
 * de consum, pe perioade, plus regimul de impozitare al firmei.
 *
 * Fișier separat de `actions.ts`, pe care îl scriu și fazele paralele. „use
 * server”: se exportă DOAR funcții async (capcana 39, `pnpm check:server`).
 *
 * ── CINE SCRIE ──────────────────────────────────────────────────────────────
 * Perioadele: `vehicles:update = all`, EXACT poarta politicilor
 * `vehicle_fiscal_regimes_*` și `vehicle_consumption_norms_*`. Regimul de
 * impozitare: `organizations:update = all`, poarta lui `organizations_update`
 * (`org_admin`). Un UPDATE respins de USING întoarce ZERO rânduri: CONFLICT.
 *
 * ── CE NU FACE ──────────────────────────────────────────────────────────────
 * Nu modifică o perioadă: corectura e ștergere + perioadă nouă (istoricul
 * rămâne în audit). Nu scrie nimic pe statul de plată: avantajul în natură e
 * doar sugestie, pe fișa angajatului.
 */

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import {
  normaConsumNouaSchema,
  regimFiscalNouSchema,
  regimImpozitareSchema,
  stergePerioadaFiscalaSchema,
} from "@/schemas/flota-fiscal";

import { traduEroareFiscal } from "./erori";

/** Unde se vede o perioadă fiscală: fișa vehiculului și pagina fiscală. */
function caiVehicul(vehicleId: string): readonly string[] {
  return [`/flota/${vehicleId}`, "/flota/fiscal"];
}

export const adaugaRegimFiscal = createAction({
  name: "fleet.fiscal_regime.create",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: regimFiscalNouSchema,
  audit: {
    action: "create",
    entityType: "vehicle_fiscal_regime",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "vehicle_id",
      "valabil_de_la",
      "regim",
      "exceptie",
      "motiv",
      "titlu_folosinta",
      "proprietar_employee_id",
      "chirie_lunara",
      "contract_numar",
      "contract_data",
    ],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("vehicle_fiscal_regimes")
      .insert({
        organization_id: ctx.tenant.organizationId,
        vehicle_id: input.vehicle_id,
        valabil_de_la: input.valabil_de_la,
        regim: input.regim,
        exceptie: input.exceptie,
        motiv: input.motiv,
        titlu_folosinta: input.titlu_folosinta,
        proprietar_employee_id: input.proprietar_employee_id,
        chirie_lunara: input.chirie_lunara,
        contract_numar: input.contract_numar,
        contract_data: input.contract_data,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareFiscal(error);
    return { id: data.id };
  },
});

export const stergeRegimFiscal = createAction({
  name: "fleet.fiscal_regime.delete",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: stergePerioadaFiscalaSchema,
  audit: {
    action: "delete",
    entityType: "vehicle_fiscal_regime",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id"],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("vehicle_fiscal_regimes")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("vehicle_id", input.vehicle_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareFiscal(error);
    if (data === null) {
      throw businessRule(
        "Regimul fiscal nu a fost șters: fusese deja șters sau nu aveți dreptul de a-l modifica.",
      );
    }
    return { id: data.id };
  },
});

export const adaugaNormaConsum = createAction({
  name: "fleet.consumption_norm.create",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: normaConsumNouaSchema,
  audit: {
    action: "create",
    entityType: "vehicle_consumption_norm",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["vehicle_id", "valabil_de_la", "l_100km", "decizie_numar", "decizie_data"],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("vehicle_consumption_norms")
      .insert({
        organization_id: ctx.tenant.organizationId,
        vehicle_id: input.vehicle_id,
        valabil_de_la: input.valabil_de_la,
        l_100km: input.l_100km,
        decizie_numar: input.decizie_numar,
        decizie_data: input.decizie_data,
        observatii: input.observatii,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareFiscal(error);
    return { id: data.id };
  },
});

export const stergeNormaConsum = createAction({
  name: "fleet.consumption_norm.delete",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: stergePerioadaFiscalaSchema,
  audit: {
    action: "delete",
    entityType: "vehicle_consumption_norm",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id"],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Foile deja trimise își păstrează norma din instantaneu: ștergerea
    // schimbă doar foile trimise de acum înainte.
    const { data, error } = await ctx.supabase
      .from("vehicle_consumption_norms")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("vehicle_id", input.vehicle_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareFiscal(error);
    if (data === null) {
      throw businessRule(
        "Norma de consum nu a fost ștearsă: fusese deja ștearsă sau nu aveți dreptul de a o modifica.",
      );
    }
    return { id: data.id };
  },
});

export const salveazaRegimImpozitare = createAction({
  name: "fleet.tax_regime.save",
  feature: "fleet",
  permission: "organizations:update",
  minScope: "all",
  input: regimImpozitareSchema,
  audit: {
    action: "update",
    entityType: "organizations",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["regim_impozitare"],
  },
  revalidate: ["/flota/fiscal"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // S1: organizația vine din tenant, nu din payload. Doar coloana asta: un
    // UPDATE cu tot rândul ar rescrie datele firmei din altă pagină.
    const { data, error } = await ctx.supabase
      .from("organizations")
      .update({ regim_impozitare: input.regim_impozitare, updated_by: ctx.user.id })
      .eq("id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareFiscal(error);
    if (data === null) {
      throw businessRule(
        "Regimul de impozitare nu a fost salvat: doar administratorul organizației îl poate schimba.",
      );
    }
    return { id: data.id };
  },
});
