// src/app/(app)/departamente/actions-stare.test.ts
//
// Mutarea unui departament în arbore, dezactivarea și reactivarea lui, și
// mutarea persoanelor între departamente. Toate cer scope `all`; toate fac
// `.select()` după UPDATE, fiindcă `departments_update` și `employees_update`
// refuză prin USING cu zero rânduri și fără eroare.

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

import {
  asteaptaDupa,
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  MEMBER_ID,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  dezactiveazaDepartament,
  mutaAngajati,
  mutaDepartament,
  reactiveazaDepartament,
} from "./actions";

const EDITARE = { "departments:update": "all" } as const;
const MUTARE_PERSOANE = { "employees:update": "all" } as const;

const DEP = ID_1;
const PARINTE = ID_2;
const MANAGER = ID_3;
const MEMBRU_SEF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONT_SEF = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ANGAJAT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ANGAJAT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// ── mutaDepartament ────────────────────────────────────────────────────────

describe("mutaDepartament", () => {
  it("cere `departments:update` la `all`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "departments:update": "team" } });
    const r = await mutaDepartament({ id: DEP, parent_id: PARINTE });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("schimbă doar părintele, pe id + organizație + nesters, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("departments", "update", { data: { id: DEP } });

    const r = await mutaDepartament({ id: DEP, parent_id: PARINTE });

    expect(r).toEqual({ ok: true, data: { id: DEP } });
    const [apel, ...altele] = server.apeluri;
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("update");
    // `path` și `depth` le calculează triggerul, nu clientul.
    expect(apel?.payload).toEqual({ parent_id: PARINTE, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", DEP)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/departamente"]);
  });

  it("părintele gol mută departamentul la rădăcină (`parent_id` NULL)", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("departments", "update", { data: { id: DEP } });
    await mutaDepartament({ id: DEP, parent_id: "" });
    expect(server.apeluri[0]?.payload).toMatchObject({ parent_id: null });
  });

  it("un departament nu poate fi subordonat lui însuși: CONFLICT, fără nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    const r = await mutaDepartament({ id: DEP, parent_id: DEP });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Un departament nu poate fi subordonat lui însuși." },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("zero rânduri: NEGASIT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("departments", "update", { data: null });
    const r = await mutaDepartament({ id: DEP, parent_id: PARINTE });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it.fails(
    "DEFECT: ciclul refuzat de `tg_departments_path` (P0001) ajunge CONFLICT, nu „eroare neașteptată”",
    async () => {
      const { server } = configureazaActiunea({ permisiuni: EDITARE });
      server.raspunde("departments", "update", {
        error: eroarePostgrest("P0001", "Structura ar deveni circulară."),
      });
      const r = await mutaDepartament({ id: DEP, parent_id: PARINTE });
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    },
  );
});

// ── dezactiveazaDepartament ────────────────────────────────────────────────

