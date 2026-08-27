// src/lib/queries/cursuri.ts
// Citirile modulului de cursuri. NU se filtrează după scope (own/team/all) în
// cod: politicile din 0075_cursuri.sql restrâng rândurile direct în Postgres.
//
// `max_rows = 1000` din `supabase/config.toml` TRUNCHIAZĂ TĂCUT. Toate
// listările de aici sunt fie paginate cu cursor keyset, fie plafonate explicit
// cu un `.limit()` sub prag și cu motivul scris.

import { createServerSupabase } from "@/lib/supabase/server";
import {
  SORTARI_CURSURI,
  SORTARI_INROLARI,
  SORTARI_MATERIALE,
  type CursItemStatus,
  type CursMaterialFel,
  type CursMaterialSursa,
  type CursCriteriu,
  type CursMotiv,
  type CursStatus,
  type CursTreaptaDovada,
  type FiltreCursuri,
  type FiltreInrolari,
  type FiltreMateriale,
  type SortareCursuri,
  type SortareInrolari,
  type SortareMateriale,
} from "@/schemas/cursuri";
import type { FurnizorLink } from "@/lib/media/link-extern";

import {
  codificaCursor,
  decodificaCursor,
  predicatKeyset,
  sortareCeruta,
  type Directie,
} from "./cursor";

// ── Traducerea cheie din URL → coloană. Explicită OBLIGATORIU: numele intră
// într-un `.order()` și într-un predicat construit ca text.

const COLOANA_SORTARE_CURS: Readonly<Record<SortareCursuri, string>> = {
  denumire: "denumire",
  cod: "cod",
  creat: "created_at",
};
const SORTARE_IMPLICITA_CURSURI = { cheie: "denumire", directie: "asc" } as const;

const COLOANA_SORTARE_MATERIAL: Readonly<Record<SortareMateriale, string>> = {
  titlu: "titlu",
  cod: "cod",
  fel: "fel",
};
const SORTARE_IMPLICITA_MATERIALE = { cheie: "titlu", directie: "asc" } as const;

const COLOANA_SORTARE_INROLARE: Readonly<Record<SortareInrolari, string>> = {
  termen: "termen",
  stare: "status",
  angajat: "employee_id",
};
/** Restanțele întâi: termenul cel mai apropiat sus. */
const SORTARE_IMPLICITA_INROLARI = { cheie: "termen", directie: "asc" } as const;

// ═══════════════════════════════════════════════════════════════════════════
// Cursuri
// ═══════════════════════════════════════════════════════════════════════════

const COLOANE_CURS =
  "id, cod, denumire, descriere, obligatoriu, valabilitate_luni, termen_zile, prag_avertizare_zile, publicat, publicat_la, activ, created_at";

export type RandCurs = Readonly<{
  id: string;
  cod: string;
  denumire: string;
  descriere: string | null;
  obligatoriu: boolean;
  valabilitate_luni: number | null;
  termen_zile: number;
  prag_avertizare_zile: number;
  publicat: boolean;
  publicat_la: string | null;
  activ: boolean;
  created_at: string;
}>;

export type RezultatCursuri = Readonly<{
  randuri: readonly RandCurs[];
  urmatorulCursor: string | null;
  total: number;
  sortare: Readonly<{ cheie: SortareCursuri; directie: Directie }>;
}>;

