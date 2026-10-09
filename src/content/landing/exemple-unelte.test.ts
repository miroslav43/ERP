// src/content/landing/exemple-unelte.test.ts
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fisaEvaluareDinParametri } from "@/app/(marketing)/unelte/fisa-evaluare/model";
import { constructorPentru, type Constructor } from "@/lib/unelte/registru";

import { EXEMPLE_UNELTE, adresaExemplu, exempluPentru, srcCaptura } from "./exemple-unelte";

/**
 * Uneltele cu rută statică proprie nu mai sunt în `UNELTE`: I7 mută fișa de
 * evaluare pe `/api/unelte/fisa-evaluare`. Constructorul ei rămâne exportat din
 * `model.ts` (I6), deci exemplul se verifică tot pe documentul real.
 */
const RUTE_STATICE: Readonly<Record<string, Constructor>> = {
  "fisa-evaluare": fisaEvaluareDinParametri,
};
const constructorExemplu = (api: string): Constructor | undefined =>
  constructorPentru(api) ?? (Object.hasOwn(RUTE_STATICE, api) ? RUTE_STATICE[api] : undefined);

describe("exemplele completate", () => {
  it("fiecare exemplu e construit de unealta lui și conține datele pe care le arată", () => {
    expect(EXEMPLE_UNELTE.length).toBeGreaterThanOrEqual(5);
    for (const e of EXEMPLE_UNELTE) {
      const construieste = constructorExemplu(e.api);
      expect(construieste, e.api).toBeTypeOf("function");
      if (construieste === undefined) continue;
      const document = JSON.stringify(construieste(new URLSearchParams(e.parametri)));
      for (const v of e.verificate) expect(document, `${e.api}: „${v}”`).toContain(v);
    }
  });

  it("textul alternativ spune „model completat”, forma căutată", () => {
    for (const e of EXEMPLE_UNELTE) expect(e.alt, e.api).toMatch(/model completat/u);
  });

  it("capturile există pe disc, la ambele mărimi", () => {
    for (const e of EXEMPLE_UNELTE) {
      for (const latura of [600, 1200] as const) {
        expect(existsSync(`public${srcCaptura(e, latura)}`), srcCaptura(e, latura)).toBe(true);
      }
    }
  });

  it("pagina fiecărei unelte cu exemplu îl randează și îl pune în datele structurate", () => {
    for (const e of EXEMPLE_UNELTE) {
      const sursa = readFileSync(`src/app/(marketing)${e.pagina}/page.tsx`, "utf8");
      expect(sursa, e.pagina).toContain("<ExempluCompletat");
      expect(sursa, e.pagina).toContain("imagineExemplu(");
    }
  });

  it("adresa exemplului deschide documentul, cu parametrii codați", () => {
    const e = exempluPentru("/unelte/programare-concedii");
    expect(e).toBeDefined();
    if (e === undefined) return;
    expect(adresaExemplu(e)).toMatch(
      /^\/unelte\/programare-concedii\?an=2027&.*angajati=Popescu\+Ana%0AIonescu\+Mihai/u,
    );
    expect(adresaExemplu(e).endsWith("#documentul")).toBe(true);
  });

  it("datele exemplelor sunt fictive și ale noastre: firma demo, fără CUI", () => {
    for (const e of EXEMPLE_UNELTE) {
      const firma = e.parametri["firma"] ?? e.parametri["angajator"];
      if (firma !== undefined) expect(firma, e.api).toBe("Administrativo Demo SRL");
      expect(e.parametri["cui"], e.api).toBeUndefined();
    }
  });
});
