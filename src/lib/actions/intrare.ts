// src/lib/actions/intrare.ts

/**
 * Intrarea unei acțiuni, adusă la forma pe care o validează Zod.
 *
 * ── DE CE ───────────────────────────────────────────────────────────────────
 * `<Formular>` dă acțiunii un `FormData`, iar mai multe ecrane îl treceau mai
 * departe ca atare: `actiune={creeazaSetKpi}`, `creeazaSablonEvaluare(date)`.
 * Schemele sunt `z.object(...)`, iar un `FormData` n-are proprietăți proprii —
 * Zod citea `denumire`, `criterii` ca `undefined` și refuza orice trimitere cu
 * „Invalid input: expected string, received undefined”, chiar cu câmpurile
 * completate. Tot modulul de evaluări și KPI (șabloane, evaluări, seturi,
 * luni) n-a salvat astfel niciodată nimic (6 oct 2026); restul aplicației
 * convertea de mână, câmp cu câmp, fiecare formular în parte.
 *
 * Conversia stă acum într-un singur loc, în `createAction`, înaintea validării
 * și a jurnalului de audit — deci și o acțiune nouă chemată cu `FormData`
 * funcționează. Un obiect obișnuit trece neatins.
 *
 * ── REGULI ──────────────────────────────────────────────────────────────────
 * · O cheie care apare o dată dă o valoare; una repetată (casete bifate cu
 *   același `name`) dă o listă, în ordinea din formular — nu doar ultima.
 * · `File` rămâne `File`; schemele care primesc fișiere îl validează ele.
 * · Cheile `$ACTION_*` puse de React pe formularele cu acțiune de server nu
 *   sunt date ale omului și nu ajung în schemă.
 */
export function intrareaActiunii(brut: unknown): unknown {
  if (typeof FormData === "undefined" || !(brut instanceof FormData)) return brut;
  const obiect: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [cheie, valoare] of brut.entries()) {
    if (cheie.startsWith("$ACTION_")) continue;
    const existenta = obiect[cheie];
    if (existenta === undefined) obiect[cheie] = valoare;
    else if (Array.isArray(existenta)) existenta.push(valoare);
    else obiect[cheie] = [existenta, valoare];
  }
  return obiect;
}
