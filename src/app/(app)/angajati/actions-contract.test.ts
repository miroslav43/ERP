// src/app/(app)/angajati/actions-contract.test.ts
//
// Contractele de muncă și datele sensibile, din `./actions.ts`: crearea,
// încetarea, modificarea salariului și dezvăluirea auditată a CNP/IBAN.
// Straturile comune ale lui `createAction` sunt verificate în testul canonic
// (`salarizare/actions.test.ts`).

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

// Generarea REVISAL are propriile interogări (termene, calendar); aici contează
// doar CE eveniment cere acțiunea și că un eșec al ei nu anulează contractul.
const { genereazaEvenimenteFals } = vi.hoisted(() => ({ genereazaEvenimenteFals: vi.fn() }));
vi.mock("@/lib/reges/genereaza-evenimente", async (orig) => ({
  ...(await orig<typeof import("@/lib/reges/genereaza-evenimente")>()),
  genereazaEvenimenteReges: genereazaEvenimenteFals,
}));

// Documentul actului are propriile citiri (fișa, firma, șablonul); aici contează
// că se cere cu datele corecte și că un eșec al lui nu anulează actul.
const { actFals } = vi.hoisted(() => ({ actFals: vi.fn() }));
vi.mock("@/lib/documents/act-aditional", () => ({ genereazaActAditionalSalariu: actFals }));

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
import { catreBytea, encrypt, versiuneCaNumar } from "@/lib/crypto/aes-gcm";
import {
  creeazaContract,
  dezvaluieDateSensibile,
  inceteazaContract,
  modificaSalariulContractului,
} from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  genereazaEvenimenteFals.mockReset();
  genereazaEvenimenteFals.mockResolvedValue({ create: 1, respinse: [] });
  actFals.mockReset();
  actFals.mockResolvedValue({ id: "doc", numarAfisat: "AAS 2026/000001" });
});

type Fals = ReturnType<typeof configureazaActiunea>["server"];

// ── creeazaContract ──────────────────────────────────────────────────────────

