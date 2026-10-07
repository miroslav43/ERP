// src/app/(app)/mentenanta/echipamente/valori-echipament.ts

/**
 * `FormData` → încărcătura acțiunilor de echipament (`creeazaEchipament`,
 * `actualizeazaEchipament`).
 *
 * Aceeași mapare pentru casetă nouă și pentru editare: formularul vechi, pe
 * react-hook-form, avea conversia scrisă în componentă și netestată — un câmp
 * citit sub un nume greșit ajungea mereu `null`, fără ca nimic să pârâie,
 * fiindcă toate coloanele în cauză sunt nullable. Aici maparea are test propriu
 * (`valori-echipament.test.ts`), ca la `flota/valori-vehicul.ts`.
 *
 * O bifă nebifată LIPSEȘTE din `FormData`, deci absența lui `este_iscir`
 * înseamnă `false`, nu „nu știu”. `Number("")` e `0`, nu `NaN` — un an de
 * fabricație gol ar deveni anul zero, de aceea șirul gol devine `null` ÎNAINTE
 * de conversie.
 */
export type ValoriEchipament = Readonly<{
  cod: string;
  denumire: string;
  serie: string | null;
  producator: string | null;
  model: string | null;
  an_fabricatie: number | null;
  locatie: string | null;
  department_id: string | null;
  responsabil_employee_id: string | null;
  status: string;
  este_iscir: boolean;
  tip_autorizare_necesara: string | null;
  valoare_achizitie: number | null;
  data_punerii_in_functiune: string | null;
  derogare_motiv: string | null;
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

export function valoriEchipament(date: FormData): ValoriEchipament {
  const esteIscir = date.get("este_iscir") === "on";
  return {
    cod: text(date, "cod"),
    denumire: text(date, "denumire"),
    serie: textSauNull(date, "serie"),
    producator: textSauNull(date, "producator"),
    model: textSauNull(date, "model"),
    an_fabricatie: numarSauNull(date, "an_fabricatie"),
    locatie: textSauNull(date, "locatie"),
    department_id: textSauNull(date, "department_id"),
    responsabil_employee_id: textSauNull(date, "responsabil_employee_id"),
    status: text(date, "status") || "in_functiune",
    este_iscir: esteIscir,
    // Câmpurile de regim ISCIR se randează doar cu bifa pusă; dacă bifa a fost
    // scoasă după ce au fost completate, nu mai sunt în DOM și nici în `FormData`
    // — dar un `defaultValue` rămas într-un control ascuns prin CSS ar ajunge.
    // Regula e deci explicită: fără ISCIR, nu există tip de autorizare și nici
    // derogare, orice ar fi scris în formular.
    tip_autorizare_necesara: esteIscir ? textSauNull(date, "tip_autorizare_necesara") : null,
    valoare_achizitie: numarSauNull(date, "valoare_achizitie"),
    data_punerii_in_functiune: textSauNull(date, "data_punerii_in_functiune"),
    derogare_motiv: esteIscir ? textSauNull(date, "derogare_motiv") : null,
  };
}
