// src/app/(app)/flota/actions-foi.test.ts
//
// Foile de parcurs (creare, închidere, decizie), alimentările și confirmarea
// anomaliilor de kilometraj. Straturile comune ale lui `createAction` sunt în
// `salarizare/actions.test.ts`.

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
  adaugaAlimentare,
  confirmaAnomalie,
  creeazaFoaie,
  decideFoaie,
  trimiteFoaie,
} from "./actions";

const ACUM = "2026-09-15T10:00:00.000Z";

const foaie = (modificari: Record<string, unknown> = {}) => ({
  vehicle_id: ID_1,
  employee_id: ID_2,
  plecare_la: "2026-09-14T07:30",
  km_plecare: "10500",
  traseu: "București — Ploiești — București",
  ...modificari,
});

const alimentare = (modificari: Record<string, unknown> = {}) => ({
  trip_sheet_id: ID_1,
  litri: "42.5",
  cost: "310.25",
  alimentat_la: "2026-09-14T12:00",
  plin: true,
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

describe("creeazaFoaie", () => {
  it("fără `trip_sheets:create`: INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:read": "all" } });
    const r = await creeazaFoaie(foaie());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes (`own`): intră ca ciornă, cu autorul și ora României convertită", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "trip_sheets:create": "own" },
    });
    server.raspunde("trip_sheets", "insert", { data: { id: ID_3 } });

    const r = await creeazaFoaie(foaie());

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("trip_sheets");
    expect(apel?.operatie).toBe("insert");
    // Fără RETURNING, `data` e null după ce foaia s-a scris deja.
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      vehicle_id: ID_1,
      employee_id: ID_2,
      status: "draft",
      plecare_la: "2026-09-14T04:30:00.000Z",
      km_plecare: 10500,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    for (const camp of ["numar", "trimis_la", "aprobat_de", "aprobat_la", "km_parcursi"]) {
      expect(apel?.payload).not.toHaveProperty(camp);
    }
    expect(caiRevalidate()).toEqual(["/flota/foi"]);
  });

  it("regresul de kilometraj (P0001) ajunge pe `km_plecare`, cu cifrele bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:create": "own" } });
    const mesaj =
      "Kilometrajul de plecare (9000 km) este mai mic decât ultimul kilometraj cunoscut al vehiculului (10000 km).";
    server.raspunde("trip_sheets", "insert", { error: eroarePostgrest("P0001", mesaj) });

    const r = await creeazaFoaie(foaie());

    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", message: mesaj, fieldErrors: { km_plecare: [mesaj] } },
    });
  });

  it("kilometrajul cu zecimale e respins de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:create": "own" } });
    const r = await creeazaFoaie(foaie({ km_plecare: "10500.5" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("km_plecare");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("trimiteFoaie", () => {
  const inchidere = { id: ID_1, sosire_la: "2026-09-14T18:00", km_sosire: "10720" };

  it("fără `trip_sheets:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:create": "own" } });
    const r = await trimiteFoaie(inchidere);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes fără salt: închide foaia și caută doar anomalii de salt neconfirmate", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });
    server.raspunde("odometer_anomalies", "select", { data: [] });

    const r = await trimiteFoaie(inchidere);

    expect(r).toEqual({ ok: true, data: { id: ID_1, anomalie: null } });
    const [apel] = server.apeluriPe("trip_sheets");
    expect(apel?.payload).toEqual({
      status: "trimis",
      sosire_la: "2026-09-14T15:00:00.000Z",
      km_sosire: 10720,
      updated_by: USER_ID,
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();

    const [anomalii] = server.apeluriPe("odometer_anomalies");
    expect(areFiltru(anomalii, "eq", "trip_sheet_id", ID_1)).toBe(true);
    expect(areFiltru(anomalii, "eq", "tip", "salt")).toBe(true);
    expect(areFiltru(anomalii, "is", "confirmat_la", null)).toBe(true);
    expect(caiRevalidate()).toEqual(["/flota/foi", "/flota/aprobari"]);
  });

  it("cu salt de kilometraj: foaia se salvează, iar avertismentul spune cifrele", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });
    server.raspunde("odometer_anomalies", "select", {
      data: [{ tip: "salt", km_asteptat: 10000, km_declarat: 13000 }],
    });

    const r = await trimiteFoaie(inchidere);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.id).toBe(ID_1);
    expect(r.data.anomalie).toContain("(13000 km)");
    expect(r.data.anomalie).toContain("cu 3000 km peste");
    expect(r.data.anomalie).toContain("(10000 km)");
  });

  it("zero rânduri (foaia altcuiva, respinsă de USING): CONFLICT, fără căutare de anomalii", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: null });

    const r = await trimiteFoaie(inchidere);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("odometer_anomalies")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("sosirea înaintea plecării (P0001) ajunge pe `sosire_la`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const mesaj = "Ora de sosire trebuie să fie după ora de plecare.";
    server.raspunde("trip_sheets", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await trimiteFoaie(inchidere);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { sosire_la: [mesaj] } },
    });
  });
});

