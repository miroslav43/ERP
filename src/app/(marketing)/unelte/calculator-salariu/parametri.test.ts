import { describe, expect, it } from "vitest";

import { calculeazaDinParametri, parametriCalculator } from "./parametri";

describe("parametrii calculatorului de salariu", () => {
  it("implicit: salariul minim brut, fără persoane, funcție de bază", () => {
    expect(parametriCalculator(new URLSearchParams())).toEqual({
      suma: 4325,
      din: "brut",
      persoane: 0,
      functieDeBaza: true,
    });
  });

  it("citește suma în format românesc și mărginește intrările absurde", () => {
    expect(parametriCalculator(new URLSearchParams({ suma: "5.000,50" })).suma).toBe(5000.5);
    expect(parametriCalculator(new URLSearchParams({ suma: "-3" })).suma).toBe(4325);
    expect(parametriCalculator(new URLSearchParams({ suma: "9".repeat(40) })).suma).toBe(500000);
    expect(parametriCalculator(new URLSearchParams({ persoane: "17" })).persoane).toBe(4);
    expect(parametriCalculator(new URLSearchParams({ din: "orice" })).din).toBe("brut");
    expect(parametriCalculator(new URLSearchParams({ baza: "nu" })).functieDeBaza).toBe(false);
  });

  it("semnalează un brut sub salariul minim, pe care calculul cu normă întreagă nu-l acoperă", () => {
    const r = calculeazaDinParametri(new URLSearchParams({ suma: "3000" }));
    expect(r.subMinim).toBe(true);
    expect(calculeazaDinParametri(new URLSearchParams({ suma: "4325" })).subMinim).toBe(false);
  });

  it("calculul din net întoarce brutul care dă netul", () => {
    const r = calculeazaDinParametri(new URLSearchParams({ suma: "2981", din: "net" }));
    expect(r.rezultat.brut).toBe(5000);
  });
});
