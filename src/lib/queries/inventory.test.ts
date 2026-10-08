// src/lib/queries/inventory.test.ts
//
// Citirile inventarului: lista cu paginare keyset și numărătoare separată,
// deținătorii curenți, istoricul, „ce am eu în primire" și rezumatul
// registrului (contoare pe stare + suma valorilor în felii de 1000, în bani
// întregi). Clientul vine din falsul strict din `@/lib/teste/actiune`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import {
  areFiltru,
  eroarePostgrest,
  type ApelFals,
  type ClientFals,
} from "@/lib/teste/supabase-fals";
import type { FiltreInventar } from "@/schemas/inventory";
import { codificaCursor, decodificaCursor } from "./cursor";
import {
  alocariDeschise,
  angajatiActivi,
  categorii,
  citesteObiect,
  inPrimireaMea,
  istoricAlocari,
  listeazaObiecte,
  numeleAngajatilor,
  rezumatInventar,
} from "./inventory";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

const limita = (apel: ApelFals | undefined): unknown =>
  apel?.filtre.find((f) => f.metoda === "limit")?.argumente[0];

const predicatOr = (apel: ApelFals | undefined): string | undefined => {
  const f = apel?.filtre.find((x) => x.metoda === "or");
  return f === undefined ? undefined : String(f.argumente[0]);
};

const [lista, numarare] = [0, 1];

const filtre = (m: Partial<FiltreInventar> = {}): FiltreInventar => ({
  q: null,
  numar: null,
  angajat: null,
  status: null,
  stare: null,
  category_id: null,
  cursor: null,
  limita: 2,
  sort: null,
  ...m,
});

const obiect = (id: string, denumire: string, numar: string) => ({
  id,
  denumire,
  numar_inventar: numar,
  serie: null,
  model: null,
  producator: null,
  category_id: null,
  status: "in_stoc",
  stare: "bun",
  locatie: null,
  valoare: null,
  data_achizitie: null,
  garantie_expira: null,
});

describe("listeazaObiecte", () => {
  it("prima pagină: organizație pe ambele interogări, cursor pe denumirea ultimului rând", async () => {
    db.raspunde("inventory_items", "select", {
      data: [
        obiect(ID_1, "Birou", "INV-1"),
        obiect(ID_2, "Laptop", "INV-2"),
        obiect(ID_3, "Monitor", "INV-3"),
      ],
    });
    db.raspunde("inventory_items", "select", { count: 11 });

    const r = await listeazaObiecte(ORG_ID, filtre());

    expect(r.randuri.map((o) => o.id)).toEqual([ID_1, ID_2]);
    expect(r.total).toBe(11);
    expect(r.sortare).toEqual({ cheie: "denumire", directie: "asc" });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "Laptop", id: ID_2 });
    for (const i of [lista, numarare]) {
      expect(areFiltru(db.apeluri[i], "eq", "organization_id", ORG_ID)).toBe(true);
    }
    expect(limita(db.apeluri[lista])).toBe(3);
    expect(areFiltru(db.apeluri[lista], "order", "id", { ascending: true })).toBe(true);
    expect(db.apeluri[numarare]?.optiuni).toEqual({ count: "exact", head: true });
  });

  it("toate filtrele pe amândouă interogările; textul liber prin `ilike`, nu prin `or`", async () => {
    db.raspunde("inventory_items", "select", { data: [] });
    db.raspunde("inventory_items", "select", { count: 0 });

    await listeazaObiecte(
      ORG_ID,
      filtre({ status: "alocat", stare: "uzat", category_id: ID_3, q: "lap", numar: "LT" }),
    );

    for (const i of [lista, numarare]) {
      const apel = db.apeluri[i];
      expect(areFiltru(apel, "eq", "status", "alocat")).toBe(true);
      expect(areFiltru(apel, "eq", "stare", "uzat")).toBe(true);
      expect(areFiltru(apel, "eq", "category_id", ID_3)).toBe(true);
      expect(areFiltru(apel, "ilike", "denumire", "%lap%")).toBe(true);
      expect(areFiltru(apel, "ilike", "numar_inventar", "%LT%")).toBe(true);
      expect(predicatOr(apel)).toBeUndefined();
    }
  });

  it("cu cursor și sortare descrescătoare după număr: predicatul doar pe listă", async () => {
    db.raspunde("inventory_items", "select", { data: [obiect(ID_3, "Monitor", "INV-1")] });
    db.raspunde("inventory_items", "select", { count: 3 });
    const cursor = codificaCursor({ valoare: "INV-2", id: ID_2 });

    const r = await listeazaObiecte(ORG_ID, filtre({ cursor, sort: "-numar" }));

    expect(r.sortare).toEqual({ cheie: "numar", directie: "desc" });
    expect(r.urmatorulCursor).toBeNull();
    expect(predicatOr(db.apeluri[lista])).toBe(
      `numar_inventar.lt."INV-2",and(numar_inventar.eq."INV-2",id.lt."${ID_2}")`,
    );
    expect(predicatOr(db.apeluri[numarare])).toBeUndefined();
  });

  it("următoarea pagină după număr poartă numărul de inventar în cursor", async () => {
    db.raspunde("inventory_items", "select", {
      data: [obiect(ID_1, "Z", "INV-9"), obiect(ID_2, "Y", "INV-8"), obiect(ID_3, "X", "INV-7")],
    });
    db.raspunde("inventory_items", "select", { count: 3 });
    const r = await listeazaObiecte(ORG_ID, filtre({ sort: "numar" }));
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "INV-8", id: ID_2 });
  });

  it("eroarea numărătorii se propagă", async () => {
    db.raspunde("inventory_items", "select", { data: [] });
    const eroare = eroarePostgrest("57014");
    db.raspunde("inventory_items", "select", { error: eroare });
    await expect(listeazaObiecte(ORG_ID, filtre())).rejects.toBe(eroare);
  });
});