describe("creeazaContract", () => {
  const PERMIS = { "employees:create": "all" } as const;
  const CONTRACT_NOU = ID_2;
  const intrare = {
    employee_id: ID_1,
    numar: "12/2026",
    data_contract: "2026-09-28",
    valabil_de_la: "2026-10-01",
    salariu_baza: 5000,
  };

  function programeaza(server: Fals, opts: { actAditional?: boolean } = {}) {
    server.raspunde("employment_contracts", "insert", { data: { id: CONTRACT_NOU } });
    server.raspunde("employment_contracts", "update", { data: { id: CONTRACT_NOU } });
    if (opts.actAditional !== true) {
      server.raspunde("employees", "update", { data: { id: ID_1 } });
      server.raspundeRpc("seed_leave_balances", { data: null });
    }
  }

  it("employees:create sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:create": "team" } });
    const r = await creeazaContract(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: inserează ca `proiect` (cerut de RLS), apoi îl activează cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);

    const r = await creeazaContract(intrare);

    expect(r).toEqual({ ok: true, data: { id: CONTRACT_NOU } });
    const [insert] = server.apeluriPe("employment_contracts", "insert");
    expect(insert?.payload).toMatchObject({
      employee_id: ID_1,
      numar: "12/2026",
      salariu_baza: 5000,
      organization_id: ORG_ID,
      status: "proiect",
      cod_revisal: null,
      incetat_la: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    const [activare] = server.apeluriPe("employment_contracts", "update");
    expect(activare?.payload).toEqual({ status: "activ", updated_by: USER_ID });
    expect(areFiltru(activare, "eq", "id", CONTRACT_NOU)).toBe(true);
    expect(areFiltru(activare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(activare?.selectDupaScriere).toBeDefined();
  });

  it("contractul de bază face fișa activă, seamănă soldul anului de angajare și cere evenimentul de angajare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);

    await creeazaContract({ ...intrare, zile_concediu_anual: 25 });

    const [fisa] = server.apeluriPe("employees", "update");
    expect(fisa?.payload).toEqual({ status: "activ", updated_by: USER_ID });
    expect(areFiltru(fisa, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(fisa?.selectDupaScriere).toBeDefined();
    expect(server.apeluriRpc.find((a) => a.nume === "seed_leave_balances")?.argumente).toEqual({
      p_employee: ID_1,
      p_an: 2026,
      p_zile_odihna_override: 25,
    });
    const parametri = genereazaEvenimenteFals.mock.calls[0]?.[0] as {
      organizationId: string;
      evenimente: Record<string, unknown>[];
    };
    expect(parametri.organizationId).toBe(ORG_ID);
    expect(parametri.evenimente).toEqual([
      expect.objectContaining({
        employeeId: ID_1,
        contractId: CONTRACT_NOU,
        tip: "angajare",
        dataEvenimentului: "2026-10-01",
        dataContract: "2026-09-28",
      }),
    ]);
    expect(caiRevalidate()).toEqual([`/angajati/${ID_1}`, "/reges"]);
  });

  it("act adițional: NU cere evenimentul de angajare (ar fi un al doilea AdaugareContract)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, { actAditional: true });
    const r = await creeazaContract({
      ...intrare,
      este_act_aditional: true,
      parent_contract_id: ID_3,
    });
    expect(r.ok).toBe(true);
    expect(genereazaEvenimenteFals).not.toHaveBeenCalled();
  });

  it("act adițional: nu schimbă starea fișei și nu seamănă soldul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, { actAditional: true });

    const r = await creeazaContract({
      ...intrare,
      este_act_aditional: true,
      parent_contract_id: ID_3,
    });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("employees")).toHaveLength(0);
    expect(server.apeluriRpc.filter((a) => a.nume === "seed_leave_balances")).toHaveLength(0);
  });

  it.each([
    ["act adițional fără contractul de bază", { este_act_aditional: true }, "parent_contract_id"],
    [
      "durată determinată fără dată de sfârșit",
      { contract_duration: "determinat" },
      "valabil_pana",
    ],
    ["sfârșit înaintea începutului", { valabil_pana: "2026-09-01" }, "valabil_pana"],
    ["telemuncă fără loc", { work_mode: "telemunca" }, "loc_telemunca"],
  ])("schema refuză %s: VALIDARE, fără nicio scriere", async (_n, modificare, camp) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await creeazaContract({ ...intrare, ...modificare });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
  });

  it("activarea respinsă tăcut (zero rânduri): CONFLICT; fișa, soldul și REVISAL nu se ating", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "insert", { data: { id: CONTRACT_NOU } });
    server.raspunde("employment_contracts", "update", { data: null });

    const r = await creeazaContract(intrare);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employees")).toHaveLength(0);
    expect(genereazaEvenimenteFals).not.toHaveBeenCalled();
    expect(caiRevalidate()).toEqual([]);
  });

  it("fișa nu poate fi activată (zero rânduri): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "insert", { data: { id: CONTRACT_NOU } });
    server.raspunde("employment_contracts", "update", { data: { id: CONTRACT_NOU } });
    server.raspunde("employees", "update", { data: null });
    const r = await creeazaContract(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(genereazaEvenimenteFals).not.toHaveBeenCalled();
  });

  it("soldul sau REVISAL eșuează: contractul rămâne creat (pași best-effort)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "insert", { data: { id: CONTRACT_NOU } });
    server.raspunde("employment_contracts", "update", { data: { id: CONTRACT_NOU } });
    server.raspunde("employees", "update", { data: { id: ID_1 } });
    server.raspundeRpc("seed_leave_balances", { error: eroarePostgrest("P0001") });
    genereazaEvenimenteFals.mockRejectedValue(new Error("termene indisponibile"));

    const r = await creeazaContract(intrare);

    expect(r).toEqual({ ok: true, data: { id: CONTRACT_NOU } });
  });

  it("numărul de contract deja folosit (23505): CONFLICT, fără activare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "insert", { error: eroarePostgrest("23505") });
    const r = await creeazaContract(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employment_contracts", "update")).toHaveLength(0);
  });

  it("salariul nu intră în jurnalul de audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    await creeazaContract({ ...intrare, salariu_baza: 7777 });
    await asteaptaDupa();
    const [succes] = server.audituri().filter((a) => a["p_status"] === "success");
    expect(succes?.["p_entity_id"]).toBe(CONTRACT_NOU);
    expect(succes?.["p_after"]).not.toHaveProperty("salariu_baza");
  });
});

// ── inceteazaContract ────────────────────────────────────────────────────────

