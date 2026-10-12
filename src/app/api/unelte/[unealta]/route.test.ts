import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * `after` din `next/server` aruncă în afara unei cereri reale. Aici îl înlocuim
 * cu o coadă, ca să putem rula sarcina programată și să vedem ce pleacă la
 * Umami. Restul modulului (NextRequest) rămâne cel adevărat.
 */
const { programate } = vi.hoisted(() => ({
  programate: [] as Array<() => Promise<unknown>>,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (sarcina: () => Promise<unknown>) => {
    programate.push(sarcina);
  },
}));

import { unealtaDinCale } from "@/lib/unelte/masurare";
import { formatePentru, UNELTE } from "@/lib/unelte/registru";

import { GET } from "./route";

const cere = (cale: string, slug: string, antete: Record<string, string> = {}) =>
  GET(new NextRequest(`http://localhost${cale}`, { headers: antete }), {
    params: Promise.resolve({ unealta: slug }),
  });

describe("ruta comună de descărcare", () => {
  it("o unealtă necunoscută primește 404", async () => {
    expect((await cere("/api/unelte/constructor", "constructor")).status).toBe(404);
  });

  it("cererea de concediu nu mai trece pe aici: are ruta ei, cu scrisoarea", async () => {
    // Ruta statică `/api/unelte/cerere-concediu` are prioritate în Next; registrul
    // nu mai are intrarea, deci un apel direct aici nu produce formularul vechi.
    expect((await cere("/api/unelte/cerere-concediu", "cerere-concediu")).status).toBe(404);
  });

  it("fișierul generat iese cu cache-control private, no-store", async () => {
    // Condica (E12) și fișa de evaluare (I7) au rute statice; ruta comună se
    // verifică pe o unealtă rămasă în `UNELTE`.
    const r = await cere("/api/unelte/fisa-instruire-ssm?format=pdf", "fisa-instruire-ssm");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("formatul cu majuscule dă formatul cerut, nu PDF", async () => {
    // Fișa de evaluare are rută statică (secțiunea I) și propriul test de format;
    // aici proba rămâne pe o unealtă servită de ruta comună.
    const r = await cere("/api/unelte/fisa-instruire-ssm?format=DOCX", "fisa-instruire-ssm");
    expect(r.headers.get("content-type")).toContain("wordprocessingml");
  });
});

describe("fișa de instruire SSM se descarcă doar în Word și PDF", () => {
  it("Excel primește 400 cu formatele disponibile, nu un fișier fără jumătate din anexă", async () => {
    const r = await cere(
      "/api/unelte/fisa-instruire-ssm?format=xlsx&nume=Popa",
      "fisa-instruire-ssm",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toBe("Unealta asta se descarcă doar în PDF sau Word.");
  });

  it("PDF și Word răspund cu fișierul", async () => {
    const pdf = await cere("/api/unelte/fisa-instruire-ssm?format=pdf", "fisa-instruire-ssm");
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    const docx = await cere("/api/unelte/fisa-instruire-ssm?format=docx", "fisa-instruire-ssm");
    expect(docx.status).toBe(200);
    expect(docx.headers.get("content-type")).toContain("wordprocessingml");
  });

  it("celelalte unelte din registru își păstrează Excelul", async () => {
    // E12, F12, G6 și I7 mută condica, cererea, foaia de parcurs și fișa de
    // evaluare pe rute statice, iar K8–K10 adaugă unelte noi. Fișa SSM poate
    // rămâne singura din `UNELTE`; atunci nu e nimic de verificat aici, iar
    // `formatePentru` e păzit de `registru.test.ts`.
    const alta = Object.keys(UNELTE).find((s) => formatePentru(s).includes("xlsx"));
    const r = alta === undefined ? null : await cere(`/api/unelte/${alta}?format=xlsx`, alta);
    expect(r === null || r.status === 200, alta).toBe(true);
  });
});

describe("cererea de demisie prin ruta comună", () => {
  it("dă un PDF pentru o cerere obișnuită", async () => {
    const r = await cere(
      "/api/unelte/cerere-demisie?tip=preaviz&nume=Popescu%20Ana&depunere=2026-10-08&format=pdf",
      "cerere-demisie",
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
  });

  it("un preaviz dincolo de calendar dă 400 cu motivul, nu un fișier", async () => {
    const r = await cere(
      "/api/unelte/cerere-demisie?tip=preaviz&depunere=2035-12-20&format=docx",
      "cerere-demisie",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/2035/u);
  });

  it("Excel primește 400: scrisoarea n-are formă de foaie de calcul", async () => {
    const r = await cere("/api/unelte/cerere-demisie?format=xlsx", "cerere-demisie");
    expect(r.status).toBe(400);
    expect(await r.text()).toBe("Unealta asta se descarcă doar în PDF sau Word.");
  });
});

describe("programarea concediilor prin ruta comună", () => {
  it("dă un Excel", async () => {
    const r = await cere(
      "/api/unelte/programare-concedii?an=2027&angajati=Popa%20Ion&format=xlsx",
      "programare-concedii",
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });
});

describe("adeverința de salariat prin ruta comună", () => {
  it("dă un Word valid", async () => {
    const r = await cere(
      "/api/unelte/adeverinta-salariat?nume=Popescu%20Ana&salariu=4.325&format=docx",
      "adeverinta-salariat",
    );
    expect(r.status).toBe(200);
    expect(new Uint8Array(await r.arrayBuffer()).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
  });

  it("Excel primește 400: adeverința n-are formă de foaie de calcul", async () => {
    const r = await cere("/api/unelte/adeverinta-salariat?format=xlsx", "adeverinta-salariat");
    expect(r.status).toBe(400);
    expect(await r.text()).toBe("Unealta asta se descarcă doar în PDF sau Word.");
  });
});

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const OM = {
  host: "administrativo.ro",
  "user-agent": IPHONE,
  "sec-fetch-user": "?1",
  "cf-connecting-ip": "82.137.40.16",
};

/**
 * Prima unealtă din registrul comun care dă un PDF doar cu `?format=pdf`. Cererea
 * de probă n-are `host`, deci nu se numără. Registrul se schimbă de la o secțiune
 * la alta (E12, F12, I7 scot unelte, K le adaugă); testul nu depinde de care rămân.
 */
async function unealtaCareDescarca(): Promise<{ slug: string; pagina: string }> {
  for (const slug of Object.keys(UNELTE)) {
    const pagina = unealtaDinCale(`/api/unelte/${slug}`);
    if (pagina === null) continue;
    const r = await cere(`/api/unelte/${slug}?format=pdf`, slug);
    if (r.status === 200 && /^attachment/u.test(r.headers.get("content-disposition") ?? "")) {
      return { slug, pagina };
    }
  }
  throw new Error("Nicio unealtă din registru nu descarcă un PDF doar cu ?format=pdf.");
}

describe("numărarea descărcărilor pe server", () => {
  beforeEach(() => {
    programate.length = 0;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("descărcarea unui om pleacă drept dl:<unealtă>:pdf:om, fără IP și fără UA", async () => {
    const { slug, pagina } = await unealtaCareDescarca();
    expect(programate).toHaveLength(0);
    vi.stubEnv("NEXT_PUBLIC_UMAMI_SRC", "http://analitice.test/script.js");
    vi.stubEnv("NEXT_PUBLIC_UMAMI_ID", "00000000-0000-4000-8000-000000000000");
    const trimis = vi.fn(
      async (_adresa: unknown, _optiuni?: RequestInit) => new Response('{"cache":"x"}'),
    );
    vi.stubGlobal("fetch", trimis);

    const r = await cere(`/api/unelte/${slug}?format=pdf`, slug, OM);
    expect(r.status).toBe(200);
    expect(programate).toHaveLength(1);

    await programate[0]?.();
    expect(trimis).toHaveBeenCalledTimes(1);
    expect(String(trimis.mock.calls[0]?.[0])).toBe("http://analitice.test/api/send");
    const corp = String(trimis.mock.calls[0]?.[1]?.body);
    expect(JSON.parse(corp).payload.name).toBe(`dl:${pagina}:pdf:om`);
    expect(corp).not.toContain("82.137.40.16");
    expect(corp).not.toContain("iPhone");
  });

  it("404, staging și localhost nu programează nimic", async () => {
    const { slug } = await unealtaCareDescarca();
    await cere("/api/unelte/inexistent?format=pdf", "inexistent", OM);
    await cere(`/api/unelte/${slug}?format=pdf`, slug, {
      ...OM,
      host: "staging.administrativo.ro",
    });
    await cere(`/api/unelte/${slug}?format=pdf`, slug);
    expect(programate).toHaveLength(0);
  });

  it("numele, firma și CUI-ul din formular nu pleacă la Umami", async () => {
    const { slug } = await unealtaCareDescarca();
    vi.stubEnv("NEXT_PUBLIC_UMAMI_SRC", "http://analitice.test/script.js");
    vi.stubEnv("NEXT_PUBLIC_UMAMI_ID", "00000000-0000-4000-8000-000000000000");
    const trimis = vi.fn(
      async (_adresa: unknown, _optiuni?: RequestInit) => new Response('{"cache":"x"}'),
    );
    vi.stubGlobal("fetch", trimis);

    const libere = "nume=Zzsecret+Popescu&firma=Zzsecret+SRL&cui=RO14399840&functie=Zzsecret";
    const r = await cere(`/api/unelte/${slug}?format=pdf&${libere}`, slug, OM);
    expect(r.status).toBe(200);
    await programate[0]?.();
    const corp = String(trimis.mock.calls[0]?.[1]?.body);
    expect(corp).toContain('"name":"dl:');
    expect(corp).not.toMatch(/Zzsecret|14399840/u);
  });
});
