// src/app/api/export/mentenanta/rapoarte/route.test.ts
//
// Exportul CSV al raportului de mentenanță (M8): porțile (autentificare, modul,
// `maintenance:export`), perioada din adresă normalizată ca pe pagină și
// organizația din tenant, nu din cerere. Citirile sunt înlocuite: ce se
// verifică e ruta.
import { beforeEach, describe, expect, it, vi } from "vitest";

const stare = vi.hoisted(() => ({
  rezolvare: { status: "ok" } as Record<string, unknown>,
  poateExporta: true,
  modulActiv: true,
  apeluri: [] as { organizationId: string; perioada: unknown }[],
  audit: [] as unknown[],
}));

vi.mock("@/lib/tenant/resolve-tenant", () => ({
  resolveTenant: vi.fn(async () => stare.rezolvare),
}));
vi.mock("@/lib/auth/permissions", () => ({
  getPermissionMap: vi.fn(async () => new Map()),
  can: vi.fn((_p: unknown, cheie: string) => cheie === "maintenance:export" && stare.poateExporta),
}));
vi.mock("@/lib/auth/features", () => ({
  getEnabledFeatures: vi.fn(async () => new Set(stare.modulActiv ? ["maintenance"] : [])),
}));
vi.mock("@/lib/format/date", async (original) => ({
  ...(await original<typeof import("@/lib/format/date")>()),
  todayInBucharest: () => "2026-10-12",
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({
    rpc: vi.fn(async (_nume: string, argumente: unknown) => {
      stare.audit.push(argumente);
      return { data: null, error: null };
    }),
  })),
}));
vi.mock("@/app/(app)/mentenanta/rapoarte/date-raport", async () => {
  const { calculeazaRaport } = await import("@/domain/maintenance/indicatori");
  return {
    incarcaRaport: vi.fn(async (organizationId: string, perioada: unknown) => {
      stare.apeluri.push({ organizationId, perioada });
      const echipament = {
        id: "e1",
        cod: "CMP-1",
        denumire: "Compresor",
        valoare_achizitie: 5000,
        casat_la: null,
        data_punerii_in_functiune: null,
      };
      return {
        raport: calculeazaRaport({
          perioada: { deLa: "2026-09-01", panaLa: "2026-09-30" },
          azi: "2026-10-12",
          acum: "2026-10-12T09:00:00Z",
          program: { orePeZi: 8, zilePeSaptamana: 5, costOraOprire: null },
          echipamente: [echipament],
          interventii: [],
          executiiPlanuri: [],
          planuri: [],
          sesizari: [],
          opriri: [],
        }),
        echipamente: new Map([["e1", echipament]]),
        citiriRestante: 0,
        pragContorNecititZile: 30,
        costOraOprireSetat: false,
        trunchiate: [],
      };
    }),
  };
});

import { GET } from "./route";

const TENANT = {
  organizationId: "org-din-tenant",
  name: "Firma",
  role: "org_admin",
  memberId: "m1",
};

beforeEach(() => {
  stare.rezolvare = { status: "ok", tenant: TENANT, user: { id: "u1", email: "a@b.ro" } };
  stare.poateExporta = true;
  stare.modulActiv = true;
  stare.apeluri = [];
  stare.audit = [];
});

const cere = (sufix = ""): Request =>
  new Request(`http://localhost/api/export/mentenanta/rapoarte${sufix}`);

describe("GET /api/export/mentenanta/rapoarte", () => {
  it("fără sesiune: 401; fără organizație: 403", async () => {
    stare.rezolvare = { status: "neautentificat" };
    expect((await GET(cere())).status).toBe(401);
    stare.rezolvare = { status: "fara_organizatie" };
    expect((await GET(cere())).status).toBe(403);
  });

  it("modul inactiv sau fără `maintenance:export`: 403, fără nicio citire", async () => {
    stare.modulActiv = false;
    expect((await GET(cere())).status).toBe(403);
    stare.modulActiv = true;
    stare.poateExporta = false;
    const raspuns = await GET(cere());
    expect(raspuns.status).toBe(403);
    expect(await raspuns.text()).toBe("Nu aveți dreptul de a exporta raportul de mentenanță.");
    expect(stare.apeluri).toEqual([]);
  });

  it("CSV pe perioada cerută, organizația din tenant, exportul auditat", async () => {
    const raspuns = await GET(cere("?de_la=2026-09-01&pana_la=2026-09-30&organizatie=alta"));
    expect(raspuns.status).toBe(200);
    expect(raspuns.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(raspuns.headers.get("content-disposition")).toBe(
      'attachment; filename="raport-mentenanta-2026-09-01-2026-09-30.csv"',
    );
    const text = await raspuns.text();
    expect(text).toContain('"Cod";"Denumire";"Intervenții"');
    expect(text).toContain('"CMP-1";"Compresor"');
    expect(stare.apeluri).toEqual([
      { organizationId: "org-din-tenant", perioada: { deLa: "2026-09-01", panaLa: "2026-09-30" } },
    ]);
    expect(stare.audit).toEqual([
      expect.objectContaining({
        p_action: "export",
        p_entity_type: "maintenance_report",
        p_organization_id: "org-din-tenant",
      }),
    ]);
  });

  it("fără perioadă: ultimele 12 luni; capetele inversate se îndreaptă ca pe pagină", async () => {
    await GET(cere());
    await GET(cere("?de_la=2026-09-30&pana_la=2026-09-01"));
    expect(stare.apeluri.map((a) => a.perioada)).toEqual([
      { deLa: "2025-10-13", panaLa: "2026-10-12" },
      { deLa: "2026-09-01", panaLa: "2026-09-30" },
    ]);
  });
});
