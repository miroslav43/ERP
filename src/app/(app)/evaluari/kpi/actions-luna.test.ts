// src/app/(app)/evaluari/kpi/actions-luna.test.ts
//
// KPI lunar — luna: deschiderea (instantaneul liniilor), salvarea valorilor cu
// scorul recalculat din bază și finalizarea fără drum înapoi. Straturile comune
// ale lui `createAction` sunt verificate în `src/app/(app)/salarizare/actions.test.ts`.

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
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { deschideLunaKpi, finalizeazaLunaKpi, salveazaLunaKpi } from "./actions";

const ACUM = new Date("2026-09-30T15:45:00.000Z");
const ANGAJAT = ID_2;
const LUNA = ID_1;
const SET = ID_3;
const IND_VIZITE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IND_ATITUDINE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IND_REBUT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const CAI_LUNA = [
  "/evaluari/kpi",
  "/evaluari/kpi/seturi",
  `/evaluari/kpi/${LUNA}`,
  `/angajati/${ANGAJAT}`,
  "/portal/kpi-ul-meu",
];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ACUM);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("deschideLunaKpi", () => {
  const PERMIS = { "evaluations:create": "team" } as const;
  const intrare = { employee_id: ANGAJAT, an: "2026", luna: "9" };

  // Indicatorii vin din embed neordonați; `ordine` decide șirul liniilor.
  const INDICATORI = [
    {
      id: IND_ATITUDINE,
      cod: "atitudine",
      denumire: "Atitudine",
      tip: "apreciat",
      unitate: null,
      sens: null,
      tinta_implicita: null,
      scala_max: 5,
      pondere: 20,
      ordine: 5,
    },
    {
      id: IND_VIZITE,
      cod: "vizite",
      denumire: "Vizite",
      tip: "masurat",
      unitate: "vizite",
      sens: "crestere",
      tinta_implicita: 40,
      scala_max: null,
      pondere: 50,
      ordine: 1,
    },
    {
      id: IND_REBUT,
      cod: "rebut",
      denumire: "Rebut",
      tip: "masurat",
      unitate: "%",
      sens: "descrestere",
      tinta_implicita: 2,
      scala_max: null,
      pondere: 30,
      ordine: 3,
    },
  ];

  const programeazaPanaLaLuna = (server: ReturnType<typeof configureazaActiunea>["server"]) => {
    server.raspunde("employees", "select", { data: { id: ANGAJAT, functie: "  Agent Vânzări " } });
    server.raspunde("kpi_seturi", "select", { data: { id: SET, indicatori: INDICATORI } });
    server.raspunde("kpi_tinte_angajat", "select", {
      data: [{ indicator_id: IND_VIZITE, tinta: 25 }],
    });
  };

  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "evaluations:create": "own" } });
    const r = await deschideLunaKpi(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cere `evaluations:create`: `update` singur nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "evaluations:update": "all" } });
    const r = await deschideLunaKpi(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: setul se caută după funcția NORMALIZATĂ, iar liniile îngheață ținta efectivă", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    programeazaPanaLaLuna(server);
    server.raspunde("kpi_evaluari_lunare", "insert", {
      data: { id: LUNA, employee_id: ANGAJAT },
    });
    server.raspunde("kpi_valori", "insert", { data: null });

    const r = await deschideLunaKpi(intrare);

    expect(r).toEqual({ ok: true, data: { id: LUNA, employee_id: ANGAJAT } });
    const [angajat] = server.apeluriPe("employees");
    expect(areFiltru(angajat, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(angajat, "eq", "id", ANGAJAT)).toBe(true);
    expect(areFiltru(angajat, "is", "deleted_at", null)).toBe(true);

    const [set] = server.apeluriPe("kpi_seturi");
    expect(areFiltru(set, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(set, "eq", "functie_norm", "agent vânzări")).toBe(true);
    expect(areFiltru(set, "eq", "activ", true)).toBe(true);
    expect(areFiltru(set, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(set, "is", "indicatori.deleted_at", null)).toBe(true);

    const [abateri] = server.apeluriPe("kpi_tinte_angajat");
    expect(areFiltru(abateri, "eq", "employee_id", ANGAJAT)).toBe(true);
    expect(areFiltru(abateri, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(abateri, "is", "deleted_at", null)).toBe(true);

    const [luna] = server.apeluriPe("kpi_evaluari_lunare", "insert");
    expect(luna?.payload).toEqual({
      organization_id: ORG_ID,
      employee_id: ANGAJAT,
      set_id: SET,
      an: 2026,
      luna: 9,
      status: "draft",
      evaluator_id: USER_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(luna?.selectDupaScriere).toBe("id, employee_id");

    const [valori] = server.apeluriPe("kpi_valori", "insert");
    const linii = valori?.payload as readonly Record<string, unknown>[];
    expect(linii.map((l) => [l.cod, l.ordine, l.tinta])).toEqual([
      ["vizite", 0, 25], // abaterea angajatului bate implicita 40
      ["rebut", 1, 2], // fără abatere: implicita funcției
      ["atitudine", 2, null], // apreciat: fără țintă
    ]);
    expect(linii[0]).toEqual({
      organization_id: ORG_ID,
      evaluare_id: LUNA,
      indicator_id: IND_VIZITE,
      cod: "vizite",
      denumire: "Vizite",
      tip: "masurat",
      unitate: "vizite",
      sens: "crestere",
      pondere: 50,
      scala_max: null,
      tinta: 25,
      ordine: 0,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
  });

  it("angajatul nu mai există: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: null });
    const r = await deschideLunaKpi(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("kpi_seturi")).toHaveLength(0);
  });

  it.each([
    ["funcție lipsă", null],
    ["funcție numai din spații", "   "],
  ])("%s: CONFLICT, fără căutarea setului", async (_caz, functie) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { id: ANGAJAT, functie } });
    const r = await deschideLunaKpi(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(/funcție/u);
    expect(server.apeluriPe("kpi_seturi")).toHaveLength(0);
  });

  it.each([
    ["funcția n-are set activ", null],
    ["setul n-are indicatori", { id: SET, indicatori: [] }],
    ["embed-ul de indicatori vine NULL", { id: SET, indicatori: null }],
  ])("%s: CONFLICT, nicio lună deschisă", async (_caz, set) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { id: ANGAJAT, functie: "Agent" } });
    server.raspunde("kpi_seturi", "select", { data: set });
    const r = await deschideLunaKpi(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("kpi_evaluari_lunare")).toHaveLength(0);
  });

  it("luna deja deschisă (23505): CONFLICT cu mesaj propriu, fără linii", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPanaLaLuna(server);
    server.raspunde("kpi_evaluari_lunare", "insert", { error: eroarePostgrest("23505") });
    const r = await deschideLunaKpi(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(/deja deschisă/u);
    expect(server.apeluriPe("kpi_valori")).toHaveLength(0);
  });

  it("INSERT-ul lunii fără rând întors (nu e managerul direct): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPanaLaLuna(server);
    server.raspunde("kpi_evaluari_lunare", "insert", { data: null });
    const r = await deschideLunaKpi(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("kpi_valori")).toHaveLength(0);
  });

  it("liniile pică: luna goală se retrage prin `sterge_logic`, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPanaLaLuna(server);
    server.raspunde("kpi_evaluari_lunare", "insert", {
      data: { id: LUNA, employee_id: ANGAJAT },
    });
    server.raspunde("kpi_valori", "insert", { error: eroarePostgrest("23514") });
    server.raspundeRpc("sterge_logic", { data: [LUNA] });

    const r = await deschideLunaKpi(intrare);

    expect(r.ok).toBe(false);
    // Nu UPDATE direct: acela pica tăcut cu 42501 (0164) și luna goală rămânea.
    expect(server.apeluriPe("kpi_evaluari_lunare", "update")).toHaveLength(0);
    const apel = server.apeluriRpc.find((a) => a.nume === "sterge_logic");
    expect(apel?.argumente).toEqual({ p_tabela: "kpi_evaluari_lunare", p_ids: [LUNA] });
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează KPI, luna, fișa angajatului și portalul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPanaLaLuna(server);
    server.raspunde("kpi_evaluari_lunare", "insert", {
      data: { id: LUNA, employee_id: ANGAJAT },
    });
    server.raspunde("kpi_valori", "insert", { data: null });
    await deschideLunaKpi(intrare);
    expect(caiRevalidate()).toEqual(CAI_LUNA);
  });
});

