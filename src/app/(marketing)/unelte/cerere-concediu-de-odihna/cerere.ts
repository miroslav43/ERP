import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
import { todayInBucharest } from "@/lib/format/date";
import { cuVirgula, faraCaractereDeControl } from "@/lib/unelte/text-curat";

/**
 * Cererea de concediu de odihnă: intervalul, și câte zile consumă din sold.
 *
 * ── CE FACE DIFERIT FAȚĂ DE UN MODEL DESCĂRCAT ────────────────────────────
 * Un model în Word are un spațiu gol în care omul scrie „14 zile". Numărul ăla
 * e greșit surprinzător de des, fiindcă art. 145 alin. (3) din Codul muncii
 * spune că sărbătorile legale în care nu se lucrează NU intră în durata
 * concediului — iar cine numără pe calendar le numără.
 *
 * Aici zilele se CALCULEAZĂ: weekendurile și sărbătorile legale se scad, iar
 * cele scoase se și enumeră, cu motivul lângă fiecare. Sărbătorile vin din
 * `sarbatoriDupaZi`, adică din același cod care ține calendarul aplicației,
 * inclusiv Paștele ortodox și zilele care depind de el. E singurul lucru pe
 * care un fișier descărcat nu-l poate face.
 *
 * ── CE NU FACE, ȘI DE CE ──────────────────────────────────────────────────
 * Nu scade zile libere plătite stabilite prin contractul colectiv sau prin
 * regulamentul intern, deși art. 145 alin. (3) le exclude și pe acelea. Nu le
 * putem cunoaște: sunt ale fiecărei firme. Pagina o spune, în loc să dea un
 * număr care pare exact și nu e.
 *
 * ── CE REFUZĂ, DIN 8 OCT 2026 ─────────────────────────────────────────────
 * Auditul live a găsit trei intrări transformate tăcut în documente: o dată
 * din afara intervalului înlocuită cu implicitul (`de_la=2019-01-05` dădea o
 * cerere pentru noiembrie 2026, cu 200), o cerere de „0 zile lucrătoare” pentru
 * un weekend și ziua de azi luată în UTC. `citesteData` și verificarea din
 * `construiesteCerere` le închid.
 */

/**
 * Limitele anilor. AN_MIN e 2024, nu 2020: calendarul comun pune 6 și 7
 * ianuarie în orice an, deși au intrat în art. 139 abia la 09.03.2023 (Legea
 * 52/2023). Pentru 2020–2023 cererea ar fi scăzut două zile care atunci erau
 * lucrătoare.
 */
export const AN_MIN = 2024;
export const AN_MAX = 2035;
/** Peste un an de concediu nu mai e o cerere, e o greșeală de tastare. */
const MAX_ZILE_INTERVAL = 366;

export type ZiExclusa = Readonly<{ data: string; motiv: string }>;

export type Cerere = Readonly<{
  deLa: string;
  panaLa: string;
  zileCalendaristice: number;
  zileLucratoare: number;
  /** Zilele scoase din numărătoare, cu motivul. Weekendurile intră aici grupat. */
  excluse: readonly ZiExclusa[];
  /** Câte weekenduri au căzut în interval — numărate, nu enumerate. */
  zileWeekend: number;
  /** `null` dacă intervalul e bun; altfel motivul, gata de afișat. */
  problema: string | null;
}>;

const ZI_MS = 24 * 60 * 60 * 1000;

/** `2026-09-18` → `Date` la miezul nopții UTC, sau `null` dacă nu e o dată reală. */
function dinIso(valoare: string): Date | null {
  const potrivire = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(valoare);
  if (potrivire === null) return null;
  const [, a, l, z] = potrivire;
  const an = Number(a);
  const luna = Number(l);
  const zi = Number(z);
  const data = new Date(Date.UTC(an, luna - 1, zi));
  // Postgres ar refuza „31 februarie"; `Date.UTC` îl mută tăcut pe 3 martie.
  if (data.getUTCFullYear() !== an || data.getUTCMonth() !== luna - 1 || data.getUTCDate() !== zi) {
    return null;
  }
  return data;
}

