// src/app/(app)/departamente/tipuri.ts
// Modelul de ecran al structurii, partajat de cele două vizualizări și de panou.

import type { NodArbore } from "@/domain/departments/arbore";

import type { PersoanaPanou } from "./panou-departament";

export interface DepartamentEcran {
  readonly id: string;
  readonly parent_id: string | null;
  readonly cod: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly activ: boolean;
  readonly manager_employee_id: string | null;
  readonly cost_center: string | null;
  readonly manager: Readonly<{ full_name: string; avatar_url: string | null }> | null;
  /** Angajații activi repartizați FIX aici. Sortați pe nume. */
  readonly persoane: readonly PersoanaPanou[];
}

export type NodDepartament = NodArbore<DepartamentEcran>;

export interface OptiuneDepartament {
  readonly id: string;
  readonly denumire: string;
  readonly cod: string;
}

export interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string;
}
