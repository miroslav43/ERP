// src/app/(app)/flota/[id]/pv/actions.ts
"use server";

// Procesul-verbal de predare-primire a vehiculului (0215, F12c).
//
// Calea e `flota/[id]/pv/actions.ts`, nu `flota/actions-pv.ts`: auditul
// acțiunilor (`audit-actiuni.mjs`), ESLint (`src/**/actions.ts`) și garda demo
// (`**/actions`) recunosc o Server Action DOAR după numele `actions.ts`
// (README F12 §2.4, corectura 1). Precedentul: `flota/[id]/iesire/actions.ts`.
//
// Fișierul exportă DOAR funcții async (capcana 39, `pnpm check:server`).
//
// Părțile, tipul, momentul, numărul și instantaneul le scrie BAZA
// (`internal.pv_vehicul_inainte`). Acțiunile trimit doar alocările și
// constatările, plus `created_by`/`updated_by` explicit: flota n-are
// `internal.set_actor` (capcana 23), iar politicile le cer.

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { fisaMea } from "@/lib/queries/portal";
import {
  actualizeazaPvSchema,
  anuleazaPvSchema,
  confirmaPvSchema,
  finalizeazaPvSchema,
  pvNouSchema,
  stergePvSchema,
  type ConstatariPv,
} from "@/schemas/fleet-pv";

import { traduEroarePv } from "./erori";

/** Coloanele de constatare, ca payload. Singurul loc care le enumeră. */
function constatari(input: ConstatariPv) {
  return {
    km_bord: input.km_bord,
    nivel_rezervor: input.nivel_rezervor,
    numar_chei: input.numar_chei,
    stare_generala: input.stare_generala,
    anvelope: input.anvelope,
    documente_bord: [...input.documente_bord],
    dotari: [...input.dotari],
    daune_constatate: input.daune_constatate,
    daune: input.daune.map((d) => ({ zona: d.zona, descriere: d.descriere })),
    observatii: input.observatii,
  };
}

/** Câmpurile constatate care ajung în audit. Descrierile daunelor și observațiile, nu. */
const AUDIT_CONSTATARI = [
  "km_bord",
  "nivel_rezervor",
  "numar_chei",
  "stare_generala",
  "anvelope",
  "daune_constatate",
] as const;

const caiVehicul = (vehiculId: string, pvId: string): readonly string[] => [
  "/flota",
  `/flota/${vehiculId}`,
  `/flota/${vehiculId}/pv/${pvId}`,
];

