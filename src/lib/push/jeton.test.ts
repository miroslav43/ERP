// src/lib/push/jeton.test.ts
import { describe, expect, it } from "vitest";

import { jetonSchema } from "./jeton";

describe("jetonSchema", () => {
  it("acceptă un jeton Expo valid", () => {
    const r = jetonSchema.safeParse({
      jeton: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      platforma: "android",
    });
    expect(r.success).toBe(true);
  });

  it("respinge un jeton de altă formă", () => {
    for (const rau of ["", "abc", "FCMToken[x]", "ExponentPushToken[]"]) {
      expect(jetonSchema.safeParse({ jeton: rau, platforma: "ios" }).success).toBe(false);
    }
  });

  it("respinge o platformă necunoscută", () => {
    const r = jetonSchema.safeParse({
      jeton: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      platforma: "windows",
    });
    expect(r.success).toBe(false);
  });
});
