// src/lib/text/diacritice.test.ts
import { describe, expect, it } from "vitest";

import { cheieCautare, faraDiacritice } from "./diacritice";

describe("faraDiacritice", () => {
  it("scoate toate cele cinci litere românești cu semn", () => {
    expect(faraDiacritice("Șerban Ioniță Ăsta Împreună")).toBe("Serban Ionita Asta Impreuna");
  });

  it("nu schimbă litera mare în mică — asta e treaba lui `cheieCautare`", () => {
    expect(faraDiacritice("ȘERBAN")).toBe("SERBAN");
  });

  it("virgula dedesubt ȘI sedila cad la fel", () => {
    // Jumătate din numele clienților vin din Excel-uri făcute înainte ca
    // Windows să scrie virgula dedesubt. „Ţucă” și „Țucă” trebuie să se
    // găsească unul pe altul.
    expect(faraDiacritice("Ţucă")).toBe(faraDiacritice("Țucă"));
    expect(faraDiacritice("Ştefan")).toBe(faraDiacritice("Ștefan"));
  });

  it("nu atinge literele fără semn și nici ß-ul german", () => {
    expect(faraDiacritice("Groß & Co. 2026")).toBe("Groß & Co. 2026");
  });

  it("textul gol rămâne gol", () => {
    expect(faraDiacritice("")).toBe("");
  });
});

describe("cheieCautare", () => {
  it("«stanescu» tastat găsește «Stănescu» scris", () => {
    expect(cheieCautare("Stănescu")).toBe("stanescu");
    expect(cheieCautare("stanescu")).toBe("stanescu");
  });

  it("cele trei regexuri din depozit dădeau același rezultat pe română", () => {
    // Motivul pentru care unificarea NU schimbă niciun comportament. Verificat
    // aici, ca afirmația din docblock să nu îmbătrânească tăcut.
    const cuvinte = ["Șerban", "Stănescu", "Ţucă", "Ioniță", "Ăsta", "Împreună"];
    const cuMarcaje = (t: string): string =>
      t
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .toLowerCase();
    const cuProprietate = (t: string): string =>
      t
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
    const cuBloc = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const c of cuvinte) {
      expect(cheieCautare(c)).toBe(cuMarcaje(c));
      expect(cheieCautare(c)).toBe(cuProprietate(c));
      expect(cheieCautare(c)).toBe(cuBloc(c));
    }
  });
});
