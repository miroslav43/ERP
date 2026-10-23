// src/lib/queries/fleet-service.ts
// Citirile service-ului, cheltuielilor și costurilor unui vehicul (0203). Ca în
// `fleet.ts`, NU se adaugă filtre de scope: vizibilitatea o dau politicile
// (`vsp_select`, `vse_select`, `vex_select`, toate prin
// `app.poate_vedea_costurile_vehiculului`: `vehicles:update = all`, `read = all`,
// sau `team` pe mașina echipei care NU e în pool, nici alocată cuiva din echipă:
// managerul nu vede facturile mașinii comune). Cine nu le vede primește zero
// rânduri, nu o eroare.

import "server-only";

import {
  consumRealPerioada,
  costPeKm,
  costTotal,
  defalcarePeCategorii,
  sumaLei,
  type TotalCategorie,
} from "@/domain/fleet/costuri";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AnvelopeMontate } from "@/schemas/fleet";
import type { CategorieCheltuiala, TipService } from "@/schemas/fleet-service";

import { citesteTot } from "./citeste-tot";
import { codificaCursor, decodificaCursor, predicatKeyset } from "./cursor";

// ── Planurile ───────────────────────────────────────────────────────────────

export interface PlanService {
  readonly id: string;
  readonly vehicle_id: string;
  readonly denumire: string;
  readonly tip: TipService;
  readonly interval_km: number | null;
  readonly interval_luni: number | null;
  readonly baza_data: string;
  readonly baza_km: number;
  readonly ultima_data: string;
  readonly ultimii_km: number;
  readonly urmatoarea_data: string | null;
  readonly urmatorii_km: number | null;
  readonly prag_avertizare_km: number;
  readonly activ: boolean;
  readonly observatii: string | null;
}

const COLOANE_PLAN =
  "id, vehicle_id, denumire, tip, interval_km, interval_luni, baza_data, baza_km, ultima_data, " +
  "ultimii_km, urmatoarea_data, urmatorii_km, prag_avertizare_km, activ, observatii";

/** Un vehicul are câteva planuri (revizie, distribuție, ITP la service). Plafon, nu paginare. */
export const PLAFON_PLANURI_SERVICE = 100;

/**
 * Planurile vehiculului: cele active întâi, apoi după scadență (cele fără dată la
 * coadă), apoi după denumire. Cele oprite rămân la vedere, ca un plan oprit din
 * greșeală să poată fi repornit.
 */
export async function planuriService(
  organizationId: string,
  vehiculId: string,
): Promise<readonly PlanService[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_service_plans")
    .select(COLOANE_PLAN)
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehiculId)
    .is("deleted_at", null)
    .order("activ", { ascending: false })
    .order("urmatoarea_data", { ascending: true, nullsFirst: false })
    .order("denumire", { ascending: true })
    .limit(PLAFON_PLANURI_SERVICE)
    .returns<PlanService[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Intervențiile ───────────────────────────────────────────────────────────

export interface IntrareService {
  readonly id: string;
  readonly vehicle_id: string;
  readonly plan_id: string | null;
  readonly data_interventiei: string;
  readonly km: number;
  readonly tip: TipService;
  readonly descriere: string;
  readonly furnizor: string | null;
  readonly numar_factura: string | null;
  readonly cost_piese: number;
  readonly cost_manopera: number;
  readonly cost_total: number;
  readonly anvelope_montate: AnvelopeMontate | null;
  readonly observatii: string | null;
}

const COLOANE_INTRARE =
  "id, vehicle_id, plan_id, data_interventiei, km, tip, descriere, furnizor, numar_factura, " +
  "cost_piese, cost_manopera, cost_total, anvelope_montate, observatii";

export type PaginaCitita<T> = Readonly<{ randuri: readonly T[]; urmatorulCursor: string | null }>;

export type OptiuniPagina = Readonly<{ cursor: string | null; limita: number }>;

/** Câte rânduri are o pagină din fila Service sau Costuri. */
export const LIMITA_IMPLICITA_PAGINA = 25;

/**
 * Intervențiile vehiculului, cele mai noi întâi. Cursor keyset pe
 * `(data_interventiei, id)`: două intervenții din aceeași zi rămân în ordine
 * stabilă, iar o intervenție adăugată între pagini nu mută rândurile (cu
 * `.range()` ar fi făcut-o).
 */
export async function intrariService(
  organizationId: string,
  vehiculId: string,
  optiuni: OptiuniPagina,
): Promise<PaginaCitita<IntrareService>> {
  const db = await createServerSupabase();
  let interogare = db
    .from("vehicle_service_entries")
    .select(COLOANE_INTRARE)
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehiculId)
    .is("deleted_at", null)
    .order("data_interventiei", { ascending: false })
    .order("id", { ascending: false })
    .limit(optiuni.limita + 1);
  if (optiuni.cursor !== null) {
    // Un cursor stricat înseamnă prima pagină, nu o eroare (link vechi sau trunchiat).
    const c = decodificaCursor(optiuni.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset("data_interventiei", c, "desc"));
  }
  const { data, error } = await interogare.returns<IntrareService[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > optiuni.limita;
  const randuri = areUrmatoarea ? toate.slice(0, optiuni.limita) : toate;
  const ultim = randuri.at(-1);
  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: ultim.data_interventiei, id: ultim.id })
        : null,
  };
}

