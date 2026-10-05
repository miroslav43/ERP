// src/app/(app)/angajati/[id]/documente/optiuni-emitere.test.ts
//
// Caseta „Emite documente" trebuie să spună, pentru FIECARE document, dacă se
// poate emite și de ce nu. Cazul care a născut-o: un angajat la sediu, fără
// fișa postului, cu trei documente emise — butonul vechi spunea doar „Toate
// documentele au fost deja emise".

import { describe, expect, it } from "vitest";

import { optiuniEmitere } from "./optiuni-emitere";

const FIRMA = [{ cod: "doc_cerere", denumire: "Cerere", serie: "CER" }];

describe("optiuniEmitere", () => {
  it("cazul din ecran: trei emise, două care nu se aplică — fiecare cu motivul lui", () => {
    const optiuni = optiuniEmitere({
      codModLucru: "sediu",
      areFisaPostului: false,
      activePeCod: new Map([
        ["contract_munca", "CIM 2026/000003"],
        ["nda", "NDA 2026/000003"],
        ["anexa_proprietate_intelectuala", "API 2026/000003"],
      ]),
      documenteFirma: FIRMA,
    });

    const peCod = new Map(optiuni.map((o) => [o.cod, o]));
    expect(peCod.get("contract_munca")).toMatchObject({ eligibil: false });
    expect(peCod.get("contract_munca")?.detaliu).toContain("CIM 2026/000003");
    expect(peCod.get("fisa_postului")).toMatchObject({
      eligibil: false,
      detaliu: "Angajatul nu are fișa postului completată.",
    });
    expect(peCod.get("act_aditional_telemunca")?.eligibil).toBe(false);
    expect(peCod.get("act_aditional_telemunca")?.detaliu).toContain("telemuncă");
    // Documentul firmei rămâne de emis — exact ce lipsea din ecranul vechi.
    expect(peCod.get("doc_cerere")).toMatchObject({ eligibil: true, grup: "firma" });
  });

  it("toate cinci ale angajării apar mereu, în ordinea de emitere, înaintea celor ale firmei", () => {
    const optiuni = optiuniEmitere({
      codModLucru: "telemunca",
      areFisaPostului: true,
      activePeCod: new Map(),
      documenteFirma: FIRMA,
    });
    expect(optiuni.map((o) => o.cod)).toEqual([
      "contract_munca",
      "fisa_postului",
      "nda",
      "anexa_proprietate_intelectuala",
      "act_aditional_telemunca",
      "doc_cerere",
    ]);
    expect(optiuni.every((o) => o.eligibil)).toBe(true);
  });

  it("fără contract nu se poate emite nimic, iar motivul spune asta", () => {
    const optiuni = optiuniEmitere({
      codModLucru: null,
      areFisaPostului: true,
      activePeCod: new Map(),
      documenteFirma: FIRMA,
    });
    expect(optiuni.some((o) => o.eligibil)).toBe(false);
    for (const o of optiuni) expect(o.detaliu).toContain("contract");
  });
});
