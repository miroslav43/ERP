// src/domain/organization/anaf.test.ts
import { describe, expect, it } from "vitest";

import { JUDETE } from "@/schemas/organization";
import {
  JUDET_DUPA_COD_AUTO,
  adresaDinAnaf,
  avertismenteAnaf,
  codCaenDinAnaf,
  codPostalDinAnaf,
  denumireAfisabila,
  formaJuridicaDinAnaf,
  judetDinAnaf,
  localitateDinAnaf,
  precompletareDinAnaf,
  raspunsAnafSchema,
  sedilaInVirgula,
  type FirmaAnaf,
} from "./anaf";

/**
 * Răspunsuri REALE, capturate de pe endpoint-ul ANAF v9 (august 2026). Nu
 * inventate: exact ele au arătat că județul vine cu sedilă, că lipsește zeroul
 * din codul poștal și că sediul social diferă de câmpul liber `adresa`.
 */
const BUCURESTI_BRUT = {
  found: [
    {
      date_generale: {
        cui: 14399840,
        denumire: "DANTE INTERNATIONAL SA",
        adresa:
          "MUNICIPIUL BUCUREŞTI, SECTOR 2, STR. GARA HERĂSTRĂU, NR.6, CLADIREA GLOBALWORTH SQUARE",
        telefon: "",
        codPostal: "",
        stare_inregistrare: "INREGISTRAT din data 29.08.2006",
        forma_juridica: "SOCIETATE COMERCIALĂ PE ACŢIUNI",
        forma_organizare: "PERSOANA JURIDICA",
        nrRegCom: "J2002000372404",
        cod_CAEN: "4754",
        iban: "",
      },
      inregistrare_scop_Tva: { scpTVA: true },
      stare_inactiv: {
        dataInactivare: "",
        dataReactivare: "",
        dataPublicare: "",
        dataRadiere: "",
        statusInactivi: false,
      },
      adresa_sediu_social: {
        stara: "",
        sdenumire_Strada: "Şos. Virtuţii",
        snumar_Strada: "148",
        scod_Localitate: "6",
        sdenumire_Localitate: "Sector 6 Mun. Bucureşti",
        sdenumire_Judet: "MUNICIPIUL BUCUREŞTI",
        scod_Judet: "40",
        scod_JudetAuto: "B",
        sdetalii_Adresa: "spatiul E47",
        scod_Postal: "60787",
      },
    },
  ],
  notFound: [],
};

const CLUJ_BRUT = {
  found: [
    {
      date_generale: {
        cui: 5022670,
        denumire: "BANCA TRANSILVANIA SA",
        adresa: "",
        telefon: "0264407150",
        codPostal: "",
        stare_inregistrare: "INREGISTRAT",
        forma_juridica: "SOCIETATE COMERCIALĂ PE ACŢIUNI",
        forma_organizare: "PERSOANA JURIDICA",
        nrRegCom: "J1993004155124",
        cod_CAEN: "6419",
        iban: "",
      },
      inregistrare_scop_Tva: { scpTVA: true },
      stare_inactiv: {
        dataInactivare: "",
        dataReactivare: "",
        dataPublicare: "",
        dataRadiere: "",
        statusInactivi: false,
      },
      adresa_sediu_social: {
        sdenumire_Localitate: "Mun. Cluj-Napoca",
        stara: "",
        sdenumire_Judet: "CLUJ",
        scod_Judet: "12",
        scod_JudetAuto: "CJ",
        sdetalii_Adresa: "",
        scod_Postal: "",
        scod_Localitate: "103",
        sdenumire_Strada: "Cal. Dorobanţilor",
        snumar_Strada: "30-36",
      },
    },
  ],
  notFound: [],
};

/**
 * Clonează un fixture și întoarce prima firmă din el, verificată.
 * `noUncheckedIndexedAccess` face `found[0]` să fie `T | undefined`, deci
 * mutarea directă a unui câmp din el nu compilează.
 */
const clonaCuPrimaFirma = <T extends { found: readonly unknown[] }>(
  brut: T,
): readonly [T, T["found"][number]] => {
  const copie = structuredClone(brut);
  const firma = copie.found[0];
  if (firma === undefined) throw new Error("Fixture fără firmă.");
  return [copie, firma];
};

const primaFirma = (brut: unknown): FirmaAnaf => {
  const parsat = raspunsAnafSchema.parse(brut);
  const firma = parsat.found[0];
  if (firma === undefined) throw new Error("Fixture fără firmă.");
  return firma;
};

