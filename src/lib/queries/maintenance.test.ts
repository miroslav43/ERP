// src/lib/queries/maintenance.test.ts
//
// Citirile modulului de mentenanță: listele paginate keyset cu numărătoare
// separată, coada de sesizări deschise, ultima citire de contor pe pagini și
// insigna de scadențe, care trebuie să numere și scadențele pe CONTOR.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { codificaCursor, decodificaCursor } from "@/lib/queries/cursor";
import {
  filtreEchipamenteSchema,
  filtreInterventiiSchema,
  filtreSesizariSchema,
} from "@/schemas/maintenance";

import {
  angajatiAutorizati,
  angajatiDupaId,
  autorizatiiIscir,
  cheieContor,
  citesteEchipament,
  citesteInterventie,
  citesteSesizare,
  contoareEchipament,
  echipamenteDupaId,
  interventii,
  listeazaEchipamente,
  numarScadenteMentenanta,
  planuriEchipament,
  planuriScadente,
  sesizari,
  sesizariDeschise,
  ultimeleCitiriContor,
} from "./maintenance";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T09:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

const filtruOr = (
  apel: { filtre: { metoda: string; argumente: readonly unknown[] }[] } | undefined,
) => apel?.filtre.find((f) => f.metoda === "or")?.argumente[0];

describe("listeazaEchipamente", () => {
  const ech = (id: string, cod: string) => ({
    id,
    cod,
    denumire: `D-${cod}`,
    status: "in_functiune",
  });

  it("pagina: limita+1, cursor pe ultimul rând arătat, total din a doua interogare", async () => {
    const { server } = configureazaActiunea();
    const randuri = ["A", "B", "C", "D", "E", "F"].map((c) => ech(`e${c}`, c));
    server.raspunde("equipment", "select", { data: randuri });
    server.raspunde("equipment", "select", { count: 31 });

    const r = await listeazaEchipamente(ORG_ID, filtreEchipamenteSchema.parse({ limita: 5 }));

    expect(r.randuri.map((x) => x.cod)).toEqual(["A", "B", "C", "D", "E"]);
    expect(r.total).toBe(31);
    expect(r.sortare).toEqual({ cheie: "cod", directie: "asc" });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "E", id: "eE" });
    const [date, numarare] = server.apeluriPe("equipment");
    expect(date?.filtre).toContainEqual({ metoda: "limit", argumente: [6] });
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
    for (const apel of [date, numarare]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
  });

  it("căutarea: cod SAU denumire, jokerii scăpați, sintaxa `or=` scoasă — pe ambele interogări", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("equipment", "select", { data: [] });
    server.raspunde("equipment", "select", { count: 0 });

    await listeazaEchipamente(
      ORG_ID,
      filtreEchipamenteSchema.parse({ cauta: '50%,(x)"', status: "in_reparatie" }),
    );

    for (const apel of server.apeluriPe("equipment")) {
      expect(filtruOr(apel)).toBe(String.raw`cod.ilike."%50\\%x%",denumire.ilike."%50\\%x%"`);
      expect(areFiltru(apel, "eq", "status", "in_reparatie")).toBe(true);
    }
  });

  it("cursor valid: predicat keyset doar pe date; cursor stricat: prima pagină, fără eroare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("equipment", "select", { data: [] });
    server.raspunde("equipment", "select", { count: 0 });
    const cursor = codificaCursor({ valoare: "casat", id: ID_1 });
    await listeazaEchipamente(ORG_ID, {
      ...filtreEchipamenteSchema.parse({ cursor }),
      sort: "-stare",
    });
    const [date, numarare] = server.apeluriPe("equipment");
    expect(filtruOr(date)).toBe(`status.lt."casat",and(status.eq."casat",id.lt."${ID_1}")`);
    expect(filtruOr(numarare)).toBeUndefined();

    server.raspunde("equipment", "select", { data: [] });
    server.raspunde("equipment", "select", { count: 0 });
    await listeazaEchipamente(ORG_ID, filtreEchipamenteSchema.parse({ cursor: "!!!" }));
    expect(filtruOr(server.apeluriPe("equipment")[2])).toBeUndefined();
  });

  it("sortare necunoscută din URL cade pe implicit, fără eroare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("equipment", "select", { data: [] });
    server.raspunde("equipment", "select", { count: 0 });
    const r = await listeazaEchipamente(ORG_ID, {
      ...filtreEchipamenteSchema.parse({}),
      sort: "valoare_achizitie",
    });
    expect(r.sortare).toEqual({ cheie: "cod", directie: "asc" });
  });
});

