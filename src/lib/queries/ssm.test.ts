// src/lib/queries/ssm.test.ts
//
// Citirile modulului SSM/PSI: fără filtru manual de scope (îl face RLS), dar
// cu `organization_id` și `deleted_at is null` pe fiecare interogare, paginare
// keyset cu numărătoare separată, și contoarele de panou care reduc istoricul
// la cea mai recentă înregistrare.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { codificaCursor, decodificaCursor } from "@/lib/queries/cursor";
import { filtreAngajatiSchema } from "@/schemas/employee";
import {
  filtreAccidenteSchema,
  filtreEipSchema,
  filtreFiseSchema,
  filtreStingatoareSchema,
} from "@/schemas/ssm";

import {
  accidente,
  accidenteNecomunicate,
  angajatiDupaId,
  autorizatiiNominale,
  autorizatiiNominaleAngajat,
  cheieMatrice,
  citesteAccident,
  citesteStingator,
  contorAutorizatiiNominale,
  contorEip,
  contorFiseAptitudine,
  contorInstruiri,
  contorStingatoare,
  eip,
  eipAngajatului,
  fiseAptitudine,
  fiseAptitudineAngajat,
  instruirileAngajatului,
  instruirileMele,
  matriceInstruiri,
  numarScadenteSsm,
  periodicitati,
  restrictiiActive,
  restrictiiActiveAngajat,
  stingatoare,
  tipuriInstruire,
  verificariStingator,
} from "./ssm";

/** „Azi” fix: 2 octombrie 2026, ora României. Prag de atenție 30 de zile, critic 7. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T09:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

const AZI = "2026-10-02";

/** Filtrul de organizație ȘI excluderea rândurilor șterse, pe primul apel al tabelei. */
function verificaOrganizatieSiNesterse(
  server: ReturnType<typeof configureazaActiunea>["server"],
  tabela: string,
): void {
  const [apel] = server.apeluriPe(tabela);
  expect(apel).toBeDefined();
  expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
  expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
}

describe("nomenclatoare", () => {
  it("tipuriInstruire: organizația, doar active și nesterse, pe domeniu apoi denumire", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("ssm_training_types", "select", { data: null });
    expect(await tipuriInstruire(ORG_ID)).toEqual([]);
    const [apel] = server.apeluriPe("ssm_training_types");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("periodicitati: doar rânduri intrate în vigoare până azi, cea mai recentă per tip", async () => {
    const { server } = configureazaActiunea();
    const rand = (tip: string, de: string, luni: number) => ({
      training_type_id: tip,
      periodicitate_luni: luni,
      durata_minima_ore: 1,
      valabil_de_la: de,
    });
    server.raspunde("ssm_training_type_periods", "select", {
      data: [
        rand(ID_1, "2026-01-01", 6),
        rand(ID_2, "2025-06-01", 12),
        rand(ID_1, "2024-01-01", 12),
      ],
    });

    const r = await periodicitati(ORG_ID);

    expect(r).toEqual([rand(ID_1, "2026-01-01", 6), rand(ID_2, "2025-06-01", 12)]);
    const [apel] = server.apeluriPe("ssm_training_type_periods");
    expect(areFiltru(apel, "lte", "valabil_de_la", AZI)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["valabil_de_la", { ascending: false }],
    });
  });
});