describe("raspunsAnafSchema", () => {
  it("acceptă răspunsurile reale, cu tot cu câmpuri pe care nu le folosim", () => {
    expect(() => raspunsAnafSchema.parse(BUCURESTI_BRUT)).not.toThrow();
    expect(() => raspunsAnafSchema.parse(CLUJ_BRUT)).not.toThrow();
  });

  it("rămâne tolerantă: un răspuns ciuntit nu aruncă, doar nu completează", () => {
    const parsat = raspunsAnafSchema.parse({
      found: [{ date_generale: { denumire: "FIRMA TEST SRL" } }],
      notFound: [],
    });
    expect(parsat.found[0]?.date_generale.cod_CAEN).toBe("");
    expect(parsat.found[0]?.adresa_sediu_social).toBeUndefined();
  });

  it("întoarce CUI-urile negăsite", () => {
    const parsat = raspunsAnafSchema.parse({ found: [], notFound: [2816483] });
    expect(parsat.found).toHaveLength(0);
    expect(parsat.notFound).toEqual([2816483]);
  });
});

describe("sedilaInVirgula", () => {
  it("înlocuiește sedila ANAF cu virgula dedesubt cerută de proiect", () => {
    expect(sedilaInVirgula("Şos. Virtuţii")).toBe("Șos. Virtuții");
    expect(sedilaInVirgula("Cal. Dorobanţilor")).toBe("Cal. Dorobanților");
    // U+015E/U+0163 intră, U+0218/U+021B ies.
    expect("Şos. Virtuţii".codePointAt(0)).toBe(0x015e);
    expect(sedilaInVirgula("Şos.").codePointAt(0)).toBe(0x0218);
  });

  it("lasă neatinse diacriticele deja corecte", () => {
    expect(sedilaInVirgula("București")).toBe("București");
    expect(sedilaInVirgula("Constanța")).toBe("Constanța");
  });
});

describe("JUDET_DUPA_COD_AUTO", () => {
  // Fără perechea asta de teste, un județ uitat e un `undefined` tăcut
  // într-un enum strict: precompletarea pur și simplu nu pune județul, iar
  // utilizatorul nu află de ce.
  it("acoperă fiecare județ din enum", () => {
    const acoperite = new Set(JUDET_DUPA_COD_AUTO.values());
    const lipsa = JUDETE.filter((judet) => !acoperite.has(judet));
    expect(lipsa).toEqual([]);
  });

  it("nu conține județe inexistente în enum", () => {
    const permise = new Set<string>(JUDETE);
    const intruse = [...JUDET_DUPA_COD_AUTO.values()].filter((judet) => !permise.has(judet));
    expect(intruse).toEqual([]);
  });

  it("are exact 42 de intrări — 41 de județe plus municipiul București", () => {
    expect(JUDET_DUPA_COD_AUTO.size).toBe(42);
    expect(JUDETE).toHaveLength(42);
  });
});

describe("judetDinAnaf", () => {
  it("mapează pe codul auto, nu pe denumirea cu sedilă", () => {
    expect(judetDinAnaf("B", "MUNICIPIUL BUCUREŞTI")).toBe("București");
    expect(judetDinAnaf("CJ", "CLUJ")).toBe("Cluj");
    expect(judetDinAnaf("BN", "BISTRIŢA-NĂSĂUD")).toBe("Bistrița-Năsăud");
  });

  it("cade pe denumire dacă lipsește codul auto, prefixe și diacritice incluse", () => {
    expect(judetDinAnaf("", "MUNICIPIUL BUCUREŞTI")).toBe("București");
    expect(judetDinAnaf("", "JUDEŢUL CONSTANŢA")).toBe("Constanța");
    expect(judetDinAnaf("", "CARAS-SEVERIN")).toBe("Caraș-Severin");
  });

  it("întoarce undefined când nu recunoaște nimic", () => {
    expect(judetDinAnaf("", "")).toBeUndefined();
    expect(judetDinAnaf("XX", "REPUBLICA MOLDOVA")).toBeUndefined();
  });
});