describe("citiri punctuale și hărți după id", () => {
  it.each([
    ["citesteEchipament", citesteEchipament, "equipment"],
    ["citesteInterventie", citesteInterventie, "maintenance_interventions"],
    ["citesteSesizare", citesteSesizare, "fault_reports"],
  ] as const)("%s: organizație + id + nesters, rândul sau null", async (_n, fn, tabela) => {
    const { server } = configureazaActiunea();
    server.raspunde(tabela, "select", { data: null });
    expect(await fn(ORG_ID, ID_1)).toBeNull();
    const [apel] = server.apeluriPe(tabela);
    expect(apel?.terminal).toBe("maybeSingle");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("echipamenteDupaId și angajatiDupaId: gol fără interogare, id-uri unice, hartă", async () => {
    const { server } = configureazaActiunea();
    expect((await echipamenteDupaId(ORG_ID, [])).size).toBe(0);
    expect((await angajatiDupaId(ORG_ID, [])).size).toBe(0);
    expect(server.apeluri).toHaveLength(0);

    server.raspunde("equipment", "select", { data: [{ id: ID_1, cod: "X" }] });
    server.raspunde("employees", "select", { data: [{ id: ID_2, full_name: "Ana" }] });
    expect((await echipamenteDupaId(ORG_ID, [ID_1, ID_1])).get(ID_1)).toEqual({
      id: ID_1,
      cod: "X",
    });
    expect((await angajatiDupaId(ORG_ID, [ID_2, ID_2])).get(ID_2)).toEqual({
      id: ID_2,
      full_name: "Ana",
    });
    const [e] = server.apeluriPe("equipment");
    expect(areFiltru(e, "in", "id", [ID_1])).toBe(true);
    expect(areFiltru(e, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(e, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(server.apeluriPe("employees")[0], "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("contoareEchipament și planuriEchipament: pe echipament, nesterse, ordonate", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("equipment_meters", "select", { data: null });
    server.raspunde("maintenance_plans", "select", { data: [{ id: ID_3 }] });
    expect(await contoareEchipament(ID_1)).toEqual([]);
    expect(await planuriEchipament(ID_1)).toEqual([{ id: ID_3 }]);
    const [c] = server.apeluriPe("equipment_meters");
    expect(areFiltru(c, "eq", "equipment_id", ID_1)).toBe(true);
    expect(areFiltru(c, "is", "deleted_at", null)).toBe(true);
    expect(c?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["data_citirii", { ascending: false }],
    });
    const [p] = server.apeluriPe("maintenance_plans");
    expect(areFiltru(p, "eq", "equipment_id", ID_1)).toBe(true);
    expect(areFiltru(p, "is", "deleted_at", null)).toBe(true);
  });
});

describe("planuriScadente", () => {
  it("doar planurile active; cea mai apropiată scadență prima, nulurile la coadă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("maintenance_plans", "select", { data: [{ id: ID_1 }], count: 1 });
    expect(await planuriScadente(ORG_ID)).toEqual({
      randuri: [{ id: ID_1 }],
      total: 1,
      trunchiat: false,
    });
    const [apel] = server.apeluriPe("maintenance_plans");
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.optiuni).toEqual({ count: "exact" });
    expect(apel?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["urmatoarea_scadenta", { ascending: true, nullsFirst: false }],
    });
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [500] });
  });

  it("numărătoarea peste rândurile citite ⇒ lista se declară trunchiată", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("maintenance_plans", "select", {
      data: [{ id: ID_1 }, { id: ID_2 }],
      count: 640,
    });
    expect(await planuriScadente(ORG_ID)).toMatchObject({ total: 640, trunchiat: true });
  });

  it("fără numărătoare: totalul e cât s-a citit, nu trunchiat", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("maintenance_plans", "select", { data: [{ id: ID_1 }], count: null });
    expect(await planuriScadente(ORG_ID)).toMatchObject({ total: 1, trunchiat: false });
  });
});

