import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as model from "./model";

const SURSA = readFileSync("src/app/(marketing)/unelte/condica-de-prezenta/page.tsx", "utf8");

describe("pagina condicii", () => {
  it("formularul trimite programul și antetul firmei", () => {
    for (const camp of ["an", "luna", "program", "firma", "cui", "compartiment", "angajati"]) {
      expect(SURSA, camp).toContain(`name="${camp}"`);
    }
  });

  it("are banda ITM și întrebările comune", () => {
    expect(SURSA).toContain("<CeCereItm");
    expect(SURSA).toContain("<IntrebariUnealta");
    expect(SURSA).not.toContain("construiesteCondica(");
  });

  it("compatibilitatea de dinainte de 8 oct 2026 a plecat din model", () => {
    expect("construiesteCondica" in model).toBe(false);
    const p = model.parametriCondica(new URLSearchParams({ firma: "X" }));
    expect("firma" in p).toBe(false);
    expect(p.antet.firma).toBe("X");
    expect(p.notaAngajati).toBeNull(); // mecanica lui B4 rămâne
  });
});
