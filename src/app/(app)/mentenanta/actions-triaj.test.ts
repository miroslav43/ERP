// src/app/(app)/mentenanta/actions-triaj.test.ts
//
// Triajul și rezolvarea sesizărilor. Triajul rămâne pe `maintenance:update` /
// team, nu `create` (capcana 35). Rezolvarea a coborât la `maintenance:read` /
// own din 0181: o face și tehnicianul ATRIBUIT, pe sesizarea lui, iar decizia
// o ia baza (politica de INSERT pe intervenții + garda sesizării). Rezolvarea
// are ordine obligatorie: întâi intervenția, apoi sesizarea cu `intervention_id`.

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
/** Poarta rezolvării: „e în modul”; cine poate rezolva CE decide baza. */
const REZOLVA = { "maintenance:read": "own" } as const;
const DESCHISE = ["nou", "in_analiza", "in_lucru", "in_asteptare"];

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
  it("trieazaSesizare: `maintenance:update` own < team ⇒ INTERZIS", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "maintenance:update": "own" },
    });
    const r = await trieazaSesizare({ id: ID_1, status: "in_lucru" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("trieazaSesizare: `maintenance:create` = all (dat angajaților pentru sesizări) nu deschide triajul", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "maintenance:create": "all", "maintenance:read": "all" },
    });
    const r = await trieazaSesizare({ id: ID_1, status: "in_lucru" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("rezolvaSesizare: fără `maintenance:read` ⇒ INTERZIS, zero apeluri", async () => {
    const { server } = configureazaActiunea({
      rol: "hr",
      permisiuni: { "maintenance:update": "own" },
    });
    const r = await rezolvaSesizare(rezolvare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("rezolvaSesizare: `maintenance:read` = own trece poarta — un străin e refuzat de BAZĂ (42501 pe intervenție)", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: REZOLVA });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
    });
    server.raspunde("maintenance_interventions", "insert", { error: eroarePostgrest("42501") });
    const r = await rezolvaSesizare(rezolvare);
    expect(r.ok).toBe(false);
    expect(server.apeluriPe("fault_reports", "update")).toHaveLength(0);
  });
});

