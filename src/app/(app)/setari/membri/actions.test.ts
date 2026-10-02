// src/app/(app)/setari/membri/actions.test.ts
//
// Membrii organizației: invitare, revocare, schimbarea rolului, starea
// apartenenței. Poarta reală la UPDATE pe `organization_members` e politica
// (rol `org_admin`); aici se verifică pragul `users:*` la `all`, piedicile de
// business (propriul cont, ultimul administrator) și `.select()` după scriere.

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

// Munca invitației (rate-limit, token, e-mail) are propriul modul; aici se
// verifică doar contextul pe care acțiunea i-l dă.
const { creeazaInvitatie } = vi.hoisted(() => ({ creeazaInvitatie: vi.fn() }));
vi.mock("@/lib/invitatii/creeaza", async (orig) => ({
  ...(await orig<typeof import("@/lib/invitatii/creeaza")>()),
  creeazaInvitatie,
}));

import {
  asteaptaDupa,
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  MEMBER_ID,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  invitaMembru,
  revocaInvitatia,
  schimbaRolulMembrului,
  seteazaStareaMembrului,
} from "./actions";

const CREARE = { "users:create": "all" } as const;
const MODIFICARE = { "users:update": "all" } as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  creeazaInvitatie.mockReset();
});

describe("invitaMembru", () => {
  const intrare = { email: "ana@firma.ro", role: "hr" };

  it("fără `users:create` la `all`: INTERZIS, invitația nu se creează", async () => {
    configureazaActiunea({ permisiuni: { "users:create": "team" } });
    const r = await invitaMembru(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(creeazaInvitatie).not.toHaveBeenCalled();
  });

  it("dă invitației organizația din sesiune, rolul, autorul și momentul cererii", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const creata = {
      id: ID_1,
      email: "ana@firma.ro",
      token: "t",
      emailTrimis: true,
      retrimisa: false,
    };
    creeazaInvitatie.mockResolvedValue(creata);

    const r = await invitaMembru(intrare);

    expect(r).toEqual({ ok: true, data: creata });
    expect(creeazaInvitatie).toHaveBeenCalledTimes(1);
    const [parametri] = creeazaInvitatie.mock.calls[0] as [Record<string, unknown>];
    expect(parametri).toMatchObject({
      db: server.client,
      organizationId: ORG_ID,
      email: "ana@firma.ro",
      rol: "hr",
      invitatDe: "Utilizator Test",
      userId: USER_ID,
    });
    expect(parametri.acum).toBeInstanceOf(Date);
    expect(caiRevalidate()).toEqual(["/setari/membri"]);
  });

  it("auditul poartă id-ul invitației, dar NICIODATĂ tokenul", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    creeazaInvitatie.mockResolvedValue({
      id: ID_1,
      email: "ana@firma.ro",
      token: "secret-token",
      emailTrimis: true,
      retrimisa: false,
    });

    await invitaMembru(intrare);
    await asteaptaDupa();

    const audit = server.audituri().find((a) => a.p_status === "success");
    expect(audit).toMatchObject({
      p_action: "invite_sent",
      p_entity_type: "invitations",
      p_entity_id: ID_1,
      p_after: { email: "ana@firma.ro", role: "hr" },
    });
    expect(JSON.stringify(audit)).not.toContain("secret-token");
  });

  it("`super_admin` nu se poate invita: rolul nu e în lista atribuibilă", async () => {
    configureazaActiunea({ permisiuni: CREARE });
    const r = await invitaMembru({ email: "x@firma.ro", role: "super_admin" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("role");
    expect(creeazaInvitatie).not.toHaveBeenCalled();
  });

  it("refuzul de business al invitației (duplicat) ajunge ca CONFLICT, fără revalidare", async () => {
    configureazaActiunea({ permisiuni: CREARE });
    const { businessRule } = await import("@/lib/actions/errors");
    creeazaInvitatie.mockRejectedValue(
      businessRule("Există deja o invitație în așteptare pentru această adresă."),
    );
    const r = await invitaMembru(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Există deja o invitație în așteptare pentru această adresă.",
      },
    });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("revocaInvitatia", () => {
  it("fără `users:create` la `all`: INTERZIS și nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    const r = await revocaInvitatia({ invitationId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("revocă doar o invitație în așteptare a firmei, cu `.select()` după UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("invitations", "update", { data: { id: ID_1 } });

    const r = await revocaInvitatia({ invitationId: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("invitations");
    expect(apel?.payload).toEqual({ status: "revoked" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "pending")).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/setari/membri"]);
  });

  it("invitație deja folosită sau a altei firme (zero rânduri): NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("invitations", "update", { data: null });
    const r = await revocaInvitatia({ invitationId: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "NEGASIT", message: "Invitația nu mai există sau a fost deja folosită." },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("42501 din politică: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("invitations", "update", { error: eroarePostgrest("42501") });
    const r = await revocaInvitatia({ invitationId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});

describe("schimbaRolulMembrului", () => {
  it("fără `users:update` la `all`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "users:update": "team" } });
    const r = await schimbaRolulMembrului({ memberId: ID_1, role: "manager" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("nimeni nu-și schimbă propriul rol", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    const r = await schimbaRolulMembrului({ memberId: MEMBER_ID, role: "employee" });
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Nu vă puteți schimba propriul rol. Rugați alt administrator.",
      },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("retrogradarea ultimului administrator activ e refuzată", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("organization_members", "select", { count: 0 });

    const r = await schimbaRolulMembrului({ memberId: ID_1, role: "hr" });

    expect(r).toMatchObject({
      ok: false,
      error: { message: "Organizația trebuie să aibă cel puțin un administrator activ." },
    });
    const [numarare, ...altele] = server.apeluriPe("organization_members");
    expect(altele).toHaveLength(0);
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(numarare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(numarare, "eq", "role", "org_admin")).toBe(true);
    expect(areFiltru(numarare, "eq", "status", "active")).toBe(true);
    expect(areFiltru(numarare, "neq", "id", ID_1)).toBe(true);
  });

  it("promovarea la `org_admin` nu mai numără administratorii", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("organization_members", "update", { data: { id: ID_1, role: "org_admin" } });

    const r = await schimbaRolulMembrului({ memberId: ID_1, role: "org_admin" });

    expect(r).toEqual({ ok: true, data: { id: ID_1, role: "org_admin" } });
    expect(server.apeluriPe("organization_members", "select")).toHaveLength(0);
  });

  it("succes: UPDATE pe id + organizație cu `.select()`, întoarce rolul scris", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("organization_members", "select", { count: 2 });
    server.raspunde("organization_members", "update", { data: { id: ID_1, role: "manager" } });

    const r = await schimbaRolulMembrului({ memberId: ID_1, role: "manager" });

    expect(r).toEqual({ ok: true, data: { id: ID_1, role: "manager" } });
    const [apel] = server.apeluriPe("organization_members", "update");
    expect(apel?.payload).toEqual({ role: "manager" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/setari/membri"]);
  });

  it("zero rânduri (politica cere rolul `org_admin`): NEGASIT, nu succes", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: MODIFICARE });
    server.raspunde("organization_members", "select", { count: 1 });
    server.raspunde("organization_members", "update", { data: null });
    const r = await schimbaRolulMembrului({ memberId: ID_1, role: "employee" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "NEGASIT", message: "Membrul nu a fost găsit în această organizație." },
    });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("seteazaStareaMembrului", () => {
  it("fără `users:update` la `all`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "users:create": "all" } });
    const r = await seteazaStareaMembrului({ memberId: ID_1, status: "suspended" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("propriul cont nu se dezactivează — nici măcar „activ” nu se scrie pe sine", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    for (const status of ["inactive", "active"] as const) {
      const r = await seteazaStareaMembrului({ memberId: MEMBER_ID, status });
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    }
    expect(server.apeluri).toHaveLength(0);
  });

  it("suspendarea ultimului administrator activ e refuzată", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("organization_members", "select", { count: 0 });
    const r = await seteazaStareaMembrului({ memberId: ID_1, status: "suspended" });
    expect(r).toMatchObject({
      ok: false,
      error: { message: "Organizația trebuie să aibă cel puțin un administrator activ." },
    });
    expect(server.apeluriPe("organization_members", "update")).toHaveLength(0);
  });

  it("dezactivarea scrie cine și când, cu `.select()` după UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("organization_members", "select", { count: 1 });
    server.raspunde("organization_members", "update", { data: { id: ID_1, status: "inactive" } });

    const r = await seteazaStareaMembrului({ memberId: ID_1, status: "inactive" });

    expect(r).toEqual({ ok: true, data: { id: ID_1, status: "inactive" } });
    const [apel] = server.apeluriPe("organization_members", "update");
    const payload = apel?.payload as Record<string, unknown>;
    expect(payload.status).toBe("inactive");
    expect(payload.deactivated_by).toBe(USER_ID);
    expect(typeof payload.deactivated_at).toBe("string");
    expect(Number.isNaN(Date.parse(String(payload.deactivated_at)))).toBe(false);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/setari/membri"]);
  });

  it("reactivarea șterge urma dezactivării și nu mai numără administratorii", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("organization_members", "update", { data: { id: ID_2, status: "active" } });

    const r = await seteazaStareaMembrului({ memberId: ID_2, status: "active" });

    expect(r).toEqual({ ok: true, data: { id: ID_2, status: "active" } });
    expect(server.apeluriPe("organization_members", "select")).toHaveLength(0);
    expect(server.apeluriPe("organization_members", "update")[0]?.payload).toEqual({
      status: "active",
      deactivated_at: null,
      deactivated_by: null,
    });
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("organization_members", "select", { count: 3 });
    server.raspunde("organization_members", "update", { data: null });
    const r = await seteazaStareaMembrului({ memberId: ID_1, status: "suspended" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("42501 din politica de UPDATE: INTERZIS, nu „membrul nu a fost găsit”", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("organization_members", "select", { count: 2 });
    server.raspunde("organization_members", "update", { error: eroarePostgrest("42501") });
    const r = await seteazaStareaMembrului({ memberId: ID_1, status: "suspended" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("o stare din afara listei e respinsă de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    const r = await seteazaStareaMembrului({ memberId: ID_1, status: "deleted" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});
