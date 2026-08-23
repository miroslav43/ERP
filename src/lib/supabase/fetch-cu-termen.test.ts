import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EroareTermenSupabase, esteTermenDepasit, fetchCuTermen } from "./fetch-cu-termen";

const TERMEN = 1_000;

/** `fetch` care nu răspunde niciodată, dar respectă semnalul de anulare. */
function fetchCareTace(): typeof fetch {
  return ((_resursa: unknown, optiuni?: RequestInit) =>
    new Promise<Response>((_rezolva, respinge) => {
      optiuni?.signal?.addEventListener("abort", () => respinge(optiuni.signal?.reason), {
        once: true,
      });
    })) as typeof fetch;
}

let fetchOriginal: typeof fetch;

beforeEach(() => {
  fetchOriginal = globalThis.fetch;
  vi.useFakeTimers();
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  vi.useRealTimers();
});

describe("fetchCuTermen", () => {
  it("întoarce răspunsul când antetul sosește la timp", async () => {
    const raspuns = new Response("ok", { status: 200 });
    globalThis.fetch = vi.fn(async () => raspuns) as unknown as typeof fetch;

    await expect(fetchCuTermen(TERMEN)("https://exemplu.test")).resolves.toBe(raspuns);
  });

  it("respinge cu EroareTermenSupabase dacă antetul nu sosește în termen", async () => {
    globalThis.fetch = fetchCareTace();

    const promisiune = fetchCuTermen(TERMEN)("https://exemplu.test");
    // Prinde respingerea înainte de a avansa ceasul: altfel Node raportează
    // promisiunea ca „unhandled rejection” între tick-uri.
    const rezultat = promisiune.catch((eroare: unknown) => eroare);

    await vi.advanceTimersByTimeAsync(TERMEN);

    const eroare = await rezultat;
    expect(eroare).toBeInstanceOf(EroareTermenSupabase);
    expect(esteTermenDepasit(eroare)).toBe(true);
  });

  it("NU taie corpul după ce antetul a sosit — cronometrul se oprește acolo", async () => {
    let semnalVazut: AbortSignal | null = null;
    globalThis.fetch = vi.fn(async (_resursa: unknown, optiuni?: RequestInit) => {
      semnalVazut = optiuni?.signal ?? null;
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    await fetchCuTermen(TERMEN)("https://exemplu.test");

    // Mult peste termen: un export de 25 MB are voie să curgă în continuare.
    await vi.advanceTimersByTimeAsync(TERMEN * 10);

    expect(semnalVazut).not.toBeNull();
    expect((semnalVazut as unknown as AbortSignal).aborted).toBe(false);
  });

  it("propagă anularea venită de la apelant, cu motivul lui", async () => {
    globalThis.fetch = fetchCareTace();

    const controlApelant = new AbortController();
    const motiv = new Error("apelantul a renunțat");

    const rezultat = fetchCuTermen(TERMEN)("https://exemplu.test", {
      signal: controlApelant.signal,
    }).catch((eroare: unknown) => eroare);

    controlApelant.abort(motiv);

    await expect(rezultat).resolves.toBe(motiv);
  });

  it("nu pornește nimic dacă semnalul apelantului e deja anulat", async () => {
    const apeluri = vi.fn(async (_resursa: unknown, optiuni?: RequestInit) => {
      // Semnalul primit e chiar al apelantului, nu unul construit de noi.
      expect(optiuni?.signal?.aborted).toBe(true);
      return new Response(null, { status: 499 });
    });
    globalThis.fetch = apeluri as unknown as typeof fetch;

    const controlApelant = new AbortController();
    controlApelant.abort(new Error("prea târziu"));

    await fetchCuTermen(TERMEN)("https://exemplu.test", { signal: controlApelant.signal });

    expect(apeluri).toHaveBeenCalledTimes(1);
  });
});

describe("esteTermenDepasit", () => {
  it("recunoaște marcajul și după ce eroarea și-a pierdut prototipul", () => {
    const reimpachetata = { ...new EroareTermenSupabase(TERMEN), esteTermenDepasit: true };
    expect(esteTermenDepasit(reimpachetata)).toBe(true);
  });

  it("respinge orice altceva", () => {
    expect(esteTermenDepasit(new Error("altă eroare"))).toBe(false);
    expect(esteTermenDepasit(null)).toBe(false);
    expect(esteTermenDepasit("termen")).toBe(false);
  });
});
