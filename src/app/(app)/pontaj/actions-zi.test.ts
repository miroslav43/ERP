// src/app/(app)/pontaj/actions-zi.test.ts
//
// Ziua de pontaj completată de mână: `salveazaZiPontaj` și `stergeZiPontaj`.
//
// `avertismenteDupaZi`, suspendarea din absențe și calendarul firmei sunt
// înlocuite: au testele lor. Aici contează ce primesc și ce face acțiunea cu
// ce întorc — mai ales că orele scope-ului `own` se RE-DERIVĂ pe server.

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

const colaboratori = vi.hoisted(() => ({
  avertismenteDupaZi: vi.fn(),
  zileNelucratoare: vi.fn(),
  suspendareaDinAbsente: vi.fn(),
  inchideSuspendareaLaReluare: vi.fn(),
  setariPontareRapida: vi.fn(),
}));
// Doar varianta de pontaj (0165) e înlocuită; restul citirilor rămân reale,
// pe clientul fals, ca testele de mai jos să le poată programa.
vi.mock("@/lib/queries/attendance", async (orig) => ({
  ...(await orig<typeof import("@/lib/queries/attendance")>()),
  setariPontareRapida: colaboratori.setariPontareRapida,
}));
vi.mock("./avertismente", () => ({ avertismenteDupaZi: colaboratori.avertismenteDupaZi }));
vi.mock("@/lib/queries/leave", () => ({ zileNelucratoare: colaboratori.zileNelucratoare }));
vi.mock("./suspendare-absente", () => ({
  suspendareaDinAbsente: colaboratori.suspendareaDinAbsente,
  inchideSuspendareaLaReluare: colaboratori.inchideSuspendareaLaReluare,
  emiteSuspendarePentruAbsente: vi.fn(),
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
import { salveazaZiPontaj, stergeZiPontaj } from "./actions";

const PROPRIU = { "attendance:create": "own" } as const;
const TOT = { "attendance:create": "all" } as const;
const FISA = ID_3;
const ACUM = new Date("2026-07-15T13:32:00Z");
const CAI = ["/pontaj", "/pontaj/perioade", "/pontaj/aprobare", "/portal", "/portal/pontajul-meu"];

/** Ziua de miercuri 15 iulie 2026, cu un interval de 8 ore și jumătate. */
const ZI = {
  data: "2026-07-15",
  ora_inceput: "08:00",
  ora_sfarsit: "16:30",
  ore_lucrate: 8.5,
  ore_suplimentare: 0.5,
  ore_noapte: 0,
} as const;

/** Programează drumul obișnuit până la citirea zilei existente. */
function pregatesteDrumul(
  server: ClientFals,
  admin: ClientFals,
  { fisa = true, existenta = null as unknown }: { fisa?: boolean; existenta?: unknown } = {},
) {
  if (fisa) admin.raspunde("employees", "select", { data: { id: FISA } });
  server.raspunde("attendance_settings", "select", { data: null });
  server.raspunde("attendance_entries", "select", { data: existenta });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ACUM);
  colaboratori.avertismenteDupaZi.mockReset().mockResolvedValue([]);
  colaboratori.zileNelucratoare.mockReset().mockResolvedValue({ nationale: [], organizatie: [] });
  colaboratori.suspendareaDinAbsente.mockReset().mockResolvedValue(null);
  colaboratori.inchideSuspendareaLaReluare.mockReset().mockResolvedValue(null);
  colaboratori.setariPontareRapida.mockReset().mockResolvedValue(null);
  return () => vi.useRealTimers();
});

describe("salveazaZiPontaj — poarta și fișa", () => {
  it("fără `attendance:create` ⇒ INTERZIS, nicio interogare", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: {} });
    const r = await salveazaZiPontaj(ZI);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("scope `own` cu `employee_id` străin ⇒ CONFLICT înaintea oricărei citiri", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    const r = await salveazaZiPontaj({ ...ZI, employee_id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("scope `own`: fișa se rezolvă din sesiune, fișa PRINCIPALĂ a organizației", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    await salveazaZiPontaj(ZI);

    const [fisa] = admin.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({ employee_id: FISA });
  });

  it("cont fără fișă principală ⇒ CONFLICT, fără scriere", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    admin.raspunde("employees", "select", { data: null });
    const r = await salveazaZiPontaj(ZI);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
  });
});

describe("salveazaZiPontaj — orele", () => {
  it("scope `own`: orele se rederivă din interval, cifrele clientului se ignoră", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    const r = await salveazaZiPontaj({
      ...ZI,
      ore_lucrate: 14,
      ore_suplimentare: 6,
      ore_noapte: 6,
    });

    expect(r).toMatchObject({ ok: true, data: { id: ID_1 } });
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({
      ore_lucrate: 8.5,
      ore_suplimentare: 0.5,
      ore_noapte: 0,
    });
  });

  it("scope `own` fără ora de ieșire: ZERO ore, oricât ar declara clientul", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    await salveazaZiPontaj({ ...ZI, ora_sfarsit: "", ore_lucrate: 10, ore_suplimentare: 2 });

    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({
      ora_sfarsit: null,
      ore_lucrate: 0,
      ore_suplimentare: 0,
      ore_noapte: 0,
    });
  });

  it("scope `own` cu interval peste miezul nopții ⇒ CONFLICT, fără scriere", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspunde("attendance_settings", "select", { data: null });
    const r = await salveazaZiPontaj({ ...ZI, ora_inceput: "22:00", ora_sfarsit: "06:00" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
  });

  it("scope `all`: responsabilul scrie pentru altcineva, iar cifrele lui se păstrează", async () => {
    const { server, admin } = configureazaActiunea({ rol: "hr", permisiuni: TOT });
    pregatesteDrumul(server, admin, { fisa: false });
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    await salveazaZiPontaj({ ...ZI, employee_id: ID_2, ore_lucrate: 10, ore_suplimentare: 2 });

    expect(admin.apeluriPe("employees")).toHaveLength(0);
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({
      employee_id: ID_2,
      ore_lucrate: 10,
      ore_suplimentare: 2,
    });
  });

  it("orele suplimentare peste orele lucrate sunt refuzate la validare", async () => {
    const { server } = configureazaActiunea({ permisiuni: TOT });
    const r = await salveazaZiPontaj({ ...ZI, ore_lucrate: 2, ore_suplimentare: 3 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("ore_suplimentare");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("salveazaZiPontaj — scrierea", () => {
  it("zi nouă: INSERT pe organizație, cu tipul derivat din calendar și rezultatul complet", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });
    colaboratori.avertismenteDupaZi.mockResolvedValue([{ cod: "repaus" }]);

    const r = await salveazaZiPontaj({ ...ZI, tip_prezenta: "homeoffice", observatii: "x" });

    expect(r).toEqual({
      ok: true,
      data: {
        id: ID_1,
        avertismente: [{ cod: "repaus" }],
        conflictSuspendare: null,
        avertismentReluare: null,
        zileSarite: [],
      },
    });
    const [citire] = server.apeluriPe("attendance_entries", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "eq", "employee_id", FISA)).toBe(true);
    expect(areFiltru(citire, "eq", "data", "2026-07-15")).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG_ID,
      data: "2026-07-15",
      ora_inceput: "08:00",
      ora_sfarsit: "16:30",
      tip_zi: "lucratoare",
      tip_prezenta: "homeoffice",
      observatii: "x",
    });
    expect(server.apeluriPe("attendance_entries", "upsert")).toHaveLength(0);
    expect(colaboratori.avertismenteDupaZi).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      employeeId: FISA,
      data: "2026-07-15",
      setari: null,
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("setările se citesc la data ZILEI pontate, nu la data de azi", async () => {
    // Ziua corectată e cu cinci zile în urmă: setările au istoric
    // (`valabil_de_la`), iar o schimbare de normă de ieri n-are voie să
    // rescrie orele unei zile de săptămâna trecută.
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    await salveazaZiPontaj({ ...ZI, data: "2026-07-10" });

    const [setari] = server.apeluriPe("attendance_settings", "select");
    expect(areFiltru(setari, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(setari, "lte", "valabil_de_la", "2026-07-10")).toBe(true);
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({ data: "2026-07-10" });
  });

  it("observațiile nu intră în audit — sunt text liber, potențial cu date personale", async () => {
    const { server } = configureazaActiunea({ permisiuni: {} });
    const r = await salveazaZiPontaj({ ...ZI, observatii: "concediu medical Popescu" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.audituri()).not.toHaveLength(0);
    expect(JSON.stringify(server.audituri())).not.toContain("Popescu");
  });

  it("sărbătoarea din calendarul firmei dă tipul `sarbatoare`; alegerea explicită bate calendarul", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    colaboratori.zileNelucratoare.mockResolvedValue({
      nationale: [{ data: "2026-07-15" }],
      organizatie: [],
    });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_2 } });

    await salveazaZiPontaj(ZI);
    await salveazaZiPontaj({ ...ZI, tip_zi: "delegatie" });

    const [prima, aDoua] = server.apeluriPe("attendance_entries", "insert");
    expect(prima?.payload).toMatchObject({ tip_zi: "sarbatoare" });
    expect(aDoua?.payload).toMatchObject({ tip_zi: "delegatie" });
    expect(colaboratori.zileNelucratoare).toHaveBeenCalledTimes(1);
    expect(colaboratori.zileNelucratoare).toHaveBeenCalledWith(ORG_ID, 2026, 2026);
  });

  it("zi existentă: UPDATE pe id + organizație, stinge respingerea, cu `.select()` după", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin, { existenta: { id: ID_2, leave_request_id: null } });
    server.raspunde("attendance_entries", "update", { data: { id: ID_2 } });

    const r = await salveazaZiPontaj(ZI);

    expect(r).toMatchObject({ ok: true, data: { id: ID_2 } });
    expect(server.apeluriPe("attendance_entries", "insert")).toHaveLength(0);
    const [update] = server.apeluriPe("attendance_entries", "update");
    expect(update?.payload).toMatchObject({
      ore_lucrate: 8.5,
      tip_prezenta: null,
      respins_la: null,
      respins_de: null,
      motiv_respingere: null,
    });
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
  });

  it("zi existentă refuzată tăcut de USING (zero rânduri) ⇒ CONFLICT, nu succes", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin, { existenta: { id: ID_2, leave_request_id: null } });
    server.raspunde("attendance_entries", "update", { data: null });
    const r = await salveazaZiPontaj(ZI);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("zi venită din concediu ⇒ CONFLICT: se modifică doar din modulul Concedii", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin, { existenta: { id: ID_2, leave_request_id: ID_1 } });
    const r = await salveazaZiPontaj(ZI);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries", "update")).toHaveLength(0);
  });

  it("23505 pe INSERT (altă filă a scris ziua) ⇒ CONFLICT cu mesajul zilei", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { error: eroarePostgrest("23505") });
    const r = await salveazaZiPontaj(ZI);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Există deja o zi de pontaj înregistrată pentru acest angajat la data aleasă.",
      },
    });
  });

  it("perioada blocată (P0001 din trigger) ⇒ CONFLICT cu mesajul triggerului", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin);
    const mesaj = "Perioada de pontaj 07.2026 este blocată.";
    server.raspunde("attendance_entries", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await salveazaZiPontaj(ZI);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("salveazaZiPontaj — sediul declarat (0163)", () => {
  const SEDIU = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("la birou, sediul ales se verifică în lista firmei și se scrie", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspundeRpc("sedii_pentru_pontaj", {
      data: [{ id: SEDIU, denumire: "Sediul Iași", din_contract: false }],
    });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    const r = await salveazaZiPontaj({
      ...ZI,
      tip_prezenta: "birou",
      punct_lucru_declarat_id: SEDIU,
    });

    expect(r).toMatchObject({ ok: true });
    const [rpc] = server.apeluriRpc.filter((a) => a.nume === "sedii_pentru_pontaj");
    expect(rpc?.argumente).toEqual({ p_organization_id: ORG_ID });
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({ punct_lucru_declarat_id: SEDIU });
  });

  // Purtătorul: omul a ales un sediu, apoi a comutat pe homeoffice. CHECK-ul
  // din bază ar refuza combinația cu o eroare pe care n-a cauzat-o el.
  it("pe homeoffice sediul se stinge, fără să mai fie căutat în listă", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    const r = await salveazaZiPontaj({
      ...ZI,
      tip_prezenta: "homeoffice",
      punct_lucru_declarat_id: SEDIU,
    });

    expect(r).toMatchObject({ ok: true });
    expect(server.apeluriRpc.filter((a) => a.nume === "sedii_pentru_pontaj")).toHaveLength(0);
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({ punct_lucru_declarat_id: null });
  });

  it("un sediu absent din lista firmei (inactiv sau străin) ⇒ CONFLICT, fără scriere", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspundeRpc("sedii_pentru_pontaj", { data: [] });

    const r = await salveazaZiPontaj({
      ...ZI,
      tip_prezenta: "birou",
      punct_lucru_declarat_id: SEDIU,
    });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
  });

  it("zi existentă: UPDATE-ul rescrie și sediul — ca pe `tip_prezenta`", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin, { existenta: { id: ID_1, leave_request_id: null } });
    server.raspunde("attendance_entries", "update", { data: { id: ID_1 } });

    const r = await salveazaZiPontaj({ ...ZI, tip_prezenta: null });

    expect(r).toMatchObject({ ok: true });
    const [update] = server.apeluriPe("attendance_entries", "update");
    expect(update?.payload).toMatchObject({ punct_lucru_declarat_id: null });
  });
});

