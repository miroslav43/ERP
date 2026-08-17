// src/domain/revisal/evenimente.ts
// Modul PUR pentru termenele REVISAL. Fără I/O, fără importuri de infrastructură.
// Termenele NU sunt codate aici: intră ca `ConfigurareTermen[]`, citite din public.revisal_config.
// Calendarul zilelor libere intră tot ca argument, ca să poată fi înlocuit fără să atingi logica.

export type ZiIso = string; // 'AAAA-LL-ZZ', comparabilă lexicografic

export const TIPURI_EVENIMENT = [
  "angajare",
  "modificare_salariu",
  "modificare_functie",
  "modificare_norma",
  "modificare_durata",
  "suspendare",
  "reluare_activitate",
  "detasare",
  "incetare",
  "corectie",
] as const;
export type TipEvenimentRevisal = (typeof TIPURI_EVENIMENT)[number];

export const REPERE_TERMEN = ["data_eveniment", "valabil_de_la", "data_contract"] as const;
export type ReperTermen = (typeof REPERE_TERMEN)[number];

export const STATUSURI_REVISAL = [
  "de_pregatit",
  "pregatit",
  "transmis",
  "confirmat",
  "respins",
  "anulat",
] as const;
export type StatusRevisal = (typeof STATUSURI_REVISAL)[number];

export type Rezultat<T> =
  { readonly ok: true; readonly valoare: T } | { readonly ok: false; readonly motiv: string };

export interface ConfigurareTermen {
  readonly id: string;
  /** null = configurare implicită de platformă; un rând al organizației o suprascrie. */
  readonly organizationId: string | null;
  readonly eventType: TipEvenimentRevisal;
  readonly termenZile: number;
  readonly reper: ReperTermen;
  readonly zileLucratoare: boolean;
  readonly descriere: string | null;
  readonly valabilDeLa: ZiIso;
  readonly valabilPana: ZiIso | null;
}

export interface DateEveniment {
  readonly eventType: TipEvenimentRevisal;
  readonly dataEvenimentului: ZiIso;
  readonly valabilDeLa: ZiIso | null;
  readonly dataContract: ZiIso | null;
}

// ---------------------------------------------------------------- aritmetică de zile

const TIPAR_ZI = /^\d{4}-\d{2}-\d{2}$/;
const MS_ZI = 86_400_000;

function laMilisecunde(zi: ZiIso): number {
  return Date.parse(`${zi}T00:00:00Z`);
}

function laZiIso(milisecunde: number): ZiIso {
  return new Date(milisecunde).toISOString().slice(0, 10);
}

export function esteZiIso(valoare: string): boolean {
  if (!TIPAR_ZI.test(valoare)) return false;
  const milisecunde = laMilisecunde(valoare);
  return Number.isFinite(milisecunde) && laZiIso(milisecunde) === valoare;
}

export function adaugaZileCalendaristice(zi: ZiIso, numar: number): ZiIso {
  return laZiIso(laMilisecunde(zi) + numar * MS_ZI);
}

/** Pozitiv dacă `a` este după `b`. */
export function diferentaInZile(a: ZiIso, b: ZiIso): number {
  return Math.round((laMilisecunde(a) - laMilisecunde(b)) / MS_ZI);
}

export function esteWeekend(zi: ZiIso): boolean {
  const ziuaSaptamanii = new Date(laMilisecunde(zi)).getUTCDay();
  return ziuaSaptamanii === 0 || ziuaSaptamanii === 6;
}

/** Paștele ortodox (Meeus, calendar iulian + 13 zile). Valabil pentru anii 1900–2099. */
export function pasteOrtodox(an: number): ZiIso {
  const a = an % 4;
  const b = an % 7;
  const c = an % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const luna = Math.floor((d + e + 114) / 31);
  const zi = ((d + e + 114) % 31) + 1;
  return laZiIso(Date.UTC(an, luna - 1, zi) + 13 * MS_ZI);
}

const ZILE_FIXE = [
  "01-01",
  "01-02",
  "01-06",
  "01-07",
  "01-24",
  "05-01",
  "06-01",
  "08-15",
  "11-30",
  "12-01",
  "12-25",
  "12-26",
] as const;

/**
 * Sărbătorile legale (art. 139 Codul muncii). Lista se schimbă prin lege —
 * DE CONFIRMAT anual cu juristul; zilele suplimentare se pot injecta din configurare.
 */
export function sarbatoriLegale(an: number): readonly ZiIso[] {
  const prefix = String(an).padStart(4, "0");
  const paste = pasteOrtodox(an);
  const mobile: readonly ZiIso[] = [
    adaugaZileCalendaristice(paste, -2), // Vinerea Mare
    paste,
    adaugaZileCalendaristice(paste, 1),
    adaugaZileCalendaristice(paste, 49), // Rusalii
    adaugaZileCalendaristice(paste, 50),
  ];
  return [...ZILE_FIXE.map((zi) => `${prefix}-${zi}`), ...mobile].sort();
}

