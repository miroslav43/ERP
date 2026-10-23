// src/lib/queries/flota-iesire.ts
//
// Citirile ieșirii din parc (0218, F12h): ieșirea vie a unui vehicul, cu
// termenele ei, și istoricul ieșirilor anulate.
//
// NU se adaugă niciun filtru de scope: `iesiri_select` și
// `termene_iesire_select` cer `vehicles:read = all`. Pentru `own`/`team`
// întorc ZERO rânduri, fără eroare (implicita I-h6), deci pagina le cheamă doar
// sub `can(..., "vehicles:read", "all")`. Termenele se citesc din tabela proprie,
// NU din `expirables`: acolo politica cere și `compliance:read`, iar un termen
// care așteaptă radierea (`termen = null`) nici nu există (capcanele 19 și 26).
//
// Fișier propriu, nu adăugiri în `fleet.ts` (F12h, Decizia 11). Poarta
// `coloane.test.ts` citește tot directorul, deci îl acoperă și pe acesta.
import "server-only";

import type { TipIncident } from "@/domain/fleet/amenzi";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  DestinatieEpava,
  MotivRadiere,
  NaturaTermen,
  TipIesire,
} from "@/schemas/flota-iesire";

import { codificaCursor, decodificaCursor, predicatKeyset } from "./cursor";

/** O ieșire are cel mult unsprezece termene (catalogul); plafonul stă mult sub `max_rows`. */
const PLAFON_TERMENE = 50;
/** Un vehicul are câteva ieșiri anulate în toată viața lui. */
const PLAFON_ANULATE = 20;

export interface TermenIesire {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly natura: NaturaTermen;
  readonly temei: string | null;
  readonly nota: string | null;
  readonly ordine: number;
  readonly depinde_de: string | null;
  /** `null` = așteaptă pasul din `depinde_de` (de regulă radierea). */
  readonly termen: string | null;
  readonly finalizat_la: string | null;
  readonly nu_se_aplica: boolean;
}

interface RandIesire {
  readonly id: string;
  readonly tip: TipIesire;
  readonly destinatie_epava: DestinatieEpava | null;
  readonly motiv_radiere: MotivRadiere | null;
  readonly data_iesire: string;
  readonly km_iesire: number | null;
  readonly motiv: string;
  readonly cumparator: string | null;
  readonly pret: number | null;
  readonly nr_document: string | null;
  readonly pastreaza_numarul: boolean;
  readonly preluata_din_istoric: boolean;
  readonly observatii: string | null;
  readonly created_at: string;
  /** Incidentul (F11) care a dus la dauna totală, sau `null`. */
  readonly incident_id: string | null;
  /**
   * Incidentul încorporat. NULL fără eroare și când `incident_id` e completat:
   * `vehicle_incidents_select` cere `vehicle_incidents:read` (capcana #18).
   */
  readonly incident: Readonly<{ id: string; tip: TipIncident; produs_la: string }> | null;
}

export interface IesireVehicul extends RandIesire {
  readonly termene: readonly TermenIesire[];
}

export interface IesireAnulata {
  readonly id: string;
  readonly tip: TipIesire;
  readonly destinatie_epava: DestinatieEpava | null;
  readonly motiv_radiere: MotivRadiere | null;
  readonly data_iesire: string;
  readonly anulat_la: string;
  readonly motiv_anulare: string;
}

/** Ieșirea VIE (neanulată) a vehiculului, cu termenele în ordinea catalogului; `null` = în parc. */
export async function iesireaVehiculului(
  organizationId: string,
  vehiculId: string,
): Promise<IesireVehicul | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_exits")
    .select(
      "id, tip, destinatie_epava, motiv_radiere, data_iesire, km_iesire, motiv, cumparator, pret, " +
        "nr_document, pastreaza_numarul, preluata_din_istoric, observatii, created_at, " +
        "incident_id, incident:vehicle_incidents!incident_id(id, tip, produs_la)",
    )
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehiculId)
    .is("deleted_at", null)
    .is("anulat_la", null)
    .maybeSingle<RandIesire>();

  if (error !== null) throw error;
  if (data === null) return null;

  const { data: termene, error: eroareTermene } = await db
    .from("vehicle_exit_obligations")
    .select(
      "id, cod, denumire, natura, temei, nota, ordine, depinde_de, termen, finalizat_la, nu_se_aplica",
    )
    .eq("organization_id", organizationId)
    .eq("exit_id", data.id)
    .is("deleted_at", null)
    .order("ordine")
    .order("id")
    .limit(PLAFON_TERMENE)
    .returns<TermenIesire[]>();

  if (eroareTermene !== null) throw eroareTermene;
  return { ...data, termene: termene ?? [] };
}

