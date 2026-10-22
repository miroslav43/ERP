// src/domain/fleet/uit.test.ts
import { describe, expect, it } from "vitest";

import {
  arataSectiuneaUit,
  avertismenteCursa,
  cifreDeControlUit,
  dataInceputNeobisnuita,
  grupeazaUit,
  intervalValabilitate,
  normalizeazaUit,
  numaraAvertismentePeFoi,
  stareUitLaZi,
  verificaUit,
} from "./uit";

/** Cele 11 exemple din comentariul Schematron-ului ANAF v2.0.2 (regula BR-019). */
const EXEMPLE_ANAF = [
  "3V0P0L0P0T3JUW46",
  "4C0U0C0J0W3DDQ92",
  "5Y0Q0L0A0Y3AJA00",
  "6N0U0A0A0K3PUM07",
  "7M0L0P0H0K3RAP05",
  "8H0Q0V0L0Q3WQN41",
  "9E0P0C0J0J3DQV99",
  "0C1E0K0N0M3EHP79",
  "1C1E0Y0Y0N3YLK25",
  "2D1R0D0L0N3CYH94",
  "3H1M0A0E0J3FKN75",
] as const;

describe("verificaUit — formatul și cifrele de control ANAF", () => {
  it.each(EXEMPLE_ANAF)("exemplul oficial %s trece", (uit) => {
    expect(verificaUit(uit)).toEqual({ ok: true });
  });

  it("suma de control a primului exemplu e 946, deci cifrele sunt „46”", () => {
    expect(cifreDeControlUit("3V0P0L0P0T3JUW")).toBe("46");
  });

  it("ultima cifră schimbată ⇒ control", () => {
    expect(verificaUit("3V0P0L0P0T3JUW47")).toEqual({ ok: false, problema: "control" });
  });

  it("15 caractere ⇒ lungime", () => {
    expect(verificaUit("3V0P0L0P0T3JUW4")).toEqual({ ok: false, problema: "lungime" });
  });

  it("litera B ⇒ caractere ÎNAINTE de normalizare, valid DUPĂ (B → 8)", () => {
    expect(verificaUit("BH0Q0V0L0Q3WQN41")).toEqual({ ok: false, problema: "caractere" });
    expect(normalizeazaUit("BH0Q0V0L0Q3WQN41")).toBe("8H0Q0V0L0Q3WQN41");
    expect(verificaUit(normalizeazaUit("BH0Q0V0L0Q3WQN41"))).toEqual({ ok: true });
  });

  it("literele în ultimele două poziții ⇒ caractere, nu control", () => {
    expect(verificaUit("3V0P0L0P0T3JUWAA")).toEqual({ ok: false, problema: "caractere" });
  });
});

describe("normalizeazaUit", () => {
  it("majuscule, fără spații, cratime sau puncte", () => {
    expect(normalizeazaUit(" 3v0p-0l0p 0t3j.uw46 ")).toBe("3V0P0L0P0T3JUW46");
  });

  it("literele asemănătoare devin cifre: O→0 I→1 Z→2 S→5 G→6 B→8", () => {
    expect(normalizeazaUit("OIZSGB")).toBe("012568");
    expect(verificaUit(normalizeazaUit("3vopolopot3juw46"))).toEqual({ ok: true });
  });

  it("grupează codul în patru pentru afișare", () => {
    expect(grupeazaUit("3V0P0L0P0T3JUW46")).toBe("3V0P 0L0P 0T3J UW46");
  });
});

describe("intervalValabilitate — ziua de început e ziua 1", () => {
  it("exemplul ANAF: 24.06 cu 5 zile ⇒ valabil până pe 28.06, expirat din 29.06", () => {
    expect(intervalValabilitate("2024-06-24", 5)).toEqual({
      ultimaZiValabila: "2024-06-28",
      primaZiExpirata: "2024-06-29",
    });
  });

  it("15 zile peste sfârșitul de lună", () => {
    expect(intervalValabilitate("2026-01-25", 15)).toEqual({
      ultimaZiValabila: "2026-02-08",
      primaZiExpirata: "2026-02-09",
    });
  });

  it("trecerea la ora de vară (29–30 martie) nu deplasează ziua", () => {
    expect(intervalValabilitate("2026-03-28", 5)).toEqual({
      ultimaZiValabila: "2026-04-01",
      primaZiExpirata: "2026-04-02",
    });
    expect(intervalValabilitate("2026-03-29", 1)).toEqual({
      ultimaZiValabila: "2026-03-29",
      primaZiExpirata: "2026-03-30",
    });
  });
});

describe("stareUitLaZi", () => {
  const u = { data_inceput: "2024-06-24", valabilitate_zile: 5 };

  it("ziua de început ⇒ valabil", () => {
    expect(stareUitLaZi(u, "2024-06-24")).toBe("valabil");
  });
  it("ultima zi ⇒ valabil", () => {
    expect(stareUitLaZi(u, "2024-06-28")).toBe("valabil");
  });
  it("prima zi expirată ⇒ expirat", () => {
    expect(stareUitLaZi(u, "2024-06-29")).toBe("expirat");
  });
  it("ziua dinainte de început ⇒ neînceput", () => {
    expect(stareUitLaZi(u, "2024-06-23")).toBe("neinceput");
  });
});

