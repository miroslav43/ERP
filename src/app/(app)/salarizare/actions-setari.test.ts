// src/app/(app)/salarizare/actions-setari.test.ts
//
// Setările de salarizare (versionate: fiecare salvare INSEREAZĂ o versiune) și
// istoricul de venit introdus manual. Straturile comune ale lui `createAction`
// sunt în testul canonic (`actions.test.ts`). Poarta pe lista de coloane
// moștenite e `setari-complete.test.ts`; aici se verifică COMPORTAMENTUL.

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
  ID_3,
  ORG_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { salveazaIstoricVenit, salveazaSetari } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// ── salveazaSetari ───────────────────────────────────────────────────────────

describe("salveazaSetari", () => {
  const PERMIS = { "payroll:update": "all" } as const;

  const INTRARE = {
    valabil_de_la: "2026-07-01",
    cota_cas: "0.25",
    cota_cass: "0.1",
    cota_impozit: "0.1",
    cota_cam_angajator: "0.0225",
    norma_zilnica_ore: "8",
    procent_spor_noapte: "0.25",
    procent_spor_weekend: "0",
    procent_spor_sarbatoare: "1",
    casa_sanatate_angajator: " cj ",
    functie_declarant: "Administrator",
    procent_ore_suplimentare: "0.75",
    valoare_tichet_masa: "40",
    tichete_impozabile: false,
    tichete_supuse_cass: true,
    salariu_minim_brut: "4050",
    aplica_minim_contributii: true,
    rotunjire_lei: false,
    praguri: [
      {
        nr_persoane_intretinere_min: 0,
        nr_persoane_intretinere_max: 0,
        venit_brut_max: 6050,
        valoare: 810,
      },
      {
        nr_persoane_intretinere_min: 1,
        nr_persoane_intretinere_max: null,
        venit_brut_max: 6050,
        valoare: 1010,
      },
    ],
  };

  /** Ce administrează formularul — cele 18 câmpuri, după coerciția Zod. */
  const SCRISE_DIN_FORMULAR = {
    organization_id: ORG_ID,
    valabil_de_la: "2026-07-01",
    cota_cas: 0.25,
    cota_cass: 0.1,
    cota_impozit: 0.1,
    cota_cam_angajator: 0.0225,
    norma_zilnica_ore: 8,
    procent_spor_noapte: 0.25,
    procent_spor_weekend: 0,
    procent_spor_sarbatoare: 1,
    casa_sanatate_angajator: "CJ",
    functie_declarant: "Administrator",
    procent_ore_suplimentare: 0.75,
    valoare_tichet_masa: 40,
    tichete_impozabile: false,
    tichete_supuse_cass: true,
    salariu_minim_brut: 4050,
    aplica_minim_contributii: true,
    rotunjire_lei: false,
  };

  /** O versiune precedentă cu valori pe care formularul NU le administrează. */
  const PRECEDENTA = {
    plafon_poprire_unica: 0.4,
    plafon_popriri_concurente: 0.5,
    cont_avansuri: "425",
    plata_avans: true,
    ziua_plata_avans: 15,
    tichete_furnizor: "Edenred",
    note: "Confirmat telefonic",
  };

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:update": "team" } });
    const r = await salveazaSetari(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("noua versiune moștenește ce nu administrează formularul și suprascrie restul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_settings", "select", { data: PRECEDENTA });
    server.raspunde("payroll_settings", "insert", { data: { id: ID_1 } });
    server.raspunde("payroll_personal_deduction_brackets", "insert", {});

    const r = await salveazaSetari(INTRARE);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [citire] = server.apeluriPe("payroll_settings", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(citire, "order", "valabil_de_la", { ascending: false })).toBe(true);
    expect(citire?.filtre).toContainEqual({ metoda: "limit", argumente: [1] });
    // Verificarea contabilului NU se moștenește: nu se cere și nu se scrie.
    expect(citire?.coloane).not.toContain("verificat");

    const [insert] = server.apeluriPe("payroll_settings", "insert");
    expect(insert?.payload).toEqual({ ...PRECEDENTA, ...SCRISE_DIN_FORMULAR });
    expect(insert?.selectDupaScriere).toBe("id");
  });

  it("o valoare veche a unui câmp din formular nu bate valoarea nouă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_settings", "select", {
      data: { ...PRECEDENTA, cota_cas: 0.99, organization_id: "altceva" },
    });
    server.raspunde("payroll_settings", "insert", { data: { id: ID_1 } });
    server.raspunde("payroll_personal_deduction_brackets", "insert", {});

    await salveazaSetari(INTRARE);

    const [insert] = server.apeluriPe("payroll_settings", "insert");
    expect(insert?.payload).toMatchObject({ cota_cas: 0.25, organization_id: ORG_ID });
  });

  it("prima salvare (fără versiune precedentă) scrie doar câmpurile formularului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_settings", "select", { data: null });
    server.raspunde("payroll_settings", "insert", { data: { id: ID_1 } });
    server.raspunde("payroll_personal_deduction_brackets", "insert", {});

    await salveazaSetari(INTRARE);

    const [insert] = server.apeluriPe("payroll_settings", "insert");
    expect(insert?.payload).toEqual(SCRISE_DIN_FORMULAR);
  });

  it("pragurile se leagă de versiunea nouă, în ordinea din formular", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_settings", "select", { data: null });
    server.raspunde("payroll_settings", "insert", { data: { id: ID_1 } });
    server.raspunde("payroll_personal_deduction_brackets", "insert", {});

    await salveazaSetari(INTRARE);

    const [praguri] = server.apeluriPe("payroll_personal_deduction_brackets", "insert");
    expect(praguri?.payload).toEqual([
      {
        organization_id: ORG_ID,
        settings_id: ID_1,
        nr_persoane_intretinere_min: 0,
        nr_persoane_intretinere_max: 0,
        venit_brut_max: 6050,
        valoare: 810,
        ordine: 0,
      },
      {
        organization_id: ORG_ID,
        settings_id: ID_1,
        nr_persoane_intretinere_min: 1,
        nr_persoane_intretinere_max: null,
        venit_brut_max: 6050,
        valoare: 1010,
        ordine: 1,
      },
    ]);
    expect(caiRevalidate()).toEqual(["/salarizare/setari"]);
  });

  it("auditul reține doar data de intrare în vigoare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_settings", "select", { data: null });
    server.raspunde("payroll_settings", "insert", { data: { id: ID_1 } });
    server.raspunde("payroll_personal_deduction_brackets", "insert", {});

    await salveazaSetari(INTRARE);
    await asteaptaDupa();

    expect(server.audituri()).toEqual([
      expect.objectContaining({ p_status: "success", p_after: { valabil_de_la: "2026-07-01" } }),
    ]);
  });

  it.each([
    ["cota_cas", "25"],
    ["cota_impozit", "-0.1"],
  ])("cota %s=%s în afara fracției 0–1: VALIDARE pe câmp", async (camp, valoare) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaSetari({ ...INTRARE, [camp]: valoare });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără niciun prag de deducere: VALIDARE pe `praguri`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaSetari({ ...INTRARE, praguri: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("praguri");
    expect(server.apeluri).toHaveLength(0);
  });

  it("versiune deja existentă la aceeași dată (23505): mesajul despre data de intrare în vigoare, fără praguri", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_settings", "select", { data: null });
    server.raspunde("payroll_settings", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "payroll_settings_valabil_uq"',
      ),
    });

    const r = await salveazaSetari(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("aceeași dată") },
    });
    expect(server.apeluriPe("payroll_personal_deduction_brackets")).toHaveLength(0);
  });

  it("eroare la citirea versiunii precedente: nicio versiune nouă — altfel cele 20 de câmpuri moștenite ar cădea pe DEFAULT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_settings", "select", { error: eroarePostgrest("57014") });

    const r = await salveazaSetari(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "EROARE_INTERNA", message: "Operațiunea a durat prea mult și a fost oprită." },
    });
    expect(server.apeluriPe("payroll_settings", "insert")).toHaveLength(0);
    expect(server.apeluriPe("payroll_personal_deduction_brackets")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("prag respins de CHECK (23514): mesajul despre valori imposibile", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_settings", "select", { data: null });
    server.raspunde("payroll_settings", "insert", { data: { id: ID_1 } });
    server.raspunde("payroll_personal_deduction_brackets", "insert", {
      error: eroarePostgrest("23514"),
    });
    // Anularea logică a versiunii fără praguri (compensarea).
    server.raspunde("payroll_settings", "update", { data: null });

    const r = await salveazaSetari(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("valori imposibile") },
    });
  });

  // Versiunea de setări e deja inserată când pragurile cad. Fără compensare
  // rămânea în bază FĂRĂ praguri: calculul lunii lua deducere personală zero,
  // tăcut, iar o nouă salvare la aceeași dată cădea pe `payroll_settings_valabil_uq`.
  const PRAG_INVERSAT = [
    {
      nr_persoane_intretinere_min: 2,
      nr_persoane_intretinere_max: 1,
      venit_brut_max: 6050,
      valoare: 810,
    },
  ];

  /** Programează și căile plauzibile de reparare (anulare prin update sau delete). */
  function programeazaPragRespins(): ReturnType<typeof configureazaActiunea>["server"] {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_settings", "select", { data: null });
    server.raspunde("payroll_settings", "insert", { data: { id: ID_1 } });
    server.raspunde("payroll_personal_deduction_brackets", "insert", {
      error: eroarePostgrest("23514", 'new row violates check constraint "ppdb_persoane_ck"'),
    });
    server.raspunde("payroll_settings", "update", { data: { id: ID_1 } });
    server.raspunde("payroll_settings", "delete", { data: { id: ID_1 } });
    return server;
  }

  it("prag cu maximul sub minim: VALIDARE din formular, nimic scris", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });

    const r = await salveazaSetari({ ...INTRARE, praguri: PRAG_INVERSAT });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(server.apeluri).toHaveLength(0);
  });

  it("pragurile respinse de bază: versiunea de setări abia inserată se anulează logic", async () => {
    const server = programeazaPragRespins();

    // Un prag valid pentru Zod, respins totuși de bază (aici: 23514 forțat).
    const r = await salveazaSetari(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("valori imposibile") },
    });
    expect(server.apeluriPe("payroll_settings", "insert")).toHaveLength(1);
    const [anulare, ...altele] = server.apeluriPe("payroll_settings", "update");
    expect(altele).toHaveLength(0);
    expect(Object.keys(anulare?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(anulare, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(anulare, "eq", "organization_id", ORG_ID)).toBe(true);
  });
});

