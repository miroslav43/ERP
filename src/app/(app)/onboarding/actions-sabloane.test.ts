// src/app/(app)/onboarding/actions-sabloane.test.ts
//
// Autorarea șabloanelor: salvarea atomică din asistent (RPC), antetul,
// pașii unul câte unul și reordonarea prin poziția de „parcare”.

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
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  actualizeazaPas,
  actualizeazaSablon,
  adaugaPas,
  creeazaSablon,
  mutaPas,
  salveazaSablon,
  stergePas,
} from "./actions";

const CREARE = { "checklists:create": "all" } as const;
const EDITARE = { "checklists:update": "all" } as const;
const MATERIAL = "88888888-8888-4888-8888-888888888888";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const antet = {
  denumire: "  Integrare IT  ",
  tip: "onboarding",
  valabil_de_la: "2026-01-01",
} as const;

// ── poarta de modul ────────────────────────────────────────────────────────

describe("poarta de modul `onboarding`", () => {
  it.each([
    ["salveazaSablon", () => salveazaSablon({ ...antet, etape: [] }), CREARE],
    ["creeazaSablon", () => creeazaSablon(antet), CREARE],
    ["actualizeazaSablon", () => actualizeazaSablon({ ...antet, id: ID_1 }), EDITARE],
    [
      "adaugaPas",
      () => adaugaPas({ template_id: ID_1, titlu: "Pas", responsabil_rol: "hr" }),
      CREARE,
    ],
    [
      "actualizeazaPas",
      () => actualizeazaPas({ id: ID_2, titlu: "Pas", responsabil_tip: "subiect" }),
      EDITARE,
    ],
    ["stergePas", () => stergePas({ id: ID_2 }), EDITARE],
    ["mutaPas", () => mutaPas({ id: ID_2, directie: "sus" }), EDITARE],
  ] as const)(
    "%s: cu modulul oprit, MODUL_DEZACTIVAT chiar și cu permisiunea la `all`",
    async (_nume, apel, permisiuni) => {
      const { server } = configureazaActiunea({ functii: [], permisiuni });
      const r = await apel();
      expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
      expect(server.apeluri).toHaveLength(0);
      expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
    },
  );
});

// ── salveazaSablon ─────────────────────────────────────────────────────────

describe("salveazaSablon", () => {
  const intrare = {
    ...antet,
    etape: [
      { titlu: "Prima zi", pasi: [{ titlu: "Primește laptopul", responsabil_tip: "subiect" }] },
    ],
  };

  it("cere `checklists:create` la `all`: `team` nu ajunge, nu se cheamă RPC-ul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:create": "team" } });
    const r = await salveazaSablon(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("trimite șablonul ÎNTREG, validat, într-un singur apel RPC și întoarce id-ul", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspundeRpc("checklist_salveaza_sablon", { data: ID_1 });

    const r = await salveazaSablon(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const apeluri = server.apeluriRpc.filter((a) => a.nume === "checklist_salveaza_sablon");
    expect(apeluri).toHaveLength(1);
    const sablon = (apeluri[0]?.argumente as { p_sablon: Record<string, unknown> }).p_sablon;
    // Ieșirea Zod, nu intrarea brută: denumirea curățată, implicitele puse.
    expect(sablon).toMatchObject({ denumire: "Integrare IT", activ: true, pasi_fara_etapa: [] });
    expect(sablon.etape).toEqual([
      expect.objectContaining({
        titlu: "Prima zi",
        termen_zile_relativ: 0,
        pasi: [expect.objectContaining({ titlu: "Primește laptopul", obligatoriu: true })],
      }),
    ]);
    // Nicio scriere directă pe tabele: totul trece prin tranzacția funcției.
    expect(server.apeluri).toHaveLength(0);
    expect(caiRevalidate()).toEqual(["/onboarding/sabloane"]);
  });

  it("un șablon fără niciun pas: VALIDARE pe `etape`, înaintea bazei (D10)", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await salveazaSablon({ ...antet, etape: [{ titlu: "Goală", pasi: [] }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors?.etape?.[0]).toContain("fără niciun pas");
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("verificare automată neimplementată (`acces_revocat`): respinsă de schemă (D4)", async () => {
    configureazaActiunea({ permisiuni: CREARE });
    const r = await salveazaSablon({
      ...antet,
      pasi_fara_etapa: [
        { titlu: "Acces", responsabil_tip: "subiect", verificare_automata: "acces_revocat" },
      ],
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
  });

  it("RPC-ul întoarce null: CONFLICT, nu succes cu id gol", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspundeRpc("checklist_salveaza_sablon", { data: null });
    const r = await salveazaSablon(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Șablonul nu a putut fi salvat." },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("23505 pe denumire: mesajul despre denumire, nu unul generic", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspundeRpc("checklist_salveaza_sablon", {
      error: eroarePostgrest("23505", "dup", 'Key "checklist_templates_denumire_uk"'),
    });
    const r = await salveazaSablon(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Există deja un șablon cu această denumire pentru tipul ales.",
      },
    });
  });
});

