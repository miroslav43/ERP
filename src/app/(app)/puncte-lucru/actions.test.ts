// src/app/(app)/puncte-lucru/actions.test.ts
//
// Acțiunile punctelor de lucru. Straturile comune ale lui `createAction`
// (sesiune, organizație, modul, Zod generic) sunt verificate o singură dată, în
// `salarizare/actions.test.ts`; aici: poarta `departments:*` la `all`, scrierea,
// tăcerea lui `USING` și secretul codului de pontaj.

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
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  actualizeazaPunctLucru,
  creeazaPunctLucru,
  dezactiveazaPunctLucru,
  reactiveazaPunctLucru,
  rotesteCodPontaj,
} from "./actions";

const CREARE = { "departments:create": "all" } as const;
const MODIFICARE = { "departments:update": "all" } as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("poarta: toate acțiunile cer `departments:*` la `all`", () => {
  it.each([
    ["creeazaPunctLucru", () => creeazaPunctLucru({ denumire: "Depozit" }), "departments:create"],
    [
      "actualizeazaPunctLucru",
      () => actualizeazaPunctLucru({ id: ID_1, denumire: "Depozit" }),
      "departments:update",
    ],
    ["dezactiveazaPunctLucru", () => dezactiveazaPunctLucru({ id: ID_1 }), "departments:update"],
    ["reactiveazaPunctLucru", () => reactiveazaPunctLucru({ id: ID_1 }), "departments:update"],
    ["rotesteCodPontaj", () => rotesteCodPontaj({ id: ID_1 }), "departments:update"],
  ] as const)("%s: fără permisiune ⇒ INTERZIS, nicio interogare", async (_n, cheama, _cheie) => {
    const { server, admin } = configureazaActiunea({ permisiuni: {} });
    const r = await cheama();
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it.each([
    ["creeazaPunctLucru", () => creeazaPunctLucru({ denumire: "Depozit" }), "departments:create"],
    [
      "actualizeazaPunctLucru",
      () => actualizeazaPunctLucru({ id: ID_1, denumire: "Depozit" }),
      "departments:update",
    ],
    ["dezactiveazaPunctLucru", () => dezactiveazaPunctLucru({ id: ID_1 }), "departments:update"],
    ["reactiveazaPunctLucru", () => reactiveazaPunctLucru({ id: ID_1 }), "departments:update"],
    ["rotesteCodPontaj", () => rotesteCodPontaj({ id: ID_1 }), "departments:update"],
  ] as const)("%s: scope `team` (sub `all`) ⇒ INTERZIS", async (_n, cheama, cheie) => {
    const { server } = configureazaActiunea({ permisiuni: { [cheie]: "team" } });
    const r = await cheama();
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("creeazaPunctLucru", () => {
  it("inserează în organizația din sesiune, activ, cu autorul pe ambele coloane", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("puncte_lucru", "insert", { data: { id: ID_1 } });

    const r = await creeazaPunctLucru({ denumire: "  Depozit Nord  ", adresa: "" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel, ...altele] = server.apeluriPe("puncte_lucru");
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("insert");
    expect(apel?.payload).toEqual({
      denumire: "Depozit Nord",
      adresa: null,
      judet: null,
      oras: null,
      cod_postal: null,
      sediu_principal: false,
      observatii: null,
      organization_id: ORG_ID,
      activ: true,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.terminal).toBe("single");
  });

  it("revalidează lista punctelor de lucru", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("puncte_lucru", "insert", { data: { id: ID_1 } });
    await creeazaPunctLucru({ denumire: "Depozit" });
    expect(caiRevalidate()).toEqual(["/puncte-lucru"]);
  });

  // `throw mapPostgrestError(...)` aruncă un `ActionError` SIMPLU (fără
  // `details`), pe care `createAction` nu-l recunoaște nici ca `ActionDenied`,
  // nici ca eroare PostgREST — deci orice cod al bazei devine EROARE_INTERNA.
  it.fails(
    "DEFECT: denumire duplicată (23505) iese EROARE_INTERNA în loc de CONFLICT",
    async () => {
      const { server } = configureazaActiunea({ permisiuni: CREARE });
      server.raspunde("puncte_lucru", "insert", { error: eroarePostgrest("23505") });
      const r = await creeazaPunctLucru({ denumire: "depozit" });
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      expect(caiRevalidate()).toEqual([]);
    },
  );

  it("auditul de succes poartă id-ul creat și doar câmpurile permise", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("puncte_lucru", "insert", { data: { id: ID_1 } });
    await creeazaPunctLucru({ denumire: "Depozit" });
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_type: "puncte_lucru",
        p_entity_id: ID_1,
      }),
    ]);
  });
});

describe("actualizeazaPunctLucru", () => {
  it("UPDATE pe id + organizație + rând neșters, cu `.select()` după scriere; `id` nu intră în payload", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("puncte_lucru", "update", { data: { id: ID_1 } });

    const r = await actualizeazaPunctLucru({ id: ID_1, denumire: "Sediu", sediu_principal: true });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("puncte_lucru", "update");
    expect(apel?.payload).toEqual({
      denumire: "Sediu",
      adresa: null,
      judet: null,
      oras: null,
      cod_postal: null,
      sediu_principal: true,
      observatii: null,
      updated_by: USER_ID,
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/puncte-lucru"]);
  });

  it("zero rânduri afectate ⇒ NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("puncte_lucru", "update", { data: null });
    const r = await actualizeazaPunctLucru({ id: ID_1, denumire: "Sediu" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("denumirea sub 2 caractere e refuzată înaintea bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    const r = await actualizeazaPunctLucru({ id: ID_1, denumire: " a " });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe.each([
  ["dezactiveazaPunctLucru", dezactiveazaPunctLucru, false, "dezactivat"],
  ["reactiveazaPunctLucru", reactiveazaPunctLucru, true, "reactivat"],
] as const)("%s", (_nume, actiune, activ, verb) => {
  it(`scrie activ=${String(activ)} pe id + organizație, cu \`.select()\` după scriere`, async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("puncte_lucru", "update", { data: { id: ID_1 } });

    const r = await actiune({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel, ...altele] = server.apeluriPe("puncte_lucru");
    expect(altele).toHaveLength(0);
    expect(apel?.payload).toEqual({ activ, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/puncte-lucru"]);
  });

  it("zero rânduri (rând șters sau refuz tăcut al lui USING) ⇒ CONFLICT, nu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("puncte_lucru", "update", { data: null });
    const r = await actiune({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain(`nu a fost ${verb}`);
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("rotesteCodPontaj", () => {
  it("scrie un cod nou de 32 de caractere base64url și îl întoarce pe ACELAȘI", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("puncte_lucru", "update", { data: { id: ID_1 } });

    const r = await rotesteCodPontaj({ id: ID_1 });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [apel] = server.apeluriPe("puncte_lucru", "update");
    const payload = apel?.payload as { cod_pontaj: string; updated_by: string };
    expect(payload.cod_pontaj).toMatch(/^[A-Za-z0-9_-]{32}$/u);
    expect(payload.updated_by).toBe(USER_ID);
    expect(r.data).toEqual({ id: ID_1, cod: payload.cod_pontaj });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/puncte-lucru"]);
  });

  it("două rotiri dau coduri diferite — codul nu e derivat din id", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("puncte_lucru", "update", { data: { id: ID_1 } });
    server.raspunde("puncte_lucru", "update", { data: { id: ID_1 } });
    const a = await rotesteCodPontaj({ id: ID_1 });
    const b = await rotesteCodPontaj({ id: ID_1 });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.data.cod).not.toBe(b.data.cod);
  });

  it("codul NU ajunge în jurnalul de audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("puncte_lucru", "update", { data: { id: ID_1 } });
    const r = await rotesteCodPontaj({ id: ID_1 });
    await asteaptaDupa();
    if (!r.ok) throw new Error("rotirea trebuia să reușească");
    const audituri = server.audituri();
    expect(audituri).toHaveLength(1);
    expect(audituri[0]).toMatchObject({ p_status: "success", p_entity_id: ID_1 });
    expect(JSON.stringify(audituri)).not.toContain(r.data.cod);
  });

  it("zero rânduri ⇒ CONFLICT: ecranul nu afișează un cod nescris nicăieri", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("puncte_lucru", "update", { data: null });
    const r = await rotesteCodPontaj({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it.fails("DEFECT: 42501 de la bază iese EROARE_INTERNA în loc de INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("puncte_lucru", "update", { error: eroarePostgrest("42501") });
    const r = await rotesteCodPontaj({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});
