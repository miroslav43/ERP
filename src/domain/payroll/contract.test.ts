// src/domain/payroll/contract.test.ts
import { describe, expect, it } from "vitest";

import { contractEfectiv, type ContractCandidat } from "./contract";

const PRIMA = "2026-08-01";
const ULTIMA = "2026-08-31";

function contract(peste: Partial<ContractCandidat> & { id: string }): ContractCandidat {
  return {
    esteActAditional: false,
    parentContractId: null,
    status: "activ",
    valabilDeLa: "2024-01-15",
    valabilPana: null,
    dataContract: "2024-01-10",
    salariuBaza: 5000,
    normaOreZi: 8,
    normaOreSaptamana: 40,
    ...peste,
  };
}

const BAZA = contract({ id: "baza" });

const act = (peste: Partial<ContractCandidat> & { id: string }): ContractCandidat =>
  contract({ esteActAditional: true, parentContractId: "baza", ...peste });

describe("contractEfectiv — defectul reparat: actele adiționale erau ignorate", () => {
  it("o mărire intrată în vigoare înaintea lunii se aplică", () => {
    const rezultat = contractEfectiv(
      [
        BAZA,
        act({
          id: "marire",
          valabilDeLa: "2026-05-01",
          dataContract: "2026-04-20",
          salariuBaza: 7000,
        }),
      ],
      PRIMA,
      ULTIMA,
    );
    expect(rezultat?.salariuBaza).toBe(7000);
    expect(rezultat?.contractId).toBe("marire");
    // Lanțul rămâne identificabil — REVISAL raportează contractul de bază.
    expect(rezultat?.contractDeBazaId).toBe("baza");
    expect(rezultat?.schimbatInLuna).toBe(false);
  });

  it("fără act adițional, termenii vin din contractul de bază", () => {
    const rezultat = contractEfectiv([BAZA], PRIMA, ULTIMA);
    expect(rezultat?.salariuBaza).toBe(5000);
    expect(rezultat?.contractId).toBe("baza");
  });

  it("o mărire care intră în vigoare abia luna viitoare NU se aplică", () => {
    const rezultat = contractEfectiv(
      [BAZA, act({ id: "viitor", valabilDeLa: "2026-09-01", salariuBaza: 9000 })],
      PRIMA,
      ULTIMA,
    );
    expect(rezultat?.salariuBaza).toBe(5000);
  });

  it("se aplică ultimul act adițional, nu primul găsit", () => {
    const rezultat = contractEfectiv(
      [
        BAZA,
        act({ id: "a2", valabilDeLa: "2026-03-01", dataContract: "2026-02-20", salariuBaza: 6000 }),
        act({ id: "a1", valabilDeLa: "2026-06-01", dataContract: "2026-05-20", salariuBaza: 8000 }),
      ],
      PRIMA,
      ULTIMA,
    );
    expect(rezultat?.salariuBaza).toBe(8000);
    expect(rezultat?.contractId).toBe("a1");
  });

  it("actul adițional schimbă și norma, nu doar salariul", () => {
    const rezultat = contractEfectiv(
      [
        BAZA,
        act({ id: "part-time", valabilDeLa: "2026-07-01", normaOreZi: 4, normaOreSaptamana: 20 }),
      ],
      PRIMA,
      ULTIMA,
    );
    expect(rezultat?.normaOreZi).toBe(4);
    expect(rezultat?.normaOreSaptamana).toBe(20);
  });
});

describe("contractEfectiv — schimbare la mijlocul lunii", () => {
  it("aplică termenii noi și semnalează că luna nu a fost împărțită", () => {
    const rezultat = contractEfectiv(
      [
        BAZA,
        act({
          id: "mijloc",
          valabilDeLa: "2026-08-15",
          dataContract: "2026-08-10",
          salariuBaza: 6500,
        }),
      ],
      PRIMA,
      ULTIMA,
    );
    expect(rezultat?.salariuBaza).toBe(6500);
    expect(rezultat?.schimbatInLuna).toBe(true);
  });

  it("un act adițional intrat în vigoare chiar în prima zi nu e o schimbare în lună", () => {
    const rezultat = contractEfectiv(
      [
        BAZA,
        act({
          id: "chiar-intai",
          valabilDeLa: PRIMA,
          dataContract: "2026-07-25",
          salariuBaza: 6500,
        }),
      ],
      PRIMA,
      ULTIMA,
    );
    expect(rezultat?.salariuBaza).toBe(6500);
    expect(rezultat?.schimbatInLuna).toBe(false);
  });
});