// ── creeazaSablon ──────────────────────────────────────────────────────────

describe("creeazaSablon", () => {
  it("cere `checklists:create`: fără cheie, refuz", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    const r = await creeazaSablon(antet);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cere `checklists:create` la `all`: `team` nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:create": "team" } });
    const r = await creeazaSablon(antet);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("inserează antetul în organizația din sesiune, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("checklist_templates", "insert", { data: { id: ID_1 } });

    const r = await creeazaSablon(antet);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("checklist_templates", "insert");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      denumire: "Integrare IT",
      tip: "onboarding",
      valabil_de_la: "2026-01-01",
      valabil_pana_la: null,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/onboarding/sabloane"]);
  });

  it.each([
    ["egal cu începutul", "2026-01-01"],
    ["înaintea începutului", "2025-12-31"],
  ])("sfârșitul valabilității %s: VALIDARE pe `valabil_pana_la`", async (_caz, sfarsit) => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await creeazaSablon({ ...antet, valabil_pana_la: sfarsit });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("valabil_pana_la");
    expect(server.apeluri).toHaveLength(0);
  });

  it("23505 pe denumire: mesajul despre denumire", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("checklist_templates", "insert", {
      error: eroarePostgrest("23505", "dup", "checklist_templates_denumire_uk"),
    });
    const r = await creeazaSablon(antet);
    expect(r).toMatchObject({
      ok: false,
      error: { message: "Există deja un șablon cu această denumire pentru tipul ales." },
    });
  });
});

// ── actualizeazaSablon ─────────────────────────────────────────────────────

