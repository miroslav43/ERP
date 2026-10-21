// src/lib/actions/public-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { cuiSchema } from "@/schemas/organization";

/*
 * Regula pe care o apără fișierul: **validarea vine ÎNAINTEA contorului de
 * rată.** O cerere malformată nu atinge baza și nu arde un slot din cele 3/oră.
 *
 * ONB-001: un om care greșea de trei ori cifrele CUI-ului era blocat o oră de
 * la crearea contului, împreună cu toți colegii din spatele aceluiași NAT —
 * fiindcă fiecare încercare stricată consuma un slot ÎNAINTE ca Zod să o vadă.
 *
 * Contorul, clientul anon și antetele cererii sunt false; `server-only` e
 * aliasat de vitest (vezi `tests/stub/server-only.ts`).
 */
const { consumeRateLimit } = vi.hoisted(() => ({ consumeRateLimit: vi.fn() }));

vi.mock("@/lib/utils/rate-limit", () => ({ consumeRateLimit }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({}) }));
vi.mock("./audit", () => ({
  readRequestMeta: async () => ({ ip: "1.2.3.4", userAgent: null }),
}));

import { createPublicAction } from "./public-action";

const handler = vi.fn();

const proba = createPublicAction({
  name: "proba",
  input: z.object({ cui: cuiSchema }),
  rateLimit: { max: 3, windowSeconds: 3600 },
  handler,
});

/** `14399840` trece cifra de control; `55676851` o pică (ONB-001, pasul 1). */
const CUI_VALID = "14399840";
const CUI_GRESIT = "55676851";

beforeEach(() => {
  consumeRateLimit.mockReset();
  handler.mockReset();
  consumeRateLimit.mockResolvedValue({ allowed: true });
  handler.mockResolvedValue({ id: "x" });
});

describe("createPublicAction — ordinea straturilor", () => {
  it("o intrare invalidă e respinsă pe câmp, în română, FĂRĂ să consume un slot de rată", async () => {
    const rezultat = await proba({ cui: CUI_GRESIT });

    expect(rezultat.ok).toBe(false);
    if (rezultat.ok) return;
    expect(rezultat.error.code).toBe("VALIDARE");
    expect(rezultat.error.fieldErrors?.["cui"]?.[0]).toMatch(/cifra de control/);
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("o intrare validă consumă exact un slot, cu cheia nume:ip, ÎNAINTE de handler", async () => {
    const rezultat = await proba({ cui: CUI_VALID });

    expect(rezultat.ok).toBe(true);
    expect(consumeRateLimit).toHaveBeenCalledTimes(1);
    expect(consumeRateLimit).toHaveBeenCalledWith({
      key: "proba:1.2.3.4",
      limit: 3,
      windowSeconds: 3600,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(consumeRateLimit.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(
      handler.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("limita atinsă → LIMITA_DEPASITA, iar handler-ul nu rulează", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false });

    const rezultat = await proba({ cui: CUI_VALID });

    expect(rezultat.ok).toBe(false);
    if (rezultat.ok) return;
    expect(rezultat.error.code).toBe("LIMITA_DEPASITA");
    expect(handler).not.toHaveBeenCalled();
  });
});
