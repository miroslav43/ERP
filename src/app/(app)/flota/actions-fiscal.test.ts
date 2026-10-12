// src/app/(app)/flota/actions-fiscal.test.ts
//
// Fiscalul flotei (0202, F10), pe clientul fals: regimul fiscal al vehiculului,
// norma proprie de consum și regimul de impozitare al firmei. Clientul fals
// prinde filtrul de organizație lipsă, `.select()` uitat și ramurile greșite;
// NU prinde o politică RLS greșită — aceea e în
// `tests/rls/proba-flota-fiscal.sql` și în `izolare.sql` (l), blocul 0202.

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
  adaugaNormaConsum,
  adaugaRegimFiscal,
  salveazaRegimImpozitare,
  stergeNormaConsum,
  stergeRegimFiscal,
} from "./actions-fiscal";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const VEHICUL = ID_2;

const regim = {
  vehicle_id: VEHICUL,
  valabil_de_la: "2026-01-01",
  regim: "limitat_50",
  motiv: "Folosit și în interes personal, deducere 50%.",
};

const norma = {
  vehicle_id: VEHICUL,
  valabil_de_la: "2026-03-01",
  l_100km: "7.5",
  decizie_numar: "DI-12",
  decizie_data: "2026-02-20",
};

describe("adaugaRegimFiscal", () => {
  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicles:update = %s`: INTERZIS, fără niciun drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": scope } });
      const r = await adaugaRegimFiscal(regim);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("INSERT cu firma din tenant și autorul explicit; titlul implicit e proprietatea", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_fiscal_regimes", "insert", { data: { id: ID_1 } });

    const r = await adaugaRegimFiscal(regim);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("vehicle_fiscal_regimes", "insert");
    expect(scriere?.payload).toEqual({
      organization_id: ORG_ID,
      vehicle_id: VEHICUL,
      valabil_de_la: "2026-01-01",
      regim: "limitat_50",
      exceptie: null,
      motiv: "Folosit și în interes personal, deducere 50%.",
      titlu_folosinta: "proprietate",
      proprietar_employee_id: null,
      chirie_lunara: null,
      contract_numar: null,
      contract_data: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual([`/flota/${VEHICUL}`, "/flota/fiscal"]);
  });

  it("categoria exceptată + mașina personală în comodat: câmpurile ajung în INSERT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_fiscal_regimes", "insert", { data: { id: ID_1 } });

    const r = await adaugaRegimFiscal({
      ...regim,
      regim: "exceptat_categorie",
      exceptie: "agenti_vanzari_achizitii",
      titlu_folosinta: "comodat",
      proprietar_employee_id: ID_3,
      contract_numar: "C-4",
      contract_data: "2026-01-02",
    });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("vehicle_fiscal_regimes", "insert")[0]?.payload).toMatchObject({
      regim: "exceptat_categorie",
      exceptie: "agenti_vanzari_achizitii",
      titlu_folosinta: "comodat",
      proprietar_employee_id: ID_3,
      contract_numar: "C-4",
      contract_data: "2026-01-02",
    });
  });

  it("regimul „categorie exceptată” fără categorie: refuzat în schemă, pe câmp, fără drum la bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const r = await adaugaRegimFiscal({ ...regim, regim: "exceptat_categorie" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["exceptie"]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("mașina personală fără proprietar și chiria la proprietate: refuzate în schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const faraProprietar = await adaugaRegimFiscal({ ...regim, titlu_folosinta: "comodat" });
    expect(faraProprietar).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    const chirieLaProprietate = await adaugaRegimFiscal({ ...regim, chirie_lunara: "1200" });
    expect(chirieLaProprietate).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (chirieLaProprietate.ok) return;
    expect(Object.keys(chirieLaProprietate.error.fieldErrors ?? {})).toEqual(["chirie_lunara"]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("a doua perioadă în aceeași zi (23505) ajunge pe `valabil_de_la`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_fiscal_regimes", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "vfr_vehicul_de_la_uq"',
      ),
    });
    const r = await adaugaRegimFiscal(regim);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { valabil_de_la: [expect.any(String)] } },
    });
  });

  it("„peste 3.500 kg” pe un vehicul ușor (P0001 din trigger) ajunge pe `regim`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const mesaj =
      "Regimul „peste 3.500 kg sau peste 9 locuri” nu se potrivește: fișa vehiculului are 2200 kg și 5 locuri. Corectați fișa sau alegeți alt regim.";
    server.raspunde("vehicle_fiscal_regimes", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await adaugaRegimFiscal({ ...regim, regim: "peste_3500_sau_9_locuri" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { regim: [mesaj] } },
    });
  });
});

describe("stergeRegimFiscal", () => {
  it("sub `vehicles:update = team`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    const r = await stergeRegimFiscal({ id: ID_1, vehicle_id: VEHICUL });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("ștergere logică, filtrată pe id, vehicul, firmă și rând nesters, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_fiscal_regimes", "update", { data: { id: ID_1 } });

    const r = await stergeRegimFiscal({ id: ID_1, vehicle_id: VEHICUL });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("vehicle_fiscal_regimes", "update");
    expect(scriere?.payload).toMatchObject({ updated_by: USER_ID });
    expect(scriere?.payload).toHaveProperty("deleted_at");
    expect(areFiltru(scriere, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(scriere, "eq", "vehicle_id", VEHICUL)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(server.apeluriPe("vehicle_fiscal_regimes", "delete")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([`/flota/${VEHICUL}`, "/flota/fiscal"]);
  });

  it("UPDATE cu zero rânduri (rând deja șters sau respins de USING) = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_fiscal_regimes", "update", { data: null });
    const r = await stergeRegimFiscal({ id: ID_1, vehicle_id: VEHICUL });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("adaugaNormaConsum", () => {
  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicles:update = %s`: INTERZIS, fără niciun drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": scope } });
      const r = await adaugaNormaConsum(norma);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("norma din câmpul numeric intră ca număr, cu decizia internă și autorul explicit", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_consumption_norms", "insert", { data: { id: ID_1 } });

    const r = await adaugaNormaConsum(norma);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("vehicle_consumption_norms", "insert");
    expect(scriere?.payload).toEqual({
      organization_id: ORG_ID,
      vehicle_id: VEHICUL,
      valabil_de_la: "2026-03-01",
      l_100km: 7.5,
      decizie_numar: "DI-12",
      decizie_data: "2026-02-20",
      observatii: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(caiRevalidate()).toEqual([`/flota/${VEHICUL}`, "/flota/fiscal"]);
  });

  it.each([["0"], ["301"], ["abc"], [""]])(
    "norma %j se oprește în schemă, pe `l_100km`, fără drum la bază",
    async (valoare) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
      const r = await adaugaNormaConsum({ ...norma, l_100km: valoare });
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      if (r.ok) return;
      expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["l_100km"]);
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("decizia din viitor (P0001 din trigger) ajunge pe `decizie_data`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const mesaj = "Data deciziei interne nu poate fi în viitor.";
    server.raspunde("vehicle_consumption_norms", "insert", {
      error: eroarePostgrest("P0001", mesaj),
    });
    const r = await adaugaNormaConsum(norma);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { decizie_data: [mesaj] } },
    });
  });

  it("a doua normă în aceeași zi (23505) ajunge pe `valabil_de_la`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_consumption_norms", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "vcn_vehicul_de_la_uq"',
      ),
    });
    const r = await adaugaNormaConsum(norma);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { valabil_de_la: [expect.any(String)] } },
    });
  });
});

