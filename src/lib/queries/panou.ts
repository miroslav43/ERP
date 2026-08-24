// src/lib/queries/panou.ts
import { cache } from "react";

import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/tenant/types";
import "server-only";

import type { FeatureKey } from "@/config/features";
import { meetsScope, type MinScope, type PermissionKey } from "@/config/permissions";
import { PRAG_MENTENANTA_AVERTIZARE_ZILE } from "@/domain/maintenance/scadente";
import { PRAG_FLOTA_AVERTIZARE_ZILE } from "@/domain/fleet/scadente";
import type { PermissionMap } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";

import { numarAngajatiActivi } from "./announcements";
import { citesteTot } from "./citeste-tot";
import { numarScadenteMentenanta } from "./maintenance";
import { numarScadenteSsm } from "./ssm";

/**
 * Citirile panoului principal.
 *
 * ── REGULA CARE GUVERNEAZĂ TOT FIȘIERUL ───────────────────────────────────
 * **Un contor se derivă din aceeași logică ca lista către care duce.**
 *
 * Constatat empiric, nu presupus: în firma de demonstrație există 7 sarcini de
 * aprobare în starea `in_asteptare`, și toate 7 aparțin unor cereri deja
 * `anulata` (6) sau `aprobata` (1) — cea mai veche din 18 august.
 * `approval_tasks` NU are cheie străină către entitatea aprobată (legătura e
 * polimorfă, `entity_type` + `entity_id`), deci starea sarcinii nu urmează
 * starea cererii-părinte.
 *
 * Un `count(*) where status = 'in_asteptare'` ar fi afișat „7 de semnat”
 * PERMANENT, iar la clic utilizatorul n-ar fi găsit nimic de semnat. Panoul e
 * proiectat ca registru care trebuie să se GOLEASCĂ; un contor care nu poate
 * ajunge la zero anulează tot principiul.
 *
 * De aceea numărătoarea de concedii se face pe `leave_requests`, filtrată pe
 * starea CERERII, exact cum face `deAprobat()` din `leave.ts` când compune
 * lista. Aceeași regulă se aplică peste tot mai jos.
 *
 * ── DE CE `number | null` ─────────────────────────────────────────────────
 * `null` înseamnă „blocul nu se arată” — modulul e stins sau rolul n-are
 * permisiunea. `0` înseamnă „se arată și e gol”, ceea ce e o informație bună:
 * spune că totul e în regulă. Turtite amândouă în `0`, panoul unui `manager`
 * ar fi arătat „0 vehicule cu documente expirate” pentru un modul la care nu
 * are deloc acces.
 */
export type Contor = number | null;

/** Ce așteaptă o decizie. Ordinea din tip e ordinea de pe ecran. */
export type CoadaPanou = Readonly<{
  cereriConcediu: Contor;
  saptamaniPontaj: Contor;
  deplasari: Contor;
  foiParcurs: Contor;
  tichete: Contor;
  /**
   * Anomaliile de kilometraj stăteau printre scadențe, deși n-au termen: un
   * contor de kilometraj sărit înapoi nu expiră, așteaptă pe cineva să confirme
   * sau să respingă. Locul lui e coada, care se golește — și, mai important, se
   * NUMĂRĂ: în `scadente` nu era citit de nicio componentă, deci interogarea se
   * făcea la fiecare încărcare de panou și rezultatul se arunca.
   */
  anomaliiKm: Contor;
}>;

/** Ce are termen. `lipsa` e o treaptă proprie, mai gravă decât „expiră curând”. */
export type ScadentePanou = Readonly<{
  ssm: Contor;
  mentenanta: Contor;
  documenteFlota: Contor;
  vehiculeFaraDocumente: Contor;
  contracteDeterminate: Contor;
}>;

export type FirmaAzi = Readonly<{
  angajatiActivi: number;
  inConcediu: number;
  departamente: number;
  functii: number;
}>;

export type ContoarePanou = Readonly<{
  coada: CoadaPanou;
  scadente: ScadentePanou;
  firma: FirmaAzi;
  /** Suma cozii, pentru cifra din antet. Ignoră blocurile ascunse. */
  totalDeRezolvat: number;
}>;

/** Ziua de azi în București, ca șir ISO. Comparațiile de date se fac pe șiruri. */
function aziBucuresti(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
}

function peste(zile: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + zile);
  return d.toISOString().slice(0, 10);
}

