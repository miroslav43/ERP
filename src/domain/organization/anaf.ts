// src/domain/organization/anaf.ts
// Traducerea răspunsului ANAF (serviciul PlatitorTvaRest v9) în valorile
// formularului de înrolare. Funcții PURE, fără I/O: apelul HTTP stă în
// `src/lib/anaf/client.ts`, iar aici rămâne doar maparea — singura parte care
// merită teste, fiindcă e singura care greșește tăcut.
//
// Fără `server-only`: schema de mai jos e folosită și la parsarea răspunsului
// pe server, și ca tip al datelor primite în componenta client.
//
// Patru lucruri verificate empiric pe endpoint-ul real, nu presupuse:
//
//   1. Județul vine „MUNICIPIUL BUCUREŞTI" / „CLUJ" — majuscule, prefix
//      variabil și sedilă (U+015E). `JUDETE` e enum strict cu virgulă
//      dedesubt, deci atribuirea directă e respinsă de Zod. Cheia stabilă e
//      `scod_JudetAuto` („B", „CJ"): două litere, fără diacritice, fără prefix.
//   2. Codul poștal vine fără zeroul din față: „60787" pentru 060787 real.
//   3. Forma juridică vine ca frază („SOCIETATE COMERCIALĂ PE ACŢIUNI"),
//      nu ca abreviere.
//   4. Codul CAEN întors poate lipsi din nomenclatorul nostru (Rev.3).

import { z } from "zod";

import { CODURI_CAEN_VALIDE } from "@/domain/organization/caen-nomenclator";
import { FORME_JURIDICE, JUDETE, SECTOARE_BUCURESTI } from "@/schemas/organization";

type Judet = (typeof JUDETE)[number];
type FormaJuridica = (typeof FORME_JURIDICE)[number];
type Sector = (typeof SECTOARE_BUCURESTI)[number];

// ── 1. Schema răspunsului ────────────────────────────────────────────────────

/**
 * Deliberat TOLERANTĂ: fiecare câmp e opțional, cu valoare implicită.
 * ANAF adaugă câmpuri între versiuni (v7 → v8 → v9 au tot crescut); o schemă
 * strictă ar rupe precompletarea la următoarea lor livrare, fără ca noi să fi
 * schimbat o linie. Ce lipsește rămâne necompletat, nu aruncă.
 */
const text = z.string().default("");

const dateGeneraleSchema = z.object({
  cui: z.union([z.number(), z.string()]).optional(),
  denumire: text,
  adresa: text,
  nrRegCom: text,
  telefon: text,
  codPostal: text,
  stare_inregistrare: text,
  forma_juridica: text,
  forma_organizare: text,
  cod_CAEN: text,
  iban: text,
});

const adresaSediuSchema = z.object({
  sdenumire_Strada: text,
  snumar_Strada: text,
  sdenumire_Localitate: text,
  sdenumire_Judet: text,
  scod_JudetAuto: text,
  sdetalii_Adresa: text,
  scod_Postal: text,
});

export const firmaAnafSchema = z.object({
  date_generale: dateGeneraleSchema,
  inregistrare_scop_Tva: z
    .object({ scpTVA: z.boolean().default(false) })
    .default({ scpTVA: false }),
  stare_inactiv: z
    .object({
      statusInactivi: z.boolean().default(false),
      dataInactivare: text,
      dataReactivare: text,
      dataRadiere: text,
    })
    .default({
      statusInactivi: false,
      dataInactivare: "",
      dataReactivare: "",
      dataRadiere: "",
    }),
  adresa_sediu_social: adresaSediuSchema.optional(),
});

export const raspunsAnafSchema = z.object({
  found: z.array(firmaAnafSchema).default([]),
  notFound: z.array(z.union([z.number(), z.string()])).default([]),
});

export type FirmaAnaf = z.output<typeof firmaAnafSchema>;
export type RaspunsAnaf = z.output<typeof raspunsAnafSchema>;

// ── 2. Diacritice ────────────────────────────────────────────────────────────

/**
 * ANAF scrie ș/ț cu SEDILĂ (U+015E/U+015F/U+0162/U+0163). Regula proiectului e
 * virgula dedesubt (U+0218/U+0219/U+021A/U+021B). Se aplică pe FIECARE text
 * venit din registru — altfel „Şos. Virtuţii" ajunge așa în baza noastră și în
 * documentele oficiale generate din ea.
 */
export function sedilaInVirgula(brut: string): string {
  return brut.replaceAll("Ş", "Ș").replaceAll("ş", "ș").replaceAll("Ţ", "Ț").replaceAll("ţ", "ț");
}

