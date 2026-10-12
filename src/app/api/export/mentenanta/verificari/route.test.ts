// src/app/api/export/mentenanta/verificari/route.test.ts
//
// Dosarul de control (M7): porțile (autentificare, modul, `maintenance:export`)
// și cele două formate. Citirile și tenantul sunt înlocuite; ce se verifică e
// ruta: ce refuză, ce format întoarce, că organizația vine din tenant.
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stare = vi.hoisted(() => ({
  rezolvare: { status: "ok" } as Record<string, unknown>,
  poateExporta: true,
  modulActiv: true,
  apeluriAutorizatii: [] as string[],
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
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({
    rpc: vi.fn(async () => ({ data: null, error: null })),
  })),
}));
vi.mock("@/lib/pdf/antet-organizatie", () => ({
  antetOrganizatie: vi.fn(async () => ({
    denumire: "Firma Test S.R.L.",
    formaJuridica: "S.R.L.",
    cui: null,
    regCom: null,
    adresa: null,
    capitalSocial: null,
    capitalVarsat: null,
    sistemDualist: false,
    telefon: null,
    email: null,
    pozitie: "antet",
    sigla: null,
  })),
}));
vi.mock("@/lib/queries/maintenance", () => ({
  autorizatiiIscir: vi.fn(async (organizationId: string) => {
    stare.apeluriAutorizatii.push(organizationId);
    return [
      {
        id: "a1",
        equipment_id: "e1",
        numar: "ISCIR-77",
        tip: "macara",
        emitent: "ISCIR",
        emis_la: "2026-01-10",
        valabil_pana: "2027-06-01",
        scadenta_verificare_tehnica: null,
        conditii: null,
        suspendata_la: null,
        regim: "inregistrat",
        motiv_suspendare: null,
        reactivata_la: null,
        inlocuita_de_id: null,
      },
    ];
  }),
  planuriScadente: vi.fn(async () => ({ randuri: [], total: 0, trunchiat: false })),
  echipamenteDupaId: vi.fn(
    async () => new Map([["e1", { id: "e1", cod: "MAC-1", denumire: "Macara" }]]),
  ),
}));

import { GET } from "./route";

const TENANT = {
  organizationId: "org-din-tenant",
  name: "Firma Test",
  role: "org_admin",
  memberId: "m1",
};

beforeEach(() => {
  stare.rezolvare = {
    status: "ok",
    tenant: TENANT,
    user: { id: "u1", email: "ana@test.ro", fullName: "Ana Pop" },
  };
  stare.poateExporta = true;
  stare.modulActiv = true;
  stare.apeluriAutorizatii = [];
});

const cere = (sufix = ""): Request =>
  new Request(`http://localhost/api/export/mentenanta/verificari${sufix}`);

describe("GET /api/export/mentenanta/verificari", () => {
  it("fără sesiune: 401", async () => {
    stare.rezolvare = { status: "neautentificat" };
    expect((await GET(cere())).status).toBe(401);
  });

  it("modul inactiv sau fără `maintenance:export`: 403, fără nicio citire", async () => {
    stare.modulActiv = false;
    expect((await GET(cere())).status).toBe(403);
    stare.modulActiv = true;
    stare.poateExporta = false;
    expect((await GET(cere("?format=pdf"))).status).toBe(403);
    expect(stare.apeluriAutorizatii).toEqual([]);
  });

  it("implicit: CSV cu antet, organizația din tenant", async () => {
    const raspuns = await GET(cere("?organizatie=alta"));
    expect(raspuns.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    const text = await raspuns.text();
    expect(text).toContain('"Echipament";"Ce"');
    expect(text).toContain('"MAC-1 — Macara";"Autorizație ISCIR"');
    expect(stare.apeluriAutorizatii).toEqual(["org-din-tenant"]);
  });

  it("`?format=pdf`: un PDF valid, descărcat ca atașament", async () => {
    const raspuns = await GET(cere("?format=pdf"));
    expect(raspuns.status).toBe(200);
    expect(raspuns.headers.get("content-type")).toBe("application/pdf");
    expect(raspuns.headers.get("content-disposition")).toMatch(
      /^attachment; filename="dosar-control-verificari-\d{4}-\d{2}-\d{2}\.pdf"$/u,
    );
    const doc = await PDFDocument.load(new Uint8Array(await raspuns.arrayBuffer()));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