describe("matriceInstruiri", () => {
  const filtre = filtreAngajatiSchema.parse({});
  const instr = (id: string, emp: string, tip: string, data: string) => ({
    id,
    employee_id: emp,
    training_type_id: tip,
    data_instruirii: data,
    durata_ore: 1,
    urmatoarea_scadenta: null,
    semnatura_confirmata: true,
  });

  it("fără angajați vizibili: nicio citire de instruiri", async () => {
    const { server } = configureazaActiunea();
    const r = await matriceInstruiri({
      organizationId: ORG_ID,
      scope: "team",
      propriaFisaId: null,
      filtre,
    });
    expect(r.angajati).toEqual([]);
    expect(r.urmatorulCursor).toBeNull();
    expect(r.celeMaiRecente.size).toBe(0);
    expect(server.apeluriPe("ssm_trainings")).toHaveLength(0);
  });

  it("instruirile se citesc doar pentru angajații paginii; cea mai recentă per (angajat, tip)", async () => {
    const { server } = configureazaActiunea();
    const angajat = (id: string) => ({
      id,
      marca: "1",
      full_name: "Ion",
      status: "activ",
      hired_on: null,
      is_primary: true,
      user_id: null,
      department: null,
      functie: null,
      cod_cor: null,
    });
    server.raspunde("employees", "select", { data: [angajat(ID_1), angajat(ID_2)] });
    server.raspunde("employees", "select", { count: 2 });
    server.raspunde("ssm_trainings", "select", {
      data: [
        instr("a", ID_1, ID_3, "2026-09-01"),
        instr("b", ID_1, ID_3, "2025-09-01"),
        instr("c", ID_2, ID_3, "2026-01-01"),
      ],
    });

    const r = await matriceInstruiri({
      organizationId: ORG_ID,
      scope: "all",
      propriaFisaId: null,
      filtre,
    });

    expect(r.angajati.map((a) => a.id)).toEqual([ID_1, ID_2]);
    expect(r.celeMaiRecente.get(cheieMatrice(ID_1, ID_3))?.id).toBe("a");
    expect(r.celeMaiRecente.get(cheieMatrice(ID_2, ID_3))?.id).toBe("c");
    expect(r.celeMaiRecente.size).toBe(2);
    const [apel] = server.apeluriPe("ssm_trainings");
    expect(areFiltru(apel, "in", "employee_id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("cheieMatrice leagă angajatul de tip cu „:”", () => {
    expect(cheieMatrice("e", "t")).toBe("e:t");
  });
});

describe("dosarul propriu: filtru EXPLICIT pe angajat (nu doar RLS)", () => {
  it("instruirileMele se sprijină pe RLS: organizație și nesterse, fără filtru pe angajat", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("ssm_trainings", "select", { data: [] });
    await instruirileMele(ORG_ID);
    const [apel] = server.apeluriPe("ssm_trainings");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id")).toBe(false);
  });

  it.each([
    ["instruirileAngajatului", instruirileAngajatului, "ssm_trainings"],
    ["fiseAptitudineAngajat", fiseAptitudineAngajat, "occupational_health_exams"],
    ["restrictiiActiveAngajat", restrictiiActiveAngajat, "employee_work_restrictions"],
    ["eipAngajatului", eipAngajatului, "ppe_issuances"],
    ["autorizatiiNominaleAngajat", autorizatiiNominaleAngajat, "personnel_authorizations"],
  ] as const)("%s: organizație + angajat + nesterse; eroarea se aruncă", async (_n, fn, tabela) => {
    const { server } = configureazaActiunea();
    const rand = { id: ID_3 };
    server.raspunde(tabela, "select", { data: [rand] });
    expect(await fn(ORG_ID, ID_2)).toEqual([rand]);
    const [apel] = server.apeluriPe(tabela);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id", ID_2)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);

    server.raspunde(tabela, "select", { error: eroarePostgrest("42501") });
    await expect(fn(ORG_ID, ID_2)).rejects.toMatchObject({ code: "42501" });
  });

  it("fișele proprii nu citesc niciodată observațiile sau costul (art. 9 GDPR)", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("occupational_health_exams", "select", { data: [] });
    await fiseAptitudineAngajat(ORG_ID, ID_2, 5);
    const [apel] = server.apeluriPe("occupational_health_exams");
    expect(apel?.coloane).not.toMatch(/observatii|cost/u);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [5] });
  });

  it("restricțiile proprii: doar cele neridicate", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_work_restrictions", "select", { data: [] });
    await restrictiiActiveAngajat(ORG_ID, ID_2);
    expect(
      areFiltru(server.apeluriPe("employee_work_restrictions")[0], "is", "ridicata_la", null),
    ).toBe(true);
  });
});

