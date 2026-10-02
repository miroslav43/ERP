// src/app/(app)/pontaj/actions-perioade.test.ts
//
// Perioadele lunare (deschidere, blocare, redeschidere), sincronizarea cu
// concediile și emiterea suspendării pentru absențe. Straturile comune ale lui
// `createAction` sunt în `salarizare/actions.test.ts`.

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

const colaboratori = vi.hoisted(() => ({ emiteSuspendarePentruAbsente: vi.fn() }));
vi.mock("./suspendare-absente", () => ({
  emiteSuspendarePentruAbsente: colaboratori.emiteSuspendarePentruAbsente,
  inchideSuspendareaLaReluare: vi.fn(),
  suspendareaDinAbsente: vi.fn(),
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
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  blocheazaPerioada,
  deschidePerioada,
  emiteSuspendareAbsente,
  redeschidePerioada,
  sincronizeazaConcediile,
} from "./actions";

const CAI = ["/pontaj", "/pontaj/perioade", "/pontaj/aprobare", "/portal", "/portal/pontajul-meu"];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  colaboratori.emiteSuspendarePentruAbsente.mockReset();
});

describe("deschidePerioada", () => {
  const PERMIS = { "attendance:create": "all" } as const;

  it("scope `team` (sub `all`) ⇒ INTERZIS, nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "attendance:create": "team" } });
    const r = await deschidePerioada({ an: 2026, luna: 7 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it.each([
    [2026, 2, "2026-02-01", "2026-02-28"],
    [2028, 2, "2028-02-01", "2028-02-29"],
    [2026, 12, "2026-12-01", "2026-12-31"],
    [2026, 4, "2026-04-01", "2026-04-30"],
  ])(
    "luna %i/%i: INSERT cu intervalul calendaristic al lunii",
    async (an, luna, inceput, sfarsit) => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS });
      server.raspunde("attendance_periods", "insert", { data: { id: ID_1 } });

      const r = await deschidePerioada({ an, luna, observatii: "" });

      expect(r).toEqual({ ok: true, data: { id: ID_1 } });
      const [apel] = server.apeluriPe("attendance_periods", "insert");
      // Fără `status`/`blocata_*`: politica INSERT le cere exact pe implicitele coloanei.
      expect(apel?.payload).toEqual({
        organization_id: ORG_ID,
        an,
        luna,
        data_inceput: inceput,
        data_sfarsit: sfarsit,
        observatii: null,
      });
      expect(apel?.selectDupaScriere).toBe("id");
      expect(caiRevalidate()).toEqual(CAI);
    },
  );

  it("observațiile nu intră în audit — doar anul și luna", async () => {
    const { server } = configureazaActiunea({ permisiuni: {} });
    await deschidePerioada({ an: 2026, luna: 7, observatii: "concediu medical Popescu" });
    expect(JSON.stringify(server.audituri())).not.toContain("Popescu");
  });

  it("P0001 de la trigger: mesajul cu cifrele lunii ajunge la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj = "Perioada de pontaj 07.2026 nu poate fi creată.";
    server.raspunde("attendance_periods", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await deschidePerioada({ an: 2026, luna: 7 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  // Din 0132 luna se naște deschisă la prima scriere, deci o deschidere
  // manuală a lunii curente lovește des `attendance_periods_luna_uq`.
  // `traduEroare` dă pentru ORICE 23505 mesajul zilei de pontaj; deschiderea
  // lunii își traduce singură conflictul.
  it("luna deja existentă (23505) ⇒ CONFLICT cu mesajul lunii, nu al zilei", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("attendance_periods", "insert", { error: eroarePostgrest("23505") });
    const r = await deschidePerioada({ an: 2026, luna: 7 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).not.toMatch(/zi de pontaj|angajat/u);
  });
});

describe.each([
  ["blocheazaPerioada", blocheazaPerioada, "blocata"],
  ["redeschidePerioada", redeschidePerioada, "deschisa"],
] as const)("%s", (_nume, actiune, status) => {
  const PERMIS = { "attendance:approve": "all" } as const;

  it("managerul cu `approve = team` e refuzat (blocarea cere `all`)", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "attendance:approve": "team" },
    });
    const r = await actiune({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it(`UPDATE doar cu status=${status}, pe id + organizație, cu \`.select()\` după scriere`, async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("attendance_periods", "update", { data: { id: ID_1 } });

    const r = await actiune({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel, ...altele] = server.apeluriPe("attendance_periods");
    expect(altele).toHaveLength(0);
    expect(apel?.payload).toEqual({ status });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("zero rânduri ⇒ NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("attendance_periods", "update", { data: null });
    const r = await actiune({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("tranziție refuzată de trigger (P0001): mesajul se propagă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj = "Tranziția perioadei de pontaj 07.2026 nu este permisă.";
    server.raspunde("attendance_periods", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await actiune({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("sincronizeazaConcediile", () => {
  const PERMIS = { "attendance:create": "all" } as const;

  it("scope `team` (sub `all`) ⇒ INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "attendance:create": "team" } });
    const r = await sincronizeazaConcediile({ an: 2026, luna: 7 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără modulul de concedii ⇒ CONFLICT, nicio citire", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS, functii: ["attendance"] });
    const r = await sincronizeazaConcediile({ an: 2026, luna: 7 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("citește zilele lucrătoare de concediu ale lunii, pe organizație", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("leave_request_days", "select", { data: [] });

    const r = await sincronizeazaConcediile({ an: 2026, luna: 2 });

    expect(r).toEqual({ ok: true, data: { create: 0, actualizate: 0, pastrate: 0 } });
    const [apel] = server.apeluriPe("leave_request_days");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "este_lucratoare", true)).toBe(true);
    expect(areFiltru(apel, "gte", "data", "2026-02-01")).toBe(true);
    expect(areFiltru(apel, "lte", "data", "2026-02-28")).toBe(true);
    // Nimic de sincronizat ⇒ pontajul nu se atinge deloc.
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
  });

  it("doar cererile APROBATE se sincronizează; zilele manuale se păstrează, nu se suprascriu", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const cerere = (status: string, tip: string | null) => ({
      employee_id: ID_3,
      status,
      tip: tip === null ? null : { tip_zi_pontaj: tip },
    });
    server.raspunde("leave_request_days", "select", {
      data: [
        { data: "2026-07-13", leave_request_id: ID_1, cerere: cerere("aprobata", "medical") },
        { data: "2026-07-14", leave_request_id: ID_1, cerere: cerere("aprobata", null) },
        { data: "2026-07-15", leave_request_id: ID_1, cerere: cerere("aprobata", "concediu") },
        { data: "2026-07-16", leave_request_id: ID_2, cerere: cerere("in_asteptare", "concediu") },
        { data: "2026-07-17", leave_request_id: ID_2, cerere: null },
      ],
    });
    server.raspunde("attendance_entries", "select", {
      data: [
        { id: "z14", employee_id: ID_3, data: "2026-07-14", sursa: "sincronizare_concedii" },
        { id: "z15", employee_id: ID_3, data: "2026-07-15", sursa: "manuala" },
      ],
    });
    server.raspunde("attendance_entries", "insert", { data: null });
    // Rândul chiar scris: un UPDATE refuzat tăcut nu trebuie numărat (defectul
    // e descris în `sincronizare-concediu.test.ts`).
    server.raspunde("attendance_entries", "update", { data: { id: "z14" } });

    const r = await sincronizeazaConcediile({ an: 2026, luna: 7 });

    expect(r).toEqual({ ok: true, data: { create: 1, actualizate: 1, pastrate: 1 } });
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: ID_3,
      data: "2026-07-13",
      tip_zi: "medical",
      ore_lucrate: 0,
      sursa: "sincronizare_concedii",
      leave_request_id: ID_1,
    });
    const [update] = server.apeluriPe("attendance_entries", "update");
    // Tipul de concediu șters ⇒ „concediu”, ca înainte de 0064.
    expect(update?.payload).toMatchObject({ tip_zi: "concediu", ore_lucrate: 0 });
    expect(areFiltru(update, "eq", "id", "z14")).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(caiRevalidate()).toEqual(CAI);
  });
});

describe("emiteSuspendareAbsente", () => {
  const PERMIS = { "employees:update": "all" } as const;

  it("poarta e `employees:update` la `all` — `attendance:*` nu ajunge", async () => {
    const { server, admin } = configureazaActiunea({
      permisiuni: { "attendance:approve": "all", "attendance:create": "all" },
    });
    const r = await emiteSuspendareAbsente({ employee_id: ID_3, data_inceput: "2026-07-01" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
    expect(colaboratori.emiteSuspendarePentruAbsente).not.toHaveBeenCalled();
  });

  it("scope `team` (sub `all`) ⇒ INTERZIS", async () => {
    configureazaActiunea({ permisiuni: { "employees:update": "team" } });
    const r = await emiteSuspendareAbsente({ employee_id: ID_3, data_inceput: "2026-07-01" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });

  it("emite cu clientul admin, organizația din sesiune și sfârșitul gol ca `null`", async () => {
    const { admin } = configureazaActiunea({ permisiuni: PERMIS });
    colaboratori.emiteSuspendarePentruAbsente.mockResolvedValue({
      ok: true,
      suspendareId: ID_1,
      termen: "2026-07-02",
      motiv: null,
    });

    const r = await emiteSuspendareAbsente({
      employee_id: ID_3,
      data_inceput: "2026-07-01",
      data_sfarsit: "",
    });

    expect(r).toEqual({ ok: true, data: { suspendareId: ID_1, motiv: null } });
    const argumente = colaboratori.emiteSuspendarePentruAbsente.mock.calls[0] ?? [];
    expect(argumente[0]).toBe(admin.client);
    expect(argumente.slice(1, 6)).toEqual([ORG_ID, ID_3, "2026-07-01", null, USER_ID]);
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("eșecul emiterii ⇒ CONFLICT cu motivul ei, fără revalidare", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    colaboratori.emiteSuspendarePentruAbsente.mockResolvedValue({
      ok: false,
      suspendareId: null,
      termen: null,
      motiv: "Angajatul nu are un contract activ.",
    });
    const r = await emiteSuspendareAbsente({ employee_id: ID_3, data_inceput: "2026-07-01" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Angajatul nu are un contract activ." },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("eșec fără motiv ⇒ CONFLICT cu mesajul implicit", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    colaboratori.emiteSuspendarePentruAbsente.mockResolvedValue({
      ok: false,
      suspendareId: null,
      termen: null,
      motiv: null,
    });
    const r = await emiteSuspendareAbsente({ employee_id: ID_3, data_inceput: "2026-07-01" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Decizia nu a putut fi emisă." },
    });
  });

  it("sfârșitul înaintea începutului e refuzat la validare, fără emitere", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    const r = await emiteSuspendareAbsente({
      employee_id: ID_3,
      data_inceput: "2026-07-10",
      data_sfarsit: "2026-07-09",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("data_sfarsit");
    expect(colaboratori.emiteSuspendarePentruAbsente).not.toHaveBeenCalled();
  });
});
