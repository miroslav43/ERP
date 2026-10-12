// src/app/(app)/diurna/rezumat-decizie.ts
//
// Ce vede aprobatorul în caseta de confirmare a deciziei: omul, intervalul,
// avansul — gata formatate pe server. `DecizieDeplasare` se montează în două
// locuri (coada de aprobări și fișa deplasării), iar formatarea avansului
// trebuie să fie aceeași în amândouă; aici stă o singură dată.
import { formatDateTime } from "@/lib/format/date";
import { formatAmount, formatLei } from "@/lib/format/money";
import type { AngajatRezumat } from "@/lib/queries/per-diem";

export type RezumatDecizie = Readonly<{ angajat: string; interval: string; avans: string }>;

export function rezumatDecizie(
  deplasare: Readonly<{
    plecare_la: string;
    sosire_la: string;
    avans_acordat: number;
    moneda_avans: string | null;
  }>,
  angajat: AngajatRezumat | undefined,
): RezumatDecizie {
  return {
    angajat: angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`,
    interval: `${formatDateTime(new Date(deplasare.plecare_la))} – ${formatDateTime(new Date(deplasare.sosire_la))}`,
    avans:
      deplasare.avans_acordat > 0
        ? deplasare.moneda_avans === null || deplasare.moneda_avans === "RON"
          ? formatLei(deplasare.avans_acordat)
          : formatAmount(deplasare.avans_acordat, deplasare.moneda_avans)
        : "fără avans",
  };
}
