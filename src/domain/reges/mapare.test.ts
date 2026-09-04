// src/domain/reges/mapare.test.ts
import { describe, expect, it } from "vitest";

import {
  compuneAdresa,
  mapeazaContract,
  mapeazaIncetare,
  mapeazaSalariat,
  mapeazaSuspendare,
  type ContractIntern,
  type SalariatIntern,
} from "./mapare";

const CTX = {
  messageId: "117f9b03-9efb-4f5a-8ebb-7ab3b0c792ae",
  autorId: "e259e758-e165-41fb-b81f-2be7358dd46d",
  sesiuneId: "117f9b04-9efb-4f5e-8ebb-7ab3b0c792cf",
  utilizator: "Maria Popescu",
  cand: new Date("2026-06-18T14:19:58.917Z"),
};

function salariat(s: Partial<SalariatIntern> = {}): SalariatIntern {
  return {
    cnp: "1900101070016",
    nume: "Popescu",
    prenume: "Ion",
    adresa: "Strada Morii 12, Cluj-Napoca",
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
    numar: "CIM-9022",
    dataContract: "2026-03-10",
    valabilDeLa: "2026-03-14",
    valabilPana: null,
    durataDeterminata: false,
    tipContract: "ContractIndividualMunca",
    tipNorma: "NormaIntreaga",
    normaTimpMunca: "NormaIntreaga840",
    repartizare: "OreDeZi",
    salariuBaza: 4000,
    moneda: "ron",
    codCor: "251401",
    regesCorId: "11111111-1111-4111-8111-111111111111",
    sporuri: [],
    regesContractId: null,
    ...c,
  };
}

describe("antetul", () => {
  it("poartă versiunea 5 și numele aplicației", () => {
    const m = mapeazaSalariat(salariat(), CTX);
    expect(m.header.version).toBe("5");
    expect(m.header.clientApplication).toBe("Administrativo");
    expect(m.header.timestamp).toBe("2026-06-18T14:19:58.917Z");
    expect(m.header.user).toBe("Maria Popescu");
  });
});

describe("salariat", () => {
  it("alege operația după prezența identificatorului REGES", () => {
    expect(mapeazaSalariat(salariat(), CTX).header.operation).toBe("InregistrareSalariat");
    expect(
      mapeazaSalariat(salariat({ regesSalariatId: "4f8cb938-ea29-498d-a897-377a9794b204" }), CTX)
        .header.operation,
    ).toBe("ModificareSalariat");
  });

  it("trimite referința doar când există", () => {
    expect(mapeazaSalariat(salariat(), CTX).referintaSalariat).toBeUndefined();
    const cuId = mapeazaSalariat(salariat({ regesSalariatId: "abc-1" }), CTX);
    expect(cuId.referintaSalariat).toEqual({ $type: "referinta", id: "abc-1" });
  });

  it("pune $type pe fiecare obiect imbricat — capcana numărul unu a mapării", () => {
    const m = mapeazaSalariat(salariat({ regesSalariatId: "abc-1" }), CTX);
    expect(m.$type).toBe("salariat");
    expect(m.info.$type).toBe("infoSalariat");
    expect(m.referintaSalariat?.$type).toBe("referinta");
  });

  it("transmite țara prin NUME, nu prin cod ISO", () => {
    const m = mapeazaSalariat(salariat(), CTX);
    expect(m.info.taraDomiciliu).toEqual({ nume: "România" });
  });

  it("omite complet câmpurile opționale goale în loc să trimită șir gol", () => {
    const m = mapeazaSalariat(
      salariat({ nationalitate: null, dataNasterii: null, localitate: "   " }),
      CTX,
    );
    expect("nationalitate" in m.info).toBe(false);
    expect("dataNastere" in m.info).toBe(false);
    expect("localitate" in m.info).toBe(false);
  });

  it("nu mută data nașterii cu o zi înapoi", () => {
    const m = mapeazaSalariat(salariat({ dataNasterii: "1990-01-01" }), CTX);
    expect(m.info.dataNastere?.startsWith("1990-01-01")).toBe(true);
  });
});

