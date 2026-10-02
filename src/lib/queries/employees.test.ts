// src/lib/queries/employees.test.ts
//
// Citirile de personal: filtrul de organizație, ștergerea logică, restrângerea
// după scope (own / team / all), paginarea keyset și maparea rândurilor.
// Clientul vine din `createServerSupabase()`, înlocuit cu falsul strict din
// `@/lib/teste/actiune` — un apel neprogramat aruncă.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID, USER_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import type { FiltreAngajati } from "@/schemas/employee";
import { codificaCursor, decodificaCursor } from "./cursor";
import {
  angajatiPentruPontaj,
  arboreleManagerial,
  citesteAngajat,
  citesteAngajatPentruEditare,
  citesteComponenteSalariale,
  citesteRezumatDateSensibile,
  citesteScutiriFiscale,
  colegiPentruManager,
  functiiFolosite,
  idFisaProprie,
  lantulDeManageri,
  listeazaAngajati,
  piediciStergereAngajat,
  rolurileConturilor,
  toateRolurileConturilor,
} from "./employees";

const URL_AVATAR = "https://example.supabase.co/storage/v1/object/public/avatars/";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

const filtre = (modificari: Partial<FiltreAngajati> = {}): FiltreAngajati => ({
  q: null,
  department_id: null,
  functie: null,
  status: null,
  cursor: null,
  limita: 2,
  sort: null,
  ...modificari,
});

function rand(id: string, nume: string, userId: string | null = null) {
  return {
    id,
    marca: `M-${nume}`,
    full_name: nume,
    status: "activ",
    hired_on: "2026-01-01",
    is_primary: true,
    user_id: userId,
    department: null,
    functie: null,
    cod_cor: null,
  };
}

const [lista, numarare] = [0, 1];

