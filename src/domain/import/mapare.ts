// src/domain/import/mapare.ts
// Potrivirea coloanelor din Excel pe câmpurile fișei de angajat.
// Normalizăm antetul: fără diacritice, fără punctuație, fără spații multiple,
// ca „Data Naşterii", „DATA NASTERII" și „data-nasterii" să ajungă la același câmp.
import type { RandBrut } from "@/lib/import/excel";

export type DefinitieCamp = {
  readonly camp: string;
  readonly eticheta: string;
  readonly obligatoriu: boolean;
  readonly alias: readonly string[];
};

export const CAMPURI_IMPORT = [
  {
    camp: "marca",
    eticheta: "Marcă",
    obligatoriu: true,
    alias: ["marca", "nr matricol", "numar matricol", "cod angajat", "id angajat"],
  },
  {
    camp: "nume",
    eticheta: "Nume",
    obligatoriu: false,
    alias: ["nume", "numele", "nume de familie"],
  },
  { camp: "prenume", eticheta: "Prenume", obligatoriu: false, alias: ["prenume", "prenumele"] },
  {
    camp: "nume_complet",
    eticheta: "Nume complet",
    obligatoriu: false,
    alias: [
      "nume complet",
      "nume si prenume",
      "numele si prenumele",
      "nume prenume",
      "angajat",
      "salariat",
    ],
  },
  { camp: "cnp", eticheta: "CNP", obligatoriu: false, alias: ["cnp", "cod numeric personal"] },
  {
    camp: "email",
    eticheta: "E-mail personal",
    obligatoriu: false,
    alias: ["email", "e mail", "email personal", "adresa email"],
  },
  {
    camp: "telefon",
    eticheta: "Telefon",
    obligatoriu: false,
    alias: ["telefon", "tel", "mobil", "telefon mobil", "numar de telefon"],
  },
  {
    camp: "data_nasterii",
    eticheta: "Data nașterii",
    obligatoriu: false,
    alias: ["data nasterii", "data nastere", "nascut la", "data de nastere"],
  },
  { camp: "gen", eticheta: "Gen", obligatoriu: false, alias: ["gen", "sex"] },
  {
    camp: "cetatenie",
    eticheta: "Cetățenie",
    obligatoriu: false,
    alias: ["cetatenie", "nationalitate"],
  },
  {
    camp: "adresa_strada",
    eticheta: "Stradă",
    obligatoriu: false,
    alias: ["adresa", "strada", "adresa domiciliu"],
  },
  {
    camp: "adresa_oras",
    eticheta: "Localitate",
    obligatoriu: false,
    alias: ["oras", "localitate", "municipiu"],
  },
  { camp: "adresa_judet", eticheta: "Județ", obligatoriu: false, alias: ["judet", "judetul"] },
  { camp: "adresa_cod_postal", eticheta: "Cod poștal", obligatoriu: false, alias: ["cod postal"] },
  {
    camp: "departament",
    eticheta: "Departament",
    obligatoriu: false,
    alias: ["departament", "compartiment", "sectie", "structura"],
  },
  {
    camp: "functie",
    eticheta: "Funcție",
    obligatoriu: false,
    alias: ["functie", "post", "denumire functie", "meserie", "ocupatie"],
  },
  {
    camp: "manager_marca",
    eticheta: "Marca managerului",
    obligatoriu: false,
    alias: ["manager", "sef direct", "marca sef", "superior ierarhic"],
  },
  {
    camp: "data_angajarii",
    eticheta: "Data angajării",
    obligatoriu: true,
    alias: ["data angajarii", "data angajare", "angajat din", "data inceperii activitatii"],
  },
  {
    camp: "numar_contract",
    eticheta: "Număr contract",
    obligatoriu: false,
    alias: ["numar contract", "nr contract", "contract nr", "nr cim", "cim"],
  },
  {
    camp: "data_contract",
    eticheta: "Data contractului",
    obligatoriu: false,
    alias: ["data contract", "data cim", "data contractului"],
  },
  {
    camp: "tip_contract",
    eticheta: "Tip contract",
    obligatoriu: false,
    alias: ["tip contract", "durata contract", "perioada contract"],
  },
  {
    camp: "contract_pana_la",
    eticheta: "Contract valabil până la",
    obligatoriu: false,
    alias: ["contract pana la", "valabil pana la", "data expirarii contractului"],
  },
  {
    camp: "salariu",
    eticheta: "Salariu de bază",
    obligatoriu: false,
    alias: ["salariu", "salariu de baza", "salariu brut", "salariu baza brut"],
  },
  {
    camp: "norma_ore",
    eticheta: "Normă (ore/săptămână)",
    obligatoriu: false,
    alias: ["norma", "ore pe saptamana", "norma saptamanala", "timp de lucru"],
  },
  {
    camp: "zile_concediu",
    eticheta: "Zile de concediu",
    obligatoriu: false,
    alias: ["zile concediu", "concediu anual", "co anual"],
  },
  {
    camp: "persoane_intretinere",
    eticheta: "Persoane în întreținere",
    obligatoriu: false,
    alias: ["persoane in intretinere", "nr persoane in intretinere", "persoane intretinere"],
  },
  {
    camp: "iban",
    eticheta: "IBAN",
    obligatoriu: false,
    alias: ["iban", "cont bancar", "cont iban"],
  },
  { camp: "banca", eticheta: "Banca", obligatoriu: false, alias: ["banca", "banca cont"] },
] as const satisfies readonly DefinitieCamp[];

