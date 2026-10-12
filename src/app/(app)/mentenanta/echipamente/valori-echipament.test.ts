// src/app/(app)/mentenanta/echipamente/valori-echipament.test.ts

import { describe, expect, it } from "vitest";

import { valoriEchipament } from "./valori-echipament";

function formular(perechi: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [cheie, valoare] of Object.entries(perechi)) date.set(cheie, valoare);
  return date;
}

describe("valoriEchipament", () => {
  it("câmpurile goale devin null, nu 0 și nu „”; bifa absentă e false", () => {
    const v = valoriEchipament(
      formular({ cod: " PRS-01 ", denumire: "Presă", an_fabricatie: "", valoare_achizitie: "" }),
    );
    expect(v).toEqual({
      cod: "PRS-01",
      denumire: "Presă",
      serie: null,
      producator: null,
      model: null,
      an_fabricatie: null,
      locatie: null,
      department_id: null,
      responsabil_employee_id: null,
      status: "in_functiune",
      este_iscir: false,
      tip_autorizare_necesara: null,
      valoare_achizitie: null,
      data_punerii_in_functiune: null,
      derogare_motiv: null,
      categorie: null,
      punct_lucru_id: null,
      garantie_expira: null,
      service_garantie: null,
      parent_equipment_id: null,
      marcaj_ce: "nu_se_aplica",
      risc_specific: false,
      folosit_in_afara_sediului: false,
      observatii: null,
    });
  });

  it("câmpurile ciclului de viață (0182): bifele absente sunt false, marcajul CE lipsă e „nu se aplică”", () => {
    const v = valoriEchipament(
      formular({
        cod: "C",
        denumire: "D",
        categorie: " Utilaje de ridicat ",
        punct_lucru_id: "22222222-2222-4222-8222-222222222222",
        garantie_expira: "2027-03-01",
        service_garantie: "Service SRL, 0722 000 000",
        parent_equipment_id: "33333333-3333-4333-8333-333333333333",
        marcaj_ce: "da",
        risc_specific: "on",
        observatii: "Montat pe linia 2.",
      }),
    );
    expect(v.categorie).toBe("Utilaje de ridicat");
    expect(v.punct_lucru_id).toBe("22222222-2222-4222-8222-222222222222");
    expect(v.garantie_expira).toBe("2027-03-01");
    expect(v.marcaj_ce).toBe("da");
    expect(v.risc_specific).toBe(true);
    expect(v.folosit_in_afara_sediului).toBe(false);
    expect(v.observatii).toBe("Montat pe linia 2.");
  });

  it("numerele se convertesc; regimul ISCIR aduce tipul de autorizare și derogarea", () => {
    const v = valoriEchipament(
      formular({
        cod: "STV-1",
        denumire: "Stivuitor",
        an_fabricatie: "2019",
        valoare_achizitie: "45000.50",
        status: "in_reparatie",
        este_iscir: "on",
        tip_autorizare_necesara: "stivuitorist",
        responsabil_employee_id: "11111111-1111-4111-8111-111111111111",
        derogare_motiv: "Responsabilul își reînnoiește autorizația până la 1 noiembrie.",
      }),
    );
    expect(v.an_fabricatie).toBe(2019);
    expect(v.valoare_achizitie).toBe(45000.5);
    expect(v.status).toBe("in_reparatie");
    expect(v.este_iscir).toBe(true);
    expect(v.tip_autorizare_necesara).toBe("stivuitorist");
    expect(v.derogare_motiv).toContain("reînnoiește");
  });

  it("fără bifa ISCIR, tipul de autorizare și derogarea se ignoră chiar dacă au fost trimise", () => {
    const v = valoriEchipament(
      formular({
        cod: "X",
        denumire: "Y",
        tip_autorizare_necesara: "macaragiu",
        derogare_motiv: "Un motiv suficient de lung ca să treacă de prag.",
      }),
    );
    expect(v.este_iscir).toBe(false);
    expect(v.tip_autorizare_necesara).toBeNull();
    expect(v.derogare_motiv).toBeNull();
  });
});