describe("angajații", () => {
  it("activi, vii, ai organizației, cu limită explicită sub `max_rows`", async () => {
    db.raspunde("employees", "select", { data: [{ id: ID_1, full_name: "Ana", marca: "1" }] });
    expect(await angajatiActivi(ORG_ID)).toHaveLength(1);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(limita(apel)).toBe(500);
  });

  it("numele după id: deduplicate, pe organizație; listă goală fără bază", async () => {
    expect((await numeleAngajatilor(ORG_ID, [])).size).toBe(0);
    expect(db.apeluri).toHaveLength(0);

    db.raspunde("employees", "select", { data: [{ id: ID_1, full_name: "Ana", marca: "1" }] });
    const r = await numeleAngajatilor(ORG_ID, [ID_1, ID_1]);
    expect(r.get(ID_1)?.marca).toBe("1");
    expect(areFiltru(db.apeluri[0], "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(db.apeluri[0], "in", "id", [ID_1])).toBe(true);
  });
});

describe("alocariDeschise", () => {
  it("deținătorul curent al fiecărui obiect, cu numele rezolvat separat", async () => {
    db.raspunde("inventory_allocations", "select", {
      data: [
        {
          id: "a1",
          item_id: ID_1,
          employee_id: ID_3,
          predat_la: "2026-09-01T07:00:00Z",
          confirmat_de_angajat_la: null,
        },
      ],
    });
    db.raspunde("employees", "select", {
      data: [{ id: ID_3, full_name: "Ion", marca: "M-3", deleted_at: null }],
    });

    const r = await alocariDeschise(ORG_ID, [ID_1, ID_2]);

    expect(r.get(ID_1)).toEqual({
      id: "a1",
      itemId: ID_1,
      employeeId: ID_3,
      angajatNume: "Ion",
      angajat: { id: ID_3, deleted_at: null },
      angajatMarca: "M-3",
      predatLa: "2026-09-01T07:00:00Z",
      confirmatDeAngajatLa: null,
    });
    expect(r.has(ID_2)).toBe(false);
    const [alocari] = db.apeluriPe("inventory_allocations");
    expect(areFiltru(alocari, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(alocari, "in", "item_id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(alocari, "is", "returnat_la", null)).toBe(true);
    expect(areFiltru(alocari, "is", "deleted_at", null)).toBe(true);
  });

  it("deținător invizibil: numele și marca rămân null, fără să cadă", async () => {
    db.raspunde("inventory_allocations", "select", {
      data: [
        {
          id: "a1",
          item_id: ID_1,
          employee_id: ID_3,
          predat_la: "2026-09-01T07:00:00Z",
          confirmat_de_angajat_la: null,
        },
      ],
    });
    db.raspunde("employees", "select", { data: [] });
    const r = await alocariDeschise(ORG_ID, [ID_1]);
    expect(r.get(ID_1)).toMatchObject({ angajatNume: null, angajatMarca: null });
  });

  it("fără alocări deschise nu mai caută angajații; fără obiecte nu atinge baza", async () => {
    expect((await alocariDeschise(ORG_ID, [])).size).toBe(0);
    expect(db.apeluri).toHaveLength(0);

    db.raspunde("inventory_allocations", "select", { data: [] });
    expect((await alocariDeschise(ORG_ID, [ID_1])).size).toBe(0);
    expect(db.apeluriPe("employees")).toHaveLength(0);
  });
});

describe("fișa obiectului", () => {
  it("citesteObiect: pe id + organizație; absent ⇒ null", async () => {
    db.raspunde("inventory_items", "select", { data: null });
    expect(await citesteObiect(ORG_ID, ID_1)).toBeNull();
    expect(areFiltru(db.apeluri[0], "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(db.apeluri[0], "eq", "id", ID_1)).toBe(true);
  });

  it("istoricul: predările vii ale obiectului, cele mai noi primele", async () => {
    db.raspunde("inventory_allocations", "select", { data: [{ id: "a1" }] });
    expect(await istoricAlocari(ORG_ID, ID_1)).toHaveLength(1);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "item_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "predat_la", { ascending: false })).toBe(true);
  });

  it("categoriile: fără filtru de organizație (cele de platformă au NULL), doar active", async () => {
    db.raspunde("inventory_categories", "select", { data: null });
    expect(await categorii()).toEqual([]);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id")).toBe(false);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });
});

describe("inPrimireaMea", () => {
  it("cu fișa proprie dată (scope team/all): filtrează explicit pe ea", async () => {
    db.raspunde("inventory_allocations", "select", { data: [{ id: "a1" }] });
    expect(await inPrimireaMea(ORG_ID, ID_3)).toHaveLength(1);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "returnat_la", null)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id", ID_3)).toBe(true);
  });

  it("fără fișă (scope own): se bazează pe RLS, fără filtru de angajat", async () => {
    db.raspunde("inventory_allocations", "select", { data: null });
    expect(await inPrimireaMea(ORG_ID, null)).toEqual([]);
    expect(areFiltru(db.apeluri[0], "eq", "employee_id")).toBe(false);
  });
});

describe("rezumatInventar", () => {
  /** Răspunsurile, în ordinea în care pornesc: patru contoare, apoi feliile sumei. */
  const raspundeContoare = (contoare: readonly (number | null)[]) => {
    for (const count of contoare) db.raspunde("inventory_items", "select", { count });
  };

  it("contoarele pe fiecare stare și suma valorilor, fără casate, adunată în bani", async () => {
    raspundeContoare([4, 3, 1, null]);
    db.raspunde("inventory_items", "select", {
      data: [
        { id: ID_1, valoare: 0.1 },
        { id: ID_2, valoare: 0.2 },
        { id: ID_3, valoare: null },
      ],
    });

    const r = await rezumatInventar(ORG_ID);

    // Fără aritmetică în bani, 0,1 + 0,2 ar da 0,30000000000000004.
    expect(r).toEqual({ inStoc: 4, alocate: 3, inReparatie: 1, casate: 0, valoareTotala: 0.3 });

    const apeluri = db.apeluriPe("inventory_items");
    const statusuri = apeluri
      .slice(0, 4)
      .map(
        (a) => a.filtre.find((f) => f.metoda === "eq" && f.argumente[0] === "status")?.argumente[1],
      );
    expect(statusuri).toEqual(["in_stoc", "alocat", "in_reparatie", "casat"]);
    for (const a of apeluri) {
      expect(areFiltru(a, "eq", "organization_id", ORG_ID)).toBe(true);
    }
    const suma = apeluri[4];
    expect(areFiltru(suma, "neq", "status", "casat")).toBe(true);
    expect(areFiltru(suma, "order", "id")).toBe(true);
    expect(limita(suma)).toBe(1000);
    expect(areFiltru(suma, "gt", "id")).toBe(false);
  });

  it("peste 1000 de obiecte: a doua felie continuă după ultimul id, nimic nu se pierde", async () => {
    raspundeContoare([0, 0, 0, 0]);
    const felie = Array.from({ length: 1000 }, (_, i) => ({
      id: `id-${String(i).padStart(4, "0")}`,
      valoare: 1,
    }));
    db.raspunde("inventory_items", "select", { data: felie });
    db.raspunde("inventory_items", "select", { data: [{ id: "id-1000", valoare: 2.5 }] });

    const r = await rezumatInventar(ORG_ID);

    expect(r.valoareTotala).toBe(1002.5);
    const felii = db.apeluriPe("inventory_items").slice(4);
    expect(felii).toHaveLength(2);
    expect(areFiltru(felii[1], "gt", "id", "id-0999")).toBe(true);
  });

  it("eroarea unui contor se propagă", async () => {
    const eroare = eroarePostgrest("42501");
    db.raspunde("inventory_items", "select", { error: eroare });
    raspundeContoare([0, 0, 0]);
    db.raspunde("inventory_items", "select", { data: [] });
    await expect(rezumatInventar(ORG_ID)).rejects.toBe(eroare);
  });
});
