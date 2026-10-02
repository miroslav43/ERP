// src/app/(app)/angajati/actions-invitatie-stergere.test.ts
//
// Invitația în aplicație și ștergerea fișei, din `./actions.ts`. Editarea,
// încadrarea și șeful de departament sunt în `actions-fisa.test.ts`, contractele
// în `actions-contract.test.ts`. Straturile comune ale lui `createAction` sunt
// verificate în testul canonic (`salarizare/actions.test.ts`).

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

// Crearea invitației (token, rând, e-mail) are propriile teste; aici se
// verifică doar ce îi trimite acțiunea și ce face cu rezultatul.
const { creeazaInvitatieFals } = vi.hoisted(() => ({ creeazaInvitatieFals: vi.fn() }));
vi.mock("@/lib/invitatii/creeaza", async (orig) => ({
  ...(await orig<typeof import("@/lib/invitatii/creeaza")>()),
  creeazaInvitatie: creeazaInvitatieFals,
}));

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
import { invitaAngajatul, stergeAngajat } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  creeazaInvitatieFals.mockReset();
});

// ── invitaAngajatul ──────────────────────────────────────────────────────────

describe("invitaAngajatul", () => {
  const PERMIS = { "employees:invite": "all" } as const;
  const fisa = {
    id: ID_1,
    marca: "0042",
    full_name: "Ion Popescu",
    email_personal: "Ion@Exemplu.ro",
    email_serviciu: null,
    user_id: null,
    status: "activ",
  };

  function programeaza(
    server: ReturnType<typeof configureazaActiunea>["server"],
    rand: Record<string, unknown> | null = fisa,
  ) {
    server.raspunde("employees", "select", { data: rand });
    server.raspunde("organizations", "select", { data: { slug: "hala-nord" } });
  }

  it("employees:invite sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:invite": "team" } });
    const r = await invitaAngajatul({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes cu e-mail personal: invită pe adresa fișei, cu retrimitere, și întoarce link + QR", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    creeazaInvitatieFals.mockResolvedValue({
      id: ID_2,
      email: "ion@exemplu.ro",
      token: "tok/en+1",
      emailTrimis: true,
      retrimisa: false,
    });

    const inainte = Date.now();
    const r = await invitaAngajatul({ id: ID_1 });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({
      adresa: "ion@exemplu.ro",
      fel: "personala",
      emailTrimis: true,
      retrimisa: false,
      link: "http://localhost:3000/invitatie/tok%2Fen%2B1",
    });
    expect(r.data.qr.startsWith("<svg")).toBe(true);
    const expira = new Date(r.data.expiraLa).getTime();
    expect(expira - inainte).toBeGreaterThanOrEqual(7 * 24 * 3600 * 1000 - 1000);
    expect(expira - inainte).toBeLessThanOrEqual(7 * 24 * 3600 * 1000 + 5000);

    expect(creeazaInvitatieFals.mock.calls[0]?.[0]).toMatchObject({
      organizationId: ORG_ID,
      email: "ion@exemplu.ro",
      rol: "employee",
      employeeId: ID_1,
      trimiteEmail: true,
      retrimiteDacaExista: true,
      userId: USER_ID,
    });
    const [citire] = server.apeluriPe("employees");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(server.apeluriPe("organizations")[0], "eq", "id", ORG_ID)).toBe(true);
    expect(caiRevalidate()).toEqual(["/angajati", "/setari/membri"]);
  });

  it("fără nicio adresă: fabrică una sintetică și NU trimite e-mail", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, { ...fisa, email_personal: null });
    creeazaInvitatieFals.mockResolvedValue({
      id: ID_2,
      email: "marca-0042@hala-nord.intern",
      token: "t",
      emailTrimis: false,
      retrimisa: true,
    });

    const r = await invitaAngajatul({ id: ID_1 });

    expect(r).toMatchObject({
      ok: true,
      data: { adresa: "marca-0042@hala-nord.intern", fel: "sintetica", emailTrimis: false },
    });
    expect(creeazaInvitatieFals.mock.calls[0]?.[0]).toMatchObject({
      email: "marca-0042@hala-nord.intern",
      trimiteEmail: false,
    });
  });

  it("angajatul are deja cont: CONFLICT, nicio invitație", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, { ...fisa, user_id: ID_3 });
    const r = await invitaAngajatul({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(creeazaInvitatieFals).not.toHaveBeenCalled();
  });

  it("fișă inexistentă: NEGASIT, nicio invitație", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, null);
    const r = await invitaAngajatul({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(creeazaInvitatieFals).not.toHaveBeenCalled();
  });

  it("organizația nu se găsește: NEGASIT, nicio invitație", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: fisa });
    server.raspunde("organizations", "select", { data: null });
    const r = await invitaAngajatul({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(creeazaInvitatieFals).not.toHaveBeenCalled();
  });

  it("modulul `nucleu` lipsă: MODUL_DEZACTIVAT, nicio interogare", async () => {
    const { server } = configureazaActiunea({ functii: ["payroll"], permisiuni: PERMIS });
    const r = await invitaAngajatul({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
    expect(server.apeluri).toHaveLength(0);
    expect(creeazaInvitatieFals).not.toHaveBeenCalled();
  });

  it("adresa nu intră în jurnalul de audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    creeazaInvitatieFals.mockResolvedValue({
      id: ID_2,
      email: "ion@exemplu.ro",
      token: "t",
      emailTrimis: true,
      retrimisa: false,
    });
    await invitaAngajatul({ id: ID_1 });
    await asteaptaDupa();
    expect(JSON.stringify(server.audituri())).not.toContain("exemplu.ro");
  });
});

