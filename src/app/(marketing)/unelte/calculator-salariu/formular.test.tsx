import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Formular } from "./formular";
import { parametriCalculator } from "./parametri";

const randeaza = (o: Record<string, string>) => {
  const p = parametriCalculator(new URLSearchParams(o), "2026-10-08");
  return render(<Formular p={p} />).container;
};

describe("formularul calculatorului", () => {
  it("e un formular GET care se întoarce la rezultat", () => {
    const form = randeaza({}).querySelector("form");
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("#rezultat");
  });

  it("pune înapoi valorile din adresă, inclusiv un text necitibil, marcat invalid", () => {
    const c = randeaza({ suma: "abc", din: "net", persoane: "2", baza: "nu" });
    const suma = c.querySelector<HTMLInputElement>('input[name="suma"]');
    expect(suma?.value).toBe("abc");
    expect(suma?.getAttribute("aria-invalid")).toBe("true");
    expect(suma?.getAttribute("aria-describedby")).toBe("eroare-suma");
    expect(c.querySelector<HTMLSelectElement>('select[name="din"]')?.value).toBe("net");
    expect(c.querySelector<HTMLSelectElement>('select[name="persoane"]')?.value).toBe("2");
    expect(c.querySelector<HTMLSelectElement>('select[name="baza"]')?.value).toBe("nu");
  });

  it("o sumă bună nu e marcată invalidă", () => {
    const suma = randeaza({ suma: "5.000" }).querySelector('input[name="suma"]');
    expect(suma?.getAttribute("aria-invalid")).toBe("false");
    expect(suma?.hasAttribute("aria-describedby")).toBe(false);
  });

  it("perioada aleasă rămâne aleasă", () => {
    const c = randeaza({ perioada: "2026-1" });
    expect(c.querySelector<HTMLSelectElement>('select[name="perioada"]')?.value).toBe("2026-1");
    expect(
      [...c.querySelectorAll('select[name="perioada"] option')].map((o) => o.textContent),
    ).toEqual(["ianuarie–iunie 2026", "iulie–decembrie 2026"]);
  });

  it("opțiunile suplimentare stau într-un <details>, deschis doar când una e aleasă", () => {
    expect(randeaza({}).querySelector("details")?.hasAttribute("open")).toBe(false);
    const c = randeaza({ sub26: "da", copii: "3" });
    expect(c.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(c.querySelector<HTMLInputElement>('input[name="sub26"]')?.checked).toBe(true);
    expect(c.querySelector<HTMLInputElement>('input[name="sub26"]')?.value).toBe("da");
    expect(c.querySelector<HTMLSelectElement>('select[name="copii"]')?.value).toBe("3");
  });

  it("tichetele: valoarea scrisă rămâne în câmp, numărul în listă, iar <details> se deschide", () => {
    const c = randeaza({ tichet: "40,18", tichete: "21" });
    expect(c.querySelector<HTMLInputElement>('input[name="tichet"]')?.value).toBe("40,18");
    expect(c.querySelector<HTMLSelectElement>('select[name="tichete"]')?.value).toBe("21");
    expect(c.querySelectorAll('select[name="tichete"] option')).toHaveLength(24);
    expect(c.querySelector("details")?.hasAttribute("open")).toBe(true);
  });

  it("eroarea de pe tichet marchează câmpul tichetului, nu suma", () => {
    const c = randeaza({ suma: "5000", tichet: "abc", tichete: "20" });
    expect(c.querySelector('input[name="tichet"]')?.getAttribute("aria-invalid")).toBe("true");
    expect(c.querySelector('input[name="suma"]')?.getAttribute("aria-invalid")).toBe("false");
  });

  it("norma și excepția de la contribuția minimă rămân alese și deschid <details>", () => {
    const c = randeaza({ ore: "4", minim: "nu" });
    expect(c.querySelector<HTMLSelectElement>('select[name="ore"]')?.value).toBe("4");
    expect(c.querySelector<HTMLInputElement>('input[name="minim"]')?.checked).toBe(true);
    expect(c.querySelector<HTMLInputElement>('input[name="minim"]')?.value).toBe("nu");
    expect(c.querySelector("details")?.hasAttribute("open")).toBe(true);
  });

  it("bifa de handicap rămâne bifată și deschide <details>", () => {
    const c = randeaza({ handicap: "da" });
    expect(c.querySelector<HTMLInputElement>('input[name="handicap"]')?.checked).toBe(true);
    expect(c.querySelector("details")?.hasAttribute("open")).toBe(true);
  });
});
