// src/domain/fleet/proces-verbal.ts
//
// Procesul-verbal de predare-primire a vehiculului (0215, F12c): listele fixe,
// regulile de avertizare și MODELUL documentului. Pur, fără I/O.
//
// ── DE CE UN SINGUR MODEL ────────────────────────────────────────────────────
// Ecranul PV-ului și PDF-ul tipărit trebuie să spună exact același lucru: omul
// semnează hârtia după ce a citit ecranul. `modelPv` traduce o singură dată
// rândul (plus instantaneul) în secțiuni de rânduri etichetă → valoare, iar
// pagina și `src/lib/pdf/proces-verbal-vehicul.ts` doar le așază. Precedentul e
// `linii-fluturas.ts`.
//
// ── DE CE LISTE FIXE ─────────────────────────────────────────────────────────
// Dotările obligatorii vin din lege (OUG 195/2002 art. 8, forma din 13.04.2024:
// trusa medicală, două triunghiuri, stingătorul), nu din preferința firmei. Ce e
// „altceva” se scrie în observații. Listele de aici sunt OGLINDA CHECK-urilor
// din `0215_flota_proces_verbal.sql`; `proces-verbal.test.ts` citește migrarea
// și le compară, fiindcă un cod care diverge dă 23514 la salvare.
//
// Lipsa unei dotări obligatorii AVERTIZEAZĂ, nu blochează (decizia I-T2): PV-ul
// există tocmai ca să consemneze că lipsea.

import type { CategorieVehicul, Combustibil } from "@/schemas/fleet";
import { formatDate, formatDateTime, toBucharestDateString } from "@/lib/format/date";

// ── Listele ────────────────────────────────────────────────────────────────

export const TIPURI_PV = ["predare", "restituire", "transfer"] as const;
export type TipPv = (typeof TIPURI_PV)[number];

export const STARI_PV = ["ciorna", "finalizat"] as const;
export type StarePv = (typeof STARI_PV)[number];

export const DOTARI_PV = [
  "trusa_medicala",
  "triunghiuri",
  "extinctor",
  "vesta_reflectorizanta",
  "roata_rezerva",
  "kit_pana",
  "cric_cheie_roti",
  "cablu_remorcare",
  "lanturi_zapada",
  "card_combustibil",
  "dispozitiv_taxare",
  "suport_telefon",
] as const;
export type CodDotare = (typeof DOTARI_PV)[number];

export const ETICHETE_DOTARI: Readonly<Record<CodDotare, string>> = {
  trusa_medicala: "Trusă medicală de prim ajutor",
  triunghiuri: "Două triunghiuri reflectorizante",
  extinctor: "Stingător",
  vesta_reflectorizanta: "Vestă reflectorizantă",
  roata_rezerva: "Roată de rezervă",
  kit_pana: "Kit de pană",
  cric_cheie_roti: "Cric și cheie de roți",
  cablu_remorcare: "Cablu de remorcare",
  lanturi_zapada: "Lanțuri de zăpadă",
  card_combustibil: "Card de combustibil",
  dispozitiv_taxare: "Dispozitiv de taxare (TollRo, Via-T)",
  suport_telefon: "Suport de telefon",
};

export const DOCUMENTE_BORD_PV = [
  "certificat_inmatriculare",
  "civ",
  "polita_rca",
  "carte_verde",
  "polita_casco",
  "copie_conforma",
  "licenta_transport",
  "carte_service",
  "manual_utilizare",
  "constatare_amiabila",
] as const;
export type CodDocumentBord = (typeof DOCUMENTE_BORD_PV)[number];

export const ETICHETE_DOCUMENTE_BORD: Readonly<Record<CodDocumentBord, string>> = {
  certificat_inmatriculare: "Certificatul de înmatriculare",
  civ: "Cartea de identitate a vehiculului (CIV)",
  polita_rca: "Polița RCA",
  carte_verde: "Cartea verde",
  polita_casco: "Polița CASCO",
  copie_conforma: "Copia conformă",
  licenta_transport: "Licența de transport",
  carte_service: "Cartea de service",
  manual_utilizare: "Manualul de utilizare",
  constatare_amiabila: "Formularul de constatare amiabilă",
};

