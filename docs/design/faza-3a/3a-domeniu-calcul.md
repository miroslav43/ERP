```ts
// src/domain/calendar/paste-ortodox.ts

/**
 * Calculează data Paștelui ortodox (calendar gregorian) pentru un an dat.
 *
 * Algoritmul Meeus/Jones/Butcher (varianta iuliană) dă luna și ziua în
 * calendarul IULIAN; decalajul dintre calendare se adaugă separat pentru
 * a obține data corespunzătoare pe calendarul gregorian (cel folosit de
 * `date` în Postgres și de `Date` în JavaScript). Corespunde exact
 * funcției `internal.paste_ortodox` din supabase/migrations/0009_leave.sql.
 *
 * Funcție PURĂ: nu citește ceasul sistemului, nu accesează rețeaua sau
 * baza de date. Pentru același an întoarce mereu aceeași dată.
 */
export function pasteOrtodox(an: number): Date {
  if (!Number.isInteger(an) || an < 1900 || an > 2199) {
    throw new RangeError(
      'Anul pentru calculul Paștelui ortodox trebuie să fie un număr întreg între 1900 și 2199.',
    );
  }

  const a = an % 4;
  const b = an % 7;
  const c = an % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;

  // 3 = martie, 4 = aprilie — luna în calendarul IULIAN.
  const lunaIuliana = Math.floor((d + e + 114) / 31);
  const ziuaIuliana = ((d + e + 114) % 31) + 1;

  // Decalajul dintre calendarul iulian și cel gregorian, valabil în intervalul suportat.
  const decalajZile = Math.floor(an / 100) - Math.floor(an / 400) - 2;

  // Date.UTC normalizează automat depășirile de zi/lună (echivalent cu
  // a construi data iuliană și a-i adăuga apoi `decalajZile` zile).
  return new Date(Date.UTC(an, lunaIuliana - 1, ziuaIuliana + decalajZile));
}
```

```ts
// src/domain/calendar/paste-ortodox.test.ts

import { describe, expect, it } from 'vitest';
import { pasteOrtodox } from './paste-ortodox';

function formateazaISO(data: Date): string {
  const an = data.getUTCFullYear().toString().padStart(4, '0');
  const luna = (data.getUTCMonth() + 1).toString().padStart(2, '0');
  const zi = data.getUTCDate().toString().padStart(2, '0');
  return `${an}-${luna}-${zi}`;
}

describe('pasteOrtodox', () => {
  // Valori de referință scrise manual (NU generate de funcția testată),
  // verificate independent față de calendarul bisericesc ortodox.
  const cazuri: ReadonlyArray<readonly [number, string]> = [
    [2024, '2024-05-05'],
    [2025, '2025-04-20'],
    [2026, '2026-04-12'],
    [2027, '2027-05-02'],
    [2028, '2028-04-16'],
  ];

  it.each(cazuri)('anul %i are Paștele ortodox pe %s', (an, dataAsteptata) => {
    expect(formateazaISO(pasteOrtodox(an))).toBe(dataAsteptata);
  });

  it('respinge anii în afara intervalului suportat', () => {
    expect(() => pasteOrtodox(1899)).toThrow(RangeError);
    expect(() => pasteOrtodox(2200)).toThrow(RangeError);
  });

  it('respinge un an care nu e număr întreg', () => {
    expect(() => pasteOrtodox(2025.5)).toThrow(RangeError);
  });
});
```

