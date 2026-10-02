// src/app/(app)/evaluari/etichete.test.ts
//
// Vocabularul evaluării anuale: pragurile barei de punctaj și hărțile de
// status. Pragurile sunt convenție de interfață, deci testele fixează exact
// marginile — o mutare de prag trebuie să fie o decizie, nu un accident.

import { describe, expect, it } from "vitest";

import { STATUSURI_EVALUARE } from "@/schemas/evaluation";
import { ETICHETE_STATUS_EVALUARE, TONURI_STATUS_EVALUARE, tonPunctaj } from "./etichete";

describe("tonPunctaj", () => {
  it.each([
    [null, "neutru"],
    [100, "bun"],
    [80, "bun"],
    [79.9, "neutru"],
    [60, "neutru"],
    [59.9, "atentie"],
    [40, "atentie"],
    [39.9, "rau"],
    [0, "rau"],
  ] as const)("%s %% ⇒ %s", (procent, ton) => {
    expect(tonPunctaj(procent)).toBe(ton);
  });

  it("fără punctaj (null) nu e „rău”: zero și absența nu se confundă", () => {
    expect(tonPunctaj(null)).not.toBe(tonPunctaj(0));
  });
});

describe("hărțile de status", () => {
  it("fiecare status are etichetă și ton", () => {
    for (const status of STATUSURI_EVALUARE) {
      expect(ETICHETE_STATUS_EVALUARE[status]).toBeTruthy();
      expect(TONURI_STATUS_EVALUARE[status]).toBeTruthy();
    }
  });

  it("ciorna e treaptă neîncepută, finalizarea e succes", () => {
    expect(ETICHETE_STATUS_EVALUARE).toEqual({ draft: "Ciornă", finalizat: "Finalizată" });
    expect(TONURI_STATUS_EVALUARE).toEqual({ draft: "ciorna", finalizat: "succes" });
  });
});