describe("idFisaProprie", () => {
  it("caută fișa contului în organizație, nesteasă, cu cea principală prima", async () => {
    db.raspunde("employees", "select", { data: { id: ID_1 } });
    expect(await idFisaProprie(ORG_ID, USER_ID)).toBe(ID_1);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "is_primary", { ascending: false })).toBe(true);
    expect(apel?.filtre.some((f) => f.metoda === "limit" && f.argumente[0] === 1)).toBe(true);
  });

  it("fără fișă: null; eroare: aruncă", async () => {
    db.raspunde("employees", "select", { data: null });
    expect(await idFisaProprie(ORG_ID, USER_ID)).toBeNull();
    db.raspunde("employees", "select", { error: eroarePostgrest("42501") });
    await expect(idFisaProprie(ORG_ID, USER_ID)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("listeazaAngajati", () => {
  it.each(["own", "team", "none"] as const)(
    "scope `%s` fără fișă proprie: listă goală, fără nicio interogare",
    async (scope) => {
      const r = await listeazaAngajati({
        organizationId: ORG_ID,
        scope,
        propriaFisaId: null,
        filtre: filtre(),
      });
      expect(r).toMatchObject({ randuri: [], urmatorulCursor: null, total: 0 });
      expect(db.apeluri).toHaveLength(0);
    },
  );

  it("scope `all`: lista și numărătoarea poartă AMBELE organizația și ștergerea logică, fără restrângere de echipă", async () => {
    db.raspunde("employees", "select", { data: [rand(ID_1, "Ana")] });
    db.raspunde("employees", "select", { count: 1 });

    const r = await listeazaAngajati({
      organizationId: ORG_ID,
      scope: "all",
      propriaFisaId: null,
      filtre: filtre(),
    });

    expect(r.total).toBe(1);
    expect(r.urmatorulCursor).toBeNull();
    for (const apel of db.apeluriPe("employees")) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(apel, "contains", "manager_path")).toBe(false);
      expect(areFiltru(apel, "eq", "id")).toBe(false);
    }
    expect(db.apeluri[numarare]?.optiuni).toEqual({ count: "exact", head: true });
  });

  it("scope `own`: ambele interogări restrânse la propria fișă", async () => {
    db.raspunde("employees", "select", { data: [] });
    db.raspunde("employees", "select", { count: 0 });
    await listeazaAngajati({
      organizationId: ORG_ID,
      scope: "own",
      propriaFisaId: ID_3,
      filtre: filtre(),
    });
    for (const apel of db.apeluri) expect(areFiltru(apel, "eq", "id", ID_3)).toBe(true);
  });

  it("scope `team`: ambele interogări restrânse la subarborele din `manager_path`", async () => {
    db.raspunde("employees", "select", { data: [] });
    db.raspunde("employees", "select", { count: 0 });
    await listeazaAngajati({
      organizationId: ORG_ID,
      scope: "team",
      propriaFisaId: ID_3,
      filtre: filtre(),
    });
    for (const apel of db.apeluri) {
      expect(areFiltru(apel, "contains", "manager_path", [ID_3])).toBe(true);
    }
  });

  it("filtrele din bară se aplică identic pe listă și pe numărătoare", async () => {
    db.raspunde("employees", "select", { data: [] });
    db.raspunde("employees", "select", { count: 0 });
    await listeazaAngajati({
      organizationId: ORG_ID,
      scope: "all",
      propriaFisaId: null,
      filtre: filtre({ q: "pop", department_id: ID_2, functie: "Sudor", status: "activ" }),
    });
    for (const apel of db.apeluri) {
      expect(areFiltru(apel, "ilike", "full_name", "%pop%")).toBe(true);
      expect(areFiltru(apel, "eq", "department_id", ID_2)).toBe(true);
      expect(areFiltru(apel, "eq", "functie", "Sudor")).toBe(true);
      expect(areFiltru(apel, "eq", "status", "activ")).toBe(true);
    }
  });

  it("keyset: cere limita+1, taie pagina și codifică cursorul din ultimul rând AFIȘAT", async () => {
    db.raspunde("employees", "select", {
      data: [rand(ID_1, "Ana", USER_ID), rand(ID_2, "Bogdan"), rand(ID_3, "Cezar")],
    });
    db.raspunde("employees", "select", { count: 7 });
    db.raspunde("profiles", "select", { data: [{ id: USER_ID, avatar_path: "u/poza.png" }] });

    const r = await listeazaAngajati({
      organizationId: ORG_ID,
      scope: "all",
      propriaFisaId: null,
      filtre: filtre({ limita: 2 }),
    });

    expect(r.randuri.map((x) => x.id)).toEqual([ID_1, ID_2]);
    expect(r.total).toBe(7);
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "Bogdan", id: ID_2 });
    expect(r.randuri[0]?.avatar_url).toBe(`${URL_AVATAR}u/poza.png`);
    expect(r.randuri[1]?.avatar_url).toBeNull();
    const apel = db.apeluri[lista];
    expect(apel?.filtre.find((f) => f.metoda === "limit")?.argumente[0]).toBe(3);
    expect(areFiltru(apel, "order", "full_name", { ascending: true, nullsFirst: false })).toBe(
      true,
    );
    expect(areFiltru(apel, "order", "id", { ascending: true })).toBe(true);
    const [profiluri] = db.apeluriPe("profiles");
    expect(areFiltru(profiluri, "in", "id", [USER_ID])).toBe(true);
  });

  it("cursorul primit devine predicat `or` DOAR pe listă, nu și pe numărătoare", async () => {
    db.raspunde("employees", "select", { data: [] });
    db.raspunde("employees", "select", { count: 9 });
    await listeazaAngajati({
      organizationId: ORG_ID,
      scope: "all",
      propriaFisaId: null,
      filtre: filtre({ cursor: codificaCursor({ valoare: "Bogdan", id: ID_2 }) }),
    });
    expect(db.apeluri[lista]?.filtre.some((f) => f.metoda === "or")).toBe(true);
    expect(db.apeluri[numarare]?.filtre.some((f) => f.metoda === "or")).toBe(false);
  });

  it("sortare după marcă, descrescător: coloana `marca` și cursorul din marcă", async () => {
    db.raspunde("employees", "select", {
      data: [rand(ID_1, "Ana"), rand(ID_2, "Bogdan"), rand(ID_3, "X")],
    });
    db.raspunde("employees", "select", { count: 3 });
    const r = await listeazaAngajati({
      organizationId: ORG_ID,
      scope: "all",
      propriaFisaId: null,
      filtre: filtre({ sort: "-marca" }),
    });
    expect(r.sortare).toEqual({ cheie: "marca", directie: "desc" });
    expect(
      areFiltru(db.apeluri[lista], "order", "marca", { ascending: false, nullsFirst: false }),
    ).toBe(true);
    expect(decodificaCursor(r.urmatorulCursor ?? "")?.valoare).toBe("M-Bogdan");
  });

  it("sortare necunoscută din URL: cade tăcut pe nume crescător", async () => {
    db.raspunde("employees", "select", { data: [] });
    db.raspunde("employees", "select", { count: 0 });
    const r = await listeazaAngajati({
      organizationId: ORG_ID,
      scope: "all",
      propriaFisaId: null,
      filtre: filtre({ sort: "cnp" }),
    });
    expect(r.sortare).toEqual({ cheie: "nume", directie: "asc" });
  });

  it("eroarea numărătorii nu se înghite", async () => {
    db.raspunde("employees", "select", { data: [] });
    db.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    await expect(
      listeazaAngajati({
        organizationId: ORG_ID,
        scope: "all",
        propriaFisaId: null,
        filtre: filtre(),
      }),
    ).rejects.toMatchObject({ code: "57014" });
  });
});

