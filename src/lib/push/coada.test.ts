// src/lib/push/coada.test.ts
import { describe, expect, it, vi, afterEach } from "vitest";

import type { AdminSupabase } from "@/lib/supabase/admin";

import * as expoModule from "./expo";
import { golesteCoada, MAX_INCERCARI } from "./coada";

// Mock parțial: `trimiteLot` rămâne implementarea REALĂ (deleagă la
// `actual.trimiteLot`) pentru toate testele care mimează rețeaua prin
// `mockExpo`/`stubGlobal("fetch", ...)`. Un singur test (mai jos, „lot mai
// scurt") suprascrie explicit un răspuns, ca să exercite o formă
// (`rezultate.length < randuri.length`) pe care `trimiteLot` de azi n-o
// produce niciodată singur — vezi comentariul de acolo.
vi.mock("./expo", async (importActual) => {
  const actual = await importActual<typeof import("./expo")>();
  return { ...actual, trimiteLot: vi.fn(actual.trimiteLot) };
});

type Rand = {
  id: string;
  incercari: number;
  jeton: string;
  dispozitiv_id: string;
  titlu: string;
  corp: string | null;
  link: string | null;
};

type ConfigClientFals = {
  /** Ce întoarce `db.rpc("push_ia_din_coada", ...)`. `undefined` ⇒ `[]`. */
  randuriRpc?: Rand[] | null;
  eroareRpc?: { message: string } | null;
  /** Id-uri de `push_livrari` a căror scriere trebuie să eșueze. */
  scrieriPushLivrariEsuate?: ReadonlySet<string>;
  /** Id-uri de `dispozitive_push` a căror retragere (UPDATE) trebuie să eșueze. */
  retrageriEsuate?: ReadonlySet<string>;
  /**
   * Id-uri de dispozitive DEJA retrase înainte de această rulare — simulează
   * cursa cu alt rând din același lot sau cu `/api/dispozitive`:
   * `.is("deleted_at", null)` nu mai potrivește nimic, deci `retras` iese
   * `null`, FĂRĂ eroare.
   */
  dejaRetrase?: ReadonlySet<string>;
  /** Dacă scrierea în `audit_logs` trebuie să eșueze. */
  auditEsueaza?: boolean;
};

/**
 * Client fals: expune doar ce folosește `golesteCoada`. Un mock al întregului
 * `SupabaseClient` ar fi de zece ori mai lung și ar testa biblioteca, nu codul.
 *
 * Suprafața a crescut față de runda 1 (era doar `.update().eq()` pe
 * `push_livrari`): `golesteCoada` verifică acum `error` la fiecare scriere și
 * scrie explicit auditul retragerii, deci fake-ul trebuie să poată SIMULA un
 * eșec de scriere pe fiecare tabelă, nu doar să înregistreze succesul.
 */
