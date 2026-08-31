// src/domain/leave/planificator.ts
//
// Planificatorul de concedii: aceleași date ca grila lunară, altă formă.
//
// Grila lunară (`calendar/grila-calendar.tsx`) răspunde la „cine lipsește pe 9
// martie". Planificatorul răspunde la cealaltă întrebare, cea pe care nimeni nu
// o putea pune: „cum arată luna pentru Ionescu, și se suprapune cu a lui Popa".
// Un rând per angajat, o coloană per zi.
//
// Modulul e PUR și nu importă nimic din React sau din Supabase: ce se poate
// calcula fără ecran se calculează aici, cu teste. Componenta primește
// structuri gata făcute și nu mai ia nicio decizie.

import type { StatusCerere } from "@/schemas/leave";
import { esteZiLucratoareIso, type ZiCalendaristica } from "./zile-cerere";

/**
 * Ce poate purta o casetă din grilă.
 *
 * Cele două stări NU sunt cele cinci statusuri ale cererii: planificatorul
 * arată doar cereri vii (`trimisa`, `in_aprobare`, `aprobata`), iar dintre ele
 * singura distincție care interesează pe ecran e „s-a decis / nu s-a decis".
 * O cerere respinsă sau anulată nu ocupă ziua nimănui, deci nu are casetă.
 */
export type StareAbsenta = "aprobata" | "in_aprobare";

export interface AbsentaCelula {
  readonly tipId: string;
  readonly tipDenumire: string;
  /** `leave_types.culoare`, hex ales de administrator dintr-un selector liber. */
  readonly tipCuloare: string;
  readonly stare: StareAbsenta;
}

export interface ZiPlanificator {
  readonly iso: ZiCalendaristica;
  /** Ziua din lună, 1…31. */
  readonly zi: number;
  /** ISO-dow: luni = 1 … duminică = 7. */
  readonly dowIso: number;
  /**
   * Zi în care nu se lucrează — weekend, sărbătoare națională sau liber
   * suplimentar al firmei, MINUS zilele de recuperare. Coloana se umbrește:
   * altfel o pauză de trei zile în mijlocul unui concediu pare o întrerupere,
   * când e doar un weekend.
   */
  readonly nelucratoare: boolean;
}

/** Inițiala zilei săptămânii, pentru antetul îngust al coloanei. */
export const INITIALE_ZILE: readonly string[] = ["L", "Ma", "Mi", "J", "V", "S", "D"];

const NUME_ZILE: readonly string[] = [
  "luni",
  "marți",
  "miercuri",
  "joi",
  "vineri",
  "sâmbătă",
  "duminică",
];

/** Numele zilei săptămânii pentru un ISO-dow (1…7). Gol pentru orice altceva. */
export function numeZiSaptamana(dowIso: number): string {
  return NUME_ZILE[dowIso - 1] ?? "";
}

/** Câte zile are luna. `luna` e 1…12, ca peste tot în proiect. */
export function numarZileLuna(an: number, luna: number): number {
  return new Date(Date.UTC(an, luna, 0)).getUTCDate();
}

