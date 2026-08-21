// src/app/(app)/pontaj/sincronizare-concediu.ts
// Nucleul upsert-ului concediu → pontaj, extras din `sincronizeazaConcediile`
// (actions.ts) ca să poată fi apelat și PUNCTUAL — pentru zilele unei singure
// cereri, chiar în momentul aprobării ei (`concedii/actions.ts`, `decideCerere`)
// — nu doar în bloc, pentru toată luna, la apăsarea manuală a butonului.
import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { traduEroare } from "./erori";

export interface ZiConcediuDeSincronizat {
  readonly employee_id: string;
  readonly data: string;
  readonly leave_request_id: string;
}

export interface RezultatSincronizare {
  readonly create: number;
  readonly actualizate: number;
  readonly pastrate: number;
}

/**
 * Upsert idempotent: nu atinge niciodată o zi introdusă manual
 * (`sursa <> 'sincronizare_concedii'`). Cere ca luna zilei să aibă deja o
 * perioadă de pontaj deschisă (`internal.pontaj_intrare_pregateste` refuză
 * altfel INSERT-ul) — apelantul decide dacă un eșec aici e blocant sau doar
 * semnalat (vezi `decideCerere`, unde e best-effort).
 */
export async function sincronizeazaZileleDeConcediu(
  db: SupabaseClient<Database>,
  organizationId: string,
  zile: readonly ZiConcediuDeSincronizat[],
): Promise<RezultatSincronizare> {
  if (zile.length === 0) return { create: 0, actualizate: 0, pastrate: 0 };

  const idAngajati = [...new Set(zile.map((z) => z.employee_id))];
  const datele = zile.map((z) => z.data);
  const dataMinima = datele.reduce((a, b) => (b < a ? b : a));
  const dataMaxima = datele.reduce((a, b) => (b > a ? b : a));

  const { data: existenteData, error: eroareExistente } = await db
    .from("attendance_entries")
    .select("id, employee_id, data, sursa")
    .eq("organization_id", organizationId)
    .in("employee_id", idAngajati)
    .gte("data", dataMinima)
    .lte("data", dataMaxima)
    .is("deleted_at", null);
  if (eroareExistente !== null) throw eroareExistente;

  const existenteHarta = new Map(
    (existenteData ?? []).map((e) => [`${e.employee_id}/${e.data}`, e]),
  );

  let create = 0;
  let actualizate = 0;
  let pastrate = 0;

  for (const zi of zile) {
    const existenta = existenteHarta.get(`${zi.employee_id}/${zi.data}`);

    if (existenta === undefined) {
      const { error } = await db.from("attendance_entries").insert({
        organization_id: organizationId,
        // Placeholder inert — vezi comentariul din `salveazaZiPontaj`.
        period_id: randomUUID(),
        employee_id: zi.employee_id,
        data: zi.data,
        ore_lucrate: 0,
        ore_suplimentare: 0,
        ore_noapte: 0,
        tip_zi: "concediu",
        sursa: "sincronizare_concedii",
        leave_request_id: zi.leave_request_id,
      });
      if (error !== null) traduEroare(error);
      create += 1;
      continue;
    }

    if (existenta.sursa !== "sincronizare_concedii") {
      // Linie manuală: conflictul se consumă tăcut, fără suprascriere.
      pastrate += 1;
      continue;
    }

    const { error } = await db
      .from("attendance_entries")
      .update({
        tip_zi: "concediu",
        ore_lucrate: 0,
        ore_suplimentare: 0,
        ore_noapte: 0,
        leave_request_id: zi.leave_request_id,
      })
      .eq("id", existenta.id)
      .eq("organization_id", organizationId);
    if (error !== null) traduEroare(error);
    actualizate += 1;
  }

  return { create, actualizate, pastrate };
}