```ts
// src/domain/calendar/sarbatori.ts

import { pasteOrtodox } from './paste-ortodox';

export type TipSarbatoare = 'fix' | 'mobil';

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
    { data: new Date(Date.UTC(an, 0, 1)), denumire: 'Anul Nou', tip: 'fix' },
    { data: new Date(Date.UTC(an, 0, 2)), denumire: 'A doua zi de Anul Nou', tip: 'fix' },
    { data: new Date(Date.UTC(an, 0, 6)), denumire: 'Bobotează', tip: 'fix' },
    { data: new Date(Date.UTC(an, 0, 7)), denumire: 'Soborul Sfântului Ioan Botezătorul', tip: 'fix' },
    { data: new Date(Date.UTC(an, 0, 24)), denumire: 'Unirea Principatelor Române', tip: 'fix' },
    { data: new Date(Date.UTC(an, 4, 1)), denumire: 'Ziua Muncii', tip: 'fix' },
    { data: new Date(Date.UTC(an, 5, 1)), denumire: 'Ziua Copilului', tip: 'fix' },
    { data: new Date(Date.UTC(an, 7, 15)), denumire: 'Adormirea Maicii Domnului', tip: 'fix' },
    { data: new Date(Date.UTC(an, 10, 30)), denumire: 'Sfântul Andrei', tip: 'fix' },
    { data: new Date(Date.UTC(an, 11, 1)), denumire: 'Ziua Națională a României', tip: 'fix' },
    { data: new Date(Date.UTC(an, 11, 25)), denumire: 'Crăciunul', tip: 'fix' },
    { data: new Date(Date.UTC(an, 11, 26)), denumire: 'A doua zi de Crăciun', tip: 'fix' },
  ];

  const mobile: readonly Sarbatoare[] = [
    { data: adaugaZile(paste, -2), denumire: 'Vinerea Mare', tip: 'mobil' },
    { data: paste, denumire: 'Paștele', tip: 'mobil' },
    { data: adaugaZile(paste, 1), denumire: 'A doua zi de Paște', tip: 'mobil' },
    { data: adaugaZile(paste, 49), denumire: 'Rusaliile', tip: 'mobil' },
    { data: adaugaZile(paste, 50), denumire: 'A doua zi de Rusalii', tip: 'mobil' },
  ];

  return [...fixe, ...mobile].sort((primul, alDoilea) => primul.data.getTime() - alDoilea.data.getTime());
}
```

```ts
// src/domain/calendar/sarbatori.test.ts

import { describe, expect, it } from 'vitest';
import { pasteOrtodox } from './paste-ortodox';
import { sarbatoriAnului, type Sarbatoare } from './sarbatori';

const ZI_IN_MS = 24 * 60 * 60 * 1000;

function gasesteDupaNume(sarbatori: readonly Sarbatoare[], denumire: string): Sarbatoare {
  const gasita = sarbatori.find((s) => s.denumire === denumire);
  if (!gasita) {
    throw new Error(`Sărbătoarea „${denumire}” nu a fost găsită în lista generată.`);
  }
  return gasita;
}

describe('sarbatoriAnului', () => {
  it('întoarce exact 17 sărbători (12 fixe + 5 mobile)', () => {
    expect(sarbatoriAnului(2026)).toHaveLength(17);
  });

  it('Vinerea Mare cade cu exact 2 zile înaintea Paștelui', () => {
    const paste = pasteOrtodox(2026);
    const vinereaMare = gasesteDupaNume(sarbatoriAnului(2026), 'Vinerea Mare');
    expect(paste.getTime() - vinereaMare.data.getTime()).toBe(2 * ZI_IN_MS);
  });

  it('Rusaliile cad la +49 de zile, iar a doua zi de Rusalii la +50', () => {
    const paste = pasteOrtodox(2027);
    const sarbatori = sarbatoriAnului(2027);
    const rusaliile = gasesteDupaNume(sarbatori, 'Rusaliile');
    const aDouaZiDeRusalii = gasesteDupaNume(sarbatori, 'A doua zi de Rusalii');
    expect(rusaliile.data.getTime() - paste.getTime()).toBe(49 * ZI_IN_MS);
    expect(aDouaZiDeRusalii.data.getTime() - paste.getTime()).toBe(50 * ZI_IN_MS);
  });

  it('sărbătorile fixe cad pe aceeași zi calendaristică în fiecare an', () => {
    const sarbatori2024 = sarbatoriAnului(2024);
    const anulNou = gasesteDupaNume(sarbatori2024, 'Anul Nou');
    expect(anulNou.data.getUTCMonth()).toBe(0);
    expect(anulNou.data.getUTCDate()).toBe(1);

    const craciunul = gasesteDupaNume(sarbatori2024, 'Crăciunul');
    expect(craciunul.data.getUTCMonth()).toBe(11);
    expect(craciunul.data.getUTCDate()).toBe(25);
  });

  it('lista e sortată cronologic', () => {
    const timpi = sarbatoriAnului(2025).map((s) => s.data.getTime());
    const timpiSortati = [...timpi].sort((x, y) => x - y);
    expect(timpi).toEqual(timpiSortati);
  });
});
```

