import { describe, expect, it } from "vitest";

import { calculeazaDinParametri, citesteSuma, parametriCalculator } from "./parametri";

const q = (o: Record<string, string>) => new URLSearchParams(o);

describe("citirea sumei, cum o scrie un român", () => {
  it("punctul de mii nu e virgulă zecimală: „4.500” e 4.500 de lei, nu 4,5", () => {
    // Auditul din 8 oct 2026: „4.500” dădea „Net 4 lei din brut 4,5 lei”.
    expect(citesteSuma("4.500")).toEqual({ ok: true, valoare: 4500, rotunjita: false });
    expect(citesteSuma("5.000")).toEqual({ ok: true, valoare: 5000, rotunjita: false });
    expect(citesteSuma("12.500")).toEqual({ ok: true, valoare: 12500, rotunjita: false });
    expect(citesteSuma("500.000")).toEqual({ ok: true, valoare: 500000, rotunjita: false });
    // Tastatura englezească: trei „zecimale” la lei nu există, deci tot mii.
    expect(citesteSuma("5,000")).toEqual({ ok: true, valoare: 5000, rotunjita: false });
  });

  it("acceptă spațiile, spațiul neîntrerupt, caracterele invizibile și sufixul de monedă", () => {
    for (const t of ["5000 lei", "5.000 lei", "5 000", "5 000", "5000LEI", "5000 RON", "​5000"]) {
      expect(citesteSuma(t), t).toEqual({ ok: true, valoare: 5000, rotunjita: false });
    }
  });

  it("banii se rotunjesc la leu, iar rotunjirea se spune", () => {
    expect(citesteSuma("7.500,50")).toEqual({ ok: true, valoare: 7501, rotunjita: true });
    expect(citesteSuma("4325,4")).toEqual({ ok: true, valoare: 4325, rotunjita: true });
    // Un singur punct urmat de una sau două cifre rămâne zecimal: 4,5 → 5 lei, spus pe față.
    expect(citesteSuma("4.5")).toEqual({ ok: true, valoare: 5, rotunjita: true });
  });

  it("formatele lipite din Excel sau de pe fluturaș: mii și bani deodată", () => {
    // O regulă de mii prea lacomă ar face din „4.500,00” 450.000 (Review Focus 1).
    for (const t of ["4.500,00", "4 500,00 lei", "4,500.00", "4500.00", "4 500,00 lei"]) {
      expect(citesteSuma(t), t).toEqual({ ok: true, valoare: 4500, rotunjita: false });
    }
  });

  it("ce nu se poate citi primește un mesaj, nu salariul minim", () => {
    for (const t of ["abc", "1e10", "Infinity", "NaN", "lei", "<script>", "1,2,3", "5000 de lei"]) {
      expect(citesteSuma(t).ok, t).toBe(false);
    }
    expect(citesteSuma("abc")).toEqual({
      ok: false,
      eroare: "Nu am înțeles suma „abc”. Scrie-o ca 5000 sau 5.000.",
    });
  });

  it("zero, negativ și peste plafon sunt refuzate, fiecare cu motivul lui", () => {
    const subUnLeu = { ok: false, eroare: "Suma trebuie să fie de cel puțin 1 leu." };
    expect(citesteSuma("0")).toEqual(subUnLeu);
    expect(citesteSuma("-5")).toEqual(subUnLeu);
    expect(citesteSuma("0,4")).toEqual(subUnLeu);
    const pestePlafon = { ok: false, eroare: "Calculatorul merge până la 500.000 de lei pe lună." };
    expect(citesteSuma("500.001")).toEqual(pestePlafon);
    expect(citesteSuma("1.234.567")).toEqual(pestePlafon);
    expect(citesteSuma("9".repeat(20))).toEqual(pestePlafon);
  });
});

describe("parametrii calculatorului de salariu", () => {
  it("implicit: salariul minim brut, fără persoane, funcție de bază", () => {
    expect(parametriCalculator(new URLSearchParams())).toEqual({
      text: "4325",
      suma: 4325,
      eroare: null,
      rotunjita: false,
      din: "brut",
      persoane: 0,
      functieDeBaza: true,
    });
  });

  it("un câmp golit (doar spații) înseamnă salariul minim, nu o eroare", () => {
    const p = parametriCalculator(new URLSearchParams({ suma: "   " }));
    expect([p.suma, p.eroare, p.text]).toEqual([4325, null, "4325"]);
  });

  it("mărginește persoanele și citește direcția și funcția de bază", () => {
    expect(parametriCalculator(q({ persoane: "17" })).persoane).toBe(4);
    expect(parametriCalculator(q({ persoane: "-1" })).persoane).toBe(0);
    expect(parametriCalculator(q({ din: "orice" })).din).toBe("brut");
    expect(parametriCalculator(q({ baza: "nu" })).functieDeBaza).toBe(false);
  });

  it("o sumă de neînțeles nu produce un rezultat pentru altă cifră", () => {
    const r = calculeazaDinParametri(q({ suma: "5000 de lei" }));
    expect(r.rezultat).toBeNull();
    expect(r.parametri.text).toBe("5000 de lei");
    expect(r.eroare).toBe("Nu am înțeles suma „5000 de lei”. Scrie-o ca 5000 sau 5.000.");
  });

  it("„4.500” brut dă netul pentru 4.500 de lei", () => {
    // CAS 4.500 × 25% = 1.125; CASS 450. Deducere fără persoane la minim + 175 lei:
    // pasul 4, 18% × 4.325 = 778,50 → 779. Impozit (4.500 − 1.125 − 450 − 779) × 10%
    // = 214,6 → 215. Net 4.500 − 1.125 − 450 − 215 = 2.710.
    const r = calculeazaDinParametri(q({ suma: "4.500" }));
    expect(r.rezultat?.brut).toBe(4500);
    expect(r.rezultat?.net).toBe(2710);
  });

  it("„3.000” net cere 5.036 de lei brut, nu 4 lei", () => {
    const r = calculeazaDinParametri(q({ suma: "3.000", din: "net" }));
    expect(r.rezultat?.brut).toBe(5036);
    expect(r.rezultat?.net).toBeGreaterThanOrEqual(3000);
  });

  it("semnalează un brut sub salariul minim, pe care calculul cu normă întreagă nu-l acoperă", () => {
    expect(calculeazaDinParametri(q({ suma: "3000" })).subMinim).toBe(true);
    expect(calculeazaDinParametri(q({ suma: "4325" })).subMinim).toBe(false);
  });

  it("calculul din net întoarce brutul care dă netul", () => {
    expect(calculeazaDinParametri(q({ suma: "2981", din: "net" })).rezultat?.brut).toBe(5000);
  });
});
