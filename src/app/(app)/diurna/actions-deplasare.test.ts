// src/app/(app)/diurna/actions-deplasare.test.ts
//
// Ciclul de viață al unei deplasări: creare, corectare, trimitere, ștergerea
// ciornei, decizia și decontarea. Straturile comune ale lui `createAction`
// (sesiune, organizație, modul, Zod generic) sunt verificate o singură dată, în
// `salarizare/actions.test.ts`; aici rămân permisiunea cu pragul ei, handlerul,
// auditul și revalidarea.
//
// Rolurile, din seed: `manager` are `per_diem:approve = team`, dar
// `per_diem:create/update/delete` doar `own` — își face propria deplasare, nu o
// scrie pe a echipei.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  asteaptaDupa,
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  actualizeazaDeplasare,
  creeazaDeplasare,
  deconteazaDeplasare,
  decideDeplasare,
  stergeCiornaDeplasare,
  trimiteDeplasare,
} from "./actions";

const ACUM = "2026-09-15T10:00:00.000Z";
const CAI_PORTAL = ["/portal", "/portal/diurna-mea"];

/** O deplasare internă minimă, validă: tren, două zile, fără avans. */
const deplasare = (modificari: Record<string, unknown> = {}) => ({
  employee_id: null,
  scop: "Audit la clientul din Cluj",
  country_id: null,
  localitate: "Cluj-Napoca",
  // Ora României în septembrie e UTC+3: 08:00 local = 05:00 UTC.
  plecare_la: "2026-09-10T08:00",
  sosire_la: "2026-09-12T18:00",
  mijloc_transport: "tren",
  ...modificari,
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(ACUM));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("creeazaDeplasare", () => {
  it("fără `per_diem:create`: INTERZIS, fără nicio interogare (nici prin admin)", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "per_diem:read": "own", "per_diem:update": "own" },
    });
    const r = await creeazaDeplasare(deplasare());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("pentru mine: fișa proprie se rezolvă prin admin, filtrată pe organizație și cont", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "per_diem:create": "own" },
    });
    admin.raspunde("employees", "select", { data: { id: ID_2 } });
    server.raspunde("business_trips", "insert", { data: { id: ID_1 } });

    const r = await creeazaDeplasare(deplasare());

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [fisa] = admin.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);

    const [insert] = server.apeluriPe("business_trips", "insert");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: ID_2,
      scop: "Audit la clientul din Cluj",
      plecare_la: "2026-09-10T05:00:00.000Z",
      sosire_la: "2026-09-12T15:00:00.000Z",
      status: "ciorna",
    });
    // WITH CHECK cere NULL pe ele: nu se trimit deloc.
    expect(insert?.payload).not.toHaveProperty("approval_task_id");
    expect(insert?.payload).not.toHaveProperty("numar_document");
    expect(insert?.payload).not.toHaveProperty("created_by");
    expect(insert?.selectDupaScriere).toBe("id");
  });

  it("succes: revalidează lista și portalul, auditul poartă id-ul nou și doar allow-list-ul", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: { "per_diem:create": "own" } });
    admin.raspunde("employees", "select", { data: { id: ID_2 } });
    server.raspunde("business_trips", "insert", { data: { id: ID_1 } });

    await creeazaDeplasare(deplasare({ observatii: "notă internă" }));
    await asteaptaDupa();

    expect(caiRevalidate()).toEqual(["/diurna", ...CAI_PORTAL]);
    const [audit] = server.audituri();
    expect(audit).toMatchObject({
      p_status: "success",
      p_action: "create",
      p_entity_type: "business_trip",
      p_entity_id: ID_1,
    });
    expect(audit?.p_after).not.toHaveProperty("observatii");
    expect(audit?.p_after).toHaveProperty("scop");
  });

  it.each([["own"], ["team"]] as const)(
    "cu scope `%s`, o deplasare pentru alt angajat e refuzată înainte de bază",
    async (scope) => {
      const { server, admin } = configureazaActiunea({
        rol: "manager",
        permisiuni: { "per_diem:create": scope },
      });
      const r = await creeazaDeplasare(deplasare({ employee_id: ID_3 }));
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      expect(server.apeluriPe("business_trips")).toHaveLength(0);
      expect(admin.apeluri).toHaveLength(0);
    },
  );

  it("cu scope `all`, angajatul ales se scrie ca atare, fără căutarea fișei proprii", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: { "per_diem:create": "all" } });
    server.raspunde("business_trips", "insert", { data: { id: ID_1 } });

    const r = await creeazaDeplasare(deplasare({ employee_id: ID_3 }));

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    expect(admin.apeluri).toHaveLength(0);
    expect(server.apeluriPe("business_trips", "insert")[0]?.payload).toMatchObject({
      employee_id: ID_3,
    });
  });

  it("contul fără fișă de angajat activă: CONFLICT cu explicație, nimic inserat", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: { "per_diem:create": "own" } });
    admin.raspunde("employees", "select", { data: null });

    const r = await creeazaDeplasare(deplasare());

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("fișă de angajat");
    expect(server.apeluriPe("business_trips")).toHaveLength(0);
  });

  it("P0001 din trigger (lipsă politică la dată): mesajul bazei ajunge pe ecran", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: { "per_diem:create": "own" } });
    admin.raspunde("employees", "select", { data: { id: ID_2 } });
    const mesaj = "Nu există o politică de diurnă valabilă la 10.09.2026.";
    server.raspunde("business_trips", "insert", { error: eroarePostgrest("P0001", mesaj) });

    const r = await creeazaDeplasare(deplasare());

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });

  it.each([
    [{ sosire_la: "2026-09-10T07:00" }, "sosire_la"],
    [{ avans_acordat: 500, moneda_avans: null }, "moneda_avans"],
    [{ detasare_transnationala: true }, "stat_gazda_country_id"],
  ])("regulile încrucișate ale schemei ies pe câmp: %j ⇒ %s", async (modificari, camp) => {
    const { server, admin } = configureazaActiunea({ permisiuni: { "per_diem:create": "own" } });
    const r = await creeazaDeplasare(deplasare(modificari));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });
});

