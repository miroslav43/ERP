// src/domain/calendar/sarbatori-cult.test.ts

import { describe, expect, it } from "vitest";

import { sarbatoriDupaZi } from "./sarbatori";
import { sarbatoriAnuluiPentruCult, sarbatoriDupaZiPentruCult } from "./sarbatori-cult";

/**
 * Ce apără: art. 139 alin. (2¹) din Codul muncii — pentru un salariat de alt
 * cult creștin, Vinerea Mare, Paștele și Rusaliile cad la datele cultului lui.
 * Datele de mai jos sunt scrise de mână (Paștele gregorian 2026 = 5 aprilie,
 * 2027 = 28 martie), nu derivate din funcția testată.
 */
describe("sărbătorile după calendarul Paștelui", () => {
  it("ortodox: exact harta din sarbatoriDupaZi", () => {
    for (const an of [2024, 2026, 2027]) {
      expect([...sarbatoriDupaZiPentruCult(an, "ortodox")], String(an)).toEqual([
        ...sarbatoriDupaZi(an),
      ]);
    }
  });

  it("gregorian 2026: zilele mobile se mută, fixele rămân", () => {
    const h = sarbatoriDupaZiPentruCult(2026, "gregorian");
    expect(h.get("2026-04-03")).toBe("Vinerea Mare");
    expect(h.get("2026-04-05")).toBe("Paștele");
    expect(h.get("2026-04-06")).toBe("A doua zi de Paște");
    expect(h.get("2026-05-24")).toBe("Rusaliile");
    expect(h.get("2026-05-25")).toBe("A doua zi de Rusalii");
    // Datele ortodoxe nu mai sunt zile libere pentru acest salariat — alin. (3¹).
    expect(h.has("2026-04-10")).toBe(false);
    expect(h.has("2026-04-13")).toBe(false);
    // 1 iunie rămâne Ziua Copilului, fără a doua zi de Rusalii ortodoxă.
    expect(h.get("2026-06-01")).toBe("Ziua Copilului");
    expect(h.get("2026-12-25")).toBe("Crăciunul");
    expect(h.size).toBe(17);
  });

  it("gregorian 2027: Paștele pe 28 martie, Rusaliile pe 16 mai", () => {
    const h = sarbatoriDupaZiPentruCult(2027, "gregorian");
    for (const zi of ["2027-03-26", "2027-03-28", "2027-03-29", "2027-05-16", "2027-05-17"]) {
      expect(h.has(zi), zi).toBe(true);
    }
    for (const zi of ["2027-04-30", "2027-05-02", "2027-05-03", "2027-06-20", "2027-06-21"]) {
      expect(h.has(zi), zi).toBe(false);
    }
  });

  it("când Paștele coincide (2025, 2028), cele două calendare dau aceleași zile", () => {
    for (const an of [2025, 2028]) {
      expect([...sarbatoriDupaZiPentruCult(an, "gregorian").keys()].sort(), String(an)).toEqual(
        [...sarbatoriDupaZi(an).keys()].sort(),
      );
    }
  });

  it("lista are 12 sărbători fixe și 5 mobile, în ordine cronologică", () => {
    const lista = sarbatoriAnuluiPentruCult(2026, "gregorian");
    expect(lista.filter((s) => s.tip === "fix")).toHaveLength(12);
    expect(lista.filter((s) => s.tip === "mobil")).toHaveLength(5);
    const timpi = lista.map((s) => s.data.getTime());
    expect(timpi).toEqual([...timpi].sort((a, b) => a - b));
  });
});
