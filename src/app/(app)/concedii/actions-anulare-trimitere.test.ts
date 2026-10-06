// src/app/(app)/concedii/actions-anulare-trimitere.test.ts
//
// `anuleazaCerere` și `trimiteCerere`: cele două tranziții pe care autorul le
// face asupra propriei cereri. Amândouă se sprijină pe `.select()` după
// UPDATE (capcana 17): un rând respins de `USING` nu dă eroare, dă zero rânduri.

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

const colaboratori = vi.hoisted(() => ({
  sincronizeazaZileleDeConcediu: vi.fn(),
  declaraSuspendareaContractului: vi.fn(),
}));
vi.mock("@/app/(app)/pontaj/sincronizare-concediu", () => ({
  sincronizeazaZileleDeConcediu: colaboratori.sincronizeazaZileleDeConcediu,
}));
vi.mock("./suspendare-contract", () => ({
  declaraSuspendareaContractului: colaboratori.declaraSuspendareaContractului,
}));

import {
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { anuleazaCerere, trimiteCerere } from "./actions";

const CERERE = ID_1;
const FISA = ID_2;
const TIP = ID_3;
const ALT_ANGAJAT = "88888888-8888-4888-8888-888888888888";
const VARIANTA = "99999999-9999-4999-8999-999999999999";

const CAI_PORTAL = ["/portal", "/portal/concediile-mele"];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  colaboratori.sincronizeazaZileleDeConcediu
    .mockReset()
    .mockResolvedValue({ create: 0, actualizate: 0, inlocuite: 0, pastrate: 0 });
  colaboratori.declaraSuspendareaContractului
    .mockReset()
    .mockResolvedValue({ ceruta: false, declarata: false, termen: null, motiv: null });
});

// ── anuleazaCerere ─────────────────────────────────────────────────────────────