export const ZONE_DAUNA = [
  "fata",
  "spate",
  "lateral_stanga",
  "lateral_dreapta",
  "plafon",
  "parbriz",
  "geamuri",
  "oglinzi",
  "faruri_stopuri",
  "jante_anvelope",
  "interior",
  "altele",
] as const;
export type ZonaDauna = (typeof ZONE_DAUNA)[number];

export const ETICHETE_ZONE_DAUNA: Readonly<Record<ZonaDauna, string>> = {
  fata: "Față",
  spate: "Spate",
  lateral_stanga: "Lateral stânga",
  lateral_dreapta: "Lateral dreapta",
  plafon: "Plafon",
  parbriz: "Parbriz",
  geamuri: "Geamuri",
  oglinzi: "Oglinzi",
  faruri_stopuri: "Faruri și stopuri",
  jante_anvelope: "Jante și anvelope",
  interior: "Interior",
  altele: "Altele",
};

export const NIVELURI_REZERVOR = ["rezerva", "sfert", "jumatate", "trei_sferturi", "plin"] as const;
export type NivelRezervor = (typeof NIVELURI_REZERVOR)[number];

export const ETICHETE_NIVEL_REZERVOR: Readonly<Record<NivelRezervor, string>> = {
  rezerva: "Rezervă",
  sfert: "Un sfert",
  jumatate: "Jumătate",
  trei_sferturi: "Trei sferturi",
  plin: "Plin",
};

export const STARI_GENERALE = ["buna", "uzura_normala", "necesita_interventie"] as const;
export type StareGenerala = (typeof STARI_GENERALE)[number];

export const ETICHETE_STARE_GENERALA: Readonly<Record<StareGenerala, string>> = {
  buna: "Bună",
  uzura_normala: "Uzură normală",
  necesita_interventie: "Necesită intervenție",
};

export const ANVELOPE_PV = ["vara", "iarna", "all_season"] as const;
export type AnvelopePv = (typeof ANVELOPE_PV)[number];

export const ETICHETE_ANVELOPE_PV: Readonly<Record<AnvelopePv, string>> = {
  vara: "De vară",
  iarna: "De iarnă",
  all_season: "All-season",
};

export const ETICHETE_TIP_PV: Readonly<Record<TipPv, string>> = {
  predare: "Predarea vehiculului către salariat",
  restituire: "Restituirea vehiculului de către salariat",
  transfer: "Transferul vehiculului între salariați",
};

/** Plafonul de daune pe un PV, oglinda lui `pvv_daune_ck`. */
export const MAXIM_DAUNE = 30;

// ── Regulile ───────────────────────────────────────────────────────────────

/** Autovehiculele de la art. 8 OUG 195/2002 (fără motociclete, remorci, utilaje). */
const CU_DOTARI_OBLIGATORII: ReadonlySet<CategorieVehicul> = new Set([
  "autoturism",
  "autoutilitara",
  "camion",
  "autobuz",
  "microbuz",
]);

const DOTARI_OBLIGATORII: readonly CodDotare[] = ["trusa_medicala", "triunghiuri", "extinctor"];

/**
 * Dotările obligatorii ale categoriei (OUG 195/2002 art. 8). Motocicletele,
 * remorcile și semiremorcile nu le au; utilajele și „altele” nu se pot
 * judeca din categorie (vezi avertismentul „drumuri publice”).
 */
export function dotariObligatoriiPentru(categorie: CategorieVehicul): readonly CodDotare[] {
  return CU_DOTARI_OBLIGATORII.has(categorie) ? DOTARI_OBLIGATORII : [];
}

