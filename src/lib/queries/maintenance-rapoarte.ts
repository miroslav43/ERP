// src/lib/queries/maintenance-rapoarte.ts
// Citirile raportului de mentenanță (M8, `/mentenanta/rapoarte`). Separate de
// `maintenance.ts` fiindcă au alt contract: nu servesc o listă paginată pentru
// ecran, ci un CALCUL, deci citesc mulțimea întreagă — în pagini, cu plafon.
//
// ── DE CE PLAFON CU `trunchiat`, NU `citesteTot` ──────────────────────────
// `max_rows = 1000` taie tăcut orice citire mai lungă (cazul 45). `citesteTot`
// aruncă la plafon; un raport e mai util cu o cifră marcată „parțială” decât
// cu un ecran de eroare, iar volumele reale sunt de zeci de rânduri pe an
// (cea mai mare firmă are 8 angajați). Peste plafon, pagina SPUNE că cifrele
// sunt un minim — tiparul `totalInterventii`.
//
// Ca restul modulului, niciun filtru de scope: RLS restrânge rândurile
// (`app.ssm_acces` din 0011, ramurile din 0181). Politicile SELECT din 0011 nu
// conțin `deleted_at is null`, deci fiecare interogare îl pune explicit.

import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { momentDinOraRomaniei } from "@/lib/format/date";
import {
  plusZile,
  type EchipamentRaport,
  type ExecutiePlan,
  type InterventieRaport,
  type OprireRaport,
  type Perioada,
  type PlanRaport,
  type SesizareRaport,
} from "@/domain/maintenance/indicatori";

/** Câte rânduri adună o citire de raport, cel mult. Peste el: `trunchiat`. */
export const PLAFON_RAPORT = 5000;
/** Sub `max_rows = 1000`, altfel PostgREST taie el, tăcut. */
const PAGINA_RAPORT = 1000;

export interface CitireRaport<T> {
  readonly randuri: readonly T[];
  /** Mulțimea are mai multe rânduri decât `PLAFON_RAPORT`. */
  readonly trunchiat: boolean;
}

type Pagina<T> = Readonly<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Citește în pagini keyset pe `id` până la plafon. Cere o pagină cu un rând
 * în plus la capăt, ca să știe dacă există și altele (fără a citi a 6-a mie).
 * `cerePagina` TREBUIE să ordoneze crescător după `id` și să pună `id > dupa`.
 */
async function citestePlafonat<T extends { readonly id: string }>(
  cerePagina: (dupa: string | null, limita: number) => PromiseLike<Pagina<T>>,
  plafon: number = PLAFON_RAPORT,
): Promise<CitireRaport<T>> {
  const adunate: T[] = [];
  let dupa: string | null = null;
  for (;;) {
    const limita = Math.min(PAGINA_RAPORT, plafon + 1 - adunate.length);
    const { data, error }: Pagina<T> = await cerePagina(dupa, limita);
    if (error !== null) throw error;
    const pagina = data ?? [];
    adunate.push(...pagina);
    if (adunate.length > plafon) return { randuri: adunate.slice(0, plafon), trunchiat: true };
    if (pagina.length < limita) return { randuri: adunate, trunchiat: false };
    const ultim = pagina.at(-1);
    if (ultim === undefined || ultim.id === dupa) return { randuri: adunate, trunchiat: false };
    dupa = ultim.id;
  }
}

/**
 * Miezul nopții (ora României) al zilei, ca moment UTC fără milisecunde —
 * punctul din `2026-09-01T00:00:00.000Z` s-ar citi ca separator într-un `or=`.
 */
export function momentInceputZi(zi: string): string {
  const moment = momentDinOraRomaniei(`${zi}T00:00`) ?? `${zi}T00:00:00.000Z`;
  return moment.replace(/\.\d{3}Z$/u, "Z");
}

