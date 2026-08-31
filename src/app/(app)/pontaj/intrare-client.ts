// src/app/(app)/pontaj/intrare-client.ts
/**
 * Forma în care o zi de pontaj trece granița server → client, și singura
 * funcție care o construiește.
 *
 * ── DE CE UN MODUL PROPRIU ────────────────────────────────────────────────
 * Tipurile stăteau în `foaie-colectiva.tsx`, adică într-un fișier `"use client"`,
 * iar maparea era scrisă de DOUĂ ori în `page.tsx` — o dată pe ramura scope
 * „own", o dată pe cea cu listă de angajați. A treia vizualizare ar fi adus a
 * treia copie. Aici e o singură dată, într-un `.ts` simplu pe care îl pot
 * importa și serverul, și clientul, și — spre deosebire de o pagină — proiectul
 * `unit` din `vitest.config.mts`.
 *
 * ── CE REPARĂ, CONCRET ────────────────────────────────────────────────────
 * O coloană `time` din Postgres sosește `"08:30:00"`. `oraOptionala` din
 * `src/schemas/attendance.ts` cere `^([01]\d|2[0-3]):[0-5]\d$` — fără secunde —
 * deci valoarea brută e RESPINSĂ de `salveazaZiPontaj`. Cum `celula-zi.tsx` își
 * inițializează starea direct din ce primește, cine deschidea o zi cu interval,
 * schimba doar observația și apăsa „Salvează" primea o eroare de validare
 * pentru un câmp pe care nu-l atinsese. Normalizarea se face o dată, aici, la
 * intrarea în client — nu în fiecare consumator.
 */

import { formatOraZi } from "@/lib/format/ore";
import type { IntrarePontaj } from "@/lib/queries/attendance";
import type { TipPrezenta, TipZi } from "@/schemas/attendance";

export interface IntrareZiClient {
  readonly id: string;
  /** `"08:30"` canonic — niciodată `"08:30:00"`. Vezi antetul fișierului. */
  readonly oraInceput: string | null;
  readonly oraSfarsit: string | null;
  readonly oreLucrate: number;
  readonly oreSuplimentare: number;
  readonly oreNoapte: number;
  readonly tipZi: TipZi;
  /**
   * Unde s-a lucrat ziua (0118). `null` înseamnă NEDECLARAT — o zi de dinainte
   * de coloană, sau una pusă de pe telefon printr-o apăsare pe „Am intrat".
   * Nu se colapsează în „la birou": ecranul arată „—", ca să se vadă diferența
   * dintre o alegere și o lipsă.
   */
  readonly tipPrezenta: TipPrezenta | null;
  readonly esteDinConcediu: boolean;
  readonly aprobat: boolean;
  readonly respins: boolean;
  readonly motivRespingere: string | null;
  readonly observatii: string | null;
}

export interface RandFoaie {
  /** `null` = fișa proprie (scope „own”): `salveazaZiPontaj` o rezolvă server-side. */
  readonly angajatId: string | null;
  readonly eticheta: string;
  /** Cheia e ziua ISO (`"2026-03-09"`) — serializabil peste granița server/client. */
  readonly intrari: Readonly<Record<string, IntrareZiClient>>;
}

/** Un rând din `attendance_entries` → forma pe care o consumă ecranele. */
export function intrareaClient(intrare: IntrarePontaj): IntrareZiClient {
  return {
    id: intrare.id,
    oraInceput: formatOraZi(intrare.ora_inceput),
    oraSfarsit: formatOraZi(intrare.ora_sfarsit),
    oreLucrate: intrare.ore_lucrate,
    oreSuplimentare: intrare.ore_suplimentare,
    oreNoapte: intrare.ore_noapte,
    tipZi: intrare.tip_zi,
    tipPrezenta: intrare.tip_prezenta,
    esteDinConcediu: intrare.leave_request_id !== null,
    aprobat: intrare.approved_at !== null,
    respins: intrare.respins_la !== null,
    motivRespingere: intrare.motiv_respingere,
    observatii: intrare.observatii,
  };
}

/** Intrările unui angajat, indexate pe ziua ISO. */
export function intrarilePeZi(
  intrari: readonly IntrarePontaj[],
): Readonly<Record<string, IntrareZiClient>> {
  return Object.fromEntries(intrari.map((i) => [i.data, intrareaClient(i)]));
}
