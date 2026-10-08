// src/domain/calendar/sarbatori.ts

import { pasteOrtodox } from "./paste-ortodox";

export type TipSarbatoare = "fix" | "mobil";

export interface Sarbatoare {
  readonly data: Date;
  readonly denumire: string;
  readonly tip: TipSarbatoare;
}

/** O sărbătoare candidată, cu ziua din care e în lege, dacă a intrat din 2016 încoace. */
type Candidata = Sarbatoare & { readonly inVigoareDin?: string };

function adaugaZile(data: Date, zile: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + zile));
}

/** `"2023-01-06"` — cheia comparată cu ziua intrării în vigoare. */
function ziIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Ziua din care fiecare sărbătoare adăugată în 2016 sau după e în art. 139 alin. (1).
 *
 * Sursa: mențiunile „(la …)” din forma consolidată a Codului muncii pe
 * legislatie.just.ro (DetaliiDocument/128647, consolidarea din 27.04.2026,
 * descărcată cu curl pe 8 oct 2026):
 *   · 24 ianuarie — Legea nr. 176/2016, MO nr. 808 din 13.10.2016, „la 16-10-2016”
 *     (rescrie alin. (1) și introduce 24 ianuarie; DetaliiDocumentAfis/182520);
 *   · 1 iunie — Legea nr. 220/2016, MO nr. 931 din 18.11.2016, „la 21-11-2016”;
 *   · Vinerea Mare — Legea nr. 64/2018, MO nr. 226 din 13.03.2018, „la 16-03-2018”;
 *   · 6 și 7 ianuarie — Legea nr. 52/2023, MO nr. 186 din 06.03.2023, „la 09-03-2023”.
 *
 * Se compară ZIUA sărbătorii, nu anul: 6–7 ianuarie 2023 au căzut înaintea legii,
 * deci ianuarie 2023 are 20 de zile lucrătoare, nu 19. Până pe 8 oct 2026 lista
 * nu ținea cont de asta, iar foaia de pontaj greșea norma pe 2020–2023.
 *
 * Celelalte sărbători sunt în lista rescrisă la 16.10.2016, fără mențiune
 * ulterioară: lista e garantată din 2017 încolo, nu și înainte (30 noiembrie și
 * restul au intrat prin legi necitite aici).
 */
const IN_VIGOARE_DIN = {
  unireaPrincipatelor: "2016-10-16",
  ziuaCopilului: "2016-11-21",
  vinereaMare: "2018-03-16",
  bobotezaSiSfantulIoan: "2023-03-09",
} as const;

/**
 * Sărbătorile legale naționale (România) pentru anul dat: fixele din
 * Codul Muncii plus cele mobile, derivate din data Paștelui ortodox, fiecare
 * doar din ziua în care a intrat în lege.
 *
 * Funcție PURĂ. Pentru 2024–2040 reflectă exact lista din seed-ul
 * `public_holidays` (supabase/migrations/0009_leave.sql). Comentariul tabelei
 * din aceeași migrare dă 6–7 ianuarie „din 2016/2017” și e GREȘIT; migrarea e
 * aplicată, deci nu se editează — sursa corectă e aici și în NOTES.md.
 */
export function sarbatoriAnului(an: number): readonly Sarbatoare[] {
  const paste = pasteOrtodox(an);

  const fixe: readonly Candidata[] = [
    { data: new Date(Date.UTC(an, 0, 1)), denumire: "Anul Nou", tip: "fix" },
    { data: new Date(Date.UTC(an, 0, 2)), denumire: "A doua zi de Anul Nou", tip: "fix" },
    {
      data: new Date(Date.UTC(an, 0, 6)),
      denumire: "Bobotează",
      tip: "fix",
      inVigoareDin: IN_VIGOARE_DIN.bobotezaSiSfantulIoan,
    },
    {
      data: new Date(Date.UTC(an, 0, 7)),
      denumire: "Soborul Sfântului Ioan Botezătorul",
      tip: "fix",
      inVigoareDin: IN_VIGOARE_DIN.bobotezaSiSfantulIoan,
    },
    {
      data: new Date(Date.UTC(an, 0, 24)),
      denumire: "Unirea Principatelor Române",
      tip: "fix",
      inVigoareDin: IN_VIGOARE_DIN.unireaPrincipatelor,
    },
    { data: new Date(Date.UTC(an, 4, 1)), denumire: "Ziua Muncii", tip: "fix" },
    {
      data: new Date(Date.UTC(an, 5, 1)),
      denumire: "Ziua Copilului",
      tip: "fix",
      inVigoareDin: IN_VIGOARE_DIN.ziuaCopilului,
    },
    { data: new Date(Date.UTC(an, 7, 15)), denumire: "Adormirea Maicii Domnului", tip: "fix" },
    { data: new Date(Date.UTC(an, 10, 30)), denumire: "Sfântul Andrei", tip: "fix" },
    { data: new Date(Date.UTC(an, 11, 1)), denumire: "Ziua Națională a României", tip: "fix" },
    { data: new Date(Date.UTC(an, 11, 25)), denumire: "Crăciunul", tip: "fix" },
    { data: new Date(Date.UTC(an, 11, 26)), denumire: "A doua zi de Crăciun", tip: "fix" },
  ];

  const mobile: readonly Candidata[] = [
    {
      data: adaugaZile(paste, -2),
      denumire: "Vinerea Mare",
      tip: "mobil",
      inVigoareDin: IN_VIGOARE_DIN.vinereaMare,
    },
    { data: paste, denumire: "Paștele", tip: "mobil" },
    { data: adaugaZile(paste, 1), denumire: "A doua zi de Paște", tip: "mobil" },
    { data: adaugaZile(paste, 49), denumire: "Rusaliile", tip: "mobil" },
    { data: adaugaZile(paste, 50), denumire: "A doua zi de Rusalii", tip: "mobil" },
  ];

  return [...fixe, ...mobile]
    .filter((s) => s.inVigoareDin === undefined || ziIso(s.data) >= s.inVigoareDin)
    .map(({ data, denumire, tip }): Sarbatoare => ({ data, denumire, tip }))
    .sort((primul, alDoilea) => primul.data.getTime() - alDoilea.data.getTime());
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