describe("ultimeleCitiriContor", () => {
  it("fără echipamente sau fără tipuri: hartă goală, nicio interogare", async () => {
    const { server } = configureazaActiunea();
    expect((await ultimeleCitiriContor(ORG_ID, [], ["ore"])).size).toBe(0);
    expect((await ultimeleCitiriContor(ORG_ID, [ID_1], [])).size).toBe(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("o interogare per tip, cu `tip` fixat; prima citire per echipament e cea bună", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("equipment_meters", "select", {
      data: [
        { equipment_id: ID_1, tip: "ore", citire: 900 },
        { equipment_id: ID_1, tip: "ore", citire: 800 },
        { equipment_id: ID_2, tip: "ore", citire: 50 },
      ],
    });
    server.raspunde("equipment_meters", "select", {
      data: [{ equipment_id: ID_1, tip: "km", citire: 12000 }],
    });

    const r = await ultimeleCitiriContor(ORG_ID, [ID_1, ID_2, ID_1], ["ore", "km", "ore"]);

    expect(Object.fromEntries(r)).toEqual({
      [cheieContor(ID_1, "ore")]: 900,
      [cheieContor(ID_2, "ore")]: 50,
      [cheieContor(ID_1, "km")]: 12000,
    });
    const apeluri = server.apeluriPe("equipment_meters");
    expect(apeluri).toHaveLength(2);
    expect(
      apeluri.map((a) => a.filtre.find((f) => f.argumente[0] === "tip")?.argumente[1]).sort(),
    ).toEqual(["km", "ore"]);
    for (const apel of apeluri) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "in", "equipment_id", [ID_1, ID_2])).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(apel.filtre).toContainEqual({ metoda: "limit", argumente: [1000] });
    }
  });

  it("o pagină plină (1000) se continuă după ultimul echipament văzut, fără a-l suprascrie", async () => {
    const { server } = configureazaActiunea();
    const plina = Array.from({ length: 1000 }, (_x, i) => ({
      equipment_id: i < 10 ? ID_1 : ID_2,
      tip: "ore",
      citire: 1000 - i,
    }));
    server.raspunde("equipment_meters", "select", { data: plina });
    server.raspunde("equipment_meters", "select", {
      data: [{ equipment_id: ID_3, tip: "ore", citire: 7 }],
    });

    const r = await ultimeleCitiriContor(ORG_ID, [ID_1, ID_2, ID_3], ["ore"]);

    expect(r.get(cheieContor(ID_1, "ore"))).toBe(1000);
    expect(r.get(cheieContor(ID_2, "ore"))).toBe(990);
    expect(r.get(cheieContor(ID_3, "ore"))).toBe(7);
    const [prima, aDoua] = server.apeluriPe("equipment_meters");
    expect(areFiltru(prima, "gt", "equipment_id")).toBe(false);
    expect(areFiltru(aDoua, "gt", "equipment_id", ID_2)).toBe(true);
  });

  it("eroarea unei pagini se aruncă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("equipment_meters", "select", { error: eroarePostgrest("57014") });
    await expect(ultimeleCitiriContor(ORG_ID, [ID_1], ["ore"])).rejects.toMatchObject({
      code: "57014",
    });
  });
});

