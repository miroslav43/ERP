// src/lib/queries/rapoarte.test.ts
//
// Citirile raportului anual. `statisticiAnuale` agregă ÎN MEMORIE peste două
// citiri complete (`citesteTot`), deci testele programează rânduri și
// verifică aritmetica: luni în ciornă, luni necalculate, totaluri, paginare.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { aniCuPerioade, statisticiAnuale } from "./rapoarte";

let server: ClientFals;

beforeEach(() => {
  server = configureazaActiunea().server;
});

describe("aniCuPerioade", () => {
  it("anii distincți ai organizației, cei mai recenți primii", async () => {
    server.raspunde("payroll_periods", "select", {
      data: [{ an: 2024 }, { an: 2026 }, { an: 2024 }, { an: 2025 }, { an: 2026 }],
    });

    expect(await aniCuPerioade(ORG_ID)).toEqual([2026, 2025, 2024]);

    const [apel] = server.apeluriPe("payroll_periods");
    expect(apel?.coloane).toBe("an");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    // Tăierea e vizibilă în cod, nu lăsată tăcută pe server.
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [600] });
  });

  it("fără nicio perioadă: listă goală, nu eroare", async () => {
    server.raspunde("payroll_periods", "select", { data: null });
    expect(await aniCuPerioade(ORG_ID)).toEqual([]);
  });

  it("eroarea bazei se propagă", async () => {
    const eroare = eroarePostgrest("42501");
    server.raspunde("payroll_periods", "select", { error: eroare });
    await expect(aniCuPerioade(ORG_ID)).rejects.toBe(eroare);
  });
});

// ── statisticiAnuale ────────────────────────────────────────────────────────

const P_IAN = "p-ian";
const P_FEB = "p-feb";
const P_MAR = "p-mar";

type Intrare = {
  id: string;
  period_id: string;
  employee_id: string;
  zile_concediu_odihna: number;
  zile_concediu_medical: number;
  brut: number;
  net_de_plata: number;
  cost_total_angajator: number;
  nr_tichete: number;
  valoare_tichete: number;
  ore_suplimentare: number;
};

function intrare(id: string, perioada: string, angajat: string, brut: number): Intrare {
  return {
    id,
    period_id: perioada,
    employee_id: angajat,
    zile_concediu_odihna: 1,
    zile_concediu_medical: 2,
    brut,
    net_de_plata: brut * 0.6,
    cost_total_angajator: brut * 1.0225,
    nr_tichete: 20,
    valoare_tichete: 800,
    ore_suplimentare: 3,
  };
}

