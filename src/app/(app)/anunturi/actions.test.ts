// src/app/(app)/anunturi/actions.test.ts
//
// Acțiunile avizierului: crearea, publicarea (tranziție cu fanout de
// notificări) și confirmarea de citire. Straturile comune ale lui
// `createAction` sunt verificate o singură dată, în testul canonic
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
import { creeazaAnunt, marcheazaAnuntCitit, publicaAnunt } from "./actions";

const ACUM = new Date("2026-09-15T08:30:00.000Z");
const CAI = ["/anunturi", "/portal"];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ACUM);
});

afterEach(() => {
  vi.useRealTimers();
});

const ANUNT = {
  titlu: "  Program redus vineri  ",
  continut: "Vineri se lucrează până la ora 14.",
  fixat: true,
  expira_la: "",
};

describe("creeazaAnunt", () => {
  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:create": "team" } });
    const r = await creeazaAnunt(ANUNT);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("ciornă: INSERT în organizația activă, nepublicat, fără nicio notificare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:create": "all" } });
    server.raspunde("announcements", "insert", { data: { id: ID_1 } });

    const r = await creeazaAnunt(ANUNT);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("announcements", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      titlu: "Program redus vineri",
      continut: "Vineri se lucrează până la ora 14.",
      fixat: true,
      publicat_la: null,
      // Șirul gol din formular devine null, nu o dată invalidă.
      expira_la: null,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.terminal).toBe("single");
    expect(server.apeluriPe("organization_members")).toHaveLength(0);
    expect(server.apeluriPe("notifications")).toHaveLength(0);
  });

  it("publicat pe loc: marca de publicare e ACUM și fiecare membru activ primește o notificare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:create": "all" } });
    server.raspunde("announcements", "insert", { data: { id: ID_1 } });
    server.raspunde("organization_members", "select", {
      data: [{ user_id: ID_2 }, { user_id: ID_3 }],
    });
    server.raspunde("notifications", "insert", { data: null });

    const r = await creeazaAnunt({ ...ANUNT, publica_acum: true, expira_la: "2026-10-01" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [insert] = server.apeluriPe("announcements", "insert");
    expect(insert?.payload).toMatchObject({
      publicat_la: ACUM.toISOString(),
      expira_la: "2026-10-01",
    });

    const [membri] = server.apeluriPe("organization_members");
    expect(areFiltru(membri, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(membri, "eq", "status", "active")).toBe(true);
    expect(areFiltru(membri, "is", "deleted_at", null)).toBe(true);

    const [notificari] = server.apeluriPe("notifications", "insert");
    expect(notificari?.payload).toEqual(
      [ID_2, ID_3].map((user_id) => ({
        organization_id: ORG_ID,
        user_id,
        kind: "announcement",
        title: "Anunț nou",
        body: "Program redus vineri",
        link: `/anunturi/${ID_1}`,
        entity_type: "announcement",
        entity_id: ID_1,
      })),
    );
  });

  it("publicat într-o firmă fără membri activi: nicio scriere în notificări", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:create": "all" } });
    server.raspunde("announcements", "insert", { data: { id: ID_1 } });
    server.raspunde("organization_members", "select", { data: [] });

    const r = await creeazaAnunt({ ...ANUNT, publica_acum: true });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("notifications")).toHaveLength(0);
  });

  it("fanout-ul respins de bază (42501) iese ca INTERZIS și nu revalidează", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:create": "all" } });
    server.raspunde("announcements", "insert", { data: { id: ID_1 } });
    server.raspunde("organization_members", "select", { data: [{ user_id: ID_2 }] });
    server.raspunde("notifications", "insert", { error: eroarePostgrest("42501") });

    const r = await creeazaAnunt({ ...ANUNT, publica_acum: true });

    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: auditul păstrează doar titlul și fixarea, nu conținutul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:create": "all" } });
    server.raspunde("announcements", "insert", { data: { id: ID_1 } });

    await creeazaAnunt(ANUNT);
    await asteaptaDupa();

    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_type: "announcement" });
    expect(audit?.p_after).toEqual({ titlu: "Program redus vineri", fixat: true });
  });

  it("succes: revalidează avizierul și portalul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:create": "all" } });
    server.raspunde("announcements", "insert", { data: { id: ID_1 } });
    await creeazaAnunt(ANUNT);
    expect(caiRevalidate()).toEqual(CAI);
  });
});