describe("decideFoaie", () => {
  it("scope `own` pe `trip_sheets:approve` (sub `team`): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:approve": "own" } });
    const r = await decideFoaie({ id: ID_1, decizie: "aprobat" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("aprobarea de către manager: statusul și autorul, fără semnătura (o pune triggerul)", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "trip_sheets:approve": "team" },
    });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });

    const r = await decideFoaie({ id: ID_1, decizie: "aprobat", motiv_respingere: "uitat" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("trip_sheets");
    expect(apel?.payload).toEqual({
      status: "aprobat",
      motiv_respingere: null,
      updated_by: USER_ID,
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/flota/foi", "/flota/aprobari"]);
  });

  it("respingerea scrie motivul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:approve": "all" } });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });
    await decideFoaie({ id: ID_1, decizie: "respins", motiv_respingere: "Lipsește bonul" });
    expect(server.apeluriPe("trip_sheets")[0]?.payload).toMatchObject({
      status: "respins",
      motiv_respingere: "Lipsește bonul",
    });
  });

  it.each([[null], [""], ["   "]])(
    "respingerea fără motiv (%j): CONFLICT, nicio scriere",
    async (motiv) => {
      const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:approve": "all" } });
      const r = await decideFoaie({ id: ID_1, decizie: "respins", motiv_respingere: motiv });
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      expect(server.apeluriPe("trip_sheets")).toHaveLength(0);
    },
  );

  it("zero rânduri (în afara echipei sau deja decisă): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:approve": "team" } });
    server.raspunde("trip_sheets", "update", { data: null });
    const r = await decideFoaie({ id: ID_1, decizie: "aprobat" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("autoaprobarea refuzată de trigger (P0001): mesajul bazei, CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:approve": "team" } });
    const mesaj = "Nu vă puteţi aproba singur propria foaie de parcurs.";
    server.raspunde("trip_sheets", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await decideFoaie({ id: ID_1, decizie: "aprobat" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("adaugaAlimentare", () => {
  it("fără `trip_sheets:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:create": "all" } });
    const r = await adaugaAlimentare(alimentare());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: cifrele convertite, fără prețul pe litru (coloană generată)", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("fuel_entries", "insert", { data: { id: ID_2 } });

    const r = await adaugaAlimentare(alimentare());

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("fuel_entries");
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      trip_sheet_id: ID_1,
      litri: 42.5,
      cost: 310.25,
      plin: true,
      alimentat_la: "2026-09-14T09:00:00.000Z",
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(apel?.payload).not.toHaveProperty("pret_litru");
    expect(caiRevalidate()).toEqual(["/flota/foi"]);
  });

  it.each([
    [{ litri: "0" }, "litri"],
    [{ litri: "2500" }, "litri"],
    [{ cost: "-1" }, "cost"],
  ])("limitele alimentării: %j ⇒ eroare pe %s", async (modificari, camp) => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const r = await adaugaAlimentare(alimentare(modificari));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
  });

  it("depășirea numerică (22003) devine un mesaj de business, nu EROARE_INTERNA", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("fuel_entries", "insert", { error: eroarePostgrest("22003") });
    const r = await adaugaAlimentare(alimentare());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("litrii");
  });

  it("data în afara foii (P0001) ajunge pe `alimentat_la`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const mesaj = "Data alimentării este în afara intervalului foii de parcurs.";
    server.raspunde("fuel_entries", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await adaugaAlimentare(alimentare());
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { alimentat_la: [mesaj] } },
    });
  });
});

describe("confirmaAnomalie", () => {
  it("scope `own` pe `vehicles:update` (sub `team`): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "own" } });
    const r = await confirmaAnomalie({ id: ID_1, nota: "Cursă necompletată" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("managerul vede anomaliile, dar fără `vehicles:update` nu le confirmă", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "trip_sheets:approve": "team", "trip_sheets:read": "team" },
    });
    const r = await confirmaAnomalie({ id: ID_1, nota: null });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: scrie doar momentul confirmării și nota, nu cifrele constatate", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    server.raspunde("odometer_anomalies", "update", { data: { id: ID_1 } });

    const r = await confirmaAnomalie({ id: ID_1, nota: "Cursă necompletată pe 12.09" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("odometer_anomalies");
    expect(apel?.payload).toEqual({ confirmat_la: ACUM, nota: "Cursă necompletată pe 12.09" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/flota/anomalii"]);
  });

  it("zero rânduri (ștearsă sau fără drept pe echipă): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    server.raspunde("odometer_anomalies", "update", { data: null });
    const r = await confirmaAnomalie({ id: ID_1, nota: null });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  // `internal.anomalii_protejeaza` pune `confirmat_de` doar la PRIMA confirmare
  // (`old.confirmat_la is null`), dar lasă `confirmat_la` și `nota` să fie
  // rescrise. Fără gardă pe `confirmat_la`, al doilea manager care confirmă
  // aceeași anomalie (două file, doi oameni) suprascrie data și nota primului,
  // iar rândul rămâne semnat de primul cu explicația celui de-al doilea.
  it("confirmarea nu suprascrie o anomalie deja confirmată (`.is(confirmat_la, null)`)", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    server.raspunde("odometer_anomalies", "update", { data: { id: ID_1 } });
    const r = await confirmaAnomalie({ id: ID_1, nota: "A doua explicație" });
    const [apel] = server.apeluriPe("odometer_anomalies");
    expect(r.ok).toBe(true);
    expect(apel).toBeDefined();
    expect(areFiltru(apel, "is", "confirmat_la", null)).toBe(true);
  });
});
