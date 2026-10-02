// src/lib/registru/document-generat.test.ts
//
// Al doilea drum spre registru: documentele generate la cerere. Regula de
// aur e „fără număr, fără document": funcția nu aruncă, dar pe orice eșec
// întoarce `ok: false`, iar apelantul nu continuă.

import { describe, expect, it } from "vitest";

import { clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { inregistreazaDocumentGenerat, numarPentruFisier } from "./document-generat";

const ORG = "11111111-1111-4111-8111-111111111111";
const ENTITATE = "55555555-5555-4555-8555-555555555555";

describe("inregistreazaDocumentGenerat", () => {
  it("cheamă RPC-ul cu organizația, tipul și idempotența pe entitate", async () => {
    const fals = clientFals();
    fals.raspundeRpc("inregistreaza_document_generat", { data: "12/03.09.2026" });

    const r = await inregistreazaDocumentGenerat(fals.client, {
      organizationId: ORG,
      tip: "stat_plata",
      rezumat: "Stat de plată august 2026",
      entitateTip: "payroll_period",
      entitateId: ENTITATE,
    });

    expect(r).toEqual({ ok: true, numarAfisat: "12/03.09.2026" });
    expect(fals.apeluriRpc).toEqual([
      {
        nume: "inregistreaza_document_generat",
        argumente: {
          p_organization_id: ORG,
          p_tip_document: "stat_plata",
          p_continut_rezumat: "Stat de plată august 2026",
          p_entitate_tip: "payroll_period",
          p_entitate_id: ENTITATE,
          p_punct_lucru_id: null,
        },
      },
    ]);
  });

  it("fără entitate și fără punct de lucru trimite null explicit, nu undefined", async () => {
    const fals = clientFals();
    fals.raspundeRpc("inregistreaza_document_generat", { data: "1/02.01.2026" });

    await inregistreazaDocumentGenerat(fals.client, {
      organizationId: ORG,
      tip: "d112",
      rezumat: "D112",
      entitateTip: "d112",
    });

    const argumente = fals.apeluriRpc[0]?.argumente as Record<string, unknown>;
    expect(argumente.p_entitate_id).toBeNull();
    expect(argumente.p_punct_lucru_id).toBeNull();
  });

  it("rezumatul se taie la 500 de caractere (art. 9: rezumat, nu text integral)", async () => {
    const fals = clientFals();
    fals.raspundeRpc("inregistreaza_document_generat", { data: "1/02.01.2026" });

    await inregistreazaDocumentGenerat(fals.client, {
      organizationId: ORG,
      tip: "fluturas",
      rezumat: "r".repeat(800),
      entitateTip: "payroll_entry",
    });

    const argumente = fals.apeluriRpc[0]?.argumente as Record<string, unknown>;
    expect(argumente.p_continut_rezumat).toHaveLength(500);
  });

  it("eroarea bazei devine `ok: false` cu mesajul ei, tăiat la 300", async () => {
    const fals = clientFals();
    fals.raspundeRpc("inregistreaza_document_generat", {
      error: eroarePostgrest("P0001", `Registrul pe anul 2025 este închis.${"!".repeat(400)}`),
    });

    const r = await inregistreazaDocumentGenerat(fals.client, {
      organizationId: ORG,
      tip: "nota_contabila",
      rezumat: "Notă",
      entitateTip: "x",
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.mesaj.startsWith("Registrul pe anul 2025 este închis.")).toBe(true);
    expect(r.mesaj).toHaveLength(300);
  });

  it.each([
    ["null", null],
    ["șir gol", ""],
    ["număr", 437],
  ])("un răspuns fără număr (%s) e eșec, nu document fără număr", async (_e, data) => {
    const fals = clientFals();
    fals.raspundeRpc("inregistreaza_document_generat", { data });

    const r = await inregistreazaDocumentGenerat(fals.client, {
      organizationId: ORG,
      tip: "ordin_bancar",
      rezumat: "Ordin",
      entitateTip: "x",
    });

    expect(r).toEqual({ ok: false, mesaj: "Registrul nu a întors un număr de înregistrare." });
  });
});

describe("numarPentruFisier", () => {
  it.each([
    ["437/02.09.2026", "437-02.09.2026"],
    ["1/01.01.2026", "1-01.01.2026"],
    ["CIM 2026/000012", "CIM-2026-000012"],
    ["a//b", "a-b"],
    ["ș\\ț:x", "ș-ț-x"],
    ["fără_schimbare-1.2", "fără_schimbare-1.2"],
    ["", ""],
  ])("%j ⇒ %j (fără separatori de cale)", (intrare, asteptat) => {
    expect(numarPentruFisier(intrare)).toBe(asteptat);
  });

  it("rezultatul nu conține niciodată bară sau bară inversă", () => {
    const rezultat = numarPentruFisier("../../etc/passwd\\x");
    expect(rezultat).not.toMatch(/[/\\]/);
  });
});
