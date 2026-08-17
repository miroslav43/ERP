// src/domain/employee/cnp.ts
/**
 * Validarea CNP-ului românesc — funcție pură, fără acces la ceas, rețea sau
 * bază de date. Poate fi rulată identic pe server, în teste și la import Excel.
 */

const PONDERI = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9] as const;
const ZILE_LUNA = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Pivot pentru cifrele 7 și 8 (rezidenți străini), unde secolul nu e codificat. */
const PIVOT_REZIDENTI_IMPLICIT = 30;

export const JUDETE_CNP: Readonly<Record<string, string>> = Object.freeze({
  "01": "Alba",
  "02": "Arad",
  "03": "Argeș",
  "04": "Bacău",
  "05": "Bihor",
  "06": "Bistrița-Năsăud",
  "07": "Botoșani",
  "08": "Brașov",
  "09": "Brăila",
  "10": "Buzău",
  "11": "Caraș-Severin",
  "12": "Cluj",
  "13": "Constanța",
  "14": "Covasna",
  "15": "Dâmbovița",
  "16": "Dolj",
  "17": "Galați",
  "18": "Gorj",
  "19": "Harghita",
  "20": "Hunedoara",
  "21": "Ialomița",
  "22": "Iași",
  "23": "Ilfov",
  "24": "Maramureș",
  "25": "Mehedinți",
  "26": "Mureș",
  "27": "Neamț",
  "28": "Olt",
  "29": "Prahova",
  "30": "Satu Mare",
  "31": "Sălaj",
  "32": "Sibiu",
  "33": "Suceava",
  "34": "Teleorman",
  "35": "Timiș",
  "36": "Tulcea",
  "37": "Vaslui",
  "38": "Vâlcea",
  "39": "Vrancea",
  "40": "București",
  "41": "București — Sector 1",
  "42": "București — Sector 2",
  "43": "București — Sector 3",
  "44": "București — Sector 4",
  "45": "București — Sector 5",
  "46": "București — Sector 6",
  "51": "Călărași",
  "52": "Giurgiu",
  "70": "Străinătate (persoane rezidente)",
});

export type GenCnp = "masculin" | "feminin";

export type MotivCnpInvalid =
  | "lipsa"
  | "caractere"
  | "lungime"
  | "cifra_sex"
  | "data_nasterii"
  | "judet"
  | "numar_ordine"
  | "cifra_control"
  | "in_viitor";

export interface CnpValid {
  readonly valid: true;
  readonly cnp: string;
  readonly dataNasterii: string;
  readonly gen: GenCnp;
  readonly judet: string;
  readonly denumireJudet: string;
  readonly rezidentStrain: boolean;
  readonly secolIncert: boolean;
}

export interface CnpInvalid {
  readonly valid: false;
  readonly motiv: MotivCnpInvalid;
  readonly mesaj: string;
}

export type RezultatCnp = CnpValid | CnpInvalid;

export interface OptiuniCnp {
  readonly astazi?: string;
  readonly pivotRezidenti?: number;
}

export function normalizeazaCnp(valoare: string): string {
  return valoare.replace(/[\s.\-_]/g, "");
}

export function cifraControlCnp(primele12: string): number | null {
  if (!/^[0-9]{12}$/.test(primele12)) {
    return null;
  }
  const suma = PONDERI.reduce(
    (acumulat, pondere, index) => acumulat + (primele12.charCodeAt(index) - 48) * pondere,
    0,
  );
  const rest = suma % 11;
  return rest === 10 ? 1 : rest;
}

function esteAnBisect(an: number): boolean {
  return (an % 4 === 0 && an % 100 !== 0) || an % 400 === 0;
}

function zileInLuna(an: number, luna: number): number {
  if (luna === 2 && esteAnBisect(an)) {
    return 29;
  }
  return ZILE_LUNA[luna - 1] ?? 0;
}

function invalid(motiv: MotivCnpInvalid, mesaj: string): CnpInvalid {
  return { valid: false, motiv, mesaj };
}

interface Incadrare {
  readonly gen: GenCnp;
  readonly secol: number | null;
  readonly rezidentStrain: boolean;
}