/** Intervențiile cu `data` în perioadă (capete incluse), anulatele excluse. */
export async function interventiiInPerioada(
  organizationId: string,
  perioada: Perioada,
): Promise<CitireRaport<InterventieRaport>> {
  const db = await createServerSupabase();
  return citestePlafonat<InterventieRaport>((dupa, limita) => {
    let q = db
      .from("maintenance_interventions")
      .select(
        "id, equipment_id, data, tip, rezultat, cost_total, acoperit_de_garantie, executant_extern, plan_id",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("data", perioada.deLa)
      .lte("data", perioada.panaLa)
      .order("id", { ascending: true })
      .limit(limita);
    if (dupa !== null) q = q.gt("id", dupa);
    return q.returns<InterventieRaport[]>();
  });
}

/**
 * Execuțiile REUȘITE ale planurilor până la capătul perioadei, oricât de vechi:
 * „la timp” se judecă față de execuția precedentă, care poate fi cu un an sau
 * doi în urmă (verificările legale). Doar `reusita` mută planul.
 */
export async function executiiPlanuriPanaLa(
  organizationId: string,
  panaLa: string,
): Promise<CitireRaport<ExecutiePlan>> {
  const db = await createServerSupabase();
  return citestePlafonat<ExecutiePlan>((dupa, limita) => {
    let q = db
      .from("maintenance_interventions")
      .select("id, plan_id, data, citire_contor")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .not("plan_id", "is", null)
      .eq("rezultat", "reusita")
      .lte("data", panaLa)
      .order("id", { ascending: true })
      .limit(limita);
    if (dupa !== null) q = q.gt("id", dupa);
    return q.returns<ExecutiePlan[]>();
  });
}

/** Sesizările raportate în perioadă — ziua României, nu ziua UTC. */
export async function sesizariInPerioada(
  organizationId: string,
  perioada: Perioada,
): Promise<CitireRaport<SesizareRaport>> {
  const db = await createServerSupabase();
  const inceput = momentInceputZi(perioada.deLa);
  const sfarsit = momentInceputZi(plusZile(perioada.panaLa, 1));
  return citestePlafonat<SesizareRaport>((dupa, limita) => {
    let q = db
      .from("fault_reports")
      .select("id, equipment_id, raportat_la, atribuit_la, rezolvat_la, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("raportat_la", inceput)
      .lt("raportat_la", sfarsit)
      .order("id", { ascending: true })
      .limit(limita);
    if (dupa !== null) q = q.gt("id", dupa);
    return q.returns<SesizareRaport[]>();
  });
}

/** Opririle care se suprapun cu perioada: încep înainte de capăt și nu s-au terminat înainte de început. */
export async function opririInPerioada(
  organizationId: string,
  perioada: Perioada,
): Promise<CitireRaport<OprireRaport>> {
  const db = await createServerSupabase();
  const inceput = momentInceputZi(perioada.deLa);
  const sfarsit = momentInceputZi(plusZile(perioada.panaLa, 1));
  return citestePlafonat<OprireRaport>((dupa, limita) => {
    let q = db
      .from("equipment_opriri")
      .select("id, equipment_id, inceput, sfarsit, tip")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .lt("inceput", sfarsit)
      .or(`sfarsit.is.null,sfarsit.gte.${inceput}`)
      .order("id", { ascending: true })
      .limit(limita);
    if (dupa !== null) q = q.gt("id", dupa);
    return q.returns<OprireRaport[]>();
  });
}

/**
 * Parcul: echipamentele neșterse, și cele casate (filtrarea pe perioadă e a domeniului).
 *
 * Valoarea de achiziție vine din `equipment_costuri` (0232, Y1), încorporată sub
 * RLS-ul ei (`maintenance:update = all` sau `maintenance:read >= team` — poarta
 * paginii e `team`, deci cititorul raportului o vede). Cui nu o vede îi vine
 * `null`, iar „Cost / valoare” rămâne „—”, fără semnal de înlocuire.
 */
export async function echipamentePentruRaport(
  organizationId: string,
): Promise<CitireRaport<EchipamentRaport>> {
  const db = await createServerSupabase();
  const brut = await citestePlafonat<EchipamentRaportBrut>((dupa, limita) => {
    let q = db
      .from("equipment")
      .select(
        "id, cod, denumire, casat_la, data_punerii_in_functiune, costuri:equipment_costuri(valoare_achizitie)",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .limit(limita);
    if (dupa !== null) q = q.gt("id", dupa);
    return q.returns<EchipamentRaportBrut[]>();
  });
  return {
    trunchiat: brut.trunchiat,
    randuri: brut.randuri.map(({ costuri, ...e }) => ({
      ...e,
      valoare_achizitie: costuri?.valoare_achizitie ?? null,
    })),
  };
}

type EchipamentRaportBrut = Omit<EchipamentRaport, "valoare_achizitie"> & {
  readonly costuri: Readonly<{ valoare_achizitie: number | null }> | null;
};

/** Planurile neșterse, active și inactive: execuțiile unui plan dezactivat se judecă și ele. */
export async function planuriPentruRaport(
  organizationId: string,
): Promise<CitireRaport<PlanRaport>> {
  const db = await createServerSupabase();
  return citestePlafonat<PlanRaport>((dupa, limita) => {
    let q = db
      .from("maintenance_plans")
      .select(
        "id, equipment_id, denumire, tip, activ, periodicitate_zile, periodicitate_contor, numar_amanari, urmatoarea_scadenta, tip_contor, urmatoarea_scadenta_contor, mod_calcul, data_ancora, amanat_pana",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .limit(limita);
    if (dupa !== null) q = q.gt("id", dupa);
    return q.returns<PlanRaport[]>();
  });
}
