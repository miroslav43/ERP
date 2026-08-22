// src/domain/ticketing/stari.test.ts
import { describe, expect, it } from "vitest";
import {
  cereAprobare,
  poateSchimbaStatusul,
  statusInitial,
  STATUSURI_TICHET,
  tranzitiePermisa,
  tranzitiiOferite,
  tranzitiiPosibile,
  type DrepturiActor,
} from "./stari";

const SOLICITANT: DrepturiActor = { esteSolicitant: true, poateAproba: false, poateOpera: false };
const MANAGER: DrepturiActor = { esteSolicitant: false, poateAproba: true, poateOpera: false };
const PATRON: DrepturiActor = { esteSolicitant: false, poateAproba: true, poateOpera: true };
const STRAIN: DrepturiActor = { esteSolicitant: false, poateAproba: false, poateOpera: false };

describe("tipul decide aprobarea", () => {
  it("software și hardware trec prin aprobare, celelalte nu", () => {
    expect(cereAprobare("software")).toBe(true);
    expect(cereAprobare("hardware")).toBe(true);
    expect(cereAprobare("defectiune")).toBe(false);
    expect(cereAprobare("bug_erp")).toBe(false);
  });

  it("statusul inițial rezultă din tip", () => {
    expect(statusInitial("software")).toBe("in_aprobare");
    expect(statusInitial("hardware")).toBe("in_aprobare");
    expect(statusInitial("defectiune")).toBe("nou");
    expect(statusInitial("bug_erp")).toBe("nou");
  });
});

describe("tranziții structurale", () => {
  it("„anulat” e definitiv", () => {
    expect(tranzitiiPosibile("anulat")).toEqual([]);
  });

  it("respinge tranzițiile care sar peste flux", () => {
    expect(tranzitiePermisa("nou", "rezolvat")).toBe(false);
    expect(tranzitiePermisa("nou", "inchis")).toBe(false);
    expect(tranzitiePermisa("in_aprobare", "rezolvat")).toBe(false);
    expect(tranzitiePermisa("anulat", "in_lucru")).toBe(false);
    expect(tranzitiePermisa("inchis", "in_lucru")).toBe(false);
  });

  it("un tichet închis se poate doar redeschide", () => {
    expect(tranzitiiPosibile("inchis")).toEqual(["redeschis"]);
  });

  it("niciun status nu are tranziție către el însuși", () => {
    for (const status of STATUSURI_TICHET) {
      expect(tranzitiePermisa(status, status), status).toBe(false);
    }
  });

  it("toate destinațiile sunt statusuri cunoscute", () => {
    const cunoscute = new Set<string>(STATUSURI_TICHET);
    for (const din of STATUSURI_TICHET) {
      for (const catre of tranzitiiPosibile(din)) {
        expect(cunoscute.has(catre), `${din} → ${catre}`).toBe(true);
      }
    }
  });
});

describe("cine are voie — auto-aprobarea nu există", () => {
  it("solicitantul NU își poate aproba propria cerere", () => {
    const r = poateSchimbaStatusul("in_aprobare", "in_lucru", SOLICITANT);
    expect(r).toEqual({ permisa: false, motiv: "fara_drept" });
  });

  it("solicitantul NU își poate respinge propria cerere", () => {
    expect(poateSchimbaStatusul("in_aprobare", "respins", SOLICITANT).permisa).toBe(false);
  });

  it("nici măcar cineva cu drepturi depline nu se aprobă pe sine", () => {
    // `poateAproba` e deja fals când actorul e solicitantul — regula e
    // codificată în construirea drepturilor, nu lăsată la latitudinea apelantului.
    const patronCareCere: DrepturiActor = {
      esteSolicitant: true,
      poateAproba: false,
      poateOpera: true,
    };
    expect(poateSchimbaStatusul("in_aprobare", "in_lucru", patronCareCere).permisa).toBe(false);
  });

  it("managerul direct aprobă și respinge", () => {
    expect(poateSchimbaStatusul("in_aprobare", "in_lucru", MANAGER).permisa).toBe(true);
    expect(poateSchimbaStatusul("in_aprobare", "respins", MANAGER).permisa).toBe(true);
  });

  it("patronul aprobă la fel de bine — prima decizie contează", () => {
    expect(poateSchimbaStatusul("in_aprobare", "in_lucru", PATRON).permisa).toBe(true);
  });

  it("un coleg oarecare nu poate nimic", () => {
    expect(poateSchimbaStatusul("in_aprobare", "in_lucru", STRAIN).permisa).toBe(false);
    expect(poateSchimbaStatusul("in_lucru", "rezolvat", STRAIN).permisa).toBe(false);
    expect(poateSchimbaStatusul("in_lucru", "anulat", STRAIN).permisa).toBe(false);
  });
});

describe("prelucrarea și închiderea", () => {
  it("solicitantul nu marchează singur tichetul ca rezolvat", () => {
    expect(poateSchimbaStatusul("in_lucru", "rezolvat", SOLICITANT).permisa).toBe(false);
  });

  it("solicitantul își poate anula tichetul", () => {
    expect(poateSchimbaStatusul("in_lucru", "anulat", SOLICITANT).permisa).toBe(true);
  });

  it("solicitantul confirmă închiderea sau redeschide", () => {
    expect(poateSchimbaStatusul("rezolvat", "inchis", SOLICITANT).permisa).toBe(true);
    expect(poateSchimbaStatusul("rezolvat", "redeschis", SOLICITANT).permisa).toBe(true);
  });

  it("echipa mută în lucru și în așteptare", () => {
    expect(poateSchimbaStatusul("nou", "in_lucru", PATRON).permisa).toBe(true);
    expect(poateSchimbaStatusul("in_lucru", "in_asteptare", PATRON).permisa).toBe(true);
    expect(poateSchimbaStatusul("nou", "in_lucru", SOLICITANT).permisa).toBe(false);
  });

  it("o tranziție invalidă e respinsă înaintea verificării de drepturi", () => {
    expect(poateSchimbaStatusul("anulat", "in_lucru", PATRON)).toEqual({
      permisa: false,
      motiv: "tranzitie_invalida",
    });
  });
});

describe("ce se oferă în interfață", () => {
  it("solicitantului i se oferă doar ce poate face", () => {
    expect(tranzitiiOferite("in_aprobare", SOLICITANT)).toEqual(["anulat"]);
    expect(tranzitiiOferite("rezolvat", SOLICITANT)).toEqual(["inchis", "redeschis"]);
  });

  it("managerului i se oferă decizia", () => {
    const oferite = tranzitiiOferite("in_aprobare", MANAGER);
    expect(oferite).toContain("respins");
    expect(oferite).toContain("in_lucru");
  });

  it("unui străin nu i se oferă nimic", () => {
    for (const status of STATUSURI_TICHET) {
      expect(tranzitiiOferite(status, STRAIN), status).toEqual([]);
    }
  });
});
