// src/app/(app)/anunturi/erori.ts
// Traducerea constrângerilor CHECK ale avizierului (0028) în erori PE CÂMP —
// separat de traducerea generică din `src/lib/actions/errors.ts`.

import { invalidInput, isPostgrestError } from "@/lib/actions/errors";

/** Constrângere din 0028 → câmpul din formular și mesajul lui. */
const CONSTRANGERI: readonly (readonly [string, string, string])[] = [
  [
    "announcements_expirare_ck",
    "expira_la",
    "Data de expirare trebuie să fie după data publicării.",
  ],
  ["announcements_titlu_len", "titlu", "Titlul are între 1 și 200 de caractere."],
  ["announcements_continut_len", "continut", "Conținutul are între 1 și 10 000 de caractere."],
];

/**
 * Plasa de siguranță pentru căile pe care Zod nu le vede.
 *
 * `announcements_expirare_ck` (`expira_la > publicat_la`) cade la
 * `publicaAnunt` pe o ciornă veche cu expirarea trecută, la
 * `actualizeazaAnunt` cu o expirare înaintea publicării și la `retrageAnunt`
 * pe un anunț programat (`now() < publicat_la`). Fără ramura asta, omul
 * primea „Datele nu respectă regulile de validare. Cod de referință: …”
 * (ADM-029), fără niciun câmp marcat.
 *
 * `invalidInput`, nu `businessRule`: al doilea n-are `fieldErrors`, deci
 * mesajul ar ateriza ca un Callout în CAPUL formularului, iar
 * `<Camp nume="expira_la">` n-ar primi `aria-invalid` — motivul e scris în
 * `cursuri/erori.ts`. Numele constrângerii vine în `error.message` de la
 * PostgREST, aceeași premisă pe care stă `cursuri/erori.ts`
 * (`courses_denumire_uk`). Orice altceva urcă neschimbat, pe
 * `mapPostgrestError`.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error) && error.code === "23514") {
    const potrivire = CONSTRANGERI.find(([constrangere]) => error.message.includes(constrangere));
    if (potrivire !== undefined) {
      const [, camp, mesaj] = potrivire;
      throw invalidInput(mesaj, { [camp]: [mesaj] });
    }
  }
  throw error;
}