/** Formă de comparație: fără diacritice, fără punctuație, majuscule. */
function cheieComparatie(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("Ş", "S")
    .replaceAll("ş", "s")
    .replaceAll("Ţ", "T")
    .replaceAll("ţ", "t")
    .replace(/[^A-Za-z]+/g, " ")
    .trim()
    .toUpperCase();
}

// ── 3. Județ ─────────────────────────────────────────────────────────────────

/**
 * Cheia e codul auto de pe numărul de înmatriculare, nu denumirea. Denumirea
 * vine în forme incompatibile între ele („MUNICIPIUL BUCUREŞTI" vs „CLUJ") și
 * cu diacritice greșite; codul auto e stabil.
 *
 * Testul din `anaf.test.ts` verifică acoperirea EXACTĂ a lui `JUDETE`: o
 * intrare uitată aici e un `undefined` tăcut într-un enum strict.
 */
export const JUDET_DUPA_COD_AUTO: ReadonlyMap<string, Judet> = new Map([
  ["AB", "Alba"],
  ["AR", "Arad"],
  ["AG", "Argeș"],
  ["BC", "Bacău"],
  ["BH", "Bihor"],
  ["BN", "Bistrița-Năsăud"],
  ["BT", "Botoșani"],
  ["BV", "Brașov"],
  ["BR", "Brăila"],
  ["B", "București"],
  ["BZ", "Buzău"],
  ["CS", "Caraș-Severin"],
  ["CL", "Călărași"],
  ["CJ", "Cluj"],
  ["CT", "Constanța"],
  ["CV", "Covasna"],
  ["DB", "Dâmbovița"],
  ["DJ", "Dolj"],
  ["GL", "Galați"],
  ["GR", "Giurgiu"],
  ["GJ", "Gorj"],
  ["HR", "Harghita"],
  ["HD", "Hunedoara"],
  ["IL", "Ialomița"],
  ["IS", "Iași"],
  ["IF", "Ilfov"],
  ["MM", "Maramureș"],
  ["MH", "Mehedinți"],
  ["MS", "Mureș"],
  ["NT", "Neamț"],
  ["OT", "Olt"],
  ["PH", "Prahova"],
  ["SM", "Satu Mare"],
  ["SJ", "Sălaj"],
  ["SB", "Sibiu"],
  ["SV", "Suceava"],
  ["TR", "Teleorman"],
  ["TM", "Timiș"],
  ["TL", "Tulcea"],
  ["VS", "Vaslui"],
  ["VL", "Vâlcea"],
  ["VN", "Vrancea"],
] satisfies readonly (readonly [string, Judet])[]);

/** Rezervă, dacă `scod_JudetAuto` lipsește: denumirea, curățată de prefixe. */
const JUDET_DUPA_DENUMIRE: ReadonlyMap<string, Judet> = new Map(
  JUDETE.map((judet) => [cheieComparatie(judet), judet]),
);

export function judetDinAnaf(codAuto: string, denumire: string): Judet | undefined {
  const dupaCod = JUDET_DUPA_COD_AUTO.get(codAuto.trim().toUpperCase());
  if (dupaCod !== undefined) return dupaCod;

  const curatat = cheieComparatie(denumire).replace(/^(JUDETUL|MUNICIPIUL|JUD)\s+/, "");
  return JUDET_DUPA_DENUMIRE.get(curatat);
}

// ── 4. Localitate și sector ──────────────────────────────────────────────────

const PREFIXE_LOCALITATE = /^(MUN\.|MUNICIPIUL|OR\.|ORAS(UL)?|ORAȘ(UL)?|COM\.|COMUNA|SAT(UL)?)\s+/i;

/**
 * `sdenumire_Localitate` vine cu prefixe („Mun. Cluj-Napoca") și, în București,
 * conține și sectorul („Sector 6 Mun. Bucureşti") — singurul loc din răspuns de
 * unde se poate afla, fiindcă `sector` e un câmp separat la noi.
 */
export function localitateDinAnaf(brut: string): Readonly<{ oras?: string; sector?: Sector }> {
  const curat = sedilaInVirgula(brut).trim();
  if (curat.length === 0) return {};

  const potrivireSector = /^sector(?:ul)?\s*([1-6])\b/i.exec(curat);
  if (potrivireSector !== null) {
    const cifra = potrivireSector[1];
    const sector = SECTOARE_BUCURESTI.find((s) => s === cifra);
    return { oras: "București", ...(sector === undefined ? {} : { sector }) };
  }

  const faraPrefix = curat.replace(PREFIXE_LOCALITATE, "").trim();
  if (faraPrefix.length < 2) return {};
  if (cheieComparatie(faraPrefix) === "BUCURESTI") return { oras: "București" };
  return { oras: faraPrefix };
}

// ── 5. Cod poștal ────────────────────────────────────────────────────────────

