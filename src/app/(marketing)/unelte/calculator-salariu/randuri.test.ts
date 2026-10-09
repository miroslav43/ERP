import { describe, expect, it } from "vitest";

import { dinBrut } from "@/lib/unelte/salariu";

import { randuriDesfasurator } from "./randuri";

const suma = (randuri: readonly { valoare: number; fel: string }[], fel: string) =>
  randuri.filter((r) => r.fel === fel).reduce((s, r) => s + r.valoare, 0);

describe("rândurile desfășurătorului", () => {
  it("la angajat se închid cu creionul: brut − ce se scade = net", () => {
    for (const brut of [4325, 4500, 5000, 6000, 10000]) {
      const r = dinBrut(brut, 0, true);
      const { angajat } = randuriDesfasurator(r);
      expect(r.brut - suma(angajat, "minus"), String(brut)).toBe(r.net);
      expect(angajat.at(-1)).toEqual({ eticheta: "Salariu net", valoare: r.net, fel: "total" });
    }
  });

  it("la firmă se închid pe cost: brut + CAM = cost total", () => {
    const r = dinBrut(5000, 0, true);
    const { angajator } = randuriDesfasurator(r);
    expect(suma(angajator, "plus")).toBe(r.costTotal);
    expect(angajator.at(-1)?.eticheta).toBe("Cost total pentru firmă");
  });

  it("suma neimpozabilă apare doar la salariul minim", () => {
    const eticheta = "Din care neimpozabil (OUG 89/2025)";
    const laMinim = randuriDesfasurator(dinBrut(4325, 0, true)).angajat.map((x) => x.eticheta);
    const pesteMinim = randuriDesfasurator(dinBrut(4326, 0, true)).angajat.map((x) => x.eticheta);
    expect(laMinim).toContain(eticheta);
    expect(pesteMinim).not.toContain(eticheta);
  });
});