describe("citesteAngajat", () => {
  const brut = {
    ...rand(ID_1, "Ana", USER_ID),
    manager_path: [ID_1],
    contracts: [
      { id: "c1", valabil_de_la: "2024-01-01" },
      { id: "c2", valabil_de_la: "2026-01-01" },
    ],
    documents: [
      { id: "d1", data_document: null },
      { id: "d2", data_document: "2025-05-05" },
      { id: "d3", data_document: "2026-06-06" },
    ],
  };

  it("scope sub `all` fără fișă proprie: null, fără interogare", async () => {
    expect(await citesteAngajat(ORG_ID, ID_1, "team", null)).toBeNull();
    expect(db.apeluri).toHaveLength(0);
  });

  it("scope `all`: fișa pe id + organizație, cu contractele și documentele cele mai noi primele", async () => {
    db.raspunde("employees", "select", { data: brut });
    db.raspunde("profiles", "select", { data: [{ id: USER_ID, avatar_path: null }] });

    const r = await citesteAngajat(ORG_ID, ID_1, "all", null);

    expect(r?.contracts.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(r?.documents.map((d) => d.id)).toEqual(["d3", "d2", "d1"]);
    expect(r?.avatar_url).toBeNull();
    const [apel] = db.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "contains", "manager_path")).toBe(false);
  });

  it("scope `own`: se adaugă și condiția „e chiar fișa mea”", async () => {
    db.raspunde("employees", "select", { data: null });
    expect(await citesteAngajat(ORG_ID, ID_1, "own", ID_2)).toBeNull();
    expect(areFiltru(db.apeluri[0], "eq", "id", ID_2)).toBe(true);
  });

  it("scope `team`: se adaugă condiția de subarbore", async () => {
    db.raspunde("employees", "select", { data: null });
    await citesteAngajat(ORG_ID, ID_1, "team", ID_2);
    expect(areFiltru(db.apeluri[0], "contains", "manager_path", [ID_2])).toBe(true);
  });
});

