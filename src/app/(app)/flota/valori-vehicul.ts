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
 * ── ȘOFERUL NU E AICI ────────────────────────────────────────────────────────
 * Din 0173, `employee_id` e derivatul alocării deschise și se schimbă doar prin
 * `alocaVehicul`. Departamentul are acum selector, iar `pool` e o bifă: o bifă
 * nebifată LIPSEȘTE din `FormData`, deci absența înseamnă `false`, nu „nu știu”.
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
  capacitate_cilindrica: number | null;
  masa_maxima_kg: number | null;
  numar_locuri: number | null;
  department_id: string | null;
  pool: boolean;
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
    capacitate_cilindrica: numarSauNull(date, "capacitate_cilindrica"),
    masa_maxima_kg: numarSauNull(date, "masa_maxima_kg"),
    numar_locuri: numarSauNull(date, "numar_locuri"),
    department_id: textSauNull(date, "department_id"),
    pool: date.get("pool") === "on",
    data_achizitie: textSauNull(date, "data_achizitie"),
    valoare_achizitie: numarSauNull(date, "valoare_achizitie"),
    prag_salt_km: numarSauNull(date, "prag_salt_km"),
    observatii: textSauNull(date, "observatii"),
  };
}

/**
 * Încărcătura vehiculului NOU: aceleași câmpuri, plus kilometrajul de la bord.
 *
 * `km_curent` nu intră în `valoriVehicul`: acțiunea de modificare trimite
 * obiectul întreg, iar kilometrajul nu se schimbă de acolo.
 *
 * Câmpul gol rămâne `null`, nu devine `0`, ca schema să-l refuze cu mesajul
 * ei. `Number("")` ar fi dat 0 km, adică exact defectul pe care îl repară.
 */
export function valoriVehiculNou(
  date: FormData,
): ValoriVehicul & Readonly<{ km_curent: number | null }> {
  return { ...valoriVehicul(date), km_curent: numarSauNull(date, "km_curent") };
}
