// src/lib/queries/attendance.test.ts
//
// Citirile pontajului. Fiecare trece prin `createServerSupabase()` (RLS), deci
// testul pune DOAR falsul clientului de server și verifică: filtrul pe
// organizație, rândurile șterse logic, paginarea, maparea și cazul gol.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID, USER_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ApelFals } from "@/lib/teste/supabase-fals";
import {
  absenteNemotivateFaraDecizie,
  afiseDePontare,
  angajatiPontajDupaId,
  citestePerioada,
  citestePerioadaDupaId,
  citesteSaptamanaPontaj,
  coduriQrDePontare,
  departamente,
  intrariLuna,
  intrariProprii,
  istoricSetariPontaj,
  liniiDeAprobat,
  listeazaAngajatiPontaj,
  listeazaPerioade,
  loturiPerioadei,
  pontajDeAprobat,
  saptamaniDeAprobat,
  setariPontaj,
  setariPontajComplete,
  setariPontareRapida,
  zilePontateAngajat,
} from "./attendance";

const PERIOADA = ID_2;
const ANGAJAT = ID_3;

/** Argumentele unui modificator numeric (`limit`, `range`), pe care `areFiltru` nu-l tipează. */
const argumente = (apel: ApelFals | undefined, metoda: string) =>
  apel?.filtre.find((f) => f.metoda === metoda)?.argumente;

const organizatieSiNeșters = (apel: ApelFals | undefined) =>
  areFiltru(apel, "eq", "organization_id", ORG_ID) && areFiltru(apel, "is", "deleted_at", null);

// ── Citirile cu o singură interogare: tabela, filtrele, cazul gol ──────────

describe.each([
  [
    "citestePerioada",
    () => citestePerioada(ORG_ID, 2026, 7),
    "attendance_periods",
    [
      ["eq", "an", 2026],
      ["eq", "luna", 7],
    ],
    null,
  ],
  [
    "citestePerioadaDupaId",
    () => citestePerioadaDupaId(ORG_ID, ID_1),
    "attendance_periods",
    [["eq", "id", ID_1]],
    null,
  ],
  [
    "listeazaPerioade",
    () => listeazaPerioade(ORG_ID, 2026),
    "attendance_periods",
    [["eq", "an", 2026]],
    [],
  ],
  [
    "intrariProprii",
    () => intrariProprii(ORG_ID, "2026-07-01", "2026-07-31"),
    "attendance_entries",
    [
      ["gte", "data", "2026-07-01"],
      ["lte", "data", "2026-07-31"],
    ],
    [],
  ],
  [
    "setariPontaj",
    () => setariPontaj(ORG_ID, "2026-07-15"),
    "attendance_settings",
    [["lte", "valabil_de_la", "2026-07-15"]],
    null,
  ],
  [
    "setariPontajComplete",
    () => setariPontajComplete(ORG_ID, "2026-07-15"),
    "attendance_settings",
    [["lte", "valabil_de_la", "2026-07-15"]],
    null,
  ],
  ["istoricSetariPontaj", () => istoricSetariPontaj(ORG_ID), "attendance_settings", [], []],
  [
    "zilePontateAngajat",
    () => zilePontateAngajat(ORG_ID, ANGAJAT, "2026-01-01", "2026-07-31"),
    "attendance_entries",
    [
      ["eq", "employee_id", ANGAJAT],
      ["gte", "data", "2026-01-01"],
      ["lte", "data", "2026-07-31"],
    ],
    [],
  ],
  [
    "loturiPerioadei",
    () => loturiPerioadei(ORG_ID, PERIOADA),
    "attendance_approval_batches",
    [["eq", "period_id", PERIOADA]],
    [],
  ],
  ["departamente", () => departamente(ORG_ID), "departments", [["eq", "activ", true]], []],
  ["setariPontareRapida", () => setariPontareRapida(ORG_ID), "setari_pontare_rapida", [], null],
  ["afiseDePontare", () => afiseDePontare(ORG_ID), "puncte_lucru", [], []],
  ["coduriQrDePontare", () => coduriQrDePontare(ORG_ID), "puncte_lucru", [], []],
] as const)("%s", (_nume, cheama, tabela, filtre, gol) => {
  it("citește pe organizație, fără rândurile șterse logic, cu filtrele cerute", async () => {
    const { server } = configureazaActiunea();
    server.raspunde(tabela, "select", { data: null });
    await cheama();
    const [apel, ...altele] = server.apeluri;
    expect(altele).toHaveLength(0);
    expect(apel?.tabela).toBe(tabela);
    expect(organizatieSiNeșters(apel)).toBe(true);
    for (const [metoda, col, val] of filtre) expect(areFiltru(apel, metoda, col, val)).toBe(true);
  });

  it("niciun rând ⇒ rezultatul gol, nu o eroare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde(tabela, "select", { data: null });
    expect(await cheama()).toEqual(gol);
  });

  it("eroarea bazei se aruncă", async () => {
    const { server } = configureazaActiunea();
    const eroare = eroarePostgrest("42501");
    server.raspunde(tabela, "select", { error: eroare });
    await expect(cheama()).rejects.toBe(eroare);
  });
});