export type CampImport = (typeof CAMPURI_IMPORT)[number]["camp"];

export function normalizeazaAntet(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const INDEX_ALIAS: ReadonlyMap<string, CampImport> = (() => {
  const index = new Map<string, CampImport>();
  for (const definitie of CAMPURI_IMPORT) {
    for (const alias of [definitie.camp, ...definitie.alias]) {
      const cheie = normalizeazaAntet(alias);
      if (!index.has(cheie)) index.set(cheie, definitie.camp);
      const compact = cheie.replace(/ /g, "");
      if (!index.has(compact)) index.set(compact, definitie.camp);
    }
  }
  return index;
})();

export type MaparePotrivita = {
  readonly camp: CampImport;
  readonly coloana: string;
  readonly indice: number;
};
export type RezultatMapare = {
  readonly potriviri: readonly MaparePotrivita[];
  readonly dupaCamp: ReadonlyMap<CampImport, string>;
  readonly coloaneIgnorate: readonly string[];
  readonly campuriLipsa: readonly CampImport[];
};

export function etichetaCampImport(camp: CampImport): string {
  return CAMPURI_IMPORT.find((definitie) => definitie.camp === camp)?.eticheta ?? camp;
}

export function mapeazaColoane(antet: readonly string[]): RezultatMapare {
  const potriviri: MaparePotrivita[] = [];
  const dupaCamp = new Map<CampImport, string>();
  const ignorate: string[] = [];

  antet.forEach((coloana, indice) => {
    const normalizat = normalizeazaAntet(coloana);
    const camp = INDEX_ALIAS.get(normalizat) ?? INDEX_ALIAS.get(normalizat.replace(/ /g, ""));
    if (camp === undefined || dupaCamp.has(camp)) {
      // Prima coloană care revendică un câmp câștigă; duplicatele sunt ignorate explicit.
      ignorate.push(coloana);
      return;
    }
    dupaCamp.set(camp, coloana);
    potriviri.push({ camp, coloana, indice });
  });

  const areNume = dupaCamp.has("nume_complet") || (dupaCamp.has("nume") && dupaCamp.has("prenume"));
  const campuriLipsa = CAMPURI_IMPORT.filter(
    (definitie) => definitie.obligatoriu && !dupaCamp.has(definitie.camp),
  ).map((d) => d.camp);

  return {
    potriviri,
    dupaCamp,
    coloaneIgnorate: ignorate,
    campuriLipsa: areNume ? campuriLipsa : [...campuriLipsa, "nume_complet"],
  };
}

export type RandMapat = {
  readonly rand: number;
  readonly valori: Readonly<Partial<Record<CampImport, string>>>;
};

export function mapeazaRand(brut: RandBrut, mapare: RezultatMapare): RandMapat {
  const valori: Partial<Record<CampImport, string>> = {};
  for (const [camp, coloana] of mapare.dupaCamp) {
    const valoare = brut.celule.get(coloana)?.trim();
    if (valoare !== undefined && valoare.length > 0) valori[camp] = valoare;
  }
  return { rand: brut.rand, valori };
}