describe("fiseAptitudine (paginare keyset)", () => {
  const fisa = (id: string, data: string) => ({
    id,
    employee_id: ID_2,
    tip: "periodic",
    data_examinarii: data,
    medic: null,
    unitate_medicala: null,
    rezultat: "apt",
    valabil_pana: null,
    numar_fisa: null,
  });

  it("limita+1 rânduri ⇒ pagina are `limita` și un cursor pe ultimul rând arătat", async () => {
    const { server } = configureazaActiunea();
    const filtre = filtreFiseSchema.parse({ limita: "5" });
    const randuri = ["01", "02", "03", "04", "05", "06"].map((z, i) =>
      fisa(`id-${String(i)}`, `2026-09-${z}`),
    );
    server.raspunde("occupational_health_exams", "select", { data: randuri });
    server.raspunde("occupational_health_exams", "select", { count: 42 });

    const r = await fiseAptitudine(ORG_ID, filtre);

    expect(r.randuri).toHaveLength(5);
    expect(r.total).toBe(42);
    expect(r.sortare).toEqual({ cheie: "data", directie: "desc" });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({
      valoare: "2026-09-05",
      id: "id-4",
    });

    const [date, numarare] = server.apeluriPe("occupational_health_exams");
    expect(date?.coloane).not.toMatch(/observatii|cost/u);
    expect(date?.filtre).toContainEqual({ metoda: "limit", argumente: [6] });
    expect(date?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["data_examinarii", { ascending: false, nullsFirst: false }],
    });
    expect(date?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["id", { ascending: false }],
    });
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
    for (const apel of [date, numarare]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
  });

  it("cursorul intră doar pe date, nu pe numărătoare; filtrul de rezultat pe amândouă", async () => {
    const { server } = configureazaActiunea();
    const cursor = codificaCursor({ valoare: "apt", id: ID_1 });
    const filtre = filtreFiseSchema.parse({ rezultat: "inapt", sort: "rezultat", cursor });
    server.raspunde("occupational_health_exams", "select", { data: [fisa(ID_2, "2026-01-01")] });
    server.raspunde("occupational_health_exams", "select", { count: null });

    const r = await fiseAptitudine(ORG_ID, filtre);

    const [date, numarare] = server.apeluriPe("occupational_health_exams");
    expect(date?.filtre.some((f) => f.metoda === "or")).toBe(true);
    expect(numarare?.filtre.some((f) => f.metoda === "or")).toBe(false);
    expect(areFiltru(date, "eq", "rezultat", "inapt")).toBe(true);
    expect(areFiltru(numarare, "eq", "rezultat", "inapt")).toBe(true);
    expect(r.sortare).toEqual({ cheie: "rezultat", directie: "asc" });
    // Ultima pagină: fără cursor următor; numărătoare absentă ⇒ rândurile citite.
    expect(r.urmatorulCursor).toBeNull();
    expect(r.total).toBe(1);
  });

  it("o eroare pe numărătoare nu e înghițită", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("occupational_health_exams", "select", { data: [] });
    server.raspunde("occupational_health_exams", "select", { error: eroarePostgrest("57014") });
    await expect(fiseAptitudine(ORG_ID, filtreFiseSchema.parse({}))).rejects.toMatchObject({
      code: "57014",
    });
  });
});

describe("accidente", () => {
  const acc = (id: string, data: string, tip = "usor") => ({ id, data_producerii: data, tip });

  it("„necomunicate” și tipul filtrează ambele interogări; cursorul urmează sortarea după tip", async () => {
    const { server } = configureazaActiunea();
    const filtre = filtreAccidenteSchema.parse({
      tip: "grav",
      necomunicate: "1",
      sort: "-tip",
      limita: 5,
    });
    const randuri = [1, 2, 3, 4, 5, 6].map((n) => acc(`a${String(n)}`, "2026-09-01", "grav"));
    server.raspunde("work_accidents", "select", { data: randuri });
    server.raspunde("work_accidents", "select", { count: 9 });

    const r = await accidente(ORG_ID, filtre);

    expect(r.randuri).toHaveLength(5);
    expect(r.total).toBe(9);
    expect(r.sortare).toEqual({ cheie: "tip", directie: "desc" });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "grav", id: "a5" });
    for (const apel of server.apeluriPe("work_accidents")) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(apel, "eq", "tip", "grav")).toBe(true);
      expect(areFiltru(apel, "is", "comunicat_la_itm_la", null)).toBe(true);
    }
  });

  it("citesteAccident: rândul sau null, pe organizație + id + nesters", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("work_accidents", "select", { data: null });
    expect(await citesteAccident(ORG_ID, ID_1)).toBeNull();
    const [apel] = server.apeluriPe("work_accidents");
    expect(apel?.coloane).toContain("imprejurari");
    expect(apel?.terminal).toBe("maybeSingle");
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("accidenteNecomunicate: cele mai vechi întâi, plafonate la 50", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("work_accidents", "select", { data: [acc(ID_1, "2026-09-01")] });
    expect(await accidenteNecomunicate(ORG_ID)).toHaveLength(1);
    const [apel] = server.apeluriPe("work_accidents");
    expect(areFiltru(apel, "is", "comunicat_la_itm_la", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["data_producerii", { ascending: true }],
    });
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [50] });
    verificaOrganizatieSiNesterse(server, "work_accidents");
  });
});