```ts
// src/domain/calendar/zile-lucratoare.ts

/**
 * Numără zilele LUCRĂTOARE dintr-un interval închis [start, sfârșit],
 * excluzând weekendul (sâmbătă/duminică), sărbătorile legale primite ca
 * parametru și zilele libere proprii organizației.
 *
 * Funcție PURĂ: sărbătorile și zilele firmei sunt primite ca date, nu
 * calculate aici — apelantul le obține din `sarbatoriAnului`, respectiv
 * din `organization_holidays`. Comparațiile se fac pe zi calendaristică
 * (UTC), ignorând ora, ca să nu depindă de fusul orar al mediului de rulare.
 */
export function calculeazaZileLucratoare(
  start: Date,
  sfarsit: Date,
  sarbatori: readonly Date[] = [],
  zileFirmei: readonly Date[] = [],
): number {
  if (sfarsit.getTime() < start.getTime()) {
    throw new RangeError('Intervalul este invalid: data de sfârșit este anterioară datei de început.');
  }

  let curent = normalizeazaZi(start);
  const limita = normalizeazaZi(sfarsit);

  let numarZile = 0;
  while (curent.getTime() <= limita.getTime()) {
    if (esteZiLucratoare(curent, sarbatori, zileFirmei)) {
      numarZile += 1;
    }
    curent = adaugaOZi(curent);
  }
  return numarZile;
}

function esteZiLucratoare(zi: Date, sarbatori: readonly Date[], zileFirmei: readonly Date[]): boolean {
  if (esteWeekend(zi)) {
    return false;
  }
  if (contineData(sarbatori, zi)) {
    return false;
  }
  if (contineData(zileFirmei, zi)) {
    return false;
  }
  return true;
}

function esteWeekend(data: Date): boolean {
  const ziuaSaptamanii = data.getUTCDay(); // 0 = duminică, 6 = sâmbătă
  return ziuaSaptamanii === 0 || ziuaSaptamanii === 6;
}

function contineData(lista: readonly Date[], data: Date): boolean {
  return lista.some((element) => esteAceeasiZi(element, data));
}

function esteAceeasiZi(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function normalizeazaZi(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

function adaugaOZi(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + 1));
}
```

```ts
// src/domain/calendar/zile-lucratoare.test.ts

import { describe, expect, it } from 'vitest';
import { calculeazaZileLucratoare } from './zile-lucratoare';

function zi(an: number, luna: number, ziua: number): Date {
  return new Date(Date.UTC(an, luna - 1, ziua));
}

describe('calculeazaZileLucratoare', () => {
  it('un interval de o singură zi lucrătoare numără o zi', () => {
    // 5 ianuarie 2026 este luni.
    expect(calculeazaZileLucratoare(zi(2026, 1, 5), zi(2026, 1, 5))).toBe(1);
  });

  it('un interval de o singură zi de weekend numără zero', () => {
    // 3 ianuarie 2026 este sâmbătă.
    expect(calculeazaZileLucratoare(zi(2026, 1, 3), zi(2026, 1, 3))).toBe(0);
  });

  it('un interval care începe și se termină în weekend numără doar zilele lucrătoare dintre ele', () => {
    // Sâmbătă 3 ian. -> sâmbătă 10 ian. 2026: 5 zile lucrătoare (luni-vineri).
    expect(calculeazaZileLucratoare(zi(2026, 1, 3), zi(2026, 1, 10))).toBe(5);
  });

  it('un interval care conține o sărbătoare scade acea zi din total', () => {
    // Luni 5 ian. -> vineri 9 ian. 2026, cu o sărbătoare miercuri 7 ian.
    const sarbatori = [zi(2026, 1, 7)];
    expect(calculeazaZileLucratoare(zi(2026, 1, 5), zi(2026, 1, 9), sarbatori)).toBe(4);
  });

  it('o sărbătoare căzută în weekend nu scade de două ori', () => {
    // Aceeași săptămână ca testul de weekend, dar sărbătoarea cade duminică 4 ian.
    const sarbatori = [zi(2026, 1, 4)];
    expect(calculeazaZileLucratoare(zi(2026, 1, 3), zi(2026, 1, 10), sarbatori)).toBe(5);
  });

  it('o zi liberă a firmei scade acea zi, chiar dacă nu e sărbătoare legală', () => {
    const zileFirmei = [zi(2026, 1, 8)]; // joi, zi liberă suplimentară acordată de firmă
    expect(calculeazaZileLucratoare(zi(2026, 1, 5), zi(2026, 1, 9), [], zileFirmei)).toBe(4);
  });

  it('respinge un interval inversat (sfârșit înainte de început)', () => {
    expect(() => calculeazaZileLucratoare(zi(2026, 1, 10), zi(2026, 1, 5))).toThrow(RangeError);
  });
});
```

