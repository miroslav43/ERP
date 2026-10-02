// src/app/(app)/mentenanta/actions-triaj.test.ts
//
// Triajul și rezolvarea sesizărilor — poarta e `maintenance:update` / team,
// nu `create` (capcana 35). Rezolvarea are ordine obligatorie: întâi
// intervenția, apoi sesizarea cu `intervention_id`-ul ei.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("next/server", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextServer(await orig()),
);
vi.mock("next/cache", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()),
);
vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/supabase/admin", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseAdmin(),
);
vi.mock("@/lib/auth/features", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.features(await orig()),
);
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);

import { caiRevalidate, configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { rezolvaSesizare, trieazaSesizare } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const UPDATE = { "maintenance:update": "team" } as const;

const rezolvare = {
  id: ID_1,
  tip: "corectiva",
  data: "2026-09-21",
  ora_start: "09:30",
  durata_ore: "1.5",
  descriere: "Înlocuit rulmentul.",
  cost_piese: "120",
  cost_manopera: "80",
  rezultat: "reusita",
};

describe("pragul de permisiune", () => {
  it.each([
    ["trieazaSesizare", trieazaSesizare, { id: ID_1, status: "in_lucru" }],
    ["rezolvaSesizare", rezolvaSesizare, rezolvare],
  ] as const)("%s: `maintenance:update` own < team ⇒ INTERZIS", async (_n, actiune, intrare) => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "maintenance:update": "own" },
    });
    const r = await actiune(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it.each([
    ["trieazaSesizare", trieazaSesizare, { id: ID_1, status: "in_lucru" }],
    ["rezolvaSesizare", rezolvaSesizare, rezolvare],
  ] as const)(
    "%s: `maintenance:create` = all (dat angajaților pentru sesizări) nu deschide triajul",
    async (_n, actiune, intrare) => {
      const { server } = configureazaActiunea({
        rol: "manager",
        permisiuni: { "maintenance:create": "all", "maintenance:read": "all" },
      });
      const r = await actiune(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );
});

describe("trieazaSesizare", () => {
  it("UPDATE pe status, motivul golit când nu e respingere, pe id + organizație", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await trieazaSesizare({ id: ID_1, status: "in_lucru", motiv_respingere: "uitat" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("fault_reports");
    expect(apel?.payload).toEqual({ status: "in_lucru", motiv_respingere: null });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual([
      "/mentenanta/sesizari",
      `/mentenanta/sesizari/${ID_1}`,
      "/mentenanta",
    ]);
  });

  it("respingerea păstrează motivul scris", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });
    await trieazaSesizare({ id: ID_1, status: "respins", motiv_respingere: "  Nu e defect.  " });
    expect(server.apeluriPe("fault_reports")[0]?.payload).toEqual({
      status: "respins",
      motiv_respingere: "Nu e defect.",
    });
  });

  it.each([[null], ["abc"], ["   abcd   "]])(
    "respingere fără motiv de minimum 5 caractere (%j): VALIDARE pe `motiv_respingere`",
    async (motiv) => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      const r = await trieazaSesizare({ id: ID_1, status: "respins", motiv_respingere: motiv });
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("motiv_respingere");
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it.each([["nou"], ["rezolvat"]])(
    "triajul nu poate atribui statusul %s (are flux propriu)",
    async (status) => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      const r = await trieazaSesizare({ id: ID_1, status });
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("zero rânduri: NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "update", { data: null });
    const r = await trieazaSesizare({ id: ID_1, status: "in_analiza" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din `fault_reports_guard`: mesajul gărzii ajunge la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const mesaj = "Respingerea unei sesizări cere un motiv scris.";
    server.raspunde("fault_reports", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await trieazaSesizare({ id: ID_1, status: "respins", motiv_respingere: "motiv ok" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it.fails(
    "DEFECT: triajul redeschide o sesizare deja rezolvată, lăsând `rezolvat_la` și `intervention_id` agățate",
    async () => {
      // Interfața ascunde butoanele pe stări terminale, dar acțiunea e chemabilă
      // direct; `rezolvaSesizare` verifică pe server statusul, triajul nu.
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("fault_reports", "select", {
        data: { id: ID_1, equipment_id: ID_2, status: "rezolvat" },
      });
      server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

      const r = await trieazaSesizare({ id: ID_1, status: "in_lucru" });

      const [actualizare] = server.apeluriPe("fault_reports", "update");
      const pazitaInBaza = actualizare?.filtre.some((f) => f.argumente[0] === "status") ?? false;
      expect(r.ok === false || pazitaInBaza).toBe(true);
    },
  );
});

describe("rezolvaSesizare", () => {
  it("întâi intervenția (pe echipamentul sesizării), apoi sesizarea rezolvată cu id-ul ei", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
    });
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await rezolvaSesizare({ ...rezolvare, equipment_id: ID_3, plan_id: ID_3 });

    expect(r).toEqual({ ok: true, data: { id: ID_1, interventionId: ID_3 } });
    expect(server.apeluri.map((a) => `${a.tabela}:${a.operatie}`)).toEqual([
      "fault_reports:select",
      "maintenance_interventions:insert",
      "fault_reports:update",
    ]);

    const [citire] = server.apeluriPe("fault_reports", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [interventie] = server.apeluriPe("maintenance_interventions");
    expect(interventie?.payload).toMatchObject({
      organization_id: ORG_ID,
      equipment_id: ID_2,
      plan_id: null,
      tip: "corectiva",
      durata_ore: 1.5,
      cost_piese: 120,
      cost_manopera: 80,
      descriere: "Înlocuit rulmentul.",
    });
    expect(interventie?.payload).not.toHaveProperty("id");
    expect(interventie?.payload).not.toHaveProperty("cost_total");
    expect(interventie?.selectDupaScriere).toBe("id");

    const [actualizare] = server.apeluriPe("fault_reports", "update");
    expect(actualizare?.payload).toEqual({ status: "rezolvat", intervention_id: ID_3 });
    expect(areFiltru(actualizare, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(actualizare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(actualizare?.selectDupaScriere).toBeDefined();

    expect(caiRevalidate()).toEqual([
      "/mentenanta/sesizari",
      `/mentenanta/sesizari/${ID_1}`,
      "/mentenanta/interventii",
      "/mentenanta",
    ]);
  });

  it("sesizare inexistentă sau invizibilă: NEGASIT, nicio intervenție creată", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "select", { data: null });
    const r = await rezolvaSesizare(rezolvare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("maintenance_interventions")).toHaveLength(0);
    expect(server.apeluriPe("fault_reports", "update")).toHaveLength(0);
  });

  it("sesizare deja rezolvată: CONFLICT, nicio intervenție dublă", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "rezolvat" },
    });
    const r = await rezolvaSesizare(rezolvare);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Această sesizare a fost deja rezolvată." },
    });
    expect(server.apeluriPe("maintenance_interventions")).toHaveLength(0);
  });

  it("intervenția respinsă de bază: sesizarea nu se mai atinge", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "nou" },
    });
    server.raspunde("maintenance_interventions", "insert", { error: eroarePostgrest("22003") });
    const r = await rezolvaSesizare(rezolvare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("citirea contorului");
    expect(server.apeluriPe("fault_reports", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("descrierea intervenției sub 3 caractere și ora greșită sunt refuzate de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r1 = await rezolvaSesizare({ ...rezolvare, descriere: "ok" });
    const r2 = await rezolvaSesizare({ ...rezolvare, ora_start: "25:00" });
    expect(r1).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(r2).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("zero rânduri la marcarea sesizării: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
    });
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
    server.raspunde("fault_reports", "update", { data: null });
    const r = await rezolvaSesizare(rezolvare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it.fails(
    "DEFECT: o rezolvare care eșuează după inserarea intervenției lasă intervenția orfană",
    async () => {
      // Cele două scrieri nu sunt atomice: dacă UPDATE-ul pe sesizare afectează
      // zero rânduri (ștearsă între timp, rezolvată concurent) sau e respins,
      // intervenția rămâne în registru, cu costuri, fără nicio sesizare legată.
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("fault_reports", "select", {
        data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
      });
      server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
      server.raspunde("fault_reports", "update", { data: null });
      server.raspunde("maintenance_interventions", "update", { data: { id: ID_3 } });
      server.raspunde("maintenance_interventions", "delete", { data: { id: ID_3 } });

      const r = await rezolvaSesizare(rezolvare);

      expect(r.ok).toBe(false);
      const scrieri = server.apeluriPe("maintenance_interventions");
      const inserata = scrieri.some((a) => a.operatie === "insert");
      const compensata = scrieri.some(
        (a) =>
          (a.operatie === "delete" || a.operatie === "update") && areFiltru(a, "eq", "id", ID_3),
      );
      expect(!inserata || compensata).toBe(true);
    },
  );
});
