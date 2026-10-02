// src/app/(app)/pontaj/actions-aprobare.test.ts
//
// Deciziile pe pontaj: aprobarea în bloc (paginată, cu zilele în curs sărite),
// decizia pe o zi și respingerea în bloc. Toate trei trec întâi prin garda
// „firma mai cere aprobare?” (`setari_pontare_rapida.necesita_aprobare`).

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

const colaboratori = vi.hoisted(() => ({ anuntaRespingereaZilei: vi.fn() }));
vi.mock("./anunta-respingerea", () => ({
  anuntaRespingereaZilei: colaboratori.anuntaRespingereaZilei,
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
import {
  areFiltru,
  eroarePostgrest,
  type ApelFals,
  type ClientFals,
} from "@/lib/teste/supabase-fals";
import { aprobaPontajBloc, decideZiPontaj, respingePontajBloc } from "./actions";

/** Argumentele unui modificator numeric (`range`), pe care `areFiltru` nu-l tipează. */
const argumente = (apel: ApelFals | undefined, metoda: string) =>
  apel?.filtre.find((f) => f.metoda === metoda)?.argumente;

const PERMIS = { "attendance:approve": "team" } as const;
const ACUM = new Date("2026-07-15T13:32:00Z");
const CAI = ["/pontaj", "/pontaj/perioade", "/pontaj/aprobare", "/portal", "/portal/pontajul-meu"];
const ANGAJAT_A = ID_3;
const ANGAJAT_B = "88888888-8888-4888-8888-888888888888";
const LOT = "99999999-9999-4999-8999-999999999999";

function garda(server: ClientFals, necesita = true) {
  server.raspunde("setari_pontare_rapida", "select", {
    data: necesita
      ? null
      : {
          mod_pontare_rapida: "ceas",
          verificare_pontare: "optional",
          program_start: null,
          necesita_aprobare: false,
        },
  });
}

const linie = (id: string, employee_id: string, deschisa = false) => ({
  id,
  employee_id,
  ora_inceput: "08:00:00",
  ora_sfarsit: deschisa ? null : "16:00:00",
});

/** Programează aprobarea până la capăt: perioadă, linii, lot, marcare, contor, lună. */
function drumAprobare(
  server: ClientFals,
  admin: ClientFals,
  linii: unknown[],
  status = "deschisa",
  { contor = { id: LOT } as unknown, luna = { id: ID_1 } as unknown } = {},
) {
  garda(server);
  server.raspunde("attendance_periods", "select", {
    data: { id: ID_1, an: 2026, luna: 7, status },
  });
  server.raspunde("attendance_entries", "select", { data: linii });
  server.raspunde("attendance_approval_batches", "insert", { data: { id: LOT } });
  admin.raspunde("attendance_entries", "update", { data: null });
  server.raspunde("attendance_approval_batches", "update", { data: contor });
  server.raspunde("attendance_periods", "update", { data: luna });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ACUM);
  colaboratori.anuntaRespingereaZilei.mockReset().mockResolvedValue(true);
  return () => vi.useRealTimers();
});

describe.each([
  ["aprobaPontajBloc", () => aprobaPontajBloc({ period_id: ID_1 })],
  ["decideZiPontaj", () => decideZiPontaj({ entry_id: ID_1, aproba: true })],
  ["respingePontajBloc", () => respingePontajBloc({ entry_ids: [ID_1], motiv: "Ore greșite" })],
] as const)("%s — poarta", (_nume, cheama) => {
  it("scope `own` (sub `team`) ⇒ INTERZIS, nicio interogare", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: { "attendance:approve": "own" } });
    const r = await cheama();
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("firma care a stins aprobarea ⇒ CONFLICT înaintea oricărei decizii", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    garda(server, false);
    const r = await cheama();
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri.map((a) => a.tabela)).toEqual(["setari_pontare_rapida"]);
    expect(server.apeluriRpc.some((a) => a.nume === "decide_zi_pontaj")).toBe(false);
    expect(admin.apeluri).toHaveLength(0);
  });
});