export async function listeazaCursuri(
  organizationId: string,
  filtre: FiltreCursuri,
): Promise<RezultatCursuri> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort ?? null, SORTARI_CURSURI, SORTARE_IMPLICITA_CURSURI);
  const coloana = COLOANA_SORTARE_CURS[sortare.cheie];
  const crescator = sortare.directie === "asc";

  // Aceleași filtre pe amândouă interogările, aplicate de aceeași funcție: două
  // copii ar diverge la primul filtru adăugat, iar divergența s-ar vedea ca o
  // numărătoare care nu se potrivește cu lista.
  const filtreaza = <
    Q extends {
      eq: (c: string, v: string | boolean) => Q;
      is: (c: string, v: null) => Q;
      or: (f: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.doar_publicate === "da") cu = cu.eq("publicat", true);
    if (filtre.cauta !== null) {
      const t = filtre.cauta.replace(/[%,()]/gu, " ");
      cu = cu.or(`denumire.ilike.%${t}%,cod.ilike.%${t}%`);
    }
    return cu;
  };

  let interogare = filtreaza(db.from("courses").select(COLOANE_CURS))
    .order(coloana, { ascending: crescator, nullsFirst: false })
    // Tie-breaker OBLIGATORIU: denumirea nu e unică între organizații diferite,
    // iar fără el paginarea poate sări sau repeta între rânduri egale.
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null)
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandCurs[]>(),
    filtreaza(db.from("courses").select("id", { count: "exact", head: true })),
  ]);
  if (rezultat.error !== null) throw rezultat.error;
  if (numarare.error !== null) throw numarare.error;

  const toate = rezultat.data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  const valoare =
    ultim === undefined
      ? null
      : sortare.cheie === "cod"
        ? ultim.cod
        : sortare.cheie === "creat"
          ? ultim.created_at
          : ultim.denumire;

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined && valoare !== null
        ? codificaCursor({ valoare, id: ultim.id })
        : null,
    total: numarare.count ?? randuri.length,
    sortare,
  };
}

export async function citesteCurs(organizationId: string, id: string): Promise<RandCurs | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("courses")
    .select(COLOANE_CURS)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandCurs>();
  if (error !== null) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// Materiale și versiuni
// ═══════════════════════════════════════════════════════════════════════════

const COLOANE_MATERIAL =
  "id, cod, titlu, descriere, fel, sursa, treapta_dovada, procent_minim, prag_test, declaratie_text, transcriere, versiune_curenta_id, activ";

export type RandMaterial = Readonly<{
  id: string;
  cod: string;
  titlu: string;
  descriere: string | null;
  fel: CursMaterialFel;
  sursa: CursMaterialSursa;
  treapta_dovada: CursTreaptaDovada;
  procent_minim: number | null;
  prag_test: number | null;
  declaratie_text: string | null;
  transcriere: string | null;
  versiune_curenta_id: string | null;
  activ: boolean;
}>;

export type RezultatMateriale = Readonly<{
  randuri: readonly RandMaterial[];
  urmatorulCursor: string | null;
  total: number;
  sortare: Readonly<{ cheie: SortareMateriale; directie: Directie }>;
}>;

export async function listeazaMateriale(
  organizationId: string,
  filtre: FiltreMateriale,
): Promise<RezultatMateriale> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(
    filtre.sort ?? null,
    SORTARI_MATERIALE,
    SORTARE_IMPLICITA_MATERIALE,
  );
  const coloana = COLOANA_SORTARE_MATERIAL[sortare.cheie];
  const crescator = sortare.directie === "asc";

  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
      or: (f: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.fel !== null) cu = cu.eq("fel", filtre.fel);
    if (filtre.cauta !== null) {
      const t = filtre.cauta.replace(/[%,()]/gu, " ");
      cu = cu.or(`titlu.ilike.%${t}%,cod.ilike.%${t}%`);
    }
    return cu;
  };

  let interogare = filtreaza(db.from("course_materials").select(COLOANE_MATERIAL))
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null)
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandMaterial[]>(),
    filtreaza(db.from("course_materials").select("id", { count: "exact", head: true })),
  ]);
  if (rezultat.error !== null) throw rezultat.error;
  if (numarare.error !== null) throw numarare.error;

  const toate = rezultat.data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  const valoare =
    ultim === undefined
      ? null
      : sortare.cheie === "cod"
        ? ultim.cod
        : sortare.cheie === "fel"
          ? ultim.fel
          : ultim.titlu;

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined && valoare !== null
        ? codificaCursor({ valoare, id: ultim.id })
        : null,
    total: numarare.count ?? randuri.length,
    sortare,
  };
}

