// src/app/(app)/pontaj/actions-pontare-rapida.test.ts
//
// Pontarea rapidă (0096): „Am intrat”, „Am ieșit”, „Confirm ziua standard”.
// Nicio acțiune nu primește de la client ora, orele sau angajatul: ora vine din
// ceasul serverului (aici, înghețat la 16:32 ora României), orele din setări,
// fișa din sesiune. Testele verifică exact asta.

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

const colaboratori = vi.hoisted(() => ({ zileNelucratoare: vi.fn() }));
vi.mock("@/lib/queries/leave", () => ({ zileNelucratoare: colaboratori.zileNelucratoare }));

import { caiRevalidate, configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { confirmaZiuaStandard, pontezaIesirea, pontezaIntrarea } from "./actions";

const PERMIS = { "attendance:create": "own" } as const;
const FISA = ID_3;
/** 13:32 UTC = 16:32 la București (EEST), miercuri 15 iulie 2026. */
const ACUM = new Date("2026-07-15T13:32:00Z");
const AZI = "2026-07-15";
const CAI = ["/pontaj", "/pontaj/perioade", "/pontaj/aprobare", "/portal", "/portal/pontajul-meu"];
const COD = "abcdefghijklmnopqrstuvwxyz012345";

type Rapida = Partial<{
  varianta_pontaj: string;
  mod_pontare_rapida: string;
  verificare_pontare: string;
  program_start: string | null;
}>;

/**
 * Preambulul comun: setări + configurația rapidă (server), apoi — după cod —
 * fișa (admin). `rapida: null` = firma n-a salvat nimic (implicit `ceas`).
 */
function preambul(
  server: ClientFals,
  admin: ClientFals,
  rapida: Rapida | null,
  setari: unknown = null,
) {
  server.raspunde("attendance_settings", "select", { data: setari });
  server.raspunde("setari_pontare_rapida", "select", {
    data:
      rapida === null
        ? null
        : {
            mod_pontare_rapida: "ceas",
            verificare_pontare: "optional",
            program_start: null,
            necesita_aprobare: true,
            ...rapida,
          },
  });
  admin.raspunde("employees", "select", { data: { id: FISA } });
}

function ziua(server: ClientFals, zi: Record<string, unknown> | null) {
  server.raspunde("attendance_entries", "select", {
    data:
      zi === null
        ? null
        : {
            id: ID_2,
            ora_inceput: null,
            ora_sfarsit: null,
            ore_lucrate: 0,
            leave_request_id: null,
            tip_zi: "lucratoare",
            ...zi,
          },
  });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ACUM);
  colaboratori.zileNelucratoare.mockReset().mockResolvedValue({ nationale: [], organizatie: [] });
  return () => vi.useRealTimers();
});

describe.each([
  ["pontezaIntrarea", pontezaIntrarea],
  ["pontezaIesirea", pontezaIesirea],
  ["confirmaZiuaStandard", confirmaZiuaStandard],
] as const)("%s — poarta și dovada de prezență", (_nume, actiune) => {
  it("fără `attendance:create` ⇒ INTERZIS, nicio interogare", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: {} });
    const r = await actiune({});
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("pontarea rapidă oprită ⇒ CONFLICT, fără fișă și fără scriere", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, { mod_pontare_rapida: "oprit" });
    const r = await actiune({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(admin.apeluriPe("employees")).toHaveLength(0);
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
  });

  // Varianta săptămânală (0165) bate orice mod — inclusiv `ambele`, care altfel
  // ar lăsa să treacă toate trei acțiunile.
  it("varianta săptămânală ⇒ CONFLICT care trimite la fișa săptămânii, fără scriere", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, {
      mod_pontare_rapida: "ambele",
      program_start: "08:00:00",
      varianta_pontaj: "saptamanal",
    });
    const r = await actiune({});
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("fișa săptămânii") },
    });
    expect(admin.apeluriPe("employees")).toHaveLength(0);
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
  });

  it("firma cere codul QR, iar cererea vine fără el ⇒ CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, {
      mod_pontare_rapida: "ambele",
      verificare_pontare: "cod_qr",
      program_start: "08:00:00",
    });
    const r = await actiune({ cod_punct_lucru: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(admin.apeluriPe("employees")).toHaveLength(0);
  });

  it("un cod PREZENT, dar al nimănui, e refuzat — nu trece drept pontare fără punct", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, { mod_pontare_rapida: "ambele", program_start: "08:00:00" });
    admin.raspunde("puncte_lucru", "select", { data: null });

    const r = await actiune({ cod_punct_lucru: COD });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [punct] = admin.apeluriPe("puncte_lucru");
    expect(areFiltru(punct, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(punct, "eq", "cod_pontaj", COD)).toBe(true);
    expect(areFiltru(punct, "eq", "activ", true)).toBe(true);
    expect(areFiltru(punct, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
  });
});

