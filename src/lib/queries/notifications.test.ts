// src/lib/queries/notifications.test.ts
//
// Pastila de necitite (eroarea NU dărâmă antetul: zero) și lista cutiei
// poștale, cu limita exportată ca ecranul să știe unde s-a oprit.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ORG_ID, USER_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { LIMITA_LISTA_NOTIFICARI, listeazaNotificarile, numaraNecitite } from "./notifications";

describe("numaraNecitite", () => {
  it("numără necititele utilizatorului în organizația activă, fără să aducă rânduri", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "select", { count: 4 });

    expect(await numaraNecitite(ORG_ID, USER_ID)).toBe(4);
    const [apel] = server.apeluri;
    expect(apel?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(apel, "is", "read_at", null)).toBe(true);
  });

  it("numărul necunoscut (null) e zero", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "select", { count: null });
    expect(await numaraNecitite(ORG_ID, USER_ID)).toBe(0);
  });

  it("eroarea NU se propagă: pastila arată zero și eroarea se loghează", async () => {
    const eroareConsola = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "select", { error: eroarePostgrest("57014") });
    expect(await numaraNecitite(ORG_ID, USER_ID)).toBe(0);
    expect(eroareConsola).toHaveBeenCalled();
  });
});

describe("listeazaNotificarile", () => {
  it("cele mai noi întâi, ale utilizatorului în organizație, cu limita exportată", async () => {
    const { server } = configureazaActiunea();
    const rand = {
      id: ID_1,
      kind: "task",
      title: "Ai ceva de făcut",
      body: null,
      link: "/reges",
      read_at: null,
      created_at: "2026-09-15T08:00:00Z",
    };
    server.raspunde("notifications", "select", { data: [rand] });

    expect(await listeazaNotificarile(ORG_ID, USER_ID)).toEqual([rand]);
    const [apel] = server.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "user_id", USER_ID)).toBe(true);
    expect(apel?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["created_at", { ascending: false }] },
        { metoda: "limit", argumente: [LIMITA_LISTA_NOTIFICARI] },
      ]),
    );
  });

  it("cutie goală ⇒ listă goală", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "select", { data: null });
    expect(await listeazaNotificarile(ORG_ID, USER_ID)).toEqual([]);
  });

  it("eroarea se propagă (lista nu minte că e goală)", async () => {
    const { server } = configureazaActiunea();
    const eroare = eroarePostgrest("42501");
    server.raspunde("notifications", "select", { error: eroare });
    await expect(listeazaNotificarile(ORG_ID, USER_ID)).rejects.toBe(eroare);
  });
});
