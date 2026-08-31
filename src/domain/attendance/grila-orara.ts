// src/domain/attendance/grila-orara.ts
/**
 * Aritmetica grilei orare săptămânale: unde cade un bloc pe verticală, ce oră a
 * atins degetul, cât de largă trebuie să fie fereastra ca să încapă tot.
 *
 * ── DE CE ÎN `domain`, NU LÂNGĂ COMPONENTĂ ────────────────────────────────
 * Același motiv scris în capul lui `calendar/grila-lunara.ts`: o grilă greșită
 * nu aruncă nicio eroare. Desenează blocul cu o oră mai sus, aliniază tragerea
 * la minutul vecin, taie ultimul sfert de oră al zilei — și totul arată perfect
 * normal. Aici e pur și fără DOM, deci intră în proiectul `unit` din
 * `vitest.config.mts`; o componentă de pagină nu e ridicată de niciun proiect
 * de test din depozit.
 *
 * Componenta păstrează exact ce nu se poate muta: `getBoundingClientRect()`,
 * `clientY`, `setPointerCapture`. Ea calculează o singură mărime — fracțiunea
 * verticală 0…1 — și de acolo încolo doar cheamă funcțiile de mai jos.
 *
 * ── MONEDA INTERNĂ: MINUTE DE LA MIEZUL NOPȚII ────────────────────────────
 * Un întreg, nu un `Date` și nu un șir. Conversia la și dinspre `"HH:MM"` trece
 * prin `minuteDinOra`/`oraDinMinute` din `calcul-ore.ts`, adică prin EXACT
 * aceleași funcții pe care le folosește `oreleZilei` — dacă grila ar avea copia
 * ei privată, blocul de pe ecran și ora salvată în bază s-ar putea despărți
 * fără ca nimic să semnaleze.
 */

import { formatOraZi } from "@/lib/format/ore";

import { minuteDinOra, oraDinMinute } from "./calcul-ore";

/** Pasul grilei: sfertul de oră. Ce se poate selecta trăgând, și doar atât. */
export const PAS_MINUTE = 15;

const MINUTE_PE_ORA = 60;
const MINUTE_PE_ZI = 24 * MINUTE_PE_ORA;

/**
 * Ultimul minut care se poate SCRIE ca oră: `23:59`.
 *
 * `24:00` nu e o oră nici pentru `oraOptionala` din `schemas/attendance.ts`
 * (`^([01]\d|2[0-3]):[0-5]\d$`), nici pentru `minuteDinOra`. O tragere până la
 * marginea de jos a unei zile întregi se oprește deci la `23:59`, nu la
 * `24:00` — ultimul sfert de oră al zilei se scrie `23:45–23:59`.
 */
const ULTIMUL_MINUT = MINUTE_PE_ZI - 1;

/** Fereastra afișată pe verticală, în minute de la miezul nopții. */
export interface IntervalGrila {
  /** Marginea de sus. `360` = 06:00. */
  readonly de: number;
  /** Marginea de jos. `1320` = 22:00. */
  readonly pana: number;
}

/**
 * Programul obișnuit, cât să încapă pe ecran fără derulare.
 *
 * Nu e o regulă de firmă și nu vine din `attendance_settings`: e doar ce se
 * vede la deschidere. Orice intrare din afara lui lărgește fereastra —
 * `intervalulGrilei` — deci nicio oră lucrată nu se poate ascunde în spatele
 * acestei alegeri.
 */
export const INTERVAL_IMPLICIT: IntervalGrila = { de: 6 * MINUTE_PE_ORA, pana: 22 * MINUTE_PE_ORA };

/** Forma minimă a unei zile, cât îi trebuie grilei ca s-o poată așeza. */
export interface IntervalZi {
  readonly oraInceput: string | null;
  readonly oraSfarsit: string | null;
}

