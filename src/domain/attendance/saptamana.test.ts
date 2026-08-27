import { describe, expect, it } from "vitest";

import {
  INDICI_WEEKEND,
  adaugaZile,
  esteLuni,
  intervalDeTrimis,
  lunieaUrmatoare,
  zileleSaptamanii,
} from "./saptamana";

describe("adaugaZile", () => {
  it("trece corect peste granița lunii și a anului", () => {
    expect(adaugaZile("2026-01-31", 1)).toBe("2026-02-01");
    expect(adaugaZile("2026-12-31", 1)).toBe("2027-01-01");
    expect(adaugaZile("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("tratează anul bisect", () => {
    expect(adaugaZile("2028-02-28", 1)).toBe("2028-02-29");
    expect(adaugaZile("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("o săptămână înainte și înapoi se anulează", () => {
    expect(adaugaZile(adaugaZile("2026-08-22", 7), -7)).toBe("2026-08-22");
  });
});

describe("esteLuni", () => {
  it("recunoaște lunea", () => {
    // 2026-08-17 e luni; 2026-08-22 e sâmbătă.
    expect(esteLuni("2026-08-17")).toBe(true);
    expect(esteLuni("2026-08-22")).toBe(false);
  });

  it("respinge orice nu are formatul unei zile", () => {
    // Parametrul vine din bara de adrese: `?saptamana=…`. O valoare stricată
    // trebuie să cadă pe implicit, nu să ajungă la Postgres și să dea 22P02.
    for (const valoare of ["", "azi", "2026-8-17", "2026-08-17T00:00:00Z", "'; drop table"]) {
      expect(esteLuni(valoare), valoare).toBe(false);
    }
  });
});

describe("lunieaUrmatoare", () => {
  it("dintr-o zi de lucru dă lunea săptămânii viitoare", () => {
    // 2026-08-17 luni → 2026-08-24; 2026-08-21 vineri → tot 2026-08-24.
    expect(lunieaUrmatoare("2026-08-17")).toBe("2026-08-24");
    expect(lunieaUrmatoare("2026-08-21")).toBe("2026-08-24");
  });

  it("sâmbăta și duminica dau tot lunea imediat următoare", () => {
    // Duminica e capătul săptămânii ISO, deci lunea următoare e a doua zi —
    // ramura pe care o inversare de semn ar trimite cu o săptămână mai încolo.
    expect(lunieaUrmatoare("2026-08-22")).toBe("2026-08-24");
    expect(lunieaUrmatoare("2026-08-23")).toBe("2026-08-24");
  });

  it("rezultatul e întotdeauna o zi de luni, în orice zi a anului", () => {
    let zi = "2026-01-01";
    for (let i = 0; i < 400; i += 1) {
      expect(esteLuni(lunieaUrmatoare(zi)), zi).toBe(true);
      zi = adaugaZile(zi, 1);
    }
  });

  it("rezultatul e mereu în viitor, niciodată ziua curentă", () => {
    let zi = "2026-01-01";
    for (let i = 0; i < 400; i += 1) {
      expect(lunieaUrmatoare(zi) > zi, zi).toBe(true);
      zi = adaugaZile(zi, 1);
    }
  });
});

describe("zileleSaptamanii", () => {
  it("dă șapte zile consecutive, începând cu lunea dată", () => {
    expect(zileleSaptamanii("2026-08-17")).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ]);
  });
});

describe("intervalDeTrimis", () => {
  const PLIN = { ora_inceput: "08:30", ora_sfarsit: "17:00" };
  const GOL = { ora_inceput: "", ora_sfarsit: "" };

  it("trimite intervalul zilelor de lucru, oricare ar fi comutatorul", () => {
    for (const index of [0, 1, 2, 3, 4]) {
      expect(intervalDeTrimis(PLIN, index, false)).toEqual(PLIN);
      expect(intervalDeTrimis(PLIN, index, true)).toEqual(PLIN);
    }
  });

  it("DEFECTUL REPARAT: weekendul nebifat pleacă fără interval, deci cu zero ore", () => {
    // Implicitul de 8 ore pe toate cele șapte zile declara 56 de ore pe
    // săptămână, din care 16 într-un weekend pe care nu-l alesese nimeni.
    expect(intervalDeTrimis(PLIN, 5, false)).toEqual({ ora_inceput: null, ora_sfarsit: null });
    expect(intervalDeTrimis(PLIN, 6, false)).toEqual({ ora_inceput: null, ora_sfarsit: null });
  });

  it("weekendul bifat trimite intervalul, ca orice altă zi", () => {
    expect(intervalDeTrimis(PLIN, 5, true)).toEqual(PLIN);
    expect(intervalDeTrimis(PLIN, 6, true)).toEqual(PLIN);
  });

  it("ziua fără interval pleacă fără interval", () => {
    expect(intervalDeTrimis(GOL, 0, true)).toEqual({ ora_inceput: null, ora_sfarsit: null });
  });

  it("intervalul pe jumătate completat se tratează ca absent, nu ca eroare de bază", () => {
    // `_interval_ck` (0081) cere ori amândouă orele, ori niciuna. Un 23514 pe
    // un câmp pe jumătate scris e o eroare pe care omul n-o poate lega de ce a
    // făcut.
    expect(intervalDeTrimis({ ora_inceput: "08:30", ora_sfarsit: "" }, 0, true)).toEqual({
      ora_inceput: null,
      ora_sfarsit: null,
    });
    expect(intervalDeTrimis({ ora_inceput: "", ora_sfarsit: "17:00" }, 0, true)).toEqual({
      ora_inceput: null,
      ora_sfarsit: null,
    });
  });

  it("indexează weekendul pe poziție, nu pe dată — săptămâna începe luni", () => {
    expect([...INDICI_WEEKEND].sort()).toEqual([5, 6]);
  });
});
