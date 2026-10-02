// src/domain/reges/evenimente.lacune.test.ts
//
// Lacunele confirmate de audit în termenele REGES: zile lucrătoare peste
// sărbători și peste granița de an, echivalența celor două liste de sărbători,
// alegerea configurării, termenul calendaristic, starea față de termen și
// deducerea evenimentelor dintr-o schimbare de contract.
//
// Termenele (−1 la angajare, +3 la suspendarea nemotivată, 10 calendaristice la
// detașare) vin din seed-ul `reges_termene` și sunt ⚠ în NOTES.md §3 REVISAL;
// aici se verifică aritmetica, nu valoarea legală.

import { describe, expect, it } from "vitest";

import { sarbatoriAnului } from "@/domain/calendar/sarbatori";

import {
  alegeConfigurare,
  calculeazaTermen,
  construiesteCalendar,
  deduceEvenimenteContract,
  deplaseazaZileLucratoare,
  evalueazaTermen,
  sarbatoriLegale,
  type ConfigurareTermen,
  type StareContractReges,
} from "./evenimente";

const CALENDAR = construiesteCalendar(2025, 2027);

describe("deplaseazaZileLucratoare — peste sărbători și peste granița de an", () => {
  it("înainte, peste weekend, Sf. Andrei și Ziua Națională: 27.11.2026 + 3 → 04.12.2026", () => {
    expect(deplaseazaZileLucratoare("2026-11-27", 3, CALENDAR)).toBe("2026-12-04");
  });

  it("înapoi, peste Paștele ortodox 2026 și Vinerea Mare: 14.04.2026 − 1 → 09.04.2026", () => {
    // 13 aprilie a doua zi de Paște, 12–11 weekend, 10 Vinerea Mare.
    expect(deplaseazaZileLucratoare("2026-04-14", -1, CALENDAR)).toBe("2026-04-09");
  });

  it("înapoi, peste Anul Nou: 04.01.2027 − 1 → 31.12.2026", () => {
    expect(deplaseazaZileLucratoare("2027-01-04", -1, CALENDAR)).toBe("2026-12-31");
  });
});

describe("sarbatoriLegale — aceeași listă ca în calendarul național", () => {
  // Două liste și două implementări ale Paștelui ortodox: REGES (+13 zile fix)
  // și `domain/calendar`. Ambele spun că oglindesc seed-ul `public_holidays`.
  // Azi coincid; testul păzește prima modificare făcută doar într-una din ele.
  it.each(Array.from({ length: 16 }, (_, i) => 2020 + i))("anul %i", (an) => {
    const reges = new Set(sarbatoriLegale(an));
    const calendar = new Set(sarbatoriAnului(an).map((s) => s.data.toISOString().slice(0, 10)));
    expect(reges).toEqual(calendar);
  });

  it("2026 are 16 zile libere distincte: 1 iunie e și Ziua Copilului, și a doua zi de Rusalii", () => {
    expect(new Set(sarbatoriLegale(2026)).size).toBe(16);
    expect(sarbatoriLegale(2026).filter((zi) => zi === "2026-06-01")).toHaveLength(2);
  });
});

function configurare(peste: Partial<ConfigurareTermen>): ConfigurareTermen {
  return {
    id: "cfg",
    organizationId: null,
    eventType: "suspendare",
    termenZile: 3,
    reper: "data_eveniment",
    zileLucratoare: true,
    descriere: null,
    valabilDeLa: "2018-01-01",
    valabilPana: null,
    ...peste,
  };
}

describe("alegeConfigurare — două rânduri de platformă pentru același eveniment", () => {
  const V1 = configurare({ id: "v1", valabilDeLa: "2018-01-01", termenZile: 20 });
  const V2 = configurare({ id: "v2", valabilDeLa: "2025-08-01", termenZile: 3 });

  it("la egalitate de prioritate câștigă cel mai recent valabil_de_la", () => {
    expect(alegeConfigurare([V1, V2], "suspendare", "2026-01-10")?.id).toBe("v2");
    expect(alegeConfigurare([V2, V1], "suspendare", "2026-01-10")?.id).toBe("v2");
  });

  it("înainte de intrarea în vigoare a rândului nou se aplică cel vechi", () => {
    expect(alegeConfigurare([V1, V2], "suspendare", "2025-07-31")?.id).toBe("v1");
  });
});