describe("stingatoare", () => {
  it("fără filtru de status, casatele ies din listă ȘI din numărătoare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("fire_extinguishers", "select", { data: [] });
    server.raspunde("fire_extinguishers", "select", { count: 0 });
    const r = await stingatoare(ORG_ID, filtreStingatoareSchema.parse({}));
    expect(r).toMatchObject({ randuri: [], urmatorulCursor: null, total: 0 });
    expect(r.sortare).toEqual({ cheie: "cod", directie: "asc" });
    for (const apel of server.apeluriPe("fire_extinguishers")) {
      expect(areFiltru(apel, "neq", "status", "casat")).toBe(true);
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
  });

  it("casatele cerute explicit: `eq status`, fără excluderea implicită", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("fire_extinguishers", "select", { data: [] });
    server.raspunde("fire_extinguishers", "select", { count: 0 });
    await stingatoare(ORG_ID, filtreStingatoareSchema.parse({ status: "casat", cauta: "ST" }));
    for (const apel of server.apeluriPe("fire_extinguishers")) {
      expect(areFiltru(apel, "eq", "status", "casat")).toBe(true);
      expect(areFiltru(apel, "neq", "status")).toBe(false);
      expect(areFiltru(apel, "ilike", "cod", "%ST%")).toBe(true);
    }
  });

  it.fails("DEFECT: `%` și `_` din căutarea după cod sunt jokeri, nu text", async () => {
    // `listeazaEchipamente` folosește `tiparContine`, care le scapă; aici
    // „ST_1” potrivește și „STX1”, iar „100%” întoarce tot ce începe cu 100.
    const { server } = configureazaActiunea();
    server.raspunde("fire_extinguishers", "select", { data: [] });
    server.raspunde("fire_extinguishers", "select", { count: 0 });
    await stingatoare(ORG_ID, filtreStingatoareSchema.parse({ cauta: "ST_1" }));
    const [apel] = server.apeluriPe("fire_extinguishers");
    const tipar = apel?.filtre.find((f) => f.metoda === "ilike")?.argumente[1];
    expect(tipar).toBe(String.raw`%ST\_1%`);
  });

  it("citesteStingator și verificariStingator", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("fire_extinguishers", "select", { data: { id: ID_1 } });
    server.raspunde("fire_extinguisher_checks", "select", { data: null });
    expect(await citesteStingator(ORG_ID, ID_1)).toEqual({ id: ID_1 });
    expect(await verificariStingator(ID_1)).toEqual([]);
    const [s] = server.apeluriPe("fire_extinguishers");
    expect(areFiltru(s, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(s, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(s, "is", "deleted_at", null)).toBe(true);
    const [v] = server.apeluriPe("fire_extinguisher_checks");
    expect(areFiltru(v, "eq", "extinguisher_id", ID_1)).toBe(true);
    expect(areFiltru(v, "is", "deleted_at", null)).toBe(true);
  });
});