function ziIso(an: number, luna: number, zi: number): ZiCalendaristica {
  return `${String(an)}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
}

/**
 * Coloanele lunii, în ordine, cu marcajul de zi nelucrătoare.
 *
 * Ordinea de decizie NU se rescrie aici: se împrumută din `zile-cerere.ts`,
 * care o ține sincronizată cu `app.este_zi_lucratoare` din 0009. Dacă
 * planificatorul ar umbri altceva decât umbrește baza, omul ar vedea o zi
 * liberă peste care i s-a scăzut totuși o zi din sold.
 */
export function zilelePlanificatorului(
  an: number,
  luna: number,
  sarbatoriRo: readonly ZiCalendaristica[],
  liberSuplimentar: readonly ZiCalendaristica[],
  zileRecuperare: readonly ZiCalendaristica[],
): readonly ZiPlanificator[] {
  const setSarbatori = new Set(sarbatoriRo);
  const setLiber = new Set(liberSuplimentar);
  const setRecuperare = new Set(zileRecuperare);

  return Array.from({ length: numarZileLuna(an, luna) }, (_, index) => {
    const zi = index + 1;
    const iso = ziIso(an, luna, zi);
    const dow = new Date(Date.UTC(an, luna - 1, zi)).getUTCDay();
    return {
      iso,
      zi,
      dowIso: dow === 0 ? 7 : dow,
      nelucratoare: !esteZiLucratoareIso(iso, setSarbatori, setLiber, setRecuperare),
    };
  });
}

/** `aprobata` ⇒ decisă; `trimisa` și `in_aprobare` ⇒ încă nu. */
export function stareDinStatus(status: StatusCerere): StareAbsenta {
  return status === "aprobata" ? "aprobata" : "in_aprobare";
}

/** Cheia unei celule în harta plată (angajat × zi), serializabilă. */
export function cheieCelula(employeeId: string, iso: ZiCalendaristica): string {
  return `${employeeId}|${iso}`;
}

/**
 * Ce se randează când o zi poartă DOUĂ absențe.
 *
 * Nu e ipotetic: un concediu medical cu `intrerupe_alte_concedii` acoperă un
 * concediu de odihnă deja aprobat, iar până când
 * `internal.leave_requests_sincronizeaza` marchează zilele vechi ca
 * `intrerupta`, ambele cereri au linii vii pe aceeași zi. Constrângerea EXCLUDE
 * păzește suprapunerile dintre cereri ACTIVE ale aceluiași om, nu și cazul ăsta.
 *
 * Câștigă cea decisă: pe ecran trebuie să apară ce s-a hotărât, nu ce s-a
 * cerut. La egalitate rămâne prima — ordinea vine din bază și e stabilă.
 */
export function alegeAbsenta(absente: readonly AbsentaCelula[]): AbsentaCelula | null {
  if (absente.length === 0) return null;
  return absente.find((a) => a.stare === "aprobata") ?? absente[0] ?? null;
}

export interface IntrareLegenda {
  readonly tipDenumire: string;
  readonly tipCuloare: string;
}

/**
 * Legenda se construiește din ce e PE ECRAN, nu din nomenclator.
 *
 * O firmă are zece tipuri configurate (`internal.seed_leave_defaults`) și,
 * într-o lună obișnuită, apar două. O legendă cu zece rânduri din care opt nu
 * se văd nicăieri e zgomot — aceeași regulă ca `tipuriDinLuna` din grila lunară.
 */
export function legendaPlanificatorului(
  celule: Readonly<Record<string, readonly AbsentaCelula[]>>,
): readonly IntrareLegenda[] {
  const harta = new Map<string, string>();
  for (const absente of Object.values(celule)) {
    for (const absenta of absente) {
      if (!harta.has(absenta.tipDenumire)) harta.set(absenta.tipDenumire, absenta.tipCuloare);
    }
  }
  return [...harta.entries()]
    .map(([tipDenumire, tipCuloare]) => ({ tipDenumire, tipCuloare }))
    .sort((a, b) => a.tipDenumire.localeCompare(b.tipDenumire, "ro"));
}

/**
 * Textul care apare la hover ȘI în numele accesibil al celulei.
 *
 * Se scriu amândouă din aceeași funcție dintr-un motiv învățat pe grila lunară:
 * `title` nu apare la atingere și nu se citește la tastatură, deci pe telefon
 * tipul și starea erau pur și simplu inaccesibile. Textul intră și în `title`,
 * și într-un `<span class="sr-only">`.
 */
export function descriereCelula(
  numeAngajat: string,
  ziIsoValoare: ZiCalendaristica,
  absenta: AbsentaCelula,
  alteAbsente: number,
): string {
  const [an, luna, zi] = ziIsoValoare.split("-");
  const data = `${zi ?? ""}.${luna ?? ""}.${an ?? ""}`;
  const stare = absenta.stare === "aprobata" ? "aprobată" : "în aprobare";
  const coada = alteAbsente > 0 ? ` (+${String(alteAbsente)} încă o cerere pe aceeași zi)` : "";
  return `${numeAngajat} · ${data} · ${absenta.tipDenumire} · ${stare}${coada}`;
}