describe("inceteazaContract", () => {
  const PERMIS = { "employees:update": "all" } as const;
  const contract = {
    id: ID_2,
    employee_id: ID_1,
    status: "activ",
    valabil_de_la: "2024-03-01",
    data_contract: "2024-02-20",
    este_act_aditional: false,
  };
  const intrare = {
    contract_id: ID_2,
    incetat_la: "2026-10-15",
    temei_incetare: "art. 55 lit. b",
    motiv_incetare: "Acordul părților",
  };

  function programeaza(server: Fals, ramase: number) {
    server.raspunde("employment_contracts", "select", { data: contract });
    server.raspunde("employment_contracts", "update", { data: { id: ID_2 } });
    server.raspunde("employment_contracts", "select", { count: ramase });
  }

  it("employees:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:update": "team" } });
    const r = await inceteazaContract(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("ultimul contract activ: încetează contractul și scoate fișa din efectiv, apoi cere evenimentul REVISAL", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, 0);
    server.raspunde("employees", "update", { data: { id: ID_1 } });

    const r = await inceteazaContract(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2, employee_id: ID_1 } });
    const [citire, numarare] = server.apeluriPe("employment_contracts", "select");
    expect(areFiltru(citire, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [update] = server.apeluriPe("employment_contracts", "update");
    expect(update?.payload).toEqual({
      status: "incetat",
      incetat_la: "2026-10-15",
      motiv_incetare: "Acordul părților",
      temei_incetare: "art. 55 lit. b",
      updated_by: USER_ID,
    });
    // Fără filtrul pe id, UPDATE-ul ar înceta TOATE contractele firmei.
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();

    // Rămase = contracte de BAZĂ active ale aceluiași om, nu acte adiționale,
    // și nu contracte șterse logic (acelea nu țin fișa în efectiv).
    expect(areFiltru(numarare, "eq", "employee_id", ID_1)).toBe(true);
    expect(areFiltru(numarare, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(numarare, "eq", "este_act_aditional", false)).toBe(true);
    expect(areFiltru(numarare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(numarare, "is", "deleted_at", null)).toBe(true);

    const [fisa] = server.apeluriPe("employees", "update");
    expect(fisa?.payload).toEqual({
      status: "incetat",
      terminated_on: "2026-10-15",
      updated_by: USER_ID,
    });
    expect(areFiltru(fisa, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(fisa?.selectDupaScriere).toBeDefined();

    const parametri = genereazaEvenimenteFals.mock.calls[0]?.[0] as {
      evenimente: Record<string, unknown>[];
    };
    expect(parametri.evenimente[0]).toMatchObject({
      tip: "incetare",
      contractId: ID_2,
      dataEvenimentului: "2026-10-15",
      valabilDeLa: "2024-03-01",
    });
    expect(caiRevalidate()).toEqual(["/angajati", `/angajati/${ID_1}`, "/reges"]);
  });

  it("cu arhivare cerută: fișa trece în `arhivat`, nu în `incetat`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, 0);
    server.raspunde("employees", "update", { data: { id: ID_1 } });
    await inceteazaContract({ ...intrare, arhiveaza_fisa: true });
    expect(server.apeluriPe("employees", "update")[0]?.payload).toMatchObject({
      status: "arhivat",
    });
  });

  it("mai rămâne un contract activ: fișa rămâne în efectiv", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, 1);
    const r = await inceteazaContract(intrare);
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("employees")).toHaveLength(0);
  });

  it("contract inexistent: NEGASIT, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: null });
    const r = await inceteazaContract(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("employment_contracts", "update")).toHaveLength(0);
  });

  it("contract deja încetat: CONFLICT, fără a doua încetare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: { ...contract, status: "incetat" } });
    const r = await inceteazaContract(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employment_contracts", "update")).toHaveLength(0);
    expect(genereazaEvenimenteFals).not.toHaveBeenCalled();
  });

  it("data încetării înaintea începutului contractului: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: contract });
    const r = await inceteazaContract({ ...intrare, incetat_la: "2024-02-28" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employment_contracts", "update")).toHaveLength(0);
  });

  it("încetarea respinsă tăcut (zero rânduri): CONFLICT, iar REVISAL nu primește o încetare inexistentă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: contract });
    server.raspunde("employment_contracts", "update", { data: null });
    const r = await inceteazaContract(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(genereazaEvenimenteFals).not.toHaveBeenCalled();
    expect(server.apeluriPe("employees")).toHaveLength(0);
  });

  it("fișa rămasă în efectiv (zero rânduri la fișă): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, 0);
    server.raspunde("employees", "update", { data: null });
    const r = await inceteazaContract(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

// ── modificaSalariulContractului ─────────────────────────────────────────────

describe("modificaSalariulContractului — act adițional", () => {
  const PERMIS = { "employees:create": "all", "employees:update": "all" } as const;
  const contract = {
    id: ID_2,
    employee_id: ID_1,
    status: "activ",
    este_act_aditional: false,
    numar: "42/2026",
    data_contract: "2026-01-10",
    salariu_baza: 5000,
    valabil_de_la: "2026-01-15",
    valabil_pana: null,
    contract_duration: "nedeterminat",
    motiv_determinat: null,
    norma_ore_saptamana: 40,
    norma_ore_zi: 8,
    work_mode: "sediu",
    special_regime: null,
    loc_telemunca: null,
    loc_munca: "Sediu",
    punct_lucru_id: null,
    department_id: ID_3,
    functie: "Contabil",
    cod_cor: "241103",
    conditii_munca: "normale",
    moneda: "RON",
    zile_concediu_anual: 21,
    preaviz_zile: 20,
    nivel_incadrare: null,
    cost_center: null,
    reges_tip_contract: "ContractIndividualMunca",
    reges_tip_norma: null,
    reges_norma_timp: null,
    reges_repartizare: null,
  };
  const intrare = {
    contract_id: ID_2,
    salariu_baza: 6000,
    valabil_de_la: "2026-11-01",
    data_act: "2026-10-20",
  };
  const ACT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  function programeaza(server: Fals, acte: readonly object[] = []) {
    server.raspunde("employment_contracts", "select", { data: contract });
    server.raspunde("employment_contracts", "select", { data: acte });
  }

  it("fără employees:create la `all`: INTERZIS — inserarea trece prin `contracts_insert`", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "employees:create": "team", "employees:update": "all" },
    });
    const r = await modificaSalariulContractului(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("creează actul ca rând NOU, copie a contractului cu salariul nou; contractul de bază nu se atinge", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspunde("employment_contracts", "insert", {
      data: { id: ACT_ID, numar: "42/2026-AA1" },
    });
    server.raspunde("employment_contracts", "update", { data: { id: ACT_ID } });

    const r = await modificaSalariulContractului(intrare);

    expect(r).toEqual({
      ok: true,
      data: {
        id: ACT_ID,
        employee_id: ID_1,
        numar: "42/2026-AA1",
        document: "AAS 2026/000001",
        avertismente: [],
      },
    });
    const [insert] = server.apeluriPe("employment_contracts", "insert");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: ID_1,
      parent_contract_id: ID_2,
      este_act_aditional: true,
      numar: "42/2026-AA1",
      data_contract: "2026-10-20",
      valabil_de_la: "2026-11-01",
      salariu_baza: 6000,
      // Restul termenilor vin neschimbați de pe contract.
      norma_ore_saptamana: 40,
      functie: "Contabil",
      cod_cor: "241103",
      reges_tip_contract: "ContractIndividualMunca",
      status: "proiect",
      created_by: USER_ID,
    });
    // Un singur UPDATE: activarea ACTULUI. Contractul de bază rămâne cum a fost semnat.
    const updateuri = server.apeluriPe("employment_contracts", "update");
    expect(updateuri).toHaveLength(1);
    expect(updateuri[0]?.payload).toEqual({ status: "activ", updated_by: USER_ID });
    expect(areFiltru(updateuri[0], "eq", "id", ACT_ID)).toBe(true);
    expect(updateuri[0]?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/angajati", `/angajati/${ID_1}`, "/reges"]);
  });

  it("emite documentul cu salariul VECHI și cel nou, și pune `modificare_salariu` pe rândul actului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspunde("employment_contracts", "insert", {
      data: { id: ACT_ID, numar: "42/2026-AA1" },
    });
    server.raspunde("employment_contracts", "update", { data: { id: ACT_ID } });

    await modificaSalariulContractului(intrare);

    expect(actFals.mock.calls[0]?.[1]).toEqual({
      organizationId: ORG_ID,
      employeeId: ID_1,
      actId: ACT_ID,
      emisDe: USER_ID,
      contractNumar: "42/2026",
      contractData: "2026-01-10",
      numarAct: "42/2026-AA1",
      dataAct: "2026-10-20",
      salariuVechi: 5000,
      salariuNou: 6000,
      dataAplicarii: "2026-11-01",
    });
    const [eveniment] = genereazaEvenimenteFals.mock.calls[0]?.[0].evenimente ?? [];
    expect(eveniment).toMatchObject({
      employeeId: ID_1,
      contractId: ACT_ID,
      tip: "modificare_salariu",
      dataEvenimentului: "2026-11-01",
      valabilDeLa: "2026-11-01",
      dataContract: "2026-10-20",
    });
  });

  it("după un act anterior: salariul vechi e al actului în vigoare, numărul e AA2", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, [
      {
        id: ID_3,
        este_act_aditional: true,
        parent_contract_id: ID_2,
        status: "activ",
        valabil_de_la: "2026-06-01",
        valabil_pana: null,
        data_contract: "2026-05-20",
        salariu_baza: 5500,
        norma_ore_zi: 8,
        norma_ore_saptamana: 40,
      },
    ]);
    server.raspunde("employment_contracts", "insert", {
      data: { id: ACT_ID, numar: "42/2026-AA2" },
    });
    server.raspunde("employment_contracts", "update", { data: { id: ACT_ID } });

    await modificaSalariulContractului(intrare);

    expect(server.apeluriPe("employment_contracts", "insert")[0]?.payload).toMatchObject({
      numar: "42/2026-AA2",
    });
    expect(actFals.mock.calls[0]?.[1]).toMatchObject({ salariuVechi: 5500, salariuNou: 6000 });
  });

  it("număr ocupat (23505): ia sufixul următor", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspunde("employment_contracts", "insert", { error: eroarePostgrest("23505") });
    server.raspunde("employment_contracts", "insert", {
      data: { id: ACT_ID, numar: "42/2026-AA2" },
    });
    server.raspunde("employment_contracts", "update", { data: { id: ACT_ID } });

    const r = await modificaSalariulContractului(intrare);

    expect(r.ok).toBe(true);
    expect(
      server
        .apeluriPe("employment_contracts", "insert")
        .map((a) => (a.payload as { numar: string }).numar),
    ).toEqual(["42/2026-AA1", "42/2026-AA2"]);
  });

  it("activarea respinsă de RLS (zero rânduri): CONFLICT care spune că salariul NU s-a modificat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspunde("employment_contracts", "insert", {
      data: { id: ACT_ID, numar: "42/2026-AA1" },
    });
    server.raspunde("employment_contracts", "update", { data: null });
    const r = await modificaSalariulContractului(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("NU");
    expect(actFals).not.toHaveBeenCalled();
    expect(genereazaEvenimenteFals).not.toHaveBeenCalled();
  });

  it("documentul și REGES eșuează: actul rămâne, iar omul primește avertismente", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspunde("employment_contracts", "insert", {
      data: { id: ACT_ID, numar: "42/2026-AA1" },
    });
    server.raspunde("employment_contracts", "update", { data: { id: ACT_ID } });
    actFals.mockRejectedValue(new Error("șablon"));
    genereazaEvenimenteFals.mockRejectedValue(new Error("reges"));

    const r = await modificaSalariulContractului(intrare);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.document).toBeNull();
    expect(r.data.avertismente).toHaveLength(2);
    expect(r.data.avertismente[1]).toContain("REGES");
  });

  it("suma salarială nu intră în jurnalul de audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspunde("employment_contracts", "insert", {
      data: { id: ACT_ID, numar: "42/2026-AA1" },
    });
    server.raspunde("employment_contracts", "update", { data: { id: ACT_ID } });
    await modificaSalariulContractului({ ...intrare, salariu_baza: 6123 });
    await asteaptaDupa();
    const [succes] = server.audituri().filter((a) => a["p_status"] === "success");
    expect(succes?.["p_after"]).toEqual({
      contract_id: ID_2,
      valabil_de_la: "2026-11-01",
      data_act: "2026-10-20",
    });
  });

  it.each([
    ["încetat", { status: "incetat" }],
    ["act adițional", { este_act_aditional: true }],
  ])("contract %s: CONFLICT, nimic scris", async (_n, modificare) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: { ...contract, ...modificare } });
    const r = await modificaSalariulContractului(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employment_contracts", "insert")).toHaveLength(0);
  });

  it("aplicare înainte de începutul contractului: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: contract });
    const r = await modificaSalariulContractului({
      ...intrare,
      valabil_de_la: "2026-01-01",
      data_act: "2025-12-20",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employment_contracts", "insert")).toHaveLength(0);
  });

  it("același salariu ca cel în vigoare: VALIDARE pe câmp, nimic scris", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    const r = await modificaSalariulContractului({ ...intrare, salariu_baza: 5000 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriPe("employment_contracts", "insert")).toHaveLength(0);
  });

  it("actul semnat DUPĂ data aplicării: VALIDARE, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await modificaSalariulContractului({ ...intrare, data_act: "2026-11-05" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("contract inexistent: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: null });
    const r = await modificaSalariulContractului(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });
});

