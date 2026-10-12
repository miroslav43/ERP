// src/lib/queries/flota-amenzi.ts
// Citirile pentru amenzile și incidentele flotei (0203, F11): lista amenzilor
// și a incidentelor (cursor keyset), fișa fiecăreia, sugestia de șofer la un
// moment dat și mulțimile pentru selectoare.
//
// Fișier separat de `fleet.ts`, pe care îl scriu și fazele paralele ale
// flotei. NU se adaugă filtre de scope: le pun politicile (`vehicle_fines_*`,
// `vehicle_incidents_*`, `= all` pe cheia lor), iar sugestia o judecă singură
// funcția `app.sofer_la`. Filtrul pe `organization_id` e explicit doar ca
// plasă (S1), nu ca autorizare.

import "server-only";

import {
  STADII_AMENDA,
  STADII_INCIDENT,
  type SursaSugestie,
  type StadiuAmenda,
  type StadiuIncident,
  type TipIncident,
} from "@/domain/fleet/amenzi";
import { createServerSupabase } from "@/lib/supabase/server";

import { codificaCursor, decodificaCursor, predicatKeyset } from "./cursor";

/**
 * Stadiile în care răspunsul către autoritate POATE să nu fi plecat. Nu ajunge
 * singură: o amendă contestată după ce răspunsul a plecat are tot stadiul
 * „contestată”, deci filtrul „de răspuns” cere și `raspuns_trimis_la` gol
 * (oglinda lui `internal.amenzi_scadenta` și a lui `verdictTermen`).
 */
const STADII_DE_RASPUNS: readonly StadiuAmenda[] = ["primita", "sofer_desemnat", "contestata"];
/** Stadiile incidentului neînchis. */
const STADII_INCIDENT_DESCHISE: readonly StadiuIncident[] = STADII_INCIDENT.filter(
  (s) => s !== "inchis",
);

// ── Amenzi ──────────────────────────────────────────────────────────────────

export interface RandAmenda {
  readonly id: string;
  readonly vehicle_id: string;
  readonly numar_pv: string;
  readonly data_pv: string | null;
  readonly constatata_la: string;
  readonly locul: string | null;
  readonly fapta: string;
  readonly autoritate: string | null;
  readonly suma: number | null;
  readonly primita_la: string;
  readonly termen_raspuns: string | null;
  readonly stadiu: StadiuAmenda;
  readonly sofer_desemnat_id: string | null;
  readonly desemnat_la: string | null;
  readonly raspuns_trimis_la: string | null;
  readonly raspuns_numar: string | null;
  readonly motiv: string | null;
  readonly observatii: string | null;
}

const COLOANE_AMENDA =
  "id, vehicle_id, numar_pv, data_pv, constatata_la, locul, fapta, autoritate, suma, primita_la, " +
  "termen_raspuns, stadiu, sofer_desemnat_id, desemnat_la, raspuns_trimis_la, raspuns_numar, motiv, observatii";

/**
 * `de_raspuns` = primită, șofer desemnat sau contestată, cu răspunsul încă
 * neplecat; `null` = toate.
 */
export type FiltruStadiuAmenda = StadiuAmenda | "de_raspuns" | null;

export interface FiltreAmenzi {
  readonly stadiu: FiltruStadiuAmenda;
  readonly vehicul: string | null;
  readonly cursor: string | null;
  readonly limita: number;
}

export interface RezultatAmenzi {
  readonly randuri: readonly RandAmenda[];
  readonly urmatorulCursor: string | null;
  readonly total: number;
}

/** Cele mai noi amenzi întâi (momentul faptei, apoi id), cu totalul filtrat. */
export async function listeazaAmenzi(
  organizationId: string,
  filtre: FiltreAmenzi,
): Promise<RezultatAmenzi> {
  const db = await createServerSupabase();

  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
      in: (c: string, v: readonly string[]) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.stadiu === "de_raspuns") {
      cu = cu.in("stadiu", STADII_DE_RASPUNS).is("raspuns_trimis_la", null);
    } else if (filtre.stadiu !== null) cu = cu.eq("stadiu", filtre.stadiu);
    if (filtre.vehicul !== null) cu = cu.eq("vehicle_id", filtre.vehicul);
    return cu;
  };

  let interogare = filtreaza(db.from("vehicle_fines").select(COLOANE_AMENDA))
    .order("constatata_la", { ascending: false })
    .order("id", { ascending: false })
    .limit(filtre.limita + 1);
  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset("constatata_la", c, "desc"));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandAmenda[]>(),
    filtreaza(db.from("vehicle_fines").select("id", { count: "exact", head: true })),
  ]);
  if (rezultat.error !== null) throw rezultat.error;
  if (numarare.error !== null) throw numarare.error;

  const toate = rezultat.data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: ultim.constatata_la, id: ultim.id })
        : null,
    total: numarare.count ?? randuri.length,
  };
}

