import { describe, expect, it } from "vitest";

import {
  antetFirmaDinParametri,
  avertismentCui,
  MAX_COMPARTIMENT,
  MAX_CUI,
  MAX_FIRMA,
  randAntetFirma,
} from "./antet-firma";

/**
 * Auditul din 8 oct 2026: foaia de pontaj n-avea niciun câmp de antet, iar
 * condica doar „firma”. Inspectorul primește o foaie care nu spune al cui e.
 */
describe("antetul de firmă al documentelor de pontaj", () => {
  it("citește firma, CUI-ul și compartimentul, cu spațiile strânse", () => {
    const a = antetFirmaDinParametri(
      new URLSearchParams({
        firma: "  Construct   SRL ",
        cui: " RO 14399840 ",
        compartiment: "Producție",
      }),
    );
    expect(a).toEqual({ firma: "Construct SRL", cui: "RO 14399840", compartiment: "Producție" });
  });

  it("lipsa câmpurilor dă șiruri goale, nu `null`", () => {
    expect(antetFirmaDinParametri(new URLSearchParams())).toEqual({
      firma: "",
      cui: "",
      compartiment: "",
    });
  });

  it("taie la plafoane și scoate caracterele de control și pe cele de lățime zero", () => {
    const a = antetFirmaDinParametri(
      new URLSearchParams({
        firma: `Firma\u000CSRL​${"F".repeat(500)}`,
        cui: "1".repeat(50),
        compartiment: `Depozit\u001F${"x".repeat(500)}`,
      }),
    );
    expect(a.firma.startsWith("Firma SRL")).toBe(true);
    expect(a.firma.length).toBeLessThanOrEqual(MAX_FIRMA);
    expect(a.cui.length).toBeLessThanOrEqual(MAX_CUI);
    expect(a.compartiment.length).toBeLessThanOrEqual(MAX_COMPARTIMENT);
    for (const v of Object.values(a)) {
      expect(v).not.toMatch(/[\u0000-\u001F\u007F​-‍﻿]/u);
    }
  });

  it("rândul de antet unește doar câmpurile completate", () => {
    expect(randAntetFirma({ firma: "Construct SRL", cui: "14399840", compartiment: "" })).toBe(
      "Construct SRL · CUI 14399840",
    );
    expect(randAntetFirma({ firma: "", cui: "", compartiment: "Bucătărie" })).toBe(
      "Compartiment: Bucătărie",
    );
    expect(randAntetFirma({ firma: "", cui: "", compartiment: "" })).toBeNull();
  });

  it("un CUI cu cifra de control greșită dă avertisment, dar nu e șters", () => {
    const a = { firma: "X", cui: "14399841", compartiment: "" };
    const mesaj = avertismentCui(a);
    expect(mesaj).toMatch(/cifra de control/u);
    expect(mesaj?.endsWith(".")).toBe(true);
    expect(randAntetFirma(a)).toBe("X · CUI 14399841");
  });

  it("un CUI valid, cu sau fără RO și spații, nu dă avertisment", () => {
    for (const cui of ["14399840", "RO 14399840", "ro14399840", ""]) {
      expect(avertismentCui({ firma: "", cui, compartiment: "" })).toBeNull();
    }
  });
});
