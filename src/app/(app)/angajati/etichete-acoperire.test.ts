// src/app/(app)/angajati/etichete-acoperire.test.ts
//
// Hărțile de etichete ale modulului, legate de enum-urile BAZEI
// (`Constants` din `src/types/database.ts`). Trei dintre ele sunt tipate
// `Record<string, string>`, deci compilatorul nu observă o valoare nouă a
// enum-ului — iar ecranul ar afișa atunci valoarea brută („prima_recurenta”).
// Celelalte sunt tipate pe uniune, dar tipul nu apără de o etichetă GOALĂ.

import { describe, expect, it } from "vitest";

import { Constants } from "@/types/database";
import { TIPURI_ACT_IDENTITATE } from "@/domain/reges/operatii";
import { TIPURI_SCUTIRE } from "@/schemas/employee";
import {
  ETICHETE_ACT_IDENTITATE,
  ETICHETE_CONDITII_MUNCA,
  ETICHETE_CONTRACT,
  ETICHETE_DURATA_CONTRACT,
  ETICHETE_GEN,
  ETICHETE_MOD_LUCRU,
  ETICHETE_REGIM_SPECIAL,
  ETICHETE_ROL_CONT,
  ETICHETE_SCUTIRE,
  ETICHETE_STARE_CIVILA,
  ETICHETE_STATUS,
  ETICHETE_TIP_COMPONENTA,
  ROLURI_ADMINISTRATIVE,
  TONURI_STATUS,
  etichetaStare,
  rolAdministrativ,
} from "./etichete";

const ENUMURI = Constants.public.Enums;

describe("fiecare valoare a enum-ului din bază are o etichetă românească, și nimic în plus", () => {
  it.each([
    ["contract_status", ETICHETE_CONTRACT, ENUMURI.contract_status],
    ["work_mode", ETICHETE_MOD_LUCRU, ENUMURI.work_mode],
    ["salary_component_kind", ETICHETE_TIP_COMPONENTA, ENUMURI.salary_component_kind],
    ["employee_status", ETICHETE_STATUS, ENUMURI.employee_status],
    ["gen", ETICHETE_GEN, ENUMURI.gen],
    ["stare_civila", ETICHETE_STARE_CIVILA, ENUMURI.stare_civila],
    ["conditii_munca", ETICHETE_CONDITII_MUNCA, ENUMURI.conditii_munca],
    ["special_regime", ETICHETE_REGIM_SPECIAL, ENUMURI.special_regime],
    ["contract_duration", ETICHETE_DURATA_CONTRACT, ENUMURI.contract_duration],
    ["exemption_type", ETICHETE_SCUTIRE, ENUMURI.exemption_type],
  ] as const)("%s", (_enum, harta, valori) => {
    expect(Object.keys(harta).sort()).toEqual([...valori].sort());
    for (const valoare of valori) {
      const eticheta = (harta as Readonly<Record<string, string>>)[valoare];
      expect(eticheta?.trim().length ?? 0).toBeGreaterThan(0);
      // O etichetă care repetă valoarea brută nu traduce nimic.
      expect(eticheta).not.toBe(valoare);
    }
  });

  it("tipurile de scutire din schemă sunt exact cele din enum-ul bazei", () => {
    expect([...TIPURI_SCUTIRE].sort()).toEqual([...ENUMURI.exemption_type].sort());
  });

  it("actele de identitate REGES au toate etichetă, iar etichetele sunt distincte (alimentează un `<select>`)", () => {
    expect(Object.keys(ETICHETE_ACT_IDENTITATE).sort()).toEqual([...TIPURI_ACT_IDENTITATE].sort());
    const etichete = Object.values(ETICHETE_ACT_IDENTITATE);
    expect(new Set(etichete).size).toBe(etichete.length);
  });

  it("fiecare stare de angajat are un ton de insignă", () => {
    expect(Object.keys(TONURI_STATUS).sort()).toEqual([...ENUMURI.employee_status].sort());
  });

  it("fiecare rol administrativ are etichetă de cont", () => {
    expect(Object.keys(ETICHETE_ROL_CONT).sort()).toEqual([...ROLURI_ADMINISTRATIVE].sort());
  });
});

describe("rolAdministrativ — marginile", () => {
  it.each([
    ["org_admin", "org_admin"],
    ["hr", "hr"],
    ["manager", "manager"],
    ["employee", null],
    ["super_admin", null],
    ["", null],
    ["ORG_ADMIN", null],
    [null, null],
    [undefined, null],
  ] as const)("%j ⇒ %j", (rol, asteptat) => {
    expect(rolAdministrativ(rol)).toBe(asteptat);
  });
});

describe("etichetaStare — reștampilarea „Candidat”", () => {
  it.each([
    ["candidat", "org_admin", "Fără contract"],
    ["candidat", "manager", "Fără contract"],
    ["candidat", null, ETICHETE_STATUS.candidat],
    ["activ", "org_admin", ETICHETE_STATUS.activ],
    ["incetat", "hr", ETICHETE_STATUS.incetat],
  ] as const)("%s + rol %s ⇒ %s", (status, rol, asteptat) => {
    expect(etichetaStare(status, rol)).toBe(asteptat);
  });
});