export async function citesteMaterial(
  organizationId: string,
  id: string,
): Promise<RandMaterial | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_materials")
    .select(COLOANE_MATERIAL)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandMaterial>();
  if (error !== null) throw error;
  return data;
}

export type RandVersiune = Readonly<{
  id: string;
  versiune: number;
  fisier_path: string | null;
  fisier_nume: string | null;
  fisier_marime_bytes: number | null;
  fisier_mime: string | null;
  subtitrare_path: string | null;
  link_furnizor: FurnizorLink | null;
  link_id: string | null;
  link_cod_privat: string | null;
  durata_secunde: number | null;
  numar_pagini: number | null;
  nota_versiune: string | null;
  publicata_la: string | null;
  retrasa_la: string | null;
}>;

const COLOANE_VERSIUNE =
  "id, versiune, fisier_path, fisier_nume, fisier_marime_bytes, fisier_mime, subtitrare_path, link_furnizor, link_id, link_cod_privat, durata_secunde, numar_pagini, nota_versiune, publicata_la, retrasa_la";

/** Plafon 200: un material cu peste 200 de versiuni e un defect, nu un caz real. */
export async function versiunileMaterialului(
  organizationId: string,
  materialId: string,
): Promise<readonly RandVersiune[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_material_versions")
    .select(COLOANE_VERSIUNE)
    .eq("organization_id", organizationId)
    .eq("material_id", materialId)
    .is("deleted_at", null)
    .order("versiune", { ascending: false })
    .limit(200)
    .returns<RandVersiune[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/** Versiunea pinuită a unei lecții — folosită de ruta de livrare a conținutului. */
export async function citesteVersiune(
  organizationId: string,
  versionId: string,
): Promise<RandVersiune | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_material_versions")
    .select(COLOANE_VERSIUNE)
    .eq("organization_id", organizationId)
    .eq("id", versionId)
    .is("deleted_at", null)
    .maybeSingle<RandVersiune>();
  if (error !== null) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// Lecțiile unui curs (course_items)
// ═══════════════════════════════════════════════════════════════════════════

export type RandLectie = Readonly<{
  id: string;
  ordine: number;
  obligatoriu: boolean;
  material_id: string;
  titlu: string;
  fel: CursMaterialFel;
  sursa: CursMaterialSursa;
  treapta_dovada: CursTreaptaDovada;
  are_versiune: boolean;
  durata_secunde: number | null;
}>;

type RandLectieBruta = Readonly<{
  id: string;
  ordine: number;
  obligatoriu: boolean;
  material_id: string;
  course_materials: Readonly<{
    titlu: string;
    fel: CursMaterialFel;
    sursa: CursMaterialSursa;
    treapta_dovada: CursTreaptaDovada;
    versiune_curenta_id: string | null;
    course_material_versions: Readonly<{ durata_secunde: number | null }> | null;
  }> | null;
}>;

export async function lectiileCursului(
  organizationId: string,
  courseId: string,
): Promise<readonly RandLectie[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_items")
    .select(
      `id, ordine, obligatoriu, material_id,
       course_materials!course_items_material_id_organization_id_fkey (
         titlu, fel, sursa, treapta_dovada, versiune_curenta_id,
         course_material_versions!course_materials_versiune_curenta_fk ( durata_secunde )
       )`,
    )
    .eq("organization_id", organizationId)
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("ordine", { ascending: true })
    .limit(500)
    .returns<RandLectieBruta[]>();
  if (error !== null) throw error;

  // Materialul poate veni NULL dacă politica de SELECT îl ascunde — tipăm
  // explicit și afișăm „—”, niciodată nu compensăm cu createAdminSupabase.
  return (data ?? []).map((r) => ({
    id: r.id,
    ordine: r.ordine,
    obligatoriu: r.obligatoriu,
    material_id: r.material_id,
    titlu: r.course_materials?.titlu ?? "—",
    fel: r.course_materials?.fel ?? "pdf",
    sursa: r.course_materials?.sursa ?? "fisier",
    treapta_dovada: r.course_materials?.treapta_dovada ?? "bifa",
    are_versiune: (r.course_materials?.versiune_curenta_id ?? null) !== null,
    durata_secunde: r.course_materials?.course_material_versions?.durata_secunde ?? null,
  }));
}

/** Biblioteca pentru constructorul de curs. Plafon 500, sub `max_rows`. */
export async function materialeDisponibile(
  organizationId: string,
): Promise<readonly RandMaterial[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_materials")
    .select(COLOANE_MATERIAL)
    .eq("organization_id", organizationId)
    .eq("activ", true)
    .is("deleted_at", null)
    .order("titlu", { ascending: true })
    .limit(500)
    .returns<RandMaterial[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ═══════════════════════════════════════════════════════════════════════════
// Înrolări
// ═══════════════════════════════════════════════════════════════════════════

export type RandInrolare = Readonly<{
  id: string;
  course_id: string;
  employee_id: string;
  ciclu: number;
  motiv: CursMotiv;
  status: CursStatus;
  atribuit_la: string;
  termen: string | null;
  finalizat_la: string | null;
  expira_la: string | null;
  materiale_total: number;
  materiale_finalizate: number;
  motiv_anulare: string | null;
}>;

const COLOANE_INROLARE =
  "id, course_id, employee_id, ciclu, motiv, status, atribuit_la, termen, finalizat_la, expira_la, materiale_total, materiale_finalizate, motiv_anulare";

export type RezultatInrolari = Readonly<{
  randuri: readonly RandInrolare[];
  urmatorulCursor: string | null;
  total: number;
  sortare: Readonly<{ cheie: SortareInrolari; directie: Directie }>;
}>;

export async function listeazaInrolari(
  organizationId: string,
  filtre: FiltreInrolari,
): Promise<RezultatInrolari> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort ?? null, SORTARI_INROLARI, SORTARE_IMPLICITA_INROLARI);
  const coloana = COLOANA_SORTARE_INROLARE[sortare.cheie];
  const crescator = sortare.directie === "asc";
  const azi = new Date().toISOString().slice(0, 10);

  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
      in: (c: string, v: readonly string[]) => Q;
      lt: (c: string, v: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.status !== null) cu = cu.eq("status", filtre.status);
    if (filtre.angajat !== null) cu = cu.eq("employee_id", filtre.angajat);
    if (filtre.curs !== null) cu = cu.eq("course_id", filtre.curs);
    if (filtre.doar_restante === "da") {
      cu = cu.in("status", ["neinceput", "in_curs"]).lt("termen", azi);
    }
    return cu;
  };

  let interogare = filtreaza(db.from("course_enrollments").select(COLOANE_INROLARE))
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null)
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandInrolare[]>(),
    filtreaza(db.from("course_enrollments").select("id", { count: "exact", head: true })),
  ]);
  if (rezultat.error !== null) throw rezultat.error;
  if (numarare.error !== null) throw numarare.error;

  const toate = rezultat.data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  const valoare =
    ultim === undefined
      ? null
      : sortare.cheie === "stare"
        ? ultim.status
        : sortare.cheie === "angajat"
          ? ultim.employee_id
          : ultim.termen;

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined && valoare !== null
        ? codificaCursor({ valoare, id: ultim.id })
        : null,
    total: numarare.count ?? randuri.length,
    sortare,
  };
}