export async function citesteAmenda(
  organizationId: string,
  id: string,
): Promise<RandAmenda | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_fines")
    .select(COLOANE_AMENDA)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandAmenda>();
  if (error !== null) throw error;
  return data;
}

export interface RezumatAmenzi {
  /** Amenzile al căror răspuns nu a plecat încă. */
  readonly deRaspuns: number;
  /** Dintre ele, cele cu termenul trecut. */
  readonly cuTermenDepasit: number;
}

/**
 * Numerele de deasupra listei. Două numărători exacte, nu o citire a
 * rândurilor: `max_rows = 1000` ar trunchia tăcut o listă mare.
 */
export async function rezumatAmenzi(organizationId: string, azi: string): Promise<RezumatAmenzi> {
  const db = await createServerSupabase();
  const deschise = () =>
    db
      .from("vehicle_fines")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("stadiu", STADII_DE_RASPUNS)
      .is("raspuns_trimis_la", null);
  const [toate, depasite] = await Promise.all([deschise(), deschise().lt("termen_raspuns", azi)]);
  if (toate.error !== null) throw toate.error;
  if (depasite.error !== null) throw depasite.error;
  return { deRaspuns: toate.count ?? 0, cuTermenDepasit: depasite.count ?? 0 };
}

export interface SugestieSofer {
  readonly employee_id: string;
  readonly sursa: SursaSugestie;
  /** Foaia sau alocarea pe care se sprijină sugestia. */
  readonly referinta_id: string;
}

/**
 * Cine conducea vehiculul la `moment` (ISO), după `app.sofer_la`: întâi linia
 * de foaie, apoi alocarea. `null` = nu se știe SAU apelantul nu administrează
 * amenzile / incidentele (funcția nu face deosebirea, deliberat).
 */
export async function soferSugerat(
  organizationId: string,
  vehicleId: string,
  moment: string,
): Promise<SugestieSofer | null> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("sofer_sugerat", {
    p_organization_id: organizationId,
    p_vehicle_id: vehicleId,
    p_moment: moment,
  });
  if (error !== null) throw error;
  const rand = data?.[0];
  if (rand === undefined) return null;
  return {
    employee_id: rand.employee_id,
    sursa: rand.sursa === "foaie" ? "foaie" : "alocare",
    referinta_id: rand.referinta_id,
  };
}

export interface OptiuneSofer {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string | null;
  readonly status: string;
}

/**
 * Toți angajații neșterși, inclusiv cei plecați: omul care conducea la
 * momentul faptei poate să nu mai lucreze în firmă, iar desemnarea îl numește
 * oricum.
 */
