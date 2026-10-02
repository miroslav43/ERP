// src/lib/queries/ticketing.test.ts
//
// Citirile modulului de ticketing: lista cu paginare keyset și total numărat
// separat, căutarea liberă scăpată de jokeri, tichetele proprii cu filtru
// explicit pe solicitant, fișa și cifrele cozii.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { codificaCursor } from "./cursor";
import {
  citesteTichetul,
  LIMITA_PAGINA,
  limitaDinUrl,
  listeazaComentariile,
  listeazaIstoricul,
  listeazaObiecteleMele,
  listeazaTichete,
  listeazaTicheteleObiectului,
  managerulDirectAl,
  rezumatCoada,
  ticheteleMele,
} from "./ticketing";

const FISA = ID_2;
const DEPARTAMENT = ID_3;

let server: ClientFals;
beforeEach(() => {
  ({ server } = configureazaActiunea());
});

const argumente = (apel: ApelFals | undefined, metoda: string) =>
  apel?.filtre.filter((f) => f.metoda === metoda).map((f) => f.argumente);

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tichet = (n: number) => ({
  id: uuid(n),
  numar_afisat: `IT-2026-${String(n).padStart(5, "0")}`,
  created_at: `2026-07-${String(30 - n).padStart(2, "0")}T10:00:00Z`,
});

describe("limitaDinUrl", () => {
  it.each([
    [undefined, LIMITA_PAGINA],
    ["25", 25],
    ["50", 50],
    ["100", 100],
    [["50", "100"], 50],
    ["100000", LIMITA_PAGINA],
    ["10", LIMITA_PAGINA],
    ["", LIMITA_PAGINA],
    ["abc", LIMITA_PAGINA],
    ["50.0", 50],
    ["-25", LIMITA_PAGINA],
    [[], LIMITA_PAGINA],
  ] as const)("%o ⇒ %i", (brut, asteptat) => {
    expect(limitaDinUrl(brut as string | string[] | undefined)).toBe(asteptat);
  });
});

