import { citesteData } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere";
import { calculeazaAcumulareProportionala, rotunjesteZileConcediu } from "@/domain/leave/sold";

/**
 * Câte zile de concediu de odihnă i se cuvin unui salariat într-un an.
 *
 * ── CE E LEGE ȘI CE E PRACTICĂ ─────────────────────────────────────────────
 * Lege (Codul muncii, forma consolidată de pe legislatie.just.ro, documentul
 * 128647, citită pe 8 oct 2026):
 *  · minimul: 20 de zile lucrătoare pe an — art. 145 alin. (1);
 *  · durata efectivă: cea din contractul individual — art. 145 alin. (2);
 *  · cel puțin 3 zile în plus pentru condiții grele, periculoase sau
 *    vătămătoare, nevăzători, alte persoane cu handicap, tineri sub 18 ani —
 *    art. 147 alin. (1)–(2);
 *  · concediul medical, de maternitate, paternal, de îngrijitor etc. se
 *    consideră activitate prestată — art. 145 alin. (4).
 * Practică, NU lege: proporția „drept ÷ 12 × lunile lucrate” pentru un an
 * lucrat parțial. Codul muncii nu are un articol pentru ea (ghidul
 * `/ghid/concediu-de-odihna` o spune la fel), iar rotunjirea o stabilesc
 * contractul colectiv sau regulamentul intern. Pagina o prezintă ca estimare.
 *
 * ── DE CE `calculeazaAcumulareProportionala` ──────────────────────────────
 * E funcția din modulul de concedii al aplicației (`src/domain/leave/sold.ts`):
 * luna angajării și luna plecării se socotesc întregi, la fel ca în soldul pe
 * care îl vede salariatul în aplicație.
 */

export const DREPT_MINIM = 20;
export const SUPLIMENT_MINIM = 3;
const DREPT_MAXIM = 60;
const SUPLIMENT_MAXIM = 30;

export type IntrareCalcul = Readonly<{
  an: number;
  /** Zilele din contractul individual de muncă. */
  dreptAnual: number;
  /** Zilele suplimentare (art. 147 sau contractul colectiv). */
  suplimentar: number;
  dataAngajarii: string | null;
  dataIncetarii: string | null;
}>;

export type RezultatCalcul = Readonly<{
  dreptTotal: number;
  luniLucrate: number;
  /** Cu două zecimale, nerotunjit. */
  proportional: number;
  inJos: number;
  inSus: number;
  anIntreg: boolean;
}>;

export type CitireCalcul = Readonly<{ intrare: IntrareCalcul; probleme: readonly string[] }>;

export function citesteCalculul(q: URLSearchParams, anCurent: number): CitireCalcul {
  const probleme: string[] = [];
  const intreg = (cheie: string, implicit: number, min: number, max: number, mesaj: string) => {
    const brut = (q.get(cheie) ?? "").trim();
    if (brut === "") return implicit;
    const n = Number(brut);
    if (!Number.isInteger(n) || n < min || n > max) {
      probleme.push(mesaj);
      return implicit;
    }
    return n;
  };
  const data = (cheie: string, eticheta: string) => {
    const citita = citesteData(q.get(cheie) ?? undefined, eticheta);
    if (citita.problema !== null) probleme.push(citita.problema);
    return citita.data;
  };

  const an = intreg("an", anCurent, 2024, 2035, "Anul trebuie să fie între 2024 și 2035.");
  const dreptAnual = intreg(
    "drept",
    DREPT_MINIM,
    DREPT_MINIM,
    DREPT_MAXIM,
    `Zilele din contract trebuie să fie între ${String(DREPT_MINIM)} și ${String(DREPT_MAXIM)}: minimul legal e de 20 de zile lucrătoare — art. 145 alin. (1) din Codul muncii.`,
  );
  const suplimentar = intreg(
    "suplimentar",
    0,
    0,
    SUPLIMENT_MAXIM,
    `Zilele suplimentare trebuie să fie între 0 și ${String(SUPLIMENT_MAXIM)}.`,
  );
  const dataAngajarii = data("angajare", "Data angajării");
  const dataIncetarii = data("incetare", "Data încetării contractului");

  if (dataAngajarii !== null && Number(dataAngajarii.slice(0, 4)) > an) {
    probleme.push(`Data angajării e după anul ${String(an)}: în acel an nu se cuvine nicio zi.`);
  }
  if (dataIncetarii !== null && Number(dataIncetarii.slice(0, 4)) < an) {
    probleme.push(
      `Contractul încetează înainte de anul ${String(an)}: în acel an nu se cuvine nicio zi.`,
    );
  }
  if (dataAngajarii !== null && dataIncetarii !== null && dataIncetarii < dataAngajarii) {
    probleme.push("Data încetării e înaintea datei angajării.");
  }

  return { intrare: { an, dreptAnual, suplimentar, dataAngajarii, dataIncetarii }, probleme };
}

export function calculeaza(i: IntrareCalcul): RezultatCalcul {
  const dreptTotal = i.dreptAnual + i.suplimentar;
  const inceputAn = `${String(i.an)}-01-01`;
  const sfarsitAn = `${String(i.an)}-12-31`;
  const inceput =
    i.dataAngajarii !== null && i.dataAngajarii > inceputAn ? i.dataAngajarii : inceputAn;
  const sfarsit =
    i.dataIncetarii !== null && i.dataIncetarii < sfarsitAn ? i.dataIncetarii : sfarsitAn;
  const luniLucrate = Math.max(0, Number(sfarsit.slice(5, 7)) - Number(inceput.slice(5, 7)) + 1);
  const proportional = calculeazaAcumulareProportionala(
    new Date(`${inceput}T00:00:00Z`),
    i.an,
    dreptTotal,
    "fara_rotunjire",
    new Date(`${sfarsit}T00:00:00Z`),
  );
  return {
    dreptTotal,
    luniLucrate,
    proportional,
    inJos: rotunjesteZileConcediu(proportional, "zi_in_jos"),
    inSus: rotunjesteZileConcediu(proportional, "zi_in_sus"),
    anIntreg: luniLucrate === 12,
  };
}
