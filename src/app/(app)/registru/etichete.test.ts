// src/app/(app)/registru/etichete.test.ts
//
// Etichetele registrului: sensurile cu cuvintele Legii 16/1996 art. 7 și
// tipurile de document, unde un cod necunoscut cade pe forma lui curățată,
// niciodată pe un gol.

import { describe, expect, it } from "vitest";

import { ETICHETE_SENS, eticheteazaTipDocument } from "./etichete";

describe("ETICHETE_SENS", () => {
  it("folosește cuvintele legii: intrare, ieșire, uz intern", () => {
    expect(ETICHETE_SENS).toEqual({ intrare: "Intrare", iesire: "Ieșire", intern: "Uz intern" });
  });
});

describe("eticheteazaTipDocument", () => {
  it.each([
    ["contract_munca", "Contract individual de muncă"],
    ["act_aditional", "Act adițional la contract"],
    ["fisa_postului", "Fișa postului"],
    ["nda", "Acord de confidențialitate"],
    ["anexa_proprietate_intelectuala", "Anexă de proprietate intelectuală"],
    ["act_aditional_telemunca", "Act adițional de telemuncă"],
    ["document_personal", "Document de personal"],
  ])("codul cunoscut %s are denumirea proprie", (cod, asteptat) => {
    expect(eticheteazaTipDocument(cod)).toBe(asteptat);
  });

  it.each([
    ["adeverinta_vechime", "Adeverinta vechime"],
    ["demisie", "Demisie"],
    ["stat_plata", "Stat plata"],
    ["_x_", "X"],
    ["d112", "D112"],
  ])("codul fără denumire %s cade pe forma curățată %s", (cod, asteptat) => {
    expect(eticheteazaTipDocument(cod)).toBe(asteptat);
  });

  it("șirul gol rămâne gol, fără să arunce", () => {
    expect(eticheteazaTipDocument("")).toBe("");
  });

  // `constructor` trece de regex-ul din `inregistrareManualaSchema`
  // (`^[a-z][a-z0-9_]{1,63}$`), deci poate ajunge în `tip_document`.
  it.fails("DEFECT: codul „constructor” întoarce funcția din prototip, nu un text", () => {
    const eticheta: unknown = eticheteazaTipDocument("constructor");
    expect(typeof eticheta).toBe("string");
    expect(eticheta).toBe("Constructor");
  });
});