describe("ordinile și plafoanele care țin rezultatul corect", () => {
  it("setările: versiunea cea mai recentă în vigoare la dată, una singură", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_settings", "select", { data: { ore_pe_zi: 8 } });
    expect(await setariPontaj(ORG_ID, "2026-07-15")).toEqual({ ore_pe_zi: 8 });
    const [apel] = server.apeluri;
    expect(areFiltru(apel, "order", "valabil_de_la", { ascending: false })).toBe(true);
    expect(argumente(apel, "limit")).toEqual([1]);
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("zilele unui angajat: cronologic, plafonate SUB pragul de trunchiere al PostgREST", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_entries", "select", { data: [] });
    await zilePontateAngajat(ORG_ID, ANGAJAT, "2026-01-01", "2026-07-31");
    const [apel] = server.apeluri;
    expect(areFiltru(apel, "order", "data", { ascending: true })).toBe(true);
    const limita = argumente(apel, "limit")?.[0];
    expect(limita).toBeLessThan(1000);
    expect(limita).toBeGreaterThanOrEqual(380);
  });

  it("intrările proprii NU filtrează pe angajat (RLS restrânge) — v. capcana 10", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_entries", "select", { data: [] });
    await intrariProprii(ORG_ID, "2026-07-01", "2026-07-31");
    expect(areFiltru(server.apeluri[0], "eq", "employee_id")).toBe(false);
    expect(areFiltru(server.apeluri[0], "in", "employee_id")).toBe(false);
  });
});

describe("intrariLuna și angajatiPontajDupaId", () => {
  it("fără angajați nu se interoghează nimic", async () => {
    const { server } = configureazaActiunea();
    expect(await intrariLuna(ORG_ID, [], "2026-07-01", "2026-07-31")).toEqual([]);
    expect(await angajatiPontajDupaId(ORG_ID, [])).toEqual(new Map());
    expect(server.apeluri).toHaveLength(0);
  });

  it("intrările lunii: doar angajații ceruți, în interval, pe organizație", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_entries", "select", { data: [{ id: ID_1 }] });
    expect(await intrariLuna(ORG_ID, [ANGAJAT, ID_1], "2026-07-01", "2026-07-31")).toEqual([
      { id: ID_1 },
    ]);
    const [apel] = server.apeluri;
    expect(organizatieSiNeșters(apel)).toBe(true);
    expect(areFiltru(apel, "in", "employee_id", [ANGAJAT, ID_1])).toBe(true);
    expect(areFiltru(apel, "gte", "data", "2026-07-01")).toBe(true);
    expect(areFiltru(apel, "lte", "data", "2026-07-31")).toBe(true);
  });

  it("angajații după id: id-uri deduplicate, rezultat indexat pe id", async () => {
    const { server } = configureazaActiunea();
    const a = { id: ANGAJAT, full_name: "Ana", marca: "7", department_id: null };
    server.raspunde("employees", "select", { data: [a] });
    const harta = await angajatiPontajDupaId(ORG_ID, [ANGAJAT, ANGAJAT, ID_1]);
    expect(harta.get(ANGAJAT)).toEqual(a);
    expect(harta.size).toBe(1);
    const [apel] = server.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "in", "id", [ANGAJAT, ID_1])).toBe(true);
  });
});

