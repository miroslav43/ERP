// src/lib/fleet/jeton-bon.test.ts
//
// Jetonul care duce propunerea citită de la `citesteBonul` la
// `adaugaAlimentare` (F12a D12): semnare → verificare, legătura cu firma, omul,
// foaia și poza, expirarea la 2 ore, falsificarea.

import { afterEach, describe, expect, it, vi } from "vitest";

import type { PropunereBon } from "@/domain/fleet/bon-ocr";

import { PLAFON_PROPUNERE_OCTETI, semneazaPropunere, verificaJeton } from "./jeton-bon";

const LEGATURA = {
  org: "11111111-1111-4111-8111-111111111111",
  user: "33333333-3333-4333-8333-333333333333",
  foaie: "55555555-5555-4555-8555-555555555555",
  cale: "11111111-1111-4111-8111-111111111111/trip_sheets/55555555-5555-4555-8555-555555555555/x-bon.jpg",
} as const;

const PROPUNERE: PropunereBon = {
  alimentat_la: "2026-10-07T14:32",
  litri: 45.32,
  cost: 312.5,
  statie: "OMV Pitești Nord",
  numar_bon: "0042",
  cui_statie: "14399840",
};

const ACUM = new Date("2026-10-07T12:00:00.000Z");

function jeton(avertismente: readonly string[] = ["Bonul are și alte produse."]): string {
  return semneazaPropunere(
    { ...LEGATURA, propunere: PROPUNERE, model: "google/gemini-3.7-flash", avertismente },
    ACUM,
  );
}

/** Schimbă un caracter din partea dată (0 = corp, 1 = semnătură). */
function altereaza(j: string, parte: 0 | 1): string {
  const parti = j.split(".");
  const tinta = parti[parte] ?? "";
  const mijloc = Math.floor(tinta.length / 2);
  const c = tinta[mijloc] === "A" ? "B" : "A";
  parti[parte] = `${tinta.slice(0, mijloc)}${c}${tinta.slice(mijloc + 1)}`;
  return parti.join(".");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("semneazaPropunere / verificaJeton", () => {
  it("ciclul semnare → verificare ⇒ `ok`, cu aceeași propunere", () => {
    const r = verificaJeton(jeton(), LEGATURA, ACUM);
    expect(r.stare).toBe("ok");
    if (r.stare !== "ok") return;
    expect(r.propunere).toEqual({
      ...PROPUNERE,
      model: "google/gemini-3.7-flash",
      citit_la: ACUM.toISOString(),
      avertismente: ["Bonul are și alte produse."],
    });
  });

  it("un caracter schimbat în corp sau în semnătură ⇒ `invalid`", () => {
    expect(verificaJeton(altereaza(jeton(), 0), LEGATURA, ACUM).stare).toBe("invalid");
    expect(verificaJeton(altereaza(jeton(), 1), LEGATURA, ACUM).stare).toBe("invalid");
  });

  it.each([
    ["user", { user: "44444444-4444-4444-8444-444444444444" }],
    ["org", { org: "22222222-2222-4222-8222-222222222222" }],
    ["foaie", { foaie: "66666666-6666-4666-8666-666666666666" }],
    ["cale", { cale: `${LEGATURA.cale}.alta` }],
    ["cale lipsă", { cale: null }],
  ])("alt %s ⇒ `invalid`", (_eticheta, schimbare) => {
    expect(verificaJeton(jeton(), { ...LEGATURA, ...schimbare }, ACUM).stare).toBe("invalid");
  });

  it("după 2 h + 1 s ⇒ `expirat`; la 2 h fix ⇒ încă `ok`", () => {
    vi.useFakeTimers();
    vi.setSystemTime(ACUM);
    const j = jeton();
    vi.setSystemTime(new Date(ACUM.getTime() + 2 * 3600_000));
    expect(verificaJeton(j, LEGATURA).stare).toBe("ok");
    vi.setSystemTime(new Date(ACUM.getTime() + 2 * 3600_000 + 1000));
    expect(verificaJeton(j, LEGATURA).stare).toBe("expirat");
  });

  it("semnătură de lungime greșită ⇒ `invalid`, fără excepție", () => {
    const [corp] = jeton().split(".");
    expect(() => verificaJeton(`${corp ?? ""}.abc`, LEGATURA, ACUM)).not.toThrow();
    expect(verificaJeton(`${corp ?? ""}.abc`, LEGATURA, ACUM).stare).toBe("invalid");
  });

  it.each([[""], ["fara-punct"], ["a.b.c"], ["."], ["corp."]])("forma „%s” ⇒ `invalid`", (j) => {
    expect(verificaJeton(j, LEGATURA, ACUM).stare).toBe("invalid");
  });

  it("peste plafon, avertismentele se scot, nu se aruncă", () => {
    const lungi = Array.from({ length: 8 }, (_, i) => `${String(i)} ${"x".repeat(600)}`);
    const r = verificaJeton(jeton(lungi), LEGATURA, ACUM);
    expect(r.stare).toBe("ok");
    if (r.stare !== "ok") return;
    expect(r.propunere.avertismente.length).toBeLessThanOrEqual(8);
    const marime = Buffer.byteLength(JSON.stringify({ v: 1, ...r.propunere, cale: LEGATURA.cale }));
    expect(marime).toBeLessThanOrEqual(PLAFON_PROPUNERE_OCTETI);
  });
});