```ts
// src/domain/leave/sold.ts

/**
 * Modul de rotunjire a fracțiunilor de zi rezultate din calculul
 * proporțional al dreptului de concediu. Corespunde exact enumerării
 * `public.leave_rounding_mode` din supabase/migrations/0009_leave.sql.
 *
 * NU există o regulă legală unică de rotunjire (vezi nota C din migrare):
 * Codul Muncii stabilește dreptul minim anual, nu cum se rotunjesc
 * fracțiile. De aceea modul e parametru, niciodată o constantă în cod.
 */
export type ModRotunjire =
  | 'fara_rotunjire'
  | 'jumatate_in_sus'
  | 'jumatate_in_jos'
  | 'zi_in_sus'
  | 'zi_in_jos'
  | 'matematic';

/**
 * Rotunjește un număr de zile de concediu conform modului configurat.
 * Rezultatul e calculat întâi la precizie de 2 zecimale, pentru a
 * elimina zgomotul de virgulă mobilă (echivalent cu `numeric(6,2)` din
 * baza de date), apoi se aplică regula de rotunjire.
 */
export function rotunjesteZileConcediu(valoare: number, mod: ModRotunjire): number {
  const laDouaZecimale = Math.round(valoare * 100) / 100;
  switch (mod) {
    case 'fara_rotunjire':
      return laDouaZecimale;
    case 'jumatate_in_sus':
      return Math.ceil(laDouaZecimale * 2) / 2;
    case 'jumatate_in_jos':
      return Math.floor(laDouaZecimale * 2) / 2;
    case 'zi_in_sus':
      return Math.ceil(laDouaZecimale);
    case 'zi_in_jos':
      return Math.floor(laDouaZecimale);
    case 'matematic':
      return Math.round(laDouaZecimale);
    default: {
      const modNerecunoscut: never = mod;
      throw new RangeError(`Mod de rotunjire necunoscut: ${String(modNerecunoscut)}`);
    }
  }
}

/**
 * Calculează dreptul de concediu ACUMULAT proporțional pentru un angajat,
 * într-un an dat, ținând cont de data angajării și de câte luni din anul
 * respectiv sunt deja „consumate” la data de referință `astazi`.
 *
 * Regula (vezi nota B din migrare): drept_lunar = drept_anual / 12,
 * drept_acumulat = drept_lunar × numărul de luni lucrate în anul `an`.
 * O lună se consideră lucrată integral dacă angajatul era încadrat în
 * acea lună, indiferent de ziua exactă a angajării în lună.
 *
 * - Dacă angajatul a fost încadrat într-un an anterior lui `an`, luna
 *   de start e ianuarie.
 * - Dacă anul `an` s-a încheiat deja (e anterior anului lui `astazi`),
 *   luna de final e decembrie; altfel e luna curentă la `astazi`.
 * - Dacă angajatul nu era încă încadrat în `an`, sau `an` nu a început
 *   încă la data `astazi`, rezultatul e 0.
 *
 * Funcție PURĂ: `astazi` e primit ca parametru, nu citit din ceasul
 * sistemului — determinismul testelor depinde de asta.
 */
export function calculeazaAcumulareProportionala(
  dataAngajarii: Date,
  an: number,
  dreptAnual: number,
  modRotunjire: ModRotunjire,
  astazi: Date,
): number {
  if (!Number.isInteger(an) || an < 2000 || an > 2199) {
    throw new RangeError('Anul de calcul al soldului trebuie să fie un număr întreg între 2000 și 2199.');
  }
  if (!Number.isFinite(dreptAnual) || dreptAnual < 0) {
    throw new RangeError('Dreptul anual de concediu nu poate fi negativ.');
  }
  if (Number.isNaN(dataAngajarii.getTime()) || Number.isNaN(astazi.getTime())) {
    throw new RangeError('Data angajării sau data de referință este invalidă.');
  }

  const anAngajarii = dataAngajarii.getUTCFullYear();
  const anAstazi = astazi.getUTCFullYear();

  if (anAngajarii > an || anAstazi < an) {
    return 0;
  }

  const primaLuna = anAngajarii === an ? dataAngajarii.getUTCMonth() + 1 : 1;
  const ultimaLuna = anAstazi === an ? astazi.getUTCMonth() + 1 : 12;

  if (primaLuna > ultimaLuna) {
    return 0;
  }

  const luniLucrate = ultimaLuna - primaLuna + 1;
  const dreptAcumulat = (dreptAnual / 12) * luniLucrate;

  return rotunjesteZileConcediu(dreptAcumulat, modRotunjire);
}
```

