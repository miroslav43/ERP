// src/lib/push/coada.test.ts
import { describe, expect, it, vi, afterEach } from "vitest";

import type { AdminSupabase } from "@/lib/supabase/admin";

import { golesteCoada, MAX_INCERCARI } from "./coada";

type Rand = {
  id: string;
  incercari: number;
  jeton: string;
  dispozitiv_id: string;
  titlu: string;
  corp: string | null;
  link: string | null;
};

/**
 * Client fals: expune doar ce folosește `golesteCoada`. Un mock al întregului
 * `SupabaseClient` ar fi de zece ori mai lung și ar testa biblioteca, nu codul.
 */
function dbFals(randuri: Rand[]) {
  const actualizari: { id: string; date: Record<string, unknown> }[] = [];
  const retrase: string[] = [];
  return {
    actualizari,
    retrase,
    rpc: (_nume: string, _args: unknown) => Promise.resolve({ data: randuri, error: null }),
    from(tabela: string) {
      return {
        update(date: Record<string, unknown>) {
          return {
            eq(_coloana: string, valoare: string) {
              if (tabela === "push_livrari") actualizari.push({ id: valoare, date });
              else retrase.push(valoare);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

function rand(peste: Partial<Rand> = {}): Rand {
  return {
    id: "l1",
    incercari: 0,
    jeton: "ExponentPushToken[a]",
    dispozitiv_id: "d1",
    titlu: "Concediu aprobat.",
    corp: null,
    link: "/portal/concediile-mele",
    ...peste,
  };
}

afterEach(() => vi.unstubAllGlobals());

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
    const db = dbFals([]);
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport).toEqual({ luate: 0, trimise: 0, esuate: 0, abandonate: 0, jetoaneRetrase: 0 });
    expect(apeluri).toHaveLength(0);
  });

  it("marchează trimis rândul livrat", async () => {
    mockExpo([{ status: "ok", id: "x" }]);
    const db = dbFals([rand()]);
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.trimise).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("trimis");
    expect(db.actualizari[0]?.date.trimis_la).toEqual(expect.any(String));
  });

  it("un jeton mort retrage dispozitivul și abandonează rândul", async () => {
    mockExpo([{ status: "error", details: { error: "DeviceNotRegistered" } }]);
    const db = dbFals([rand()]);
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.jetoaneRetrase).toBe(1);
    expect(raport.abandonate).toBe(1);
    expect(db.retrase).toEqual(["d1"]);
    expect(db.actualizari[0]?.date.stare).toBe("abandonat");
  });

  it("o eroare obișnuită lasă rândul reîncercabil și incrementează", async () => {
    mockExpo([{ status: "error", message: "boom", details: { error: "MessageTooBig" } }]);
    const db = dbFals([rand({ incercari: 1 })]);
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.esuate).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("in_asteptare");
    expect(db.actualizari[0]?.date.incercari).toBe(2);
    expect(db.actualizari[0]?.date.eroare).toBe("boom");
  });

  it("abandonează după MAX_INCERCARI", async () => {
    mockExpo([{ status: "error", message: "boom", details: { error: "MessageTooBig" } }]);
    const db = dbFals([rand({ incercari: MAX_INCERCARI - 1 })]);
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.abandonate).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("abandonat");
  });
});
