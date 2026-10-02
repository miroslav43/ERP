// src/app/(app)/pontaj/saptamana/actions.test.ts
//
// Planul săptămânal: trimiterea (RPC cu orele RE-DERIVATE pe server) și decizia
// (sarcina + submisia, apoi — doar la aprobare — scrierea în pontaj).
//
// `avertismenteDupaSaptamana`, `zileNelucratoare` și `scriePontajulSaptamanii`
// sunt înlocuite: au testele lor, iar aici contează CE primesc și ce se face
// cu rezultatul lor.

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
  avertismenteDupaSaptamana: vi.fn(),
  zileNelucratoare: vi.fn(),
  scriePontajulSaptamanii: vi.fn(),
}));
vi.mock("../avertismente", () => ({
  avertismenteDupaSaptamana: colaboratori.avertismenteDupaSaptamana,
}));
vi.mock("@/lib/queries/leave", () => ({ zileNelucratoare: colaboratori.zileNelucratoare }));
vi.mock("./scrie-pontajul", () => ({
  scriePontajulSaptamanii: colaboratori.scriePontajulSaptamanii,
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
import { decideSaptamanaPontaj, trimiteSaptamanaPontaj } from "./actions";

const CREARE = { "attendance:create": "own" } as const;
const APROBARE = { "attendance:approve": "team" } as const;
const ACUM = new Date("2026-07-15T09:00:00Z");

const CAI = [
  "/pontaj/saptamana",
  "/pontaj/aprobare",
  "/portal",
  "/portal/pontajul-meu",
  "/portal/pontajul-meu/saptamana",
];

/** Setări minime pentru `setariPontaj` — doar ce citesc acțiunile. */
function setari(extra: Record<string, unknown> = {}) {
  return {
    ore_pe_zi: 8,
    noapte_start: "22:00:00",
    noapte_sfarsit: "06:00:00",
    pauza_masa_minute: 60,
    pauza_masa_inclusa_in_program: false,
    pauza_obligatorie_peste_ore: 6,
    lucreaza_weekend: false,
    ...extra,
  };
}

const LUNI = {
  data: "2026-07-13",
  tip_prezenta: "birou",
  ora_inceput: "08:00",
  ora_sfarsit: "17:00",
  // Valoare de tranzit: serverul o rescrie din interval.
  ore_planificate: 12,
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ACUM);
  colaboratori.avertismenteDupaSaptamana.mockReset().mockResolvedValue([]);
  colaboratori.zileNelucratoare.mockReset().mockResolvedValue({ nationale: [], organizatie: [] });
  colaboratori.scriePontajulSaptamanii.mockReset().mockResolvedValue({ scrise: 5, pastrate: 1 });
  return () => vi.useRealTimers();
});

describe("trimiteSaptamanaPontaj", () => {
  it("fără `attendance:create` ⇒ INTERZIS, fără RPC", async () => {
    const { server } = configureazaActiunea({ permisiuni: {} });
    const r = await trimiteSaptamanaPontaj({
      saptamana_start: "2026-07-13",
      status: "trimisa",
      zile: [LUNI],
    });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("orele planificate se DERIVĂ din interval și setări, nu se cred de la client", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("attendance_settings", "select", { data: setari() });
    server.raspundeRpc("trimite_saptamana_pontaj", {
      data: { submission_id: ID_1, zile_sarite: ["2026-07-14"] },
    });

    const r = await trimiteSaptamanaPontaj({
      saptamana_start: "2026-07-13",
      status: "trimisa",
      zile: [
        LUNI,
        { ...LUNI, data: "2026-07-14", ora_inceput: "", ora_sfarsit: "", ore_planificate: 8 },
      ],
    });

    expect(r).toMatchObject({ ok: true, data: { id: ID_1, zileSarite: ["2026-07-14"] } });
    const apel = server.apeluriRpc.find((a) => a.nume === "trimite_saptamana_pontaj");
    const arg = apel?.argumente as { p_zile: { ore_planificate: number; ora_inceput: unknown }[] };
    expect(apel?.argumente).toMatchObject({
      p_organization_id: ORG_ID,
      p_saptamana_start: "2026-07-13",
      p_status: "trimisa",
      p_employee_id: null,
      p_lucreaza_weekend: false,
    });
    // 08:00–17:00 = 9 ore brute, minus pauza de 60 de minute (necuprinsă în program).
    expect(arg.p_zile[0]?.ore_planificate).toBe(8);
    // Zi fără interval = zi nelucrată: zero ore, nu norma presupusă.
    expect(arg.p_zile[1]).toMatchObject({ ora_inceput: null, ore_planificate: 0 });
    // Setările se citesc la data săptămânii, nu azi.
    const [citire] = server.apeluriPe("attendance_settings");
    expect(areFiltru(citire, "lte", "valabil_de_la", "2026-07-13")).toBe(true);
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("responsabilul cu `create = all` completează săptămâna ALTCUIVA: fișa aleasă ajunge în RPC", async () => {
    // Cu `p_employee_id` pierdut pe drum, săptămâna s-ar scrie tăcut pe
    // propria fișă a responsabilului (`null` = cine e logat, 0084).
    const { server } = configureazaActiunea({
      rol: "hr",
      permisiuni: { "attendance:create": "all" },
    });
    server.raspunde("attendance_settings", "select", { data: setari() });
    server.raspundeRpc("trimite_saptamana_pontaj", { data: { submission_id: ID_1 } });

    const r = await trimiteSaptamanaPontaj({
      saptamana_start: "2026-07-13",
      status: "trimisa",
      employee_id: ID_3,
      zile: [LUNI],
    });

    expect(r).toMatchObject({ ok: true, data: { id: ID_1 } });
    const apel = server.apeluriRpc.find((a) => a.nume === "trimite_saptamana_pontaj");
    expect(apel?.argumente).toMatchObject({ p_organization_id: ORG_ID, p_employee_id: ID_3 });
  });

  it("avertismentele se calculează din zilele TRIMISE, cu orele derivate", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("attendance_settings", "select", { data: setari() });
    server.raspundeRpc("trimite_saptamana_pontaj", { data: { submission_id: ID_1 } });
    colaboratori.avertismenteDupaSaptamana.mockResolvedValue([{ cod: "x" }]);

    const r = await trimiteSaptamanaPontaj({
      saptamana_start: "2026-07-13",
      status: "ciorna",
      zile: [LUNI],
    });

    expect(r).toMatchObject({ ok: true, data: { avertismente: [{ cod: "x" }] } });
    expect(colaboratori.avertismenteDupaSaptamana).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        saptamanaStart: "2026-07-13",
        zile: [expect.objectContaining({ data: "2026-07-13", oreLucrate: 8, oreSuplimentare: 0 })],
      }),
    );
  });

  it("o sâmbătă lucrată declară weekendul chiar dacă firma nu-l are în setări", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("attendance_settings", "select", { data: setari({ lucreaza_weekend: false }) });
    server.raspundeRpc("trimite_saptamana_pontaj", { data: { submission_id: ID_1 } });

    await trimiteSaptamanaPontaj({
      saptamana_start: "2026-07-13",
      status: "trimisa",
      zile: [LUNI, { ...LUNI, data: "2026-07-18" }],
    });

    const apel = server.apeluriRpc.find((a) => a.nume === "trimite_saptamana_pontaj");
    expect(apel?.argumente).toMatchObject({ p_lucreaza_weekend: true });
  });

  it("interval inversat ⇒ CONFLICT înaintea RPC-ului", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("attendance_settings", "select", { data: null });
    const r = await trimiteSaptamanaPontaj({
      saptamana_start: "2026-07-13",
      status: "trimisa",
      zile: [{ ...LUNI, ora_inceput: "17:00", ora_sfarsit: "08:00" }],
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriRpc.some((a) => a.nume === "trimite_saptamana_pontaj")).toBe(false);
  });

  it("săptămâna care nu începe luni e refuzată la validare", async () => {
    configureazaActiunea({ permisiuni: CREARE });
    const r = await trimiteSaptamanaPontaj({
      saptamana_start: "2026-07-15",
      status: "trimisa",
      zile: [LUNI],
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
  });

  it("P0001 din RPC: mesajul ajunge la om, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("attendance_settings", "select", { data: null });
    const mesaj = "Săptămâna 13.07.2026 este deja aprobată.";
    server.raspundeRpc("trimite_saptamana_pontaj", { error: eroarePostgrest("P0001", mesaj) });
    const r = await trimiteSaptamanaPontaj({
      saptamana_start: "2026-07-13",
      status: "trimisa",
      zile: [LUNI],
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("forma neașteptată a răspunsului RPC nu transformă un plan salvat în eroare", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("attendance_settings", "select", { data: null });
    server.raspundeRpc("trimite_saptamana_pontaj", {
      data: { zile_sarite: [1, "2026-07-14", null] },
    });
    const r = await trimiteSaptamanaPontaj({
      saptamana_start: "2026-07-13",
      status: "trimisa",
      zile: [LUNI],
    });
    expect(r).toMatchObject({ ok: true, data: { id: "", zileSarite: ["2026-07-14"] } });
  });
});

/** Programează garda „firma mai cere aprobare?” (`setari_pontare_rapida`). */
function cereAprobare(server: ClientFals, necesita = true) {
  server.raspunde("setari_pontare_rapida", "select", {
    data:
      necesita === true
        ? null
        : {
            mod_pontare_rapida: "ceas",
            verificare_pontare: "optional",
            program_start: null,
            necesita_aprobare: false,
          },
  });
}

const RESPINGERE = {
  taskId: ID_1,
  decizie: "respinsa",
  comentariu: "",
  motivRespingere: "Ore greșite marți",
} as const;

describe("decideSaptamanaPontaj", () => {
  it("scope `own` (sub `team`) ⇒ INTERZIS, nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "attendance:approve": "own" } });
    const r = await decideSaptamanaPontaj(RESPINGERE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("firma care a stins aprobarea ⇒ CONFLICT înaintea oricărei citiri a sarcinii", async () => {
    const { server } = configureazaActiunea({ permisiuni: APROBARE });
    cereAprobare(server, false);
    const r = await decideSaptamanaPontaj(RESPINGERE);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("approval_tasks")).toHaveLength(0);
  });

  it("sarcină negăsită sau deja rezolvată ⇒ NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: APROBARE });
    cereAprobare(server);
    server.raspunde("approval_tasks", "select", { data: null });
    const r = await decideSaptamanaPontaj(RESPINGERE);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    const [citire] = server.apeluriPe("approval_tasks", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "eq", "entity_type", "attendance_week_submission")).toBe(true);
    expect(areFiltru(citire, "eq", "status", "in_asteptare")).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
  });

  it("respingerea: sarcina și submisia se decid cu `.select()`, fără nicio scriere în pontaj", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: APROBARE });
    cereAprobare(server);
    server.raspunde("approval_tasks", "select", { data: { id: ID_1, entity_id: ID_2 } });
    server.raspunde("approval_tasks", "update", { data: { id: ID_1 } });
    server.raspunde("attendance_week_submissions", "update", { data: { id: ID_2 } });

    const r = await decideSaptamanaPontaj(RESPINGERE);

    expect(r).toEqual({ ok: true, data: { id: ID_2, scrise: 0, pastrate: 0 } });
    const [sarcina] = server.apeluriPe("approval_tasks", "update");
    expect(sarcina?.payload).toEqual({
      status: "respinsa",
      comentariu: null,
      decis_la: ACUM.toISOString(),
    });
    expect(areFiltru(sarcina, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(sarcina, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(sarcina?.selectDupaScriere).toBeDefined();
    const [saptamana] = server.apeluriPe("attendance_week_submissions", "update");
    expect(saptamana?.payload).toEqual({
      status: "respinsa",
      decis_de: USER_ID,
      decis_la: ACUM.toISOString(),
      motiv_respingere: "Ore greșite marți",
    });
    expect(areFiltru(saptamana, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(saptamana, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(saptamana?.selectDupaScriere).toBeDefined();
    expect(admin.apeluri).toHaveLength(0);
    expect(colaboratori.scriePontajulSaptamanii).not.toHaveBeenCalled();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("respingerea fără motiv de 5 caractere e refuzată la validare", async () => {
    const { server } = configureazaActiunea({ permisiuni: APROBARE });
    const r = await decideSaptamanaPontaj({ ...RESPINGERE, motivRespingere: " ab " });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("aprobarea: motivul nu se scrie, iar săptămâna se scrie în pontaj cu clientul admin", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: APROBARE });
    cereAprobare(server);
    server.raspunde("approval_tasks", "select", { data: { id: ID_1, entity_id: ID_2 } });
    server.raspunde("approval_tasks", "update", { data: { id: ID_1 } });
    server.raspunde("attendance_week_submissions", "update", { data: { id: ID_2 } });
    admin.raspunde("attendance_week_submissions", "select", {
      data: { employee_id: ID_3, saptamana_start: "2026-07-13" },
    });
    server.raspunde("attendance_settings", "select", { data: setari({ ore_pe_zi: 6 }) });
    colaboratori.zileNelucratoare.mockResolvedValue({
      nationale: [{ data: "2026-07-14" }],
      organizatie: [],
    });

    const r = await decideSaptamanaPontaj({ ...RESPINGERE, decizie: "aprobata" });

    expect(r).toEqual({ ok: true, data: { id: ID_2, scrise: 5, pastrate: 1 } });
    const [saptamana] = server.apeluriPe("attendance_week_submissions", "update");
    expect(saptamana?.payload).toMatchObject({ status: "aprobata", motiv_respingere: null });
    const [citire] = admin.apeluriPe("attendance_week_submissions", "select");
    expect(areFiltru(citire, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(colaboratori.zileNelucratoare).toHaveBeenCalledWith(ORG_ID, 2026, 2026);
    // Setările de la data SĂPTĂMÂNII (luni 13), nu de azi (miercuri 15).
    const [citireSetari] = server.apeluriPe("attendance_settings", "select");
    expect(areFiltru(citireSetari, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citireSetari, "lte", "valabil_de_la", "2026-07-13")).toBe(true);

    const argumente = colaboratori.scriePontajulSaptamanii.mock.calls[0] ?? [];
    expect(argumente[0]).toBe(admin.client);
    expect(argumente.slice(1, 4)).toEqual([ORG_ID, ID_2, ID_3]);
    expect(argumente[4]).toMatchObject({ orePeZi: 6, noapteStart: "22:00" });
    // Tipul zilei vine din calendarul firmei: 14 iulie e sărbătoare aici.
    const tipZi = argumente[5] as (data: string) => string;
    expect(tipZi("2026-07-14")).toBe("sarbatoare");
    expect(tipZi("2026-07-13")).toBe("lucratoare");
    expect(argumente.slice(6, 8)).toEqual([USER_ID, ACUM.toISOString()]);
  });

  it("aprobarea unei submisii pe care adminul n-o mai găsește nu scrie nimic în pontaj", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: APROBARE });
    cereAprobare(server);
    server.raspunde("approval_tasks", "select", { data: { id: ID_1, entity_id: ID_2 } });
    server.raspunde("approval_tasks", "update", { data: { id: ID_1 } });
    server.raspunde("attendance_week_submissions", "update", { data: { id: ID_2 } });
    admin.raspunde("attendance_week_submissions", "select", { data: null });

    const r = await decideSaptamanaPontaj({ ...RESPINGERE, decizie: "aprobata" });

    expect(r).toEqual({ ok: true, data: { id: ID_2, scrise: 0, pastrate: 0 } });
    expect(colaboratori.scriePontajulSaptamanii).not.toHaveBeenCalled();
  });

  it("sarcina decisă între timp de altcineva (zero rânduri) ⇒ CONFLICT, submisia neatinsă", async () => {
    const { server } = configureazaActiunea({ permisiuni: APROBARE });
    cereAprobare(server);
    server.raspunde("approval_tasks", "select", { data: { id: ID_1, entity_id: ID_2 } });
    server.raspunde("approval_tasks", "update", { data: null });
    const r = await decideSaptamanaPontaj(RESPINGERE);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_week_submissions")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("submisia retrimisă între citire și scriere (zero rânduri) ⇒ CONFLICT, fără pontaj", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: APROBARE });
    cereAprobare(server);
    server.raspunde("approval_tasks", "select", { data: { id: ID_1, entity_id: ID_2 } });
    server.raspunde("approval_tasks", "update", { data: { id: ID_1 } });
    server.raspunde("attendance_week_submissions", "update", { data: null });
    const r = await decideSaptamanaPontaj({ ...RESPINGERE, decizie: "aprobata" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(admin.apeluri).toHaveLength(0);
  });
});