function iso(data: Date): string {
  return `${String(data.getUTCFullYear()).padStart(4, "0")}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

export type DataCitita = Readonly<{ data: string | null; problema: string | null }>;

/**
 * O dată din adresă, citită STRICT. Lipsa nu e o greșeală — `{ data: null,
 * problema: null }`, iar apelantul pune implicitul. O valoare prezentă dar
 * greșită e o greșeală și se spune, cu numele câmpului.
 */
export function citesteData(brut: string | undefined, eticheta: string): DataCitita {
  const valoare = (brut ?? "").trim();
  if (valoare === "") return { data: null, problema: null };
  const data = dinIso(valoare);
  if (data === null) {
    return { data: null, problema: `${eticheta}: „${valoare.slice(0, 20)}” nu e o dată reală.` };
  }
  const an = data.getUTCFullYear();
  if (an < AN_MIN || an > AN_MAX) {
    return {
      data: null,
      problema: `${eticheta}: anul ${String(an)} e în afara intervalului ${String(AN_MIN)}–${String(AN_MAX)}.`,
    };
  }
  return { data: iso(data), problema: null };
}

/**
 * Data din adresă, sau implicitul — și pentru lipsă, și pentru o valoare
 * greșită. Rămâne doar pentru pagina de dinainte de 8 oct 2026; taskul F14
 * o șterge odată cu pagina veche. Codul nou folosește `citesteData`.
 */
export function normalizeazaData(brut: string | undefined, implicit: string): string {
  const data = dinIso((brut ?? "").trim());
  if (data === null) return implicit;
  const an = data.getUTCFullYear();
  return an >= AN_MIN && an <= AN_MAX ? iso(data) : implicit;
}

/**
 * Un câmp de text din adresă: un singur rând, fără caractere de control, cu
 * „ș”/„ț” cu virgulă, plafonat, fără spații la capete.
 */
export function normalizeazaText(brut: string | undefined, maxim = 120): string {
  return cuVirgula(faraCaractereDeControl(brut ?? ""))
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxim);
}

/**
 * Ziua de azi în România, ca `YYYY-MM-DD`. Nu în UTC: între miezul nopții și
 * 02:00–03:00 ora României, `new Date()` în UTC dădea ziua de ieri.
 */
export function aziIso(): string {
  return todayInBucharest();
}

/** Aceeași zi, mutată cu `n` zile. */
export function plusZile(isoData: string, n: number): string {
  const data = dinIso(isoData);
  if (data === null) return isoData;
  return iso(new Date(data.getTime() + n * ZI_MS));
}

/**
 * Intervalul cu care se deschide formularul: prima zi de luni aflată la cel
 * puțin 60 de zile de azi, până vineri în aceeași săptămână.
 *
 * 60, fiindcă art. 148 alin. (4) dă salariatului dreptul să ceară concediul cu
 * cel puțin 60 de zile înainte; luni–vineri, fiindcă implicitul vechi (azi + 30)
 * cădea pe 7 noiembrie 2026, o sâmbătă.
 */
export function intervalImplicit(azi: string): Readonly<{ deLa: string; panaLa: string }> {
  const baza = dinIso(azi) ?? new Date(Date.UTC(AN_MIN, 0, 1));
  const peste60 = new Date(baza.getTime() + 60 * ZI_MS);
  const panaLaLuni = (8 - peste60.getUTCDay()) % 7;
  const luni = new Date(peste60.getTime() + panaLaLuni * ZI_MS);
  return { deLa: iso(luni), panaLa: iso(new Date(luni.getTime() + 4 * ZI_MS)) };
}

export function construiesteCerere(deLa: string, panaLa: string): Cerere {
  const inceput = dinIso(deLa);
  const sfarsit = dinIso(panaLa);
  const gol = (problema: string): Cerere => ({
    deLa,
    panaLa,
    zileCalendaristice: 0,
    zileLucratoare: 0,
    excluse: [],
    zileWeekend: 0,
    problema,
  });

  if (inceput === null || sfarsit === null) return gol("Una dintre date nu e o zi reală.");
  if (sfarsit.getTime() < inceput.getTime()) {
    return gol("Data de sfârșit e înaintea celei de început.");
  }
  const zileCalendaristice = Math.round((sfarsit.getTime() - inceput.getTime()) / ZI_MS) + 1;
  if (zileCalendaristice > MAX_ZILE_INTERVAL) {
    return gol(`Intervalul are ${String(zileCalendaristice)} de zile — prea mult pentru o cerere.`);
  }

  // Intervalul poate traversa 31 decembrie, deci sărbătorile se cer pe ani, nu
  // pe un an presupus. Harta se construiește o dată, nu per zi.
  const sarbatori = new Map<string, string>();
  for (let an = inceput.getUTCFullYear(); an <= sfarsit.getUTCFullYear(); an += 1) {
    for (const [zi, nume] of sarbatoriDupaZi(an)) sarbatori.set(zi, nume);
  }

  const excluse: ZiExclusa[] = [];
  let zileLucratoare = 0;
  let zileWeekend = 0;

  for (let t = inceput.getTime(); t <= sfarsit.getTime(); t += ZI_MS) {
    const zi = new Date(t);
    const dow = zi.getUTCDay();
    const cheie = iso(zi);
    if (dow === 0 || dow === 6) {
      zileWeekend += 1;
      continue;
    }
    const sarbatoare = sarbatori.get(cheie);
    if (sarbatoare !== undefined) {
      excluse.push({ data: cheie, motiv: sarbatoare });
      continue;
    }
    zileLucratoare += 1;
  }

  // Numerele rămân, ca pagina să poată arăta de ce: „2 zile de weekend”.
  const problema =
    zileLucratoare === 0
      ? "Intervalul nu conține nicio zi lucrătoare: toate zilele lui sunt de weekend sau sărbători legale."
      : null;
  return { deLa, panaLa, zileCalendaristice, zileLucratoare, excluse, zileWeekend, problema };
}
