// src/app/(app)/diurna/actions-etape-cheltuieli.test.ts
//
// Ce se atașează unei deplasări (etape de traseu, cheltuieli), decizia asupra
// unei cheltuieli și versiunea nouă de politică. Straturile comune ale lui
// `createAction` sunt în `salarizare/actions.test.ts`.

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
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  adaugaCheltuiala,
  adaugaEtapa,
  creeazaPolitica,
  decideCheltuiala,
  stergeCheltuiala,
  stergeEtapa,
} from "./actions";

const ACUM = "2026-09-15T10:00:00.000Z";
const CAI_PORTAL = ["/portal", "/portal/diurna-mea"];
const ACTUALIZARE_OWN = { "per_diem:update": "own" } as const;

const etapa = (modificari: Record<string, unknown> = {}) => ({
  business_trip_id: ID_1,
  from_country_id: ID_2,
  to_country_id: ID_3,
  plecare_la: "2026-09-10T08:00",
  sosire_la: "2026-09-10T12:00",
  mijloc_transport: "avion",
  ...modificari,
});

const cheltuiala = (modificari: Record<string, unknown> = {}) => ({
  business_trip_id: ID_1,
  tip: "cazare",
  data_cheltuielii: "2026-09-10",
  suma: "120.5",
  moneda: "eur",
  curs_valutar: "4.97",
  ...modificari,
});

