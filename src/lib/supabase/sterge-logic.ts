// src/lib/supabase/sterge-logic.ts
import type { PostgrestError } from "@supabase/supabase-js";

import type { ServerSupabase } from "./server";

/**
 * Ștergerea logică pe tabelele a căror politică SELECT ascunde rândul șters.
 *
 * ── DE CE NU `update({ deleted_at })` ─────────────────────────────────────
 * Pe tabelele astea, UPDATE-ul care setează `deleted_at` pică ÎNTOTDEAUNA cu
 * 42501: clauza WHERE citește coloane, deci Postgres verifică rândul NOU contra
 * politicii SELECT, iar rândul nou e tocmai cel ascuns (0164). Funcția
 * `public.sterge_logic` evaluează aceleași politici SELECT/UPDATE pentru
 * apelant și ocolește doar verificarea aceea.
 *
 * Lista e cea din funcție; o tabelă nouă se adaugă în AMBELE locuri.
 * `evaluation_templates` are funcția ei (0162), cu regula „nefolosit”.
 *
 * Rezultatul are forma unui răspuns PostgREST: `data` sunt id-urile efectiv
 * șterse. Un vector gol înseamnă „nimic de șters” SAU „refuzat de USING” —
 * exact ca un UPDATE cu zero rânduri, deci apelantul îl tratează la fel.
 */
export type TabelaStergereLogica =
  | "inrolare_ciorne"
  | "role_permissions"
  | "hr_document_templates"
  | "kpi_seturi"
  | "kpi_indicatori"
  | "kpi_tinte_angajat"
  | "kpi_evaluari_lunare";

export async function stergeLogic(
  supabase: ServerSupabase,
  tabela: TabelaStergereLogica,
  ids: readonly string[],
): Promise<Readonly<{ data: readonly string[]; error: PostgrestError | null }>> {
  if (ids.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.rpc("sterge_logic", {
    p_tabela: tabela,
    p_ids: [...ids],
  });
  return { data: error === null ? (data ?? []) : [], error };
}
