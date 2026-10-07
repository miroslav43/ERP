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

export type TipZiPontaj = Database["public"]["Enums"]["attendance_day_type"];

export interface ZiConcediuDeSincronizat {
  readonly employee_id: string;
  readonly data: string;
  readonly leave_request_id: string;
  /**
   * Ce fel de zi de pontaj produce concediul — `leave_types.tip_zi_pontaj`.
   *
   * Până în 0064 aici era constanta `"concediu"`, pentru TOATE tipurile. Dar
   * agregarea de salarizare numără pe `tip_zi` (0049:65-66), iar zilele de
   * `concediu` intră în `zilePlatite` (calc.ts:324): concediul fără plată se
   * plătea, iar `zile_concediu_medical` era permanent 0. Apelantul citește
   * coloana și o trimite aici — nu mai există o a doua sursă de adevăr.
   */
  readonly tip_zi: TipZiPontaj;
}

export interface RezultatSincronizare {
  readonly create: number;
  readonly actualizate: number;
  /** Zile pontate ca lucrate (manual, ceas, plan, import) trecute pe concediu. */
  readonly inlocuite: number;
  /** Zile pontate pe care UPDATE-ul nu le-a putut atinge (zero rânduri). */
  readonly pastrate: number;
}

/**
 * Ce rămâne dintr-o zi pontată când un concediu aprobat o acoperă.
 *
 * Până acum ziua pontată se PĂSTRA („dacă omul chiar a muncit, ștergerea ar
 * distruge singura dovadă”). Dar cazul real e invers: concediul de urgență,
 * cerut pentru o zi deja completată din planul săptămânii sau pontată
 * dimineața. Concediul aprobat e ultima decizie despre zi; o zi rămasă
 * „lucrătoare, 8 ore” se plătea și ca muncă, și ca zi scăzută din sold.
 *
 * Dovada nu se pierde: `audit_attendance_entries` scrie rândul vechi întreg în
 * `audit_logs`. Se rescrie ACELAȘI rând (nu ștergere + inserare): o singură
 * comandă, deci nu există momentul în care ziua lipsește. Intervalul, sediul și
 * decizia de pontaj se golesc — erau ale zilei lucrate, nu ale concediului
 * (`attendance_entries_punct_declarat_ck`, `_aprobare_zi_incheiata_ck`).
 * La anularea concediului, 0079 §3 șterge logic rândul: ziua rămâne goală, de
 * repontat, nu revine singură ca lucrată.
 */
const ZI_LUCRATA_GOLITA = {
  sursa: "sincronizare_concedii",
  ora_inceput: null,
  ora_sfarsit: null,
  tip_prezenta: null,
  punct_lucru_id: null,
  punct_lucru_declarat_id: null,
  approved_at: null,
  approved_by: null,
  batch_id: null,
  respins_la: null,
  respins_de: null,
  motiv_respingere: null,
} as const;

/**
 * Upsert idempotent: ziua scrisă de o sincronizare anterioară se actualizează,
 * ziua pontată ca lucrată se ÎNLOCUIEȘTE cu concediul (vezi
 * `ZI_LUCRATA_GOLITA`). Cere ca luna zilei să aibă deja o
 * perioadă de pontaj deschisă (`internal.pontaj_intrare_pregateste` refuză
 * altfel INSERT-ul) — apelantul decide dacă un eșec aici e blocant sau doar
 * semnalat (vezi `decideCerere`, unde e best-effort).
 */
export async function sincronizeazaZileleDeConcediu(
  db: SupabaseClient<Database>,
  organizationId: string,
  zile: readonly ZiConcediuDeSincronizat[],
): Promise<RezultatSincronizare> {
  if (zile.length === 0) return { create: 0, actualizate: 0, inlocuite: 0, pastrate: 0 };

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
  let inlocuite = 0;
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
        tip_zi: zi.tip_zi,
        sursa: "sincronizare_concedii",
        leave_request_id: zi.leave_request_id,
      });
      if (error !== null) traduEroare(error);
      create += 1;
      continue;
    }

    const eraLucrata = existenta.sursa !== "sincronizare_concedii";

    const { data: actualizata, error } = await db
      .from("attendance_entries")
      .update({
        tip_zi: zi.tip_zi,
        ore_lucrate: 0,
        ore_suplimentare: 0,
        ore_noapte: 0,
        leave_request_id: zi.leave_request_id,
        ...(eraLucrata ? ZI_LUCRATA_GOLITA : {}),
      })
      .eq("id", existenta.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    // Zero rânduri, fără eroare: ziua a fost aprobată între timp, iar
    // `attendance_entries_update` (0013:795) o refuză celui fără
    // `attendance:approve`. Nu s-a scris nimic: ziua lucrată rămâne lucrată și
    // se numără drept păstrată, ca apelantul s-o poată semnala.
    if (actualizata === null) {
      if (eraLucrata) pastrate += 1;
      continue;
    }
    if (eraLucrata) inlocuite += 1;
    else actualizate += 1;
  }

  return { create, actualizate, inlocuite, pastrate };
}