describe("calculeazaTermen — termen în zile calendaristice", () => {
  it("10 zile calendaristice de la 24.12.2026 nu sar peste sărbători: 03.01.2027", () => {
    const r = calculeazaTermen(
      {
        eventType: "detasare",
        dataEvenimentului: "2026-12-24",
        valabilDeLa: null,
        dataContract: null,
      },
      [configurare({ id: "det", eventType: "detasare", termenZile: 10, zileLucratoare: false })],
      CALENDAR,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valoare.termenTransmitere).toBe("2027-01-03");
    expect(r.valoare.zileLucratoare).toBe(false);
    expect(r.valoare.explicatie).toBe(
      "10 zile calendaristice după data evenimentului (2026-12-24).",
    );
  });
});

describe("evalueazaTermen — ramurile nevăzute", () => {
  it("un termen viitor e în termen, cu zilele rămase", () => {
    expect(evalueazaTermen("2026-06-10", "2026-06-05", "pregatit")).toEqual({
      stare: "in_termen",
      zileRamase: 5,
      zileIntarziere: 0,
    });
  });

  it("un eveniment anulat nu e întârziat, oricât ar fi trecut termenul", () => {
    expect(evalueazaTermen("2026-05-29", "2026-06-05", "anulat")).toEqual({
      stare: "anulat",
      zileRamase: 0,
      zileIntarziere: 0,
    });
  });

  it("același termen depășit, neanulat, e întârziat cu 7 zile", () => {
    expect(evalueazaTermen("2026-05-29", "2026-06-05", "de_pregatit")).toEqual({
      stare: "intarziat",
      zileRamase: 0,
      zileIntarziere: 7,
    });
  });
});

describe("deduceEvenimenteContract — tranzițiile netestate", () => {
  const BAZA: StareContractReges = {
    salariuBaza: 5000,
    functie: "Sudor",
    codCor: "721208",
    normaOreSaptamana: 40,
    normaOreZi: 8,
    contractDuration: "nedeterminat",
    valabilPana: null,
    status: "activ",
  };

  it("proiect → activ e o angajare", () => {
    expect(deduceEvenimenteContract({ ...BAZA, status: "proiect" }, BAZA)).toEqual(["angajare"]);
  });

  it("suspendat → activ cu salariu nou: reluare și modificare de salariu", () => {
    expect(
      deduceEvenimenteContract({ ...BAZA, status: "suspendat" }, { ...BAZA, salariuBaza: 5500 }),
    ).toEqual(["reluare_activitate", "modificare_salariu"]);
  });

  it("suspendat → încetat e doar încetare", () => {
    expect(
      deduceEvenimenteContract({ ...BAZA, status: "suspendat" }, { ...BAZA, status: "incetat" }),
    ).toEqual(["incetare"]);
  });

  it("activ → anulat nu se raportează", () => {
    expect(deduceEvenimenteContract(BAZA, { ...BAZA, status: "anulat" })).toEqual([]);
  });

  it("o redenumire a funcției la același cod COR e tot modificare de funcție", () => {
    expect(deduceEvenimenteContract(BAZA, { ...BAZA, functie: "Sudor autorizat" })).toEqual([
      "modificare_functie",
    ]);
  });

  it("trecerea pe durată determinată e modificare de durată", () => {
    expect(
      deduceEvenimenteContract(BAZA, {
        ...BAZA,
        contractDuration: "determinat",
        valabilPana: "2027-06-30",
      }),
    ).toEqual(["modificare_durata"]);
  });
});