```ts
// src/domain/leave/sold.test.ts

import { describe, expect, it } from 'vitest';
import { calculeazaAcumulareProportionala, rotunjesteZileConcediu } from './sold';

function zi(an: number, luna: number, ziua: number): Date {
  return new Date(Date.UTC(an, luna - 1, ziua));
}

describe('calculeazaAcumulareProportionala', () => {
  it('angajat de la 1 ianuarie acumulează dreptul anual integral', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2025, 1, 1),
      2025,
      20,
      'fara_rotunjire',
      zi(2026, 1, 15), // anul 2025 s-a încheiat deja
    );
    expect(zile).toBe(20);
  });

  it('angajat la 15 iunie acumulează proporțional cele 7 luni rămase din an', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2025, 6, 15),
      2025,
      21,
      'jumatate_in_sus',
      zi(2026, 1, 15),
    );
    // 21 / 12 = 1,75 pe lună × 7 luni (iunie-decembrie) = 12,25 -> rotunjit la 0,5 în sus = 12,5
    expect(zile).toBe(12.5);
  });

  it('angajat anul trecut are dreptul anual integral pentru anul curent', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2023, 3, 1),
      2025,
      20,
      'fara_rotunjire',
      zi(2026, 1, 10),
    );
    expect(zile).toBe(20);
  });

  it('angajat în decembrie acumulează doar fracțiunea unei singure luni', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2025, 12, 10),
      2025,
      24,
      'zi_in_sus',
      zi(2026, 3, 1),
    );
    // 24 / 12 = 2 pe lună × 1 lună (decembrie) = 2
    expect(zile).toBe(2);
  });

  it('nu acumulează nimic dacă angajatul nu era încă încadrat în anul respectiv', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2026, 3, 1),
      2025,
      20,
      'fara_rotunjire',
      zi(2026, 6, 1),
    );
    expect(zile).toBe(0);
  });

  it('nu acumulează nimic dacă anul de calcul nu a început încă la data de referință', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2020, 1, 1),
      2027,
      20,
      'fara_rotunjire',
      zi(2026, 6, 1),
    );
    expect(zile).toBe(0);
  });

  it('respinge un drept anual negativ', () => {
    expect(() =>
      calculeazaAcumulareProportionala(zi(2025, 1, 1), 2025, -1, 'fara_rotunjire', zi(2026, 1, 1)),
    ).toThrow(RangeError);
  });
});

describe('rotunjesteZileConcediu', () => {
  it('fara_rotunjire păstrează valoarea la 2 zecimale', () => {
    expect(rotunjesteZileConcediu(12.256, 'fara_rotunjire')).toBe(12.26);
  });

  it('jumatate_in_jos rotunjește în jos la cel mai apropiat 0,5', () => {
    expect(rotunjesteZileConcediu(12.4, 'jumatate_in_jos')).toBe(12);
  });

  it('zi_in_jos rotunjește în jos la ziua întreagă', () => {
    expect(rotunjesteZileConcediu(12.9, 'zi_in_jos')).toBe(12);
  });

  it('matematic rotunjește standard la cea mai apropiată zi', () => {
    expect(rotunjesteZileConcediu(12.5, 'matematic')).toBe(13);
    expect(rotunjesteZileConcediu(12.4, 'matematic')).toBe(12);
  });
});
```

