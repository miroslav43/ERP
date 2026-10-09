import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Formular } from "./formular";
import { parametriCalculator } from "./parametri";

const randeaza = (o: Record<string, string>) => {
  const p = parametriCalculator(new URLSearchParams(o));
  return render(<Formular p={p} eroare={p.eroare} />).container;
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
});