describe("dezactiveazaDepartament", () => {
  it("cere `departments:update`: `create` singur nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "departments:create": "all" } });
    const r = await dezactiveazaDepartament({ id: DEP });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cere `departments:update` la `all`: `team` nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "departments:update": "team" } });
    const r = await dezactiveazaDepartament({ id: DEP });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("refuză cât timp are angajați (orice status, doar nesterși): CONFLICT, fără scriere", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("employees", "select", { count: 2 });

    const r = await dezactiveazaDepartament({ id: DEP });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("Mutați-i în altă structură");
    const [numarare] = server.apeluriPe("employees", "select");
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(numarare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(numarare, "eq", "department_id", DEP)).toBe(true);
    expect(areFiltru(numarare, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(numarare, "eq", "status")).toBe(false);
    expect(server.apeluriPe("departments")).toHaveLength(0);
  });

  it("gol: `activ = false` pe id + organizație, cu managerul citit din RETURNING", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("employees", "select", { count: 0 });
    server.raspunde("departments", "update", {
      data: { id: DEP, manager_employee_id: MANAGER },
    });

    const r = await dezactiveazaDepartament({ id: DEP });

    expect(r).toEqual({ ok: true, data: { id: DEP } });
    const [apel] = server.apeluriPe("departments", "update");
    expect(apel?.payload).toEqual({ activ: false, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", DEP)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toContain("manager_employee_id");
    // `hr` nu atinge rolurile.
    expect(server.apeluriPe("organization_members")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(["/departamente"]);
  });

  it("numărătoarea fără `count` (null) se tratează drept zero angajați", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("employees", "select", { count: null });
    server.raspunde("departments", "update", { data: { id: DEP, manager_employee_id: null } });
    expect((await dezactiveazaDepartament({ id: DEP })).ok).toBe(true);
  });

  it("zero rânduri la UPDATE: CONFLICT „nu a fost dezactivat”, nu succes", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("employees", "select", { count: 0 });
    server.raspunde("departments", "update", { data: null });
    const r = await dezactiveazaDepartament({ id: DEP });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("nu a fost dezactivat");
    expect(caiRevalidate()).toEqual([]);
  });

  it("`org_admin`: șeful care nu mai conduce nimic altceva revine la `employee`", async () => {
    const { server } = configureazaActiunea({ rol: "org_admin", permisiuni: EDITARE });
    server.raspunde("employees", "select", { count: 0 });
    server.raspunde("departments", "update", {
      data: { id: DEP, manager_employee_id: MANAGER },
    });
    server.raspunde("employees", "select", { data: { user_id: CONT_SEF } });
    server.raspunde("organization_members", "select", {
      data: { id: MEMBRU_SEF, role: "manager" },
    });
    server.raspunde("departments", "select", { count: 0 });
    server.raspunde("organization_members", "select", { count: 1 });
    server.raspunde("organization_members", "update", {
      data: { id: MEMBRU_SEF, role: "employee" },
    });

    const r = await dezactiveazaDepartament({ id: DEP });

    expect(r.ok).toBe(true);
    const [rol] = server.apeluriPe("organization_members", "update");
    expect(rol?.payload).toEqual({ role: "employee" });
    expect(areFiltru(rol, "eq", "id", MEMBRU_SEF)).toBe(true);
    expect(areFiltru(rol, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("`org_admin`: șeful care mai conduce alt departament activ își păstrează rolul", async () => {
    const { server } = configureazaActiunea({ rol: "org_admin", permisiuni: EDITARE });
    server.raspunde("employees", "select", { count: 0 });
    server.raspunde("departments", "update", {
      data: { id: DEP, manager_employee_id: MANAGER },
    });
    server.raspunde("employees", "select", { data: { user_id: CONT_SEF } });
    server.raspunde("organization_members", "select", {
      data: { id: MEMBRU_SEF, role: "manager" },
    });
    server.raspunde("departments", "select", { count: 1 });

    const r = await dezactiveazaDepartament({ id: DEP });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("organization_members", "update")).toHaveLength(0);
  });

  it("`org_admin` dezactivând propriul departament nu-și schimbă singur rolul: CONFLICT", async () => {
    const { server } = configureazaActiunea({ rol: "org_admin", permisiuni: EDITARE });
    server.raspunde("employees", "select", { count: 0 });
    server.raspunde("departments", "update", {
      data: { id: DEP, manager_employee_id: MANAGER },
    });
    server.raspunde("employees", "select", { data: { user_id: CONT_SEF } });
    // Apartenența șefului e chiar a autorului.
    server.raspunde("organization_members", "select", {
      data: { id: MEMBER_ID, role: "manager" },
    });
    server.raspunde("departments", "select", { count: 0 });

    const r = await dezactiveazaDepartament({ id: DEP });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("propriul rol");
    expect(server.apeluriPe("organization_members", "update")).toHaveLength(0);
  });
});

// ── reactiveazaDepartament ─────────────────────────────────────────────────

describe("reactiveazaDepartament", () => {
  it("cere `departments:update` la `all`: `team` nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "departments:update": "team" } });
    const r = await reactiveazaDepartament({ id: DEP });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("`activ = true` fără nicio condiție de efectiv (un departament gol e legitim)", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("departments", "update", { data: { id: DEP, manager_employee_id: null } });

    const r = await reactiveazaDepartament({ id: DEP });

    expect(r).toEqual({ ok: true, data: { id: DEP } });
    expect(server.apeluriPe("employees")).toHaveLength(0);
    const [apel] = server.apeluriPe("departments", "update");
    expect(apel?.payload).toEqual({ activ: true, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", DEP)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/departamente"]);
  });

  it("zero rânduri: CONFLICT „nu a fost reactivat”", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("departments", "update", { data: null });
    const r = await reactiveazaDepartament({ id: DEP });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("nu a fost reactivat");
  });

  it("`org_admin`: șeful `employee` al departamentului redeschis își recapătă rolul de manager", async () => {
    const { server } = configureazaActiunea({ rol: "org_admin", permisiuni: EDITARE });
    server.raspunde("departments", "update", {
      data: { id: DEP, manager_employee_id: MANAGER },
    });
    server.raspunde("employees", "select", { data: { user_id: CONT_SEF } });
    server.raspunde("organization_members", "select", {
      data: { id: MEMBRU_SEF, role: "employee" },
    });
    server.raspunde("organization_members", "select", { count: 1 });
    server.raspunde("organization_members", "update", {
      data: { id: MEMBRU_SEF, role: "manager" },
    });

    const r = await reactiveazaDepartament({ id: DEP });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("organization_members", "update")[0]?.payload).toEqual({
      role: "manager",
    });
  });
});

// ── mutaAngajati ───────────────────────────────────────────────────────────

