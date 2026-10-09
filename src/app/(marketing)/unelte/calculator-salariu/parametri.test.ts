import { describe, expect, it } from "vitest";

import { calculeazaDinParametri, citesteSuma, parametriCalculator } from "./parametri";

const q = (o: Record<string, string>) => new URLSearchParams(o);
const AZI = "2026-10-08";

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
  it("implicit: salariul minim al perioadei de azi, fără persoane, funcție de bază", () => {
    expect(parametriCalculator(new URLSearchParams(), AZI)).toEqual({
      text: "4325",
      suma: 4325,
      eroare: null,
      rotunjita: false,
      din: "brut",
      optiuni: { perioada: "2026-2", persoane: 0, functieDeBaza: true },
    });
  });

  it("în martie 2026 implicitul e ianuarie–iunie, cu minimul de 4.050", () => {
    const p = parametriCalculator(new URLSearchParams(), "2026-03-15");
    expect(p.optiuni.perioada).toBe("2026-1");
    expect(p.suma).toBe(4050);
  });

  it("perioada din adresă bate ziua de azi; una necunoscută e ignorată", () => {
    expect(parametriCalculator(q({ perioada: "2026-1" }), AZI).optiuni.perioada).toBe("2026-1");
    expect(parametriCalculator(q({ perioada: "2025-2" }), AZI).optiuni.perioada).toBe("2026-2");
  });

  it("un câmp golit (doar spații) înseamnă salariul minim al perioadei, nu o eroare", () => {
    const p = parametriCalculator(new URLSearchParams({ suma: "   " }), AZI);
    expect([p.suma, p.eroare, p.text]).toEqual([4325, null, "4325"]);
  });

  it("4.325 în ianuarie–iunie e un salariu peste minim: fără sumă scutită, net 2.599", () => {
    // Review Focus 3: suma rămasă în câmp după schimbarea perioadei.
    // CAS 1.081,25 → 1.081; CASS 432,50 → 433; deducere minim + 275, pasul 6, 17% × 4.050 = 688,50 → 689;
    // impozit (4.325 − 1.081,25 − 432,5 − 689) × 10% = 212,225 → 212; net 4.325 − 1.081 − 433 − 212 = 2.599.
    const r = calculeazaDinParametri(q({ suma: "4325", perioada: "2026-1" }), AZI);
    expect(r.rezultat).toMatchObject({ sumaNeimpozabila: 0, net: 2599 });
    expect(r.subMinim).toBe(false);
  });

  it("mărginește persoanele și citește direcția și funcția de bază", () => {
    expect(parametriCalculator(q({ persoane: "17" }), AZI).optiuni.persoane).toBe(4);
    expect(parametriCalculator(q({ persoane: "-1" }), AZI).optiuni.persoane).toBe(0);
    expect(parametriCalculator(q({ din: "orice" }), AZI).din).toBe("brut");
    expect(parametriCalculator(q({ baza: "nu" }), AZI).optiuni.functieDeBaza).toBe(false);
  });

  it("o sumă de neînțeles nu produce un rezultat pentru altă cifră", () => {
    const r = calculeazaDinParametri(q({ suma: "5000 de lei" }), AZI);
    expect(r.rezultat).toBeNull();
    expect(r.parametri.text).toBe("5000 de lei");
    expect(r.eroare).toBe("Nu am înțeles suma „5000 de lei”. Scrie-o ca 5000 sau 5.000.");
  });

  it("„4.500” brut dă netul pentru 4.500 de lei", () => {
    // CAS 1.125; CASS 450; deducere pasul 4, 18% × 4.325 = 778,50 → 779;
    // impozit (4.500 − 1.125 − 450 − 779) × 10% = 214,6 → 215; net 2.710.
    const r = calculeazaDinParametri(q({ suma: "4.500" }), AZI);
    expect(r.rezultat?.brut).toBe(4500);
    expect(r.rezultat?.net).toBe(2710);
  });

  it("„3.000” net cere 5.036 de lei brut, nu 4 lei", () => {
    const r = calculeazaDinParametri(q({ suma: "3.000", din: "net" }), AZI);
    expect(r.rezultat?.brut).toBe(5036);
  });

  it("semnalează un brut sub salariul minim al perioadei alese", () => {
    expect(calculeazaDinParametri(q({ suma: "3000" }), AZI).subMinim).toBe(true);
    expect(calculeazaDinParametri(q({ suma: "4325" }), AZI).subMinim).toBe(false);
    expect(calculeazaDinParametri(q({ suma: "4050" }), AZI).subMinim).toBe(true);
    const ianuarie = calculeazaDinParametri(q({ suma: "4050", perioada: "2026-1" }), AZI);
    expect(ianuarie.subMinim).toBe(false);
    expect(ianuarie.minimLegal).toBe(4050);
    expect(ianuarie.rezultat?.net).toBe(2574);
  });

  it("calculul din net întoarce brutul care dă netul", () => {
    expect(calculeazaDinParametri(q({ suma: "2981", din: "net" }), AZI).rezultat?.brut).toBe(5000);
  });

  it("după 31 decembrie 2026 pagina știe că valorile au expirat", () => {
    expect(calculeazaDinParametri(new URLSearchParams(), "2027-01-04").expirat).toBe(true);
    expect(calculeazaDinParametri(new URLSearchParams(), AZI).expirat).toBe(false);
  });
});
