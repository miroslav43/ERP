// src/lib/queries/employees.ts
// Citirile de personal, cu paginare keyset și restrângere după scope (self / team).

import type { PermissionScope } from "@/config/permissions";
import {
  SORTARI_ANGAJATI,
  type FiltreAngajati,
  type SortareAngajati,
  type StatusAngajat,
} from "@/schemas/employee";
import type { PiediciStergere } from "@/domain/hr/stergere-angajat";
import { urlAvatar } from "@/lib/avatar/cale";
import { avataturiPeUtilizatori } from "@/lib/queries/profile";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  codificaCursor as codificaKeyset,
  decodificaCursor as decodificaKeyset,
  predicatKeyset,
  sortareCeruta,
  type Directie,
} from "./cursor";

const EMBED_DEPARTAMENT = "department:departments!department_id(id, denumire)";

/**
 * Funcția NU mai e o relație încorporată.
 *
 * Până la migrarea 0110 aici stătea `job_position:job_positions!job_position_id(id,
 * denumire)`, adică un JOIN pe fiecare listare de angajați. Nomenclatorul a fost
 * desființat: denumirea și codul COR sunt coloane pe `employees`, deci două
 * coloane simple în loc de un embed. Ecranele care afișau doar numele funcției
 * cer doar `functie`; constanta asta e pentru cele care au nevoie și de cod.
 */
const COLOANE_FUNCTIE = "functie, cod_cor";

export interface RandAngajat {
  readonly id: string;
  readonly marca: string;
  readonly full_name: string;
  readonly status: StatusAngajat;
  readonly hired_on: string | null;
  readonly is_primary: boolean;
  /**
   * Contul din portal, dacă fișa are unul. Se citea deja — avatarul se rezolvă
   * din el — dar se arunca la ieșire. E păstrat de când coloana „Stare" arată
   * și rolul din aplicație: ea are nevoie de cheia după care se caută rolul.
   */
  readonly user_id: string | null;
  readonly avatar_url: string | null;
  readonly department: { readonly id: string; readonly denumire: string } | null;
  readonly functie: string | null;
  readonly cod_cor: string | null;
}

type RandAngajatBrut = Omit<RandAngajat, "avatar_url">;

export interface RezultatAngajati {
  readonly randuri: readonly RandAngajat[];
  readonly urmatorulCursor: string | null;
  /**
   * Câte rânduri sunt în total, după filtre. Nicio listă din produs n-o spunea:
   * „Pagina următoare" fără un total e o ușă fără indicație — nu știi dacă mai
   * urmează un ecran sau o sută.
   */
  readonly total: number;
  /** Sortarea EFECTIV aplicată, după îngustarea la coloanele permise. */
  readonly sortare: Readonly<{ cheie: SortareAngajati; directie: Directie }>;
}

const SORTARE_IMPLICITA = { cheie: "nume", directie: "asc" } as const;

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
  /** Adresa dată de firmă (0033). Rezerva pentru invitație când lipsește cea personală. */
  readonly email_serviciu: string | null;
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
  /**
   * Actul de identitate — citit AICI doar ca să se poată semnala ce lipsește.
   *
   * Fișa de detaliu nu-l afișează (e în ecranul de editare), dar fără el pagina
   * n-ar putea spune „lipsesc datele pentru contract și REGES" — iar toate cele
   * 11 fișe din baza reală n-au niciunul dintre câmpurile astea.
   */
  readonly serie_act: string | null;
  readonly numar_act: string | null;
  readonly act_eliberat_de: string | null;
  readonly act_eliberat_la: string | null;
  readonly nr_persoane_intretinere: number;
  readonly is_primary: boolean;
  readonly contact_urgenta_nume: string | null;
  readonly contact_urgenta_telefon: string | null;
  readonly observatii: string | null;
  readonly department: { readonly id: string; readonly denumire: string } | null;
  readonly functie: string | null;
  readonly cod_cor: string | null;
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
  readonly functie: string | null;
}