/** Categoriile la care se cere verificarea „circulă pe drumuri publice?”. */
export function ceraVerificareDrumuriPublice(categorie: CategorieVehicul): boolean {
  return categorie === "utilaj" || categorie === "altele";
}

/** Remorcile n-au bord: kilometrajul se consemnează 0 și se tipărește „—”. */
export function areBord(categorie: CategorieVehicul): boolean {
  return categorie !== "remorca" && categorie !== "semiremorca";
}

/**
 * Oglinda regulii din `internal.pv_vehicul_inainte` (pasul B), pentru titlul
 * casetei înainte de salvare. `null` = niciun capăt de alocare.
 */
export function tipPv(
  alocari: Readonly<{ predataId: string | null; primitaId: string | null }>,
): TipPv | null {
  if (alocari.predataId !== null && alocari.primitaId !== null) return "transfer";
  if (alocari.primitaId !== null) return "predare";
  if (alocari.predataId !== null) return "restituire";
  return null;
}

/**
 * Eticheta nivelului: la un electric „baterie”, altfel „combustibil”. La
 * `hibrid_plugin` vehiculul are și rezervor, și baterie, iar PV-ul are o singură
 * coloană: se consemnează combustibilul, iar bateria în observații (decizie de
 * implementare F12c).
 */
export function etichetaNivel(combustibil: Combustibil | null): string {
  return combustibil === "electric" ? "Nivel baterie" : "Nivel combustibil";
}

/**
 * Codurile nomenclatorului de documente ale vehiculului (`vehicle_document_types`)
 * care au un document de bord corespondent. Precompletează bifele ciornei.
 */
const DOCUMENT_BORD_DIN_TIP: Readonly<Record<string, CodDocumentBord>> = {
  rca: "polita_rca",
  casco: "polita_casco",
  copie_conforma: "copie_conforma",
  licenta_transport: "licenta_transport",
};

/** Dotările care au un rând în nomenclatorul de documente (scadența lor). */
const DOTARE_DIN_TIP: Readonly<Record<string, CodDotare>> = {
  extinctor: "extinctor",
  trusa_medicala: "trusa_medicala",
};

/** Documentul de bord care corespunde unui tip de document al vehiculului, dacă există. */
export function documentBordDinTip(codTip: string): CodDocumentBord | null {
  return DOCUMENT_BORD_DIN_TIP[codTip] ?? null;
}

/** Bifele propuse pe ciornă, din documentele CURENTE ale vehiculului. */
export function bifePropuse(coduriTipuriCurente: readonly string[]): Readonly<{
  documente: readonly CodDocumentBord[];
  dotari: readonly CodDotare[];
}> {
  const documente = new Set<CodDocumentBord>(["certificat_inmatriculare"]);
  const dotari = new Set<CodDotare>();
  for (const cod of coduriTipuriCurente) {
    const document = DOCUMENT_BORD_DIN_TIP[cod];
    if (document !== undefined) documente.add(document);
    const dotare = DOTARE_DIN_TIP[cod];
    if (dotare !== undefined) dotari.add(dotare);
  }
  return {
    documente: DOCUMENTE_BORD_PV.filter((c) => documente.has(c)),
    dotari: DOTARI_PV.filter((c) => dotari.has(c)),
  };
}

// ── Formele de date ────────────────────────────────────────────────────────

export interface DaunaPv {
  readonly zona: ZonaDauna;
  readonly descriere: string;
}

export interface VehiculPv {
  readonly nr_inmatriculare: string;
  readonly marca: string;
  readonly model: string;
  readonly vin: string | null;
  readonly categorie: CategorieVehicul;
  readonly tip_combustibil: Combustibil;
  readonly an_fabricatie: number | null;
}

export interface ParteaPv {
  readonly tip: "firma" | "angajat";
  readonly nume: string | null;
  readonly marca: string | null;
  readonly functie: string | null;
}

export interface ReprezentantPv {
  readonly nume: string | null;
  readonly functie: string | null;
}