// ── Cheltuielile ────────────────────────────────────────────────────────────

export interface CheltuialaVehicul {
  readonly id: string;
  readonly vehicle_id: string;
  readonly categorie: CategorieCheltuiala;
  readonly data_cheltuielii: string;
  readonly suma: number;
  readonly litri: number | null;
  readonly km_bord: number | null;
  readonly numar_document: string | null;
  readonly observatii: string | null;
}

const COLOANE_CHELTUIALA =
  "id, vehicle_id, categorie, data_cheltuielii, suma, litri, km_bord, numar_document, observatii";

/** Cheltuielile vehiculului, cele mai noi întâi, cu același cursor keyset. */
export async function cheltuieliVehicul(
  organizationId: string,
  vehiculId: string,
  optiuni: OptiuniPagina,
): Promise<PaginaCitita<CheltuialaVehicul>> {
  const db = await createServerSupabase();
  let interogare = db
    .from("vehicle_expenses")
    .select(COLOANE_CHELTUIALA)
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehiculId)
    .is("deleted_at", null)
    .order("data_cheltuielii", { ascending: false })
    .order("id", { ascending: false })
    .limit(optiuni.limita + 1);
  if (optiuni.cursor !== null) {
    const c = decodificaCursor(optiuni.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset("data_cheltuielii", c, "desc"));
  }
  const { data, error } = await interogare.returns<CheltuialaVehicul[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > optiuni.limita;
  const randuri = areUrmatoarea ? toate.slice(0, optiuni.limita) : toate;
  const ultim = randuri.at(-1);
  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: ultim.data_cheltuielii, id: ultim.id })
        : null,
  };
}

// ── Costurile pe perioadă ───────────────────────────────────────────────────

export interface CosturiVehicul {
  /** `deLa` nul = tot istoricul. Capetele sunt incluse. */
  readonly deLa: string | null;
  readonly panaLa: string;
  /**
   * `false` când cititorul nu vede TOATE foile vehiculului (managerul vede doar
   * foile șoferilor echipei lui): foile n-au fost citite, iar totalul, costul pe
   * km și consumul nu le conțin. Ecranul spune asta, nu pune „0”.
   */
  readonly foiIncluse: boolean;
  readonly service: Readonly<{
    numar: number;
    total: number;
    piese: number;
    manopera: number;
    peTip: readonly TotalCategorie<TipService>[];
  }>;
  readonly cheltuieli: Readonly<{
    numar: number;
    total: number;
    litriFaraFoaie: number;
    peCategorie: readonly TotalCategorie<CategorieCheltuiala>[];
  }>;
  /** Foile APROBATE din perioadă: kilometrii și combustibilul de pe ele. */
  readonly foi: Readonly<{ numar: number; km: number; litri: number; costCombustibil: number }>;
  readonly documente: Readonly<{ numar: number; total: number }>;
  readonly total: number;
  readonly costPeKm: number | null;
  readonly consumReal: number | null;
}

interface RandServiciu {
  readonly id: string;
  readonly tip: TipService;
  readonly cost_piese: number;
  readonly cost_manopera: number;
  readonly cost_total: number;
}
interface RandCheltuiala {
  readonly id: string;
  readonly categorie: CategorieCheltuiala;
  readonly suma: number;
  readonly litri: number | null;
}
interface RandFoaie {
  readonly id: string;
  readonly km_parcursi: number | null;
  readonly alimentari: readonly { readonly litri: number; readonly cost: number | null }[];
}
/**
 * Costul documentului, din `vehicle_document_costuri` (0225, X1), încorporat
 * `!inner` sub RLS-ul costurilor: documentul fără rând de cost vizibil nu intră.
 */
interface RandDocument {
  readonly id: string;
  readonly costuri: Readonly<{ cost: number | null }>;
}

/**
 * Costurile vehiculului pe o perioadă, adunate în aplicație din patru surse
 * (vezi `costuri.ts`). Fiecare sursă trece prin `citesteTot`: `max_rows = 1000`
 * ar tăia TĂCUT o agregare, iar un total mai mic cu 15% nu se observă niciodată.
 *
 * Foile se aduc cu alimentările în același răspuns (embed pe `trip_sheet_id`),
 * ca lista de id-uri a foilor să nu ajungă într-un `.in()` cât o carte.
 *
 * `cuFoi` = cititorul are `trip_sheets:read = all`. Service-ul, cheltuielile și
 * costul documentelor (`vehicle_document_costuri`, 0225) se citesc sub
 * `vehicles:read >= team` + vehiculul echipei, fără pool, adică
 * COMPLETE pentru orice vehicul pe care îl deschizi; foile și alimentările se
 * citesc sub `trip_sheets:read`, iar la `team` RLS le taie TĂCUT la șoferii
 * echipei. Un cost pe km împărțit la kilometri parțiali iese umflat, fără
 * eroare, așa că fără `cuFoi` foile nu se interoghează deloc.
 */