describe("pontezaIntrarea", () => {
  it("zi neîncepută: INSERT cu ora serverului, zero ore, sursa `pontare_rapida`", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    preambul(server, admin, null);
    ziua(server, null);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    const r = await pontezaIntrarea({});

    expect(r).toEqual({
      ok: true,
      data: { id: ID_1, ora_inceput: "16:32", reluare: false, punct_lucru: null },
    });
    const [citire] = server.apeluriPe("attendance_entries", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "eq", "employee_id", FISA)).toBe(true);
    expect(areFiltru(citire, "eq", "data", AZI)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: FISA,
      data: AZI,
      tip_zi: "lucratoare",
      ora_inceput: "16:32",
      ora_sfarsit: null,
      ore_lucrate: 0,
      ore_suplimentare: 0,
      ore_noapte: 0,
      punct_lucru_id: null,
      sursa: "pontare_rapida",
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("cu cod valid: punctul de lucru se reține pe zi și se numește în răspuns", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, { verificare_pontare: "cod_qr" });
    admin.raspunde("puncte_lucru", "select", { data: { id: ID_2, denumire: "Depozit Nord" } });
    ziua(server, null);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    const r = await pontezaIntrarea({ cod_punct_lucru: COD });

    expect(r).toMatchObject({ ok: true, data: { punct_lucru: "Depozit Nord" } });
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({ punct_lucru_id: ID_2 });
  });

  it("verificarea `fara` ignoră codul trimis — nu-l caută", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, { verificare_pontare: "fara" });
    ziua(server, null);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });
    const r = await pontezaIntrarea({ cod_punct_lucru: COD });
    expect(r).toMatchObject({ ok: true, data: { punct_lucru: null } });
    expect(admin.apeluriPe("puncte_lucru")).toHaveLength(0);
  });

  it("a doua atingere pe o zi deja deschisă e IDEMPOTENTĂ: succes, nicio scriere", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null);
    ziua(server, { ora_inceput: "07:45:00" });

    const r = await pontezaIntrarea({});

    expect(r).toEqual({
      ok: true,
      data: { id: ID_2, ora_inceput: "07:45", reluare: true, punct_lucru: null },
    });
    expect(server.apeluriPe("attendance_entries", "insert")).toHaveLength(0);
    expect(server.apeluriPe("attendance_entries", "update")).toHaveLength(0);
  });

  it("zi deja încheiată ⇒ CONFLICT care numește intervalul", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null);
    ziua(server, { ora_inceput: "08:00:00", ora_sfarsit: "12:00:00", ore_lucrate: 4 });
    const r = await pontezaIntrarea({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("de la 08:00 până la 12:00");
  });

  it("zi din concediu ⇒ CONFLICT, fără scriere", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null);
    ziua(server, { leave_request_id: ID_1, tip_zi: "concediu" });
    const r = await pontezaIntrarea({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries", "insert")).toHaveLength(0);
  });

  it("rând gol existent: se deschide prin UPDATE, cu `.select()`; zero rânduri ⇒ CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null);
    ziua(server, {});
    server.raspunde("attendance_entries", "update", { data: { id: ID_2 } });

    const r = await pontezaIntrarea({});

    expect(r).toMatchObject({ ok: true, data: { id: ID_2, reluare: false } });
    const [update] = server.apeluriPe("attendance_entries", "update");
    expect(update?.payload).toMatchObject({ ora_inceput: "16:32", sursa: "pontare_rapida" });
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();

    const doi = configureazaActiunea({ permisiuni: PERMIS });
    preambul(doi.server, doi.admin, null);
    ziua(doi.server, {});
    doi.server.raspunde("attendance_entries", "update", { data: null });
    const r2 = await pontezaIntrarea({});
    expect(r2).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("luna blocată (P0001 din trigger) ⇒ CONFLICT cu mesajul triggerului", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null);
    ziua(server, null);
    const mesaj = "Perioada de pontaj 07.2026 este blocată.";
    server.raspunde("attendance_entries", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await pontezaIntrarea({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("pontezaIesirea", () => {
  it("modul `confirmare` nu permite ceasul ⇒ CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, { mod_pontare_rapida: "confirmare", program_start: "08:00:00" });
    const r = await pontezaIesirea({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("închide ziua la ora serverului, cu orele DERIVATE din setări", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null);
    ziua(server, { ora_inceput: "08:00:00" });
    server.raspunde("attendance_entries", "update", { data: { id: ID_2 } });

    const r = await pontezaIesirea({});

    // 08:00 → 16:32 = 8 h 32 min = 8,53 h; norma implicită 8 ⇒ 0,53 suplimentare.
    expect(r).toEqual({ ok: true, data: { id: ID_2, ora_sfarsit: "16:32", ore_lucrate: 8.53 } });
    const [update] = server.apeluriPe("attendance_entries", "update");
    expect(update?.payload).toEqual({
      ora_sfarsit: "16:32",
      ore_lucrate: 8.53,
      ore_suplimentare: 0.53,
      ore_noapte: 0,
    });
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("pauza de masă necuprinsă în program se scade", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null, {
      ore_pe_zi: 8,
      noapte_start: "22:00:00",
      noapte_sfarsit: "06:00:00",
      pauza_masa_minute: 30,
      pauza_masa_inclusa_in_program: false,
      pauza_obligatorie_peste_ore: 6,
    });
    ziua(server, { ora_inceput: "08:00:00" });
    server.raspunde("attendance_entries", "update", { data: { id: ID_2 } });
    const r = await pontezaIesirea({});
    expect(r).toMatchObject({ ok: true, data: { ore_lucrate: 8.03 } });
  });

  it.each([
    ["nicio zi azi", null],
    ["zi încheiată", { ora_inceput: "08:00:00", ora_sfarsit: "12:00:00", ore_lucrate: 4 }],
    ["zi goală, nedeschisă", {}],
  ])("%s ⇒ CONFLICT „apăsați întâi Am intrat”, fără scriere", async (_d, zi) => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null);
    ziua(server, zi);
    const r = await pontezaIesirea({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries", "update")).toHaveLength(0);
  });

  it("ziua deschisă aseară (ora de intrare după ora curentă) ⇒ CONFLICT, nu ore negative", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null);
    ziua(server, { ora_inceput: "22:10:00" });
    const r = await pontezaIesirea({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries", "update")).toHaveLength(0);
  });

  it("zi aprobată între timp (zero rânduri) ⇒ CONFLICT, fără revalidare", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null);
    ziua(server, { ora_inceput: "08:00:00" });
    server.raspunde("attendance_entries", "update", { data: null });
    const r = await pontezaIesirea({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("confirmaZiuaStandard", () => {
  const CONFIRMARE = { mod_pontare_rapida: "confirmare", program_start: "08:00:00" } as const;

  it("modul `ceas` nu permite confirmarea ⇒ CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, null);
    const r = await confirmaZiuaStandard({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("fără ora de început a programului ⇒ CONFLICT, fără citirea zilei", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, { mod_pontare_rapida: "ambele", program_start: null });
    const r = await confirmaZiuaStandard({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
  });

  it("programul care trece de miezul nopții ⇒ CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, { mod_pontare_rapida: "confirmare", program_start: "20:00:00" });
    const r = await confirmaZiuaStandard({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("attendance_entries")).toHaveLength(0);
  });

  it("zi neîncepută: INSERT cu intervalul propus din program și normă, nu cu ora curentă", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, CONFIRMARE, {
      ore_pe_zi: 8,
      noapte_start: "22:00:00",
      noapte_sfarsit: "06:00:00",
      pauza_masa_minute: 60,
      pauza_masa_inclusa_in_program: false,
      pauza_obligatorie_peste_ore: 6,
    });
    ziua(server, null);
    server.raspunde("attendance_entries", "insert", { data: { id: ID_1 } });

    const r = await confirmaZiuaStandard({});

    // 08:00 + 8 h normă + 1 h pauză necuprinsă = 17:00; lucrate rămân 8.
    expect(r).toEqual({
      ok: true,
      data: { id: ID_1, ora_inceput: "08:00", ora_sfarsit: "17:00", ore_lucrate: 8 },
    });
    const [insert] = server.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: FISA,
      data: AZI,
      ora_inceput: "08:00",
      ora_sfarsit: "17:00",
      ore_lucrate: 8,
      ore_suplimentare: 0,
      sursa: "pontare_rapida",
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("rând gol existent: UPDATE cu `.select()`; zero rânduri ⇒ CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, CONFIRMARE);
    ziua(server, {});
    server.raspunde("attendance_entries", "update", { data: null });

    const r = await confirmaZiuaStandard({});

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [update] = server.apeluriPe("attendance_entries", "update");
    expect(update?.payload).toMatchObject({ ora_inceput: "08:00", ora_sfarsit: "16:00" });
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
  });

  it("rând gol existent completat: întoarce rândul SCRIS, cu intervalul propus, fără INSERT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, CONFIRMARE);
    ziua(server, {});
    server.raspunde("attendance_entries", "update", { data: { id: ID_2 } });

    const r = await confirmaZiuaStandard({});

    expect(r).toEqual({
      ok: true,
      data: { id: ID_2, ora_inceput: "08:00", ora_sfarsit: "16:00", ore_lucrate: 8 },
    });
    expect(server.apeluriPe("attendance_entries", "insert")).toHaveLength(0);
    const [update] = server.apeluriPe("attendance_entries", "update");
    expect(update?.payload).toMatchObject({ sursa: "pontare_rapida", ore_lucrate: 8 });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it.each([
    ["zi în curs", { ora_inceput: "08:00:00" }, "Am ieșit"],
    [
      "zi încheiată",
      { ora_inceput: "08:00:00", ora_sfarsit: "12:00:00", ore_lucrate: 4 },
      "deja pontată",
    ],
    ["zi de concediu medical", { tip_zi: "medical" }, "deja înregistrată"],
  ])("%s ⇒ CONFLICT, fără scriere", async (_d, zi, fragment) => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    preambul(server, admin, CONFIRMARE);
    ziua(server, zi);
    const r = await confirmaZiuaStandard({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain(fragment);
    expect(server.apeluriPe("attendance_entries", "insert")).toHaveLength(0);
    expect(server.apeluriPe("attendance_entries", "update")).toHaveLength(0);
  });
});
