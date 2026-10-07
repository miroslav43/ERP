// src/app/(app)/mentenanta/interventii/valori-interventie.ts

/**
 * `FormData` → câmpurile comune ale unei intervenții (`campuriInterventie` din
 * `schemas/maintenance.ts`), fără `plan_id` și `equipment_id`: pe acelea le
 * știe apelantul (fișa echipamentului, planul, sesizarea), nu formularul.
 *
 * Aceeași mapare servește trei casete — intervenția de pe fișa echipamentului,
 * „Execută" de pe plan și „Rezolvă" de pe sesizare — ca `rezolvaSesizare` să nu
 * mai primească cinci câmpuri din treisprezece cu restul fixate pe `null`, cum
 * făcea panoul inline de dinainte.
 *
 * `Number("")` e `0`, nu `NaN`: un câmp numeric gol devine `null` ÎNAINTE de
 * conversie, cu excepția costurilor, care au implicit `0` și în schemă.
 */
export type ValoriInterventie = Readonly<{
  tip: string;
  data: string;
  ora_start: string | null;
  durata_ore: number | null;
  executant_employee_id: string | null;
  executant_extern: string | null;
  descriere: string;
  piese: string | null;
  cost_piese: number;
  cost_manopera: number;
  rezultat: string;
  oprire_minute: number | null;
  citire_contor: number | null;
  observatii: string | null;
}>;

function text(date: FormData, cheie: string): string {
  return String(date.get(cheie) ?? "").trim();
}

function textSauNull(date: FormData, cheie: string): string | null {
  const valoare = text(date, cheie);
  return valoare.length === 0 ? null : valoare;
}

function numarSauNull(date: FormData, cheie: string): number | null {
  const valoare = text(date, cheie);
  return valoare.length === 0 ? null : Number(valoare);
}

function numarSauZero(date: FormData, cheie: string): number {
  return numarSauNull(date, cheie) ?? 0;
}

export function valoriInterventie(date: FormData): ValoriInterventie {
  return {
    tip: text(date, "tip") || "corectiva",
    data: text(date, "data"),
    ora_start: textSauNull(date, "ora_start"),
    durata_ore: numarSauNull(date, "durata_ore"),
    executant_employee_id: textSauNull(date, "executant_employee_id"),
    executant_extern: textSauNull(date, "executant_extern"),
    descriere: text(date, "descriere"),
    piese: textSauNull(date, "piese"),
    cost_piese: numarSauZero(date, "cost_piese"),
    cost_manopera: numarSauZero(date, "cost_manopera"),
    rezultat: text(date, "rezultat") || "reusita",
    oprire_minute: numarSauNull(date, "oprire_minute"),
    citire_contor: numarSauNull(date, "citire_contor"),
    observatii: textSauNull(date, "observatii"),
  };
}

/** Planul ales în casetă, sau `null` pentru o intervenție de sine stătătoare. */
export function planDinFormular(date: FormData): string | null {
  return textSauNull(date, "plan_id");
}