describe("aprobaPontajBloc", () => {
  it("aprobă liniile încheiate, SARE zilele în curs și le numără", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    drumAprobare(server, admin, [
      linie("a1", ANGAJAT_A),
      linie("b1", ANGAJAT_B, true),
      { id: "a2", employee_id: ANGAJAT_A, ora_inceput: null, ora_sfarsit: null },
    ]);

    const r = await aprobaPontajBloc({ period_id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: LOT, liniiAprobate: 2, zileDeschise: 1 } });

    const [perioada] = server.apeluriPe("attendance_periods", "select");
    expect(areFiltru(perioada, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(perioada, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(perioada, "is", "deleted_at", null)).toBe(true);

    const [linii] = server.apeluriPe("attendance_entries", "select");
    expect(areFiltru(linii, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(linii, "eq", "period_id", ID_1)).toBe(true);
    for (const col of ["approved_at", "leave_request_id", "respins_la", "deleted_at"]) {
      expect(areFiltru(linii, "is", col, null)).toBe(true);
    }
    expect(areFiltru(linii, "order", "id")).toBe(true);
    expect(argumente(linii, "range")).toEqual([0, 999]);

    const [lot] = server.apeluriPe("attendance_approval_batches", "insert");
    expect(lot?.payload).toEqual({
      organization_id: ORG_ID,
      period_id: ID_1,
      department_id: null,
      observatii: null,
    });

    // Marcarea trece cu clientul admin (managerul n-are `attendance:create`),
    // dar mărginită la id-urile citite cu clientul lui și la organizație.
    expect(server.apeluriPe("attendance_entries", "update")).toHaveLength(0);
    const [marcare] = admin.apeluriPe("attendance_entries", "update");
    expect(marcare?.payload).toEqual({
      approved_at: ACUM.toISOString(),
      approved_by: USER_ID,
      batch_id: LOT,
    });
    expect(areFiltru(marcare, "in", "id", ["a1", "a2"])).toBe(true);
    expect(areFiltru(marcare, "eq", "organization_id", ORG_ID)).toBe(true);

    const [contor] = server.apeluriPe("attendance_approval_batches", "update");
    expect(contor?.payload).toEqual({ linii_aprobate: 2 });
    expect(areFiltru(contor, "eq", "id", LOT)).toBe(true);
    expect(areFiltru(contor, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(contor?.selectDupaScriere).toBeDefined();

    const [luna] = server.apeluriPe("attendance_periods", "update");
    expect(luna?.payload).toEqual({ status: "in_aprobare" });
    // Tranziția atinge DOAR luna aprobată, nu toate lunile neblocate ale firmei.
    expect(areFiltru(luna, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(luna, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(luna?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("luna deja „în aprobare” nu se mai atinge", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    drumAprobare(server, admin, [linie("a1", ANGAJAT_A)], "in_aprobare");
    const r = await aprobaPontajBloc({ period_id: ID_1 });
    expect(r).toMatchObject({ ok: true, data: { liniiAprobate: 1 } });
    expect(server.apeluriPe("attendance_periods", "update")).toHaveLength(0);
  });

  it("perioadă negăsită ⇒ NEGASIT; perioadă blocată ⇒ CONFLICT; nicio scriere", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    garda(server);
    server.raspunde("attendance_periods", "select", { data: null });
    expect(await aprobaPontajBloc({ period_id: ID_1 })).toMatchObject({
      ok: false,
      error: { code: "NEGASIT" },
    });
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);

    const doi = configureazaActiunea({ permisiuni: PERMIS });
    garda(doi.server);
    doi.server.raspunde("attendance_periods", "select", {
      data: { id: ID_1, an: 2026, luna: 7, status: "blocata" },
    });
    const r = await aprobaPontajBloc({ period_id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(doi.server.apeluriPe("attendance_entries")).toHaveLength(0);
    expect(doi.admin.apeluri).toHaveLength(0);
  });

  it("filtrul de departament și bifele pe oameni și pe zile se aplică UNA PESTE ALTA", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    // ANGAJAT_C e bifat ca om și ca zi, dar NU e în departament.
    const ANGAJAT_C = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const ZI_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const ZI_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    drumAprobare(
      server,
      admin,
      [
        linie(ID_1, ANGAJAT_A),
        linie(ID_2, ANGAJAT_A),
        linie(ZI_B, ANGAJAT_B),
        linie(ZI_C, ANGAJAT_C),
      ],
      "in_aprobare",
    );
    server.raspunde("employees", "select", { data: [{ id: ANGAJAT_A }, { id: ANGAJAT_B }] });

    const r = await aprobaPontajBloc({
      period_id: ID_1,
      department_id: ID_3,
      // ANGAJAT_B e în departament, dar nebifat ca om.
      employee_ids: [ANGAJAT_A, ANGAJAT_C],
      // ID_1 e al unui om bifat, dar ziua lui nu e bifată.
      entry_ids: [ID_2, ZI_B, ZI_C],
    });

    expect(r).toMatchObject({ ok: true, data: { liniiAprobate: 1 } });
    const [angajati] = server.apeluriPe("employees");
    expect(areFiltru(angajati, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(angajati, "eq", "department_id", ID_3)).toBe(true);
    const [marcare] = admin.apeluriPe("attendance_entries", "update");
    expect(areFiltru(marcare, "in", "id", [ID_2])).toBe(true);
  });

  it.each([
    [{ employee_ids: [] }, "niciun angajat"],
    [{ entry_ids: [] }, "nicio zi"],
  ])("lista goală %o nu înseamnă „toți” ⇒ CONFLICT", async (extra, fragment) => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    garda(server);
    server.raspunde("attendance_periods", "select", {
      data: { id: ID_1, an: 2026, luna: 7, status: "deschisa" },
    });
    server.raspunde("attendance_entries", "select", { data: [linie("a1", ANGAJAT_A)] });
    const r = await aprobaPontajBloc({ period_id: ID_1, ...extra });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain(fragment);
    expect(server.apeluriPe("attendance_approval_batches")).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it.each([
    ["nicio linie", [], "Nu există linii"],
    ["doar zile în curs", [linie("b1", ANGAJAT_B, true)], "încă deschise"],
  ])("%s ⇒ CONFLICT, fără lot", async (_d, linii, fragment) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    garda(server);
    server.raspunde("attendance_periods", "select", {
      data: { id: ID_1, an: 2026, luna: 7, status: "deschisa" },
    });
    server.raspunde("attendance_entries", "select", { data: linii });
    const r = await aprobaPontajBloc({ period_id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain(fragment);
    expect(server.apeluriPe("attendance_approval_batches")).toHaveLength(0);
  });

  it("peste 1000 de linii: se citește pagina a doua și se aprobă TOATE", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    const pagina = Array.from({ length: 1000 }, (_, i) => linie(`p${String(i)}`, ANGAJAT_A));
    garda(server);
    server.raspunde("attendance_periods", "select", {
      data: { id: ID_1, an: 2026, luna: 7, status: "in_aprobare" },
    });
    server.raspunde("attendance_entries", "select", { data: pagina });
    server.raspunde("attendance_entries", "select", { data: [linie("ultima", ANGAJAT_B)] });
    server.raspunde("attendance_approval_batches", "insert", { data: { id: LOT } });
    admin.raspunde("attendance_entries", "update", { data: null });
    server.raspunde("attendance_approval_batches", "update", { data: { id: LOT } });

    const r = await aprobaPontajBloc({ period_id: ID_1 });

    expect(r).toMatchObject({ ok: true, data: { liniiAprobate: 1001 } });
    const citiri = server.apeluriPe("attendance_entries", "select");
    expect(citiri).toHaveLength(2);
    expect(argumente(citiri[1], "range")).toEqual([1000, 1999]);
    const [contor] = server.apeluriPe("attendance_approval_batches", "update");
    expect(contor?.payload).toEqual({ linii_aprobate: 1001 });
  });

  it("20 de pagini pline: refuz explicit, nu o aprobare trunchiată tăcut", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    const pagina = Array.from({ length: 1000 }, (_, i) => linie(`p${String(i)}`, ANGAJAT_A));
    garda(server);
    server.raspunde("attendance_periods", "select", {
      data: { id: ID_1, an: 2026, luna: 7, status: "deschisa" },
    });
    for (let i = 0; i < 20; i += 1)
      server.raspunde("attendance_entries", "select", { data: pagina });

    const r = await aprobaPontajBloc({ period_id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("20000");
    expect(server.apeluriPe("attendance_approval_batches")).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("contorul lotului refuzat tăcut (zero rânduri) ⇒ CONFLICT, nu „0 linii” pe veci", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    drumAprobare(server, admin, [linie("a1", ANGAJAT_A)], "deschisa", { contor: null });

    const r = await aprobaPontajBloc({ period_id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("0 linii");
    expect(server.apeluriPe("attendance_periods", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("managerul nu poate muta luna în „în aprobare” (zero rânduri) ⇒ CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    drumAprobare(server, admin, [linie("a1", ANGAJAT_A)], "deschisa", { luna: null });

    const r = await aprobaPontajBloc({ period_id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("în aprobare");
  });
});

describe("decideZiPontaj", () => {
  it("aprobarea: RPC-ul cu organizația, FĂRĂ motiv, și nicio notificare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    garda(server);
    server.raspundeRpc("decide_zi_pontaj", { data: ID_1 });

    const r = await decideZiPontaj({ entry_id: ID_1, aproba: true, motiv: "" });

    expect(r).toEqual({ ok: true, data: { id: ID_1, anuntat: false } });
    const apel = server.apeluriRpc.find((a) => a.nume === "decide_zi_pontaj");
    expect(apel?.argumente).toEqual({
      p_organization_id: ORG_ID,
      p_entry_id: ID_1,
      p_aproba: true,
    });
    expect(colaboratori.anuntaRespingereaZilei).not.toHaveBeenCalled();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("respingerea: motivul pleacă în RPC, iar angajatul e anunțat prin clientul admin", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    garda(server);
    server.raspundeRpc("decide_zi_pontaj", { data: ID_1 });
    colaboratori.anuntaRespingereaZilei.mockResolvedValue(false);

    const r = await decideZiPontaj({ entry_id: ID_1, aproba: false, motiv: "  Lipsă pauză  " });

    expect(r).toEqual({ ok: true, data: { id: ID_1, anuntat: false } });
    const apel = server.apeluriRpc.find((a) => a.nume === "decide_zi_pontaj");
    expect(apel?.argumente).toMatchObject({ p_aproba: false, p_motiv: "Lipsă pauză" });
    expect(colaboratori.anuntaRespingereaZilei).toHaveBeenCalledWith(
      admin.client,
      ORG_ID,
      ID_1,
      "Lipsă pauză",
    );
  });

  it("respingerea fără motiv de 5 caractere e refuzată la validare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await decideZiPontaj({ entry_id: ID_1, aproba: false, motiv: "nu" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("motiv");
    expect(server.apeluri).toHaveLength(0);
  });

  it("RPC fără rezultat ⇒ CONFLICT; P0001 ⇒ mesajul funcției", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    garda(server);
    server.raspundeRpc("decide_zi_pontaj", { data: null });
    expect(await decideZiPontaj({ entry_id: ID_1, aproba: true })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });

    const doi = configureazaActiunea({ permisiuni: PERMIS });
    garda(doi.server);
    const mesaj = "Perioada de pontaj 07.2026 este blocată.";
    doi.server.raspundeRpc("decide_zi_pontaj", { error: eroarePostgrest("P0001", mesaj) });
    expect(await decideZiPontaj({ entry_id: ID_1, aproba: true })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: mesaj },
    });
  });
});

describe("respingePontajBloc", () => {
  it("fiecare zi trece prin RPC-ul de o zi; eșecurile se numără, nu opresc lotul", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    garda(server);
    server.raspundeRpc("decide_zi_pontaj", { data: ID_1 });
    server.raspundeRpc("decide_zi_pontaj", { error: eroarePostgrest("P0001", "deja aprobată") });
    server.raspundeRpc("decide_zi_pontaj", { data: null });
    server.raspundeRpc("decide_zi_pontaj", { data: ID_3 });
    colaboratori.anuntaRespingereaZilei.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const r = await respingePontajBloc({
      entry_ids: [ID_1, ID_2, ANGAJAT_B, ID_3],
      motiv: "  Ore nejustificate  ",
    });

    expect(r).toEqual({ ok: true, data: { respinse: 2, esuate: 2, anuntate: 1 } });
    const apeluri = server.apeluriRpc.filter((a) => a.nume === "decide_zi_pontaj");
    expect(apeluri.map((a) => a.argumente)).toEqual(
      [ID_1, ID_2, ANGAJAT_B, ID_3].map((id) => ({
        p_organization_id: ORG_ID,
        p_entry_id: id,
        p_aproba: false,
        p_motiv: "Ore nejustificate",
      })),
    );
    // Doar zilele chiar respinse își anunță angajatul.
    expect(colaboratori.anuntaRespingereaZilei.mock.calls).toEqual([
      [admin.client, ORG_ID, ID_1, "Ore nejustificate"],
      [admin.client, ORG_ID, ID_3, "Ore nejustificate"],
    ]);
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("nicio zi respinsă ⇒ CONFLICT, nicio notificare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    garda(server);
    server.raspundeRpc("decide_zi_pontaj", { error: eroarePostgrest("42501") });
    const r = await respingePontajBloc({ entry_ids: [ID_1], motiv: "Ore greșite" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(colaboratori.anuntaRespingereaZilei).not.toHaveBeenCalled();
    expect(caiRevalidate()).toEqual([]);
  });

  it("respingerea „în alb” (fără zile) e refuzată la validare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await respingePontajBloc({ entry_ids: [], motiv: "Ore greșite" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

// Jurnalul de audit e citibil de oricine are `audit:read`: motivul unei
// respingeri descrie o problemă a unei persoane anume și nu are voie să ajungă
// acolo, nici la refuz, nici la succes.
describe("motivul respingerii nu intră în audit", () => {
  it.each([
    [
      "decideZiPontaj",
      () => decideZiPontaj({ entry_id: ID_1, aproba: false, motiv: "Lipsă pauză Popescu" }),
    ],
    [
      "respingePontajBloc",
      () => respingePontajBloc({ entry_ids: [ID_1], motiv: "Lipsă pauză Popescu" }),
    ],
  ] as const)("%s — refuzul nu scrie motivul în jurnal", async (_nume, cheama) => {
    const { server } = configureazaActiunea({ permisiuni: {} });
    const r = await cheama();
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.audituri()).not.toHaveLength(0);
    expect(JSON.stringify(server.audituri())).not.toContain("Popescu");
  });
});
