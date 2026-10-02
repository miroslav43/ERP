// src/app/(app)/cursuri/actions-curs.test.ts
//
// Ciclul de viață al cursului: creare, modificare, publicare, dezactivare.
// Permisiunea și pragul de scope sunt în `actions-permisiuni.test.ts`.

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
  ORG_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { actualizeazaCurs, creeazaCurs, dezactiveazaCurs, publicaCurs } from "./actions";

const RUTE = ["/cursuri", "/portal/cursurile-mele", "/portal"];
const CREARE = { "courses:create": "team" } as const;
const MODIFICARE = { "courses:update": "team" } as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("creeazaCurs", () => {
  it("managerul cu `team` creează cursul în organizația lui, cu valorile normalizate", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: CREARE });
    server.raspunde("courses", "insert", { data: { id: ID_1 } });

    const r = await creeazaCurs({
      cod: "  ssm_baza ",
      denumire: "Instructaj SSM",
      termen_zile: "",
      prag_avertizare_zile: "",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel, ...altele] = server.apeluriPe("courses");
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      cod: "ssm_baza",
      denumire: "Instructaj SSM",
      descriere: null,
      obligatoriu: true,
      valabilitate_luni: null,
      // Gol = FĂRĂ TERMEN (0085), nu 30 de zile.
      termen_zile: null,
      // Preavizul golit revine la 30: coloana e `not null`.
      prag_avertizare_zile: 30,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("organizația vine din sesiune, nu din intrare: un `organization_id` trimis e ignorat", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("courses", "insert", { data: { id: ID_1 } });

    await creeazaCurs({ cod: "ssm_baza", denumire: "Instructaj", organization_id: ID_2 });

    const [apel] = server.apeluriPe("courses", "insert");
    expect((apel?.payload as { organization_id: string }).organization_id).toBe(ORG_ID);
  });

  it("auditul de succes poartă id-ul creat și doar câmpurile din allow-list", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("courses", "insert", { data: { id: ID_1 } });

    await creeazaCurs({ cod: "ssm_baza", denumire: "Instructaj", descriere: "Text liber" });
    await asteaptaDupa();

    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_id: ID_1 });
    expect(audit?.["p_after"]).not.toHaveProperty("descriere");
    expect(audit?.["p_after"]).toMatchObject({ cod: "ssm_baza", denumire: "Instructaj" });
  });

  it("rând negăsit după INSERT (RLS) ⇒ CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("courses", "insert", { data: null });

    const r = await creeazaCurs({ cod: "ssm_baza", denumire: "Instructaj" });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("cod duplicat (23505) ⇒ VALIDARE pe câmpul `cod`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("courses", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "courses_cod_uk"',
      ),
    });

    const r = await creeazaCurs({ cod: "ssm_baza", denumire: "Instructaj" });

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("cod");
  });

  it.fails(
    "DEFECT: denumire duplicată (courses_denumire_uk) ⇒ eroarea trebuie pusă pe `denumire`, nu pe `cod`",
    async () => {
      // `courses_denumire_uk` (0075:91) e un index unic separat de cel pe cod.
      // Omul care refolosește o denumire cu un cod NOU primește „alegeți alt
      // cod" pe câmpul Cod — schimbă codul și primește aceeași eroare.
      const { server } = configureazaActiunea({ permisiuni: CREARE });
      server.raspunde("courses", "insert", {
        error: eroarePostgrest(
          "23505",
          'duplicate key value violates unique constraint "courses_denumire_uk"',
        ),
      });

      const r = await creeazaCurs({ cod: "ssm_nou", denumire: "Instructaj SSM" });

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.fieldErrors).toHaveProperty("denumire");
      expect(r.error.fieldErrors).not.toHaveProperty("cod");
    },
  );

  it("valabilitatea peste 120 de luni e refuzată înainte de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await creeazaCurs({
      cod: "ssm_baza",
      denumire: "Instructaj",
      valabilitate_luni: 121,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaCurs", () => {
  it("UPDATE pe id + organizație + nesters, fără `id` în payload, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: MODIFICARE });
    server.raspunde("courses", "update", { data: { id: ID_1 } });

    const r = await actualizeazaCurs({ id: ID_1, cod: "ssm_baza", denumire: "Instructaj nou" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("courses", "update");
    expect(apel?.payload).not.toHaveProperty("id");
    expect(apel?.payload).toMatchObject({ cod: "ssm_baza", denumire: "Instructaj nou" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("zero rânduri (alt tenant, șters sau USING) ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("courses", "update", { data: null });
    const r = await actualizeazaCurs({ id: ID_1, cod: "ssm_baza", denumire: "Instructaj" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("42501 pe o coloană fără grant ⇒ CONFLICT cu mesajul modulului, nu textul bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("courses", "update", {
      error: eroarePostgrest("42501", "permission denied for column publicat"),
    });
    const r = await actualizeazaCurs({ id: ID_1, cod: "ssm_baza", denumire: "Instructaj" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu aveți dreptul de a modifica acest câmp." },
    });
  });
});

describe("publicaCurs", () => {
  it("publicarea numără lecțiile nesterse ale cursului în organizație, apoi scrie data publicării", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: MODIFICARE });
    server.raspunde("course_items", "select", { count: 3 });
    server.raspunde("courses", "update", { data: { id: ID_1 } });

    const r = await publicaCurs({ id: ID_1, publicat: true });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [numarare] = server.apeluriPe("course_items", "select");
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(numarare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(numarare, "eq", "course_id", ID_1)).toBe(true);
    expect(areFiltru(numarare, "is", "deleted_at", null)).toBe(true);

    const [apel] = server.apeluriPe("courses", "update");
    const payload = apel?.payload as { publicat: boolean; publicat_la: string | null };
    expect(payload.publicat).toBe(true);
    expect(payload.publicat_la).not.toBeNull();
    expect(Number.isNaN(Date.parse(payload.publicat_la ?? ""))).toBe(false);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it.each([[0], [null]])(
    "un curs fără nicio lecție (count = %s) nu se publică: CONFLICT, fără UPDATE",
    async (count) => {
      const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
      server.raspunde("course_items", "select", { count });

      const r = await publicaCurs({ id: ID_1, publicat: true });

      expect(r).toMatchObject({
        ok: false,
        error: { code: "CONFLICT", message: expect.stringContaining("cel puțin o lecție") },
      });
      expect(server.apeluriPe("courses")).toHaveLength(0);
    },
  );

  it("retragerea din publicare nu mai numără lecțiile și golește data publicării", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("courses", "update", { data: { id: ID_1 } });

    const r = await publicaCurs({ id: ID_1, publicat: false });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("course_items")).toHaveLength(0);
    expect(server.apeluriPe("courses", "update")[0]?.payload).toEqual({
      publicat: false,
      publicat_la: null,
    });
  });

  it("zero rânduri la UPDATE ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_items", "select", { count: 1 });
    server.raspunde("courses", "update", { data: null });
    const r = await publicaCurs({ id: ID_1, publicat: true });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("eroarea la numărarea lecțiilor nu e înghițită", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_items", "select", { error: eroarePostgrest("42501") });
    const r = await publicaCurs({ id: ID_1, publicat: true });
    expect(r.ok).toBe(false);
    expect(server.apeluriPe("courses")).toHaveLength(0);
  });
});

describe("dezactiveazaCurs", () => {
  it("scrie doar `activ`, pe id + organizație + nesters, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("courses", "update", { data: { id: ID_1 } });

    const r = await dezactiveazaCurs({ id: ID_1, activ: false });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("courses", "update");
    expect(apel?.payload).toEqual({ activ: false });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("zero rânduri ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("courses", "update", { data: null });
    const r = await dezactiveazaCurs({ id: ID_1, activ: false });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
