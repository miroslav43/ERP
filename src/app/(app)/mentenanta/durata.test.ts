// src/app/(app)/mentenanta/durata.test.ts
import { describe, expect, it } from "vitest";

import { formatDurataMinute, minuteIntre } from "./durata";

describe("formatDurataMinute", () => {
  it.each([
    [0, "sub un minut"],
    [0.4, "sub un minut"],
    [1, "1 min"],
    [45, "45 min"],
    [60, "1 h"],
    [200, "3 h 20 min"],
    [1440, "1 zi"],
    [1440 + 240, "1 zi 4 h"],
    [3 * 1440 + 59, "3 zile"],
    [-30, "sub un minut"],
  ])("%d minute → %s", (minute, text) => {
    expect(formatDurataMinute(minute)).toBe(text);
  });
});

describe("minuteIntre", () => {
  const acum = "2026-10-07T12:00:00.000Z";
  it("până la sfârșit când există, altfel până acum", () => {
    expect(minuteIntre("2026-10-07T10:00:00.000Z", "2026-10-07T11:30:00.000Z", acum)).toBe(90);
    expect(minuteIntre("2026-10-07T10:00:00.000Z", null, acum)).toBe(120);
  });
  it("momente invalide → 0, nu NaN", () => {
    expect(minuteIntre("nu-e-data", null, acum)).toBe(0);
  });
});
