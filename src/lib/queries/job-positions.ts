// src/lib/queries/job-positions.ts
// Citirile nomenclatorului de funcții.

import { ocupatiaDupaCod } from "@/domain/hr/cor-nomenclator";
import { cheieCautare } from "@/lib/text/diacritice";
import { sortareCeruta } from "@/lib/queries/cursor";
import { createServerSupabase } from "@/lib/supabase/server";
import { SORTARI_FUNCTII, type FiltreFunctii, type SortareFunctii } from "@/schemas/job-position";

/**
 * ── DE CE NOMENCLATORUL SE CITEȘTE ÎNTREG, NU PAGINAT ─────────────────────
 * Restul listelor din aplicație (`employees`, `inventory_items`, `attendance`)
 * filtrează și paginează în bază, cu cursor keyset. Aici nu, și motivul nu e
 * comoditatea:
 *
 * · **Ce caută omul nu e în bază.** Pe rând stă `cod_cor = '251401'`; ce
 *   citește el pe ecran, și deci ce tastează în căutare, e „Inginer de sistem
 *   în informatică" — un text care trăiește în `src/domain/hr/cor-nomenclator.ts`,
 *   nu într-o coloană. Un `ilike` în Postgres nu-l poate atinge. O căutare care
 *   nu găsește ce se vede pe ecran e mai rea decât lipsa căutării.
 * · **Mulțimea e mărginită prin natura ei.** Un nomenclator de funcții are
 *   zeci de rânduri, nu zeci de mii; crește cu câteva pe an. `LIMITA_FUNCTII`
 *   e de zece ori peste ce are cea mai mare firmă din producție.
 *
 * Compromisul se plătește o singură dată, aici, și e DECLARAT: dacă citirea
 * atinge limita, `trunchiat` urcă până în `<Tabel>`, care desenează marcajul.
 * `max_rows = 1000` al PostgREST ar fi tăiat oricum — diferența e că limita
 * noastră e mai mică și, mai ales, CUNOSCUTĂ de ecran.
 */
export const LIMITA_FUNCTII = 500;

/**
 * Câți angajați se citesc pentru numărătoarea pe funcție.
 *
 * PostgREST nu are `group by`, iar o numărătoare `head: true` per funcție ar fi
 * însemnat N drumuri la bază pentru N funcții. Un singur drum care aduce doar
 * coloana `job_position_id` e mai ieftin decât N, iar gruparea se face aici.
 */
export const LIMITA_ANGAJATI_NUMARATI = 5000;

/** Rândul brut, exact coloanele cerute din `job_positions`. */
export interface RandFunctie {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly cod_cor: string | null;
  readonly nivel_studii: string | null;
  readonly descriere: string | null;
  readonly activ: boolean;
}

export interface FunctieListata extends RandFunctie {
  /** Denumirea ocupației din Clasificarea Ocupațiilor. `null` = fără cod COR. */
  readonly ocupatie: string | null;
  /**
   * Codul e completat, dar nu există în nomenclator. Se poate întâmpla la o
   * funcție creată înainte ca `codCorOptional` să ceară existența codului, sau
   * după o revizuire a Clasificării care scoate ocupații.
   */
  readonly corNecunoscut: boolean;
  /**
   * Câți angajați activi au funcția asta.
   *
   * `null` înseamnă „nu s-a numărat", NU „zero" — vezi `poateNumaraAngajati`.
   * Distincția e toată miza câmpului: un zero fals ar spune „funcția e liberă,
   * se poate dezactiva" tocmai despre o funcție ocupată.
   */
  readonly numarAngajati: number | null;
}

export interface RezultatFunctii {
  readonly randuri: readonly FunctieListata[];
  /** Câte funcții are nomenclatorul înainte de filtrare — pentru starea goală. */
  readonly totalNefiltrat: number;
  /** Câte n-au cod COR, din tot nomenclatorul. Semnalul de pregătire REVISAL. */
  readonly faraCor: number;
  /** Citirea a atins limita: pe disc mai există funcții neafișate. */
  readonly trunchiat: boolean;
  readonly sortare: Readonly<{ cheie: SortareFunctii; directie: "asc" | "desc" }>;
}

