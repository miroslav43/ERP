// src/domain/calendar/paste-ortodox.test.ts

import { describe, expect, it } from "vitest";
import { pasteOrtodox } from "./paste-ortodox";

function formateazaISO(data: Date): string {
  const an = data.getUTCFullYear().toString().padStart(4, "0");
  const luna = (data.getUTCMonth() + 1).toString().padStart(2, "0");
  const zi = data.getUTCDate().toString().padStart(2, "0");
  return `${an}-${luna}-${zi}`;
}

describe("pasteOrtodox", () => {
  // Valori de referință scrise manual (NU generate de funcția testată),
  // verificate independent față de calendarul bisericesc ortodox.
  const cazuri: ReadonlyArray<readonly [number, string]> = [
    [2024, "2024-05-05"],
    [2025, "2025-04-20"],
    [2026, "2026-04-12"],
    [2027, "2027-05-02"],
    [2028, "2028-04-16"],
  ];

  it.each(cazuri)("anul %i are Paștele ortodox pe %s", (an, dataAsteptata) => {
    expect(formateazaISO(pasteOrtodox(an))).toBe(dataAsteptata);
  });

  it("respinge anii în afara intervalului suportat", () => {
    expect(() => pasteOrtodox(1899)).toThrow(RangeError);
    expect(() => pasteOrtodox(2200)).toThrow(RangeError);
  });

  it("respinge un an care nu e număr întreg", () => {
    expect(() => pasteOrtodox(2025.5)).toThrow(RangeError);
  });
});
