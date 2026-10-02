// src/lib/queries/kpi.test.ts
//
// Citirile KPI-ului lunar: seturile, setul aplicabil unui angajat (cu motivul
// absenței), luna cu liniile ei, lista echipei paginată keyset, portalul și
// lista celor pentru care se poate deschide o lună.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { decodificaCursor } from "./cursor";
import {
  angajatiPentruKpi,
  citesteLunaKpi,
  citesteSetKpi,
  kpiAngajat,
  listeazaLuniKpi,
  listeazaSeturiKpi,
  normalizeazaFunctie,
  setPentruAngajat,
  tintaEfectivaAfisata,
  type FiltreKpi,
  type IndicatorKpi,
} from "./kpi";

const indicator = (extra: Partial<IndicatorKpi> = {}): IndicatorKpi => ({
  id: ID_1,
  cod: "vizite",
  denumire: "Vizite",
  descriere: null,
  tip: "masurat",
  unitate: "vizite",
  sens: "crestere",
  tinta_implicita: 40,
  scala_max: null,
  pondere: 50,
  ordine: 0,
  ...extra,
});

describe("normalizeazaFunctie", () => {
  it.each([
    [null, null],
    ["", null],
    ["   ", null],
    ["Agent", "agent"],
    ["  Agent Vânzări ", "agent vânzări"],
    ["ȘOFER", "șofer"],
  ])("%j ⇒ %j", (intrare, asteptat) => {
    expect(normalizeazaFunctie(intrare)).toBe(asteptat);
  });
});

describe("tintaEfectivaAfisata", () => {
  it.each([
    ["abaterea proprie bate implicita", indicator(), new Map([[ID_1, 25]]), 25],
    ["o abatere de ZERO rămâne zero (nu cade pe implicită)", indicator(), new Map([[ID_1, 0]]), 0],
    ["fără abatere: implicita funcției", indicator(), new Map([[ID_2, 10]]), 40],
    ["indicator apreciat: fără țintă", indicator({ tip: "apreciat" }), new Map([[ID_1, 3]]), null],
  ])("%s", (_caz, ind, abateri, asteptat) => {
    expect(tintaEfectivaAfisata(ind, abateri)).toBe(asteptat);
  });
});

describe("listeazaSeturiKpi / citesteSetKpi", () => {
  const set = {
    id: ID_3,
    functie: "Agent",
    denumire: "KPI agenți",
    descriere: null,
    activ: true,
    indicatori: [
      indicator({ id: ID_1, denumire: "Zeta", ordine: 2 }),
      indicator({ id: ID_2, denumire: "Beta", ordine: 1 }),
      indicator({ id: ID_3, denumire: "Alfa", ordine: 1 }),
    ],
  };

  it("filtrează pe organizație, rânduri vii și indicatori vii; indicatorii ies în ordinea managerului", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_seturi", "select", {
      data: [set, { ...set, id: ID_1, indicatori: null }],
    });

    const r = await listeazaSeturiKpi(ORG_ID);

    const [apel] = server.apeluriPe("kpi_seturi");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "is", "indicatori.deleted_at", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [200] });
    // `ordine`, apoi denumirea la egalitate.
    expect(r[0]?.indicatori.map((i) => i.denumire)).toEqual(["Alfa", "Beta", "Zeta"]);
    expect(r[1]?.indicatori).toEqual([]);
  });

  it("citesteSetKpi: pe organizație + id; absent ⇒ null", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_seturi", "select", { data: null });
    expect(await citesteSetKpi(ORG_ID, ID_3)).toBeNull();
    const [apel] = server.apeluriPe("kpi_seturi");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("citesteSetKpi: setul găsit are indicatorii ordonați", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_seturi", "select", { data: set });
    const r = await citesteSetKpi(ORG_ID, ID_3);
    expect(r?.indicatori.map((i) => i.ordine)).toEqual([1, 1, 2]);
  });
});

