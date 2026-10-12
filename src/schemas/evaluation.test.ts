// src/schemas/evaluation.test.ts
//
// Data evaluării: cel mult un an în viitor. QA 8 oct 2026, HR-029 — o
// evaluare „din 2030" se salva și apărea în listă ca și cum ar fi avut loc.
// Un an, nu „azi": `planificaEvaluari` programează legitim evaluări viitoare.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  actualizeazaEvaluareSchema,
  creeazaEvaluareSchema,
  planificaEvaluariSchema,
} from "./evaluation";

const ANGAJAT = "66666666-6666-4666-8666-666666666666";
const SABLON = "77777777-7777-4777-8777-777777777777";

const RASPUNSURI = [{ criteriu_cod: "calitate", scor: 4 }];

/** „Azi" fix: 12 octombrie 2026, ora României. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

const AZI = "2026-10-12";
const PESTE_11_LUNI = "2027-09-12";
const PESTE_UN_AN = "2027-10-12";
const PESTE_UN_AN_SI_O_ZI = "2027-10-13";

type Schema =
  typeof creeazaEvaluareSchema | typeof planificaEvaluariSchema | typeof actualizeazaEvaluareSchema;

const cazuri: readonly (readonly [string, Schema, (data: string) => object])[] = [
  [
    "creeazaEvaluareSchema",
    creeazaEvaluareSchema,
    (data) => ({
      employee_id: ANGAJAT,
      template_id: SABLON,
      data_evaluarii: data,
      raspunsuri: RASPUNSURI,
    }),
  ],
  [
    "planificaEvaluariSchema",
    planificaEvaluariSchema,
    (data) => ({ template_id: SABLON, data_evaluarii: data, employee_ids: [ANGAJAT] }),
  ],
  [
    "actualizeazaEvaluareSchema",
    actualizeazaEvaluareSchema,
    (data) => ({ id: ANGAJAT, data_evaluarii: data, raspunsuri: RASPUNSURI }),
  ],
];

describe.each(cazuri)("%s — data_evaluarii", (_nume, schema, intrare) => {
  it("2030-01-01: issue pe `data_evaluarii`", () => {
    const r = schema.safeParse(intrare("2030-01-01"));
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "data_evaluarii");
    expect(issue?.message).toContain("un an în viitor");
  });

  it("o zi peste un an: respinsă", () => {
    expect(schema.safeParse(intrare(PESTE_UN_AN_SI_O_ZI)).success).toBe(false);
  });

  it("exact un an: trece", () => {
    expect(schema.safeParse(intrare(PESTE_UN_AN)).success).toBe(true);
  });

  it("azi + 11 luni: trece", () => {
    expect(schema.safeParse(intrare(PESTE_11_LUNI)).success).toBe(true);
  });

  it("azi: trece", () => {
    expect(schema.safeParse(intrare(AZI)).success).toBe(true);
  });

  it("în trecut: trece", () => {
    expect(schema.safeParse(intrare("2026-09-30")).success).toBe(true);
  });

  it("format greșit: mesajul de format, nu cel de prag", () => {
    const r = schema.safeParse(intrare("12.10.2026"));
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "data_evaluarii");
    expect(issue?.message).toContain("AAAA-LL-ZZ");
  });
});
