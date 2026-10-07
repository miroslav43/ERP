import { describe, expect, it } from "vitest";
import { z } from "zod";

import { intrareaActiunii } from "./intrare";

describe("intrareaActiunii", () => {
  it("un FormData devine obiect pe care Zod îl poate valida — defectul din evaluări", () => {
    const date = new FormData();
    date.set("denumire", "Evaluare anuală");
    date.set("criterii", '[{"denumire":"Calitate"}]');
    const schema = z.object({ denumire: z.string(), criterii: z.string() });

    // Înainte: `schema.safeParse(date)` dădea „expected string, received undefined”.
    expect(schema.safeParse(date).success).toBe(false);
    expect(schema.safeParse(intrareaActiunii(date))).toMatchObject({
      success: true,
      data: { denumire: "Evaluare anuală", criterii: '[{"denumire":"Calitate"}]' },
    });
  });

  it("cheile repetate devin listă, în ordine; fișierele rămân File", () => {
    const date = new FormData();
    date.append("zile", "luni");
    date.append("zile", "marti");
    const fisier = new File(["x"], "a.pdf", { type: "application/pdf" });
    date.set("fisier", fisier);

    expect(intrareaActiunii(date)).toEqual({ zile: ["luni", "marti"], fisier });
  });

  it("ignoră cheile `$ACTION_*` puse de React", () => {
    const date = new FormData();
    date.set("$ACTION_ID_abc", "");
    date.set("id", "1");
    expect(intrareaActiunii(date)).toEqual({ id: "1" });
  });

  it("un obiect obișnuit trece neatins", () => {
    const intrare = { id: "1" };
    expect(intrareaActiunii(intrare)).toBe(intrare);
  });
});
