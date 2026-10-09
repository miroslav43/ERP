import { afterEach, describe, expect, it, vi } from "vitest";

import type { EvenimentServer } from "./masurare";
import {
  AGENT_SERVER,
  IP_FARA_LOCALIZARE,
  type Programator,
  configUmami,
  configUmamiDinMediu,
  corpEveniment,
  cuNumarare,
  numaraConversia,
  programeaza,
  trimiteEveniment,
} from "./umami-server";

const CONFIG = {
  adresa: "http://analitice.test/api/send",
  site: "00000000-0000-4000-8000-000000000000",
} as const;
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IP_VIZITATOR = "82.137.40.16";
const EV: EvenimentServer = {
  nume: "dl:condica-de-prezenta:pdf:om",
  cale: "/unelte/condica-de-prezenta",
};
/** Ce produce `cerereOm()`: `?format=pdf&luna=10` → luna trece prin lista albă. */
const EV_CERERE: EvenimentServer = { ...EV, date: { luna: 10 } };

function cerereOm(antete: Record<string, string> = {}, metoda = "GET"): Request {
  return new Request("http://localhost/api/unelte/condica-de-prezenta?format=pdf&luna=10", {
    method: metoda,
    headers: {
      host: "administrativo.ro",
      "user-agent": IPHONE,
      "sec-fetch-user": "?1",
      "cf-connecting-ip": IP_VIZITATOR,
      ...antete,
    },
  });
}

function fisier(): Response {
  return new Response("%PDF", {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="condica-prezenta-2026-10.pdf"',
    },
  });
}

function colector() {
  const sarcini: Array<() => Promise<unknown>> = [];
  const programator: Programator = (sarcina) => {
    sarcini.push(sarcina);
  };
  const trimise: EvenimentServer[] = [];
  const trimite = async (ev: EvenimentServer) => {
    trimise.push(ev);
    return true;
  };
  return { sarcini, programator, trimise, trimite };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("configurația", () => {
  it("adresa de trimitere vine din adresa scriptului", () => {
    expect(configUmami("http://analitice.test/script.js", " site-1 ")).toEqual({
      adresa: "http://analitice.test/api/send",
      site: "site-1",
    });
  });

  it("fără script, fără site sau cu o adresă stricată nu se trimite nimic", () => {
    expect(configUmami(undefined, "site-1")).toBeNull();
    expect(configUmami("http://analitice.test/script.js", "")).toBeNull();
    expect(configUmami("nu e o adresă", "site-1")).toBeNull();
  });

  it("din mediu citește variabilele publice ale scriptului", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_SRC", "http://analitice.test/script.js");
    vi.stubEnv("NEXT_PUBLIC_UMAMI_ID", "site-1");
    expect(configUmamiDinMediu()).toEqual({
      adresa: "http://analitice.test/api/send",
      site: "site-1",
    });
  });
});

describe("corpul trimis", () => {
  it("are doar numele, pagina și valori fixe — nimic despre vizitator", () => {
    expect(corpEveniment(CONFIG, EV)).toEqual({
      type: "event",
      payload: {
        website: CONFIG.site,
        hostname: "administrativo.ro",
        url: "/unelte/condica-de-prezenta",
        name: EV.nume,
        ip: IP_FARA_LOCALIZARE,
        userAgent: AGENT_SERVER,
        browser: "server",
        os: "server",
        device: "server",
      },
    });
  });

  it("câmpurile din lista albă pleacă în `data`, ca proprietăți de eveniment Umami", () => {
    const ev: EvenimentServer = { ...EV, date: { an: 2026, luna: 10, program: "ls" } };
    expect(corpEveniment(CONFIG, ev).payload.data).toEqual({ an: 2026, luna: 10, program: "ls" });
    expect(corpEveniment(CONFIG, EV).payload).not.toHaveProperty("data");
  });
});

describe("trimiteEveniment", () => {
  it("face POST la Umami, cu termen, și raportează reușita", async () => {
    const cerere = vi.fn(
      async (_adresa: string, _optiuni: RequestInit) =>
        new Response('{"cache":"x","sessionId":"s","visitId":"v"}'),
    );
    expect(await trimiteEveniment(EV, { config: CONFIG, cerere })).toBe(true);
    expect(cerere).toHaveBeenCalledTimes(1);
    expect(cerere.mock.calls[0]?.[0]).toBe(CONFIG.adresa);
    const optiuni = cerere.mock.calls[0]?.[1];
    expect(optiuni?.method).toBe("POST");
    expect(optiuni?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(optiuni?.body))).toEqual(corpEveniment(CONFIG, EV));
  });

  it("„beep boop”, un 400 sau o rețea căzută nu aruncă și nu sunt reușite", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const beep = async () => new Response('{"beep":"boop"}');
    const respins = async () => new Response("{}", { status: 400 });
    const cazut = async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    };
    for (const cerere of [beep, respins, cazut]) {
      expect(await trimiteEveniment(EV, { config: CONFIG, cerere })).toBe(false);
    }
  });

  it("fără configurație nu atinge rețeaua", async () => {
    const cerere = vi.fn(async (_adresa: string, _optiuni: RequestInit) => new Response("{}"));
    expect(await trimiteEveniment(EV, { config: null, cerere })).toBe(false);
    expect(cerere).not.toHaveBeenCalled();
  });
});

