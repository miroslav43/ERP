// src/lib/queries/fleet-contabil.ts
//
// Citirile exportului contabil al flotei (F12g): costurile unei luni, aduse în
// forma comună `LinieCost`, și datele firmei care exportă.
//
// ── DE CE FĂRĂ FILTRU DE SCOPE ȘI FĂRĂ CLIENT ADMIN ─────────────────────────
// Citirile trec prin RLS-ul utilizatorului. Poarta rutei cere `all` pe
// `vehicles:export`, `vehicles:read` și `trip_sheets:read` (L15): cu `team`,
// RLS-ul ar tăia tăcut o parte din lună, iar nota ar ieși incompletă și ar arăta
// completă. Proba `tests/rls/proba-flota-export-contabil.sql` arată cât pierde
// managerul.
//
// ── LIMITELE LUNII ──────────────────────────────────────────────────────────
// Alimentarea are un moment (`alimentat_la`, timestamptz): luna se taie în ORA
// ROMÂNIEI (31 oct, 23:30 e octombrie), cu fusul recalculat la fiecare capăt —
// ora se schimbă în martie și în octombrie. Cheltuielile și intervențiile au o
// zi (`date`), deci se taie pe zile.
//
// ── DE CE TOATE CITIRILE TREC PRIN `citesteTot` ─────────────────────────────
// `max_rows = 1000` trunchiază TĂCUT. O notă contabilă cu o mie de bonuri din
// 1.200 nu-și vede niciodată lipsa. `citesteTot` aruncă la plafon.
import "server-only";

import { ETICHETE_COMBUSTIBIL } from "@/app/(app)/flota/etichete";
import type { FirmaExport } from "@/domain/fleet/contabil/configurare";
import {
  CATEGORIE_CHELTUIALA,
  CATEGORIE_SERVICE,
  regimDeclaratLa,
  type LinieCost,
  type PerioadaRegim,
} from "@/domain/fleet/contabil/linii";
import { intervalLuna, lunaMutata } from "@/domain/fleet/rapoarte";
import { momentDinOraRomaniei, toBucharestDateString } from "@/lib/format/date";
import { createServerSupabase } from "@/lib/supabase/server";

import { citesteTot } from "./citeste-tot";

/** Câte id-uri intră într-un `.in()`: adresa cererii nu crește fără limită. */
const FELIE_ID = 200;

function felii<T>(lista: readonly T[]): T[][] {
  const rezultat: T[][] = [];
  for (let i = 0; i < lista.length; i += FELIE_ID) rezultat.push(lista.slice(i, i + FELIE_ID));
  return rezultat;
}

/**
 * `numeric(14,2)` → bani. Coloanele sunt exacte la ban; orice altceva decât un
 * întreg nenegativ după înmulțire e o dată stricată, nu o rotunjire de făcut.
 */
export function inBaniExact(valoare: number, unde: string): number {
  const bani = Math.round(valoare * 100);
  if (!Number.isFinite(valoare) || bani < 0 || Math.abs(bani - valoare * 100) > 1e-6) {
    throw new RangeError(`Suma ${String(valoare)} (${unde}) nu e un număr nenegativ de bani.`);
  }
  return bani;
}

/** Limitele lunii `AAAA-LL` ca momente UTC: [prima zi 00:00, luna următoare 00:00), în ora României. */
export function limiteLuna(luna: string): { deLa: string; panaLa: string } {
  const deLa = momentDinOraRomaniei(`${luna}-01T00:00`);
  const panaLa = momentDinOraRomaniei(`${lunaMutata(luna, 1)}-01T00:00`);
  // Pe o lună validată de schemă nu poate ieși `null`; dacă iese, nu e „fără limită”.
  if (deLa === null || panaLa === null) throw new RangeError(`Luna ${luna} nu are limite valide.`);
  return { deLa, panaLa };
}

/** Firma care exportă: denumirea, CIF-ul (doar cifre) și dacă e plătitoare de TVA. */
export async function firmaPentruExport(organizationId: string): Promise<FirmaExport> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("organizations")
    .select("name, legal_name, cui, cui_normalizat, platitor_tva")
    .eq("id", organizationId)
    .maybeSingle();
  if (error !== null) throw error;
  if (data === null) throw new Error("Organizația nu a putut fi citită.");
  return {
    denumire: data.legal_name ?? data.name,
    cui: data.cui_normalizat ?? data.cui.replace(/\D/gu, ""),
    platitorTva: data.platitor_tva,
  };
}

