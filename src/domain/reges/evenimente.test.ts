// src/domain/reges/evenimente.test.ts
import { describe, expect, it } from "vitest";

import {
  adaugaZileCalendaristice,
  alegeConfigurare,
  calculeazaTermen,
  construiesteCalendar,
  deduceEvenimenteContract,
  deplaseazaZileLucratoare,
  esteZiLucratoare,
  evalueazaTermen,
  pasteOrtodox,
  type ConfigurareTermen,
  type StareContractReges,
} from "./evenimente";

const CALENDAR = construiesteCalendar(2025, 2027);

function config(partial: Partial<ConfigurareTermen>): ConfigurareTermen {
  return {
    id: "cfg-1",
    organizationId: null,
    eventType: "angajare",
    termenZile: -1,
    reper: "valabil_de_la",
    zileLucratoare: true,
    descriere: null,
    valabilDeLa: "2018-01-01",
    valabilPana: null,
    ...partial,
  };
}

describe("calendarul zilelor lucrătoare", () => {
  it("calculează Paștele ortodox", () => {
    expect(pasteOrtodox(2025)).toBe("2025-04-20");
    expect(pasteOrtodox(2026)).toBe("2026-04-12");
  });

  it("exclude weekendul și sărbătorile legale", () => {
    expect(esteZiLucratoare("2026-06-03", CALENDAR)).toBe(true); // miercuri obișnuită
    expect(esteZiLucratoare("2026-06-06", CALENDAR)).toBe(false); // sâmbătă
    expect(esteZiLucratoare("2026-06-01", CALENDAR)).toBe(false); // 1 iunie + a doua zi de Rusalii
    expect(esteZiLucratoare("2026-12-01", CALENDAR)).toBe(false); // Ziua Națională
  });

  it("sare peste zilele libere când se deplasează înapoi", () => {
    // 2026-06-02 e marți; ziua lucrătoare anterioară este vineri 29 mai
    // (1 iunie sărbătoare, 30–31 mai weekend).
    expect(deplaseazaZileLucratoare("2026-06-02", -1, CALENDAR)).toBe("2026-05-29");
  });

  it("lasă ziua neschimbată pentru termen zero", () => {
    expect(deplaseazaZileLucratoare("2026-06-06", 0, CALENDAR)).toBe("2026-06-06");
  });
});

describe("alegeConfigurare", () => {
  it("preferă rândul organizației în fața celui de platformă", () => {
    const alesa = alegeConfigurare(
      [config({ id: "platforma" }), config({ id: "org", organizationId: "o1" })],
      "angajare",
      "2026-06-02",
    );
    expect(alesa?.id).toBe("org");
  });

  it("ignoră configurările expirate", () => {
    const alesa = alegeConfigurare(
      [config({ id: "veche", valabilPana: "2020-12-31" })],
      "angajare",
      "2026-06-02",
    );
    expect(alesa).toBeNull();
  });
});

describe("calculeazaTermen", () => {
  it("angajarea se transmite în ziua lucrătoare anterioară începerii activității", () => {
    const rezultat = calculeazaTermen(
      {
        eventType: "angajare",
        dataEvenimentului: "2026-06-02",
        valabilDeLa: "2026-06-02",
        dataContract: "2026-05-25",
      },
      [config({})],
      CALENDAR,
    );
    expect(rezultat.ok).toBe(true);
    if (rezultat.ok) expect(rezultat.valoare.termenTransmitere).toBe("2026-05-29");
  });

  it("modificarea de salariu are 20 de zile lucrătoare de la eveniment", () => {
    const rezultat = calculeazaTermen(
      {
        eventType: "modificare_salariu",
        dataEvenimentului: "2026-09-01",
        valabilDeLa: null,
        dataContract: null,
      },
      [
        config({
          id: "ms",
          eventType: "modificare_salariu",
          termenZile: 20,
          reper: "data_eveniment",
        }),
      ],
      CALENDAR,
    );
    expect(rezultat.ok).toBe(true);
    if (rezultat.ok) {
      // 20 de zile lucrătoare peste 1 septembrie 2026, fără sărbători în interval.
      expect(rezultat.valoare.termenTransmitere).toBe(
        deplaseazaZileLucratoare("2026-09-01", 20, CALENDAR),
      );
      expect(rezultat.valoare.termenTransmitere).toBe("2026-09-29");
    }
  });

  it("refuză explicit când lipsește configurarea", () => {
    const rezultat = calculeazaTermen(
      {
        eventType: "detasare",
        dataEvenimentului: "2026-06-02",
        valabilDeLa: null,
        dataContract: null,
      },
      [config({})],
      CALENDAR,
    );
    expect(rezultat.ok).toBe(false);
    if (!rezultat.ok) expect(rezultat.motiv).toContain("Nu există un termen configurat");
  });

  it("refuză explicit când lipsește data de reper", () => {
    const rezultat = calculeazaTermen(
      {
        eventType: "angajare",
        dataEvenimentului: "2026-06-02",
        valabilDeLa: null,
        dataContract: null,
      },
      [config({})],
      CALENDAR,
    );
    expect(rezultat.ok).toBe(false);
  });
});

describe("evalueazaTermen", () => {
  it("marchează întârzierea în zile", () => {
    expect(evalueazaTermen("2026-05-29", "2026-06-05", "de_pregatit")).toEqual({
      stare: "intarziat",
      zileRamase: 0,
      zileIntarziere: 7,
    });
  });

  it("nu mai evaluează termenul pentru evenimentele transmise", () => {
    expect(evalueazaTermen("2020-01-01", "2026-06-05", "confirmat").stare).toBe("transmis");
  });

  it("semnalează ziua-limită", () => {
    const azi = adaugaZileCalendaristice("2026-06-05", 0);
    expect(evalueazaTermen("2026-06-05", azi, "pregatit").stare).toBe("astazi");
  });
});

describe("deduceEvenimenteContract", () => {
  const baza: StareContractReges = {
    salariuBaza: 5000,
    jobPositionId: "f1",
    normaOreSaptamana: 40,
    normaOreZi: 8,
    contractDuration: "nedeterminat",
    valabilPana: null,
    status: "activ",
  };

  it("contractul nou activ produce o angajare", () => {
    expect(deduceEvenimenteContract(null, baza)).toEqual(["angajare"]);
  });

  it("proiectul nu produce încă niciun eveniment", () => {
    expect(deduceEvenimenteContract(null, { ...baza, status: "proiect" })).toEqual([]);
  });

  it("detectează simultan salariul și norma", () => {
    const tipuri = deduceEvenimenteContract(baza, {
      ...baza,
      salariuBaza: 6000,
      normaOreSaptamana: 20,
      normaOreZi: 4,
    });
    expect(tipuri).toEqual(["modificare_salariu", "modificare_norma"]);
  });

  it("încetarea nu mai generează modificări de conținut", () => {
    expect(
      deduceEvenimenteContract(baza, { ...baza, status: "incetat", salariuBaza: 9000 }),
    ).toEqual(["incetare"]);
  });
});
