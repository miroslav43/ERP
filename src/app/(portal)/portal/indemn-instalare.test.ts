import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MARCAJ_APLICATIE } from "./indemn-instalare";

/**
 * Contractul dintre portal și învelișul nativ.
 *
 * `mobil/App.tsx` adaugă marcajul la User-Agent prin
 * `applicationNameForUserAgent`; `indemn-instalare.tsx` îl caută ca să nu
 * invite omul să instaleze aplicația DIN care citește invitația.
 *
 * Nu există import între ele — `mobil/` are propriul tsconfig, propriul
 * lockfile și e exclus din ESLint-ul de la rădăcină — deci singura poartă
 * posibilă e citirea fișierului de pe disc. Fără ea, o redenumire într-una
 * din părți ar readuce banda în APK, tăcut: nimic n-ar cădea, iar defectul
 * s-ar vedea doar pe telefon.
 */
describe("marcajul de aplicație nativă", () => {
  const appTsx = readFileSync(join(process.cwd(), "mobil/App.tsx"), "utf8");

  it("`mobil/App.tsx` chiar îl pune în User-Agent", () => {
    expect(appTsx).toContain(`applicationNameForUserAgent="${MARCAJ_APLICATIE}/`);
  });

  it("folosește `applicationNameForUserAgent`, nu `userAgent`", () => {
    // `userAgent` ÎNLOCUIEȘTE antetul implicit: am pierde versiunea de Android
    // și de Chrome, de care depinde orice diagnostic ulterior. Regula e ușor
    // de călcat la o refactorizare, fiindcă ambele „merg" pentru marcaj.
    expect(appTsx).not.toMatch(/^\s*userAgent=/m);
  });
});
