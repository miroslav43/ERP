// src/app/(app)/flota/[id]/valori-document.ts

/**
 * `FormData` → încărcătura acțiunilor de document.
 *
 * Funcție pură, în afara componentelor, din două motive. Unul: o folosesc două
 * formulare — cel care adaugă și caseta care corectează — iar o a doua copie ar
 * diverge exact ca în cazul câmpurilor. Doi: e singurul loc din lanț unde „câmp
 * gol" se traduce în `null`, iar traducerea aia are o capcană care merită
 * verificată de un test, nu de un utilizator.
 *
 * ── CAPCANA: `""` DEVINE `0`, NU `null` ──────────────────────────────────────
 * `cost` e `z.coerce.number().min(0).nullable().default(null)`. Un input numeric
 * gol trimite `""`, iar `Number("")` e `0` — deci un document fără cost s-ar
 * salva cu „0 lei", care în raport arată ca o poliță gratuită, nu ca una
 * necompletată. `null` trece nevătămat prin `.nullable()`, care se evaluează
 * ÎNAINTEA coerciției.
 */
export type ValoriDocument = Readonly<{
  document_type_id: string;
  emitent: string | null;
  valabil_de_la: string | null;
  expira_la: string | null;
  cost: number | null;
  observatii: string | null;
}>;

function textSauNull(date: FormData, cheie: string): string | null {
  const valoare = String(date.get(cheie) ?? "").trim();
  return valoare.length === 0 ? null : valoare;
}

export function valoriDocument(date: FormData): ValoriDocument {
  const cost = textSauNull(date, "cost");

  return {
    document_type_id: String(date.get("document_type_id") ?? ""),
    emitent: textSauNull(date, "emitent"),
    valabil_de_la: textSauNull(date, "valabil_de_la"),
    expira_la: textSauNull(date, "expira_la"),
    cost: cost === null ? null : Number(cost),
    observatii: textSauNull(date, "observatii"),
  };
}