// ── salveazaIstoricVenit ─────────────────────────────────────────────────────

describe("salveazaIstoricVenit", () => {
  const PERMIS = { "payroll:create": "all" } as const;
  const INTRARE = {
    employee_id: ID_2,
    an: 2025,
    luna: 11,
    venit_brut: "6200",
    drepturi_salariale: "6000",
    zile_lucrate: "20",
    sursa: "Adeverință angajator anterior",
  };
  const CAMPURI = {
    venit_brut: 6200,
    drepturi_salariale: 6000,
    zile_lucrate: 20,
    sursa: "Adeverință angajator anterior",
  };

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:create": "team" } });
    const r = await salveazaIstoricVenit(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("luna nouă: inserează rândul în organizația curentă (citire-apoi-scriere, nu upsert)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_prior_income", "select", { data: null });
    server.raspunde("payroll_prior_income", "insert", { data: { id: ID_1 } });

    const r = await salveazaIstoricVenit(INTRARE);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [citire] = server.apeluriPe("payroll_prior_income", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "eq", "employee_id", ID_2)).toBe(true);
    expect(areFiltru(citire, "eq", "an", 2025)).toBe(true);
    expect(areFiltru(citire, "eq", "luna", 11)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    expect(server.apeluriPe("payroll_prior_income", "upsert")).toHaveLength(0);
    const [insert] = server.apeluriPe("payroll_prior_income", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      employee_id: ID_2,
      an: 2025,
      luna: 11,
      ...CAMPURI,
    });
    expect(caiRevalidate()).toEqual(["/salarizare/istoric-venituri"]);
  });

  it("luna deja introdusă: actualizează rândul existent, fără să-i schimbe angajatul sau luna", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_prior_income", "select", { data: { id: ID_3 } });
    server.raspunde("payroll_prior_income", "update", { data: { id: ID_3 } });

    const r = await salveazaIstoricVenit(INTRARE);

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    expect(server.apeluriPe("payroll_prior_income", "insert")).toHaveLength(0);
    const [update] = server.apeluriPe("payroll_prior_income", "update");
    expect(update?.payload).toEqual(CAMPURI);
    expect(areFiltru(update, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
  });

  it("actualizare cu zero rânduri: CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_prior_income", "select", { data: { id: ID_3 } });
    server.raspunde("payroll_prior_income", "update", { data: null });

    const r = await salveazaIstoricVenit(INTRARE);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("peste 31 de zile lucrate: VALIDARE pe `zile_lucrate`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaIstoricVenit({ ...INTRARE, zile_lucrate: 32 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("zile_lucrate");
    expect(server.apeluri).toHaveLength(0);
  });

  it("42P10 (upsert pe index parțial): mesajul modulului, nu cel generic", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_prior_income", "select", { data: null });
    server.raspunde("payroll_prior_income", "insert", { error: eroarePostgrest("42P10") });

    const r = await salveazaIstoricVenit(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("nu a putut fi rezolvată") },
    });
  });
});
