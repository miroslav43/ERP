// src/lib/queries/departments.ts
// Citirile structurii organizatorice: departamentele și angajații lor.

import "server-only";

import type { PermissionScope } from "@/config/permissions";
import { createServerSupabase } from "@/lib/supabase/server";

import { citesteTot } from "./citeste-tot";

/**
 * Citirile de departamente, în sfârșit într-un loc.
 *
 * Până acum `.from("departments")` apărea în trei module de citiri și opt
 * pagini, iar `/angajati` își lua lista din `queries/attendance.ts` — cu un
 * comentariu care recunoștea că nu e locul ei. Ecranul de structură își scria
 * SQL-ul direct în `page.tsx`.
 *
 * ── DE CE `citesteTot` ȘI NU O LIMITĂ DECLARATĂ ───────────────────────────
 * `job-positions.ts` alege cealaltă cale — o limită proprie plus un steag
 * `trunchiat` care urcă până în `<Tabel>` — și are dreptate acolo: nomenclatorul
 * se afișează într-un tabel care poate desena marcajul de tăiere.
 *
 * Aici criteriul din documentația lui `citesteTot` cade pe partea cealaltă:
 * trunchierea e invizibilă exact unde nu există „mai departe". Ecranul de
 * structură NU paginează — arată tot arborele deodată și numără angajații pe
 * fiecare nod. La `max_rows = 1000` PostgREST taie tăcut, iar consecința nu e o
 * listă mai scurtă, ci CIFRE GREȘITE: pastilele de efectiv arată mai puțin, iar
 * un departament plin poate afișa „Departament gol".
 *
 * Mai rău, pentru departamente tăierea deformează ierarhia însăși: un nod al
 * cărui părinte a rămas afară urcă la rădăcină, deci ecranul desenează o
 * structură plauzibilă și falsă. `citesteTot` paginează cu cursor keyset și
 * ARUNCĂ la plafon, în loc să taie.
 */

export interface RandDepartament {
  readonly id: string;
  readonly parent_id: string | null;
  readonly cod: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly activ: boolean;
  readonly manager_employee_id: string | null;
  readonly cost_center: string | null;
  readonly manager: Readonly<{ full_name: string; user_id: string | null }> | null;
}

export interface AngajatStructura {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly department_id: string | null;
  readonly user_id: string | null;
  /** `candidat` | `activ` | `suspendat` | `preaviz` | `incetat` | `arhivat`. */
  readonly status: string;
  readonly job_position: Readonly<{ denumire: string }> | null;
}

const COLOANE_DEPARTAMENT =
  "id, parent_id, cod, denumire, descriere, activ, manager_employee_id, cost_center, manager:employees!manager_employee_id(full_name, user_id)";

const COLOANE_ANGAJAT =
  "id, full_name, marca, department_id, user_id, status, job_position:job_positions!job_position_id(denumire)";

export async function structuraDepartamentelor(
  organizationId: string,
): Promise<readonly RandDepartament[]> {
  const db = await createServerSupabase();
  return citesteTot<RandDepartament>(
    (dupa, pas) => {
      const q = db
        .from("departments")
        .select(COLOANE_DEPARTAMENT)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .limit(pas);
      return (dupa === null ? q : q.gt("id", dupa)).returns<RandDepartament[]>();
    },
    (rand) => rand.id,
    { nume: "structura departamentelor" },
  );
}

/**
 * Angajații organizației, cu departamentul lor.
 *
 * ── DE CE NU DOAR CEI ACTIVI ──────────────────────────────────────────────
 * Prima variantă filtra `status = 'activ'`, și crea un blocaj: un angajat
 * `suspendat` sau `candidat` repartizat undeva NU apărea pe ecran, dar
 * `dezactiveazaDepartament` îl numără (el filtrează doar `deleted_at is null`,
 * fără status). Rezultatul era un departament care arăta gol, refuza
 * dezactivarea cu „Mutați-i în altă structură”, iar persoana de mutat nu se
 * putea găsi nicăieri în interfață — exact fundătura pe care `mutaAngajati` a
 * fost construită s-o închidă.
 *
 * Deci se aduc toți, cu `status`, iar ecranul decide: efectivul numără doar
 * activii, lista din panou îi arată pe toți, cu statusul marcat.
 *
 * Întoarce ȘI angajații cu `department_id = null` — nerepartizații. Ecranul îi
 * arăta zero, fiindcă gruparea îi sărea; erau invizibili exact pe pagina de la
 * care ai nevoie să-i vezi, și tot ei sunt cei pe care `dezactiveazaDepartament`
 * îți cere să-i muți înainte de a închide un departament.
 *
 * Restrângerea de scope repetă tiparul din `arboreleManagerial`: `own` se uită
 * la propria fișă, `team` la subarborele managerial (`manager_path`), `all` la
 * tot. Atenție la o confuzie ușoară: `team` NU înseamnă „departamentul meu" —
 * scope-ul se rezolvă peste tot pe `manager_path`, niciodată pe `department_id`.
 *
 * Ordinea e pe `id`, nu pe nume, fiindcă e cheia keyset a paginării; sortarea
 * pentru ecran se face în pagină, după ce lista e completă.
 */
export async function angajatiPentruStructura(
  organizationId: string,
  scope: PermissionScope,
  propriaFisaId: string | null,
): Promise<readonly AngajatStructura[]> {
  if (scope === "none") return [];
  // Fără fișă proprie, `own` și `team` n-au ancoră: orice altceva ar întoarce
  // mai mult decât are voie apelantul.
  if (scope !== "all" && propriaFisaId === null) return [];

  const db = await createServerSupabase();
  return citesteTot<AngajatStructura>(
    (dupa, pas) => {
      let q = db
        .from("employees")
        .select(COLOANE_ANGAJAT)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .limit(pas);
      if (scope === "own") q = q.eq("id", propriaFisaId as string);
      if (scope === "team") q = q.contains("manager_path", [propriaFisaId as string]);
      return (dupa === null ? q : q.gt("id", dupa)).returns<AngajatStructura[]>();
    },
    (rand) => rand.id,
    { nume: "angajații structurii" },
  );
}
