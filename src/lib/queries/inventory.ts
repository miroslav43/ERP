// src/lib/queries/inventory.ts
// Citirile de inventar: listă cu paginare keyset, fișă de obiect, istoric de
// alocări și „ce am eu în primire". Spre deosebire de queries/employees.ts,
// aici NU se mai adaugă niciun filtru de scope (own/team/all) în interogări —
// RLS din 0010/0016/0019 restrânge singură rândurile, direct în Postgres.

import type { FiltreInventar, StareObiect, StatusObiect } from "@/schemas/inventory";
import { createServerSupabase } from "@/lib/supabase/server";

export interface RandInventar {
  readonly id: string;
  readonly denumire: string;
  readonly numar_inventar: string;
  readonly serie: string | null;
  readonly model: string | null;
  readonly producator: string | null;
  readonly category_id: string | null;
  readonly status: StatusObiect;
  readonly stare: StareObiect;
  readonly locatie: string | null;
  readonly valoare: number | null;
  readonly data_achizitie: string | null;
  readonly garantie_expira: string | null;
}

export interface RezultatInventar {
  readonly randuri: readonly RandInventar[];
  readonly urmatorulCursor: string | null;
}

export interface ObiectInventar extends RandInventar {
  readonly observatii: string | null;
  readonly import_batch_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DetinatorAlocare {
  readonly id: string;
  readonly itemId: string;
  readonly employeeId: string;
  readonly angajatNume: string | null;
  readonly angajatMarca: string | null;
  readonly predatLa: string;
  readonly confirmatDeAngajatLa: string | null;
}

export interface IstoricAlocare {
  readonly id: string;
  readonly employee_id: string;
  readonly predat_la: string;
  readonly returnat_la: string | null;
  readonly stare_la_predare: StareObiect;
  readonly stare_la_returnare: StareObiect | null;
  readonly observatii: string | null;
  readonly pv_document_path: string | null;
  readonly confirmat_de_angajat_la: string | null;
}

export interface AngajatRezumat {
  readonly id: string;
  // `employees.full_name` e o coloană generată din `last_name`/`first_name`
  // (ambele NOT NULL), dar Postgres nu o marchează NOT NULL, deci generatorul
  // de tipuri o dă drept `string | null` — respectat aici, nu forțat cu `!`.
  readonly full_name: string | null;
  readonly marca: string;
}

export interface Categorie {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly ordine: number;
}

interface ObiectInPrimire {
  readonly id: string;
  readonly denumire: string;
  readonly numar_inventar: string;
  readonly serie: string | null;
}

export interface RandInPrimire {
  readonly id: string;
  readonly item_id: string;
  readonly predat_la: string;
  readonly stare_la_predare: StareObiect;
  readonly observatii: string | null;
  readonly confirmat_de_angajat_la: string | null;
  readonly obiect: ObiectInPrimire;
}

interface Cursor {
  readonly denumire: string;
  readonly id: string;
}

function codificaCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.denumire}\u0000${cursor.id}`, "utf8").toString("base64url");
}

function decodificaCursor(valoare: string): Cursor | null {
  try {
    const bucati = Buffer.from(valoare, "base64url").toString("utf8").split("\u0000");
    const denumire = bucati[0];
    const id = bucati[1];
    if (denumire === undefined || id === undefined || id.length === 0) return null;
    return { denumire, id };
  } catch {
    return null;
  }
}

function ghilimeleaza(valoare: string): string {
  return `"${valoare.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

const COLOANE_LISTA =
  "id, denumire, numar_inventar, serie, model, producator, category_id, status, stare, locatie, valoare, data_achizitie, garantie_expira";

export async function listeazaObiecte(
  organizationId: string,
  filtre: FiltreInventar,
): Promise<RezultatInventar> {
  const db = await createServerSupabase();
  let interogare = db
    .from("inventory_items")
    .select(COLOANE_LISTA)
    .eq("organization_id", organizationId)
    .order("denumire", { ascending: true })
    .order("id", { ascending: true })
    .limit(filtre.limita + 1);

  if (filtre.status !== null) interogare = interogare.eq("status", filtre.status);
  if (filtre.stare !== null) interogare = interogare.eq("stare", filtre.stare);
  if (filtre.category_id !== null) interogare = interogare.eq("category_id", filtre.category_id);
  // Filtre separate, NU `.or(...)`: textul utilizatorului nu se interpolează
  // niciodată în sintaxa `or=()`.
  if (filtre.q !== null) interogare = interogare.ilike("denumire", `%${filtre.q}%`);
  if (filtre.numar !== null) interogare = interogare.ilike("numar_inventar", `%${filtre.numar}%`);

  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null) {
    const denumire = ghilimeleaza(cursor.denumire);
    interogare = interogare.or(
      `denumire.gt.${denumire},and(denumire.eq.${denumire},id.gt.${cursor.id})`,
    );
  }

  const { data, error } = await interogare.returns<RandInventar[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultimul = randuri.at(-1);
  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultimul !== undefined
        ? codificaCursor({ denumire: ultimul.denumire, id: ultimul.id })
        : null,
  };
}

