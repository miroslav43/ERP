// src/lib/queries/fleet-service.test.ts
//
// Citirile service-ului, cheltuielilor și costurilor (0200), pe clientul fals:
// filtrele de firmă și de rând viu, cursorul keyset al listelor și adunarea
// costurilor din cele patru surse. NU prind o politică RLS greșită — aceea e pe
// `tests/rls/proba-flota-service.sql`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, type ClientFals } from "@/lib/teste/supabase-fals";

import { decodificaCursor } from "./cursor";
import { cheltuieliVehicul, costuriVehicul, intrariService, planuriService } from "./fleet-service";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

const intrare = (id: string, data: string) => ({
  id,
  vehicle_id: ID_1,
  plan_id: null,
  data_interventiei: data,
  km: 46000,
  tip: "revizie",
  descriere: "Ulei",
  furnizor: null,
  numar_factura: null,
  cost_piese: 100,
  cost_manopera: 50,
  cost_total: 150,
  anvelope_montate: null,
  observatii: null,
});

const cheltuiala = (id: string, data: string) => ({
  id,
  vehicle_id: ID_1,
  categorie: "parcare",
  data_cheltuielii: data,
  suma: 15,
  litri: null,
  km_bord: null,
  numar_document: null,
  observatii: null,
});

describe("planuriService", () => {
  it("firma și vehiculul explicit, doar rândurile vii, active întâi", async () => {
    db.raspunde("vehicle_service_plans", "select", { data: [] });
    expect(await planuriService(ORG_ID, ID_1)).toEqual([]);

    const apel = db.apeluriPe("vehicle_service_plans")[0];
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "vehicle_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    // Ordinea: activ desc, apoi scadența cu NULL-urile la coadă, apoi denumirea.
    expect(apel?.filtre.filter((f) => f.metoda === "order").map((f) => f.argumente[0])).toEqual([
      "activ",
      "urmatoarea_data",
      "denumire",
    ]);
  });
});

describe("intrariService", () => {
  it("pagina plină: cursorul pe data și id-ul ultimului rând, nu pe al celui în plus", async () => {
    db.raspunde("vehicle_service_entries", "select", {
      data: [intrare(ID_1, "2026-10-05"), intrare(ID_2, "2026-09-20"), intrare(ID_3, "2026-08-01")],
    });
    const r = await intrariService(ORG_ID, ID_1, { cursor: null, limita: 2 });

    expect(r.randuri.map((x) => x.id)).toEqual([ID_1, ID_2]);
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({
      valoare: "2026-09-20",
      id: ID_2,
    });
    const apel = db.apeluriPe("vehicle_service_entries")[0];
    expect(apel?.filtre.find((f) => f.metoda === "limit")?.argumente[0]).toBe(3);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre.some((f) => f.metoda === "or")).toBe(false);
  });

  it("ultima pagină: fără cursor", async () => {
    db.raspunde("vehicle_service_entries", "select", { data: [intrare(ID_1, "2026-10-05")] });
    const r = await intrariService(ORG_ID, ID_1, { cursor: null, limita: 2 });
    expect(r.randuri).toHaveLength(1);
    expect(r.urmatorulCursor).toBeNull();
  });

  it("cu cursor: predicatul keyset în ordinea descrescătoare; un cursor stricat înseamnă prima pagină", async () => {
    db.raspunde("vehicle_service_entries", "select", { data: [] });
    const cursor = Buffer.from(`2026-09-20\u0000${ID_2}`, "utf8").toString("base64url");
    await intrariService(ORG_ID, ID_1, { cursor, limita: 2 });
    const sunt = db.apeluriPe("vehicle_service_entries")[0]?.filtre.find((f) => f.metoda === "or");
    expect(String(sunt?.argumente[0])).toContain("data_interventiei.lt.");

    db.raspunde("vehicle_service_entries", "select", { data: [] });
    await intrariService(ORG_ID, ID_1, { cursor: "%%%nu-e-cursor", limita: 2 });
    expect(db.apeluriPe("vehicle_service_entries")[1]?.filtre.some((f) => f.metoda === "or")).toBe(
      false,
    );
  });
});

