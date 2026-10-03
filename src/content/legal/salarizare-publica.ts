import type { PayrollSettingsSnapshot, PragDeducerePersonala } from "@/domain/payroll/calc";

/**
 * Valorile legale pentru calculatorul PUBLIC de salariu (`/unelte/calculator-salariu`).
 *
 * ── VERIFICATE PE 3 OCT 2026, PE TEXTELE OFICIALE ─────────────────────────
 * Citite cu `curl` în Portalul Legislativ (forme consolidate):
 *  - salariul minim 4.325 lei din 1 iulie 2026 — HG 146/2026, MO nr. 196 din
 *    13 martie 2026;
 *  - CAS 25% (art. 138), CASS 10% (art. 156), impozit 10% (art. 64 și 78),
 *    CAM 2,25% (art. 220^3) — Codul fiscal, doc. 171282;
 *  - grila deducerii personale de bază — Codul fiscal art. 77 alin. (3)–(4);
 *  - suma neimpozabilă de la salariul minim: 200 lei pe lună pentru veniturile
 *    din 1 iulie – 31 decembrie 2026, cu venit brut de cel mult 4.600 lei —
 *    OUG 89/2025 art. III (doc. 305817, nemodificat în forma consolidată);
 *  - rotunjirea la leu a impozitelor și contribuțiilor (de la 50 de bani în sus)
 *    — OUG 59/2005 și Ordinul 978/2005.
 * Cifrele finale se potrivesc cu vectorii publicați de presă și de alte
 * calculatoare pentru a doua jumătate a lui 2026 (4.325 brut → 2.699 net;
 * 5.000 brut → 2.981 net) — vezi `src/lib/unelte/salariu.test.ts`.
 *
 * ── CE NU ACOPERĂ ─────────────────────────────────────────────────────────
 * Deducerea personală suplimentară (art. 77 alin. (10): sub 26 de ani, copii
 * înscriși la școală), facilitățile pe sectoare, tichetele, timpul parțial
 * (unde contribuțiile se datorează la minim). Pagina le spune pe față.
 *
 * Valabil pentru iulie–decembrie 2026: la 1 ianuarie 2027 facilitatea expiră
 * (art. III alin. (6)) și valorile se reverifică.
 */

export const SALARIU_MINIM_BRUT_2026_IULIE = 4325;

export const VERIFICARE = {
  la: "2026-10-03",
  surse: [
    {
      eticheta: "HG 146/2026 — salariul minim",
      href: "https://legislatie.just.ro/Public/DetaliiDocumentAfis/308231",
    },
    {
      eticheta: "Codul fiscal, forma consolidată",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/171282",
    },
    {
      eticheta: "OUG 89/2025, art. III — suma neimpozabilă",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/305817",
    },
    {
      eticheta: "OUG 59/2005 — rotunjirea la leu",
      href: "https://legislatie.just.ro/public/DetaliiDocument/62685",
    },
  ],
} as const;

/** OUG 89/2025 art. III alin. (1): suma, plafonul de venit brut și perioada. */
export const FACILITATE_SALARIU_MINIM = {
  suma: 200,
  plafonVenitBrut: 4600,
  valabilDeLa: "2026-07-01",
  valabilPana: "2026-12-31",
} as const;

/** Procentele de bază, în zecimi de procent, pentru 0, 1, 2, 3 și 4+ persoane în întreținere. */
const PROCENTE_BAZA = [200, 250, 300, 350, 450] as const;
const PAS_LEI = 50;
const PASI = 40; // minim + 2.000 de lei = 40 de pași de 50

/**
 * Grila art. 77 alin. (4), generată: la pasul k (k = 0 pentru venitul de până
 * la minim inclusiv, apoi câte 50 de lei), procentul scade cu 0,5 puncte.
 * Valoarea se rotunjește la leu (19,5% din 4.325 = 843,375 → 843), cum o dau
 * grilele publicate „865–1.946 lei” și calculatoarele care o folosesc.
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
        // În bani întregi, ca 0,5% din minim să nu ajungă .4999 în virgulă mobilă.
        valoare: Math.round((Math.round(minim * 100) * zecimiProcent) / 100_000),
      });
    }
  });
  return praguri;
}

export const SETARI_SALARIZARE_PUBLICE: PayrollSettingsSnapshot = {
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
  deducerePersonala: grilaDeducerePersonala(SALARIU_MINIM_BRUT_2026_IULIE),
  rotunjireLei: true,
  salariuMinimBrut: SALARIU_MINIM_BRUT_2026_IULIE,
};
