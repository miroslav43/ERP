// src/app/(app)/concedii/actions-creare.test.ts
//
// `creeazaCerereConcediu`: fișa țintă, tipul și varianta, certificatul medical,
// verificările de la trimitere (sold, plafon, suprapunere) și erorile bazei.
// Aprobarea pe loc a cererii depuse de cine are `leave:approve = all` stă în
// `actions-creare-aprobare.test.ts`.
//
// Straturile comune ale lui `createAction` sunt verificate o singură dată, în
// testul canonic (`salarizare/actions.test.ts`); aici doar permisiunea și
// handlerul.

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

// Colaboratorii aprobării: aici nu trebuie chemați niciodată (nicio cerere nu
// se aprobă pe loc), dar falsificați, ca o regresie să nu atingă modulele reale.
const colaboratori = vi.hoisted(() => ({
  sincronizeazaZileleDeConcediu: vi.fn(),
  declaraSuspendareaContractului: vi.fn(),
}));
vi.mock("@/app/(app)/pontaj/sincronizare-concediu", () => ({
  sincronizeazaZileleDeConcediu: colaboratori.sincronizeazaZileleDeConcediu,
}));
vi.mock("./suspendare-contract", () => ({
  declaraSuspendareaContractului: colaboratori.declaraSuspendareaContractului,
}));

import {
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { creeazaCerereConcediu } from "./actions";

const FISA = ID_2;
const TIP = ID_3;
const CERERE = ID_1;
const ALT_ANGAJAT = "88888888-8888-4888-8888-888888888888";
const VARIANTA = "99999999-9999-4999-8999-999999999999";
const COD_MEDICAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const PROPRIU = { "leave:create": "own" } as const;

const CAI_DE_BAZA = ["/concedii", "/concedii/sold", "/portal", "/portal/concediile-mele"];

/** Luni 6 – vineri 10 iulie 2026: cinci zile lucrătoare fără sărbători. */
const intrare = (extra: Record<string, unknown> = {}) => ({
  leave_type_id: TIP,
  data_inceput: "2026-07-06",
  data_sfarsit: "2026-07-10",
  ...extra,
});

const tipOdihna = (extra: Record<string, unknown> = {}) => ({
  id: TIP,
  key: "odihna",
  denumire: "Concediu de odihnă",
  scade_din_sold: true,
  zile_implicite: 21,
  plafon_anual_zile: null,
  ...extra,
});

/** Fișa proprie, citită cu clientul admin (rolul `employee` nu-și vede fișa prin RLS). */
function fisaProprie(admin: ClientFals, id: string | null = FISA) {
  admin.raspunde("employees", "select", { data: id === null ? null : { id } });
}

/** Sărbătorile anului: naționale și ale organizației. */
function sarbatori(
  server: ClientFals,
  nationale: readonly string[] = [],
  organizatie: readonly { data: string; tip: string }[] = [],
) {
  server.raspunde("public_holidays", "select", {
    data: nationale.map((data) => ({ data, denumire: "Sărbătoare" })),
  });
  server.raspunde("organization_holidays", "select", {
    data: organizatie.map((z) => ({ ...z, denumire: "Zi a firmei" })),
  });
}

/** Drumul complet al unei trimiteri care trece toate verificările (fără plafon). */
function trimitereCurata(server: ClientFals, ramase: number | null = 21) {
  sarbatori(server);
  server.raspunde("leave_balances", "select", { data: ramase === null ? null : { ramase } });
  server.raspunde("leave_requests", "select", { data: [] });
  server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 5 } });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  colaboratori.sincronizeazaZileleDeConcediu.mockReset();
  colaboratori.declaraSuspendareaContractului.mockReset();
});

