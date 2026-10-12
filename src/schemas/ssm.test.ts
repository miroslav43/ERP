// src/schemas/ssm.test.ts
//
// Fișa de aptitudine: valabilitatea nu poate fi anterioară examinării.
// QA 8 oct 2026, HR-017 — o fișă „expirată" la 01.01.2026 pentru un examen
// din 10.09.2026 se salva fără nicio obiecție și intra în raportul de expirări.

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  TIPURI_ACCIDENT,
  accidentNouSchema,
  fisaAptitudineSchema,
  instruireBlocSchema,
} from "./ssm";

const FISA = {
  employee_id: "66666666-6666-4666-8666-666666666666",
  tip: "periodic",
  data_examinarii: "2026-09-10",
  rezultat: "apt",
};

describe("fisaAptitudineSchema — valabil_pana față de data_examinarii", () => {
  it("valabilitatea anterioară examinării: issue pe `valabil_pana`", () => {
    const r = fisaAptitudineSchema.safeParse({ ...FISA, valabil_pana: "2026-01-01" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "valabil_pana");
    expect(issue?.message).toContain("anterioară datei examinării");
  });

  it("valabilitatea egală cu data examinării trece", () => {
    expect(fisaAptitudineSchema.safeParse({ ...FISA, valabil_pana: "2026-09-10" }).success).toBe(
      true,
    );
  });

  it("valabilitatea ulterioară trece", () => {
    expect(fisaAptitudineSchema.safeParse({ ...FISA, valabil_pana: "2027-09-10" }).success).toBe(
      true,
    );
  });

  it("valabilitatea goală devine null și trece", () => {
    const r = fisaAptitudineSchema.safeParse({ ...FISA, valabil_pana: "" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.valabil_pana).toBeNull();
  });
});

const eroriPe = (schema: z.ZodType, intrare: unknown) => {
  const rezultat = schema.safeParse(intrare);
  expect(rezultat.success).toBe(false);
  return z.flattenError(rezultat.error as z.ZodError).fieldErrors as Record<
    string,
    string[] | undefined
  >;
};

const ANGAJAT = "66666666-6666-4666-8666-666666666666";
const INSTRUIRE = {
  training_type_id: "77777777-7777-4777-8777-777777777777",
  data_instruirii: "2026-10-01",
  durata_ore: "2",
  employee_ids: [ANGAJAT],
};

/**
 * ADM-018: data goală arăta „Invalid ISO date”, iar durata „abc” se salva
 * tăcut ca „0:00 h” — `Number("abc")` din formular devenea NaN, apoi 0.
 */
describe("instruireBlocSchema — mesaje românești", () => {
  it("formular gol: tipul și data au mesaje proprii", () => {
    const erori = eroriPe(instruireBlocSchema, {});
    expect(erori["training_type_id"]).toEqual(["Alegeți tipul instruirii."]);
    expect(erori["data_instruirii"]).toEqual(["Introduceți data instruirii."]);
  });

  it("durata „abc” e refuzată, nu salvată ca zero", () => {
    const erori = eroriPe(instruireBlocSchema, { ...INSTRUIRE, durata_ore: "abc" });
    expect(erori["durata_ore"]).toEqual(["Durata se scrie în ore și minute (ex. 2:00)."]);
  });

  it("durata goală spune ce lipsește (`IntrareDurata` trimite „” pe un text de neînțeles)", () => {
    const erori = eroriPe(instruireBlocSchema, { ...INSTRUIRE, durata_ore: "" });
    expect(erori["durata_ore"]).toEqual(["Introduceți durata instruirii (ex. 2:00)."]);
  });

  it("durata zecimală din câmpul ascuns trece și devine număr", () => {
    const r = instruireBlocSchema.safeParse({ ...INSTRUIRE, durata_ore: "1.5" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.durata_ore).toBe(1.5);
  });
});

describe("HR-016 / ADM-019 — angajatul neales și zilele negative", () => {
  it("fișa de aptitudine fără angajat: „Alegeți angajatul.”", () => {
    const erori = eroriPe(fisaAptitudineSchema, { ...FISA, employee_id: "" });
    expect(erori["employee_id"]).toEqual(["Alegeți angajatul."]);
  });

  it("accidentul cu −3 zile de incapacitate are mesaj românesc", () => {
    const erori = eroriPe(accidentNouSchema, {
      data_producerii: "2026-10-01",
      locul: "Hală",
      imprejurari: "Alunecare",
      tip: TIPURI_ACCIDENT[0],
      zile_incapacitate: -3,
    });
    expect(erori["zile_incapacitate"]).toEqual(["Zilele de incapacitate nu pot fi negative."]);
  });
});