export async function citesteInrolare(
  organizationId: string,
  id: string,
): Promise<RandInrolare | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_enrollments")
    .select(COLOANE_INROLARE)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandInrolare>();
  if (error !== null) throw error;
  return data;
}

export type RandLectieInrolare = Readonly<{
  id: string;
  ordine: number;
  titlu: string;
  fel: CursMaterialFel;
  obligatoriu: boolean;
  treapta_dovada: CursTreaptaDovada;
  procent_minim: number | null;
  prag_test: number | null;
  declaratie_text: string | null;
  durata_secunde: number | null;
  status: CursItemStatus;
  secunde_vizionate: number;
  pozitie_secunde: number;
  finalizat_la: string | null;
  semnatura_nume: string | null;
  semnat_la: string | null;
  material_id: string;
  version_id: string | null;
}>;

const COLOANE_LECTIE_INROLARE =
  "id, ordine, titlu, fel, obligatoriu, treapta_dovada, procent_minim, prag_test, declaratie_text, durata_secunde, status, secunde_vizionate, pozitie_secunde, finalizat_la, semnatura_nume, semnat_la, material_id, version_id";

export async function lectiileInrolarii(
  organizationId: string,
  enrollmentId: string,
): Promise<readonly RandLectieInrolare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_enrollment_items")
    .select(COLOANE_LECTIE_INROLARE)
    .eq("organization_id", organizationId)
    .eq("enrollment_id", enrollmentId)
    .is("deleted_at", null)
    .order("ordine", { ascending: true })
    .limit(500)
    .returns<RandLectieInrolare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export async function citesteLectieInrolare(
  organizationId: string,
  id: string,
): Promise<RandLectieInrolare | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_enrollment_items")
    .select(COLOANE_LECTIE_INROLARE)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandLectieInrolare>();
  if (error !== null) throw error;
  return data;
}