/** Ieșirile anulate ale vehiculului, cele mai noi primele. Fără paginare: sunt câteva. */
export async function iesirileAnulate(
  organizationId: string,
  vehiculId: string,
): Promise<readonly IesireAnulata[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_exits")
    .select("id, tip, destinatie_epava, motiv_radiere, data_iesire, anulat_la, motiv_anulare")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehiculId)
    .is("deleted_at", null)
    .not("anulat_la", "is", null)
    .order("anulat_la", { ascending: false })
    .order("id", { ascending: false })
    .limit(PLAFON_ANULATE)
    .returns<IesireAnulata[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Termenele deschise ale tuturor vehiculelor ieșite (panoul de pe /flota) ──

/** Un termen deschis, cu ieșirea și vehiculul lui (pentru legătura spre fișă). */
export interface TermenDeschis {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly natura: NaturaTermen;
  /** Doar termenele CU dată: cele care așteaptă radierea n-au încă una. */
  readonly termen: string;
  readonly vehicle_id: string;
  readonly iesire: Readonly<{
    id: string;
    tip: TipIesire;
    destinatie_epava: DestinatieEpava | null;
    motiv_radiere: MotivRadiere | null;
  }>;
  /** NULL fără eroare dacă vehiculul nu se mai vede (capcana #18). */
  readonly vehicul: Readonly<{ id: string; nr_inmatriculare: string }> | null;
}

export interface PaginaTermeneDeschise {
  readonly randuri: readonly TermenDeschis[];
  readonly urmatorulCursor: string | null;
}

/**
 * Termenele de ieșire DESCHISE ale firmei, cele mai apropiate primele (F12h).
 *
 * Deschis = cu dată, nebifat, nu „nu se aplică”, al unei ieșiri VII: termenele
 * unei ieșiri anulate rămân în tabelă ca istoric, deci ies prin join-ul `!inner`
 * cu `anulat_la is null`. Termenele care așteaptă radierea (`termen = null`) nu
 * intră: n-au încă o dată, iar `expirables` nici nu le are (capcana #59).
 *
 * Keyset pe `(termen, id)`, crescător; `limita + 1` spune dacă mai urmează.
 * Doar sub `vehicles:read = all` (politica): altfel ZERO rânduri, fără eroare.
 */
export async function termeneDeIesireDeschise(
  organizationId: string,
  pagina: Readonly<{ cursor: string | null; limita: number }>,
): Promise<PaginaTermeneDeschise> {
  const db = await createServerSupabase();
  let interogare = db
    .from("vehicle_exit_obligations")
    .select(
      "id, cod, denumire, natura, termen, vehicle_id, " +
        // O singură cheie spre `vehicle_exits` (`exit_id`): fără indiciu, doar `!inner`.
        "iesire:vehicle_exits!inner(id, tip, destinatie_epava, motiv_radiere, anulat_la, deleted_at), " +
        "vehicul:vehicles!vehicle_id(id, nr_inmatriculare)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("finalizat_la", null)
    .eq("nu_se_aplica", false)
    .not("termen", "is", null)
    .is("iesire.anulat_la", null)
    .is("iesire.deleted_at", null)
    .order("termen")
    .order("id")
    .limit(pagina.limita + 1);
  if (pagina.cursor !== null) {
    const c = decodificaCursor(pagina.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset("termen", c, "asc"));
  }

  const { data, error } = await interogare.returns<TermenDeschis[]>();
  if (error !== null) throw error;
  const toate = data ?? [];
  const areUrmatoarea = toate.length > pagina.limita;
  const randuri = areUrmatoarea ? toate.slice(0, pagina.limita) : toate;
  const ultim = randuri.at(-1);
  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: ultim.termen, id: ultim.id })
        : null,
  };
}

// ── Incidentele din care se alege la „Scoate din parc” ──

/** Un vehicul are câteva incidente; caseta arată cele mai noi. */
const PLAFON_INCIDENTE = 20;

export interface IncidentPentruIesire {
  readonly id: string;
  readonly tip: TipIncident;
  readonly produs_la: string;
}

/**
 * Incidentele vehiculului (F11), pentru legătura opțională a daunei totale
 * (`vehicle_exits.incident_id`). Prin RLS: fără `vehicle_incidents:read`, lista
 * vine goală și caseta nu arată selectorul.
 */
export async function incidentePentruIesire(
  organizationId: string,
  vehiculId: string,
): Promise<readonly IncidentPentruIesire[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_incidents")
    .select("id, tip, produs_la")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehiculId)
    .is("deleted_at", null)
    .order("produs_la", { ascending: false })
    .order("id", { ascending: false })
    .limit(PLAFON_INCIDENTE)
    .returns<IncidentPentruIesire[]>();

  if (error !== null) throw error;
  return data ?? [];
}