describe("interventii și sesizari (liste keyset)", () => {
  it("interventii: filtrele de tip, rezultat și echipament pe ambele interogări; cursorul pe cost", async () => {
    const { server } = configureazaActiunea();
    const rand = (id: string, cost: number | null) => ({
      id,
      cost_total: cost,
      data: "2026-09-01",
    });
    server.raspunde("maintenance_interventions", "select", {
      data: [rand("i1", 10), rand("i2", null), rand("i3", 30)],
    });
    server.raspunde("maintenance_interventions", "select", { count: 3 });
    const filtre = {
      ...filtreInterventiiSchema.parse({
        tip: "corectiva",
        rezultat: "esuata",
        echipament: ID_1,
        limita: 5,
      }),
      limita: 2,
      sort: "-cost",
    };

    const r = await interventii(ORG_ID, filtre);

    expect(r.sortare).toEqual({ cheie: "cost", directie: "desc" });
    // `cost_total` nul (doar teoretic) devine „0” în cursor, nu „null”.
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "0", id: "i2" });
    for (const apel of server.apeluriPe("maintenance_interventions")) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(apel, "eq", "tip", "corectiva")).toBe(true);
      expect(areFiltru(apel, "eq", "rezultat", "esuata")).toBe(true);
      expect(areFiltru(apel, "eq", "equipment_id", ID_1)).toBe(true);
    }
    expect(server.apeluriPe("maintenance_interventions")[0]?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["cost_total", { ascending: false, nullsFirst: false }],
    });
  });

  it("sesizari: implicit cele mai noi întâi; filtrele pe ambele interogări; total din numărătoare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("fault_reports", "select", { data: [{ id: ID_1, raportat_la: "2026-09-01" }] });
    server.raspunde("fault_reports", "select", { count: 12 });

    const r = await sesizari(
      ORG_ID,
      filtreSesizariSchema.parse({ status: "nou", urgenta: "critica", echipament: ID_2 }),
    );

    expect(r).toMatchObject({ total: 12, urmatorulCursor: null });
    expect(r.sortare).toEqual({ cheie: "raportat", directie: "desc" });
    for (const apel of server.apeluriPe("fault_reports")) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(apel, "eq", "status", "nou")).toBe(true);
      expect(areFiltru(apel, "eq", "urgenta", "critica")).toBe(true);
      expect(areFiltru(apel, "eq", "equipment_id", ID_2)).toBe(true);
    }
  });
});

describe("sesizariDeschise", () => {
  it("filtrul de stare e în interogare; utilaj oprit, apoi urgența, apoi vechimea", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("fault_reports", "select", { data: [{ id: ID_1 }], count: 73 });

    const r = await sesizariDeschise(ORG_ID, 10);

    expect(r).toEqual({ randuri: [{ id: ID_1 }], total: 73 });
    const [apel] = server.apeluriPe("fault_reports");
    expect(areFiltru(apel, "in", "status", ["nou", "in_analiza", "in_lucru"])).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    const ordini = apel?.filtre.filter((f) => f.metoda === "order").map((f) => f.argumente);
    expect(ordini).toEqual([
      ["opreste_functionarea", { ascending: false }],
      ["urgenta", { ascending: false }],
      ["raportat_la", { ascending: true }],
    ]);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [10] });
  });
});

