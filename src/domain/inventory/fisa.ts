// src/domain/inventory/fisa.ts

/**
 * Regulile fișei unui obiect de inventar: cine îl are acum, cât e completată
 * fișa, ce s-a întâmplat cu el și cum stă garanția.
 *
 * Funcții pure, fără React, fără Supabase, fără clase CSS. Apelantul aduce
 * rândurile deja citite; aici se decide doar ce e adevărat despre ele.
 *
 * ── DE CE `status` NU E SURSA DE ADEVĂR PENTRU CUSTODIE ────────────────────
 * `inventory_items.status` e un CACHE. Îl scrie triggerul
 * `internal.inventory_alloc_propaga` (0010_inventory.sql:449, rescris în
 * 0019_fix_inventar.sql), pornind de la `inventory_allocations` — iar designul
 * o spune explicit: „status-ul de pe item e derivat, cache pentru liste; sursa
 * de adevăr rămâne `inventory_allocations`”.
 *
 * Deci `custodie()` întreabă ÎNTÂI alocarea deschisă și abia apoi statusul.
 * Dacă cele două se contrazic — un rând rămas `alocat` după o returnare
 * scrisă direct în bază, un trigger care n-a rulat la un import — fișa spune
 * adevărul din alocări, nu din cache. Ordinea inversă ar fi produs exact
 * defectul tăcut pe care nu-l vezi până nu caută cineva laptopul.
 *
 * ── DE CE CASAREA N-ARE DATĂ ───────────────────────────────────────────────
 * `inventory_items` NU are coloana `casat_la` — designul o prevedea
 * (`docs/design/design-inventory-onboarding-announcements.md:61`), migrarea
 * 0010 n-a adus-o, și am verificat în `information_schema` pe baza aplicată.
 * `updated_at` nu e o înlocuire: se mișcă la orice editare ulterioară, deci ar
 * data casarea în ziua în care cineva a corectat o literă din denumire.
 *
 * Cronologia scrie de aceea punctul de casare cu `moment: null` și fără dată pe
 * ecran. O dată inventată dintr-un `updated_at` ar fi arătat exact ca un fapt.
 */

import { toBucharestDateString } from "@/lib/format/date";
import { treaptaDinScadenta, type TreaptaScadenta } from "@/domain/scadente";
import type { StareObiect, StatusObiect } from "@/schemas/inventory";

/* ─────────────────────────── Completitudinea fișei ─────────────────────── */

/**
 * Cele douăsprezece câmpuri pe care le poate scrie omul, în ordinea din
 * formular. Trei sunt mereu completate — `denumire` și `numar_inventar` sunt
 * obligatorii în schemă, `stare` are implicit — deci minimul real e 3 din 12,
 * nu 0 din 12. Contorul nu ascunde asta: „3 din 12” e onest, „0 din 9” ar fi
 * sugerat că se poate ajunge la zero.
 */
export const CAMPURI_FISA = [
  "denumire",
  "numar_inventar",
  "serie",
  "model",
  "producator",
  "category_id",
  "data_achizitie",
  "valoare",
  "garantie_expira",
  "stare",
  "locatie",
  "observatii",
] as const;

export type CampFisa = (typeof CAMPURI_FISA)[number];

export type ObiectCompletitudine = Readonly<Record<CampFisa, unknown>>;

/**
 * Aceeași regulă ca `esteGol` din `components/ui/lista-definitii.tsx`, ca fișa
 * să nu numere altfel decât desenează: `null`, `undefined` și șirul din spații
 * albe sunt goale — în bază un câmp „curățat” rămâne des `" "`.
 *
 * `0` NU e gol. Un obiect primit gratuit are valoare 0, iar asta e o
 * informație, nu o absență. `valoare || gol` e capcana clasică.
 */
function esteCompletat(valoare: unknown): boolean {
  if (valoare === null || valoare === undefined) return false;
  if (typeof valoare === "string") return valoare.trim() !== "";
  return true;
}

/** Câte dintre cele 12 câmpuri au valoare. Între 3 și 12. */
export function campuriCompletate(obiect: ObiectCompletitudine): number {
  return CAMPURI_FISA.filter((camp) => esteCompletat(obiect[camp])).length;
}

/* ──────────────────────────────── Custodia ─────────────────────────────── */

export type ObiectCustodie = Readonly<{
  status: StatusObiect;
}>;

export type AlocareCustodie = Readonly<{
  id: string;
  predat_la: string;
  stare_la_predare: StareObiect;
  confirmat_de_angajat_la: string | null;
}>;

