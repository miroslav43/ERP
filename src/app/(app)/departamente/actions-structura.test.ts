// src/app/(app)/departamente/actions-structura.test.ts
//
// Crearea și actualizarea unui departament. Pe lângă rândul din `departments`,
// ambele scriu și pe `employees` (repartizarea managerului, subordonarea) și,
// pentru `org_admin`, pe `organization_members` (rolul șefului). Regulile pure
// sunt testate în `src/domain/departments/`; aici se verifică ce ajunge la bază.

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
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { actualizeazaDepartament, creeazaDepartament } from "./actions";

const CREARE = { "departments:create": "all" } as const;
const EDITARE = { "departments:update": "all" } as const;

/** Departamentul nou / editat. */
const DEP = ID_1;
/** Managerul ales. */
const MANAGER = ID_2;
/** Departamentul în care e managerul acum, altul decât `DEP`. */
const ALT_DEP = ID_3;
const PARINTE = "88888888-8888-4888-8888-888888888888";
const SEF_SUS = "99999999-9999-4999-8999-999999999999";
const MEMBRU_SEF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONT_SEF = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ANGAJAT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ANGAJAT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const REVALIDARE = ["/departamente", "/angajati", "/organigrama"];

/**
 * Citirile lui `aplicaSubordonarea`: fișa șefului, apoi membrii departamentului.
 *
 * Ordinea e cea în care falsul le consumă, nu cea din sursă: cele trei citiri
 * pleacă într-un `Promise.all`, iar fișa e un lanț terminat cu `.maybeSingle()`,
 * pe când membrii se citesc dintr-o funcție `async` care ajunge la `await` abia
 * după ce s-a construit tot tabloul.
 */
