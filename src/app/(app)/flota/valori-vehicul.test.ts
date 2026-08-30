import { describe, expect, it } from "vitest";

import { vehiculNouSchema } from "@/schemas/fleet";

import { valoriVehicul } from "./valori-vehicul";

function formular(campuri: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [cheie, valoare] of Object.entries(campuri)) date.append(cheie, valoare);
  return date;
}

const MINIM = {
  nr_inmatriculare: "CJ 07 ABC",
  marca: "Dacia",
  model: "Logan",
  categorie: "autoturism",
  tip_combustibil: "motorina",
};

describe("valoriVehicul", () => {
  /**
   * Regresie directă: `culoare`, `data_achizitie` și `valoare_achizitie` erau
   * citite din `FormData` de un formular care nu le randa. Testul le ține
   * legate de un `name` real — dacă inputul dispare din nou, aici nu se vede,
   * dar cel puțin maparea rămâne una singură, verificată.
   */
  it("citește toate cele cincisprezece câmpuri ale schemei", () => {
    const valori = valoriVehicul(
      formular({
        ...MINIM,
        vin: "VF1LB000123456789",
        an_fabricatie: "2019",
        culoare: "alb",
        consum_mediu_declarat: "5.4",
        data_achizitie: "2020-03-15",
        valoare_achizitie: "42500",
        prag_salt_km: "800",
        observatii: "Cauciucuri de iarnă în portbagaj.",
      }),
    );

    expect(valori).toStrictEqual({
      nr_inmatriculare: "CJ 07 ABC",
      marca: "Dacia",
      model: "Logan",
      vin: "VF1LB000123456789",
      categorie: "autoturism",
      tip_combustibil: "motorina",
      an_fabricatie: 2019,
      culoare: "alb",
      consum_mediu_declarat: 5.4,
      employee_id: null,
      department_id: null,
      data_achizitie: "2020-03-15",
      valoare_achizitie: 42500,
      prag_salt_km: 800,
      observatii: "Cauciucuri de iarnă în portbagaj.",
    });
  });

  it("nu transformă numerele goale în zero", () => {
    const valori = valoriVehicul(
      formular({ ...MINIM, an_fabricatie: "", valoare_achizitie: "", prag_salt_km: "" }),
    );

    expect(valori.an_fabricatie).toBeNull();
    expect(valori.valoare_achizitie).toBeNull();
    expect(valori.prag_salt_km).toBeNull();
  });

  /**
   * `vin` are ramură proprie în schemă: șirul gol e acceptat și transformat în
   * `null` DUPĂ validarea formatului. Trimis ca `null` de aici, ar sări peste
   * ramura aia — deci rămâne text.
   */
  it("lasă VIN-ul ca text gol, nu îl trece în null", () => {
    expect(valoriVehicul(formular({ ...MINIM, vin: "" })).vin).toBe("");
    expect(vehiculNouSchema.safeParse(valoriVehicul(formular({ ...MINIM, vin: "" }))).success).toBe(
      true,
    );
  });

  it("păstrează alocarea trimisă prin câmpuri ascunse", () => {
    const sofer = "55555555-5555-4555-8555-555555555555";
    const valori = valoriVehicul(formular({ ...MINIM, employee_id: sofer }));

    expect(valori.employee_id).toBe(sofer);
    expect(valori.department_id).toBeNull();
  });

  it("produce o încărcătură pe care schema de creare o acceptă", () => {
    expect(vehiculNouSchema.safeParse(valoriVehicul(formular(MINIM))).success).toBe(true);
  });
});
