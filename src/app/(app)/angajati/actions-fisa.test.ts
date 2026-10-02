// src/app/(app)/angajati/actions-fisa.test.ts
//
// Acțiunile pe FIȘA angajatului din `./actions.ts`: editarea, încadrarea și
// desemnarea ca șef de departament. Invitația și ștergerea sunt în
// `actions-invitatie-stergere.test.ts`, contractele în `actions-contract.test.ts`. Straturile comune ale lui
// `createAction` sunt verificate în testul canonic (`salarizare/actions.test.ts`).

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

// Mecanismul de șef (roluri + subordonare) are propriile interogări; aici se
// verifică doar CE îi cere acțiunea și când.
const sef = vi.hoisted(() => ({
  decideSchimbareaSefului: vi.fn(),
  aplicaRolurile: vi.fn(),
  aplicaSubordonarea: vi.fn(),
  elibereazaSubordonarea: vi.fn(),
}));
vi.mock("@/lib/departamente/sef", () => sef);

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
import { actualizeazaAngajat, actualizeazaIncadrarea, desemneazaSefDepartament } from "./actions";

const CNP = "1960101010109";
const IBAN = "RO49AAAA1B31007593840000";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const f of Object.values(sef)) f.mockReset();
  sef.decideSchimbareaSefului.mockResolvedValue({ decizie: "falsa" });
});

// ── actualizeazaAngajat ──────────────────────────────────────────────────────

describe("actualizeazaAngajat", () => {
  const PERMIS = { "employees:update": "team" } as const;
  const intrare = { id: ID_1, last_name: "Popescu", first_name: "Ion", telefon: "0722000000" };

  it("employees:update sub `team` (own): INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:update": "own" } });
    const r = await actualizeazaAngajat(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: UPDATE pe id + organizație + nesters, cu `.select()` după, fără id și fără date sensibile în payload", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "update", { data: { id: ID_1 } });

    const r = await actualizeazaAngajat(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("employees", "update");
    const payload = apel?.payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      last_name: "Popescu",
      first_name: "Ion",
      telefon: "0722000000",
      updated_by: USER_ID,
    });
    for (const cheie of ["id", "cnp", "iban", "banca", "full_name"]) {
      expect(payload).not.toHaveProperty(cheie);
    }
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    // Fără valori sensibile noi, RPC-ul de criptare nu se cheamă deloc.
    expect(server.apeluriRpc.filter((a) => a.nume === "hr_write_sensitive")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(["/angajati", `/angajati/${ID_1}`]);
  });

  it("CNP și IBAN noi: trec CRIPTATE prin `hr_write_sensitive`, niciodată în clar", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "update", { data: { id: ID_1 } });
    server.raspundeRpc("hr_write_sensitive", { data: null });

    const r = await actualizeazaAngajat({ ...intrare, cnp: CNP, iban: IBAN, banca: "BT" });

    expect(r.ok).toBe(true);
    const apel = server.apeluriRpc.find((a) => a.nume === "hr_write_sensitive");
    const argumente = apel?.argumente as Record<string, unknown>;
    expect(argumente).toMatchObject({
      p_employee: ID_1,
      p_cnp_last4: "0109",
      p_iban_last4: "0000",
      p_banca: "BT",
    });
    expect(JSON.stringify(argumente)).not.toContain(CNP);
    expect(JSON.stringify(argumente)).not.toContain(IBAN);
    expect(String(argumente["p_cnp_ciphertext"])).toMatch(/^\\x[0-9a-f]+$/u);
    // Tabela cu criptotext nu se atinge direct: grantul a fost revocat în 0005.
    expect(server.apeluriPe("employee_sensitive_data")).toHaveLength(0);
  });

  it("doar banca: RPC-ul primește doar banca, fără chei de CNP sau IBAN", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "update", { data: { id: ID_1 } });
    server.raspundeRpc("hr_write_sensitive", { data: null });

    await actualizeazaAngajat({ ...intrare, banca: "ING" });

    const apel = server.apeluriRpc.find((a) => a.nume === "hr_write_sensitive");
    expect(apel?.argumente).toEqual({ p_employee: ID_1, p_banca: "ING" });
  });

  it("zero rânduri (fișă din afara echipei sau ștearsă): NEGASIT, iar datele sensibile nu se scriu", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "update", { data: null });

    const r = await actualizeazaAngajat({ ...intrare, cnp: CNP });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriRpc.filter((a) => a.nume === "hr_write_sensitive")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("CNP invalid: VALIDARE pe câmpul `cnp`, fără nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await actualizeazaAngajat({ ...intrare, cnp: "1234567890123" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("cnp");
    expect(server.apeluri).toHaveLength(0);
  });
});