```ts
// src/domain/leave/verificari.ts

/**
 * Interval de concediu simplu, folosit doar pentru comparații de date —
 * fără stare de bază de date (fără id, status etc.).
 */
export interface IntervalConcediu {
  readonly dataInceput: Date;
  readonly dataSfarsit: Date;
}

function valideazaInterval(interval: IntervalConcediu, etichetaEroare: string): void {
  if (interval.dataSfarsit.getTime() < interval.dataInceput.getTime()) {
    throw new RangeError(`${etichetaEroare}: data de sfârșit este anterioară datei de început.`);
  }
}

function seSuprapun(a: IntervalConcediu, b: IntervalConcediu): boolean {
  return (
    a.dataInceput.getTime() <= b.dataSfarsit.getTime() && b.dataInceput.getTime() <= a.dataSfarsit.getTime()
  );
}

/**
 * Verifică dacă intervalul unei cereri noi se suprapune cu oricare dintre
 * intervalele deja existente (comparație de interval închis, echivalentă
 * cu `daterange(..., '[]')` din constrângerea EXCLUDE a tabelei
 * `leave_requests`).
 *
 * Apelantul e responsabil să filtreze `cereriExistente` la statusurile
 * relevante (trimisă / în aprobare / aprobată) și să excludă tipurile de
 * concediu care „întrerup” alte concedii (medical, maternitate) — exact
 * cum face predicatul `where` al constrângerii din baza de date.
 */
export function verificaSuprapunere(
  cerereNoua: IntervalConcediu,
  cereriExistente: readonly IntervalConcediu[],
): boolean {
  valideazaInterval(cerereNoua, 'Intervalul cererii noi este invalid');
  return cereriExistente.some((existenta) => seSuprapun(cerereNoua, existenta));
}

export interface RezultatVerificareSold {
  /** true dacă soldul disponibil acoperă zilele solicitate. */
  readonly areSoldSuficient: boolean;
  /** Zilele care lipsesc din sold; 0 dacă soldul e suficient. */
  readonly zileLipsa: number;
}

/**
 * Compară zilele solicitate cu soldul disponibil (`leave_balances.ramase`).
 * Nu decide DACĂ tipul de concediu scade din sold — asta ține de
 * `leave_types.scade_din_sold` și e responsabilitatea apelantului.
 */
export function verificaSold(zileSolicitate: number, zileDisponibile: number): RezultatVerificareSold {
  if (!Number.isFinite(zileSolicitate) || zileSolicitate < 0) {
    throw new RangeError('Numărul de zile solicitate nu poate fi negativ.');
  }
  const diferenta = Math.round((zileSolicitate - zileDisponibile) * 100) / 100;
  const zileLipsa = diferenta > 0 ? diferenta : 0;
  return { areSoldSuficient: zileLipsa === 0, zileLipsa };
}

export interface CerereEchipa extends IntervalConcediu {
  readonly angajatId: string;
}

function acopera(interval: IntervalConcediu, ziua: Date): boolean {
  return interval.dataInceput.getTime() <= ziua.getTime() && ziua.getTime() <= interval.dataSfarsit.getTime();
}

function normalizeazaZi(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

function adaugaOZi(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + 1));
}

/**
 * Verifică dacă aprobarea cererii noi ar duce numărul de absenți simultani
 * din aceeași echipă peste pragul acceptat, în oricare zi a intervalului
 * cerut. `cereriEchipa` conține DOAR cererile deja aprobate/în aprobare
 * ale colegilor din aceeași echipă/departament — filtrarea după echipă e
 * responsabilitatea apelantului, funcția aici doar numără suprapunerile
 * pe zi.
 *
 * Întoarce `true` dacă există conflict (pragul e depășit în cel puțin o zi).
 */
export function conflictDeEchipa(
  cerereNoua: IntervalConcediu,
  cereriEchipa: readonly CerereEchipa[],
  pragMaximSimultan: number,
): boolean {
  valideazaInterval(cerereNoua, 'Intervalul cererii noi este invalid');
  if (!Number.isInteger(pragMaximSimultan) || pragMaximSimultan < 1) {
    throw new RangeError('Pragul maxim de absențe simultane trebuie să fie un număr întreg de cel puțin 1.');
  }

  let ziua = normalizeazaZi(cerereNoua.dataInceput);
  const limita = normalizeazaZi(cerereNoua.dataSfarsit);

  while (ziua.getTime() <= limita.getTime()) {
    const numarAbsenti = cereriEchipa.filter((cerere) => acopera(cerere, ziua)).length + 1;
    if (numarAbsenti > pragMaximSimultan) {
      return true;
    }
    ziua = adaugaOZi(ziua);
  }
  return false;
}
```