export async function costuriVehicul(
  organizationId: string,
  vehiculId: string,
  deLa: string | null,
  panaLa: string,
  cuFoi: boolean,
): Promise<CosturiVehicul> {
  const db = await createServerSupabase();

  const [servicii, cheltuieli, foi, documente] = await Promise.all([
    citesteTot<RandServiciu>(
      (dupa, pas) => {
        let q = db
          .from("vehicle_service_entries")
          .select("id, tip, cost_piese, cost_manopera, cost_total")
          .eq("organization_id", organizationId)
          .eq("vehicle_id", vehiculId)
          .is("deleted_at", null)
          .lte("data_interventiei", panaLa);
        if (deLa !== null) q = q.gte("data_interventiei", deLa);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas).returns<RandServiciu[]>();
      },
      (r) => r.id,
      { nume: "intervenții de service" },
    ),
    citesteTot<RandCheltuiala>(
      (dupa, pas) => {
        let q = db
          .from("vehicle_expenses")
          .select("id, categorie, suma, litri")
          .eq("organization_id", organizationId)
          .eq("vehicle_id", vehiculId)
          .is("deleted_at", null)
          .lte("data_cheltuielii", panaLa);
        if (deLa !== null) q = q.gte("data_cheltuielii", deLa);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas).returns<RandCheltuiala[]>();
      },
      (r) => r.id,
      { nume: "cheltuieli de vehicul" },
    ),
    cuFoi
      ? citesteTot<RandFoaie>(
          (dupa, pas) => {
            let q = db
              .from("trip_sheets")
              .select("id, km_parcursi, alimentari:fuel_entries!trip_sheet_id(litri, cost)")
              .eq("organization_id", organizationId)
              .eq("vehicle_id", vehiculId)
              .eq("status", "aprobat")
              .is("deleted_at", null)
              .is("alimentari.deleted_at", null)
              .lte("data", panaLa);
            if (deLa !== null) q = q.gte("data", deLa);
            if (dupa !== null) q = q.gt("id", dupa);
            return q.order("id", { ascending: true }).limit(pas).returns<RandFoaie[]>();
          },
          (r) => r.id,
          { nume: "foi aprobate" },
        )
      : Promise.resolve<RandFoaie[]>([]),
    citesteTot<RandDocument>(
      (dupa, pas) => {
        let q = db
          .from("vehicle_documents")
          .select("id, costuri:vehicle_document_costuri!inner(cost)")
          .eq("organization_id", organizationId)
          .eq("vehicle_id", vehiculId)
          .is("deleted_at", null)
          .not("costuri.cost", "is", null)
          .not("valabil_de_la", "is", null)
          .lte("valabil_de_la", panaLa);
        if (deLa !== null) q = q.gte("valabil_de_la", deLa);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas).returns<RandDocument[]>();
      },
      (r) => r.id,
      { nume: "documente de vehicul" },
    ),
  ]);

  const serviceTotal = sumaLei(servicii.map((s) => s.cost_total));
  const cheltuieliTotal = sumaLei(cheltuieli.map((c) => c.suma));
  const kmFoi = foi.reduce((a, f) => a + (f.km_parcursi ?? 0), 0);
  const alimentari = foi.flatMap((f) => f.alimentari);
  const litriFoi = sumaLei(alimentari.map((a) => a.litri));
  const costCombustibil = sumaLei(alimentari.map((a) => a.cost));
  const documenteTotal = sumaLei(documente.map((d) => d.costuri.cost));

  const total = costTotal({
    service: serviceTotal,
    combustibilFoi: costCombustibil,
    cheltuieli: cheltuieliTotal,
    documente: documenteTotal,
  });

  return {
    deLa,
    panaLa,
    foiIncluse: cuFoi,
    service: {
      numar: servicii.length,
      total: serviceTotal,
      piese: sumaLei(servicii.map((s) => s.cost_piese)),
      manopera: sumaLei(servicii.map((s) => s.cost_manopera)),
      peTip: defalcarePeCategorii(servicii.map((s) => ({ categorie: s.tip, suma: s.cost_total }))),
    },
    cheltuieli: {
      numar: cheltuieli.length,
      total: cheltuieliTotal,
      litriFaraFoaie: sumaLei(cheltuieli.map((c) => c.litri)),
      peCategorie: defalcarePeCategorii(
        cheltuieli.map((c) => ({ categorie: c.categorie, suma: c.suma })),
      ),
    },
    foi: { numar: foi.length, km: kmFoi, litri: litriFoi, costCombustibil },
    documente: { numar: documente.length, total: documenteTotal },
    total,
    costPeKm: costPeKm(total, kmFoi),
    consumReal: consumRealPerioada(litriFoi, kmFoi),
  };
}
