import { describe, expect, it } from "vitest";

import { calendarulAnului, ZILE_LIBERE } from "./zile-libere";

/**
 * Cifrele paginii „Zile libere” se calculează; testul le leagă de numărători
 * făcute pe hârtie, ca o schimbare în motorul de sărbători să nu ajungă tăcut
 * pe una dintre cele mai căutate pagini ale sitului.
 *
 * 2026 începe joi: 261 de zile de luni până vineri, minus 11 sărbători în
 * timpul săptămânii = 250. 2027 începe vineri: 261 minus 9 = 252.
 */
describe("zilele libere legale", () => {
  it("2026: 17 sărbători în 16 zile, 250 de zile lucrătoare", () => {
    const c = calendarulAnului(2026);
    expect(c.sarbatori).toBe(17);
    expect(c.zile).toHaveLength(16);
    expect(c.inTimpulSaptamanii).toBe(11);
    expect(c.zileLucratoare).toBe(250);
    expect(c.paste).toBe("12 aprilie 2026");
    // A doua zi de Rusalii cade pe 1 iunie, odată cu Ziua Copilului.
    const iunie = c.zile.find((z) => z.iso === "2026-06-01");
    expect(iunie?.denumiri).toEqual(["Ziua Copilului", "A doua zi de Rusalii"]);
    expect(c.luni.map((l) => l.zileLucratoare)).toEqual([
      18, 20, 22, 20, 20, 21, 23, 21, 22, 22, 20, 21,
    ]);
  });

  it("2027: 17 sărbători în 17 zile, 252 de zile lucrătoare", () => {
    const c = calendarulAnului(2027);
    expect(c.zile).toHaveLength(17);
    expect(c.inTimpulSaptamanii).toBe(9);
    expect(c.zileLucratoare).toBe(252);
    expect(c.paste).toBe("2 mai 2027");
  });

  it("totalul anului e suma lunilor, pe orice an", () => {
    for (let an = 2024; an <= 2035; an += 1) {
      const c = calendarulAnului(an);
      expect(
        c.luni.reduce((s, l) => s + l.zileLucratoare, 0),
        String(an),
      ).toBe(c.zileLucratoare);
      expect(c.sarbatori, String(an)).toBe(17);
    }
  });

  it("pagina spune numărul corect de sărbători și nu le confundă cu zilele", () => {
    const text = ZILE_LIBERE.raspunsScurt.join(" ");
    expect(text).toMatch(/17 zile de sărbătoare legală/);
    expect(text).not.toMatch(/rusalii/); // numele propriu rămâne cu majusculă
  });
});
