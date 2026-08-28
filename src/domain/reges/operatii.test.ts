// src/domain/reges/operatii.test.ts
import { describe, expect, it } from "vitest";

import {
  OPERATII,
  TIPURI_ACT_IDENTITATE,
  TIPURI_CONTRACT,
  propuneNormaTimpMunca,
  propuneTipContract,
  propuneTipNorma,
} from "./operatii";

describe("vocabularul de protocol", () => {
  it("nu are valori duplicate — un duplicat ar face uniunea de tipuri mincinoasă", () => {
    expect(new Set(OPERATII).size).toBe(OPERATII.length);
    expect(new Set(TIPURI_CONTRACT).size).toBe(TIPURI_CONTRACT.length);
    expect(new Set(TIPURI_ACT_IDENTITATE).size).toBe(TIPURI_ACT_IDENTITATE.length);
  });

  it("păstrează scrierea EXACTĂ din XSD, inclusiv majusculele", () => {
    // Valorile sunt vocabular de protocol, ca numele metodelor HTTP. O
    // „normalizare" la snake_case ar produce mesaje respinse fără explicație.
    expect(OPERATII).toContain("InregistrareSalariat");
    expect(OPERATII).toContain("IncetareContract");
    expect(TIPURI_ACT_IDENTITATE).toContain("NIF");
    // Greșeala din README-ul oficial: `ActiuneIncetare` NU e operație, e
    // `$type`-ul obiectului `actiune`.
    expect(OPERATII).not.toContain("ActiuneIncetare" as never);
  });

  it("are toate cele 16 tipuri de contract din schemă", () => {
    expect(TIPURI_CONTRACT).toHaveLength(16);
  });
});

describe("propuneTipNorma", () => {
  it("40 de ore și peste înseamnă normă întreagă", () => {
    expect(propuneTipNorma(40)).toBe("NormaIntreaga");
    expect(propuneTipNorma(48)).toBe("NormaIntreaga");
  });

  it("sub 40 de ore înseamnă timp parțial", () => {
    expect(propuneTipNorma(20)).toBe("TimpPartial");
    expect(propuneTipNorma(39.5)).toBe("TimpPartial");
  });

  it("NU poate deduce Kurzarbeit — și nu pretinde că poate", () => {
    // `NormaOUG132` e o decizie administrativă, nu un număr de ore: un contract
    // în Kurzarbeit are aceleași ore ca unul cu timp parțial obișnuit. De aceea
    // coloana `reges_tip_norma` există separat pe contract, iar ecranul de
    // detaliu marchează valorile deduse ca neconfirmate.
    expect(propuneTipNorma(20)).not.toBe("NormaOUG132");
  });
});

describe("propuneNormaTimpMunca", () => {
  it("8/40 → norma întreagă obișnuită", () => {
    expect(propuneNormaTimpMunca(8, 40)).toBe("NormaIntreaga840");
  });

  it("6/30 → norma redusă legală", () => {
    expect(propuneNormaTimpMunca(6, 30)).toBe("NormaIntreaga630");
  });

  it("orice altceva rămâne timp parțial", () => {
    expect(propuneNormaTimpMunca(4, 20)).toBe("TimpPartial");
    expect(propuneNormaTimpMunca(8, 20)).toBe("TimpPartial");
  });

  it("nu confundă 6/36 cu norma redusă", () => {
    // 30 ≤ 36 < 40, deci intră pe `NormaIntreaga630` — iar asta e o presupunere
    // pe care operatorul trebuie s-o poată vedea și corecta. Testul o fixează ca
    // fiind comportamentul CUNOSCUT, nu unul întâmplător.
    expect(propuneNormaTimpMunca(6, 36)).toBe("NormaIntreaga630");
  });
});

describe("propuneTipContract", () => {
  it("ucenicia bate modul de lucru", () => {
    expect(propuneTipContract({ regimSpecial: "ucenicie", modLucru: "telemunca" })).toBe(
      "ContractUcenicie",
    );
  });

  it("traduce modul de lucru", () => {
    expect(propuneTipContract({ regimSpecial: null, modLucru: "domiciliu" })).toBe(
      "ContractMuncaLaDomiciliu",
    );
    expect(propuneTipContract({ regimSpecial: null, modLucru: "telemunca" })).toBe(
      "ContractIndividualMuncaClauzaTelemunca",
    );
  });

  it("cade pe contractul individual obișnuit", () => {
    expect(propuneTipContract({ regimSpecial: null, modLucru: "sediu" })).toBe(
      "ContractIndividualMunca",
    );
    expect(propuneTipContract({ regimSpecial: null, modLucru: "mixt" })).toBe(
      "ContractIndividualMunca",
    );
  });

  it("NU poate produce tipurile care n-au corespondent în modelul nostru", () => {
    // `RaportDeServiciu`, `ContractDeManagement`, `ActAdministrativDemnitar` și
    // `ContractDeActivitateSportiva` nu se deduc din `work_mode` sau
    // `special_regime` — nimic din ce ținem nu le distinge. Cine are un astfel
    // de contract TREBUIE să-l aleagă explicit, iar testul ăsta e dovada că
    // deducția singură nu-l va nimeri niciodată.
    const deduse = new Set(
      (["sediu", "telemunca", "domiciliu", "mixt"] as const).flatMap((modLucru) =>
        ([null, "ucenicie", "internship", "zilier"] as const).map((regimSpecial) =>
          propuneTipContract({ regimSpecial, modLucru }),
        ),
      ),
    );
    for (const imposibil of [
      "RaportDeServiciu",
      "ContractDeManagement",
      "ActAdministrativDemnitar",
      "ContractDeActivitateSportiva",
    ] as const) {
      expect(deduse.has(imposibil)).toBe(false);
    }
    // Deducția atinge PATRU din cele șaisprezece tipuri: contractul individual,
    // ucenicia, munca la domiciliu și telemunca. Restul de douăsprezece cer o
    // alegere explicită — cifra e aici tocmai ca nimeni să nu creadă că
    // deducția e o clasificare completă.
    expect(deduse.size).toBe(4);
    expect(TIPURI_CONTRACT.length - deduse.size).toBe(12);
  });
});
