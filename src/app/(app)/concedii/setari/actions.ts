// src/app/(app)/concedii/setari/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { notFound } from "@/lib/actions/errors";
import {
  actualizeazaTipConcediuSchema,
  aplicaDrepturiSchema,
  comutaActivTipConcediuSchema,
  creeazaRegulaConcediuSchema,
  seteazaZileConcediuImplicitSchema,
  stergeRegulaConcediuSchema,
  type CreeazaRegulaConcediuInput,
} from "@/schemas/leave";
import { traduEroare } from "../erori";

const CAI_REVALIDARE = ["/concedii/setari", "/concedii/sold"] as const;

/**
 * `leave_entitlement_rules.categorie` rămâne DOAR o etichetă de audit/afișare
 * (0035_reguli_concediu.sql) — cheia reală e `tip_criteriu` + discriminantul
 * lui. Generată aici, nu cerută de la utilizator, ca să respecte oricum
 * `ler_categorie_ck` (`^[a-z][a-z0-9_]{1,40}$`).
 */
function categorieDinRegula(input: CreeazaRegulaConcediuInput): string {
  switch (input.tip_criteriu) {
    case "vechime":
      return `vechime_${String(input.vechime_ani_min)}_ani`;
    case "conditii_munca":
      return `conditii_${input.valoare_text ?? ""}`;
    case "grad_handicap":
      return `handicap_${input.valoare_text ?? ""}`;
    case "varsta_sub_18":
      return "varsta_sub_18";
    case "departament":
      return "departament";
    case "functie":
      return "functie";
    default: {
      const necunoscut: never = input.tip_criteriu;
      throw new Error(`Criteriu de grilă necunoscut: ${String(necunoscut)}`);
    }
  }
}

// ── Tipuri de concediu ─────────────────────────────────────────────────────────
// `leave_types.reglementat = true` respinge orice UPDATE al câmpurilor de mai
// jos direct în bază (internal.leave_types_protejeaza_reglementat, 0035) — nu
// se repetă garda aici, doar se lasă eroarea (deja în română) să treacă prin
// `traduEroare`.