describe("actualizeazaSablon", () => {
  const intrare = { ...antet, id: ID_1 };

  it("cere `checklists:update = all`: `create` singur nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await actualizeazaSablon(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cere `checklists:update` la `all`: `team` nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:update": "team" } });
    const r = await actualizeazaSablon(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("UPDATE pe id + organizație, fără `id` în payload, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("checklist_templates", "update", { data: { id: ID_1 } });

    const r = await actualizeazaSablon(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("checklist_templates", "update");
    expect(apel?.payload).not.toHaveProperty("id");
    expect(apel?.payload).not.toHaveProperty("organization_id");
    expect(apel?.payload).toMatchObject({ denumire: "Integrare IT", tip: "onboarding" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual([`/onboarding/sabloane/${ID_1}`, "/onboarding/sabloane"]);
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("checklist_templates", "update", { data: null });
    const r = await actualizeazaSablon(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "NEGASIT", message: "Șablonul nu a fost găsit." },
    });
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── adaugaPas ──────────────────────────────────────────────────────────────

describe("adaugaPas", () => {
  const intrare = { template_id: ID_1, titlu: "Semnează regulamentul", responsabil_rol: "hr" };

  it("cere `checklists:create`: fără cheie, refuz", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    const r = await adaugaPas(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cere `checklists:create` la `all`: `team` nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:create": "team" } });
    const r = await adaugaPas(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("pune pasul la coadă: ordine = max + 1, citit doar din pașii vii ai șablonului", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("checklist_template_items", "select", { data: { ordine: 7 } });
    server.raspunde("checklist_template_items", "insert", { data: { id: ID_2 } });

    const r = await adaugaPas(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [max] = server.apeluriPe("checklist_template_items", "select");
    expect(areFiltru(max, "eq", "template_id", ID_1)).toBe(true);
    expect(areFiltru(max, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(max, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(max, "order", "ordine", { ascending: false })).toBe(true);

    const [insert] = server.apeluriPe("checklist_template_items", "insert");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG_ID,
      template_id: ID_1,
      ordine: 8,
      titlu: "Semnează regulamentul",
      responsabil_tip: "rol",
      responsabil_rol: "hr",
      obligatoriu: true,
      tip_dovada: "bifa",
    });
    expect(caiRevalidate()).toEqual([`/onboarding/sabloane/${ID_1}`]);
  });

  it("primul pas al unui șablon gol primește ordinea 1", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("checklist_template_items", "select", { data: null });
    server.raspunde("checklist_template_items", "insert", { data: { id: ID_2 } });
    await adaugaPas(intrare);
    expect(server.apeluriPe("checklist_template_items", "insert")[0]?.payload).toMatchObject({
      ordine: 1,
    });
  });

  it("pasul 500 încă intră; al 501-lea e refuzat înaintea bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("checklist_template_items", "select", { data: { ordine: 499 } });
    server.raspunde("checklist_template_items", "insert", { data: { id: ID_2 } });
    expect((await adaugaPas(intrare)).ok).toBe(true);

    const { server: s2 } = configureazaActiunea({ permisiuni: CREARE });
    s2.raspunde("checklist_template_items", "select", { data: { ordine: 500 } });
    const r = await adaugaPas(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("limita de 500");
    expect(s2.apeluriPe("checklist_template_items", "insert")).toHaveLength(0);
  });

  it("combinație de responsabil invalidă (tip `rol` fără rol): VALIDARE, fără citire", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await adaugaPas({ template_id: ID_1, titlu: "Pas", responsabil_tip: "rol" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("responsabil_tip");
    expect(server.apeluri).toHaveLength(0);
  });

  it("23505 pe poziție (concurență): mesaj despre poziție, nu despre denumire", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("checklist_template_items", "select", { data: { ordine: 2 } });
    server.raspunde("checklist_template_items", "insert", {
      error: eroarePostgrest("23505", "dup", "checklist_template_items_ordine_uk"),
    });
    const r = await adaugaPas(intrare);
    expect(r.ok ? "" : r.error.message).toContain("aceeași poziție");
  });

  it("materialul de citit acceptat și validat de schemă ajunge în rândul inserat", async () => {
    // `adaugaPasSchema` primește `material_id` și îi verifică combinația
    // (`_material_ck`), dar handlerul nu-l trimite: pasul se creează fără
    // material, iar acțiunea raportează succes.
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("checklist_template_items", "select", { data: { ordine: 1 } });
    server.raspunde("checklist_template_items", "insert", { data: { id: ID_2 } });
    const r = await adaugaPas({ ...intrare, material_id: MATERIAL });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("checklist_template_items", "insert")[0]?.payload).toMatchObject({
      material_id: MATERIAL,
    });
  });
});

// ── actualizeazaPas ────────────────────────────────────────────────────────

describe("actualizeazaPas", () => {
  const intrare = { id: ID_2, titlu: "Predă cheile", responsabil_tip: "manager_direct" };

  it("cere `checklists:update`: `create` singur nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await actualizeazaPas(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cere `checklists:update` la `all`: `team` nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:update": "team" } });
    const r = await actualizeazaPas(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("rescrie câmpurile pasului fără să atingă ordinea; revalidează șablonul din RETURNING", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("checklist_template_items", "update", {
      data: { id: ID_2, template_id: ID_3 },
    });

    const r = await actualizeazaPas(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2, template_id: ID_3 } });
    const [apel] = server.apeluriPe("checklist_template_items", "update");
    expect(apel?.payload).toMatchObject({
      titlu: "Predă cheile",
      responsabil_tip: "manager_direct",
      responsabil_rol: null,
      responsabil_employee_id: null,
    });
    expect(apel?.payload).not.toHaveProperty("ordine");
    expect(apel?.payload).not.toHaveProperty("template_id");
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toContain("template_id");
    expect(caiRevalidate()).toEqual([`/onboarding/sabloane/${ID_3}`]);
  });

  it("verificare `curs_finalizat` fără curs: VALIDARE pe `curs_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    const r = await actualizeazaPas({ ...intrare, verificare_automata: "curs_finalizat" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("curs_id");
    expect(server.apeluri).toHaveLength(0);
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("checklist_template_items", "update", { data: null });
    const r = await actualizeazaPas(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });
});

