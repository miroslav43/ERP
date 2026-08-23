/**
 * Datele foii colective de prezență din heroul landing-ului.
 *
 * Foaia nu e o ilustrație: e un document care se ÎNCHIDE. Suma pe cele opt
 * rânduri, suma pe cele treizeci de coloane și totalul general sunt același
 * număr, iar vizitatorul poate face adunarea singur, pe ecran. De aceea aici nu
 * există nicio cifră scrisă de mână în afară de excepțiile fiecărui angajat —
 * restul se DERIVĂ, iar `foaia-date.test.ts` cade dacă vreodată nu se mai închide.
 *
 * De ce aprilie 2026. Luna conține Vinerea Mare (10 aprilie) și a doua zi de
 * Paște (13 aprilie) ca zile libere legale, în timp ce Paștele ortodox cade
 * duminică (12 aprilie) și deci NU adaugă o zi liberă. Rezultatul — douăzeci de
 * zile lucrătoare, o sută șaizeci de ore normă — e o propoziție pe care orice om
 * de salarizare o poate verifica, și e dovada că sărbătorile mobile chiar se
 * calculează din data Paștelui. Martie 2026 n-are nicio sărbătoare legală: o
 * celulă de sărbătoare acolo ar fi fost prima minciună de pe pagină.
 *
 * Sărbătorile NU sunt o listă copiată aici. Vin din `sarbatoriAnului()`, exact
 * funcția pe care o folosește aplicația la calculul zilelor lucrătoare.
 */
import { sarbatoriAnului } from "@/domain/calendar/sarbatori";

export const AN_FOAIE = 2026;
export const LUNA_FOAIE = 4;
export const ORE_NORMA_ZI = 8;

/**
 * Cele șapte valori ale enum-ului `attendance_day_type` din
 * `0013_attendance.sql`. Nu se inventează un al optulea cod pentru pagină:
 * testul le compară cu tipurile generate din baza reală.
 */
export type TipZiFoaie =
  | "lucratoare"
  | "weekend"
  | "sarbatoare"
  | "concediu"
  | "medical"
  | "absenta_nemotivata"
  | "delegatie"
  | "fara_plata";

/**
 * Codul scris în celulă. Ziua lucrătoare și weekendul nu au cod — o foaie
 * reală nu scrie „L" în fiecare casetă, scrie ore.
 */
export const COD_ZI: Readonly<Record<TipZiFoaie, string | null>> = {
  lucratoare: null,
  weekend: null,
  sarbatoare: "SL",
  concediu: "CO",
  medical: "CM",
  absenta_nemotivata: "AN",
  delegatie: "D",
  fara_plata: "CFP",
};

export const LEGENDA: readonly Readonly<{ cod: string; tip: TipZiFoaie; text: string }>[] = [
  { cod: "SL", tip: "sarbatoare", text: "sărbătoare legală" },
  { cod: "CO", tip: "concediu", text: "concediu de odihnă" },
  { cod: "CM", tip: "medical", text: "concediu medical" },
  { cod: "D", tip: "delegatie", text: "delegație" },
  { cod: "AN", tip: "absenta_nemotivata", text: "absență nemotivată" },
  { cod: "CFP", tip: "fara_plata", text: "concediu fără plată" },
];

export type Celula = Readonly<{
  zi: number;
  tip: TipZiFoaie;
  ore: number;
  suplimentare: number;
  noapte: number;
}>;

export type RandFoaie = Readonly<{
  nume: string;
  celule: readonly Celula[];
  ore: number;
  suplimentare: number;
  noapte: number;
}>;

export type ZiCalendar = Readonly<{
  zi: number;
  litera: string;
  nelucratoare: boolean;
  sarbatoare: string | null;
}>;

export type Fereastra = Readonly<{
  cheie: string;
  eticheta: string;
  eticheteLunga: string;
  prima: number;
  ultima: number;
  total: number;
}>;

