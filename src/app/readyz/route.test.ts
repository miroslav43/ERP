import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EroareTermenSupabase } from "@/lib/supabase/fetch-cu-termen";

import { GET } from "./route";

/**
 * Ruta asta intră în `healthcheck:` din docker-stack.yml. Un verdict greșit nu
 * produce o pagină urâtă, ci omoară replici: un 503 nemeritat rotește ambele
 * replici la fiecare 60 de secunde, la nesfârșit. De aceea clasificarea are
 * teste, nu doar comentarii.
 */

type Verdict = {
  readonly stare: string;
  readonly supabase: string;
  readonly supabaseMs: number;
  readonly intarziereBuclaMs: number;
  readonly motiv?: string;
};

let fetchOriginal: typeof fetch;

beforeEach(() => {
  fetchOriginal = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

async function verdictul(): Promise<{ status: number; corp: Verdict }> {
  const raspuns = await GET();
  return { status: raspuns.status, corp: (await raspuns.json()) as Verdict };
}

describe("GET /readyz", () => {
  it("200 când Supabase răspunde — orice ar răspunde", async () => {
    // 401 e răspunsul real al lui /auth/v1/health fără cheie. Ne interesează
    // că VINE un răspuns, nu care e.
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 401 }),
    ) as unknown as typeof fetch;

    const { status, corp } = await verdictul();

    expect(status).toBe(200);
    expect(corp.stare).toBe("ok");
    expect(corp.supabase).toBe("raspunde");
    expect(corp.motiv).toBeUndefined();
  });

  it("503 când apelul nu se mai întoarce — semnătura blocajului din 23 august", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new EroareTermenSupabase(2_000);
    }) as unknown as typeof fetch;

    const { status, corp } = await verdictul();

    expect(status).toBe(503);
    expect(corp.stare).toBe("blocat");
    expect(corp.supabase).toBe("fara-raspuns");
    expect(corp.motiv).toContain("nu a răspuns");
  });

  it("200 când Supabase e în pană dar răspunde repede cu eroare de rețea", async () => {
    // Cazul care contează cel mai mult: o pană la Supabase NU trebuie să
    // omoare replici sănătoase. Procesul demonstrează că poate ieși în
    // exterior — doar că n-are cu cine vorbi.
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed: ECONNREFUSED");
    }) as unknown as typeof fetch;

    const { status, corp } = await verdictul();

    expect(status).toBe(200);
    expect(corp.stare).toBe("ok");
    expect(corp.supabase).toBe("eroare-retea");
  });

  it("raportează întârzierea buclei de evenimente", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 401 }),
    ) as unknown as typeof fetch;

    const { corp } = await verdictul();

    expect(typeof corp.intarziereBuclaMs).toBe("number");
    expect(corp.intarziereBuclaMs).toBeGreaterThanOrEqual(0);
  });

  it("nu se lasă cache-uită", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 401 }),
    ) as unknown as typeof fetch;

    const raspuns = await GET();

    expect(raspuns.headers.get("cache-control")).toContain("no-store");
  });
});
