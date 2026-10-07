import { describe, expect, it } from "vitest";

import { vehiculNouSchema } from "@/schemas/fleet";

import { valoriVehicul, valoriVehiculNou } from "./valori-vehicul";

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
  it("citește toate cele optsprezece câmpuri ale schemei", () => {
    const valori = valoriVehicul(
      formular({
        ...MINIM,
        vin: "VF1LB000123456789",
        an_fabricatie: "2019",
        culoare: "alb",
        consum_mediu_declarat: "5.4",
        capacitate_cilindrica: "1461",
        masa_maxima_kg: "1550",
        numar_locuri: "5",
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
      capacitate_cilindrica: 1461,
      masa_maxima_kg: 1550,
      numar_locuri: 5,
      department_id: null,
      pool: false,
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
    expect(
      vehiculNouSchema.safeParse(valoriVehiculNou(formular({ ...MINIM, vin: "", km_curent: "1" })))
        .success,
    ).toBe(true);
  });

  /**
   * Din 0173, șoferul se schimbă doar prin alocare. Un `employee_id` rătăcit în
   * formular nu are voie să ajungă în încărcătură: baza l-ar refuza cu P0001,
   * pe un formular care nici n-are câmpul.
   */
  it("nu citește șoferul, chiar dacă formularul l-ar trimite", () => {
    const sofer = "55555555-5555-4555-8555-555555555555";
    const valori = valoriVehicul(formular({ ...MINIM, employee_id: sofer }));

    expect(valori).not.toHaveProperty("employee_id");
  });

  it("citește departamentul și bifa de pool; bifa absentă înseamnă `false`", () => {
    const departament = "66666666-6666-4666-8666-666666666666";
    const bifat = valoriVehicul(formular({ ...MINIM, department_id: departament, pool: "on" }));
    expect(bifat.department_id).toBe(departament);
    expect(bifat.pool).toBe(true);

    expect(valoriVehicul(formular(MINIM)).pool).toBe(false);
  });

  it("produce o încărcătură pe care schema de creare o acceptă", () => {
    expect(
      vehiculNouSchema.safeParse(valoriVehiculNou(formular({ ...MINIM, km_curent: "87000" })))
        .success,
    ).toBe(true);
  });
});

describe("valoriVehiculNou", () => {
  it("adaugă kilometrajul de la bord", () => {
    expect(valoriVehiculNou(formular({ ...MINIM, km_curent: "87000" })).km_curent).toBe(87000);
  });

  /**
   * Defectul reparat: vehiculul intra cu 0 km, iar prima foaie de parcurs
   * accepta orice kilometraj. Câmpul gol trebuie refuzat, nu trecut în zero.
   */
  it("lasă kilometrajul gol null, iar schema îl refuză", () => {
    const valori = valoriVehiculNou(formular({ ...MINIM, km_curent: "" }));

    expect(valori.km_curent).toBeNull();
    const rezultat = vehiculNouSchema.safeParse(valori);
    expect(rezultat.success).toBe(false);
    expect(rezultat.error?.issues.map((p) => p.path.join("."))).toContain("km_curent");
  });

  it("primește zero km doar scris explicit, pentru o mașină nouă", () => {
    const valori = valoriVehiculNou(formular({ ...MINIM, km_curent: "0" }));

    expect(valori.km_curent).toBe(0);
    expect(vehiculNouSchema.safeParse(valori).success).toBe(true);
  });
});
