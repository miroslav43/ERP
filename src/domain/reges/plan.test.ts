// src/domain/reges/plan.test.ts
import { describe, expect, it } from "vitest";

import { planificaMesaje, type StarePentruPlan } from "./plan";

function stare(s: Partial<StarePentruPlan> = {}): StarePentruPlan {
  return {
    tipEveniment: "angajare",
    regesSalariatId: null,
    regesContractId: null,
    ...s,
  };
}

describe("angajare", () => {
  it("cere DOUĂ mesaje când salariatul nu e încă la ITM, al doilea dependent de primul", () => {
    const rezultat = planificaMesaje(stare());
    expect(rezultat.ok).toBe(true);
    if (!rezultat.ok) return;

    expect(rezultat.valoare).toHaveLength(2);
    expect(rezultat.valoare[0]?.operatie).toBe("InregistrareSalariat");
    expect(rezultat.valoare[0]?.depindeDePrecedentul).toBe(false);
    expect(rezultat.valoare[1]?.operatie).toBe("AdaugareContract");
    // Miezul: contractul NU poate fi construit până nu vine referința salariatului.
    expect(rezultat.valoare[1]?.depindeDePrecedentul).toBe(true);
  });

  it("sare peste înregistrarea salariatului dacă are deja identificator REGES", () => {
    const rezultat = planificaMesaje(stare({ regesSalariatId: "abc" }));
    expect(rezultat.ok).toBe(true);
    if (!rezultat.ok) return;

    expect(rezultat.valoare).toHaveLength(1);
    expect(rezultat.valoare[0]?.operatie).toBe("AdaugareContract");
    expect(rezultat.valoare[0]?.depindeDePrecedentul).toBe(false);
  });

  it("refuză o a doua adăugare a aceluiași contract", () => {
    const rezultat = planificaMesaje(stare({ regesSalariatId: "abc", regesContractId: "def" }));
    expect(rezultat.ok).toBe(false);
    if (rezultat.ok) return;
    expect(rezultat.motiv).toMatch(/are deja identificator/);
  });
});

describe("operații prin referință", () => {
  it("refuză încetarea unui contract netransmis, cu motivul scris", () => {
    const rezultat = planificaMesaje(
      stare({ tipEveniment: "incetare", regesSalariatId: "abc", regesContractId: null }),
    );
    expect(rezultat.ok).toBe(false);
    if (rezultat.ok) return;
    expect(rezultat.motiv).toMatch(/prin referință/);
    expect(rezultat.motiv).toMatch(/Transmiteți întâi adăugarea/);
  });

  it.each([
    ["incetare", "IncetareContract"],
    ["suspendare", "SuspendareContract"],
    ["reluare_activitate", "ReactivareContract"],
    ["modificare_salariu", "ModificareContract"],
    ["modificare_functie", "ModificareContract"],
    ["modificare_norma", "ModificareContract"],
    ["modificare_durata", "ModificareContract"],
    ["corectie", "ModificareContract"],
  ] as const)("%s → %s, un singur mesaj", (tipEveniment, operatie) => {
    const rezultat = planificaMesaje(
      stare({ tipEveniment, regesSalariatId: "abc", regesContractId: "def" }),
    );
    expect(rezultat.ok).toBe(true);
    if (!rezultat.ok) return;
    expect(rezultat.valoare).toHaveLength(1);
    expect(rezultat.valoare[0]?.operatie).toBe(operatie);
  });
});

describe("detașare", () => {
  it("produce o PROPUNERE, nu o detașare directă", () => {
    const rezultat = planificaMesaje(
      stare({ tipEveniment: "detasare", regesSalariatId: "abc", regesContractId: "def" }),
    );
    expect(rezultat.ok).toBe(true);
    if (!rezultat.ok) return;
    expect(rezultat.valoare[0]?.operatie).toBe("PropunereDetasareContract");
    expect(rezultat.valoare[0]?.tip).toBe("propunere_detasare");
    expect(rezultat.valoare[0]?.explicatie).toMatch(/acceptă separat/);
  });
});

describe("ordinea", () => {
  it("numerotează pașii de la zero, în ordinea trimiterii", () => {
    const rezultat = planificaMesaje(stare());
    expect(rezultat.ok).toBe(true);
    if (!rezultat.ok) return;
    expect(rezultat.valoare.map((p) => p.ordine)).toEqual([0, 1]);
  });
});
