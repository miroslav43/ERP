// src/domain/departments/manager-membru.test.ts
import { describe, expect, it } from "vitest";

import { decideApartenentaManagerului } from "./manager-membru";

/**
 * Cazurile de mai jos vin dintr-un defect raportat de utilizator, nu dintr-o
 * ipoteză: desemnarea unui manager scria DOAR `departments.manager_employee_id`,
 * iar omul apărea pe card ca manager și lipsea din lista de membri și din
 * efectiv — fiindcă acelea se citesc din `employees.department_id`, o coloană cu
 * care prima n-avea nicio legătură.
 */

const DEPT = "d-productie";
const ALT_DEPT = "d-vanzari";
const OM = "e-pop-radu";

describe("decideApartenentaManagerului", () => {
  it("nu face nimic când managerul e scos (nedesemnat)", () => {
    expect(
      decideApartenentaManagerului({
        managerId: null,
        departamentId: DEPT,
        departamentActiv: true,
        departamentulManagerului: null,
        mutaDinAltDepartament: true,
      }),
    ).toEqual({ fel: "nimic", motiv: "fara_manager" });
  });

  it("nu face nimic când managerul e deja membru al departamentului", () => {
    expect(
      decideApartenentaManagerului({
        managerId: OM,
        departamentId: DEPT,
        departamentActiv: true,
        departamentulManagerului: DEPT,
        mutaDinAltDepartament: false,
      }),
    ).toEqual({ fel: "nimic", motiv: "deja_membru" });
  });

  it("repartizează tăcut un manager nerepartizat, chiar fără bifă", () => {
    // Cazul obișnuit și fără ambiguitate: nu se pierde nicio apartenență,
    // fiindcă omul n-avea niciuna. Bifa nu-l privește.
    expect(
      decideApartenentaManagerului({
        managerId: OM,
        departamentId: DEPT,
        departamentActiv: true,
        departamentulManagerului: null,
        mutaDinAltDepartament: false,
      }),
    ).toEqual({ fel: "repartizeaza", employeeId: OM, dinAltDepartament: false });
  });

  it("mută managerul din alt departament DOAR cu bifa pornită", () => {
    expect(
      decideApartenentaManagerului({
        managerId: OM,
        departamentId: DEPT,
        departamentActiv: true,
        departamentulManagerului: ALT_DEPT,
        mutaDinAltDepartament: true,
      }),
    ).toEqual({ fel: "repartizeaza", employeeId: OM, dinAltDepartament: true });
  });

  it("lasă managerul în departamentul lui când bifa e stinsă", () => {
    // Starea asta e legitimă și rămâne posibilă: cineva care conduce „Producție"
    // fără să facă parte din ea. Ecranul o arată, nu o corectează pe la spate.
    expect(
      decideApartenentaManagerului({
        managerId: OM,
        departamentId: DEPT,
        departamentActiv: true,
        departamentulManagerului: ALT_DEPT,
        mutaDinAltDepartament: false,
      }),
    ).toEqual({ fel: "nimic", motiv: "mutare_refuzata" });
  });

  it("nu confundă un departament necunoscut apelantului cu absența lui", () => {
    // `departamentulManagerului` poate fi un id pe care RLS nu-l lasă să se
    // vadă. Nu e `null`, deci NU se repartizează tăcut: intră pe ramura cu bifă.
    expect(
      decideApartenentaManagerului({
        managerId: OM,
        departamentId: DEPT,
        departamentActiv: true,
        departamentulManagerului: "d-invizibil",
        mutaDinAltDepartament: false,
      }),
    ).toEqual({ fel: "nimic", motiv: "mutare_refuzata" });
  });

  it("nu repopulează un departament dezactivat, nici cu bifa pornită", () => {
    // `dezactiveazaDepartament` refuză închiderea până când departamentul e gol,
    // dar nu golește `manager_employee_id`. O redenumire a departamentului
    // închis n-are voie să-i strecoare înapoi exact o persoană.
    expect(
      decideApartenentaManagerului({
        managerId: OM,
        departamentId: DEPT,
        departamentActiv: false,
        departamentulManagerului: null,
        mutaDinAltDepartament: true,
      }),
    ).toEqual({ fel: "nimic", motiv: "departament_inactiv" });
  });

  it("nu se plânge de inactivitate când managerul e deja înăuntru", () => {
    // Ordinea regulilor contează: cine e deja membru nu se mișcă nicăieri, deci
    // n-are ce încălca. Altfel un departament dezactivat cu managerul lui
    // înăuntru ar raporta la fiecare salvare un motiv care nu-l privește.
    expect(
      decideApartenentaManagerului({
        managerId: OM,
        departamentId: DEPT,
        departamentActiv: false,
        departamentulManagerului: DEPT,
        mutaDinAltDepartament: false,
      }),
    ).toEqual({ fel: "nimic", motiv: "deja_membru" });
  });
});
