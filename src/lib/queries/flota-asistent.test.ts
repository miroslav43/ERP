// src/lib/queries/flota-asistent.test.ts
//
// Citirile uneltelor de flotă ale asistentului (F12e), pe falsul strict:
// fiecare citire are filtrul de firmă (D12: ramura `is_platform_admin` vede
// toate firmele) și `deleted_at is null` (din 0018, singura barieră contra
// rândurilor șterse logic); documentele vin din `vehicle_documents`, niciodată
// din `expirables`; `citesteTot` paginează keyset, nu se oprește la 1000.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, type ApelFals, type ClientFals } from "@/lib/teste/supabase-fals";

import {
  alocarileInceputeInainte,
  amenziCuTermen,
  curseleFoilor,
  documenteCurente,
  foiInInterval,
  normeConsum,
  permiseCareExpira,
  planuriServiceActive,
  regimuriFiscale,
  rezervarileZilei,
  vehiculeDupaNumar,
  vehiculeFirmei,
} from "./flota-asistent";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

const izolat = (apel: ApelFals | undefined): void => {
  expect(areFiltru(apel, "eq", "organization_id", ORG_ID), "organization_id").toBe(true);
  expect(areFiltru(apel, "is", "deleted_at", null), "deleted_at").toBe(true);
};

describe("fiecare citire e izolată pe firmă și fără rânduri șterse", () => {
  it.each([
    ["vehicles", () => vehiculeDupaNumar(ORG_ID, "B123", 6)],
    ["vehicles", () => vehiculeFirmei(ORG_ID)],
    ["vehicle_documents", () => documenteCurente(ORG_ID, [ID_1])],
    ["trip_sheets", () => foiInInterval(ORG_ID, "2026-10-01", "2026-10-31")],
    ["trip_sheet_curse", () => curseleFoilor(ORG_ID, [ID_1])],
    ["vehicle_assignments", () => alocarileInceputeInainte(ORG_ID, ID_1, "2026-10-21T21:00:00Z")],
    ["vehicle_reservations", () => rezervarileZilei(ORG_ID, ID_1, "2026-10-22")],
    ["vehicle_service_plans", () => planuriServiceActive(ORG_ID, [ID_1])],
    ["vehicle_fines", () => amenziCuTermen(ORG_ID, "2026-11-21")],
    ["driver_licenses", () => permiseCareExpira(ORG_ID, "2026-11-21")],
    ["vehicle_consumption_norms", () => normeConsum(ORG_ID, [ID_1])],
    ["vehicle_fiscal_regimes", () => regimuriFiscale(ORG_ID, [ID_1])],
  ] as const)("%s", async (tabela, citeste) => {
    db.raspunde(tabela, "select", { data: [] });
    await citeste();
    izolat(db.apeluriPe(tabela, "select")[0]);
  });
});

describe("documentele", () => {
  it("se citesc din `vehicle_documents`, doar cele curente, doar pe vehiculele date", async () => {
    db.raspunde("vehicle_documents", "select", { data: [] });
    await documenteCurente(ORG_ID, [ID_1, ID_2]);
    const [apel] = db.apeluriPe("vehicle_documents", "select");
    expect(areFiltru(apel, "eq", "este_curent", true)).toBe(true);
    expect(areFiltru(apel, "in", "vehicle_id", [ID_1, ID_2])).toBe(true);
    expect(db.apeluriPe("expirables")).toEqual([]);
  });

  it("fără vehicule, niciun drum la bază: nu există „toate documentele firmei”", async () => {
    expect(await documenteCurente(ORG_ID, [])).toEqual([]);
    expect(db.apeluriPe("vehicle_documents")).toEqual([]);
  });
});

describe("foile și cursele", () => {
  it("intervalul e pe ziua foii (`data`), iar coloana e și în `select`", async () => {
    db.raspunde("trip_sheets", "select", { data: [] });
    await foiInInterval(ORG_ID, "2026-10-01", "2026-10-31", {
      vehicleId: ID_1,
      statusuri: ["draft", "trimis"],
    });
    const [apel] = db.apeluriPe("trip_sheets", "select");
    expect(areFiltru(apel, "gte", "data", "2026-10-01")).toBe(true);
    expect(areFiltru(apel, "lte", "data", "2026-10-31")).toBe(true);
    expect(areFiltru(apel, "eq", "vehicle_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["draft", "trimis"])).toBe(true);
    expect(apel?.coloane).toContain("data");
  });

  it("cursele nu citesc locurile (decizia I-T6)", async () => {
    db.raspunde("trip_sheet_curse", "select", { data: [] });
    await curseleFoilor(ORG_ID, [ID_1]);
    const [apel] = db.apeluriPe("trip_sheet_curse", "select");
    expect(apel?.coloane).not.toContain("loc");
    expect(apel?.coloane).not.toContain("scop");
  });

  it("`citesteTot` paginează keyset: a doua pagină pornește după ultimul id", async () => {
    const pagina = Array.from({ length: 1000 }, (_, i) => ({
      id: `id-${String(i).padStart(4, "0")}`,
      vehicle_id: ID_1,
      employee_id: ID_2,
      numar: null,
      data: "2026-10-01",
      status: "draft",
    }));
    db.raspunde("trip_sheets", "select", { data: pagina });
    db.raspunde("trip_sheets", "select", { data: [] });
    const foi = await foiInInterval(ORG_ID, "2026-10-01", "2026-10-31");
    expect(foi).toHaveLength(1000);
    const [, aDoua] = db.apeluriPe("trip_sheets", "select");
    expect(areFiltru(aDoua, "gt", "id", "id-0999")).toBe(true);
  });
});

describe("permisele", () => {
  it("nu citesc numărul permisului", async () => {
    db.raspunde("driver_licenses", "select", { data: [] });
    await permiseCareExpira(ORG_ID, "2026-11-21");
    const [apel] = db.apeluriPe("driver_licenses", "select");
    expect(apel?.coloane).not.toContain("numar");
    expect(areFiltru(apel, "lte", "expira_la", "2026-11-21")).toBe(true);
  });
});

describe("alocările și rezervările", () => {
  it("alocările încep înaintea sfârșitului zilei", async () => {
    db.raspunde("vehicle_assignments", "select", { data: [] });
    await alocarileInceputeInainte(ORG_ID, ID_1, "2026-10-21T21:00:00Z");
    const [apel] = db.apeluriPe("vehicle_assignments", "select");
    expect(areFiltru(apel, "lt", "de_la", "2026-10-21T21:00:00Z")).toBe(true);
    expect(apel?.coloane).toContain("pana_la");
  });

  it("rezervările cuprind ziua și sunt cerute sau confirmate", async () => {
    db.raspunde("vehicle_reservations", "select", { data: [] });
    await rezervarileZilei(ORG_ID, ID_1, "2026-10-22");
    const [apel] = db.apeluriPe("vehicle_reservations", "select");
    expect(areFiltru(apel, "lte", "de_la", "2026-10-22")).toBe(true);
    expect(areFiltru(apel, "gte", "pana_la", "2026-10-22")).toBe(true);
    expect(areFiltru(apel, "in", "status", ["ceruta", "confirmata"])).toBe(true);
  });
});