const SORTARE_IMPLICITA = { cheie: "denumire", directie: "asc" } as const;

/**
 * Comparația de text se face cu regulile limbii ROMÂNE, nu cu ordinea din
 * tabelul de coduri: `Șofer` trebuie să stea după `Sudor` și înainte de
 * `Tâmplar`, iar un `.sort()` gol l-ar arunca la coadă, după `Z`, fiindcă
 * U+0218 e mai mare decât orice literă neaccentuată.
 *
 * `numeric` desface și codurile interne: `F2` înaintea lui `F10`.
 */
const COMPARATOR = new Intl.Collator("ro", { numeric: true, sensitivity: "base" });

/**
 * Câți angajați pe fiecare funcție.
 *
 * Funcție pură, exportată ca să fie testabilă: aici se decide dacă o funcție
 * arată „0 angajați" sau nu apare deloc în hartă, iar consecința e un buton de
 * dezactivare activ sau blocat.
 */
export function numaraPeFunctie(
  randuri: readonly Readonly<{ job_position_id: string | null }>[],
): ReadonlyMap<string, number> {
  const harta = new Map<string, number>();
  for (const rand of randuri) {
    if (rand.job_position_id === null) continue;
    harta.set(rand.job_position_id, (harta.get(rand.job_position_id) ?? 0) + 1);
  }
  return harta;
}

/**
 * Rândul brut + ce știe nomenclatorul COR + numărătoarea.
 *
 * `numarPeFunctie === null` (n-avem dreptul să numărăm) și „funcția nu apare în
 * hartă" (n-are niciun angajat) sunt cazuri DIFERITE și se traduc diferit:
 * `null`, respectiv `0`.
 */
export function imbogateste(
  randuri: readonly RandFunctie[],
  numarPeFunctie: ReadonlyMap<string, number> | null,
): readonly FunctieListata[] {
  return randuri.map((rand) => {
    const ocupatie = rand.cod_cor === null ? null : ocupatiaDupaCod(rand.cod_cor);
    return {
      ...rand,
      ocupatie: ocupatie?.denumire ?? null,
      corNecunoscut: rand.cod_cor !== null && ocupatie === null,
      numarAngajati: numarPeFunctie === null ? null : (numarPeFunctie.get(rand.id) ?? 0),
    };
  });
}

/**
 * Filtrarea, în memorie.
 *
 * Căutarea liberă prinde denumirea, codul intern, codul COR ȘI denumirea
 * ocupației — ultima fiind exact motivul pentru care filtrarea nu e în bază.
 *
 * Diacriticele se ignoră în amândouă direcțiile, prin `cheieCautare`: cine
 * tastează „sofer" pe o tastatură fără diacritice trebuie să găsească „Șofer",
 * iar cine a scris „Şofer" cu sedilă într-un import vechi trebuie găsit de cine
 * tastează „Șofer" cu virgulă dedesubt. Helperul e cel din
 * `src/lib/text/diacritice.ts`, nu o a șaisprezecea copie locală a lui
 * `normalize("NFD")`.
 */
export function filtreazaFunctii(
  functii: readonly FunctieListata[],
  filtre: FiltreFunctii,
): readonly FunctieListata[] {
  const cautat = filtre.q === null ? null : cheieCautare(filtre.q);

  return functii.filter((functie) => {
    if (filtre.stare === "activa" && !functie.activ) return false;
    if (filtre.stare === "inactiva" && functie.activ) return false;
    if (filtre.cor === "lipsa" && functie.cod_cor !== null) return false;
    if (cautat === null || cautat === "") return true;

    return [functie.denumire, functie.cod, functie.cod_cor, functie.ocupatie]
      .filter((v): v is string => v !== null)
      .some((v) => cheieCautare(v).includes(cautat));
  });
}

