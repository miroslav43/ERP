// src/app/(app)/mentenanta/planuri/actions.test.ts
//
// Gesturile de pe planul de mentenanță (0183): amânarea, activarea / dezactivarea
// și ștergerea logică. Dreptul real îl decide baza (politica + garda); aici se
// verifică ce TRIMITE acțiunea: payload-ul, filtrele din UPDATE (organizația,
// id-ul, `deleted_at is null`), `.select()` după scriere, zero rânduri tratat ca
// NEGASIT (capcana 17), traducerea P0001 și căile revalidate.

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

import { caiRevalidate, configureazaActiunea, ID_1, ID_2, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { amanaPlan, comutaPlanActiv, stergePlan } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const UPDATE = { "maintenance:update": "team" } as const;

/** Căile pe care le revalidează orice gest pe plan: lista, planurile și fișa planului. */
/** Și fișa echipamentului (`ID_2`, întors de handler): ea listează planurile. */
const CAI = (id: string) => [
  "/mentenanta",
  "/mentenanta/planuri",
  `/mentenanta/planuri/${id}`,
  `/mentenanta/echipamente/${ID_2}`,
];

const MESAJ_P0001 =
  "Doar un plan cu periodicitate în zile se poate amâna; scadența pe contor se citește, nu se amână.";

const amanare = {
  id: ID_1,
  amanat_pana: "2026-11-15",
  motiv_amanare: "Piesa de schimb sosește abia în noiembrie.",
};

describe("pragul de permisiune", () => {
  const cazuri = [
    ["amanaPlan", amanaPlan, amanare],
    ["comutaPlanActiv", comutaPlanActiv, { id: ID_1, activ: false }],
    ["stergePlan", stergePlan, { id: ID_1 }],
  ] as const;

  it.each(cazuri)(
    "%s: `maintenance:update` own < team ⇒ INTERZIS, zero apeluri",
    async (_n, actiune, intrare) => {
      const { server } = configureazaActiunea({
        rol: "employee",
        permisiuni: { "maintenance:update": "own" },
      });
      const r = await actiune(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
      expect(caiRevalidate()).toEqual([]);
    },
  );

  it.each(cazuri)(
    "%s: fără nicio permisiune pe mentenanță ⇒ INTERZIS, zero apeluri",
    async (_n, actiune, intrare) => {
      const { server } = configureazaActiunea({ rol: "employee", permisiuni: {} });
      const r = await actiune(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
      expect(caiRevalidate()).toEqual([]);
    },
  );
});

describe("amanaPlan", () => {
  it("UPDATE pe amanat_pana + motiv_amanare, filtrat pe organizație, id și rânduri nesterse, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", { data: { id: ID_1, equipment_id: ID_2 } });

    const r = await amanaPlan(amanare);

    expect(r).toEqual({ ok: true, data: { id: ID_1, equipment_id: ID_2 } });
    const apeluri = server.apeluriPe("maintenance_plans");
    expect(apeluri).toHaveLength(1);
    const [apel] = apeluri;
    expect(apel?.operatie).toBe("update");
    expect(apel?.payload).toEqual({
      amanat_pana: "2026-11-15",
      motiv_amanare: "Piesa de schimb sosește abia în noiembrie.",
    });
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(CAI(ID_1));
  });

  it("motivul se taie de spații înainte să ajungă în bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", { data: { id: ID_1, equipment_id: ID_2 } });

    const r = await amanaPlan({ ...amanare, motiv_amanare: "   Lipsește piesa   " });

    expect(r.ok).toBe(true);
    const [apel] = server.apeluriPe("maintenance_plans", "update");
    expect(apel?.payload).toMatchObject({ motiv_amanare: "Lipsește piesa" });
  });

  it("zero rânduri după UPDATE ⇒ NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", { data: null });

    const r = await amanaPlan(amanare);

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("maintenance_plans", "update")).toHaveLength(1);
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din bază (plan doar pe contor) ⇒ CONFLICT cu mesajul bazei, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", {
      error: eroarePostgrest("P0001", MESAJ_P0001),
    });

    const r = await amanaPlan(amanare);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: MESAJ_P0001 } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("mesajul P0001 se taie la 300 de caractere", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", {
      error: eroarePostgrest("P0001", "x".repeat(500)),
    });

    const r = await amanaPlan(amanare);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: "x".repeat(300) } });
  });

  it("alt cod Postgres (42501) ⇒ INTERZIS, nu CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", { error: eroarePostgrest("42501") });

    const r = await amanaPlan(amanare);

    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it.each([
    ["id care nu e uuid", { ...amanare, id: "plan-1" }],
    ["data în format european", { ...amanare, amanat_pana: "15.11.2026" }],
    ["data lipsă", { id: ID_1, motiv_amanare: amanare.motiv_amanare }],
    ["motiv sub 5 caractere", { ...amanare, motiv_amanare: "scut" }],
    ["motiv doar din spații", { ...amanare, motiv_amanare: "        " }],
    ["motiv peste 1000 de caractere", { ...amanare, motiv_amanare: "a".repeat(1001) }],
  ])("intrare nevalidă (%s) ⇒ VALIDARE, zero apeluri", async (_n, intrare) => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });

    const r = await amanaPlan(intrare as never);

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("comutaPlanActiv", () => {
  it.each([[true], [false]])(
    "activ = %s: UPDATE pe `activ`, cu filtrul `neq activ` pe aceeași valoare, `.select()` și revalidare",
    async (activ) => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("maintenance_plans", "update", {
        data: { id: ID_1, equipment_id: ID_2, activ },
      });

      const r = await comutaPlanActiv({ id: ID_1, activ });

      expect(r).toEqual({ ok: true, data: { id: ID_1, equipment_id: ID_2, activ } });
      const apeluri = server.apeluriPe("maintenance_plans");
      expect(apeluri).toHaveLength(1);
      const [apel] = apeluri;
      expect(apel?.operatie).toBe("update");
      expect(apel?.payload).toEqual({ activ });
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      // Fără ea, comutarea în starea în care e deja ar trece drept reușită.
      expect(areFiltru(apel, "neq", "activ", activ)).toBe(true);
      expect(apel?.selectDupaScriere).toBeDefined();
      expect(apel?.terminal).toBe("maybeSingle");
      expect(caiRevalidate()).toEqual(CAI(ID_1));
    },
  );

  it("zero rânduri (plan dispărut, inaccesibil sau deja în starea cerută) ⇒ NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", { data: null });

    const r = await comutaPlanActiv({ id: ID_1, activ: true });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din bază ⇒ CONFLICT cu mesajul bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", {
      error: eroarePostgrest("P0001", "Echipamentul e casat; planul nu se mai poate activa."),
    });

    const r = await comutaPlanActiv({ id: ID_1, activ: true });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Echipamentul e casat; planul nu se mai poate activa." },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it.each([
    ["id care nu e uuid", { id: "plan-1", activ: true }],
    ["`activ` lipsă", { id: ID_1 }],
    ["`activ` șir în loc de boolean", { id: ID_1, activ: "false" }],
    ["`activ` număr", { id: ID_1, activ: 0 }],
  ])("intrare nevalidă (%s) ⇒ VALIDARE, zero apeluri", async (_n, intrare) => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });

    const r = await comutaPlanActiv(intrare as never);

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("stergePlan", () => {
  it("ștergere logică: `deleted_at` (ISO) + `activ: false`, filtrat pe organizație, id și rânduri nesterse", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", { data: { id: ID_1, equipment_id: ID_2 } });
    const inainte = Date.now();

    const r = await stergePlan({ id: ID_1 });

    const dupa = Date.now();
    expect(r).toEqual({ ok: true, data: { id: ID_1, equipment_id: ID_2 } });
    const apeluri = server.apeluriPe("maintenance_plans");
    expect(apeluri).toHaveLength(1);
    const [apel] = apeluri;
    expect(apel?.operatie).toBe("update");
    expect(apel?.payload).toEqual({ deleted_at: expect.any(String), activ: false });
    const { deleted_at } = apel?.payload as { deleted_at: string };
    expect(new Date(deleted_at).toISOString()).toBe(deleted_at);
    expect(new Date(deleted_at).getTime()).toBeGreaterThanOrEqual(inainte);
    expect(new Date(deleted_at).getTime()).toBeLessThanOrEqual(dupa);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    // Al doilea clic pe „Șterge” nu mai găsește planul: NEGASIT, nu o a doua ștergere.
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(CAI(ID_1));
  });

  it("nu șterge fizic: niciun apel `delete` pe tabelă", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", { data: { id: ID_1, equipment_id: ID_2 } });

    await stergePlan({ id: ID_1 });

    expect(server.apeluriPe("maintenance_plans", "delete")).toHaveLength(0);
  });

  it("zero rânduri (plan inexistent sau deja șters) ⇒ NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", { data: null });

    const r = await stergePlan({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din bază ⇒ CONFLICT cu mesajul bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", {
      error: eroarePostgrest("P0001", "Planul are o execuție în curs."),
    });

    const r = await stergePlan({ id: ID_1 });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Planul are o execuție în curs." },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it.each([
    ["id care nu e uuid", { id: "plan-1" }],
    ["id lipsă", {}],
  ])("intrare nevalidă (%s) ⇒ VALIDARE, zero apeluri", async (_n, intrare) => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });

    const r = await stergePlan(intrare as never);

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });
});
