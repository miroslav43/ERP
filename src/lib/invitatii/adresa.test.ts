// src/lib/invitatii/adresa.test.ts

import { describe, expect, it } from "vitest";

import {
  adresaRealaDinFisa,
  adresaSintetica,
  alegeAdresaDeInvitatie,
  esteAdresaSintetica,
} from "./adresa";

describe("adresaSintetica", () => {
  it("compune adresa din marcă și slug", () => {
    expect(adresaSintetica("0042", "hala-nord")).toBe("marca-0042@hala-nord.intern");
  });

  it("curăță marca de tot ce n-are ce căuta într-o adresă", () => {
    expect(adresaSintetica("A 12/B", "firma")).toBe("marca-a-12-b@firma.intern");
  });

  it("nu produce niciodată o adresă cu partea locală goală", () => {
    // O marcă din caractere care dispar toate la curățare ar da `marca-@...`,
    // respinsă de CHECK-ul de format din bază.
    expect(adresaSintetica("///", "firma")).toBe("marca-fara-marca@firma.intern");
  });

  it("trece verificarea de format cerută de bază", () => {
    const tipar = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u;
    for (const marca of ["0042", "A 12/B", "///", "ĂÎȘȚÂ"]) {
      expect(adresaSintetica(marca, "firma")).toMatch(tipar);
    }
  });
});

describe("esteAdresaSintetica", () => {
  it("recunoaște adresele fabricate de noi", () => {
    expect(esteAdresaSintetica("marca-1@firma.intern")).toBe(true);
    expect(esteAdresaSintetica("ion@gmail.com")).toBe(false);
  });
});

describe("alegeAdresaDeInvitatie", () => {
  const BAZA = { marca: "0042", email_personal: null, email_serviciu: null };

  it("preferă adresa personală", () => {
    expect(
      alegeAdresaDeInvitatie(
        { ...BAZA, email_personal: "Ion@Gmail.com", email_serviciu: "ion@firma.ro" },
        "firma",
      ),
    ).toEqual({ adresa: "ion@gmail.com", fel: "personala", seTrimiteEmail: true });
  });

  it("cade pe adresa de serviciu când lipsește cea personală", () => {
    expect(alegeAdresaDeInvitatie({ ...BAZA, email_serviciu: "ion@firma.ro" }, "firma")).toEqual({
      adresa: "ion@firma.ro",
      fel: "serviciu",
      seTrimiteEmail: true,
    });
  });

  it("fabrică o adresă când nu există niciuna, și NU trimite e-mail", () => {
    expect(alegeAdresaDeInvitatie(BAZA, "hala-nord")).toEqual({
      adresa: "marca-0042@hala-nord.intern",
      fel: "sintetica",
      seTrimiteEmail: false,
    });
  });

  it("tratează șirul gol ca pe o adresă lipsă, nu ca pe una validă", () => {
    expect(alegeAdresaDeInvitatie({ ...BAZA, email_personal: "   " }, "firma").fel).toBe(
      "sintetica",
    );
  });
});

describe("adresaRealaDinFisa", () => {
  it("întoarce null când nu există nicio adresă — NU fabrică una", () => {
    // Diferența față de `alegeAdresaDeInvitatie` e chiar rostul funcției:
    // apelantul de la înrolare trebuie să afle că nu se poate trimite nimic,
    // nu să primească o adresă sintetică pe care s-o ardă pe un loc de licență.
    expect(adresaRealaDinFisa({ email_personal: null, email_serviciu: null })).toBeNull();
    expect(adresaRealaDinFisa({ email_personal: "  ", email_serviciu: "" })).toBeNull();
  });

  it("preferă personala, apoi cea de serviciu, normalizate", () => {
    expect(
      adresaRealaDinFisa({ email_personal: "IoN@Gmail.com", email_serviciu: "x@firma.ro" }),
    ).toBe("ion@gmail.com");
    expect(adresaRealaDinFisa({ email_personal: null, email_serviciu: "X@Firma.ro" })).toBe(
      "x@firma.ro",
    );
  });
});