describe("contract", () => {
  it("leagă contractul de salariat prin referință", () => {
    const m = mapeazaContract(contract(), "sal-1", CTX);
    expect(m.continut?.referintaSalariat).toEqual({ $type: "referinta", id: "sal-1" });
    expect(m.continut?.$type).toBe("continutContract");
  });

  it("normalizează moneda la majuscule", () => {
    expect(mapeazaContract(contract(), "sal-1", CTX).continut?.moneda).toBe("RON");
  });

  it("traduce durata în enum-ul REGES", () => {
    expect(mapeazaContract(contract(), "sal-1", CTX).continut?.tipDurata).toBe("Nedeterminata");
    expect(
      mapeazaContract(
        contract({ durataDeterminata: true, valabilPana: "2026-12-31" }),
        "sal-1",
        CTX,
      ).continut?.tipDurata,
    ).toBe("Determinata");
  });

  it("trimite data de sfârșit DOAR pentru durată determinată", () => {
    const nedeterminat = mapeazaContract(contract({ valabilPana: "2026-12-31" }), "sal-1", CTX);
    // Contradicția „nedeterminat + dată de sfârșit" e respinsă de server.
    expect("dataSfarsitContract" in (nedeterminat.continut ?? {})).toBe(false);

    const determinat = mapeazaContract(
      contract({ durataDeterminata: true, valabilPana: "2026-12-31" }),
      "sal-1",
      CTX,
    );
    expect(determinat.continut?.dataSfarsitContract?.startsWith("2026-12-31")).toBe(true);
  });

  it("referențiază funcția prin identificatorul din nomenclator, nu prin cod", () => {
    // REGES-Online cere UUID-ul poziției COR. Perechea `{ cod, versiune }` era
    // forma din fișierele Revisal vechi, iar trimisă azi e respinsă.
    expect(mapeazaContract(contract(), "sal-1", CTX).continut?.cor).toEqual({
      $type: "referinta",
      id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("pune salariul de bază într-un OBIECT, fără `sporuri` când nu există", () => {
    const m = mapeazaContract(contract(), "sal-1", CTX);
    // `sporuri: []` NU e același lucru cu absența câmpului pentru un
    // deserializator strict — de aceea se omite, nu se trimite gol.
    expect(m.continut?.salariu).toStrictEqual({ salariuBaza: 4000 });
  });

  it("duce sporurile în `salariu.sporuri`, fără `$type` și fără monedă", () => {
    const m = mapeazaContract(
      contract({
        sporuri: [
          { referintaTipSpor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", valoare: 10.5, esteProcent: true },
          { referintaTipSpor: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", valoare: 250, esteProcent: false },
        ],
      }),
      "sal-1",
      CTX,
    );

    expect(m.continut?.salariu).toStrictEqual({
      salariuBaza: 4000,
      sporuri: [
        { referintaTipSpor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", valoare: 10.5, esteProcent: true },
        { referintaTipSpor: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", valoare: 250, esteProcent: false },
      ],
    });
  });

  it("taie zgomotul de virgulă mobilă și din valoarea sporului", () => {
    const m = mapeazaContract(
      contract({
        sporuri: [
          { referintaTipSpor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", valoare: 10.500000000000002, esteProcent: true },
        ],
      }),
      "sal-1",
      CTX,
    );

    expect(m.continut?.salariu.sporuri?.[0]?.valoare).toBe(10.5);
  });

  it("taie zgomotul de virgulă mobilă din salariu", () => {
    const m = mapeazaContract(contract({ salariuBaza: 4000.0000000000005 }), "sal-1", CTX);
    expect(m.continut?.salariu.salariuBaza).toBe(4000);
  });
});

describe("acțiuni pe contract", () => {
  it("încetarea merge prin referință, cu $type propriu", () => {
    const m = mapeazaIncetare(
      "con-1",
      { data: "2026-09-20", temeiLegal: "Art55LitB", explicatie: "Indisciplină" },
      CTX,
    );
    expect(m.header.operation).toBe("IncetareContract");
    expect(m.referintaContract).toEqual({ $type: "referinta", id: "con-1" });
    expect(m.actiune?.$type).toBe("actiuneIncetare");
    expect(m.continut).toBeUndefined();
  });

  it("suspendarea poartă intervalul și temeiul", () => {
    const m = mapeazaSuspendare(
      "con-1",
      {
        dataInceput: "2026-09-20",
        dataSfarsit: "2026-09-27",
        temeiLegal: "Art54",
        explicatie: null,
      },
      CTX,
    );
    expect(m.actiune?.$type).toBe("actiuneSuspendare");
    expect(m.header.operation).toBe("SuspendareContract");
    if (m.actiune?.$type !== "actiuneSuspendare") return;
    expect(m.actiune.dataInceput.startsWith("2026-09-20")).toBe(true);
    expect(m.actiune.dataSfarsit?.startsWith("2026-09-27")).toBe(true);
    expect("explicatie" in m.actiune).toBe(false);
  });

  it("suspendarea fără termen omite data de sfârșit", () => {
    const m = mapeazaSuspendare(
      "con-1",
      { dataInceput: "2026-09-20", dataSfarsit: null, temeiLegal: "Art54", explicatie: null },
      CTX,
    );
    if (m.actiune?.$type !== "actiuneSuspendare") return;
    expect("dataSfarsit" in m.actiune).toBe(false);
  });
});

describe("compuneAdresa", () => {
  it("leagă componentele cu virgulă", () => {
    expect(
      compuneAdresa({
        strada: "Strada Morii 12",
        oras: "Cluj-Napoca",
        judet: "Cluj",
        codPostal: "400001",
      }),
    ).toBe("Strada Morii 12, Cluj-Napoca, Cluj, 400001");
  });

  it("sare componentele goale în loc să lase virgule orfane", () => {
    expect(
      compuneAdresa({ strada: "Strada Morii 12", oras: null, judet: "  ", codPostal: null }),
    ).toBe("Strada Morii 12");
  });
});