describe("statisticiAnuale", () => {
  it("un an fără perioade iese devreme, cu totul pe zero și fără alte citiri", async () => {
    server.raspunde("payroll_periods", "select", { data: [] });

    const r = await statisticiAnuale(ORG_ID, 2026);

    expect(r).toEqual({
      an: 2026,
      perAngajat: [],
      perLuna: [],
      luniInCiorna: [],
      luniNecalculate: [],
      perioadeNecalculate: [],
      totalZileConcediuOdihna: 0,
      totalZileConcediuMedical: 0,
      totalVenitBrutAnual: 0,
      totalVenitNetAnual: 0,
      totalCostAngajatorAnual: 0,
      totalTicheteNumar: 0,
      totalTicheteValoare: 0,
      totalOreSuplimentare: 0,
    });
    expect(server.apeluriPe("payroll_entries")).toHaveLength(0);
    expect(server.apeluriPe("employees")).toHaveLength(0);
  });

  it("perioadele se citesc pe organizație și an, ordonate pe lună", async () => {
    server.raspunde("payroll_periods", "select", { data: [] });

    await statisticiAnuale(ORG_ID, 2026);

    const [apel] = server.apeluriPe("payroll_periods");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "an", 2026)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "luna", { ascending: true })).toBe(true);
  });

  /*
   * HR-027: cifrele unei luni în ciornă NU intră în raport. Fie e o perioadă
   * redeschisă (cifrele vechi se vor schimba la recalculare), fie sunt rânduri
   * orfane lăsate de un calcul refuzat de trigger după ce RPC-ul scrisese deja
   * — în ambele cazuri ecranul perioadei le ascunde, iar raportul le aduna.
   * Citirea rămâne una singură, peste toate perioadele, ca să se poată deosebi
   * „ciornă cu cifre vechi" de „necalculată"; doar acumularea e condiționată.
   */
  describe("cu trei luni: aprobată, redeschisă în ciornă, necalculată", () => {
    beforeEach(() => {
      server.raspunde("payroll_periods", "select", {
        data: [
          { id: P_IAN, luna: 1, status: "aprobat" },
          { id: P_FEB, luna: 2, status: "draft" },
          { id: P_MAR, luna: 3, status: "calculat" },
        ],
      });
      server.raspunde("payroll_entries", "select", {
        data: [
          intrare("e1", P_IAN, "ang-b", 5000),
          intrare("e2", P_IAN, "ang-a", 4000),
          intrare("e3", P_FEB, "ang-b", 5500),
          intrare("e4", P_FEB, "ang-sters", 1000),
        ],
      });
      server.raspunde("employees", "select", {
        data: [
          { id: "ang-a", full_name: "Ana Dan", marca: "1" },
          { id: "ang-b", full_name: "Bogdan Ene", marca: "2" },
        ],
      });
    });

    it("seria lunară cuprinde doar lunile cu cifre VALABILE — ciorna redeschisă iese", async () => {
      const r = await statisticiAnuale(ORG_ID, 2026);

      expect(r.perLuna).toEqual([
        {
          periodId: P_IAN,
          luna: 1,
          status: "aprobat",
          totalBrut: 9000,
          totalNet: 5400,
          totalCostAngajator: 9000 * 1.0225,
        },
      ]);
    });

    it("luna redeschisă cu cifre e „în ciornă” ȘI „necalculată”; luna fără nicio intrare doar „necalculată”", async () => {
      const r = await statisticiAnuale(ORG_ID, 2026);
      // Ciorna e semnalată separat (cifrele ei vechi există, dar sunt excluse)…
      expect(r.luniInCiorna).toEqual([2]);
      // …și intră între lunile fără calcul valabil, ca ecranul să ducă la ea.
      expect(r.luniNecalculate).toEqual([2, 3]);
      expect(r.perioadeNecalculate).toEqual([
        { id: P_FEB, luna: 2 },
        { id: P_MAR, luna: 3 },
      ]);
    });

    it("per angajat: doar din lunile valabile; cine avea rând doar în ciornă dispare", async () => {
      const r = await statisticiAnuale(ORG_ID, 2026);

      expect(r.perAngajat.map((a) => [a.fullName, a.marca])).toEqual([
        ["Ana Dan", "1"],
        ["Bogdan Ene", "2"],
      ]);
      expect(r.perAngajat.map((a) => a.exista)).toEqual([true, true]);
      const bogdan = r.perAngajat.find((a) => a.employeeId === "ang-b");
      expect(bogdan).toEqual({
        employeeId: "ang-b",
        fullName: "Bogdan Ene",
        marca: "2",
        exista: true,
        zileConcediuOdihna: 1,
        zileConcediuMedical: 2,
        venitBrutAnual: 5000,
        venitNetAnual: 3000,
        ticheteNumar: 20,
        ticheteValoare: 800,
        oreSuplimentare: 3,
      });
    });

    it("totalurile anuale însumează doar lunile valabile, iar costul vine din același rând", async () => {
      const r = await statisticiAnuale(ORG_ID, 2026);

      expect(r).toMatchObject({
        an: 2026,
        totalZileConcediuOdihna: 2,
        totalZileConcediuMedical: 4,
        totalVenitBrutAnual: 9000,
        totalVenitNetAnual: 5400,
        totalTicheteNumar: 40,
        totalTicheteValoare: 1600,
        totalOreSuplimentare: 6,
      });
      expect(r.totalCostAngajatorAnual).toBeCloseTo(9000 * 1.0225, 6);
      // Costul nu poate fi sub brut când vine din aceleași rânduri.
      expect(r.totalCostAngajatorAnual).toBeGreaterThanOrEqual(r.totalVenitBrutAnual);
    });

    it("angajatul șters rămâne, marcat, când are rând într-o lună valabilă", async () => {
      // Fixtura de mai sus îl are doar în ciornă; aici primește și un rând în
      // ianuarie, ca regula „rămâne, marcat” să fie verificată pe drumul nou.
      server = configureazaActiunea().server;
      server.raspunde("payroll_periods", "select", {
        data: [
          { id: P_IAN, luna: 1, status: "aprobat" },
          { id: P_FEB, luna: 2, status: "draft" },
        ],
      });
      server.raspunde("payroll_entries", "select", {
        data: [intrare("e1", P_IAN, "ang-sters", 1000), intrare("e4", P_FEB, "ang-sters", 1000)],
      });
      server.raspunde("employees", "select", { data: [] });

      const r = await statisticiAnuale(ORG_ID, 2026);

      expect(r.perAngajat).toHaveLength(1);
      expect(r.perAngajat[0]).toMatchObject({
        fullName: "Angajat șters",
        marca: "—",
        exista: false,
        venitBrutAnual: 1000,
      });
    });

    it("o ciornă FĂRĂ rânduri e doar necalculată, nu și „în ciornă”", async () => {
      server = configureazaActiunea().server;
      server.raspunde("payroll_periods", "select", {
        data: [
          { id: P_IAN, luna: 1, status: "aprobat" },
          { id: P_FEB, luna: 2, status: "draft" },
        ],
      });
      server.raspunde("payroll_entries", "select", { data: [intrare("e1", P_IAN, "ang-a", 4000)] });
      server.raspunde("employees", "select", {
        data: [{ id: "ang-a", full_name: "Ana Dan", marca: "1" }],
      });

      const r = await statisticiAnuale(ORG_ID, 2026);

      expect(r.luniInCiorna).toEqual([]);
      expect(r.luniNecalculate).toEqual([2]);
    });

    it("intrările se citesc doar calculate, din perioadele anului, în organizația curentă", async () => {
      await statisticiAnuale(ORG_ID, 2026);

      const [intrari] = server.apeluriPe("payroll_entries");
      expect(areFiltru(intrari, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(intrari, "eq", "status", "calculat")).toBe(true);
      expect(areFiltru(intrari, "in", "period_id", [P_IAN, P_FEB, P_MAR])).toBe(true);
      expect(areFiltru(intrari, "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(intrari, "order", "id", { ascending: true })).toBe(true);
      const [angajati] = server.apeluriPe("employees");
      expect(areFiltru(angajati, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(angajati, "is", "deleted_at", null)).toBe(true);
    });
  });

  it("peste 1000 de intrări: se citește și pagina următoare, keyset după id", async () => {
    server.raspunde("payroll_periods", "select", {
      data: [{ id: P_IAN, luna: 1, status: "inchis" }],
    });
    const pagina1 = Array.from({ length: 1000 }, (_, i) =>
      intrare(`e${String(i).padStart(4, "0")}`, P_IAN, "ang-a", 1),
    );
    server.raspunde("payroll_entries", "select", { data: pagina1 });
    server.raspunde("payroll_entries", "select", { data: [intrare("e9999", P_IAN, "ang-a", 1)] });
    server.raspunde("employees", "select", {
      data: [{ id: "ang-a", full_name: "Ana Dan", marca: "1" }],
    });

    const r = await statisticiAnuale(ORG_ID, 2026);

    expect(r.totalVenitBrutAnual).toBe(1001);
    const [prima, aDoua] = server.apeluriPe("payroll_entries");
    expect(prima?.filtre).toContainEqual({ metoda: "limit", argumente: [1000] });
    expect(areFiltru(prima, "gt", "id")).toBe(false);
    expect(areFiltru(aDoua, "gt", "id", "e0999")).toBe(true);
  });

  it("eroarea pe intrări se propagă, nu iese un raport cu zero", async () => {
    server.raspunde("payroll_periods", "select", {
      data: [{ id: P_IAN, luna: 1, status: "inchis" }],
    });
    const eroare = eroarePostgrest("57014");
    server.raspunde("payroll_entries", "select", { error: eroare });
    server.raspunde("employees", "select", { data: [] });

    await expect(statisticiAnuale(ORG_ID, 2026)).rejects.toBe(eroare);
  });

  it("eroarea pe perioade se propagă", async () => {
    const eroare = eroarePostgrest("42501");
    server.raspunde("payroll_periods", "select", { error: eroare });
    await expect(statisticiAnuale(ORG_ID, 2026)).rejects.toBe(eroare);
  });
});
