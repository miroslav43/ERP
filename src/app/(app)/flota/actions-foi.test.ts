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

import { semneazaPropunere } from "@/lib/fleet/jeton-bon";
import {
  asteaptaDupa,
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
  actualizeazaAlimentare,
  actualizeazaFoaie,
  adaugaAlimentare,
  confirmaAnomalie,
  creeazaFoaie,
  decideFoaie,
  redeschideFoaie,
  retrageFoaie,
  stergeAlimentare,
  stergeFoaie,
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
    // Sub `all`, șoferul e fișa PROPRIE (0199): aici e chiar ID_2 din payload.
    server.raspunde("employees", "select", { data: { id: ID_2 } });
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
    expect(caiRevalidate()).toEqual(["/flota/foi", "/portal", "/portal/masina-mea"]);
  });

  it("regresul de kilometraj (P0001) ajunge pe `km_plecare`, cu cifrele bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:create": "all" } });
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

describe("creeazaFoaie — șoferul (0199)", () => {
  it("sub `all`, fără șofer trimis: foaia e pe fișa PRINCIPALĂ proprie", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "trip_sheets:create": "own" },
    });
    server.raspunde("employees", "select", { data: { id: ID_2 } });
    server.raspunde("trip_sheets", "insert", { data: { id: ID_3 } });

    const r = await creeazaFoaie(foaie({ employee_id: null }));

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [fisa] = server.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "user_id", USER_ID)).toBe(true);
    // `app.current_employee_id` cere fișa principală; o secundară ar cădea pe RLS.
    expect(areFiltru(fisa, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriPe("trip_sheets")[0]?.payload).toMatchObject({ employee_id: ID_2 });
  });

  it("sub `all`, cu fișa ALTCUIVA trimisă: CONFLICT, fără scriere", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "trip_sheets:create": "own" },
    });
    server.raspunde("employees", "select", { data: { id: ID_3 } });

    const r = await creeazaFoaie(foaie({ employee_id: ID_2 }));

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("doar pentru dumneavoastră");
    expect(server.apeluriPe("trip_sheets")).toHaveLength(0);
  });

  it("sub `all`, cont fără fișă principală: CONFLICT, fără scriere", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "trip_sheets:create": "own" },
    });
    server.raspunde("employees", "select", { data: null });

    const r = await creeazaFoaie(foaie({ employee_id: null }));

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("trip_sheets")).toHaveLength(0);
  });

  it("cu `all`, fără șofer: VALIDARE pe `employee_id`, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:create": "all" } });

    const r = await creeazaFoaie(foaie({ employee_id: null }));

    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { employee_id: ["Alegeți șoferul."] } },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cu `all`, șoferul ales intră cum e, fără căutarea fișei proprii", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:create": "all" } });
    server.raspunde("trip_sheets", "insert", { data: { id: ID_3 } });

    const r = await creeazaFoaie(foaie({ employee_id: ID_2 }));

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    expect(server.apeluriPe("employees")).toHaveLength(0);
    expect(server.apeluriPe("trip_sheets")[0]?.payload).toMatchObject({ employee_id: ID_2 });
  });

  it("vehiculul nealocat și non-pool (P0001 din 0199) ajunge pe `vehicle_id`", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "trip_sheets:create": "own" },
    });
    const mesaj =
      "Vehiculul ales nu vă este alocat în ziua plecării și nu este o mașină comună (pool). Foaia se întocmește pe vehiculul primit în folosință sau pe unul din pool.";
    server.raspunde("employees", "select", { data: { id: ID_2 } });
    server.raspunde("trip_sheets", "insert", { error: eroarePostgrest("P0001", mesaj) });

    const r = await creeazaFoaie(foaie({ employee_id: null }));

    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { vehicle_id: [mesaj] } },
    });
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

  it("succes fără salt: trimite ciorna (doar starea; sosirea vine din curse) și caută anomaliile de salt", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });
    server.raspunde("odometer_anomalies", "select", { data: [] });

    const r = await trimiteFoaie(inchidere);

    expect(r).toEqual({ ok: true, data: { id: ID_1, anomalie: null } });
    const [apel] = server.apeluriPe("trip_sheets");
    // Din 0200 sosirea o dau cursele: câmpurile vechi trimise de un client
    // rămas în urmă le taie schema, nu ajung în bază.
    expect(apel?.payload).toEqual({ status: "trimis", updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    // Doar o ciornă se trimite; o foaie deja trimisă nu se „retrimite” peste.
    expect(areFiltru(apel, "eq", "status", "draft")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();

    const [anomalii] = server.apeluriPe("odometer_anomalies");
    expect(areFiltru(anomalii, "eq", "trip_sheet_id", ID_1)).toBe(true);
    expect(areFiltru(anomalii, "eq", "tip", "salt")).toBe(true);
    expect(areFiltru(anomalii, "is", "confirmat_la", null)).toBe(true);
    expect(caiRevalidate()).toEqual([
      "/flota/foi",
      `/flota/foi/${ID_1}`,
      "/flota/aprobari",
      "/portal",
      "/portal/masina-mea",
      `/portal/masina-mea/foi/${ID_1}`,
    ]);
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

  it("o cursă neîncheiată (P0001, 0200) ajunge ca mesajul bazei, întreg", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const mesaj =
      "Încheiați toate cursele (ora și kilometrajul la sosire) înainte de a trimite foaia spre aprobare.";
    server.raspunde("trip_sheets", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await trimiteFoaie(inchidere);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
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
    expect(caiRevalidate()).toEqual([
      "/flota/foi",
      "/flota/aprobari",
      "/portal",
      "/portal/masina-mea",
      `/portal/masina-mea/foi/${ID_1}`,
    ]);
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
    // Mesajul din 0018 are sedilă; ajunge la om cu virgulă dedesubt (ADM-021).
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu vă puteți aproba singur propria foaie de parcurs." },
    });
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
    expect(caiRevalidate()).toEqual([
      "/flota/foi",
      "/portal",
      "/portal/masina-mea",
      `/portal/masina-mea/foi/${ID_1}`,
    ]);
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

describe("adaugaAlimentare — bonul citit (F12a, 0213)", () => {
  const CALE = `${ORG_ID}/trip_sheets/${ID_1}/x-bon.jpg`;
  const PROPUNERE = {
    alimentat_la: "2026-09-14T12:00",
    litri: 45.32,
    cost: 312.5,
    statie: "OMV",
    numar_bon: "0042",
    cui_statie: "14399840",
  };
  const jeton = (legatura: Partial<{ user: string; cale: string }> = {}) =>
    semneazaPropunere({
      org: ORG_ID,
      user: legatura.user ?? USER_ID,
      foaie: ID_1,
      cale: legatura.cale ?? CALE,
      propunere: PROPUNERE,
      model: "google/gemini-3.7-flash",
      avertismente: ["Bonul are și alte produse (9,00 lei); s-a completat doar carburantul."],
    });
  const cuPoza = (modificari: Record<string, unknown> = {}) =>
    alimentare({ fisier_bon_path: CALE, ...modificari });
  const pozaInStorage = (server: ReturnType<typeof configureazaActiunea>["server"]) => {
    server.raspundeStocare("org-flota", "info", {
      data: { size: 250_000, contentType: "image/jpeg" },
    });
  };
  const angajat = () =>
    configureazaActiunea({ rol: "employee", permisiuni: { "trip_sheets:update": "own" } });

  it("jeton valid: INSERT-ul omului fără propunere; UPDATE-ul ADMIN scrie propunerea DIN JETON", async () => {
    const { server, admin } = angajat();
    pozaInStorage(server);
    server.raspunde("fuel_entries", "insert", { data: { id: ID_2 } });
    admin.raspunde("fuel_entries", "update", { data: [{ id: ID_2 }] });

    // Omul a corectat litrii după citire: declarația e a lui, propunerea rămâne a bonului.
    const r = await adaugaAlimentare(cuPoza({ litri: "54.32", ocr_jeton: jeton() }));

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [insert] = server.apeluriPe("fuel_entries", "insert");
    expect(insert?.payload).toMatchObject({ litri: 54.32, fisier_bon_path: CALE });
    expect(insert?.payload).not.toHaveProperty("ocr_propunere");
    expect(insert?.payload).not.toHaveProperty("ocr_jeton");

    const [update] = admin.apeluriPe("fuel_entries", "update");
    expect(update?.payload).toMatchObject({
      ocr_propunere: { v: 1, ...PROPUNERE, model: "google/gemini-3.7-flash", cale: CALE },
      updated_by: USER_ID,
    });
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "ocr_propunere", null)).toBe(true);
    expect(update?.selectDupaScriere).toBe("id");
  });

  it("UPDATE-ul admin cu zero rânduri: alimentarea rămâne salvată (`ok: true`)", async () => {
    const { server, admin } = angajat();
    pozaInStorage(server);
    server.raspunde("fuel_entries", "insert", { data: { id: ID_2 } });
    admin.raspunde("fuel_entries", "update", { data: [] });
    const r = await adaugaAlimentare(cuPoza({ ocr_jeton: jeton() }));
    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
  });

  it("UPDATE-ul admin cu eroare (23514): tot `ok: true`, cu urmă în jurnal", async () => {
    const { server, admin } = angajat();
    pozaInStorage(server);
    server.raspunde("fuel_entries", "insert", { data: { id: ID_2 } });
    admin.raspunde("fuel_entries", "update", { error: eroarePostgrest("23514") });
    const r = await adaugaAlimentare(cuPoza({ ocr_jeton: jeton() }));
    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    expect(console.error).toHaveBeenCalledWith(
      "[ocr-bon] propunerea nu s-a salvat",
      expect.objectContaining({ cod: "23514" }),
    );
  });

  it("jeton expirat (> 2 h): niciun UPDATE admin, salvarea reușește", async () => {
    const { server, admin } = angajat();
    const vechi = jeton();
    vi.setSystemTime(new Date(new Date(ACUM).getTime() + 2 * 3600_000 + 1000));
    pozaInStorage(server);
    server.raspunde("fuel_entries", "insert", { data: { id: ID_2 } });
    const r = await adaugaAlimentare(cuPoza({ ocr_jeton: vechi }));
    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    expect(admin.apeluri).toHaveLength(0);
  });

  it.each([
    ["al altui om", () => jeton({ user: ID_3 })],
    ["pe altă poză", () => jeton({ cale: `${ORG_ID}/trip_sheets/${ID_1}/alta.jpg` })],
    ["falsificat", () => `${jeton().slice(0, -3)}AAA`],
  ])("jeton %s: INTERZIS, fără insert", async (_e, fabrica) => {
    const { server, admin } = angajat();
    const r = await adaugaAlimentare(cuPoza({ ocr_jeton: fabrica() }));
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriPe("fuel_entries")).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("jeton fără poză (`fisier_bon_path` lipsă): INTERZIS", async () => {
    const { server } = angajat();
    const r = await adaugaAlimentare(alimentare({ ocr_jeton: jeton() }));
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriPe("fuel_entries")).toHaveLength(0);
  });

  it("`ocr_jeton` nu ajunge niciodată în audit; `cui_statie` și poza da", async () => {
    const { server, admin } = angajat();
    pozaInStorage(server);
    server.raspunde("fuel_entries", "insert", { data: { id: ID_2 } });
    admin.raspunde("fuel_entries", "update", { data: [{ id: ID_2 }] });
    const j = jeton();
    await adaugaAlimentare(cuPoza({ ocr_jeton: j, cui_statie: "RO 14399840" }));
    await asteaptaDupa();
    const audit = JSON.stringify(server.audituri());
    expect(audit).not.toContain("ocr_jeton");
    expect(audit).not.toContain(j.slice(0, 40));
    expect(audit).toContain("14399840");
    expect(audit).toContain("fisier_bon_path");
  });

  it("`cui_statie` „RO 14 399 840” ⇒ normalizat la cifre", async () => {
    const { server } = angajat();
    server.raspunde("fuel_entries", "insert", { data: { id: ID_2 } });
    await adaugaAlimentare(alimentare({ cui_statie: "RO 14 399 840" }));
    expect(server.apeluriPe("fuel_entries", "insert")[0]?.payload).toMatchObject({
      cui_statie: "14399840",
    });
  });

  it("CUI cu cifra de control greșită ⇒ eroare pe `cui_statie`, fără insert", async () => {
    const { server } = angajat();
    const r = await adaugaAlimentare(alimentare({ cui_statie: "14399841" }));
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { cui_statie: ["CUI-ul stației nu e valid."] } },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("poza din folderul altei foi ⇒ VALIDARE; poza lipsă din Storage ⇒ CONFLICT", async () => {
    const a = angajat();
    const r1 = await adaugaAlimentare(
      alimentare({ fisier_bon_path: `${ORG_ID}/trip_sheets/${ID_3}/x-bon.jpg` }),
    );
    expect(r1).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(a.server.apeluriPe("fuel_entries")).toHaveLength(0);

    const b = angajat();
    b.server.raspundeStocare("org-flota", "info", { error: { message: "Object not found" } });
    const r2 = await adaugaAlimentare(cuPoza());
    expect(r2).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(b.server.apeluriPe("fuel_entries")).toHaveLength(0);
  });

  it("23505 pe `fuel_bon_uq` (al doilea clic pe același bon) ⇒ VALIDARE pe `numar_bon`", async () => {
    const { server } = angajat();
    server.raspunde("fuel_entries", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "fuel_bon_uq"',
      ),
    });
    const r = await adaugaAlimentare(alimentare({ numar_bon: "0042" }));
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["numar_bon"]);
    expect(r.error.message).not.toMatch(/vehicul/u);
  });

  it("corectura (`actualizeazaAlimentare`) nu trimite niciodată propunerea sau jetonul", async () => {
    const { server, admin } = angajat();
    server.raspunde("fuel_entries", "update", { data: { id: ID_2 } });
    await actualizeazaAlimentare({
      ...alimentare({ cui_statie: "14399840" }),
      id: ID_2,
      ocr_jeton: jeton(),
      ocr_propunere: { v: 1 },
    } as never);
    const [apel] = server.apeluriPe("fuel_entries", "update");
    expect(apel?.payload).not.toHaveProperty("ocr_propunere");
    expect(apel?.payload).not.toHaveProperty("ocr_jeton");
    expect(apel?.payload).toMatchObject({ cui_statie: "14399840" });
    expect(admin.apeluri).toHaveLength(0);
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

describe("trimiteFoaie — observații", () => {
  const inchidere = { id: ID_1, sosire_la: "2026-09-14T18:00", km_sosire: "10720" };

  it("observațiile de la închidere se scriu pe foaie", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });
    server.raspunde("odometer_anomalies", "select", { data: [] });

    await trimiteFoaie({ ...inchidere, observatii: "Ocol prin Câmpina, drum închis." });

    const [apel] = server.apeluriPe("trip_sheets");
    expect(apel?.payload).toMatchObject({ observatii: "Ocol prin Câmpina, drum închis." });
  });

  it("câmpul gol nu șterge observațiile puse la întocmire", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });
    server.raspunde("odometer_anomalies", "select", { data: [] });

    await trimiteFoaie({ ...inchidere, observatii: null });

    const [apel] = server.apeluriPe("trip_sheets");
    expect(apel?.payload).not.toHaveProperty("observatii");
  });
});