/**
 * ANAF taie zeroul din față: „60787" e în realitate 060787. Codurile românești
 * au exact 6 cifre, deci un șir de 5 se completează la stânga. Orice altceva se
 * ignoră — mai bine gol decât greșit pe documente.
 */
export function codPostalDinAnaf(brut: string): string | undefined {
  const cifre = brut.replace(/\D+/g, "");
  if (cifre.length === 6) return cifre;
  if (cifre.length === 5) return cifre.padStart(6, "0");
  return undefined;
}

// ── 6. Adresă ────────────────────────────────────────────────────────────────

const MAX_ADRESA = 240; // limita din `textOptional(240)` pe câmpul `adresa`.

/**
 * Se compune din `adresa_sediu_social`, NU din câmpul text `date_generale.adresa`:
 * răspunsul are trei adrese (text liber, sediu social, domiciliu fiscal) și pe
 * firme reale ele DIFERĂ. Sediul social e cel care apare pe contracte, iar
 * varianta structurată e singura care se poate împărți pe coloanele noastre.
 */
export function adresaDinAnaf(sediu: z.output<typeof adresaSediuSchema>): string | undefined {
  const strada = sedilaInVirgula(sediu.sdenumire_Strada).trim();
  const numar = sedilaInVirgula(sediu.snumar_Strada).trim();
  const detalii = sedilaInVirgula(sediu.sdetalii_Adresa).trim();

  const bucati = [strada, numar.length > 0 ? `nr. ${numar}` : "", detalii].filter(
    (bucata) => bucata.length > 0,
  );

  if (bucati.length === 0) return undefined;
  return bucati.join(", ").slice(0, MAX_ADRESA);
}

// ── 7. Formă juridică ────────────────────────────────────────────────────────

/** Ordinea contează: „DEBUTANT" trebuie testat înaintea lui SRL simplu. */
const FORME_DUPA_TIPAR: readonly (readonly [RegExp, FormaJuridica])[] = [
  [/RASPUNDERE LIMITATA.*DEBUTANT|DEBUTANT/, "SRL-D"],
  [/RASPUNDERE LIMITATA/, "SRL"],
  [/PE ACTIUNI/, "SA"],
  [/PERSOANA FIZICA AUTORIZATA/, "PFA"],
  [/INTREPRINDERE INDIVIDUALA/, "II"],
  [/INTREPRINDERE FAMILIALA/, "IF"],
  [/COMANDITA/, "SCS"],
  [/NUME COLECTIV/, "SNC"],
  [/REGIE AUTONOMA/, "RA"],
  [/ASOCIATIE|FUNDATIE|ORGANIZATIE NEGUVERNAMENTALA|SINDICAT/, "ONG"],
];

/**
 * Necunoscutul întoarce `undefined`, nu o valoare de rezervă: formularul are
 * deja „SRL" ca implicit, iar o ghicire greșită trece neobservată prin toți
 * pașii asistentului și ajunge pe documente.
 */
export function formaJuridicaDinAnaf(brut: string): FormaJuridica | undefined {
  const cheie = cheieComparatie(brut);
  if (cheie.length === 0) return undefined;
  for (const [tipar, forma] of FORME_DUPA_TIPAR) {
    if (tipar.test(cheie)) return forma;
  }
  return undefined;
}

// ── 8. Cod CAEN ──────────────────────────────────────────────────────────────

/**
 * Nomenclatorul nostru e CAEN Rev.3; ANAF servește și coduri Rev.2, care pot
 * să nu mai existe. Un cod absent ar trece de `regex(/^[0-9]{4}$/)` și ar cădea
 * abia la `.refine(CODURI_CAEN_VALIDE.has)` — adică la trimiterea formularului,
 * pe un câmp pe care utilizatorul nu l-a atins. Îl filtrăm aici.
 */
export function codCaenDinAnaf(brut: string): string | undefined {
  const cod = brut.trim();
  if (!/^[0-9]{4}$/.test(cod)) return undefined;
  return CODURI_CAEN_VALIDE.has(cod) ? cod : undefined;
}

// ── 9. Denumire ──────────────────────────────────────────────────────────────

/** Abrevieri care rămân cu majuscule într-o denumire altfel scrisă normal. */
const ABREVIERI: ReadonlySet<string> = new Set([
  ...FORME_JURIDICE,
  "SC",
  "SRL",
  "SA",
  "IT",
  "IFN",
  "SIF",
  "CEC",
]);

/**
 * ANAF întoarce denumirea integral cu majuscule („BANCA TRANSILVANIA SA").
 * `legal_name` o păstrează așa — e denumirea din statut. `name` e cea afișată
 * în aplicație, deci merită scrisă normal, cu formele juridice lăsate
 * majuscule (altfel „SA" devine „Sa").
 */