function programeazaSubordonarea(
  server: ReturnType<typeof configureazaActiunea>["server"],
  membri: readonly { id: string; manager_employee_id: string | null }[],
): void {
  server.raspunde("employees", "select", {
    data: { manager_path: [MANAGER], manager_employee_id: null },
  });
  server.raspunde("employees", "select", { data: membri });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// ── creeazaDepartament ─────────────────────────────────────────────────────

describe("creeazaDepartament", () => {
  it("cere `departments:create` la `all`: `team` nu ajunge", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "departments:create": "team" },
    });
    const r = await creeazaDepartament({ denumire: "Producție" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără manager: un singur INSERT, în organizația din sesiune, cu `path` din RETURNING", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("departments", "insert", { data: { id: DEP, path: [DEP] } });

    const r = await creeazaDepartament({
      cod: "  ",
      denumire: " Producție ",
      parent_id: "",
      muta_managerul_in_departament: "on",
    });

    expect(r).toEqual({ ok: true, data: { id: DEP } });
    expect(server.apeluri).toHaveLength(1);
    const [apel] = server.apeluriPe("departments", "insert");
    expect(apel?.payload).toEqual({
      // Codul gol devine NULL, nu șir vid: indexul unic pe `lower(cod)` ar
      // ciocni două departamente fără cod.
      cod: null,
      denumire: "Producție",
      descriere: null,
      parent_id: null,
      manager_employee_id: null,
      cost_center: null,
      organization_id: ORG_ID,
      activ: true,
      path: [],
      depth: 0,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    // Consimțământul nu e coloană: în payload ar da PGRST204.
    expect(apel?.payload).not.toHaveProperty("muta_managerul_in_departament");
    expect(apel?.selectDupaScriere).toBe("id, path");
    expect(caiRevalidate()).toEqual(REVALIDARE);
  });

  it("auditul reține consimțământul pentru mutarea managerului", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("departments", "insert", { data: { id: DEP, path: [DEP] } });
    await creeazaDepartament({ denumire: "Producție", muta_managerul_in_departament: true });
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_id: DEP,
        p_after: expect.objectContaining({ muta_managerul_in_departament: true }),
      }),
    ]);
  });

  it("managerul nerepartizat e mutat tăcut în departamentul nou (nu pleacă de nicăieri)", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("employees", "select", { data: { department_id: null } });
    server.raspunde("departments", "insert", { data: { id: DEP, path: [DEP] } });
    server.raspunde("employees", "update", { data: { id: MANAGER } });
    programeazaSubordonarea(server, [{ id: MANAGER, manager_employee_id: null }]);

    const r = await creeazaDepartament({ denumire: "Producție", manager_employee_id: MANAGER });

    expect(r).toEqual({ ok: true, data: { id: DEP } });
    const [citire] = server.apeluriPe("employees", "select");
    expect(areFiltru(citire, "eq", "id", MANAGER)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [repartizare, ...altele] = server.apeluriPe("employees", "update");
    expect(altele).toHaveLength(0);
    expect(repartizare?.payload).toEqual({ department_id: DEP, updated_by: USER_ID });
    expect(areFiltru(repartizare, "eq", "id", MANAGER)).toBe(true);
    expect(areFiltru(repartizare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(repartizare?.selectDupaScriere).toBeDefined();
    // `hr` nu poate scrie roluri: nici nu se încearcă.
    expect(server.apeluriPe("organization_members")).toHaveLength(0);
  });

  it("managerul din ALT departament, fără bifa de mutare: rămâne unde e", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("employees", "select", { data: { department_id: ALT_DEP } });
    server.raspunde("departments", "insert", { data: { id: DEP, path: [DEP] } });
    programeazaSubordonarea(server, []);

    const r = await creeazaDepartament({ denumire: "Producție", manager_employee_id: MANAGER });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("employees", "update")).toHaveLength(0);
  });

  it("șeful e ridicat sub șeful departamentului de DEASUPRA, înaintea legării membrilor", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("employees", "select", { data: { department_id: ALT_DEP } });
    server.raspunde("departments", "insert", { data: { id: DEP, path: [PARINTE, DEP] } });
    programeazaSubordonarea(server, []);
    server.raspunde("departments", "select", {
      data: [{ id: PARINTE, manager_employee_id: SEF_SUS }],
    });
    server.raspunde("employees", "select", { data: { manager_path: [SEF_SUS] } });
    server.raspunde("employees", "update", { data: [{ id: MANAGER }] });

    const r = await creeazaDepartament({
      denumire: "Producție",
      parent_id: PARINTE,
      manager_employee_id: MANAGER,
    });

    expect(r.ok).toBe(true);
    const [stramosi] = server.apeluriPe("departments", "select");
    expect(areFiltru(stramosi, "in", "id", [PARINTE])).toBe(true);
    expect(areFiltru(stramosi, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(stramosi, "eq", "activ", true)).toBe(true);
    const [ridicare] = server.apeluriPe("employees", "update");
    expect(ridicare?.payload).toEqual({ manager_employee_id: SEF_SUS, updated_by: USER_ID });
    expect(areFiltru(ridicare, "in", "id", [MANAGER])).toBe(true);
    expect(areFiltru(ridicare, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("`org_admin` desemnând un `employee` ca șef: îi dă rolul de manager", async () => {
    const { server } = configureazaActiunea({ rol: "org_admin", permisiuni: CREARE });
    server.raspunde("employees", "select", { data: { department_id: ALT_DEP } });
    server.raspunde("departments", "insert", { data: { id: DEP, path: [DEP] } });
    // citesteSeful(manager): fișa, apoi apartenența.
    server.raspunde("employees", "select", { data: { user_id: CONT_SEF } });
    server.raspunde("organization_members", "select", {
      data: { id: MEMBRU_SEF, role: "employee" },
    });
    // schimbaRolul: rămâne măcar un administrator.
    server.raspunde("organization_members", "select", { count: 1 });
    server.raspunde("organization_members", "update", {
      data: { id: MEMBRU_SEF, role: "manager" },
    });
    programeazaSubordonarea(server, []);

    const r = await creeazaDepartament({ denumire: "Producție", manager_employee_id: MANAGER });

    expect(r.ok).toBe(true);
    const [apartenenta] = server.apeluriPe("organization_members", "select");
    expect(areFiltru(apartenenta, "eq", "user_id", CONT_SEF)).toBe(true);
    expect(areFiltru(apartenenta, "eq", "organization_id", ORG_ID)).toBe(true);
    const [rol] = server.apeluriPe("organization_members", "update");
    expect(rol?.payload).toEqual({ role: "manager" });
    expect(areFiltru(rol, "eq", "id", MEMBRU_SEF)).toBe(true);
    expect(areFiltru(rol, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(rol?.selectDupaScriere).toBeDefined();
  });

  it("managerul ales a fost șters între timp: NEGASIT, departamentul NU se creează", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("employees", "select", { data: null });
    const r = await creeazaDepartament({ denumire: "Producție", manager_employee_id: MANAGER });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "NEGASIT", message: "Angajatul ales ca manager nu a fost găsit." },
    });
    expect(server.apeluriPe("departments")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("repartizarea managerului refuzată tăcut: mesajul spune că departamentul E creat", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("employees", "select", { data: { department_id: null } });
    server.raspunde("departments", "insert", { data: { id: DEP, path: [DEP] } });
    server.raspunde("employees", "update", { data: null });
    const r = await creeazaDepartament({ denumire: "Producție", manager_employee_id: MANAGER });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toMatch(/^Departamentul a fost creat, dar managerul/u);
  });

  it("denumirea sub 2 caractere: VALIDARE pe `denumire`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await creeazaDepartament({ denumire: " P " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("denumire");
    expect(server.apeluri).toHaveLength(0);
  });

  it("codul duplicat (23505) se raportează CONFLICT, nu „eroare neașteptată”", async () => {
    // `throw mapPostgrestError(...)` aruncă un obiect `ActionError` simplu —
    // nici `ActionDenied`, nici eroare PostgREST (n-are `details`) — deci
    // `createAction` îl transformă în EROARE_INTERNA.
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("departments", "insert", {
      error: eroarePostgrest("23505", "dup", "departments_org_cod_uniq"),
    });
    const r = await creeazaDepartament({ cod: "PRD", denumire: "Producție" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

// ── actualizeazaDepartament ────────────────────────────────────────────────

describe("actualizeazaDepartament", () => {
  const baza = { id: DEP, denumire: "Producție", cod: "prd" };

  it("cere `departments:update` la `all`; `create` singur nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await actualizeazaDepartament(baza);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cere `departments:update` la `all`: `team` nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "departments:update": "team" } });
    const r = await actualizeazaDepartament(baza);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("citește șeful de DINAINTE, apoi UPDATE pe id + organizație + nesters, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("departments", "select", { data: { manager_employee_id: null } });
    server.raspunde("departments", "update", {
      data: { id: DEP, activ: true, parent_id: null, path: [DEP] },
    });

    const r = await actualizeazaDepartament({ ...baza, muta_managerul_in_departament: true });

    expect(r).toEqual({ ok: true, data: { id: DEP } });
    const [inainte] = server.apeluriPe("departments", "select");
    expect(areFiltru(inainte, "eq", "id", DEP)).toBe(true);
    expect(areFiltru(inainte, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(inainte, "is", "deleted_at", null)).toBe(true);

    const [scriere] = server.apeluriPe("departments", "update");
    expect(scriere?.payload).toEqual({
      cod: "prd",
      denumire: "Producție",
      descriere: null,
      parent_id: null,
      manager_employee_id: null,
      cost_center: null,
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "id", DEP)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toContain("activ");
    // Ordinea: citirea de dinainte precede scrierea.
    expect(server.apeluri.map((a) => a.operatie)).toEqual(["select", "update"]);
    expect(caiRevalidate()).toEqual(REVALIDARE);
  });

  it("zero rânduri (șters sau refuzat de USING): NEGASIT, fără scrieri pe fișe", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("departments", "select", { data: { manager_employee_id: null } });
    server.raspunde("departments", "update", { data: null });
    const r = await actualizeazaDepartament(baza);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "NEGASIT", message: "Departamentul nu a fost găsit." },
    });
    expect(server.apeluriPe("employees")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("aceeași persoană rămâne șef (redenumire): nicio scriere pe subordonare sau roluri", async () => {
    const { server } = configureazaActiunea({ rol: "org_admin", permisiuni: EDITARE });
    server.raspunde("employees", "select", { data: { department_id: DEP } });
    server.raspunde("departments", "select", { data: { manager_employee_id: MANAGER } });
    server.raspunde("departments", "update", {
      data: { id: DEP, activ: true, parent_id: null, path: [DEP] },
    });

    const r = await actualizeazaDepartament({ ...baza, manager_employee_id: MANAGER });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("employees", "update")).toHaveLength(0);
    expect(server.apeluriPe("organization_members")).toHaveLength(0);
  });

  it("departament dezactivat: managerul din alt departament NU e mutat în el, nici cu bifa", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("employees", "select", { data: { department_id: ALT_DEP } });
    server.raspunde("departments", "select", { data: { manager_employee_id: MANAGER } });
    server.raspunde("departments", "update", {
      data: { id: DEP, activ: false, parent_id: null, path: [DEP] },
    });
    const r = await actualizeazaDepartament({
      ...baza,
      manager_employee_id: MANAGER,
      muta_managerul_in_departament: true,
    });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("employees", "update")).toHaveLength(0);
  });

  it("managerul șters din departament: subordonații lui directi urcă la șeful de deasupra", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("departments", "select", { data: { manager_employee_id: MANAGER } });
    server.raspunde("departments", "update", {
      data: { id: DEP, activ: true, parent_id: PARINTE, path: [PARINTE, DEP] },
    });
    // elibereazaSubordonarea: membrii, apoi strămoșii și fișa șefului de sus.
    server.raspunde("employees", "select", {
      data: [
        { id: ANGAJAT_A, manager_employee_id: MANAGER },
        { id: ANGAJAT_B, manager_employee_id: SEF_SUS },
      ],
    });
    server.raspunde("departments", "select", {
      data: [{ id: PARINTE, manager_employee_id: SEF_SUS }],
    });
    server.raspunde("employees", "select", { data: { manager_path: [SEF_SUS] } });
    server.raspunde("employees", "update", { data: [{ id: ANGAJAT_A }] });

    const r = await actualizeazaDepartament({ ...baza, manager_employee_id: "" });

    expect(r).toEqual({ ok: true, data: { id: DEP } });
    const [eliberare, ...altele] = server.apeluriPe("employees", "update");
    expect(altele).toHaveLength(0);
    // Doar cel legat de fostul șef; cel care atârnă de altcineva nu se atinge.
    expect(areFiltru(eliberare, "in", "id", [ANGAJAT_A])).toBe(true);
    expect(eliberare?.payload).toEqual({ manager_employee_id: SEF_SUS, updated_by: USER_ID });
    expect(areFiltru(eliberare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(eliberare?.selectDupaScriere).toBeDefined();
  });

  it("eliberarea refuzată parțial: CONFLICT cu cifrele, nu „a eșuat”", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: EDITARE });
    server.raspunde("departments", "select", { data: { manager_employee_id: MANAGER } });
    server.raspunde("departments", "update", {
      data: { id: DEP, activ: true, parent_id: null, path: [DEP] },
    });
    server.raspunde("employees", "select", {
      data: [
        { id: ANGAJAT_A, manager_employee_id: MANAGER },
        { id: ANGAJAT_B, manager_employee_id: MANAGER },
      ],
    });
    server.raspunde("employees", "update", { data: [{ id: ANGAJAT_A }] });

    const r = await actualizeazaDepartament(baza);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("Departamentul a fost salvat");
    expect(r.ok ? "" : r.error.message).toContain("1 din 2");
  });

  it("`org_admin` înlocuiește un șef manager care nu mai conduce nimic: îl retrogradează", async () => {
    const { server } = configureazaActiunea({ rol: "org_admin", permisiuni: EDITARE });
    server.raspunde("departments", "select", { data: { manager_employee_id: MANAGER } });
    server.raspunde("departments", "update", {
      data: { id: DEP, activ: true, parent_id: null, path: [DEP] },
    });
    server.raspunde("employees", "select", { data: { user_id: CONT_SEF } });
    server.raspunde("organization_members", "select", {
      data: { id: MEMBRU_SEF, role: "manager" },
    });
    // maiConduceAltDepartament: zero alte departamente active.
    server.raspunde("departments", "select", { count: 0 });
    server.raspunde("organization_members", "select", { count: 1 });
    server.raspunde("organization_members", "update", {
      data: { id: MEMBRU_SEF, role: "employee" },
    });
    server.raspunde("employees", "select", { data: [] });

    const r = await actualizeazaDepartament(baza);

    expect(r.ok).toBe(true);
    const [, alteDepartamente] = server.apeluriPe("departments", "select");
    expect(areFiltru(alteDepartamente, "eq", "manager_employee_id", MANAGER)).toBe(true);
    expect(areFiltru(alteDepartamente, "neq", "id", DEP)).toBe(true);
    expect(areFiltru(alteDepartamente, "eq", "activ", true)).toBe(true);
    const [rol] = server.apeluriPe("organization_members", "update");
    expect(rol?.payload).toEqual({ role: "employee" });
    expect(areFiltru(rol, "eq", "id", MEMBRU_SEF)).toBe(true);
  });
});