/**
 * Sortarea, în memorie.
 *
 * Denumirea e MEREU ultimul criteriu, chiar și când e și primul: fără un
 * departajator stabil, două funcții cu același număr de angajați își schimbă
 * locul între două randări ale aceleiași pagini, iar ochiul citește asta ca pe
 * o listă care „sare".
 */
export function sorteazaFunctii(
  functii: readonly FunctieListata[],
  sortare: Readonly<{ cheie: SortareFunctii; directie: "asc" | "desc" }>,
): readonly FunctieListata[] {
  const semn = sortare.directie === "asc" ? 1 : -1;

  return [...functii].sort((a, b) => {
    const diferenta =
      sortare.cheie === "cod"
        ? COMPARATOR.compare(a.cod, b.cod)
        : sortare.cheie === "cor"
          ? // Funcțiile fără cod COR se adună la coadă în ordinea crescătoare,
            // nu se amestecă printre cele cu cod: sunt lista de lucru a cuiva.
            comparaOptional(a.ocupatie ?? a.cod_cor, b.ocupatie ?? b.cod_cor)
          : sortare.cheie === "angajati"
            ? (a.numarAngajati ?? 0) - (b.numarAngajati ?? 0)
            : COMPARATOR.compare(a.denumire, b.denumire);

    return diferenta !== 0 ? semn * diferenta : COMPARATOR.compare(a.denumire, b.denumire);
  });
}

/** `null` la coadă indiferent de sens — lipsa nu e o valoare mică, e o lipsă. */
function comparaOptional(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return COMPARATOR.compare(a, b);
}

/**
 * Nomenclatorul de funcții, filtrat și sortat.
 *
 * `poateNumaraAngajati` NU e o preferință de afișare, e o poartă de corectitudine.
 * `job_positions_select` (`0005_hr_rls.sql:147`) deschide nomenclatorul și celui
 * cu `employees:read` — deci un `manager` (`employees:read = team`) și un
 * `employee` (`= own`) ajung legitim pe ecran. Numărătoarea lor ar trece însă
 * prin ACELEAȘI politici: managerul ar număra doar echipa lui, angajatul doar
 * pe el însuși. Rezultatul n-ar fi o eroare, ci „Sudor · 1 angajat" acolo unde
 * sunt nouă.
 *
 * De aceea apelantul trimite `can(permisiuni, "employees:read", "all")`, iar
 * când e fals nu se citește nimic din `employees` și coloana lipsește cu totul.
 * O cifră lipsă se vede; una parțială nu.
 */
export async function listeazaFunctii(
  organizationId: string,
  filtre: FiltreFunctii,
  poateNumaraAngajati: boolean,
): Promise<RezultatFunctii> {
  const db = await createServerSupabase();

  const [rezultatFunctii, rezultatAngajati] = await Promise.all([
    db
      .from("job_positions")
      .select("id, cod, denumire, cod_cor, nivel_studii, descriere, activ")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("denumire")
      .limit(LIMITA_FUNCTII)
      .returns<RandFunctie[]>(),
    poateNumaraAngajati
      ? db
          .from("employees")
          .select("job_position_id")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .not("job_position_id", "is", null)
          .limit(LIMITA_ANGAJATI_NUMARATI)
          .returns<{ job_position_id: string | null }[]>()
      : null,
  ]);

  if (rezultatFunctii.error !== null) throw rezultatFunctii.error;
  if (rezultatAngajati !== null && rezultatAngajati.error !== null) throw rezultatAngajati.error;

  const brute = rezultatFunctii.data ?? [];
  const numarPeFunctie =
    rezultatAngajati === null ? null : numaraPeFunctie(rezultatAngajati.data ?? []);

  const toate = imbogateste(brute, numarPeFunctie);
  const sortare = sortareCeruta<SortareFunctii>(filtre.sort, SORTARI_FUNCTII, SORTARE_IMPLICITA);

  return {
    randuri: sorteazaFunctii(filtreazaFunctii(toate, filtre), sortare),
    totalNefiltrat: toate.length,
    faraCor: toate.filter((f) => f.cod_cor === null).length,
    trunchiat: brute.length >= LIMITA_FUNCTII,
    sortare,
  };
}