describe("avertismenteCursa", () => {
  const valabil = { uit: "3V0P0L0P0T3JUW46", data_inceput: "2026-10-20", valabilitate_zile: 5 };
  const expirat = { uit: "4C0U0C0J0W3DDQ92", data_inceput: "2026-10-01", valabilitate_zile: 5 };

  it("neaplicabil fără UIT ⇒ nimic", () => {
    expect(avertismenteCursa({ e_transport: "neaplicabil" }, [], "2026-10-21", 3500)).toEqual([]);
  });

  it("risc fiscal fără UIT ⇒ lipsa_uit", () => {
    expect(
      avertismenteCursa({ e_transport: "risc_fiscal_national" }, [], "2026-10-21", 3500),
    ).toEqual([{ tip: "lipsa_uit" }]);
  });

  it("neaplicabil CU un UIT expirat ⇒ monitorizată implicit, uit_expirat", () => {
    expect(
      avertismenteCursa({ e_transport: "neaplicabil" }, [expirat], "2026-10-21", 3500),
    ).toEqual([{ tip: "uit_expirat", uit: expirat.uit, primaZiExpirata: "2026-10-06" }]);
  });

  it("UIT care începe după ziua foii ⇒ uit_neinceput", () => {
    expect(
      avertismenteCursa({ e_transport: "international" }, [valabil], "2026-10-19", 3500),
    ).toEqual([{ tip: "uit_neinceput", uit: valabil.uit, dataInceput: "2026-10-20" }]);
  });

  it("UIT valabil în ziua foii ⇒ nimic", () => {
    expect(
      avertismenteCursa({ e_transport: "international" }, [valabil], "2026-10-21", 3500),
    ).toEqual([]);
  });

  it("masa 1800 kg ⇒ vehicul_sub_prag (doar notă)", () => {
    expect(
      avertismenteCursa({ e_transport: "risc_fiscal_national" }, [valabil], "2026-10-21", 1800),
    ).toEqual([{ tip: "vehicul_sub_prag", masaKg: 1800 }]);
  });

  it("masa necunoscută ⇒ fără nota de prag", () => {
    expect(
      avertismenteCursa({ e_transport: "risc_fiscal_national" }, [valabil], "2026-10-21", null),
    ).toEqual([]);
  });

  it("cursă nemonitorizată pe vehicul ușor ⇒ nici nota de prag", () => {
    expect(avertismenteCursa({ e_transport: "neaplicabil" }, [], "2026-10-21", 1200)).toEqual([]);
  });
});

describe("numaraAvertismentePeFoi — pastila din coada de aprobări", () => {
  const foi = [
    { id: "f1", data: "2026-10-21" },
    { id: "f2", data: "2026-10-21" },
    { id: "f3", data: "2026-10-21" },
  ];

  it("numără lipsa și codurile nevalabile, inclusiv pe cursa „neaplicabil” cu UIT", () => {
    const curse = [
      { id: "c1", trip_sheet_id: "f1", e_transport: "risc_fiscal_national" as const },
      { id: "c2", trip_sheet_id: "f1", e_transport: "international" as const },
      { id: "c3", trip_sheet_id: "f2", e_transport: "neaplicabil" as const },
      { id: "c4", trip_sheet_id: "f3", e_transport: "neaplicabil" as const },
      { id: "c5", trip_sheet_id: "altă-foaie", e_transport: "international" as const },
    ];
    const uituri = [
      { cursa_id: "c2", uit: "3V0P0L0P0T3JUW46", data_inceput: "2026-10-20", valabilitate_zile: 5 },
      { cursa_id: "c3", uit: "4C0U0C0J0W3DDQ92", data_inceput: "2026-10-01", valabilitate_zile: 5 },
    ];
    expect(Object.fromEntries(numaraAvertismentePeFoi(foi, curse, uituri))).toEqual({
      f1: 1, // c1 fără UIT; c2 are un cod valabil
      f2: 1, // c3: cod expirat, deși cursa e „neaplicabil”
      f3: 0, // c4 nemonitorizată
    });
  });
});

describe("arataSectiuneaUit — decizia I-f1", () => {
  it("vehicul ≥ 2.500 kg sau masă necunoscută ⇒ da", () => {
    expect(arataSectiuneaUit(3500, { e_transport: "neaplicabil" }, 0)).toBe(true);
    expect(arataSectiuneaUit(2500, { e_transport: "neaplicabil" }, 0)).toBe(true);
    expect(arataSectiuneaUit(null, { e_transport: "neaplicabil" }, 0)).toBe(true);
  });
  it("autoturism sub prag, cursă nemarcată și fără coduri ⇒ nu", () => {
    expect(arataSectiuneaUit(1600, { e_transport: "neaplicabil" }, 0)).toBe(false);
  });
  it("sub prag, dar marcată sau cu coduri ⇒ da", () => {
    expect(arataSectiuneaUit(1600, { e_transport: "international" }, 0)).toBe(true);
    expect(arataSectiuneaUit(1600, { e_transport: "neaplicabil" }, 1)).toBe(true);
  });
});

describe("dataInceputNeobisnuita — nota nemodală din formular", () => {
  it("în fereastră ⇒ nu", () => {
    expect(dataInceputNeobisnuita("2026-10-21", "2026-10-21")).toBe(false);
    expect(dataInceputNeobisnuita("2026-10-24", "2026-10-21")).toBe(false);
    expect(dataInceputNeobisnuita("2026-10-06", "2026-10-21")).toBe(false);
  });
  it("anul greșit sau peste fereastră ⇒ da", () => {
    expect(dataInceputNeobisnuita("2062-10-21", "2026-10-21")).toBe(true);
    expect(dataInceputNeobisnuita("2026-10-25", "2026-10-21")).toBe(true);
    expect(dataInceputNeobisnuita("2026-10-05", "2026-10-21")).toBe(true);
  });
});
