// src/app/(app)/angajati/[id]/actions-auxiliare.test.ts
//
// Acțiunile mici de pe fișa angajatului: fotografia contului, componentele
// salariale, persoanele în întreținere și scutirile fiscale. Straturile comune
// ale lui `createAction` sunt verificate în testul canonic
// (`salarizare/actions.test.ts`).

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
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { pregatesteIncarcareAvatarAngajat, salveazaAvatarAngajat } from "./avatar-actions";
import { asociazaComponenta, incheieComponentaAngajat } from "./componente-actions";
import { adaugaPersoanaIntretinere, stergePersoanaIntretinere } from "./dependenti-actions";
import { adaugaScutireFiscala } from "./scutiri-actions";

/** Contul din portal legat de fișa ID_1 — altul decât utilizatorul din sesiune. */
const CONT_ANGAJAT = ID_3;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// ── Fotografia contului ──────────────────────────────────────────────────────

describe("pregatesteIncarcareAvatarAngajat", () => {
  const PERMIS = { "users:update": "all" } as const;
  const intrare = { employeeId: ID_1, numeFisier: "poza.png", dimensiune: 1000, mime: "image/png" };

  it("users:update sub `all` (team): INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "users:update": "team" } });
    const r = await pregatesteIncarcareAvatarAngajat(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: semnează o cale sub contul ANGAJATULUI, nu al celui care încarcă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { user_id: CONT_ANGAJAT } });
    server.raspundeStocare("avatars", "createSignedUploadUrl", {
      data: { signedUrl: "https://semnat" },
    });

    const r = await pregatesteIncarcareAvatarAngajat(intrare);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.urlSemnat).toBe("https://semnat");
    expect(r.data.cale.startsWith(`${CONT_ANGAJAT}/`)).toBe(true);
    expect(r.data.cale.endsWith("poza.png")).toBe(true);
    const [fisa] = server.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriStocare[0]?.argumente[0]).toBe(r.data.cale);
  });

  it("tip de fișier nepermis: CONFLICT înainte de orice interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await pregatesteIncarcareAvatarAngajat({ ...intrare, mime: "application/pdf" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("fișă inexistentă sau invizibilă: NEGASIT, nicio semnare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: null });
    const r = await pregatesteIncarcareAvatarAngajat(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("angajat fără cont în portal: CONFLICT — fotografia stă pe cont, nu pe fișă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { user_id: null } });
    const r = await pregatesteIncarcareAvatarAngajat(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("semnarea eșuată în Storage: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { user_id: CONT_ANGAJAT } });
    server.raspundeStocare("avatars", "createSignedUploadUrl", { error: { message: "x" } });
    const r = await pregatesteIncarcareAvatarAngajat(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("salveazaAvatarAngajat", () => {
  const PERMIS = { "users:update": "all" } as const;
  const cale = `${CONT_ANGAJAT}/abc-poza.png`;

  function programeaza(server: ReturnType<typeof configureazaActiunea>["server"]) {
    server.raspunde("employees", "select", { data: { user_id: CONT_ANGAJAT } });
    server.raspundeStocare("avatars", "info", { data: { size: 1000, contentType: "image/png" } });
  }

  it("users:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "users:update": "team" } });
    const r = await salveazaAvatarAngajat({ employeeId: ID_1, cale });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: scrie calea prin RPC, pe organizația din sesiune și contul angajatului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspundeRpc("set_member_avatar", { data: null });

    const r = await salveazaAvatarAngajat({ employeeId: ID_1, cale });

    expect(r).toEqual({ ok: true, data: { employeeId: ID_1 } });
    const apel = server.apeluriRpc.find((a) => a.nume === "set_member_avatar");
    expect(apel?.argumente).toEqual({
      p_organization_id: ORG_ID,
      p_user_id: CONT_ANGAJAT,
      p_avatar_path: cale,
    });
    expect(caiRevalidate()).toEqual([
      `/angajati/${ID_1}`,
      "/organigrama",
      "/departamente",
      "/angajati",
    ]);
  });

  it("calea e sub contul altcuiva: CONFLICT, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    const r = await salveazaAvatarAngajat({ employeeId: ID_1, cale: `${USER_ID}/abc-poza.png` });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriRpc.filter((a) => a.nume === "set_member_avatar")).toHaveLength(0);
  });

  it("obiectul urcat nu mai există în Storage: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { user_id: CONT_ANGAJAT } });
    server.raspundeStocare("avatars", "info", { error: { message: "nu există" } });
    const r = await salveazaAvatarAngajat({ employeeId: ID_1, cale });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("se judecă fișierul REAL, nu ce a declarat browserul: un PDF urcat e refuzat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { user_id: CONT_ANGAJAT } });
    server.raspundeStocare("avatars", "info", {
      data: { size: 1000, contentType: "application/pdf" },
    });
    const r = await salveazaAvatarAngajat({ employeeId: ID_1, cale });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriRpc.filter((a) => a.nume === "set_member_avatar")).toHaveLength(0);
  });

  it("RPC-ul eșuează: CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspundeRpc("set_member_avatar", { error: eroarePostgrest("42501") });
    const r = await salveazaAvatarAngajat({ employeeId: ID_1, cale });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── Componentele salariale ───────────────────────────────────────────────────

describe("asociazaComponenta", () => {
  const PERMIS = { "payroll:create": "all" } as const;
  const intrare = {
    employee_id: ID_1,
    component_type_id: ID_2,
    kind: "spor_suma",
    suma: 300,
    valabil_de_la: "2026-10-01",
  };

  it("payroll:create sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:create": "team" } });
    const r = await asociazaComponenta(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("firmă fără modulul de salarizare: MODUL_DEZACTIVAT, deși permisiunea există", async () => {
    const { server } = configureazaActiunea({ functii: ["nucleu"], permisiuni: PERMIS });
    const r = await asociazaComponenta(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: inserează pe organizația din sesiune, cu autorul, și revalidează fișa", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_components", "insert", { data: { id: ID_3 } });

    const r = await asociazaComponenta(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("salary_components", "insert");
    expect(apel?.payload).toMatchObject({
      employee_id: ID_1,
      component_type_id: ID_2,
      kind: "spor_suma",
      suma: 300,
      procent: null,
      valabil_de_la: "2026-10-01",
      organization_id: ORG_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(caiRevalidate()).toEqual([`/angajati/${ID_1}`]);
  });

  it.each([
    ["spor procentual fără procent", { kind: "spor_procent", suma: null }, "procent"],
    ["sumă fixă cu procent", { procent: 10 }, "procent"],
    ["interval inversat", { valabil_pana: "2026-09-01" }, "valabil_pana"],
  ])("schema refuză %s: VALIDARE pe câmpul potrivit", async (_n, modificare, camp) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await asociazaComponenta({ ...intrare, ...modificare });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
  });

  it("23505 tradus cu `mapPostgrestError` și aruncat ca valoare iese CONFLICT, nu EROARE_INTERNA", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_components", "insert", { error: eroarePostgrest("23505") });
    const r = await asociazaComponenta(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("incheieComponentaAngajat", () => {
  const PERMIS = { "payroll:update": "all" } as const;
  const intrare = { id: ID_2, employee_id: ID_1 };

  it("payroll:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:update": "team" } });
    const r = await incheieComponentaAngajat(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("firmă fără modulul de salarizare: MODUL_DEZACTIVAT, deși permisiunea există", async () => {
    const { server } = configureazaActiunea({ functii: ["nucleu"], permisiuni: PERMIS });
    const r = await incheieComponentaAngajat(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: închide intervalul AZI pe componenta angajatului, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_components", "update", { data: { id: ID_2 } });

    const r = await incheieComponentaAngajat(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("salary_components", "update");
    const azi = new Date().toISOString().slice(0, 10);
    expect(apel?.payload).toEqual({ valabil_pana: azi, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual([`/angajati/${ID_1}`]);
  });

  it("zero rânduri (componenta altui angajat sau respinsă de USING): NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_components", "update", { data: null });
    const r = await incheieComponentaAngajat(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── Persoanele în întreținere ────────────────────────────────────────────────

describe("adaugaPersoanaIntretinere", () => {
  const PERMIS = { "employees:update": "all" } as const;
  const intrare = {
    employee_id: ID_1,
    nume: "Ana Popescu",
    relatie: "copil",
    data_nasterii: "2015-04-02",
    in_intretinere_de_la: "2026-01-01",
  };

  it("employees:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:update": "team" } });
    const r = await adaugaPersoanaIntretinere(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: inserează persoana fără să atingă contorul de pe fișă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_dependents", "insert", { data: { id: ID_2 } });

    const r = await adaugaPersoanaIntretinere(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("employee_dependents", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      employee_id: ID_1,
      nume: "Ana Popescu",
      relatie: "copil",
      data_nasterii: "2015-04-02",
      in_intretinere_de_la: "2026-01-01",
      in_intretinere_pana_la: null,
      observatii: null,
    });
    // Contorul îl recalculează triggerul din 0069; acțiunea nu scrie pe fișă.
    expect(server.apeluriPe("employees")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([`/angajati/${ID_1}`, "/salarizare"]);
  });

  it("intervalul inversat: VALIDARE pe data de sfârșit", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await adaugaPersoanaIntretinere({ ...intrare, in_intretinere_pana_la: "2025-12-31" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("in_intretinere_pana_la");
    expect(server.apeluri).toHaveLength(0);
  });

  it("23505 tradus cu `mapPostgrestError` și aruncat ca valoare iese CONFLICT, nu EROARE_INTERNA", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_dependents", "insert", { error: eroarePostgrest("23505") });
    const r = await adaugaPersoanaIntretinere(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("stergePersoanaIntretinere", () => {
  const PERMIS = { "employees:update": "all" } as const;

  it("employees:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:update": "team" } });
    const r = await stergePersoanaIntretinere({ id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: ștergere LOGICĂ pe id + organizație, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_dependents", "update", { data: { id: ID_2, employee_id: ID_1 } });

    const r = await stergePersoanaIntretinere({ id: ID_2 });

    expect(r).toEqual({ ok: true, data: { employeeId: ID_1 } });
    const [apel, ...altele] = server.apeluriPe("employee_dependents");
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("update");
    expect(Object.keys(apel?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/salarizare"]);
  });

  it("zero rânduri (deja scoasă sau respinsă de USING): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_dependents", "update", { data: null });
    const r = await stergePersoanaIntretinere({ id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── Scutirile fiscale ────────────────────────────────────────────────────────

describe("adaugaScutireFiscala", () => {
  const PERMIS = { "payroll:create": "all" } as const;
  const intrare = {
    employee_id: ID_1,
    exemption_type: "it",
    valabil_de_la: "2026-01-01",
    procent_scutire: 100,
  };

  it("payroll:create sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:create": "team" } });
    const r = await adaugaScutireFiscala(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("firmă fără modulul de salarizare: MODUL_DEZACTIVAT, deși permisiunea există", async () => {
    const { server } = configureazaActiunea({ functii: ["nucleu"], permisiuni: PERMIS });
    const r = await adaugaScutireFiscala(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: inserează pe organizația din sesiune și revalidează fișa", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_tax_exemptions", "insert", { data: { id: ID_2 } });

    const r = await adaugaScutireFiscala(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("employee_tax_exemptions", "insert");
    expect(apel?.payload).toMatchObject({
      employee_id: ID_1,
      exemption_type: "it",
      valabil_de_la: "2026-01-01",
      valabil_pana: null,
      procent_scutire: 100,
      organization_id: ORG_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual([`/angajati/${ID_1}`]);
  });

  it("intervalul inversat: VALIDARE, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await adaugaScutireFiscala({ ...intrare, valabil_pana: "2025-01-01" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("valabil_pana");
    expect(server.apeluri).toHaveLength(0);
  });

  it("procent peste 100: VALIDARE", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    const r = await adaugaScutireFiscala({ ...intrare, procent_scutire: 120 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
  });

  it("42501 tradus cu `mapPostgrestError` și aruncat ca valoare iese INTERZIS, nu EROARE_INTERNA", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_tax_exemptions", "insert", { error: eroarePostgrest("42501") });
    const r = await adaugaScutireFiscala(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});