describe("salveazaZiPontaj — contractul suspendat pentru absențe", () => {
  const SUSPENDARE = { id: ID_1, data_inceput: "2026-07-01", contract_id: ID_2 };

  it("ore > 0 pe contract suspendat, neconfirmat ⇒ întrebare, NIMIC scris", async () => {
    const { server, admin } = configureazaActiunea({ rol: "hr", permisiuni: TOT });
    server.raspunde("attendance_settings", "select", { data: null });
    colaboratori.suspendareaDinAbsente.mockResolvedValue(SUSPENDARE);

    const r = await salveazaZiPontaj({ ...ZI, employee_id: ID_3 });

    expect(r).toMatchObject({
      ok: true,
      data: { id: null, conflictSuspendare: { suspendareId: ID_1, dataInceput: "2026-07-01" } },
    });
    expect(colaboratori.suspendareaDinAbsente).toHaveBeenCalledWith(admin.client, ORG_ID, ID_3);
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
    expect(colaboratori.inchideSuspendareaLaReluare).not.toHaveBeenCalled();
  });

  it("confirmat: suspendarea se închide ÎNAINTE de scriere, iar avertismentul ei iese în rezultat", async () => {
    const { server, admin } = configureazaActiunea({ rol: "hr", permisiuni: TOT });
    pregatesteDrumul(server, admin, { fisa: false });
    server.raspunde("attendance_entries", "insert", { data: { id: ID_2 } });
    colaboratori.suspendareaDinAbsente.mockResolvedValue(SUSPENDARE);
    // Câte scrieri pe ziua de pontaj existau în clipa închiderii suspendării.
    let scrieriLaInchidere: number | null = null;
    colaboratori.inchideSuspendareaLaReluare.mockImplementation(() => {
      scrieriLaInchidere =
        server.apeluriPe("attendance_entries", "insert").length +
        server.apeluriPe("attendance_entries", "update").length;
      return Promise.resolve("Transmiteți reluarea la ITM.");
    });

    const r = await salveazaZiPontaj({ ...ZI, employee_id: ID_3, confirma_reluare: "true" });

    expect(scrieriLaInchidere).toBe(0);
    expect(server.apeluriPe("attendance_entries", "insert")).toHaveLength(1);
    expect(r).toMatchObject({
      ok: true,
      data: {
        id: ID_2,
        avertismentReluare: "Transmiteți reluarea la ITM.",
        conflictSuspendare: null,
      },
    });
    const argumente = colaboratori.inchideSuspendareaLaReluare.mock.calls[0] ?? [];
    expect(argumente[0]).toBe(admin.client);
    expect(argumente.slice(1, 6)).toEqual([ORG_ID, ID_3, ID_1, "2026-07-15", USER_ID]);
  });

  it("zi fără ore (absență) nu verifică suspendarea", async () => {
    const { server, admin } = configureazaActiunea({ rol: "hr", permisiuni: TOT });
    pregatesteDrumul(server, admin, { fisa: false });
    server.raspunde("attendance_entries", "insert", { data: { id: ID_2 } });
    await salveazaZiPontaj({
      employee_id: ID_3,
      data: "2026-07-15",
      ore_lucrate: 0,
      tip_zi: "absenta_nemotivata",
    });
    expect(colaboratori.suspendareaDinAbsente).not.toHaveBeenCalled();
  });

  // Verificarea se face pe `input.ore_lucrate` ÎNAINTE de rederivarea din
  // interval (actions.ts:274 vs :312). Un angajat cu contract suspendat care
  // trimite `ore_lucrate: 0` cu interval 08:00–16:30 sare de verificare, iar
  // serverul scrie apoi 8,5 ore pe contractul suspendat.
  it("scope `own`: suspendarea se verifică pe orele rederivate din interval, nu pe cele declarate", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    pregatesteDrumul(server, admin);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });
    colaboratori.suspendareaDinAbsente.mockResolvedValue(SUSPENDARE);

    const r = await salveazaZiPontaj({ ...ZI, ore_lucrate: 0, ore_suplimentare: 0 });

    expect(r).toMatchObject({
      ok: true,
      data: { id: null, conflictSuspendare: { suspendareId: ID_1 } },
    });
    expect(server.apeluriPe("attendance_entries", "insert")).toHaveLength(0);
  });
});