const politica = (modificari: Record<string, unknown> = {}) => ({
  denumire: "Politica 2026",
  country_id_intern: ID_2,
  moneda_interna: "ron",
  diurna_interna_zi: "50",
  diurna_externa_zi: null,
  moneda_diurna_externa: "EUR",
  mod_calcul_zile: "ferestre_24h",
  ore_minime: "12",
  tarif_km_auto_personal: "0.5",
  valabil_de_la: "2026-01-01",
  ...modificari,
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(ACUM));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("adaugaEtapa", () => {
  it("fără `per_diem:update`: INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:create": "all" } });
    const r = await adaugaEtapa(etapa());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: `ordine` = ultima etapă vie + 1, inserată în organizația curentă", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    server.raspunde("business_trip_legs", "select", { data: { ordine: 2 } });
    server.raspunde("business_trip_legs", "insert", { data: { id: ID_2 } });

    const r = await adaugaEtapa(etapa());

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [citire, insert] = server.apeluriPe("business_trip_legs");
    expect(areFiltru(citire, "eq", "business_trip_id", ID_1)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(citire, "order", "ordine", { ascending: false })).toBe(true);
    // Fără `.limit(1)`, `.maybeSingle()` cade cu PGRST116 de la a doua etapă încolo.
    expect(citire?.filtre.some((f) => f.metoda === "limit" && f.argumente[0] === 1)).toBe(true);
    expect(insert?.operatie).toBe("insert");
    // Fără RETURNING, `data` e null după ce rândul s-a scris deja: reîncercarea dublează etapa.
    expect(insert?.selectDupaScriere).toBe("id");
    expect(insert?.terminal).toBe("single");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG_ID,
      business_trip_id: ID_1,
      ordine: 3,
      plecare_la: "2026-09-10T05:00:00.000Z",
      sosire_la: "2026-09-10T09:00:00.000Z",
      mijloc_transport: "avion",
    });
    expect(caiRevalidate()).toEqual(["/diurna", ...CAI_PORTAL]);
  });

  it("prima etapă a deplasării primește `ordine` 1", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    server.raspunde("business_trip_legs", "select", { data: null });
    server.raspunde("business_trip_legs", "insert", { data: { id: ID_2 } });
    await adaugaEtapa(etapa());
    expect(server.apeluriPe("business_trip_legs", "insert")[0]?.payload).toMatchObject({
      ordine: 1,
    });
  });

  it("refuzul de încadrare în deplasare ajunge pe plecare și sosire", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    server.raspunde("business_trip_legs", "select", { data: null });
    const mesaj = "Etapa trebuie să se încadreze în intervalul deplasării.";
    server.raspunde("business_trip_legs", "insert", { error: eroarePostgrest("P0001", mesaj) });

    const r = await adaugaEtapa(etapa());

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE", message: mesaj } });
    if (r.ok) return;
    expect(r.error.fieldErrors).toEqual({ plecare_la: [mesaj], sosire_la: [mesaj] });
  });

  it("refuzul „țări diferite” ajunge pe țara de sosire", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    server.raspunde("business_trip_legs", "select", { data: null });
    const mesaj = "O etapă trebuie să lege două țări diferite.";
    server.raspunde("business_trip_legs", "insert", { error: eroarePostgrest("P0001", mesaj) });

    const r = await adaugaEtapa(etapa());

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toEqual({ to_country_id: [mesaj] });
  });

  it("alt P0001 rămâne mesaj general, iar 23505 pe ordine cere reîncercare", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    server.raspunde("business_trip_legs", "select", { data: null });
    server.raspunde("business_trip_legs", "insert", {
      error: eroarePostgrest("P0001", "Deplasarea nu mai poate fi modificată."),
    });
    const r1 = await adaugaEtapa(etapa());
    expect(r1).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Deplasarea nu mai poate fi modificată.",
        fieldErrors: null,
      },
    });

    server.raspunde("business_trip_legs", "select", { data: { ordine: 1 } });
    server.raspunde("business_trip_legs", "insert", { error: eroarePostgrest("23505") });
    const r2 = await adaugaEtapa(etapa());
    expect(r2).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r2.ok) return;
    expect(r2.error.message).toContain("reîncercați");
  });

  it("aceeași țară la plecare și sosire e respinsă de schemă, înainte de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    const r = await adaugaEtapa(etapa({ to_country_id: ID_2 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("to_country_id");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("stergeEtapa", () => {
  it("fără `per_diem:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:delete": "all" } });
    const r = await stergeEtapa({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: ștergere logică a unei etape încă vii", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    server.raspunde("business_trip_legs", "update", { data: { id: ID_1 } });

    const r = await stergeEtapa({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("business_trip_legs");
    expect(apel?.payload).toEqual({ deleted_at: ACUM });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/diurna", ...CAI_PORTAL]);
  });

  it("zero rânduri (deja scoasă): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    server.raspunde("business_trip_legs", "update", { data: null });
    const r = await stergeEtapa({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("adaugaCheltuiala", () => {
  it("fără `per_diem:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "all" } });
    const r = await adaugaCheltuiala(cheltuiala());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: sumele convertite, moneda cu majuscule, fără câmpurile de aprobare", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: ACTUALIZARE_OWN });
    server.raspunde("trip_expenses", "insert", { data: { id: ID_2 } });

    const r = await adaugaCheltuiala(cheltuiala());

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("trip_expenses");
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.terminal).toBe("single");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      business_trip_id: ID_1,
      tip: "cazare",
      suma: 120.5,
      moneda: "EUR",
      curs_valutar: 4.97,
    });
    for (const camp of ["suma_lei", "aprobata", "aprobata_de", "aprobata_la", "motiv_respingere"]) {
      expect(apel?.payload).not.toHaveProperty(camp);
    }
    expect(caiRevalidate()).toEqual(["/diurna", ...CAI_PORTAL]);
  });

  it("o sumă de zero e respinsă de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    const r = await adaugaCheltuiala(cheltuiala({ suma: "0" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("suma");
    expect(server.apeluri).toHaveLength(0);
  });

  it("P0001 din `valideaza_cheltuiala_deplasare`: mesajul bazei, CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    const mesaj = "Cheltuiala trebuie să fie din perioada deplasării.";
    server.raspunde("trip_expenses", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await adaugaCheltuiala(cheltuiala());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("stergeCheltuiala", () => {
  it("fără `per_diem:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: {} });
    const r = await stergeCheltuiala({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: se șterge logic doar o cheltuială neaprobată, încă vie", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    server.raspunde("trip_expenses", "update", { data: { id: ID_1 } });

    const r = await stergeCheltuiala({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("trip_expenses");
    expect(apel?.payload).toEqual({ deleted_at: ACUM });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "aprobata", false)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
  });

  it("zero rânduri (aprobată sau deja scoasă): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE_OWN });
    server.raspunde("trip_expenses", "update", { data: null });
    const r = await stergeCheltuiala({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("decideCheltuiala", () => {
  it("scope `own` pe `per_diem:approve` (sub `team`): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "own" } });
    const r = await decideCheltuiala({ id: ID_1, decizie: "aproba" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("aprobarea scrie tripletul complet: steag, aprobator din sesiune, moment", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "team" } });
    server.raspunde("trip_expenses", "update", { data: { id: ID_1 } });

    const r = await decideCheltuiala({ id: ID_1, decizie: "aproba", motiv_respingere: "ignorat" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("trip_expenses");
    expect(apel?.payload).toEqual({
      aprobata: true,
      aprobata_de: USER_ID,
      aprobata_la: ACUM,
      motiv_respingere: null,
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/diurna", ...CAI_PORTAL]);
  });

  it("respingerea golește tripletul și păstrează motivul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "all" } });
    server.raspunde("trip_expenses", "update", { data: { id: ID_1 } });

    await decideCheltuiala({ id: ID_1, decizie: "respinge", motiv_respingere: "Bon ilizibil" });

    expect(server.apeluriPe("trip_expenses")[0]?.payload).toEqual({
      aprobata: false,
      aprobata_de: null,
      aprobata_la: null,
      motiv_respingere: "Bon ilizibil",
    });
  });

  it.each([[undefined], [""], ["   "]])(
    "respingerea fără motiv scris (%j): CONFLICT, nicio scriere",
    async (motiv) => {
      const { server } = configureazaActiunea({ permisiuni: { "per_diem:approve": "all" } });
      const r = await decideCheltuiala({ id: ID_1, decizie: "respinge", motiv_respingere: motiv });
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      expect(server.apeluriPe("trip_expenses")).toHaveLength(0);
    },
  );

  it("zero rânduri (WITH CHECK cere și `update`): CONFLICT care numește cauza", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "per_diem:approve": "team" },
    });
    server.raspunde("trip_expenses", "update", { data: null });
    const r = await decideCheltuiala({ id: ID_1, decizie: "aproba" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("dreptul de modificare");
  });
});

describe("creeazaPolitica", () => {
  it("scope `team` pe `per_diem:update` (sub `all`): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "team" } });
    const r = await creeazaPolitica(politica());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: doar ce decide firma, restul pus de acțiune", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "all" } });
    server.raspunde("per_diem_policies", "insert", { data: { id: ID_3 } });

    const r = await creeazaPolitica(politica());

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("per_diem_policies");
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.terminal).toBe("single");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      moneda_interna: "RON",
      diurna_interna_zi: 50,
      // Fără sumă externă fixă, moneda ei nu se scrie, chiar dacă formularul o trimite.
      diurna_externa_zi: null,
      moneda_diurna_externa: null,
      categorie_barem: "II",
      prag_ore_minim: 12,
      prag_ore_zi_intreaga: 12,
      moneda_tarif_km: "RON",
      tarif_km_auto_personal: 0.5,
      valabil_de_la: "2026-01-01",
      acorda_diurna_ziua_trecerii: true,
      regula_tara_trecere: "tara_sosire",
    });
    expect(apel?.payload).not.toHaveProperty("valabil_pana");
    expect(caiRevalidate()).toEqual([
      "/diurna/politica",
      "/diurna",
      "/diurna/noua",
      ...CAI_PORTAL,
      "/portal/diurna-mea/noua",
    ]);
  });

  it("cu sumă externă fixă, moneda ei se scrie", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "all" } });
    server.raspunde("per_diem_policies", "insert", { data: { id: ID_3 } });
    await creeazaPolitica(politica({ diurna_externa_zi: 40, moneda_diurna_externa: "eur" }));
    expect(server.apeluriPe("per_diem_policies")[0]?.payload).toMatchObject({
      diurna_externa_zi: 40,
      moneda_diurna_externa: "EUR",
    });
  });

  it("suma externă fără monedă e respinsă de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "all" } });
    const r = await creeazaPolitica(
      politica({ diurna_externa_zi: 40, moneda_diurna_externa: null }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("moneda_diurna_externa");
    expect(server.apeluri).toHaveLength(0);
  });

  it("23505 (o versiune pe zi): eroarea stă pe `valabil_de_la`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "all" } });
    server.raspunde("per_diem_policies", "insert", { error: eroarePostgrest("23505") });
    const r = await creeazaPolitica(politica());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["valabil_de_la"]);
  });

  it("P0001 (nicio lege încărcată la dată): mesajul bazei, pe `valabil_de_la`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "all" } });
    const mesaj = "Nu există valori legale de diurnă valabile la 01.01.1990.";
    server.raspunde("per_diem_policies", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await creeazaPolitica(politica());
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", message: mesaj, fieldErrors: { valabil_de_la: [mesaj] } },
    });
  });

  it("42501: INTERZIS pe calea generică, nu pe câmp", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "per_diem:update": "all" } });
    server.raspunde("per_diem_policies", "insert", { error: eroarePostgrest("42501") });
    const r = await creeazaPolitica(politica());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS", fieldErrors: null } });
  });
});
