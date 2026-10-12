import { describe, expect, it } from "vitest";

import {
  intervalExplicit,
  numar,
  parseazaEvenimente,
  randeazaDate,
  randeazaRaport,
  saptamanaTrecuta,
  valoareDinEnv,
} from "./agregare.mjs";

describe("valoareDinEnv", () => {
  it("citește o singură cheie, cu ghilimele, fără să confunde prefixele", () => {
    const text =
      "A=1\nXUMAMI_ADMIN_PAROLA=nu\r\nUMAMI_ADMIN_PAROLA=\"s3cr=et\"\r\nB=\nC='unu doi'\n";
    expect(valoareDinEnv(text, "UMAMI_ADMIN_PAROLA")).toBe("s3cr=et");
    expect(valoareDinEnv(text, "C")).toBe("unu doi");
    expect(valoareDinEnv(text, "B")).toBeNull();
    expect(valoareDinEnv(text, "LIPSA")).toBeNull();
  });
});

describe("numar", () => {
  it("acceptă numere, șiruri și forma veche { value }", () => {
    expect(numar(3)).toBe(3);
    expect(numar("4")).toBe(4);
    expect(numar({ value: 5 })).toBe(5);
    expect(numar(null)).toBe(0);
    expect(numar("x")).toBe(0);
  });
});

