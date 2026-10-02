// src/app/(app)/concedii/setari/actions.test.ts
//
// Cele șase scrieri de configurare a concediilor. Toate cer scope `all`;
// tipurile reglementate legal sunt păzite în bază (P0001 cu mesaj în română),
// iar grilele de zile suplimentare se creează noi, nu se editează.

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
import {
  actualizeazaTipConcediu,
  aplicaDrepturileConcediu,
  comutaActivTipConcediu,
  creeazaRegulaConcediu,
  dezactiveazaRegulaConcediu,
  seteazaZileConcediuImplicit,
} from "./actions";

const CAI = ["/concedii/setari", "/concedii/sold"];
const ACUM = new Date("2026-03-02T08:00:00Z");
const ACTUALIZARE = { "leave:update": "all" } as const;
const CREARE = { "leave:create": "all" } as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ACUM);
  return () => vi.useRealTimers();
});

describe("pragul de scope: toate cer `all`", () => {
  it.each([
    ["actualizeazaTipConcediu", () => actualizeazaTipConcediu({ id: ID_1 }), "leave:update"],
    [
      "comutaActivTipConcediu",
      () => comutaActivTipConcediu({ id: ID_1, activ: false }),
      "leave:update",
    ],
    ["creeazaRegulaConcediu", () => creeazaRegulaConcediu({}), "leave:create"],
    ["dezactiveazaRegulaConcediu", () => dezactiveazaRegulaConcediu({ id: ID_1 }), "leave:update"],
    [
      "seteazaZileConcediuImplicit",
      () => seteazaZileConcediuImplicit({ zile: 21 }),
      "leave:update",
    ],
    ["aplicaDrepturileConcediu", () => aplicaDrepturileConcediu({ an: 2026 }), "leave:update"],
  ])("%s cu scope `team`: INTERZIS, fără interogări și fără RPC", async (_nume, cheama, cheie) => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: { [cheie]: "team" } });
    const r = await cheama();
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });
});