describe("creeazaCerereConcediu — autorizare și fișa țintă", () => {
  it("fără `leave:create`: INTERZIS, fără nicio interogare pe vreun client", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: {} });
    const r = await creeazaCerereConcediu(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("scope `own` cu `employee_id` explicit: CONFLICT, înaintea oricărei citiri", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    const r = await creeazaCerereConcediu(intrare({ employee_id: ALT_ANGAJAT }));
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("alt angajat") },
    });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("cont fără fișă de angajat activă: CONFLICT, fără inserare", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin, null);
    const r = await creeazaCerereConcediu(intrare());
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("fișă de angajat") },
    });
    expect(server.apeluriPe("leave_requests")).toHaveLength(0);
  });

  it("ciornă pentru sine: fișa din organizație + utilizator, status `ciorna`, `created_by` explicit", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 5 } });

    const r = await creeazaCerereConcediu(intrare({ motiv: "Vacanță" }));

    expect(r).toEqual({
      ok: true,
      data: {
        id: CERERE,
        zileLucratoare: 5,
        aprobataInstant: false,
        zileInlocuite: 0,
        suspendare: { ceruta: false, declarata: false, termen: null, motiv: null },
      },
    });

    const [fisa] = admin.apeluriPe("employees", "select");
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);

    const [tip] = server.apeluriPe("leave_types", "select");
    expect(areFiltru(tip, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(tip, "eq", "id", TIP)).toBe(true);
    expect(areFiltru(tip, "eq", "activ", true)).toBe(true);
    expect(areFiltru(tip, "is", "deleted_at", null)).toBe(true);

    const [insert] = server.apeluriPe("leave_requests", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      employee_id: FISA,
      leave_type_id: TIP,
      data_inceput: "2026-07-06",
      data_sfarsit: "2026-07-10",
      motiv: "Vacanță",
      atasament_path: null,
      leave_variant_id: null,
      medical_code_id: null,
      serie_certificat: null,
      numar_certificat: null,
      status: "ciorna",
      created_by: USER_ID,
    });
    expect(insert?.selectDupaScriere).toBeDefined();
    expect(insert?.terminal).toBe("single");
    // O ciornă nu trece prin sold, plafon sau suprapunere.
    expect(server.apeluriPe("leave_balances")).toHaveLength(0);
    expect(server.apeluriPe("public_holidays")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(CAI_DE_BAZA);
  });

  it("scope `all` cu angajat explicit: nu caută fișa proprie, scrie cererea pe angajatul ales", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "hr",
      permisiuni: { "leave:create": "all" },
    });
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 5 } });

    const r = await creeazaCerereConcediu(intrare({ employee_id: ALT_ANGAJAT }));

    expect(r.ok).toBe(true);
    expect(admin.apeluriPe("employees")).toHaveLength(0);
    const [insert] = server.apeluriPe("leave_requests", "insert");
    expect(insert?.payload).toMatchObject({ employee_id: ALT_ANGAJAT, created_by: USER_ID });
  });
});