// ── stergeAngajat ────────────────────────────────────────────────────────────

describe("stergeAngajat", () => {
  const PERMIS = { "employees:delete": "all" } as const;

  function programeaza(
    ctx: ReturnType<typeof configureazaActiunea>,
    piedici: { contracte: number; subordonati: number; userId?: string | null },
  ) {
    ctx.server.raspunde("employees", "select", {
      data: { id: ID_1, user_id: piedici.userId ?? null },
    });
    ctx.admin.raspunde("employment_contracts", "select", { count: piedici.contracte });
    ctx.admin.raspunde("employees", "select", { count: piedici.subordonati });
  }

  it("employees:delete sub `all` (team): INTERZIS", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: { "employees:delete": "team" } });
    const r = await stergeAngajat({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("succes: numără piedicile cu clientul de serviciu, filtrate pe organizație, apoi șterge LOGIC", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(ctx, { contracte: 0, subordonati: 0 });
    ctx.server.raspunde("employees", "update", { data: { id: ID_1 } });

    const r = await stergeAngajat({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [citire] = ctx.server.apeluriPe("employees", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [contracte] = ctx.admin.apeluriPe("employment_contracts");
    expect(areFiltru(contracte, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(contracte, "eq", "employee_id", ID_1)).toBe(true);
    expect(areFiltru(contracte, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(contracte, "is", "deleted_at", null)).toBe(true);
    const [subordonati] = ctx.admin.apeluriPe("employees");
    expect(areFiltru(subordonati, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(subordonati, "eq", "manager_employee_id", ID_1)).toBe(true);
    // Subordonații șterși logic nu blochează ștergerea.
    expect(areFiltru(subordonati, "is", "deleted_at", null)).toBe(true);

    const [update] = ctx.server.apeluriPe("employees", "update");
    expect(Object.keys(update?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(ctx.server.apeluriPe("employees", "delete")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(["/angajati", "/organigrama", "/setari/membri"]);
  });

  it.each([
    ["un contract activ", { contracte: 1, subordonati: 0 }],
    ["un subordonat direct", { contracte: 0, subordonati: 2 }],
    ["propria fișă", { contracte: 0, subordonati: 0, userId: USER_ID }],
  ])("piedică — %s: CONFLICT, fișa nu se atinge", async (_n, piedici) => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(ctx, piedici);
    const r = await stergeAngajat({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toMatch(/^Nu se poate șterge fișa/u);
    expect(ctx.server.apeluriPe("employees", "update")).toHaveLength(0);
  });

  it("fișa altui utilizator legat de cont nu e „propria fișă”: se șterge", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(ctx, { contracte: 0, subordonati: 0, userId: ID_3 });
    ctx.server.raspunde("employees", "update", { data: { id: ID_1 } });
    const r = await stergeAngajat({ id: ID_1 });
    expect(r.ok).toBe(true);
  });

  it("fișă inexistentă sau deja ștearsă: NEGASIT, fără numărători", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    ctx.server.raspunde("employees", "select", { data: null });
    const r = await stergeAngajat({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(ctx.admin.apeluri).toHaveLength(0);
  });

  it("zero rânduri, fișa încă vie: refuzul vine din politica de editare, iar mesajul o spune", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(ctx, { contracte: 0, subordonati: 0 });
    ctx.server.raspunde("employees", "update", { data: null });
    ctx.admin.raspunde("employees", "select", { count: 1 });

    const r = await stergeAngajat({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("dreptul de editare");
    const recitire = ctx.admin.apeluriPe("employees")[1];
    expect(areFiltru(recitire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(recitire, "eq", "organization_id", ORG_ID)).toBe(true);
    // Recitirea numără doar fișa VIE: fără filtru, o fișă ștearsă de altcineva
    // ar fi raportată drept refuz de politică.
    expect(areFiltru(recitire, "is", "deleted_at", null)).toBe(true);
    expect(caiRevalidate()).toEqual([]);
  });

  it("zero rânduri, fișa deja ștearsă între timp: CONFLICT „ștearsă de altcineva”", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(ctx, { contracte: 0, subordonati: 0 });
    ctx.server.raspunde("employees", "update", { data: null });
    ctx.admin.raspunde("employees", "select", { count: 0 });
    const r = await stergeAngajat({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("altcineva");
  });

  it("modulul `nucleu` lipsă: MODUL_DEZACTIVAT, nicio interogare", async () => {
    const { server, admin } = configureazaActiunea({ functii: ["payroll"], permisiuni: PERMIS });
    const r = await stergeAngajat({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("UPDATE-ul cu eroare de regulă (P0001): CONFLICT, fără recitire și fără revalidare", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(ctx, { contracte: 0, subordonati: 0 });
    ctx.server.raspunde("employees", "update", { error: eroarePostgrest("P0001") });
    const r = await stergeAngajat({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    // Doar numărătoarea subordonaților; recitirea e numai pe calea „zero rânduri”.
    expect(ctx.admin.apeluriPe("employees")).toHaveLength(1);
    expect(caiRevalidate()).toEqual([]);
  });

  it("textul brut al bazei (42501) NU ajunge la utilizator la eroarea UPDATE-ului de ștergere", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(ctx, { contracte: 0, subordonati: 0 });
    ctx.server.raspunde("employees", "update", {
      error: eroarePostgrest(
        "42501",
        'new row violates row-level security policy for table "employees"',
      ),
    });
    const r = await stergeAngajat({ id: ID_1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Politica din `errors.ts`: mesajele bazei nu ies din server.
    expect(r.error.message).not.toContain("row-level security");
  });
});
