// src/app/(app)/angajati/[id]/permisiuni/actions.test.ts
//
// Rolul și suprascrierile per membru, de pe fișa angajatului. Straturile
// comune ale lui `createAction` sunt verificate o dată, în testul canonic
// (`salarizare/actions.test.ts`); aici: pragul de permisiune, handlerul,
// revalidarea.

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

// `schimbaRolul` are propriile gărzi (ultimul administrator, propriul rol) și
// propriile interogări; aici se verifică doar că acțiunea îi dă contextul corect.
const { schimbaRolulFals } = vi.hoisted(() => ({ schimbaRolulFals: vi.fn() }));
vi.mock("@/lib/membri/schimba-rol", async (orig) => ({
  ...(await orig<typeof import("@/lib/membri/schimba-rol")>()),
  schimbaRolul: schimbaRolulFals,
}));

import {
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  MEMBER_ID,
  ORG_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { businessRule } from "@/lib/actions/errors";
import { schimbaRolulAngajatului, suprascriePermisiunea } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  schimbaRolulFals.mockReset();
});

describe("schimbaRolulAngajatului", () => {
  const PERMIS = { "users:update": "all" } as const;

  it("users:update sub `all` (team): INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "users:update": "team" } });
    const r = await schimbaRolulAngajatului({ memberId: ID_1, role: "manager" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(schimbaRolulFals).not.toHaveBeenCalled();
  });

  it("succes: trimite organizația din sesiune și apartenența autorului, nu ce vine din client", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    schimbaRolulFals.mockResolvedValue({ id: ID_1, role: "manager" });

    const r = await schimbaRolulAngajatului({ memberId: ID_1, role: "manager" });

    expect(r).toEqual({ ok: true, data: { id: ID_1, role: "manager" } });
    expect(schimbaRolulFals).toHaveBeenCalledTimes(1);
    expect(schimbaRolulFals.mock.calls[0]?.[0]).toMatchObject({
      organizationId: ORG_ID,
      memberId: ID_1,
      rol: "manager",
      memberIdAutor: MEMBER_ID,
    });
  });

  it("succes: revalidează lista de angajați și lista de membri", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    schimbaRolulFals.mockResolvedValue({ id: ID_1, role: "hr" });
    await schimbaRolulAngajatului({ memberId: ID_1, role: "hr" });
    expect(caiRevalidate()).toEqual(["/angajati", "/setari/membri"]);
  });

  it("rolul `super_admin` nu se poate atribui de pe fișă: VALIDARE", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    const r = await schimbaRolulAngajatului({ memberId: ID_1, role: "super_admin" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(schimbaRolulFals).not.toHaveBeenCalled();
  });

  it("refuzul gărzii (propriul rol, ultimul administrator) ajunge la ecran ca CONFLICT, fără revalidare", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    schimbaRolulFals.mockRejectedValue(businessRule("Nu vă puteți schimba propriul rol."));
    const r = await schimbaRolulAngajatului({ memberId: MEMBER_ID, role: "employee" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu vă puteți schimba propriul rol." },
    });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("suprascriePermisiunea", () => {
  const PERMIS = { "roles:update": "team" } as const;
  const intrare = (scope: string | null) => ({
    memberId: ID_1,
    cheie: "leave:approve",
    scope,
  });

  it("roles:update sub `team` (own): INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "roles:update": "own" } });
    const r = await suprascriePermisiunea(intrare("all"));
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("caută suprascrierea existentă pe organizație, membru, resursă și acțiune, doar printre cele nesterse", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("role_permissions", "select", { data: null });
    server.raspunde("organization_members", "select", { data: { role: "employee" } });
    server.raspunde("role_permissions", "insert", { data: [{ id: ID_2 }] });

    await suprascriePermisiunea(intrare("team"));

    const [cautare] = server.apeluriPe("role_permissions", "select");
    expect(areFiltru(cautare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(cautare, "eq", "member_id", ID_1)).toBe(true);
    expect(areFiltru(cautare, "eq", "resource", "leave")).toBe(true);
    expect(areFiltru(cautare, "eq", "action", "approve")).toBe(true);
    expect(areFiltru(cautare, "is", "deleted_at", null)).toBe(true);
  });

  it("fără suprascriere existentă: inserează rândul de MEMBRU, cu rolul lui citit din organizație", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("role_permissions", "select", { data: null });
    server.raspunde("organization_members", "select", { data: { role: "hr" } });
    server.raspunde("role_permissions", "insert", { data: [{ id: ID_2 }] });

    const r = await suprascriePermisiunea(intrare("team"));

    expect(r).toEqual({ ok: true, data: { memberId: ID_1 } });
    const [membru] = server.apeluriPe("organization_members");
    expect(areFiltru(membru, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(membru, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(membru, "is", "deleted_at", null)).toBe(true);
    const [insert] = server.apeluriPe("role_permissions", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      member_id: ID_1,
      role: "hr",
      resource: "leave",
      action: "approve",
      scope: "team",
    });
    expect(insert?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/angajati"]);
  });

  it("membrul nu e în organizație: CONFLICT și nicio inserare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("role_permissions", "select", { data: null });
    server.raspunde("organization_members", "select", { data: null });

    const r = await suprascriePermisiunea(intrare("team"));

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("role_permissions", "insert")).toHaveLength(0);
  });

  it("inserare respinsă tăcut de RLS (zero rânduri întoarse): CONFLICT, nu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("role_permissions", "select", { data: null });
    server.raspunde("organization_members", "select", { data: { role: "hr" } });
    server.raspunde("role_permissions", "insert", { data: [] });

    const r = await suprascriePermisiunea(intrare("team"));

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("cu suprascriere existentă: schimbă doar scope-ul rândului găsit, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("role_permissions", "select", { data: { id: ID_2 } });
    server.raspunde("role_permissions", "update", { data: [{ id: ID_2 }] });

    const r = await suprascriePermisiunea(intrare("all"));

    expect(r).toEqual({ ok: true, data: { memberId: ID_1 } });
    const [update, ...altele] = server.apeluriPe("role_permissions", "update");
    expect(altele).toHaveLength(0);
    expect(update?.payload).toEqual({ scope: "all" });
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(server.apeluriPe("organization_members")).toHaveLength(0);
  });

  it("modificare respinsă de USING (zero rânduri): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("role_permissions", "select", { data: { id: ID_2 } });
    server.raspunde("role_permissions", "update", { data: [] });
    const r = await suprascriePermisiunea(intrare("all"));
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("`scope: null` cu suprascriere existentă: o retrage LOGIC, prin `sterge_logic`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("role_permissions", "select", { data: { id: ID_2 } });
    server.raspundeRpc("sterge_logic", { data: [ID_2] });

    const r = await suprascriePermisiunea(intrare(null));

    expect(r).toEqual({ ok: true, data: { memberId: ID_1 } });
    const apel = server.apeluriRpc.find((a) => a.nume === "sterge_logic");
    expect(apel?.argumente).toEqual({ p_tabela: "role_permissions", p_ids: [ID_2] });
    // Nici UPDATE direct (pică mereu cu 42501, 0164), nici DELETE.
    expect(server.apeluriPe("role_permissions", "update")).toHaveLength(0);
    expect(server.apeluriPe("role_permissions", "delete")).toHaveLength(0);
  });

  it("`scope: null` fără suprascriere: nimic de retras, succes fără nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("role_permissions", "select", { data: null });

    const r = await suprascriePermisiunea(intrare(null));

    expect(r).toEqual({ ok: true, data: { memberId: ID_1 } });
    expect(server.apeluri.filter((a) => a.operatie !== "select")).toHaveLength(0);
  });

  it("retragere respinsă tăcut (zero rânduri): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("role_permissions", "select", { data: { id: ID_2 } });
    server.raspundeRpc("sterge_logic", { data: [] });
    const r = await suprascriePermisiunea(intrare(null));
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("42501 din politica bazei (ținta e chiar apelantul, resursa `roles`): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("role_permissions", "select", { data: null });
    server.raspunde("organization_members", "select", { data: { role: "manager" } });
    server.raspunde("role_permissions", "insert", { error: eroarePostgrest("42501") });
    const r = await suprascriePermisiunea(intrare("all"));
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });

  it("cheie de permisiune necunoscută: VALIDARE, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await suprascriePermisiunea({
      memberId: ID_1,
      cheie: "inventat:orice",
      scope: "all",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});
