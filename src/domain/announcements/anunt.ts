// src/domain/announcements/anunt.ts
// Logica pură a avizierului: în ce stare e un anunț, ce se vede din el în listă
// și ce lasă să treacă filtrul din adresă. Fără I/O și fără ceas — `acum` vine
// ca argument, ca peste tot în `src/domain`.

/**
 * Cele patru stări ale unui anunț.
 *
 * ── DE CE PATRU, CÂND ECRANUL ARĂTA DOUĂ ──────────────────────────────────
 * Lista calcula în JSX `publicat_la === null` (ciornă) și
 * `new Date(expira_la) < acum` (expirat). Lipsea `programat`: `publicat_la` are
 * voie să fie în VIITOR — nimic în bază nu-l oprește — iar `announcements_select`
 * (`0028_announcements.sql:79`) cere explicit `publicat_la <= now()` ca să-l
 * arate unui angajat. Un anunț cu data de publicare mâine era desenat
 * „Publicat" administratorului, în timp ce firma nu-l vedea deloc.
 *
 * ── DE CE EXPIRAREA E `<=`, NU `<` ────────────────────────────────────────
 * Politica scrie `expira_la > now()` pentru „încă vizibil". Negat, asta e
 * `expira_la <= now()`. Ecranul folosea `<`, deci în secunda exactă a expirării
 * lista spunea „valabil" despre un rând pe care baza tocmai îl ascunsese. O
 * secundă pe an, dar exact felul de nepotrivire care se descoperă în producție,
 * pe un anunț care „a dispărut fără motiv".
 */
export type StareAnunt = "ciorna" | "programat" | "activ" | "expirat";

/** Doar cele două coloane din care se deduce starea. */
export type AnuntDeStare = Readonly<{
  publicat_la: string | null;
  expira_la: string | null;
}>;

export function stareAnunt(anunt: AnuntDeStare, acum: Date): StareAnunt {
  if (anunt.publicat_la === null) return "ciorna";

  const momentul = acum.getTime();
  if (new Date(anunt.publicat_la).getTime() > momentul) return "programat";
  if (anunt.expira_la !== null && new Date(anunt.expira_la).getTime() <= momentul) {
    return "expirat";
  }
  return "activ";
}

/** Adevărat pentru stările pe care angajatul obișnuit NU le vede (RLS le ascunde). */
export function esteAscunsAngajatilor(stare: StareAnunt): boolean {
  return stare !== "activ";
}

/**
 * Cât din conținut intră în card.
 *
 * 180 de caractere ≈ două rânduri pe coloana de citire a produsului. Mai mult
 * n-ar fi o previzualizare, ci anunțul de două ori.
 */
export const LUNGIME_EXTRAS = 180;

/**
 * Primele rânduri ale anunțului, pentru card.
 *
 * ── DE CE SE TAIE PE CUVÂNT, NU PE CARACTER ───────────────────────────────
 * O tăietură oarbă produce „…programul de lucru se modif…", care se citește ca
 * o greșeală de bază de date, nu ca o previzualizare. Tăietura urcă la ultimul
 * spațiu, dar doar dacă acesta n-a mâncat mai mult de 40 % din text — altfel un
 * singur cuvânt foarte lung ar reduce extrasul la nimic.
 *
 * Spațiile albe se turtesc: în conținut există rânduri goale între paragrafe,
 * iar `line-clamp` peste `whitespace-pre-wrap` ar număra rândul gol drept unul
 * dintre cele două rânduri afișate — deci jumătate din previzualizare ar fi
 * vidă, pe un card din două.
 */
export function extrasAnunt(continut: string, lungime: number = LUNGIME_EXTRAS): string {
  const unRand = continut.replace(/\s+/gu, " ").trim();
  if (unRand.length <= lungime) return unRand;

  const taiat = unRand.slice(0, lungime);
  const spatiu = taiat.lastIndexOf(" ");
  const pastrat = spatiu > lungime * 0.6 ? taiat.slice(0, spatiu) : taiat;
  return `${pastrat.trimEnd()}…`;
}