/** Excepțiile unui angajat față de ziua implicită de opt ore. */
type Exceptie = Readonly<{
  zile: readonly number[];
  tip?: TipZiFoaie;
  ore?: number;
  suplimentare?: number;
  noapte?: number;
}>;

type SpecAngajat = Readonly<{ nume: string; exceptii: readonly Exceptie[] }>;

/**
 * Singurele cifre scrise de mână din tot modulul. Fiecare are o poveste pe care
 * un om de HR o recunoaște: două zile lungi înainte de Paște, un concediu de o
 * săptămână, o lună de ture de noapte, un concediu medical de trei zile, o
 * delegație, o absență nemotivată, o zi de unsprezece ore la închiderea lunii.
 */
const SPEC: readonly SpecAngajat[] = [
  { nume: "Popa I.", exceptii: [{ zile: [7, 8], ore: 10, suplimentare: 2 }] },
  { nume: "Ilie M.", exceptii: [{ zile: [20, 21, 22, 23, 24], tip: "concediu", ore: 0 }] },
  { nume: "Radu A.", exceptii: [{ zile: [6, 7, 8, 9], noapte: 6 }] },
  { nume: "Marin D.", exceptii: [{ zile: [7, 8, 9], tip: "medical", ore: 0 }] },
  { nume: "Vlad C.", exceptii: [{ zile: [15, 16, 17], tip: "delegatie" }] },
  {
    nume: "Toma S.",
    exceptii: [
      { zile: [17], ore: 7.5 },
      { zile: [23], tip: "absenta_nemotivata", ore: 0 },
    ],
  },
  { nume: "Dinu R.", exceptii: [{ zile: [30], ore: 11, suplimentare: 3 }] },
  {
    nume: "Enache V.",
    exceptii: [
      { zile: [16, 17], tip: "concediu", ore: 0 },
      { zile: [14], noapte: 8 },
    ],
  },
] as const;

/** L M M J V S D — inițialele zilelor, cum sunt tipărite pe orice pontaj.
 * Șir, nu tablou: indexarea unui șir întoarce mereu `string`, deci nu cere
 * nici asertare, nici valoare de rezervă inventată. */
const LITERE_ZI = "LMMJVSD";

function zileInLuna(an: number, luna: number): number {
  return new Date(Date.UTC(an, luna, 0)).getUTCDate();
}

function construiesteCalendar(an: number, luna: number): readonly ZiCalendar[] {
  const sarbatori = new Map(
    sarbatoriAnului(an)
      .filter((s) => s.data.getUTCFullYear() === an && s.data.getUTCMonth() === luna - 1)
      .map((s) => [s.data.getUTCDate(), s.denumire] as const),
  );

  const zile: ZiCalendar[] = [];
  for (let zi = 1; zi <= zileInLuna(an, luna); zi += 1) {
    const iso = new Date(Date.UTC(an, luna - 1, zi)).getUTCDay(); // 0 = duminică
    const indice = (iso + 6) % 7; // 0 = luni
    const weekend = indice >= 5;
    const sarbatoare = sarbatori.get(zi) ?? null;
    zile.push({
      zi,
      litera: LITERE_ZI.charAt(indice),
      // Paștele ortodox cade duminică în 2026: e sărbătoare legală, dar nu
      // adaugă o zi liberă. Pe foaie rămâne weekend, fiindcă asta e.
      nelucratoare: weekend || sarbatoare !== null,
      sarbatoare: weekend ? null : sarbatoare,
    });
  }
  return zile;
}