// ── actualizeazaIncadrarea ───────────────────────────────────────────────────

describe("actualizeazaIncadrarea", () => {
  const PERMIS = { "employees:update": "all" } as const;
  const intrare = {
    employee_id: ID_1,
    functie: "Sudor MAG",
    cod_cor: null,
    department_id: ID_2,
    manager_employee_id: ID_3,
  };

  function programeazaVerificari(server: ReturnType<typeof configureazaActiunea>["server"]) {
    server.raspunde("departments", "select", {
      data: { id: ID_2, denumire: "Producție", activ: true },
    });
    server.raspunde("employees", "select", {
      data: { id: ID_3, full_name: "Maria Ionescu", manager_path: [ID_3] },
    });
  }

  it("employees:update sub `all` (team): INTERZIS — spre deosebire de editarea completă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:update": "team" } });
    const r = await actualizeazaIncadrarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: verifică departamentul și managerul în organizație, apoi scrie exact cele patru câmpuri", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaVerificari(server);
    server.raspunde("employees", "update", { data: { id: ID_1 } });

    const r = await actualizeazaIncadrarea(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [departament] = server.apeluriPe("departments");
    expect(areFiltru(departament, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(departament, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(departament, "is", "deleted_at", null)).toBe(true);
    const [manager] = server.apeluriPe("employees", "select");
    expect(areFiltru(manager, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(manager, "eq", "organization_id", ORG_ID)).toBe(true);
    // Un angajat șters logic nu poate deveni manager.
    expect(areFiltru(manager, "is", "deleted_at", null)).toBe(true);
    const [update] = server.apeluriPe("employees", "update");
    expect(update?.payload).toEqual({
      functie: "Sudor MAG",
      cod_cor: null,
      department_id: ID_2,
      manager_employee_id: ID_3,
      updated_by: USER_ID,
    });
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/angajati", "/organigrama"]);
  });

  it("managerul golit intră în jurnalul de audit, alături de celelalte trei câmpuri", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "update", { data: { id: ID_1 } });
    await actualizeazaIncadrarea({ ...intrare, department_id: null, manager_employee_id: null });
    await asteaptaDupa();
    const [succes] = server.audituri().filter((a) => a["p_status"] === "success");
    expect(succes?.["p_after"]).toMatchObject({ manager_employee_id: null, employee_id: ID_1 });
  });

  it("fără departament și fără manager: nicio verificare, doar UPDATE-ul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "update", { data: { id: ID_1 } });
    const r = await actualizeazaIncadrarea({
      ...intrare,
      department_id: null,
      manager_employee_id: null,
    });
    expect(r.ok).toBe(true);
    expect(server.apeluri.map((a) => `${a.tabela}:${a.operatie}`)).toEqual(["employees:update"]);
  });

  it("departament inexistent în organizație: NEGASIT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("departments", "select", { data: null });
    const r = await actualizeazaIncadrarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("employees", "update")).toHaveLength(0);
  });

  it("departament dezactivat: CONFLICT care îl numește, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("departments", "select", {
      data: { id: ID_2, denumire: "Depozit vechi", activ: false },
    });
    const r = await actualizeazaIncadrarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("Depozit vechi");
    expect(server.apeluriPe("employees")).toHaveLength(0);
  });

  it("manager inexistent: NEGASIT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: null });
    const r = await actualizeazaIncadrarea({ ...intrare, department_id: null });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("employees", "update")).toHaveLength(0);
  });

  it("ciclu: managerul ales e deja în subordinea angajatului ⇒ CONFLICT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", {
      data: { id: ID_3, full_name: "Maria Ionescu", manager_path: [ID_1, ID_3] },
    });
    const r = await actualizeazaIncadrarea({ ...intrare, department_id: null });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("Maria Ionescu");
    expect(server.apeluriPe("employees", "update")).toHaveLength(0);
  });

  it("propriul manager: VALIDARE pe `manager_employee_id`, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await actualizeazaIncadrarea({ ...intrare, manager_employee_id: ID_1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("manager_employee_id");
    expect(server.apeluri).toHaveLength(0);
  });

  it("zero rânduri la UPDATE (respins de USING): NEGASIT, nu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaVerificari(server);
    server.raspunde("employees", "update", { data: null });
    const r = await actualizeazaIncadrarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it.fails(
    "DEFECT: P0001 din `tg_employees_manager_path` (lanț peste 12 niveluri), tradus cu `mapPostgrestError` și aruncat ca obiect simplu, iese EROARE_INTERNA, nu CONFLICT",
    async () => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS });
      programeazaVerificari(server);
      server.raspunde("employees", "update", { error: eroarePostgrest("P0001") });
      const r = await actualizeazaIncadrarea(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    },
  );
});

