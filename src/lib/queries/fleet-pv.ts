// src/lib/queries/fleet-pv.ts
//
// Citirile procesului-verbal de predare-primire a vehiculului (0215, F12c).
//
// Ca în `fleet.ts`, NU se adaugă niciun filtru de scope: `pv_vehicul_select`
// decide ce rânduri vede omul (părțile PV-ului, managerul lor, administratorul,
// iar din decizia 3 și partea fără `vehicles:read`). Un filtru duplicat aici ar
// putea diverge tăcut de regula reală.
//
// FIECARE citire pune `.is("deleted_at", null)`: politica SELECT nu ascunde
// rândurile șterse (altfel ștergerea logică a ciornei ar da 42501 — 0164, DL16),
// deci fără filtru o ciornă ștearsă ar reapărea pe ecran (capcana 31).
//
// Fișier propriu, nu adăugiri în `fleet.ts` (decizia DL13). Poarta
// `coloane.test.ts` citește tot directorul, deci îl acoperă și pe acesta.

import "server-only";

import type {
  AnvelopePv,
  NivelRezervor,
  StareGenerala,
  StarePv,
  TipPv,
} from "@/domain/fleet/proces-verbal";
import type { Json } from "@/types/database";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Câte PV-uri citește o listă. O mașină are câteva predări pe an, un om câteva
 * PV-uri; plafonul stă mult sub `max_rows = 1000`, care ar tăia TĂCUT.
 */
export const PLAFON_PV = 200;

/** Un PV în lista fișei vehiculului (o celulă pe fiecare capăt de alocare). */
export interface RandPv {
  readonly id: string;
  readonly tip: TipPv;
  readonly moment: string;
  readonly stare: StarePv;
  /** `''` = ciornă, încă fără număr. */
  readonly numar: string;
  readonly numar_registru: string | null;
  readonly alocare_predata_id: string | null;
  readonly alocare_primita_id: string | null;
  readonly anulat_la: string | null;
  readonly confirmat_predator_la: string | null;
  readonly confirmat_primitor_la: string | null;
}

/** Fișa angajatului încorporată; `null` pentru cine n-are `employees:read` (capcana 18). */
export interface ParteEmbed {
  readonly full_name: string;
  readonly marca: string | null;
  readonly functie: string | null;
}

export interface PvComplet extends RandPv {
  readonly organization_id: string;
  readonly vehicle_id: string;
  readonly data_pv: string;
  readonly predator_employee_id: string | null;
  readonly primitor_employee_id: string | null;
  readonly km_bord: number | null;
  readonly nivel_rezervor: NivelRezervor | null;
  readonly numar_chei: number | null;
  readonly stare_generala: StareGenerala | null;
  readonly anvelope: AnvelopePv | null;
  readonly documente_bord: readonly string[];
  readonly dotari: readonly string[];
  readonly daune_constatate: boolean | null;
  readonly daune: Json;
  readonly observatii: string | null;
  /** Instantaneul de la finalizare; `null` pe ciornă. Se citește cu `citesteInstantaneu`. */
  readonly snapshot: Json | null;
  readonly finalizat_la: string | null;
  readonly finalizat_de: string | null;
  readonly confirmat_predator_de: string | null;
  readonly confirmat_primitor_de: string | null;
  readonly motiv_anulare: string | null;
  readonly scan_path: string | null;
  readonly created_at: string;
  readonly predator: ParteEmbed | null;
  readonly primitor: ParteEmbed | null;
}

/** PV-urile unui vehicul, cele mai noi primele. Ciornele intră: ecranul le arată. */
export async function pvurileVehiculului(
  organizationId: string,
  vehiculId: string,
): Promise<readonly RandPv[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_handovers")
    .select(
      "id, tip, moment, stare, numar, numar_registru, alocare_predata_id, alocare_primita_id, " +
        "anulat_la, confirmat_predator_la, confirmat_primitor_la",
    )
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehiculId)
    .is("deleted_at", null)
    .order("moment", { ascending: false })
    .order("id", { ascending: false })
    .limit(PLAFON_PV)
    .returns<RandPv[]>();

  if (error !== null) throw error;
  return data ?? [];
}