describe("creeazaCerereConcediu — documentul atașat", () => {
  it("calea din dosarul propriu e acceptată și ajunge în rând", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 5 } });
    const cale = `${ORG_ID}/leave/${FISA}/abc-certificat.pdf`;

    const r = await creeazaCerereConcediu(intrare({ atasament_path: cale }));

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("leave_requests", "insert")[0]?.payload).toMatchObject({
      atasament_path: cale,
    });
  });

  it.each([
    ["dosarul altui angajat", `${ORG_ID}/leave/${ALT_ANGAJAT}/certificat.pdf`],
    ["altă resursă", `${ORG_ID}/employees/${FISA}/certificat.pdf`],
    ["urcare în arbore", `${ORG_ID}/leave/${FISA}/../${ALT_ANGAJAT}/x.pdf`],
  ])("calea din %s: VALIDARE pe `atasament_path`, fără inserare", async (_caz, cale) => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    const r = await creeazaCerereConcediu(intrare({ atasament_path: cale }));
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("atasament_path");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("creeazaCerereConcediu — tipul, varianta și certificatul", () => {
  it("tip inexistent sau dezactivat: CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: null });
    const r = await creeazaCerereConcediu(intrare());
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("nu există") },
    });
    expect(server.apeluriPe("leave_requests")).toHaveLength(0);
  });

  it("varianta inexistentă: CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    server.raspunde("leave_type_variants", "select", { data: null });
    const r = await creeazaCerereConcediu(intrare({ leave_variant_id: VARIANTA }));
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Varianta") },
    });
    const [varianta] = server.apeluriPe("leave_type_variants");
    expect(areFiltru(varianta, "eq", "id", VARIANTA)).toBe(true);
    expect(areFiltru(varianta, "eq", "activ", true)).toBe(true);
    expect(areFiltru(varianta, "is", "deleted_at", null)).toBe(true);
  });

  it("varianta altui tip de concediu: CONFLICT, nu se împrumută plafonul altui tip", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna({ key: "casatorie" }) });
    server.raspunde("leave_type_variants", "select", {
      data: {
        id: VARIANTA,
        leave_type_key: "crestere_copil",
        denumire: "Copil cu handicap",
        zile: 1095,
      },
    });
    const r = await creeazaCerereConcediu(intrare({ leave_variant_id: VARIANTA }));
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("nu aparține tipului") },
    });
    expect(server.apeluriPe("leave_requests")).toHaveLength(0);
  });

  it("concediu medical fără cod de indemnizație: CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna({ key: "medical" }) });
    const r = await creeazaCerereConcediu(intrare());
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("codul de indemnizație") },
    });
  });

  it("certificat medical pe un concediu care nu e medical: CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    const r = await creeazaCerereConcediu(
      intrare({ medical_code_id: COD_MEDICAL, numar_certificat: "123456" }),
    );
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: expect.stringContaining("doar unei cereri de concediu medical"),
      },
    });
  });

  it("concediu medical cu certificat complet: codul, seria și numărul ajung în rând", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna({ key: "medical" }) });
    server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 5 } });
    const r = await creeazaCerereConcediu(
      intrare({
        medical_code_id: COD_MEDICAL,
        serie_certificat: "CCMAM",
        numar_certificat: "4471",
      }),
    );
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("leave_requests", "insert")[0]?.payload).toMatchObject({
      medical_code_id: COD_MEDICAL,
      serie_certificat: "CCMAM",
      numar_certificat: "4471",
    });
  });

  it.each([
    [
      "sfârșit înaintea începutului",
      { data_inceput: "2026-07-10", data_sfarsit: "2026-07-06" },
      "data_sfarsit",
    ],
    [
      "cerere peste doi ani",
      { data_inceput: "2026-12-28", data_sfarsit: "2027-01-04" },
      "data_sfarsit",
    ],
    ["cod fără număr de certificat", { medical_code_id: COD_MEDICAL }, "numar_certificat"],
    ["număr de certificat fără cod", { numar_certificat: "4471" }, "medical_code_id"],
  ])(
    "schema respinge %s: VALIDARE pe câmpul potrivit, fără interogări",
    async (_caz, extra, camp) => {
      const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
      const r = await creeazaCerereConcediu(intrare(extra));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.code).toBe("VALIDARE");
      expect(r.error.fieldErrors).toHaveProperty(camp);
      expect(server.apeluri).toHaveLength(0);
      expect(admin.apeluri).toHaveLength(0);
    },
  );
});

