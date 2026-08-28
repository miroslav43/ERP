// src/lib/reges/client.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BAZE_API, BAZE_SSO, cheamaReges } from "./client";

const JETON = "jeton-de-test";

function raspuns(status: number, corp: unknown, tipText = false): Response {
  return new Response(tipText ? String(corp) : JSON.stringify(corp), {
    status,
    headers: { "Content-Type": tipText ? "text/plain" : "application/json" },
  });
}

let apeluri: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
  apeluri = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mockFetch(raspunsuri: (() => Response | Promise<Response>)[]): void {
  let i = 0;
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    apeluri.push({ url: String(url), init });
    const urmatorul = raspunsuri[Math.min(i, raspunsuri.length - 1)];
    i += 1;
    return Promise.resolve(urmatorul?.() ?? raspuns(200, {}));
  });
}

/** Rulează promisiunea lăsând cronometrele false să curgă. */
async function cu<T>(promisiune: Promise<T>): Promise<T> {
  const rezultat = promisiune.then((v) => v);
  await vi.runAllTimersAsync();
  return rezultat;
}

describe("bazele de URL", () => {
  it("separă mediile", () => {
    expect(BAZE_API.test).toBe("https://api.dev.inspectiamuncii.org");
    expect(BAZE_API.productie).toBe("https://api.inspectiamuncii.ro");
    expect(BAZE_SSO.test).toContain("sso.dev.inspectiamuncii.org/realms/API");
    expect(BAZE_SSO.productie).toContain("sso.inspectiamuncii.ro/realms/API");
  });
});

describe("cererea", () => {
  it("pune jetonul în antet și corpul ca JSON", async () => {
    mockFetch([() => raspuns(200, { responseId: "abc" })]);
    const r = await cu(
      cheamaReges<{ responseId: string }>({
        mediu: "test",
        cale: "/api/Contract",
        metoda: "POST",
        jeton: JETON,
        corp: { $type: "contract" },
      }),
    );

    expect(r.ok).toBe(true);
    const antete = apeluri[0]?.init.headers as Record<string, string>;
    expect(antete.Authorization).toBe(`Bearer ${JETON}`);
    expect(antete["Content-Type"]).toBe("application/json");
    expect(apeluri[0]?.init.body).toBe('{"$type":"contract"}');
  });

  it("trece consumerId ca parametru de query, nu în corp", async () => {
    // Swagger-ul îl declară query pe TOATE metodele Status/*; README-ul nu-l
    // pomenește deloc, iar un consumerId trimis în corp e ignorat tăcut.
    mockFetch([() => raspuns(200, [])]);
    await cu(
      cheamaReges({
        mediu: "test",
        cale: "/api/Status/ReadBatch",
        metoda: "POST",
        jeton: JETON,
        parametri: { consumerId: "c-1" },
        corp: { messages: 20 },
      }),
    );

    expect(apeluri[0]?.url).toBe(
      "https://api.dev.inspectiamuncii.org/api/Status/ReadBatch?consumerId=c-1",
    );
    expect(apeluri[0]?.init.body).toBe('{"messages":20}');
  });

  it("nu pune Content-Type când nu are corp", async () => {
    mockFetch([() => raspuns(200, {})]);
    await cu(cheamaReges({ mediu: "test", cale: "/api/Profile", metoda: "GET", jeton: JETON }));
    const antete = apeluri[0]?.init.headers as Record<string, string>;
    expect("Content-Type" in antete).toBe(false);
  });
});

describe("politica de reîncercare", () => {
  it("NU reîncearcă un 400 — același mesaj primește același refuz", async () => {
    mockFetch([() => raspuns(400, { title: "Schema invalidă" })]);
    const r = await cu(
      cheamaReges({ mediu: "test", cale: "/api/Contract", metoda: "POST", jeton: JETON, corp: {} }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motiv).toBe("validare");
    expect(apeluri).toHaveLength(1);
  });

  it("reîncearcă un 503 și reușește la a doua", async () => {
    let i = 0;
    mockFetch([
      () => {
        i += 1;
        return i === 1 ? raspuns(503, "indisponibil", true) : raspuns(200, { responseId: "ok" });
      },
    ]);
    const r = await cu(
      cheamaReges({ mediu: "test", cale: "/api/Contract", metoda: "POST", jeton: JETON, corp: {} }),
    );

    expect(r.ok).toBe(true);
    expect(apeluri.length).toBeGreaterThan(1);
  });

  it("se oprește după trei încercări pe indisponibil", async () => {
    mockFetch([() => raspuns(500, "eroare", true)]);
    const r = await cu(
      cheamaReges({ mediu: "test", cale: "/api/Contract", metoda: "POST", jeton: JETON, corp: {} }),
    );

    expect(r.ok).toBe(false);
    expect(apeluri).toHaveLength(3);
  });

  it("NU reîncearcă un 401 — jetonul se reîmprospătează în altă parte", async () => {
    mockFetch([() => raspuns(401, "expirat", true)]);
    const r = await cu(
      cheamaReges({ mediu: "test", cale: "/api/Contract", metoda: "POST", jeton: JETON, corp: {} }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motiv).toBe("neautorizat");
    expect(apeluri).toHaveLength(1);
  });
});

describe("mesajele de eroare", () => {
  it("scoate explicația din ProblemDetails", async () => {
    mockFetch([() => raspuns(400, { detail: "Câmpul Cnp este obligatoriu." })]);
    const r = await cu(
      cheamaReges({ mediu: "test", cale: "/api/Salariat", metoda: "POST", jeton: JETON, corp: {} }),
    );
    if (r.ok) return;
    expect(r.mesaj).toBe("Câmpul Cnp este obligatoriu.");
  });

  it("desface dicționarul de erori pe câmpuri", async () => {
    mockFetch([
      () =>
        raspuns(400, { title: "Validare", errors: { Cnp: ["obligatoriu"], Nume: ["prea lung"] } }),
    ]);
    const r = await cu(
      cheamaReges({ mediu: "test", cale: "/api/Salariat", metoda: "POST", jeton: JETON, corp: {} }),
    );
    if (r.ok) return;
    expect(r.mesaj).toContain("Cnp: obligatoriu");
    expect(r.mesaj).toContain("Nume: prea lung");
  });

  it("nu aruncă pentru un corp care nu e JSON", async () => {
    mockFetch([() => raspuns(200, "<html>eroare</html>", true)]);
    const r = await cu(
      cheamaReges({ mediu: "test", cale: "/api/Profile", metoda: "GET", jeton: JETON }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motiv).toBe("neasteptat");
  });

  it("nu aruncă pentru o cădere de rețea", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("ECONNREFUSED")));
    const r = await cu(
      cheamaReges({ mediu: "test", cale: "/api/Profile", metoda: "GET", jeton: JETON }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motiv).toBe("indisponibil");
    expect(r.status).toBeNull();
  });

  it("tratează un corp gol la 200 ca succes fără date", async () => {
    // `new Response("", { status: 204 })` ARUNCĂ: un status fără corp nu poate
    // avea corp. Corpul trebuie să fie `null`, altfel testul verifică din greșeală
    // comportamentul la cădere de rețea, nu pe cel la răspuns gol.
    mockFetch([() => new Response(null, { status: 204 })]);
    const r = await cu(
      cheamaReges({ mediu: "test", cale: "/api/Status/CommitRead", metoda: "POST", jeton: JETON }),
    );
    expect(r.ok).toBe(true);
  });
});
