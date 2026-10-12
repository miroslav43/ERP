// src/domain/maintenance/instructiuni.ts
/**
 * Instrucțiunile unui plan ca listă de verificare. Funcții pure.
 *
 * Planul își ține instrucțiunile ca text liber; liniile care încep cu „- ” (sau
 * „* ”, „• ”, „1. ”) sunt pași. La „Execută”, pașii apar ca bife, iar ce s-a
 * bifat și ce nu ajunge în `observatii` ale intervenției — fără tabelă nouă,
 * fiindcă volumul real (câteva planuri pe firmă) nu o justifică.
 */

const RE_PAS = /^\s*(?:[-*•]|\d{1,2}[.)])\s+(.+?)\s*$/;

/** Plafon pentru rezumat: `observatii` are 2000 de caractere în schemă. */
export const MAXIM_REZUMAT_PASI = 1500;

/** Pașii din text, în ordinea lor; liniile care nu sunt pași se ignoră. */
export function pasiDinInstructiuni(text: string | null): readonly string[] {
  if (text === null) return [];
  const pasi: string[] = [];
  for (const linie of text.split(/\r?\n/)) {
    const m = RE_PAS.exec(linie);
    if (m?.[1] !== undefined && m[1].length > 0) pasi.push(m[1]);
  }
  return pasi;
}

/**
 * Rezumatul bifelor pentru `observatii`: „Listă de verificare: ✓ a · ✓ b · ✗ c”.
 * Gol când nu există pași. Tăiat la plafon, cu „…” ca semn că lipsește ceva.
 */
export function rezumatPasi(pasi: readonly string[], bifati: ReadonlySet<number>): string {
  if (pasi.length === 0) return "";
  const bucati = pasi.map((pas, i) => `${bifati.has(i) ? "✓" : "✗"} ${pas}`);
  const text = `Listă de verificare: ${bucati.join(" · ")}`;
  return text.length <= MAXIM_REZUMAT_PASI ? text : `${text.slice(0, MAXIM_REZUMAT_PASI - 1)}…`;
}

/** `observatii` finale: rezumatul bifelor, apoi textul omului, despărțite de o linie goală. */
export function observatiiCuPasi(rezumat: string, observatii: string | null): string | null {
  const bucati = [rezumat, observatii ?? ""].map((b) => b.trim()).filter((b) => b.length > 0);
  return bucati.length === 0 ? null : bucati.join("\n\n");
}