describe("creeazaCerereConcediu — verificările de la trimitere", () => {
  it("trimitere cu sold suficient: status `trimisa`, soldul citit pe angajat + tip + an", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    trimitereCurata(server, 5);

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({ ok: true, data: { aprobataInstant: false } });
    const [sold] = server.apeluriPe("leave_balances");
    expect(areFiltru(sold, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(sold, "eq", "employee_id", FISA)).toBe(true);
    expect(areFiltru(sold, "eq", "leave_type_id", TIP)).toBe(true);
    expect(areFiltru(sold, "eq", "an", 2026)).toBe(true);
    expect(areFiltru(sold, "is", "deleted_at", null)).toBe(true);
    const [existente] = server.apeluriPe("leave_requests", "select");
    expect(areFiltru(existente, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(existente, "eq", "employee_id", FISA)).toBe(true);
    expect(areFiltru(existente, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(existente, "in", "status", ["trimisa", "in_aprobare", "aprobata"])).toBe(true);
    expect(server.apeluriPe("leave_requests", "insert")[0]?.payload).toMatchObject({
      status: "trimisa",
    });
    // Fără `leave:approve = all`, cererea pleacă pe lanț: nimic nu se aprobă pe loc.
    expect(admin.apeluriPe("approval_tasks")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(CAI_DE_BAZA);
  });

  it("sold insuficient: CONFLICT cu zilele care lipsesc, fără inserare", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: { ramase: 3 } });

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("lipsesc 2,00 zile") },
    });
    expect(server.apeluriPe("leave_requests", "insert")).toHaveLength(0);
  });

  it("fără rând de sold în an, dreptul disponibil e `zile_implicite` al tipului", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna({ zile_implicite: 4 }) });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: null });

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("lipsesc 1,00 zile") },
    });
  });

  it("sărbătorile legale și zilele libere ale firmei nu se scad din sold", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    sarbatori(server, ["2026-07-08"], [{ data: "2026-07-09", tip: "liber_suplimentar" }]);
    // Trei zile rămase ajung doar dacă miercurea și joia nu se numără.
    server.raspunde("leave_balances", "select", { data: { ramase: 3 } });
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 3 } });

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r.ok).toBe(true);
    const [organizatie] = server.apeluriPe("organization_holidays");
    expect(areFiltru(organizatie, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("tip care nu scade din sold: soldul nu se citește deloc", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna({ scade_din_sold: false }) });
    sarbatori(server);
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 5 } });

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("leave_balances")).toHaveLength(0);
  });

  it("plafon legal depășit: CONFLICT cu zilele deja folosite în an", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", {
      data: tipOdihna({
        key: "paternal",
        denumire: "Paternal",
        scade_din_sold: false,
        plafon_anual_zile: 10,
      }),
    });
    sarbatori(server);
    server.raspunde("leave_requests", "select", {
      data: [{ zile_lucratoare: 4 }, { zile_lucratoare: 3 }],
    });

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: expect.stringMatching(
          /plafon legal de 10,00 zile.*7,00 sunt deja folosite în 2026.*cu 2,00 zile/u,
        ),
      },
    });
    const [consumate] = server.apeluriPe("leave_requests", "select");
    expect(areFiltru(consumate, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(consumate, "eq", "employee_id", FISA)).toBe(true);
    expect(areFiltru(consumate, "eq", "leave_type_id", TIP)).toBe(true);
    // Doar cererile care chiar consumă plafonul: anulatele și respinsele nu.
    expect(areFiltru(consumate, "in", "status", ["trimisa", "in_aprobare", "aprobata"])).toBe(true);
    expect(areFiltru(consumate, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(consumate, "gte", "data_inceput", "2026-01-01")).toBe(true);
    expect(areFiltru(consumate, "lte", "data_inceput", "2026-12-31")).toBe(true);
  });

  it("varianta legală înlocuiește plafonul tipului (paternal cu atestat: 15 zile)", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", {
      data: tipOdihna({
        key: "paternal",
        denumire: "Paternal",
        scade_din_sold: false,
        plafon_anual_zile: 10,
      }),
    });
    server.raspunde("leave_type_variants", "select", {
      data: { id: VARIANTA, leave_type_key: "paternal", denumire: "Paternal cu atestat", zile: 15 },
    });
    sarbatori(server);
    // 7 folosite + 5 cerute = 12: peste plafonul de bază, sub cel al variantei.
    server.raspunde("leave_requests", "select", { data: [{ zile_lucratoare: 7 }] });
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 5 } });

    const r = await creeazaCerereConcediu(intrare({ trimite: true, leave_variant_id: VARIANTA }));

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("leave_requests", "insert")[0]?.payload).toMatchObject({
      leave_variant_id: VARIANTA,
    });
    const [consumate] = server.apeluriPe("leave_requests", "select");
    expect(areFiltru(consumate, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(consumate, "eq", "employee_id", FISA)).toBe(true);
    expect(areFiltru(consumate, "in", "status", ["trimisa", "in_aprobare", "aprobata"])).toBe(true);
    expect(areFiltru(consumate, "is", "deleted_at", null)).toBe(true);
  });

  it("suprapunere cu o cerere existentă: CONFLICT, fără inserare", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: { ramase: 21 } });
    server.raspunde("leave_requests", "select", {
      data: [{ data_inceput: "2026-07-10", data_sfarsit: "2026-07-14" }],
    });

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("acoperă o parte din perioada") },
    });
    expect(server.apeluriPe("leave_requests", "insert")).toHaveLength(0);
  });

  it("o cerere care se termină în ajun nu e suprapunere", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: { ramase: 21 } });
    server.raspunde("leave_requests", "select", {
      data: [{ data_inceput: "2026-06-29", data_sfarsit: "2026-07-05" }],
    });
    server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 5 } });

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r.ok).toBe(true);
  });
});

