// src/lib/queries/fleet-pv.test.ts
//
// Citirile procesului-verbal de predare (0215, F12c), pe clientul fals: firma
// și rândul viu explicit pe FIECARE citire (politica SELECT nu ascunde ciornele
// șterse), filtrul pe fișa proprie din portal într-un singur `.or()`, plafonul
// sub `max_rows`. NU prind o politică RLS greșită — aceea e pe
// `tests/rls/proba-flota-pv.sql`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, type ClientFals } from "@/lib/teste/supabase-fals";

import {
  PLAFON_DE_CONFIRMAT,
  PLAFON_PV,
  citestePv,
  documenteleCurenteLaBord,
  pvuriDeConfirmat,
  pvurileMele,
  pvurileVehiculului,
} from "./fleet-pv";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

function argumente(apel: ReturnType<ClientFals["apeluriPe"]>[number] | undefined, metoda: string) {
  return apel?.filtre.filter((f) => f.metoda === metoda).map((f) => f.argumente);
}

describe("pvurileVehiculului", () => {
  it("firma, vehiculul și rândul viu explicit; cele mai noi primele; plafon", async () => {
    db.raspunde("vehicle_handovers", "select", { data: [] });
    expect(await pvurileVehiculului(ORG_ID, ID_1)).toEqual([]);

    const [apel] = db.apeluriPe("vehicle_handovers");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "vehicle_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "order")).toEqual([
      ["moment", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(argumente(apel, "limit")).toEqual([[PLAFON_PV]]);
  });
});

describe("citestePv", () => {
  it("firma, id-ul și rândul viu; părțile încorporate pe cheia lor", async () => {
    db.raspunde("vehicle_handovers", "select", { data: null });
    expect(await citestePv(ORG_ID, ID_1)).toBeNull();

    const [apel] = db.apeluriPe("vehicle_handovers");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.coloane).toContain(
      "predator:employees!predator_employee_id(full_name, marca, functie)",
    );
    expect(apel?.coloane).toContain(
      "primitor:employees!primitor_employee_id(full_name, marca, functie)",
    );
    expect(apel?.coloane).not.toContain("sofer_employee_id");
    expect(apel?.terminal).toBe("maybeSingle");
  });
});

describe("pvurileMele", () => {
  it("fișa proprie ca predător SAU primitor, într-un singur `.or()`; doar finalizatele", async () => {
    db.raspunde("vehicle_handovers", "select", { data: [] });
    await pvurileMele(ORG_ID, ID_2);

    const [apel] = db.apeluriPe("vehicle_handovers");
    expect(argumente(apel, "or")).toEqual([
      [`predator_employee_id.eq.${ID_2},primitor_employee_id.eq.${ID_2}`],
    ]);
    expect(areFiltru(apel, "eq", "stare", "finalizat")).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "limit")).toEqual([[PLAFON_PV]]);
  });

  it("aduce `scan_path`: partea PV-ului își deschide scanul semnat din portal (F12c)", async () => {
    const rand = { id: ID_1, numar: "PVP-2026-0001", scan_path: "org/vehicles/v/pv.pdf" };
    db.raspunde("vehicle_handovers", "select", { data: [rand] });
    expect(await pvurileMele(ORG_ID, ID_2)).toEqual([rand]);

    const [apel] = db.apeluriPe("vehicle_handovers");
    expect(apel?.coloane).toContain("scan_path");
  });
});

describe("pvuriDeConfirmat", () => {
  it("coloana PĂRȚII: predătorul pe predare, primitorul pe primire; neanulate", async () => {
    db.raspunde("vehicle_handovers", "select", { data: [{ id: ID_1, numar: "PVA-2026-0001" }] });
    expect(await pvuriDeConfirmat(ORG_ID, ID_2)).toEqual([{ id: ID_1, numar: "PVA-2026-0001" }]);

    const [apel] = db.apeluriPe("vehicle_handovers");
    expect(argumente(apel, "or")).toEqual([
      [
        `and(predator_employee_id.eq.${ID_2},confirmat_predator_la.is.null),` +
          `and(primitor_employee_id.eq.${ID_2},confirmat_primitor_la.is.null)`,
      ],
    ]);
    expect(areFiltru(apel, "is", "anulat_la", null)).toBe(true);
    expect(areFiltru(apel, "eq", "stare", "finalizat")).toBe(true);
    expect(argumente(apel, "limit")).toEqual([[PLAFON_DE_CONFIRMAT]]);
  });
});

describe("documenteleCurenteLaBord", () => {
  it("doar documentele curente și vii ale vehiculului, cu tipul încorporat", async () => {
    db.raspunde("vehicle_documents", "select", { data: [] });
    await documenteleCurenteLaBord(ORG_ID, ID_1);

    const [apel] = db.apeluriPe("vehicle_documents");
    expect(areFiltru(apel, "eq", "este_curent", true)).toBe(true);
    expect(areFiltru(apel, "eq", "vehicle_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });
});
