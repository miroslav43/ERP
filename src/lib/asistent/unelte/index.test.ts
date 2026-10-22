// src/lib/asistent/unelte/index.test.ts
/**
 * Registrul uneltelor, văzut din partea modelului.
 *
 * Gemini, prin OpenRouter, acceptă doar un subset de JSON Schema; o unealtă cu
 * un cuvânt-cheie nesuportat (de exemplu `pattern`, din `.regex()`) face să
 * cadă cererea pentru TOATE uneltele, nu doar pentru ea. Precedentul din
 * producție (`cauta_om`, `sold_concediu`) folosește doar `type`, `properties`,
 * `required`, `description`, `minimum`/`maximum`, `minLength`/`maxLength`.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { declaraPentruModel, TOATE_UNELTELE } from "./index";

const UNELTE_FLOTA = [
  "scadente_flota",
  "vehicule_fara_foi",
  "consum_fata_de_norma",
  "cine_are_masina",
  "propune_foaia_de_azi",
  "scadente_soferi",
];

describe("registrul", () => {
  it("are uneltele de flotă, fiecare o singură dată", () => {
    const nume = TOATE_UNELTELE.map((u) => u.nume);
    expect(new Set(nume).size).toBe(nume.length);
    for (const n of UNELTE_FLOTA) expect(nume, n).toContain(n);
  });

  it("uneltele de flotă cer modulul `fleet` și o permisiune", () => {
    for (const u of TOATE_UNELTELE.filter((x) => UNELTE_FLOTA.includes(x.nume))) {
      expect(u.featureKey, u.nume).toBe("fleet");
      expect(u.permission, u.nume).not.toBeNull();
    }
  });

  it("nicio unealtă nu trimite modelului `pattern` sau `format`", () => {
    for (const declaratie of declaraPentruModel(TOATE_UNELTELE)) {
      const schema = JSON.stringify(declaratie.function.parameters);
      expect(schema, declaratie.function.name).not.toContain('"pattern"');
      expect(schema, declaratie.function.name).not.toContain('"format"');
    }
  });

  it("descrierile sunt scurte: intră în prompt la fiecare întrebare", () => {
    for (const u of TOATE_UNELTELE) {
      expect(u.descriere.length, u.nume).toBeLessThanOrEqual(400);
    }
  });
});
