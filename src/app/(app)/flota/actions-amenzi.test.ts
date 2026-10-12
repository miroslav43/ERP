// src/app/(app)/flota/actions-amenzi.test.ts
//
// Amenzile și incidentele flotei (0203, F11), pe clientul fals: înregistrarea,
// desemnarea șoferului, răspunsul către autoritate, închiderea, ștergerea.
// Clientul fals prinde filtrul de organizație lipsă, `.select()` uitat,
// stadiul de plecare uitat și ramurile greșite; NU prinde o politică RLS
// greșită — aceea e în `tests/rls/proba-flota-amenzi.sql` și în `izolare.sql`
// (l), blocul 0203.

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
  actualizeazaAmenda,
  actualizeazaIncident,
  desemneazaSofer,
  inregistreazaAmenda,
  raporteazaIncident,
  retrageDesemnarea,
  schimbaStadiulAmenzii,
  schimbaStadiulIncidentului,
  stergeAmenda,
  stergeIncident,
  trimiteRaspuns,
} from "./actions-amenzi";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const VEHICUL = ID_2;
const SOFER = ID_3;

const amenda = {
  vehicle_id: VEHICUL,
  numar_pv: "PV 12/A",
  data_pv: "2026-10-09",
  constatata_la: "2026-10-09T09:30",
  locul: "DN1, Ploiești",
  fapta: "Depășirea vitezei legale",
  autoritate: "Poliția Rutieră",
  suma: "580",
  primita_la: "2026-10-11",
  termen_raspuns: "2026-10-19",
  observatii: "",
};

const incident = {
  vehicle_id: VEHICUL,
  tip: "coliziune",
  produs_la: "2026-10-11T16:00",
  locul: "Parcarea sediului",
  descriere: "Zgâriere aripă dreapta",
  sofer_id: SOFER,
  cost_estimat: "1200",
  observatii: "",
};

