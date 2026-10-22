// src/app/(app)/flota/carduri/actions.ts
"use server";

/**
 * Cardurile de combustibil (0214, F12b): înregistrare, corectură, ștergere.
 *
 * „use server”: se exportă DOAR funcții async (capcana 39, `pnpm check:server`).
 *
 * ── CINE SCRIE ──────────────────────────────────────────────────────────────
 * `vehicles:create = all` (card nou) și `vehicles:update = all` (corectură,
 * ștergere): EXACT poarta politicilor `carduri_insert` / `carduri_update`. Fără
 * chei noi (F12b, Decizia 6). Un UPDATE respins de USING întoarce ZERO rânduri:
 * CONFLICT.
 *
 * ── NUMĂRUL CARDULUI ────────────────────────────────────────────────────────
 * Numărul întreg NU se salvează și NU intră în audit: din el se păstrează
 * ultimele 4 cifre și amprenta HMAC (`amprentaSensibila`, pe `HR_HASH_KEY`), pe
 * intrarea `card:<emitent>:<numărul întreg>`. Allow-list-ul de audit nu-l
 * numește, iar `numar` lipsește din el.
 */

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { actualizeazaCardSchema, cardNouSchema, stergeCardSchema } from "@/schemas/fleet-carduri";

import { traduEroareCarduri } from "./erori";

const CAI = ["/flota/carduri"] as const;

const MESAJ_CONFLICT =
  "Cardul s-a schimbat între timp, a fost șters sau nu aveți dreptul să-l modificați. Reîncărcați pagina.";

export const creeazaCard = createAction({
  name: "fleet.card.create",
  feature: "fleet",
  permission: "vehicles:create",
  minScope: "all",
  input: cardNouSchema,
  audit: {
    action: "create",
    entityType: "fuel_cards",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["emitent", "vehicle_id", "employee_id", "valabil_pana", "status"],
  },
  revalidate: CAI,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    let amprenta: string | null = null;
    if (input.numarIntreg !== null) {
      // Importul dinamic ține `aes-gcm` (server-only, cu cheile) în afara
      // modulului citit la încărcarea paginii.
      const { amprentaSensibila } = await import("@/lib/crypto/aes-gcm");
      amprenta = amprentaSensibila(`card:${input.emitent}:${input.numarIntreg}`);
    }
    const { data, error } = await ctx.supabase
      .from("fuel_cards")
      .insert({
        organization_id: ctx.tenant.organizationId,
        emitent: input.emitent,
        ultimele_cifre: input.ultimeleCifre,
        amprenta_numar: amprenta,
        denumire: input.denumire,
        vehicle_id: input.vehicle_id,
        employee_id: input.employee_id,
        valabil_pana: input.valabil_pana,
        observatii: input.observatii,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareCarduri(error);
    return { id: data.id };
  },
});

export const actualizeazaCard = createAction({
  name: "fleet.card.update",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: actualizeazaCardSchema,
  audit: {
    action: "update",
    entityType: "fuel_cards",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id", "employee_id", "valabil_pana", "status"],
  },
  revalidate: CAI,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Emitentul și numărul nu se trimit: alt număr e alt card (baza refuză).
    const { data, error } = await ctx.supabase
      .from("fuel_cards")
      .update({
        denumire: input.denumire,
        vehicle_id: input.vehicle_id,
        employee_id: input.employee_id,
        valabil_pana: input.valabil_pana,
        status: input.status,
        observatii: input.observatii,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareCarduri(error);
    if (data === null) throw businessRule(MESAJ_CONFLICT);
    return { id: data.id };
  },
});

export const stergeCard = createAction({
  name: "fleet.card.delete",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: stergeCardSchema,
  audit: {
    action: "delete",
    entityType: "fuel_cards",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: CAI,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Ștergere LOGICĂ: tranzacțiile importate rămân (FK-ul `restrict` nu se
    // activează la `deleted_at`), iar scadența cardului iese din semafor prin
    // trigger. `carduri_select` nu filtrează `deleted_at`, deci RETURNING vine.
    const { data, error } = await ctx.supabase
      .from("fuel_cards")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareCarduri(error);
    if (data === null) throw businessRule(MESAJ_CONFLICT);
    return { id: data.id };
  },
});
