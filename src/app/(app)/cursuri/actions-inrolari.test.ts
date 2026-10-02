// src/app/(app)/cursuri/actions-inrolari.test.ts
//
// Înrolările (atribuire manuală, anulare), testul grilă și regulile de
// atribuire automată — inclusiv aplicarea imediată, care reproduce în acțiune
// selecția jobului de noapte.

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
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import {
  anuleazaInrolare,
  aplicaRegulile,
  atribuieCurs,
  creeazaRegula,
  salveazaTest,
  stergeRegula,
} from "./actions";

const RUTE = ["/cursuri", "/portal/cursurile-mele", "/portal"];
const CREARE = { "courses:create": "team" } as const;
const MODIFICARE = { "courses:update": "team" } as const;
const CURS = "88888888-8888-4888-8888-888888888888";
const DEP = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("atribuieCurs", () => {
  it("câte un INSERT pe persoană, cu motivul `manual`, termenul omis când lipsește", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: CREARE });
    server.raspunde("course_enrollments", "insert", {});
    server.raspunde("course_enrollments", "insert", {});

    const r = await atribuieCurs({ course_id: CURS, employee_ids: [ID_1, ID_2] });

    expect(r).toEqual({ ok: true, data: { atribuite: 2, esuate: 0 } });
    expect(server.apeluriPe("course_enrollments", "insert").map((a) => a.payload)).toEqual([
      { organization_id: ORG_ID, course_id: CURS, employee_id: ID_1, motiv: "manual" },
      { organization_id: ORG_ID, course_id: CURS, employee_id: ID_2, motiv: "manual" },
    ]);
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("termenul dat se scrie pe fiecare înrolare", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_enrollments", "insert", {});

    await atribuieCurs({ course_id: CURS, employee_ids: [ID_1], termen: "2026-11-30" });

    expect(server.apeluriPe("course_enrollments", "insert")[0]?.payload).toMatchObject({
      termen: "2026-11-30",
    });
  });

  it("un eșec pe o persoană nu anulează restul: se numără separat", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_enrollments", "insert", { error: eroarePostgrest("23505") });
    server.raspunde("course_enrollments", "insert", {});
    server.raspunde("course_enrollments", "insert", { error: eroarePostgrest("P0001", "x") });

    const r = await atribuieCurs({ course_id: CURS, employee_ids: [ID_1, ID_2, ID_3] });

    expect(r).toEqual({ ok: true, data: { atribuite: 1, esuate: 2 } });
    expect(server.apeluriPe("course_enrollments", "insert")).toHaveLength(3);
  });

  it("nicio atribuire reușită (curs nepublicat sau fără lecții) ⇒ CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const mesaj = "Cursul «Instructaj SSM» nu are nicio lecție și nu poate fi atribuit.";
    server.raspunde("course_enrollments", "insert", { error: eroarePostgrest("P0001", mesaj) });
    server.raspunde("course_enrollments", "insert", { error: eroarePostgrest("P0001", mesaj) });

    const r = await atribuieCurs({ course_id: CURS, employee_ids: [ID_1, ID_2] });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Nicio atribuire") },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("peste 200 de persoane deodată ⇒ VALIDARE, fără nicio inserție", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await atribuieCurs({ course_id: CURS, employee_ids: Array(201).fill(ID_1) });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("anuleazaInrolare", () => {
  it("trece înrolarea în `anulat` cu motivul, pe id + organizație + nesters, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: MODIFICARE });
    server.raspunde("course_enrollments", "update", { data: { id: ID_1 } });

    const r = await anuleazaInrolare({ id: ID_1, motiv: "  A plecat din firmă " });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("course_enrollments", "update");
    expect(apel?.payload).toEqual({ status: "anulat", motiv_anulare: "A plecat din firmă" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("zero rânduri ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_enrollments", "update", { data: null });
    const r = await anuleazaInrolare({ id: ID_1, motiv: "A plecat din firmă" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("motivul sub 5 caractere ⇒ VALIDARE pe `motiv` (CHECK-ul coloanei)", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    const r = await anuleazaInrolare({ id: ID_1, motiv: "nu" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("motiv");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("salveazaTest", () => {
  const INTREBARI = [
    {
      id: "q1",
      text: "Ce faceți la incendiu?",
      optiuni: [
        { id: "a", text: "Fug" },
        { id: "b", text: "Sun la 112" },
      ],
      corect: "b",
    },
    {
      id: "q2",
      text: "Unde e stingătorul?",
      optiuni: [
        { id: "a", text: "Pe hol" },
        { id: "b", text: "Nu există" },
      ],
      corect: "a",
    },
  ];

  it("cheia pleacă în tabela ei, ÎNAINTEA întrebărilor; întrebările pleacă fără `corect`", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: MODIFICARE });
    server.raspunde("course_material_versions", "select", { data: { id: ID_1 } });
    server.raspunde("course_answer_keys", "upsert", {});
    server.raspunde("course_material_versions", "update", { data: { id: ID_1 } });

    const r = await salveazaTest({ version_id: ID_1, intrebari: INTREBARI });

    expect(r).toEqual({ ok: true, data: { id: ID_1, intrebari: 2 } });
    const tabele = server.apeluri.map((a) => `${a.tabela}:${a.operatie}`);
    expect(tabele).toEqual([
      "course_material_versions:select",
      "course_answer_keys:upsert",
      "course_material_versions:update",
    ]);

    const [versiune] = server.apeluriPe("course_material_versions", "select");
    expect(areFiltru(versiune, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(versiune, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(versiune, "is", "deleted_at", null)).toBe(true);

    const [cheie] = server.apeluriPe("course_answer_keys", "upsert");
    expect(cheie?.payload).toEqual({
      organization_id: ORG_ID,
      version_id: ID_1,
      chei: { q1: "b", q2: "a" },
    });
    expect(cheie?.optiuni).toEqual({ onConflict: "version_id" });

    const [update] = server.apeluriPe("course_material_versions", "update");
    expect(JSON.stringify(update?.payload)).not.toContain("corect");
    expect(update?.payload).toEqual({
      intrebari: INTREBARI.map(({ corect: _c, ...rest }) => rest),
    });
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("cheia de răspuns nu ajunge în jurnalul de audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_material_versions", "select", { data: { id: ID_1 } });
    server.raspunde("course_answer_keys", "upsert", {});
    server.raspunde("course_material_versions", "update", { data: { id: ID_1 } });

    await salveazaTest({ version_id: ID_1, intrebari: INTREBARI });
    await asteaptaDupa();

    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_after: { version_id: ID_1 } });
    expect(JSON.stringify(audit)).not.toContain("Sun la 112");
  });

  it("versiune inexistentă ⇒ NEGASIT, fără nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_material_versions", "select", { data: null });

    const r = await salveazaTest({ version_id: ID_1, intrebari: INTREBARI });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("course_answer_keys")).toHaveLength(0);
    expect(server.apeluriPe("course_material_versions", "update")).toHaveLength(0);
  });

  it("cheia refuzată ⇒ eroare, iar întrebările NU se scriu (n-ar exista test fără cheie)", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_material_versions", "select", { data: { id: ID_1 } });
    server.raspunde("course_answer_keys", "upsert", { error: eroarePostgrest("42501") });

    const r = await salveazaTest({ version_id: ID_1, intrebari: INTREBARI });

    expect(r.ok).toBe(false);
    expect(server.apeluriPe("course_material_versions", "update")).toHaveLength(0);
  });

  it("zero rânduri la scrierea întrebărilor ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_material_versions", "select", { data: { id: ID_1 } });
    server.raspunde("course_answer_keys", "upsert", {});
    server.raspunde("course_material_versions", "update", { data: null });
    const r = await salveazaTest({ version_id: ID_1, intrebari: INTREBARI });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it.each([
    ["varianta corectă lipsă dintre opțiuni", [{ ...INTREBARI[0], corect: "z" }]],
    ["identificatori de întrebare duplicați", [INTREBARI[0], { ...INTREBARI[1], id: "q1" }]],
    ["întrebare cu o singură variantă", [{ ...INTREBARI[0], optiuni: [{ id: "b", text: "x" }] }]],
  ])("%s ⇒ VALIDARE, fără nicio interogare", async (_caz, intrebari) => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    const r = await salveazaTest({ version_id: ID_1, intrebari });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("creeazaRegula", () => {
  it("INSERT cu exact o țintă potrivită criteriului, în organizația sesiunii", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: CREARE });
    server.raspunde("course_assignment_rules", "insert", { data: { id: ID_2 } });

    const r = await creeazaRegula({
      course_id: CURS,
      criteriu: "departament",
      department_id: DEP,
      decalaj_zile: "7",
      termen_zile: "",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("course_assignment_rules", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      course_id: CURS,
      criteriu: "departament",
      department_id: DEP,
      cod_cor: null,
      rol: null,
      employee_id: null,
      decalaj_zile: 7,
      termen_zile: null,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it.each([
    ["departament fără departament", { criteriu: "departament" }, "department_id"],
    ["„toți” cu un angajat-țintă", { criteriu: "toti", employee_id: ID_1 }, "employee_id"],
    ["rol fără rol", { criteriu: "rol" }, "rol"],
  ])("%s ⇒ VALIDARE pe câmpul țintei", async (_caz, intrare, camp) => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await creeazaRegula({ course_id: CURS, ...intrare });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
  });

  it("rând neîntors ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_assignment_rules", "insert", { data: null });
    const r = await creeazaRegula({ course_id: CURS, criteriu: "toti" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("stergeRegula", () => {
  it("ștergere logică și dezactivare, pe id + organizație + nesters, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_assignment_rules", "update", { data: { id: ID_1 } });

    const r = await stergeRegula({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("course_assignment_rules", "update");
    expect(apel?.payload).toEqual({ deleted_at: expect.any(String), activ: false });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("zero rânduri ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_assignment_rules", "update", { data: null });
    const r = await stergeRegula({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("aplicaRegulile", () => {
  type Regula = Readonly<{
    criteriu: string;
    department_id?: string | null;
    cod_cor?: string | null;
    rol?: string | null;
    employee_id?: string | null;
    decalaj_zile?: number;
    termen_zile?: number | null;
  }>;
  type Angajat = Readonly<{
    id: string;
    department_id?: string | null;
    cod_cor?: string | null;
    hired_on?: string | null;
    user_id?: string | null;
  }>;

  const U1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const U2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  /** Cele patru citiri paralele; data e fixată la 2 octombrie 2026. */
  function programeaza(
    server: ClientFals,
    reguli: readonly Regula[],
    angajati: readonly Angajat[],
    membri: readonly { user_id: string; role: string }[] = [],
    existente: readonly string[] = [],
  ): void {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T09:00:00Z"));
    server.raspunde("course_assignment_rules", "select", {
      data: reguli.map((r) => ({
        department_id: null,
        cod_cor: null,
        rol: null,
        employee_id: null,
        decalaj_zile: 0,
        termen_zile: null,
        ...r,
      })),
    });
    server.raspunde("employees", "select", {
      data: angajati.map((a) => ({
        department_id: null,
        cod_cor: null,
        hired_on: null,
        user_id: null,
        ...a,
      })),
    });
    server.raspunde("organization_members", "select", { data: membri });
    server.raspunde("course_enrollments", "select", {
      data: existente.map((employee_id) => ({ employee_id })),
    });
  }

  const inrolati = (server: ClientFals) =>
    server
      .apeluriPe("course_enrollments", "insert")
      .map((a) => (a.payload as { employee_id: string }).employee_id);

  it("fără curs ales ⇒ CONFLICT, fără nicio citire", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await aplicaRegulile({ course_id: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("citește doar regulile active ale cursului, fișele active, membrii activi și înrolările vii", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: CREARE });
    programeaza(server, [], []);

    const r = await aplicaRegulile({ course_id: CURS });

    expect(r).toEqual({ ok: true, data: { atribuite: 0, esuate: 0 } });
    const [reguli] = server.apeluriPe("course_assignment_rules");
    expect(areFiltru(reguli, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(reguli, "eq", "course_id", CURS)).toBe(true);
    expect(areFiltru(reguli, "eq", "activ", true)).toBe(true);
    expect(areFiltru(reguli, "is", "deleted_at", null)).toBe(true);
    const [angajati] = server.apeluriPe("employees");
    expect(areFiltru(angajati, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(angajati, "in", "status", ["activ", "suspendat", "preaviz"])).toBe(true);
    expect(areFiltru(angajati, "is", "deleted_at", null)).toBe(true);
    const [membri] = server.apeluriPe("organization_members");
    expect(areFiltru(membri, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(membri, "eq", "status", "active")).toBe(true);
    expect(areFiltru(membri, "is", "deleted_at", null)).toBe(true);
    const [existente] = server.apeluriPe("course_enrollments", "select");
    expect(areFiltru(existente, "eq", "course_id", CURS)).toBe(true);
    expect(areFiltru(existente, "eq", "organization_id", ORG_ID)).toBe(true);
    // O înrolare ștearsă logic nu mai ține locul: omul trebuie reînrolat.
    expect(areFiltru(existente, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(existente, "in", "status", ["neinceput", "in_curs", "finalizat"])).toBe(true);
    expect(server.apeluriPe("course_enrollments", "insert")).toHaveLength(0);
  });

  it("regula „toți” prinde fiecare fișă, mai puțin pe cei deja înrolați", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    programeaza(
      server,
      [{ criteriu: "toti" }],
      [{ id: ID_1 }, { id: ID_2 }, { id: ID_3 }],
      [],
      [ID_2],
    );
    server.raspunde("course_enrollments", "insert", {});
    server.raspunde("course_enrollments", "insert", {});

    const r = await aplicaRegulile({ course_id: CURS });

    expect(r).toEqual({ ok: true, data: { atribuite: 2, esuate: 0 } });
    expect(inrolati(server)).toEqual([ID_1, ID_3]);
    expect(server.apeluriPe("course_enrollments", "insert")[0]?.payload).toEqual({
      organization_id: ORG_ID,
      course_id: CURS,
      employee_id: ID_1,
      motiv: "regula",
    });
  });

  it.each([
    [
      "departament",
      { criteriu: "departament", department_id: DEP },
      [
        { id: ID_1, department_id: DEP },
        { id: ID_2, department_id: null },
      ],
      [ID_1],
    ],
    [
      "funcție: doar codul COR identic; fișa fără cod nu prinde",
      { criteriu: "functie", cod_cor: "251401" },
      [
        { id: ID_1, cod_cor: "251401" },
        { id: ID_2, cod_cor: "111111" },
        { id: ID_3, cod_cor: null },
      ],
      [ID_1],
    ],
    [
      // 0110 lasă `course_assignment_rules.cod_cor` nullable, iar backfill-ul din
      // job_positions poate scrie null. Fără garda `angajat.cod_cor !== null`,
      // null === null ar înrola tăcut fiecare fișă fără ocupație declarată.
      "funcție cu regula FĂRĂ cod COR: nu prinde nici fișele fără cod",
      { criteriu: "functie", cod_cor: null },
      [
        { id: ID_1, cod_cor: null },
        { id: ID_2, cod_cor: "251401" },
        { id: ID_3, cod_cor: null },
      ],
      [],
    ],
    [
      "angajat anume",
      { criteriu: "angajat", employee_id: ID_2 },
      [{ id: ID_1 }, { id: ID_2 }],
      [ID_2],
    ],
    [
      "rol: prin contul legat de fișă; fișa fără cont nu prinde",
      { criteriu: "rol", rol: "manager" },
      [
        { id: ID_1, user_id: U1 },
        { id: ID_2, user_id: U2 },
        { id: ID_3, user_id: null },
      ],
      [ID_1],
    ],
  ])("criteriul %s", async (_caz, regula, angajati, asteptati) => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    programeaza(server, [regula], angajati, [
      { user_id: U1, role: "manager" },
      { user_id: U2, role: "employee" },
    ]);
    for (const _ of asteptati) server.raspunde("course_enrollments", "insert", {});

    const r = await aplicaRegulile({ course_id: CURS });

    expect(r).toEqual({ ok: true, data: { atribuite: asteptati.length, esuate: 0 } });
    expect(inrolati(server)).toEqual(asteptati);
  });

  it("decalajul se numără de la angajare; fișa fără dată intră imediat", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    programeaza(
      server,
      [{ criteriu: "toti", decalaj_zile: 7 }],
      [
        { id: ID_1, hired_on: "2026-09-30" }, // 7 octombrie > azi ⇒ încă nu
        { id: ID_2, hired_on: "2026-09-25" }, // 2 octombrie = azi ⇒ da
        { id: ID_3, hired_on: null },
      ],
    );
    server.raspunde("course_enrollments", "insert", {});
    server.raspunde("course_enrollments", "insert", {});

    const r = await aplicaRegulile({ course_id: CURS });

    expect(r).toEqual({ ok: true, data: { atribuite: 2, esuate: 0 } });
    expect(inrolati(server)).toEqual([ID_2, ID_3]);
  });

  it("termenul regulii devine dată calendaristică de la azi; o persoană prinsă de două reguli intră o dată", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    programeaza(
      server,
      [
        { criteriu: "angajat", employee_id: ID_1, termen_zile: 10 },
        { criteriu: "toti", termen_zile: null },
      ],
      [{ id: ID_1 }, { id: ID_2 }],
    );
    server.raspunde("course_enrollments", "insert", {});
    server.raspunde("course_enrollments", "insert", {});

    await aplicaRegulile({ course_id: CURS });

    const payloaduri = server.apeluriPe("course_enrollments", "insert").map((a) => a.payload);
    expect(payloaduri).toEqual([
      {
        organization_id: ORG_ID,
        course_id: CURS,
        employee_id: ID_1,
        motiv: "regula",
        termen: "2026-10-12",
      },
      { organization_id: ORG_ID, course_id: CURS, employee_id: ID_2, motiv: "regula" },
    ]);
  });

  it("inserțiile refuzate se numără ca eșuate, fără să oprească restul", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    programeaza(server, [{ criteriu: "toti" }], [{ id: ID_1 }, { id: ID_2 }]);
    server.raspunde("course_enrollments", "insert", { error: eroarePostgrest("P0001", "x") });
    server.raspunde("course_enrollments", "insert", {});

    const r = await aplicaRegulile({ course_id: CURS });

    expect(r).toEqual({ ok: true, data: { atribuite: 1, esuate: 1 } });
  });

  it.each([["course_assignment_rules"], ["employees"]])(
    "eroarea la citirea din %s nu e înghițită și nu se înrolează nimeni",
    async (tabela) => {
      const { server } = configureazaActiunea({ permisiuni: CREARE });
      server.raspunde(tabela, "select", { error: eroarePostgrest("42501") });
      programeaza(server, [{ criteriu: "toti" }], [{ id: ID_1 }]);

      const r = await aplicaRegulile({ course_id: CURS });

      expect(r.ok).toBe(false);
      expect(server.apeluriPe("course_enrollments", "insert")).toHaveLength(0);
    },
  );

  it("eroarea la citirea membrilor nu e raportată ca „0 atribuiri”", async () => {
    // actions.ts:1039–1043 verifică `reguli.error` și `angajati.error`, dar
    // nu și `membri.error` / `existente.error`. Cu membrii necitiți, o regulă
    // pe rol nu prinde pe nimeni și acțiunea întoarce succes cu zero —
    // omul crede că nu există cine să primească cursul.
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("organization_members", "select", { error: eroarePostgrest("57014") });
    programeaza(server, [{ criteriu: "rol", rol: "manager" }], [{ id: ID_1, user_id: U1 }]);

    const r = await aplicaRegulile({ course_id: CURS });

    expect(r.ok).toBe(false);
  });

  it("eroarea la citirea înrolărilor existente nu duce la înrolări noi", async () => {
    // actions.ts:1039–1043 nu verifică nici `existente.error`. Cu înrolările
    // necitite, setul `deja` e gol: acțiunea încearcă să înroleze din nou pe
    // toată lumea și raportează succes în loc să spună că n-a putut citi.
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_enrollments", "select", { error: eroarePostgrest("57014") });
    programeaza(server, [{ criteriu: "toti" }], [{ id: ID_1 }], [], [ID_1]);
    server.raspunde("course_enrollments", "insert", {});

    const r = await aplicaRegulile({ course_id: CURS });

    expect(r.ok).toBe(false);
    expect(server.apeluriPe("course_enrollments", "insert")).toHaveLength(0);
  });
});
