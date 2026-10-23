// src/app/(app)/flota/[id]/iesire/actions.test.ts
//
// Ieșirea din parc (0218, F12h), pe clientul fals: filtrul de organizație pe
// fiecare scriere, autorul trimis explicit, `.select()` după tranziții și zero
// rânduri = CONFLICT, cumpărătorul și prețul în afara auditului. Clientul fals
// NU prinde o politică RLS greșită — aceea e în `tests/rls/proba-flota-iesire.sql`
// și în `izolare.sql` (l), blocul F12h.

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
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  anuleazaIesirea,
  finalizeazaObligatia,
  redeschideObligatia,
  scoateDinParc,
} from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const IESIRE = ID_1;
const VEHICUL = ID_2;
const TERMEN = "88888888-8888-4888-8888-888888888888";

const ADMIN = { "vehicles:update": "all" } as const;

const vanzare = {
  vehicle_id: VEHICUL,
  tip: "vanzare",
  data_iesire: "2026-10-19",
  km_iesire: "123456",
  motiv: "Vândută unui client",
  cumparator: "Ion Popescu",
  pret: "15000",
  nr_document: "C-17",
  pastreaza_numarul: true,
};

describe("scoateDinParc", () => {
  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicles:update = %s`: INTERZIS, fără drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": scope } });
      const r = await scoateDinParc(vanzare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it('un singur INSERT, cu firma din tenant și autorul explicit, apoi `.select("id")`', async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exits", "insert", { data: { id: IESIRE } });

    const r = await scoateDinParc({
      ...vanzare,
      organization_id: "altă-firmă",
      preluata_din_istoric: true,
    });

    expect(r).toEqual({ ok: true, data: { id: IESIRE } });
    expect(server.apeluri).toHaveLength(1);
    const [scriere] = server.apeluriPe("vehicle_exits", "insert");
    expect(scriere?.payload).toEqual({
      organization_id: ORG_ID,
      vehicle_id: VEHICUL,
      tip: "vanzare",
      destinatie_epava: null,
      motiv_radiere: null,
      data_iesire: "2026-10-19",
      km_iesire: 123456,
      motiv: "Vândută unui client",
      cumparator: "Ion Popescu",
      pret: 15000,
      nr_document: "C-17",
      pastreaza_numarul: true,
      observatii: null,
      incident_id: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    // Starea inițială o păzesc politica și triggerul; clientul nu o trimite.
    expect(scriere?.payload).not.toHaveProperty("preluata_din_istoric");
    expect(scriere?.payload).not.toHaveProperty("anulat_la");
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${VEHICUL}`]);
  });

  it("cumpărătorul și prețul NU intră în audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exits", "insert", { data: { id: IESIRE } });
    await scoateDinParc(vanzare);
    await asteaptaDupa();

    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_id: IESIRE });
    expect(audit?.p_after).toEqual({
      vehicle_id: VEHICUL,
      tip: "vanzare",
      destinatie_epava: null,
      motiv_radiere: null,
      data_iesire: "2026-10-19",
      km_iesire: 123456,
      motiv: "Vândută unui client",
      nr_document: "C-17",
      pastreaza_numarul: true,
      incident_id: null,
    });
    expect(JSON.stringify(audit)).not.toContain("Ion Popescu");
  });

  // F12h: incidentul legat (0218, `vexit_incident_ck`) intră în INSERT și în audit.
  it("daună totală cu incidentul ei: `incident_id` în INSERT și în audit", async () => {
    const INCIDENT = "77777777-7777-4777-8777-777777777777";
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exits", "insert", { data: { id: IESIRE } });
    const r = await scoateDinParc({
      vehicle_id: VEHICUL,
      tip: "dauna_totala",
      destinatie_epava: "casata",
      data_iesire: "2026-10-19",
      motiv: "Daună totală după accident",
      incident_id: INCIDENT,
    });
    await asteaptaDupa();

    expect(r).toEqual({ ok: true, data: { id: IESIRE } });
    const [scriere] = server.apeluriPe("vehicle_exits", "insert");
    expect(scriere?.payload).toMatchObject({ tip: "dauna_totala", incident_id: INCIDENT });
    expect(server.audituri()[0]?.p_after).toMatchObject({ incident_id: INCIDENT });
  });

  it("P0001 „Incidentul ales…” ajunge pe câmpul `incident_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exits", "insert", {
      error: eroarePostgrest("P0001", "Incidentul ales nu aparține acestui vehicul."),
    });
    const r = await scoateDinParc({
      vehicle_id: VEHICUL,
      tip: "dauna_totala",
      destinatie_epava: "casata",
      data_iesire: "2026-10-19",
      motiv: "Daună totală după accident",
      incident_id: "77777777-7777-4777-8777-777777777777",
    });
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "VALIDARE",
        fieldErrors: { incident_id: ["Incidentul ales nu aparține acestui vehicul."] },
      },
    });
  });

  it("P0001 „Data ieșirii…” ajunge pe câmpul `data_iesire`, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    const mesaj = "Data ieșirii este înaintea datei achiziției.";
    server.raspunde("vehicle_exits", "insert", { error: eroarePostgrest("P0001", mesaj) });

    const r = await scoateDinParc(vanzare);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { data_iesire: [mesaj] } },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("schema refuză prețul la casare înainte de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    const r = await scoateDinParc({ ...vanzare, tip: "casare", cumparator: null });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { pret: expect.any(Array) } },
    });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("anuleazaIesirea", () => {
  const input = { id: IESIRE, vehicle_id: VEHICUL, motiv_anulare: "Înregistrată din greșeală" };

  it("sub `vehicles:update = team`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    expect(await anuleazaIesirea(input)).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("UPDATE pe ieșirea VIE a firmei, cu `.select()`; autorul anulării îl scrie baza", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exits", "update", { data: { id: IESIRE } });

    expect(await anuleazaIesirea(input)).toEqual({ ok: true, data: { id: IESIRE } });
    const [scriere] = server.apeluriPe("vehicle_exits", "update");
    expect(scriere?.payload).toMatchObject({
      motiv_anulare: "Înregistrată din greșeală",
      updated_by: USER_ID,
    });
    expect(scriere?.payload).toHaveProperty("anulat_la");
    expect(scriere?.payload).not.toHaveProperty("anulat_de");
    expect(areFiltru(scriere, "eq", "id", IESIRE)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "anulat_la", null)).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${VEHICUL}`]);
  });

  it("zero rânduri (ieșirea fusese anulată): CONFLICT, nu reușită", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exits", "update", { data: null });
    const r = await anuleazaIesirea(input);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("23505 pe numărul refolosit: CONFLICT cu explicația", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exits", "update", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "vehicles_org_nr_uq"',
      ),
    });
    const r = await anuleazaIesirea(input);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringMatching(/nu poate reveni în parc/u) },
    });
  });
});

describe("finalizeazaObligatia", () => {
  it("sub `vehicles:update = team`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    const r = await finalizeazaObligatia({
      id: TERMEN,
      vehicle_id: VEHICUL,
      stare: "facut",
      finalizat_la: "2026-10-20",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("„Făcut”: UPDATE pe termenul DESCHIS al firmei, cu `.select()`; autorul îl scrie baza", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exit_obligations", "update", { data: { id: TERMEN } });

    const r = await finalizeazaObligatia({
      id: TERMEN,
      vehicle_id: VEHICUL,
      stare: "facut",
      finalizat_la: "2026-10-20",
      nota: "Depusă la ghișeu",
      finalizat_de: "cineva-din-payload",
    });
    expect(r).toEqual({ ok: true, data: { id: TERMEN } });
    const [scriere] = server.apeluriPe("vehicle_exit_obligations", "update");
    expect(scriere?.payload).toEqual({
      finalizat_la: "2026-10-20",
      nota: "Depusă la ghișeu",
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "finalizat_la", null)).toBe(true);
    expect(areFiltru(scriere, "eq", "nu_se_aplica", false)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${VEHICUL}`]);
  });

  it("„Nu se aplică”: fără dată, doar bifa", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exit_obligations", "update", { data: { id: TERMEN } });
    await finalizeazaObligatia({
      id: TERMEN,
      vehicle_id: VEHICUL,
      stare: "nu_se_aplica",
      finalizat_la: "",
    });
    const [scriere] = server.apeluriPe("vehicle_exit_obligations", "update");
    expect(scriere?.payload).toEqual({ nu_se_aplica: true, nota: null, updated_by: USER_ID });
  });

  it("zero rânduri (termenul fusese închis): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exit_obligations", "update", { data: null });
    const r = await finalizeazaObligatia({
      id: TERMEN,
      vehicle_id: VEHICUL,
      stare: "facut",
      finalizat_la: "2026-10-20",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("P0001 „Data la care…” ajunge pe `finalizat_la`", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    const mesaj = "Data la care s-a făcut pasul este înaintea datei ieșirii din parc.";
    server.raspunde("vehicle_exit_obligations", "update", {
      error: eroarePostgrest("P0001", mesaj),
    });
    const r = await finalizeazaObligatia({
      id: TERMEN,
      vehicle_id: VEHICUL,
      stare: "facut",
      finalizat_la: "2026-01-01",
    });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { finalizat_la: [mesaj] } },
    });
  });
});

