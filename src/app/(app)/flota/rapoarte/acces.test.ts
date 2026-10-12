// src/app/(app)/flota/rapoarte/acces.test.ts
import { describe, expect, it } from "vitest";

import type { PermissionScope } from "@/lib/auth/permissions";

import { poateExportaFlota, poateVedeaRapoarte } from "./acces";

const harta = (m: Record<string, PermissionScope>) => new Map(Object.entries(m));

const ADMIN = harta({
  "vehicles:read": "all",
  "trip_sheets:read": "all",
  "vehicles:export": "all",
});

describe("poarta rapoartelor flotei", () => {
  it("administratorul vede rapoartele și le exportă", () => {
    expect(poateVedeaRapoarte(ADMIN)).toBe(true);
    expect(poateExportaFlota(ADMIN)).toBe(true);
  });

  it("managerul (vehicule și foi la `team`) nu vede rapoartele: ar primi agregate parțiale", () => {
    const manager = harta({ "vehicles:read": "team", "trip_sheets:read": "team" });
    expect(poateVedeaRapoarte(manager)).toBe(false);
    expect(poateExportaFlota(manager)).toBe(false);
  });

  it("fără dreptul pe TOATE foile, rapoartele nu se deschid, deși vehiculele se văd toate", () => {
    const m = harta({ "vehicles:read": "all", "trip_sheets:read": "team", "vehicles:export": "all" });
    expect(poateVedeaRapoarte(m)).toBe(false);
    expect(poateExportaFlota(m)).toBe(false);
  });

  it("fără dreptul pe TOATE vehiculele, la fel", () => {
    const m = harta({ "vehicles:read": "team", "trip_sheets:read": "all", "vehicles:export": "all" });
    expect(poateVedeaRapoarte(m)).toBe(false);
  });

  it("exportul cere cheia proprie: cine doar citește vede ecranul, dar nu descarcă", () => {
    const m = harta({ "vehicles:read": "all", "trip_sheets:read": "all" });
    expect(poateVedeaRapoarte(m)).toBe(true);
    expect(poateExportaFlota(m)).toBe(false);
  });

  it("absența cheilor e refuz, nu eroare", () => {
    expect(poateVedeaRapoarte(new Map())).toBe(false);
    expect(poateExportaFlota(new Map())).toBe(false);
  });
});