describe("trimiteDeplasare", () => {
  it("fără `per_diem:update`: INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:create": "own" } });
    const r = await trimiteDeplasare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: trece în aprobare doar din ciornă sau respinsă, cu `.select()` după UPDATE", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "per_diem:update": "own" },
    });
    server.raspunde("business_trips", "update", { data: { id: ID_1 } });

    const r = await trimiteDeplasare({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel, ...altele] = server.apeluriPe("business_trips");
    expect(altele).toHaveLength(0);
    expect(apel?.payload).toEqual({ status: "in_aprobare" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["ciorna", "respinsa"])).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(["/diurna", "/diurna/aprobari", ...CAI_PORTAL]);
  });

  it("zero rânduri (deja trimisă sau respinsă de USING): CONFLICT, nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "own" } });
    server.raspunde("business_trips", "update", { data: null });
    const r = await trimiteDeplasare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("23505 (numerotare): CONFLICT cu îndemn de reîncercare, nu textul constrângerii", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "own" } });
    server.raspunde("business_trips", "update", {
      error: eroarePostgrest("23505", "duplicate key value violates business_trips_numar_uk"),
    });
    const r = await trimiteDeplasare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("reîncercați");
    expect(r.error.message).not.toContain("business_trips_numar_uk");
  });
});

describe("stergeCiornaDeplasare", () => {
  it("`per_diem:update` nu ține loc de `per_diem:delete`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "all" } });
    const r = await stergeCiornaDeplasare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: ștergere logică, doar pe o ciornă a organizației", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "per_diem:delete": "own" },
    });
    server.raspunde("business_trips", "update", { data: { id: ID_1 } });

    const r = await stergeCiornaDeplasare({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("business_trips");
    expect(apel?.operatie).toBe("update");
    expect(apel?.payload).toEqual({ deleted_at: ACUM });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "ciorna")).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/diurna", ...CAI_PORTAL]);
  });

  it("zero rânduri (trimisă între timp): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:delete": "own" } });
    server.raspunde("business_trips", "update", { data: null });
    const r = await stergeCiornaDeplasare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("decideDeplasare", () => {
  it("scope `own` pe `per_diem:approve` (sub pragul `team`): INTERZIS", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "per_diem:approve": "own" },
    });
    const r = await decideDeplasare({ id: ID_1, decizie: "aprobata" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it.each([["aprobata"], ["respinsa"]] as const)(
    "managerul (`team`) decide `%s` doar pe o deplasare aflată în aprobare",
    async (decizie) => {
      const { server } = configureazaActiunea({
        rol: "manager",
        permisiuni: { "per_diem:approve": "team" },
      });
      server.raspunde("business_trips", "update", { data: { id: ID_1 } });

      const r = await decideDeplasare({ id: ID_1, decizie });

      expect(r).toEqual({ ok: true, data: { id: ID_1 } });
      const [apel] = server.apeluriPe("business_trips");
      expect(apel?.payload).toEqual({ status: decizie });
      expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "eq", "status", "in_aprobare")).toBe(true);
      expect(apel?.selectDupaScriere).toBeDefined();
      expect(caiRevalidate()).toEqual(["/diurna", "/diurna/aprobari", ...CAI_PORTAL]);
    },
  );

  it("decizia nu poate fi altă stare decât aprobată / respinsă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "all" } });
    const r = await decideDeplasare({ id: ID_1, decizie: "decontata" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("zero rânduri (decisă deja din altă parte): CONFLICT, audit `failure`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "team" } });
    server.raspunde("business_trips", "update", { data: null });

    const r = await decideDeplasare({ id: ID_1, decizie: "aprobata" });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.audituri()).toEqual([
      expect.objectContaining({ p_status: "failure", p_error_code: "CONFLICT" }),
    ]);
  });

  it("42501 (WITH CHECK cere și `per_diem:update`): INTERZIS pe calea generică", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "per_diem:approve": "team" },
    });
    server.raspunde("business_trips", "update", { error: eroarePostgrest("42501") });
    const r = await decideDeplasare({ id: ID_1, decizie: "aprobata" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});