/**
 * Dovada imutabilă. `course_completion_records` NU are `deleted_at` — un
 * `.is("deleted_at", null)` pe ea dă 42703. Deliberat, ca la
 * `checklist_completion_records`.
 */
export type Dovada = Readonly<{
  id: string;
  enrollment_id: string;
  employee_id: string;
  course_id: string;
  ciclu: number;
  finalizat_la: string;
  expira_la: string | null;
  total_materiale: number;
  materiale_finalizate: number;
  continut: unknown;
  continut_checksum: string;
}>;

export async function dovadaInrolarii(
  organizationId: string,
  enrollmentId: string,
): Promise<Dovada | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_completion_records")
    .select(
      "id, enrollment_id, employee_id, course_id, ciclu, finalizat_la, expira_la, total_materiale, materiale_finalizate, continut, continut_checksum",
    )
    .eq("organization_id", organizationId)
    .eq("enrollment_id", enrollmentId)
    .maybeSingle<Dovada>();
  if (error !== null) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// Portal
// ═══════════════════════════════════════════════════════════════════════════

export type CursulMeu = Readonly<{
  inrolare: RandInrolare;
  denumire: string;
  descriere: string | null;
  obligatoriu: boolean;
  prag_avertizare_zile: number;
}>;

type InrolareCuCurs = RandInrolare &
  Readonly<{
    courses: Readonly<{
      denumire: string;
      descriere: string | null;
      obligatoriu: boolean;
      prag_avertizare_zile: number;
    }> | null;
  }>;

/**
 * Cursurile unei persoane. `employeeId` se trimite EXPLICIT, chiar dacă RLS ar
 * restrânge oricum: un cont cu `courses:read = all` care intră în portal ar
 * vedea altfel toată firma sub „ale mele". Aceeași grijă ca la
 * `/portal/integrarea-mea`.
 *
 * Plafon 200: la volumele reale (cea mai mare firmă are opt angajați) nimeni
 * n-are 200 de cursuri, iar paginarea în portal ar fi zgomot.
 */