describe("stergeZiPontaj", () => {
  it("fără `attendance:create` ⇒ INTERZIS, nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: {} });
    const r = await stergeZiPontaj({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("ștergere LOGICĂ: `deleted_at` = acum, pe id + organizație, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    server.raspunde("attendance_entries", "select", { data: { id: ID_1, leave_request_id: null } });
    server.raspunde("attendance_entries", "update", { data: { id: ID_1 } });

    const r = await stergeZiPontaj({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [citire] = server.apeluriPe("attendance_entries", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [update] = server.apeluriPe("attendance_entries", "update");
    expect(update?.payload).toEqual({ deleted_at: ACUM.toISOString() });
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(server.apeluriPe("attendance_entries", "delete")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("zi negăsită ⇒ NEGASIT, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PROPRIU });
    server.raspunde("attendance_entries", "select", { data: null });
    const r = await stergeZiPontaj({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("attendance_entries", "update")).toHaveLength(0);
  });

  it("zi din concediu ⇒ CONFLICT, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PROPRIU });
    server.raspunde("attendance_entries", "select", { data: { id: ID_1, leave_request_id: ID_2 } });
    const r = await stergeZiPontaj({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries", "update")).toHaveLength(0);
  });

  it("zi aprobată între timp (zero rânduri) ⇒ CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PROPRIU });
    server.raspunde("attendance_entries", "select", { data: { id: ID_1, leave_request_id: null } });
    server.raspunde("attendance_entries", "update", { data: null });
    const r = await stergeZiPontaj({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("luna blocată (P0001 din trigger, și la ștergerea logică) ⇒ CONFLICT cu mesajul triggerului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PROPRIU });
    const mesaj = "Perioada de pontaj 07.2026 este blocată.";
    server.raspunde("attendance_entries", "select", { data: { id: ID_1, leave_request_id: null } });
    server.raspunde("attendance_entries", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await stergeZiPontaj({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("varianta săptămânală (0165)", () => {
  const PE_SAPTAMANA = {
    mod_pontare_rapida: "ceas",
    verificare_pontare: "fara",
    program_start: null,
    necesita_aprobare: true,
    varianta_pontaj: "saptamanal",
  } as const;

  it("angajatul nu-și mai salvează ziua: CONFLICT, nicio scriere", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    colaboratori.setariPontareRapida.mockResolvedValue(PE_SAPTAMANA);

    const r = await salveazaZiPontaj(ZI);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("fișa săptămânii") },
    });
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
    expect(admin.apeluriPe("attendance_entries")).toHaveLength(0);
  });

  it("nici nu-și șterge ziua", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    colaboratori.setariPontareRapida.mockResolvedValue(PE_SAPTAMANA);

    const r = await stergeZiPontaj({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
  });

  // Varianta privește cum se pontează OMUL, nu corecturile din foaia colectivă.
  it("responsabilul cu `create = all` corectează în continuare ziua altcuiva", async () => {
    const { server } = configureazaActiunea({ permisiuni: TOT });
    colaboratori.setariPontareRapida.mockResolvedValue(PE_SAPTAMANA);
    server.raspunde("attendance_settings", "select", { data: null });
    server.raspunde("attendance_entries", "select", { data: null });
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    const r = await salveazaZiPontaj({ ...ZI, employee_id: ID_2 });

    expect(r).toMatchObject({ ok: true });
    expect(colaboratori.setariPontareRapida).not.toHaveBeenCalled();
  });
});
