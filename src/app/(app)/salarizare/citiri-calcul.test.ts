// src/app/(app)/salarizare/citiri-calcul.test.ts
//
// Citirile din `@/lib/queries/payroll` care alimentează `calculeazaPerioada`:
// scutiri, componente salariale, prime și rețineri, pontaj agregat, istoric de
// venit, certificate medicale, compensări, diurnă. Stau lângă acțiunea care le
// consumă (în `actions-calcul.test.ts` sunt înlocuite cu spioni); restul
// citirilor modulului sunt în `src/lib/queries/payroll.test.ts`.
//
// Clientul e falsul STRICT din `@/lib/teste/supabase-fals`, servit prin
// `createServerSupabase`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import {
  certificateMedicaleLuna,
  compensariLuna,
  componenteSalarialeActivePerioada,
  diurnaLunaPerAngajat,
  istoricVenitPerAngajat,
  listeazaBonusuriSiRetineri,
  plafoaneDiurnaLuna,
  PONTAJ_GOL,
  pontajAgregatPerioada,
  primeSiRetineriPerioada,
  scutiriActivePerioada,
} from "@/lib/queries/payroll";
import { configureazaActiunea, ID_1, ID_2, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";

let server: ClientFals;
/** Argumentele lui `.range()` de pe lanțurile `rpc()`, în ordine. */
let intervaleRpc: [number, number][];

beforeEach(() => {
  server = configureazaActiunea().server;
  intervaleRpc = [];
  // Falsul comun întoarce direct o promisiune din `rpc()`; aici i se lipesc
  // `.select()` și `.range()`, ca lanțul lui `pontajAgregatPerioada` să meargă.
  const client = server.client as unknown as {
    rpc: (nume: string, argumente?: unknown) => Promise<unknown>;
  };
  const original = client.rpc.bind(client);
  client.rpc = (nume, argumente) => {
    const promisiune = original(nume, argumente);
    return Object.assign(promisiune, {
      select: () => promisiune,
      range: (de: number, pana: number) => {
        intervaleRpc.push([de, pana]);
        return promisiune;
      },
    });
  };
});

const esteViuInOrg = (tabela: string, index = 0) => {
  const apel = server.apeluriPe(tabela)[index];
  return (
    areFiltru(apel, "eq", "organization_id", ORG_ID) && areFiltru(apel, "is", "deleted_at", null)
  );
};

// ── Intrările calculului ─────────────────────────────────────────────────────

describe("intrările calculului", () => {
  it("scutiriActivePerioada: procentul trece din 0–100 în fracție, o singură dată", async () => {
    server.raspunde("employee_tax_exemptions", "select", {
      data: [
        { employee_id: "a", procent_scutire: 100, plafon_lunar: 10000 },
        { employee_id: "a", procent_scutire: null, plafon_lunar: null },
        { employee_id: "b", procent_scutire: 50, plafon_lunar: null },
      ],
    });

    const r = await scutiriActivePerioada(ORG_ID, 2026, 2);

    expect(r.get("a")).toEqual([
      { procentScutire: 1, plafonLunar: 10000 },
      { procentScutire: null, plafonLunar: null },
    ]);
    expect(r.get("b")).toEqual([{ procentScutire: 0.5, plafonLunar: null }]);
    const [apel] = server.apeluriPe("employee_tax_exemptions");
    expect(esteViuInOrg("employee_tax_exemptions")).toBe(true);
    expect(areFiltru(apel, "lte", "valabil_de_la", "2026-02-28")).toBe(true);
    expect(apel?.filtre).toContainEqual({
      metoda: "or",
      argumente: ["valabil_pana.is.null,valabil_pana.gte.2026-02-01"],
    });
  });

  it("componenteSalarialeActivePerioada: steagurile vin din șablon, implicit „da” fără șablon", async () => {
    server.raspunde("salary_components", "select", {
      data: [
        {
          employee_id: "a",
          kind: "spor_suma",
          procent: null,
          suma: 300,
          component_type: { impozabil: false, intra_in_baza_cas: false, intra_in_baza_cass: true },
        },
        { employee_id: "a", kind: "spor_procent", procent: 10, suma: null, component_type: null },
      ],
    });

    const [faraCas, implicit] =
      (await componenteSalarialeActivePerioada(ORG_ID, 2026, 3)).get("a") ?? [];

    expect(faraCas).toEqual({
      kind: "spor_suma",
      procent: null,
      suma: 300,
      impozabil: false,
      intraInBazaCas: false,
      intraInBazaCass: true,
      supusContributii: true,
    });
    expect(implicit).toMatchObject({
      impozabil: true,
      intraInBazaCas: true,
      intraInBazaCass: true,
    });
    expect(esteViuInOrg("salary_components")).toBe(true);
  });

  it("primeSiRetineriPerioada: ambele liste ale perioadei, din organizația curentă", async () => {
    server.raspunde("payroll_bonuses", "select", { data: [{ id: "b1" }] });
    server.raspunde("payroll_deductions", "select", { data: null });

    expect(await primeSiRetineriPerioada(ORG_ID, ID_1)).toEqual({
      prime: [{ id: "b1" }],
      retineri: [],
    });
    for (const tabela of ["payroll_bonuses", "payroll_deductions"]) {
      expect(esteViuInOrg(tabela)).toBe(true);
      expect(areFiltru(server.apeluriPe(tabela)[0], "eq", "period_id", ID_1)).toBe(true);
    }
  });

  it("listeazaBonusuriSiRetineri: restrânge la angajat; eroarea pe rețineri se propagă", async () => {
    const eroare = eroarePostgrest("42501");
    server.raspunde("payroll_bonuses", "select", { data: [] });
    server.raspunde("payroll_deductions", "select", { error: eroare });

    await expect(listeazaBonusuriSiRetineri(ORG_ID, ID_1, ID_2)).rejects.toBe(eroare);
    expect(areFiltru(server.apeluriPe("payroll_bonuses")[0], "eq", "employee_id", ID_2)).toBe(true);
  });

  it("pontajAgregatPerioada: paginează RPC-ul câte 500, un rând per angajat, fără `employee_id` în valoare", async () => {
    const pagina = Array.from({ length: 500 }, (_, i) => ({
      employee_id: `e${String(i)}`,
      ...PONTAJ_GOL,
    }));
    server.raspundeRpc("pontaj_agregat_salarizare", { data: pagina });
    server.raspundeRpc("pontaj_agregat_salarizare", {
      data: [{ employee_id: "ultimul", ...PONTAJ_GOL, zile_lucrate: 21 }],
    });

    const r = await pontajAgregatPerioada(ID_2);

    expect(r.trunchiat).toBe(false);
    expect(r.pePersoana.size).toBe(501);
    expect(r.pePersoana.get("ultimul")).toEqual({ ...PONTAJ_GOL, zile_lucrate: 21 });
    expect(intervaleRpc).toEqual([
      [0, 499],
      [500, 999],
    ]);
    expect(server.apeluriRpc[0]?.argumente).toEqual({ p_period_id: ID_2 });
  });

  it("pontajAgregatPerioada: plafonul de siguranță atins ⇒ `trunchiat`, nu tăcere", async () => {
    const pagina = Array.from({ length: 500 }, (_, i) => ({
      employee_id: `e${String(i)}`,
      ...PONTAJ_GOL,
    }));
    for (let i = 0; i < 100; i += 1)
      server.raspundeRpc("pontaj_agregat_salarizare", { data: pagina });

    const r = await pontajAgregatPerioada(ID_2);

    expect(r.trunchiat).toBe(true);
    expect(intervaleRpc).toHaveLength(100);
  });
});

// ── Istoricul de venit ───────────────────────────────────────────────────────

describe("istoricVenitPerAngajat", () => {
  it("fereastra de N luni dinaintea lunii; luna calculată bate luna importată", async () => {
    server.raspunde("payroll_entries", "select", {
      data: [
        {
          employee_id: "a",
          brut: 5200,
          prime_total: 200,
          zile_lucrate: 21,
          perioada: { an: 2026, luna: 1 },
        },
        {
          employee_id: "b",
          brut: 3000,
          prime_total: 0,
          zile_lucrate: 18,
          perioada: { an: 2026, luna: 2 },
        },
        {
          employee_id: "b",
          brut: 9999,
          prime_total: 0,
          zile_lucrate: 21,
          perioada: { an: 2026, luna: 3 },
        },
        { employee_id: "b", brut: 1, prime_total: 0, zile_lucrate: 1, perioada: null },
      ],
    });
    server.raspunde("payroll_prior_income", "select", {
      data: [
        {
          employee_id: "a",
          an: 2026,
          luna: 1,
          venit_brut: 5000,
          drepturi_salariale: 4900,
          zile_lucrate: 20,
        },
        {
          employee_id: "a",
          an: 2025,
          luna: 12,
          venit_brut: 4000,
          drepturi_salariale: 3800,
          zile_lucrate: 20,
        },
        {
          employee_id: "a",
          an: 2025,
          luna: 11,
          venit_brut: 1,
          drepturi_salariale: 1,
          zile_lucrate: 1,
        },
      ],
    });

    const r = await istoricVenitPerAngajat(ORG_ID, 2026, 3, 3);

    expect(r.get("a")).toEqual([
      { an: 2026, luna: 1, venitBrut: 5200, drepturiSalariale: 5000, zileLucrate: 21 },
      { an: 2025, luna: 12, venitBrut: 4000, drepturiSalariale: 3800, zileLucrate: 20 },
    ]);
    // Luna calculată însăși (martie) nu intră în propria medie.
    expect(r.get("b")).toEqual([
      { an: 2026, luna: 2, venitBrut: 3000, drepturiSalariale: 3000, zileLucrate: 18 },
    ]);
    expect(esteViuInOrg("payroll_entries")).toBe(true);
    expect(esteViuInOrg("payroll_prior_income")).toBe(true);
    expect(areFiltru(server.apeluriPe("payroll_prior_income")[0], "gte", "an", 2025)).toBe(true);
  });

  it("zero luni cerute: hartă goală, fără nicio citire", async () => {
    expect((await istoricVenitPerAngajat(ORG_ID, 2026, 3, 0)).size).toBe(0);
    expect(server.apeluri).toHaveLength(0);
  });

  // `payroll_entries` nu are fereastră în bază: TOATE lunile calculate vreodată.
  // La `max_rows = 1000`, PostgREST taie tăcut (capcana 2), iar lunile pierdute
  // scădeau media de concediu medical/odihnă. Citirea e acum paginată keyset.
  it("peste 1000 de intrări calculate, citirea cere pagina următoare după ultimul id", async () => {
    const pagina1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `e${String(i).padStart(4, "0")}`,
      employee_id: "a",
      brut: 1,
      prime_total: 0,
      zile_lucrate: 1,
      perioada: { an: 2019, luna: 1 },
    }));
    server.raspunde("payroll_entries", "select", { data: pagina1 });
    server.raspunde("payroll_entries", "select", {
      data: [
        {
          id: "e1000",
          employee_id: "a",
          brut: 4000,
          prime_total: 0,
          zile_lucrate: 21,
          perioada: { an: 2026, luna: 2 },
        },
      ],
    });
    server.raspunde("payroll_prior_income", "select", { data: [] });

    const r = await istoricVenitPerAngajat(ORG_ID, 2026, 3, 6);

    const apeluri = server.apeluriPe("payroll_entries");
    expect(apeluri).toHaveLength(2);
    expect(areFiltru(apeluri[0], "gt", "id")).toBe(false);
    expect(areFiltru(apeluri[1], "gt", "id", "e0999")).toBe(true);
    for (const apel of apeluri) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(apel, "order", "id")).toBe(true);
    }
    // Luna din a doua pagină — cea din fereastră — ajunge în istoric.
    expect(r.get("a")?.some((l) => l.an === 2026 && l.luna === 2)).toBe(true);
  });
});

