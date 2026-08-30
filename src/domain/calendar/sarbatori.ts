// src/domain/calendar/sarbatori.ts

import { pasteOrtodox } from "./paste-ortodox";

export type TipSarbatoare = "fix" | "mobil";

export interface Sarbatoare {
  readonly data: Date;
  readonly denumire: string;
  readonly tip: TipSarbatoare;
}

function adaugaZile(data: Date, zile: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + zile));
}

/**
 * Sărbătorile legale naționale (România) pentru anul dat: fixele din
 * Codul Muncii plus cele mobile, derivate din data Paștelui ortodox.
 *
 * Funcție PURĂ — reflectă exact lista din seed-ul `public_holidays`
 * (supabase/migrations/0009_leave.sql), fără acces la bază de date.
 */
export function sarbatoriAnului(an: number): readonly Sarbatoare[] {
  const paste = pasteOrtodox(an);

  const fixe: readonly Sarbatoare[] = [
    { data: new Date(Date.UTC(an, 0, 1)), denumire: "Anul Nou", tip: "fix" },
    { data: new Date(Date.UTC(an, 0, 2)), denumire: "A doua zi de Anul Nou", tip: "fix" },
    { data: new Date(Date.UTC(an, 0, 6)), denumire: "Bobotează", tip: "fix" },
    {
      data: new Date(Date.UTC(an, 0, 7)),
      denumire: "Soborul Sfântului Ioan Botezătorul",
      tip: "fix",
    },
    { data: new Date(Date.UTC(an, 0, 24)), denumire: "Unirea Principatelor Române", tip: "fix" },
    { data: new Date(Date.UTC(an, 4, 1)), denumire: "Ziua Muncii", tip: "fix" },
    { data: new Date(Date.UTC(an, 5, 1)), denumire: "Ziua Copilului", tip: "fix" },
    { data: new Date(Date.UTC(an, 7, 15)), denumire: "Adormirea Maicii Domnului", tip: "fix" },
    { data: new Date(Date.UTC(an, 10, 30)), denumire: "Sfântul Andrei", tip: "fix" },
    { data: new Date(Date.UTC(an, 11, 1)), denumire: "Ziua Națională a României", tip: "fix" },
    { data: new Date(Date.UTC(an, 11, 25)), denumire: "Crăciunul", tip: "fix" },
    { data: new Date(Date.UTC(an, 11, 26)), denumire: "A doua zi de Crăciun", tip: "fix" },
  ];

  const mobile: readonly Sarbatoare[] = [
    { data: adaugaZile(paste, -2), denumire: "Vinerea Mare", tip: "mobil" },
    { data: paste, denumire: "Paștele", tip: "mobil" },
    { data: adaugaZile(paste, 1), denumire: "A doua zi de Paște", tip: "mobil" },
    { data: adaugaZile(paste, 49), denumire: "Rusaliile", tip: "mobil" },
    { data: adaugaZile(paste, 50), denumire: "A doua zi de Rusalii", tip: "mobil" },
  ];

  return [...fixe, ...mobile].sort(
    (primul, alDoilea) => primul.data.getTime() - alDoilea.data.getTime(),
  );
}

/**
 * Sărbătorile anului indexate după ziua lor calendaristică ISO, `"2026-12-01"`.
 *
 * Forma de care are nevoie un calendar: 42 de căsuțe pe ecran, fiecare cu o
 * singură întrebare — „ziua asta e liberă, și cum se numește?”. Cu lista brută,
 * răspunsul ar cere 42 × 17 comparații de `Date`, adică fix locul unde un fus
 * orar mută Crăciunul pe 24 decembrie. Aici cheia e un șir de cifre și
 * comparația e de șiruri.
 *
 * Când două sărbători cad în aceeași zi — 1 iunie 2026 e și Ziua Copilului, și
 * a doua zi de Rusalii — denumirile se ADUNĂ, despărțite prin `·`. Un `Map`
 * ține o singură valoare pe cheie, deci scrierea directă ar pierde tăcut una
 * dintre ele; `sarbatoriAnului` are un test dedicat care apără exact
 * nededuplicarea în listă, iar ăsta e perechea lui pentru hartă.
 */
export function sarbatoriDupaZi(an: number): ReadonlyMap<string, string> {
  const dupaZi = new Map<string, string>();
  for (const sarbatoare of sarbatoriAnului(an)) {
    const { data } = sarbatoare;
    const zi = `${String(data.getUTCFullYear()).padStart(4, "0")}-${String(
      data.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
    const dinainte = dupaZi.get(zi);
    dupaZi.set(
      zi,
      dinainte === undefined ? sarbatoare.denumire : `${dinainte} · ${sarbatoare.denumire}`,
    );
  }
  return dupaZi;
}
