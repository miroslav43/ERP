import { describe, expect, it } from "vitest";

import {
  campuriLegaleLipsa,
  denumireCuForma,
  estePeActiuni,
  randuriBlocFirma,
  type AntetOrganizatie,
} from "./bloc-firma";

/** Un SRL complet, punctul de plecare al majorității cazurilor. */
const SRL: AntetOrganizatie = {
  denumire: "ACME PRODUCTION S.R.L.",
  formaJuridica: "S.R.L.",
  cui: "RO12345678",
  regCom: "J40/1234/2019",
  adresa: "Str. Fabricii 12, București, Sector 6",
  capitalSocial: 45_000,
  capitalVarsat: null,
  sistemDualist: false,
  telefon: "021 123 45 67",
  email: "office@acme.ro",
  pozitie: "antet",
  sigla: null,
};

describe("estePeActiuni", () => {
  // Câmpul `forma_juridica` e text liber de 40 de caractere în profilul firmei,
  // deci aceeași societate pe acțiuni sosește scrisă în patru feluri.
  it.each(["SA", "S.A.", "s.a.", " SA ", "societate pe acțiuni", "SCA"])(
    "recunoaște „%s” ca societate pe acțiuni",
    (forma) => {
      expect(estePeActiuni(forma)).toBe(true);
    },
  );

  it.each(["SRL", "S.R.L.", "PFA", "II", "asociație", null])("nu confundă „%s”", (forma) => {
    expect(estePeActiuni(forma)).toBe(false);
  });
});

describe("denumireCuForma", () => {
  it("adaugă forma juridică atunci când denumirea nu o conține", () => {
    expect(denumireCuForma("ACME PRODUCTION", "S.R.L.")).toBe("ACME PRODUCTION S.R.L.");
  });

  // Capcana pentru care există funcția: firmele își scriu `legal_name` întreg,
  // iar o concatenare oarbă ar tipări forma de două ori pe contract.
  it("nu repetă forma juridică deja prezentă în denumire", () => {
    expect(denumireCuForma("ACME PRODUCTION S.R.L.", "S.R.L.")).toBe("ACME PRODUCTION S.R.L.");
  });

  it("prinde repetarea și când punctuația diferă", () => {
    expect(denumireCuForma("ACME PRODUCTION SRL", "S.R.L.")).toBe("ACME PRODUCTION SRL");
    expect(denumireCuForma("ACME PRODUCTION S.R.L.", "SRL")).toBe("ACME PRODUCTION S.R.L.");
  });

  it("lasă denumirea neatinsă fără formă juridică", () => {
    expect(denumireCuForma("ACME PRODUCTION", null)).toBe("ACME PRODUCTION");
    expect(denumireCuForma("ACME PRODUCTION", "   ")).toBe("ACME PRODUCTION");
  });
});

describe("randuriBlocFirma", () => {
  it("compune cele trei rânduri ale unui SRL complet", () => {
    expect(randuriBlocFirma(SRL)).toEqual([
      "ACME PRODUCTION S.R.L.",
      "CUI RO12345678 · Reg. com. J40/1234/2019 · capital social 45.000,00 lei",
      "Str. Fabricii 12, București, Sector 6 · tel. 021 123 45 67 · office@acme.ro",
    ]);
  });

  // Art. 74 alin. (3): pentru SRL legea cere UN capital, pentru SA două.
  it("scrie un singur capital la SRL, chiar dacă vărsatul e completat din greșeală", () => {
    const randuri = randuriBlocFirma({ ...SRL, capitalVarsat: 20_000 });
    expect(randuri[1]).toContain("capital social 45.000,00 lei");
    expect(randuri[1]).not.toContain("vărsat");
  });

  it("scrie subscris și vărsat la societatea pe acțiuni", () => {
    const randuri = randuriBlocFirma({
      ...SRL,
      denumire: "ACME INDUSTRIES S.A.",
      formaJuridica: "S.A.",
      capitalSocial: 90_000,
      capitalVarsat: 45_000,
    });
    expect(randuri[1]).toBe(
      "CUI RO12345678 · Reg. com. J40/1234/2019 · capital social subscris 90.000,00 lei, vărsat 45.000,00 lei",
    );
  });

  it("etichetează capitalul drept subscris la SA chiar dacă vărsatul lipsește", () => {
    const randuri = randuriBlocFirma({
      ...SRL,
      formaJuridica: "S.A.",
      capitalVarsat: null,
    });
    expect(randuri[1]).toContain("capital social subscris 45.000,00 lei");
  });

  // Art. 74 alin. (2).
  it("adaugă mențiunea dualistă doar când e cerută", () => {
    expect(randuriBlocFirma(SRL)[1]).not.toContain("dualist");
    expect(randuriBlocFirma({ ...SRL, sistemDualist: true })[1]).toContain(
      "societate administrată în sistem dualist",
    );
  });

  it("nu întoarce rânduri goale când firma n-are date de contact", () => {
    const randuri = randuriBlocFirma({
      ...SRL,
      adresa: null,
      telefon: null,
      email: "  ",
    });
    expect(randuri).toHaveLength(2);
    expect(randuri.every((rand) => rand.trim().length > 0)).toBe(true);
  });

  it("se reduce la denumire când profilul firmei e gol", () => {
    expect(
      randuriBlocFirma({
        denumire: "Firma Mea",
        formaJuridica: null,
        cui: null,
        regCom: null,
        adresa: null,
        capitalSocial: null,
        capitalVarsat: null,
        sistemDualist: false,
        telefon: null,
        email: null,
        pozitie: "subsol",
        sigla: null,
      }),
    ).toEqual(["Firma Mea"]);
  });
});

describe("campuriLegaleLipsa", () => {
  it("nu reclamă nimic pentru un SRL complet", () => {
    expect(campuriLegaleLipsa(SRL)).toEqual([]);
  });

  it("cere capitalul vărsat doar la societățile pe acțiuni", () => {
    expect(campuriLegaleLipsa({ ...SRL, formaJuridica: "S.A." })).toEqual([
      "capitalul social vărsat",
    ]);
    expect(campuriLegaleLipsa({ ...SRL, capitalVarsat: null })).toEqual([]);
  });

  it("enumeră fiecare câmp cerut de art. 74 care lipsește", () => {
    expect(
      campuriLegaleLipsa({
        ...SRL,
        formaJuridica: null,
        cui: null,
        regCom: null,
        adresa: null,
        capitalSocial: null,
      }),
    ).toEqual([
      "forma juridică",
      "codul unic de înregistrare",
      "numărul din registrul comerțului",
      "sediul social",
      "capitalul social",
    ]);
  });
});