describe("inregistreazaAmenda", () => {
  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicle_fines:create = %s`: INTERZIS, fără niciun drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:create": scope } });
      const r = await inregistreazaAmenda(amenda);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("`vehicles:update = all` NU ajunge: amenzile au cheia lor", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const r = await inregistreazaAmenda(amenda);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("INSERT cu firma din tenant, autorul explicit, momentul în UTC și suma ca număr", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:create": "all" } });
    server.raspunde("vehicle_fines", "insert", { data: { id: ID_1 } });

    const r = await inregistreazaAmenda(amenda);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("vehicle_fines", "insert");
    expect(scriere?.payload).toEqual({
      organization_id: ORG_ID,
      vehicle_id: VEHICUL,
      numar_pv: "PV 12/A",
      data_pv: "2026-10-09",
      constatata_la: "2026-10-09T06:30:00.000Z",
      locul: "DN1, Ploiești",
      fapta: "Depășirea vitezei legale",
      autoritate: "Poliția Rutieră",
      suma: 580,
      primita_la: "2026-10-11",
      termen_raspuns: "2026-10-19",
      observatii: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    // Stadiul NU se trimite: îl pune implicitul bazei, iar politica îl pinuiește.
    expect(scriere?.payload).not.toHaveProperty("stadiu");
    expect(scriere?.payload).not.toHaveProperty("sofer_desemnat_id");
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/flota/amenzi"]);
  });

  it("aceeași hârtie introdusă a doua oară (23505) ajunge pe `numar_pv`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:create": "all" } });
    server.raspunde("vehicle_fines", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "vf_numar_uq"',
      ),
    });
    const r = await inregistreazaAmenda(amenda);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { numar_pv: [expect.any(String)] } },
    });
  });

  it("vehiculul altei firme (P0001 din trigger) ajunge pe `vehicle_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:create": "all" } });
    const mesaj = "Vehiculul ales nu aparține organizației dumneavoastră.";
    server.raspunde("vehicle_fines", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await inregistreazaAmenda(amenda);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { vehicle_id: [mesaj] } },
    });
  });

  it("termenul înaintea datei primirii se oprește în schemă, fără drum la bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:create": "all" } });
    const r = await inregistreazaAmenda({ ...amenda, termen_raspuns: "2026-10-01" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["termen_raspuns"]);
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaAmenda", () => {
  const { vehicle_id: _vehicul, ...corectura } = amenda;
  void _vehicul;

  it("UPDATE pe firmă, id și rând nesters; nu atinge stadiul; `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: { id: ID_1 } });

    const r = await actualizeazaAmenda({ id: ID_1, ...corectura, fapta: "Parcare interzisă" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("vehicle_fines", "update");
    expect(scriere?.payload).toMatchObject({ fapta: "Parcare interzisă", updated_by: USER_ID });
    expect(scriere?.payload).not.toHaveProperty("stadiu");
    expect(scriere?.payload).not.toHaveProperty("vehicle_id");
    expect(areFiltru(scriere, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/flota/amenzi", `/flota/amenzi/${ID_1}`]);
  });

  it("amenda închisă (P0001) rămâne mesajul bazei, nu cel generic", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    const mesaj = "Amenda este plătită și nu se mai modifică.";
    server.raspunde("vehicle_fines", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await actualizeazaAmenda({ id: ID_1, ...corectura });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("zero rânduri = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: null });
    const r = await actualizeazaAmenda({ id: ID_1, ...corectura });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("desemneazaSofer", () => {
  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicle_fines:update = %s`: INTERZIS",
    async (scope) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": scope } });
      const r = await desemneazaSofer({ id: ID_1, employee_id: SOFER });
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("trece amenda în „șofer desemnat”, din „primită” sau „șofer desemnat”, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: { id: ID_1 } });

    const r = await desemneazaSofer({ id: ID_1, employee_id: SOFER });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("vehicle_fines", "update");
    expect(scriere?.payload).toEqual({
      stadiu: "sofer_desemnat",
      sofer_desemnat_id: SOFER,
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "in", "stadiu", ["primita", "sofer_desemnat"])).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    // Calea obișnuită nu face a doua încercare.
    expect(server.apeluriPe("vehicle_fines", "update")).toHaveLength(1);
  });

  it("amenda contestată ÎNAINTE de răspuns: a doua încercare pune doar șoferul, stadiul rămâne „contestată”", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: null });
    server.raspunde("vehicle_fines", "update", { data: { id: ID_1 } });

    const r = await desemneazaSofer({ id: ID_1, employee_id: SOFER });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [, a_doua] = server.apeluriPe("vehicle_fines", "update");
    expect(a_doua?.payload).toEqual({ sofer_desemnat_id: SOFER, updated_by: USER_ID });
    expect(areFiltru(a_doua, "eq", "stadiu", "contestata")).toBe(true);
    expect(areFiltru(a_doua, "is", "raspuns_trimis_la", null)).toBe(true);
    expect(areFiltru(a_doua, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(a_doua, "is", "deleted_at", null)).toBe(true);
    expect(a_doua?.selectDupaScriere).toBe("id");
  });

  it("șoferul altei firmei (23503) ajunge pe `employee_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", {
      error: eroarePostgrest("23503", 'violates foreign key constraint "vf_sofer_fk"'),
    });
    const r = await desemneazaSofer({ id: ID_1, employee_id: SOFER });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { employee_id: [expect.any(String)] } },
    });
  });

  it("amenda a trecut între timp în alt stadiu (zero rânduri la ambele încercări) = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: null });
    server.raspunde("vehicle_fines", "update", { data: null });
    const r = await desemneazaSofer({ id: ID_1, employee_id: SOFER });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("vehicle_fines", "update")).toHaveLength(2);
  });

  it("un șofer lipsă se oprește în schemă, pe `employee_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    const r = await desemneazaSofer({ id: ID_1, employee_id: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["employee_id"]);
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("retrageDesemnarea", () => {
  it("întoarce amenda în „primită” și golește șoferul, doar din „șofer desemnat”", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: { id: ID_1 } });

    const r = await retrageDesemnarea({ id: ID_1 });

    expect(r.ok).toBe(true);
    const [scriere] = server.apeluriPe("vehicle_fines", "update");
    expect(scriere?.payload).toEqual({
      stadiu: "primita",
      sofer_desemnat_id: null,
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "stadiu", "sofer_desemnat")).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("zero rânduri (răspunsul a plecat între timp) = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: null });
    const r = await retrageDesemnarea({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("trimiteRaspuns", () => {
  it("marchează răspunsul doar din „șofer desemnat”, cu data și numărul de ieșire", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: { id: ID_1 } });

    const r = await trimiteRaspuns({
      id: ID_1,
      raspuns_trimis_la: "2026-10-12",
      raspuns_numar: " IES-9 ",
    });

    expect(r.ok).toBe(true);
    const [scriere] = server.apeluriPe("vehicle_fines", "update");
    expect(scriere?.payload).toEqual({
      stadiu: "raspuns_trimis",
      raspuns_trimis_la: "2026-10-12",
      raspuns_numar: "IES-9",
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "stadiu", "sofer_desemnat")).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(server.apeluriPe("vehicle_fines", "update")).toHaveLength(1);
  });

  it("amenda contestată ÎNAINTE de răspuns: a doua încercare scrie răspunsul și lasă stadiul „contestată”", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: null });
    server.raspunde("vehicle_fines", "update", { data: { id: ID_1 } });

    const r = await trimiteRaspuns({
      id: ID_1,
      raspuns_trimis_la: "2026-10-12",
      raspuns_numar: "IES-9",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [, a_doua] = server.apeluriPe("vehicle_fines", "update");
    expect(a_doua?.payload).toEqual({
      raspuns_trimis_la: "2026-10-12",
      raspuns_numar: "IES-9",
      updated_by: USER_ID,
    });
    expect(areFiltru(a_doua, "eq", "stadiu", "contestata")).toBe(true);
    expect(areFiltru(a_doua, "is", "raspuns_trimis_la", null)).toBe(true);
    expect(areFiltru(a_doua, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(a_doua?.selectDupaScriere).toBe("id");
  });

  it("data din viitor (P0001) ajunge pe `raspuns_trimis_la`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    const mesaj = "Data trimiterii răspunsului nu poate fi în viitor.";
    server.raspunde("vehicle_fines", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await trimiteRaspuns({ id: ID_1, raspuns_trimis_la: "2099-01-01" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { raspuns_trimis_la: [mesaj] } },
    });
  });

  it("fără șofer desemnat în așteptare (zero rânduri la ambele încercări) = CONFLICT, nu succes tăcut", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: null });
    server.raspunde("vehicle_fines", "update", { data: null });
    const r = await trimiteRaspuns({ id: ID_1, raspuns_trimis_la: "2026-10-12" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("vehicle_fines", "update")).toHaveLength(2);
  });

  it("amenda contestată fără șofer: baza refuză (P0001) și mesajul ajunge pe `employee_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    const mesaj = "Alegeți șoferul pe care îl comunicați autorității.";
    server.raspunde("vehicle_fines", "update", { data: null });
    server.raspunde("vehicle_fines", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await trimiteRaspuns({ id: ID_1, raspuns_trimis_la: "2026-10-12" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { employee_id: [mesaj] } },
    });
  });
});

