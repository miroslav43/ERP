// src/domain/fleet/contabil/linii.ts
//
// Linia de cost a exportului contabil al flotei (F12g): forma comună în care
// ajung alimentările de pe foi (`fuel_entries`), cheltuielile (`vehicle_expenses`)
// și intervențiile de service (`vehicle_service_entries`), înainte să devină
// articole contabile.
//
// ── DE CE CARTOGRAFIERILE SUNT `satisfies Record<Enum, …>` ─────────────────
// Enumurile vin din `src/types/database.ts`. O categorie nouă în bază, fără
// locul ei aici, pică la `tsc` — nu ajunge tăcut pe „altele” într-o notă
// contabilă.
import { perioadaLa } from "@/domain/fleet/fiscal";
import type { DateString } from "@/lib/format/date";
import type { Database } from "@/types/database";

type Enumuri = Database["public"]["Enums"];

export type SursaCost = "alimentare" | "cheltuiala" | "service";

export const CATEGORII_CONTABILE = [
  "combustibil",
  "revizie_reparatii",
  "anvelope",
  "daune",
  "parcare",
  "spalatorie",
  "taxe_drum",
  "altele",
] as const;
export type CategorieContabila = (typeof CATEGORII_CONTABILE)[number];

/** Regimul de deducere la DATA liniei (vezi `regimDeclaratLa`). */
export type RegimDeducere = "integral" | "limitat_50";

export type StareFoaie = Enumuri["trip_sheet_status"];

export interface VehiculLinie {
  /** Din cheia străină a sursei: există mereu, chiar când vehiculul s-a șters. */
  readonly id: string;
  /** Numărul de înmatriculare: instantaneul foii sau vehiculul de azi; `null` = necunoscut. */
  readonly nr: string | null;
  readonly masaMaximaKg: number | null;
}

export interface LinieCost {
  readonly id: string;
  readonly sursa: SursaCost;
  /** Ziua documentului, în ora României. */
  readonly data: DateString;
  readonly categorie: CategorieContabila;
  /** Totalul de pe document, CU TVA, în bani (întreg nenegativ). */
  readonly totalBani: number;
  readonly vehicul: VehiculLinie;
  /** Doar pentru jurnal (decizia D11): nu intră în explicațiile importate. */
  readonly sofer: string | null;
  /** `numar_bon` / `numar_document` / `numar_factura`, așa cum a fost scris. */
  readonly document: string | null;
  /** Stația sau furnizorul. */
  readonly furnizor: string | null;
  /** `fuel_entries.cui_statie` (F12a): doar cifre. */
  readonly cuiFurnizor: string | null;
  /**
   * Sursa înregistrează CUI-ul furnizorului (doar alimentările, din F12a). Pe o
   * sursă care îl are, un CUI lipsă înseamnă bon necitit complet (L13); pe una
   * care nu-l are, lipsa nu spune nimic despre document.
   */
  readonly sursaAreCui: boolean;
  readonly litri: number | null;
  /** Tipul combustibilului sau descrierea intervenției, pentru explicație. */
  readonly detaliu: string | null;
  /** Regimul din F10 (`vehicle_fiscal_regimes`) la data liniei; `null` = nedeclarat. */
  readonly regimDeclarat: RegimDeducere | null;
  /** Starea foii, doar pentru alimentări; `null` pe sursele fără foaie. */
  readonly stareFoaie: StareFoaie | null;
  /** Foaia alimentării a fost ștearsă logic. */
  readonly foaieStearsa: boolean;
  /** Legată de o tranzacție de card de flotă (F12b, `fuel_card_transactions.fuel_entry_id`). */
  readonly peCardDeFlota: boolean;
}

/** Categoriile cheltuielilor din F7 (`vehicle_expense_category`). */
export const CATEGORIE_CHELTUIALA = {
  combustibil_fara_foaie: "combustibil",
  parcare: "parcare",
  spalatorie: "spalatorie",
  taxa_drum: "taxe_drum",
  taxa_pod: "taxe_drum",
  tollro: "taxe_drum",
  altele: "altele",
} as const satisfies Record<Enumuri["vehicle_expense_category"], CategorieContabila>;

/** Tipurile intervențiilor din F7 (`vehicle_service_type`). */
export const CATEGORIE_SERVICE = {
  revizie: "revizie_reparatii",
  reparatie: "revizie_reparatii",
  anvelope: "anvelope",
  dauna: "daune",
  altele: "altele",
} as const satisfies Record<Enumuri["vehicle_service_type"], CategorieContabila>;

/**
 * Regimul fiscal din F10 → deducerea TVA-ului. Doar `limitat_50` limitează
 * (art. 298 alin. 1); celelalte trei sunt deducere integrală (alin. 2 și 3).
 */
export const DEDUCERE_DUPA_REGIM_FISCAL = {
  limitat_50: "limitat_50",
  integral_exclusiv_economic: "integral",
  exceptat_categorie: "integral",
  peste_3500_sau_9_locuri: "integral",
} as const satisfies Record<Enumuri["vehicle_fiscal_regime"], RegimDeducere>;

export interface PerioadaRegim {
  readonly valabil_de_la: DateString;
  readonly regim: Enumuri["vehicle_fiscal_regime"];
}

/** Regimul de deducere în vigoare la `zi`: ultima perioadă cu `valabil_de_la <= zi`. */
export function regimDeclaratLa(
  perioade: readonly PerioadaRegim[],
  zi: DateString,
): RegimDeducere | null {
  const perioada = perioadaLa(perioade, zi);
  return perioada === null ? null : DEDUCERE_DUPA_REGIM_FISCAL[perioada.regim];
}

export const ETICHETE_CATEGORIE_CONTABILA: Readonly<Record<CategorieContabila, string>> = {
  combustibil: "Combustibil",
  revizie_reparatii: "Revizie și reparații",
  anvelope: "Anvelope",
  daune: "Daune",
  parcare: "Parcare",
  spalatorie: "Spălătorie",
  taxe_drum: "Taxe de drum",
  altele: "Altele",
};

export const ETICHETE_SURSA: Readonly<Record<SursaCost, string>> = {
  alimentare: "Alimentare",
  cheltuiala: "Cheltuială",
  service: "Service",
};

/** Cum se numește documentul în explicație. */
export const ETICHETE_DOCUMENT: Readonly<Record<SursaCost, string>> = {
  alimentare: "bon",
  cheltuiala: "doc.",
  service: "factura",
};

/** Ordinea stabilă a liniilor în orice fișier: data, apoi sursa, apoi id-ul. */
export function comparaLinii(a: LinieCost, b: LinieCost): number {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  if (a.sursa !== b.sursa) return a.sursa < b.sursa ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