/**
 * Unde e obiectul, ca uniune discriminată. Cuvintele le scrie ecranul —
 * modulul ăsta n-are voie să știe română de afiș, exact ca `scadente.ts`, care
 * dă treapta și lasă pastila să aleagă eticheta.
 */
export type Custodie =
  | Readonly<{
      fel: "alocat";
      alocareId: string;
      detinator: string | null;
      predatLa: string;
      stareLaPredare: StareObiect;
      confirmatLa: string | null;
    }>
  | Readonly<{ fel: "in_stoc" }>
  | Readonly<{ fel: "in_reparatie" }>
  | Readonly<{ fel: "casat" }>;

/**
 * @param obiect          Statusul din cache — consultat abia al doilea.
 * @param alocareDeschisa Alocarea cu `returnat_la IS NULL`, dacă există.
 * @param detinator       Numele angajatului; `null` când RLS nu-l lasă citit.
 */
export function custodie(
  obiect: ObiectCustodie,
  alocareDeschisa: AlocareCustodie | null,
  detinator: string | null,
): Custodie {
  /*
    Alocarea bate statusul. Inclusiv pentru un obiect marcat `casat`: dacă
    cineva încă îl are în primire, fișa trebuie să spună asta și să ofere
    returnarea — altfel obiectul dispare din evidența omului fără ca cineva
    să fi consemnat că l-a dat înapoi.
  */
  if (alocareDeschisa !== null) {
    return {
      fel: "alocat",
      alocareId: alocareDeschisa.id,
      detinator,
      predatLa: alocareDeschisa.predat_la,
      stareLaPredare: alocareDeschisa.stare_la_predare,
      confirmatLa: alocareDeschisa.confirmat_de_angajat_la,
    };
  }
  if (obiect.status === "casat") return { fel: "casat" };
  if (obiect.status === "in_reparatie") return { fel: "in_reparatie" };
  /*
    `status === "alocat"` fără alocare deschisă ajunge tot aici, deliberat:
    nimeni nu ține obiectul, deci e în stoc. Cache-ul a rămas în urmă.
  */
  return { fel: "in_stoc" };
}

/* ─────────────────────────────── Cronologia ────────────────────────────── */

export type FelEveniment = "inregistrare" | "predare" | "returnare" | "casare";

export type EvenimentFisa = Readonly<{
  /** Cheie stabilă pentru React — `id`-ul alocării plus felul, nu indicele. */
  cheie: string;
  fel: FelEveniment;
  /** ISO. `null` NUMAI la casare: `inventory_items` n-are `casat_la`. */
  moment: string | null;
  /** Numele angajatului la predare/returnare; `null` în rest. */
  angajat: string | null;
  /** Starea fizică consemnată în acel moment. */
  stare: StareObiect | null;
}>;

export type ObiectCronologie = Readonly<{
  status: StatusObiect;
  created_at: string;
}>;

export type AlocareCronologie = Readonly<{
  id: string;
  employee_id: string;
  predat_la: string;
  returnat_la: string | null;
  stare_la_predare: StareObiect;
  stare_la_returnare: StareObiect | null;
}>;

/**
 * Punctele cronologiei, de la cel mai recent la cel mai vechi.
 *
 * Casarea, fiind fără dată, stă mereu PRIMA: e ultimul lucru care se poate
 * întâmpla unui obiect, iar `status = 'casat'` e o stare terminală păzită de
 * `internal.inventory_items_valideaza`. Nu se poate întâmpla nimic după ea.
 *
 * @param nume Numele angajaților, după `employee_id`. Lipsa unei chei nu e o
 *             eroare: RLS poate ascunde fișa colegului, iar cronologia rămâne
 *             corectă cu numele necunoscut.
 */
