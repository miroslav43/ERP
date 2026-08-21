// src/domain/organization/tari-europene.ts
// Țările europene, cu codul ISO 3166-1 alpha-2 — singura formă acceptată de
// coloanele de adresă din baza de date: `organizations.tara` are
// `check (tara ~ '^[A-Z]{2}$')`, `public_holidays.tara` are
// `check (char_length(tara) = 2)`, iar `employees.adresa_tara` are default 'RO'.
//
// ATENȚIE — a nu se confunda cu tabela `countries` din 0015_per_diem.sql.
// Aceea e nomenclatorul de diurnă (alpha2 + alpha3 + monedă + barem), acoperă
// toată lumea, se referă prin FK și NU trebuie restrânsă la Europa: o
// deplasare în interes de serviciu poate fi oriunde. Lista de aici e strict
// pentru câmpul de adresă al organizației.
//
// Acoperire: Europa geografică, nu doar UE — include Regatul Unit, Elveția,
// Norvegia, Balcanii de Vest, Republica Moldova, Ucraina și statele
// transcontinentale uzuale (Turcia, Georgia, Armenia, Azerbaidjan). O firmă
// românească are parteneri și sedii în afara UE; o listă doar-UE ar bloca
// adrese perfect legitime.

export type Tara = Readonly<{
  /** ISO 3166-1 alpha-2, două majuscule. */
  cod: string;
  denumire: string;
}>;

/** Sortate după denumire, cu România prima — cazul covârșitor de frecvent. */
export const TARI_EUROPENE: readonly Tara[] = [
  { cod: "RO", denumire: "România" },
  { cod: "AL", denumire: "Albania" },
  { cod: "AD", denumire: "Andorra" },
  { cod: "AM", denumire: "Armenia" },
  { cod: "AT", denumire: "Austria" },
  { cod: "AZ", denumire: "Azerbaidjan" },
  { cod: "BY", denumire: "Belarus" },
  { cod: "BE", denumire: "Belgia" },
  { cod: "BA", denumire: "Bosnia și Herțegovina" },
  { cod: "BG", denumire: "Bulgaria" },
  { cod: "CZ", denumire: "Cehia" },
  { cod: "CY", denumire: "Cipru" },
  { cod: "HR", denumire: "Croația" },
  { cod: "DK", denumire: "Danemarca" },
  { cod: "CH", denumire: "Elveția" },
  { cod: "EE", denumire: "Estonia" },
  { cod: "FI", denumire: "Finlanda" },
  { cod: "FR", denumire: "Franța" },
  { cod: "GE", denumire: "Georgia" },
  { cod: "DE", denumire: "Germania" },
  { cod: "GI", denumire: "Gibraltar" },
  { cod: "GR", denumire: "Grecia" },
  { cod: "IE", denumire: "Irlanda" },
  { cod: "IS", denumire: "Islanda" },
  { cod: "FO", denumire: "Insulele Feroe" },
  { cod: "IT", denumire: "Italia" },
  { cod: "XK", denumire: "Kosovo" },
  { cod: "LV", denumire: "Letonia" },
  { cod: "LI", denumire: "Liechtenstein" },
  { cod: "LT", denumire: "Lituania" },
  { cod: "LU", denumire: "Luxemburg" },
  { cod: "MK", denumire: "Macedonia de Nord" },
  { cod: "MT", denumire: "Malta" },
  { cod: "MC", denumire: "Monaco" },
  { cod: "ME", denumire: "Muntenegru" },
  { cod: "NO", denumire: "Norvegia" },
  { cod: "PL", denumire: "Polonia" },
  { cod: "PT", denumire: "Portugalia" },
  { cod: "GB", denumire: "Regatul Unit" },
  { cod: "MD", denumire: "Republica Moldova" },
  { cod: "RU", denumire: "Rusia" },
  { cod: "SM", denumire: "San Marino" },
  { cod: "RS", denumire: "Serbia" },
  { cod: "SK", denumire: "Slovacia" },
  { cod: "SI", denumire: "Slovenia" },
  { cod: "ES", denumire: "Spania" },
  { cod: "SE", denumire: "Suedia" },
  { cod: "TR", denumire: "Turcia" },
  { cod: "UA", denumire: "Ucraina" },
  { cod: "HU", denumire: "Ungaria" },
  { cod: "VA", denumire: "Vatican" },
  { cod: "NL", denumire: "Țările de Jos" },
];

export const CODURI_TARI_VALIDE: ReadonlySet<string> = new Set(TARI_EUROPENE.map((t) => t.cod));

export const TARA_IMPLICITA = "RO";