describe("codPostalDinAnaf", () => {
  it("pune la loc zeroul pe care ANAF îl taie", () => {
    expect(codPostalDinAnaf("60787")).toBe("060787");
  });

  it("lasă neatins un cod deja complet", () => {
    expect(codPostalDinAnaf("400117")).toBe("400117");
  });

  it("preferă golul în locul unei valori greșite", () => {
    expect(codPostalDinAnaf("")).toBeUndefined();
    expect(codPostalDinAnaf("123")).toBeUndefined();
    expect(codPostalDinAnaf("1234567")).toBeUndefined();
  });
});

describe("localitateDinAnaf", () => {
  it("extrage și sectorul din forma bucureșteană", () => {
    expect(localitateDinAnaf("Sector 6 Mun. Bucureşti")).toEqual({
      oras: "București",
      sector: "6",
    });
  });

  it("scapă de prefixul de rang administrativ", () => {
    expect(localitateDinAnaf("Mun. Cluj-Napoca")).toEqual({ oras: "Cluj-Napoca" });
    expect(localitateDinAnaf("Com. Floreşti")).toEqual({ oras: "Florești" });
    expect(localitateDinAnaf("Or. Buftea")).toEqual({ oras: "Buftea" });
  });

  it("normalizează Bucureștiul scris fără sector", () => {
    expect(localitateDinAnaf("Mun. Bucureşti")).toEqual({ oras: "București" });
  });

  it("întoarce gol pentru intrare goală", () => {
    expect(localitateDinAnaf("")).toEqual({});
  });
});

describe("adresaDinAnaf", () => {
  const sediu = (partial: Record<string, string>) => ({
    sdenumire_Strada: "",
    snumar_Strada: "",
    sdenumire_Localitate: "",
    sdenumire_Judet: "",
    scod_JudetAuto: "",
    sdetalii_Adresa: "",
    scod_Postal: "",
    ...partial,
  });

  it("compune stradă, număr și detalii, cu diacriticele corectate", () => {
    expect(
      adresaDinAnaf(
        sediu({
          sdenumire_Strada: "Şos. Virtuţii",
          snumar_Strada: "148",
          sdetalii_Adresa: "spatiul E47",
        }),
      ),
    ).toBe("Șos. Virtuții, nr. 148, spatiul E47");
  });

  it("sare peste bucățile lipsă, fără virgule orfane", () => {
    expect(
      adresaDinAnaf(sediu({ sdenumire_Strada: "Cal. Dorobanţilor", snumar_Strada: "30-36" })),
    ).toBe("Cal. Dorobanților, nr. 30-36");
  });

  it("întoarce undefined când nu are din ce compune", () => {
    expect(adresaDinAnaf(sediu({}))).toBeUndefined();
  });
});

describe("formaJuridicaDinAnaf", () => {
  it("traduce fraza ANAF în abrevierea din enum", () => {
    expect(formaJuridicaDinAnaf("SOCIETATE COMERCIALĂ PE ACŢIUNI")).toBe("SA");
    expect(formaJuridicaDinAnaf("SOCIETATE CU RASPUNDERE LIMITATA")).toBe("SRL");
    expect(formaJuridicaDinAnaf("PERSOANA FIZICA AUTORIZATA")).toBe("PFA");
    expect(formaJuridicaDinAnaf("REGIE AUTONOMA")).toBe("RA");
  });

  it("distinge societatea debutantă de SRL-ul obișnuit", () => {
    expect(formaJuridicaDinAnaf("SOCIETATE CU RASPUNDERE LIMITATA - DEBUTANT")).toBe("SRL-D");
  });

  it("preferă undefined unei ghiciri — formularul are deja un implicit", () => {
    expect(formaJuridicaDinAnaf("")).toBeUndefined();
    expect(formaJuridicaDinAnaf("FORMA NEMAIVAZUTA")).toBeUndefined();
  });
});

describe("codCaenDinAnaf", () => {
  it("acceptă un cod care există în nomenclatorul Rev.3", () => {
    expect(codCaenDinAnaf("4754")).toBe("4754");
    expect(codCaenDinAnaf("6419")).toBe("6419");
  });

  it("respinge un cod absent din nomenclator, deși are 4 cifre", () => {
    // Ar trece de `regex(/^[0-9]{4}$/)` și ar pica abia la trimiterea
    // formularului, pe un câmp pe care utilizatorul nu l-a atins.
    expect(codCaenDinAnaf("9999")).toBeUndefined();
    expect(codCaenDinAnaf("1234")).toBeUndefined();
  });

  it("respinge ce nu are forma unui cod", () => {
    expect(codCaenDinAnaf("")).toBeUndefined();
    expect(codCaenDinAnaf("475")).toBeUndefined();
  });
});

