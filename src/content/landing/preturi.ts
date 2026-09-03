import type { FeatureKey } from "@/config/features";

/**
 * Tabelul canonic de prețuri. O singură sursă, pentru pagina de start, pagina de
 * prețuri și datele structurate.
 *
 * ── DE CE NU STAU ÎN `ro.ts` ȘI `en.ts` ───────────────────────────────────
 * O sumă în lei e aceeași în ambele limbi. Scrisă în două fișiere, ar fi două
 * lucruri care trebuie schimbate împreună la fiecare actualizare de ofertă — și
 * exact tiparul ăsta a produs deja pe pagina asta trei cifre diferite pentru
 * numărul de module. Aici stau NUMERELE; numele și descrierile planurilor, care
 * chiar se traduc, rămân în fișierele de limbă.
 *
 * ── TVA ───────────────────────────────────────────────────────────────────
 * WISELEARNING SRL nu e înregistrată în scopuri de TVA, deci sumele de mai jos
 * sunt FINALE. Nu e o omisiune, e un avantaj de comunicat: concurența afișează
 * prețuri fără TVA, la care cumpărătorul mai adaugă 21%. Mențiunea e obligatorie
 * lângă cifră — vezi `preturi.nota` din fișierele de limbă.
 */

/** Moneda, o singură dată. Sumele sunt întregi: nu există bani în ofertă. */
export const MONEDA = "lei";

/** Pragul de angajați până la care se aplică prețul de bază. */
export const PRAG_ANGAJATI = 20;

/**
 * Prețul lunar al fiecărui modul opțional, în lei.
 *
 * Cele patru chei ABSENTE — `nucleu`, `attendance`, `leave`, `employee_portal` —
 * lipsesc fiindcă intră în nucleu și nu se cumpără separat. Absența e verificată
 * de test: fiecare cheie din catalog trebuie ori să aibă preț aici, ori să fie
 * în `MODULE_NUCLEU`.
 */
export const PRETURI_MODULE: Readonly<Partial<Record<FeatureKey, number>>> = {
  reges: 39,
  onboarding: 30,
  courses: 39,
  ssm: 29,
  evaluations: 25,
  fleet: 35,
  maintenance: 25,
  inventory: 25,
  announcements: 15,
  ticketing: 25,
  payroll: 69,
  per_diem: 25,
  asistent: 39,
};

/** Ce intră în nucleu și vine cu orice pachet. */
export const MODULE_NUCLEU: readonly FeatureKey[] = [
  "nucleu",
  "attendance",
  "leave",
  "employee_portal",
];

/** Prețul nucleului, până la `PRAG_ANGAJATI` angajați. */
export const PRET_NUCLEU = 149;

/**
 * Pachetele.
 *
 * NU sunt o scară: `hr_extins`, `operational` și `financiar` sunt trei axe
 * paralele peste același nucleu, nu trepte care se conțin una pe alta. Modelul
 * de dinainte presupunea o scară (Start ⊂ Profesional ⊂ Business ⊂ Enterprise),
 * iar testul verifica incluziunea crescătoare — o invariantă care nu mai descrie
 * oferta reală. Singurul care conține tot e `tot`.
 *
 * `pret` e suma ÎNCASATĂ. Reducerea afișată nu se scrie de mână: se calculează
 * din modulele listate, cu `sumaSeparat()`. Un „în loc de” scris de mână e o
 * cifră care nu se verifică nicăieri și care rămâne în urmă la prima schimbare
 * de tarif.
 */
export type CheiePachet = "nucleu" | "hr_extins" | "operational" | "financiar" | "tot";

export type Pachet = Readonly<{
  cheie: CheiePachet;
  /** Modulele PESTE nucleu. Nucleul se adaugă la citire, nu se repetă aici. */
  optionale: readonly FeatureKey[];
  pret: number;
  recomandat?: boolean;
}>;

export const PACHETE: readonly Pachet[] = [
  { cheie: "nucleu", optionale: [], pret: PRET_NUCLEU },
  {
    cheie: "hr_extins",
    optionale: ["reges", "onboarding", "courses", "ssm", "evaluations"],
    pret: 249,
    recomandat: true,
  },
  {
    cheie: "operational",
    optionale: ["fleet", "maintenance", "inventory", "announcements", "ticketing"],
    pret: 229,
  },
  { cheie: "financiar", optionale: ["payroll", "per_diem"], pret: 219 },
  {
    cheie: "tot",
    optionale: [
      "reges",
      "onboarding",
      "courses",
      "ssm",
      "evaluations",
      "fleet",
      "maintenance",
      "inventory",
      "announcements",
      "ticketing",
      "payroll",
      "per_diem",
      "asistent",
    ],
    pret: 499,
  },
];

/** Toate modulele unui pachet: nucleul plus opționalele lui. */
export function moduleleDin(pachet: Pachet): readonly FeatureKey[] {
  return [...MODULE_NUCLEU, ...pachet.optionale];
}

/** Cât ar costa modulele pachetului cumpărate separat, cu nucleul inclus. */
export function sumaSeparat(pachet: Pachet): number {
  return pachet.optionale.reduce(
    (total, cheie) => total + (PRETURI_MODULE[cheie] ?? 0),
    PRET_NUCLEU,
  );
}

/** Suma formatată pentru afișare: „149 lei / lună”. */
export function lunar(suma: number, limba: "ro" | "en"): string {
  return limba === "ro" ? `${suma} ${MONEDA} / lună` : `${suma} RON / month`;
}