export async function cursurileMele(
  organizationId: string,
  employeeId: string,
): Promise<readonly CursulMeu[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_enrollments")
    .select(
      `${COLOANE_INROLARE},
       courses!course_enrollments_course_id_organization_id_fkey (
         denumire, descriere, obligatoriu, prag_avertizare_zile
       )`,
    )
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .neq("status", "anulat")
    .order("termen", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(200)
    .returns<InrolareCuCurs[]>();
  if (error !== null) throw error;

  return (data ?? []).map(({ courses, ...inrolare }) => ({
    inrolare,
    denumire: courses?.denumire ?? "—",
    descriere: courses?.descriere ?? null,
    obligatoriu: courses?.obligatoriu ?? true,
    prag_avertizare_zile: courses?.prag_avertizare_zile ?? 30,
  }));
}

/**
 * Contorul pentru cardul promovat din `/portal`.
 *
 * Numărul vine din ACEEAȘI listă pe care o afișează ecranul, nu dintr-un
 * `count()` separat: o interogare care numără și una care listează diverg
 * întotdeauna, la momentul cel mai prost. Capcana e reală în acest repo —
 * contorul de sarcini de aprobare a afișat „7 de semnat" la nesfârșit.
 */
export function restanteDinCursuri(
  cursuri: readonly CursulMeu[],
  azi: string,
): Readonly<{ deFacut: number; celMaiApropiatTermen: string | null }> {
  const deschise = cursuri.filter(
    (c) => c.inrolare.status === "neinceput" || c.inrolare.status === "in_curs",
  );
  const termene = deschise
    .map((c) => c.inrolare.termen)
    .filter((t): t is string => t !== null)
    .sort();
  return {
    deFacut: deschise.length,
    celMaiApropiatTermen: termene.find((t) => t >= azi) ?? termene[0] ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Stadiu și conformitate
// ═══════════════════════════════════════════════════════════════════════════

export type StadiuAngajat = Readonly<{
  employee_id: string;
  nume: string;
  inrolare: RandInrolare | null;
}>;

/** Angajații activi, pentru ecranul de atribuire. Plafon 500, sub `max_rows`. */
export type AngajatOptiune = Readonly<{
  id: string;
  nume: string;
  department_id: string | null;
  job_position_id: string | null;
}>;

type AngajatBrut = Readonly<{
  id: string;
  nume: string | null;
  prenume: string | null;
  department_id: string | null;
  job_position_id: string | null;
}>;

export async function angajatiPentruAtribuire(
  organizationId: string,
): Promise<readonly AngajatOptiune[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, nume, prenume, department_id, job_position_id")
    .eq("organization_id", organizationId)
    .in("status", ["activ", "suspendat", "preaviz"])
    .is("deleted_at", null)
    .order("nume", { ascending: true })
    .limit(500)
    .returns<AngajatBrut[]>();
  if (error !== null) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    nume: [a.nume, a.prenume].filter(Boolean).join(" ") || "—",
    department_id: a.department_id,
    job_position_id: a.job_position_id,
  }));
}