// ── dezvaluieDateSensibile ───────────────────────────────────────────────────

describe("dezvaluieDateSensibile", () => {
  const PERMIS = { "employees:read": "all" } as const;
  const CNP = "1960101010109";
  const IBAN = "RO49AAAA1B31007593840000";

  function criptat(valoare: string) {
    const c = encrypt(valoare);
    return {
      ciphertext: catreBytea(c.ciphertext),
      iv: catreBytea(c.iv),
      tag: catreBytea(c.tag),
      versiune: versiuneCaNumar(c.keyVersion),
    };
  }

  function rand(cnp: string | null, iban: string | null) {
    const c = cnp === null ? null : criptat(cnp);
    const i = iban === null ? null : criptat(iban);
    return {
      cnp_ciphertext: c?.ciphertext ?? null,
      cnp_iv: c?.iv ?? null,
      cnp_tag: c?.tag ?? null,
      cnp_key_version: c?.versiune ?? null,
      iban_ciphertext: i?.ciphertext ?? null,
      iban_iv: i?.iv ?? null,
      iban_tag: i?.tag ?? null,
      iban_key_version: i?.versiune ?? null,
    };
  }

  const intrare = { employee_id: ID_1, camp: "cnp", motiv: "Verificare contract" };

  it("employees:read sub `all` (team): INTERZIS — CNP-ul nu se vede pe echipă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:read": "team" } });
    const r = await dezvaluieDateSensibile(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("CNP: îl decriptează din RPC, nu din tabelă, și scrie explicit rândul de consultare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("hr_read_sensitive", { data: [rand(CNP, IBAN)] });

    const r = await dezvaluieDateSensibile(intrare);

    expect(r).toEqual({ ok: true, data: { camp: "cnp", valoare: CNP } });
    expect(server.apeluriRpc.find((a) => a.nume === "hr_read_sensitive")?.argumente).toEqual({
      p_employee: ID_1,
    });
    expect(server.apeluriPe("employee_sensitive_data")).toHaveLength(0);
    // Rândul explicit e scris ÎN handler, deci există înaintea celui generic
    // din `after()`, și poartă exact câmpul și motivul — fără alt conținut.
    const [explicit] = server.audituri();
    expect(explicit).toMatchObject({
      p_organization_id: ORG_ID,
      p_action: "view",
      p_status: "success",
      p_entity_type: "employee_sensitive_data",
      p_entity_id: ID_1,
    });
    expect(explicit?.["p_after"]).toEqual({ camp: "cnp", motiv: "Verificare contract" });
  });

  it("IBAN: întoarce IBAN-ul, nu CNP-ul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("hr_read_sensitive", { data: [rand(CNP, IBAN)] });
    const r = await dezvaluieDateSensibile({ ...intrare, camp: "iban" });
    expect(r).toEqual({ ok: true, data: { camp: "iban", valoare: IBAN } });
  });

  it("niciun rând de date sensibile: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("hr_read_sensitive", { data: [] });
    const r = await dezvaluieDateSensibile(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("câmpul cerut necompletat (CNP există, IBAN nu): NEGASIT cu mesajul IBAN-ului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("hr_read_sensitive", { data: [rand(CNP, null)] });
    const r = await dezvaluieDateSensibile({ ...intrare, camp: "iban" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("IBAN");
    // Nicio consultare reușită nu se înregistrează pentru o valoare absentă.
    expect(
      server
        .audituri()
        .filter(
          (a) => a["p_entity_type"] === "employee_sensitive_data" && a["p_status"] === "success",
        ),
    ).toHaveLength(0);
  });

  it("motiv prea scurt: VALIDARE, fără nicio citire", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await dezvaluieDateSensibile({ ...intrare, motiv: "ok" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriRpc.filter((a) => a.nume === "hr_read_sensitive")).toHaveLength(0);
  });

  it("RPC-ul refuză (42501): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("hr_read_sensitive", { error: eroarePostgrest("42501") });
    const r = await dezvaluieDateSensibile(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});
