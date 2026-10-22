// src/domain/fleet/contabil/format-winmentor.ts
//
// Notele contabile pentru WinMentor (F12g): fișierul text de import, în format
// INI, cu `[InfoPachet]`, câte un `[Nota_n]` și un `[Items_n]` per document.
//
// ── SURSA ───────────────────────────────────────────────────────────────────
// „Structură import fișier note contabile în WinMENTOR” (modificat 10.05.2022) și
// „Structură import fișier pentru partenerii noi [PARTNER.txt]” (modificat
// 01.09.2025), http://download.winmentor.ro/WinMentor/Documentatie/22_Structuri%20import%20din%20alte%20aplicatii/
// Verificat pe documentație, NEÎNCERCAT într-un import real (decizia B4).
//
// ── DE CE NOTĂ CONTABILĂ, NU FACTURĂ DE ACHIZIȚIE ───────────────────────────
// Facturile de intrare WinMentor cer codul de articol din nomenclatorul
// contabilului (L3), pe care nu-l avem.
//
// ── PRESUPUNERI ⚠ (de reglat la acceptanță, D7) ─────────────────────────────
// Separatorul zecimal (punct, după `Curs=4.95` din exemplu), codificarea (ASCII,
// L7), CRLF, numele fișierului de note (nedocumentat: îl alege contabilul la
// import), forma valorii `Partener` (documentația arată `RO 1216789`), cuvântul
// `Cumparari` (exemplul are doar `Vanzari`), bifa de partener `X` pe ambele
// conturi și ce TVA așteaptă jurnalul de cumpărări la deducerea limitată.
import { type LinieInclusa, type RezultatExport } from "./articole";
import { dataRo, randuri, sumaCuPunct } from "./csv";
import type { LinieCost } from "./linii";
import { faraPunctSiVirgula, inAscii } from "./text-ascii";

/** ⚠ Forma valorii `Partener=` (E1: exemplul are `RO 1216789`). */
export const FORMAT_PARTENER_WM = (cui: string): string => cui;

/** ⚠ `Jurnal=` pentru cumpărări: exemplul documentației arată doar `Vanzari`. */
export const JURNAL_CUMPARARI_WM = "Cumparari";

/** ⚠ Bifa de partener pe cont (P = cu partener, X = fără), aceeași pe debit și pe credit. */
const BIFA_CONT_WM = "X";

export const NUME_NOTE_WM = "NoteContabile.txt";
export const NUME_PARTENERI_WM = "Partner.txt";

/**
 * `NrDoc` pare numeric în WinMentor (E1, ⚠): bonul dacă are doar cifre (cel
 * mult 9), altfel un număr derivat din id. Derivat din id, nu din poziția notei
 * în fișier: o linie în plus sau în minus nu mută numerele celorlalte (L14).
 */
export function numarDocumentWinMentor(linie: LinieCost): string {
  const bon = linie.document?.trim() ?? "";
  if (/^\d{1,9}$/u.test(bon)) return bon;
  return String(Number.parseInt(linie.id.slice(0, 8), 16) % 1_000_000_000);
}

/** Text pentru un câmp INI: ASCII, fără `;` (separatorul liniei de articol). */
function camp(text: string, lungime?: number): string {
  return faraPunctSiVirgula(inAscii(text, lungime));
}

export interface OptiuniWinMentor {
  readonly an: number;
  readonly luna: number;
  /** Bifa „Identific partenerii după codul fiscal” din formular (constanta WinMentor, E2). */
  readonly partenerDupaCui: boolean;
}

export interface FisiereWinMentor {
  readonly note: string;
  /** `null` când nicio notă nu are partener. */
  readonly parteneri: string | null;
}

function nota(n: number, inclusa: LinieInclusa, cuPartener: boolean): string[] {
  const { linie, articole } = inclusa;
  const linii = [
    `[Nota_${String(n)}]`,
    `NrDoc=${numarDocumentWinMentor(linie)}`,
    `Data=${dataRo(linie.data)}`,
    "Moneda=Lei",
    `Observatii=${camp(articole[0]?.explicatie ?? "")}`,
    `Partener=${cuPartener && linie.cuiFurnizor !== null ? FORMAT_PARTENER_WM(linie.cuiFurnizor) : ""}`,
    `TotalLinii=${String(articole.length)}`,
  ];
  if (cuPartener) {
    linii.push(`Jurnal=${JURNAL_CUMPARARI_WM}`);
    const baza = articole.findIndex((a) => a.rol === "baza" || a.rol === "total");
    if (baza !== -1) linii.push(`Baza=${String(baza + 1)}`);
    const tva = articole.findIndex((a) => a.rol === "tva_deductibil");
    if (tva !== -1) linii.push(`TVA=${String(tva + 1)}`);
  }
  linii.push(`[Items_${String(n)}]`);
  articole.forEach((a, k) => {
    linii.push(
      `Item_${String(k + 1)}=${BIFA_CONT_WM};${a.contDebit};${BIFA_CONT_WM};${a.contCredit};${sumaCuPunct(a.sumaBani)};;${camp(a.explicatie, 60)}`,
    );
  });
  return linii;
}

export function noteWinMentor(
  rezultat: RezultatExport,
  optiuni: OptiuniWinMentor,
): FisiereWinMentor {
  const corp: string[] = [];
  const parteneri = new Map<string, string>();
  let n = 0;
  for (const inclusa of rezultat.incluse) {
    if (inclusa.articole.length === 0) continue;
    n += 1;
    const cuPartener = optiuni.partenerDupaCui && inclusa.linie.cuiFurnizor !== null;
    if (
      cuPartener &&
      inclusa.linie.cuiFurnizor !== null &&
      !parteneri.has(inclusa.linie.cuiFurnizor)
    ) {
      parteneri.set(inclusa.linie.cuiFurnizor, inclusa.linie.furnizor ?? "");
    }
    corp.push("", ...nota(n, inclusa, cuPartener));
  }

  // `TotalNote` și `TotalLinii` se numără din ce s-a scris, nu din intrare:
  // WinMentor validează corespondența.
  const note = randuri([
    "[InfoPachet]",
    `AnLucru=${String(optiuni.an)}`,
    `LunaLucru=${String(optiuni.luna)}`,
    "Tipdocument=NOTA CONTABILA",
    `TotalNote=${String(n)}`,
    ...corp,
  ]);

  if (parteneri.size === 0) return { note, parteneri: null };
  const sectiuni: string[] = ["[InfoPachet]"];
  for (const [cui, denumire] of [...parteneri].sort(([a], [b]) => (a < b ? -1 : 1))) {
    sectiuni.push(
      "",
      `[ParteneriNoi_${cui}]`,
      `Denumire=${camp(denumire) || cui}`,
      `CodFiscal=${cui}`,
      "Tara=Romania",
      "SimbolTara=RO",
      "PersoanaFizica=NU",
    );
  }
  return { note, parteneri: randuri(sectiuni) };
}