describe("mutaAngajati", () => {
  it("cere `employees:update` la `all`, ca pagina: `team` nu ajunge", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "employees:update": "team" },
    });
    const r = await mutaAngajati({ employee_ids: [ANGAJAT_A], department_id: DEP });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("nici `departments:update = all` nu deschide mutarea persoanelor", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    const r = await mutaAngajati({ employee_ids: [ANGAJAT_A], department_id: DEP });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("verifică departamentul-țintă în organizație, apoi mută lotul cu `.select()` numărat", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: MUTARE_PERSOANE });
    server.raspunde("departments", "select", { data: { id: DEP, activ: true } });
    server.raspunde("employees", "update", { data: [{ id: ANGAJAT_A }, { id: ANGAJAT_B }] });

    const r = await mutaAngajati({ employee_ids: [ANGAJAT_A, ANGAJAT_B], department_id: DEP });

    expect(r).toEqual({ ok: true, data: { mutati: 2 } });
    const [tinta] = server.apeluriPe("departments", "select");
    expect(areFiltru(tinta, "eq", "id", DEP)).toBe(true);
    expect(areFiltru(tinta, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(tinta, "is", "deleted_at", null)).toBe(true);

    const [apel] = server.apeluriPe("employees", "update");
    expect(apel?.payload).toEqual({ department_id: DEP, updated_by: USER_ID });
    expect(areFiltru(apel, "in", "id", [ANGAJAT_A, ANGAJAT_B])).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/departamente", "/angajati", "/organigrama"]);
  });

  it("scoaterea din departament (`null`) nu citește niciun departament", async () => {
    const { server } = configureazaActiunea({ permisiuni: MUTARE_PERSOANE });
    server.raspunde("employees", "update", { data: [{ id: ANGAJAT_A }] });
    const r = await mutaAngajati({ employee_ids: [ANGAJAT_A], department_id: null });
    expect(r).toEqual({ ok: true, data: { mutati: 1 } });
    expect(server.apeluriPe("departments")).toHaveLength(0);
    expect(server.apeluriPe("employees", "update")[0]?.payload).toMatchObject({
      department_id: null,
    });
  });

  it("id-urile duplicate se deduplică: o scriere reușită nu e raportată drept refuz parțial", async () => {
    const { server } = configureazaActiunea({ permisiuni: MUTARE_PERSOANE });
    server.raspunde("employees", "update", { data: [{ id: ANGAJAT_A }] });
    const r = await mutaAngajati({ employee_ids: [ANGAJAT_A, ANGAJAT_A], department_id: null });
    expect(r).toEqual({ ok: true, data: { mutati: 1 } });
    expect(areFiltru(server.apeluriPe("employees")[0], "in", "id", [ANGAJAT_A])).toBe(true);
  });

  it("departamentul-țintă din altă firmă sau șters: NEGASIT, nimeni nu e mutat", async () => {
    const { server } = configureazaActiunea({ permisiuni: MUTARE_PERSOANE });
    server.raspunde("departments", "select", { data: null });
    const r = await mutaAngajati({ employee_ids: [ANGAJAT_A], department_id: DEP });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "NEGASIT", message: "Departamentul selectat nu a fost găsit." },
    });
    expect(server.apeluriPe("employees")).toHaveLength(0);
  });

  it("departamentul-țintă dezactivat nu primește oameni: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MUTARE_PERSOANE });
    server.raspunde("departments", "select", { data: { id: DEP, activ: false } });
    const r = await mutaAngajati({ employee_ids: [ANGAJAT_A], department_id: DEP });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("dezactivat");
    expect(server.apeluriPe("employees")).toHaveLength(0);
  });

  it("refuz parțial al politicii: CONFLICT care spune câți au fost mutați", async () => {
    const { server } = configureazaActiunea({ permisiuni: MUTARE_PERSOANE });
    server.raspunde("employees", "update", { data: [{ id: ANGAJAT_B }] });
    const r = await mutaAngajati({ employee_ids: [ANGAJAT_A, ANGAJAT_B], department_id: null });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toMatch(/^Au fost mutate 1 din 2 persoane\./u);
    expect(caiRevalidate()).toEqual([]);
  });

  it("refuz total (zero rânduri, `data` null): CONFLICT „0 din 1”", async () => {
    const { server } = configureazaActiunea({ permisiuni: MUTARE_PERSOANE });
    server.raspunde("employees", "update", { data: null });
    const r = await mutaAngajati({ employee_ids: [ANGAJAT_A], department_id: null });
    expect(r.ok ? "" : r.error.message).toContain("0 din 1");
  });

  it("lista goală: VALIDARE, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: MUTARE_PERSOANE });
    const r = await mutaAngajati({ employee_ids: [], department_id: null });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("employee_ids");
    expect(server.apeluri).toHaveLength(0);
  });

  it("auditul ține prima fișă ca entitate și lista întreagă în detalii", async () => {
    const { server } = configureazaActiunea({ permisiuni: MUTARE_PERSOANE });
    server.raspunde("employees", "update", { data: [{ id: ANGAJAT_A }, { id: ANGAJAT_B }] });
    await mutaAngajati({ employee_ids: [ANGAJAT_A, ANGAJAT_B], department_id: null });
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_id: ANGAJAT_A,
        p_after: { employee_ids: [ANGAJAT_A, ANGAJAT_B], department_id: null },
      }),
    ]);
  });
});
