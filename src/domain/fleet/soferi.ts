// src/domain/fleet/soferi.ts

/**
 * Verificările încrucișate ale șoferului (flota F9, 0204): absență aprobată în
 * ziua foii (fără tipul concediului), contract încetat, permis expirat sau fără
 * categoria vehiculului, aviz medical expirat sau lipsă, deplasare în altă
 * localitate fără delegație. Ce baza nu spune (`null`: permis fără citire, aviz
 * fără acces SSM) nu produce nicio avertizare.
 *
 * Funcții pure, fără I/O. Baza dă FAPTELE (`public.verificari_soferi`), aici se
 * decide ce se spune. Toate sunt AVERTISMENTE: nimic din ce iese de aici nu
 * blochează o foaie sau o predare (implicitele planului, decizia „avertizează,
 * nu blochează”).
 *
 * ── DE CE AICI ȘI NU ÎN SQL ───────────────────────────────────────────────
 * Maparea categoriei de vehicul pe categoria de permis și potrivirea
 * localității sunt reguli de text și de prag, cu multe cazuri de margine
 * (masă, locuri, diacritice). În vitest se testează în milisecunde; într-o
 * funcție SQL, doar pe bancul local.
 */

/** OUG 195/2002 art. 20 alin. (1), în ordinea din lege. Oglinda lui `internal.categorii_permis()`. */
export const CATEGORII_PERMIS = [
  "AM",
  "A1",
  "A2",
  "A",
  "B1",
  "B",
  "BE",
  "C1",
  "C1E",
  "C",
  "CE",
  "D1",
  "D1E",
  "D",
  "DE",
  "Tr",
  "Tb",
  "Tv",
] as const;
export type CategoriePermis = (typeof CATEGORII_PERMIS)[number];

/** Categoriile vehiculului, în oglindă cu enum-ul `vehicle_category`. */
export type CategorieVehicul =
  | "autoturism"
  | "autoutilitara"
  | "camion"
  | "autobuz"
  | "microbuz"
  | "remorca"
  | "semiremorca"
  | "utilaj"
  | "motocicleta"
  | "altele";

export interface VehiculPentruPermis {
  readonly categorie: CategorieVehicul;
  readonly masa_maxima_kg: number | null;
  readonly numar_locuri: number | null;
}

/** Un rând din `public.verificari_soferi`. */
export interface FapteSofer {
  readonly employee_id: string;
  /**
   * `absent` = o absență aprobată acoperă ziua; `null` = niciuna. Baza NU spune
   * tipul concediului: CM-ul e dată de sănătate (art. 9 GDPR) și nu se deosebește
   * de un concediu de odihnă. Orice altă valoare nenulă se tratează tot ca
   * „absent”, ca un fapt vechi să nu scape tipul pe ecran.
   */
  readonly concediu: string | null;
  readonly contract_incetat: boolean;
  /**
   * Cele trei câmpuri ale permisului (`permis_exista`, `permis_expira_la`,
   * `permis_categorii`) ies doar pentru cine ar trece politica de SELECT pe
   * `driver_licenses` pentru acel angajat (HR, administratorul, managerul
   * echipei, șoferul însuși). Ceilalți primesc `null` la `permis_exista` și la
   * `permis_categorii` = „nu se știe”, care NU e „fără permis”: ecranul nu scrie
   * nimic despre permis. Cu `permis_exista === false` baza a putut verifica,
   * iar omul n-are permis: `permis_expira_la` e `null` și se spune „fără permis”.
   */
  readonly permis_exista: boolean | null;
  readonly permis_expira_la: string | null;
  readonly permis_categorii: readonly string[] | null;
  /**
   * `apt` / `expirat` / `lipsa` doar pentru cine are acces SSM pe fișa șoferului
   * (sau administrează parcul). Pentru oricine altcineva, `null` = „nu se știe”:
   * nici „apt”, nici un semnal generic (art. 9 GDPR — și „nu e valabil” ar
   * dezvălui starea examenului). `null` mai înseamnă SSM oprit. Ecranul tratează
   * `null` ca „fără semnal”, niciodată ca problemă.
   */
  readonly aviz: string | null;
  /** O deplasare activă acoperă ziua; `null` = diurna e oprită, deci nu se judecă. */
  readonly delegatie: boolean | null;
}