describe("creeazaCerereConcediu — erorile bazei, traduse de `erori.ts`", () => {
  it("23P01 (cursă pe constrângerea de suprapunere): CONFLICT cu mesaj pentru om", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    server.raspunde("leave_requests", "insert", {
      error: eroarePostgrest("23P01", "conflicting key value violates exclusion constraint"),
    });
    const r = await creeazaCerereConcediu(intrare());
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Aveți deja o cerere") },
    });
  });

  it("P0001 din trigger: CONFLICT cu textul triggerului", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    const mesaj = "Perioada este mai veche de doi ani.";
    server.raspunde("leave_requests", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await creeazaCerereConcediu(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("creeazaCerereConcediu — o eroare de citire nu ocolește nicio verificare", () => {
  const tipPaternal = () =>
    tipOdihna({
      key: "paternal",
      denumire: "Paternal",
      scade_din_sold: true,
      plafon_anual_zile: 10,
    });

  /** Verifică eșecul intern și lipsa oricărei scrieri a cererii. */
  function faraInserare(
    r: Awaited<ReturnType<typeof creeazaCerereConcediu>>,
    server: ClientFals,
  ): void {
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriPe("leave_requests", "insert")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  }

  it("eroare la citirea fișei proprii: EROARE_INTERNA, nu „cont fără fișă”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    admin.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    const r = await creeazaCerereConcediu(intrare({ trimite: true }));
    faraInserare(r, server);
    expect(server.apeluriPe("leave_types")).toHaveLength(0);
  });

  it("eroare la citirea tipului: EROARE_INTERNA, nu „tip inexistent”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { error: eroarePostgrest("57014") });
    const r = await creeazaCerereConcediu(intrare({ trimite: true }));
    faraInserare(r, server);
  });

  it("eroare la citirea variantei: EROARE_INTERNA, nu „variantă inexistentă”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    server.raspunde("leave_type_variants", "select", { error: eroarePostgrest("57014") });
    const r = await creeazaCerereConcediu(intrare({ trimite: true, leave_variant_id: VARIANTA }));
    faraInserare(r, server);
  });

  it("eroare la citirea soldului: EROARE_INTERNA, nu cădere pe `zile_implicite`", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { error: eroarePostgrest("57014") });
    const r = await creeazaCerereConcediu(intrare({ trimite: true }));
    faraInserare(r, server);
    // Nimic după sold: nici plafonul, nici suprapunerea.
    expect(server.apeluriPe("leave_requests", "select")).toHaveLength(0);
  });

  it("eroare la numărarea zilelor din plafon: EROARE_INTERNA, nu „0 zile consumate”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipPaternal() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: { ramase: 21 } });
    server.raspunde("leave_requests", "select", { error: eroarePostgrest("57014") });
    const r = await creeazaCerereConcediu(intrare({ trimite: true }));
    faraInserare(r, server);
    // Suprapunerea nu mai rulează după plafonul căzut.
    expect(server.apeluriPe("leave_requests", "select")).toHaveLength(1);
  });

  it("eroare la căutarea suprapunerilor: EROARE_INTERNA, nu „nicio cerere existentă”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    sarbatori(server);
    server.raspunde("leave_balances", "select", { data: { ramase: 21 } });
    server.raspunde("leave_requests", "select", { error: eroarePostgrest("57014") });
    const r = await creeazaCerereConcediu(intrare({ trimite: true }));
    faraInserare(r, server);
  });
});
