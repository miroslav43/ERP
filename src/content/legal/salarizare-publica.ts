import type { PayrollSettingsSnapshot, PragDeducerePersonala } from "@/domain/payroll/calc";

/**
 * Valorile legale pentru calculatorul PUBLIC de salariu (`/unelte/calculator-salariu`).
 *
 * ── VERIFICATE PE 3 OCT 2026, PE TEXTELE OFICIALE ─────────────────────────
 * Citite cu `curl` în Portalul Legislativ (forme consolidate):
 *  - salariul minim 4.325 lei din 1 iulie 2026 — HG 146/2026, MO nr. 196 din
 *    13 martie 2026; art. 2 abrogă HG 1506/2024 la aceeași dată;
 *  - (reverificat pe 9 oct 2026) salariul minim 4.050 lei din 1 ianuarie 2025 până la 30 iunie
 *    2026, 165,334 ore, 24,496 lei/oră — HG 1506/2024 art. 1, MO 1185 din
 *    28 noiembrie 2024;
 *  - (reverificat pe 9 oct 2026) suma scutită în ianuarie–iunie 2026: 300 lei, plafon 4.300 lei
 *    — OUG 89/2025 art. III alin. (1), forma consolidată din 16.08.2026;
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
 * Facilitățile pe sectoare (abrogate din 2025, OUG 156/2024), scutirea pentru
 * cercetare-dezvoltare, sporurile și concediile. Pagina le spune pe față.
 * Deducerea suplimentară (art. 77 alin. (10)) e acoperită din 9 oct 2026.
 *
 * Valabil pentru 2026, pe cele două perioade din `PERIOADE_2026`: la 1 ianuarie
 * 2027 facilitatea expiră (art. III alin. (6)) și valorile se reverifică.
 * `valoriExpirate()` face pagina să spună asta din prima zi a lui 2027.
 */

export const SALARIU_MINIM_BRUT_2026_IULIE = 4325;

/** HG 1506/2024 art. 1: în vigoare de la 1 ianuarie 2025 până la 30 iunie 2026 (abrogată de HG 146/2026 art. 2). */
export const SALARIU_MINIM_BRUT_2026_IANUARIE = 4050;