export type CodAvertisment =
  | "absent"
  | "contract_incetat"
  | "permis_lipsa"
  | "permis_expirat"
  | "permis_categorie"
  | "aviz_expirat"
  | "aviz_lipsa"
  | "fara_delegatie";

export interface Avertisment {
  readonly cod: CodAvertisment;
  readonly mesaj: string;
}

const MASA_B_KG = 3500;
const MASA_C1_KG = 7500;
/** Locurile cu tot cu șoferul: B duce cel mult 8 pasageri, D1 cel mult 16. */
const LOCURI_B = 9;
const LOCURI_D1 = 17;

/**
 * Categoriile de permis care acoperă vehiculul, sau `null` când categoria lui
 * nu se judecă (remorca depinde de vehiculul tractor, utilajul de tipul lui).
 * Fără masă sau fără locuri se alege varianta mai largă dintre cele posibile,
 * nu cea mai strictă: un avertisment fals e zgomot, nu prudență.
 */
export function categoriiAcceptate(v: VehiculPentruPermis): readonly CategoriePermis[] | null {
  const masa = v.masa_maxima_kg;
  switch (v.categorie) {
    case "motocicleta":
      return ["AM", "A1", "A2", "A"];
    case "autoturism":
    case "autoutilitara":
      if (masa === null || masa <= MASA_B_KG) return ["B"];
      return masa <= MASA_C1_KG ? ["C1", "C"] : ["C"];
    case "camion":
      return masa !== null && masa > MASA_C1_KG ? ["C"] : ["C1", "C"];
    case "microbuz":
      if (v.numar_locuri !== null && v.numar_locuri <= LOCURI_B) return ["B"];
      return v.numar_locuri !== null && v.numar_locuri > LOCURI_D1 ? ["D"] : ["D1", "D"];
    case "autobuz":
      return v.numar_locuri !== null && v.numar_locuri <= LOCURI_D1 ? ["D1", "D"] : ["D"];
    default:
      return null;
  }
}

