// src/lib/queries/flota-iesire.test.ts
//
// Citirile ieșirii din parc (0218, F12h), pe clientul fals: firma și rândul viu
// explicit, ieșirea ANULATĂ în afara termenelor deschise, keyset pe (termen, id).
// NU prind o politică RLS greșită — aceea e pe `tests/rls/proba-flota-iesire.sql`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, type ClientFals } from "@/lib/teste/supabase-fals";

import { codificaCursor } from "./cursor";
import { iesireaVehiculului, incidentePentruIesire, termeneDeIesireDeschise } from "./flota-iesire";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

function argumente(apel: ReturnType<ClientFals["apeluriPe"]>[number] | undefined, metoda: string) {
  return apel?.filtre.filter((f) => f.metoda === metoda).map((f) => f.argumente);
}

const termen = (id: string, zi: string) => ({
  id,
  cod: "radiere_drpciv",
  denumire: "Radierea din evidența DRPCIV",
  natura: "legal",
  termen: zi,
  vehicle_id: ID_2,
  iesire: { id: ID_1, tip: "casare", destinatie_epava: null, motiv_radiere: null, anulat_la: null },
  vehicul: { id: ID_2, nr_inmatriculare: "B 100 ABC" },
});

/*
 * F12h: „termenele deschise ale vehiculelor ieșite din parc” nu aveau citire.
 * Panoul de pe `/flota` le arată pe toate, cele mai apropiate primele.
 */
describe("termeneDeIesireDeschise", () => {
  it("doar termenele deschise, cu dată, ale ieșirilor VII; termen crescător, apoi id", async () => {
    db.raspunde("vehicle_exit_obligations", "select", { data: [termen("t-1", "2026-11-01")] });
    const r = await termeneDeIesireDeschise(ORG_ID, { cursor: null, limita: 10 });

    expect(r).toEqual({ randuri: [termen("t-1", "2026-11-01")], urmatorulCursor: null });
    const [apel] = db.apeluriPe("vehicle_exit_obligations");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "is", "finalizat_la", null)).toBe(true);
    expect(areFiltru(apel, "eq", "nu_se_aplica", false)).toBe(true);
    expect(areFiltru(apel, "not", "termen", "is")).toBe(true);
    // Termenele unei ieșiri anulate rămân în tabelă ca istoric: ies prin join.
    expect(apel?.coloane).toContain("iesire:vehicle_exits!inner(");
    expect(areFiltru(apel, "is", "iesire.anulat_la", null)).toBe(true);
    expect(areFiltru(apel, "is", "iesire.deleted_at", null)).toBe(true);
    expect(argumente(apel, "order")).toEqual([["termen"], ["id"]]);
    expect(argumente(apel, "limit")).toEqual([[11]]);
  });

  it("pagina plină dă cursorul ultimului rând; cursorul continuă după (termen, id)", async () => {
    db.raspunde("vehicle_exit_obligations", "select", {
      data: [termen("t-1", "2026-11-01"), termen("t-2", "2026-11-05"), termen("t-3", "2026-12-01")],
    });
    const r = await termeneDeIesireDeschise(ORG_ID, { cursor: null, limita: 2 });
    expect(r.randuri.map((t) => t.id)).toEqual(["t-1", "t-2"]);
    expect(r.urmatorulCursor).toBe(codificaCursor({ valoare: "2026-11-05", id: "t-2" }));

    db.raspunde("vehicle_exit_obligations", "select", { data: [] });
    await termeneDeIesireDeschise(ORG_ID, { cursor: r.urmatorulCursor, limita: 2 });
    const [, apel] = db.apeluriPe("vehicle_exit_obligations");
    expect(argumente(apel, "or")).toEqual([
      ['termen.gt."2026-11-05",and(termen.eq."2026-11-05",id.gt."t-2")'],
    ]);
  });
});

describe("iesireaVehiculului — incidentul legat", () => {
  it("aduce `incident_id` și incidentul încorporat (NULL când RLS îl ascunde)", async () => {
    db.raspunde("vehicle_exits", "select", { data: null });
    await iesireaVehiculului(ORG_ID, ID_2);
    const [apel] = db.apeluriPe("vehicle_exits");
    expect(apel?.coloane).toContain("incident_id");
    expect(apel?.coloane).toContain("incident:vehicle_incidents!incident_id(id, tip, produs_la)");
  });
});

describe("incidentePentruIesire", () => {
  it("incidentele vehiculului, ale firmei, vii, cele mai noi primele, cu plafon", async () => {
    db.raspunde("vehicle_incidents", "select", { data: [] });
    expect(await incidentePentruIesire(ORG_ID, ID_2)).toEqual([]);
    const [apel] = db.apeluriPe("vehicle_incidents");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "vehicle_id", ID_2)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "order")).toEqual([
      ["produs_la", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(argumente(apel, "limit")).toEqual([[20]]);
  });
});
