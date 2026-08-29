import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatMonthYear,
  parseDateRo,
  toBucharestDateString,
  todayInBucharest,
  formatMonthShort,
  oraInBucharest,
} from "./date";

describe("formatDate", () => {
  it("formatează o zi calendaristică în dd.MM.yyyy", () => {
    expect(formatDate("2026-03-09")).toBe("09.03.2026");
  });

  it("păstrează ziua exact așa cum e stocată, fără deplasare de fus", () => {
    // O coloană `date` din Postgres nu are oră. Interpretarea ei ca UTC și
    // reafișarea în alt fus a produs clasicul „ziua de dinainte".
    expect(formatDate("2026-01-01")).toBe("01.01.2026");
    expect(formatDate("2026-12-31")).toBe("31.12.2026");
  });

  it("respinge o valoare care nu este o dată", () => {
    expect(() => formatDate("nu-e-data")).toThrow();
  });
});

describe("formatDateTime", () => {
  it("afișează momentul în ora României, nu în UTC", () => {
    // Vara, România este UTC+3.
    expect(formatDateTime("2026-07-15T09:30:00Z")).toBe("15.07.2026, 12:30");
  });

  it("aplică corect ora de iarnă (UTC+2)", () => {
    expect(formatDateTime("2026-01-15T09:30:00Z")).toBe("15.01.2026, 11:30");
  });

  it("traversează corect miezul nopții — un moment UTC devine ziua următoare local", () => {
    expect(formatDateTime("2026-07-14T22:30:00Z")).toBe("15.07.2026, 01:30");
  });
});

describe("toBucharestDateString", () => {
  it("determină ziua calendaristică românească a unui moment în timp", () => {
    // 22:30 UTC este deja ziua următoare la București — asta decide în ce zi
    // de pontaj sau în ce lună de salarizare cade o înregistrare.
    expect(toBucharestDateString(new Date("2026-07-14T22:30:00Z"))).toBe("2026-07-15");
    expect(toBucharestDateString(new Date("2026-07-14T20:30:00Z"))).toBe("2026-07-14");
  });

  it("tratează corect granița de lună", () => {
    expect(toBucharestDateString(new Date("2026-06-30T21:30:00Z"))).toBe("2026-07-01");
  });
});

describe("formatMonthYear", () => {
  it("scrie luna în română, cu diacritice", () => {
    expect(formatMonthYear(2026, 3)).toBe("martie 2026");
    expect(formatMonthYear(2026, 8)).toBe("august 2026");
    expect(formatMonthYear(2026, 2)).toBe("februarie 2026");
  });

  it("respinge o lună în afara intervalului", () => {
    expect(() => formatMonthYear(2026, 0)).toThrow();
    expect(() => formatMonthYear(2026, 13)).toThrow();
  });
});

describe("parseDateRo", () => {
  it("citește formatul dd.MM.yyyy introdus de utilizator", () => {
    expect(parseDateRo("09.03.2026")).toBe("2026-03-09");
  });

  it("acceptă și forma fără zero în față", () => {
    expect(parseDateRo("9.3.2026")).toBe("2026-03-09");
  });

  it("respinge datele care nu există în calendar", () => {
    expect(parseDateRo("31.02.2026")).toBeNull();
    expect(parseDateRo("29.02.2027")).toBeNull();
  });

  it("acceptă 29 februarie într-un an bisect", () => {
    expect(parseDateRo("29.02.2028")).toBe("2028-02-29");
  });

  it("întoarce null pentru intrări invalide", () => {
    expect(parseDateRo("")).toBeNull();
    expect(parseDateRo("2026-03-09")).toBeNull();
    expect(parseDateRo("abc")).toBeNull();
  });
});

describe("todayInBucharest", () => {
  it("întoarce o zi calendaristică în format ISO", () => {
    expect(todayInBucharest()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatMonthShort", () => {
  it("dă forma scurtă pentru axa unui grafic", () => {
    expect(formatMonthShort(1)).toBe("ian.");
    expect(formatMonthShort(12)).toBe("dec.");
  });

  it("«mai» n-are punct — nu e prescurtare, e cuvântul întreg", () => {
    expect(formatMonthShort(5)).toBe("mai");
  });

  it("respinge o lună inexistentă în loc s-o randeze goală", () => {
    expect(() => formatMonthShort(0)).toThrow(RangeError);
    expect(() => formatMonthShort(13)).toThrow(RangeError);
  });
});

describe("oraInBucharest", () => {
  it("dă ora locală românească, nu UTC", () => {
    // 2026-08-28T06:32:00Z = 09:32 în România (EEST, UTC+3).
    expect(oraInBucharest(new Date("2026-08-28T06:32:00Z"))).toBe("09:32");
  });

  it("scrie miezul nopții „00:00”, niciodată „24:00”", () => {
    // 2026-01-14T22:00:00Z = 00:00 în România (EET, UTC+2).
    expect(oraInBucharest(new Date("2026-01-14T22:00:00Z"))).toBe("00:00");
  });

  it("aruncă pentru un moment invalid", () => {
    expect(() => oraInBucharest(new Date("nu-e-o-data"))).toThrow(TypeError);
  });
});