describe("listeazaAngajatiPontaj — cursor keyset", () => {
  const FILTRE = { luna: 7, departament: null, cauta: null, cursor: null, limita: 2 };
  const ang = (id: string, full_name: string) => ({
    id,
    marca: "1",
    full_name,
    department_id: null,
    status: "activ",
  });

  it("cere limita+1, doar fișe active/suspendate/în preaviz, ordonate total (nume, id)", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", { data: [] });
    await listeazaAngajatiPontaj(ORG_ID, FILTRE);
    const [apel] = server.apeluri;
    expect(organizatieSiNeșters(apel)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["activ", "suspendat", "preaviz"])).toBe(true);
    expect(areFiltru(apel, "order", "full_name", { ascending: true })).toBe(true);
    expect(areFiltru(apel, "order", "id", { ascending: true })).toBe(true);
    expect(argumente(apel, "limit")).toEqual([3]);
    expect(apel?.filtre.some((f) => f.metoda === "or")).toBe(false);
  });

  it("limita+1 rânduri ⇒ se taie la limită și se dă cursorul ULTIMULUI rând păstrat", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", {
      data: [ang(ID_1, "Ana"), ang(ID_2, "Barbu"), ang(ID_3, "Cazacu")],
    });
    server.raspunde("employees", "select", { data: [ang(ID_3, "Cazacu")] });

    const pagina = await listeazaAngajatiPontaj(ORG_ID, FILTRE);

    expect(pagina.randuri.map((r) => r.full_name)).toEqual(["Ana", "Barbu"]);
    expect(pagina.urmatorulCursor).not.toBeNull();

    // Cursorul întors continuă exact după „Barbu”, cu ghilimele în `or()`.
    const urmatoarea = await listeazaAngajatiPontaj(ORG_ID, {
      ...FILTRE,
      cursor: pagina.urmatorulCursor,
    });
    expect(urmatoarea).toEqual({ randuri: [ang(ID_3, "Cazacu")], urmatorulCursor: null });
    const or = server.apeluri[1]?.filtre.find((f) => f.metoda === "or");
    expect(or?.argumente[0]).toBe(`full_name.gt."Barbu",and(full_name.eq."Barbu",id.gt.${ID_2})`);
  });

  it("numele cu ghilimele și virgulă e citat, nu sparge filtrul `or()`", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", {
      data: [ang(ID_1, 'Ion "Nelu", jr'), ang(ID_2, "Z"), ang(ID_3, "ZZ")],
    });
    server.raspunde("employees", "select", { data: [] });
    const p = await listeazaAngajatiPontaj(ORG_ID, { ...FILTRE, limita: 1 });
    await listeazaAngajatiPontaj(ORG_ID, { ...FILTRE, limita: 1, cursor: p.urmatorulCursor });
    const or = server.apeluri[1]?.filtre.find((f) => f.metoda === "or");
    expect(or?.argumente[0]).toBe(
      `full_name.gt."Ion \\"Nelu\\", jr",and(full_name.eq."Ion \\"Nelu\\", jr",id.gt.${ID_1})`,
    );
  });

  it("cursor stricat ⇒ prima pagină, nu o eroare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", { data: [] });
    await listeazaAngajatiPontaj(ORG_ID, { ...FILTRE, cursor: "fara-separator" });
    expect(server.apeluri[0]?.filtre.some((f) => f.metoda === "or")).toBe(false);
  });

  it("căutarea și departamentul devin filtre", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", { data: [] });
    await listeazaAngajatiPontaj(ORG_ID, { ...FILTRE, cauta: "pop", departament: ID_2 });
    const [apel] = server.apeluri;
    expect(areFiltru(apel, "ilike", "full_name", "%pop%")).toBe(true);
    expect(areFiltru(apel, "eq", "department_id", ID_2)).toBe(true);
  });
});