/** Perechea id → nume/marcă, pentru rândurile de alocare care nu au embed direct. */
export async function numeleAngajatilor(
  organizationId: string,
  employeeIds: readonly string[],
): Promise<ReadonlyMap<string, AngajatRezumat>> {
  const idUnice = [...new Set(employeeIds)];
  if (idUnice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", organizationId)
    .in("id", idUnice);
  if (error !== null) throw error;

  return new Map((data ?? []).map((angajat) => [angajat.id, angajat] as const));
}

/** Deținătorii curenți ai unui lot de obiecte — pentru coloana „Deținut de" din listă. */
export async function alocariDeschise(
  organizationId: string,
  itemIds: readonly string[],
): Promise<ReadonlyMap<string, DetinatorAlocare>> {
  if (itemIds.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("inventory_allocations")
    .select("id, item_id, employee_id, predat_la, confirmat_de_angajat_la")
    .eq("organization_id", organizationId)
    .in("item_id", itemIds)
    .is("returnat_la", null)
    .is("deleted_at", null);
  if (error !== null) throw error;

  const randuri = data ?? [];
  if (randuri.length === 0) return new Map();

  const angajati = await numeleAngajatilor(
    organizationId,
    randuri.map((rand) => rand.employee_id),
  );

  const rezultat = new Map<string, DetinatorAlocare>();
  for (const rand of randuri) {
    const angajat = angajati.get(rand.employee_id) ?? null;
    rezultat.set(rand.item_id, {
      id: rand.id,
      itemId: rand.item_id,
      employeeId: rand.employee_id,
      angajatNume: angajat?.full_name ?? null,
      angajatMarca: angajat?.marca ?? null,
      predatLa: rand.predat_la,
      confirmatDeAngajatLa: rand.confirmat_de_angajat_la,
    });
  }
  return rezultat;
}

export async function citesteObiect(
  organizationId: string,
  itemId: string,
): Promise<ObiectInventar | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("inventory_items")
    .select(`${COLOANE_LISTA}, observatii, import_batch_id, created_at, updated_at`)
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .maybeSingle<ObiectInventar>();
  if (error !== null) throw error;
  return data;
}

export async function istoricAlocari(
  organizationId: string,
  itemId: string,
): Promise<readonly IstoricAlocare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("inventory_allocations")
    .select(
      "id, employee_id, predat_la, returnat_la, stare_la_predare, stare_la_returnare, observatii, pv_document_path, confirmat_de_angajat_la",
    )
    .eq("organization_id", organizationId)
    .eq("item_id", itemId)
    .is("deleted_at", null)
    .order("predat_la", { ascending: false })
    .returns<IstoricAlocare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Catalogul de categorii, platformă + proprii. `organization_id` e nullable
 * (categoriile de platformă nu aparțin niciunei organizații), iar RLS arată
 * ambele seturi oricui are măcar `inventory:read = own` — de aceea funcția nu
 * primește și nu filtrează după `organizationId`.
 */
export async function categorii(): Promise<readonly Categorie[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("inventory_categories")
    .select("id, cod, denumire, ordine")
    .is("deleted_at", null)
    .eq("activ", true)
    .order("ordine")
    .order("denumire");
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * „Ce am eu în primire acum". Pentru scope `own`, `propriaFisaId` trebuie
 * trimis `null`: RLS restrânge deja singură la `employee_id = current_employee_id`.
 * Pentru `team`/`all`, RLS NU restrânge la propria fișă — apelantul trebuie să
 * dea `propriaFisaId` explicit (obținut cu `idFisaProprie()`), altfel funcția
 * ar întoarce alocările deschise ale ÎNTREGII organizații.
 */
export async function inPrimireaMea(
  organizationId: string,
  propriaFisaId: string | null,
): Promise<readonly RandInPrimire[]> {
  const db = await createServerSupabase();
  let interogare = db
    .from("inventory_allocations")
    .select(
      "id, item_id, predat_la, stare_la_predare, observatii, confirmat_de_angajat_la, obiect:inventory_items!item_id(id, denumire, numar_inventar, serie)",
    )
    .eq("organization_id", organizationId)
    .is("returnat_la", null)
    .is("deleted_at", null)
    .order("predat_la", { ascending: false });

  if (propriaFisaId !== null) {
    interogare = interogare.eq("employee_id", propriaFisaId);
  }

  const { data, error } = await interogare.returns<RandInPrimire[]>();
  if (error !== null) throw error;
  return data ?? [];
}
