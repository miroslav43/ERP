// src/app/(app)/mentenanta/iscir/valori-autorizatie.test.ts
import { describe, expect, it } from "vitest";

import { valoriAutorizatie, valoriReinnoire } from "./valori-autorizatie";

function formular(valori: Readonly<Record<string, string>>): FormData {
  const f = new FormData();
  for (const [cheie, valoare] of Object.entries(valori)) f.set(cheie, valoare);
  return f;
}

describe("valoriAutorizatie", () => {
  it("câmpurile goale pleacă `null`; emitentul gol devine „ISCIR”, regimul lipsă „inregistrat”", () => {
    expect(
      valoriAutorizatie(formular({ numar: "  ", tip: "macara", valabil_pana: "2027-01-10" })),
    ).toEqual({
      regim: "inregistrat",
      numar: null,
      tip: "macara",
      emitent: "ISCIR",
      emis_la: null,
      valabil_pana: "2027-01-10",
      scadenta_verificare_tehnica: null,
      conditii: null,
    });
  });

  it("valorile completate trec tăiate de spații; regimul RSVTI rămâne cum e ales", () => {
    expect(
      valoriAutorizatie(
        formular({
          regim: "neinregistrat_rsvti",
          numar: "",
          tip: " stivuitor ",
          emitent: " RSVTI intern ",
          emis_la: "2026-10-01",
          valabil_pana: "2028-10-01",
          scadenta_verificare_tehnica: "2027-10-01",
          conditii: " Sarcina maximă 2 t. ",
        }),
      ),
    ).toEqual({
      regim: "neinregistrat_rsvti",
      numar: null,
      tip: "stivuitor",
      emitent: "RSVTI intern",
      emis_la: "2026-10-01",
      valabil_pana: "2028-10-01",
      scadenta_verificare_tehnica: "2027-10-01",
      conditii: "Sarcina maximă 2 t.",
    });
  });

  it("fără valabilitate: șir gol, ca schema să spună mesajul pe câmpul ei", () => {
    expect(valoriAutorizatie(formular({ tip: "cazan" })).valabil_pana).toBe("");
  });
});

describe("valoriReinnoire", () => {
  it("emitentul gol rămâne `null` — funcția din bază îl ia de pe autorizația veche", () => {
    expect(
      valoriReinnoire(formular({ numar: "ISCIR-77", emitent: "", valabil_pana: "2028-01-10" })),
    ).toEqual({
      numar: "ISCIR-77",
      emitent: null,
      emis_la: null,
      valabil_pana: "2028-01-10",
      scadenta_verificare_tehnica: null,
      conditii: null,
    });
  });

  it("nu poartă tipul, regimul sau echipamentul: le moștenește rândul nou", () => {
    const v = valoriReinnoire(formular({ tip: "macara", regim: "inregistrat", valabil_pana: "x" }));
    expect(Object.keys(v)).not.toContain("tip");
    expect(Object.keys(v)).not.toContain("regim");
    expect(Object.keys(v)).not.toContain("equipment_id");
  });
});
