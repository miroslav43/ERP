// src/domain/attendance/zile-nepontate.lacune.test.ts
//
// Lacuna confirmată de audit: restanțele din portal folosesc doar calendarul
// național, nu zilele proprii ale firmei (`organization_holidays`: liber
// suplimentar și zi de recuperare). `zile-cerere.ts` aplică ordinea din
// `app.este_zi_lucratoare`, care le ține în seamă; `meritaPontata` nu are
// niciun parametru prin care să le primească.
//
// Testul fixează comportamentul ACTUAL. Reparația cere schimbarea semnăturii
// (zilele firmei ca intrare), deci forma corectă nu se poate scrie ca test pe
// semnătura de azi.

import { describe, expect, it } from "vitest";

import { meritaPontata } from "./zi-de-pontat";
import { zileNepontate } from "./zile-nepontate";

const BIROU = { lucreazaWeekend: false, lucreazaSarbatori: false } as const;

describe("zileNepontate — firmă de birou, martie 2026", () => {
  const lipsa = zileNepontate(2026, 3, "2026-03-31", [], BIROU);

  it("cere doar zilele luni–vineri de dinaintea zilei curente", () => {
    // Martie 2026: 22 de zile luni–vineri, iar 31 (marți) e ziua curentă.
    expect(lipsa).toHaveLength(21);
    expect(lipsa).not.toContain("2026-03-31");
    expect(lipsa.every((zi) => meritaPontata(zi, BIROU))).toBe(true);
  });

  it("azi cere pontaj pe o zi liberă a firmei (luni 9 martie, liber suplimentar)", () => {
    expect(lipsa).toContain("2026-03-09");
  });

  it("azi omite o sâmbătă de recuperare a firmei (14 martie)", () => {
    expect(lipsa).not.toContain("2026-03-14");
  });
});
