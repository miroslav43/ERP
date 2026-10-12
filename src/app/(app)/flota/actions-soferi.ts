// src/app/(app)/flota/actions-soferi.ts
"use server";

/**
 * Șoferii flotei (0204, F9): permisul de conducere de pe fișa angajatului și
 * legarea foii de parcurs de deplasarea (delegația) șoferului.
 *
 * Fișier separat de `actions.ts`, pe care îl scriu și fazele paralele. „use
 * server”: se exportă DOAR funcții async (capcana 39, `pnpm check:server`).
 *
 * ── CINE SCRIE PERMISELE ────────────────────────────────────────────────────
 * Seed-ul (0204): `org_admin` și `hr` au `driver_licenses:create/update = all`;
 * `manager` doar citește echipa, `employee` doar propriul permis. `minScope`
 * e `own`, nu `all`: politica judecă pe angajat (`app.ssm_acces`), deci o
 * suprascriere pe firmă care dă cuiva `team` funcționează fără ca acțiunea s-o
 * blocheze înainte. Un rând refuzat de USING întoarce ZERO rânduri: CONFLICT.
 *
 * ── CE JUDECĂ BAZA ──────────────────────────────────────────────────────────
 * Categoriile (lista din lege, normalizate și ordonate), un singur permis
 * activ pe angajat, angajatul din aceeași firmă (cheie compusă), mutarea pe alt
 * om (P0001) și proiecția scadenței în `expirables`. Pe foaie: aceeași firmă,
 * același angajat, deplasare neanulată; starea foii (doar ciorna se mai scrie)
 * o judecă `internal.foi_parcurs_inainte`.
 *
 * Avertismentele (permis expirat, aviz lipsă, concediu) NU blochează nimic:
 * se arată pe foaie, la predare și pe fișă, din `src/domain/fleet/soferi.ts`.
 */

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import {
  actualizeazaPermisSchema,
  legaDeplasareaSchema,
  permisNouSchema,
  stergePermisSchema,
} from "@/schemas/soferi";

import { traduEroareDeplasare, traduEroarePermis } from "./erori";

/** Unde apare permisul: fișa angajatului, portalul șoferului, foile. */
function caiPermis(employeeId: string): readonly string[] {
  return [`/angajati/${employeeId}`, "/portal", "/portal/masina-mea", "/flota/foi"];
}

/** Rutele atinse de o scriere pe foaie (aceleași ca la curse). */
function caiFoaie(foaieId: string): readonly string[] {
  return [
    "/flota/foi",
    `/flota/foi/${foaieId}`,
    "/portal",
    "/portal/masina-mea",
    `/portal/masina-mea/foi/${foaieId}`,
  ];
}

const ALLOW_PERMIS = ["employee_id", "categorii", "eliberat_la", "expira_la"] as const;

export const adaugaPermis = createAction({
  name: "fleet.driver_license.create",
  feature: "fleet",
  permission: "driver_licenses:create",
  minScope: "own",
  input: permisNouSchema,
  audit: {
    action: "create",
    entityType: "driver_license",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [...ALLOW_PERMIS],
  },
  revalidate: (input) => caiPermis(input.employee_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // `fisier_path` nu se trimite: încărcarea copiei vine cu fișierele din F6.
    const { data, error } = await ctx.supabase
      .from("driver_licenses")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: input.employee_id,
        numar: input.numar,
        categorii: [...input.categorii],
        eliberat_la: input.eliberat_la,
        expira_la: input.expira_la,
        observatii: input.observatii,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroarePermis(error);
    return { id: data.id };
  },
});

export const actualizeazaPermis = createAction({
  name: "fleet.driver_license.update",
  feature: "fleet",
  permission: "driver_licenses:update",
  minScope: "own",
  input: actualizeazaPermisSchema,
  audit: {
    action: "update",
    entityType: "driver_license",
    entityId: (input) => input.id,
    allow: ["id", ...ALLOW_PERMIS],
  },
  revalidate: (input) => caiPermis(input.employee_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Reînnoirea e chiar UPDATE-ul ăsta (un singur permis activ pe om);
    // istoricul îl ține auditul. `employee_id` filtrează, nu se scrie.
    const { data, error } = await ctx.supabase
      .from("driver_licenses")
      .update({
        numar: input.numar,
        categorii: [...input.categorii],
        eliberat_la: input.eliberat_la,
        expira_la: input.expira_la,
        observatii: input.observatii,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("employee_id", input.employee_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroarePermis(error);
    if (data === null) {
      throw businessRule(
        "Permisul nu a putut fi modificat: a fost șters între timp sau nu aveți dreptul de a-l modifica.",
      );
    }
    return { id: data.id };
  },
});

export const stergePermis = createAction({
  name: "fleet.driver_license.delete",
  feature: "fleet",
  permission: "driver_licenses:update",
  minScope: "own",
  input: stergePermisSchema,
  audit: {
    action: "delete",
    entityType: "driver_license",
    entityId: (input) => input.id,
    allow: ["id", "employee_id"],
  },
  revalidate: (input) => caiPermis(input.employee_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Ștergere logică: scadența iese din `expirables` prin trigger, iar locul
    // se eliberează pentru un permis nou (indexul unic e parțial).
    const { data, error } = await ctx.supabase
      .from("driver_licenses")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("employee_id", input.employee_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroarePermis(error);
    if (data === null) {
      throw businessRule(
        "Permisul nu a fost șters: fusese deja șters sau nu aveți dreptul de a-l modifica.",
      );
    }
    return { id: data.id };
  },
});

export const legaDeplasarea = createAction({
  name: "fleet.trip_sheet.link_trip",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: legaDeplasareaSchema,
  audit: {
    action: "update",
    entityType: "trip_sheet",
    entityId: (input) => input.id,
    allow: ["id", "business_trip_id"],
  },
  revalidate: (input) => caiFoaie(input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // `.eq("status", "draft")`: legătura se schimbă doar pe ciornă — exact ce
    // primește și baza (§D1 din 0200). Fără filtru, o foaie trimisă ar da
    // P0001 în loc de CONFLICT; cu el, zero rânduri = CONFLICT.
    const { data, error } = await ctx.supabase
      .from("trip_sheets")
      .update({ business_trip_id: input.business_trip_id, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "draft")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareDeplasare(error);
    if (data === null) {
      throw businessRule(
        "Deplasarea nu a putut fi legată: foaia nu mai e ciornă sau nu aveți dreptul de a o modifica. Reîncărcați foaia.",
      );
    }
    return { id: data.id };
  },
});