describe("schimbaStadiulAmenzii", () => {
  it.each([
    ["platita", ["primita", "sofer_desemnat", "raspuns_trimis", "contestata"]],
    ["contestata", ["primita", "sofer_desemnat", "raspuns_trimis"]],
  ] as const)(
    "→ %s: plecările permise vin din matricea domeniului (aceeași ca a bazei)",
    async (stadiu, plecari) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
      server.raspunde("vehicle_fines", "update", { data: { id: ID_1 } });

      const r = await schimbaStadiulAmenzii({ id: ID_1, stadiu });

      expect(r.ok).toBe(true);
      const [scriere] = server.apeluriPe("vehicle_fines", "update");
      expect(scriere?.payload).toEqual({ stadiu, updated_by: USER_ID });
      expect(areFiltru(scriere, "in", "stadiu", plecari)).toBe(true);
      expect(scriere?.selectDupaScriere).toBe("id");
    },
  );

  it("→ anulată: motivul ajunge în UPDATE, din orice stadiu neînchis", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: { id: ID_1 } });

    const r = await schimbaStadiulAmenzii({
      id: ID_1,
      stadiu: "anulata",
      motiv: "Desființată de autoritate",
    });

    expect(r.ok).toBe(true);
    const [scriere] = server.apeluriPe("vehicle_fines", "update");
    expect(scriere?.payload).toEqual({
      stadiu: "anulata",
      motiv: "Desființată de autoritate",
      updated_by: USER_ID,
    });
    expect(
      areFiltru(scriere, "in", "stadiu", [
        "primita",
        "sofer_desemnat",
        "raspuns_trimis",
        "contestata",
      ]),
    ).toBe(true);
  });

  it("anularea fără motiv se oprește în schemă, pe `motiv`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    const r = await schimbaStadiulAmenzii({ id: ID_1, stadiu: "anulata" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["motiv"]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("amenda deja închisă (zero rânduri) = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: null });
    const r = await schimbaStadiulAmenzii({ id: ID_1, stadiu: "platita" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("stergeAmenda", () => {
  it("ștergere logică, doar din „primită”, cu `.select()` după; niciun DELETE", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: { id: ID_1 } });

    const r = await stergeAmenda({ id: ID_1 });

    expect(r.ok).toBe(true);
    const [scriere] = server.apeluriPe("vehicle_fines", "update");
    expect(scriere?.payload).toHaveProperty("deleted_at");
    expect(areFiltru(scriere, "eq", "stadiu", "primita")).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(server.apeluriPe("vehicle_fines", "delete")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(["/flota/amenzi"]);
  });

  it("amenda aflată în lucru (zero rânduri) = CONFLICT, cu îndrumarea spre anulare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_fines:update": "all" } });
    server.raspunde("vehicle_fines", "update", { data: null });
    const r = await stergeAmenda({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("se anulează");
  });
});

