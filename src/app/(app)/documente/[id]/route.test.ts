// src/app/(app)/documente/[id]/route.test.ts
//
// Ruta care arată un document emis: HTML de tipărit sau, cu `?format=pdf`, PDF
// compus din HTML-ul STOCAT. RLS decide cine vede documentul; ruta adaugă doar
// sesiunea, organizația activă și filtrul explicit pe ea.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

const falsuriPdf = vi.hoisted(() => ({ antetOrganizatie: vi.fn(), pdfDinDocument: vi.fn() }));
vi.mock("@/lib/pdf/antet-organizatie", async (orig) => ({
  ...(await orig<typeof import("@/lib/pdf/antet-organizatie")>()),
  antetOrganizatie: falsuriPdf.antetOrganizatie,
}));
vi.mock("@/lib/pdf/din-html", () => ({ pdfDinDocument: falsuriPdf.pdfDinDocument }));

import { configureazaActiunea, ID_1, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { GET } from "./route";

const ANTET = {
  denumire: "Firma Test SRL",
  formaJuridica: "SRL",
  cui: "RO123",
  regCom: null,
  adresa: null,
  capitalSocial: null,
  capitalVarsat: null,
  sistemDualist: false,
  telefon: null,
  email: null,
  pozitie: "antet",
  sigla: null,
} as const;

const documentStocat = {
  numar_afisat: "CIM 2026/000012",
  titlu: "Contract individual de muncă",
  continut_html: "<p>Textul contractului</p>",
  continut_checksum: "f".repeat(64),
  cod_verificare: "cod-1",
};

const cere = (cautare = "") =>
  GET(new Request(`https://app.test/documente/${ID_1}${cautare}`), {
    params: Promise.resolve({ id: ID_1 }),
  });

beforeEach(() => {
  falsuriPdf.antetOrganizatie.mockReset();
  falsuriPdf.pdfDinDocument.mockReset();
  falsuriPdf.antetOrganizatie.mockResolvedValue(ANTET);
});

describe("GET /documente/[id]", () => {
  it("fără sesiune: 401, fără nicio citire", async () => {
    const { server } = configureazaActiunea({ sesiune: "neautentificat" });
    const r = await cere();
    expect(r.status).toBe(401);
    expect(r.headers.get("content-type")).toContain("text/plain");
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără organizație activă: 403", async () => {
    const { server } = configureazaActiunea({ sesiune: "fara_organizatie" });
    const r = await cere();
    expect(r.status).toBe(403);
    expect(server.apeluri).toHaveLength(0);
  });

  it("documentul inexistent sau ascuns de RLS: 404, fără antet citit", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("hr_issued_documents", "select", { data: null });
    const r = await cere();
    expect(r.status).toBe(404);
    expect(falsuriPdf.antetOrganizatie).not.toHaveBeenCalled();
  });

  it("eroarea de citire: 500 cu text simplu, fără detaliile bazei", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("hr_issued_documents", "select", {
      error: eroarePostgrest("57014", "detaliu intern"),
    });
    const r = await cere();
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain("detaliu intern");
  });

  it("HTML de tipărit: documentul organizației active, viu, cu antetul firmei, fără cache", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("hr_issued_documents", "select", { data: documentStocat });

    const r = await cere();

    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("cache-control")).toBe("no-store");
    const html = await r.text();
    expect(html).toContain("<p>Textul contractului</p>");
    expect(html).toContain("Nr. CIM 2026/000012");
    expect(html).toContain("Firma Test SRL");
    const [apel] = server.apeluriPe("hr_issued_documents");
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    // Denumirea legală bate denumirea uzuală pe un document oficial.
    expect(falsuriPdf.antetOrganizatie).toHaveBeenCalledWith(
      server.client,
      ORG_ID,
      "Firma Test SRL",
    );
    expect(falsuriPdf.pdfDinDocument).not.toHaveBeenCalled();
  });

  it("`?format=pdf`: PDF din HTML-ul STOCAT, inline, cu amprenta scurtă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("hr_issued_documents", "select", { data: documentStocat });
    falsuriPdf.pdfDinDocument.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));

    const r = await cere("?format=pdf");

    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-disposition")).toBe(
      'inline; filename="contract-individual-de-munca-cim-2026-000012.pdf"',
    );
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(falsuriPdf.pdfDinDocument).toHaveBeenCalledWith({
      html: "<p>Textul contractului</p>",
      numarAfisat: "CIM 2026/000012",
      titlu: "Contract individual de muncă",
      organizatie: ANTET,
      codVerificare: "cod-1",
      amprenta: "f".repeat(16),
    });
  });

  it("`&descarca=1`: atașament, nu filă nouă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("hr_issued_documents", "select", { data: documentStocat });
    falsuriPdf.pdfDinDocument.mockResolvedValue(new Uint8Array([1]));
    const r = await cere("?format=pdf&descarca=1");
    expect(r.headers.get("content-disposition")).toMatch(/^attachment; filename="/);
  });

  it("câmpuri stocate lipsă nu rup randarea", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("hr_issued_documents", "select", {
      data: {
        ...documentStocat,
        continut_html: null,
        continut_checksum: null,
        cod_verificare: null,
      },
    });
    const r = await cere();
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("Cod de verificare: ");
  });
});