/**
 * Minute de la miezul nopții dintr-o oră care poate veni cu secunde.
 *
 * O coloană `time` din Postgres ajunge în client ca `"08:30:00"`, iar
 * `minuteDinOra` — strict, fiindcă păzește aritmetica de salarizare — o
 * respinge. Toleranța stă AICI, la intrarea în grilă, și nu se propagă mai
 * departe: fără ea, blocurile ar dispărea tăcut de pe ecran pentru fiecare
 * intrare citită direct din bază, ceea ce e cel mai probabil fel în care se
 * strică ecranul ăsta.
 */
export function minutulOrei(ora: string | null | undefined): number | null {
  const canonic = formatOraZi(ora);
  return canonic === null ? null : minuteDinOra(canonic);
}

function laOraIntreagaJos(minute: number): number {
  return Math.max(0, Math.floor(minute / MINUTE_PE_ORA) * MINUTE_PE_ORA);
}

function laOraIntreagaSus(minute: number): number {
  return Math.min(MINUTE_PE_ZI, Math.ceil(minute / MINUTE_PE_ORA) * MINUTE_PE_ORA);
}

/**
 * Fereastra lărgită cât să cuprindă toate intrările săptămânii.
 *
 * Marginile se rotunjesc la ora ÎNTREAGĂ, ca liniile de ceas din jgheab să
 * rămână întregi: o tură care începe la 05:20 coboară marginea la 05:00, nu la
 * 05:20 — altfel rigla ar scrie ore la sferturi și n-ar mai fi o riglă.
 *
 * Ziua deschisă cu ceasul și neînchisă (`ora_inceput` fără `ora_sfarsit`, adică
 * cineva care a apăsat „Am intrat" și n-a ieșit încă) contează cu un sfert de
 * oră: destul cât să existe pe ecran, fără să pretindă o durată pe care n-o
 * cunoaște nimeni.
 */
export function intervalulGrilei(
  intrari: readonly IntervalZi[],
  baza: IntervalGrila = INTERVAL_IMPLICIT,
): IntervalGrila {
  let de = baza.de;
  let pana = baza.pana;

  for (const intrare of intrari) {
    const inceput = minutulOrei(intrare.oraInceput);
    // Fără oră de început nu există bloc de desenat — ziua poate fi de concediu
    // sau completată doar cu numărul de ore, iar aceea nu are loc pe verticală.
    if (inceput === null) continue;
    const sfarsit = minutulOrei(intrare.oraSfarsit);
    const capat = Math.max(sfarsit ?? 0, inceput + PAS_MINUTE);

    de = Math.min(de, laOraIntreagaJos(inceput));
    pana = Math.max(pana, laOraIntreagaSus(capat));
  }

  return { de, pana };
}

/** Înălțimea ferestrei în ore — de aici își ia componenta înălțimea în pixeli. */
export function inaltimeaInOre(interval: IntervalGrila): number {
  return (interval.pana - interval.de) / MINUTE_PE_ORA;
}

/** Orele întregi de scris în jgheab: `06:00`, `07:00`, … Marginea de jos nu se scrie. */
export function liniileOrare(interval: IntervalGrila): readonly string[] {
  const ore: string[] = [];
  for (let m = laOraIntreagaSus(interval.de); m < interval.pana; m += MINUTE_PE_ORA) {
    ore.push(oraDinMinute(m));
  }
  return ore;
}

/**
 * Fracțiunea verticală 0…1 din corpul unei coloane → minutul aliniat la pas.
 *
 * Rotunjirea e la cel mai APROPIAT sfert, nu în jos: cine oprește degetul la
 * două minute de 09:00 a vrut 09:00, nu 08:45.
 *
 * Plafonarea se face și aici, nu doar în componentă: un pointer capturat poate
 * ieși din coloană (asta e chiar rostul lui `setPointerCapture`), iar o
 * fracțiune de `1.4` ar produce altfel o oră din ziua următoare.
 */