describe("raporteazaIncident", () => {
  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicle_incidents:create = %s`: INTERZIS, fără niciun drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({
        permisiuni: { "vehicle_incidents:create": scope },
      });
      const r = await raporteazaIncident(incident);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("INSERT cu firma din tenant, autorul explicit, momentul în UTC; stadiul nu se trimite", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:create": "all" } });
    server.raspunde("vehicle_incidents", "insert", { data: { id: ID_1 } });

    const r = await raporteazaIncident(incident);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("vehicle_incidents", "insert");
    expect(scriere?.payload).toEqual({
      organization_id: ORG_ID,
      vehicle_id: VEHICUL,
      tip: "coliziune",
      produs_la: "2026-10-11T13:00:00.000Z",
      locul: "Parcarea sediului",
      descriere: "Zgâriere aripă dreapta",
      sofer_id: SOFER,
      cost_estimat: 1200,
      observatii: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(scriere?.payload).not.toHaveProperty("stadiu");
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/flota/incidente"]);
  });

  it("momentul din viitor (P0001) ajunge pe `produs_la`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:create": "all" } });
    const mesaj = "Momentul incidentului nu poate fi în viitor.";
    server.raspunde("vehicle_incidents", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await raporteazaIncident(incident);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { produs_la: [mesaj] } },
    });
  });
});

describe("actualizeazaIncident", () => {
  const detalii = {
    id: ID_1,
    tip: "avarie",
    produs_la: "2026-10-11T16:00",
    locul: "",
    descriere: "Parbriz crăpat",
    sofer_id: "",
    cost_estimat: "300",
    despagubire: "",
    asigurator: "Allianz",
    dosar_numar: "D-77",
    work_accident_id: ID_3,
    observatii: "",
  };

  it("UPDATE pe detalii, fără stadiu și fără vehicul; legătura SSM ajunge în rând", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:update": "all" } });
    server.raspunde("vehicle_incidents", "update", { data: { id: ID_1 } });

    const r = await actualizeazaIncident(detalii);

    expect(r.ok).toBe(true);
    const [scriere] = server.apeluriPe("vehicle_incidents", "update");
    expect(scriere?.payload).toMatchObject({
      tip: "avarie",
      sofer_id: null,
      cost_estimat: 300,
      despagubire: null,
      asigurator: "Allianz",
      dosar_numar: "D-77",
      work_accident_id: ID_3,
      updated_by: USER_ID,
    });
    expect(scriere?.payload).not.toHaveProperty("stadiu");
    expect(scriere?.payload).not.toHaveProperty("vehicle_id");
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/flota/incidente", `/flota/incidente/${ID_1}`]);
  });

  it("cercetarea SSM din altă firmă (P0001) ajunge pe `work_accident_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:update": "all" } });
    const mesaj = "Cercetarea SSM aleasă nu aparține organizației dumneavoastră.";
    server.raspunde("vehicle_incidents", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await actualizeazaIncident(detalii);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { work_accident_id: [mesaj] } },
    });
  });

  it("incidentul închis (P0001) rămâne mesajul bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:update": "all" } });
    const mesaj = "Incidentul este închis și nu se mai modifică.";
    server.raspunde("vehicle_incidents", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await actualizeazaIncident(detalii);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("schimbaStadiulIncidentului", () => {
  it("→ la asigurător: trimite asiguratorul și dosarul, doar din stadii deschise, altele decât destinația", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:update": "all" } });
    server.raspunde("vehicle_incidents", "update", { data: { id: ID_1 } });

    const r = await schimbaStadiulIncidentului({
      id: ID_1,
      stadiu: "la_asigurator",
      asigurator: "Allianz",
      dosar_numar: "D-77",
    });

    expect(r.ok).toBe(true);
    const [scriere] = server.apeluriPe("vehicle_incidents", "update");
    expect(scriere?.payload).toEqual({
      stadiu: "la_asigurator",
      asigurator: "Allianz",
      dosar_numar: "D-77",
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "in", "stadiu", ["raportat", "constatat", "in_reparatie"])).toBe(
      true,
    );
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("→ închis: costul final 0 ajunge în UPDATE (nu e tratat ca „lipsă”); câmpurile goale nu se scriu", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:update": "all" } });
    server.raspunde("vehicle_incidents", "update", { data: { id: ID_1 } });

    const r = await schimbaStadiulIncidentului({ id: ID_1, stadiu: "inchis", cost_final: "0" });

    expect(r.ok).toBe(true);
    const [scriere] = server.apeluriPe("vehicle_incidents", "update");
    expect(scriere?.payload).toEqual({ stadiu: "inchis", cost_final: 0, updated_by: USER_ID });
    expect(scriere?.payload).not.toHaveProperty("despagubire");
    expect(scriere?.payload).not.toHaveProperty("asigurator");
  });

  it("închiderea fără cost final se oprește în schemă, pe `cost_final`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:update": "all" } });
    const r = await schimbaStadiulIncidentului({ id: ID_1, stadiu: "inchis" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["cost_final"]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("incidentul închis între timp (zero rânduri) = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:update": "all" } });
    server.raspunde("vehicle_incidents", "update", { data: null });
    const r = await schimbaStadiulIncidentului({ id: ID_1, stadiu: "constatat" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("stergeIncident", () => {
  it("ștergere logică, doar din „raportat”, cu `.select()` după; niciun DELETE", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:update": "all" } });
    server.raspunde("vehicle_incidents", "update", { data: { id: ID_1 } });

    const r = await stergeIncident({ id: ID_1 });

    expect(r.ok).toBe(true);
    const [scriere] = server.apeluriPe("vehicle_incidents", "update");
    expect(scriere?.payload).toHaveProperty("deleted_at");
    expect(areFiltru(scriere, "eq", "stadiu", "raportat")).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(server.apeluriPe("vehicle_incidents", "delete")).toHaveLength(0);
  });

  it("incidentul aflat în lucru (zero rânduri) = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicle_incidents:update": "all" } });
    server.raspunde("vehicle_incidents", "update", { data: null });
    const r = await stergeIncident({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
