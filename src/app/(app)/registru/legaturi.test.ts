// src/app/(app)/registru/legaturi.test.ts
//
// Harta de la rândul de registru la ecranul documentului-sursă. Funcție pură:
// nu aruncă niciodată, iar ce n-are ecran întoarce `null`, nu o adresă inventată.

import { describe, expect, it } from "vitest";

import { legaturaDocument, TIPURI_CU_PARINTE } from "./legaturi";

const ID = "11111111-1111-4111-8111-111111111111";
const ANG = "22222222-2222-4222-8222-222222222222";
const PARINTE = "33333333-3333-4333-8333-333333333333";

describe("legaturaDocument", () => {
  it.each([
    ["leave_requests", `/concedii/${ID}`],
    ["business_trips", `/diurna/${ID}`],
    ["trip_sheets", `/flota/foi/${ID}`],
    ["work_accidents", `/ssm/accidente/${ID}`],
    ["payroll_periods", `/salarizare/${ID}`],
    ["payroll_periods_bancar", `/salarizare/${ID}`],
    ["payroll_periods_nota", `/salarizare/${ID}`],
    ["payroll_periods_d112", `/salarizare/${ID}`],
    ["payroll_periods_d112_rect", `/salarizare/${ID}`],
  ])("%s are pagină proprie pe id", (tip, href) => {
    expect(
      legaturaDocument({ entitateTip: tip, entitateId: ID, parinteId: null, angajatId: null }),
    ).toEqual({ href, eticheta: "Deschide documentul", inFilaNoua: false });
  });

  it("documentul emis de aplicație se deschide ca PDF, în filă nouă", () => {
    expect(
      legaturaDocument({
        entitateTip: "hr_issued_documents",
        entitateId: ID,
        parinteId: null,
        angajatId: ANG,
      }),
    ).toEqual({
      href: `/documente/${ID}?format=pdf`,
      eticheta: "Deschide PDF-ul",
      inFilaNoua: true,
      pdf: `/documente/${ID}?format=pdf`,
    });
  });

  it.each([
    ["employment_contracts", `/angajati/${ANG}/documente`],
    ["employee_documents", `/angajati/${ANG}/documente`],
    ["job_descriptions", `/angajati/${ANG}/documente`],
    ["employee_evaluations", `/angajati/${ANG}`],
  ])("%s duce la fișa angajatului, când angajatul e cunoscut", (tip, href) => {
    expect(
      legaturaDocument({ entitateTip: tip, entitateId: ID, parinteId: null, angajatId: ANG }),
    ).toEqual({ href, eticheta: "Deschide documentul", inFilaNoua: false });
  });

  it("documentele din fișa angajatului fără angajat cunoscut n-au țintă", () => {
    expect(
      legaturaDocument({
        entitateTip: "employment_contracts",
        entitateId: ID,
        parinteId: null,
        angajatId: null,
      }),
    ).toBeNull();
  });

  it.each([
    ["vehicle_documents", `/flota/${PARINTE}`],
    ["fire_extinguisher_checks", `/ssm/stingatoare/${PARINTE}`],
    ["iscir_authorizations", `/mentenanta/echipamente/${PARINTE}`],
    ["inventory_allocations", `/inventar/${PARINTE}/pv/${ID}`],
    ["payroll_entries", `/salarizare/${PARINTE}/${ID}`],
    ["per_diem_calculations", `/diurna/${PARINTE}/decont`],
    ["course_completion_records", `/cursuri/${PARINTE}/stadiu`],
  ])("%s cere părintele și îl folosește în adresă", (tip, href) => {
    expect(TIPURI_CU_PARINTE).toContain(tip);
    expect(
      legaturaDocument({ entitateTip: tip, entitateId: ID, parinteId: PARINTE, angajatId: null }),
    ).toEqual({ href, eticheta: "Deschide documentul", inFilaNoua: false });
  });

  it("adeverința de curs deschide stadiul cursului pe angajatul ei", () => {
    expect(
      legaturaDocument({
        entitateTip: "course_completion_records",
        entitateId: ID,
        parinteId: PARINTE,
        angajatId: ANG,
      }),
    ).toEqual({
      href: `/cursuri/${PARINTE}/stadiu?angajat=${ANG}`,
      eticheta: "Deschide documentul",
      inFilaNoua: false,
    });
  });

  it.each([
    ["vehicle_documents", "/flota"],
    ["fire_extinguisher_checks", "/ssm/stingatoare"],
    ["iscir_authorizations", "/mentenanta"],
    ["inventory_allocations", "/inventar"],
    ["payroll_entries", "/salarizare"],
    ["per_diem_calculations", "/diurna"],
    ["course_completion_records", "/cursuri"],
  ])("%s fără părinte (ascuns de RLS) cade pe lista modulului", (tip, href) => {
    expect(
      legaturaDocument({ entitateTip: tip, entitateId: ID, parinteId: null, angajatId: null }),
    ).toEqual({ href, eticheta: "Deschide lista modulului", inFilaNoua: false });
  });

  it.each([
    ["ssm_trainings", "/ssm/instruiri"],
    ["ppe_issuances", "/ssm/eip"],
    ["occupational_health_exams", "/ssm/medicina-muncii"],
    ["personnel_authorizations", "/ssm/autorizatii"],
    ["payroll_garnishments", "/salarizare/popriri"],
    ["reges_propuneri", "/reges/propuneri"],
    ["maintenance_interventions", "/mentenanta/interventii"],
    ["pontaj_arhive_lunare", "/pontaj/arhiva"],
  ])("%s are doar listă, nu pagină pe id", (tip, href) => {
    expect(
      legaturaDocument({ entitateTip: tip, entitateId: ID, parinteId: null, angajatId: null }),
    ).toEqual({ href, eticheta: "Deschide lista modulului", inFilaNoua: false });
  });

  it.each([
    "manual",
    "risk_assessments",
    "hot_work_permits",
    "evacuation_drills",
    "safety_committee_meetings",
    "dangerous_incidents",
    "occupational_diseases",
    "environmental_permits",
    "holiday_compensation",
    "overtime_compensation",
    "work_permits",
    "contract_suspendari",
    "invitations",
    "tabela_inventata",
    "",
  ])("„%s” n-are ecran: întoarce null, nu aruncă", (tip) => {
    expect(
      legaturaDocument({ entitateTip: tip, entitateId: ID, parinteId: null, angajatId: ANG }),
    ).toBeNull();
  });

  it("fără id de entitate nu există țintă pe id, oricare ar fi tipul", () => {
    expect(
      legaturaDocument({
        entitateTip: "leave_requests",
        entitateId: null,
        parinteId: null,
        angajatId: null,
      }),
    ).toBeNull();
  });

  // `constructor` e un `entitate_tip` valid ca text și o cheie din prototip.
  it("„constructor” nu scoate funcția din prototip", () => {
    expect(
      legaturaDocument({
        entitateTip: "constructor",
        entitateId: ID,
        parinteId: null,
        angajatId: null,
      }),
    ).toBeNull();
  });
});