// ── desemneazaSefDepartament ─────────────────────────────────────────────────

describe("desemneazaSefDepartament", () => {
  const PERMIS = { "departments:update": "all" } as const;
  const SEF_VECHI = ID_3;
  const CALE = [ID_2];

  function programeaza(
    server: ReturnType<typeof configureazaActiunea>["server"],
    sefCurent: string | null,
  ) {
    server.raspunde("employees", "select", {
      data: { id: ID_1, full_name: "Ion Popescu", department_id: ID_2 },
    });
    server.raspunde("departments", "select", {
      data: { id: ID_2, parent_id: null, manager_employee_id: sefCurent, path: CALE },
    });
  }

  it("departments:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "departments:update": "team" } });
    const r = await desemneazaSefDepartament({ employee_id: ID_1, department_id: ID_2, sef: true });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes (org_admin): scrie șeful, decide rolurile și mută subordonarea de pe fostul șef", async () => {
    const { server } = configureazaActiunea({ rol: "org_admin", permisiuni: PERMIS });
    programeaza(server, SEF_VECHI);
    server.raspunde("departments", "update", { data: { id: ID_2 } });

    const r = await desemneazaSefDepartament({ employee_id: ID_1, department_id: ID_2, sef: true });

    expect(r).toEqual({ ok: true, data: { id: ID_2, rolAcordat: true } });
    // Fișa citită e a organizației și vie; departamentul citit „înainte” la fel.
    const [fisa] = server.apeluriPe("employees", "select");
    expect(areFiltru(fisa, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
    const [inainte] = server.apeluriPe("departments", "select");
    expect(areFiltru(inainte, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(inainte, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(inainte, "is", "deleted_at", null)).toBe(true);
    const [update] = server.apeluriPe("departments", "update");
    expect(update?.payload).toEqual({ manager_employee_id: ID_1, updated_by: USER_ID });
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();

    const [context, parametri] = sef.decideSchimbareaSefului.mock.calls[0] ?? [];
    expect(context).toMatchObject({
      organizationId: ORG_ID,
      userId: USER_ID,
      memberIdAutor: MEMBER_ID,
      autorEsteAdministrator: true,
    });
    expect(parametri).toEqual({ sefAnteriorId: SEF_VECHI, sefNouId: ID_1, departamentId: ID_2 });
    expect(sef.aplicaRolurile.mock.calls[0]?.[1]).toEqual({ decizie: "falsa" });
    expect(sef.aplicaSubordonarea.mock.calls[0]?.[1]).toEqual({
      departamentId: ID_2,
      sefId: ID_1,
      sefAnteriorId: SEF_VECHI,
      caleaDepartamentului: CALE,
    });
    expect(sef.elibereazaSubordonarea).not.toHaveBeenCalled();
    expect(caiRevalidate()).toEqual(["/angajati", "/departamente", "/organigrama"]);
  });

  it("autor `hr`: structura se scrie, dar rolul NU se acordă — semnal, nu eroare", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: PERMIS });
    programeaza(server, null);
    server.raspunde("departments", "update", { data: { id: ID_2 } });

    const r = await desemneazaSefDepartament({ employee_id: ID_1, department_id: ID_2, sef: true });

    expect(r).toEqual({ ok: true, data: { id: ID_2, rolAcordat: false } });
    expect(sef.decideSchimbareaSefului.mock.calls[0]?.[0]).toMatchObject({
      autorEsteAdministrator: false,
    });
    expect(sef.aplicaSubordonarea).toHaveBeenCalledTimes(1);
  });

  it("debifare când șeful e chiar el: golește coloana și desface subordonarea", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, ID_1);
    server.raspunde("departments", "update", { data: { id: ID_2 } });

    const r = await desemneazaSefDepartament({
      employee_id: ID_1,
      department_id: ID_2,
      sef: false,
    });

    expect(r.ok).toBe(true);
    const [update] = server.apeluriPe("departments", "update");
    expect(update?.payload).toEqual({ manager_employee_id: null, updated_by: USER_ID });
    expect(sef.elibereazaSubordonarea.mock.calls[0]?.[1]).toEqual({
      departamentId: ID_2,
      sefAnteriorId: ID_1,
      caleaDepartamentului: CALE,
    });
    expect(sef.aplicaSubordonarea).not.toHaveBeenCalled();
  });

  it("debifare când șef e ALTCINEVA: nu-l demite, nu scrie nimic", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, SEF_VECHI);

    const r = await desemneazaSefDepartament({
      employee_id: ID_1,
      department_id: ID_2,
      sef: false,
    });

    expect(r).toEqual({ ok: true, data: { id: ID_2, rolAcordat: false } });
    expect(server.apeluriPe("departments", "update")).toHaveLength(0);
    expect(sef.aplicaRolurile).not.toHaveBeenCalled();
    expect(sef.elibereazaSubordonarea).not.toHaveBeenCalled();
  });

  it("re-bifare când e deja șef: nicio mutare de subordonare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, ID_1);
    server.raspunde("departments", "update", { data: { id: ID_2 } });
    await desemneazaSefDepartament({ employee_id: ID_1, department_id: ID_2, sef: true });
    expect(sef.aplicaSubordonarea).not.toHaveBeenCalled();
    expect(sef.elibereazaSubordonarea).not.toHaveBeenCalled();
  });

  it("angajatul nu mai e în departament: CONFLICT, departamentul nici nu se citește", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", {
      data: { id: ID_1, full_name: "Ion Popescu", department_id: ID_3 },
    });
    const r = await desemneazaSefDepartament({ employee_id: ID_1, department_id: ID_2, sef: true });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("departments")).toHaveLength(0);
  });

  it("fișă inexistentă: NEGASIT; filtrul pe organizație e pus pe citirea fișei", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: null });
    const r = await desemneazaSefDepartament({ employee_id: ID_1, department_id: ID_2, sef: true });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(areFiltru(server.apeluriPe("employees")[0], "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("departament inexistent: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", {
      data: { id: ID_1, full_name: "Ion Popescu", department_id: ID_2 },
    });
    server.raspunde("departments", "select", { data: null });
    const r = await desemneazaSefDepartament({ employee_id: ID_1, department_id: ID_2, sef: true });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("zero rânduri la UPDATE: NEGASIT, iar rolurile și subordonarea nu se ating", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, SEF_VECHI);
    server.raspunde("departments", "update", { data: null });
    const r = await desemneazaSefDepartament({ employee_id: ID_1, department_id: ID_2, sef: true });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(sef.aplicaRolurile).not.toHaveBeenCalled();
    expect(sef.aplicaSubordonarea).not.toHaveBeenCalled();
  });
});