describe("eip, autorizații, angajați", () => {
  it("eip: sortarea după articol pune articolul în cursor", async () => {
    const { server } = configureazaActiunea();
    const rand = (id: string, articol: string) => ({ id, articol, data_predarii: "2026-01-01" });
    const randuri = ["A", "B", "C", "D", "E", "F"].map((a) => rand(`e${a}`, a));
    server.raspunde("ppe_issuances", "select", { data: randuri });
    server.raspunde("ppe_issuances", "select", { count: 6 });
    const r = await eip(ORG_ID, filtreEipSchema.parse({ sort: "articol", limita: 5 }));
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "E", id: "eE" });
    for (const apel of server.apeluriPe("ppe_issuances")) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
  });

  it("autorizatiiNominale și restrictiiActive: organizație, nesterse, plafon explicit", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("personnel_authorizations", "select", { data: [] });
    server.raspunde("employee_work_restrictions", "select", { data: [] });
    await autorizatiiNominale(ORG_ID);
    await restrictiiActive(ORG_ID);
    const [a] = server.apeluriPe("personnel_authorizations");
    expect(areFiltru(a, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(a, "is", "deleted_at", null)).toBe(true);
    expect(a?.filtre).toContainEqual({ metoda: "limit", argumente: [500] });
    const [rr] = server.apeluriPe("employee_work_restrictions");
    expect(areFiltru(rr, "is", "ridicata_la", null)).toBe(true);
    verificaOrganizatieSiNesterse(server, "employee_work_restrictions");
    expect(rr?.filtre).toContainEqual({ metoda: "limit", argumente: [200] });
  });

  it("angajatiDupaId: listă goală fără interogare; id-uri unice; hartă după id", async () => {
    const { server } = configureazaActiunea();
    expect((await angajatiDupaId(ORG_ID, [])).size).toBe(0);
    expect(server.apeluri).toHaveLength(0);

    const ion = { id: ID_1, full_name: "Ion", marca: "7" };
    server.raspunde("employees", "select", { data: [ion] });
    const harta = await angajatiDupaId(ORG_ID, [ID_1, ID_1, ID_2]);
    expect(harta.get(ID_1)).toEqual(ion);
    expect(harta.has(ID_2)).toBe(false);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "in", "id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
  });
});

