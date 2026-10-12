// src/lib/queries/flota-amenzi.test.ts
//
// Citirile amenzilor (0203, F11), pe clientul fals: filtrul „de răspuns” și
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

import { listeazaAmenzi, rezumatAmenzi, type FiltreAmenzi } from "./flota-amenzi";

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