/**
 * Toate costurile flotei din luna `AAAA-LL`: alimentările de pe foi (după
 * momentul alimentării), cheltuielile și intervențiile (după zi). Nimic nu se
 * filtrează aici după starea foii sau după card: decizia „intră / nu intră” e a
 * modelului (`construiesteArticole`), ca jurnalul să arate și ce n-a intrat.
 */
export async function liniiDeCostPeLuna(
  organizationId: string,
  luna: string,
): Promise<readonly LinieCost[]> {
  const db = await createServerSupabase();
  const { deLa, panaLa } = limiteLuna(luna);
  const zile = intervalLuna(luna);

  const [alimentari, cheltuieli, interventii] = await Promise.all([
    citesteTot(
      (dupa, pas) => {
        let q = db
          .from("fuel_entries")
          .select(
            "id, alimentat_la, cost, litri, numar_bon, statie, cui_statie, foaie:trip_sheets!trip_sheet_id(status, deleted_at, vehicle_id, vehicul_nr, vehicul_combustibil, vehicul:vehicles!vehicle_id(nr_inmatriculare, masa_maxima_kg, tip_combustibil), sofer:employees!employee_id(full_name))",
          )
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .gte("alimentat_la", deLa)
          .lt("alimentat_la", panaLa);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas);
      },
      (r) => r.id,
      { nume: "alimentările lunii" },
    ),
    citesteTot(
      (dupa, pas) => {
        let q = db
          .from("vehicle_expenses")
          .select(
            "id, data_cheltuielii, categorie, suma, litri, numar_document, vehicle_id, vehicul:vehicles!vehicle_id(nr_inmatriculare, masa_maxima_kg)",
          )
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .gte("data_cheltuielii", zile.deLa)
          .lte("data_cheltuielii", zile.panaLa);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas);
      },
      (r) => r.id,
      { nume: "cheltuielile lunii" },
    ),
    citesteTot(
      (dupa, pas) => {
        let q = db
          .from("vehicle_service_entries")
          .select(
            "id, data_interventiei, tip, descriere, furnizor, numar_factura, cost_total, cost_piese, cost_manopera, vehicle_id, vehicul:vehicles!vehicle_id(nr_inmatriculare, masa_maxima_kg)",
          )
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .gte("data_interventiei", zile.deLa)
          .lte("data_interventiei", zile.panaLa);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas);
      },
      (r) => r.id,
      { nume: "intervențiile lunii" },
    ),
  ]);

  // ── Cardul de flotă (F12b): după LEGĂTURĂ, nu după luna tranzacției ─────
  // O tranzacție din 31 oct, 23:50 poate fi legată de o alimentare din 1 nov.
  const peCard = new Set<string>();
  for (const bucata of felii(alimentari.map((a) => a.id))) {
    const legate = await citesteTot(
      (dupa, pas) => {
        let q = db
          .from("fuel_card_transactions")
          .select("id, fuel_entry_id, stare_potrivire")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .in("fuel_entry_id", bucata)
          .in("stare_potrivire", ["potrivita", "diferenta"]);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas);
      },
      (r) => r.id,
      { nume: "tranzacțiile de card ale alimentărilor" },
    );
    for (const t of legate) if (t.fuel_entry_id !== null) peCard.add(t.fuel_entry_id);
  }

  // ── Regimul fiscal (F10), pe vehiculele lunii ───────────────────────────
  const vehicule = new Set<string>();
  for (const a of alimentari) if (a.foaie !== null) vehicule.add(a.foaie.vehicle_id);
  for (const c of cheltuieli) vehicule.add(c.vehicle_id);
  for (const s of interventii) vehicule.add(s.vehicle_id);
  const regimuri = new Map<string, PerioadaRegim[]>();
  for (const bucata of felii([...vehicule])) {
    const randuri = await citesteTot(
      (dupa, pas) => {
        let q = db
          .from("vehicle_fiscal_regimes")
          .select("id, vehicle_id, valabil_de_la, regim")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .in("vehicle_id", bucata)
          .lte("valabil_de_la", zile.panaLa);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas);
      },
      (r) => r.id,
      { nume: "regimurile fiscale ale vehiculelor" },
    );
    for (const r of randuri) {
      const lista = regimuri.get(r.vehicle_id) ?? [];
      lista.push({ valabil_de_la: r.valabil_de_la, regim: r.regim });
      regimuri.set(r.vehicle_id, lista);
    }
  }
  const regimLa = (vehicleId: string, zi: string) =>
    regimDeclaratLa(regimuri.get(vehicleId) ?? [], zi);

  const linii: LinieCost[] = [];
  for (const a of alimentari) {
    const foaie = a.foaie;
    const data = toBucharestDateString(new Date(a.alimentat_la));
    const combustibil = foaie?.vehicul_combustibil ?? foaie?.vehicul?.tip_combustibil ?? null;
    const vehicleId = foaie?.vehicle_id ?? "";
    linii.push({
      id: a.id,
      sursa: "alimentare",
      data,
      categorie: "combustibil",
      totalBani: inBaniExact(a.cost, `alimentarea ${a.id}`),
      vehicul: {
        id: vehicleId,
        // Instantaneul foii (numărul de la data foii) bate vehiculul de azi.
        nr: foaie?.vehicul_nr ?? foaie?.vehicul?.nr_inmatriculare ?? null,
        masaMaximaKg: foaie?.vehicul?.masa_maxima_kg ?? null,
      },
      sofer: foaie?.sofer?.full_name ?? null,
      document: a.numar_bon,
      furnizor: a.statie,
      cuiFurnizor: a.cui_statie,
      sursaAreCui: true,
      litri: a.litri,
      detaliu: combustibil === null ? null : ETICHETE_COMBUSTIBIL[combustibil],
      regimDeclarat: vehicleId === "" ? null : regimLa(vehicleId, data),
      // Foaia lipsă din embed (n-ar trebui, sub poarta `all`) NU e „aprobată”:
      // `null` ar fi însemnat „sursă fără foaie” și linia ar fi intrat în note.
      stareFoaie: foaie?.status ?? "draft",
      foaieStearsa: foaie !== null && foaie.deleted_at !== null,
      peCardDeFlota: peCard.has(a.id),
    });
  }
  for (const c of cheltuieli) {
    linii.push({
      id: c.id,
      sursa: "cheltuiala",
      data: c.data_cheltuielii,
      categorie: CATEGORIE_CHELTUIALA[c.categorie],
      totalBani: inBaniExact(c.suma, `cheltuiala ${c.id}`),
      vehicul: {
        id: c.vehicle_id,
        nr: c.vehicul?.nr_inmatriculare ?? null,
        masaMaximaKg: c.vehicul?.masa_maxima_kg ?? null,
      },
      sofer: null,
      document: c.numar_document,
      furnizor: null,
      cuiFurnizor: null,
      sursaAreCui: false,
      litri: c.litri,
      detaliu: null,
      regimDeclarat: regimLa(c.vehicle_id, c.data_cheltuielii),
      stareFoaie: null,
      foaieStearsa: false,
      peCardDeFlota: false,
    });
  }
  for (const s of interventii) {
    linii.push({
      id: s.id,
      sursa: "service",
      data: s.data_interventiei,
      categorie: CATEGORIE_SERVICE[s.tip],
      totalBani: inBaniExact(s.cost_total ?? s.cost_piese + s.cost_manopera, `intervenția ${s.id}`),
      vehicul: {
        id: s.vehicle_id,
        nr: s.vehicul?.nr_inmatriculare ?? null,
        masaMaximaKg: s.vehicul?.masa_maxima_kg ?? null,
      },
      sofer: null,
      document: s.numar_factura,
      furnizor: s.furnizor,
      cuiFurnizor: null,
      sursaAreCui: false,
      litri: null,
      detaliu: s.descriere,
      regimDeclarat: regimLa(s.vehicle_id, s.data_interventiei),
      stareFoaie: null,
      foaieStearsa: false,
      peCardDeFlota: false,
    });
  }
  return linii;
}
