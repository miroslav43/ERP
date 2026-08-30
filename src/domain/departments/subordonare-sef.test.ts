// src/domain/departments/subordonare-sef.test.ts
import { describe, expect, it } from "vitest";

import { planificaSubordonarea } from "./subordonare-sef";

/**
 * Ordinea scrierilor NU e un detaliu de implementare, e o condiție de
 * corectitudine: `tg_employees_manager_path` (0004_hr.sql:798) ARUNCĂ `P0001` la
 * ciclu, iar un UPDATE în masă pică întreg dacă un singur rând l-ar produce.
 * De aceea planul are două câmpuri, nu o listă: întâi se ridică șeful din lanț,
 * abia apoi se leagă oamenii de el.
 */

const SEF = "e-sef";
const PARINTE = "e-sef-parinte";

function membru(id: string, managerEmployeeId: string | null = null) {
  return { id, managerEmployeeId };
}

describe("planificaSubordonarea", () => {
  it("leagă toți membrii de șef, mai puțin pe el însuși", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru("e-2", "e-alt-manager"), membru(SEF)],
      caleaSefului: [SEF],
      sefulParinte: null,
    });
    expect(plan.deLegat).toEqual(["e-1", "e-2"]);
    expect(plan.ridicaSeful).toBeNull();
  });

  it("sare peste cei care îl au deja pe șef ca manager", () => {
    // Fără filtrul ăsta, fiecare salvare ar rescrie fișe neschimbate: `updated_at`
    // s-ar mișca degeaba, iar jurnalul s-ar umple cu modificări care nu sunt.
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1", SEF), membru("e-2")],
      caleaSefului: [SEF],
      sefulParinte: null,
    });
    expect(plan.deLegat).toEqual(["e-2"]);
  });

  it("ridică șeful din lanț când managerul lui e chiar în departament", () => {
    // Ciclul: e-1 ar primi ca manager pe SEF, iar SEF îl are pe e-1 în cale.
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru(SEF, "e-1")],
      caleaSefului: ["e-1", SEF],
      sefulParinte: PARINTE,
    });
    expect(plan.ridicaSeful).toEqual({ nouManager: PARINTE });
    expect(plan.deLegat).toEqual(["e-1"]);
  });

  it("ridică șeful și când legătura e indirectă, prin cineva din afară", () => {
    // SEF → e-extern → e-1, iar e-1 e membru: după legare lanțul s-ar închide.
    // Verificarea se face pe TOATĂ calea, nu doar pe managerul direct.
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru(SEF, "e-extern")],
      caleaSefului: ["e-1", "e-extern", SEF],
      sefulParinte: PARINTE,
    });
    expect(plan.ridicaSeful).toEqual({ nouManager: PARINTE });
  });

  it("ridică șeful la nimeni când departamentul n-are părinte", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru(SEF, "e-1")],
      caleaSefului: ["e-1", SEF],
      sefulParinte: null,
    });
    expect(plan.ridicaSeful).toEqual({ nouManager: null });
  });

  it("nu ridică șeful sub un părinte care e tot în departament", () => {
    // Altfel am muta ciclul cu un pas mai încolo, în loc să-l rupem.
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru(PARINTE), membru(SEF, "e-1")],
      caleaSefului: ["e-1", SEF],
      sefulParinte: PARINTE,
    });
    expect(plan.ridicaSeful).toEqual({ nouManager: null });
  });

  it("nu atinge șeful când lanțul lui nu trece prin departament", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru(SEF, "e-extern")],
      caleaSefului: ["e-extern", SEF],
      sefulParinte: PARINTE,
    });
    expect(plan.ridicaSeful).toBeNull();
  });

  it("întoarce un plan gol pentru un departament fără oameni", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [],
      caleaSefului: [SEF],
      sefulParinte: PARINTE,
    });
    expect(plan).toEqual({ ridicaSeful: null, deLegat: [] });
  });
});