describe("săptămâna", () => {
  it("joi, 8 oct 2026 → săptămâna ISO 40, de luni până duminică", () => {
    const s = saptamanaTrecuta(new Date("2026-10-08T12:00:00Z"));
    expect(s.de.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(s.pana.toISOString()).toBe("2026-10-04T23:59:59.999Z");
    expect(s.eticheta).toBe("2026-S40");
  });

  it("lunea dă săptămâna care tocmai s-a încheiat, nu pe cea de azi", () => {
    expect(saptamanaTrecuta(new Date("2026-10-05T01:00:00Z")).eticheta).toBe("2026-S40");
    expect(saptamanaTrecuta(new Date("2026-10-04T23:00:00Z")).eticheta).toBe("2026-S39");
  });

  it("peste an: 6 ian 2027 → 2026-S53", () => {
    const s = saptamanaTrecuta(new Date("2027-01-06T08:00:00Z"));
    expect(s.de.toISOString()).toBe("2026-12-28T00:00:00.000Z");
    expect(s.eticheta).toBe("2026-S53");
  });

  it("intervalul explicit include ambele zile și refuză datele greșite", () => {
    const i = intervalExplicit("2026-10-01", "2026-10-07");
    expect(i.de.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(i.pana.toISOString()).toBe("2026-10-07T23:59:59.999Z");
    expect(() => intervalExplicit("2026-10-07", "2026-10-01")).toThrow("Intervalul e inversat.");
    expect(() => intervalExplicit("1 oct", "2026-10-07")).toThrow("AAAA-LL-ZZ");
    expect(() => intervalExplicit("2026-13-40", "2026-10-07")).toThrow("Data nu există.");
  });
});

const RANDURI = [
  { x: "dl:foaie-de-pontaj:xlsx:om", y: 1 },
  { x: "dl:foaie-de-pontaj:xlsx:neconfirmat", y: "1" },
  { x: "dl:foaie-de-pontaj:pdf:audit", y: 3 },
  { x: "dl:condica-de-prezenta:docx:robot", y: 2 },
  { x: "cont:foaie-de-pontaj", y: 1 },
  { x: "cont:direct", y: 2 },
  { x: "foaie-genereaza", y: 4 },
  { x: "condica-pdf", y: 1 },
  { x: "cta-foaie-de-pontaj", y: 1 },
  { x: "citire", y: 42 },
  { x: "dl:rau", y: 9 },
  { x: "calc:calculator-salariu:om", y: 5 },
  { x: "calc:calculator-salariu:neconfirmat", y: "2" },
];

describe("parseazaEvenimente", () => {
  it("separă descărcările pe clasă, formatele oamenilor și conturile", () => {
    const e = parseazaEvenimente(RANDURI);
    expect(e.unelte.get("foaie-de-pontaj")).toEqual({
      om: 1,
      neconfirmat: 1,
      robot: 0,
      audit: 3,
      formate: { xlsx: 2 },
      conturi: 1,
    });
    expect(e.unelte.get("condica-de-prezenta")?.robot).toBe(2);
    expect(e.conturiDirecte).toBe(2);
    expect(e.browser).toEqual([
      { nume: "foaie-genereaza", numar: 4 },
      { nume: "condica-pdf", numar: 1 },
      { nume: "cta-foaie-de-pontaj", numar: 1 },
    ]);
  });
});

describe("calculatorul de salariu", () => {
  it("calculele de pe server se numără pe clasă, separat de descărcări", () => {
    const e = parseazaEvenimente(RANDURI);
    expect(e.calcule).toEqual({ om: 5, neconfirmat: 2, robot: 0, audit: 0 });
    expect(e.unelte.has("calculator-salariu")).toBe(false);
  });
});

describe("randeazaDate", () => {
  it("o tabelă pe eveniment și câmp, valorile ordonate după număr", () => {
    const text = randeazaDate([
      {
        eveniment: "dl:foaie-de-pontaj:xlsx:om",
        camp: "angajati",
        valori: [
          { valoare: "3", numar: 1 },
          { valoare: "12", numar: 4 },
        ],
      },
      {
        eveniment: "calc:calculator-salariu:om",
        camp: "brut",
        valori: [{ valoare: "5000-10000", numar: 2 }],
      },
    ]);
    expect(text).toContain("## Datele evenimentelor (server)");
    expect(text).toContain("| dl:foaie-de-pontaj:xlsx:om | angajati | 12 4 · 3 1 |");
    expect(text).toContain("| calc:calculator-salariu:om | brut | 5000-10000 2 |");
  });

  it("fără date sau cu API-ul indisponibil, o spune", () => {
    expect(randeazaDate([])).toContain("(nicio proprietate de eveniment)");
    expect(randeazaDate(null)).toContain("nu s-au putut citi");
  });
});

describe("randeazaRaport", () => {
  it("un rând pe unealtă, ordonat după oamenii care au descărcat, cu totalul", () => {
    const text = randeazaRaport({
      eticheta: "2026-S40",
      de: new Date("2026-09-28T00:00:00.000Z"),
      pana: new Date("2026-10-04T23:59:59.999Z"),
      vizitatori: new Map([
        ["foaie-de-pontaj", 2],
        ["calculator-salariu", 1],
      ]),
      evenimente: parseazaEvenimente(RANDURI),
    });
    expect(text).toContain("# Uneltele gratuite — 2026-S40 (2026-09-28 – 2026-10-04)");
    const randuri = text.split("\n").filter((l) => l.startsWith("| "));
    expect(randuri.slice(2, 6)).toEqual([
      "| foaie-de-pontaj | 2 | 1 | 1 | 0 | 3 | xlsx 2 | 1 |",
      "| calculator-salariu | 1 | 0 | 0 | 0 | 0 | — | 0 |",
      "| condica-de-prezenta | 0 | 0 | 0 | 2 | 0 | — | 0 |",
      "| **Total** | 3 | 1 | 1 | 2 | 3 | | 1 |",
    ]);
    expect(text).toContain("Conturi fără unealtă (direct): 2");
    expect(text).toContain("| foaie-genereaza | 4 |");
    expect(text).toContain("Calcule de salariu (server): om 5 · neconfirmat 2 · robot 0 · audit 0");
  });

  it("o săptămână fără nimic se spune, nu se ascunde", () => {
    const text = randeazaRaport({
      eticheta: "2026-S41",
      de: new Date("2026-10-05T00:00:00.000Z"),
      pana: new Date("2026-10-11T23:59:59.999Z"),
      vizitatori: new Map(),
      evenimente: parseazaEvenimente([]),
    });
    expect(text).toContain("| **Total** | 0 | 0 | 0 | 0 | 0 | | 0 |");
    expect(text).toContain("(niciun eveniment)");
  });
});