function clientFals(config: ConfigClientFals = {}) {
  const actualizari: { id: string; date: Record<string, unknown> }[] = [];
  const retrase: string[] = [];
  const audituri: Record<string, unknown>[] = [];

  return {
    actualizari,
    retrase,
    audituri,
    rpc: (_nume: string, _args: unknown) => {
      if (config.eroareRpc) return Promise.resolve({ data: null, error: config.eroareRpc });
      return Promise.resolve({
        data: config.randuriRpc === undefined ? [] : config.randuriRpc,
        error: null,
      });
    },
    from(tabela: string) {
      if (tabela === "push_livrari") {
        return {
          update(date: Record<string, unknown>) {
            return {
              eq(_coloana: string, id: string) {
                if (config.scrieriPushLivrariEsuate?.has(id)) {
                  return Promise.resolve({ error: { message: "scriere eșuată (simulat)." } });
                }
                actualizari.push({ id, date });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (tabela === "dispozitive_push") {
        return {
          update(_date: Record<string, unknown>) {
            return {
              eq(_coloana: string, id: string) {
                return {
                  is(_coloana2: string, _valoare: null) {
                    return {
                      select(_coloane: string) {
                        return {
                          maybeSingle() {
                            if (config.retrageriEsuate?.has(id)) {
                              return Promise.resolve({
                                data: null,
                                error: { message: "retragere eșuată (simulat)." },
                              });
                            }
                            if (config.dejaRetrase?.has(id)) {
                              return Promise.resolve({ data: null, error: null });
                            }
                            retrase.push(id);
                            return Promise.resolve({
                              data: { organization_id: "org-1", user_id: "user-1" },
                              error: null,
                            });
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (tabela === "audit_logs") {
        return {
          insert(rand: Record<string, unknown>) {
            audituri.push(rand);
            if (config.auditEsueaza) {
              return Promise.resolve({ error: { message: "audit eșuat (simulat)." } });
            }
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`clientFals: tabelă neașteptată „${tabela}”.`);
    },
  };
}

function rand(peste: Partial<Rand> = {}): Rand {
  return {
    id: "l1",
    // Reflectă valoarea DEJA incrementată de `push_ia_din_coada` la preluare
    // (0122, secțiunea 5b, Runda 2) — un rând claimat pentru prima oară vine
    // din RPC cu `incercari = 1`, nu `0`. `golesteCoada` nu mai adaugă un
    // `+ 1` în TypeScript.
    incercari: 1,
    jeton: "ExponentPushToken[a]",
    dispozitiv_id: "d1",
    titlu: "Concediu aprobat.",
    corp: null,
    link: "/portal/concediile-mele",
    ...peste,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(expoModule.trimiteLot).mockClear();
});

function mockExpo(bilete: unknown[]): void {
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      new Response(JSON.stringify({ data: bilete }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("golesteCoada", () => {
  it("coada goală nu cheamă rețeaua", async () => {
    const apeluri: unknown[] = [];
    vi.stubGlobal("fetch", (...a: unknown[]) => {
      apeluri.push(a);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const db = clientFals({ randuriRpc: [] });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport).toEqual({ luate: 0, trimise: 0, esuate: 0, abandonate: 0, jetoaneRetrase: 0 });
    expect(apeluri).toHaveLength(0);
  });

  it("`data: null` de la rpc se tratează ca array gol, nu ca excepție", async () => {
    const apeluri: unknown[] = [];
    vi.stubGlobal("fetch", (...a: unknown[]) => {
      apeluri.push(a);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    // `randuriRpc: null` explicit — distinct de `undefined` (⇒ `[]` în fake),
    // exact forma pe care `db.rpc(...)` o poate întoarce real când n-are
    // niciun rând de dat.
    const db = clientFals({ randuriRpc: null });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport).toEqual({ luate: 0, trimise: 0, esuate: 0, abandonate: 0, jetoaneRetrase: 0 });
    expect(apeluri).toHaveLength(0);
  });

  it("o eroare de la rpc se propagă ca excepție, cu mesaj în română", async () => {
    const db = clientFals({ eroareRpc: { message: "conexiune refuzată" } });
    await expect(golesteCoada(db as unknown as AdminSupabase)).rejects.toThrow(
      "Preluarea din coadă a eșuat: conexiune refuzată.",
    );
  });

  it("marchează trimis rândul livrat", async () => {
    mockExpo([{ status: "ok", id: "x" }]);
    const db = clientFals({ randuriRpc: [rand()] });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.trimise).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("trimis");
    expect(db.actualizari[0]?.date.trimis_la).toEqual(expect.any(String));
  });

  it("un jeton mort retrage dispozitivul, scrie auditul și abandonează rândul", async () => {
    mockExpo([{ status: "error", details: { error: "DeviceNotRegistered" } }]);
    const db = clientFals({ randuriRpc: [rand()] });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.jetoaneRetrase).toBe(1);
    expect(raport.abandonate).toBe(1);
    expect(db.retrase).toEqual(["d1"]);
    expect(db.actualizari[0]?.date.stare).toBe("abandonat");
    // Auditul manual e obligatoriu (src/lib/supabase/admin.ts): triggerul
    // generic ar scrie actor_id = auth.uid(), NULL sub service_role oricum —
    // aici actor_id rămâne EXPLICIT null, fiindcă nu există niciun om care a
    // acționat (Expo a confirmat un telefon mort, nu o predare).
    expect(db.audituri).toHaveLength(1);
    expect(db.audituri[0]).toMatchObject({
      organization_id: "org-1",
      actor_id: null,
      action: "delete",
      entity_type: "dispozitive_push",
      entity_id: "d1",
    });
  });

  it("dispozitiv deja retras (cursă benignă): rândul se abandonează, dar fără o nouă retragere sau un nou audit", async () => {
    mockExpo([{ status: "error", details: { error: "DeviceNotRegistered" } }]);
    const db = clientFals({ randuriRpc: [rand()], dejaRetrase: new Set(["d1"]) });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.jetoaneRetrase).toBe(0);
    expect(raport.abandonate).toBe(1);
    expect(db.retrase).toEqual([]);
    expect(db.audituri).toHaveLength(0);
    expect(db.actualizari[0]?.date.stare).toBe("abandonat");
  });

  it("retragerea dispozitivului eșuează: rândul tot se abandonează, dar nu se numără ca jeton retras", async () => {
    mockExpo([{ status: "error", details: { error: "DeviceNotRegistered" } }]);
    const spyEroare = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = clientFals({ randuriRpc: [rand()], retrageriEsuate: new Set(["d1"]) });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.jetoaneRetrase).toBe(0);
    expect(raport.abandonate).toBe(1);
    expect(db.retrase).toEqual([]);
    expect(db.audituri).toHaveLength(0);
    expect(spyEroare).toHaveBeenCalled();
    spyEroare.mockRestore();
  });

  it("o eroare obișnuită lasă rândul reîncercabil, cu numărul de încercări NEATINS de TypeScript", async () => {
    mockExpo([{ status: "error", message: "boom", details: { error: "MessageTooBig" } }]);
    // `incercari: 2` simulează a doua preluare a aceluiași rând (deja
    // incrementat de SQL, de la 1 la 2) — `golesteCoada` scrie EXACT această
    // valoare înapoi, fără un `+ 1` suplimentar (Runda 2: incrementul s-a
    // mutat în `push_ia_din_coada`, ca să avanseze chiar și când scrierea
    // asta eșuează constant).
    const db = clientFals({ randuriRpc: [rand({ incercari: 2 })] });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.esuate).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("in_asteptare");
    expect(db.actualizari[0]?.date.incercari).toBe(2);
    expect(db.actualizari[0]?.date.eroare).toBe("boom");
  });

  it("abandonează după MAX_INCERCARI", async () => {
    mockExpo([{ status: "error", message: "boom", details: { error: "MessageTooBig" } }]);
    // `incercari: MAX_INCERCARI` — valoarea vine DEJA la prag din preluare
    // (SQL incrementează la fiecare claim), nu `MAX_INCERCARI - 1` + 1 ca
    // înainte de Runda 2.
    const db = clientFals({ randuriRpc: [rand({ incercari: MAX_INCERCARI })] });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.abandonate).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("abandonat");
    expect(db.actualizari[0]?.date.incercari).toBe(MAX_INCERCARI);
  });

  it("o scriere de stare eșuată nu se numără ca succes și nu blochează restul lotului", async () => {
    mockExpo([
      { status: "error", message: "boom", details: { error: "MessageTooBig" } },
      { status: "ok" },
    ]);
    const spyEroare = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = clientFals({
      randuriRpc: [rand({ id: "l1" }), rand({ id: "l2", dispozitiv_id: "d2" })],
      scrieriPushLivrariEsuate: new Set(["l1"]),
    });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    // l1: scrierea reîncercării a picat — nu se numără nici la `esuate`.
    expect(raport.esuate).toBe(0);
    expect(db.actualizari.some((a) => a.id === "l1")).toBe(false);
    // l2: nealterat de eșecul lui l1 — poziția se potrivește corect.
    expect(raport.trimise).toBe(1);
    expect(db.actualizari.find((a) => a.id === "l2")?.date.stare).toBe("trimis");
    expect(raport.luate).toBe(2);
    // Invarianta raportului: diferența dintre `luate` și suma celorlalte
    // patru contoare e vizibilă (aici 1), nu ascunsă într-un fals succes.
    expect(raport.trimise + raport.esuate + raport.abandonate).toBe(1);
    expect(spyEroare).toHaveBeenCalled();
    spyEroare.mockRestore();
  });

  it("N rânduri cu rezultate amestecate: potrivirea pozițională ține pentru toate", async () => {
    mockExpo([
      { status: "ok" },
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "error", message: "boom", details: { error: "MessageTooBig" } },
    ]);
    const db = clientFals({
      randuriRpc: [
        rand({ id: "l1", dispozitiv_id: "d1" }),
        rand({ id: "l2", dispozitiv_id: "d2" }),
        rand({ id: "l3", dispozitiv_id: "d3", incercari: 1 }),
      ],
    });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport).toEqual({ luate: 3, trimise: 1, esuate: 1, abandonate: 1, jetoaneRetrase: 1 });
    expect(db.actualizari.find((a) => a.id === "l1")?.date.stare).toBe("trimis");
    expect(db.actualizari.find((a) => a.id === "l2")?.date.stare).toBe("abandonat");
    expect(db.actualizari.find((a) => a.id === "l3")?.date.stare).toBe("in_asteptare");
    // Scris exact ce a venit din preluare (1) — TypeScript nu mai incrementează.
    expect(db.actualizari.find((a) => a.id === "l3")?.date.incercari).toBe(1);
    // Doar dispozitivul mort (l2 → d2) se retrage — nu d1, nu d3.
    expect(db.retrase).toEqual(["d2"]);
  });

  it("lot mai scurt decât cozile trimise: rândul rămas se tratează ca eroare reîncercabilă, nu se pierde", async () => {
    // `trimiteLot` de azi nu produce niciodată un rezultat mai scurt decât
    // intrarea (fiecare poziție lipsă e umplută de `citesteBilet(undefined)`
    // cu un `{ fel: "eroare" }` explicit) — de-aia forma se simulează direct
    // pe mock-ul funcției, nu prin `mockExpo`/`fetch`. Contractul pozițional
    // cu Task 3 a costat trei runde de reparații tocmai pe cazul ăsta.
    vi.mocked(expoModule.trimiteLot).mockResolvedValueOnce([{ fel: "ok" }]);
    const db = clientFals({
      randuriRpc: [rand({ id: "l1" }), rand({ id: "l2", dispozitiv_id: "d2" })],
    });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.luate).toBe(2);
    expect(raport.trimise).toBe(1);
    expect(db.actualizari.find((a) => a.id === "l1")?.date.stare).toBe("trimis");
    // l2 n-are bilet corespunzător — tratat ca eroare reîncercabilă, NU
    // aruncă și NU indexează greșit restul lotului.
    expect(raport.esuate).toBe(1);
    expect(db.actualizari.find((a) => a.id === "l2")?.date.stare).toBe("in_asteptare");
    expect(db.actualizari.find((a) => a.id === "l2")?.date.eroare).toBe("Fără bilet de la Expo.");
  });
});