// ── stergePas ──────────────────────────────────────────────────────────────

describe("stergePas", () => {
  it("cere `checklists:update = all`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:update": "team" } });
    const r = await stergePas({ id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("ștergerea e LOGICĂ: UPDATE cu `deleted_at`, niciodată DELETE", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("checklist_template_items", "update", {
      data: { id: ID_2, template_id: ID_3 },
    });

    const inainte = Date.now();
    const r = await stergePas({ id: ID_2 });

    expect(r).toEqual({ ok: true, data: { id: ID_2, template_id: ID_3 } });
    expect(server.apeluriPe("checklist_template_items", "delete")).toHaveLength(0);
    const [apel] = server.apeluriPe("checklist_template_items", "update");
    const payload = apel?.payload as { deleted_at: string };
    expect(Object.keys(payload)).toEqual(["deleted_at"]);
    expect(Date.parse(payload.deleted_at)).toBeGreaterThanOrEqual(inainte - 1000);
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual([`/onboarding/sabloane/${ID_3}`]);
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("checklist_template_items", "update", { data: null });
    const r = await stergePas({ id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });
});

// ── mutaPas ────────────────────────────────────────────────────────────────

describe("mutaPas", () => {
  const VECIN = "99999999-9999-4999-8999-999999999999";

  /** Programează citirile: pasul curent (ordinea 3), vecinul și maximul. */
  function citiri(
    server: ReturnType<typeof configureazaActiunea>["server"],
    vecin: { id: string; ordine: number } | null,
    max = 9,
  ): void {
    server.raspunde("checklist_template_items", "select", {
      data: { id: ID_2, template_id: ID_1, ordine: 3 },
    });
    server.raspunde("checklist_template_items", "select", { data: vecin });
    server.raspunde("checklist_template_items", "select", { data: { ordine: max } });
  }

  it("cere `checklists:update` la `all`: `team` nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:update": "team" } });
    const r = await mutaPas({ id: ID_2, directie: "sus" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("„sus”: schimbă locul cu vecinul de deasupra, trecând prin parcare (max + 1)", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    citiri(server, { id: VECIN, ordine: 2 });
    server.raspunde("checklist_template_items", "update", { data: { id: ID_2 } });
    server.raspunde("checklist_template_items", "update", { data: { id: VECIN } });
    server.raspunde("checklist_template_items", "update", { data: { id: ID_2 } });

    const r = await mutaPas({ id: ID_2, directie: "sus" });

    expect(r).toEqual({ ok: true, data: { id: ID_2, template_id: ID_1 } });
    const [curent, vecin, max] = server.apeluriPe("checklist_template_items", "select");
    expect(areFiltru(curent, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(curent, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(curent, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(vecin, "eq", "template_id", ID_1)).toBe(true);
    expect(areFiltru(vecin, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(vecin, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(vecin, "lt", "ordine", 3)).toBe(true);
    expect(areFiltru(vecin, "order", "ordine", { ascending: false })).toBe(true);
    // Parcarea se calculează din maximul pașilor VII ai aceluiași șablon.
    expect(areFiltru(max, "eq", "template_id", ID_1)).toBe(true);
    expect(areFiltru(max, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(max, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(max, "order", "ordine", { ascending: false })).toBe(true);

    const scrieri = server.apeluriPe("checklist_template_items", "update");
    expect(scrieri.map((s) => s.payload)).toEqual([{ ordine: 10 }, { ordine: 3 }, { ordine: 2 }]);
    expect(scrieri.map((s) => s.filtre.find((f) => f.argumente[0] === "id")?.argumente[1])).toEqual(
      [ID_2, VECIN, ID_2],
    );
    for (const s of scrieri) {
      expect(areFiltru(s, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(s.selectDupaScriere).toBeDefined();
    }
    expect(caiRevalidate()).toEqual([`/onboarding/sabloane/${ID_1}`]);
  });

  it("„jos”: caută vecinul cu ordine mai mare, crescător", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    citiri(server, { id: VECIN, ordine: 4 });
    server.raspunde("checklist_template_items", "update", { data: { id: ID_2 } });
    server.raspunde("checklist_template_items", "update", { data: { id: VECIN } });
    server.raspunde("checklist_template_items", "update", { data: { id: ID_2 } });

    const r = await mutaPas({ id: ID_2, directie: "jos" });

    expect(r.ok).toBe(true);
    const [, vecin] = server.apeluriPe("checklist_template_items", "select");
    expect(areFiltru(vecin, "gt", "ordine", 3)).toBe(true);
    expect(areFiltru(vecin, "order", "ordine", { ascending: true })).toBe(true);
    expect(server.apeluriPe("checklist_template_items", "update").map((s) => s.payload)).toEqual([
      { ordine: 10 },
      { ordine: 3 },
      { ordine: 4 },
    ]);
  });

  it("pasul nu există: NEGASIT, fără nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("checklist_template_items", "select", { data: null });
    const r = await mutaPas({ id: ID_2, directie: "sus" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("checklist_template_items", "update")).toHaveLength(0);
  });

  it.each([
    ["sus", "Pasul este deja primul din listă."],
    ["jos", "Pasul este deja ultimul din listă."],
  ] as const)("fără vecin în direcția „%s”: CONFLICT, fără scriere", async (directie, mesaj) => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    server.raspunde("checklist_template_items", "select", {
      data: { id: ID_2, template_id: ID_1, ordine: 3 },
    });
    server.raspunde("checklist_template_items", "select", { data: null });
    const r = await mutaPas({ id: ID_2, directie });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(server.apeluriPe("checklist_template_items", "update")).toHaveLength(0);
  });

  it("parcarea ar depăși 500: CONFLICT, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    citiri(server, { id: VECIN, ordine: 2 }, 500);
    const r = await mutaPas({ id: ID_2, directie: "sus" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("limita de 500");
    expect(server.apeluriPe("checklist_template_items", "update")).toHaveLength(0);
  });

  it("parcarea respinsă tăcut (zero rânduri): CONFLICT, iar vecinul nu se mai atinge", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    citiri(server, { id: VECIN, ordine: 2 });
    server.raspunde("checklist_template_items", "update", { data: null });
    const r = await mutaPas({ id: ID_2, directie: "sus" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("Ordinea listei a rămas neschimbată");
    expect(server.apeluriPe("checklist_template_items", "update")).toHaveLength(1);
  });

  it("mutarea vecinului eșuează cu eroare: mesajul spune că pasul a rămas la coadă", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    citiri(server, { id: VECIN, ordine: 2 });
    server.raspunde("checklist_template_items", "update", { data: { id: ID_2 } });
    server.raspunde("checklist_template_items", "update", { error: eroarePostgrest("23505") });
    const r = await mutaPas({ id: ID_2, directie: "sus" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("mutarea vecinului a eșuat");
    expect(server.apeluriPe("checklist_template_items", "update")).toHaveLength(2);
  });

  it("vecinul respins tăcut (zero rânduri): CONFLICT, fără a treia scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    citiri(server, { id: VECIN, ordine: 2 });
    server.raspunde("checklist_template_items", "update", { data: { id: ID_2 } });
    server.raspunde("checklist_template_items", "update", { data: null });
    const r = await mutaPas({ id: ID_2, directie: "sus" });
    expect(r.ok ? "" : r.error.message).toContain("pasul vecin nu a putut fi mutat");
    expect(server.apeluriPe("checklist_template_items", "update")).toHaveLength(2);
  });

  it.each([
    ["cu eroare", { error: eroarePostgrest("40001") }, "revenirea pe poziția nouă a eșuat"],
    ["tăcut", { data: null }, "revenirea pe poziția nouă a fost respinsă"],
  ])("revenirea din parcare respinsă %s: CONFLICT cu mesaj propriu", async (_caz, rasp, mesaj) => {
    const { server } = configureazaActiunea({ permisiuni: EDITARE });
    citiri(server, { id: VECIN, ordine: 2 });
    server.raspunde("checklist_template_items", "update", { data: { id: ID_2 } });
    server.raspunde("checklist_template_items", "update", { data: { id: VECIN } });
    server.raspunde("checklist_template_items", "update", rasp);
    const r = await mutaPas({ id: ID_2, directie: "sus" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain(mesaj);
    expect(caiRevalidate()).toEqual([]);
  });
});
