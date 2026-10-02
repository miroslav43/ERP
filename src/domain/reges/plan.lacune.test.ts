// src/domain/reges/plan.lacune.test.ts
//
// Lacuna confirmată de audit: `suspendare_nemotivata` și `reluare_nemotivata`
// (0128) n-aveau test, iar maparea e `Partial<Record>` — un tip de eveniment nou
// fără operație cade abia la rulare. Poarta de mai jos trece prin TOATE tipurile
// din `TIPURI_EVENIMENT`.

import { describe, expect, it } from "vitest";

import { TIPURI_EVENIMENT } from "./evenimente";
import { planificaMesaje } from "./plan";

describe("planificaMesaje — absențele nemotivate", () => {
  it.each([
    { tipEveniment: "suspendare_nemotivata", operatie: "SuspendareContract" },
    { tipEveniment: "reluare_nemotivata", operatie: "ReactivareContract" },
  ] as const)(
    "$tipEveniment pleacă la REGES ca $operatie, un singur pas",
    ({ tipEveniment, operatie }) => {
      const r = planificaMesaje({ tipEveniment, regesSalariatId: "abc", regesContractId: "def" });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.valoare).toHaveLength(1);
      expect(r.valoare[0]?.operatie).toBe(operatie);
      expect(r.valoare[0]?.depindeDePrecedentul).toBe(false);
    },
  );

  it("suspendarea nemotivată a unui contract netransmis e refuzată cu motivul scris", () => {
    const r = planificaMesaje({
      tipEveniment: "suspendare_nemotivata",
      regesSalariatId: "abc",
      regesContractId: null,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motiv).toContain("SuspendareContract");
  });
});

describe("planificaMesaje — fiecare tip de eveniment are o operație REGES", () => {
  it.each(TIPURI_EVENIMENT.filter((tip) => tip !== "angajare"))(
    "%s, pe un contract deja transmis, produce un plan",
    (tipEveniment) => {
      const r = planificaMesaje({ tipEveniment, regesSalariatId: "abc", regesContractId: "def" });
      expect(r).toMatchObject({ ok: true });
    },
  );

  it("angajarea, pe un contract încă netransmis, produce un plan", () => {
    const r = planificaMesaje({
      tipEveniment: "angajare",
      regesSalariatId: "abc",
      regesContractId: null,
    });
    expect(r).toMatchObject({ ok: true });
  });
});