// ── Certificate medicale și compensări ───────────────────────────────────────

const cod = {
  cod: "01",
  procent: 0.75,
  zile_angajator: 5,
  platitor: "mixt",
  luni_baza_calcul: 6,
  plafon_salarii_minime: 12,
  retine_cas: true,
  retine_impozit: true,
  retine_cass: false,
};
const certificat = (
  angajat: string,
  de: string,
  pana: string,
  zile: number,
  c: typeof cod | null = cod,
) => ({
  employee_id: angajat,
  data_inceput: de,
  data_sfarsit: pana,
  zile_lucratoare: zile,
  zile_calendaristice: zile,
  serie_certificat: "CCMAM",
  numar_certificat: de,
  cod: c,
});

describe("certificateMedicaleLuna", () => {
  it("un certificat de continuare poartă zilele de angajator deja consumate în episod", async () => {
    server.raspunde("leave_requests", "select", {
      data: [
        certificat("a", "2026-02-25", "2026-02-27", 3),
        certificat("a", "2026-02-28", "2026-03-05", 6),
        certificat("b", "2026-01-10", "2026-01-12", 3),
        certificat("b", "2026-03-10", "2026-03-12", 3),
        certificat("c", "2026-03-02", "2026-03-04", 3, null),
        certificat("d", "2026-02-02", "2026-02-04", 3),
      ],
    });

    const r = await certificateMedicaleLuna(ORG_ID, 2026, 3);

    expect(r.get("a")?.zileAngajatorDejaConsumate).toBe(3);
    expect(r.get("a")?.certificate).toEqual([
      expect.objectContaining({
        dataInceput: "2026-02-28",
        esteContinuare: true,
        cod: expect.objectContaining({ zileAngajator: 5, retineCass: false, platitor: "mixt" }),
      }),
    ]);
    // Episod nou: contorul repornește.
    expect(r.get("b")).toMatchObject({ zileAngajatorDejaConsumate: 0 });
    expect(r.get("b")?.certificate[0]?.esteContinuare).toBe(false);
    expect(r.has("c")).toBe(false);
    expect(r.has("d")).toBe(false);

    const [apel] = server.apeluriPe("leave_requests");
    expect(esteViuInOrg("leave_requests")).toBe(true);
    expect(areFiltru(apel, "eq", "status", "aprobata")).toBe(true);
    expect(areFiltru(apel, "not", "medical_code_id")).toBe(true);
    expect(areFiltru(apel, "gte", "data_inceput", "2025-09-01")).toBe(true);
    expect(areFiltru(apel, "lte", "data_inceput", "2026-03-31")).toBe(true);
  });

  it("compensariLuna: orele suplimentare și sărbătorile se grupează pe angajat", async () => {
    server.raspunde("overtime_compensation", "select", {
      data: [
        {
          employee_id: "a",
          ore: 4,
          ore_folosite: 1,
          ore_expirate: 0,
          termen_folosire: "2026-05-31",
        },
      ],
    });
    server.raspunde("holiday_compensation", "select", {
      data: [
        {
          employee_id: "a",
          data_sarbatorii: "2026-03-08",
          ore_lucrate: 8,
          tip: "spor",
          acordata: false,
          termen_acordare: null,
          spor_procent: 100,
        },
        {
          employee_id: "b",
          data_sarbatorii: "2026-03-08",
          ore_lucrate: 4,
          tip: "altceva",
          acordata: true,
          termen_acordare: "2026-04-08",
          spor_procent: null,
        },
      ],
    });

    const r = await compensariLuna(ORG_ID, 2026, 3);

    expect(r.get("a")?.suplimentare).toEqual([
      { ore: 4, oreFolosite: 1, oreExpirate: 0, termenFolosire: "2026-05-31" },
    ]);
    expect(r.get("a")?.sarbatori[0]).toMatchObject({ tip: "spor", sporProcent: 100 });
    expect(r.get("b")).toEqual({
      suplimentare: [],
      sarbatori: [expect.objectContaining({ tip: "zi_libera", acordata: true })],
    });
    expect(esteViuInOrg("overtime_compensation")).toBe(true);
    expect(
      areFiltru(
        server.apeluriPe("overtime_compensation")[0],
        "lte",
        "data_generarii",
        "2026-03-31",
      ),
    ).toBe(true);
    const [sarb] = server.apeluriPe("holiday_compensation");
    expect(areFiltru(sarb, "gte", "data_sarbatorii", "2026-03-01")).toBe(true);
    expect(areFiltru(sarb, "lte", "data_sarbatorii", "2026-03-31")).toBe(true);
  });
});