/**
 * Cereri de concediu care așteaptă o decizie, la nivel de organizație.
 *
 * Se numără CERERILE, nu sarcinile de aprobare — vezi comentariul din capul
 * fișierului. În tot `src/lib/queries/` existau opt apeluri `count: "exact"`
 * și niciunul pe concedii; badge-ul `leave_pending` din meniu era declarat și
 * nealimentat tocmai fiindcă o numărătoare naivă ar fi fost greșită.
 */
export async function contorCereriConcediu(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", ["trimisa", "in_aprobare"]);
  if (error !== null) throw error;
  return count ?? 0;
}

/** Săptămâni de pontaj trimise spre aprobare, la nivel de organizație. */
export async function contorPontajDeAprobat(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("attendance_periods")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("status", "in_aprobare");
  if (error !== null) throw error;
  return count ?? 0;
}

/** Deplasări care așteaptă aprobare. Azi lista se citește întreagă ca să se afle dacă e ceva. */
export async function contorDeplasari(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("business_trips")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("status", "in_aprobare");
  if (error !== null) throw error;
  return count ?? 0;
}

/** Foi de parcurs trimise spre aprobare. */
export async function contorFoiDeParcurs(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("trip_sheets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("status", "trimis");
  if (error !== null) throw error;
  return count ?? 0;
}

/** Tichete care așteaptă o decizie. */
export async function contorTichete(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("status", "in_aprobare");
  if (error !== null) throw error;
  return count ?? 0;
}

export type ScadenteFlota = Readonly<{
  /** Documente curente care expiră în intervalul dat sau au expirat deja. */
  expira: number;
  /** Vehicule fără NICIUN document curent. Nu se aprind niciodată singure. */
  faraDocumente: number;
}>;

/**
 * Scadențele parcului auto.
 *
 * Sursa e `vehicle_documents`, NU `public.expirables`: politica RLS a acesteia
 * din urmă cere `compliance:read`, pe care un administrator de flotă nu-l are
 * — motivul e scris deja în `fleet.ts:246-249`, iar tabela i-ar întoarce zero
 * rânduri fără nicio eroare.
 *
 * `faraDocumente` există fiindcă „lipsește” e o stare distinctă și mai gravă
 * decât „expiră curând”: un vehicul fără niciun document nu are dată de la
 * care să numere, deci nu se va aprinde NICIODATĂ singur, oricât ar trece.
 * Cazul e real în producție, nu ipotetic.
 */
export async function numarScadenteFlota(
  organizationId: string,
  pragZile: number,
): Promise<ScadenteFlota> {
  const db = await createServerSupabase();
  const limita = peste(pragZile);

  /*
   * Cele două liste trec prin `citesteTot`, nu prin `.limit()`.
   *
   * Erau `.limit(1000)` pe vehicule și `.limit(5000)` pe documente. Al doilea
   * era o cifră fără efect: `max_rows = 1000` (supabase/config.toml:18) taie
   * răspunsul la o mie ORICÂT ar cere clientul, și o face TĂCUT — fără eroare
   * și fără antet. Consecința nu era o cifră lipsă, ci una INVENTATĂ: mulțimea
   * `cuDocumente` ieșea incompletă, iar fiecare vehicul ale cărui documente
   * căzuseră dincolo de a mia poziție era raportat drept „fără niciun
   * document" — cartela roșie de pe panou, pentru vehicule în regulă.
   *
   * Primul prag e la 1000 de documente curente, adică pe la ~250 de vehicule cu
   * ITP, RCA, asigurare și copie conformă. Bucla nu costă nimic sub prag: se
   * oprește la prima pagină incompletă.
   */
  const [expiraRes, vehicule, documente] = await Promise.all([
    db
      .from("vehicle_documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("este_curent", true)
      .not("expira_la", "is", null)
      .lte("expira_la", limita),
    citesteTot<{ id: string }>(
      (dupa, pas) => {
        const q = db
          .from("vehicles")
          .select("id")
          .eq("organization_id", organizationId)
          .is("deleted_at", null);
        return (dupa === null ? q : q.gt("id", dupa))
          .order("id", { ascending: true })
          .limit(pas)
          .returns<{ id: string }[]>();
      },
      (v) => v.id,
      { nume: "vehicule" },
    ),
    citesteTot<{ id: string; vehicle_id: string }>(
      (dupa, pas) => {
        const q = db
          .from("vehicle_documents")
          .select("id, vehicle_id")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .eq("este_curent", true);
        return (dupa === null ? q : q.gt("id", dupa))
          .order("id", { ascending: true })
          .limit(pas)
          .returns<{ id: string; vehicle_id: string }[]>();
      },
      (d) => d.id,
      { nume: "documente de vehicul" },
    ),
  ]);

  if (expiraRes.error !== null) throw expiraRes.error;

  const cuDocumente = new Set(documente.map((d) => d.vehicle_id));
  const faraDocumente = vehicule.filter((v) => !cuDocumente.has(v.id)).length;

  return { expira: expiraRes.count ?? 0, faraDocumente };
}

/** Anomalii de kilometraj neconfirmate. */
export async function contorAnomaliiKm(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("odometer_anomalies")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("confirmat_la", null);
  if (error !== null) throw error;
  return count ?? 0;
}

/**
 * Contracte pe durată determinată care expiră în intervalul dat.
 *
 * `valabil_pana` e declarat pe `employment_contracts` de la început și NICIO
 * citire din proiect nu-l caută pe expirare. Consecința: un ERP de HR
 * românesc nu putea spune câte contracte determinate expiră luna viitoare,
 * deși prelungirea lor e un eveniment REVISAL cu termen.
 */
export async function contorContracteCareExpira(
  organizationId: string,
  pragZile: number,
): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("employment_contracts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("incetat_la", null)
    .not("valabil_pana", "is", null)
    .lte("valabil_pana", peste(pragZile));
  if (error !== null) throw error;
  return count ?? 0;
}

/**
 * Cine e azi la lucru și cine nu.
 *
 * „În concediu” se calculează pe cereri APROBATE care acoperă ziua curentă,
 * numărând angajați distincți: două cereri consecutive ale aceleiași persoane
 * nu fac două persoane. `count: "exact"` nu poate face `distinct`, deci se
 * aduc identificatorii — volumul e mărginit de numărul de concedii active
 * într-o singură zi, nu de istoricul lor.
 *
 * Lista trece totuși prin `citesteTot`: avea `.limit(1000)`, adică exact
 * plafonul `max_rows` al PostgREST, deci prima organizație care depășea pragul
 * ar fi primit o cifră tăiată fără nicio eroare — și tăiată în jos, ceea ce pe
 * un panou arată ca „mai puțină lume în concediu", cea mai liniștitoare formă a
 * unei cifre greșite.
 */
export async function stareFirmeiAzi(organizationId: string): Promise<FirmaAzi> {
  const db = await createServerSupabase();
  const azi = aziBucuresti();

  const [activi, concedii, departamente, functii] = await Promise.all([
    numarAngajatiActivi(organizationId),
    citesteTot<{ id: string; employee_id: string }>(
      (dupa, pas) => {
        const q = db
          .from("leave_requests")
          .select("id, employee_id")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .eq("status", "aprobata")
          .lte("data_inceput", azi)
          .gte("data_sfarsit", azi);
        return (dupa === null ? q : q.gt("id", dupa))
          .order("id", { ascending: true })
          .limit(pas)
          .returns<{ id: string; employee_id: string }[]>();
      },
      (c) => c.id,
      { nume: "concedii active azi" },
    ),
    db
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    db
      .from("job_positions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
  ]);

  if (departamente.error !== null) throw departamente.error;
  if (functii.error !== null) throw functii.error;

  return {
    angajatiActivi: activi,
    inConcediu: new Set(concedii.map((c) => c.employee_id)).size,
    departamente: departamente.count ?? 0,
    functii: functii.count ?? 0,
  };
}

/** Fereastra în care o scadență devine „de rezolvat” pe panou. */
export const PRAG_PANOU_ZILE = 30;

type Porti = Readonly<{
  features: ReadonlySet<FeatureKey>;
  /**
   * Harta întreagă, cum o dă `getPermissionMap`. `scope = "none"` e refuz
   * explicit și e deja eliminat din hartă de acolo.
   *
   * Tipul vine din `@/lib/auth/permissions`, nu din `@/config/permissions`:
   * cele două module duplică `PermissionScope` și tabelul de ranguri, iar
   * cheia e uniune strictă în primul și `string` în al doilea. Se folosește
   * tipul CANONIC, cel pe care îl produce chiar funcția care umple harta;
   * pragul se verifică cu `meetsScope` din `config`, care e cel pur și testat.
   */
  permissions: PermissionMap;
}>;

function are(porti: Porti, cheie: PermissionKey, prag: MinScope): boolean {
  return meetsScope(porti.permissions.get(cheie), prag);
}

function areModul(porti: Porti, cheie: FeatureKey): boolean {
  return porti.features.has(cheie);
}

/**
 * Toate cifrele panoului, într-un singur apel.
 *
 * ── DE CE PORȚILE SE EVALUEAZĂ ÎNAINTE ────────────────────────────────────
 * Fiecare interogare pornește DOAR dacă rolul are voie s-o vadă. Motivul e
 * scris deja în `portal/page.tsx:50-52`: o poartă verificată DUPĂ ce
 * interogarea a plecat plătește oricum drumul dus-întors la bază, iar pe un
 * panou cu douăsprezece surse asta înseamnă douăsprezece drumuri inutile
 * pentru un `manager` care vede trei blocuri.
 *
 * Un al doilea motiv, mai important: RLS ar întoarce oricum zero rânduri
 * pentru ce nu i se cuvine — dar zero rânduri arată pe ecran exact ca „totul e
 * în regulă”. `null` spune „nu se aplică”, ceea ce e altceva.
 */
export async function contoarePanou(organizationId: string, porti: Porti): Promise<ContoarePanou> {
  /*
   * Poarta era `leave:read = all`, iar asta ținea rândul de concedii ascuns
   * exact rolului a cărui treabă principală e: `manager` are `leave` pe `team`
   * (0002_authz.sql:1179 — `{read,approve}`), deci nu atingea pragul, iar
   * panoul îi spunea „Nimic nu așteaptă semnătura dumneavoastră" în timp ce
   * cererile echipei lui stăteau netrimise mai departe.
   *
   * Pragul coboară la `team`, iar cifra rămâne corectă pentru fiecare rol fără
   * niciun filtru de aplicație: politica `leave_requests_select` (0009:987) dă
   * managerului cererile subordonaților (`app.is_manager_of`) și celorlalți tot
   * ce le revine, iar `count: "exact"` trece prin ACEEAȘI politică. Numărul e
   * deci întotdeauna „câte văd eu", nu „câte există".
   */
  const vedeConcedii = areModul(porti, "leave") && are(porti, "leave:read", "team");
  const vedePontaj = areModul(porti, "attendance") && are(porti, "attendance:approve", "team");
  const vedeDiurna = areModul(porti, "per_diem") && are(porti, "per_diem:approve", "team");
  const vedeFoi = areModul(porti, "fleet") && are(porti, "trip_sheets:approve", "team");
  const vedeTichete = areModul(porti, "ticketing") && are(porti, "tickets:approve", "team");

  const vedeSsm = areModul(porti, "ssm") && are(porti, "ssm:read", "all");
  const vedeMentenanta = areModul(porti, "maintenance") && are(porti, "maintenance:read", "team");
  const vedeFlota = areModul(porti, "fleet") && are(porti, "vehicles:read", "team");
  /*
   * Anomaliile de kilometraj au poartă PROPRIE, mai strictă decât restul flotei:
   * `/flota/anomalii` se închide pe `vehicles:update = team`
   * (`flota/anomalii/page.tsx:145`), nu pe `vehicles:read`. Cu poarta comună,
   * cine avea doar drept de citire primea pe panou un rând care îl trimitea
   * într-un `AccesRestricționat` — exact defectul pentru care panoul vechi a
   * fost rescris. Regula fișierului: contorul se derivă din aceeași logică ca
   * lista către care duce, iar poarta face parte din logică.
   */
  const vedeAnomalii = areModul(porti, "fleet") && are(porti, "vehicles:update", "team");
  const vedeContracte = are(porti, "employees:read", "all");

  const [
    cereriConcediu,
    saptamaniPontaj,
    deplasari,
    foiParcurs,
    tichete,
    ssm,
    mentenanta,
    flota,
    anomalii,
    contracte,
    firma,
  ] = await Promise.all([
    vedeConcedii ? contorCereriConcediu(organizationId) : null,
    vedePontaj ? contorPontajDeAprobat(organizationId) : null,
    vedeDiurna ? contorDeplasari(organizationId) : null,
    vedeFoi ? contorFoiDeParcurs(organizationId) : null,
    vedeTichete ? contorTichete(organizationId) : null,
    vedeSsm ? numarScadenteSsm(organizationId) : null,
    vedeMentenanta
      ? numarScadenteMentenanta(organizationId, PRAG_MENTENANTA_AVERTIZARE_ZILE)
      : null,
    // Pragul flotei vine din domeniu, ca cel al mentenanței de deasupra. Aici
    // era `PRAG_PANOU_ZILE` — aceeași cifră, altă sursă: în ziua în care una
    // s-ar fi schimbat, contorul de pe panou și lista de flotă ar fi arătat
    // cifre diferite, fără nicio eroare. Contractele de mai jos RĂMÂN pe pragul
    // de panou: nu sunt documente de vehicul, e altă scadență.
    vedeFlota ? numarScadenteFlota(organizationId, PRAG_FLOTA_AVERTIZARE_ZILE) : null,
    vedeAnomalii ? contorAnomaliiKm(organizationId) : null,
    vedeContracte ? contorContracteCareExpira(organizationId, PRAG_PANOU_ZILE) : null,
    stareFirmeiAzi(organizationId),
  ]);

  const coada: CoadaPanou = {
    cereriConcediu,
    saptamaniPontaj,
    deplasari,
    foiParcurs,
    tichete,
    anomaliiKm: anomalii,
  };

  return {
    coada,
    scadente: {
      ssm,
      mentenanta,
      documenteFlota: flota === null ? null : flota.expira,
      vehiculeFaraDocumente: flota === null ? null : flota.faraDocumente,
      contracteDeterminate: contracte,
    },
    firma,
    // Blocurile ascunse nu intră în total: cifra din antet trebuie să
    // corespundă cu ce se vede dedesubt, altfel omul caută patru lucruri și
    // găsește două.
    totalDeRezolvat: Object.values(coada).reduce<number>((s, v) => s + (v ?? 0), 0),
  };
}

/**
 * Aceiași contori, dar memoizați pe cerere — pentru meniul lateral.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * `buildNavigation` primea `badges: {}` în amândouă locurile care îl cheamă
 * (`(app)/layout.tsx` și `topbar.tsx`), deci meniul nu arăta NICIODATĂ vreun
 * contor, în timp ce panoul îi calcula pe toți. Cele patru surse declarate în
 * `NAV_ITEMS` — `leave_pending`, `ssm_expiring`, `fleet_expiring`,
 * `maintenance_due` — erau tip fără implementare.
 *
 * Regula pe care o respectă: contorul din meniu se derivă din ACEEAȘI logică
 * precum lista, nu dintr-un `count()` rapid. E chiar motivul pentru care
 * `leave_pending` n-avea contor scris — unul naiv ar fi numărat cele 7 sarcini
 * `in_asteptare` din producție, toate aparținând unor cereri deja anulate sau
 * aprobate, iar meniul ar fi arătat „7" la nesfârșit.
 *
 * ── DE CE ARGUMENTE PRIMITIVE ─────────────────────────────────────────────
 * `React.cache()` compară argumentele prin IDENTITATE. `contoarePanou` primește
 * un obiect `porti` construit la fața locului, deci două apeluri din două
 * componente n-ar fi fost niciodată același apel: layout-ul și pagina ar fi
 * rulat fiecare cele unsprezece interogări. Cu `(organizationId, role,
 * memberId)` — trei șiruri — memoizarea prinde, iar `/panou` costă exact cât
 * costa înainte de a exista insignele. Capcana e documentată deja în
 * `lib/auth/features.ts:30`; aici e aceeași, cu aceeași dezlegare.
 */
export const contoarePanouPentru = cache(
  async (organizationId: string, role: AppRole, memberId: string): Promise<ContoarePanou> => {
    const [features, permissions] = await Promise.all([
      getEnabledFeatures(organizationId),
      getPermissionMap(organizationId, role, memberId),
    ]);
    return contoarePanou(organizationId, { features, permissions });
  },
);

/**
 * Cele patru insigne de meniu, din contorii de mai sus.
 *
 * `null` (bloc ascuns de modul sau de permisiune) și `0` se OMIT amândouă:
 * `buildNavigation` nu afișează un badge zero, iar o cheie lipsă și una cu zero
 * spun același lucru — „nimic de arătat aici".
 */
export function insigneMeniu(
  contoare: ContoarePanou,
): Partial<
  Record<"leave_pending" | "ssm_expiring" | "fleet_expiring" | "maintenance_due", number>
> {
  const insigne: Partial<Record<string, number>> = {};
  const pune = (cheie: string, valoare: Contor): void => {
    if (valoare !== null && valoare > 0) insigne[cheie] = valoare;
  };
  pune("leave_pending", contoare.coada.cereriConcediu);
  pune("ssm_expiring", contoare.scadente.ssm);
  pune("fleet_expiring", contoare.scadente.documenteFlota);
  pune("maintenance_due", contoare.scadente.mentenanta);
  return insigne;
}