describe("liniiDeAprobat — citită până la capăt", () => {
  const pagina = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `l${String(i)}` }));

  it("exclude aprobatele, concediile, respinsele și șterse; ordine totală (data, id)", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_entries", "select", { data: pagina(3) });
    const r = await liniiDeAprobat(ORG_ID, PERIOADA);
    expect(r).toEqual({ linii: pagina(3), trunchiat: false });
    const [apel] = server.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "period_id", PERIOADA)).toBe(true);
    for (const col of ["approved_at", "leave_request_id", "respins_la", "deleted_at"]) {
      expect(areFiltru(apel, "is", col, null)).toBe(true);
    }
    expect(areFiltru(apel, "order", "data")).toBe(true);
    expect(areFiltru(apel, "order", "id")).toBe(true);
    expect(argumente(apel, "range")).toEqual([0, 999]);
  });

  it("pagina plină ⇒ se cere următoarea; ultima incompletă oprește bucla", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_entries", "select", { data: pagina(1000) });
    server.raspunde("attendance_entries", "select", { data: pagina(12) });
    const r = await liniiDeAprobat(ORG_ID, PERIOADA);
    expect(r.linii).toHaveLength(1012);
    expect(r.trunchiat).toBe(false);
    expect(argumente(server.apeluri[1], "range")).toEqual([1000, 1999]);
  });

  it("20 de pagini pline ⇒ `trunchiat`, ca ecranul să spună că cifra e sub cea reală", async () => {
    const { server } = configureazaActiunea();
    for (let i = 0; i < 20; i += 1)
      server.raspunde("attendance_entries", "select", { data: pagina(1000) });
    const r = await liniiDeAprobat(ORG_ID, PERIOADA);
    expect(r.trunchiat).toBe(true);
    expect(r.linii).toHaveLength(20000);
    expect(server.apeluri).toHaveLength(20);
  });
});

describe("citesteSaptamanaPontaj", () => {
  it("fără submisie ⇒ null, fără a citi zilele", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_week_submissions", "select", { data: null });
    expect(await citesteSaptamanaPontaj(ORG_ID, ANGAJAT, "2026-07-13")).toBeNull();
    const [apel] = server.apeluri;
    expect(organizatieSiNeșters(apel)).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id", ANGAJAT)).toBe(true);
    expect(areFiltru(apel, "eq", "saptamana_start", "2026-07-13")).toBe(true);
    expect(server.apeluriPe("attendance_week_submission_days")).toHaveLength(0);
  });

  it("mapează submisia și zilele ei, cronologic", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_week_submissions", "select", {
      data: { id: ID_1, status: "respinsa", motiv_respingere: "x", lucreaza_weekend: true },
    });
    server.raspunde("attendance_week_submission_days", "select", {
      data: [{ data: "2026-07-13" }],
    });
    expect(await citesteSaptamanaPontaj(ORG_ID, ANGAJAT, "2026-07-13")).toEqual({
      id: ID_1,
      status: "respinsa",
      motivRespingere: "x",
      lucreazaWeekend: true,
      zile: [{ data: "2026-07-13" }],
    });
    const [zile] = server.apeluriPe("attendance_week_submission_days");
    expect(areFiltru(zile, "eq", "submission_id", ID_1)).toBe(true);
    expect(areFiltru(zile, "order", "data", { ascending: true })).toBe(true);
  });
});

