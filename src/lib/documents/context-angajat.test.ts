// src/lib/documents/context-angajat.test.ts
//
// Contextul celor cinci documente de înrolare, adunat dintr-un singur loc:
// fișa angajatului (a firmei, vie), contractul de BAZĂ cel mai recent,
// departamentul și fișa postului. Lipsa fișei sau a contractului oprește
// emiterea cu un mesaj, nu cu un document plin de „nespecificat".

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { areFiltru, clientFals } from "@/lib/teste/supabase-fals";

import { adunaContextInrolare } from "./context-angajat";

const ORG = "11111111-1111-4111-8111-111111111111";
const ANGAJAT = "66666666-6666-4666-8666-666666666666";
const DEPARTAMENT = "88888888-8888-4888-8888-888888888888";

const angajat = (peste: Record<string, unknown> = {}) => ({
  id: ANGAJAT,
  full_name: "Ion Pop",
  adresa_strada: "Str. Lungă 1",
  adresa_oras: null,
  adresa_judet: "Cluj",
  serie_act: "CJ",
  numar_act: "123456",
  act_eliberat_de: "SPCLEP",
  act_eliberat_la: "2019-03-12",
  functie: "Contabil",
  department_id: DEPARTAMENT,
  ...peste,
});

const contract = (peste: Record<string, unknown> = {}) => ({
  id: "c1",
  numar: "12",
  data_contract: "2026-09-01",
  valabil_de_la: "2026-09-10",
  valabil_pana: null,
  contract_duration: "nedeterminat",
  norma_ore_saptamana: "40",
  norma_ore_zi: "8",
  work_mode: "telemunca",
  loc_munca: null,
  loc_telemunca: "Acasă",
  salariu_baza: "5000.50",
  zile_concediu_anual: 21,
  ...peste,
});

const ETICHETE = { telemunca: "Telemuncă", sediu: "La sediu" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-15T07:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("adunaContextInrolare", () => {
  it("adună fișa, contractul de bază, departamentul și fișa postului, în forma documentelor", async () => {
    const db = clientFals();
    db.raspunde("employees", "select", { data: angajat() });
    db.raspunde("employment_contracts", "select", { data: contract() });
    db.raspunde("departments", "select", { data: { denumire: "Financiar" } });
    db.raspunde("job_descriptions", "select", {
      data: { subordonare: "Director", atributii: ["Plăți", "Facturi"], competente: null },
    });

    const r = await adunaContextInrolare(db.client, {
      organizationId: ORG,
      employeeId: ANGAJAT,
      etichetaModLucru: ETICHETE,
    });

    expect(r).toEqual({
      organizationId: ORG,
      employeeId: ANGAJAT,
      contractId: "c1",
      azi: "2026-09-15",
      angajat: {
        nume: "Ion Pop",
        adresa: "Str. Lungă 1, Cluj",
        serieAct: "CJ",
        numarAct: "123456",
        actEliberatDe: "SPCLEP",
        actEliberatLa: "2019-03-12",
        functie: "Contabil",
        departament: "Financiar",
      },
      contract: {
        numar: "12",
        dataContract: "2026-09-01",
        dataAngajarii: "2026-09-10",
        durata: "nedeterminată",
        normaOreSaptamana: 40,
        normaOreZi: 8,
        modLucru: "Telemuncă",
        locMunca: null,
        locTelemunca: "Acasă",
        salariuBrut: 5000.5,
        zileConcediuAnual: 21,
      },
      codModLucru: "telemunca",
      fisaPostului: { subordonare: "Director", atributii: ["Plăți", "Facturi"], competente: [] },
    });

    const [fisa] = db.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "id", ANGAJAT)).toBe(true);
    expect(areFiltru(fisa, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
    const [c] = db.apeluriPe("employment_contracts");
    expect(areFiltru(c, "eq", "employee_id", ANGAJAT)).toBe(true);
    expect(areFiltru(c, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(c, "eq", "este_act_aditional", false)).toBe(true);
    expect(areFiltru(c, "is", "deleted_at", null)).toBe(true);
    expect(c?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["valabil_de_la", { ascending: false }] },
        { metoda: "limit", argumente: [1] },
      ]),
    );
    expect(areFiltru(db.apeluriPe("job_descriptions")[0], "is", "deleted_at", null)).toBe(true);
  });

  it("determinat cu dată de sfârșit: durata spune până când, cu data românească", async () => {
    const db = clientFals();
    db.raspunde("employees", "select", { data: angajat({ department_id: null }) });
    db.raspunde("employment_contracts", "select", {
      data: contract({
        contract_duration: "determinat",
        valabil_pana: "2027-03-31",
        work_mode: "hibrid",
      }),
    });
    db.raspunde("job_descriptions", "select", { data: null });

    const r = await adunaContextInrolare(db.client, {
      organizationId: ORG,
      employeeId: ANGAJAT,
      etichetaModLucru: ETICHETE,
    });

    expect(r.contract.durata).toBe("determinată, până la 31.03.2027");
    // Eticheta necunoscută cade pe codul brut, nu pe gol.
    expect(r.contract.modLucru).toBe("hibrid");
    expect(r.angajat.departament).toBeNull();
    expect(r.fisaPostului).toBeNull();
    // Fără departament pe fișă: departamentele nu se citesc.
    expect(db.apeluriPe("departments")).toHaveLength(0);
  });

  it("fișă fără nume și fără adresă: șiruri goale, nu „null” tipărit", async () => {
    const db = clientFals();
    db.raspunde("employees", "select", {
      data: angajat({
        full_name: null,
        adresa_strada: null,
        adresa_judet: null,
        department_id: null,
      }),
    });
    db.raspunde("employment_contracts", "select", { data: contract() });
    db.raspunde("job_descriptions", "select", { data: null });
    const r = await adunaContextInrolare(db.client, {
      organizationId: ORG,
      employeeId: ANGAJAT,
      etichetaModLucru: ETICHETE,
    });
    expect(r.angajat.nume).toBe("");
    expect(r.angajat.adresa).toBe("");
  });

  it("fișa inexistentă sau a altei firme: NEGASIT, nimic altceva citit", async () => {
    const db = clientFals();
    db.raspunde("employees", "select", { data: null });
    await expect(
      adunaContextInrolare(db.client, {
        organizationId: ORG,
        employeeId: ANGAJAT,
        etichetaModLucru: {},
      }),
    ).rejects.toMatchObject({ code: "NEGASIT" });
    expect(db.apeluri).toHaveLength(1);
  });

  it("fără contract: CONFLICT „nu se poate emite niciun document”", async () => {
    const db = clientFals();
    db.raspunde("employees", "select", { data: angajat() });
    db.raspunde("employment_contracts", "select", { data: null });
    await expect(
      adunaContextInrolare(db.client, {
        organizationId: ORG,
        employeeId: ANGAJAT,
        etichetaModLucru: {},
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Angajatul nu are contract, deci nu se poate emite niciun document.",
    });
  });
});