describe("anuleazaCerere", () => {
  const PROPRIU = { "leave:update": "own" } as const;
  const TOT = { "leave:update": "all" } as const;

  function fisa(admin: ClientFals, id: string | null = FISA) {
    admin.raspunde("employees", "select", { data: id === null ? null : { id } });
  }
  function tinta(server: ClientFals, employee_id: string, status: string) {
    server.raspunde("leave_requests", "select", { data: { employee_id, status } });
  }

  it("fără `leave:update`: INTERZIS, fără nicio interogare", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: {} });
    const r = await anuleazaCerere({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("propria ciornă: UPDATE pe `anulata`, restrâns la fișa proprie și la statusurile autorului", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisa(admin);
    tinta(server, FISA, "ciorna");
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });

    const r = await anuleazaCerere({ id: CERERE });

    expect(r).toEqual({ ok: true, data: { id: CERERE } });
    const [fisaApel] = admin.apeluriPe("employees");
    expect(areFiltru(fisaApel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisaApel, "eq", "user_id", USER_ID)).toBe(true);
    // Fișa decide `esteAMea`, adică dreptul de a retrage un concediu APROBAT:
    // o fișă secundară sau ștearsă nu are voie să-l dea.
    expect(areFiltru(fisaApel, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(fisaApel, "is", "deleted_at", null)).toBe(true);

    const [citire] = server.apeluriPe("leave_requests", "select");
    expect(areFiltru(citire, "eq", "id", CERERE)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);

    const [apel] = server.apeluriPe("leave_requests", "update");
    expect(apel?.payload).toEqual({ status: "anulata" });
    expect(areFiltru(apel, "eq", "id", CERERE)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["ciorna", "trimisa", "aprobata"])).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id", FISA)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("revalidează lista, soldul, aprobările, calendarul, pontajul și fișa din portal", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisa(admin);
    tinta(server, FISA, "trimisa");
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    await anuleazaCerere({ id: CERERE });
    expect(caiRevalidate()).toEqual([
      "/concedii",
      "/concedii/sold",
      "/concedii/aprobari",
      "/concedii/calendar",
      "/concedii/echipa",
      "/pontaj",
      ...CAI_PORTAL,
      `/portal/concediile-mele/${CERERE}`,
    ]);
  });

  it("scope `own` fără fișă de angajat: CONFLICT, cererea nici nu se citește", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisa(admin, null);
    const r = await anuleazaCerere({ id: CERERE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("fișă de angajat") },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("eroare la citirea fișei proprii: EROARE_INTERNA, nu „cont fără fișă”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    admin.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    const r = await anuleazaCerere({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("eroare la citirea cererii: EROARE_INTERNA, nu NEGASIT, fără UPDATE", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisa(admin);
    server.raspunde("leave_requests", "select", { error: eroarePostgrest("57014") });
    const r = await anuleazaCerere({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriPe("leave_requests", "update")).toHaveLength(0);
  });

  it("cerere invizibilă prin RLS: NEGASIT, fără UPDATE", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisa(admin);
    server.raspunde("leave_requests", "select", { data: null });
    const r = await anuleazaCerere({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("leave_requests", "update")).toHaveLength(0);
  });

  it("manager (`own`) pe cererea unui subaltern: UPDATE-ul rămâne legat de fișa lui, deci CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PROPRIU });
    fisa(admin);
    tinta(server, ALT_ANGAJAT, "trimisa");
    server.raspunde("leave_requests", "update", { data: null });

    const r = await anuleazaCerere({ id: CERERE });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [apel] = server.apeluriPe("leave_requests", "update");
    expect(areFiltru(apel, "eq", "employee_id", FISA)).toBe(true);
    // Cererea altcuiva nu primește dreptul de retragere a concediului aprobat.
    expect(areFiltru(apel, "in", "status", ["ciorna", "trimisa"])).toBe(true);
    expect(caiRevalidate()).toEqual([]);
  });

  it("scope `all` pe cererea altcuiva: fără filtru pe angajat, doar ciornă sau trimisă", async () => {
    const { server, admin } = configureazaActiunea({ rol: "hr", permisiuni: TOT });
    fisa(admin);
    tinta(server, ALT_ANGAJAT, "trimisa");
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });

    const r = await anuleazaCerere({ id: CERERE });

    expect(r.ok).toBe(true);
    const [apel] = server.apeluriPe("leave_requests", "update");
    expect(areFiltru(apel, "eq", "employee_id")).toBe(false);
    expect(areFiltru(apel, "in", "status", ["ciorna", "trimisa"])).toBe(true);
  });

  it("scope `all` fără fișă (administrator invitat): anularea merge mai departe", async () => {
    const { server, admin } = configureazaActiunea({ rol: "org_admin", permisiuni: TOT });
    fisa(admin, null);
    tinta(server, ALT_ANGAJAT, "ciorna");
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    const r = await anuleazaCerere({ id: CERERE });
    expect(r).toEqual({ ok: true, data: { id: CERERE } });
  });

  it("concediul APROBAT al altcuiva nu se retrage, nici cu scope `all`: CONFLICT, fără UPDATE", async () => {
    const { server, admin } = configureazaActiunea({ rol: "hr", permisiuni: TOT });
    fisa(admin);
    tinta(server, ALT_ANGAJAT, "aprobata");

    const r = await anuleazaCerere({ id: CERERE });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("doar de angajatul") },
    });
    expect(server.apeluriPe("leave_requests", "update")).toHaveLength(0);
  });

  it("propriul concediu aprobat, cu scope `all`: se poate retrage (statusul `aprobata` intră în listă)", async () => {
    const { server, admin } = configureazaActiunea({ rol: "hr", permisiuni: TOT });
    fisa(admin);
    tinta(server, FISA, "aprobata");
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    const r = await anuleazaCerere({ id: CERERE });
    expect(r.ok).toBe(true);
    const [apel] = server.apeluriPe("leave_requests", "update");
    expect(areFiltru(apel, "in", "status", ["ciorna", "trimisa", "aprobata"])).toBe(true);
  });

  it("P0001 (concediul a început deja): CONFLICT cu data spusă de trigger", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisa(admin);
    tinta(server, FISA, "aprobata");
    const mesaj = "Concediul a început pe 2026-07-06 și nu mai poate fi anulat.";
    server.raspunde("leave_requests", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await anuleazaCerere({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("cererea deja respinsă (zero rânduri): CONFLICT, fără revalidare", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisa(admin);
    tinta(server, FISA, "respinsa");
    server.raspunde("leave_requests", "update", { data: null });
    const r = await anuleazaCerere({ id: CERERE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("nu poate fi anulată") },
    });
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── trimiteCerere ──────────────────────────────────────────────────────────────

describe("trimiteCerere", () => {
  const PROPRIU = { "leave:update": "own" } as const;

  const ciorna = (extra: Record<string, unknown> = {}) => ({
    id: CERERE,
    employee_id: FISA,
    leave_type_id: TIP,
    leave_variant_id: null,
    data_inceput: "2026-07-06",
    data_sfarsit: "2026-07-10",
    status: "ciorna",
    ...extra,
  });
  const tip = (extra: Record<string, unknown> = {}) => ({
    id: TIP,
    denumire: "Concediu de odihnă",
    scade_din_sold: true,
    zile_implicite: 21,
    plafon_anual_zile: null,
    ...extra,
  });
  function sarbatori(server: ClientFals) {
    server.raspunde("public_holidays", "select", { data: [] });
    server.raspunde("organization_holidays", "select", { data: [] });
  }
  /** Ciorna, tipul, verificările curate și UPDATE-ul reușit. */
  function drumCurat(server: ClientFals) {
    server.raspunde("leave_requests", "select", { data: ciorna() });
    server.raspunde("leave_types", "select", { data: tip() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: { ramase: 21 } });
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "update", { data: { id: CERERE, zile_lucratoare: 5 } });
  }

  it("fără `leave:update`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "leave:create": "own" },
    });
    const r = await trimiteCerere({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("ciorna trece pe `trimisa`, cu `.eq('status','ciorna')` și `.select()` contra celei de-a doua file", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    drumCurat(server);

    const r = await trimiteCerere({ id: CERERE });

    expect(r).toEqual({
      ok: true,
      data: {
        id: CERERE,
        zileLucratoare: 5,
        aprobataInstant: false,
        zileInlocuite: 0,
        suspendare: { ceruta: false, declarata: false, termen: null, motiv: null },
      },
    });
    const [citire] = server.apeluriPe("leave_requests", "select");
    expect(areFiltru(citire, "eq", "id", CERERE)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [tipApel] = server.apeluriPe("leave_types");
    expect(areFiltru(tipApel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(tipApel, "eq", "id", TIP)).toBe(true);
    expect(areFiltru(tipApel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(tipApel, "is", "deleted_at", null)).toBe(true);

    const [sold] = server.apeluriPe("leave_balances");
    expect(areFiltru(sold, "eq", "employee_id", FISA)).toBe(true);

    const [apel] = server.apeluriPe("leave_requests", "update");
    expect(apel?.payload).toEqual({ status: "trimisa" });
    expect(areFiltru(apel, "eq", "id", CERERE)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "ciorna")).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();

    expect(caiRevalidate()).toEqual([
      "/concedii",
      "/concedii/sold",
      "/concedii/aprobari",
      ...CAI_PORTAL,
      `/portal/concediile-mele/${CERERE}`,
    ]);
  });

  it("cerere invizibilă: NEGASIT", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { data: null });
    const r = await trimiteCerere({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it.each(["trimisa", "aprobata", "anulata"])(
    "o cerere deja `%s` nu se mai trimite: CONFLICT, fără UPDATE",
    async (status) => {
      const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
      server.raspunde("leave_requests", "select", { data: ciorna({ status }) });
      const r = await trimiteCerere({ id: CERERE });
      expect(r).toMatchObject({
        ok: false,
        error: { code: "CONFLICT", message: expect.stringContaining("Doar o ciornă") },
      });
      expect(server.apeluriPe("leave_requests", "update")).toHaveLength(0);
    },
  );

  it("eroare la citirea ciornei: EROARE_INTERNA, nu NEGASIT", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { error: eroarePostgrest("57014") });
    const r = await trimiteCerere({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriPe("leave_types")).toHaveLength(0);
    expect(server.apeluriPe("leave_requests", "update")).toHaveLength(0);
  });

  it("eroare la citirea tipului: EROARE_INTERNA, nu „tip dezactivat”", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { data: ciorna() });
    server.raspunde("leave_types", "select", { error: eroarePostgrest("57014") });
    const r = await trimiteCerere({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriPe("leave_requests", "update")).toHaveLength(0);
  });

  it("eroare la citirea variantei: EROARE_INTERNA, nu cădere tăcută pe plafonul de bază", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { data: ciorna({ leave_variant_id: VARIANTA }) });
    server.raspunde("leave_types", "select", {
      data: tip({ denumire: "Paternal", scade_din_sold: false, plafon_anual_zile: 10 }),
    });
    server.raspunde("leave_type_variants", "select", { error: eroarePostgrest("57014") });
    const r = await trimiteCerere({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    // Verificările de trimitere nici nu încep.
    expect(server.apeluriPe("public_holidays")).toHaveLength(0);
    expect(server.apeluriPe("leave_requests", "update")).toHaveLength(0);
  });

  it("tipul ciornei dezactivat între timp: CONFLICT", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { data: ciorna() });
    server.raspunde("leave_types", "select", { data: null });
    const r = await trimiteCerere({ id: CERERE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("dezactivat") },
    });
  });

  it("sold insuficient la trimitere: CONFLICT, ciorna rămâne ciornă", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { data: ciorna() });
    server.raspunde("leave_types", "select", { data: tip() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: { ramase: 2 } });
    const r = await trimiteCerere({ id: CERERE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("lipsesc 3,00 zile") },
    });
    expect(server.apeluriPe("leave_requests", "update")).toHaveLength(0);
  });

  it("varianta ciornei încă activă: se verifică plafonul ei, nu al tipului", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { data: ciorna({ leave_variant_id: VARIANTA }) });
    server.raspunde("leave_types", "select", {
      data: tip({ denumire: "Paternal", scade_din_sold: false, plafon_anual_zile: 10 }),
    });
    server.raspunde("leave_type_variants", "select", {
      data: { denumire: "Paternal cu atestat", zile: 15 },
    });
    sarbatori(server);
    server.raspunde("leave_requests", "select", { data: [{ zile_lucratoare: 7 }] });
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "update", { data: { id: CERERE, zile_lucratoare: 5 } });

    const r = await trimiteCerere({ id: CERERE });

    expect(r.ok).toBe(true);
    const [varianta] = server.apeluriPe("leave_type_variants");
    expect(areFiltru(varianta, "eq", "id", VARIANTA)).toBe(true);
    expect(areFiltru(varianta, "eq", "activ", true)).toBe(true);
    expect(areFiltru(varianta, "is", "deleted_at", null)).toBe(true);
  });

  it("varianta dezactivată între timp: cade pe plafonul de bază (mai strict), nu blochează orbește", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { data: ciorna({ leave_variant_id: VARIANTA }) });
    server.raspunde("leave_types", "select", {
      data: tip({ denumire: "Paternal", scade_din_sold: false, plafon_anual_zile: 10 }),
    });
    server.raspunde("leave_type_variants", "select", { data: null });
    sarbatori(server);
    server.raspunde("leave_requests", "select", { data: [{ zile_lucratoare: 7 }] });

    const r = await trimiteCerere({ id: CERERE });

    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: expect.stringContaining("„Paternal” are un plafon legal de 10,00"),
      },
    });
  });

  it("suprapunere cu altă cerere a aceluiași angajat: CONFLICT", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { data: ciorna() });
    server.raspunde("leave_types", "select", { data: tip() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: { ramase: 21 } });
    server.raspunde("leave_requests", "select", {
      data: [{ data_inceput: "2026-07-01", data_sfarsit: "2026-07-06" }],
    });
    const r = await trimiteCerere({ id: CERERE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("acoperă o parte") },
    });
  });

  it("UPDATE respins tăcut (zero rânduri): CONFLICT, nu „trimisă”", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { data: ciorna() });
    server.raspunde("leave_types", "select", { data: tip() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: { ramase: 21 } });
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "update", { data: null });
    const r = await trimiteCerere({ id: CERERE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("nu a putut fi trimisă") },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("23P01 la UPDATE (cursă pe suprapunere): CONFLICT cu mesajul tradus", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("leave_requests", "select", { data: ciorna() });
    server.raspunde("leave_types", "select", { data: tip() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: { ramase: 21 } });
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "update", { error: eroarePostgrest("23P01") });
    const r = await trimiteCerere({ id: CERERE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Aveți deja o cerere") },
    });
  });

  it("ciorna ridicată de cine are `leave:approve = all` se aprobă pe loc", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "org_admin",
      permisiuni: { "leave:update": "all", "leave:approve": "all" },
    });
    drumCurat(server);
    admin.raspunde("approval_tasks", "update", { data: null });
    admin.raspunde("leave_requests", "update", { data: { id: CERERE } });
    admin.raspunde("leave_requests", "select", {
      data: { employee_id: FISA, tip: null },
    });
    admin.raspunde("employees", "select", { data: null });
    admin.raspunde("leave_request_days", "select", {
      data: [{ data: "2026-07-06", leave_request_id: CERERE }],
    });

    const r = await trimiteCerere({ id: CERERE });

    expect(r).toMatchObject({ ok: true, data: { aprobataInstant: true } });
    const [aprobare] = admin.apeluriPe("leave_requests", "update");
    expect(aprobare?.payload).toEqual({ status: "aprobata", decis_de: USER_ID });
    expect(areFiltru(aprobare, "eq", "status", "trimisa")).toBe(true);
    // Tipul șters logic între timp: zilele pleacă în pontaj ca „concediu”.
    expect(colaboratori.sincronizeazaZileleDeConcediu).toHaveBeenCalledWith(admin.client, ORG_ID, [
      { employee_id: FISA, data: "2026-07-06", leave_request_id: CERERE, tip_zi: "concediu" },
    ]);
    expect(caiRevalidate()).toEqual([
      "/concedii",
      "/concedii/sold",
      "/concedii/aprobari",
      ...CAI_PORTAL,
      `/portal/concediile-mele/${CERERE}`,
      "/concedii/aprobari",
      "/concedii/echipa",
      "/concedii/calendar",
      "/pontaj",
      "/portal/pontajul-meu",
    ]);
  });
});
