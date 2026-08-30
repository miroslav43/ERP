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
  /**
   * Conduce departamentul, dar are în aplicație rolul de `employee`.
   *
   * Se calculează pe server, din rolul apartenenței. `false` acoperă și cazurile
   * în care nu e nimic de semnalat, și cele în care semnalul ar fi greșit: omul
   * fără cont (n-are ce rol să primească) sau pus intenționat pe `hr` ori
   * `Administrator` — roluri pe care automatismul nu le atinge niciodată.
   */
  readonly sefFaraRolDeManager: boolean;
  /** Angajații activi repartizați FIX aici. Sortați pe nume. */
  readonly persoane: readonly PersoanaPanou[];
}

export type NodDepartament = NodArbore<DepartamentEcran>;

export interface OptiuneDepartament {
  readonly id: string;
  readonly denumire: string;
  readonly cod: string;
  /** Un departament dezactivat nu poate primi oameni — vezi `mutaAngajati`. */
  readonly activ: boolean;
}

export interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string;
  /**
   * `employees.department_id` de ACUM. `null` = nerepartizat.
   *
   * Nu e decor: desemnarea unui manager îl și repartizează în departamentul pe
   * care îl preia, iar formularul trebuie să știe DINAINTE dacă asta înseamnă
   * că omul pleacă de undeva. Fără câmpul ăsta, singura variantă onestă ar fi
   * să nu mute pe nimeni.
   */
  readonly departamentId: string | null;
  /**
   * Denumirea acelui departament, pentru avertismentul din formular.
   *
   * Poate fi „alt departament" când RLS ascunde departamentul respectiv —
   * aceeași grijă ca la `PersoanaPanou.departamentCurent`: se spune ce se știe,
   * nu se inventează „nerepartizat".
   */
  readonly departamentDenumire: string | null;
}