describe("autorizații ISCIR și angajați autorizați", () => {
  it("autorizatiiIscir: pe organizație; echipamentul e opțional", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("iscir_authorizations", "select", { data: [] });
    server.raspunde("iscir_authorizations", "select", { data: null });
    await autorizatiiIscir(ORG_ID);
    expect(await autorizatiiIscir(ORG_ID, ID_1)).toEqual([]);
    const [toate, ale] = server.apeluriPe("iscir_authorizations");
    expect(areFiltru(toate, "eq", "equipment_id")).toBe(false);
    expect(areFiltru(ale, "eq", "equipment_id", ID_1)).toBe(true);
    for (const apel of [toate, ale]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
  });

  it("angajatiAutorizati: tipul cerut, nesuspendate, valabile de azi încolo", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("personnel_authorizations", "select", { data: [] });
    await angajatiAutorizati(ORG_ID, "RSVTI");
    const [apel] = server.apeluriPe("personnel_authorizations");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "tip", "RSVTI")).toBe(true);
    expect(areFiltru(apel, "is", "suspendata_la", null)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "gte", "valabil_pana", "2026-10-02")).toBe(true);
  });

  it("„azi” e ziua României, nu UTC — după miezul nopții o autorizație expirată ieri nu mai apare valabilă", async () => {
    // 01:30 ora României, 3 octombrie = 22:30 UTC, 2 octombrie. O autorizație
    // cu `valabil_pana = 2026-10-02` a expirat, dar `gte(..., "2026-10-02")`
    // o lasă în selectorul de responsabil ISCIR până la 03:00.
    vi.setSystemTime(new Date("2026-10-02T22:30:00Z"));
    const { server } = configureazaActiunea();
    server.raspunde("personnel_authorizations", "select", { data: [] });
    await angajatiAutorizati(ORG_ID, "RSVTI");
    const [apel] = server.apeluriPe("personnel_authorizations");
    expect(areFiltru(apel, "gte", "valabil_pana", "2026-10-03")).toBe(true);
  });
});

describe("numarScadenteMentenanta", () => {
  const plan = (
    id: string,
    eq: string,
    data: string | null,
    contor: { tip: "ore" | "km"; scad: number; per: number } | null,
  ) => ({
    id,
    equipment_id: eq,
    urmatoarea_scadenta: data,
    tip_contor: contor?.tip ?? null,
    urmatoarea_scadenta_contor: contor?.scad ?? null,
    periodicitate_contor: contor?.per ?? null,
  });

  it("numără planurile pe dată ȘI pe contor (cu ultima citire), plus autorizațiile ISCIR", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("maintenance_plans", "select", {
      count: 4,
      data: [
        plan("p1", ID_1, "2026-10-10", null), // apropiată pe dată
        plan("p2", ID_1, "2027-01-01", { tip: "ore", scad: 1000, per: 500 }), // 10 ore rămase ≤ 50
        plan("p3", ID_2, "2027-01-01", { tip: "km", scad: 5000, per: 1000 }), // fără citire: doar data
        plan("p4", ID_3, null, null), // fără scadență
      ],
    });
    server.raspunde("iscir_authorizations", "select", { count: 2 });
    server.raspunde("equipment_meters", "select", {
      data: [{ equipment_id: ID_1, tip: "ore", citire: 990 }],
    });
    server.raspunde("equipment_meters", "select", { data: [] });

    expect(await numarScadenteMentenanta(ORG_ID, 15)).toBe(4);

    const [iscir] = server.apeluriPe("iscir_authorizations");
    expect(iscir?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(iscir, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(iscir, "is", "suspendata_la", null)).toBe(true);
    expect(areFiltru(iscir, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(iscir, "lte", "valabil_pana", "2026-10-17")).toBe(true);

    for (const apel of server.apeluriPe("equipment_meters")) {
      expect(areFiltru(apel, "in", "equipment_id", [ID_1, ID_2])).toBe(true);
    }
  });

  it("fără planuri pe contor: nicio citire de contoare; ISCIR fără numărătoare = 0", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("maintenance_plans", "select", {
      data: [plan("p1", ID_1, "2026-09-01", null)],
      count: 1,
    });
    server.raspunde("iscir_authorizations", "select", { count: null });
    expect(await numarScadenteMentenanta(ORG_ID, 15)).toBe(1);
    expect(server.apeluriPe("equipment_meters")).toHaveLength(0);
  });

  it("eroarea la numărarea ISCIR nu devine zero tăcut", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("maintenance_plans", "select", { data: [], count: 0 });
    server.raspunde("iscir_authorizations", "select", { error: eroarePostgrest("42501") });
    await expect(numarScadenteMentenanta(ORG_ID, 15)).rejects.toMatchObject({ code: "42501" });
  });
});