describe("redeschideFoaie", () => {
  it("fără `trip_sheets:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:read": "own" } });
    const r = await redeschideFoaie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: respins → draft, filtrat pe starea `respins`, cu `.select()`", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "trip_sheets:update": "own" },
    });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });

    const r = await redeschideFoaie({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("trip_sheets");
    expect(apel?.payload).toEqual({ status: "draft", updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "status", "respins")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual([
      "/flota/foi",
      `/flota/foi/${ID_1}`,
      "/portal",
      "/portal/masina-mea",
      `/portal/masina-mea/foi/${ID_1}`,
    ]);
  });

  it("zero rânduri (nu mai e respinsă sau e a altcuiva): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: null });
    const r = await redeschideFoaie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("trimiteFoaie — foaia subordonatului (0199 §C2)", () => {
  it("managerul care închide foaia subordonatului primește refuzul bazei, ca CONFLICT", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "trip_sheets:update": "own" },
    });
    const mesaj =
      "Foaia de parcurs a unui coleg se poate doar aproba sau respinge, după ce a fost trimisă. O completează și o trimite șoferul ei.";
    server.raspunde("trip_sheets", "update", { error: eroarePostgrest("P0001", mesaj) });

    const r = await trimiteFoaie({ id: ID_1, sosire_la: "2026-09-14T18:00", km_sosire: "10720" });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    // Refuzul nu trece mai departe la căutarea anomaliilor: n-a fost nicio scriere.
    expect(server.apeluriPe("odometer_anomalies")).toHaveLength(0);
  });
});