describe("saptamaniDeAprobat", () => {
  it("doar sarcinile în așteptare ale utilizatorului; fără ele, nimic altceva nu se citește", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("approval_tasks", "select", { data: [] });
    expect(await saptamaniDeAprobat(ORG_ID, USER_ID)).toEqual([]);
    const [apel] = server.apeluri;
    expect(organizatieSiNeșters(apel)).toBe(true);
    expect(areFiltru(apel, "eq", "entity_type", "attendance_week_submission")).toBe(true);
    expect(areFiltru(apel, "eq", "approver_user_id", USER_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "in_asteptare")).toBe(true);
    expect(server.apeluri).toHaveLength(1);
  });

  it("împerechează sarcina cu submisia TRIMISĂ, angajatul și zilele; sarcina orfană iese", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("approval_tasks", "select", {
      data: [
        { id: "t1", entity_id: ID_1, termen_la: null, created_at: "c1" },
        { id: "t2", entity_id: ID_2, termen_la: "2026-07-20", created_at: "c2" },
      ],
    });
    server.raspunde("attendance_week_submissions", "select", {
      data: [{ id: ID_1, employee_id: ANGAJAT, saptamana_start: "2026-07-13", status: "trimisa" }],
    });
    server.raspunde("employees", "select", {
      data: [{ id: ANGAJAT, full_name: "Ana", marca: "7" }],
    });
    server.raspunde("attendance_week_submission_days", "select", {
      data: [
        { submission_id: ID_1, data: "2026-07-13" },
        { submission_id: ID_1, data: "2026-07-14" },
      ],
    });

    const r = await saptamaniDeAprobat(ORG_ID, USER_ID);

    expect(r).toEqual([
      {
        taskId: "t1",
        termenLa: null,
        createdAt: "c1",
        submisie: { id: ID_1, saptamanaStart: "2026-07-13", status: "trimisa" },
        angajat: { id: ANGAJAT, fullName: "Ana", marca: "7" },
        zile: [
          { submission_id: ID_1, data: "2026-07-13" },
          { submission_id: ID_1, data: "2026-07-14" },
        ],
      },
    ]);
    const [submisii] = server.apeluriPe("attendance_week_submissions");
    expect(areFiltru(submisii, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(submisii, "in", "id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(submisii, "eq", "status", "trimisa")).toBe(true);
  });

  // attendance.ts:714-725 — `employees` și `attendance_week_submission_days`
  // se citesc doar după id-uri, fără `.eq("organization_id")`, contrar
  // convenției citirilor (filtru explicit pe organizație pe FIECARE interogare).
  // Id-urile vin deja din sarcinile firmei, deci azi nu iese nimic străin; dar
  // un utilizator membru în două firme rămâne apărat doar de proveniența lor.
  it.fails(
    "DEFECT: citirile secundare (angajați, zile) nu se mărginesc explicit la organizație",
    async () => {
      const { server } = configureazaActiunea();
      server.raspunde("approval_tasks", "select", {
        data: [{ id: "t1", entity_id: ID_1, termen_la: null, created_at: "c1" }],
      });
      server.raspunde("attendance_week_submissions", "select", {
        data: [
          { id: ID_1, employee_id: ANGAJAT, saptamana_start: "2026-07-13", status: "trimisa" },
        ],
      });
      server.raspunde("employees", "select", { data: [] });
      server.raspunde("attendance_week_submission_days", "select", { data: [] });

      await saptamaniDeAprobat(ORG_ID, USER_ID);

      const [angajati] = server.apeluriPe("employees");
      const [zile] = server.apeluriPe("attendance_week_submission_days");
      expect(areFiltru(angajati, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(zile, "eq", "organization_id", ORG_ID)).toBe(true);
    },
  );
});

describe("afiseDePontare / coduriQrDePontare", () => {
  const RANDURI = [
    { id: ID_1, denumire: "Sediu", activ: true, cod_pontaj: "secret-de-32-de-caractere-aaaaaa" },
    { id: ID_2, denumire: "Depozit", activ: false, cod_pontaj: null },
  ];

  it("afișele spun doar „are cod”, fără să dea codul mai departe", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("puncte_lucru", "select", { data: RANDURI });
    const r = await afiseDePontare(ORG_ID);
    expect(r).toEqual([
      { id: ID_1, denumire: "Sediu", activ: true, areCod: true },
      { id: ID_2, denumire: "Depozit", activ: false, areCod: false },
    ]);
    expect(JSON.stringify(r)).not.toContain("secret");
  });

  it("codurile QR dau codul, cu sediul principal primul", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("puncte_lucru", "select", { data: RANDURI });
    const r = await coduriQrDePontare(ORG_ID);
    expect(r.map((p) => p.cod)).toEqual(["secret-de-32-de-caractere-aaaaaa", null]);
    expect(areFiltru(server.apeluri[0], "order", "sediu_principal", { ascending: false })).toBe(
      true,
    );
  });
});