describe("contractEfectiv — cazuri care NU trebuie să blocheze salarizarea", () => {
  it("un contract pe durată determinată care expiră la mijlocul lunii rămâne plătibil", () => {
    const rezultat = contractEfectiv(
      [contract({ id: "determinat", valabilPana: "2026-08-15" })],
      PRIMA,
      ULTIMA,
    );
    expect(rezultat).not.toBeNull();
    expect(rezultat?.contractId).toBe("determinat");
    expect(rezultat?.schimbatInLuna).toBe(false);
  });

  it("un angajat care începe la mijlocul lunii primește contractul lui", () => {
    const rezultat = contractEfectiv(
      [contract({ id: "nou", valabilDeLa: "2026-08-17" })],
      PRIMA,
      ULTIMA,
    );
    expect(rezultat?.contractId).toBe("nou");
    expect(rezultat?.schimbatInLuna).toBe(false);
  });
});

describe("contractEfectiv — când nu există contract", () => {
  it("fără contract de bază activ întoarce null", () => {
    expect(contractEfectiv([], PRIMA, ULTIMA)).toBeNull();
    expect(
      contractEfectiv([contract({ id: "incetat", status: "incetat" })], PRIMA, ULTIMA),
    ).toBeNull();
    expect(
      contractEfectiv([contract({ id: "proiect", status: "proiect" })], PRIMA, ULTIMA),
    ).toBeNull();
  });

  it("un contract care începe abia luna viitoare întoarce null", () => {
    expect(
      contractEfectiv([contract({ id: "viitor", valabilDeLa: "2026-09-01" })], PRIMA, ULTIMA),
    ).toBeNull();
  });

  it("un contract expirat înaintea lunii întoarce null", () => {
    expect(
      contractEfectiv([contract({ id: "expirat", valabilPana: "2026-07-31" })], PRIMA, ULTIMA),
    ).toBeNull();
  });

  it("un act adițional fără contractul lui de bază activ nu ține locul acestuia", () => {
    expect(
      contractEfectiv(
        [act({ id: "orfan", valabilDeLa: "2026-05-01", salariuBaza: 9000 })],
        PRIMA,
        ULTIMA,
      ),
    ).toBeNull();
  });
});

describe("contractEfectiv — izolare și determinism", () => {
  it("un act adițional atârnat de ALT contract nu intră în calcul", () => {
    const rezultat = contractEfectiv(
      [
        BAZA,
        act({
          id: "strain",
          parentContractId: "alt-contract",
          valabilDeLa: "2026-06-01",
          salariuBaza: 99000,
        }),
      ],
      PRIMA,
      ULTIMA,
    );
    expect(rezultat?.salariuBaza).toBe(5000);
  });

  it("două acte adiționale în aceeași zi dau mereu același rezultat, indiferent de ordinea citirii", () => {
    const a = act({
      id: "aaa",
      valabilDeLa: "2026-06-01",
      dataContract: "2026-05-20",
      salariuBaza: 6000,
    });
    const b = act({
      id: "bbb",
      valabilDeLa: "2026-06-01",
      dataContract: "2026-05-20",
      salariuBaza: 7000,
    });
    const intr1 = contractEfectiv([BAZA, a, b], PRIMA, ULTIMA);
    const intr2 = contractEfectiv([BAZA, b, a], PRIMA, ULTIMA);
    expect(intr1).toEqual(intr2);
    // Fără criteriul final pe identificator, recalculul ar putea da alt salariu.
    expect(intr1?.contractId).toBe("bbb");
  });

  it("nu modifică lista primită", () => {
    const lista = [BAZA, act({ id: "x", valabilDeLa: "2026-06-01" })];
    const copie = [...lista];
    contractEfectiv(lista, PRIMA, ULTIMA);
    expect(lista).toEqual(copie);
  });
});
