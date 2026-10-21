// src/lib/asistent/viziune.test.ts
//
// Clientul de viziune (F12a): corpul EXACT trimis la OpenRouter (ZDR, schemă
// strictă, FĂRĂ `temperature`), maparea codurilor de stare și ce NU ajunge în
// jurnal. Niciun apel real: `fetch` e o dublură.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ cheie: "sk-or-v1-test" }));

vi.mock("@/config/env", async (orig) => {
  const original = await orig<typeof import("@/config/env")>();
  return {
    ...original,
    serverEnv: {
      ...original.serverEnv,
      get OPENROUTER_API_KEY() {
        return env.cheie;
      },
      OPENROUTER_MODEL_VIZIUNE: "google/gemini-3.7-flash",
    },
  };
});

const { citesteImagineStructurat } = await import("./viziune");

const BASE64 = "QUJDREVGR0hJSktMTU5PUA==";

const intrare = {
  prompt: "Ești un transcriptor.",
  instructiune: "Transcrie bonul.",
  jpegBase64: BASE64,
  schema: { name: "bon", schema: { type: "object" } },
};

function raspunsOk(continut = '{"lizibil":true}'): Response {
  return new Response(
    JSON.stringify({
      model: "google/gemini-3.7-flash",
      choices: [{ message: { content: continut } }],
      usage: { prompt_tokens: 1800, completion_tokens: 550, cost: 0.0035 },
    }),
    { status: 200 },
  );
}

let consola: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  env.cheie = "sk-or-v1-test";
  consola = vi.spyOn(console, "error").mockImplementation(() => undefined);
  info = vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function corpTrimis(spion: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [, init] = spion.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("citesteImagineStructurat", () => {
  it("cheia goală ⇒ `neconfigurat`, fără niciun fetch", async () => {
    env.cheie = "";
    const spion = vi.fn();
    vi.stubGlobal("fetch", spion);
    const r = await citesteImagineStructurat(intrare);
    expect(r).toMatchObject({ ok: false, motiv: "neconfigurat" });
    expect(spion).not.toHaveBeenCalled();
  });

  it("corpul: ZDR, schemă strictă, efort low, FĂRĂ `temperature`, imaginea după text", async () => {
    const spion = vi.fn(async () => raspunsOk());
    vi.stubGlobal("fetch", spion);
    await citesteImagineStructurat(intrare);

    const [url, init] = spion.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const antete = init.headers as Record<string, string>;
    expect(antete["Authorization"]).toBe("Bearer sk-or-v1-test");
    expect(antete["X-Title"]).toBe("Administrativo");

    const corp = corpTrimis(spion);
    expect(corp["stream"]).toBe(false);
    expect("temperature" in corp).toBe(false);
    expect(corp["max_tokens"]).toBe(1500);
    expect(corp["model"]).toBe("google/gemini-3.7-flash");
    expect(corp["reasoning"]).toEqual({ effort: "low" });
    expect(corp["response_format"]).toEqual({
      type: "json_schema",
      json_schema: { name: "bon", strict: true, schema: { type: "object" } },
    });
    expect(corp["provider"]).toEqual({
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
    });
    const mesaje = corp["messages"] as {
      role: string;
      content: string | { type: string; text?: string; image_url?: { url: string } }[];
    }[];
    expect(mesaje[0]).toEqual({ role: "system", content: "Ești un transcriptor." });
    const parti = mesaje[1]?.content;
    expect(Array.isArray(parti)).toBe(true);
    if (!Array.isArray(parti)) return;
    expect(parti[0]).toEqual({ type: "text", text: "Transcrie bonul." });
    expect(parti[1]?.type).toBe("image_url");
    expect(parti[1]?.image_url?.url).toBe(`data:image/jpeg;base64,${BASE64}`);
  });

  it("răspuns valid ⇒ conținutul, modelul, costul și tokenii", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => raspunsOk('{"x":1}')),
    );
    const r = await citesteImagineStructurat(intrare);
    expect(r).toEqual({
      ok: true,
      continut: '{"x":1}',
      model: "google/gemini-3.7-flash",
      cost: 0.0035,
      tokeni: { intrare: 1800, iesire: 550 },
    });
  });

  it.each([
    [429, "limita limitare", "limita"],
    [404, "not found", "fara_endpoint"],
    [
      503,
      '{"error":{"message":"No available model provider meets your routing requirements"}}',
      "fara_endpoint",
    ],
    [503, "upstream down", "indisponibil"],
    [403, "guardrail", "indisponibil"],
    [402, "credit", "indisponibil"],
    [500, "boom", "indisponibil"],
  ])("HTTP %d ⇒ `%s` ⇒ %s", async (status, corp, motiv) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(corp, { status })),
    );
    const r = await citesteImagineStructurat(intrare);
    expect(r).toMatchObject({ ok: false, motiv });
    if (!r.ok) expect(r.mesaj).toMatch(/\.$/u);
  });

  it("fără `semnal` ⇒ nu aruncă; termen depășit ⇒ `termen`", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }),
    );
    await expect(citesteImagineStructurat(intrare)).resolves.toMatchObject({
      ok: false,
      motiv: "termen",
    });
  });

  it("rețea căzută ⇒ `indisponibil`, fără excepție", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(citesteImagineStructurat(intrare)).resolves.toMatchObject({
      ok: false,
      motiv: "indisponibil",
    });
  });

  it("forma necunoscută a răspunsului ⇒ `indisponibil`", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })),
    );
    expect(await citesteImagineStructurat(intrare)).toMatchObject({ ok: false });
  });

  it("jurnalul nu primește niciodată imaginea, nici răspunsul", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(`eroare cu ${BASE64} în corp`, { status: 500 })),
    );
    await citesteImagineStructurat(intrare);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => raspunsOk('{"secret":"continutul bonului"}')),
    );
    await citesteImagineStructurat(intrare);

    const tot = JSON.stringify([...consola.mock.calls, ...info.mock.calls]);
    expect(tot).not.toContain(BASE64);
    expect(tot).not.toContain("continutul bonului");
  });
});
