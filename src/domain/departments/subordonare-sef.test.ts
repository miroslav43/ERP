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
      sefulDeDeasupra: null,
      caleaSefuluiDeDeasupra: [],
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
      sefulDeDeasupra: null,
      caleaSefuluiDeDeasupra: [],
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
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [],
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
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [],
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
      sefulDeDeasupra: null,
      caleaSefuluiDeDeasupra: [],
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
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [],
      sefAnteriorId: null,
      managerDirectAlSefului: null,
    });
    expect(plan.ridicaSeful).toEqual({ nouManager: null });
  });

  /**
   * Regula pe care o cere structura: șeful unui departament raportează la șeful
   * de deasupra. Se scrie și peste un manager existent — altfel vârful ramurii
   * ar fi singurul punct în care structura desenată și cea reală diverg, adică
   * exact locul din care se citește toată ramura.
   */
  it("așază șeful sub cel de deasupra, chiar dacă avea deja alt manager", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru(SEF, "e-extern")],
      caleaSefului: ["e-extern", SEF],
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [PARINTE],
      sefAnteriorId: null,
      managerDirectAlSefului: "e-extern",
    });
    expect(plan.ridicaSeful).toEqual({ nouManager: PARINTE });
  });

  it("nu rescrie nimic când șeful e deja sub cel de deasupra", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru(SEF, PARINTE)],
      caleaSefului: [PARINTE, SEF],
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [PARINTE],
      sefAnteriorId: null,
      managerDirectAlSefului: PARINTE,
    });
    expect(plan.ridicaSeful).toBeNull();
  });

  it("nu atinge șeful când deasupra nu există niciun șef", () => {
    // Departamentul rădăcină: conducerea n-are deasupra pe cine să raporteze.
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1"), membru(SEF, "e-extern")],
      caleaSefului: ["e-extern", SEF],
      sefulDeDeasupra: null,
      caleaSefuluiDeDeasupra: [],
      sefAnteriorId: null,
      managerDirectAlSefului: "e-extern",
    });
    expect(plan.ridicaSeful).toBeNull();
  });

  it("nu-l așază sub cineva care atârnă chiar de el", () => {
    // `tg_employees_manager_path` ar arunca P0001 și ar anula tot lotul, cu un
    // mesaj despre lanțuri în loc de unul despre ce a apăsat omul.
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [membru("e-1")],
      caleaSefului: [SEF],
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [SEF, PARINTE],
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
      sefulDeDeasupra: null,
      caleaSefuluiDeDeasupra: [],
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
      sefulDeDeasupra: null,
      caleaSefuluiDeDeasupra: [],
      sefAnteriorId: "e-fost-sef",
      managerDirectAlSefului: "e-sef-direct",
    });
    expect(plan.ridicaSeful).toBeNull();
  });

  it("întoarce un plan gol pentru un departament fără oameni și fără șef deasupra", () => {
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [],
      caleaSefului: [SEF],
      sefulDeDeasupra: null,
      caleaSefuluiDeDeasupra: [],
      sefAnteriorId: null,
      managerDirectAlSefului: null,
    });
    expect(plan).toEqual({ ridicaSeful: null, deLegat: [] });
  });

  it("leagă șeful de cel de deasupra chiar dacă departamentul e gol", () => {
    // Un departament nou, cu șef și fără oameni, intră totuși în arbore: altfel
    // vârful ar atârna nicăieri până la prima angajare.
    const plan = planificaSubordonarea({
      sefId: SEF,
      membri: [],
      caleaSefului: [SEF],
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [PARINTE],
      sefAnteriorId: null,
      managerDirectAlSefului: null,
    });
    expect(plan).toEqual({ ridicaSeful: { nouManager: PARINTE }, deLegat: [] });
  });
});

describe("planificaEliberarea", () => {
  const FOST = "e-fost-sef";

  it("scoate din subordinea fostului șef pe cei pe care desemnarea lui i-a legat", () => {
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru("e-1", FOST), membru("e-2", FOST), membru(FOST)],
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [],
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
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [],
    });
    expect(plan.deEliberat).toEqual(["e-3"]);
  });

  it("nu se atinge de fostul șef însuși", () => {
    // Ștergerea lui din dreptul departamentului nu spune nimic despre cui
    // raportează EL.
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru(FOST, "e-directorul")],
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [],
    });
    expect(plan.deEliberat).toEqual([]);
  });

  it("îi lasă fără manager când departamentul n-are părinte", () => {
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru("e-1", FOST)],
      sefulDeDeasupra: null,
      caleaSefuluiDeDeasupra: [],
    });
    expect(plan).toEqual({ deEliberat: ["e-1"], nouManager: null });
  });

  it("nu-i mută sub un șef-părinte care e tot în departament", () => {
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru("e-1", FOST), membru(PARINTE)],
      sefulDeDeasupra: PARINTE,
      caleaSefuluiDeDeasupra: [],
    });
    expect(plan.nouManager).toBeNull();
  });

  it("nu-i mută înapoi sub fostul șef, chiar dacă el conduce și părintele", () => {
    const plan = planificaEliberarea({
      sefAnteriorId: FOST,
      membri: [membru("e-1", FOST)],
      sefulDeDeasupra: FOST,
      caleaSefuluiDeDeasupra: [FOST],
    });
    expect(plan.nouManager).toBeNull();
  });
});
