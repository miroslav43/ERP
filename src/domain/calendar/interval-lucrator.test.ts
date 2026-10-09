// src/domain/calendar/interval-lucrator.test.ts
import { describe, expect, it } from "vitest";

import {
  aNaZiLucratoareDupa,
  anulProgramarii,
  dataLunga,
  esteZiLucratoare,
  numaraInterval,
  sarbatoriSarite,
  ziuaUrmatoare,
  ziValida,
} from "./interval-lucrator";

describe("numaraInterval", () => {
  it("săptămâna Paștelui 2026: scade Vinerea Mare și a doua zi de Paște", () => {
    expect(numaraInterval("2026-04-06", "2026-04-17")).toEqual({
      deLa: "2026-04-06",
      panaLa: "2026-04-17",
      zileCalendaristice: 12,
      zileLucratoare: 8,
      zileWeekend: 2,
      sarbatoriScazute: [
        { data: "2026-04-10", denumire: "Vinerea Mare" },
        { data: "2026-04-13", denumire: "A doua zi de Paște" },
      ],
    });
  });

  it("peste Anul Nou: Crăciunul, 1, 6 și 7 ianuarie", () => {
    const r = numaraInterval("2026-12-21", "2027-01-08");
    expect(r.zileLucratoare).toBe(11);
    expect(r.zileWeekend).toBe(4);
    expect(r.sarbatoriScazute.map((s) => s.data)).toEqual([
      "2026-12-25",
      "2027-01-01",
      "2027-01-06",
      "2027-01-07",
    ]);
  });

  it("1 iunie 2026 e o singură zi cu două sărbători, numărată o dată", () => {
    const r = numaraInterval("2026-05-25", "2026-06-05");
    expect(r.zileLucratoare).toBe(9);
    expect(r.sarbatoriScazute).toEqual([
      { data: "2026-06-01", denumire: "Ziua Copilului · A doua zi de Rusalii" },
    ]);
  });

  it("anii întregi: 250 de zile lucrătoare în 2026, 252 în 2027", () => {
    expect(numaraInterval("2026-01-01", "2026-12-31").zileLucratoare).toBe(250);
    expect(numaraInterval("2027-01-01", "2027-12-31").zileLucratoare).toBe(252);
  });

  it("octombrie 2026: 22 de zile lucrătoare, 9 de weekend", () => {
    const r = numaraInterval("2026-10-01", "2026-10-31");
    expect([r.zileLucratoare, r.zileWeekend, r.sarbatoriScazute.length]).toEqual([22, 9, 0]);
  });

  it("un interval doar cu sărbători dă zero, nu eroare", () => {
    expect(numaraInterval("2026-11-30", "2026-12-01").zileLucratoare).toBe(0);
    expect(numaraInterval("2026-10-10", "2026-10-11").zileLucratoare).toBe(0);
  });

  it("intervalul inversat, ziua inexistentă și anul din afară sunt refuzate", () => {
    expect(() => numaraInterval("2026-12-20", "2026-12-10")).toThrow(/înaintea/u);
    expect(() => numaraInterval("2026-02-30", "2026-03-10")).toThrow(RangeError);
    expect(() => numaraInterval("2023-01-01", "2023-01-31")).toThrow(/2024 și 2035/u);
  });
});

describe("aNaZiLucratoareDupa", () => {
  it("numărătoarea începe a doua zi: 20 de zile lucrătoare după 8 oct 2026", () => {
    expect(aNaZiLucratoareDupa("2026-10-08", 20)).toBe("2026-11-05");
  });

  it("peste Crăciun și Anul Nou, 20 și 45 de zile", () => {
    expect(aNaZiLucratoareDupa("2026-12-10", 20)).toBe("2027-01-13");
    expect(aNaZiLucratoareDupa("2026-12-10", 45)).toBe("2027-02-17");
  });

  it("sare peste Sfântul Andrei și 1 decembrie", () => {
    expect(aNaZiLucratoareDupa("2026-11-27", 1)).toBe("2026-12-02");
  });

  it("zero zile întoarce ziua de pornire", () => {
    expect(aNaZiLucratoareDupa("2026-10-09", 0)).toBe("2026-10-09");
  });

  it("pornirea dintr-o duminică nu numără duminica", () => {
    expect(aNaZiLucratoareDupa("2026-10-11", 1)).toBe("2026-10-12");
  });

  it("un termen care trece de 2035 e refuzat, nu ghicit", () => {
    expect(() => aNaZiLucratoareDupa("2035-12-20", 20)).toThrow(/2035/u);
  });

  it("numărul de zile trebuie să fie întreg, între 0 și 400", () => {
    expect(() => aNaZiLucratoareDupa("2026-10-08", -1)).toThrow(RangeError);
    expect(() => aNaZiLucratoareDupa("2026-10-08", 2.5)).toThrow(RangeError);
    expect(() => aNaZiLucratoareDupa("2026-10-08", 401)).toThrow(RangeError);
  });
});

describe("sarbatoriSarite", () => {
  it("sărbătorile de luni–vineri dintre pornire (exclusiv) și termen (inclusiv)", () => {
    expect(sarbatoriSarite("2026-12-10", "2027-02-17").map((s) => s.denumire)).toEqual([
      "Crăciunul",
      "Anul Nou",
      "Bobotează",
      "Soborul Sfântului Ioan Botezătorul",
    ]);
    expect(sarbatoriSarite("2026-10-09", "2026-10-09")).toEqual([]);
  });
});

describe("ajutoarele", () => {
  it("ziValida: doar zile reale din 2024–2035, cu spații tăiate", () => {
    expect(ziValida(" 2026-10-08 ")).toBe("2026-10-08");
    expect(ziValida("2026-02-29")).toBeNull();
    expect(ziValida("2028-02-29")).toBe("2028-02-29");
    expect(ziValida("2036-01-01")).toBeNull();
    expect(ziValida("08.10.2026")).toBeNull();
  });

  it("ziuaUrmatoare trece peste lună și an", () => {
    expect(ziuaUrmatoare("2026-12-31")).toBe("2027-01-01");
    expect(ziuaUrmatoare("2028-02-28")).toBe("2028-02-29");
  });

  it("esteZiLucratoare", () => {
    expect(esteZiLucratoare("2026-10-08")).toBe(true);
    expect(esteZiLucratoare("2026-10-10")).toBe(false);
    expect(esteZiLucratoare("2026-12-01")).toBe(false);
  });

  it("dataLunga, cu ziua săptămânii", () => {
    expect(dataLunga("2026-11-05")).toBe("joi, 5 noiembrie 2026");
    expect(dataLunga("2027-02-17")).toBe("miercuri, 17 februarie 2027");
    expect(dataLunga("2026-10-31")).toBe("sâmbătă, 31 octombrie 2026");
  });

  it("anulProgramarii: din octombrie se programează anul următor (art. 148 alin. (1))", () => {
    expect(anulProgramarii("2026-09-30")).toBe(2026);
    expect(anulProgramarii("2026-10-01")).toBe(2027);
    expect(anulProgramarii("2026-12-31")).toBe(2027);
    expect(anulProgramarii("2027-01-01")).toBe(2027);
  });
});