export function denumireAfisabila(brut: string): string {
  return sedilaInVirgula(brut)
    .trim()
    .split(/\s+/)
    .map((cuvant) => {
      const fara = cuvant.replace(/[.,]/g, "").toUpperCase();
      if (ABREVIERI.has(fara)) return cuvant.toUpperCase();
      if (cuvant.length <= 1) return cuvant.toUpperCase();
      return cuvant.charAt(0).toUpperCase() + cuvant.slice(1).toLowerCase();
    })
    .join(" ");
}

// ── 10. Avertismente ─────────────────────────────────────────────────────────

/**
 * O firmă radiată sau declarată inactivă NU se înrolează tăcut. Nu blocăm
 * (poate fi o eroare de registru, iar decizia e a omului), dar o spunem.
 */
export function avertismenteAnaf(firma: FirmaAnaf): readonly string[] {
  const avertismente: string[] = [];
  const stare = firma.stare_inactiv;

  if (stare.dataRadiere.trim().length > 0) {
    avertismente.push(`Firma figurează RADIATĂ în registru din ${stare.dataRadiere}.`);
  }
  if (stare.statusInactivi) {
    const din = stare.dataInactivare.trim();
    avertismente.push(
      `Firma figurează INACTIVĂ fiscal${din.length > 0 ? ` din ${din}` : ""} la ANAF.`,
    );
  }
  return avertismente;
}

// ── 11. Precompletarea ───────────────────────────────────────────────────────

/** Cheile sunt exact cele din `CAMPURI_PAS_1`, ca umplerea să fie o buclă. */
export type PrecompletareAnaf = Readonly<{
  name?: string;
  legal_name?: string;
  forma_juridica?: FormaJuridica;
  platitor_tva?: boolean;
  reg_com?: string;
  telefon_contact?: string;
  judet?: Judet;
  sector?: Sector;
  oras?: string;
  adresa?: string;
  cod_postal?: string;
  cod_caen?: string;
}>;

export type RezultatPrecompletare = Readonly<{
  denumire: string;
  valori: PrecompletareAnaf;
  avertismente: readonly string[];
}>;

/** Adaugă cheia doar dacă valoarea există — `exactOptionalPropertyTypes`. */
function adauga<C extends keyof PrecompletareAnaf>(
  tinta: Record<string, unknown>,
  cheie: C,
  valoare: PrecompletareAnaf[C] | undefined,
): void {
  if (valoare !== undefined && valoare !== "") tinta[cheie] = valoare;
}

export function precompletareDinAnaf(firma: FirmaAnaf): RezultatPrecompletare {
  const g = firma.date_generale;
  const sediu = firma.adresa_sediu_social;
  const valori: Record<string, unknown> = {};

  const denumire = sedilaInVirgula(g.denumire).trim();
  adauga(valori, "name", denumire.length > 0 ? denumireAfisabila(denumire) : undefined);
  adauga(valori, "legal_name", denumire.length > 0 ? denumire : undefined);
  adauga(valori, "forma_juridica", formaJuridicaDinAnaf(g.forma_juridica));
  adauga(valori, "reg_com", sedilaInVirgula(g.nrRegCom).trim());
  adauga(valori, "telefon_contact", g.telefon.trim());
  adauga(valori, "cod_caen", codCaenDinAnaf(g.cod_CAEN));

  // Doar `true` se propagă. ANAF e sursa de adevăr pentru „e plătitor", dar un
  // `false` care ar debifa o casetă bifată manual ar fi exact suprascrierea pe
  // care restul funcției o evită.
  if (firma.inregistrare_scop_Tva.scpTVA) valori["platitor_tva"] = true;

  if (sediu !== undefined) {
    adauga(valori, "judet", judetDinAnaf(sediu.scod_JudetAuto, sediu.sdenumire_Judet));
    const localitate = localitateDinAnaf(sediu.sdenumire_Localitate);
    adauga(valori, "oras", localitate.oras);
    adauga(valori, "sector", localitate.sector);
    adauga(valori, "adresa", adresaDinAnaf(sediu));
    // `codPostal` din `date_generale` e adesea gol, iar cel din sediu populat.
    adauga(valori, "cod_postal", codPostalDinAnaf(sediu.scod_Postal || g.codPostal));
  } else {
    adauga(valori, "cod_postal", codPostalDinAnaf(g.codPostal));
  }

  // Sectorul are sens doar în București — constrângerea `organizations_sector_ck`
  // din 0030 respinge orice altă combinație, iar aici s-ar vedea abia la salvare.
  if (valori["judet"] !== "București") delete valori["sector"];

  return {
    denumire: denumire.length > 0 ? denumire : "Firmă fără denumire în registru",
    valori: valori as PrecompletareAnaf,
    avertismente: avertismenteAnaf(firma),
  };
}
