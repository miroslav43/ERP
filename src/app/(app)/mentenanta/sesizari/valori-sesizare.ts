// src/app/(app)/mentenanta/sesizari/valori-sesizare.ts

/**
 * `FormData` → încărcătura lui `creeazaSesizare`.
 *
 * Echipamentul vine dintr-un `<input type="hidden" name="equipment_id">`, scris
 * de selectorul cu căutare; gol, rămâne „” și `sesizareNouaSchema` îl refuză cu
 * mesajul ei pe câmp („Selectați echipamentul defect.”) — nu-l transformăm în
 * `null`, fiindcă `z.uuid()` ar da atunci un mesaj generic de tip.
 *
 * O bifă nebifată LIPSEȘTE din `FormData`: absența e `false`, nu „nu știu”.
 */
export type ValoriSesizare = Readonly<{
  equipment_id: string;
  descriere: string;
  urgenta: string;
  opreste_functionarea: boolean;
}>;

function text(date: FormData, cheie: string): string {
  return String(date.get(cheie) ?? "").trim();
}

export function valoriSesizare(date: FormData): ValoriSesizare {
  return {
    equipment_id: text(date, "equipment_id"),
    descriere: text(date, "descriere"),
    urgenta: text(date, "urgenta") || "medie",
    opreste_functionarea: date.get("opreste_functionarea") === "on",
  };
}