// ── Foaia zilnică (0200) ─────────────────────────────────────────────────────

describe("creeazaFoaie — o foaie pe vehicul și zi (0200)", () => {
  it("a doua foaie activă a zilei (23505) ajunge pe `plecare_la`, nu „vehicul duplicat”", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:create": "all" } });
    server.raspunde("trip_sheets", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "ts_vehicul_zi_uq"',
      ),
    });
    const r = await creeazaFoaie(foaie());
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["plecare_la"]);
    expect(r.error.message).toMatch(/deja o foaie de parcurs în ziua aceasta/);
  });
});

describe("retrageFoaie", () => {
  it("fără `trip_sheets:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:read": "own" } });
    const r = await retrageFoaie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: trimis → draft, DOAR starea, filtrat pe `trimis`, cu `.select()`", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "trip_sheets:update": "own" },
    });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });

    const r = await retrageFoaie({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("trip_sheets");
    // Baza refuză retragerea care strecoară altă coloană (0200 §D1).
    expect(apel?.payload).toEqual({ status: "draft", updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "status", "trimis")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toContain("/flota/aprobari");
    expect(caiRevalidate()).toContain(`/portal/masina-mea/foi/${ID_1}`);
  });

  it("zero rânduri (deja decisă între timp): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: null });
    const r = await retrageFoaie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("actualizeazaFoaie", () => {
  it("cu curse: ora și km nu se trimit (baza le ia din curse); doar ciorna se atinge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });

    const r = await actualizeazaFoaie({
      id: ID_1,
      traseu: "București — Ploiești",
      scop: "Livrări",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("trip_sheets");
    expect(apel?.payload).toEqual({
      traseu: "București — Ploiești",
      scop: "Livrări",
      observatii: null,
      updated_by: USER_ID,
    });
    expect(areFiltru(apel, "eq", "status", "draft")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("fără curse: ora și km de plecare pleacă, ora în UTC", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });
    await actualizeazaFoaie({ id: ID_1, plecare_la: "2026-09-14T07:00", km_plecare: "10500" });
    expect(server.apeluriPe("trip_sheets")[0]?.payload).toMatchObject({
      plecare_la: "2026-09-14T04:00:00.000Z",
      km_plecare: 10500,
    });
  });

  it("refuzul bazei pe o foaie cu curse rămâne mesaj general", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const mesaj =
      "Orele și kilometrajul foii se scriu pe curse. Modificați cursa, iar foaia se recalculează singură.";
    server.raspunde("trip_sheets", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await actualizeazaFoaie({ id: ID_1, km_plecare: "1" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("zero rânduri (nu mai e ciornă): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: null });
    const r = await actualizeazaFoaie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("stergeFoaie", () => {
  it("doar ciorna se șterge logic", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });
    const r = await stergeFoaie({ id: ID_1 });
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("trip_sheets");
    expect(apel?.payload).toEqual({ deleted_at: ACUM, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "status", "draft")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("o foaie trimisă: zero rânduri, CONFLICT cu îndrumarea spre retragere", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: null });
    const r = await stergeFoaie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toMatch(/se retrage întâi/);
  });
});

describe("actualizeazaAlimentare și stergeAlimentare", () => {
  it("corectura: fără `id` și `trip_sheet_id` în payload, filtrată pe amândouă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("fuel_entries", "update", { data: { id: ID_2 } });

    const r = await actualizeazaAlimentare({ ...alimentare(), id: ID_2 });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("fuel_entries");
    expect(apel?.payload).toMatchObject({
      litri: 42.5,
      cost: 310.25,
      alimentat_la: "2026-09-14T09:00:00.000Z",
      updated_by: USER_ID,
    });
    expect(apel?.payload).not.toHaveProperty("trip_sheet_id");
    expect(apel?.payload).not.toHaveProperty("pret_litru");
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "trip_sheet_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(caiRevalidate()).toContain(`/flota/foi/${ID_1}`);
  });

  it("pe o foaie trimisă baza refuză (0200 §D1): mesaj general", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const mesaj =
      "Alimentările se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.";
    server.raspunde("fuel_entries", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await actualizeazaAlimentare({ ...alimentare(), id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("bonul dublat (23505) ajunge pe `numar_bon`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("fuel_entries", "update", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "fuel_bon_uq"',
      ),
    });
    const r = await actualizeazaAlimentare({ ...alimentare({ numar_bon: "B1" }), id: ID_2 });
    if (r.ok) throw new Error("trebuia refuzat");
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["numar_bon"]);
  });

  it("ștergerea: logică, zero rânduri = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("fuel_entries", "update", { data: { id: ID_2 } });
    const ok = await stergeAlimentare({ id: ID_2, trip_sheet_id: ID_1 });
    expect(ok).toEqual({ ok: true, data: { id: ID_2 } });
    expect(server.apeluriPe("fuel_entries")[0]?.payload).toEqual({
      deleted_at: ACUM,
      updated_by: USER_ID,
    });

    const { server: alt } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    alt.raspunde("fuel_entries", "update", { data: null });
    const r = await stergeAlimentare({ id: ID_2, trip_sheet_id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