export function evenimenteFisa(
  obiect: ObiectCronologie,
  istoric: readonly AlocareCronologie[],
  nume: ReadonlyMap<string, string | null>,
): readonly EvenimentFisa[] {
  const puncte: EvenimentFisa[] = [];

  for (const alocare of istoric) {
    const angajat = nume.get(alocare.employee_id) ?? null;
    puncte.push({
      cheie: `${alocare.id}·predare`,
      fel: "predare",
      moment: alocare.predat_la,
      angajat,
      stare: alocare.stare_la_predare,
    });
    if (alocare.returnat_la !== null) {
      puncte.push({
        cheie: `${alocare.id}·returnare`,
        fel: "returnare",
        moment: alocare.returnat_la,
        angajat,
        stare: alocare.stare_la_returnare,
      });
    }
  }

  puncte.push({
    cheie: "inregistrare",
    fel: "inregistrare",
    moment: obiect.created_at,
    angajat: null,
    stare: null,
  });

  /*
    Sortare descrescătoare pe ISO, comparație lexicografică: `timestamptz`
    citit prin PostgREST vine mereu în aceeași formă, deci șirurile se ordonează
    ca și momentele. `new Date()` pe fiecare capăt ar fi fost 2N alocări pentru
    exact același rezultat.
  */
  puncte.sort((a, b) => (b.moment ?? "").localeCompare(a.moment ?? ""));

  if (obiect.status === "casat") {
    puncte.unshift({
      cheie: "casare",
      fel: "casare",
      moment: null,
      angajat: null,
      stare: null,
    });
  }

  return puncte;
}

/* ──────────────────────────────── Garanția ─────────────────────────────── */

/**
 * Preavizul garanției: 60 de zile.
 *
 * Mai lung decât cele 30 ale flotei și decât cele 15 ale mentenanței, fiindcă
 * măsoară altceva. Un ITP se reînnoiește; o garanție NU se reînnoiește
 * niciodată — singura acțiune posibilă înainte de expirare e să trimiți
 * obiectul în service cât mai e acoperit. Două luni e intervalul în care mai
 * încape un diagnostic plus un drum la furnizor.
 */
export const PRAG_GARANTIE_AVERTIZARE_ZILE = 60;
/** Ultimele două săptămâni: dacă mai e ceva de reclamat, acum e momentul. */
export const PRAG_GARANTIE_CRITIC_ZILE = 14;

/**
 * Treapta garanției.
 *
 * `laNull` e `neaplicabil`, NU `lipsa` — invers decât la flotă. Un vehicul fără
 * RCA e o ilegalitate care nu se aprinde niciodată singură; un obiect fără dată
 * de garanție e cazul obișnuit (un birou, un scaun, orice s-a cumpărat acum
 * șase ani). Dacă lipsa ar fi fost gravă, fiecare registru de inventar ar fi
 * pornit roșu în ziua importului.
 *
 * @param azi Ziua curentă în Europe/Bucharest, din `todayInBucharest()`.
 */
export function treaptaGarantie(garantieExpira: string | null, azi: string): TreaptaScadenta {
  return treaptaDinScadenta(garantieExpira, azi, {
    avertizareZile: PRAG_GARANTIE_AVERTIZARE_ZILE,
    criticZile: PRAG_GARANTIE_CRITIC_ZILE,
    laNull: "neaplicabil",
  });
}

/* ─────────────────────────── Vechimea în evidență ──────────────────────── */

/**
 * De câte zile e obiectul în evidență, numărat din `created_at`.
 *
 * Din `created_at`, nu din `data_achizitie`: cele două răspund la întrebări
 * diferite („de când îl știe firma” vs „de când e cumpărat”), iar
 * `data_achizitie` e goală la majoritatea obiectelor. Un contor care schimbă
 * tăcut sursa în funcție de ce e completat ar fi comparat mere cu pere între
 * două rânduri ale aceleiași liste.
 *
 * `created_at` e `timestamptz`, deci ziua se ia în Europe/Bucharest: un obiect
 * înregistrat la 23:30 local e salvat ca 20:30 UTC în vară, iar tăierea brută a
 * ISO-ului l-ar fi datat cu o zi mai devreme în ianuarie și corect în iulie.
 *
 * @param azi Ziua curentă în Europe/Bucharest, din `todayInBucharest()`.
 */
export function zileInEvidenta(creatLa: string, azi: string): number {
  const ziInregistrarii = toBucharestDateString(new Date(creatLa));
  return Math.max(0, zileIntre(ziInregistrarii, azi));
}

/** Diferența în zile între două zile ISO, prin UTC — fusul se simplifică. */
function zileIntre(de_la: string, pana_la: string): number {
  const [aY, aM, aD] = de_la.split("-").map(Number);
  const [bY, bM, bD] = pana_la.split("-").map(Number);
  const msA = Date.UTC(aY ?? 0, (aM ?? 1) - 1, aD ?? 1);
  const msB = Date.UTC(bY ?? 0, (bM ?? 1) - 1, bD ?? 1);
  return Math.round((msB - msA) / 86_400_000);
}