interface VerigaLantBrut extends Omit<VerigaLant, "avatar_url"> {
  readonly user_id: string | null;
}

export interface RezumatDateSensibile {
  readonly cnp_last4: string | null;
  readonly iban_last4: string | null;
  readonly banca: string | null;
}

/*
 * Cursorul, ghilimelarea și predicatul keyset trăiau AICI, în copii aproape
 * identice răspândite prin zece fișiere de citiri — fiecare cu propriul
 * `ghilimeleaza`. Au fost mutate în `./cursor.ts`, unde structura poartă o
 * valoare opacă în loc de un nume, deci aceeași funcție servește orice coloană
 * de sortare. Testele lor sunt în `cursor.test.ts`.
 */

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

/**
 * Cheia din URL → coloana din bază. Traducerea e OBLIGATORIU explicită: numele
 * coloanei intră într-un predicat construit ca text, deci nu are voie să vină
 * din afară. Cheile sunt românești fiindcă apar în adresa pe care omul o
 * copiază; coloanele rămân englezești, ca tot restul schemei.
 */
const COLOANA_SORTARE: Readonly<Record<SortareAngajati, string>> = {
  nume: "full_name",
  marca: "marca",
  angajat_din: "hired_on",
};

export interface IntrareListare {
  readonly organizationId: string;
  readonly scope: PermissionScope;
  readonly propriaFisaId: string | null;
  readonly filtre: FiltreAngajati;
}