export const actualizeazaTipConcediu = createAction({
  name: "leave.settings.update_type",
  feature: "leave",
  permission: "leave:update",
  minScope: "all",
  input: actualizeazaTipConcediuSchema,
  audit: {
    action: "update",
    entityType: "leave_type",
    entityId: (input) => input.id,
    allow: [
      "zile_implicite",
      "se_reporteaza",
      "termen_reportare",
      "plafon_reportare_zile",
      "necesita_document",
      "mod_rotunjire_acumulare",
      "culoare",
    ],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("leave_types")
      .update({
        zile_implicite: input.zile_implicite,
        se_reporteaza: input.se_reporteaza,
        termen_reportare: input.termen_reportare,
        plafon_reportare_zile: input.plafon_reportare_zile,
        necesita_document: input.necesita_document,
        mod_rotunjire_acumulare: input.mod_rotunjire_acumulare,
        culoare: input.culoare,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw traduEroare(error);
    if (data === null) throw notFound("Tipul de concediu nu a fost găsit.");
    return { id: data.id };
  },
});

export const comutaActivTipConcediu = createAction({
  name: "leave.settings.toggle_type",
  feature: "leave",
  permission: "leave:update",
  minScope: "all",
  input: comutaActivTipConcediuSchema,
  audit: {
    action: "update",
    entityType: "leave_type",
    entityId: (input) => input.id,
    allow: ["activ"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("leave_types")
      .update({ activ: input.activ })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw traduEroare(error);
    if (data === null) throw notFound("Tipul de concediu nu a fost găsit.");
    return { id: data.id };
  },
});

// ── Grile de zile suplimentare ────────────────────────────────────────────────

export const creeazaRegulaConcediu = createAction({
  name: "leave.settings.create_rule",
  feature: "leave",
  permission: "leave:create",
  minScope: "all",
  input: creeazaRegulaConcediuSchema,
  audit: {
    action: "create",
    entityType: "leave_entitlement_rule",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "leave_type_id",
      "tip_criteriu",
      "vechime_ani_min",
      "valoare_text",
      "department_id",
      "cod_cor",
      "zile_suplimentare",
      "denumire",
      "valabil_de_la",
      "valabil_pana_la",
    ],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("leave_entitlement_rules")
      .insert({
        organization_id: ctx.tenant.organizationId,
        leave_type_id: input.leave_type_id,
        tip_criteriu: input.tip_criteriu,
        vechime_ani_min: input.vechime_ani_min,
        valoare_text: input.valoare_text,
        department_id: input.department_id,
        cod_cor: input.cod_cor,
        zile_suplimentare: input.zile_suplimentare,
        denumire: input.denumire,
        valabil_de_la: input.valabil_de_la,
        valabil_pana_la: input.valabil_pana_la,
        categorie: categorieDinRegula(input),
      })
      .select("id")
      .single();
    if (error !== null) throw traduEroare(error);
    return { id: data.id };
  },
});

export const dezactiveazaRegulaConcediu = createAction({
  name: "leave.settings.deactivate_rule",
  feature: "leave",
  permission: "leave:update",
  minScope: "all",
  input: stergeRegulaConcediuSchema,
  audit: {
    action: "delete",
    entityType: "leave_entitlement_rule",
    entityId: (input) => input.id,
    allow: [],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("leave_entitlement_rules")
      .update({ deleted_at: ctx.now.toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw traduEroare(error);
    if (data === null) throw notFound("Regula nu a fost găsită.");
    return { id: data.id };
  },
});

// ── Zilele de bază de concediu de odihnă ale organizației ─────────────────────
// RPC dedicat (public.seteaza_zile_concediu_implicit, 0035), NU un UPDATE
// direct pe `organizations`: cere `leave:update = all`, nu `organizations:update
// = all` — un HR care configurează concediile nu are nevoie de acces la fișa
// generală a organizației. Trigger-ul din bază propagă automat spre
// `leave_types.zile_implicite` (tip „odihna”).

export const seteazaZileConcediuImplicit = createAction({
  name: "leave.settings.set_base_days",
  feature: "leave",
  permission: "leave:update",
  minScope: "all",
  input: seteazaZileConcediuImplicitSchema,
  audit: {
    action: "update",
    entityType: "organization",
    entityId: (_input, data: Readonly<{ organizationId: string }>) => data.organizationId,
    allow: ["zile"],
  },
  revalidate: [...CAI_REVALIDARE, "/setari/organizatie"],
  handler: async (ctx, input): Promise<Readonly<{ organizationId: string }>> => {
    const { error } = await ctx.supabase.rpc("seteaza_zile_concediu_implicit", {
      p_organization_id: ctx.tenant.organizationId,
      p_zile: input.zile,
    });
    if (error !== null) throw traduEroare(error);
    return { organizationId: ctx.tenant.organizationId };
  },
});

// ── Aplicarea drepturilor pe angajați ─────────────────────────────────────────
// Previzualizarea (public.aplica_drepturi_concediu cu p_simulare = true) e o
// CITIRE — trăiește în lib/queries/leave.ts (previzualizeazaDrepturi), nu aici.
// Doar SCRIEREA e o Server Action.

export const aplicaDrepturileConcediu = createAction({
  name: "leave.settings.apply_entitlements",
  feature: "leave",
  permission: "leave:update",
  minScope: "all",
  input: aplicaDrepturiSchema,
  audit: {
    action: "update",
    entityType: "leave_balances",
    allow: ["an"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input): Promise<Readonly<{ modificate: number }>> => {
    const { data, error } = await ctx.supabase.rpc("aplica_drepturi_concediu", {
      p_organization_id: ctx.tenant.organizationId,
      p_an: input.an,
      p_simulare: false,
    });
    if (error !== null) throw traduEroare(error);
    return { modificate: (data ?? []).length };
  },
});
