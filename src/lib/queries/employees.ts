// src/lib/queries/employees.ts
// Citirile de personal, cu paginare keyset și restrângere după scope (self / team).

import type { PermissionScope } from "@/config/permissions";
import type { FiltreAngajati, StatusAngajat } from "@/schemas/employee";
import { urlAvatar } from "@/lib/avatar/cale";
import { avataturiPeUtilizatori } from "@/lib/queries/profile";
import { createServerSupabase } from "@/lib/supabase/server";

const EMBED_DEPARTAMENT = "department:departments!department_id(id, denumire)";
const EMBED_FUNCTIE = "job_position:job_positions!job_position_id(id, denumire)";

export interface RandAngajat {
  readonly id: string;
  readonly marca: string;
  readonly full_name: string;
  readonly status: StatusAngajat;
  readonly hired_on: string | null;
  readonly is_primary: boolean;
  readonly avatar_url: string | null;
  readonly department: { readonly id: string; readonly denumire: string } | null;
  readonly job_position: { readonly id: string; readonly denumire: string } | null;
}

interface RandAngajatBrut extends Omit<RandAngajat, "avatar_url"> {
  readonly user_id: string | null;
}

export interface RezultatAngajati {
  readonly randuri: readonly RandAngajat[];
  readonly urmatorulCursor: string | null;
}

export interface ContractAngajat {
  readonly id: string;
  readonly numar: string;
  readonly data_contract: string;
  readonly valabil_de_la: string;
  readonly valabil_pana: string | null;
  readonly contract_duration: string;
  readonly norma_ore_saptamana: number;
  readonly salariu_baza: number;
  readonly moneda: string;
  readonly work_mode: string;
  readonly status: string;
  readonly este_act_aditional: boolean;
  readonly incetat_la: string | null;
  readonly motiv_incetare: string | null;
}

export interface DocumentAngajat {
  readonly id: string;
  readonly titlu: string;
  readonly data_document: string | null;
  readonly valabil_pana: string | null;
  readonly confidential: boolean;
}

export interface AngajatDetaliu {
  readonly id: string;
  readonly marca: string;
  readonly full_name: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly email_personal: string | null;
  readonly telefon: string | null;
  readonly adresa_strada: string | null;
  readonly adresa_oras: string | null;
  readonly adresa_judet: string | null;
  readonly data_nasterii: string | null;
  readonly gen: string;
  readonly cetatenie: string;
  readonly status: StatusAngajat;
  readonly hired_on: string | null;
  readonly terminated_on: string | null;
  readonly conditii_munca: string;
  readonly grad_handicap: string | null;
  readonly nr_persoane_intretinere: number;
  readonly is_primary: boolean;
  readonly contact_urgenta_nume: string | null;
  readonly contact_urgenta_telefon: string | null;
  readonly observatii: string | null;
  readonly department: { readonly id: string; readonly denumire: string } | null;
  readonly job_position: { readonly id: string; readonly denumire: string } | null;
  /** Lanțul de manageri de la vârf până la angajat INCLUSIV — vezi tg_employees_manager_path. */
  readonly manager_path: readonly string[];
  /** Contul din portal legat de această fișă — `null` dacă nu are (nu a acceptat invitația). */
  readonly user_id: string | null;
  readonly avatar_url: string | null;
  readonly contracts: readonly ContractAngajat[];
  readonly documents: readonly DocumentAngajat[];
}

type AngajatDetaliuBrut = Omit<AngajatDetaliu, "avatar_url">;

export interface VerigaLant {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly avatar_url: string | null;
  readonly job_position: { readonly denumire: string } | null;
}

interface VerigaLantBrut extends Omit<VerigaLant, "avatar_url"> {
  readonly user_id: string | null;
}

export interface RezumatDateSensibile {
  readonly cnp_last4: string | null;
  readonly iban_last4: string | null;
  readonly banca: string | null;
}

interface Cursor {
  readonly nume: string;
  readonly id: string;
}

export function codificaCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.nume}\u0000${cursor.id}`, "utf8").toString("base64url");
}

export function decodificaCursor(valoare: string): Cursor | null {
  try {
    const bucati = Buffer.from(valoare, "base64url").toString("utf8").split("\u0000");
    const nume = bucati[0];
    const id = bucati[1];
    if (nume === undefined || id === undefined || id.length === 0) return null;
    return { nume, id };
  } catch {
    return null;
  }
}

function ghilimeleaza(valoare: string): string {
  return `"${valoare.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