function normalizat(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

/**
 * Locul unei curse e în localitatea firmei? Textul e liber („Sediu”, „Str.
 * Fabricii 3, Cluj-Napoca”), deci regula e îngăduitoare: locul gol sau care
 * conține numele orașului e „acasă”. Rămâne o euristică — de aceea produce un
 * avertisment, niciodată un refuz.
 */
export function esteInLocalitate(loc: string | null, orasFirma: string): boolean {
  if (loc === null || loc.trim().length === 0) return true;
  const oras = normalizat(orasFirma);
  if (oras.length === 0) return true;
  return normalizat(loc).includes(oras);
}

function dataRo(iso: string): string {
  const [an, luna, zi] = iso.slice(0, 10).split("-");
  return `${zi ?? ""}.${luna ?? ""}.${an ?? ""}`;
}

export interface CursaPentruVerificare {
  readonly de_la_loc: string | null;
  readonly pana_la_loc: string | null;
}

export interface ContextVerificare {
  readonly fapte: FapteSofer;
  /** Ziua judecată, `AAAA-LL-ZZ` (ziua foii, sau azi la predare). */
  readonly zi: string;
  /** `foaie` = „în ziua foii”; `azi` = la predarea vehiculului. */
  readonly momentul?: "foaie" | "azi";
  readonly vehicul?: VehiculPentruPermis | null;
  readonly curse?: readonly CursaPentruVerificare[];
  readonly orasFirma?: string | null;
  /** Foaia are deja `business_trip_id`: delegația e chiar legată de ea. */
  readonly legataDeDeplasare?: boolean;
}

/** Avertismentele, în ordinea în care contează: omul, actele, deplasarea. */
export function avertismenteSofer(c: ContextVerificare): readonly Avertisment[] {
  const f = c.fapte;
  const cand = c.momentul === "azi" ? "astăzi" : "în ziua foii";
  const lista: Avertisment[] = [];

  // Fără tipul concediului: vezi `FapteSofer.concediu`.
  if (f.concediu !== null) {
    lista.push({ cod: "absent", mesaj: `Șoferul are o absență aprobată ${cand}.` });
  }

  if (f.contract_incetat) {
    lista.push({
      cod: "contract_incetat",
      mesaj: "Contractul de muncă al șoferului este încetat.",
    });
  }

  // `permis_exista === null`: apelantul n-are citirea permisului, baza nu spune
  // nimic. Nu e „fără permis” și nici „categorie greșită”: nicio avertizare.
  if (f.permis_exista === null) {
    // fără semnal
  } else if (!f.permis_exista || f.permis_expira_la === null) {
    lista.push({
      cod: "permis_lipsa",
      mesaj: "Șoferul nu are un permis de conducere înregistrat pe fișă.",
    });
  } else {
    if (f.permis_expira_la < c.zi) {
      lista.push({
        cod: "permis_expirat",
        mesaj: `Permisul de conducere al șoferului a expirat pe ${dataRo(f.permis_expira_la)}.`,
      });
    }
    const categoriiPermis = f.permis_categorii;
    const acceptate =
      c.vehicul === undefined || c.vehicul === null ? null : categoriiAcceptate(c.vehicul);
    if (
      acceptate !== null &&
      categoriiPermis !== null &&
      !acceptate.some((k) => categoriiPermis.includes(k))
    ) {
      lista.push({
        cod: "permis_categorie",
        mesaj: `Vehiculul cere permis de categoria ${acceptate.join(" sau ")}, iar permisul șoferului are ${
          categoriiPermis.length === 0 ? "alte categorii" : categoriiPermis.join(", ")
        }.`,
      });
    }
  }

  // Avizul: doar „expirat” și „lipsa” sunt probleme. `null` (fără acces SSM sau
  // SSM oprit) și orice alt text — „apt” inclusiv — nu produc nimic: ecranul nu
  // scrie nicio frază derivată din examenele medicale pentru cine nu le poate citi.
  if (f.aviz === "expirat") {
    lista.push({
      cod: "aviz_expirat",
      mesaj: "Avizul medical al șoferului (fișa de aptitudine) a expirat.",
    });
  } else if (f.aviz === "lipsa") {
    lista.push({
      cod: "aviz_lipsa",
      mesaj: "Șoferul nu are un aviz medical de aptitudine valabil.",
    });
  }

  const oras = c.orasFirma ?? null;
  if (
    f.delegatie === false &&
    c.legataDeDeplasare !== true &&
    oras !== null &&
    oras.trim().length > 0
  ) {
    const departe = (c.curse ?? [])
      .flatMap((cursa) => [cursa.pana_la_loc, cursa.de_la_loc])
      .find((loc) => !esteInLocalitate(loc, oras));
    if (departe !== undefined && departe !== null) {
      lista.push({
        cod: "fara_delegatie",
        mesaj: `Cursa spre „${departe.trim()}” pare în afara localității firmei (${oras.trim()}), iar șoferul nu are o deplasare (delegație) pentru ziua foii.`,
      });
    }
  }

  return lista;
}

const SCURT: Readonly<Record<CodAvertisment, string>> = {
  absent: "absent",
  contract_incetat: "contract încetat",
  permis_lipsa: "fără permis",
  permis_expirat: "permis expirat",
  permis_categorie: "categorie de permis nepotrivită",
  aviz_expirat: "aviz expirat",
  aviz_lipsa: "aviz lipsă",
  fara_delegatie: "fără delegație",
};

/** Eticheta scurtă din selectorul de șofer („permis expirat, aviz lipsă”), sau `null`. */
export function rezumatScurt(avertismente: readonly Avertisment[]): string | null {
  if (avertismente.length === 0) return null;
  return avertismente.map((a) => SCURT[a.cod]).join(", ");
}