describe("listeazaTichete", () => {
  it("fără filtre: organizație + nesterse pe ambele interogări; lista ordonată și limitată", async () => {
    server.raspunde("tickets", "select", { data: [tichet(1)] });
    server.raspunde("tickets", "select", { count: 31 });

    const r = await listeazaTichete(ORG_ID, {});

    expect(r).toEqual({ randuri: [tichet(1)], urmatorulCursor: null, total: 31 });
    const [lista, numarare] = server.apeluriPe("tickets");
    for (const apel of [lista, numarare]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      // Filtrele absente nu ajung ca `.eq(col, undefined)`, care ar goli lista.
      expect(areFiltru(apel, "eq", "solicitant_employee_id")).toBe(false);
      expect(areFiltru(apel, "eq", "asignat_employee_id")).toBe(false);
    }
    expect(argumente(lista, "order")).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(argumente(lista, "limit")).toEqual([[LIMITA_PAGINA + 1]]);
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
    expect(argumente(numarare, "order")).toEqual([]);
  });

  it("pagină plină: taie surplusul și dă cursorul pe `created_at` + id al ultimului afișat", async () => {
    server.raspunde("tickets", "select", { data: [1, 2, 3].map(tichet) });
    server.raspunde("tickets", "select", { count: 3 });

    const r = await listeazaTichete(ORG_ID, {}, null, null, 2);

    expect(r.randuri.map((t) => t.id)).toEqual([uuid(1), uuid(2)]);
    expect(r.urmatorulCursor).toBe(codificaCursor({ valoare: tichet(2).created_at, id: uuid(2) }));
    expect(argumente(server.apeluriPe("tickets")[0], "limit")).toEqual([[3]]);
  });

  it("cursorul se aplică doar pe listă; totalul rămâne cel al tuturor paginilor", async () => {
    server.raspunde("tickets", "select", { data: [] });
    server.raspunde("tickets", "select", { count: 55 });
    const cursor = codificaCursor({ valoare: "2026-07-20T10:00:00Z", id: ID_1 });

    const r = await listeazaTichete(ORG_ID, {}, cursor);

    expect(r.total).toBe(55);
    const [lista, numarare] = server.apeluriPe("tickets");
    expect(argumente(lista, "or")).toEqual([
      [
        `created_at.lt."2026-07-20T10:00:00Z",and(created_at.eq."2026-07-20T10:00:00Z",id.lt."${ID_1}")`,
      ],
    ]);
    expect(argumente(numarare, "or")).toEqual([]);
  });

  it("cursor stricat din adresă: ignorat, prima pagină", async () => {
    server.raspunde("tickets", "select", { data: [] });
    server.raspunde("tickets", "select", { count: 0 });
    await listeazaTichete(ORG_ID, {}, "%%%");
    expect(argumente(server.apeluriPe("tickets")[0], "or")).toEqual([]);
  });

  it("filtrele din adresă și solicitantul se aplică identic pe listă și pe numărătoare", async () => {
    server.raspunde("tickets", "select", { data: [] });
    server.raspunde("tickets", "select", { count: 0 });

    await listeazaTichete(
      ORG_ID,
      {
        tip: "hardware",
        status: "in_lucru",
        prioritate: "critica",
        asignat_employee_id: ID_1,
        department_id: DEPARTAMENT,
      },
      null,
      FISA,
    );

    for (const apel of server.apeluriPe("tickets")) {
      expect(areFiltru(apel, "eq", "solicitant_employee_id", FISA)).toBe(true);
      expect(areFiltru(apel, "eq", "tip", "hardware")).toBe(true);
      expect(areFiltru(apel, "eq", "status", "in_lucru")).toBe(true);
      expect(areFiltru(apel, "eq", "prioritate", "critica")).toBe(true);
      expect(areFiltru(apel, "eq", "asignat_employee_id", ID_1)).toBe(true);
      expect(areFiltru(apel, "eq", "department_id", DEPARTAMENT)).toBe(true);
    }
  });

  it("căutarea acoperă titlul și numărul afișat, cu `%`, `_` și virgula scăpate", async () => {
    server.raspunde("tickets", "select", { data: [] });
    server.raspunde("tickets", "select", { count: 0 });

    await listeazaTichete(ORG_ID, { cauta: "100%_, sigur" });

    // Dublu: `\%` pentru LIKE, apoi backslash-ul însuși scăpat în ghilimelele PostgREST.
    const asteptat = String.raw`titlu.ilike."%100\\%\\_, sigur%",numar_afisat.ilike."%100\\%\\_, sigur%"`;
    for (const apel of server.apeluriPe("tickets")) {
      expect(argumente(apel, "or")).toEqual([[asteptat]]);
    }
  });

  it("căutare goală: niciun `or`", async () => {
    server.raspunde("tickets", "select", { data: [] });
    server.raspunde("tickets", "select", { count: 0 });
    await listeazaTichete(ORG_ID, { cauta: "" });
    for (const apel of server.apeluriPe("tickets")) expect(argumente(apel, "or")).toEqual([]);
  });

  it("numărătoare lipsă: totalul e lungimea paginii", async () => {
    server.raspunde("tickets", "select", { data: [tichet(1), tichet(2)] });
    server.raspunde("tickets", "select", { count: null });
    expect((await listeazaTichete(ORG_ID, {})).total).toBe(2);
  });

  it("eroare pe listă: aruncă, nu întoarce o pagină goală cu un total plin", async () => {
    server.raspunde("tickets", "select", { error: eroarePostgrest("57014") });
    server.raspunde("tickets", "select", { count: 31 });
    await expect(listeazaTichete(ORG_ID, {})).rejects.toMatchObject({ code: "57014" });
  });

  it("solicitant `null`: niciun filtru pe solicitant", async () => {
    server.raspunde("tickets", "select", { data: [] });
    server.raspunde("tickets", "select", { count: 0 });
    await listeazaTichete(ORG_ID, {}, null, null);
    for (const apel of server.apeluriPe("tickets")) {
      expect(areFiltru(apel, "eq", "solicitant_employee_id")).toBe(false);
    }
  });

  it("eroare pe numărătoare: aruncă", async () => {
    server.raspunde("tickets", "select", { data: [] });
    server.raspunde("tickets", "select", { error: eroarePostgrest("42P17") });
    await expect(listeazaTichete(ORG_ID, {})).rejects.toMatchObject({ code: "42P17" });
  });
});