/** Un document al vehiculului, la momentul PV-ului (instantaneu) sau azi (ciornă). */
export interface DocumentLaPv {
  readonly cod: string;
  readonly denumire: string;
  readonly numar: string | null;
  readonly expira_la: string | null;
  readonly valabil: boolean;
}

/** Forma lui `vehicle_handovers.snapshot`, scrisă de `internal.pv_vehicul_instantaneu`. */
export interface InstantaneuPv {
  readonly vehicul: VehiculPv;
  readonly predator: ParteaPv;
  readonly primitor: ParteaPv;
  readonly reprezentant: ReprezentantPv;
  readonly firma: Readonly<{ denumire: string | null }>;
  readonly documente: readonly DocumentLaPv[];
}

/** Coloanele PV-ului de care au nevoie avertismentele și modelul. */
export interface DatePv {
  readonly tip: TipPv;
  readonly stare: StarePv;
  readonly moment: string;
  readonly data_pv: string;
  readonly numar: string;
  readonly numar_registru: string | null;
  readonly km_bord: number | null;
  readonly nivel_rezervor: NivelRezervor | null;
  readonly numar_chei: number | null;
  readonly stare_generala: StareGenerala | null;
  readonly anvelope: AnvelopePv | null;
  readonly documente_bord: readonly string[];
  readonly dotari: readonly string[];
  readonly daune_constatate: boolean | null;
  readonly daune: readonly DaunaPv[];
  readonly observatii: string | null;
  readonly finalizat_la: string | null;
  readonly confirmat_predator_la: string | null;
  readonly confirmat_primitor_la: string | null;
  readonly anulat_la: string | null;
  readonly motiv_anulare: string | null;
}

/**
 * Citește instantaneul din `jsonb` fără `as` orb: ce lipsește devine `null`,
 * iar un instantaneu fără vehicul nu e un instantaneu.
 */
export function citesteInstantaneu(brut: unknown): InstantaneuPv | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const v = o["vehicul"];
  if (v === null || typeof v !== "object") return null;
  const vehicul = v as Record<string, unknown>;
  const text = (x: unknown): string | null => (typeof x === "string" ? x : null);
  const parte = (x: unknown): ParteaPv => {
    const p = x !== null && typeof x === "object" ? (x as Record<string, unknown>) : {};
    return {
      tip: p["tip"] === "angajat" ? "angajat" : "firma",
      nume: text(p["nume"]),
      marca: text(p["marca"]),
      functie: text(p["functie"]),
    };
  };
  const repr =
    o["reprezentant"] !== null && typeof o["reprezentant"] === "object"
      ? (o["reprezentant"] as Record<string, unknown>)
      : {};
  const firma =
    o["firma"] !== null && typeof o["firma"] === "object"
      ? (o["firma"] as Record<string, unknown>)
      : {};
  const documente = Array.isArray(o["documente"]) ? (o["documente"] as unknown[]) : [];
  return {
    vehicul: {
      nr_inmatriculare: text(vehicul["nr_inmatriculare"]) ?? "—",
      marca: text(vehicul["marca"]) ?? "—",
      model: text(vehicul["model"]) ?? "—",
      vin: text(vehicul["vin"]),
      categorie: (text(vehicul["categorie"]) ?? "autoturism") as CategorieVehicul,
      tip_combustibil: (text(vehicul["tip_combustibil"]) ?? "altul") as Combustibil,
      an_fabricatie: typeof vehicul["an_fabricatie"] === "number" ? vehicul["an_fabricatie"] : null,
    },
    predator: parte(o["predator"]),
    primitor: parte(o["primitor"]),
    reprezentant: { nume: text(repr["nume"]), functie: text(repr["functie"]) },
    firma: { denumire: text(firma["denumire"]) },
    documente: documente
      .filter((d): d is Record<string, unknown> => d !== null && typeof d === "object")
      .map((d) => ({
        cod: text(d["cod"]) ?? "",
        denumire: text(d["denumire"]) ?? "Document",
        numar: text(d["numar"]),
        expira_la: text(d["expira_la"]),
        valabil: d["valabil"] !== false,
      })),
  };
}