function incadreaza(cifraSex: number, anDouaCifre: number, pivot: number): Incadrare | null {
  switch (cifraSex) {
    case 1:
      return { gen: "masculin", secol: 1900, rezidentStrain: false };
    case 2:
      return { gen: "feminin", secol: 1900, rezidentStrain: false };
    case 3:
      return { gen: "masculin", secol: 1800, rezidentStrain: false };
    case 4:
      return { gen: "feminin", secol: 1800, rezidentStrain: false };
    case 5:
      return { gen: "masculin", secol: 2000, rezidentStrain: false };
    case 6:
      return { gen: "feminin", secol: 2000, rezidentStrain: false };
    case 7:
      return { gen: "masculin", secol: anDouaCifre <= pivot ? 2000 : 1900, rezidentStrain: true };
    case 8:
      return { gen: "feminin", secol: anDouaCifre <= pivot ? 2000 : 1900, rezidentStrain: true };
    default:
      return null;
  }
}

export function valideazaCnp(valoare: string, optiuni?: OptiuniCnp): RezultatCnp {
  const cnp = normalizeazaCnp(valoare);
  if (cnp.length === 0) {
    return invalid("lipsa", "CNP-ul lipsește.");
  }
  if (/[^0-9]/.test(cnp)) {
    return invalid("caractere", "CNP-ul poate conține doar cifre.");
  }
  if (cnp.length !== 13) {
    return invalid("lungime", `CNP-ul are ${String(cnp.length)} cifre; sunt necesare exact 13.`);
  }

  const pivot = optiuni?.pivotRezidenti ?? PIVOT_REZIDENTI_IMPLICIT;
  const cifraSex = Number(cnp.slice(0, 1));
  const anDouaCifre = Number(cnp.slice(1, 3));
  const incadrare = incadreaza(cifraSex, anDouaCifre, pivot);
  if (incadrare === null || incadrare.secol === null) {
    return invalid(
      "cifra_sex",
      `Prima cifră a CNP-ului („${cnp.slice(0, 1)}”) nu este validă: se acceptă valorile 1-8 (1-6 cetățeni români, 7-8 rezidenți străini).`,
    );
  }

  const an = incadrare.secol + anDouaCifre;
  const luna = Number(cnp.slice(3, 5));
  const zi = Number(cnp.slice(5, 7));
  if (luna < 1 || luna > 12 || zi < 1 || zi > zileInLuna(an, luna)) {
    return invalid(
      "data_nasterii",
      `Cifrele 2-7 din CNP nu formează o dată de naștere validă (${cnp.slice(1, 3)}-${cnp.slice(3, 5)}-${cnp.slice(5, 7)}).`,
    );
  }
  const dataNasterii = `${String(an).padStart(4, "0")}-${cnp.slice(3, 5)}-${cnp.slice(5, 7)}`;

  const codJudet = cnp.slice(7, 9);
  const denumireJudet = JUDETE_CNP[codJudet];
  if (denumireJudet === undefined) {
    return invalid("judet", `Codul de județ „${codJudet}” din CNP nu există.`);
  }

  if (cnp.slice(9, 12) === "000") {
    return invalid(
      "numar_ordine",
      "Numărul de ordine din CNP (ultimele trei cifre înainte de cifra de control) nu poate fi 000.",
    );
  }

  const control = cifraControlCnp(cnp.slice(0, 12));
  if (control === null || control !== Number(cnp.slice(12, 13))) {
    return invalid(
      "cifra_control",
      "Cifra de control a CNP-ului nu corespunde. Verificați cifrele introduse.",
    );
  }

  const astazi = optiuni?.astazi;
  if (astazi !== undefined && dataNasterii > astazi) {
    return invalid("in_viitor", "Data de naștere din CNP este în viitor.");
  }

  return {
    valid: true,
    cnp,
    dataNasterii,
    gen: incadrare.gen,
    judet: codJudet,
    denumireJudet,
    rezidentStrain: incadrare.rezidentStrain,
    secolIncert: incadrare.rezidentStrain,
  };
}
