// src/lib/queries/fleet-carduri.test.ts
//
// Cardurile omului din portal (F12b), pe clientul fals: firma și rândul viu
// explicit, filtrul pe fișa proprie SAU pe mașinile lui, într-un singur `.or()`.
// NU prind o politică RLS greșită — aceea e pe `tests/rls/proba-flota-carduri.sql`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, type ClientFals } from "@/lib/teste/supabase-fals";

import { PLAFON_CARDURI_MELE, carduleMele } from "./fleet-carduri";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

function argumente(apel: ReturnType<ClientFals["apeluriPe"]>[number] | undefined, metoda: string) {
  return apel?.filtre.filter((f) => f.metoda === metoda).map((f) => f.argumente);
}

/*
 * Notificarea cardului care expiră duce omul fără `team`/`all` la
 * `/portal/masina-mea`, unde cardul nu apărea. Pagina îl arată acum din citirea
 * asta: doar ultimele cifre, niciodată numărul întreg (nici nu se păstrează).
 */
describe("carduleMele", () => {
  it("cardul pe fișa lui SAU pe mașinile lui, într-un singur `.or()`; fără anulate", async () => {
    const rand = { id: ID_3, emitent: "omv_petrom", ultimele_cifre: "1234" };
    db.raspunde("fuel_cards", "select", { data: [rand] });
    expect(await carduleMele(ORG_ID, ID_1, [ID_2, ID_2])).toEqual([rand]);

    const [apel] = db.apeluriPe("fuel_cards");
    expect(argumente(apel, "or")).toEqual([[`employee_id.eq.${ID_1},vehicle_id.in.(${ID_2})`]]);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "neq", "status", "anulat")).toBe(true);
    expect(argumente(apel, "limit")).toEqual([[PLAFON_CARDURI_MELE]]);
    expect(apel?.coloane).toContain("ultimele_cifre");
    expect(apel?.coloane).not.toContain("amprenta_numar");
  });

  it("fără mașini: doar cardul pe fișa lui", async () => {
    db.raspunde("fuel_cards", "select", { data: [] });
    await carduleMele(ORG_ID, ID_1, []);

    const [apel] = db.apeluriPe("fuel_cards");
    expect(argumente(apel, "or")).toEqual([[`employee_id.eq.${ID_1}`]]);
  });
});
