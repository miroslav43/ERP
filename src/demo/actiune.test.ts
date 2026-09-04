import { describe, expect, it } from "vitest";

import { actiuneDemo } from "./actiune";

describe("acțiunea de demonstrație", () => {
  it("întoarce ok cu datele produse de scriitor", async () => {
    const actiune = actiuneDemo((date) => ({ nume: String(date.get("nume") ?? "") }));
    const date = new FormData();
    date.set("nume", "Popescu");

    const rezultat = await actiune(date);

    expect(rezultat.ok).toBe(true);
    if (rezultat.ok) expect(rezultat.data).toEqual({ nume: "Popescu" });
  });

  it("întoarce un refuz cu forma ActionError, inclusiv requestId", async () => {
    const actiune = actiuneDemo(() => ({
      refuz: "Datele nu sunt complete.",
      campuri: { nume: ["Completați numele."] },
    }));

    const rezultat = await actiune(new FormData());

    expect(rezultat.ok).toBe(false);
    if (!rezultat.ok) {
      expect(rezultat.error.message).toBe("Datele nu sunt complete.");
      expect(rezultat.error.fieldErrors).toEqual({ nume: ["Completați numele."] });
      expect(typeof rezultat.error.requestId).toBe("string");
      expect(rezultat.error.requestId.length).toBeGreaterThan(0);
    }
  });

  it("prinde o excepție din scriitor și o traduce în refuz, nu o lasă să spargă pagina", async () => {
    const actiune = actiuneDemo(() => {
      throw new Error("ceva");
    });

    const rezultat = await actiune(new FormData());

    expect(rezultat.ok).toBe(false);
    if (!rezultat.ok) expect(rezultat.error.message).toMatch(/\.$/);
  });
});
