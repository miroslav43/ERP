// src/domain/calendar/paste-gregorian.test.ts

import { describe, expect, it } from "vitest";

import { pasteGregorian } from "./paste-gregorian";
import { pasteOrtodox } from "./paste-ortodox";

function iso(data: Date): string {
  const an = data.getUTCFullYear().toString().padStart(4, "0");
  const luna = (data.getUTCMonth() + 1).toString().padStart(2, "0");
  const zi = data.getUTCDate().toString().padStart(2, "0");
  return `${an}-${luna}-${zi}`;
}

describe("pasteGregorian", () => {
  /*
   * Valori SCRISE DE MÂNĂ, nu generate de funcția testată. Verificate pe 8 oct
   * 2026 cu o implementare independentă (`dateutil.easter`, metoda
   * EASTER_WESTERN). 2008 e cel mai devreme Paște din secol (23 martie), 2038 cel
   * mai târziu posibil (25 aprilie); 2025 și 2028 coincid cu Paștele ortodox.
   */
  const cazuri: ReadonlyArray<readonly [number, string]> = [
    [2008, "2008-03-23"],
    [2011, "2011-04-24"],
    [2019, "2019-04-21"],
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2035, "2035-03-25"],
    [2038, "2038-04-25"],
  ];

  it.each(cazuri)("în %i, Paștele gregorian cade pe %s", (an, asteptat) => {
    expect(iso(pasteGregorian(an))).toBe(asteptat);
  });

  it("cade mereu duminica, între 22 martie și 25 aprilie", () => {
    for (let an = 1900; an <= 2199; an += 1) {
      const paste = pasteGregorian(an);
      expect(paste.getUTCDay(), String(an)).toBe(0);
      const ziuaDinAn = iso(paste).slice(5);
      expect(ziuaDinAn >= "03-22" && ziuaDinAn <= "04-25", `${String(an)}: ${ziuaDinAn}`).toBe(
        true,
      );
    }
  });

  it("față de Paștele ortodox: aceeași zi, sau cu 1, 4 ori 5 săptămâni mai devreme", () => {
    // Invariantul care prinde o formulă greșită fără să depindă de tabelul de mai sus.
    for (let an = 1900; an <= 2199; an += 1) {
      const diferenta = (pasteOrtodox(an).getTime() - pasteGregorian(an).getTime()) / 86_400_000;
      expect([0, 7, 28, 35], String(an)).toContain(diferenta);
    }
  });

  it("respinge anii în afara intervalului și anii neîntregi", () => {
    expect(() => pasteGregorian(1899)).toThrow(RangeError);
    expect(() => pasteGregorian(2200)).toThrow(RangeError);
    expect(() => pasteGregorian(2026.5)).toThrow(RangeError);
  });
});
