import { describe, expect, it } from "vitest";

import {
  sarbatoriText,
  weekendText,
  zileCalendaristiceText,
  zileLucratoareText,
  zileText,
} from "./text-zile";

describe("acordul numerelor din cerere (auditul din 8 oct 2026)", () => {
  it("zilele lucrătoare: singular, sub 20 fără „de”, de la 20 cu „de”", () => {
    expect(zileLucratoareText(0)).toBe("nicio zi lucrătoare");
    expect(zileLucratoareText(1)).toBe("1 zi lucrătoare");
    expect(zileLucratoareText(5)).toBe("5 zile lucrătoare");
    expect(zileLucratoareText(19)).toBe("19 zile lucrătoare");
    expect(zileLucratoareText(20)).toBe("20 de zile lucrătoare");
    expect(zileLucratoareText(101)).toBe("101 zile lucrătoare");
    expect(zileLucratoareText(250)).toBe("250 de zile lucrătoare");
  });

  it("weekendul: „o zi de weekend”, nu „cele 1 zile de weekend”", () => {
    expect(weekendText(0)).toBe("nicio zi de weekend");
    expect(weekendText(1)).toBe("o zi de weekend");
    expect(weekendText(2)).toBe("cele 2 zile de weekend");
    expect(weekendText(20)).toBe("cele 20 de zile de weekend");
    expect(weekendText(104)).toBe("cele 104 zile de weekend");
  });

  it("zilele calendaristice și sărbătorile", () => {
    expect(zileText(1)).toBe("1 zi");
    expect(zileText(30)).toBe("30 de zile");
    expect(zileCalendaristiceText(1)).toBe("1 zi calendaristică");
    expect(zileCalendaristiceText(20)).toBe("20 de zile calendaristice");
    expect(sarbatoriText(0)).toBe("nicio sărbătoare legală");
    expect(sarbatoriText(1)).toBe("o sărbătoare legală");
    expect(sarbatoriText(4)).toBe("4 sărbători legale");
  });
});
