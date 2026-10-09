// src/app/(marketing)/unelte/adeverinta-salariat/model.ts
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { LINIE_GOALA, type DocumentTabelar } from "@/lib/unelte/document-tabelar";

/**
 * Adeverința de salariat.
 *
 * Art. 34 alin. (5) din Codul muncii (consolidat la 27.04.2026): la cererea
 * salariatului sau a unui fost salariat, angajatorul e obligat să elibereze
 * un document care atestă activitatea, durata ei, salariul și vechimea. Codul
 * nu dă un model; ăsta e forma uzuală.
 *
 * ── CNP-UL NU SE CERE ─────────────────────────────────────────────────────
 * Tot ce scrie omul în formular stă în adresa paginii (GET). Numele și salariul
 * sunt tăiate din ce pleacă la statistici (lista albă din A2), dar un CNP n-are
 * ce căuta nici în istoricul browserului. Rămâne o linie de completat de mână.
 */

export type Durata = "nedeterminata" | "determinata";

export type ParametriAdeverinta = Readonly<{
  firma: string;
  cui: string;
  nr: string;
  nume: string;
  functie: string;
  /** ISO, sau "" când rămâne de completat de mână. */
  angajare: string;
  durata: Durata;
  ore: number;
  salariu: number | null;
  scop: string;
  emitere: string;
}>;

const text = (v: string | null, maxim = 120): string =>
  (v ?? "")
    .replace(/[\r\n\t]+/gu, " ")
    .trim()
    .slice(0, maxim);

/**
 * Suma, cum o scrie un român: „4.325”, „4 325”, „4.325,50”, „5.000 lei”.
 * Punctul urmat de exact trei cifre e separator de mii, nu virgulă zecimală.
 */
export function citesteSuma(brut: string): number | null {
  const s = brut.replace(/\s+/gu, "").replace(/lei$/iu, "");
  let normal: string;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/u.test(s))
    normal = s.replace(/\./gu, "").replace(",", ".");
  else if (/^\d+(?:,\d{1,2})?$/u.test(s)) normal = s.replace(",", ".");
  else if (/^\d+(?:\.\d{1,2})?$/u.test(s)) normal = s;
  else return null;
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : null;
}

/** O zi reală între 1950 și azi, sau `null`. */
function dataTrecuta(brut: string, azi: string): string | null {
  const potrivire = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(brut);
  if (potrivire === null) return null;
  const [, a, l, z] = potrivire;
  const data = new Date(Date.UTC(Number(a), Number(l) - 1, Number(z)));
  if (
    data.getUTCFullYear() !== Number(a) ||
    data.getUTCMonth() !== Number(l) - 1 ||
    data.getUTCDate() !== Number(z)
  ) {
    return null;
  }
  return brut >= "1950-01-01" && brut <= azi ? brut : null;
}

const lei = (n: number): string =>
  `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(n)} lei`;

export function citesteAdeverinta(
  q: URLSearchParams,
  azi: string,
): Readonly<{ parametri: ParametriAdeverinta; avertismente: readonly string[] }> {
  const avertismente: string[] = [];

  let angajare = "";
  const brutAngajare = (q.get("angajare") ?? "").trim();
  if (brutAngajare !== "") {
    const valida = dataTrecuta(brutAngajare, azi);
    if (valida === null) {
      avertismente.push(
        `Data angajării: „${brutAngajare.slice(0, 20)}” nu e o zi reală între 1950 și azi; am lăsat-o de completat de mână.`,
      );
    } else {
      angajare = valida;
    }
  }

  let salariu: number | null = null;
  const brutSalariu = (q.get("salariu") ?? "").trim();
  if (brutSalariu !== "") {
    salariu = citesteSuma(brutSalariu);
    if (salariu === null) {
      avertismente.push(
        `Salariul „${brutSalariu.slice(0, 20)}” nu e o sumă; l-am lăsat afară din adeverință.`,
      );
    }
  }

  const oreBrut = Number(q.get("ore") ?? "8");
  const ore = Number.isInteger(oreBrut) && oreBrut >= 1 && oreBrut <= 8 ? oreBrut : 8;

  return {
    parametri: {
      firma: text(q.get("firma")),
      cui: text(q.get("cui"), 20),
      nr: text(q.get("nr"), 30),
      nume: text(q.get("nume")),
      functie: text(q.get("functie")),
      angajare,
      durata: q.get("durata") === "determinata" ? "determinata" : "nedeterminata",
      ore,
      salariu,
      scop: text(q.get("scop")),
      emitere: azi,
    },
    avertismente,
  };
}

const sauLinie = (v: string): string => (v === "" ? LINIE_GOALA : v);

export function construiesteAdeverinta(p: ParametriAdeverinta): DocumentTabelar {
  const norma =
    p.ore === 8
      ? "normă întreagă (8 ore pe zi)"
      : `normă parțială (${String(p.ore)} ${p.ore === 1 ? "oră" : "ore"} pe zi)`;
  const durata = p.durata === "determinata" ? "determinată" : "nedeterminată";
  const angajator = p.cui === "" ? sauLinie(p.firma) : `${sauLinie(p.firma)}, CUI ${p.cui}`;

  return {
    titlu: "Adeverință",
    subtitlu: p.firma === "" ? null : p.cui === "" ? p.firma : `${p.firma}, CUI ${p.cui}`,
    campuri: [
      { eticheta: "Nr.", valoare: p.nr },
      { eticheta: "Data", valoare: formatDate(p.emitere) },
    ],
    paragrafe: [
      `Prin prezenta se adeverește că ${sauLinie(p.nume)}, CNP ${LINIE_GOALA}, este angajat(ă) la ${angajator}, în funcția de ${sauLinie(p.functie)}, cu contract individual de muncă pe durată ${durata}, cu ${norma}, din data de ${p.angajare === "" ? LINIE_GOALA : formatDate(p.angajare)}.`,
      ...(p.salariu === null ? [] : [`Salariul de bază brut lunar este de ${lei(p.salariu)}.`]),
      `Prezenta adeverință se eliberează la cererea salariatului${p.scop === "" ? "" : `, pentru a-i servi la ${p.scop}`}, potrivit art. 34 alin. (5) din Codul muncii.`,
    ],
    coloane: [],
    randuri: [],
    umbrite: [],
    note: [],
    semnaturi: ["Reprezentant legal", "Întocmit"],
    orientare: "portret",
    numeFisier: `adeverinta-salariat-${p.nume === "" ? "necompletata" : p.nume}`,
  };
}

export function adeverintaDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteAdeverinta(citesteAdeverinta(q, todayInBucharest()).parametri);
}