// ── Liniile unei luni deschise ────────────────────────────────────────────────

const LINIE_VIZITE = {
  id: IND_VIZITE,
  cod: "vizite",
  tip: "masurat",
  sens: "crestere",
  pondere: 60,
  scala_max: null,
  tinta: 40,
  realizat: null,
  nota: null,
};
const LINIE_ATITUDINE = {
  id: IND_ATITUDINE,
  cod: "atitudine",
  tip: "apreciat",
  sens: null,
  pondere: 40,
  scala_max: 5,
  tinta: null,
  realizat: null,
  nota: null,
};
const lunaDraft = (valori: unknown[] = [LINIE_VIZITE, LINIE_ATITUDINE], status = "draft") => ({
  data: { id: LUNA, employee_id: ANGAJAT, status, valori },
});
const fara = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;

describe("salveazaLunaKpi", () => {
  const PERMIS = { "evaluations:update": "team" } as const;
  const intrare = (valori: unknown[], concluzie = "Lună bună") => ({
    id: LUNA,
    valori: JSON.stringify(valori),
    concluzie,
  });

  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "evaluations:update": "own" } });
    const r = await salveazaLunaKpi(intrare([]));
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: fiecare linie primește doar câmpul tipului ei, iar scorul vine din RECITIREA bazei", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("kpi_evaluari_lunare", "select", lunaDraft());
    server.raspunde("kpi_valori", "update", { data: null });
    server.raspunde("kpi_valori", "update", { data: null });
    // Baza spune altceva decât clientul: nota la atitudine nu s-a scris.
    server.raspunde("kpi_valori", "select", {
      data: [fara({ ...LINIE_VIZITE, realizat: 30 }), fara(LINIE_ATITUDINE)],
    });
    server.raspunde("kpi_evaluari_lunare", "update", { data: { id: LUNA } });

    const r = await salveazaLunaKpi(
      intrare([
        // Un `nota` pe linie măsurată și un `realizat` pe linie apreciată se ignoră.
        { cod: "vizite", realizat: "30", nota: "9", comentariu: "Concediu o săptămână" },
        { cod: "atitudine", realizat: "100", nota: "4" },
        // Cod rămas dintr-un set schimbat între timp: ignorat, nu eroare.
        { cod: "disparut", realizat: "1" },
      ]),
    );

    expect(r).toEqual({ ok: true, data: { id: LUNA, employee_id: ANGAJAT, procent: 75 } });

    const [citire] = server.apeluriPe("kpi_evaluari_lunare", "select");
    expect(areFiltru(citire, "eq", "id", LUNA)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(citire, "is", "valori.deleted_at", null)).toBe(true);

    const [vizite, atitudine, ...altele] = server.apeluriPe("kpi_valori", "update");
    expect(altele).toHaveLength(0);
    expect(vizite?.payload).toEqual({
      realizat: 30,
      nota: null,
      procent: 75,
      comentariu: "Concediu o săptămână",
      updated_by: USER_ID,
    });
    expect(areFiltru(vizite, "eq", "id", IND_VIZITE)).toBe(true);
    expect(areFiltru(vizite, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(vizite, "is", "deleted_at", null)).toBe(true);
    expect(atitudine?.payload).toEqual({
      realizat: null,
      nota: 4,
      procent: 80,
      comentariu: null,
      updated_by: USER_ID,
    });

    const [recitire] = server.apeluriPe("kpi_valori", "select");
    expect(areFiltru(recitire, "eq", "evaluare_id", LUNA)).toBe(true);
    expect(areFiltru(recitire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(recitire, "is", "deleted_at", null)).toBe(true);

    const [scor] = server.apeluriPe("kpi_evaluari_lunare", "update");
    // 75 (doar vizitele, cum spune baza), nu 77 (cât ar fi dat intrarea clientului).
    expect(scor?.payload).toEqual({
      scor_procent: 75,
      concluzie: "Lună bună",
      updated_by: USER_ID,
    });
    expect(areFiltru(scor, "eq", "id", LUNA)).toBe(true);
    expect(areFiltru(scor, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scor, "eq", "status", "draft")).toBe(true);
    expect(scor?.selectDupaScriere).toBe("id");
  });

  it("nota peste scala liniei: CONFLICT care numește linia, nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_evaluari_lunare", "select", lunaDraft());
    const r = await salveazaLunaKpi(intrare([{ cod: "atitudine", nota: "7" }]));
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(/„atitudine" trebuie să fie între 0 și 5/u);
    expect(server.apeluriPe("kpi_valori")).toHaveLength(0);
  });

  it("luna nu mai există: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_evaluari_lunare", "select", { data: null });
    const r = await salveazaLunaKpi(intrare([]));
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("luna finalizată: CONFLICT, nicio linie atinsă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_evaluari_lunare", "select", lunaDraft(undefined, "finalizat"));
    const r = await salveazaLunaKpi(intrare([{ cod: "vizite", realizat: "10" }]));
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("kpi_valori")).toHaveLength(0);
  });

  it("zero rânduri la scrierea scorului (finalizată între timp): CONFLICT, nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_evaluari_lunare", "select", lunaDraft());
    server.raspunde("kpi_valori", "select", { data: [] });
    server.raspunde("kpi_evaluari_lunare", "update", { data: null });
    const r = await salveazaLunaKpi(intrare([]));
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează KPI, luna, fișa angajatului și portalul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_evaluari_lunare", "select", lunaDraft());
    server.raspunde("kpi_valori", "select", { data: [] });
    server.raspunde("kpi_evaluari_lunare", "update", { data: { id: LUNA } });
    await salveazaLunaKpi(intrare([]));
    expect(caiRevalidate()).toEqual(CAI_LUNA);
  });
});