export function minutulDinFractie(
  fractie: number,
  interval: IntervalGrila,
  pas: number = PAS_MINUTE,
): number {
  const inaltime = interval.pana - interval.de;
  const brut = interval.de + fractie * inaltime;
  const aliniat = Math.round(brut / pas) * pas;
  return Math.min(interval.pana, Math.max(interval.de, aliniat));
}

export interface SelectieOrara {
  readonly inceput: string;
  readonly sfarsit: string;
}

/**
 * Cele două capete ale tragerii → intervalul de pus în dialog.
 *
 * Trei lucruri, toate învățate din felul în care oamenii chiar trag cu degetul:
 *
 * 1. **Se ordonează.** Se trage și de jos în sus la fel de des ca invers.
 * 2. **Are un pas minim.** O atingere fără mișcare — adică un click — dă un
 *    sfert de oră. Un început egal cu sfârșitul ar fi respins de `oreleZilei`
 *    cu `null`, iar omul ar vedea dialogul deschizându-se cu un interval pe care
 *    salvarea îl refuză.
 * 3. **Se oprește la `23:59`.** Vezi `ULTIMUL_MINUT`: ultimul sfert de oră al
 *    zilei se scrie `23:45–23:59`, fiindcă `24:00` nu se poate salva.
 *
 * `null` doar când nu mai rămâne loc pentru niciun interval — o tragere care
 * începe chiar la `23:59`.
 */
export function selectiaDinTragere(
  aMinute: number,
  bMinute: number,
  interval: IntervalGrila,
  pas: number = PAS_MINUTE,
): SelectieOrara | null {
  const de = Math.max(interval.de, Math.min(aMinute, bMinute));
  let pana = Math.min(ULTIMUL_MINUT, Math.max(aMinute, bMinute));

  if (pana - de < pas) pana = Math.min(ULTIMUL_MINUT, de + pas);
  if (pana <= de) return null;

  return { inceput: oraDinMinute(de), sfarsit: oraDinMinute(pana) };
}

export interface PozitieBloc {
  /** Distanța de la marginea de sus a ferestrei, în procente. */
  readonly susProcent: number;
  readonly inaltimeProcent: number;
  /** Blocul iese din fereastră — componenta îl marchează, ca să nu pară scurtat. */
  readonly taiat: boolean;
}

/**
 * Unde stă blocul unei zile în fereastră, în procente.
 *
 * Procente, nu pixeli: înălțimea corpului grilei o fixează componenta (ore ×
 * înălțimea unei ore), iar blocul o urmează. Aceeași măsurătoare — dreptunghiul
 * coloanei — servește și aritmetica de pointer, deci cele două nu se pot
 * despărți.
 *
 * `null` înseamnă „nimic de desenat": zi fără oră de început, interval întors
 * pe dos, sau bloc căzut în întregime în afara ferestrei (imposibil după
 * `intervalulGrilei`, dar funcția nu presupune că a fost chemată).
 */
export function pozitiaBlocului(
  oraInceput: string | null,
  oraSfarsit: string | null,
  interval: IntervalGrila,
): PozitieBloc | null {
  const inceput = minutulOrei(oraInceput);
  if (inceput === null) return null;

  const sfarsitCitit = minutulOrei(oraSfarsit);
  // Ziua în curs: „Am intrat" fără „Am ieșit". Primește un sfert de oră cât să
  // se vadă; că e neîncheiată o spune componenta, prin altceva decât înălțimea.
  const sfarsit = sfarsitCitit ?? inceput + PAS_MINUTE;
  if (sfarsit <= inceput) return null;

  const inaltimeFereastra = interval.pana - interval.de;
  if (inaltimeFereastra <= 0) return null;

  const sus = Math.max(inceput, interval.de);
  const jos = Math.min(sfarsit, interval.pana);
  if (jos <= sus) return null;

  return {
    susProcent: ((sus - interval.de) / inaltimeFereastra) * 100,
    inaltimeProcent: ((jos - sus) / inaltimeFereastra) * 100,
    taiat: inceput < interval.de || sfarsit > interval.pana,
  };
}