describe("cuNumarare", () => {
  it("întoarce exact răspunsul rutei și programează o singură trimitere", async () => {
    const { sarcini, programator, trimise, trimite } = colector();
    const raspuns = fisier();
    const GET = cuNumarare(async (_c: Request) => raspuns, { programator, trimite });
    expect(await GET(cerereOm())).toBe(raspuns);
    expect(sarcini).toHaveLength(1);
    await sarcini[0]?.();
    expect(trimise).toEqual([EV_CERERE]);
  });

  it("Umami care nu răspunde niciodată nu întârzie descărcarea", async () => {
    const { sarcini, programator } = colector();
    const GET = cuNumarare(async () => fisier(), {
      programator,
      trimite: () => new Promise<boolean>(() => {}),
    });
    expect((await GET(cerereOm())).status).toBe(200);
    expect(sarcini).toHaveLength(1);
  });

  it("în afara unei cereri, `after` aruncă E468 — descărcarea merge mai departe", async () => {
    const GET = cuNumarare(async () => fisier());
    expect((await GET(cerereOm())).status).toBe(200);
    expect(programeaza(EV)).toBe(false);
  });

  it("HEAD, staging și erorile rutei nu se numără", async () => {
    const { sarcini, programator, trimite } = colector();
    const GET = cuNumarare(async () => fisier(), { programator, trimite });
    await GET(cerereOm({}, "HEAD"));
    await GET(cerereOm({ host: "staging.administrativo.ro" }));
    expect(sarcini).toHaveLength(0);

    const cade = cuNumarare(
      async (): Promise<Response> => {
        throw new Error("generare");
      },
      { programator, trimite },
    );
    await expect(cade(cerereOm())).rejects.toThrow("generare");
    expect(sarcini).toHaveLength(0);
  });

  it("păstrează al doilea argument al unei rute dinamice", async () => {
    const GET = cuNumarare(
      async (_c: Request, ctx: { params: Promise<{ unealta: string }> }) =>
        new Response((await ctx.params).unealta),
    );
    const r = await GET(new Request("http://localhost/api/unelte/fisa-evaluare"), {
      params: Promise.resolve({ unealta: "fisa-evaluare" }),
    });
    expect(await r.text()).toBe("fisa-evaluare");
  });

  it("corpul care pleacă nu poartă IP-ul sau browserul vizitatorului", async () => {
    const { sarcini, programator } = colector();
    const cerere = vi.fn(async (_adresa: string, _optiuni: RequestInit) => new Response("{}"));
    const GET = cuNumarare(async () => fisier(), {
      programator,
      trimite: (ev) => trimiteEveniment(ev, { config: CONFIG, cerere }),
    });
    await GET(cerereOm());
    await sarcini[0]?.();
    const corp = String(cerere.mock.calls[0]?.[1]?.body);
    expect(corp).not.toContain(IP_VIZITATOR);
    expect(corp).not.toContain("iPhone");
    expect(corp).toContain('"name":"dl:condica-de-prezenta:pdf:om"');
    expect(corp).toContain('"data":{"luna":10}');
  });

  it("numele și firma scrise în formular nu pleacă, numărul angajaților da", async () => {
    const { sarcini, programator } = colector();
    const cerere = vi.fn(async (_adresa: string, _optiuni: RequestInit) => new Response("{}"));
    const GET = cuNumarare(async () => fisier(), {
      programator,
      trimite: (ev) => trimiteEveniment(ev, { config: CONFIG, cerere }),
    });
    const r = new Request(
      "http://localhost/api/unelte/condica-de-prezenta?format=pdf&an=2026&luna=10&angajati=Zzsecret+Popescu%0AIon+Pop&firma=Zzsecret+SRL&cui=RO14399840",
      { headers: { host: "administrativo.ro", "user-agent": IPHONE, "sec-fetch-user": "?1" } },
    );
    await GET(r);
    await sarcini[0]?.();
    const corp = String(cerere.mock.calls[0]?.[1]?.body);
    expect(corp).not.toMatch(/Zzsecret|14399840/u);
    expect(JSON.parse(corp).payload.data).toEqual({ an: 2026, luna: 10, angajati: 2 });
  });
});

describe("numaraConversia", () => {
  it("contul de pe administrativo.ro pleacă cu sursa lui", async () => {
    const { sarcini, programator, trimise, trimite } = colector();
    const antete = new Headers({ host: "administrativo.ro", "user-agent": IPHONE });
    expect(numaraConversia("foaie-de-pontaj", antete, { programator, trimite })).toBe(true);
    await sarcini[0]?.();
    expect(trimise).toEqual([{ nume: "cont:foaie-de-pontaj", cale: "/inregistrare" }]);
  });

  it("staging și serverul nostru nu se numără", () => {
    const { sarcini, programator, trimite } = colector();
    for (const antete of [
      new Headers({ host: "staging.administrativo.ro", "user-agent": IPHONE }),
      new Headers({
        host: "administrativo.ro",
        "user-agent": IPHONE,
        "cf-connecting-ip": "62.171.154.194",
      }),
    ]) {
      expect(numaraConversia("foaie-de-pontaj", antete, { programator, trimite })).toBe(false);
    }
    expect(sarcini).toHaveLength(0);
  });
});
