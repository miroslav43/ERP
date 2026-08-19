import { describe, expect, it } from "vitest";
import { mapeazaRaspunsAnaf } from "./anaf";

const RASPUNS_VALID = {
  cod: 200,
  found: [
    {
      date_generale: {
        cui: 14399840,
        denumire: "FIRMA MEA SRL",
        nrRegCom: "J40/1234/2020",
        cod_CAEN: 6201,
        stare_inregistrare: "INREGISTRAT din data 01.01.2020",
      },
      inregistrare_scop_Tva: { scpTVA: true },
      stare_inactiv: { statusInactivi: false },
      adresa_sediu_social: {
        sdenumire_Strada: "STR. EXEMPLU",
        snumar_Strada: "10",
        sdenumire_Localitate: "SECTOR 1",
        sdenumire_Judet: "BUCURESTI",
        scod_Postal: "010101",
      },
    },
  ],
  notFound: [],
};

describe("mapeazaRaspunsAnaf", () => {
  it("extrage datele de bază dintr-un răspuns complet", () => {
    const rezultat = mapeazaRaspunsAnaf("14399840", RASPUNS_VALID);
    expect(rezultat.gasit).toBe(true);
    if (!rezultat.gasit) return;
    expect(rezultat.denumire).toBe("FIRMA MEA SRL");
    expect(rezultat.cui).toBe("14399840");
    expect(rezultat.platitorTva).toBe(true);
    expect(rezultat.regCom).toBe("J40/1234/2020");
    expect(rezultat.codCaen).toBe("6201");
    expect(rezultat.radiata).toBe(false);
    expect(rezultat.adresa.strada).toBe("STR. EXEMPLU");
    expect(rezultat.adresa.numar).toBe("10");
    expect(rezultat.adresa.judet).toBe("BUCURESTI");
    expect(rezultat.adresa.codPostal).toBe("010101");
  });

  it("întoarce negăsit când found e gol", () => {
    const rezultat = mapeazaRaspunsAnaf("14399840", { found: [], notFound: [{ cui: 14399840 }] });
    expect(rezultat.gasit).toBe(false);
  });

  it("tratează firma radiată ca găsită, cu radiata=true, nu ca eroare", () => {
    const raspuns = {
      found: [
        {
          date_generale: { denumire: "FIRMA RADIATA SRL" },
          stare_inactiv: { statusInactivi: true },
        },
      ],
    };
    const rezultat = mapeazaRaspunsAnaf("14399840", raspuns);
    expect(rezultat.gasit).toBe(true);
    if (!rezultat.gasit) return;
    expect(rezultat.radiata).toBe(true);
  });

  it("nu aruncă și întoarce negăsit pentru un răspuns cu formă complet neașteptată", () => {
    expect(mapeazaRaspunsAnaf("14399840", null).gasit).toBe(false);
    expect(mapeazaRaspunsAnaf("14399840", "text neașteptat").gasit).toBe(false);
    expect(mapeazaRaspunsAnaf("14399840", { altceva: true }).gasit).toBe(false);
  });

  it("lasă codCaen null când lipsește (PFA/II), fără să blocheze restul câmpurilor", () => {
    const raspuns = {
      found: [{ date_generale: { denumire: "PFA EXEMPLU" }, stare_inactiv: { statusInactivi: false } }],
    };
    const rezultat = mapeazaRaspunsAnaf("14399840", raspuns);
    expect(rezultat.gasit).toBe(true);
    if (!rezultat.gasit) return;
    expect(rezultat.codCaen).toBeNull();
    expect(rezultat.denumire).toBe("PFA EXEMPLU");
  });
});