describe("setPentruAngajat", () => {
  it.each([
    ["angajatul nu e vizibil", null],
    ["funcția lipsește", { functie: null }],
    ["funcția e numai spații", { functie: "  " }],
  ])("%s ⇒ motiv `fara_functie`, fără căutarea setului", async (_caz, angajat) => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", { data: angajat });
    const r = await setPentruAngajat(ORG_ID, ID_2);
    expect(r.set).toBeNull();
    expect(r.motiv).toBe("fara_functie");
    expect(r.abateri.size).toBe(0);
    expect(server.apeluriPe("kpi_seturi")).toHaveLength(0);
  });

  it("funcția fără set activ ⇒ motiv `fara_set`, fără citirea țintelor", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", { data: { functie: "Agent" } });
    server.raspunde("kpi_seturi", "select", { data: null });
    const r = await setPentruAngajat(ORG_ID, ID_2);
    expect(r).toMatchObject({ set: null, motiv: "fara_set" });
    expect(server.apeluriPe("kpi_tinte_angajat")).toHaveLength(0);
  });

  it("setul activ al funcției NORMALIZATE, plus abaterile angajatului ca hartă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", { data: { functie: " Agent Teren " } });
    server.raspunde("kpi_seturi", "select", {
      data: {
        id: ID_3,
        functie: "Agent teren",
        denumire: "KPI",
        descriere: null,
        activ: true,
        indicatori: [indicator()],
      },
    });
    server.raspunde("kpi_tinte_angajat", "select", { data: [{ indicator_id: ID_1, tinta: 30 }] });

    const r = await setPentruAngajat(ORG_ID, ID_2);

    expect(r.motiv).toBeNull();
    expect(r.set?.id).toBe(ID_3);
    expect([...r.abateri]).toEqual([[ID_1, 30]]);

    const [angajat] = server.apeluriPe("employees");
    expect(areFiltru(angajat, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(angajat, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(angajat, "is", "deleted_at", null)).toBe(true);
    const [set] = server.apeluriPe("kpi_seturi");
    expect(areFiltru(set, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(set, "eq", "functie_norm", "agent teren")).toBe(true);
    expect(areFiltru(set, "eq", "activ", true)).toBe(true);
    // Portalul nu arată un set șters, nici indicatorii scoși din el.
    expect(areFiltru(set, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(set, "is", "indicatori.deleted_at", null)).toBe(true);
    const [tinte] = server.apeluriPe("kpi_tinte_angajat");
    expect(areFiltru(tinte, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(tinte, "eq", "employee_id", ID_2)).toBe(true);
    expect(areFiltru(tinte, "is", "deleted_at", null)).toBe(true);
  });
});

const linie = (extra: object = {}) => ({
  id: ID_1,
  cod: "vizite",
  denumire: "Vizite",
  tip: "masurat",
  unitate: "vizite",
  sens: "crestere",
  pondere: 50,
  scala_max: null,
  tinta: 40,
  realizat: 30,
  nota: null,
  comentariu: null,
  ordine: 0,
  ...extra,
});

const lunaBruta = (extra: object = {}) => ({
  id: ID_1,
  employee_id: ID_2,
  an: 2026,
  luna: 9,
  status: "draft",
  concluzie: null,
  finalizat_la: null,
  employee: { full_name: "Ana Pop", marca: "007" },
  valori: [
    linie({
      id: ID_3,
      cod: "atitudine",
      denumire: "Atitudine",
      tip: "apreciat",
      sens: null,
      scala_max: 5,
      tinta: null,
      realizat: null,
      nota: 4,
      ordine: 1,
    }),
    linie(),
  ],
  ...extra,
});

describe("citesteLunaKpi", () => {
  it("liniile se ordonează, fiecare își recalculează procentul, iar scorul se derivă din ele", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_evaluari_lunare", "select", { data: lunaBruta() });

    const r = await citesteLunaKpi(ORG_ID, ID_1);

    const [apel] = server.apeluriPe("kpi_evaluari_lunare");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "is", "valori.deleted_at", null)).toBe(true);

    expect(r?.valori.map((v) => [v.cod, v.procent])).toEqual([
      ["vizite", 75],
      ["atitudine", 80],
    ]);
    expect(r?.scor).toEqual({ procent: 77.5, completate: 2, necompletate: 0 });
    expect(r).toMatchObject({ angajat: "Ana Pop", marca: "007", an: 2026, luna: 9 });
  });

  it("absentă ⇒ null; embed de angajat NULL ⇒ nume null", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_evaluari_lunare", "select", { data: null });
    expect(await citesteLunaKpi(ORG_ID, ID_1)).toBeNull();

    const { server: s2 } = configureazaActiunea();
    s2.raspunde("kpi_evaluari_lunare", "select", {
      data: lunaBruta({ employee: null, valori: null }),
    });
    const r = await citesteLunaKpi(ORG_ID, ID_1);
    expect(r).toMatchObject({ angajat: null, marca: null, valori: [] });
    expect(r?.scor.procent).toBeNull();
  });
});