describe("stergeNormaConsum", () => {
  it("ștergere logică cu `.select()` după; foile deja trimise își păstrează norma", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_consumption_norms", "update", { data: { id: ID_1 } });

    const r = await stergeNormaConsum({ id: ID_1, vehicle_id: VEHICUL });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("vehicle_consumption_norms", "update");
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    // Nicio atingere a foilor: snapshot-ul normei e al foii, nu al normei.
    expect(server.apeluriPe("trip_sheets", "update")).toHaveLength(0);
  });

  it("zero rânduri = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_consumption_norms", "update", { data: null });
    const r = await stergeNormaConsum({ id: ID_1, vehicle_id: VEHICUL });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("salveazaRegimImpozitare", () => {
  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `organizations:update = %s`: INTERZIS, fără niciun drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({ permisiuni: { "organizations:update": scope } });
      const r = await salveazaRegimImpozitare({ regim_impozitare: "profit" });
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("UPDATE doar pe coloana regimului, pe firma din tenant, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "organizations:update": "all" } });
    server.raspunde("organizations", "update", { data: { id: ORG_ID } });

    const r = await salveazaRegimImpozitare({ regim_impozitare: "micro" });

    expect(r).toEqual({ ok: true, data: { id: ORG_ID } });
    const [scriere] = server.apeluriPe("organizations", "update");
    expect(scriere?.payload).toEqual({ regim_impozitare: "micro", updated_by: USER_ID });
    expect(areFiltru(scriere, "eq", "id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/flota/fiscal"]);
  });

  it("câmpul gol șterge regimul (nestabilit)", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "organizations:update": "all" } });
    server.raspunde("organizations", "update", { data: { id: ORG_ID } });
    const r = await salveazaRegimImpozitare({ regim_impozitare: "" });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("organizations", "update")[0]?.payload).toEqual({
      regim_impozitare: null,
      updated_by: USER_ID,
    });
  });

  it("un regim necunoscut se oprește în schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "organizations:update": "all" } });
    const r = await salveazaRegimImpozitare({ regim_impozitare: "scutit" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("UPDATE respins de USING (zero rânduri) = CONFLICT, nu succes tăcut", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "organizations:update": "all" } });
    server.raspunde("organizations", "update", { data: null });
    const r = await salveazaRegimImpozitare({ regim_impozitare: "profit" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