describe("ticheteleMele", () => {
  it("filtru EXPLICIT pe solicitant și organizație, cu limită sub `max_rows`", async () => {
    server.raspunde("tickets", "select", { data: null });
    expect(await ticheteleMele(ORG_ID, FISA)).toEqual([]);
    const [apel] = server.apeluriPe("tickets");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "solicitant_employee_id", FISA)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "limit")).toEqual([[50]]);
    expect(argumente(apel, "order")).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
  });

  it("eroarea se aruncă, nu devine „niciun tichet”", async () => {
    server.raspunde("tickets", "select", { error: eroarePostgrest("57014") });
    await expect(ticheteleMele(ORG_ID, FISA)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("fișa tichetului", () => {
  it("citesteTichetul: un singur rând nesters, `null` dacă nu se vede", async () => {
    server.raspunde("tickets", "select", { data: null });
    expect(await citesteTichetul(ID_1)).toBeNull();
    const [apel] = server.apeluriPe("tickets");
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("listeazaComentariile: nesterse, cronologic", async () => {
    server.raspunde("ticket_comments", "select", { data: null });
    expect(await listeazaComentariile(ID_1)).toEqual([]);
    const [apel] = server.apeluriPe("ticket_comments");
    expect(areFiltru(apel, "eq", "ticket_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "order")).toEqual([["created_at", { ascending: true }]]);
  });

  it("listeazaIstoricul: cele mai noi întâi", async () => {
    server.raspunde("ticket_history", "select", { data: [{ id: ID_3 }] });
    expect(await listeazaIstoricul(ID_1)).toEqual([{ id: ID_3 }]);
    const [apel] = server.apeluriPe("ticket_history");
    expect(areFiltru(apel, "eq", "ticket_id", ID_1)).toBe(true);
    expect(argumente(apel, "order")).toEqual([["created_at", { ascending: false }]]);
  });

  it("eroarea de citire se aruncă", async () => {
    server.raspunde("ticket_history", "select", { error: eroarePostgrest("42501") });
    await expect(listeazaIstoricul(ID_1)).rejects.toMatchObject({ code: "42501" });
  });

  it("citesteTichetul: eroarea se aruncă, nu devine „tichet inexistent”", async () => {
    server.raspunde("tickets", "select", { error: eroarePostgrest("57014") });
    await expect(citesteTichetul(ID_1)).rejects.toMatchObject({ code: "57014" });
  });

  it("listeazaComentariile: eroarea se aruncă, nu devine „niciun comentariu”", async () => {
    server.raspunde("ticket_comments", "select", { error: eroarePostgrest("57014") });
    await expect(listeazaComentariile(ID_1)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("listeazaObiecteleMele", () => {
  it("doar alocările nereturnate, cu obiectele ascunse de RLS scoase și sortare românească", async () => {
    server.raspunde("inventory_allocations", "select", {
      data: [
        { item: { id: ID_1, denumire: "Tabletă", numar_inventar: null, serie: null, model: null } },
        { item: null },
        {
          item: {
            id: ID_2,
            denumire: "Șurubelniță",
            numar_inventar: "I-2",
            serie: null,
            model: null,
          },
        },
        { item: { id: ID_3, denumire: "Laptop", numar_inventar: "I-1", serie: "S", model: "M" } },
      ],
    });

    const r = await listeazaObiecteleMele(FISA);

    expect(r.map((o) => o.denumire)).toEqual(["Laptop", "Șurubelniță", "Tabletă"]);
    const [apel] = server.apeluriPe("inventory_allocations");
    expect(areFiltru(apel, "eq", "employee_id", FISA)).toBe(true);
    expect(areFiltru(apel, "is", "returnat_la", null)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("eroarea se aruncă, nu golește lista de obiecte", async () => {
    server.raspunde("inventory_allocations", "select", { error: eroarePostgrest("57014") });
    await expect(listeazaObiecteleMele(FISA)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("managerulDirectAl", () => {
  it.each([
    [{ manager_employee_id: ID_1 }, ID_1],
    [{ manager_employee_id: null }, null],
    [null, null],
  ])("rândul %o ⇒ %s", async (rand, asteptat) => {
    server.raspunde("employees", "select", { data: rand });
    expect(await managerulDirectAl(FISA)).toBe(asteptat);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "id", FISA)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("eroarea se aruncă, nu devine „fără manager”", async () => {
    server.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    await expect(managerulDirectAl(FISA)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("listeazaTicheteleObiectului", () => {
  it("tichetele nesterse ale obiectului, cele mai noi întâi", async () => {
    server.raspunde("tickets", "select", { data: null });
    expect(await listeazaTicheteleObiectului(ID_1)).toEqual([]);
    const [apel] = server.apeluriPe("tickets");
    expect(areFiltru(apel, "eq", "inventory_item_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "order")).toEqual([["created_at", { ascending: false }]]);
  });

  it("eroarea se aruncă, nu devine un istoric gol", async () => {
    server.raspunde("tickets", "select", { error: eroarePostgrest("57014") });
    await expect(listeazaTicheteleObiectului(ID_1)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("rezumatCoada", () => {
  const ACUM = new Date("2026-07-15T12:00:00Z");
  const DESCHISE = ["nou", "in_aprobare", "in_lucru", "in_asteptare", "redeschis"];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ACUM);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("patru numărători `head`, fiecare pe organizație și nesterse", async () => {
    for (const count of [12, 3, 2, 5]) server.raspunde("tickets", "select", { count });

    const r = await rezumatCoada(ORG_ID);

    expect(r).toEqual({
      deschise: 12,
      deAprobat: 3,
      asteaptaSolicitantul: 2,
      faraMiscareDe7Zile: 5,
    });
    const apeluri = server.apeluriPe("tickets");
    expect(apeluri).toHaveLength(4);
    for (const apel of apeluri) {
      expect(apel.optiuni).toEqual({ count: "exact", head: true });
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
    const [deschise, deAprobat, asteapta, restante] = apeluri;
    expect(areFiltru(deschise, "in", "status", DESCHISE)).toBe(true);
    expect(areFiltru(deAprobat, "eq", "status", "in_aprobare")).toBe(true);
    expect(areFiltru(asteapta, "eq", "status", "in_asteptare")).toBe(true);
    expect(areFiltru(restante, "in", "status", DESCHISE)).toBe(true);
    // Restanța se măsoară din ultima atingere, nu din deschidere.
    expect(areFiltru(restante, "lt", "updated_at", "2026-07-08T12:00:00.000Z")).toBe(true);
    expect(areFiltru(restante, "lt", "created_at")).toBe(false);
  });

  it("numărători lipsă ⇒ 0", async () => {
    for (let i = 0; i < 4; i += 1) server.raspunde("tickets", "select", { count: null });
    expect(await rezumatCoada(ORG_ID)).toEqual({
      deschise: 0,
      deAprobat: 0,
      asteaptaSolicitantul: 0,
      faraMiscareDe7Zile: 0,
    });
  });

  it("o singură numărătoare eșuată face ca tot rezumatul să arunce", async () => {
    server.raspunde("tickets", "select", { count: 1 });
    server.raspunde("tickets", "select", { count: 1 });
    server.raspunde("tickets", "select", { error: eroarePostgrest("57014") });
    server.raspunde("tickets", "select", { count: 1 });
    await expect(rezumatCoada(ORG_ID)).rejects.toMatchObject({ code: "57014" });
  });
});