describe("deconteazaDeplasare", () => {
  it("scope `own` pe `per_diem:approve`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "own" } });
    const r = await deconteazaDeplasare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: decontată doar din starea „aprobată”", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "team" } });
    server.raspunde("business_trips", "update", { data: { id: ID_1 } });

    const r = await deconteazaDeplasare({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("business_trips");
    expect(apel?.payload).toEqual({ status: "decontata" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "aprobata")).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/diurna", "/diurna/aprobari", ...CAI_PORTAL]);
  });

  it("zero rânduri: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "all" } });
    server.raspunde("business_trips", "update", { data: null });
    const r = await deconteazaDeplasare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("P0001 (stare terminală): mesajul triggerului, tăiat la 300 de caractere", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "all" } });
    const lung = `Deplasarea este decontată. ${"x".repeat(400)}`;
    server.raspunde("business_trips", "update", { error: eroarePostgrest("P0001", lung) });
    const r = await deconteazaDeplasare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toBe(lung.slice(0, 300));
  });
});

describe("actualizeazaDeplasare", () => {
  it("fără `per_diem:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:read": "all" } });
    const r = await actualizeazaDeplasare({ id: ID_1, ...deplasare() });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: rescrie câmpurile, dar NU proprietarul, starea sau numărul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "own" } });
    server.raspunde("business_trips", "update", { data: { id: ID_1 } });

    const r = await actualizeazaDeplasare({
      id: ID_1,
      ...deplasare({ employee_id: ID_3, scop: "Audit corectat", km_parcursi: "120" }),
    });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("business_trips");
    expect(apel?.payload).toMatchObject({
      scop: "Audit corectat",
      km_parcursi: 120,
      plecare_la: "2026-09-10T05:00:00.000Z",
    });
    expect(apel?.payload).not.toHaveProperty("employee_id");
    expect(apel?.payload).not.toHaveProperty("status");
    expect(apel?.payload).not.toHaveProperty("numar_document");
    expect(apel?.payload).not.toHaveProperty("organization_id");
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["ciorna", "respinsa"])).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
  });

  it("revalidează fișa și decontul deplasării corectate", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "own" } });
    server.raspunde("business_trips", "update", { data: { id: ID_1 } });
    await actualizeazaDeplasare({ id: ID_1, ...deplasare() });
    expect(caiRevalidate()).toEqual([
      "/diurna",
      `/diurna/${ID_1}`,
      `/diurna/${ID_1}/decont`,
      ...CAI_PORTAL,
    ]);
  });

  it("auditul corecturii păstrează doar allow-list-ul: fără observații și fără angajat", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "own" } });
    server.raspunde("business_trips", "update", { data: { id: ID_1 } });
    await actualizeazaDeplasare({
      id: ID_1,
      ...deplasare({ employee_id: ID_3, observatii: "notă internă" }),
    });
    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({
      p_status: "success",
      p_action: "update",
      p_entity_type: "business_trip",
      p_entity_id: ID_1,
    });
    expect(audit?.p_after).toHaveProperty("scop");
    expect(audit?.p_after).not.toHaveProperty("observatii");
    expect(audit?.p_after).not.toHaveProperty("employee_id");
  });

  it("zero rânduri (ieșită din ciornă/respinsă): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "own" } });
    server.raspunde("business_trips", "update", { data: null });
    const r = await actualizeazaDeplasare({ id: ID_1, ...deplasare() });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("păstrează regulile schemei de creare: sosirea înaintea plecării ⇒ VALIDARE", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "own" } });
    const r = await actualizeazaDeplasare({
      id: ID_1,
      ...deplasare({ sosire_la: "2026-09-09T08:00" }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("sosire_la");
    expect(server.apeluri).toHaveLength(0);
  });
});