/** Lista de daune din `jsonb`; elementele fără forma cerută se sar. */
export function citesteDaune(brut: unknown): readonly DaunaPv[] {
  if (!Array.isArray(brut)) return [];
  const zone = new Set<string>(ZONE_DAUNA);
  return brut
    .filter((d): d is Record<string, unknown> => d !== null && typeof d === "object")
    .filter(
      (d) =>
        typeof d["zona"] === "string" && zone.has(d["zona"]) && typeof d["descriere"] === "string",
    )
    .map((d) => ({ zona: d["zona"] as ZonaDauna, descriere: d["descriere"] as string }));
}

// ── Avertismentele ─────────────────────────────────────────────────────────

export type ContextAvertismente = Readonly<{
  categorie: CategorieVehicul;
  /** Din instantaneu la finalizat; documentele vii ale vehiculului la ciornă. */
  documente: readonly DocumentLaPv[];
  /** Kilometrajul curent al vehiculului, doar pe ciornă (pe finalizat, `null`). */
  kmCurentVehicul: number | null;
  /** Numele șoferului de dinainte, când o PREDARE simplă are un predecesor lipit. */
  predecesorLipit: string | null;
  /** Alocarea vine din backfill-ul 0173 (`de_la` aproximat). */
  alocareDinIstoric: boolean;
  /** Ziua întocmirii: a finalizării, sau azi pe ciornă (`YYYY-MM-DD`). */
  ziuaIntocmirii: string;
}>;

