// src/domain/fleet/carduri/reactivare.ts
//
// „Reactivează” pe o tranzacție ignorată (F12b): starea în care iese rândul din
// `ignorata`, ÎNAINTEA repotrivirii lui. Funcție PURĂ.

import type { StarePotrivire } from "./potrivire";

/** Ce știe deja rândul ignorat: legăturile lui rămân, doar starea se schimbă. */
export interface TranzactieReactivata {
  readonly categorie: string;
  readonly card_id: string | null;
  readonly vehicle_id: string | null;
  readonly trip_sheet_id: string | null;
}

/**
 * O stare FĂRĂ alimentare (`fctx_stare_ck`: doar `potrivita`/`diferenta` au
 * una), aleasă în ordinea potrivirii (`potrivire.ts`, pașii 2–6): vehiculul,
 * apoi felul tranzacției, apoi foaia. Acțiunea repotrivește rândul imediat
 * după; starea asta rămâne doar dacă repotrivirea cade, iar repotrivirea lunii
 * o reia (ignoratele nu se repotrivesc, celelalte da).
 */
export function stareDupaReactivare(
  t: TranzactieReactivata,
): Exclude<StarePotrivire, "potrivita" | "diferenta" | "ignorata"> {
  if (t.vehicle_id === null) return t.card_id === null ? "card_necunoscut" : "vehicul_necunoscut";
  if (t.categorie !== "combustibil") return "necombustibil";
  return t.trip_sheet_id === null ? "fara_foaie" : "fara_alimentare";
}
