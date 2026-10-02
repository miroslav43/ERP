// src/lib/queries/checklist.test.ts
//
// Citirile modulului de integrare. Scope-ul (own/team/all) îl aplică RLS, nu
// codul — deci aici se verifică ce ține de cod: filtrul de organizație și de
// ștergere logică, paginarea keyset cu numărătoarea separată, agregarea
// progresului și capcanele tăcute (42703 pe tabela fără `deleted_at`).

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { filtreInstanteSchema, filtreSabloaneSchema } from "@/schemas/checklist";

import {
  angajatiActivi,
  angajatiDupaId,
  bunuriNereturnate,
  citesteInstanta,
  citesteSablon,
  dovadaParcurgerii,
  etapeleSablonului,
  listeazaInstante,
  listeazaSabloane,
  pasiiInstantei,
  pasiiSablonului,
  progresInstante,
  sabloaneActive,
  sarcinileMele,
} from "./checklist";
import { codificaCursor, predicatKeyset } from "./cursor";

function fals(): ClientFals {
  return configureazaActiunea().server;
}

/** Un id deterministic, valid ca UUID, pentru rândul `i`. */
function idRand(i: number): string {
  return `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
}

function instanta(i: number, camp: Record<string, unknown> = {}) {
  return {
    id: idRand(i),
    template_id: ID_1,
    employee_id: ID_2,
    tip: "onboarding",
    data_referinta: `2026-09-${String(30 - i).padStart(2, "0")}`,
    status: "in_curs",
    ciclu: 1,
    finalizata_la: null,
    anulata_la: null,
    created_at: "2026-09-01T00:00:00Z",
    ...camp,
  };
}

// ── listeazaInstante ───────────────────────────────────────────────────────

describe("listeazaInstante", () => {
  const implicit = filtreInstanteSchema.parse({});

  it("lista și numărătoarea poartă ACELEAȘI filtre de mulțime, inclusiv organizația", async () => {
    const server = fals();
    server.raspunde("checklist_instances", "select", { data: [] });
    server.raspunde("checklist_instances", "select", { count: 0 });

    await listeazaInstante(ORG_ID, {
      ...implicit,
      tip: "offboarding",
      status: ["in_curs", "finalizata"],
      angajat: ID_2,
      de_la: "2026-01-01",
      pana_la: "2026-12-31",
    });

    const [lista, numarare] = server.apeluriPe("checklist_instances");
    for (const apel of [lista, numarare]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(apel, "eq", "tip", "offboarding")).toBe(true);
      expect(areFiltru(apel, "in", "status", ["in_curs", "finalizata"])).toBe(true);
      expect(areFiltru(apel, "eq", "employee_id", ID_2)).toBe(true);
      expect(areFiltru(apel, "gte", "data_referinta", "2026-01-01")).toBe(true);
      expect(areFiltru(apel, "lte", "data_referinta", "2026-12-31")).toBe(true);
    }
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
  });

  it("filtrele goale nu adaugă condiții", async () => {
    const server = fals();
    server.raspunde("checklist_instances", "select", { data: [] });
    server.raspunde("checklist_instances", "select", { count: 0 });
    await listeazaInstante(ORG_ID, implicit);
    const [lista] = server.apeluriPe("checklist_instances");
    for (const col of ["tip", "employee_id"]) expect(areFiltru(lista, "eq", col)).toBe(false);
    expect(areFiltru(lista, "in", "status")).toBe(false);
    expect(areFiltru(lista, "gte", "data_referinta")).toBe(false);
  });

  it("implicit: cea mai recentă dată prima, id-ul al doilea criteriu, limita + 1", async () => {
    const server = fals();
    server.raspunde("checklist_instances", "select", { data: [] });
    server.raspunde("checklist_instances", "select", { count: 0 });

    const r = await listeazaInstante(ORG_ID, { ...implicit, limita: 10 });

    const [lista, numarare] = server.apeluriPe("checklist_instances");
    expect(
      areFiltru(lista, "order", "data_referinta", { ascending: false, nullsFirst: false }),
    ).toBe(true);
    expect(areFiltru(lista, "order", "id", { ascending: false })).toBe(true);
    expect(lista?.filtre).toContainEqual({ metoda: "limit", argumente: [11] });
    // Paginarea aparține paginii, nu mulțimii: numărătoarea n-o poartă.
    expect(numarare?.filtre.some((f) => ["order", "limit", "or"].includes(f.metoda))).toBe(false);
    expect(r.sortare).toEqual({ cheie: "data", directie: "desc" });
    expect(r).toMatchObject({ randuri: [], urmatorulCursor: null, total: 0 });
  });

  it("o sortare necunoscută din URL cade tăcut pe implicit", async () => {
    const server = fals();
    server.raspunde("checklist_instances", "select", { data: [] });
    server.raspunde("checklist_instances", "select", { count: 0 });
    const r = await listeazaInstante(ORG_ID, { ...implicit, sort: "-cnp" });
    expect(r.sortare).toEqual({ cheie: "data", directie: "desc" });
    expect(areFiltru(server.apeluri[0], "order", "cnp")).toBe(false);
  });

  it("pagină plină (limita + 1 rânduri): taie ultimul și emite cursorul pe ultimul AFIȘAT", async () => {
    const server = fals();
    const randuri = [1, 2, 3, 4, 5, 6].map((i) => instanta(i));
    server.raspunde("checklist_instances", "select", { data: randuri });
    server.raspunde("checklist_instances", "select", { count: 42 });

    const r = await listeazaInstante(ORG_ID, { ...implicit, limita: 5 });

    expect(r.randuri.map((x) => x.id)).toEqual([1, 2, 3, 4, 5].map(idRand));
    expect(r.urmatorulCursor).toBe(
      codificaCursor({ valoare: randuri[4]?.data_referinta ?? "", id: idRand(5) }),
    );
    expect(r.total).toBe(42);
  });

  it("ultima pagină (sub limită): fără cursor", async () => {
    const server = fals();
    server.raspunde("checklist_instances", "select", { data: [instanta(1), instanta(2)] });
    server.raspunde("checklist_instances", "select", { count: 2 });
    const r = await listeazaInstante(ORG_ID, { ...implicit, limita: 5 });
    expect(r.randuri).toHaveLength(2);
    expect(r.urmatorulCursor).toBeNull();
  });

  it.each([
    ["tip", "tip", "transfer"],
    ["-stare", "status", "anulata"],
  ] as const)("sortarea `%s`: cursorul poartă valoarea coloanei `%s`", async (sort, col, val) => {
    const server = fals();
    const randuri = [1, 2, 3, 4, 5, 6].map((i) => instanta(i, { [col]: val }));
    server.raspunde("checklist_instances", "select", { data: randuri });
    server.raspunde("checklist_instances", "select", { count: 6 });
    const r = await listeazaInstante(ORG_ID, { ...implicit, limita: 5, sort });
    expect(r.urmatorulCursor).toBe(codificaCursor({ valoare: val, id: idRand(5) }));
    expect(areFiltru(server.apeluri[0], "order", col)).toBe(true);
  });

  it("cu cursor: predicatul keyset doar pe listă, în direcția sortării", async () => {
    const server = fals();
    server.raspunde("checklist_instances", "select", { data: [] });
    server.raspunde("checklist_instances", "select", { count: 9 });
    const cursor = { valoare: "2026-09-10", id: ID_3 };

    const r = await listeazaInstante(ORG_ID, { ...implicit, cursor: codificaCursor(cursor) });

    const [lista, numarare] = server.apeluriPe("checklist_instances");
    expect(lista?.filtre.find((f) => f.metoda === "or")?.argumente[0]).toBe(
      predicatKeyset("data_referinta", cursor, "desc"),
    );
    expect(numarare?.filtre.some((f) => f.metoda === "or")).toBe(false);
    // Totalul nu scade de la o pagină la alta.
    expect(r.total).toBe(9);
  });

  it("cursor stricat: prima pagină, nu eroare", async () => {
    const server = fals();
    server.raspunde("checklist_instances", "select", { data: [] });
    server.raspunde("checklist_instances", "select", { count: 0 });
    await listeazaInstante(ORG_ID, { ...implicit, cursor: "%%nu-e-cursor" });
    expect(server.apeluri[0]?.filtre.some((f) => f.metoda === "or")).toBe(false);
  });

  it("numărătoarea fără `count`: totalul cade pe rândurile afișate", async () => {
    const server = fals();
    server.raspunde("checklist_instances", "select", { data: [instanta(1)] });
    server.raspunde("checklist_instances", "select", { count: null });
    const r = await listeazaInstante(ORG_ID, implicit);
    expect(r.total).toBe(1);
  });

  it.each([
    ["lista", 0],
    ["numărătoarea", 1],
  ])("eroare pe %s: se propagă, nu se înghite ca listă goală", async (_caz, care) => {
    const server = fals();
    const eroare = eroarePostgrest("42P01");
    server.raspunde("checklist_instances", "select", care === 0 ? { error: eroare } : { data: [] });
    server.raspunde("checklist_instances", "select", care === 1 ? { error: eroare } : { count: 0 });
    await expect(listeazaInstante(ORG_ID, implicit)).rejects.toBe(eroare);
  });
});

// ── Citiri punctuale ───────────────────────────────────────────────────────

describe("citesteInstanta / citesteSablon", () => {
  it.each([
    ["citesteInstanta", citesteInstanta, "checklist_instances"],
    ["citesteSablon", citesteSablon, "checklist_templates"],
  ] as const)("%s: id + organizație + nesters, un singur rând", async (_n, fn, tabela) => {
    const server = fals();
    server.raspunde(tabela, "select", { data: { id: ID_1 } });
    expect(await fn(ORG_ID, ID_1)).toEqual({ id: ID_1 });
    const [apel] = server.apeluriPe(tabela);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("inexistentă: null, nu eroare", async () => {
    const server = fals();
    server.raspunde("checklist_instances", "select", { data: null });
    expect(await citesteInstanta(ORG_ID, ID_1)).toBeNull();
  });

  it("eroarea bazei se propagă", async () => {
    const server = fals();
    const eroare = eroarePostgrest("42501");
    server.raspunde("checklist_templates", "select", { error: eroare });
    await expect(citesteSablon(ORG_ID, ID_1)).rejects.toBe(eroare);
  });
});

describe("dovadaParcurgerii", () => {
  it("NU filtrează pe `deleted_at` (coloana nu există: 42703) — capcana #12", async () => {
    const server = fals();
    server.raspunde("checklist_completion_records", "select", { data: { id: ID_3 } });
    expect(await dovadaParcurgerii(ORG_ID, ID_1)).toEqual({ id: ID_3 });
    const [apel] = server.apeluriPe("checklist_completion_records");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "instance_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at")).toBe(false);
    expect(apel?.coloane).toContain("continut_checksum");
  });
});

// ── progresInstante ────────────────────────────────────────────────────────

describe("progresInstante", () => {
  it("lista goală de instanțe: nicio interogare", async () => {
    const server = fals();
    expect((await progresInstante([])).size).toBe(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("numără „gata” = bifat + neaplicabil (`în lucru` NU), cu procent rotunjit", async () => {
    const server = fals();
    server.raspunde("checklist_instance_items", "select", {
      data: [
        { instance_id: ID_1, status: "bifat", obligatoriu: true },
        { instance_id: ID_1, status: "neaplicabil", obligatoriu: false },
        { instance_id: ID_1, status: "in_lucru", obligatoriu: true },
        { instance_id: ID_2, status: "de_facut", obligatoriu: true },
        { instance_id: ID_2, status: "de_facut", obligatoriu: true },
        { instance_id: ID_2, status: "bifat", obligatoriu: true },
      ],
    });

    const progres = await progresInstante([ID_1, ID_2, ID_1]);

    expect(progres.get(ID_1)).toEqual({ total: 3, gata: 2, procent: 67 });
    expect(progres.get(ID_2)).toEqual({ total: 3, gata: 1, procent: 33 });
    const [apel] = server.apeluriPe("checklist_instance_items");
    // Id-urile se deduplică înainte de `in`.
    expect(areFiltru(apel, "in", "instance_id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "range", argumente: [0, 999] });
  });

  it("o instanță fără pași nu apare în hartă (nu un 0% inventat)", async () => {
    const server = fals();
    server.raspunde("checklist_instance_items", "select", { data: [] });
    const progres = await progresInstante([ID_3]);
    expect(progres.has(ID_3)).toBe(false);
  });

  it("peste 1000 de pași citește pagina următoare, nu se oprește tăcut la plafon", async () => {
    const server = fals();
    const plina = Array.from({ length: 1000 }, () => ({
      instance_id: ID_1,
      status: "bifat",
      obligatoriu: true,
    }));
    server.raspunde("checklist_instance_items", "select", { data: plina });
    server.raspunde("checklist_instance_items", "select", {
      data: [{ instance_id: ID_1, status: "de_facut", obligatoriu: true }],
    });

    const progres = await progresInstante([ID_1]);

    expect(progres.get(ID_1)).toEqual({ total: 1001, gata: 1000, procent: 100 });
    const [, aDoua] = server.apeluriPe("checklist_instance_items");
    expect(aDoua?.filtre).toContainEqual({ metoda: "range", argumente: [1000, 1999] });
  });

  /** Programează 11 pagini pline: una peste plafonul de 10. */
  function paginiPestePlafon(server: ClientFals): void {
    const plina = Array.from({ length: 1000 }, () => ({
      instance_id: ID_1,
      status: "de_facut",
      obligatoriu: true,
    }));
    for (let i = 0; i < 11; i += 1) {
      server.raspunde("checklist_instance_items", "select", { data: plina });
    }
  }

  it("plafonul de 10 pagini oprește bucla: a 11-a pagină nu se mai cere", async () => {
    const server = fals();
    paginiPestePlafon(server);
    // Rezultatul nu contează aici (azi o hartă trunchiată, după reparare o
    // eroare) — doar faptul că bucla nu continuă.
    await progresInstante([ID_1]).catch(() => undefined);
    expect(server.apeluriPe("checklist_instance_items")).toHaveLength(10);
  });

  it.fails(
    "DEFECT: peste plafonul de pagini, progresul se semnalează, nu se trunchiază tăcut",
    async () => {
      // Azi: a zecea pagină plină iese din buclă fără niciun semnal, iar harta
      // spune total = 10000 — un procent greșit, prezentat ca adevărat. Regula
      // proiectului (`citesteTot`): la plafon se ARUNCĂ, nu se trunchiază.
      const server = fals();
      paginiPestePlafon(server);
      await expect(progresInstante([ID_1])).rejects.toThrow();
    },
  );

  it.fails(
    "DEFECT: citirea de progres se restrânge explicit la organizație, nu doar prin RLS",
    async () => {
      // Convenția din `employees.ts`: `organizationId` primul argument și
      // `.eq("organization_id", …)` pe fiecare citire. `progresInstante` nu
      // primește organizația deloc, deci filtrul nu are cum să existe.
      const server = fals();
      server.raspunde("checklist_instance_items", "select", { data: [] });
      await progresInstante([ID_1]);
      const [apel] = server.apeluriPe("checklist_instance_items");
      expect(
        apel?.filtre.some((f) => f.metoda === "eq" && f.argumente[0] === "organization_id"),
      ).toBe(true);
    },
  );
});

// ── Pașii, etapele, bunurile ───────────────────────────────────────────────

describe("pasiiInstantei", () => {
  it("pașii vii ai instanței, cu etapa întâi (fără etapă în cap) și apoi ordinea", async () => {
    const server = fals();
    server.raspunde("checklist_instance_items", "select", { data: [{ id: ID_3 }] });
    expect(await pasiiInstantei(ORG_ID, ID_1)).toEqual([{ id: ID_3 }]);
    const [apel] = server.apeluriPe("checklist_instance_items");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "instance_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    const ordini = apel?.filtre.filter((f) => f.metoda === "order").map((f) => f.argumente);
    expect(ordini).toEqual([
      ["etapa_ordine", { ascending: true, nullsFirst: true }],
      ["ordine", { ascending: true }],
    ]);
    expect(apel?.coloane).toContain("material:course_materials!");
  });

  it("`data` null devine listă goală", async () => {
    const server = fals();
    server.raspunde("checklist_instance_items", "select", { data: null });
    expect(await pasiiInstantei(ORG_ID, ID_1)).toEqual([]);
  });
});

describe("pasiiSablonului / etapeleSablonului", () => {
  it.each([
    ["pasiiSablonului", pasiiSablonului, "checklist_template_items"],
    ["etapeleSablonului", etapeleSablonului, "checklist_template_stages"],
  ] as const)("%s: șablonul cerut, organizația, nesterse, după ordine", async (_n, fn, tabela) => {
    const server = fals();
    server.raspunde(tabela, "select", { data: null });
    expect(await fn(ORG_ID, ID_1)).toEqual([]);
    const [apel] = server.apeluriPe(tabela);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "template_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "ordine", { ascending: true })).toBe(true);
  });
});

describe("bunuriNereturnate", () => {
  it("doar alocările nereturnate și nesterse ale angajatului", async () => {
    const server = fals();
    const bun = { id: ID_3, predat_la: "2026-01-01", item: { id: ID_1 } };
    server.raspunde("inventory_allocations", "select", { data: [bun] });
    expect(await bunuriNereturnate(ORG_ID, ID_2)).toEqual([bun]);
    const [apel] = server.apeluriPe("inventory_allocations");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id", ID_2)).toBe(true);
    expect(areFiltru(apel, "is", "returnat_la", null)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });
});

// ── Șabloane ───────────────────────────────────────────────────────────────

describe("listeazaSabloane", () => {
  const implicit = filtreSabloaneSchema.parse({});

  function sablon(i: number) {
    return {
      id: idRand(i),
      denumire: `Șablon ${String(i)}`,
      tip: "onboarding",
      descriere: null,
      department_id: null,
      cod_cor: null,
      activ: true,
      valabil_de_la: `2026-0${String(i)}-01`,
      valabil_pana_la: null,
    };
  }

  it("aceleași filtre pe listă și numărătoare; căutarea e pe denumire, insensibilă la majuscule", async () => {
    const server = fals();
    server.raspunde("checklist_templates", "select", { data: [] });
    server.raspunde("checklist_templates", "select", { count: 0 });
    await listeazaSabloane(ORG_ID, { ...implicit, tip: "transfer", cauta: "IT" });
    const [lista, numarare] = server.apeluriPe("checklist_templates");
    for (const apel of [lista, numarare]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(apel, "eq", "tip", "transfer")).toBe(true);
      expect(areFiltru(apel, "ilike", "denumire", "%IT%")).toBe(true);
    }
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
  });

  it("implicit: alfabetic crescător, limita + 1", async () => {
    const server = fals();
    server.raspunde("checklist_templates", "select", { data: [] });
    server.raspunde("checklist_templates", "select", { count: 0 });
    const r = await listeazaSabloane(ORG_ID, { ...implicit, limita: 5 });
    const [lista] = server.apeluriPe("checklist_templates");
    expect(areFiltru(lista, "order", "denumire", { ascending: true, nullsFirst: false })).toBe(
      true,
    );
    expect(areFiltru(lista, "order", "id", { ascending: true })).toBe(true);
    expect(lista?.filtre).toContainEqual({ metoda: "limit", argumente: [6] });
    expect(r.sortare).toEqual({ cheie: "denumire", directie: "asc" });
  });

  it.each([
    [undefined, "denumire", (s: ReturnType<typeof sablon>) => s.denumire],
    ["-valabil", "valabil_de_la", (s: ReturnType<typeof sablon>) => s.valabil_de_la],
  ] as const)(
    "sortarea %s: cursorul pe coloana `%s` a ultimului afișat",
    async (sort, col, val) => {
      const server = fals();
      const randuri = [1, 2, 3, 4, 5, 6].map(sablon);
      server.raspunde("checklist_templates", "select", { data: randuri });
      server.raspunde("checklist_templates", "select", { count: 6 });
      const r = await listeazaSabloane(ORG_ID, {
        ...implicit,
        limita: 5,
        ...(sort === undefined ? {} : { sort }),
      });
      expect(r.randuri).toHaveLength(5);
      const ultim = randuri[4];
      if (ultim === undefined) throw new Error("fixture");
      expect(r.urmatorulCursor).toBe(codificaCursor({ valoare: val(ultim), id: ultim.id }));
      expect(areFiltru(server.apeluri[0], "order", col)).toBe(true);
    },
  );

  it("cu cursor: predicatul keyset doar pe listă", async () => {
    const server = fals();
    server.raspunde("checklist_templates", "select", { data: [] });
    server.raspunde("checklist_templates", "select", { count: 3 });
    const cursor = { valoare: "Șablon 3", id: ID_3 };
    await listeazaSabloane(ORG_ID, { ...implicit, cursor: codificaCursor(cursor) });
    const [lista, numarare] = server.apeluriPe("checklist_templates");
    expect(lista?.filtre.find((f) => f.metoda === "or")?.argumente[0]).toBe(
      predicatKeyset("denumire", cursor, "asc"),
    );
    expect(numarare?.filtre.some((f) => f.metoda === "or")).toBe(false);
  });
});

describe("sabloaneActive", () => {
  it("doar cele active și nesterse, alfabetic, plafonat la 200 (fără filtru de valabilitate)", async () => {
    const server = fals();
    server.raspunde("checklist_templates", "select", { data: [{ id: ID_1 }] });
    expect(await sabloaneActive(ORG_ID)).toEqual([{ id: ID_1 }]);
    const [apel] = server.apeluriPe("checklist_templates");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [200] });
    expect(apel?.filtre.some((f) => String(f.argumente[0]).startsWith("valabil"))).toBe(false);
  });
});

// ── Angajați ───────────────────────────────────────────────────────────────

describe("angajatiDupaId", () => {
  it("lista goală: nicio interogare", async () => {
    const server = fals();
    expect((await angajatiDupaId(ORG_ID, [])).size).toBe(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("deduplică id-urile și indexează rezultatul pe id", async () => {
    const server = fals();
    server.raspunde("employees", "select", {
      data: [
        { id: ID_1, full_name: "Ana", marca: "1" },
        { id: ID_2, full_name: null, marca: "2" },
      ],
    });
    const harta = await angajatiDupaId(ORG_ID, [ID_1, ID_2, ID_1]);
    expect(harta.get(ID_2)).toEqual({ id: ID_2, full_name: null, marca: "2" });
    expect(harta.size).toBe(2);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "in", "id", [ID_1, ID_2])).toBe(true);
  });
});

describe("angajatiActivi", () => {
  it("doar fișele active și nesterse ale organizației, după nume", async () => {
    const server = fals();
    server.raspunde("employees", "select", { data: null });
    expect(await angajatiActivi(ORG_ID)).toEqual([]);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "full_name", { ascending: true })).toBe(true);
  });
});

// ── sarcinileMele ──────────────────────────────────────────────────────────

describe("sarcinileMele", () => {
  it("pașii deschiși ai parcursurilor în curs, pe rolul meu SAU pe fișa mea", async () => {
    const server = fals();
    server.raspunde("checklist_instance_items", "select", { data: [{ id: ID_3 }] });

    expect(await sarcinileMele(ORG_ID, ID_2, "hr")).toEqual([{ id: ID_3 }]);

    const [apel] = server.apeluriPe("checklist_instance_items");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["de_facut", "in_lucru"])).toBe(true);
    expect(areFiltru(apel, "eq", "checklist_instances.status", "in_curs")).toBe(true);
    expect(apel?.coloane).toContain("checklist_instances!inner(status)");
    expect(apel?.filtre.find((f) => f.metoda === "or")?.argumente[0]).toBe(
      `and(responsabil_tip.eq.rol,responsabil_rol.eq.hr),responsabil_employee_id.eq.${ID_2}`,
    );
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [200] });
  });

  it("fără fișă proprie: doar ramura pe rol, fără `responsabil_employee_id.eq.`", async () => {
    const server = fals();
    server.raspunde("checklist_instance_items", "select", { data: null });
    expect(await sarcinileMele(ORG_ID, null, "org_admin")).toEqual([]);
    expect(server.apeluri[0]?.filtre.find((f) => f.metoda === "or")?.argumente[0]).toBe(
      "and(responsabil_tip.eq.rol,responsabil_rol.eq.org_admin)",
    );
  });
});
