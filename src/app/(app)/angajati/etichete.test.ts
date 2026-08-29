// src/app/(app)/angajati/etichete.test.ts

import { describe, expect, it } from "vitest";

import { ETICHETE_STATUS, etichetaStare, rolAdministrativ } from "./etichete";

describe("rolul contului, îngustat pentru insignă", () => {
  it("recunoaște cele trei roluri administrative", () => {
    expect(rolAdministrativ("org_admin")).toBe("org_admin");
    expect(rolAdministrativ("hr")).toBe("hr");
    expect(rolAdministrativ("manager")).toBe("manager");
  });

  it("respinge `employee` — insigna pe fiecare rând nu distinge pe nimeni", () => {
    expect(rolAdministrativ("employee")).toBeNull();
  });

  it("respinge `super_admin`, care nu poate exista în organization_members", () => {
    // Schema are CHECK care îl interzice acolo; sursa lui e `platform_admins`.
    expect(rolAdministrativ("super_admin")).toBeNull();
  });

  it("nu se sperie de absență sau de o valoare necunoscută", () => {
    expect(rolAdministrativ(null)).toBeNull();
    expect(rolAdministrativ(undefined)).toBeNull();
    expect(rolAdministrativ("contabil_sef")).toBeNull();
  });
});

describe("eticheta stării", () => {
  it("reștampilează „Candidat” DOAR pentru un cont cu rol", () => {
    expect(etichetaStare("candidat", "org_admin")).toBe("Fără contract");
    expect(etichetaStare("candidat", "hr")).toBe("Fără contract");
  });

  it("lasă neatins candidatul adevărat la angajare", () => {
    // Nu are cont, deci nu are rol — fluxul de recrutare rămâne cum era.
    expect(etichetaStare("candidat", null)).toBe("Candidat");
  });

  it("nu atinge nicio altă stare, nici pentru administrator", () => {
    expect(etichetaStare("activ", "org_admin")).toBe("Activ");
    expect(etichetaStare("suspendat", "org_admin")).toBe("Suspendat");
    expect(etichetaStare("incetat", "org_admin")).toBe("Contract încetat");
  });

  it("acoperă toate stările din enum, cu rol și fără", () => {
    // Poarta care prinde o stare adăugată în bază fără eticheta ei: dacă
    // enum-ul crește, `ETICHETE_STATUS` nu mai compilează, iar bucla asta
    // confirmă că funcția chiar trece prin toate.
    for (const stare of Object.keys(ETICHETE_STATUS) as (keyof typeof ETICHETE_STATUS)[]) {
      expect(etichetaStare(stare, null)).toBe(ETICHETE_STATUS[stare]);
      expect(etichetaStare(stare, "manager")).not.toBe("");
    }
  });
});