describe("contoarele panoului", () => {
  it("contorInstruiri: cea mai recentă per (angajat, tip), SSM și PSI numărate separat", async () => {
    const { server } = configureazaActiunea();
    const r = (emp: string, tip: string, scad: string | null, domeniu: "ssm" | "psi" | null) => ({
      employee_id: emp,
      training_type_id: tip,
      data_instruirii: "2026-01-01",
      urmatoarea_scadenta: scad,
      tip: domeniu === null ? null : { domeniu },
    });
    server.raspunde("ssm_trainings", "select", {
      data: [
        r(ID_1, "t1", "2027-06-01", "ssm"), // cea mai recentă: ok
        r(ID_1, "t1", "2026-01-01", "ssm"), // istoric expirat, ignorat
        r(ID_2, "t1", "2026-10-20", "ssm"), // atenție
        r(ID_2, "t2", "2026-09-01", "psi"), // expirat
        r(ID_3, "t3", "2026-09-01", null), // tip invizibil: sărit
      ],
    });

    expect(await contorInstruiri(ORG_ID)).toEqual([
      { domeniu: "ssm", deAtentionat: 1 },
      { domeniu: "psi", deAtentionat: 1 },
    ]);
    const [apel] = server.apeluriPe("ssm_trainings");
    expect(apel?.coloane).toContain("ssm_training_types!inner(domeniu)");
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [2000] });
    verificaOrganizatieSiNesterse(server, "ssm_trainings");
  });

  it("contorStingatoare: cele trei obligații numărate separat; fără înregistrare = de atenționat", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("fire_extinguishers", "select", {
      data: [
        {
          ultima_verificare: "2025-09-01",
          scadenta_verificare: "2026-09-01",
          ultima_reincarcare: "2026-01-01",
          scadenta_reincarcare: "2029-01-01",
          ultima_proba_presiune: null,
          scadenta_proba_presiune: null,
        },
        {
          ultima_verificare: "2026-05-01",
          scadenta_verificare: "2026-10-05",
          ultima_reincarcare: "2026-01-01",
          scadenta_reincarcare: "2029-01-01",
          ultima_proba_presiune: "2025-01-01",
          scadenta_proba_presiune: "2030-01-01",
        },
      ],
    });
    expect(await contorStingatoare(ORG_ID)).toEqual({
      verificare: 2,
      reincarcare: 0,
      probaPresiune: 1,
    });
    const [apel] = server.apeluriPe("fire_extinguishers");
    expect(areFiltru(apel, "neq", "status", "casat")).toBe(true);
    verificaOrganizatieSiNesterse(server, "fire_extinguishers");
  });

  it("contorFiseAptitudine: doar ultima fișă a fiecărui angajat contează", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("occupational_health_exams", "select", {
      data: [
        { employee_id: ID_1, data_examinarii: "2026-09-01", valabil_pana: "2027-09-01" },
        { employee_id: ID_1, data_examinarii: "2025-09-01", valabil_pana: "2026-09-01" },
        { employee_id: ID_2, data_examinarii: "2025-10-01", valabil_pana: "2026-10-09" },
        { employee_id: ID_3, data_examinarii: "2025-10-01", valabil_pana: null },
      ],
    });
    expect(await contorFiseAptitudine(ORG_ID)).toBe(1);
    verificaOrganizatieSiNesterse(server, "occupational_health_exams");
  });

  it("contorAutorizatiiNominale: suspendatele se exclud în interogare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("personnel_authorizations", "select", {
      data: [
        { valabil_pana: "2026-09-30", suspendata_la: null },
        { valabil_pana: "2026-10-31", suspendata_la: null },
        { valabil_pana: "2026-11-02", suspendata_la: null },
      ],
    });
    expect(await contorAutorizatiiNominale(ORG_ID)).toBe(2);
    expect(
      areFiltru(server.apeluriPe("personnel_authorizations")[0], "is", "suspendata_la", null),
    ).toBe(true);
    verificaOrganizatieSiNesterse(server, "personnel_authorizations");
  });

  it("contorEip: data de înlocuire explicită, altfel predare + durată; fără ambele nu se numără", async () => {
    const { server } = configureazaActiunea();
    const r = (predare: string, luni: number | null, inlocuire: string | null) => ({
      data_predarii: predare,
      durata_utilizare_luni: luni,
      data_inlocuirii: inlocuire,
      returnat_la: null,
    });
    server.raspunde("ppe_issuances", "select", {
      data: [
        r("2026-01-01", 12, "2026-10-10"), // explicită, peste 8 zile: atenție
        r("2025-10-15", 12, null), // 2026-10-15: atenție
        r("2025-12-15", 12, null), // 2026-12-15: ok
        r("2020-01-01", null, null), // fără scadență
        r("2026-05-01", 1, "2027-01-01"), // explicita bate durata
      ],
    });
    expect(await contorEip(ORG_ID)).toBe(2);
    expect(areFiltru(server.apeluriPe("ppe_issuances")[0], "is", "returnat_la", null)).toBe(true);
    verificaOrganizatieSiNesterse(server, "ppe_issuances");
  });

  it("numarScadenteSsm: suma tuturor celor cinci surse", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("ssm_trainings", "select", {
      data: [
        {
          employee_id: ID_1,
          training_type_id: "t",
          data_instruirii: "2025-01-01",
          urmatoarea_scadenta: "2026-01-01",
          tip: { domeniu: "psi" },
        },
      ],
    });
    server.raspunde("fire_extinguishers", "select", {
      data: [
        {
          ultima_verificare: null,
          scadenta_verificare: null,
          ultima_reincarcare: null,
          scadenta_reincarcare: null,
          ultima_proba_presiune: null,
          scadenta_proba_presiune: null,
        },
      ],
    });
    server.raspunde("occupational_health_exams", "select", {
      data: [{ employee_id: ID_1, data_examinarii: "2025-01-01", valabil_pana: "2026-01-01" }],
    });
    server.raspunde("personnel_authorizations", "select", {
      data: [{ valabil_pana: "2026-10-03", suspendata_la: null }],
    });
    server.raspunde("ppe_issuances", "select", { data: [] });

    // 1 instruire + 3 obligații de stingător niciodată efectuate + 1 fișă + 1 autorizație + 0 EIP
    expect(await numarScadenteSsm(ORG_ID)).toBe(6);
  });
});
