import type { PayrollSettingsSnapshot, PragDeducerePersonala } from "@/domain/payroll/calc";

/**
 * Valorile legale pentru calculatorul PUBLIC de salariu (`/unelte/calculator-salariu`).
 *
 * ── POARTA ────────────────────────────────────────────────────────────────
 * `verificatDeContabil: false` ține pagina nepublicată. Un calculator public care
 * greșește cu 10 lei își strică reputația exact în fața publicului care contează,
 * iar `NOTES.md` cere confirmarea contabilului pentru orice valoare legală
 * înainte de calcul real. Ridicarea flagului e o decizie a omului, nu a codului.
 *
 * ── CE E VERIFICAT ȘI CE NU (2 oct 2026) ─────────────────────────────────
 * Verificat pe sursă, cu `curl`:
 *  - salariul minim 4.325 lei din 1 iulie 2026 — HG 146/2026, MO nr. 196 din
 *    13 martie 2026;
 *  - grila deducerii personale de bază — Codul fiscal art. 77 alin. (3)–(4),
 *    forma consolidată (doc. 171282): 20/25/30/35/45% din minim, minus 0,5
 *    puncte la fiecare 50 de lei peste minim, până la minim + 2.000 de lei.
 * Valori statutare luate din implicitele produsului (`bun-venit/actions.ts`),
 * NErecitite azi: CAS 25%, CASS 10%, impozit 10%, CAM 2,25%.
 *
 * DE CONFIRMAT de contabil, explicit:
 *  1. Suma de 300 lei neimpozabilă la salariul minim: textul consolidat o dă
 *     pentru „lunile ianuarie–decembrie 2025”. Dacă a fost prelungită pentru
 *     2026, calculatorul (și motorul produsului, care n-o modelează deloc)
 *     greșește netul la salariul minim.
 *  2. Rotunjirea deducerii personale (aici: la ban, nu la leu).
 *  3. Deducerea personală suplimentară (art. 77 alin. (10): sub 26 de ani,
 *     copii înscriși la școală) — lipsește din această versiune.
 */

export const SALARIU_MINIM_BRUT_2026_IULIE = 4325;

export const SURSA =
  "Salariul minim: HG 146/2026. Grila deducerii: Codul fiscal art. 77 alin. (4), forma consolidată citită pe 2 oct 2026. Cotele: implicitele produsului. Neconfirmate încă de contabil.";

/** Procentele de bază, în zecimi de procent, pentru 0, 1, 2, 3 și 4+ persoane în întreținere. */
const PROCENTE_BAZA = [200, 250, 300, 350, 450] as const;
const PAS_LEI = 50;
const PASI = 40; // minim + 2.000 de lei = 40 de pași de 50

/**
 * Grila art. 77 alin. (4), generată: la pasul k (k = 0 pentru venitul de până
 * la minim inclusiv, apoi câte 50 de lei), procentul scade cu 0,5 puncte.
 * Valoarea se calculează în bani întregi, ca 19,5% din 4.325 să dea 843,38 și
 * nu 843,37 din virgulă mobilă.
 */
export function grilaDeducerePersonala(minim: number): readonly PragDeducerePersonala[] {
  const praguri: PragDeducerePersonala[] = [];
  PROCENTE_BAZA.forEach((baza, persoane) => {
    for (let k = 0; k <= PASI; k += 1) {
      const zecimiProcent = baza - 5 * k;
      praguri.push({
        nrPersoaneIntretinereMin: persoane,
        nrPersoaneIntretinereMax: persoane === 4 ? null : persoane,
        venitBrutMax: minim + PAS_LEI * k,
        valoare: Math.round((Math.round(minim * 100) * zecimiProcent) / 1000) / 100,
      });
    }
  });
  return praguri;
}

export const SETARI_SALARIZARE_PUBLICE: PayrollSettingsSnapshot & {
  readonly verificatDeContabil: boolean;
} = {
  valabilDeLa: "2026-07-01",
  cotaCas: 0.25,
  cotaCass: 0.1,
  cotaImpozit: 0.1,
  cotaCamAngajator: 0.0225,
  normaZilnicaOre: 8,
  procentSporNoapte: 0.25,
  procentSporWeekend: 0,
  procentOreSuplimentare: 0.75,
  valoareTichetMasa: 0,
  ticheteImpozabile: false,
  verificatDeContabil: false,
  deducerePersonala: grilaDeducerePersonala(SALARIU_MINIM_BRUT_2026_IULIE),
  rotunjireLei: false,
  salariuMinimBrut: SALARIU_MINIM_BRUT_2026_IULIE,
};