describe("finalizeazaLunaKpi", () => {
  const PERMIS = { "evaluations:update": "team" } as const;
  const COMPLETATA = [{ ...LINIE_VIZITE, realizat: 40 }, LINIE_ATITUDINE];

  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "evaluations:update": "own" } });
    const r = await finalizeazaLunaKpi({ id: LUNA });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: tranziția draft → finalizat cu marca de timp și semnătura, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("kpi_evaluari_lunare", "select", lunaDraft(COMPLETATA));
    server.raspunde("kpi_evaluari_lunare", "update", { data: { id: LUNA } });

    const r = await finalizeazaLunaKpi({ id: LUNA });

    expect(r).toEqual({ ok: true, data: { id: LUNA, employee_id: ANGAJAT } });
    const [apel] = server.apeluriPe("kpi_evaluari_lunare", "update");
    expect(apel?.payload).toEqual({
      status: "finalizat",
      finalizat_la: ACUM.toISOString(),
      evaluator_id: USER_ID,
      updated_by: USER_ID,
    });
    expect(areFiltru(apel, "eq", "id", LUNA)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "draft")).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id");
  });

  it.each([
    ["nicio linie completată", lunaDraft()],
    ["luna fără linii", lunaDraft([])],
    ["luna deja finalizată", lunaDraft(COMPLETATA, "finalizat")],
  ])("%s: CONFLICT, fără UPDATE", async (_caz, luna) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_evaluari_lunare", "select", luna);
    const r = await finalizeazaLunaKpi({ id: LUNA });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("kpi_evaluari_lunare", "update")).toHaveLength(0);
  });

  it("zero rânduri (închisă de altcineva între timp): CONFLICT, nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_evaluari_lunare", "select", lunaDraft(COMPLETATA));
    server.raspunde("kpi_evaluari_lunare", "update", { data: null });
    const r = await finalizeazaLunaKpi({ id: LUNA });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează KPI, luna, fișa angajatului și portalul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_evaluari_lunare", "select", lunaDraft(COMPLETATA));
    server.raspunde("kpi_evaluari_lunare", "update", { data: { id: LUNA } });
    await finalizeazaLunaKpi({ id: LUNA });
    expect(caiRevalidate()).toEqual(CAI_LUNA);
  });
});