describe("rolurileConturilor / toateRolurileConturilor", () => {
  it("fără conturi: hartă goală, fără interogare", async () => {
    expect((await rolurileConturilor(ORG_ID, [null, null])).size).toBe(0);
    expect(db.apeluri).toHaveLength(0);
  });

  it("cere doar conturile distincte, membri activi și neșterși", async () => {
    db.raspunde("organization_members", "select", {
      data: [
        { user_id: USER_ID, role: "org_admin" },
        { user_id: null, role: "hr" },
      ],
    });
    const harta = await rolurileConturilor(ORG_ID, [USER_ID, USER_ID, null]);
    expect([...harta]).toEqual([[USER_ID, "org_admin"]]);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "in", "user_id", [USER_ID])).toBe(true);
    expect(areFiltru(apel, "eq", "status", "active")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("varianta completă: fără filtru pe listă, aceeași restrângere la membri activi", async () => {
    db.raspunde("organization_members", "select", {
      data: [
        { user_id: USER_ID, role: "hr" },
        { user_id: ID_1, role: "manager" },
      ],
    });
    const harta = await toateRolurileConturilor(ORG_ID);
    expect(harta.get(ID_1)).toBe("manager");
    expect(areFiltru(db.apeluri[0], "in", "user_id")).toBe(false);
    expect(areFiltru(db.apeluri[0], "eq", "status", "active")).toBe(true);
    expect(areFiltru(db.apeluri[0], "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(db.apeluri[0], "is", "deleted_at", null)).toBe(true);
  });
});

describe("piediciStergereAngajat", () => {
  it("numără contractele ACTIVE și subordonații DIRECȚI, în organizație", async () => {
    db.raspunde("employment_contracts", "select", { count: 2 });
    db.raspunde("employees", "select", { count: null });
    const r = await piediciStergereAngajat(ORG_ID, ID_1, true);
    expect(r).toEqual({ contracteActive: 2, subordonatiDirecti: 0, esteFisaProprie: true });
    const [contracte] = db.apeluriPe("employment_contracts");
    expect(areFiltru(contracte, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(contracte, "eq", "organization_id", ORG_ID)).toBe(true);
    const [subordonati] = db.apeluriPe("employees");
    expect(areFiltru(subordonati, "eq", "manager_employee_id", ID_1)).toBe(true);
    expect(areFiltru(subordonati, "contains", "manager_path")).toBe(false);
  });
});

describe("lantulDeManageri", () => {
  it("doar angajatul în lanț: listă goală, fără interogare", async () => {
    expect(await lantulDeManageri(ORG_ID, [ID_1], ID_1)).toEqual([]);
    expect(db.apeluri).toHaveLength(0);
  });

  it("ordinea urmează `manager_path` (vârf → șef direct), nu ordinea din bază; lipsurile dispar", async () => {
    db.raspunde("employees", "select", {
      data: [
        { id: ID_3, full_name: "Șef direct", marca: "3", user_id: null, functie: null },
        { id: ID_2, full_name: "Director", marca: "2", user_id: null, functie: "Director" },
      ],
    });
    const lant = await lantulDeManageri(ORG_ID, [ID_2, "lipsa", ID_3, ID_1], ID_1);
    expect(lant.map((v) => v.id)).toEqual([ID_2, ID_3]);
    expect(lant[0]).not.toHaveProperty("user_id");
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "in", "id", [ID_2, "lipsa", ID_3])).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });
});

describe("arboreleManagerial", () => {
  const nod = (id: string, manager: string | null) => ({
    id,
    full_name: id,
    marca: id,
    manager_employee_id: manager,
    user_id: null,
    department: null,
    functie: null,
  });

  it("scope `all`: toți angajații ACTIVI ai organizației, ordonați după nume, fără restrângere", async () => {
    db.raspunde("employees", "select", { data: [nod(ID_1, null), nod(ID_2, ID_1)] });
    const r = await arboreleManagerial(ORG_ID, "all", null);
    expect(r.map((n) => n.id)).toEqual([ID_1, ID_2]);
    expect(r[0]?.avatar_url).toBeNull();
    const [apel, ...altele] = db.apeluri;
    expect(altele).toHaveLength(0);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "full_name")).toBe(true);
    expect(areFiltru(apel, "contains", "manager_path")).toBe(false);
  });

  it("scope `team`: doar subarborele propriei fișe", async () => {
    db.raspunde("employees", "select", { data: [nod(ID_2, null)] });
    await arboreleManagerial(ORG_ID, "team", ID_2);
    expect(areFiltru(db.apeluri[0], "contains", "manager_path", [ID_2])).toBe(true);
  });

  it("scope `own`: propriul lanț de șefi (fără sine) plus propriul subarbore, ascendenții primii", async () => {
    db.raspunde("employees", "select", { data: { manager_path: [ID_1, ID_2, ID_3] } });
    db.raspunde("employees", "select", { data: [nod(ID_3, ID_2)] });
    db.raspunde("employees", "select", { data: [nod(ID_1, null), nod(ID_2, ID_1)] });

    const r = await arboreleManagerial(ORG_ID, "own", ID_3);

    expect(r.map((n) => n.id)).toEqual([ID_1, ID_2, ID_3]);
    const [proprie, subarbore, ascendenti] = db.apeluri;
    expect(areFiltru(proprie, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(subarbore, "contains", "manager_path", [ID_3])).toBe(true);
    expect(areFiltru(subarbore, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(subarbore, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(subarbore, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(ascendenti, "in", "id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(ascendenti, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(ascendenti, "is", "deleted_at", null)).toBe(true);
  });

  it("scope `own` la vârful ierarhiei: fără interogarea ascendenților", async () => {
    db.raspunde("employees", "select", { data: { manager_path: [ID_3] } });
    db.raspunde("employees", "select", { data: [nod(ID_3, null)] });
    const r = await arboreleManagerial(ORG_ID, "own", ID_3);
    expect(r.map((n) => n.id)).toEqual([ID_3]);
    expect(db.apeluri).toHaveLength(2);
  });

  it("scope `team` fără fișă proprie întoarce mulțimea vidă fără să interogheze organizația", async () => {
    db.raspunde("employees", "select", { data: [nod(ID_1, null)] });
    const r = await arboreleManagerial(ORG_ID, "team", null);
    expect(r).toEqual([]);
    expect(db.apeluri).toHaveLength(0);
  });
});

describe("citirile simple ale fișei", () => {
  it("citesteAngajatPentruEditare: id + organizație + nesters", async () => {
    db.raspunde("employees", "select", { data: { id: ID_1 } });
    expect(await citesteAngajatPentruEditare(ORG_ID, ID_1)).toEqual({ id: ID_1 });
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.coloane).toContain("manager_employee_id");
    expect(apel?.coloane).not.toMatch(/\bnume\b/u);
  });

  it("colegiPentruManager: fără fișa editată, doar stările cu om prezent, plafonat explicit", async () => {
    db.raspunde("employees", "select", { data: null });
    expect(await colegiPentruManager(ORG_ID, ID_1)).toEqual([]);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "neq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["candidat", "activ", "suspendat", "preaviz"])).toBe(
      true,
    );
    expect(apel?.filtre.find((f) => f.metoda === "limit")?.argumente[0]).toBe(500);
  });

  it("angajatiPentruPontaj: aceleași stări, dar FĂRĂ excludere (patronul e în listă)", async () => {
    db.raspunde("employees", "select", { data: [{ id: ID_1, full_name: "A", marca: "1" }] });
    expect(await angajatiPentruPontaj(ORG_ID)).toHaveLength(1);
    expect(areFiltru(db.apeluri[0], "neq", "id")).toBe(false);
    expect(areFiltru(db.apeluri[0], "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("citesteRezumatDateSensibile: doar coloanele mascate", async () => {
    db.raspunde("employee_sensitive_data", "select", { data: null });
    expect(await citesteRezumatDateSensibile(ORG_ID, ID_1)).toBeNull();
    const [apel] = db.apeluri;
    expect(apel?.coloane).toBe("cnp_last4, iban_last4, banca");
    expect(areFiltru(apel, "eq", "employee_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it.each([
    ["citesteScutiriFiscale", "employee_tax_exemptions", citesteScutiriFiscale],
    ["citesteComponenteSalariale", "salary_components", citesteComponenteSalariale],
  ] as const)(
    "%s: ale angajatului, nesterse, cele mai noi primele; gol ⇒ []",
    async (_n, tabela, functie) => {
      db.raspunde(tabela, "select", { data: null });
      expect(await functie(ORG_ID, ID_1)).toEqual([]);
      const [apel] = db.apeluri;
      expect(areFiltru(apel, "eq", "employee_id", ID_1)).toBe(true);
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(apel, "order", "valabil_de_la", { ascending: false })).toBe(true);
    },
  );

  it("functiiFolosite: denumirile distincte, doar cele completate", async () => {
    db.raspunde("employees", "select", {
      data: [{ functie: "Sudor" }, { functie: "Sudor" }, { functie: "Lăcătuș" }],
    });
    expect(await functiiFolosite(ORG_ID)).toEqual(["Sudor", "Lăcătuș"]);
    expect(areFiltru(db.apeluri[0], "not", "functie", "is")).toBe(true);
    expect(areFiltru(db.apeluri[0], "is", "deleted_at", null)).toBe(true);
  });

  it("o eroare a bazei nu se transformă în listă goală", async () => {
    db.raspunde("employees", "select", { error: eroarePostgrest("42703") });
    await expect(functiiFolosite(ORG_ID)).rejects.toMatchObject({ code: "42703" });
  });
});
