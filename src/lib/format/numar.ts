/**
 * Numere scrise ca în limba română, cu substantivul lor acordat.
 *
 * Funcții pure, fără I/O, ca `money.ts`: merg și pe server (PDF, mesaje de
 * eroare), și în client.
 *
 * ── DE CE EXISTĂ FIȘIERUL ─────────────────────────────────────────────────
 * QA din oct 2026 a găsit „6 din 6 de rânduri”, „1 pași”, „13,00 zile rămase”,
 * „lipsesc 1,00 zile”. Două cauze, amândouă aici:
 *   · `formatAmount` e făcut pentru BANI și forțează două zecimale. Zilele,
 *     pașii și rândurile nu sunt sume: „13 zile”, iar jumătatea de zi apare
 *     doar când există („1,5 zile”). De aici `formatNumar`.
 *   · „de” intră peste 19, după ULTIMELE DOUĂ cifre, nu după mărime: „20 de
 *     zile”, dar „101 zile” și „0 zile”. Singularul e doar la 1 (și -1).
 *
 * Regula exista în zece copii paralele. Aici s-au mutat cele din
 * `src/app/(app)/mentenanta/etichete.ts` (`textNumarat`) și
 * `src/app/(app)/diurna/etichete.ts` (`textZile`), care doar re-exportă.
 *
 * ── DATORIE (copii încă nemutate) ─────────────────────────────────────────
 *   · `acordNumeric` în `src/domain/cursuri/scadente.ts` — dă greșit
 *     „0 de minute” (zero intră pe ramura „de”);
 *   · `numara` în `src/domain/hr/stergere-angajat.ts`;
 *   · `numarCuUnitate` în `src/domain/ssm/termen-itm.ts`;
 *   · `textNumaratFoi` în `src/app/(app)/flota/aprobari/page.tsx`;
 *   · `cuDe` în `src/content/legal/zile-libere.ts`;
 *   · `zile` în `src/lib/asistent/unelte/sold-concediu.ts`;
 *   · inline în `src/app/(marketing)/unelte/calculator-salariu/lei.ts` și
 *     `src/domain/payroll/etape/diurna-plafoane.ts`.
 */

const formator = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

/** `1` → „1”, `1.5` → „1,5”, `1234.5` → „1.234,5”. Fără zecimale forțate. */
export function formatNumar(numar: number): string {
  return formator.format(numar);
}

/**
 * DOAR substantivul, acordat cu numărul: „rând”, „rânduri”, „de rânduri”.
 *
 * Pentru textele în care numărul e scris separat de substantiv
 * („6 din 6 rânduri”, „2 din 5 pași”).
 */
export function acordSubstantiv(numar: number, singular: string, plural: string): string {
  const absolut = Math.abs(numar);
  if (absolut === 1) return singular;
  const intreg = Math.floor(absolut);
  const ultimeleDoua = intreg % 100;
  const cereDe = intreg >= 20 && (ultimeleDoua === 0 || ultimeleDoua >= 20);
  return cereDe ? `de ${plural}` : plural;
}

/** Numărul și substantivul lui: „0 persoane”, „1 persoană”, „20 de persoane”. */
export function textNumarat(numar: number, singular: string, plural: string): string {
  return `${formatNumar(numar)} ${acordSubstantiv(numar, singular, plural)}`;
}

/** „1 zi”, „13 zile”, „20 de zile”, „1,5 zile” — sau alt substantiv de zile. */
export function textZile(zile: number, singular = "zi", plural = "zile"): string {
  return textNumarat(zile, singular, plural);
}
