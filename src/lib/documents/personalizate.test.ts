// src/lib/documents/personalizate.test.ts
//
// Emiterea unui document creat de firmă. Generatorul (numerotare, amprentă,
// inserare) are testul lui; aici contează două promisiuni ale modulului:
// CNP-ul se decriptează DOAR dacă textul îl cere, iar în `date_document` ajung
// DOAR variabilele folosite.

import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ genereaza: vi.fn(), cnp: vi.fn(), org: vi.fn() }));
vi.mock("./generator", () => ({ genereazaDocument: f.genereaza }));
vi.mock("./inrolare", async (orig) => ({
  ...(await orig<typeof import("./inrolare")>()),
  cnpComplet: f.cnp,
  organizatiaPentruDocumente: f.org,
}));

import { areFiltru, clientFals } from "@/lib/teste/supabase-fals";

import type { ContextInrolare } from "./context-angajat";
import { genereazaDocumentPersonalizat } from "./personalizate";

const ORG = "00000000-0000-4000-8000-000000000001";
const ANGAJAT = "00000000-0000-4000-8000-000000000002";

const CONTEXT: ContextInrolare = {
  organizationId: ORG,
  employeeId: ANGAJAT,
  contractId: "00000000-0000-4000-8000-000000000003",
  azi: "2026-10-05",
  angajat: {
    nume: "Ion Pop",
    adresa: null,
    serieAct: null,
    numarAct: null,
    actEliberatDe: null,
    actEliberatLa: null,
    functie: "Referent",
    departament: null,
  },
  contract: {
    numar: "12",
    dataContract: "2026-09-01",
    dataAngajarii: "2026-09-10",
    durata: "nedeterminată",
    normaOreSaptamana: 40,
    normaOreZi: 8,
    modLucru: "birou",
    locMunca: null,
    locTelemunca: null,
    salariuBrut: 5000,
    zileConcediuAnual: 21,
  },
  codModLucru: "sediu",
  fisaPostului: null,
};

beforeEach(() => {
  f.genereaza.mockReset().mockResolvedValue({ id: "id-emis", numarAfisat: "CER 2026/000001" });
  f.cnp.mockReset().mockResolvedValue("1990101000000");
  f.org.mockReset().mockResolvedValue({ denumire: "Firma SRL", reprezentantLegal: null });
});

function cuSablon(continut_html: string) {
  const db = clientFals();
  db.raspunde("hr_document_templates", "select", { data: { denumire: "Cerere", continut_html } });
  return db;
}

describe("genereazaDocumentPersonalizat", () => {
  it("citește DOAR varianta firmei, activă și neștearsă", async () => {
    const db = cuSablon("<p>{{angajat_nume}}</p>");
    await genereazaDocumentPersonalizat(db.client, {
      context: CONTEXT,
      cod: "doc_cerere",
      emisDe: "u",
    });
    const [citire] = db.apeluriPe("hr_document_templates", "select");
    expect(areFiltru(citire, "eq", "cod", "doc_cerere")).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(citire, "eq", "activ", true)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
  });

  it("fără {{cnp_complet}} în text, CNP-ul NU se decriptează (decriptarea lasă rând de audit)", async () => {
    const db = cuSablon("<p>{{angajat_nume}}, {{functie}}</p>");
    await genereazaDocumentPersonalizat(db.client, {
      context: CONTEXT,
      cod: "doc_cerere",
      emisDe: "u",
    });
    expect(f.cnp).not.toHaveBeenCalled();
  });

  it("cu {{cnp_complet}}, se decriptează o dată, pentru angajatul din context", async () => {
    const db = cuSablon("<p>{{cnp_complet}}</p>");
    await genereazaDocumentPersonalizat(db.client, {
      context: CONTEXT,
      cod: "doc_cerere",
      emisDe: "u",
    });
    expect(f.cnp).toHaveBeenCalledTimes(1);
    expect(f.cnp.mock.calls[0]?.[1]).toBe(ANGAJAT);
    const valori = f.genereaza.mock.calls[0]?.[1].valori as ReadonlyMap<string, string>;
    expect(valori.get("cnp_complet")).toBe("1990101000000");
  });

  it("generatorul primește DOAR variabilele folosite (salariul nu ajunge în date_document)", async () => {
    const db = cuSablon("<p>{{angajat_nume}} — {{durata_confidentialitate}} — {{atributii}}</p>");
    const emis = await genereazaDocumentPersonalizat(db.client, {
      context: CONTEXT,
      cod: "doc_cerere",
      emisDe: "u",
    });

    const parametri = f.genereaza.mock.calls[0]?.[1];
    expect(parametri).toMatchObject({
      organizationId: ORG,
      employeeId: ANGAJAT,
      codSablon: "doc_cerere",
      emisDe: "u",
    });
    expect(Object.fromEntries(parametri.valori as ReadonlyMap<string, string>)).toEqual({
      angajat_nume: "Ion Pop",
      durata_confidentialitate: "doi ani",
      // Fără fișa postului: textul de rezervă, nu golul care ar opri emiterea.
      atributii: "—",
    });
    expect(emis).toEqual({
      cod: "doc_cerere",
      denumire: "Cerere",
      id: "id-emis",
      numarAfisat: "CER 2026/000001",
    });
  });

  it("șablonul nu mai există: NEGASIT, nimic emis", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", { data: null });
    await expect(
      genereazaDocumentPersonalizat(db.client, {
        context: CONTEXT,
        cod: "doc_cerere",
        emisDe: "u",
      }),
    ).rejects.toMatchObject({ code: "NEGASIT" });
    expect(f.genereaza).not.toHaveBeenCalled();
  });

  it("un cod de înrolare nu trece pe aici: refuz fără nicio citire", async () => {
    const db = clientFals();
    await expect(
      genereazaDocumentPersonalizat(db.client, {
        context: CONTEXT,
        cod: "contract_munca",
        emisDe: "u",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.apeluri).toHaveLength(0);
  });
});
