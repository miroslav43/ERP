// src/domain/hr/cnp.test.ts
//
// Validatorul de CNP folosit de schemele de angajat, de acțiunea fișei și de
// generatorul D112. Dublura din `src/domain/employee/cnp.ts` are testul ei;
// cele două NU se unifică aici (dublura respinge cifra 9 și numărul de ordine
// 000, deci ar schimba comportamentul pe alte CNP-uri).
//
// Niciun CNP real: cifrele de control sunt calculate cu cheia 279146358279.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateazaCnp } from "./cnp";

/** Bărbat născut la 1 ianuarie 2096 — cifra 5 dă secolul 2000, deci anul e în viitor. */
const CNP_DIN_VIITOR = "5960101123453";
/** Bărbat născut la 29 februarie 1996 — an bisect, dată reală. */
const CNP_1996 = "1960229123452";

describe("validateazaCnp — data nașterii în viitor", () => {
  // QA 8 oct 2026, HR-002: un CNP cu anul 2096 trecea de validare și ajungea
  // criptat în bază, unde un CHECK nici nu l-ar putea citi.
  it("respinge un CNP a cărui dată de naștere e după `astazi`", () => {
    const rezultat = validateazaCnp(CNP_DIN_VIITOR, { astazi: "2026-10-12" });
    expect(rezultat.valid).toBe(false);
    if (rezultat.valid) return;
    expect(rezultat.motiv).toContain("în viitor");
  });

  it("același CNP e valid când `astazi` a trecut de data nașterii", () => {
    const rezultat = validateazaCnp(CNP_DIN_VIITOR, { astazi: "2097-01-01" });
    expect(rezultat.valid).toBe(true);
    if (!rezultat.valid) return;
    expect(rezultat.dataNasterii).toBe("2096-01-01");
    expect(rezultat.gen).toBe("masculin");
  });

  it("data nașterii egală cu `astazi` nu e în viitor", () => {
    const rezultat = validateazaCnp(CNP_DIN_VIITOR, { astazi: "2096-01-01" });
    expect(rezultat.valid).toBe(true);
  });

  it("un CNP din 1996 rămâne valid, cu data și genul extrase", () => {
    const rezultat = validateazaCnp(CNP_1996, { astazi: "2026-10-12" });
    expect(rezultat.valid).toBe(true);
    if (!rezultat.valid) return;
    expect(rezultat.dataNasterii).toBe("1996-02-29");
    expect(rezultat.gen).toBe("masculin");
  });
});

describe("validateazaCnp — fără `astazi` citește ceasul", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pe 12 octombrie 2026, anul 2096 e în viitor", () => {
    vi.setSystemTime(new Date("2026-10-12T10:00:00Z"));
    const rezultat = validateazaCnp(CNP_DIN_VIITOR);
    expect(rezultat.valid).toBe(false);
    if (rezultat.valid) return;
    expect(rezultat.motiv).toContain("în viitor");
  });

  it("pe 2 ianuarie 2096, același CNP e valid", () => {
    vi.setSystemTime(new Date("2096-01-02T10:00:00Z"));
    expect(validateazaCnp(CNP_DIN_VIITOR).valid).toBe(true);
  });
});

describe("validateazaCnp — refuzurile de dinaintea datei", () => {
  it("13 cifre, nu mai puține", () => {
    const rezultat = validateazaCnp("196022912345");
    expect(rezultat.valid).toBe(false);
    if (rezultat.valid) return;
    expect(rezultat.motiv).toContain("13 cifre");
  });

  it("cifra de control greșită", () => {
    const rezultat = validateazaCnp("1960229123451");
    expect(rezultat.valid).toBe(false);
    if (rezultat.valid) return;
    expect(rezultat.motiv).toContain("control");
  });

  it("separatoarele se ignoră la normalizare", () => {
    expect(validateazaCnp("1 960229 123452", { astazi: "2026-10-12" }).valid).toBe(true);
  });
});
