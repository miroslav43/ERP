// src/app/(app)/cursuri/actions-lectii.test.ts
//
// Lecțiile unui curs (`course_items`): adăugare la coada listei, modificare,
// ștergere logică și reordonarea în TREI update-uri cu parcare la `max+1`
// (`course_items_ordine_uk` nu e deferabil).

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

import { caiRevalidate, configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ApelFals } from "@/lib/teste/supabase-fals";
import { actualizeazaLectie, adaugaLectie, mutaLectie, stergeLectie } from "./actions";

const RUTE = ["/cursuri", "/portal/cursurile-mele", "/portal"];
const CREARE = { "courses:create": "team" } as const;
const MODIFICARE = { "courses:update": "team" } as const;

/** Argumentele unui filtru (`order`, `limit`, `lt`...) din lanțul înregistrat. */
const argumenteFiltru = (apel: ApelFals | undefined, metoda: string) =>
  apel?.filtre.find((f) => f.metoda === metoda)?.argumente;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("adaugaLectie", () => {
  it("lecția nouă intră la coada cursului (ordinea maximă + 1), în organizația sesiunii", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: CREARE });
    server.raspunde("course_items", "select", { data: { ordine: 7 } });
    server.raspunde("course_items", "insert", { data: { id: ID_3 } });

    const r = await adaugaLectie({ course_id: ID_1, material_id: ID_2 });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [ultima] = server.apeluriPe("course_items", "select");
    expect(areFiltru(ultima, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(ultima, "eq", "course_id", ID_1)).toBe(true);
    expect(areFiltru(ultima, "is", "deleted_at", null)).toBe(true);
    expect(argumenteFiltru(ultima, "order")).toEqual(["ordine", { ascending: false }]);

    const [insert] = server.apeluriPe("course_items", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      course_id: ID_1,
      material_id: ID_2,
      obligatoriu: true,
      ordine: 8,
    });
    expect(insert?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("prima lecție a unui curs gol primește ordinea 1", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_items", "select", { data: null });
    server.raspunde("course_items", "insert", { data: { id: ID_3 } });

    await adaugaLectie({ course_id: ID_1, material_id: ID_2, obligatoriu: false });

    expect(server.apeluriPe("course_items", "insert")[0]?.payload).toMatchObject({
      ordine: 1,
      obligatoriu: false,
    });
  });

  it.each([
    [499, true],
    [500, false],
  ])(
    "plafonul de 500 de lecții: după ordinea %s, inserția e permisă = %s",
    async (maxim, permis) => {
      const { server } = configureazaActiunea({ permisiuni: CREARE });
      server.raspunde("course_items", "select", { data: { ordine: maxim } });
      server.raspunde("course_items", "insert", { data: { id: ID_3 } });

      const r = await adaugaLectie({ course_id: ID_1, material_id: ID_2 });

      expect(r.ok).toBe(permis);
      expect(server.apeluriPe("course_items", "insert")).toHaveLength(permis ? 1 : 0);
      if (!r.ok) expect(r.error.code).toBe("CONFLICT");
    },
  );

  it("materialul altui tenant (23503 pe cheia compusă) ⇒ CONFLICT cu mesajul modulului", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_items", "select", { data: null });
    server.raspunde("course_items", "insert", { error: eroarePostgrest("23503") });

    const r = await adaugaLectie({ course_id: ID_1, material_id: ID_2 });

    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Materialul sau cursul la care faceți referire nu mai există.",
      },
    });
  });

  it("rând neîntors ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_items", "select", { data: null });
    server.raspunde("course_items", "insert", { data: null });
    const r = await adaugaLectie({ course_id: ID_1, material_id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("actualizeazaLectie", () => {
  it("scrie doar `obligatoriu`, pe id + organizație + nesters, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_items", "update", { data: { id: ID_1 } });

    const r = await actualizeazaLectie({ id: ID_1, obligatoriu: false });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("course_items", "update");
    expect(apel?.payload).toEqual({ obligatoriu: false });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("zero rânduri ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_items", "update", { data: null });
    const r = await actualizeazaLectie({ id: ID_1, obligatoriu: true });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("stergeLectie", () => {
  it("ștergere logică: doar `deleted_at`, pe id + organizație + nesters, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_items", "update", { data: { id: ID_1 } });

    const r = await stergeLectie({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel, ...altele] = server.apeluriPe("course_items");
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("update");
    expect(Object.keys(apel?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("zero rânduri ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_items", "update", { data: null });
    const r = await stergeLectie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("mutaLectie", () => {
  /** Lecția curentă (ID_1, ordine 3) și vecina (ID_2), apoi maximul cursului. */
  const programeazaCitiri = (
    server: ReturnType<typeof configureazaActiunea>["server"],
    vecina: { id: string; ordine: number } | null,
    maxim: number | null = 5,
  ) => {
    server.raspunde("course_items", "select", {
      data: { id: ID_1, course_id: ID_3, ordine: 3 },
    });
    server.raspunde("course_items", "select", { data: vecina });
    if (vecina !== null) {
      server.raspunde("course_items", "select", {
        data: maxim === null ? null : { ordine: maxim },
      });
    }
  };

  it("în sus: parcare la max+1, vecina pe locul vechi, lecția pe locul vecinei", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: MODIFICARE });
    programeazaCitiri(server, { id: ID_2, ordine: 2 });
    for (let i = 0; i < 3; i += 1) server.raspunde("course_items", "update", { data: { id: "x" } });

    const r = await mutaLectie({ id: ID_1, directie: "sus" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });

    const [curenta, vecina, maxim] = server.apeluriPe("course_items", "select");
    expect(areFiltru(curenta, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(curenta, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(curenta, "is", "deleted_at", null)).toBe(true);
    // Vecina de deasupra: ordinea strict mai mică, cea mai apropiată.
    expect(areFiltru(vecina, "eq", "course_id", ID_3)).toBe(true);
    expect(areFiltru(vecina, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(argumenteFiltru(vecina, "lt")).toEqual(["ordine", 3]);
    expect(argumenteFiltru(vecina, "order")).toEqual(["ordine", { ascending: false }]);
    // O lecție ștearsă logic nu poate fi vecină: al doilea pas, filtrat, ar
    // atinge zero rânduri și lecția ar rămâne parcată la max+1.
    expect(areFiltru(vecina, "is", "deleted_at", null)).toBe(true);
    expect(argumenteFiltru(vecina, "limit")).toEqual([1]);
    // Locul de parcare vine din MAXIMUL lecțiilor vii ale aceluiași curs.
    expect(areFiltru(maxim, "eq", "course_id", ID_3)).toBe(true);
    expect(areFiltru(maxim, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(maxim, "is", "deleted_at", null)).toBe(true);
    expect(argumenteFiltru(maxim, "order")).toEqual(["ordine", { ascending: false }]);
    expect(argumenteFiltru(maxim, "limit")).toEqual([1]);

    const pasi = server.apeluriPe("course_items", "update");
    expect(
      pasi.map((p) => [p.filtre.find((f) => f.argumente[0] === "id")?.argumente[1], p.payload]),
    ).toEqual([
      [ID_1, { ordine: 6 }],
      [ID_2, { ordine: 3 }],
      [ID_1, { ordine: 2 }],
    ]);
    for (const pas of pasi) {
      expect(areFiltru(pas, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(pas, "is", "deleted_at", null)).toBe(true);
      expect(pas.selectDupaScriere).toBeDefined();
    }
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("în jos: vecina e cea de dedesubt (ordine strict mai mare, crescător)", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    programeazaCitiri(server, { id: ID_2, ordine: 4 });
    for (let i = 0; i < 3; i += 1) server.raspunde("course_items", "update", { data: { id: "x" } });

    const r = await mutaLectie({ id: ID_1, directie: "jos" });

    expect(r.ok).toBe(true);
    const [, vecina] = server.apeluriPe("course_items", "select");
    expect(argumenteFiltru(vecina, "gt")).toEqual(["ordine", 3]);
    expect(argumenteFiltru(vecina, "order")).toEqual(["ordine", { ascending: true }]);
    expect(server.apeluriPe("course_items", "update").map((p) => p.payload)).toEqual([
      { ordine: 6 },
      { ordine: 3 },
      { ordine: 4 },
    ]);
  });

  it("fără maxim citit, parcarea cade pe ordinea lecției curente + 1", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    programeazaCitiri(server, { id: ID_2, ordine: 2 }, null);
    for (let i = 0; i < 3; i += 1) server.raspunde("course_items", "update", { data: { id: "x" } });

    const r = await mutaLectie({ id: ID_1, directie: "sus" });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("course_items", "update").map((p) => p.payload)).toEqual([
      { ordine: 4 },
      { ordine: 3 },
      { ordine: 2 },
    ]);
  });

  it("eroare de privilegiu la citirea lecției ⇒ CONFLICT tradus, nu NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_items", "select", { error: eroarePostgrest("42501") });

    const r = await mutaLectie({ id: ID_1, directie: "sus" });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu aveți dreptul de a modifica acest câmp." },
    });
    expect(server.apeluriPe("course_items", "update")).toHaveLength(0);
  });

  it("eroare de privilegiu la citirea vecinei ⇒ CONFLICT tradus, nu „deja prima”", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_items", "select", {
      data: { id: ID_1, course_id: ID_3, ordine: 3 },
    });
    server.raspunde("course_items", "select", { error: eroarePostgrest("42501") });

    const r = await mutaLectie({ id: ID_1, directie: "sus" });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu aveți dreptul de a modifica acest câmp." },
    });
    expect(server.apeluriPe("course_items", "update")).toHaveLength(0);
  });

  it("lecția inexistentă ⇒ NEGASIT, fără nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_items", "select", { data: null });

    const r = await mutaLectie({ id: ID_1, directie: "sus" });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("course_items", "update")).toHaveLength(0);
  });

  it.each([
    ["sus", "Lecția este deja prima."],
    ["jos", "Lecția este deja ultima."],
  ])("fără vecină %s ⇒ CONFLICT „%s”, fără scriere", async (directie, mesaj) => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    programeazaCitiri(server, null);

    const r = await mutaLectie({ id: ID_1, directie });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(server.apeluriPe("course_items", "update")).toHaveLength(0);
  });

  it("parcarea ar depăși plafonul de 500 ⇒ CONFLICT înainte de orice scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    programeazaCitiri(server, { id: ID_2, ordine: 2 }, 500);

    const r = await mutaLectie({ id: ID_1, directie: "sus" });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("loc de manevră") },
    });
    expect(server.apeluriPe("course_items", "update")).toHaveLength(0);
  });

  it.each([
    [0, "nu a pornit", 1],
    [1, "s-a oprit la jumătate", 2],
    [2, "s-a oprit la ultimul pas", 3],
  ])(
    "pasul %s atinge zero rânduri ⇒ CONFLICT care spune unde a rămas ordinea („%s”)",
    async (pasGol, fragment, pasiFacuti) => {
      const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
      programeazaCitiri(server, { id: ID_2, ordine: 2 });
      for (let i = 0; i < 3; i += 1) {
        server.raspunde("course_items", "update", { data: i === pasGol ? null : { id: "x" } });
      }

      const r = await mutaLectie({ id: ID_1, directie: "sus" });

      expect(r).toMatchObject({
        ok: false,
        error: { code: "CONFLICT", message: expect.stringContaining(fragment) },
      });
      expect(server.apeluriPe("course_items", "update")).toHaveLength(pasiFacuti);
      expect(caiRevalidate()).toEqual([]);
    },
  );
});
