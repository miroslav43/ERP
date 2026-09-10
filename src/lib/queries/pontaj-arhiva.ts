// src/lib/queries/pontaj-arhiva.ts
//
// Citirile arhivei lunare de pontaj (migrarea 0134).
//
// ── DE CE NUMĂRUL DE REGISTRU SE CITEȘTE SEPARAT ────────────────────────────
// `registru_documente` leagă documentul prin perechea `(entitate_tip,
// entitate_id)`, care NU e cheie străină — registrul consemnează entități din
// zece tabele diferite. PostgREST nu poate face embed fără FK, deci numărul vine
// dintr-o a doua interogare, mărginită la id-urile deja citite.
//
// Cine ajunge aici are `attendance:export = all`, adică `org_admin` sau `hr` —
// și amândoi au `registru:read = all` din seed-ul lui 0120. Dacă cineva mută
// vreodată poarta arhivei pe altă cheie, numărul devine `null` TĂCUT: RLS-ul
// registrului întoarce zero rânduri, nu o eroare. De aceea `numarAfisat` e
// `string | null` și ecranul afișează „—", în loc să presupună că e mereu acolo.
//
// ── DE CE NU E CURSOR KEYSET ────────────────────────────────────────────────
// Abatere de la regula proiectului, cu motiv aritmetic: cinci ani înseamnă cel
// mult 60 de rânduri, iar `max_rows = 1000` nu are ce trunchia. Un cursor aici
// ar fi ceremonie peste o listă care încape într-un ecran și jumătate.

import { createServerSupabase } from "@/lib/supabase/server";
import type { Enums, Json } from "@/types/database";

/** Câți ani în urmă arată ecranul implicit. ⚠️ Termenul legal: NOTES.md. */
export const ANI_PASTRARE = 5;

/** Plafonul dosarului comasat: 60 de luni, adică exact fereastra de păstrare. */
export const MAX_LUNI_DOSAR = 60;

export interface ArhivaLunaPontaj {
  readonly id: string;
  readonly an: number;
  readonly luna: number;
  readonly versiune: number;
  readonly motiv: Enums<"pontaj_arhiva_motiv">;
  readonly status_perioada: Enums<"attendance_period_status"> | null;
  readonly checksum: string;
  readonly numar_angajati: number;
  readonly total_ore: number;
  readonly total_ore_suplimentare: number;
  readonly total_ore_noapte: number;
  readonly generat_la: string;
  /** Numărul din registrul de documente, sau `null` dacă nu e vizibil. */
  readonly numarAfisat: string | null;
}

export interface ArhivaCuContinut extends ArhivaLunaPontaj {
  readonly continut: Json;
}

const COLOANE =
  "id, an, luna, versiune, motiv, status_perioada, checksum, numar_angajati, " +
  "total_ore, total_ore_suplimentare, total_ore_noapte, generat_la";

interface RandArhiva {
  readonly id: string;
  readonly an: number;
  readonly luna: number;
  readonly versiune: number;
  readonly motiv: Enums<"pontaj_arhiva_motiv">;
  readonly status_perioada: Enums<"attendance_period_status"> | null;
  readonly checksum: string;
  readonly numar_angajati: number;
  readonly total_ore: number;
  readonly total_ore_suplimentare: number;
  readonly total_ore_noapte: number;
  readonly generat_la: string;
}

/** Numerele de registru pentru id-urile date, ca hartă. Lipsă = `null`. */
async function numereDeRegistru(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
  if (ids.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("registru_documente")
    .select("entitate_id, numar_afisat")
    .eq("entitate_tip", "pontaj_arhive_lunare")
    .in("entitate_id", [...ids])
    .returns<{ entitate_id: string; numar_afisat: string }[]>();
  if (error !== null) throw error;

  return new Map((data ?? []).map((r) => [r.entitate_id, r.numar_afisat]));
}

function cuNumar(
  randuri: readonly RandArhiva[],
  numere: ReadonlyMap<string, string>,
): readonly ArhivaLunaPontaj[] {
  return randuri.map((r) => ({ ...r, numarAfisat: numere.get(r.id) ?? null }));
}

/**
 * Versiunile ÎN VIGOARE din intervalul de ani cerut, cea mai recentă lună prima.
 *
 * `inlocuita_de is null` e filtrul care face lista să însemne ceva: fără el, o
 * lună corectată de două ori ar apărea de trei ori, iar cine se uită n-ar ști
 * care e documentul.
 */
export async function listeazaArhivePontaj(
  organizationId: string,
  deLaAn: number,
  panaLaAn: number,
): Promise<readonly ArhivaLunaPontaj[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("pontaj_arhive_lunare")
    .select(COLOANE)
    .eq("organization_id", organizationId)
    .gte("an", deLaAn)
    .lte("an", panaLaAn)
    .is("inlocuita_de", null)
    .is("deleted_at", null)
    .order("an", { ascending: false })
    .order("luna", { ascending: false })
    .returns<RandArhiva[]>();
  if (error !== null) throw error;

  const randuri = data ?? [];
  return cuNumar(randuri, await numereDeRegistru(randuri.map((r) => r.id)));
}

/** O arhivă anume, cu tot instantaneul. Pentru exportul unei singure luni. */
export async function arhivaPontajDupaId(
  organizationId: string,
  id: string,
): Promise<ArhivaCuContinut | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("pontaj_arhive_lunare")
    .select(`${COLOANE}, continut`)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandArhiva & { continut: Json }>();
  if (error !== null) throw error;
  if (data === null) return null;

  const numere = await numereDeRegistru([data.id]);
  return { ...data, numarAfisat: numere.get(data.id) ?? null };
}

/**
 * Arhivele în vigoare dintr-un interval de luni, cronologic. Pentru dosarul
 * comasat, unde ordinea filelor trebuie să fie a calendarului, nu inversă.
 *
 * Intervalul se dă ca `an * 12 + luna`, aritmetică pe care Postgres n-o poate
 * face în `.gte()` pe două coloane — de aici filtrul pe ani plus tăierea în
 * TypeScript a capetelor.
 */
export async function arhivePontajInInterval(
  organizationId: string,
  deLa: { readonly an: number; readonly luna: number },
  panaLa: { readonly an: number; readonly luna: number },
): Promise<readonly ArhivaCuContinut[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("pontaj_arhive_lunare")
    .select(`${COLOANE}, continut`)
    .eq("organization_id", organizationId)
    .gte("an", deLa.an)
    .lte("an", panaLa.an)
    .is("inlocuita_de", null)
    .is("deleted_at", null)
    .order("an", { ascending: true })
    .order("luna", { ascending: true })
    .returns<(RandArhiva & { continut: Json })[]>();
  if (error !== null) throw error;

  const indice = (an: number, luna: number): number => an * 12 + luna;
  const jos = indice(deLa.an, deLa.luna);
  const sus = indice(panaLa.an, panaLa.luna);

  const inInterval = (data ?? [])
    .filter((r) => indice(r.an, r.luna) >= jos && indice(r.an, r.luna) <= sus)
    .slice(0, MAX_LUNI_DOSAR);

  const numere = await numereDeRegistru(inInterval.map((r) => r.id));
  return inInterval.map((r) => ({ ...r, numarAfisat: numere.get(r.id) ?? null }));
}