describe("trieazaSesizare", () => {
  it("UPDATE pe status, motivul și tipul golite când nu e respingere, pe id + organizație + stări deschise", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await trieazaSesizare({ id: ID_1, status: "in_lucru", motiv_respingere: "uitat" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("fault_reports");
    expect(apel?.payload).toEqual({
      status: "in_lucru",
      motiv_respingere: null,
      motiv_respingere_tip: null,
      duplicat_al_id: null,
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "in", "status", DESCHISE)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual([
      "/mentenanta/sesizari",
      `/mentenanta/sesizari/${ID_1}`,
      "/mentenanta",
    ]);
  });

  it("respingerea păstrează motivul scris; tipul lipsă devine „altul”", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });
    await trieazaSesizare({ id: ID_1, status: "respins", motiv_respingere: "  Nu e defect.  " });
    expect(server.apeluriPe("fault_reports")[0]?.payload).toEqual({
      status: "respins",
      motiv_respingere: "Nu e defect.",
      motiv_respingere_tip: "altul",
      duplicat_al_id: null,
    });
  });

  it("respingerea ca duplicat poartă sesizarea originală", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });
    await trieazaSesizare({
      id: ID_1,
      status: "respins",
      motiv_respingere: "Aceeași defecțiune ca SZ-2026-0003.",
      motiv_respingere_tip: "duplicat",
      duplicat_al_id: ID_2,
    });
    expect(server.apeluriPe("fault_reports")[0]?.payload).toMatchObject({
      motiv_respingere_tip: "duplicat",
      duplicat_al_id: ID_2,
    });
  });

  it("duplicat fără sesizarea originală: VALIDARE pe `duplicat_al_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await trieazaSesizare({
      id: ID_1,
      status: "respins",
      motiv_respingere: "motiv ok",
      motiv_respingere_tip: "duplicat",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("duplicat_al_id");
    expect(server.apeluri).toHaveLength(0);
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

  it.each([["nou"], ["rezolvat"], ["inchis"], ["retrasa"]])(
    "triajul nu poate atribui statusul %s (are flux propriu)",
    async (status) => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      const r = await trieazaSesizare({ id: ID_1, status });
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("„în așteptare” e un status de triaj (0181)", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });
    const r = await trieazaSesizare({ id: ID_1, status: "in_asteptare" });
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
  });

  it("zero rânduri: NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "update", { data: null });
    const r = await trieazaSesizare({ id: ID_1, status: "in_analiza" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din `fault_reports_garda`: mesajul gărzii ajunge la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const mesaj = "Respingerea unei sesizări cere un motiv scris.";
    server.raspunde("fault_reports", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await trieazaSesizare({ id: ID_1, status: "respins", motiv_respingere: "motiv ok" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("triajul NU redeschide o sesizare terminală: UPDATE-ul e păzit pe stările deschise", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });
    await trieazaSesizare({ id: ID_1, status: "in_lucru" });
    const [actualizare] = server.apeluriPe("fault_reports", "update");
    expect(areFiltru(actualizare, "in", "status", DESCHISE)).toBe(true);
  });
});

describe("rezolvaSesizare", () => {
  it("întâi intervenția (pe echipamentul sesizării, legată de ea), apoi sesizarea rezolvată cu id-ul ei", async () => {
    const { server } = configureazaActiunea({ permisiuni: REZOLVA });
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
      fault_report_id: ID_1,
      tip: "corectiva",
      durata_ore: 1.5,
      cost_piese: 120,
      cost_manopera: 80,
      descriere: "Înlocuit rulmentul.",
    });
    expect(interventie?.payload).not.toHaveProperty("id");
    expect(interventie?.payload).not.toHaveProperty("cost_total");
    // Câmpurile sesizării nu se scurg în intervenție.
    expect(interventie?.payload).not.toHaveProperty("repus_in_functiune_la");
    expect(interventie?.payload).not.toHaveProperty("nota_rezolvare");
    expect(interventie?.selectDupaScriere).toBe("id");

    const [actualizare] = server.apeluriPe("fault_reports", "update");
    expect(actualizare?.payload).toEqual({
      status: "rezolvat",
      intervention_id: ID_3,
      nota_rezolvare: null,
    });
    expect(areFiltru(actualizare, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(actualizare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(actualizare?.selectDupaScriere).toBeDefined();

    expect(caiRevalidate()).toEqual([
      "/mentenanta/sesizari",
      `/mentenanta/sesizari/${ID_1}`,
      "/mentenanta/interventii",
      "/mentenanta",
      "/portal/sesizari",
      `/portal/sesizari/${ID_1}`,
    ]);
  });

  it("nota pentru raportor ajunge pe sesizare, nu pe intervenție", async () => {
    const { server } = configureazaActiunea({ permisiuni: REZOLVA });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
    });
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });
    await rezolvaSesizare({ ...rezolvare, nota_rezolvare: "Schimbat rulmentul; merge." });
    const [actualizare] = server.apeluriPe("fault_reports", "update");
    expect(actualizare?.payload).toMatchObject({ nota_rezolvare: "Schimbat rulmentul; merge." });
  });

  it("`repus_in_functiune_la` corectează oprirea din jurnal, DUPĂ rezolvare, pe sesizare + organizație", async () => {
    const { server } = configureazaActiunea({ permisiuni: REZOLVA });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
    });
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });
    server.raspunde("equipment_opriri", "update", { data: null });

    const repus = "2026-09-21T11:00:00.000Z";
    const r = await rezolvaSesizare({ ...rezolvare, repus_in_functiune_la: repus });

    expect(r.ok).toBe(true);
    expect(server.apeluri.map((a) => `${a.tabela}:${a.operatie}`)).toEqual([
      "fault_reports:select",
      "maintenance_interventions:insert",
      "fault_reports:update",
      "equipment_opriri:update",
    ]);
    const [oprire] = server.apeluriPe("equipment_opriri", "update");
    expect(oprire?.payload).toEqual({ sfarsit: repus });
    expect(areFiltru(oprire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(oprire, "eq", "fault_report_id", ID_1)).toBe(true);
    expect(areFiltru(oprire, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(oprire, "gte", "sfarsit", repus)).toBe(true);
  });

  it("eroarea la corectarea opririi NU anulează rezolvarea (se jurnalizează)", async () => {
    const { server } = configureazaActiunea({ permisiuni: REZOLVA });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
    });
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });
    server.raspunde("equipment_opriri", "update", { error: eroarePostgrest("42501") });
    const r = await rezolvaSesizare({
      ...rezolvare,
      repus_in_functiune_la: "2026-09-21T11:00:00.000Z",
    });
    expect(r).toEqual({ ok: true, data: { id: ID_1, interventionId: ID_3 } });
  });

  it("sesizare inexistentă sau invizibilă: NEGASIT, nicio intervenție creată", async () => {
    const { server } = configureazaActiunea({ permisiuni: REZOLVA });
    server.raspunde("fault_reports", "select", { data: null });
    const r = await rezolvaSesizare(rezolvare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("maintenance_interventions")).toHaveLength(0);
    expect(server.apeluriPe("fault_reports", "update")).toHaveLength(0);
  });

  it.each(["rezolvat", "respins", "inchis", "retrasa"])(
    "sesizare care nu mai e deschisă (%s): CONFLICT, nicio intervenție dublă",
    async (status) => {
      const { server } = configureazaActiunea({ permisiuni: REZOLVA });
      server.raspunde("fault_reports", "select", {
        data: { id: ID_1, equipment_id: ID_2, status },
      });
      const r = await rezolvaSesizare(rezolvare);
      expect(r).toMatchObject({
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Această sesizare nu mai e deschisă: a fost rezolvată, respinsă sau retrasă.",
        },
      });
      expect(server.apeluriPe("maintenance_interventions")).toHaveLength(0);
    },
  );

  it.each(["nou", "in_analiza", "in_asteptare"])(
    "sesizare deschisă dar nu „în lucru” (%s): CONFLICT explicat, nicio intervenție (ar rămâne orfană)",
    async (status) => {
      const { server } = configureazaActiunea({ permisiuni: REZOLVA });
      server.raspunde("fault_reports", "select", {
        data: { id: ID_1, equipment_id: ID_2, status },
      });
      const r = await rezolvaSesizare(rezolvare);
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      if (!r.ok) expect(r.error.message).toContain("„În lucru”");
      expect(server.apeluriPe("maintenance_interventions")).toHaveLength(0);
    },
  );

  it("intervenția respinsă de bază: sesizarea nu se mai atinge", async () => {
    const { server } = configureazaActiunea({ permisiuni: REZOLVA });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
    });
    server.raspunde("maintenance_interventions", "insert", { error: eroarePostgrest("22003") });
    const r = await rezolvaSesizare(rezolvare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("citirea contorului");
    expect(server.apeluriPe("fault_reports", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("descrierea intervenției sub 3 caractere și ora greșită sunt refuzate de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: REZOLVA });
    const r1 = await rezolvaSesizare({ ...rezolvare, descriere: "ok" });
    const r2 = await rezolvaSesizare({ ...rezolvare, ora_start: "25:00" });
    expect(r1).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(r2).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("UPDATE-ul pe sesizare e condiționat pe „în lucru” (cursa a doi operatori)", async () => {
    const { server } = configureazaActiunea({ permisiuni: REZOLVA });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
    });
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });
    await rezolvaSesizare(rezolvare);
    const [actualizare] = server.apeluriPe("fault_reports", "update");
    expect(areFiltru(actualizare, "eq", "status", "in_lucru")).toBe(true);
    expect(areFiltru(actualizare, "is", "deleted_at", null)).toBe(true);
  });

  it("cursa pierdută (zero rânduri): CONFLICT, iar intervenția inserată se anulează logic", async () => {
    // Cele două scrieri nu sunt atomice: fără compensare, intervenția rămânea în
    // registru, cu costuri, fără nicio sesizare legată.
    const { server } = configureazaActiunea({ permisiuni: REZOLVA });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
    });
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
    server.raspunde("fault_reports", "update", { data: null });
    server.raspunde("maintenance_interventions", "update", { data: null });

    const r = await rezolvaSesizare(rezolvare);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [anulare] = server.apeluriPe("maintenance_interventions", "update");
    expect(Object.keys(anulare?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(anulare, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(anulare, "eq", "organization_id", ORG_ID)).toBe(true);
    // `.select()` după anulare: zero rânduri (tehnicianul n-are UPDATE pe
    // intervenții) se jurnalizează, nu trece tăcut.
    expect(anulare?.selectDupaScriere).toBe("id");
    expect(console.warn).toHaveBeenCalled();
    expect(caiRevalidate()).toEqual([]);
  });

  it("eroare la marcarea sesizării: intervenția se anulează, iar eroarea se traduce", async () => {
    const { server } = configureazaActiunea({ permisiuni: REZOLVA });
    server.raspunde("fault_reports", "select", {
      data: { id: ID_1, equipment_id: ID_2, status: "in_lucru" },
    });
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
    server.raspunde("fault_reports", "update", { error: eroarePostgrest("42501") });
    server.raspunde("maintenance_interventions", "update", { data: null });

    const r = await rezolvaSesizare(rezolvare);

    expect(r.ok).toBe(false);
    expect(server.apeluriPe("maintenance_interventions", "update")).toHaveLength(1);
  });
});