export async function listeazaAngajati(intrare: IntrareListare): Promise<RezultatAngajati> {
  const { organizationId, scope, propriaFisaId, filtre } = intrare;
  if (scope !== "all" && propriaFisaId === null) {
    return { randuri: [], urmatorulCursor: null, total: 0, sortare: SORTARE_IMPLICITA };
  }

  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort, SORTARI_ANGAJATI, SORTARE_IMPLICITA);
  const coloana = COLOANA_SORTARE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  /*
   * ── DE CE NUMĂRĂTOAREA E O A DOUA INTEROGARE ──────────────────────────
   * Aici stătea `count: "exact"` pe ACEEAȘI interogare, cu argumentul —
   * corect în sine — că așa numărătoarea respectă filtrele și politicile RLS.
   * Argumentul rata un lucru: predicatul KEYSET e și el un filtru. Pus pe
   * aceeași interogare, `count` numără doar ce a rămas DUPĂ cursor.
   *
   * Consecința se vedea de la pagina a doua: `<Paginare>` scria „25 din 30 de
   * rânduri" acolo unde erau 55, iar totalul scădea cu fiecare „mai departe".
   * O cifră greșită fără nicio eroare — exact clasa pe care restul stratului o
   * vânează.
   *
   * Cele două interogări împart ACELEAȘI filtre, aplicate de aceeași funcție,
   * ca să nu poată diverge; se deosebesc doar prin cursor, ordine și limită,
   * care aparțin paginii, nu mulțimii. Merg în paralel, iar numărătoarea e
   * `head: true`, deci nu aduce niciun rând.
   */
  /**
   * Filtrele mulțimii, aplicate identic pe amândouă interogările.
   *
   * Generic peste constructorul de interogare, nu scris de două ori: două copii
   * ar diverge la primul filtru adăugat, iar divergența s-ar vedea tocmai ca o
   * numărătoare care nu se potrivește cu lista — defectul reparat aici.
   */
  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
      ilike: (c: string, v: string) => Q;
      contains: (c: string, v: readonly string[]) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (scope === "own" && propriaFisaId !== null) cu = cu.eq("id", propriaFisaId);
    else if (scope === "team" && propriaFisaId !== null)
      cu = cu.contains("manager_path", [propriaFisaId]);
    if (filtre.q !== null) cu = cu.ilike("full_name", `%${filtre.q}%`);
    if (filtre.department_id !== null) cu = cu.eq("department_id", filtre.department_id);
    if (filtre.functie !== null) cu = cu.eq("functie", filtre.functie);
    if (filtre.status !== null) cu = cu.eq("status", filtre.status);
    return cu;
  };

  let interogare = filtreaza(
    db
      .from("employees")
      .select(
        `id, marca, full_name, status, hired_on, is_primary, user_id, ${EMBED_DEPARTAMENT}, ${COLOANE_FUNCTIE}`,
      ),
  )
    // Identificatorul e MEREU al doilea criteriu: numele nu e unic, iar fără el
    // ordinea dintre doi omonimi e nedefinită, deci paginarea poate sări sau
    // repeta exact acolo.
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  const cursor = filtre.cursor === null ? null : decodificaKeyset(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandAngajatBrut[]>(),
    filtreaza(db.from("employees").select("id", { count: "exact", head: true })),
  ]);
  const { data, error } = rezultat;
  if (error !== null) throw error;
  if (numarare.error !== null) throw numarare.error;
  const count = numarare.count;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const brute = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const avataruri = await avataturiPeUtilizatori(brute.map((rand) => rand.user_id));
  const randuri: RandAngajat[] = brute.map((rand) => ({
    ...rand,
    avatar_url: urlAvatar(avataruri.get(rand.user_id ?? "") ?? null),
  }));
  const ultimul = randuri.at(-1);
  const valoareCursor =
    ultimul === undefined
      ? null
      : sortare.cheie === "marca"
        ? ultimul.marca
        : sortare.cheie === "angajat_din"
          ? (ultimul.hired_on ?? "")
          : ultimul.full_name;

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultimul !== undefined && valoareCursor !== null
        ? codificaKeyset({ valoare: valoareCursor, id: ultimul.id })
        : null,
    total: count ?? randuri.length,
    sortare,
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
      `id, marca, full_name, first_name, last_name, email_personal, email_serviciu, telefon, adresa_strada, adresa_oras,
       adresa_judet, data_nasterii, gen, cetatenie, status, hired_on, terminated_on, conditii_munca,
       grad_handicap, serie_act, numar_act, act_eliberat_de, act_eliberat_la,
       nr_persoane_intretinere, is_primary, contact_urgenta_nume, contact_urgenta_telefon,
       observatii, manager_path, user_id,
       ${EMBED_DEPARTAMENT}, ${COLOANE_FUNCTIE},
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
 * Rolul din aplicație al conturilor legate de niște fișe.
 *
 * ── DE CE O A DOUA INTEROGARE, NU UN EMBED ────────────────────────────────
 * Nu există cheie străină între `employees` și `organization_members` — se
 * întâlnesc pe perechea `(organization_id, user_id)`, nu pe o referință. Fără
 * FK, PostgREST refuză embed-ul, deci alegerea nu e între „embed” și „încă un
 * dus-întors”, ci doar cum se face al doilea.
 *
 * Se cer exact id-urile cerute, nu toți membrii firmei: la opt angajați
 * diferența e nulă, dar interogarea rămâne mărginită și la o firmă care crește.
 *
 * ── CE NU REFUZĂ TĂCUT ────────────────────────────────────────────────────
 * `organization_members_select` cere DOAR apartenența la organizație — nicio
 * permisiune, niciun scope. Deci și `hr` (care n-are niciun `users:*`) și
 * managerul primesc rândurile. Verificat pe politica vie, nu dedus: e fix genul
 * de citire care ar fi întors zero rânduri fără eroare.
 *
 * Se filtrează `status = 'active'`: un membru dezactivat nu mai e administrator
 * al nimănui, iar insigna lui de pe fișă ar fi o afirmație falsă.
 */
interface RolMembru {
  readonly user_id: string | null;
  readonly role: string;
}

export async function rolurileConturilor(
  organizationId: string,
  userIds: readonly (string | null)[],
): Promise<ReadonlyMap<string, string>> {
  const ids = [...new Set(userIds.filter((u): u is string => u !== null))];
  if (ids.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .in("user_id", ids)
    .eq("status", "active")
    .is("deleted_at", null)
    // Array MUTABIL în generic, nu `readonly …[]`: supabase-js compară forma și
    // răspunde la un `readonly` cu un tip-mesaj („Cannot cast array result to a
    // single object"), nu cu o eroare care arată spre cauză. Rezultatul se
    // închide oricum imediat, în `ReadonlyMap`.
    .returns<RolMembru[]>();
  if (error !== null) throw error;

  return new Map(
    data.flatMap((rand) => (rand.user_id === null ? [] : [[rand.user_id, rand.role] as const])),
  );
}

/**
 * Piedicile la ștergerea unei fișe, numărate în bază — pentru ECRAN.
 *
 * ── DE CE SE NUMĂRĂ ÎNAINTE DE CLIC ───────────────────────────────────────
 * Același argument ca la `actiuni-functie.tsx`: un refuz care sosește după
 * apăsare îl învață pe om că butonul e nesigur, iar cifra care explică refuzul
 * — câte contracte, câți subordonați — nu apare nicăieri. Aici motivele se
 * așază sub buton, iar butonul se blochează singur.
 *
 * ⚠️ Numărătoarea trece prin RLS, deci vede doar ce are voie să citească cel
 * care întreabă. Rolurile cu `employees:delete = all` (super_admin, org_admin,
 * hr) au și `employees:read = all`, deci pentru ele numărul e complet. O
 * suprascriere per membru (`role_permissions.member_id`, migrarea 0063) poate
 * însă acorda ștergerea fără citirea completă — atunci ecranul ar SUBESTIMA.
 * De aceea adevărul rămâne la server: `stergeAngajat` renumără cu clientul de
 * serviciu, iar funcția asta e doar semnalul care ține degetul departe de
 * butonul care oricum ar fi refuzat.
 */
export async function piediciStergereAngajat(
  organizationId: string,
  employeeId: string,
  esteFisaProprie: boolean,
): Promise<PiediciStergere> {
  const db = await createServerSupabase();

  const [contracte, subordonati] = await Promise.all([
    db
      .from("employment_contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .eq("status", "activ")
      .is("deleted_at", null),
    // Subordonații DIRECȚI, nu tot subarborele: `manager_path` l-ar da pe tot,
    // dar mesajul „mută-i pe alt manager" se referă la cei care îl au scris ca
    // manager. Nepoții se mută singuri, prin triggerul de cascadă.
    db
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("manager_employee_id", employeeId)
      .is("deleted_at", null),
  ]);

  if (contracte.error !== null) throw contracte.error;
  if (subordonati.error !== null) throw subordonati.error;

  return {
    contracteActive: contracte.count ?? 0,
    subordonatiDirecti: subordonati.count ?? 0,
    esteFisaProprie,
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
    .select("id, full_name, marca, user_id, functie")
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
  /**
   * Contul din portal. Se citea deja — avatarul se rezolvă din el — dar se
   * arunca la ieșire. E păstrat de când organigrama pune administratorul la
   * rădăcină: `organization_members` nu are cheie străină către `employees`, se
   * întâlnesc pe `(organization_id, user_id)`, deci ăsta e singurul fir dintre
   * un nod și rolul lui. Vezi `rolurileConturilor`, aceeași cheie.
   */
  readonly user_id: string | null;
  readonly avatar_url: string | null;
  readonly department: { readonly denumire: string } | null;
  readonly functie: string | null;
}

type NodManagerialBrut = Omit<NodManagerial, "avatar_url">;

/**
 * Toți angajații activi vizibili prin scope-ul curent, în formă plată —
 * pagina construiește arborele (rădăcinile sunt nodurile al căror
 * `manager_employee_id` nu se regăsește în acest set, fie pentru că e
 * `null`, fie pentru că managerul lor nu e vizibil la scope „team").
 */
const COLOANE_NOD_MANAGERIAL = `id, full_name, marca, manager_employee_id, user_id, ${EMBED_DEPARTAMENT}, functie`;

export async function arboreleManagerial(
  organizationId: string,
  scope: PermissionScope,
  propriaFisaId: string | null,
): Promise<readonly NodManagerial[]> {
  const db = await createServerSupabase();

  if (scope === "own" && propriaFisaId !== null) {
    // Un angajat obișnuit nu vede toată organizația, dar tot trebuie să-și
    // vadă locul în ea: propriul lanț de manageri (ca la breadcrumb-ul de pe
    // fișa proprie, `lantulDeManageri`) + propria subarbore, dacă are
    // subordonați direcți (posibil chiar și cu scope „own", dacă permisiunile
    // sunt configurate neobișnuit).
    const { data: proprie, error: eroareProprie } = await db
      .from("employees")
      .select("manager_path")
      .eq("id", propriaFisaId)
      .maybeSingle<{ manager_path: readonly string[] }>();
    if (eroareProprie !== null) throw eroareProprie;

    const idAscendenti = (proprie?.manager_path ?? []).filter((id) => id !== propriaFisaId);
    const [subarbore, ascendenti] = await Promise.all([
      db
        .from("employees")
        .select(COLOANE_NOD_MANAGERIAL)
        .eq("organization_id", organizationId)
        .eq("status", "activ")
        .is("deleted_at", null)
        .contains("manager_path", [propriaFisaId])
        .returns<NodManagerialBrut[]>(),
      idAscendenti.length === 0
        ? Promise.resolve({ data: [] as NodManagerialBrut[], error: null })
        : db
            .from("employees")
            .select(COLOANE_NOD_MANAGERIAL)
            .eq("organization_id", organizationId)
            .in("id", idAscendenti)
            .is("deleted_at", null)
            .returns<NodManagerialBrut[]>(),
    ]);
    if (subarbore.error !== null) throw subarbore.error;
    if (ascendenti.error !== null) throw ascendenti.error;

    const brute = [...ascendenti.data, ...subarbore.data];
    const avataruri = await avataturiPeUtilizatori(brute.map((nod) => nod.user_id));
    return brute.map((nod) => ({
      ...nod,
      avatar_url: urlAvatar(avataruri.get(nod.user_id ?? "") ?? null),
    }));
  }

  let interogare = db
    .from("employees")
    .select(COLOANE_NOD_MANAGERIAL)
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
  return brute.map((nod) => ({
    ...nod,
    avatar_url: urlAvatar(avataruri.get(nod.user_id ?? "") ?? null),
  }));
}

// ── Fișa, pentru ecranul de editare ────────────────────────────────────────

/**
 * Exact coloanele pe care `actualizeazaAngajatSchema` le acceptă la scriere.
 *
 * DE CE O A DOUA CITIRE, ȘI NU `citesteAngajat`: aceea selectează 24 de
 * coloane, alese pentru ce se AFIȘEAZĂ pe fișă. Schema de actualizare acceptă
 * 33. Diferența — adresa de reședință, contactul de serviciu, actul de
 * identitate, starea civilă, managerul direct, relația contactului de urgență —
 * nu ajungea niciodată în formular, deci formularul nu o retrimitea, deci Zod
 * îi aplica `.default(null)` și `UPDATE`-ul o ștergea. Măsurat: din 34 de chei
 * ajunse la `.update()`, formularul trimitea 12; celelalte 22 se scriau ca
 * `null` (sau reveneau la „RO" / „normale" / `true`) la FIECARE salvare, chiar
 * și când se corecta doar un număr de telefon.
 *
 * Lista de mai jos și `.pick()`-ul din `src/schemas/employee.ts` trebuie să
 * rămână identice: dacă o coloană se adaugă acolo și nu aici, se pierde din nou.
 */
export interface AngajatEditabil {
  readonly id: string;
  readonly marca: string;
  readonly full_name: string;
  readonly last_name: string;
  readonly first_name: string;
  readonly email_personal: string | null;
  readonly telefon: string | null;
  readonly email_serviciu: string | null;
  readonly telefon_serviciu: string | null;
  readonly adresa_strada: string | null;
  readonly adresa_oras: string | null;
  readonly adresa_judet: string | null;
  readonly adresa_cod_postal: string | null;
  readonly adresa_resedinta_strada: string | null;
  readonly adresa_resedinta_oras: string | null;
  readonly adresa_resedinta_judet: string | null;
  readonly adresa_resedinta_cod_postal: string | null;
  readonly stare_civila: string | null;
  readonly data_nasterii: string | null;
  readonly gen: string;
  readonly cetatenie: string;
  readonly tip_act_identitate: string | null;
  readonly reges_tip_act: string | null;
  readonly serie_act: string | null;
  readonly numar_act: string | null;
  readonly act_eliberat_de: string | null;
  readonly act_eliberat_la: string | null;
  readonly act_valabil_pana: string | null;
  readonly department_id: string | null;
  readonly functie: string | null;
  readonly cod_cor: string | null;
  readonly manager_employee_id: string | null;
  readonly hired_on: string | null;
  readonly conditii_munca: string;
  readonly grad_handicap: string | null;
  readonly optiune_pilon_ii: boolean;
  readonly contact_urgenta_nume: string | null;
  readonly contact_urgenta_telefon: string | null;
  readonly contact_urgenta_relatie: string | null;
  readonly observatii: string | null;
}

export async function citesteAngajatPentruEditare(
  organizationId: string,
  employeeId: string,
): Promise<AngajatEditabil | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select(
      `id, marca, full_name, last_name, first_name, email_personal, telefon, email_serviciu,
       telefon_serviciu, adresa_strada, adresa_oras, adresa_judet, adresa_cod_postal,
       adresa_resedinta_strada, adresa_resedinta_oras, adresa_resedinta_judet,
       adresa_resedinta_cod_postal, stare_civila, data_nasterii, gen, cetatenie,
       tip_act_identitate, reges_tip_act, serie_act, numar_act, act_eliberat_de,
       act_eliberat_la, act_valabil_pana,
       department_id, functie, cod_cor, manager_employee_id, hired_on, conditii_munca,
       grad_handicap, optiune_pilon_ii, contact_urgenta_nume, contact_urgenta_telefon,
       contact_urgenta_relatie, observatii`,
    )
    .eq("organization_id", organizationId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle<AngajatEditabil>();
  if (error !== null) throw error;
  return data;
}

export interface OptiuneColeg {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

/**
 * Colegii care pot fi aleși ca manager direct, fără fișa editată însăși — o
 * fișă care se raportează la ea însăși ar face `manager_path` să cicleze.
 *
 * Nu exclude subordonații actuali: ierarhia se poate rescrie legitim, iar
 * verificarea de ciclu aparține bazei (triggerul `tg_employees_manager_path`),
 * nu unui `<select>`. `max_rows` din PostgREST taie TĂCUT la 1000 de rânduri;
 * cea mai mare firmă din sistem are 8 angajați, deci limita nu se atinge, dar
 * `.limit(...)` explicit face tăierea vizibilă în cod dacă vreodată se atinge.
 */
export async function colegiPentruManager(
  organizationId: string,
  exclusId: string,
): Promise<readonly OptiuneColeg[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", organizationId)
    .neq("id", exclusId)
    .is("deleted_at", null)
    .in("status", ["candidat", "activ", "suspendat", "preaviz"])
    .order("full_name", { ascending: true })
    .limit(500)
    .returns<OptiuneColeg[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Toți angajații pentru care se poate completa un plan de pontaj (0084).
 *
 * Aceleași stări ca la `colegiPentruManager` — cine e `plecat` n-are săptămână
 * de planificat — dar FĂRĂ excludere: patronul trebuie să se regăsească și pe
 * sine în listă, altfel selectorul îl scoate din propria firmă.
 *
 * Nu e o poartă: cine deschide lista tot nu poate SCRIE decât unde îl lasă
 * `app.poate_scrie_pontaj`. Ecranul o oferă doar la scope `all`, ca să nu
 * afișeze nume pe care apoi baza le-ar refuza.
 */
export async function angajatiPentruPontaj(
  organizationId: string,
): Promise<readonly OptiuneColeg[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", ["candidat", "activ", "suspendat", "preaviz"])
    .order("full_name", { ascending: true })
    .limit(500)
    .returns<OptiuneColeg[]>();
  if (error !== null) throw error;
  return data ?? [];
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
    .select(
      "id, exemption_type, valabil_de_la, valabil_pana, procent_scutire, plafon_lunar, temei_legal",
    )
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .returns<ScutireFiscala[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export interface ComponentaSalariala {
  readonly id: string;
  readonly kind: string;
  readonly procent: number | null;
  readonly suma: number | null;
  readonly valabil_de_la: string;
  readonly valabil_pana: string | null;
  readonly observatii: string | null;
  readonly component_type: Readonly<{ denumire: string; cod_revisal: string | null }> | null;
}

export async function citesteComponenteSalariale(
  organizationId: string,
  employeeId: string,
): Promise<readonly ComponentaSalariala[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("salary_components")
    .select(
      "id, kind, procent, suma, valabil_de_la, valabil_pana, observatii, component_type:salary_component_types!component_type_id(denumire, cod_revisal)",
    )
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .returns<ComponentaSalariala[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/*
 * `citesteEvaluari`, `Evaluare`, `RaspunsEvaluare` și `CriteriuSablonEvaluare`
 * au fost mutate în `src/lib/queries/evaluari.ts`, ca `evaluariAngajat`.
 *
 * Motivul nu e curățenia, ci corectitudinea: funcția de aici citea criteriile
 * din ȘABLONUL CURENT (`template:evaluation_templates(criterii)`) și potrivea
 * răspunsurile după cod. Cât timp șabloanele nu se puteau edita, mergea. De
 * când se pot, o redenumire de criteriu rescria retroactiv evaluările vechi,
 * iar o scală schimbată le rescria notele. Varianta nouă citește instantaneul
 * (`criterii_sablon`) scris la completare.
 */

// ── Funcții, pentru filtrul listei (0 rânduri ⇒ filtrul se ascunde) ─────────

/**
 * Denumirile de funcții CHIAR FOLOSITE în firmă, pentru sugestiile din fișă și
 * pentru `<select>`-ul din bara de filtre.
 *
 * ── DE CE DIN `employees`, ȘI NU DINTR-UN NOMENCLATOR ─────────────────────
 * Fiindcă nu mai există unul: migrarea 0110 a desființat `job_positions`.
 * Predecesoarea (`functiiActive`) citea nomenclatorul, adică lista funcțiilor
 * DEFINITE — care putea conține funcții pe care nu le ținea nimeni și putea
 * omite... nimic, dar cu prețul unui pas separat de administrare.
 *
 * Aici lista se naște din realitate: ce scrie efectiv pe fișe. Consecința utilă
 * e că filtrul nu poate oferi niciodată o opțiune care întoarce zero rânduri.
 *
 * Deduplicarea se face în memorie, nu cu `distinct`: PostgREST nu-l expune, iar
 * volumele sunt cele reale — cea mai mare firmă are opt angajați.
 */
export async function functiiFolosite(organizationId: string): Promise<readonly string[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("functie")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .not("functie", "is", null)
    .order("functie", { ascending: true })
    // Array MUTABIL în generic, deliberat: cu `readonly string[]` tipul se rupe
    // tăcut și eroarea arată spre `.single()`, adică spre cauza greșită.
    .returns<{ functie: string }[]>();
  if (error !== null) throw error;
  return [...new Set((data ?? []).map((rand) => rand.functie))];
}