export async function soferiPentruDesemnare(
  organizationId: string,
): Promise<readonly OptiuneSofer[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca, status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("full_name")
    .limit(500)
    .returns<OptiuneSofer[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export interface OptiuneVehiculAmenda {
  readonly id: string;
  readonly nr_inmatriculare: string;
  readonly marca: string;
  readonly model: string;
}

/** Toate vehiculele neșterse: un vehicul vândut poate primi amenzi pe o faptă anterioară. */
export async function vehiculePentruAmenzi(
  organizationId: string,
): Promise<readonly OptiuneVehiculAmenda[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicles")
    .select("id, nr_inmatriculare, marca, model")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("nr_inmatriculare")
    .limit(500)
    .returns<OptiuneVehiculAmenda[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export interface DatePersonaleSofer {
  readonly full_name: string | null;
  readonly marca: string | null;
  readonly adresa_strada: string | null;
  readonly adresa_oras: string | null;
  readonly adresa_judet: string | null;
  readonly adresa_resedinta_strada: string | null;
  readonly adresa_resedinta_oras: string | null;
  readonly adresa_resedinta_judet: string | null;
  readonly tip_act_identitate: string | null;
  readonly serie_act: string | null;
  readonly numar_act: string | null;
}

/**
 * Datele personale cerute de art. 39 alin. (2) (fără CNP, care trece doar
 * prin `hr_read_sensitive`), citite prin RLS-ul fișei de angajat. Doar ruta
 * scrisorii le cere, după ce a verificat `employees:read = all`.
 */
export async function datePersonaleSofer(
  organizationId: string,
  employeeId: string,
): Promise<DatePersonaleSofer | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select(
      "full_name, marca, adresa_strada, adresa_oras, adresa_judet, adresa_resedinta_strada, " +
        "adresa_resedinta_oras, adresa_resedinta_judet, tip_act_identitate, serie_act, numar_act",
    )
    .eq("organization_id", organizationId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle<DatePersonaleSofer>();
  if (error !== null) throw error;
  return data;
}

// ── Incidente ───────────────────────────────────────────────────────────────

export interface RandIncident {
  readonly id: string;
  readonly vehicle_id: string;
  readonly tip: TipIncident;
  readonly produs_la: string;
  readonly locul: string | null;
  readonly descriere: string;
  readonly sofer_id: string | null;
  readonly stadiu: StadiuIncident;
  readonly cost_estimat: number | null;
  readonly cost_final: number | null;
  readonly despagubire: number | null;
  readonly asigurator: string | null;
  readonly dosar_numar: string | null;
  readonly work_accident_id: string | null;
  readonly inchis_la: string | null;
  readonly observatii: string | null;
}

const COLOANE_INCIDENT =
  "id, vehicle_id, tip, produs_la, locul, descriere, sofer_id, stadiu, cost_estimat, cost_final, " +
  "despagubire, asigurator, dosar_numar, work_accident_id, inchis_la, observatii";

/** `deschise` = tot ce nu e închis; `null` = toate. */
export type FiltruStadiuIncident = StadiuIncident | "deschise" | null;

export interface FiltreIncidente {
  readonly stadiu: FiltruStadiuIncident;
  readonly vehicul: string | null;
  readonly cursor: string | null;
  readonly limita: number;
}

export interface RezultatIncidente {
  readonly randuri: readonly RandIncident[];
  readonly urmatorulCursor: string | null;
  readonly total: number;
}

export async function listeazaIncidente(
  organizationId: string,
  filtre: FiltreIncidente,
): Promise<RezultatIncidente> {
  const db = await createServerSupabase();

  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
      in: (c: string, v: readonly string[]) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.stadiu === "deschise") cu = cu.in("stadiu", STADII_INCIDENT_DESCHISE);
    else if (filtre.stadiu !== null) cu = cu.eq("stadiu", filtre.stadiu);
    if (filtre.vehicul !== null) cu = cu.eq("vehicle_id", filtre.vehicul);
    return cu;
  };

  let interogare = filtreaza(db.from("vehicle_incidents").select(COLOANE_INCIDENT))
    .order("produs_la", { ascending: false })
    .order("id", { ascending: false })
    .limit(filtre.limita + 1);
  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset("produs_la", c, "desc"));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandIncident[]>(),
    filtreaza(db.from("vehicle_incidents").select("id", { count: "exact", head: true })),
  ]);
  if (rezultat.error !== null) throw rezultat.error;
  if (numarare.error !== null) throw numarare.error;

  const toate = rezultat.data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: ultim.produs_la, id: ultim.id })
        : null,
    total: numarare.count ?? randuri.length,
  };
}

export async function citesteIncident(
  organizationId: string,
  id: string,
): Promise<RandIncident | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_incidents")
    .select(COLOANE_INCIDENT)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandIncident>();
  if (error !== null) throw error;
  return data;
}

export interface CercetareSsm {
  readonly id: string;
  readonly numar_intern: string | null;
  readonly data_producerii: string;
  readonly locul: string;
}

/**
 * Cercetările SSM pe care apelantul le poate citi (`work_accidents`, politica
 * SSM). Cine nu are acces SSM primește listă goală, fără eroare: legătura se
 * poate pune doar de cine vede cercetarea.
 */
export async function cercetariSsm(organizationId: string): Promise<readonly CercetareSsm[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("work_accidents")
    .select("id, numar_intern, data_producerii, locul")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("data_producerii", { ascending: false })
    .limit(100)
    .returns<CercetareSsm[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/** O cercetare anume, sau `null` când nu există ori apelantul n-o poate citi. */
export async function cercetareSsmDupaId(
  organizationId: string,
  id: string,
): Promise<CercetareSsm | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("work_accidents")
    .select("id, numar_intern, data_producerii, locul")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<CercetareSsm>();
  if (error !== null) throw error;
  return data;
}

/** Filtrul de stadiu din `?stadiu=`: orice valoare necunoscută cade pe „toate”. */
export function filtruStadiuAmendaDinParametru(valoare: string | undefined): FiltruStadiuAmenda {
  if (valoare === "de_raspuns") return "de_raspuns";
  return STADII_AMENDA.find((s) => s === valoare) ?? null;
}

/** Filtrul de stadiu din `?stadiu=`: orice valoare necunoscută cade pe „toate”. */
export function filtruStadiuIncidentDinParametru(
  valoare: string | undefined,
): FiltruStadiuIncident {
  if (valoare === "deschise") return "deschise";
  return STADII_INCIDENT.find((s) => s === valoare) ?? null;
}