/** Fișa proprie a utilizatorului curent — necesară pentru scope „self” și „team”. */
export async function idFisaProprie(
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error !== null) throw error;
  return data?.id ?? null;
}

export interface IntrareListare {
  readonly organizationId: string;
  readonly scope: PermissionScope;
  readonly propriaFisaId: string | null;
  readonly filtre: FiltreAngajati;
}

export async function listeazaAngajati(intrare: IntrareListare): Promise<RezultatAngajati> {
  const { organizationId, scope, propriaFisaId, filtre } = intrare;
  if (scope !== "all" && propriaFisaId === null) {
    return { randuri: [], urmatorulCursor: null };
  }

  const db = await createServerSupabase();
  let interogare = db
    .from("employees")
    .select(
      `id, marca, full_name, status, hired_on, is_primary, user_id, ${EMBED_DEPARTAMENT}, ${EMBED_FUNCTIE}`,
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true })
    .order("id", { ascending: true })
    .limit(filtre.limita + 1);

  if (scope === "own" && propriaFisaId !== null) {
    interogare = interogare.eq("id", propriaFisaId);
  } else if (scope === "team" && propriaFisaId !== null) {
    interogare = interogare.contains("manager_path", [propriaFisaId]);
  }

  if (filtre.q !== null) interogare = interogare.ilike("full_name", `%${filtre.q}%`);
  if (filtre.department_id !== null)
    interogare = interogare.eq("department_id", filtre.department_id);
  if (filtre.job_position_id !== null)
    interogare = interogare.eq("job_position_id", filtre.job_position_id);
  if (filtre.status !== null) interogare = interogare.eq("status", filtre.status);

  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null) {
    const nume = ghilimeleaza(cursor.nume);
    interogare = interogare.or(`full_name.gt.${nume},and(full_name.eq.${nume},id.gt.${cursor.id})`);
  }

  const { data, error } = await interogare.returns<RandAngajatBrut[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const brute = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const avataruri = await avataturiPeUtilizatori(brute.map((rand) => rand.user_id));
  const randuri: RandAngajat[] = brute.map(({ user_id, ...rest }) => ({
    ...rest,
    avatar_url: urlAvatar(avataruri.get(user_id ?? "") ?? null),
  }));
  const ultimul = randuri.at(-1);
  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultimul !== undefined
        ? codificaCursor({ nume: ultimul.full_name, id: ultimul.id })
        : null,
  };
}

export async function citesteAngajat(
  organizationId: string,
  employeeId: string,
  scope: PermissionScope,
  propriaFisaId: string | null,
): Promise<AngajatDetaliu | null> {
  if (scope !== "all" && propriaFisaId === null) return null;

  const db = await createServerSupabase();
  let interogare = db
    .from("employees")
    .select(
      `id, marca, full_name, first_name, last_name, email_personal, telefon, adresa_strada, adresa_oras,
       adresa_judet, data_nasterii, gen, cetatenie, status, hired_on, terminated_on, conditii_munca,
       grad_handicap, nr_persoane_intretinere, is_primary, contact_urgenta_nume, contact_urgenta_telefon,
       observatii, manager_path, user_id,
       ${EMBED_DEPARTAMENT}, ${EMBED_FUNCTIE},
       contracts:employment_contracts!employee_id(id, numar, data_contract, valabil_de_la, valabil_pana,
         contract_duration, norma_ore_saptamana, salariu_baza, moneda, work_mode, status, este_act_aditional,
         incetat_la, motiv_incetare),
       documents:employee_documents!employee_id(id, titlu, data_document, valabil_pana, confidential)`,
    )
    .eq("organization_id", organizationId)
    .eq("id", employeeId)
    .is("deleted_at", null);

  if (scope === "own" && propriaFisaId !== null) {
    interogare = interogare.eq("id", propriaFisaId);
  } else if (scope === "team" && propriaFisaId !== null) {
    interogare = interogare.contains("manager_path", [propriaFisaId]);
  }

  const { data, error } = await interogare.maybeSingle<AngajatDetaliuBrut>();
  if (error !== null) throw error;
  if (data === null) return null;

  const avataruri = await avataturiPeUtilizatori([data.user_id]);
  const contracte = [...data.contracts].sort((a, b) =>
    b.valabil_de_la.localeCompare(a.valabil_de_la),
  );
  const documente = [...data.documents].sort((a, b) =>
    (b.data_document ?? "").localeCompare(a.data_document ?? ""),
  );
  return {
    ...data,
    avatar_url: urlAvatar(avataruri.get(data.user_id ?? "") ?? null),
    contracts: contracte,
    documents: documente,
  };
}