export const VERIFICARE = {
  la: "2026-10-09",
  surse: [
    {
      eticheta: "HG 146/2026 — salariul minim",
      href: "https://legislatie.just.ro/Public/DetaliiDocumentAfis/308231",
    },
    {
      eticheta: "HG 1506/2024 — salariul minim până la 30 iunie 2026",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/291450",
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

/** Art. 77 alin. (3): deducerea de bază se acordă până la minim + 2.000 de lei inclusiv. */
export const PLAFON_DEDUCERE_PESTE_MINIM = PAS_LEI * PASI;

/**
 * Deducerea de bază din art. 77 alin. (4), calculată direct pentru un venit.
 * Dă aceeași valoare ca pragul din `grilaDeducerePersonala` care acoperă venitul
 * (testat pe fiecare leu, în ambele perioade). `venitBrut` e venitul brut lunar
 * din salarii; calculatorul include în el tichetele (⚠ NOTES.md §3).
 */
export function valoareDeducereDeBaza(minim: number, persoane: number, venitBrut: number): number {
  if (venitBrut > minim + PLAFON_DEDUCERE_PESTE_MINIM) return 0;
  const pas = venitBrut <= minim ? 0 : Math.ceil((venitBrut - minim) / PAS_LEI);
  const baza = PROCENTE_BAZA[Math.min(4, Math.max(0, Math.round(persoane)))] ?? 0;
  return Math.round((Math.round(minim * 100) * (baza - 5 * pas)) / 100_000);
}

/**
 * Art. 77 alin. (10) lit. a): 15% din salariul minim, pentru cei de până la 26 de
 * ani cu venituri din salarii de cel mult minim + 2.000 de lei. Rotunjită ca grila,
 * cu 50 de bani în sus (⚠ art. 66: 607,50 → 607 sau 608; NOTES.md §3).
 */
export function valoareDeducereSub26(minim: number): number {
  return Math.round((Math.round(minim * 100) * 150) / 100_000);
}

/**
 * Art. 77 alin. (10) lit. b): 100 de lei pe lună pentru fiecare copil sub 18 ani
 * înscris la școală, „indiferent de nivelul” veniturilor părintelui.
 */
export const DEDUCERE_COPIL_SCOALA = 100;

function setariPentruMinim(minim: number, valabilDeLa: string): PayrollSettingsSnapshot {
  return {
    valabilDeLa,
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
    deducerePersonala: grilaDeducerePersonala(minim),
    rotunjireLei: true,
    salariuMinimBrut: minim,
  };
}

export const SETARI_SALARIZARE_PUBLICE: PayrollSettingsSnapshot = setariPentruMinim(
  SALARIU_MINIM_BRUT_2026_IULIE,
  "2026-07-01",
);

/** Cele două perioade ale lui 2026. Cheia e și valoarea din adresă (`?perioada=`). */
export type Perioada = "2026-1" | "2026-2";

export type ValoriPerioada = Readonly<{
  eticheta: string;
  valabilDeLa: string;
  valabilPana: string;
  salariuMinim: number;
  /** Text, nu număr: se afișează, nu se calculează cu el. */
  oreLunaMedie: string;
  leiPeOra: string;
  actSalariuMinim: string;
  /** OUG 89/2025 art. III alin. (1): suma scutită și plafonul de venit brut (fără tichete). */
  facilitate: Readonly<{ suma: number; plafonVenitBrut: number }>;
  setari: PayrollSettingsSnapshot;
}>;

export const PERIOADE_2026: Readonly<Record<Perioada, ValoriPerioada>> = {
  "2026-1": {
    eticheta: "ianuarie–iunie 2026",
    valabilDeLa: "2026-01-01",
    valabilPana: "2026-06-30",
    salariuMinim: SALARIU_MINIM_BRUT_2026_IANUARIE,
    oreLunaMedie: "165,334",
    leiPeOra: "24,496",
    actSalariuMinim: "HG 1506/2024",
    // OUG 89/2025 art. III alin. (1): 300 de lei pe lună pentru 1 ianuarie–30 iunie
    // 2026; lit. b): venit brut, fără tichete, de cel mult 4.300 de lei.
    facilitate: { suma: 300, plafonVenitBrut: 4300 },
    setari: setariPentruMinim(SALARIU_MINIM_BRUT_2026_IANUARIE, "2026-01-01"),
  },
  "2026-2": {
    eticheta: "iulie–decembrie 2026",
    valabilDeLa: FACILITATE_SALARIU_MINIM.valabilDeLa,
    valabilPana: FACILITATE_SALARIU_MINIM.valabilPana,
    salariuMinim: SALARIU_MINIM_BRUT_2026_IULIE,
    oreLunaMedie: "166,667",
    leiPeOra: "25,949",
    actSalariuMinim: "HG 146/2026",
    facilitate: {
      suma: FACILITATE_SALARIU_MINIM.suma,
      plafonVenitBrut: FACILITATE_SALARIU_MINIM.plafonVenitBrut,
    },
    setari: SETARI_SALARIZARE_PUBLICE,
  },
};

export const PERIOADE: readonly Perioada[] = ["2026-1", "2026-2"];

export function estePerioada(v: string | null): v is Perioada {
  return v === "2026-1" || v === "2026-2";
}

/**
 * Perioada în care cade o zi `AAAA-LL-ZZ` (ziua din România, `todayInBucharest()`).
 * După 31 decembrie 2026 rămâne a doua jumătate a lui 2026; `valoriExpirate` o
 * spune pe față, în loc să prezinte valorile vechi drept actuale.
 */
export function perioadaPentruZi(zi: string): Perioada {
  return zi < PERIOADE_2026["2026-2"].valabilDeLa ? "2026-1" : "2026-2";
}

export function valoriExpirate(zi: string): boolean {
  return zi > PERIOADE_2026["2026-2"].valabilPana;
}