/** Câte zile întregi sunt între două zile `YYYY-MM-DD`. */
function zileIntre(de: string, pana: string): number {
  return Math.round((Date.parse(`${pana}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/**
 * Ce trebuie spus înainte de semnare. Nimic de aici nu blochează: baza refuză
 * doar ce e imposibil (formatul, unicitatea, imuabilitatea — decizia I-T2).
 */
export function avertismentePv(pv: DatePv, context: ContextAvertismente): readonly string[] {
  const avertismente: string[] = [];
  const dotari = new Set(pv.dotari);
  for (const cod of dotariObligatoriiPentru(context.categorie)) {
    if (!dotari.has(cod)) {
      avertismente.push(
        `Lipsește dotarea obligatorie: ${ETICHETE_DOTARI[cod].toLowerCase()} (OUG 195/2002 art. 8).`,
      );
    }
  }
  if (ceraVerificareDrumuriPublice(context.categorie)) {
    avertismente.push(
      "Verificați dacă vehiculul circulă pe drumuri publice: atunci are nevoie de trusă medicală, triunghiuri și stingător.",
    );
  }
  if (!pv.documente_bord.includes("certificat_inmatriculare")) {
    avertismente.push(
      "Certificatul de înmatriculare nu e bifat la bord. Poliția îl cere la control (OUG 195/2002 art. 35).",
    );
  }
  for (const document of context.documente) {
    if (!document.valabil) {
      avertismente.push(`${document.denumire} era expirat la data predării.`);
    }
  }
  if (
    context.kmCurentVehicul !== null &&
    pv.km_bord !== null &&
    areBord(context.categorie) &&
    pv.km_bord < context.kmCurentVehicul
  ) {
    avertismente.push(
      `Kilometrajul din procesul-verbal (${pv.km_bord.toLocaleString("ro-RO")} km) e sub cel curent al vehiculului (${context.kmCurentVehicul.toLocaleString("ro-RO")} km). Predarea e înregistrată retroactiv?`,
    );
  }
  if (pv.tip === "predare" && context.predecesorLipit !== null) {
    avertismente.push(
      `Vehiculul vine direct de la ${context.predecesorLipit}. Întocmiți un proces-verbal de transfer, nu de predare.`,
    );
  }
  if (context.alocareDinIstoric) {
    avertismente.push("Data predării a fost dedusă la introducerea istoricului; verificați-o.");
  }
  const intarziere = zileIntre(pv.data_pv, context.ziuaIntocmirii);
  if (intarziere > 1) {
    avertismente.push(
      `Procesul-verbal se întocmește la ${String(intarziere)} zile după predare. Hârtia poartă ambele date: a predării și a întocmirii.`,
    );
  }
  return avertismente;
}

// ── Modelul documentului ───────────────────────────────────────────────────

export interface RandModel {
  readonly eticheta: string;
  readonly valoare: string;
  /** Un rând care cere atenție la citire (document expirat, dotare obligatorie lipsă). */
  readonly atentie?: boolean;
}

export interface SectiuneModel {
  readonly titlu: string;
  readonly randuri: readonly RandModel[];
}

export interface SemnaturaModel {
  readonly rol: string;
  readonly nume: string;
  /** „Confirmat în aplicație la …”, dacă partea a confirmat. */
  readonly confirmare: string | null;
}

export interface ModelPv {
  readonly titlu: string;
  readonly subtitlu: string;
  /** Banda roșie a PV-ului anulat, sau `null`. */
  readonly banda: string | null;
  readonly operatiunea: string;
  readonly sectiuni: readonly SectiuneModel[];
  /** Lista de daune, sau textul explicit „Nu s-au constatat…”. */
  readonly daune: readonly string[];
  readonly observatii: string;
  readonly formula: string;
  readonly semnaturi: readonly SemnaturaModel[];
}

export type IntrareModelPv = Readonly<{
  pv: DatePv;
  vehicul: VehiculPv;
  predator: ParteaPv;
  primitor: ParteaPv;
  reprezentant: ReprezentantPv | null;
  firma: string;
  documente: readonly DocumentLaPv[];
  etichete: Readonly<{
    categorie: Readonly<Record<string, string>>;
    combustibil: Readonly<Record<string, string>>;
  }>;
}>;

const LIPSA = "—";

function numeParte(parte: ParteaPv, firma: string): string {
  if (parte.tip === "firma") return parte.nume ?? firma;
  const detalii = [parte.marca === null ? null : `marca ${parte.marca}`, parte.functie].filter(
    (x): x is string => x !== null && x.length > 0,
  );
  return `${parte.nume ?? LIPSA}${detalii.length === 0 ? "" : ` (${detalii.join(", ")})`}`;
}

function numeSemnatura(
  parte: ParteaPv,
  firma: string,
  reprezentant: ReprezentantPv | null,
): string {
  if (parte.tip === "angajat") return parte.nume ?? LIPSA;
  return reprezentant?.nume === null || reprezentant?.nume === undefined
    ? firma
    : `${firma}, prin ${reprezentant.nume}`;
}

function confirmare(la: string | null, nume: string): string | null {
  return la === null ? null : `Confirmat în aplicație de ${nume} la ${formatDateTime(la)}.`;
}

/** Ziua din `moment`, în ora României, `YYYY-MM-DD`. */
function ziuaRomaniei(moment: string): string {
  return toBucharestDateString(new Date(moment));
}

/**
 * Rândurile documentului, în ordinea hârtiei (E1, E14 din specificație): ce
 * operațiune, cine, ce vehicul, kilometrajul și rezervorul, documentele și
 * dotările, starea, daunele, observațiile, formula și semnăturile.
 */
export function modelPv(intrare: IntrareModelPv): ModelPv {
  const { pv, vehicul, firma } = intrare;
  const ora = formatDateTime(pv.moment);
  const finalizat = pv.stare === "finalizat";
  const ziuaIntocmirii = pv.finalizat_la === null ? null : ziuaRomaniei(pv.finalizat_la);

  const subtitluParti = [
    finalizat ? `Nr. ${pv.numar} din ${formatDate(pv.data_pv)}` : "Ciornă, fără număr",
    `predare la ${ora}`,
    pv.numar_registru === null ? null : `Înregistrat sub nr. ${pv.numar_registru}`,
    ziuaIntocmirii !== null && ziuaIntocmirii !== pv.data_pv
      ? `Întocmit la ${formatDate(ziuaIntocmirii)}`
      : null,
  ].filter((x): x is string => x !== null);

  const banda =
    pv.anulat_la === null
      ? null
      : `ANULAT la ${formatDateTime(pv.anulat_la)}${pv.motiv_anulare === null ? "" : ` — motiv: ${pv.motiv_anulare}`}`;

  const parti: RandModel[] = [
    { eticheta: "A predat", valoare: numeParte(intrare.predator, firma) },
    { eticheta: "A primit", valoare: numeParte(intrare.primitor, firma) },
  ];
  if (pv.tip === "transfer") {
    parti.push({
      eticheta: "Reprezentantul firmei",
      valoare:
        intrare.reprezentant?.nume === null || intrare.reprezentant?.nume === undefined
          ? `${firma}`
          : `${intrare.reprezentant.nume}${intrare.reprezentant.functie === null ? "" : ` (${intrare.reprezentant.functie})`}, pentru ${firma}`,
    });
  }

  const vehiculRanduri: RandModel[] = [
    { eticheta: "Număr de înmatriculare", valoare: vehicul.nr_inmatriculare },
    { eticheta: "Marca și modelul", valoare: `${vehicul.marca} ${vehicul.model}` },
    { eticheta: "Serie șasiu (VIN)", valoare: vehicul.vin ?? LIPSA },
    {
      eticheta: "Categoria",
      valoare: intrare.etichete.categorie[vehicul.categorie] ?? vehicul.categorie,
    },
    {
      eticheta: "Combustibil",
      valoare: intrare.etichete.combustibil[vehicul.tip_combustibil] ?? vehicul.tip_combustibil,
    },
    {
      eticheta: "Anul fabricației",
      valoare: vehicul.an_fabricatie === null ? LIPSA : String(vehicul.an_fabricatie),
    },
  ];

  const bord = areBord(vehicul.categorie);
  const kmRanduri: RandModel[] = [
    {
      eticheta: "Kilometraj la bord",
      valoare:
        pv.km_bord === null || (!bord && pv.km_bord === 0)
          ? LIPSA
          : `${pv.km_bord.toLocaleString("ro-RO")} km`,
    },
    {
      eticheta: etichetaNivel(vehicul.tip_combustibil),
      valoare: pv.nivel_rezervor === null ? LIPSA : ETICHETE_NIVEL_REZERVOR[pv.nivel_rezervor],
    },
    { eticheta: "Număr de chei", valoare: pv.numar_chei === null ? LIPSA : String(pv.numar_chei) },
  ];

  // Documentele: bifa de la bord, plus valabilitatea din nomenclator (unde există).
  const valabilitate = new Map<CodDocumentBord, DocumentLaPv>();
  for (const document of intrare.documente) {
    const cod = documentBordDinTip(document.cod);
    if (cod !== null) valabilitate.set(cod, document);
  }
  const documenteBord = new Set(pv.documente_bord);
  const documenteRanduri: RandModel[] = DOCUMENTE_BORD_PV.map((cod) => {
    const document = valabilitate.get(cod);
    const predat = documenteBord.has(cod) ? "Da" : "Nu";
    if (document === undefined) return { eticheta: ETICHETE_DOCUMENTE_BORD[cod], valoare: predat };
    const pana =
      document.expira_la === null
        ? ""
        : document.valabil
          ? ` · valabil până la ${formatDate(document.expira_la)}`
          : ` · expirat la data predării (${formatDate(document.expira_la)})`;
    return {
      eticheta: ETICHETE_DOCUMENTE_BORD[cod],
      valoare: `${predat}${pana}`,
      ...(document.valabil ? {} : { atentie: true }),
    };
  });

  const obligatorii = new Set(dotariObligatoriiPentru(vehicul.categorie));
  const dotari = new Set(pv.dotari);
  const dotariRanduri: RandModel[] = DOTARI_PV.map((cod) => {
    const are = dotari.has(cod);
    const obligatorie = obligatorii.has(cod);
    return {
      eticheta: obligatorie
        ? `${ETICHETE_DOTARI[cod]} — obligatorie (OUG 195/2002 art. 8)`
        : ETICHETE_DOTARI[cod],
      valoare: are ? "Da" : "Nu",
      ...(obligatorie && !are ? { atentie: true } : {}),
    };
  });

  const stareRanduri: RandModel[] = [
    {
      eticheta: "Starea generală",
      valoare: pv.stare_generala === null ? LIPSA : ETICHETE_STARE_GENERALA[pv.stare_generala],
    },
    {
      eticheta: "Anvelope",
      valoare: pv.anvelope === null ? LIPSA : ETICHETE_ANVELOPE_PV[pv.anvelope],
    },
  ];

  const daune =
    pv.daune_constatate === false
      ? ["Nu s-au constatat daune vizibile."]
      : pv.daune_constatate === null
        ? ["Nedeclarat încă."]
        : pv.daune.map((d) => `${ETICHETE_ZONE_DAUNA[d.zona]} — ${d.descriere}`);

  const trei = pv.tip === "transfer";
  const exemplare = trei ? "3 exemplare" : "2 exemplare";
  const formula =
    `Prin semnarea prezentului proces-verbal, primitorul confirmă preluarea vehiculului, a documentelor ` +
    `și a dotărilor consemnate mai sus, în starea descrisă. Documentul se întocmește în ${exemplare}, ` +
    `câte unul pentru fiecare parte.`;

  const numePredator = numeSemnatura(intrare.predator, firma, intrare.reprezentant);
  const numePrimitor = numeSemnatura(intrare.primitor, firma, intrare.reprezentant);
  const semnaturi: SemnaturaModel[] = [
    {
      rol: "Am predat",
      nume: numePredator,
      confirmare:
        intrare.predator.tip === "angajat"
          ? confirmare(pv.confirmat_predator_la, numePredator)
          : null,
    },
    {
      rol: "Am primit",
      nume: numePrimitor,
      confirmare:
        intrare.primitor.tip === "angajat"
          ? confirmare(pv.confirmat_primitor_la, numePrimitor)
          : null,
    },
  ];
  if (trei) {
    semnaturi.push({
      rol: "Reprezentantul firmei",
      nume: intrare.reprezentant?.nume ?? firma,
      confirmare: null,
    });
  }

  return {
    titlu: "PROCES-VERBAL DE PREDARE-PRIMIRE A VEHICULULUI",
    subtitlu: subtitluParti.join(" · "),
    banda,
    operatiunea: ETICHETE_TIP_PV[pv.tip],
    sectiuni: [
      { titlu: "Părțile", randuri: parti },
      { titlu: "Vehiculul", randuri: vehiculRanduri },
      { titlu: "Kilometraj, rezervor, chei", randuri: kmRanduri },
      { titlu: "Documente la bord", randuri: documenteRanduri },
      { titlu: "Dotări", randuri: dotariRanduri },
      { titlu: "Starea vehiculului", randuri: stareRanduri },
    ],
    daune,
    observatii: pv.observatii === null || pv.observatii.trim() === "" ? LIPSA : pv.observatii,
    formula,
    semnaturi,
  };
}

/** `pv-predare-B123ABC-PVA-2026-0003` (fără diacritice: trece prin `numeFisier`). */
export function numeFisierPv(tip: TipPv, nrInmatriculare: string, numar: string): string {
  return `pv-${tip}-${nrInmatriculare}-${numar}`;
}