/** Un PV întreg, cu părțile încorporate. `null` = nu există SAU nu e vizibil (același răspuns). */
export async function citestePv(organizationId: string, id: string): Promise<PvComplet | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_handovers")
    .select(
      "id, organization_id, vehicle_id, tip, moment, data_pv, stare, numar, numar_registru, " +
        "alocare_predata_id, alocare_primita_id, predator_employee_id, primitor_employee_id, " +
        "km_bord, nivel_rezervor, numar_chei, stare_generala, anvelope, documente_bord, dotari, " +
        "daune_constatate, daune, observatii, snapshot, finalizat_la, finalizat_de, " +
        "confirmat_predator_la, confirmat_predator_de, confirmat_primitor_la, confirmat_primitor_de, " +
        "anulat_la, motiv_anulare, scan_path, created_at, " +
        "predator:employees!predator_employee_id(full_name, marca, functie), " +
        "primitor:employees!primitor_employee_id(full_name, marca, functie)",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<PvComplet>();

  if (error !== null) throw error;
  return data;
}

/** Un PV în „Mașina mea”: doar finalizatele, cu numărul vehiculului din instantaneu. */
export interface PvulMeu {
  readonly id: string;
  readonly tip: TipPv;
  readonly moment: string;
  readonly numar: string;
  readonly predator_employee_id: string | null;
  readonly primitor_employee_id: string | null;
  readonly confirmat_predator_la: string | null;
  readonly confirmat_primitor_la: string | null;
  readonly anulat_la: string | null;
  readonly snapshot: Json | null;
}

/**
 * PV-urile omului (predător SAU primitor), FINALIZATE, cele mai noi primele.
 *
 * Filtrul pe fișa proprie e EXPLICIT: un administrator care e și șofer vede prin
 * RLS tot parcul, iar „ale mele” ar deveni ale tuturor. Un singur `.or()` (nu
 * două: comportamentul a doi parametri `or=` nu e dovedit în proiect) și fără
 * cursor — un om are câteva PV-uri pe an, iar plafonul stă sub `max_rows`.
 */
export async function pvurileMele(
  organizationId: string,
  employeeId: string,
): Promise<readonly PvulMeu[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_handovers")
    .select(
      "id, tip, moment, numar, predator_employee_id, primitor_employee_id, " +
        "confirmat_predator_la, confirmat_primitor_la, anulat_la, snapshot",
    )
    .eq("organization_id", organizationId)
    .eq("stare", "finalizat")
    .or(`predator_employee_id.eq.${employeeId},primitor_employee_id.eq.${employeeId}`)
    .is("deleted_at", null)
    .order("moment", { ascending: false })
    .order("id", { ascending: false })
    .limit(PLAFON_PV)
    .returns<PvulMeu[]>();

  if (error !== null) throw error;
  return data ?? [];
}

/** Plafonul cardului „De făcut” din portal. */
export const PLAFON_DE_CONFIRMAT = 20;

/**
 * PV-urile finalizate și neanulate pe care omul încă nu le-a confirmat, pe
 * coloana PĂRȚII LUI (predătorul își confirmă predarea, primitorul primirea).
 * Cardul de sarcini din portal numără exact lista asta, nu un `count()` separat.
 */
export async function pvuriDeConfirmat(
  organizationId: string,
  employeeId: string,
): Promise<readonly Readonly<{ id: string; numar: string }>[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_handovers")
    .select("id, numar")
    .eq("organization_id", organizationId)
    .eq("stare", "finalizat")
    .is("anulat_la", null)
    .or(
      `and(predator_employee_id.eq.${employeeId},confirmat_predator_la.is.null),` +
        `and(primitor_employee_id.eq.${employeeId},confirmat_primitor_la.is.null)`,
    )
    .is("deleted_at", null)
    .order("moment", { ascending: false })
    .limit(PLAFON_DE_CONFIRMAT)
    .returns<{ id: string; numar: string }[]>();

  if (error !== null) throw error;
  return data ?? [];
}

/** Un document curent al vehiculului, pentru ciorna PV-ului (bife propuse, avertismente). */
export interface DocumentCurentLaBord {
  readonly numar: string | null;
  readonly expira_la: string | null;
  readonly tip: Readonly<{ cod: string; denumire: string }> | null;
}

/**
 * Documentele CURENTE ale vehiculului, pe ciornă. Finalizatul folosește
 * instantaneul: RCA-ul reînnoit după predare nu schimbă hârtia de atunci.
 */
export async function documenteleCurenteLaBord(
  organizationId: string,
  vehiculId: string,
): Promise<readonly DocumentCurentLaBord[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_documents")
    .select("numar, expira_la, tip:vehicle_document_types!document_type_id(cod, denumire)")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehiculId)
    .eq("este_curent", true)
    .is("deleted_at", null)
    .limit(PLAFON_PV)
    .returns<DocumentCurentLaBord[]>();

  if (error !== null) throw error;
  return data ?? [];
}
