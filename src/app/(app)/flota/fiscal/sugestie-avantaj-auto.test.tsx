// src/app/(app)/flota/fiscal/sugestie-avantaj-auto.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FapteAvantajAlocare } from "@/lib/queries/flota-fiscal";

/*
  Componenta de SERVER se randează aici ca funcție async: citirea (`server-only`)
  e înlocuită cu faptele de la bază. Ce se probează e ce SPUNE ecranul —
  sugestia, temeiul, avertismentele — nu RLS-ul funcției (acela e în
  `tests/rls/proba-flota-fiscal.sql`).
*/
const avantajeNaturaAuto = vi.fn();
vi.mock("@/lib/queries/flota-fiscal", () => ({
  avantajeNaturaAuto: (...a: unknown[]) => avantajeNaturaAuto(...a),
}));

import { SugestieAvantajAuto } from "./sugestie-avantaj-auto";

const ORG = "11111111-1111-4111-8111-111111111111";
const ANG = "22222222-2222-4222-8222-222222222222";

function alocare(suprascrieri: Partial<FapteAvantajAlocare> = {}): FapteAvantajAlocare {
  return {
    assignment_id: "a1",
    vehicle_id: "v1",
    vehicul_nr: "B-01-ABC",
    de_la: "2026-10-01T07:00:00+00:00",
    pana_la: null,
    regim: "exceptat_categorie",
    titlu_folosinta: "proprietate",
    valoare_intrare: 85000,
    chirie_lunara: null,
    regim_impozitare: "profit",
    ...suprascrieri,
  };
}

async function randeaza(): Promise<void> {
  render(await SugestieAvantajAuto({ organizationId: ORG, employeeId: ANG, azi: "2026-10-12" }));
}

beforeEach(() => {
  avantajeNaturaAuto.mockReset();
  avantajeNaturaAuto.mockResolvedValue([]);
});

describe("SugestieAvantajAuto", () => {
  it("fără alocare cu folosință personală în luna curentă sau în cea trecută, nu se randează nimic", async () => {
    const rezultat = await SugestieAvantajAuto({
      organizationId: ORG,
      employeeId: ANG,
      azi: "2026-10-12",
    });
    expect(rezultat).toBeNull();
    // Două luni, în paralel: octombrie (curentă) și septembrie (trecută).
    expect(avantajeNaturaAuto).toHaveBeenCalledWith(ORG, ANG, "2026-10");
    expect(avantajeNaturaAuto).toHaveBeenCalledWith(ORG, ANG, "2026-09");
  });

  it("1,7% din valoarea de intrare, cu formula, temeiul și ce are de făcut omul de la salarizare", async () => {
    avantajeNaturaAuto.mockImplementation((_o: string, _e: string, luna: string) =>
      Promise.resolve(luna === "2026-10" ? [alocare()] : []),
    );
    await randeaza();
    expect(screen.getByRole("heading", { name: /Avantaj în natură/u })).toBeTruthy();
    expect(screen.getByText("B-01-ABC")).toBeTruthy();
    expect(screen.getByText(/1,7% × 85\.000,00 lei = 1\.445,00 lei pe lună/u)).toBeTruthy();
    expect(screen.getByText(/titlul IV pct\. 12 alin\. \(5\) lit\. a\)/u)).toBeTruthy();
    expect(screen.getByText(/Se adaugă manual, pentru octombrie 2026/u)).toBeTruthy();
    // Nu scrie nimic singură: spune-o pe față.
    expect(screen.getByText(/nimic nu intră pe statul de plată/u)).toBeTruthy();
  });

  it("firma micro: motivul, fără nicio sumă și fără îndemnul de a adăuga ceva", async () => {
    avantajeNaturaAuto.mockResolvedValue([alocare({ regim_impozitare: "micro" })]);
    await randeaza();
    expect(screen.getAllByText(/impozitul microîntreprinderilor/u).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Se adaugă manual/u)).toBeNull();
    expect(screen.queryByText(/pe lună$/u)).toBeNull();
  });

  it("regimul firmei nestabilit: cere completarea lui, nu inventează o sumă", async () => {
    avantajeNaturaAuto.mockResolvedValue([alocare({ regim_impozitare: null })]);
    await randeaza();
    expect(screen.getAllByText(/Regimul de impozitare al firmei nu e stabilit/u).length).toBe(2);
    expect(screen.queryByText(/lei pe lună/u)).toBeNull();
  });

  it("vehiculul „exclusiv economic” primește sugestia ȘI avertismentul contradicției", async () => {
    avantajeNaturaAuto.mockResolvedValue([alocare({ regim: "integral_exclusiv_economic" })]);
    await randeaza();
    expect(screen.getAllByText(/contrazice regimul/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/lei pe lună/u).length).toBeGreaterThan(0);
  });

  it("alocarea încheiată arată intervalul, iar formula pe km personali e spusă o dată la capăt", async () => {
    avantajeNaturaAuto.mockResolvedValue([
      alocare({ de_la: "2026-09-02T07:00:00+00:00", pana_la: "2026-09-20T15:00:00+00:00" }),
    ]);
    await randeaza();
    expect(screen.getAllByText(/02\.09\.2026 – 20\.09\.2026/u).length).toBeGreaterThan(0);
    expect(screen.getByText(/kilometrii parcurși în interes personal/u)).toBeTruthy();
  });
});
