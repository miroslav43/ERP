// src/app/(app)/evaluari/kpi/actions-seturi.test.ts
//
// KPI lunar — seturile de indicatori și abaterile de țintă per angajat.
// Straturile comune ale lui `createAction` sunt verificate în
// `src/app/(app)/salarizare/actions.test.ts`.

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
import {
  actualizeazaSetKpi,
  arhiveazaSetKpi,
  creeazaSetKpi,
  seteazaTintaKpi,
  stergeTintaKpi,
} from "./actions";

const ACUM = new Date("2026-09-20T10:00:00.000Z");
const PERMIS = { "evaluations:update": "team" } as const;
const SUB_PRAG = { "evaluations:update": "own" } as const;
const CAI_KPI = ["/evaluari/kpi", "/evaluari/kpi/seturi"];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ACUM);
});

afterEach(() => {
  vi.useRealTimers();
});

const MASURAT = {
  denumire: "Vizite clienți",
  tip: "masurat",
  sens: "crestere",
  unitate: "vizite",
  tinta_implicita: "40",
  // Rămas în formular la comutarea tipului: se anulează, nu se refuză.
  scala_max: "5",
  pondere: "60",
};
const APRECIAT = {
  denumire: "Atitudine",
  tip: "apreciat",
  sens: "descrestere",
  unitate: "puncte",
  tinta_implicita: "3",
  scala_max: "5",
  pondere: "40",
};

