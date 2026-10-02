// src/lib/queries/announcements.test.ts
//
// Citirile avizierului: lista de administrare (cu limită cunoscută), lista din
// portal (filtrul „publicat, neexpirat” scris explicit), detaliul, confirmările
// de citire și numitorii lor.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  anunturiPublicate,
  citesteAnunt,
  cititoriAnunt,
  idAnunturiCitite,
  LIMITA_ANUNTURI,
  listeazaAnunturi,
  numarAngajatiActivi,
  numarAngajatiCuCont,
} from "./announcements";

const anunt = (id: string) => ({
  id,
  titlu: "Titlu",
  continut: "Conținut",
  fixat: false,
  publicat_la: "2026-09-01T08:00:00Z",
  expira_la: null,
  created_at: "2026-09-01T07:00:00Z",
});

describe("listeazaAnunturi", () => {
  it("organizația activă, rânduri vii; fixate întâi, ciornele înaintea publicatelor", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("announcements", "select", { data: [anunt(ID_1)] });

    const r = await listeazaAnunturi(ORG_ID);

    expect(r).toEqual({ randuri: [anunt(ID_1)], trunchiat: false });
    const [apel] = server.apeluriPe("announcements");
    expect(apel?.coloane).toContain("continut");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["fixat", { ascending: false }] },
        { metoda: "order", argumente: ["publicat_la", { ascending: false, nullsFirst: true }] },
        { metoda: "limit", argumente: [LIMITA_ANUNTURI] },
      ]),
    );
  });

  it("limita e explicită, nu `max_rows` tăcut; peste ea lista se declară trunchiată", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("announcements", "select", {
      data: [anunt(ID_1), anunt(ID_2), anunt(ID_3)],
    });
    const r = await listeazaAnunturi(ORG_ID, 2);
    // Baza n-ar întoarce peste limită; dacă o face, lista rămâne marcată.
    expect(r.trunchiat).toBe(true);
    const [apel] = server.apeluriPe("announcements");
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [2] });
  });

  it.fails(
    "DEFECT: exact `limita` anunțuri pe disc nu înseamnă că lista e trunchiată",
    async () => {
      // `trunchiat: randuri.length >= limita` fără să ceară `limita + 1`: cu
      // exact 2 anunțuri și limita 2, ecranul spune că mai sunt anunțuri
      // neafișate, deși nu mai e niciunul.
      const { server } = configureazaActiunea();
      server.raspunde("announcements", "select", { data: [anunt(ID_1), anunt(ID_2)] });
      const r = await listeazaAnunturi(ORG_ID, 2);
      expect(r.trunchiat).toBe(false);
    },
  );

  it("fără anunțuri: listă goală, netrunchiată", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("announcements", "select", { data: null });
    expect(await listeazaAnunturi(ORG_ID)).toEqual({ randuri: [], trunchiat: false });
  });

  it("eroarea bazei se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("announcements", "select", { error: eroarePostgrest("42501") });
    await expect(listeazaAnunturi(ORG_ID)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("anunturiPublicate", () => {
  const ACUM = "2026-09-15T10:00:00.000Z";

  it("filtrul de portal e explicit: publicat până ACUM și neexpirat, independent de scope", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("announcements", "select", { data: [anunt(ID_1)] });

    const r = await anunturiPublicate(ORG_ID, ACUM);

    expect(r).toHaveLength(1);
    const [apel] = server.apeluriPe("announcements");
    expect(apel?.coloane).not.toContain("continut");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "not", argumente: ["publicat_la", "is", null] });
    expect(areFiltru(apel, "lte", "publicat_la", ACUM)).toBe(true);
    expect(apel?.filtre).toContainEqual({
      metoda: "or",
      argumente: [`expira_la.is.null,expira_la.gt."${ACUM}"`],
    });
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [100] });
  });

  it("limita se poate cere; lipsa rândurilor dă listă goală", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("announcements", "select", { data: null });
    expect(await anunturiPublicate(ORG_ID, ACUM, 5)).toEqual([]);
    const [apel] = server.apeluriPe("announcements");
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [5] });
  });
});

describe("citesteAnunt", () => {
  it("pe organizație + id, rânduri vii; absent ⇒ null", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("announcements", "select", { data: null });
    expect(await citesteAnunt(ORG_ID, ID_1)).toBeNull();
    const [apel] = server.apeluriPe("announcements");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.terminal).toBe("maybeSingle");
  });
});

describe("idAnunturiCitite", () => {
  it("confirmările angajatului, din organizația lui, ca mulțime de id-uri", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("announcement_reads", "select", {
      data: [{ announcement_id: ID_1 }, { announcement_id: ID_3 }, { announcement_id: ID_1 }],
    });

    const r = await idAnunturiCitite(ORG_ID, ID_2);

    expect([...r].sort()).toEqual([ID_1, ID_3].sort());
    const [apel] = server.apeluriPe("announcement_reads");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id", ID_2)).toBe(true);
  });

  it("nicio confirmare: mulțime goală", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("announcement_reads", "select", { data: null });
    expect((await idAnunturiCitite(ORG_ID, ID_2)).size).toBe(0);
  });
});

describe("cititoriAnunt", () => {
  it("cititorii anunțului, cei mai recenți întâi, cu embed-ul de angajat", async () => {
    const { server } = configureazaActiunea();
    const cititori = [{ employee_id: ID_2, citit_la: "2026-09-02T08:00:00Z", angajat: null }];
    server.raspunde("announcement_reads", "select", { data: cititori });

    expect(await cititoriAnunt(ID_1)).toEqual(cititori);
    const [apel] = server.apeluriPe("announcement_reads");
    expect(areFiltru(apel, "eq", "announcement_id", ID_1)).toBe(true);
    expect(apel?.coloane).toContain("angajat:employees!employee_id");
    expect(apel?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["citit_la", { ascending: false }],
    });
  });
});

describe("numitorii confirmărilor", () => {
  it("numarAngajatiCuCont: activi, vii, DOAR cei cu cont (pot confirma)", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", { count: 6 });
    expect(await numarAngajatiCuCont(ORG_ID)).toBe(6);
    const [apel] = server.apeluriPe("employees");
    expect(apel?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "not", argumente: ["user_id", "is", null] });
  });

  it("numarAngajatiActivi: activi și vii, cu sau fără cont", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", { count: 8 });
    expect(await numarAngajatiActivi(ORG_ID)).toBe(8);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre.some((f) => f.metoda === "not")).toBe(false);
  });

  it.each([
    ["numarAngajatiCuCont", numarAngajatiCuCont],
    ["numarAngajatiActivi", numarAngajatiActivi],
  ])("%s: `count` null ⇒ 0, eroarea se propagă", async (_nume, functie) => {
    const { server } = configureazaActiunea();
    server.raspunde("employees", "select", { count: null });
    expect(await functie(ORG_ID)).toBe(0);
    server.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    await expect(functie(ORG_ID)).rejects.toMatchObject({ code: "57014" });
  });
});
