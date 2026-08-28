// src/domain/reges/validare.test.ts
import { describe, expect, it } from "vitest";

import type { ContractIntern, SalariatIntern } from "./mapare";
import {
  verificaContract,
  verificaIncetare,
  verificaSalariat,
  verificaSuspendare,
} from "./validare";

function salariat(s: Partial<SalariatIntern> = {}): SalariatIntern {
  return {
    cnp: "1900101070016",
    nume: "Popescu",
    prenume: "Ion",
    adresa: "Strada Morii 12",
    taraDomiciliu: "România",
    tipActIdentitate: "CarteIdentitate",
    nationalitate: "Română",
    dataNasterii: "1990-01-01",
    localitate: "Cluj-Napoca",
    regesSalariatId: null,
    ...s,
  };
}

function contract(c: Partial<ContractIntern> = {}): ContractIntern {
  return {
    numar: "CIM-1",
    dataContract: "2026-03-10",
    valabilDeLa: "2026-03-14",
    valabilPana: null,
    durataDeterminata: false,
    tipContract: "ContractIndividualMunca",
    tipNorma: "NormaIntreaga",
    normaTimpMunca: "NormaIntreaga840",
    repartizare: "OreDeZi",
    salariuBaza: 4000,
    moneda: "RON",
    codCor: "251401",
    versiuneCor: null,
    regesContractId: null,
    ...c,
  };
}

const campuri = (probleme: readonly { camp: string }[]) => probleme.map((p) => p.camp);

describe("salariat", () => {
  it("nu are ce reproșa unei fișe complete", () => {
    expect(verificaSalariat(salariat())).toEqual([]);
  });

  it("prinde CNP-ul lipsă — cazul care blochează orice transmitere", () => {
    expect(campuri(verificaSalariat(salariat({ cnp: "" })))).toContain("cnp");
  });

  it("prinde un CNP cu formă greșită", () => {
    expect(campuri(verificaSalariat(salariat({ cnp: "0900101070016" })))).toContain("cnp");
    expect(campuri(verificaSalariat(salariat({ cnp: "190010107001" })))).toContain("cnp");
  });

  it("cere adresa și țara — obligatorii în XSD, opționale în modelul nostru", () => {
    const probleme = campuri(verificaSalariat(salariat({ adresa: "  ", taraDomiciliu: "" })));
    expect(probleme).toContain("adresa");
    expect(probleme).toContain("taraDomiciliu");
  });

  it("refuză un tip de act care nu e din enum-ul REGES", () => {
    const gresit = salariat({ tipActIdentitate: "CI" as never });
    expect(campuri(verificaSalariat(gresit))).toContain("tipActIdentitate");
  });
});

describe("contract", () => {
  it("nu are ce reproșa unui contract complet", () => {
    expect(verificaContract(contract())).toEqual([]);
  });

  it("cere data de sfârșit pentru durată determinată", () => {
    expect(campuri(verificaContract(contract({ durataDeterminata: true })))).toContain(
      "valabilPana",
    );
  });

  it("refuză data de sfârșit pe durată nedeterminată", () => {
    expect(campuri(verificaContract(contract({ valabilPana: "2026-12-31" })))).toContain(
      "valabilPana",
    );
  });

  it("prinde intervalul inversat", () => {
    const probleme = verificaContract(
      contract({ durataDeterminata: true, valabilDeLa: "2026-06-01", valabilPana: "2026-01-01" }),
    );
    expect(probleme.some((p) => p.mesaj.includes("înaintea"))).toBe(true);
  });

  it("cere cod COR de șase cifre — fără el registrul respinge contractul", () => {
    expect(campuri(verificaContract(contract({ codCor: "" })))).toContain("codCor");
    expect(campuri(verificaContract(contract({ codCor: "2514" })))).toContain("codCor");
  });

  it("refuză salariul zero sau negativ", () => {
    expect(campuri(verificaContract(contract({ salariuBaza: 0 })))).toContain("salariuBaza");
    expect(campuri(verificaContract(contract({ salariuBaza: -1 })))).toContain("salariuBaza");
  });

  it("acceptă moneda scrisă cu litere mici", () => {
    expect(campuri(verificaContract(contract({ moneda: "ron" })))).not.toContain("moneda");
    expect(campuri(verificaContract(contract({ moneda: "LEI" })))).not.toContain("moneda");
    expect(campuri(verificaContract(contract({ moneda: "RONN" })))).toContain("moneda");
  });
});

describe("acțiuni", () => {
  it("încetarea cere temei legal", () => {
    expect(campuri(verificaIncetare({ data: "2026-09-20", temeiLegal: null }))).toContain(
      "temeiIncetare",
    );
    expect(verificaIncetare({ data: "2026-09-20", temeiLegal: "Art55LitB" })).toEqual([]);
  });

  it("suspendarea cere temei și interval coerent", () => {
    expect(
      verificaSuspendare({
        dataInceput: "2026-09-20",
        dataSfarsit: "2026-09-27",
        temeiLegal: "Art54",
      }),
    ).toEqual([]);

    const inversat = verificaSuspendare({
      dataInceput: "2026-09-27",
      dataSfarsit: "2026-09-20",
      temeiLegal: "Art54",
    });
    expect(inversat.some((p) => p.mesaj.includes("înainte să înceapă"))).toBe(true);
  });

  it("suspendarea fără termen e validă", () => {
    expect(
      verificaSuspendare({ dataInceput: "2026-09-20", dataSfarsit: null, temeiLegal: "Art54" }),
    ).toEqual([]);
  });
});
