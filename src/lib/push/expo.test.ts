import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_PE_LOT, trimiteLot } from "./expo";
import type { MesajPush } from "./mesaj";

function mesaj(jeton: string): MesajPush {
  return {
    to: jeton,
    title: "T",
    body: "B",
    data: { cale: "/portal" },
    sound: "default",
    channelId: "implicit",
  };
}

let apeluri: { url: string; init: RequestInit }[] = [];

function mockFetch(corpuri: unknown[]): void {
  let i = 0;
  apeluri = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    apeluri.push({ url: String(url), init });
    const corp = corpuri[Math.min(i, corpuri.length - 1)];
    i += 1;
    return Promise.resolve(
      new Response(JSON.stringify(corp), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trimiteLot", () => {
  it("nu cheamă rețeaua pentru un lot gol", async () => {
    mockFetch([{ data: [] }]);
    const rezultate = await trimiteLot([]);
    expect(rezultate).toEqual([]);
    expect(apeluri).toHaveLength(0);
  });

  it("traduce biletele ok", async () => {
    mockFetch([{ data: [{ status: "ok", id: "x" }] }]);
    const rezultate = await trimiteLot([mesaj("ExponentPushToken[a]")]);
    expect(rezultate).toEqual([{ fel: "ok" }]);
  });

  it("recunoaște jetonul mort după DeviceNotRegistered", async () => {
    mockFetch([
      {
        data: [{ status: "error", message: "…", details: { error: "DeviceNotRegistered" } }],
      },
    ]);
    const rezultate = await trimiteLot([mesaj("ExponentPushToken[a]")]);
    expect(rezultate).toEqual([{ fel: "jeton-mort" }]);
  });

  it("orice altă eroare rămâne reîncercabilă", async () => {
    mockFetch([
      {
        data: [{ status: "error", message: "MessageTooBig", details: { error: "MessageTooBig" } }],
      },
    ]);
    const rezultate = await trimiteLot([mesaj("ExponentPushToken[a]")]);
    expect(rezultate[0]?.fel).toBe("eroare");
    expect(rezultate[0]).toEqual({ fel: "eroare", mesaj: "MessageTooBig" });
  });

  it("sparge loturile mai mari de 100 și păstrează ordinea", async () => {
    const mesaje = Array.from({ length: 150 }, (_, i) => mesaj(`ExponentPushToken[${i}]`));
    mockFetch([
      { data: Array.from({ length: MAX_PE_LOT }, () => ({ status: "ok", id: "x" })) },
      { data: Array.from({ length: 50 }, () => ({ status: "ok", id: "x" })) },
    ]);
    const rezultate = await trimiteLot(mesaje);
    expect(apeluri).toHaveLength(2);
    expect(rezultate).toHaveLength(150);
    expect(rezultate.every((r) => r.fel === "ok")).toBe(true);
  });

  it("un răspuns scurt nu lasă mesaje fără rezultat", async () => {
    // Expo a răspuns cu mai puține bilete decât mesaje trimise. Fără plasa asta,
    // ruta ar potrivi pozițional greșit și ar marca un mesaj netrimis ca trimis.
    mockFetch([{ data: [{ status: "ok", id: "x" }] }]);
    const rezultate = await trimiteLot([
      mesaj("ExponentPushToken[a]"),
      mesaj("ExponentPushToken[b]"),
    ]);
    expect(rezultate).toHaveLength(2);
    expect(rezultate[1]?.fel).toBe("eroare");
  });

  it("un HTTP nereușit face tot lotul reîncercabil", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("nope", { status: 502 })));
    const rezultate = await trimiteLot([mesaj("ExponentPushToken[a]")]);
    expect(rezultate[0]?.fel).toBe("eroare");
  });

  it("un corp JSON nevalid la 200 nu aruncă și nu pierde loturile de dinainte", async () => {
    let apel = 0;
    vi.stubGlobal("fetch", () => {
      apel += 1;
      // Primul lot reușește, al doilea întoarce 200 cu corp nevalid.
      const corp =
        apel === 1
          ? JSON.stringify({
              data: Array.from({ length: MAX_PE_LOT }, () => ({ status: "ok", id: "x" })),
            })
          : "nu e json";
      return Promise.resolve(
        new Response(corp, { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    });
    const mesaje = Array.from({ length: 150 }, (_, i) => mesaj(`ExponentPushToken[${i}]`));
    const rezultate = await trimiteLot(mesaje);
    expect(rezultate).toHaveLength(150);
    expect(rezultate[0]?.fel).toBe("ok");
    expect(rezultate[149]?.fel).toBe("eroare");
  });
});