```ts
// src/domain/leave/verificari.test.ts

import { describe, expect, it } from 'vitest';
import {
  conflictDeEchipa,
  verificaSold,
  verificaSuprapunere,
  type CerereEchipa,
  type IntervalConcediu,
} from './verificari';

function zi(an: number, luna: number, ziua: number): Date {
  return new Date(Date.UTC(an, luna - 1, ziua));
}

function interval(inceput: [number, number, number], sfarsit: [number, number, number]): IntervalConcediu {
  return { dataInceput: zi(...inceput), dataSfarsit: zi(...sfarsit) };
}

describe('verificaSuprapunere', () => {
  it('detectează suprapunerea completă a două intervale identice', () => {
    const nou = interval([2026, 3, 10], [2026, 3, 14]);
    const existente = [interval([2026, 3, 10], [2026, 3, 14])];
    expect(verificaSuprapunere(nou, existente)).toBe(true);
  });

  it('detectează suprapunerea parțială la început', () => {
    const nou = interval([2026, 3, 10], [2026, 3, 14]);
    const existente = [interval([2026, 3, 5], [2026, 3, 10])];
    expect(verificaSuprapunere(nou, existente)).toBe(true);
  });

  it('detectează suprapunerea parțială la sfârșit', () => {
    const nou = interval([2026, 3, 10], [2026, 3, 14]);
    const existente = [interval([2026, 3, 14], [2026, 3, 20])];
    expect(verificaSuprapunere(nou, existente)).toBe(true);
  });

  it('nu semnalează conflict pentru intervale adiacente, dar neintersectate', () => {
    const nou = interval([2026, 3, 10], [2026, 3, 14]);
    const existente = [interval([2026, 3, 15], [2026, 3, 20])];
    expect(verificaSuprapunere(nou, existente)).toBe(false);
  });

  it('nu semnalează conflict când nu există nicio cerere existentă', () => {
    const nou = interval([2026, 3, 10], [2026, 3, 14]);
    expect(verificaSuprapunere(nou, [])).toBe(false);
  });

  it('respinge un interval inversat', () => {
    const nouInvalid = interval([2026, 3, 14], [2026, 3, 10]);
    expect(() => verificaSuprapunere(nouInvalid, [])).toThrow(RangeError);
  });
});

describe('verificaSold', () => {
  it('semnalează sold suficient când zilele disponibile acoperă cererea', () => {
    expect(verificaSold(5, 10)).toEqual({ areSoldSuficient: true, zileLipsa: 0 });
  });

  it('semnalează sold suficient la egalitate exactă', () => {
    expect(verificaSold(10, 10)).toEqual({ areSoldSuficient: true, zileLipsa: 0 });
  });

  it('calculează zilele lipsă când soldul e insuficient', () => {
    expect(verificaSold(12.5, 10)).toEqual({ areSoldSuficient: false, zileLipsa: 2.5 });
  });

  it('respinge un număr de zile solicitate negativ', () => {
    expect(() => verificaSold(-1, 10)).toThrow(RangeError);
  });
});

describe('conflictDeEchipa', () => {
  const echipa: readonly CerereEchipa[] = [
    { angajatId: 'a1', dataInceput: zi(2026, 7, 6), dataSfarsit: zi(2026, 7, 10) },
    { angajatId: 'a2', dataInceput: zi(2026, 7, 8), dataSfarsit: zi(2026, 7, 12) },
  ];

  it('nu semnalează conflict sub prag', () => {
    // zilele 6-7: cel mult 1 coleg (a1) + cererea nouă = 2 <= prag 3
    const nou = interval([2026, 7, 6], [2026, 7, 7]);
    expect(conflictDeEchipa(nou, echipa, 3)).toBe(false);
  });

  it('nu semnalează conflict exact la prag', () => {
    // ziua 8: a1 + a2 + cererea nouă = 3, prag 3 -> fără conflict
    const nou = interval([2026, 7, 8], [2026, 7, 8]);
    expect(conflictDeEchipa(nou, echipa, 3)).toBe(false);
  });

  it('semnalează conflict când pragul e depășit', () => {
    // ziua 8: a1 + a2 + cererea nouă = 3, prag 2 -> conflict
    const nou = interval([2026, 7, 8], [2026, 7, 8]);
    expect(conflictDeEchipa(nou, echipa, 2)).toBe(true);
  });

  it('respinge un prag mai mic decât 1', () => {
    const nou = interval([2026, 7, 6], [2026, 7, 7]);
    expect(() => conflictDeEchipa(nou, echipa, 0)).toThrow(RangeError);
  });

  it('respinge un interval inversat', () => {
    const nouInvalid = interval([2026, 7, 10], [2026, 7, 6]);
    expect(() => conflictDeEchipa(nouInvalid, echipa, 2)).toThrow(RangeError);
  });
});
```