/** Numele angajaților dintr-o listă de identificatori, pentru afișare în tabele. */
export async function numeAngajati(
  organizationId: string,
  ids: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (ids.length === 0) return new Map();
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, nume, prenume")
    .eq("organization_id", organizationId)
    .in("id", [...new Set(ids)].slice(0, 500))
    .returns<AngajatBrut[]>();
  if (error !== null) throw error;
  return new Map(
    (data ?? []).map((a) => [a.id, [a.nume, a.prenume].filter(Boolean).join(" ") || "—"]),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Testul grilă (0077)
// ═══════════════════════════════════════════════════════════════════════════

export type OptiuneIntrebare = Readonly<{ id: string; text: string }>;
export type IntrebareAfisata = Readonly<{
  id: string;
  text: string;
  optiuni: readonly OptiuneIntrebare[];
}>;

/**
 * Întrebările unei versiuni, așa cum le vede ANGAJATUL: fără răspunsul corect.
 *
 * Cheia stă în `course_answer_keys`, tabelă fără nicio politică pentru rolul
 * angajatului. Funcția asta nu o atinge deloc — nici măcar nu o poate atinge.
 */
export async function intrebarileVersiunii(
  organizationId: string,
  versionId: string,
): Promise<readonly IntrebareAfisata[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_material_versions")
    .select("intrebari")
    .eq("organization_id", organizationId)
    .eq("id", versionId)
    .is("deleted_at", null)
    .maybeSingle<{ intrebari: unknown }>();
  if (error !== null) throw error;

  const brute = data?.intrebari;
  if (!Array.isArray(brute)) return [];
  return brute.flatMap((i): readonly IntrebareAfisata[] => {
    if (typeof i !== "object" || i === null) return [];
    const o = i as Record<string, unknown>;
    if (typeof o["id"] !== "string" || typeof o["text"] !== "string") return [];
    const optiuni = Array.isArray(o["optiuni"])
      ? o["optiuni"].flatMap((v): readonly OptiuneIntrebare[] => {
          if (typeof v !== "object" || v === null) return [];
          const p = v as Record<string, unknown>;
          return typeof p["id"] === "string" && typeof p["text"] === "string"
            ? [{ id: p["id"], text: p["text"] }]
            : [];
        })
      : [];
    return [{ id: o["id"], text: o["text"], optiuni }];
  });
}

export type CheieRaspuns = Readonly<Record<string, string>>;

/** Cheia de răspuns, pentru constructorul de test. RLS o dă doar la `team`+. */
export async function cheiaVersiunii(
  organizationId: string,
  versionId: string,
): Promise<CheieRaspuns> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_answer_keys")
    .select("chei")
    .eq("organization_id", organizationId)
    .eq("version_id", versionId)
    .maybeSingle<{ chei: unknown }>();
  if (error !== null) throw error;
  const brute = data?.chei;
  if (typeof brute !== "object" || brute === null) return {};
  const rezultat: Record<string, string> = {};
  for (const [k, v] of Object.entries(brute as Record<string, unknown>)) {
    if (typeof v === "string") rezultat[k] = v;
  }
  return rezultat;
}

export type Incercare = Readonly<{
  id: string;
  numar: number;
  scor: number;
  promovat: boolean;
  trimis_la: string;
}>;

export async function incercarileLectiei(
  organizationId: string,
  enrollmentItemId: string,
): Promise<readonly Incercare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_quiz_attempts")
    .select("id, numar, scor, promovat, trimis_la")
    .eq("organization_id", organizationId)
    .eq("enrollment_item_id", enrollmentItemId)
    .order("numar", { ascending: false })
    .limit(100)
    .returns<Incercare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ═══════════════════════════════════════════════════════════════════════════
// Reguli de atribuire (0078)
// ═══════════════════════════════════════════════════════════════════════════

export type RandRegula = Readonly<{
  id: string;
  course_id: string;
  criteriu: CursCriteriu;
  department_id: string | null;
  job_position_id: string | null;
  rol: string | null;
  employee_id: string | null;
  decalaj_zile: number;
  termen_zile: number | null;
  activ: boolean;
}>;

export async function regulileCursului(
  organizationId: string,
  courseId: string,
): Promise<readonly RandRegula[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("course_assignment_rules")
    .select(
      "id, course_id, criteriu, department_id, job_position_id, rol, employee_id, decalaj_zile, termen_zile, activ",
    )
    .eq("organization_id", organizationId)
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200)
    .returns<RandRegula[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export type OptiuneDenumita = Readonly<{ id: string; denumire: string }>;

/** Departamente și funcții, pentru selectoarele regulii. Plafon 300 fiecare. */
export async function tinteRegula(
  organizationId: string,
): Promise<
  Readonly<{ departamente: readonly OptiuneDenumita[]; functii: readonly OptiuneDenumita[] }>
> {
  const db = await createServerSupabase();
  const [dep, fun] = await Promise.all([
    db
      .from("departments")
      .select("id, denumire")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("denumire", { ascending: true })
      .limit(300)
      .returns<OptiuneDenumita[]>(),
    db
      .from("job_positions")
      .select("id, denumire")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("denumire", { ascending: true })
      .limit(300)
      .returns<OptiuneDenumita[]>(),
  ]);
  if (dep.error !== null) throw dep.error;
  if (fun.error !== null) throw fun.error;
  return { departamente: dep.data ?? [], functii: fun.data ?? [] };
}

// ═══════════════════════════════════════════════════════════════════════════
// Matricea de conformitate
// ═══════════════════════════════════════════════════════════════════════════

export type CelulaConformitate = Readonly<{
  status: CursStatus | null;
  termen: string | null;
  expiraLa: string | null;
  pragAvertizareZile: number;
}>;

export type MatriceConformitate = Readonly<{
  angajati: readonly AngajatOptiune[];
  cursuri: readonly Readonly<{ id: string; denumire: string; prag_avertizare_zile: number }>[];
  /** Cheia e `${employeeId}|${courseId}`. Absența înseamnă „neatribuit”. */
  celule: ReadonlyMap<string, CelulaConformitate>;
}>;

export function cheieCelula(employeeId: string, courseId: string): string {
  return `${employeeId}|${courseId}`;
}

/**
 * Matricea angajat × curs obligatoriu.
 *
 * Plafonată la 100 de angajați și 50 de cursuri: peste asta, un tabel de
 * 5000 de celule nu mai e un ecran, e un export. La volumele reale (cea mai
 * mare firmă are opt angajați) matricea încape întreagă, fără derulare.
 */
export async function matriceConformitate(organizationId: string): Promise<MatriceConformitate> {
  const db = await createServerSupabase();
  const [angajati, cursuriRes] = await Promise.all([
    angajatiPentruAtribuire(organizationId),
    db
      .from("courses")
      .select("id, denumire, prag_avertizare_zile")
      .eq("organization_id", organizationId)
      .eq("obligatoriu", true)
      .eq("publicat", true)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire", { ascending: true })
      .limit(50)
      .returns<{ id: string; denumire: string; prag_avertizare_zile: number }[]>(),
  ]);
  if (cursuriRes.error !== null) throw cursuriRes.error;
  const cursuri = cursuriRes.data ?? [];

  const celule = new Map<string, CelulaConformitate>();
  if (angajati.length === 0 || cursuri.length === 0) {
    return { angajati: angajati.slice(0, 100), cursuri, celule };
  }

  const pragPeCurs = new Map(cursuri.map((c) => [c.id, c.prag_avertizare_zile]));
  const { data, error } = await db
    .from("course_enrollments")
    .select("employee_id, course_id, status, termen, expira_la, ciclu")
    .eq("organization_id", organizationId)
    .in(
      "course_id",
      cursuri.map((c) => c.id),
    )
    .is("deleted_at", null)
    .neq("status", "anulat")
    // Ciclul cel mai mare primul: pentru un curs recertificat, celula trebuie
    // să arate parcursul CURENT, nu pe cel de anul trecut.
    .order("ciclu", { ascending: false })
    .limit(1000)
    .returns<
      {
        employee_id: string;
        course_id: string;
        status: CursStatus;
        termen: string | null;
        expira_la: string | null;
      }[]
    >();
  if (error !== null) throw error;

  for (const rand of data ?? []) {
    const cheie = cheieCelula(rand.employee_id, rand.course_id);
    // Primul rând întâlnit e cel cu ciclul cel mai mare, deci se păstrează.
    if (celule.has(cheie)) continue;
    celule.set(cheie, {
      status: rand.status,
      termen: rand.termen,
      expiraLa: rand.expira_la,
      pragAvertizareZile: pragPeCurs.get(rand.course_id) ?? 30,
    });
  }

  return { angajati: angajati.slice(0, 100), cursuri, celule };
}
