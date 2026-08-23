// src/lib/queries/panou.ts
import "server-only";

import type { FeatureKey } from "@/config/features";
import { meetsScope, type MinScope, type PermissionKey } from "@/config/permissions";
import { PRAG_MENTENANTA_AVERTIZARE_ZILE } from "@/domain/maintenance/scadente";
import { PRAG_FLOTA_AVERTIZARE_ZILE } from "@/domain/fleet/scadente";
import type { PermissionMap } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";

import { numarAngajatiActivi } from "./announcements";
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
}>;

/** Ce are termen. `lipsa` e o treaptă proprie, mai gravă decât „expiră curând”. */
export type ScadentePanou = Readonly<{
  ssm: Contor;
  mentenanta: Contor;
  documenteFlota: Contor;
  vehiculeFaraDocumente: Contor;
  anomaliiKm: Contor;
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

  const [expiraRes, vehiculeRes, cuDocumenteRes] = await Promise.all([
    db
      .from("vehicle_documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("este_curent", true)
      .not("expira_la", "is", null)
      .lte("expira_la", limita),
    db
      .from("vehicles")
      .select("id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(1000),
    db
      .from("vehicle_documents")
      .select("vehicle_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("este_curent", true)
      .limit(5000),
  ]);

  if (expiraRes.error !== null) throw expiraRes.error;
  if (vehiculeRes.error !== null) throw vehiculeRes.error;
  if (cuDocumenteRes.error !== null) throw cuDocumenteRes.error;

  const cuDocumente = new Set((cuDocumenteRes.data ?? []).map((d) => d.vehicle_id));
  const faraDocumente = (vehiculeRes.data ?? []).filter((v) => !cuDocumente.has(v.id)).length;

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
 */
export async function stareFirmeiAzi(organizationId: string): Promise<FirmaAzi> {
  const db = await createServerSupabase();
  const azi = aziBucuresti();

  const [activi, concedii, departamente, functii] = await Promise.all([
    numarAngajatiActivi(organizationId),
    db
      .from("leave_requests")
      .select("employee_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("status", "aprobata")
      .lte("data_inceput", azi)
      .gte("data_sfarsit", azi)
      .limit(1000),
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

  if (concedii.error !== null) throw concedii.error;
  if (departamente.error !== null) throw departamente.error;
  if (functii.error !== null) throw functii.error;

  return {
    angajatiActivi: activi,
    inConcediu: new Set((concedii.data ?? []).map((c) => c.employee_id)).size,
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
  const vedeConcedii = areModul(porti, "leave") && are(porti, "leave:read", "all");
  const vedePontaj = areModul(porti, "attendance") && are(porti, "attendance:approve", "team");
  const vedeDiurna = areModul(porti, "per_diem") && are(porti, "per_diem:approve", "team");
  const vedeFoi = areModul(porti, "fleet") && are(porti, "trip_sheets:approve", "team");
  const vedeTichete = areModul(porti, "ticketing") && are(porti, "tickets:approve", "team");

  const vedeSsm = areModul(porti, "ssm") && are(porti, "ssm:read", "all");
  const vedeMentenanta = areModul(porti, "maintenance") && are(porti, "maintenance:read", "team");
  const vedeFlota = areModul(porti, "fleet") && are(porti, "vehicles:read", "team");
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
    vedeFlota ? contorAnomaliiKm(organizationId) : null,
    vedeContracte ? contorContracteCareExpira(organizationId, PRAG_PANOU_ZILE) : null,
    stareFirmeiAzi(organizationId),
  ]);

  const coada: CoadaPanou = {
    cereriConcediu,
    saptamaniPontaj,
    deplasari,
    foiParcurs,
    tichete,
  };

  return {
    coada,
    scadente: {
      ssm,
      mentenanta,
      documenteFlota: flota === null ? null : flota.expira,
      vehiculeFaraDocumente: flota === null ? null : flota.faraDocumente,
      anomaliiKm: anomalii,
      contracteDeterminate: contracte,
    },
    firma,
    // Blocurile ascunse nu intră în total: cifra din antet trebuie să
    // corespundă cu ce se vede dedesubt, altfel omul caută patru lucruri și
    // găsește două.
    totalDeRezolvat: Object.values(coada).reduce<number>((s, v) => s + (v ?? 0), 0),
  };
}