describe("creeazaSetKpi", () => {
  const intrare = (indicatori: unknown[] = [MASURAT, APRECIAT]) => ({
    functie: "Agent vânzări",
    denumire: "KPI agenți",
    descriere: "",
    indicatori: JSON.stringify(indicatori),
  });

  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await creeazaSetKpi(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("modulul `kpi` inactiv, chiar cu `evaluations` activ: MODUL_DEZACTIVAT", async () => {
    const { server } = configureazaActiunea({ functii: ["evaluations"], permisiuni: PERMIS });
    const r = await creeazaSetKpi(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: setul, apoi indicatorii cu coduri, ordine și câmpurile străine tipului anulate", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("kpi_seturi", "insert", { data: { id: ID_1 } });
    server.raspunde("kpi_indicatori", "insert", { data: null });

    const r = await creeazaSetKpi(intrare());

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [set] = server.apeluriPe("kpi_seturi", "insert");
    expect(set?.payload).toEqual({
      organization_id: ORG_ID,
      functie: "Agent vânzări",
      denumire: "KPI agenți",
      descriere: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(set?.selectDupaScriere).toBe("id");

    const [indicatori] = server.apeluriPe("kpi_indicatori", "insert");
    const comun = { organization_id: ORG_ID, set_id: ID_1, descriere: null };
    const autori = { created_by: USER_ID, updated_by: USER_ID };
    expect(indicatori?.payload).toEqual([
      {
        ...comun,
        cod: "vizite_clienti",
        denumire: "Vizite clienți",
        tip: "masurat",
        unitate: "vizite",
        sens: "crestere",
        tinta_implicita: 40,
        scala_max: null,
        pondere: 60,
        ordine: 0,
        ...autori,
      },
      {
        ...comun,
        cod: "atitudine",
        denumire: "Atitudine",
        tip: "apreciat",
        unitate: null,
        sens: null,
        tinta_implicita: null,
        scala_max: 5,
        pondere: 40,
        ordine: 1,
        ...autori,
      },
    ]);
  });

  it.each([
    ["măsurat fără sens", [{ ...MASURAT, sens: "" }]],
    ["măsurat fără țintă", [{ ...MASURAT, tinta_implicita: "" }]],
    ["apreciat pe o scală nepermisă", [{ ...APRECIAT, scala_max: "7" }]],
  ])("%s: VALIDARE, fără nicio scriere", async (_caz, indicatori) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await creeazaSetKpi(intrare(indicatori));
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("23505 pe setul funcției: CONFLICT cu explicația „un set activ per funcție”", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_seturi", "insert", { error: eroarePostgrest("23505") });
    const r = await creeazaSetKpi(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(/deja un set de indicatori activ/u);
    expect(server.apeluriPe("kpi_indicatori")).toHaveLength(0);
  });

  it("INSERT-ul setului fără rând întors: CONFLICT, fără indicatori", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_seturi", "insert", { data: null });
    const r = await creeazaSetKpi(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("kpi_indicatori")).toHaveLength(0);
  });

  it("indicatorii pică: setul-cochilie se retrage (soft delete pe id + organizație), fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_seturi", "insert", { data: { id: ID_1 } });
    server.raspunde("kpi_indicatori", "insert", { error: eroarePostgrest("23514") });
    server.raspunde("kpi_seturi", "update", { data: null });

    const r = await creeazaSetKpi(intrare());

    expect(r.ok).toBe(false);
    const [retragere] = server.apeluriPe("kpi_seturi", "update");
    expect(retragere?.payload).toEqual({ deleted_at: ACUM.toISOString(), updated_by: USER_ID });
    expect(areFiltru(retragere, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(retragere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează lista KPI și pagina de seturi", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_seturi", "insert", { data: { id: ID_1 } });
    server.raspunde("kpi_indicatori", "insert", { data: null });
    await creeazaSetKpi(intrare());
    expect(caiRevalidate()).toEqual(CAI_KPI);
  });
});

describe("actualizeazaSetKpi", () => {
  const IND_VIZITE = ID_2;
  const IND_REBUT = ID_3;
  const intrare = (indicatori: unknown[]) => ({
    id: ID_1,
    denumire: "KPI agenți 2026",
    descriere: "",
    indicatori: JSON.stringify(indicatori),
  });

  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await actualizeazaSetKpi(intrare([MASURAT]));
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("reconciliere după cod: scos ⇒ soft delete, păstrat ⇒ UPDATE, nou ⇒ INSERT", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("kpi_indicatori", "select", {
      data: [
        { id: IND_VIZITE, cod: "vizite" },
        { id: IND_REBUT, cod: "rebut" },
      ],
    });
    server.raspunde("kpi_indicatori", "update", { data: null });
    server.raspunde("kpi_indicatori", "update", { data: null });
    server.raspunde("kpi_indicatori", "insert", { data: null });
    server.raspunde("kpi_seturi", "update", { data: { id: ID_1 } });

    const r = await actualizeazaSetKpi(intrare([{ ...MASURAT, cod: "vizite" }, APRECIAT]));

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    // Întâi soft delete-ul celor scoși, abia apoi INSERT-ul: altfel un cod scos
    // și readăugat în aceeași salvare lovește `kpi_indicatori_cod_uniq`.
    expect(
      server
        .apeluriPe("kpi_indicatori")
        .map((a) => a.operatie + (a.filtre.some((f) => f.metoda === "in") ? ":sterge" : "")),
    ).toEqual(["select", "update:sterge", "update", "insert"]);
    const [citire] = server.apeluriPe("kpi_indicatori", "select");
    expect(areFiltru(citire, "eq", "set_id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [stergere, actualizare] = server.apeluriPe("kpi_indicatori", "update");
    expect(stergere?.payload).toEqual({ deleted_at: ACUM.toISOString(), updated_by: USER_ID });
    expect(areFiltru(stergere, "in", "id", [IND_REBUT])).toBe(true);
    expect(areFiltru(stergere, "eq", "organization_id", ORG_ID)).toBe(true);

    expect(actualizare?.payload).toMatchObject({
      set_id: ID_1,
      cod: "vizite",
      tinta_implicita: 40,
      ordine: 0,
      updated_by: USER_ID,
    });
    expect(actualizare?.payload).not.toHaveProperty("created_by");
    expect(areFiltru(actualizare, "eq", "id", IND_VIZITE)).toBe(true);
    expect(areFiltru(actualizare, "eq", "organization_id", ORG_ID)).toBe(true);

    const [insert] = server.apeluriPe("kpi_indicatori", "insert");
    expect(insert?.payload).toEqual([
      expect.objectContaining({ cod: "atitudine", ordine: 1, set_id: ID_1, created_by: USER_ID }),
    ]);

    const [set] = server.apeluriPe("kpi_seturi", "update");
    expect(set?.payload).toEqual({
      denumire: "KPI agenți 2026",
      descriere: null,
      updated_by: USER_ID,
    });
    expect(areFiltru(set, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(set, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(set, "is", "deleted_at", null)).toBe(true);
    expect(set?.selectDupaScriere).toBe("id");
  });

  it("niciun indicator scos: nu se trimite niciun soft delete", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_indicatori", "select", { data: [{ id: IND_VIZITE, cod: "vizite" }] });
    server.raspunde("kpi_indicatori", "update", { data: null });
    server.raspunde("kpi_seturi", "update", { data: { id: ID_1 } });

    await actualizeazaSetKpi(intrare([{ ...MASURAT, cod: "vizite" }]));

    const actualizari = server.apeluriPe("kpi_indicatori", "update");
    expect(actualizari).toHaveLength(1);
    expect(actualizari[0]?.filtre.some((f) => f.metoda === "in")).toBe(false);
    expect(server.apeluriPe("kpi_indicatori", "insert")).toHaveLength(0);
  });

  it("soft delete-ul celor scoși refuzat: eroare, setul nu se salvează, nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_indicatori", "select", { data: [{ id: IND_REBUT, cod: "rebut" }] });
    server.raspunde("kpi_indicatori", "update", { error: eroarePostgrest("42501") });

    const r = await actualizeazaSetKpi(intrare([MASURAT]));

    expect(r.ok).toBe(false);
    expect(server.apeluriPe("kpi_indicatori", "insert")).toHaveLength(0);
    expect(server.apeluriPe("kpi_seturi", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("UPDATE-ul unui indicator păstrat refuzat: eroare, fără INSERT și fără set salvat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_indicatori", "select", { data: [{ id: IND_VIZITE, cod: "vizite" }] });
    server.raspunde("kpi_indicatori", "update", { error: eroarePostgrest("42501") });

    const r = await actualizeazaSetKpi(intrare([{ ...MASURAT, cod: "vizite" }, APRECIAT]));

    expect(r.ok).toBe(false);
    expect(server.apeluriPe("kpi_indicatori", "insert")).toHaveLength(0);
    expect(server.apeluriPe("kpi_seturi", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("INSERT-ul indicatorilor noi refuzat: eroare, setul nu se salvează, nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_indicatori", "select", { data: [] });
    server.raspunde("kpi_indicatori", "insert", { error: eroarePostgrest("23514") });

    const r = await actualizeazaSetKpi(intrare([MASURAT]));

    expect(r.ok).toBe(false);
    expect(server.apeluriPe("kpi_seturi", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("zero rânduri pe set: CONFLICT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_indicatori", "select", { data: [] });
    server.raspunde("kpi_indicatori", "insert", { data: null });
    server.raspunde("kpi_seturi", "update", { data: null });
    const r = await actualizeazaSetKpi(intrare([MASURAT]));
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează lista, seturile și pagina setului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_indicatori", "select", { data: [] });
    server.raspunde("kpi_indicatori", "insert", { data: null });
    server.raspunde("kpi_seturi", "update", { data: { id: ID_1 } });
    await actualizeazaSetKpi(intrare([MASURAT]));
    expect(caiRevalidate()).toEqual([...CAI_KPI, `/evaluari/kpi/seturi/${ID_1}`]);
  });
});

describe("arhiveazaSetKpi", () => {
  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await arhiveazaSetKpi({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: `activ = false` (nu ștergere), doar pe un set activ, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_seturi", "update", { data: { id: ID_1 } });

    const r = await arhiveazaSetKpi({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("kpi_seturi", "update");
    expect(apel?.payload).toEqual({ activ: false, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(CAI_KPI);
  });

  it("zero rânduri (deja arhivat): CONFLICT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_seturi", "update", { data: null });
    const r = await arhiveazaSetKpi({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it.fails(
    "DEFECT: refuzul RLS la scriere (42501) trebuie să iasă INTERZIS, nu EROARE_INTERNA",
    async () => {
      // `throw mapPostgrestError(...)` aruncă un `ActionError` simplu, pe care
      // `createAction` nu-l recunoaște (nu e `ActionDenied`, n-are `details`).
      const { server } = configureazaActiunea({ permisiuni: PERMIS });
      server.raspunde("kpi_seturi", "update", { error: eroarePostgrest("42501") });
      const r = await arhiveazaSetKpi({ id: ID_1 });
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    },
  );
});

describe("seteazaTintaKpi", () => {
  const ANGAJAT = ID_2;
  const INDICATOR = ID_3;
  const intrare = (tinta: unknown = "25") => ({
    employee_id: ANGAJAT,
    indicator_id: INDICATOR,
    tinta,
    motiv: "Zonă rurală",
  });
  const CAI = [...CAI_KPI, `/angajati/${ANGAJAT}`, "/portal/kpi-ul-meu"];

  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await seteazaTintaKpi(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără abatere existentă: INSERT în organizația activă (nu upsert)", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("kpi_tinte_angajat", "select", { data: null });
    server.raspunde("kpi_tinte_angajat", "insert", { data: { id: ID_1, employee_id: ANGAJAT } });

    const r = await seteazaTintaKpi(intrare());

    expect(r).toEqual({ ok: true, data: { id: ID_1, employee_id: ANGAJAT } });
    const [citire] = server.apeluriPe("kpi_tinte_angajat", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "eq", "employee_id", ANGAJAT)).toBe(true);
    expect(areFiltru(citire, "eq", "indicator_id", INDICATOR)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [insert] = server.apeluriPe("kpi_tinte_angajat", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      employee_id: ANGAJAT,
      indicator_id: INDICATOR,
      tinta: 25,
      motiv: "Zonă rurală",
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(server.apeluriPe("kpi_tinte_angajat", "upsert")).toHaveLength(0);
  });

  it("abatere existentă: UPDATE pe rândul ei, cu `.select()`; ținta zero e valoare, nu lipsă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_tinte_angajat", "select", { data: { id: ID_1 } });
    server.raspunde("kpi_tinte_angajat", "update", { data: { id: ID_1, employee_id: ANGAJAT } });

    await seteazaTintaKpi(intrare(0));

    const [apel] = server.apeluriPe("kpi_tinte_angajat", "update");
    expect(apel?.payload).toEqual({ tinta: 0, motiv: "Zonă rurală", updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, employee_id");
    expect(server.apeluriPe("kpi_tinte_angajat", "insert")).toHaveLength(0);
  });

  it("ținta golită: VALIDARE „Puneți o țintă”, nu zero", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await seteazaTintaKpi(intrare(""));
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors?.tinta).toEqual(["Puneți o țintă."]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("UPDATE respins tăcut (nu e managerul direct): CONFLICT care numește cauza probabilă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_tinte_angajat", "select", { data: { id: ID_1 } });
    server.raspunde("kpi_tinte_angajat", "update", { data: null });
    const r = await seteazaTintaKpi(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(/managerul direct/u);
    expect(caiRevalidate()).toEqual([]);
  });

  it("INSERT fără rând întors: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_tinte_angajat", "select", { data: null });
    server.raspunde("kpi_tinte_angajat", "insert", { data: null });
    const r = await seteazaTintaKpi(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("succes: revalidează KPI, fișa angajatului și portalul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_tinte_angajat", "select", { data: null });
    server.raspunde("kpi_tinte_angajat", "insert", { data: { id: ID_1, employee_id: ANGAJAT } });
    await seteazaTintaKpi(intrare());
    expect(caiRevalidate()).toEqual(CAI);
  });
});

describe("stergeTintaKpi", () => {
  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await stergeTintaKpi({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: soft delete pe id + organizație, doar pe rând viu, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_tinte_angajat", "update", { data: { id: ID_1, employee_id: ID_2 } });

    const r = await stergeTintaKpi({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1, employee_id: ID_2 } });
    const [apel] = server.apeluriPe("kpi_tinte_angajat", "update");
    expect(apel?.payload).toEqual({ deleted_at: ACUM.toISOString(), updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, employee_id");
    // Fișa revalidată e a angajatului întors de bază.
    expect(caiRevalidate()).toEqual([...CAI_KPI, `/angajati/${ID_2}`, "/portal/kpi-ul-meu"]);
  });

  it("zero rânduri: CONFLICT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("kpi_tinte_angajat", "update", { data: null });
    const r = await stergeTintaKpi({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});
