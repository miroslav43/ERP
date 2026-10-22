// src/app/(app)/flota/carduri/valori-card.ts

/**
 * `FormData` → încărcătura acțiunilor de card (0214, F12b). Singura traducere,
 * pentru cardul nou și pentru corectură (tiparul `valori-vehicul.ts`).
 *
 * Două capcane tăcute stau aici, prinse de `valori-card.test.ts`:
 *   · `Number("")` e `0`, nu `NaN`: o lună de valabilitate necompletată ar
 *     deveni luna zero. Golul rămâne `null`.
 *   · Ținta e UN singur câmp (`tinta`), cu valoarea `vehicul:<id>`, `sofer:<id>`
 *     sau goală (card de rezervă): două casete separate ar putea trimite
 *     amândouă, iar baza refuză (`fcard_tinta_ck`).
 */

export type TintaCard = Readonly<{
  vehicle_id: string | null;
  employee_id: string | null;
}>;

export type ValoriCard = Readonly<{
  denumire: string | null;
  vehicle_id: string | null;
  employee_id: string | null;
  valabil_luna: number | null;
  valabil_an: number | null;
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

/** `vehicul:<id>` / `sofer:<id>` / gol. O valoare necunoscută nu ghicește nimic. */
export function tintaDinValoare(valoare: string): TintaCard {
  const [fel, id] = valoare.split(":", 2);
  if (fel === "vehicul" && id !== undefined && id.length > 0) {
    return { vehicle_id: id, employee_id: null };
  }
  if (fel === "sofer" && id !== undefined && id.length > 0) {
    return { vehicle_id: null, employee_id: id };
  }
  return { vehicle_id: null, employee_id: null };
}

/** Valoarea selectorului de țintă pentru un card existent. */
export function valoareTinta(tinta: TintaCard): string {
  if (tinta.vehicle_id !== null) return `vehicul:${tinta.vehicle_id}`;
  if (tinta.employee_id !== null) return `sofer:${tinta.employee_id}`;
  return "";
}

export function valoriCard(date: FormData): ValoriCard {
  return {
    denumire: textSauNull(date, "denumire"),
    ...tintaDinValoare(text(date, "tinta")),
    valabil_luna: numarSauNull(date, "valabil_luna"),
    valabil_an: numarSauNull(date, "valabil_an"),
    observatii: textSauNull(date, "observatii"),
  };
}

export function valoriCardNou(
  date: FormData,
): ValoriCard & Readonly<{ emitent: string; numar: string }> {
  return {
    emitent: text(date, "emitent"),
    numar: text(date, "numar"),
    ...valoriCard(date),
  };
}

export function valoriCorecturaCard(
  id: string,
  date: FormData,
): ValoriCard & Readonly<{ id: string; status: string }> {
  return { id, status: text(date, "status"), ...valoriCard(date) };
}
