// src/lib/queries/departments.test.ts
//
// Citirile structurii organizatorice. Ecranul nu paginează și numără oameni pe
// noduri, deci o listă tăiată la plafonul PostgREST dă cifre greșite și un
// arbore deformat: `citesteTot` trebuie să ceară pagina următoare cu cursor
// keyset. Plus restrângerea de scope pentru angajați (own / team / all).

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ORG_ID, USER_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";

import {
  angajatiPentruStructura,
  rolurilePeUtilizator,
  structuraDepartamentelor,
} from "./departments";

function fals(): ClientFals {
  return configureazaActiunea().server;
}

/** Id-uri crescătoare, ca ordinea keyset să fie cea a indicelui. */
function idRand(i: number): string {
  return `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
}

function departament(i: number) {
  return {
    id: idRand(i),
    parent_id: null,
    cod: null,
    denumire: `Departament ${String(i)}`,
    descriere: null,
    activ: true,
    manager_employee_id: null,
    cost_center: null,
    manager: null,
  };
}

// ── structuraDepartamentelor ───────────────────────────────────────────────

describe("structuraDepartamentelor", () => {
  it("departamentele nesterse ale organizației, cu managerul încorporat, ordonate pe id", async () => {
    const server = fals();
    server.raspunde("departments", "select", { data: [departament(1), departament(2)] });

    const lista = await structuraDepartamentelor(ORG_ID);

    expect(lista.map((d) => d.id)).toEqual([idRand(1), idRand(2)]);
    const [apel, ...altele] = server.apeluriPe("departments");
    expect(altele).toHaveLength(0);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "id", { ascending: true })).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [1000] });
    // Prima pagină nu are cursor.
    expect(areFiltru(apel, "gt", "id")).toBe(false);
    expect(apel?.coloane).toContain("manager:employees!manager_employee_id(full_name, user_id)");
  });

  it("pagină plină de 1000: cere următoarea DUPĂ ultimul id, nu se oprește tăcut la plafon", async () => {
    const server = fals();
    const plina = Array.from({ length: 1000 }, (_, i) => departament(i + 1));
    server.raspunde("departments", "select", { data: plina });
    server.raspunde("departments", "select", { data: [departament(1001)] });

    const lista = await structuraDepartamentelor(ORG_ID);

    expect(lista).toHaveLength(1001);
    const [, aDoua] = server.apeluriPe("departments");
    expect(areFiltru(aDoua, "gt", "id", idRand(1000))).toBe(true);
    expect(areFiltru(aDoua, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(aDoua, "is", "deleted_at", null)).toBe(true);
  });

  it("eroarea bazei se propagă, nu devine un arbore gol", async () => {
    const server = fals();
    const eroare = eroarePostgrest("42501");
    server.raspunde("departments", "select", { error: eroare });
    await expect(structuraDepartamentelor(ORG_ID)).rejects.toBe(eroare);
  });
});

// ── rolurilePeUtilizator ───────────────────────────────────────────────────

describe("rolurilePeUtilizator", () => {
  it("indexează rolul membrilor ACTIVI și nesterși pe contul lor", async () => {
    const server = fals();
    server.raspunde("organization_members", "select", {
      data: [
        { user_id: USER_ID, role: "org_admin" },
        { user_id: ID_1, role: "employee" },
      ],
    });

    const harta = await rolurilePeUtilizator(ORG_ID);

    expect(harta.get(USER_ID)).toBe("org_admin");
    expect(harta.get(ID_1)).toBe("employee");
    expect(harta.size).toBe(2);
    const [apel] = server.apeluriPe("organization_members");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "active")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("`data` null: hartă goală", async () => {
    const server = fals();
    server.raspunde("organization_members", "select", { data: null });
    expect((await rolurilePeUtilizator(ORG_ID)).size).toBe(0);
  });

  it("eroarea se propagă", async () => {
    const server = fals();
    const eroare = eroarePostgrest("42P01");
    server.raspunde("organization_members", "select", { error: eroare });
    await expect(rolurilePeUtilizator(ORG_ID)).rejects.toBe(eroare);
  });
});

// ── angajatiPentruStructura ────────────────────────────────────────────────

describe("angajatiPentruStructura", () => {
  const FISA = ID_2;
  const angajat = {
    id: idRand(1),
    full_name: "Ana Pop",
    marca: "001",
    department_id: null,
    user_id: null,
    status: "suspendat",
    functie: null,
  };

  it.each([
    ["none", FISA],
    ["own", null],
    ["team", null],
  ] as const)(
    "scope `%s` fără ancoră (fișă %s): listă goală, fără interogare",
    async (scope, fisa) => {
      const server = fals();
      expect(await angajatiPentruStructura(ORG_ID, scope, fisa)).toEqual([]);
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("`all`: toți angajații nesterși ai organizației, ORICE status, inclusiv nerepartizații", async () => {
    const server = fals();
    server.raspunde("employees", "select", { data: [angajat] });

    expect(await angajatiPentruStructura(ORG_ID, "all", null)).toEqual([angajat]);

    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "eq", "status")).toBe(false);
    expect(areFiltru(apel, "eq", "id")).toBe(false);
    expect(areFiltru(apel, "contains", "manager_path")).toBe(false);
    expect(areFiltru(apel, "not", "department_id")).toBe(false);
    expect(areFiltru(apel, "order", "id", { ascending: true })).toBe(true);
  });

  it("`own`: doar propria fișă", async () => {
    const server = fals();
    server.raspunde("employees", "select", { data: [] });
    await angajatiPentruStructura(ORG_ID, "own", FISA);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "id", FISA)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "contains", "manager_path")).toBe(false);
  });

  it("`team`: subarborele MANAGERIAL (`manager_path`), nu departamentul", async () => {
    const server = fals();
    server.raspunde("employees", "select", { data: [] });
    await angajatiPentruStructura(ORG_ID, "team", FISA);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "contains", "manager_path", [FISA])).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "department_id")).toBe(false);
    expect(areFiltru(apel, "eq", "id")).toBe(false);
  });

  it("restrângerea de scope se păstrează și pe pagina a doua", async () => {
    const server = fals();
    const plina = Array.from({ length: 1000 }, (_, i) => ({ ...angajat, id: idRand(i + 1) }));
    server.raspunde("employees", "select", { data: plina });
    server.raspunde("employees", "select", { data: [] });

    const lista = await angajatiPentruStructura(ORG_ID, "team", FISA);

    expect(lista).toHaveLength(1000);
    const [, aDoua] = server.apeluriPe("employees");
    expect(areFiltru(aDoua, "gt", "id", idRand(1000))).toBe(true);
    expect(areFiltru(aDoua, "contains", "manager_path", [FISA])).toBe(true);
  });
});
