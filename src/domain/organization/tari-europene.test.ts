// src/domain/organization/tari-europene.test.ts
import { describe, expect, it } from "vitest";
import { CODURI_TARI_VALIDE, TARA_IMPLICITA, TARI_EUROPENE } from "./tari-europene";
import { filtreazaOptiuni, rezolvaOptiune } from "@/components/forms/combobox-cod";

const GOL: ReadonlySet<string> = new Set();
const TOATE = TARI_EUROPENE.length;

describe("nomenclatorul de țări", () => {
  it("toate codurile respectă constrângerea din baza de date (^[A-Z]{2}$)", () => {
    // `organizations.tara` are exact acest check; un cod care nu-l respectă ar
    // trece de formular și ar pica abia la INSERT, cu 23514.
    for (const t of TARI_EUROPENE) {
      expect(t.cod, `codul pentru ${t.denumire}`).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("nu are coduri duplicate", () => {
    expect(CODURI_TARI_VALIDE.size).toBe(TOATE);
  });

  it("nu are denumiri duplicate", () => {
    expect(new Set(TARI_EUROPENE.map((t) => t.denumire)).size).toBe(TOATE);
  });

  it("România e prima și e țara implicită", () => {
    expect(TARI_EUROPENE[0]?.cod).toBe("RO");
    expect(TARA_IMPLICITA).toBe("RO");
    expect(CODURI_TARI_VALIDE.has(TARA_IMPLICITA)).toBe(true);
  });

  it("conține vecinii și partenerii uzuali, inclusiv din afara UE", () => {
    for (const cod of ["HU", "BG", "MD", "UA", "RS", "GB", "CH", "NO", "TR"]) {
      expect(CODURI_TARI_VALIDE.has(cod), cod).toBe(true);
    }
  });
});

describe("căutarea în lista de țări", () => {
  it("fără interogare, întoarce toată lista", () => {
    expect(filtreazaOptiuni(TARI_EUROPENE, "", GOL, TOATE).length).toBe(TOATE);
  });

  it("filtrează după cod, indiferent de majuscule", () => {
    const rezultat = filtreazaOptiuni(TARI_EUROPENE, "ro", GOL, TOATE);
    expect(rezultat.some((t) => t.cod === "RO")).toBe(true);
  });

  it("filtrează după denumire, fără diacritice", () => {
    const rezultat = filtreazaOptiuni(TARI_EUROPENE, "romania", GOL, TOATE);
    expect(rezultat.map((t) => t.cod)).toContain("RO");
  });

  it("acceptă codul scris direct, cu orice majuscule", () => {
    expect(rezolvaOptiune(TARI_EUROPENE, "RO", GOL, TOATE)?.cod).toBe("RO");
    expect(rezolvaOptiune(TARI_EUROPENE, "hu", GOL, TOATE)?.cod).toBe("HU");
    expect(rezolvaOptiune(TARI_EUROPENE, "  de  ", GOL, TOATE)?.cod).toBe("DE");
  });

  it("acceptă eticheta completă rămasă în casetă", () => {
    expect(rezolvaOptiune(TARI_EUROPENE, "RO — România", GOL, TOATE)?.cod).toBe("RO");
  });

  it("acceptă denumirea scrisă complet, fără diacritice", () => {
    expect(rezolvaOptiune(TARI_EUROPENE, "romania", GOL, TOATE)?.cod).toBe("RO");
    expect(rezolvaOptiune(TARI_EUROPENE, "Ungaria", GOL, TOATE)?.cod).toBe("HU");
  });

  it("respinge o țară inexistentă sau un text ambiguu", () => {
    expect(rezolvaOptiune(TARI_EUROPENE, "ZZ", GOL, TOATE)).toBeUndefined();
    expect(rezolvaOptiune(TARI_EUROPENE, "Japonia", GOL, TOATE)).toBeUndefined();
    expect(rezolvaOptiune(TARI_EUROPENE, "", GOL, TOATE)).toBeUndefined();
  });
});
