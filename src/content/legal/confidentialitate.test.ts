import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SECTIUNI_CONFIDENTIALITATE } from "./confidentialitate";

const politica = JSON.stringify(SECTIUNI_CONFIDENTIALITATE);

describe("politica despre uneltele gratuite", () => {
  it("numește uneltele și spune unde ajung valorile din câmpuri", () => {
    expect(politica).toContain("administrativo.ro/unelte");
    expect(politica).toMatch(/nu ajung în statisticile de vizitare/u);
    expect(politica).toMatch(/istoricul browserului/u);
    expect(politica).toMatch(/Cloudflare/u);
  });

  it("declară jurnalul de acces al serverului și temeiul lui", () => {
    expect(politica).toMatch(/jurnalul de acces al serverului —/u);
    expect(politica).toMatch(/Jurnalul de acces al serverului: interesul nostru legitim/u);
  });

  it("spune că GA tace pe pagina de unealtă cu valori completate", () => {
    expect(politica).toMatch(/nu trimite nimic la Google Analytics/u);
  });
});

describe("promisiunea de pe /unelte", () => {
  const pagina = readFileSync("src/app/(marketing)/unelte/page.tsx", "utf8");

  it("nu mai promite că nimic nu e reținut", () => {
    expect(pagina).not.toMatch(/niciuna\s+nu\s+reține\s+ce\s+scrii/u);
    expect(pagina).not.toMatch(/fără să rețină ceva/u);
  });

  it("spune că valorile rămân în adresă și trimite la politică", () => {
    expect(pagina).toMatch(/istoricul\s+browserului/u);
    expect(pagina).toContain('href="/legal/confidentialitate#sectiunea-2"');
  });
});
