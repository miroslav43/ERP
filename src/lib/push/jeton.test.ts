// src/lib/push/jeton.test.ts
import { describe, expect, it } from "vitest";

import { decidePasInregistrareJeton, jetonSchema } from "./jeton";

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

describe("decidePasInregistrareJeton", () => {
  it("inserează direct când nu există niciun rând activ pentru jeton", () => {
    expect(decidePasInregistrareJeton("inexistent")).toBe("insereaza");
  });

  it("nu mai scrie nimic când rândul propriu a fost deja actualizat cu succes", () => {
    expect(decidePasInregistrareJeton("propriu_scriibil")).toBe("gata");
  });

  it("retrage și reinserează când rândul propriu nu mai e accesibil prin RLS (organizație pierdută)", () => {
    expect(decidePasInregistrareJeton("propriu_neaccesibil")).toBe("retrage_apoi_insereaza");
  });

  it("retrage și reinserează când rândul e al altcuiva (predarea telefonului)", () => {
    expect(decidePasInregistrareJeton("altcuiva")).toBe("retrage_apoi_insereaza");
  });
});