/**
 * Ziua aleasă în casetă → momentul exact al expirării, ca ISO cu decalaj.
 *
 * ── DE CE NU `new Date(\`${zi}T23:59:59\`)` ────────────────────────────────
 * Constructorul fără sufix de fus citește fusul MAȘINII care rulează codul —
 * în cazul de față, browserul. Pentru cineva cu ceasul pe UTC (un laptop
 * proaspăt instalat, o mașină virtuală, un container), anunțul pentru care s-a
 * ales 30 septembrie expira la 30 septembrie 23:59:59Z, adică 1 octombrie
 * 02:59:59 ora României — o zi mai târziu decât scria pe ecran. Invers, la
 * +05, expira cu câteva ore mai devreme. Nimic nu semnala diferența.
 *
 * ── DE CE DECALAJUL SE CALCULEAZĂ DIN ZIUA ALEASĂ ─────────────────────────
 * România e la +03 din ultima duminică din martie până în ultima din
 * octombrie, și la +02 în rest. Un anunț scris în ianuarie care expiră în
 * iulie cade de cealaltă parte a schimbării: decalajul „de acum" i-ar muta
 * expirarea cu o oră. `Intl` știe calendarul de ore de vară; noi nu-l scriem.
 *
 * Rezultatul se întoarce ca ȘIR, nu ca `Date`: pleacă direct într-o coloană
 * `timestamptz`, iar Postgres citește sufixul de decalaj exact ca `Date`.
 */
export function sfarsitulZileiRomania(zi: string): string {
  return `${zi}T23:59:59${decalajRomania(zi)}`;
}

const FORMATTER_DECALAJ = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Bucharest",
  timeZoneName: "longOffset",
});

/** `+03:00` sau `+02:00`, pentru prânzul zilei date. */
function decalajRomania(zi: string): string {
  // Prânzul, nu miezul nopții: la ora 00:00 UTC din ziua schimbării, decalajul
  // e încă cel vechi, iar la 12:00 e deja cel care ține tot restul zilei.
  const reper = new Date(`${zi}T12:00:00Z`);
  if (Number.isNaN(reper.getTime())) throw new TypeError(`Zi invalidă: ${zi}`);

  const nume = FORMATTER_DECALAJ.formatToParts(reper).find((p) => p.type === "timeZoneName");
  // `GMT+3`, `GMT+03:00` sau `GMT` — forma scurtă apare pentru decalaj zero și
  // pe implementări mai vechi; toate trei se normalizează la `+HH:MM`.
  const brut = (nume?.value ?? "GMT").replace("GMT", "");
  if (brut === "") return "+00:00";
  const [semn, ore, minute] = [brut[0] ?? "+", ...brut.slice(1).split(":")];
  return `${semn}${(ore ?? "0").padStart(2, "0")}:${(minute ?? "00").padStart(2, "0")}`;
}

/**
 * Segmentele comutatorului din capul listei.
 *
 * `ciorne` cuprinde ȘI `programat`: din locul administratorului, amândouă
 * răspund la aceeași întrebare — „ce am scris și firma încă nu vede". Pastila
 * de pe card le desparte oricum; segmentul nu are de ce.
 */
export type FiltruStareAnunt = "toate" | "active" | "ciorne" | "expirate";

export const FILTRE_STARE: readonly FiltruStareAnunt[] = [
  "toate",
  "active",
  "ciorne",
  "expirate",
] as const;

export const FILTRU_IMPLICIT: FiltruStareAnunt = "toate";

/** Citește segmentul din adresă. Orice altceva cade pe implicit — inclusiv `undefined`. */
export function filtruDinAdresa(valoare: string | readonly string[] | undefined): FiltruStareAnunt {
  const text = typeof valoare === "string" ? valoare : undefined;
  return FILTRE_STARE.find((f) => f === text) ?? FILTRU_IMPLICIT;
}

export function potrivesteFiltru(stare: StareAnunt, filtru: FiltruStareAnunt): boolean {
  switch (filtru) {
    case "toate":
      return true;
    case "active":
      return stare === "activ";
    case "ciorne":
      return stare === "ciorna" || stare === "programat";
    case "expirate":
      return stare === "expirat";
  }
}

/** Câte anunțuri sunt în fiecare segment — cifra de pe eticheta comutatorului. */
export function numaraPeStari(
  stari: readonly StareAnunt[],
): Readonly<Record<FiltruStareAnunt, number>> {
  return {
    toate: stari.length,
    active: stari.filter((s) => potrivesteFiltru(s, "active")).length,
    ciorne: stari.filter((s) => potrivesteFiltru(s, "ciorne")).length,
    expirate: stari.filter((s) => potrivesteFiltru(s, "expirate")).length,
  };
}
