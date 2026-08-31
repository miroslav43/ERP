// src/app/(app)/flota/valori-vehicul.ts

/**
 * `FormData` → încărcătura acțiunilor de vehicul.
 *
 * ── CE A REPARAT FIȘIERUL ĂSTA ───────────────────────────────────────────────
 * Formularul de adăugare CITEA `culoare`, `data_achizitie` și `valoare_achizitie`
 * din `FormData`, dar niciunul dintre cele trei n-avea input în pagină. Adică
 * trei câmpuri ale schemei ajungeau mereu goale, fără ca ceva să pârâie: nici
 * typecheck, nici lint, nici baza — toate trei sunt nullable. Mutarea maparii
 * într-un fișier propriu, cu test, face desincronizarea vizibilă.
 *
 * ── DE CE `employee_id` ȘI `department_id` SE CITESC, DEȘI NU SE COMPLETEAZĂ ──
 * Formularele nu au încă selector de șofer sau de departament. Dar acțiunea de
 * MODIFICARE trimite obiectul întreg, deci dacă le-aș fixa pe `null` aici, orice
 * salvare a fișei ar șterge o alocare făcută altundeva. Caseta de modificare le
 * trimite prin `<input type="hidden">` cu valorile curente; la creare lipsesc din
 * `FormData` și devin `null`, exact ca înainte.
 */
export type ValoriVehicul = Readonly<{
  nr_inmatriculare: string;
  marca: string;
  model: string;
  vin: string;
  categorie: string;
  tip_combustibil: string;
  an_fabricatie: number | null;
  culoare: string | null;
  consum_mediu_declarat: number | null;
  employee_id: string | null;
  department_id: string | null;
  data_achizitie: string | null;
  valoare_achizitie: number | null;
  prag_salt_km: number | null;
  observatii: string | null;
}>;

function text(date: FormData, cheie: string): string {
  return String(date.get(cheie) ?? "").trim();
}

function textSauNull(date: FormData, cheie: string): string | null {
  const valoare = text(date, cheie);
  return valoare.length === 0 ? null : valoare;
}

/** `Number("")` e `0`, nu `NaN` — un an de fabricație gol ar deveni anul zero. */
function numarSauNull(date: FormData, cheie: string): number | null {
  const valoare = text(date, cheie);
  return valoare.length === 0 ? null : Number(valoare);
}

export function valoriVehicul(date: FormData): ValoriVehicul {
  return {
    nr_inmatriculare: text(date, "nr_inmatriculare"),
    marca: text(date, "marca"),
    model: text(date, "model"),
    // `vin` rămâne text, nu `null`: schema acceptă șirul gol printr-o ramură
    // proprie care îl transformă ea în `null`, după validarea formatului.
    vin: text(date, "vin"),
    categorie: text(date, "categorie"),
    tip_combustibil: text(date, "tip_combustibil"),
    an_fabricatie: numarSauNull(date, "an_fabricatie"),
    culoare: textSauNull(date, "culoare"),
    consum_mediu_declarat: numarSauNull(date, "consum_mediu_declarat"),
    employee_id: textSauNull(date, "employee_id"),
    department_id: textSauNull(date, "department_id"),
    data_achizitie: textSauNull(date, "data_achizitie"),
    valoare_achizitie: numarSauNull(date, "valoare_achizitie"),
    prag_salt_km: numarSauNull(date, "prag_salt_km"),
    observatii: textSauNull(date, "observatii"),
  };
}
