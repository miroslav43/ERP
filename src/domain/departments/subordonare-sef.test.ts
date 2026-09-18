// src/domain/departments/subordonare-sef.test.ts
import { describe, expect, it } from "vitest";

import { planificaEliberarea, planificaSubordonarea } from "./subordonare-sef";

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
      sefAnteriorId: null,
      managerDirectAlSefului: null,
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
      sefAnteriorId: null,
      managerDirectAlSefului: null,
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
      sefAnteriorId: null,
      managerDirectAlSefului: null,
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
      sefAnteriorId: null,
      managerDirectAlSefului: null,
    });
    expect(plan.ridicaSeful).toEqual({ nouManager: PARINTE });
  });

  it("ridică șeful la nimeni când departamentul n-are părinte", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru(SEF, "e-1")],
      caleaSefului: ["e-1", SEF],
      sefulParinte: null,
      sefAnteriorId: null,
      managerDirectAlSefului: null,
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
      sefAnteriorId: null,
      managerDirectAlSefului: null,
    });
    expect(plan.ridicaSeful).toEqual({ nouManager: null });
  });

  it("nu atinge șeful când lanțul lui nu trece prin departament", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru(SEF, "e-extern")],
      caleaSefului: ["e-extern", SEF],
      sefulParinte: PARINTE,
      sefAnteriorId: null,
      managerDirectAlSefului: null,
    });
    expect(plan.ridicaSeful).toBeNull();
  });

  /**
   * Cazul care a lăsat un director sub un Project Manager, pe date reale.
   *
   * Popescu fusese șeful Conducerii, iar mecanismul îi legase pe membri de el —
   * printre ei directorul. Când directorul a devenit el însuși șeful
   * departamentului, nimic nu-l desfăcea: lanțul lui nu mai trecea prin niciun
   * membru (Popescu plecase în alt departament), deci vechea condiție nu se
   * aprindea. Rămânea atârnat de fostul șef, iar organigrama arăta fidel asta.
   */
  it("ridică noul șef când atârnă chiar de fostul șef al departamentului", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru(SEF, "e-fost-sef")],
      caleaSefului: ["e-fost-sef", SEF],
      sefulParinte: null,
      sefAnteriorId: "e-fost-sef",
      managerDirectAlSefului: "e-fost-sef",
    });
    expect(plan.ridicaSeful).toEqual({ nouManager: null });
  });

  it("nu ridică noul șef când fostul șef e doar mai sus în lanț, nu managerul lui direct", () => {
    // Directorul rămâne deasupra tuturor pe merit. O ridicare „pe toată calea"
    // ar rupe ierarhii legitime în numele simetriei.
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru(SEF, "e-sef-direct")],
      caleaSefului: ["e-fost-sef", "e-sef-direct", SEF],
      sefulParinte: null,
      sefAnteriorId: "e-fost-sef",
      managerDirectAlSefului: "e-sef-direct",
    });
    expect(plan.ridicaSeful).toBeNull();
  });

  it("întoarce un plan gol pentru un departament fără oameni", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [],
      caleaSefului: [SEF],
      sefulParinte: PARINTE,
      sefAnteriorId: null,
      managerDirectAlSefului: null,
    });
    expect(plan).toEqual({ ridicaSeful: null, deLegat: [] });
  });
});

describe("planificaEliberarea", () => {
  const FOST = "e-fost-sef";

  it("scoate din subordinea fostului șef pe cei pe care desemnarea lui i-a legat", () => {
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru("e-1", FOST), membru("e-2", FOST), membru(FOST)],
      sefulParinte: PARINTE,
    });
    expect(plan.deEliberat).toEqual(["e-1", "e-2"]);
    expect(plan.nouManager).toBe(PARINTE);
  });

  it("nu atinge pe cine atârnă de altcineva", () => {
    // Legătura aceea n-a fost scrisă de mecanismul ăsta, deci nu e a lui s-o
    // desfacă. O eliberare „a tuturor" ar fi la fel de tăcută ca defectul.
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru("e-1", "e-altcineva"), membru("e-2", null), membru("e-3", FOST)],
      sefulParinte: PARINTE,
    });
    expect(plan.deEliberat).toEqual(["e-3"]);
  });

  it("nu se atinge de fostul șef însuși", () => {
    // Ștergerea lui din dreptul departamentului nu spune nimic despre cui
    // raportează EL.
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru(FOST, "e-directorul")],
      sefulParinte: PARINTE,
    });
    expect(plan.deEliberat).toEqual([]);
  });

  it("îi lasă fără manager când departamentul n-are părinte", () => {
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru("e-1", FOST)],
      sefulParinte: null,
    });
    expect(plan).toEqual({ deEliberat: ["e-1"], nouManager: null });
  });

  it("nu-i mută sub un șef-părinte care e tot în departament", () => {
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru("e-1", FOST), membru(PARINTE)],
      sefulParinte: PARINTE,
    });
    expect(plan.nouManager).toBeNull();
  });

  it("nu-i mută înapoi sub fostul șef, chiar dacă el conduce și părintele", () => {
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru("e-1", FOST)],
      sefulParinte: FOST,
    });
    expect(plan.nouManager).toBeNull();
  });
});
