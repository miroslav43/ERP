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

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  DestinatieEpava,
  MotivRadiere,
  NaturaTermen,
  TipIesire,
} from "@/schemas/flota-iesire";

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
        "nr_document, pastreaza_numarul, preluata_din_istoric, observatii, created_at",
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