export interface CalendarLucrator {
  readonly zileLibere: ReadonlySet<ZiIso>;
}

export function construiesteCalendar(
  anInceput: number,
  anSfarsit: number,
  suplimentare: readonly ZiIso[] = [],
): CalendarLucrator {
  const zileLibere = new Set<ZiIso>();
  const minim = Math.min(anInceput, anSfarsit) - 1;
  const maxim = Math.max(anInceput, anSfarsit) + 1;
  for (let an = minim; an <= maxim; an += 1) {
    for (const zi of sarbatoriLegale(an)) zileLibere.add(zi);
  }
  for (const zi of suplimentare) zileLibere.add(zi);
  return { zileLibere };
}

export function esteZiLucratoare(zi: ZiIso, calendar: CalendarLucrator): boolean {
  return !esteWeekend(zi) && !calendar.zileLibere.has(zi);
}

/**
 * Deplasează cu `numar` zile lucrătoare (negativ = înapoi). `numar = 0` întoarce ziua
 * nemodificată: „cel târziu la data încetării" nu se rotunjește la o zi lucrătoare.
 * Întoarce null dacă nu se poate încheia — calendar coruptibil, nu se ghicește.
 */
export function deplaseazaZileLucratoare(
  zi: ZiIso,
  numar: number,
  calendar: CalendarLucrator,
): ZiIso | null {
  if (numar === 0) return zi;
  const pas = numar > 0 ? 1 : -1;
  let ramase = Math.abs(numar);
  let curent = zi;
  for (let i = 0; i < 2000 && ramase > 0; i += 1) {
    curent = adaugaZileCalendaristice(curent, pas);
    if (esteZiLucratoare(curent, calendar)) ramase -= 1;
  }
  return ramase === 0 ? curent : null;
}

// ---------------------------------------------------------------- alegerea configurării

/** Rândul organizației bate rândul de platformă; la egalitate câștigă cel mai recent `valabil_de_la`. */
export function alegeConfigurare(
  configurari: readonly ConfigurareTermen[],
  tip: TipEvenimentRevisal,
  laData: ZiIso,
): ConfigurareTermen | null {
  const candidate = configurari.filter(
    (c) =>
      c.eventType === tip &&
      c.valabilDeLa <= laData &&
      (c.valabilPana === null || c.valabilPana >= laData),
  );
  const ordonate = [...candidate].sort((a, b) => {
    const prioritate = Number(b.organizationId !== null) - Number(a.organizationId !== null);
    if (prioritate !== 0) return prioritate;
    if (a.valabilDeLa === b.valabilDeLa) return 0;
    return a.valabilDeLa < b.valabilDeLa ? 1 : -1;
  });
  return ordonate[0] ?? null;
}

// ---------------------------------------------------------------- calculul termenului

export interface TermenCalculat {
  readonly configurareId: string;
  readonly reper: ReperTermen;
  readonly dataReper: ZiIso;
  readonly termenZile: number;
  readonly zileLucratoare: boolean;
  readonly termenTransmitere: ZiIso;
  readonly explicatie: string;
}

const ETICHETA_REPER: Record<ReperTermen, string> = {
  data_eveniment: "data evenimentului",
  valabil_de_la: "data de la care produce efecte contractul",
  data_contract: "data încheierii contractului",
};

function dataDeReper(eveniment: DateEveniment, reper: ReperTermen): ZiIso | null {
  if (reper === "data_eveniment") return eveniment.dataEvenimentului;
  if (reper === "valabil_de_la") return eveniment.valabilDeLa;
  return eveniment.dataContract;
}