// ── Diurnă ───────────────────────────────────────────────────────────────────

const calculDiurna = (
  id: string,
  deplasare: Record<string, unknown> | null,
  extra: Record<string, unknown> = {},
) => ({
  business_trip_id: id,
  zile_total: 2,
  valoare_lei: 300,
  plafon_neimpozabil_lei: 200,
  parte_neimpozabila_lei: 200,
  parte_impozabila_lei: 100,
  curs_incomplet: false,
  deplasare,
  ...extra,
});

describe("diurna", () => {
  it("diurnaLunaPerAngajat: doar deplasările încheiate sau decontate, sosite în lună", async () => {
    server.raspunde("per_diem_calculations", "select", {
      data: [
        calculDiurna("t1", {
          employee_id: "a",
          status: "incheiata",
          sosire_la: "2026-03-10T18:00:00Z",
        }),
        calculDiurna(
          "t2",
          { employee_id: "a", status: "decontata", sosire_la: "2026-03-31T21:00:00Z" },
          {
            zile_total: 0,
            valoare_lei: 50,
            parte_neimpozabila_lei: 20,
            parte_impozabila_lei: 30,
            curs_incomplet: true,
          },
        ),
        calculDiurna("t3", {
          employee_id: "a",
          status: "aprobata",
          sosire_la: "2026-03-12T10:00:00Z",
        }),
        calculDiurna("t4", {
          employee_id: "b",
          status: "incheiata",
          sosire_la: "2026-04-01T08:00:00Z",
        }),
        calculDiurna("t5", null),
      ],
    });

    const r = await diurnaLunaPerAngajat(ORG_ID, 2026, 3);

    expect([...r.keys()]).toEqual(["a"]);
    expect(r.get("a")).toEqual({
      zile: [
        // `baremLegalZi` poartă plafonul ÎNTREGII deplasări (plafon_neimpozabil_lei),
        // nu plafonul pe zi — apelantul îl împarte la multiplicator.
        { data: "2026-03-10", sumaAcordata: 300, baremLegalZi: 200, deplasareId: "t1" },
        { data: "2026-03-31", sumaAcordata: 50, baremLegalZi: 200, deplasareId: "t2" },
      ],
      neimpozabilaCalculata: 220,
      impozabilaCalculata: 130,
      cursIncomplet: true,
    });
    expect(
      areFiltru(server.apeluriPe("per_diem_calculations")[0], "eq", "organization_id", ORG_ID),
    ).toBe(true);
  });

  // Se citesc TOATE calculele de diurnă ale firmei, din toți anii, filtrate pe
  // lună abia în memorie: după 1000 de deplasări PostgREST taie tăcut, iar
  // diurna lunii putea lipsi de pe stat. Citirea e acum paginată keyset.
  it("peste 1000 de calcule de diurnă, citirea cere pagina următoare și găsește luna", async () => {
    const pagina1 = Array.from({ length: 1000 }, (_, i) =>
      calculDiurna(`v${String(i).padStart(4, "0")}`, {
        employee_id: "a",
        status: "incheiata",
        sosire_la: "2019-01-10T10:00:00Z",
      }),
    );
    server.raspunde("per_diem_calculations", "select", { data: pagina1 });
    server.raspunde("per_diem_calculations", "select", {
      data: [
        calculDiurna("w0001", {
          employee_id: "a",
          status: "incheiata",
          sosire_la: "2026-03-10T10:00:00Z",
        }),
      ],
    });

    const r = await diurnaLunaPerAngajat(ORG_ID, 2026, 3);

    const apeluri = server.apeluriPe("per_diem_calculations");
    expect(apeluri).toHaveLength(2);
    expect(areFiltru(apeluri[1], "gt", "business_trip_id", "v0999")).toBe(true);
    for (const apel of apeluri) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "order", "business_trip_id")).toBe(true);
    }
    expect(r.get("a")?.zile.map((z) => z.deplasareId)).toEqual(["w0001"]);
  });

  it("plafoaneDiurnaLuna: politica în vigoare la sfârșitul lunii; fără politică ⇒ null", async () => {
    server.raspunde("per_diem_policies", "select", {
      data: { multiplu_plafon_neimpozabil: 2.5, plafon_salarii_baza_luna: 3 },
    });
    expect(await plafoaneDiurnaLuna(ORG_ID, 2026, 2)).toEqual({
      multiplicatorPlafonZilnic: 2.5,
      fractiePlafonLunar: 3,
    });
    expect(esteViuInOrg("per_diem_policies")).toBe(true);
    expect(
      areFiltru(server.apeluriPe("per_diem_policies")[0], "lte", "valabil_de_la", "2026-02-28"),
    ).toBe(true);

    server.raspunde("per_diem_policies", "select", { data: null });
    expect(await plafoaneDiurnaLuna(ORG_ID, 2026, 2)).toBeNull();
  });
});
