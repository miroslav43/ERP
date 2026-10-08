import { describe, expect, it } from "vitest";

import { construiesteFoaie } from "./foaie";

/**
 * Foaia de pontaj pe anii pe care formularul îi acceptă (2020–2035).
 *
 * Auditul din 8 oct 2026: ianuarie 2022 ieșea „18 zile × 8 h = 144 h”, fiindcă
 * 6 și 7 ianuarie erau socotite sărbători și înainte de Legea 52/2023. Cifrele
 * de mai jos sunt numărate pe calendar, nu derivate din funcția testată.
 */
describe("zilele lucrătoare ale foii", () => {
  it.each([
    [2020, 20],
    [2021, 20],
    [2022, 20],
    [2023, 20],
    [2024, 20],
    [2026, 18],
  ])("zile lucrătoare în ianuarie %i: %i", (an, zile) => {
    expect(construiesteFoaie(an, 1, ["Popa Ion"], 8).zileLucratoare).toBe(zile);
  });

  it("ianuarie 2022: 160 h normă, iar 6 și 7 ianuarie sunt zile obișnuite", () => {
    const f = construiesteFoaie(2022, 1, ["Popa Ion"], 8);
    expect(f.normaLunara).toBe(160);
    expect(f.zile[5]?.sarbatoare).toBeNull(); // 6 ianuarie 2022, joi
    expect(f.zile[6]?.sarbatoare).toBeNull(); // 7 ianuarie 2022, vineri
  });

  it("din 2024, 6 și 7 ianuarie sunt sărbători", () => {
    const f = construiesteFoaie(2025, 1, ["Popa Ion"], 8);
    expect(f.zile[5]?.sarbatoare).toBe("Bobotează");
    expect(f.zile[6]?.sarbatoare).toBe("Soborul Sfântului Ioan Botezătorul");
  });
});
