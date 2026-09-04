import { describe, expect, it } from "vitest";

import { cheieCelula } from "@/domain/leave/planificator";

import { absenteLunii, ANGAJATI, TIPURI } from "./lume";

describe("lumea fictivă", () => {
  it("are opt angajați cu marcă unică", () => {
    expect(ANGAJATI).toHaveLength(8);
    expect(new Set(ANGAJATI.map((a) => a.marca)).size).toBe(8);
  });

  it("are tipuri de concediu cu culoare validă", () => {
    expect(TIPURI.length).toBeGreaterThan(2);
    for (const tip of TIPURI) expect(tip.culoare).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("așază absențele în LUNA primită, nu într-o lună fixă", () => {
    const celule = absenteLunii("2027-11-15");
    const chei = Object.keys(celule);
    expect(chei.length).toBeGreaterThan(0);
    for (const cheie of chei) expect(cheie).toContain("2027-11-");
  });

  it("cheile sunt construite cu cheieCelula, nu de mână", () => {
    const celule = absenteLunii("2026-03-10");
    const primaCheie = Object.keys(celule)[0] ?? "";
    const [employeeId = "", data = ""] = primaCheie.split("|");
    expect(cheieCelula(employeeId, data)).toBe(primaCheie);
  });

  it("conține cel puțin o absență în aprobare, ca hașura să aibă ce demonstra", () => {
    const stari = Object.values(absenteLunii("2026-03-10")).flatMap((c) => c.map((a) => a.stare));
    expect(stari).toContain("in_aprobare");
    expect(stari).toContain("aprobata");
  });
});
