// src/domain/organization/caen-reguli.test.ts
import { describe, expect, it } from "vitest";
import { CODURI_INTERZISE_SRLD, maximSecundare, valideazaSelectieCaen } from "./caen-reguli";

describe("maximSecundare", () => {
  it("PFA: maxim 4", () => {
    expect(maximSecundare("PFA")).toBe(4);
  });
  it("II: maxim 9", () => {
    expect(maximSecundare("II")).toBe(9);
  });
  it.each(["SRL", "SRL-D", "SA", "SNC", "SCS", "RA", "IF", "ONG"])(
    "%s: nelimitat (null)",
    (forma) => {
      expect(maximSecundare(forma)).toBeNull();
    },
  );
});

describe("valideazaSelectieCaen", () => {
  it("acceptă fără principal (ecran de editare, câmp încă necompletat)", () => {
    expect(valideazaSelectieCaen("SRL", undefined, [])).toEqual({ valid: true });
  });

  it("respinge codul principal duplicat printre cele secundare", () => {
    const rezultat = valideazaSelectieCaen("SRL", "6210", ["6210"]);
    expect(rezultat.valid).toBe(false);
  });

  it("respinge coduri secundare duplicate între ele", () => {
    const rezultat = valideazaSelectieCaen("SRL", "6210", ["6220", "6220"]);
    expect(rezultat.valid).toBe(false);
  });

  it("PFA: acceptă exact 4 secundare (5 total)", () => {
    expect(valideazaSelectieCaen("PFA", "0111", ["0112", "0113", "0114", "0115"])).toEqual({
      valid: true,
    });
  });

  it("PFA: respinge al 5-lea cod secundar (6 total)", () => {
    const rezultat = valideazaSelectieCaen("PFA", "0111", [
      "0112",
      "0113",
      "0114",
      "0115",
      "0116",
    ]);
    expect(rezultat.valid).toBe(false);
  });

  it("II: acceptă exact 9 secundare, respinge al 10-lea", () => {
    const noua = ["0112", "0113", "0114", "0115", "0116", "0119", "0121", "0122", "0123"];
    expect(valideazaSelectieCaen("II", "0111", noua)).toEqual({ valid: true });
    expect(valideazaSelectieCaen("II", "0111", [...noua, "0124"]).valid).toBe(false);
  });

  it("SRL: nelimitat — acceptă 20 de coduri secundare distincte", () => {
    const secundare = Array.from({ length: 20 }, (_, i) => `01${String(12 + i).padStart(2, "0")}`);
    expect(valideazaSelectieCaen("SRL", "0111", secundare).valid).toBe(true);
  });

  it("SRL-D: acceptă coduri din exact 5 grupe distincte", () => {
    const rezultat = valideazaSelectieCaen("SRL-D", "0111", ["0121", "0130", "0141", "0150"]);
    expect(rezultat).toEqual({ valid: true });
  });

  it("SRL-D: respinge a 6-a grupă distinctă", () => {
    const rezultat = valideazaSelectieCaen("SRL-D", "0111", [
      "0121",
      "0130",
      "0141",
      "0150",
      "0161",
    ]);
    expect(rezultat.valid).toBe(false);
  });

  it.each([...CODURI_INTERZISE_SRLD])("SRL-D: respinge codul interzis %s ca principal", (cod) => {
    expect(valideazaSelectieCaen("SRL-D", cod, []).valid).toBe(false);
  });

  it("SRL-D: respinge un cod interzis aflat printre cele secundare", () => {
    expect(valideazaSelectieCaen("SRL-D", "0111", ["9200"]).valid).toBe(false);
  });

  it("SRL-D: codurile interzise NU se aplică altor forme juridice (SRL le acceptă)", () => {
    expect(valideazaSelectieCaen("SRL", "9200", []).valid).toBe(true);
  });
});