describe("absenteNemotivateFaraDecizie", () => {
  const absent = (employee_id: string, data: string) => ({
    employee_id,
    data,
    tip_zi: "absenta_nemotivata",
    ore_lucrate: 0,
  });

  it("fără serii de cel puțin două zile nu se mai citește nimic", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_entries", "select", { data: [absent(ANGAJAT, "2026-07-13")] });
    expect(await absenteNemotivateFaraDecizie(ORG_ID, PERIOADA)).toEqual([]);
    const [apel] = server.apeluri;
    expect(organizatieSiNeșters(apel)).toBe(true);
    expect(areFiltru(apel, "eq", "period_id", PERIOADA)).toBe(true);
    expect(server.apeluri).toHaveLength(1);
  });

  it("seriile angajaților deja suspendați ies; numele lipsă devine „Angajat necunoscut”", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_entries", "select", {
      data: [
        absent(ANGAJAT, "2026-07-13"),
        absent(ANGAJAT, "2026-07-14"),
        absent(ID_1, "2026-07-13"),
        absent(ID_1, "2026-07-14"),
        absent(ID_1, "2026-07-15"),
      ],
    });
    server.raspunde("contract_suspendari", "select", { data: [{ employee_id: ID_1 }] });
    server.raspunde("employees", "select", { data: [] });

    const r = await absenteNemotivateFaraDecizie(ORG_ID, PERIOADA);

    expect(r).toEqual([
      {
        employeeId: ANGAJAT,
        numeAngajat: "Angajat necunoscut",
        dataInceput: "2026-07-13",
        dataSfarsit: "2026-07-14",
        zile: 2,
      },
    ]);
    const [susp] = server.apeluriPe("contract_suspendari");
    expect(organizatieSiNeșters(susp)).toBe(true);
    expect(areFiltru(susp, "eq", "sursa", "absenta_nemotivata")).toBe(true);
    expect(areFiltru(susp, "eq", "stare", "activa")).toBe(true);
    // Seriile vin ordonate după angajat, deci și lista de id-uri.
    expect(areFiltru(susp, "in", "employee_id", [ID_1, ANGAJAT])).toBe(true);
    const [angajati] = server.apeluriPe("employees");
    expect(organizatieSiNeșters(angajati)).toBe(true);
  });
});

describe("pontajDeAprobat — contorul care urmează lista", () => {
  it("numără pe luni, exclude blocatele, concediile și respinsele; lunile cronologic", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_periods", "select", {
      data: [
        { id: "p8", an: 2026, luna: 8 },
        { id: "p12", an: 2025, luna: 12 },
        { id: "p7", an: 2026, luna: 7 },
      ],
    });
    server.raspunde("attendance_entries", "select", {
      data: [{ period_id: "p8" }, { period_id: "p12" }, { period_id: "p8" }],
    });
    server.raspunde("attendance_week_submissions", "select", { count: 2 });

    const r = await pontajDeAprobat(ORG_ID);

    expect(r).toEqual({
      zile: 3,
      fise: 2,
      luni: [
        { an: 2025, luna: 12, zile: 1 },
        { an: 2026, luna: 8, zile: 2 },
      ],
    });
    const [perioade] = server.apeluriPe("attendance_periods");
    expect(organizatieSiNeșters(perioade)).toBe(true);
    expect(areFiltru(perioade, "neq", "status", "blocata")).toBe(true);
    const [zile] = server.apeluriPe("attendance_entries");
    for (const col of ["approved_at", "leave_request_id", "respins_la", "deleted_at"]) {
      expect(areFiltru(zile, "is", col, null)).toBe(true);
    }
    expect(areFiltru(zile, "in", "period_id", ["p8", "p12", "p7"])).toBe(true);
    const [fise] = server.apeluriPe("attendance_week_submissions");
    expect(fise?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(fise, "eq", "status", "trimisa")).toBe(true);
  });

  it("nimic de aprobat ⇒ null", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_periods", "select", { data: [{ id: "p7", an: 2026, luna: 7 }] });
    server.raspunde("attendance_entries", "select", { data: [] });
    server.raspunde("attendance_week_submissions", "select", { count: 0 });
    expect(await pontajDeAprobat(ORG_ID)).toBeNull();
  });

  // `return null` la linia 1117 vine ÎNAINTEA numărării fișelor. Fișele
  // săptămânale nu creează perioade (0132 le naște doar la scrierea zilelor),
  // deci o firmă nouă — sau una cu toate lunile blocate — cu o fișă trimisă
  // primește `null`: panoul tace despre o aprobare care chiar așteaptă.
  it.fails("DEFECT: fișele trimise se pierd când nu există nicio lună neblocată", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("attendance_periods", "select", { data: [] });
    // Programat ca reparația firească (fără `return null`, cu `.in("period_id",
    // [])`) să nu pice din alt motiv: testul cade DOAR din cauza lui `null`.
    server.raspunde("attendance_entries", "select", { data: [] });
    server.raspunde("attendance_week_submissions", "select", { count: 1 });
    expect(await pontajDeAprobat(ORG_ID)).toMatchObject({ zile: 0, fise: 1 });
  });
});