/** Ciorna, dintr-o predare, o restituire sau un transfer (ambele capete). */
export const creeazaPv = createAction({
  name: "fleet.handover.create",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: pvNouSchema,
  audit: {
    action: "create",
    entityType: "vehicle_handover",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["vehicle_id", "alocare_predata_id", "alocare_primita_id", ...AUDIT_CONSTATARI],
  },
  revalidate: (input, data: Readonly<{ id: string }>) => caiVehicul(input.vehicle_id, data.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_handovers")
      .insert({
        organization_id: ctx.tenant.organizationId,
        // Doar ca tipul de `Insert` să fie complet: baza îl rescrie din alocare.
        vehicle_id: input.vehicle_id,
        alocare_predata_id: input.alocare_predata_id,
        alocare_primita_id: input.alocare_primita_id,
        ...constatari(input),
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroarePv(error);

    return { id: data.id };
  },
});

/** Constatările ciornei. Pe un PV finalizat, `.eq("stare","ciorna")` dă zero rânduri: CONFLICT. */
export const actualizeazaPv = createAction({
  name: "fleet.handover.update",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: actualizeazaPvSchema,
  audit: {
    action: "update",
    entityType: "vehicle_handover",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id", ...AUDIT_CONSTATARI],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id, input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_handovers")
      .update({ ...constatari(input), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stare", "ciorna")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroarePv(error);
    if (data === null) {
      throw businessRule(
        "Ciorna nu a fost salvată: procesul-verbal a fost finalizat sau șters între timp. Reîncărcați fișa vehiculului.",
      );
    }

    return { id: data.id };
  },
});

/**
 * Finalizarea: baza alocă numărul PVA, scrie instantaneul și înregistrează
 * documentul în registru, în aceeași tranzacție. Câmpurile obligatorii le cere
 * tot baza (P0001 pe câmp). Al doilea clic găsește PV-ul finalizat: zero
 * rânduri, CONFLICT, nu P0001.
 */
export const finalizeazaPv = createAction({
  name: "fleet.handover.finalize",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: finalizeazaPvSchema,
  audit: {
    action: "update",
    entityType: "vehicle_handover",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id"],
  },
  revalidate: (input) => [...caiVehicul(input.vehicle_id, input.id), "/portal/masina-mea"],
  handler: async (
    ctx,
    input,
  ): Promise<Readonly<{ id: string; numar: string; numar_registru: string | null }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_handovers")
      .update({ stare: "finalizat", updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stare", "ciorna")
      .is("deleted_at", null)
      .select("id, numar, numar_registru")
      .maybeSingle();
    if (error !== null) traduEroarePv(error);
    if (data === null) {
      throw businessRule(
        "Procesul-verbal nu a fost finalizat: era deja finalizat sau a fost șters între timp. Reîncărcați fișa vehiculului.",
      );
    }

    return { id: data.id, numar: data.numar, numar_registru: data.numar_registru };
  },
});

/** Anularea: o singură dată, cu motivul. Numărul și rândul din registru rămân consumate. */
export const anuleazaPv = createAction({
  name: "fleet.handover.cancel",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: anuleazaPvSchema,
  audit: {
    action: "update",
    entityType: "vehicle_handover",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id", "motiv_anulare"],
  },
  revalidate: (input) => [...caiVehicul(input.vehicle_id, input.id), "/portal/masina-mea"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_handovers")
      .update({
        // Ora o rescrie baza (`now()`): payload-ul doar cere anularea.
        anulat_la: ctx.now.toISOString(),
        motiv_anulare: input.motiv_anulare,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stare", "finalizat")
      .is("anulat_la", null)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroarePv(error);
    if (data === null) {
      throw businessRule(
        "Procesul-verbal nu a fost anulat: era deja anulat sau nu mai e finalizat. Reîncărcați fișa vehiculului.",
      );
    }

    return { id: data.id };
  },
});

/** Ștergerea logică, doar pe ciornă (baza refuză un PV finalizat). */
export const stergePv = createAction({
  name: "fleet.handover.delete",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: stergePvSchema,
  audit: {
    action: "delete",
    entityType: "vehicle_handover",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id"],
  },
  revalidate: (input) => ["/flota", `/flota/${input.vehicle_id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_handovers")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stare", "ciorna")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroarePv(error);
    if (data === null) {
      throw businessRule(
        "Ciorna nu a fost ștearsă: procesul-verbal a fost finalizat sau șters între timp. Reîncărcați fișa vehiculului.",
      );
    }

    return { id: data.id };
  },
});

/**
 * Confirmarea din portal a părții-angajat. Completează semnătura de pe hârtie,
 * nu o înlocuiește (decizia I-c1, ⚠ jurist).
 *
 * Permisiunea e `employees:read` / `own` — dreptul de a-și vedea propria fișă,
 * pe care îl au toate cele cinci roluri — NU `vehicles:read`. Decizia 3 a lui
 * Miro (B3): omul fără `vehicles:read` (de regulă `hr`) care conduce o mașină a
 * firmei își confirmă PV-ul la care e parte. Cine e parte decide BAZA
 * (`pv_vehicul_update`, ramura „parte la PV”, și triggerul, pe
 * `app.current_employee_id`); acțiunea doar alege coloana.
 *
 * Fișa proprie vine din `fisaMea` (fișa PRINCIPALĂ), nu din `fisaProprie`:
 * triggerul și politica judecă pe `app.current_employee_id`, adică tot pe
 * `is_primary`. O fișă neprincipală ar trece de acțiune și ar fi refuzată de
 * bază cu P0001.
 */
export const confirmaPv = createAction({
  name: "fleet.handover.confirm",
  feature: "fleet",
  permission: "employees:read",
  minScope: "own",
  input: confirmaPvSchema,
  audit: {
    action: "update",
    entityType: "vehicle_handover",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/portal/masina-mea", "/portal"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const stare = await fisaMea(ctx.tenant.organizationId, ctx.user.id);
    if (stare.stare !== "ok") {
      throw businessRule(
        "Contul dumneavoastră nu are o fișă de angajat principală în această organizație. Contactați administratorul.",
      );
    }
    const fisaId = stare.fisa.id;

    const db = await createServerSupabase();
    const { data: pv, error: eroareCitire } = await db
      .from("vehicle_handovers")
      .select("id, predator_employee_id, primitor_employee_id")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stare", "finalizat")
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) traduEroarePv(eroareCitire);
    if (pv === null) throw notFound("Procesul-verbal nu există sau nu vă este accesibil.");

    // Un om nu e niciodată ambele părți: baza refuză transferul A → A.
    const coloana =
      pv.primitor_employee_id === fisaId
        ? "confirmat_primitor_la"
        : pv.predator_employee_id === fisaId
          ? "confirmat_predator_la"
          : null;
    if (coloana === null) {
      throw businessRule("Nu sunteți parte la acest proces-verbal, deci nu îl puteți confirma.");
    }

    const { data, error } = await db
      .from("vehicle_handovers")
      // Ora o rescrie baza (`now()`), iar autorul îl pune tot ea (`auth.uid()`).
      .update(
        coloana === "confirmat_primitor_la"
          ? { confirmat_primitor_la: ctx.now.toISOString(), updated_by: ctx.user.id }
          : { confirmat_predator_la: ctx.now.toISOString(), updated_by: ctx.user.id },
      )
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stare", "finalizat")
      .is("anulat_la", null)
      .is(coloana, null)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroarePv(error);
    if (data === null) {
      throw businessRule(
        "Procesul-verbal nu a fost confirmat: era deja confirmat sau a fost anulat între timp. Reîncărcați pagina.",
      );
    }

    return { id: data.id };
  },
});
