// src/domain/fleet/fisiere.test.ts
import { describe, expect, it } from "vitest";

import {
  BUCKET_FLOTA,
  LIMITA_FISIER_FLOTA_BYTES,
  caleFlotaValida,
  construiesteCaleFlota,
  prefixCaleFlota,
  verificaFisierFlota,
} from "./fisiere";

const ORG = "11111111-1111-4111-8111-111111111111";
const VEH = "22222222-2222-4222-8222-222222222222";
const ALT = "33333333-3333-4333-8333-333333333333";

describe("fișierele flotei", () => {
  it("bucketul e cel creat de 0202", () => {
    expect(BUCKET_FLOTA).toBe("org-flota");
  });

  it("calea are forma cerută de `app.flota_poate_fisier`: patru segmente", () => {
    const cale = construiesteCaleFlota(ORG, "vehicles", VEH, "Poliță RCA 2026.pdf");
    expect(cale.startsWith(`${ORG}/vehicles/${VEH}/`)).toBe(true);
    expect(cale.split("/")).toHaveLength(4);
    expect(cale.endsWith("-polita-rca-2026.pdf")).toBe(true);
  });

  it("acceptă calea în prefixul entității și o refuză în al alteia", () => {
    const cale = construiesteCaleFlota(ORG, "trip_sheets", VEH, "bon.jpg");
    expect(caleFlotaValida(cale, ORG, "trip_sheets", VEH)).toBe(true);
    expect(caleFlotaValida(cale, ORG, "trip_sheets", ALT)).toBe(false);
    expect(caleFlotaValida(cale, ORG, "vehicles", VEH)).toBe(false);
  });

  it("refuză traversarea și subfolderele", () => {
    const prefix = prefixCaleFlota(ORG, "vehicles", VEH);
    expect(caleFlotaValida(`${prefix}../${ALT}/x.pdf`, ORG, "vehicles", VEH)).toBe(false);
    expect(caleFlotaValida(`${prefix}sub/x.pdf`, ORG, "vehicles", VEH)).toBe(false);
    expect(caleFlotaValida(prefix, ORG, "vehicles", VEH)).toBe(false);
  });

  it("acceptă PDF și poze de telefon (HEIC), refuză restul", () => {
    expect(verificaFisierFlota("application/pdf", 1000)).toBeNull();
    expect(verificaFisierFlota("image/heic", 1000)).toBeNull();
    expect(verificaFisierFlota("application/zip", 1000)).toMatch(/PDF/u);
  });

  it("refuză fișierul gol și pe cel peste limită", () => {
    expect(verificaFisierFlota("image/jpeg", 0)).toMatch(/gol/u);
    expect(verificaFisierFlota("image/jpeg", LIMITA_FISIER_FLOTA_BYTES + 1)).toMatch(/20 MB/u);
    expect(verificaFisierFlota("image/jpeg", LIMITA_FISIER_FLOTA_BYTES)).toBeNull();
  });
});