describe("listeazaLuniKpi", () => {
  const FILTRE: FiltreKpi = {
    an: null,
    luna: null,
    status: null,
    employee_id: null,
    sort: null,
    cursor: null,
    limita: 25,
  };
  const randLista = (id: string, extra: object = {}) => ({
    id,
    employee_id: ID_2,
    an: 2026,
    luna: 9,
    perioada: "2026-09-01",
    status: "draft",
    scor_procent: 90,
    employee: { full_name: "Ana Pop", marca: "007" },
    valori: [linie(), linie({ cod: "rebut", realizat: null })],
    ...extra,
  });

  it("filtrele se aplică pe ambele interogări; numărătoarea nu primește cursorul", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_evaluari_lunare", "select", { data: [] });
    server.raspunde("kpi_evaluari_lunare", "select", { count: 0 });
    const cursor = Buffer.from(`2026-08-01\u0000${ID_1}`, "utf8").toString("base64url");

    await listeazaLuniKpi(ORG_ID, {
      ...FILTRE,
      an: 2026,
      luna: 9,
      status: "finalizat",
      employee_id: ID_2,
      cursor,
    });

    const [lista, numar] = server.apeluriPe("kpi_evaluari_lunare");
    for (const apel of [lista, numar]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(apel, "eq", "an", 2026)).toBe(true);
      expect(areFiltru(apel, "eq", "luna", 9)).toBe(true);
      expect(areFiltru(apel, "eq", "status", "finalizat")).toBe(true);
      expect(areFiltru(apel, "eq", "employee_id", ID_2)).toBe(true);
    }
    expect(numar?.optiuni).toEqual({ count: "exact", head: true });
    expect(lista?.filtre).toContainEqual({
      metoda: "or",
      argumente: [`perioada.lt."2026-08-01",and(perioada.eq."2026-08-01",id.lt."${ID_1}")`],
    });
    expect(numar?.filtre.some((f) => f.metoda === "or")).toBe(false);
    expect(lista?.filtre).toContainEqual({ metoda: "limit", argumente: [26] });
  });

  it("scorul stocat bate recalculul; lipsa lui cade pe recalcul; liniile se numără", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_evaluari_lunare", "select", {
      data: [randLista(ID_1), randLista(ID_3, { scor_procent: null, employee: null })],
    });
    server.raspunde("kpi_evaluari_lunare", "select", { count: 2 });

    const r = await listeazaLuniKpi(ORG_ID, FILTRE);

    expect(r.total).toBe(2);
    expect(r.randuri[0]).toMatchObject({ scor_procent: 90, nrLinii: 2, completate: 1 });
    expect(r.randuri[1]).toMatchObject({ scor_procent: 75, angajat: null, marca: null });
    expect(r.urmatorulCursor).toBeNull();
  });

  it("pagină plină: cursorul poartă perioada și id-ul ultimului rând afișat", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_evaluari_lunare", "select", {
      data: [randLista(ID_1), randLista(ID_2, { perioada: "2026-08-01" }), randLista(ID_3)],
    });
    server.raspunde("kpi_evaluari_lunare", "select", { count: 3 });

    const r = await listeazaLuniKpi(ORG_ID, { ...FILTRE, limita: 2 });

    expect(r.randuri).toHaveLength(2);
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "2026-08-01", id: ID_2 });
  });

  it("sortarea după scor: ordinea pe `scor_procent`, iar cursorul poartă scorul ca text", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_evaluari_lunare", "select", {
      data: [randLista(ID_1, { scor_procent: 87.5 }), randLista(ID_2)],
    });
    server.raspunde("kpi_evaluari_lunare", "select", { count: 2 });

    const r = await listeazaLuniKpi(ORG_ID, { ...FILTRE, sort: "-scor", limita: 1 });

    const [lista] = server.apeluriPe("kpi_evaluari_lunare");
    expect(lista?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["scor_procent", { ascending: false, nullsFirst: false }],
    });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "87.5", id: ID_1 });
  });

  it.fails(
    "DEFECT: sortat după scor, o pagină care se termină pe o lună fără scor trebuie să permită „mai departe”",
    async () => {
      // `scor_procent` e NULL pe orice lună abia deschisă. Cu `nullsFirst:
      // false` ele vin la coadă, iar `valoareCursor === null` anulează cursorul:
      // restul lunilor fără scor nu mai pot fi aduse niciodată.
      const { server } = configureazaActiunea();
      server.raspunde("kpi_evaluari_lunare", "select", {
        data: [randLista(ID_1, { scor_procent: null }), randLista(ID_2, { scor_procent: null })],
      });
      server.raspunde("kpi_evaluari_lunare", "select", { count: 2 });

      const r = await listeazaLuniKpi(ORG_ID, { ...FILTRE, sort: "-scor", limita: 1 });

      expect(r.urmatorulCursor).not.toBeNull();
    },
  );

  it("eroarea numărătorii se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_evaluari_lunare", "select", { data: [] });
    server.raspunde("kpi_evaluari_lunare", "select", { error: eroarePostgrest("57014") });
    await expect(listeazaLuniKpi(ORG_ID, FILTRE)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("kpiAngajat", () => {
  it("luna cerută, seria lui și setul aplicabil chiar dacă luna nu e deschisă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_evaluari_lunare", "select", { data: null });
    server.raspunde("kpi_evaluari_lunare", "select", {
      data: [{ id: ID_1, an: 2026, luna: 8, status: "finalizat", scor_procent: 92 }],
    });
    server.raspunde("employees", "select", { data: { functie: null } });

    const r = await kpiAngajat(ORG_ID, ID_2, 2026, 9, 6);

    expect(r.luna).toBeNull();
    expect(r.serie).toEqual([
      { id: ID_1, an: 2026, luna: 8, status: "finalizat", scor_procent: 92 },
    ]);
    expect(r.aplicabil.motiv).toBe("fara_functie");

    const [luna, serie] = server.apeluriPe("kpi_evaluari_lunare");
    for (const apel of [luna, serie]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "eq", "employee_id", ID_2)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
    expect(areFiltru(luna, "eq", "an", 2026)).toBe(true);
    expect(areFiltru(luna, "eq", "luna", 9)).toBe(true);
    // Liniile șterse soft nu intră în luna afișată.
    expect(areFiltru(luna, "is", "valori.deleted_at", null)).toBe(true);
    expect(serie?.filtre).toContainEqual({ metoda: "limit", argumente: [6] });
    expect(serie?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["perioada", { ascending: false }],
    });
  });

  it("luna deschisă se mapează cu scorul recalculat; seria goală e listă goală", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("kpi_evaluari_lunare", "select", { data: lunaBruta() });
    server.raspunde("kpi_evaluari_lunare", "select", { data: null });
    server.raspunde("employees", "select", { data: null });

    const r = await kpiAngajat(ORG_ID, ID_2, 2026, 9);

    expect(r.luna?.scor.procent).toBe(77.5);
    expect(r.serie).toEqual([]);
  });
});

describe("angajatiPentruKpi", () => {
  it("scope `all` (fără fișă proprie): toată organizația, statusurile care încă lucrează", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", {
      data: [{ id: ID_1, full_name: "Ana", marca: "1", functie: null }],
    });

    const r = await angajatiPentruKpi(ORG_ID, null);

    expect(r).toHaveLength(1);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["activ", "suspendat", "preaviz"])).toBe(true);
    expect(areFiltru(apel, "eq", "manager_employee_id")).toBe(false);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [500] });
  });

  it("managerul: doar subordonații DIRECȚI, nu tot subarborele", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", { data: null });

    const r = await angajatiPentruKpi(ORG_ID, ID_3);

    expect(r).toEqual([]);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "manager_employee_id", ID_3)).toBe(true);
  });
});