function construiesteRand(spec: SpecAngajat, zile: readonly ZiCalendar[]): RandFoaie {
  const exceptii = new Map<number, Exceptie>();
  for (const exceptie of spec.exceptii) {
    for (const zi of exceptie.zile) {
      exceptii.set(zi, { ...exceptii.get(zi), ...exceptie });
    }
  }

  const celule = zile.map((zi): Celula => {
    if (zi.sarbatoare !== null) {
      return { zi: zi.zi, tip: "sarbatoare", ore: 0, suplimentare: 0, noapte: 0 };
    }
    if (zi.nelucratoare) {
      return { zi: zi.zi, tip: "weekend", ore: 0, suplimentare: 0, noapte: 0 };
    }
    const exceptie = exceptii.get(zi.zi);
    return {
      zi: zi.zi,
      tip: exceptie?.tip ?? "lucratoare",
      ore: exceptie?.ore ?? ORE_NORMA_ZI,
      suplimentare: exceptie?.suplimentare ?? 0,
      noapte: exceptie?.noapte ?? 0,
    };
  });

  const aduna = (ia: (c: Celula) => number) => celule.reduce((s, c) => s + ia(c), 0);
  return {
    nume: spec.nume,
    celule,
    ore: aduna((c) => c.ore),
    suplimentare: aduna((c) => c.suplimentare),
    noapte: aduna((c) => c.noapte),
  };
}

const zile = construiesteCalendar(AN_FOAIE, LUNA_FOAIE);
const randuri = SPEC.map((spec) => construiesteRand(spec, zile));

const totaluriPeZi: readonly number[] = zile.map((_zi, index) =>
  randuri.reduce((suma, rand) => {
    const celula = rand.celule[index];
    return suma + (celula === undefined ? 0 : celula.ore);
  }, 0),
);

const total = randuri.reduce((s, r) => s + r.ore, 0);

function totalInterval(prima: number, ultima: number): number {
  return totaluriPeZi.slice(prima - 1, ultima).reduce((s, o) => s + o, 0);
}

/**
 * Cele trei tăieturi ale foii. Pe ecran îngust documentul NU se derulează
 * lateral — se taie, exact cum se taie un formular tipărit. Fiecare fereastră
 * își poartă propriul total, iar totalurile ferestrelor se adună înapoi la
 * totalul lunii: reconcilierea supraviețuiește și pe telefon.
 */
function construiesteSaptamani(): readonly Fereastra[] {
  const ferestre: Fereastra[] = [];
  let prima = 1;
  let index = 1;
  while (prima <= zile.length) {
    let ultima = prima;
    while (ultima < zile.length && zile[ultima]?.litera !== "L") ultima += 1;
    ferestre.push({
      cheie: `s${index}`,
      eticheta: `S${index}`,
      eticheteLunga: `Săptămâna ${index}, zilele ${prima}–${ultima}`,
      prima,
      ultima,
      total: totalInterval(prima, ultima),
    });
    prima = ultima + 1;
    index += 1;
  }
  return ferestre;
}

const jumatati: readonly Fereastra[] = [
  {
    cheie: "j1",
    eticheta: "1–15",
    eticheteLunga: "Prima jumătate a lunii, zilele 1–15",
    prima: 1,
    ultima: 15,
    total: totalInterval(1, 15),
  },
  {
    cheie: "j2",
    eticheta: "16–30",
    eticheteLunga: "A doua jumătate a lunii, zilele 16–30",
    prima: 16,
    ultima: zile.length,
    total: totalInterval(16, zile.length),
  },
];

export const FOAIA = {
  an: AN_FOAIE,
  luna: LUNA_FOAIE,
  zile,
  randuri,
  totaluriPeZi,
  total,
  suplimentare: randuri.reduce((s, r) => s + r.suplimentare, 0),
  noapte: randuri.reduce((s, r) => s + r.noapte, 0),
  zileLucratoare: zile.filter((z) => !z.nelucratoare).length,
  jumatati,
  saptamani: construiesteSaptamani(),
} as const;

export const NORMA_LUNARA = FOAIA.zileLucratoare * ORE_NORMA_ZI;

const FORMAT_ORE = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** „1 198,5" — spațiu la mii, virgulă la zecimale, ca pe orice document românesc. */
export function formateazaOre(ore: number): string {
  return FORMAT_ORE.format(ore);
}