describe("publicaAnunt", () => {
  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:update": "team" } });
    const r = await publicaAnunt({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: UPDATE pe id + organizație cu `.select()`, apoi notificări cu titlul din bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:update": "all" } });
    server.raspunde("announcements", "update", { data: { id: ID_1, titlu: "Inventar anual" } });
    server.raspunde("organization_members", "select", { data: [{ user_id: ID_2 }] });
    server.raspunde("notifications", "insert", { data: null });

    const r = await publicaAnunt({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    const [apel] = server.apeluriPe("announcements", "update");
    expect(apel?.payload).toEqual({ publicat_la: ACUM.toISOString() });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, titlu");
    expect(apel?.terminal).toBe("maybeSingle");

    const [notificari] = server.apeluriPe("notifications", "insert");
    expect(notificari?.payload).toEqual([
      expect.objectContaining({
        user_id: ID_2,
        body: "Inventar anual",
        link: `/anunturi/${ID_1}`,
        entity_id: ID_1,
      }),
    ]);
  });

  it("zero rânduri afectate: NEGASIT, fără notificări și fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:update": "all" } });
    server.raspunde("announcements", "update", { data: null });

    const r = await publicaAnunt({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("organization_members")).toHaveLength(0);
    expect(server.apeluriPe("notifications")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează avizierul și portalul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:update": "all" } });
    server.raspunde("announcements", "update", { data: { id: ID_1, titlu: "X" } });
    server.raspunde("organization_members", "select", { data: [] });
    await publicaAnunt({ id: ID_1 });
    expect(caiRevalidate()).toEqual(CAI);
  });
});

describe("marcheazaAnuntCitit", () => {
  const FISA = ID_2;

  it("fără `announcements:read`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: {} });
    const r = await marcheazaAnuntCitit({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("prima confirmare: se scrie pe fișa PROPRIE, găsită după utilizatorul sesiunii", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "announcements:read": "own" },
    });
    server.raspunde("employees", "select", { data: { id: FISA } });
    server.raspunde("announcement_reads", "select", { data: null });
    server.raspunde("announcement_reads", "insert", { data: null });

    const r = await marcheazaAnuntCitit({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    const [fisa] = server.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "user_id", USER_ID)).toBe(true);

    const [cautare] = server.apeluriPe("announcement_reads", "select");
    expect(areFiltru(cautare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(cautare, "eq", "announcement_id", ID_1)).toBe(true);
    expect(areFiltru(cautare, "eq", "employee_id", FISA)).toBe(true);

    const [insert] = server.apeluriPe("announcement_reads", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      announcement_id: ID_1,
      employee_id: FISA,
      user_id: USER_ID,
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("confirmarea există deja: reușită, fără a doua scriere", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "announcements:read": "own" },
    });
    server.raspunde("employees", "select", { data: { id: FISA } });
    server.raspunde("announcement_reads", "select", { data: { id: ID_3 } });

    const r = await marcheazaAnuntCitit({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    expect(server.apeluriPe("announcement_reads", "insert")).toHaveLength(0);
  });

  it("utilizatorul fără fișă de angajat (admin pur): reușită fără nicio confirmare scrisă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "announcements:read": "all" } });
    server.raspunde("employees", "select", { data: null });

    const r = await marcheazaAnuntCitit({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    expect(server.apeluriPe("announcement_reads")).toHaveLength(0);
  });

  it("confirmarea dublă din cursă (23505 pe indexul unic) e tratată ca reușită", async () => {
    // Pagina de vault promite: „O a doua confirmare cade cu 23505; acțiunea o
    // tratează ca reușită". Handlerul arunca eroarea mai departe, iar două
    // file deschise pe același anunț dădeau „Există deja o înregistrare".
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "announcements:read": "own" },
    });
    server.raspunde("employees", "select", { data: { id: FISA } });
    server.raspunde("announcement_reads", "select", { data: null });
    server.raspunde("announcement_reads", "insert", { error: eroarePostgrest("23505") });

    const r = await marcheazaAnuntCitit({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
  });
});