describe("actualizeazaTipConcediu", () => {
  const intrare = {
    id: ID_1,
    zile_implicite: 23,
    se_reporteaza: true,
    termen_reportare: 18,
    plafon_reportare_zile: 5,
    necesita_document: false,
    mod_rotunjire_acumulare: "matematic",
    culoare: "#2563EB",
  };

  it("succes: UPDATE pe id + organizație + nesters, cu `.select()`, doar câmpurile editabile", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("leave_types", "update", { data: { id: ID_1 } });

    const r = await actualizeazaTipConcediu(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("leave_types");
    expect(apel?.payload).toEqual({
      zile_implicite: 23,
      se_reporteaza: true,
      termen_reportare: 18,
      plafon_reportare_zile: 5,
      necesita_document: false,
      mod_rotunjire_acumulare: "matematic",
      culoare: "#2563EB",
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("tip inexistent sau al altei firme (zero rânduri): NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("leave_types", "update", { data: null });
    const r = await actualizeazaTipConcediu(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("tip reglementat legal: P0001 din trigger ajunge pe ecran cu textul lui", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const mesaj = "Concediul medical este reglementat prin lege și nu poate fi modificat.";
    server.raspunde("leave_types", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await actualizeazaTipConcediu(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("mesajul triggerului se taie la 300 de caractere", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("leave_types", "update", { error: eroarePostgrest("P0001", "x".repeat(400)) });
    const r = await actualizeazaTipConcediu(intrare);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toHaveLength(300);
  });

  it("culoare care nu e cod hexazecimal: VALIDARE pe `culoare`, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const r = await actualizeazaTipConcediu({ ...intrare, culoare: "albastru" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("culoare");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("comutaActivTipConcediu", () => {
  it("succes: scrie doar `activ`, pe id + organizație, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("leave_types", "update", { data: { id: ID_1 } });
    const r = await comutaActivTipConcediu({ id: ID_1, activ: false });
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("leave_types");
    expect(apel?.payload).toEqual({ activ: false });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("leave_types", "update", { data: null });
    const r = await comutaActivTipConcediu({ id: ID_1, activ: true });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("42501 la UPDATE: INTERZIS, nu „tipul nu a fost găsit”", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("leave_types", "update", { error: eroarePostgrest("42501") });
    const r = await comutaActivTipConcediu({ id: ID_1, activ: false });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 la UPDATE (tip reglementat): CONFLICT cu textul triggerului", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const mesaj = "Concediul de odihnă nu poate fi dezactivat.";
    server.raspunde("leave_types", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await comutaActivTipConcediu({ id: ID_1, activ: false });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("creeazaRegulaConcediu", () => {
  const baza = {
    leave_type_id: ID_2,
    zile_suplimentare: 3,
    denumire: "Vechime peste 5 ani",
    valabil_de_la: "2026-01-01",
  };

  it("succes: INSERT cu organizația, discriminantul criteriului și categoria generată", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("leave_entitlement_rules", "insert", { data: { id: ID_1 } });

    const r = await creeazaRegulaConcediu({ ...baza, tip_criteriu: "vechime", vechime_ani_min: 5 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("leave_entitlement_rules");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      leave_type_id: ID_2,
      tip_criteriu: "vechime",
      vechime_ani_min: 5,
      valoare_text: null,
      department_id: null,
      cod_cor: null,
      zile_suplimentare: 3,
      denumire: "Vechime peste 5 ani",
      valabil_de_la: "2026-01-01",
      valabil_pana_la: null,
      categorie: "vechime_5_ani",
    });
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it.each([
    [{ tip_criteriu: "vechime", vechime_ani_min: 0 }, "vechime_0_ani"],
    [{ tip_criteriu: "conditii_munca", valoare_text: "deosebite" }, "conditii_deosebite"],
    [{ tip_criteriu: "conditii_munca", valoare_text: "speciale" }, "conditii_speciale"],
    [{ tip_criteriu: "grad_handicap", valoare_text: "grav" }, "handicap_grav"],
    [{ tip_criteriu: "varsta_sub_18" }, "varsta_sub_18"],
    [{ tip_criteriu: "departament", department_id: ID_2 }, "departament"],
    [{ tip_criteriu: "functie", cod_cor: "251401" }, "functie"],
  ])(
    "criteriul %o produce categoria `%s` (respectă `ler_categorie_ck`)",
    async (criteriu, categorie) => {
      const { server } = configureazaActiunea({ permisiuni: CREARE });
      server.raspunde("leave_entitlement_rules", "insert", { data: { id: ID_1 } });
      const r = await creeazaRegulaConcediu({ ...baza, ...criteriu });
      expect(r.ok).toBe(true);
      const [apel] = server.apeluriPe("leave_entitlement_rules");
      expect(apel?.payload).toMatchObject({ categorie });
      expect(categorie).toMatch(/^[a-z][a-z0-9_]{1,40}$/u);
    },
  );

  it.each([
    ["vechime fără prag de ani", { tip_criteriu: "vechime" }, "vechime_ani_min"],
    [
      "vechime cu departament completat",
      { tip_criteriu: "vechime", vechime_ani_min: 5, department_id: ID_2 },
      "department_id",
    ],
    [
      "condiții de muncă necunoscute",
      { tip_criteriu: "conditii_munca", valoare_text: "grele" },
      "valoare_text",
    ],
    ["handicap fără grad", { tip_criteriu: "grad_handicap" }, "valoare_text"],
    ["departament lipsă", { tip_criteriu: "departament" }, "department_id"],
    ["funcție fără cod COR", { tip_criteriu: "functie" }, "cod_cor"],
    [
      "valabilitate care se termină înainte să înceapă",
      { tip_criteriu: "varsta_sub_18", valabil_pana_la: "2025-12-31" },
      "valabil_pana_la",
    ],
    [
      "zile suplimentare negative",
      { tip_criteriu: "varsta_sub_18", zile_suplimentare: -1 },
      "zile_suplimentare",
    ],
  ])("regula ambiguă (%s): VALIDARE pe câmpul potrivit, fără INSERT", async (_caz, extra, camp) => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await creeazaRegulaConcediu({ ...baza, ...extra });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
  });

  it("P0001 (grilă pe tip reglementat): CONFLICT cu textul triggerului", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const mesaj = "Tipul de concediu este reglementat legal și nu acceptă grile proprii.";
    server.raspunde("leave_entitlement_rules", "insert", {
      error: eroarePostgrest("P0001", mesaj),
    });
    const r = await creeazaRegulaConcediu({ ...baza, tip_criteriu: "varsta_sub_18" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("23505 (regulă duplicată): CONFLICT pe calea generică", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("leave_entitlement_rules", "insert", { error: eroarePostgrest("23505") });
    const r = await creeazaRegulaConcediu({ ...baza, tip_criteriu: "varsta_sub_18" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Există deja o înregistrare cu aceste date." },
    });
  });

  it("auditul poartă id-ul regulii create", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("leave_entitlement_rules", "insert", { data: { id: ID_1 } });
    await creeazaRegulaConcediu({ ...baza, tip_criteriu: "varsta_sub_18" });
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_type: "leave_entitlement_rule",
        p_entity_id: ID_1,
      }),
    ]);
  });
});

describe("dezactiveazaRegulaConcediu", () => {
  it("ștergere logică: `deleted_at` = acum, pe id + organizație + nesters, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("leave_entitlement_rules", "update", { data: { id: ID_1 } });
    const r = await dezactiveazaRegulaConcediu({ id: ID_1 });
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("leave_entitlement_rules");
    expect(apel?.operatie).toBe("update");
    expect(apel?.payload).toEqual({ deleted_at: ACUM.toISOString() });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("regulă deja dezactivată sau invizibilă: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("leave_entitlement_rules", "update", { data: null });
    const r = await dezactiveazaRegulaConcediu({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("42501 la UPDATE: INTERZIS, nu „regula nu a fost găsită”", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("leave_entitlement_rules", "update", { error: eroarePostgrest("42501") });
    const r = await dezactiveazaRegulaConcediu({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 la UPDATE: CONFLICT cu textul triggerului", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const mesaj = "Grila legală nu se poate dezactiva.";
    server.raspunde("leave_entitlement_rules", "update", {
      error: eroarePostgrest("P0001", mesaj),
    });
    const r = await dezactiveazaRegulaConcediu({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("seteazaZileConcediuImplicit", () => {
  it("succes: RPC dedicat cu organizația din sesiune, nu UPDATE pe `organizations`", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspundeRpc("seteaza_zile_concediu_implicit", { data: null });
    const r = await seteazaZileConcediuImplicit({ zile: 23 });
    expect(r).toEqual({ ok: true, data: { organizationId: ORG_ID } });
    expect(server.apeluriRpc).toContainEqual({
      nume: "seteaza_zile_concediu_implicit",
      argumente: { p_organization_id: ORG_ID, p_zile: 23 },
    });
    expect(server.apeluriPe("organizations")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([...CAI, "/setari/organizatie"]);
  });

  it.each([-1, 61, 20.5])("zile = %s: VALIDARE, fără RPC", async (zile) => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const r = await seteazaZileConcediuImplicit({ zile });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("P0001 din funcție: CONFLICT cu textul ei", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const mesaj = "Minimul legal este de 20 de zile lucrătoare.";
    server.raspundeRpc("seteaza_zile_concediu_implicit", {
      error: eroarePostgrest("P0001", mesaj),
    });
    const r = await seteazaZileConcediuImplicit({ zile: 10 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("aplicaDrepturileConcediu", () => {
  it("succes: RPC fără simulare, întoarce câte solduri s-au modificat", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspundeRpc("aplica_drepturi_concediu", {
      data: [{ employee_id: ID_1 }, { employee_id: ID_2 }],
    });
    const r = await aplicaDrepturileConcediu({ an: 2026 });
    expect(r).toEqual({ ok: true, data: { modificate: 2 } });
    expect(server.apeluriRpc).toContainEqual({
      nume: "aplica_drepturi_concediu",
      argumente: { p_organization_id: ORG_ID, p_an: 2026, p_simulare: false },
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("nimic de modificat (rezultat null): 0, nu eroare", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspundeRpc("aplica_drepturi_concediu", { data: null });
    const r = await aplicaDrepturileConcediu({ an: 2026 });
    expect(r).toEqual({ ok: true, data: { modificate: 0 } });
  });

  it("an în afara intervalului acceptat: VALIDARE, fără RPC", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const r = await aplicaDrepturileConcediu({ an: 1999 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("eroare necunoscută din funcție: EROARE_INTERNA, textul brut nu iese", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspundeRpc("aplica_drepturi_concediu", {
      error: eroarePostgrest("XX000", "detaliu intern din plpgsql"),
    });
    const r = await aplicaDrepturileConcediu({ an: 2026 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("EROARE_INTERNA");
    expect(r.error.message).not.toContain("plpgsql");
  });
});