/**
 * Lanțul de manageri de la vârf până la managerul direct — EXCLUZÂND
 * angajatul însuși, deși `manager_path` îl conține (ultima poziție).
 * Ordinea rezultatului urmează exact `manager_path`, nu ordinea din DB.
 *
 * Interogare separată, NU embed `manager:employees!manager_employee_id(...)`:
 * pe un self-join, PostgREST nu poate distinge sensul relației după numele
 * coloanei — hint-ul se rezolvă la relația inversă (subordonați), nu la
 * managerul propriu-zis, și întoarce mereu un array gol.
 */
export async function lantulDeManageri(
  organizationId: string,
  managerPath: readonly string[],
  propriulId: string,
): Promise<readonly VerigaLant[]> {
  const idManageri = managerPath.filter((id) => id !== propriulId);
  if (idManageri.length === 0) return [];

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select(`id, full_name, marca, user_id, ${EMBED_FUNCTIE}`)
    .eq("organization_id", organizationId)
    .in("id", idManageri)
    .is("deleted_at", null)
    .returns<VerigaLantBrut[]>();
  if (error !== null) throw error;

  const brute = data ?? [];
  const avataruri = await avataturiPeUtilizatori(brute.map((v) => v.user_id));
  const dupaId = new Map(
    brute.map(({ user_id, ...rest }): readonly [string, VerigaLant] => [
      rest.id,
      { ...rest, avatar_url: urlAvatar(avataruri.get(user_id ?? "") ?? null) },
    ]),
  );
  return idManageri.map((id) => dupaId.get(id)).filter((v): v is VerigaLant => v !== undefined);
}

export interface NodManagerial {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly manager_employee_id: string | null;
  readonly avatar_url: string | null;
  readonly department: { readonly denumire: string } | null;
  readonly job_position: { readonly denumire: string } | null;
}

interface NodManagerialBrut extends Omit<NodManagerial, "avatar_url"> {
  readonly user_id: string | null;
}

/**
 * Toți angajații activi vizibili prin scope-ul curent, în formă plată —
 * pagina construiește arborele (rădăcinile sunt nodurile al căror
 * `manager_employee_id` nu se regăsește în acest set, fie pentru că e
 * `null`, fie pentru că managerul lor nu e vizibil la scope „team").
 */
export async function arboreleManagerial(
  organizationId: string,
  scope: PermissionScope,
  propriaFisaId: string | null,
): Promise<readonly NodManagerial[]> {
  const db = await createServerSupabase();
  let interogare = db
    .from("employees")
    .select(
      `id, full_name, marca, manager_employee_id, user_id, ${EMBED_DEPARTAMENT}, ${EMBED_FUNCTIE}`,
    )
    .eq("organization_id", organizationId)
    .eq("status", "activ")
    .is("deleted_at", null)
    .order("full_name");

  if (scope === "team" && propriaFisaId !== null) {
    interogare = interogare.contains("manager_path", [propriaFisaId]);
  }

  const { data, error } = await interogare.returns<NodManagerialBrut[]>();
  if (error !== null) throw error;

  const brute = data ?? [];
  const avataruri = await avataturiPeUtilizatori(brute.map((nod) => nod.user_id));
  return brute.map(({ user_id, ...rest }) => ({
    ...rest,
    avatar_url: urlAvatar(avataruri.get(user_id ?? "") ?? null),
  }));
}

/** Doar rezumatul mascat — valorile clare se obțin exclusiv prin acțiunea auditată. */
export async function citesteRezumatDateSensibile(
  organizationId: string,
  employeeId: string,
): Promise<RezumatDateSensibile | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employee_sensitive_data")
    .select("cnp_last4, iban_last4, banca")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .maybeSingle<RezumatDateSensibile>();
  if (error !== null) throw error;
  return data;
}

export interface ScutireFiscala {
  readonly id: string;
  readonly exemption_type: string;
  readonly valabil_de_la: string;
  readonly valabil_pana: string | null;
  readonly procent_scutire: number | null;
  readonly plafon_lunar: number | null;
  readonly temei_legal: string | null;
}

export async function citesteScutiriFiscale(
  organizationId: string,
  employeeId: string,
): Promise<readonly ScutireFiscala[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employee_tax_exemptions")
    .select("id, exemption_type, valabil_de_la, valabil_pana, procent_scutire, plafon_lunar, temei_legal")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .returns<ScutireFiscala[]>();
  if (error !== null) throw error;
  return data ?? [];
}