describe("redeschideObligatia", () => {
  it("UPDATE doar pe un termen ÎNCHIS al firmei, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exit_obligations", "update", { data: { id: TERMEN } });

    expect(await redeschideObligatia({ id: TERMEN, vehicle_id: VEHICUL })).toEqual({
      ok: true,
      data: { id: TERMEN },
    });
    const [scriere] = server.apeluriPe("vehicle_exit_obligations", "update");
    expect(scriere?.payload).toEqual({
      finalizat_la: null,
      nu_se_aplica: false,
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "or", "finalizat_la.not.is.null,nu_se_aplica.eq.true")).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("zero rânduri: CONFLICT; P0001 al dependentului făcut: mesajul bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_exit_obligations", "update", { data: null });
    expect(await redeschideObligatia({ id: TERMEN, vehicle_id: VEHICUL })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });

    configureazaActiunea({ permisiuni: ADMIN }).server.raspunde(
      "vehicle_exit_obligations",
      "update",
      {
        error: eroarePostgrest(
          "P0001",
          "Un termen care depinde de acesta este deja făcut. Redeschideți-l întâi pe acela.",
        ),
      },
    );
    expect(await redeschideObligatia({ id: TERMEN, vehicle_id: VEHICUL })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringMatching(/^Un termen care depinde/u) },
    });
  });
});