export function calculeazaTermen(
  eveniment: DateEveniment,
  configurari: readonly ConfigurareTermen[],
  calendar: CalendarLucrator,
): Rezultat<TermenCalculat> {
  if (!esteZiIso(eveniment.dataEvenimentului)) {
    return { ok: false, motiv: "Data evenimentului lipsește sau nu este o dată validă." };
  }
  const configurare = alegeConfigurare(
    configurari,
    eveniment.eventType,
    eveniment.dataEvenimentului,
  );
  if (configurare === null) {
    return {
      ok: false,
      motiv: `Nu există un termen configurat pentru evenimentul „${eveniment.eventType}" la data de ${eveniment.dataEvenimentului}. Completați configurarea REVISAL înainte de a înregistra evenimentul.`,
    };
  }
  const dataReper = dataDeReper(eveniment, configurare.reper);
  if (dataReper === null || !esteZiIso(dataReper)) {
    return {
      ok: false,
      motiv: `Termenul se raportează la ${ETICHETA_REPER[configurare.reper]}, dar această dată nu este completată pe contract.`,
    };
  }

  const termenTransmitere = configurare.zileLucratoare
    ? deplaseazaZileLucratoare(dataReper, configurare.termenZile, calendar)
    : adaugaZileCalendaristice(dataReper, configurare.termenZile);

  if (termenTransmitere === null) {
    return {
      ok: false,
      motiv: "Termenul nu a putut fi calculat: calendarul zilelor lucrătoare este incomplet.",
    };
  }

  const numarZile = Math.abs(configurare.termenZile);
  const unitate = configurare.zileLucratoare ? "lucrătoare" : "calendaristice";
  const explicatie =
    configurare.termenZile === 0
      ? `Chiar la ${ETICHETA_REPER[configurare.reper]} (${dataReper}).`
      : `${numarZile} ${numarZile === 1 ? "zi" : "zile"} ${unitate} ${configurare.termenZile < 0 ? "înainte de" : "după"} ${ETICHETA_REPER[configurare.reper]} (${dataReper}).`;

  return {
    ok: true,
    valoare: {
      configurareId: configurare.id,
      reper: configurare.reper,
      dataReper,
      termenZile: configurare.termenZile,
      zileLucratoare: configurare.zileLucratoare,
      termenTransmitere,
      explicatie,
    },
  };
}

// ---------------------------------------------------------------- starea față de termen

export type StareTermen = "transmis" | "anulat" | "in_termen" | "astazi" | "intarziat";

export interface EvaluareTermen {
  readonly stare: StareTermen;
  /** Zile rămase (pozitiv) sau zile de întârziere (pozitiv, în `zileIntarziere`). */
  readonly zileRamase: number;
  readonly zileIntarziere: number;
}

export function evalueazaTermen(
  termenTransmitere: ZiIso,
  azi: ZiIso,
  status: StatusRevisal,
): EvaluareTermen {
  if (status === "transmis" || status === "confirmat") {
    return { stare: "transmis", zileRamase: 0, zileIntarziere: 0 };
  }
  if (status === "anulat") {
    return { stare: "anulat", zileRamase: 0, zileIntarziere: 0 };
  }
  const delta = diferentaInZile(termenTransmitere, azi);
  if (delta < 0) return { stare: "intarziat", zileRamase: 0, zileIntarziere: -delta };
  if (delta === 0) return { stare: "astazi", zileRamase: 0, zileIntarziere: 0 };
  return { stare: "in_termen", zileRamase: delta, zileIntarziere: 0 };
}

// ---------------------------------------------------------------- deducerea evenimentelor

export interface StareContractRevisal {
  readonly salariuBaza: number;
  readonly jobPositionId: string | null;
  readonly normaOreSaptamana: number;
  readonly normaOreZi: number;
  readonly contractDuration: "nedeterminat" | "determinat";
  readonly valabilPana: ZiIso | null;
  readonly status: "proiect" | "activ" | "suspendat" | "incetat" | "anulat";
}

/**
 * Compară două stări ale aceluiași contract și spune ce evenimente REVISAL se nasc.
 * Pur, deci se poate rula identic din formularul de editare și din importul în masă.
 */
export function deduceEvenimenteContract(
  vechi: StareContractRevisal | null,
  nou: StareContractRevisal,
): readonly TipEvenimentRevisal[] {
  if (vechi === null) {
    return nou.status === "activ" ? ["angajare"] : [];
  }
  const tipuri: TipEvenimentRevisal[] = [];
  if (vechi.status !== "activ" && nou.status === "activ" && vechi.status === "proiect") {
    tipuri.push("angajare");
  }
  if (vechi.status === "activ" && nou.status === "suspendat") tipuri.push("suspendare");
  if (vechi.status === "suspendat" && nou.status === "activ") tipuri.push("reluare_activitate");
  if (vechi.status !== "incetat" && nou.status === "incetat") tipuri.push("incetare");

  if (nou.status !== "anulat" && nou.status !== "incetat") {
    if (vechi.salariuBaza !== nou.salariuBaza) tipuri.push("modificare_salariu");
    if (vechi.jobPositionId !== nou.jobPositionId) tipuri.push("modificare_functie");
    if (vechi.normaOreSaptamana !== nou.normaOreSaptamana || vechi.normaOreZi !== nou.normaOreZi) {
      tipuri.push("modificare_norma");
    }
    if (vechi.contractDuration !== nou.contractDuration || vechi.valabilPana !== nou.valabilPana) {
      tipuri.push("modificare_durata");
    }
  }
  return tipuri;
}
