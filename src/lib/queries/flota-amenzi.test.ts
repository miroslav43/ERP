// src/lib/queries/flota-amenzi.test.ts
//
// Citirile amenzilor (0206, F11), pe clientul fals: filtrul „de răspuns” și
// numerele de deasupra listei trebuie să spună ACELAȘI lucru ca baza
// (`internal.amenzi_scadenta`) și ca domeniul (`verdictTermen`): răspunsul
// n-a plecat, adică stadiul e primită / șofer desemnat / contestată ȘI
// `raspuns_trimis_la` e gol. O amendă contestată după ce răspunsul a plecat NU
// mai e „de răspuns”, nici „cu termenul depășit”.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, type ClientFals } from "@/lib/teste/supabase-fals";

import { declaratiileMele, listeazaAmenzi, rezumatAmenzi, type FiltreAmenzi } from "./flota-amenzi";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

const filtre = (m: Partial<FiltreAmenzi> = {}): FiltreAmenzi => ({
  stadiu: null,
  vehicul: null,
  cursor: null,
  limita: 25,
  ...m,
});

describe("listeazaAmenzi — filtrul „de răspuns”", () => {
  it("cere stadiile de răspuns ȘI `raspuns_trimis_la` gol, pe listă și pe numărătoare", async () => {
    db.raspunde("vehicle_fines", "select", { data: [] });
    db.raspunde("vehicle_fines", "select", { data: null, count: 0 });

    await listeazaAmenzi(ORG_ID, filtre({ stadiu: "de_raspuns" }));

    const apeluri = db.apeluriPe("vehicle_fines", "select");
    expect(apeluri).toHaveLength(2);
    for (const apel of apeluri) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(apel, "in", "stadiu", ["primita", "sofer_desemnat", "contestata"])).toBe(
        true,
      );
      expect(areFiltru(apel, "is", "raspuns_trimis_la", null)).toBe(true);
    }
  });

  it("filtrul unui stadiu anume NU adaugă condiția pe răspuns", async () => {
    db.raspunde("vehicle_fines", "select", { data: [] });
    db.raspunde("vehicle_fines", "select", { data: null, count: 0 });

    await listeazaAmenzi(ORG_ID, filtre({ stadiu: "contestata" }));

    for (const apel of db.apeluriPe("vehicle_fines", "select")) {
      expect(areFiltru(apel, "eq", "stadiu", "contestata")).toBe(true);
      expect(areFiltru(apel, "is", "raspuns_trimis_la", null)).toBe(false);
    }
  });
});

describe("rezumatAmenzi", () => {
  it("ambele numărători cer răspunsul neplecat; cea de termene mai cere termenul trecut", async () => {
    db.raspunde("vehicle_fines", "select", { data: null, count: 3 });
    db.raspunde("vehicle_fines", "select", { data: null, count: 1 });

    const r = await rezumatAmenzi(ORG_ID, "2026-10-12");

    expect(r).toEqual({ deRaspuns: 3, cuTermenDepasit: 1 });
    const [toate, depasite] = db.apeluriPe("vehicle_fines", "select");
    for (const apel of [toate, depasite]) {
      expect(areFiltru(apel, "in", "stadiu", ["primita", "sofer_desemnat", "contestata"])).toBe(
        true,
      );
      expect(areFiltru(apel, "is", "raspuns_trimis_la", null)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
    expect(areFiltru(depasite, "lt", "termen_raspuns", "2026-10-12")).toBe(true);
    expect(areFiltru(toate, "lt", "termen_raspuns", "2026-10-12")).toBe(false);
  });
});

// 0206 §F: „Incidentele declarate de mine” din portal. Filtrul pe declarant e
// EXPLICIT: un administrator-șofer (`read = all`) ar vedea altfel tot parcul.
describe("declaratiileMele", () => {
  const FISA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  it("filtrează pe firmă, pe declarant și pe nesterse, pe listă și pe numărătoare", async () => {
    db.raspunde("vehicle_incidents", "select", { data: [] });
    db.raspunde("vehicle_incidents", "select", { data: null, count: 0 });

    const r = await declaratiileMele(ORG_ID, FISA, { cursor: null, limita: 10 });

    expect(r).toEqual({ randuri: [], urmatorulCursor: null, total: 0 });
    const apeluri = db.apeluriPe("vehicle_incidents", "select");
    expect(apeluri).toHaveLength(2);
    for (const apel of apeluri) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "eq", "declarat_de_employee_id", FISA)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
    expect(apeluri[0]?.filtre).toContainEqual({ metoda: "limit", argumente: [11] });
  });

  it("cu un rând în plus, întoarce cursorul următoarei pagini", async () => {
    const rand = (id: string, produs_la: string) => ({ id, produs_la });
    db.raspunde("vehicle_incidents", "select", {
      data: [
        rand("11111111-1111-4111-8111-111111111111", "2026-10-02T10:00:00Z"),
        rand("22222222-2222-4222-8222-222222222222", "2026-10-01T10:00:00Z"),
      ],
    });
    db.raspunde("vehicle_incidents", "select", { data: null, count: 2 });

    const r = await declaratiileMele(ORG_ID, FISA, { cursor: null, limita: 1 });

    expect(r.randuri).toHaveLength(1);
    expect(r.urmatorulCursor).not.toBeNull();
    expect(r.total).toBe(2);
  });
});