describe("cheltuieliVehicul", () => {
  it("aceeași paginare keyset, pe data cheltuielii", async () => {
    db.raspunde("vehicle_expenses", "select", {
      data: [
        cheltuiala(ID_1, "2026-10-05"),
        cheltuiala(ID_2, "2026-10-04"),
        cheltuiala(ID_3, "2026-10-03"),
      ],
    });
    const r = await cheltuieliVehicul(ORG_ID, ID_1, { cursor: null, limita: 2 });
    expect(r.randuri).toHaveLength(2);
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "2026-10-04", id: ID_2 });
    const apel = db.apeluriPe("vehicle_expenses")[0];
    expect(apel?.filtre.filter((f) => f.metoda === "order").map((f) => f.argumente[0])).toEqual([
      "data_cheltuielii",
      "id",
    ]);
  });
});

describe("costuriVehicul", () => {
  function programeaza(): void {
    db.raspunde("vehicle_service_entries", "select", {
      data: [
        { id: ID_1, tip: "revizie", cost_piese: 300, cost_manopera: 450, cost_total: 750 },
        { id: ID_2, tip: "reparatie", cost_piese: 200, cost_manopera: 100, cost_total: 300 },
      ],
    });
    db.raspunde("vehicle_expenses", "select", {
      data: [
        { id: ID_1, categorie: "combustibil_fara_foaie", suma: 300.5, litri: 40 },
        { id: ID_2, categorie: "parcare", suma: 15, litri: null },
        { id: ID_3, categorie: "parcare", suma: 20, litri: null },
      ],
    });
    db.raspunde("trip_sheets", "select", {
      data: [
        { id: ID_1, km_parcursi: 400, alimentari: [{ litri: 30, cost: 220 }] },
        {
          id: ID_2,
          km_parcursi: 600,
          alimentari: [
            { litri: 40, cost: 290.4 },
            { litri: 20, cost: 150 },
          ],
        },
        { id: ID_3, km_parcursi: null, alimentari: [] },
      ],
    });
    db.raspunde("vehicle_documents", "select", {
      data: [
        { id: ID_1, cost: 1800 },
        { id: ID_2, cost: 200.5 },
      ],
    });
  }

  it("adună cele patru surse, cost pe km din foile aprobate și consumul real", async () => {
    programeaza();
    const r = await costuriVehicul(ORG_ID, ID_1, "2026-01-01", "2026-10-12", true);

    expect(r.service).toMatchObject({ numar: 2, total: 1050, piese: 500, manopera: 550 });
    expect(r.service.peTip.map((t) => [t.categorie, t.suma])).toEqual([
      ["revizie", 750],
      ["reparatie", 300],
    ]);
    expect(r.cheltuieli).toMatchObject({ numar: 3, total: 335.5, litriFaraFoaie: 40 });
    expect(r.cheltuieli.peCategorie[0]).toEqual({
      categorie: "combustibil_fara_foaie",
      suma: 300.5,
      numar: 1,
    });
    expect(r.foi).toEqual({ numar: 3, km: 1000, litri: 90, costCombustibil: 660.4 });
    expect(r.documente).toEqual({ numar: 2, total: 2000.5 });
    // 1050 + 660,40 + 335,50 + 2000,50
    expect(r.total).toBe(4046.4);
    expect(r.costPeKm).toBe(4.05);
    expect(r.consumReal).toBeCloseTo(9, 5);
  });

  it("fiecare sursă are firma, vehiculul, rândurile vii și perioada pe coloana ei de dată", async () => {
    programeaza();
    await costuriVehicul(ORG_ID, ID_1, "2026-01-01", "2026-10-12", true);

    const surse: readonly (readonly [string, string])[] = [
      ["vehicle_service_entries", "data_interventiei"],
      ["vehicle_expenses", "data_cheltuielii"],
      ["trip_sheets", "data"],
      ["vehicle_documents", "valabil_de_la"],
    ];
    for (const [tabela, coloanaData] of surse) {
      const apel = db.apeluriPe(tabela)[0];
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID), `${tabela}: firma`).toBe(true);
      expect(areFiltru(apel, "eq", "vehicle_id", ID_1), `${tabela}: vehiculul`).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null), `${tabela}: rânduri vii`).toBe(true);
      expect(areFiltru(apel, "gte", coloanaData, "2026-01-01"), `${tabela}: de la`).toBe(true);
      expect(areFiltru(apel, "lte", coloanaData, "2026-10-12"), `${tabela}: până la`).toBe(true);
    }
    // Doar foile aprobate dau kilometri și combustibil; alimentările șterse nu se numără.
    const foi = db.apeluriPe("trip_sheets")[0];
    expect(areFiltru(foi, "eq", "status", "aprobat")).toBe(true);
    expect(areFiltru(foi, "is", "alimentari.deleted_at", null)).toBe(true);
  });

  it("tot istoricul: fără limita de jos", async () => {
    programeaza();
    await costuriVehicul(ORG_ID, ID_1, null, "2026-10-12", true);
    for (const tabela of [
      "vehicle_service_entries",
      "vehicle_expenses",
      "trip_sheets",
      "vehicle_documents",
    ]) {
      const apel = db.apeluriPe(tabela)[0];
      expect(
        apel?.filtre.some((f) => f.metoda === "gte"),
        tabela,
      ).toBe(false);
      expect(
        apel?.filtre.some((f) => f.metoda === "lte"),
        tabela,
      ).toBe(true);
    }
  });

  it("fără foi aprobate nu există cost pe km și nici consum — null, nu 0", async () => {
    db.raspunde("vehicle_service_entries", "select", { data: [] });
    db.raspunde("vehicle_expenses", "select", {
      data: [{ id: ID_1, categorie: "parcare", suma: 15, litri: null }],
    });
    db.raspunde("trip_sheets", "select", { data: [] });
    db.raspunde("vehicle_documents", "select", { data: [] });
    const r = await costuriVehicul(ORG_ID, ID_1, null, "2026-10-12", true);
    expect(r.total).toBe(15);
    expect(r.costPeKm).toBeNull();
    expect(r.consumReal).toBeNull();
  });
  it("fără dreptul de a citi TOATE foile: foile nu se interoghează, iar cifrele derivate din ele lipsesc", async () => {
    // Managerul vede service-ul și cheltuielile oricărui vehicul vizibil, dar
    // RLS pe `trip_sheets` îi arată doar foile șoferilor echipei lui. Un cost pe
    // km împărțit la kilometri PARȚIALI ar ieși umflat, fără eroare și fără
    // avertisment, deci foile nu intră deloc în calcul (și nici în total).
    db.raspunde("vehicle_service_entries", "select", {
      data: [{ id: ID_1, tip: "revizie", cost_piese: 300, cost_manopera: 450, cost_total: 750 }],
    });
    db.raspunde("vehicle_expenses", "select", {
      data: [{ id: ID_1, categorie: "parcare", suma: 15, litri: null }],
    });
    db.raspunde("vehicle_documents", "select", { data: [{ id: ID_1, cost: 200.5 }] });
    // Un răspuns programat pe foi, ca să se vadă că NU e citit.
    db.raspunde("trip_sheets", "select", {
      data: [{ id: ID_1, km_parcursi: 400, alimentari: [{ litri: 30, cost: 220 }] }],
    });

    const r = await costuriVehicul(ORG_ID, ID_1, null, "2026-10-12", false);

    expect(db.apeluriPe("trip_sheets")).toHaveLength(0);
    expect(r.foiIncluse).toBe(false);
    expect(r.foi).toEqual({ numar: 0, km: 0, litri: 0, costCombustibil: 0 });
    expect(r.total).toBe(965.5);
    expect(r.costPeKm).toBeNull();
    expect(r.consumReal).toBeNull();
  });

  it("cu dreptul de a citi toate foile, foile intră și se marchează incluse", async () => {
    programeaza();
    const r = await costuriVehicul(ORG_ID, ID_1, null, "2026-10-12", true);
    expect(r.foiIncluse).toBe(true);
    expect(db.apeluriPe("trip_sheets")).toHaveLength(1);
  });
});