describe("denumireAfisabila", () => {
  it("scrie normal denumirea, dar lasă forma juridică cu majuscule", () => {
    expect(denumireAfisabila("BANCA TRANSILVANIA SA")).toBe("Banca Transilvania SA");
    expect(denumireAfisabila("DANTE INTERNATIONAL SA")).toBe("Dante International SA");
    expect(denumireAfisabila("EXEMPLU COMPANIE SRL")).toBe("Exemplu Companie SRL");
  });
});

describe("avertismenteAnaf", () => {
  it("tace pentru o firmă activă", () => {
    expect(avertismenteAnaf(primaFirma(CLUJ_BRUT))).toEqual([]);
  });

  it("semnalează firma inactivă fiscal", () => {
    const [brut, firma] = clonaCuPrimaFirma(BUCURESTI_BRUT);
    firma.stare_inactiv.statusInactivi = true;
    firma.stare_inactiv.dataInactivare = "2025-03-01";
    const avertismente = avertismenteAnaf(primaFirma(brut));
    expect(avertismente).toHaveLength(1);
    expect(avertismente[0]).toContain("INACTIVĂ");
    expect(avertismente[0]).toContain("2025-03-01");
  });

  it("semnalează firma radiată", () => {
    const [brut, firma] = clonaCuPrimaFirma(BUCURESTI_BRUT);
    firma.stare_inactiv.dataRadiere = "2024-11-20";
    expect(avertismenteAnaf(primaFirma(brut))[0]).toContain("RADIATĂ");
  });
});

describe("precompletareDinAnaf", () => {
  it("mapează firma bucureșteană, sector inclusiv", () => {
    const { valori, denumire, avertismente } = precompletareDinAnaf(primaFirma(BUCURESTI_BRUT));

    expect(denumire).toBe("DANTE INTERNATIONAL SA");
    expect(avertismente).toEqual([]);
    expect(valori).toEqual({
      name: "Dante International SA",
      legal_name: "DANTE INTERNATIONAL SA",
      forma_juridica: "SA",
      platitor_tva: true,
      reg_com: "J2002000372404",
      judet: "București",
      sector: "6",
      oras: "București",
      adresa: "Șos. Virtuții, nr. 148, spatiul E47",
      cod_postal: "060787",
      cod_caen: "4754",
    });
  });

  it("mapează firma din provincie: fără sector, fără cod poștal, cu telefon", () => {
    const { valori } = precompletareDinAnaf(primaFirma(CLUJ_BRUT));

    expect(valori).toEqual({
      name: "Banca Transilvania SA",
      legal_name: "BANCA TRANSILVANIA SA",
      forma_juridica: "SA",
      platitor_tva: true,
      reg_com: "J1993004155124",
      telefon_contact: "0264407150",
      judet: "Cluj",
      oras: "Cluj-Napoca",
      adresa: "Cal. Dorobanților, nr. 30-36",
      cod_caen: "6419",
    });
    expect(valori.sector).toBeUndefined();
    expect(valori.cod_postal).toBeUndefined();
  });

  it("nu lasă un sector în afara Bucureștiului", () => {
    // `organizations_sector_ck` din 0030 respinge combinația; fără curățarea
    // asta, eroarea ar apărea abia la salvare, cu formularul deja completat.
    const [brut, firma] = clonaCuPrimaFirma(CLUJ_BRUT);
    firma.adresa_sediu_social.sdenumire_Localitate = "Sector 3 Mun. Bucureşti";
    const { valori } = precompletareDinAnaf(primaFirma(brut));
    expect(valori.judet).toBe("Cluj");
    expect(valori.sector).toBeUndefined();
  });

  it("nu debifează TVA-ul: `false` de la ANAF nu se propagă", () => {
    const [brut, firma] = clonaCuPrimaFirma(CLUJ_BRUT);
    firma.inregistrare_scop_Tva.scpTVA = false;
    expect(precompletareDinAnaf(primaFirma(brut)).valori.platitor_tva).toBeUndefined();
  });

  it("nu inventează nimic dintr-un răspuns aproape gol", () => {
    const firma = primaFirma({ found: [{ date_generale: { denumire: "" } }], notFound: [] });
    const { valori, denumire } = precompletareDinAnaf(firma);
    expect(valori).toEqual({});
    expect(denumire).toBe("Firmă fără denumire în registru");
  });
});