**De semnalat:**

1. Nu am putut verifica prin citirea `package.json` ce framework de testare rulează în proiect (instrucțiunea a fost „nu folosi tool-uri"). Am scris testele cu sintaxa **Vitest** (`import { describe, expect, it } from 'vitest'`, inclusiv `it.each`), fiind cea mai comună în proiecte Next.js/TS recente. Dacă proiectul folosește Jest, importurile trebuie eliminate (globale) sau adaptate.
2. Fișierele domeniului (`src/domain/**`) lucrează exclusiv cu `Date` nativ, normalizat la miezul nopții UTC — nu am importat `DateString`/`toBucharestDateString` din `@/lib/format/date`, ca stratul de domeniu (logică pură, testabilă fără infrastructură) să rămână independent de fusul orar de business și de modulele de infrastructură. Conversia `DateString` (Europe/Bucharest) ↔ `Date` UTC e responsabilitatea stratului de acțiuni/wiring care va apela aceste funcții, nu a domeniului.
3. `calculeazaZileLucratoare` primește `sarbatori` și `zileFirmei` ca simple liste de date-limită neînsoțite de „tip" — nu modelează `zi_recuperare` (ziua din `organization_holidays` care transformă o sâmbătă în zi lucrătoare, prioritate 1 în `app.este_zi_lucratoare`). Semnătura cerută explicit în sarcină avea doar 4 parametri; dacă e nevoie și de recuperări, propun un al 5-lea parametru opțional `zileRecuperare: readonly Date[]`.
4. `verificaSuprapunere` și `conflictDeEchipa` compară intervale la granularitate de ZI întreagă (ca și constrângerea `EXCLUDE` din `leave_requests`, care nu ține cont de `portiune_inceput`/`portiune_sfarsit`) — o cerere de „a doua jumătate" din ziua X și una de „prima jumătate" din aceeași zi X sunt raportate ca suprapunere, exact ca în baza de date, deși teoretic nu s-ar exclude reciproc. Fidel cu motorul SQL, nu cu o interpretare mai fină.
5. `conflictDeEchipa` e un concept cerut explicit în sarcină, dar nu apare ca atare în schema livrată (nu există prag de „absențe simultane pe echipă" în `0009_leave.sql`). L-am implementat ca funcție pur combinatorică, agnostică la sursa datelor — apelantul din stratul de acțiuni trebuie să decidă ce înseamnă „aceeași echipă" (după `department_id` din `employees`, needs verificare în Faza 2) și de unde vine `pragMaximSimultan` (probabil o coloană de configurare care încă nu există în inventar).