// src/app/(app)/departamente/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { businessRule, mapPostgrestError, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaDepartamentSchema,
  creeazaDepartamentSchema,
  dezactiveazaDepartamentSchema,
  mutaDepartamentSchema,
} from "@/schemas/department";
import { mutaAngajatiSchema } from "@/schemas/employee";

type DepartamentIdentificat = Readonly<{ id: string }>;

const CAMPURI_AUDITATE_CREARE = [
  "cod",
  "denumire",
  "descriere",
  "parent_id",
  "manager_employee_id",
  "cost_center",
] as const;

const CAMPURI_AUDITATE_ACTUALIZARE = [
  "denumire",
  "descriere",
  "parent_id",
  "manager_employee_id",
  "cost_center",
] as const;

export const creeazaDepartament = createAction<
  typeof creeazaDepartamentSchema,
  DepartamentIdentificat
>({
  name: "departments.create",
  permission: "departments:create",
  minScope: "all",
  input: creeazaDepartamentSchema,
  audit: {
    action: "create",
    entityType: "departments",
    entityId: (_input, data) => data.id,
    allow: CAMPURI_AUDITATE_CREARE,
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("departments")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        activ: true,
        path: [],
        depth: 0,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    revalidatePath("/departamente");
    return { id: data.id };
  },
});

export const actualizeazaDepartament = createAction<
  typeof actualizeazaDepartamentSchema,
  DepartamentIdentificat
>({
  name: "departments.update",
  permission: "departments:update",
  minScope: "all",
  input: actualizeazaDepartamentSchema,
  audit: {
    action: "update",
    entityType: "departments",
    entityId: (input) => input.id,
    allow: CAMPURI_AUDITATE_ACTUALIZARE,
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;
    const { data, error } = await db
      .from("departments")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) throw notFound("Departamentul nu a fost găsit.");
    revalidatePath("/departamente");
    return { id };
  },
});

export const mutaDepartament = createAction<typeof mutaDepartamentSchema, DepartamentIdentificat>({
  name: "departments.move",
  permission: "departments:update",
  minScope: "all",
  input: mutaDepartamentSchema,
  audit: {
    action: "update",
    entityType: "departments",
    entityId: (input) => input.id,
    allow: ["parent_id"],
  },
  handler: async (ctx, input) => {
    if (input.parent_id === input.id) {
      throw businessRule("Un departament nu poate fi subordonat lui însuși.");
    }
    const db = await createServerSupabase();
    // Ciclurile și adâncimea sunt respinse de trigger-ul tg_departments_path (P0001).
    const { data, error } = await db
      .from("departments")
      .update({ parent_id: input.parent_id, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) throw notFound("Departamentul nu a fost găsit.");
    revalidatePath("/departamente");
    return { id: input.id };
  },
});

export const dezactiveazaDepartament = createAction<
  typeof dezactiveazaDepartamentSchema,
  DepartamentIdentificat
>({
  name: "departments.deactivate",
  permission: "departments:update",
  minScope: "all",
  input: dezactiveazaDepartamentSchema,
  audit: {
    action: "update",
    entityType: "departments",
    entityId: (input) => input.id,
    allow: [],
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { count, error: eroareAngajati } = await db
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("department_id", input.id)
      .is("deleted_at", null);
    if (eroareAngajati !== null) throw mapPostgrestError(eroareAngajati, ctx.requestId);
    if ((count ?? 0) > 0) {
      throw businessRule(
        "Departamentul are angajați alocați. Mutați-i în altă structură înainte de dezactivare.",
      );
    }

    // Numărătoarea de angajați de mai sus e o citire separată de scrierea asta:
    // între cele două, altcineva poate muta un angajat în departament sau îl
    // poate șterge logic. Iar `departments_update` cere în `USING` și
    // `departments:update = all` și `deleted_at is null` — refuzul e zero
    // rânduri, fără eroare, deci fără `.select()` ecranul ar anunța
    // dezactivarea unui departament rămas activ.
    const { data: departamentDezactivat, error } = await db
      .from("departments")
      .update({ activ: false, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (departamentDezactivat === null) {
      throw businessRule(
        "Departamentul nu a fost dezactivat: a fost șters între timp sau nu aveți dreptul de a modifica structura organizatorică. Reîncărcați pagina.",
      );
    }
    revalidatePath("/departamente");
    return { id: input.id };
  },
});

/**
 * Reactivarea unui departament dezactivat.
 *
 * ── DE CE E NOUĂ ──────────────────────────────────────────────────────────
 * `activ: true` apărea într-un singur loc în tot modulul: la CREARE. Un
 * departament dezactivat din greșeală nu se mai putea readuce din interfață
 * deloc — singura ieșire era un UPDATE scris de mână în bază. Aceeași fundătură
 * exista și la funcții.
 *
 * Nu e simetrică perfect cu dezactivarea, și e bine că nu e: dezactivarea
 * refuză un departament cu angajați alocați, fiindcă i-ar lăsa fără structură.
 * Reactivarea n-are ce refuza — un departament activ cu zero angajați e o stare
 * legitimă, chiar cea de dinaintea primei angajări.
 */
export const reactiveazaDepartament = createAction<
  typeof dezactiveazaDepartamentSchema,
  DepartamentIdentificat
>({
  name: "departments.reactivate",
  permission: "departments:update",
  minScope: "all",
  input: dezactiveazaDepartamentSchema,
  audit: {
    action: "update",
    entityType: "departments",
    entityId: (input) => input.id,
    allow: [],
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    // Aceeași grijă ca la dezactivare: `departments_update` cere în `USING`
    // `departments:update = all` și `deleted_at is null`, iar refuzul e zero
    // rânduri fără eroare.
    const { data: reactivat, error } = await db
      .from("departments")
      .update({ activ: true, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (reactivat === null) {
      throw businessRule(
        "Departamentul nu a fost reactivat: a fost șters între timp sau nu aveți dreptul de a modifica structura organizatorică. Reîncărcați pagina.",
      );
    }
    revalidatePath("/departamente");
    return { id: input.id };
  },
});

/**
 * Mutarea persoanelor între departamente.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * `dezactiveazaDepartament`, mai sus în acest fișier, refuză cu mesajul
 * „Mutați-i în altă structură înainte de dezactivare". Până acum, unealta la
 * care trimitea mesajul nu exista nicăieri în aplicație: singura cale de a
 * schimba departamentul cuiva era formularul complet al fișei, deschis pentru
 * fiecare om în parte.
 *
 * ── CINCI DECIZII CARE NU SE VĂD DIN SEMNĂTURĂ ────────────────────────────
 * 1. Schemă îngustă, două câmpuri. NU `actualizeazaAngajatSchema`, care are 36
 *    de câmpuri cu `.default(...)` și ar goli fișa dintr-un payload parțial.
 *    Motivul lung stă lângă `mutaAngajatiSchema`, în `@/schemas/employee`.
 * 2. `minScope: "all"`, nu `"team"`. `actualizeazaAngajat` are azi `"team"`
 *    deși pagina lui cere `"all"` — deci e invocabilă direct, ca endpoint POST,
 *    de cineva care n-a văzut niciodată ecranul. Discrepanța nu se repetă aici.
 * 3. Departamentul-țintă se verifică EXPLICIT că e al organizației.
 *    `employees.department_id` e o cheie străină simplă, fără componentă pe
 *    `organization_id` și fără trigger — spre deosebire de
 *    `departments.parent_id` și `departments.manager_employee_id`, care AU
 *    verificarea, în aceeași migrare. E singura relație din trio-ul HR pe care
 *    baza n-o păzește, deci o păzim aici.
 * 4. `.select("id")` după `.update()`, cu lungimea comparată. Politica
 *    `employees_update` refuză prin `USING` cu ZERO RÂNDURI ȘI FĂRĂ EROARE; la
 *    o mutare în masă, un refuz parțial ar fi raportat altfel drept reușită
 *    deplină.
 * 5. Un refuz parțial NU se poate anula: PostgREST nu deschide o tranzacție
 *    peste două cereri. Mesajul spune deci exact ce s-a întâmplat, cu cifre —
 *    nu „a eșuat", ceea ce ar fi o minciună despre rândurile deja scrise.
 *
 * `revalidate:` se DECLARĂ aici, spre deosebire de acțiunile de mai sus din
 * fișier, care cheamă `revalidatePath()` din handler. Tiparul canonic e cel
 * declarativ: revalidarea se execută după succesul complet al acțiunii,
 * inclusiv după scrierea jurnalului, nu înaintea lui.
 */
export const mutaAngajati = createAction<typeof mutaAngajatiSchema, { mutati: number }>({
  name: "employees.move_department",
  permission: "employees:update",
  minScope: "all",
  input: mutaAngajatiSchema,
  audit: {
    action: "update",
    entityType: "employee",
    // Auditul aplicației scrie un rând pe acțiune, deci reține doar prima fișă.
    // Reconstituirea per persoană vine din triggerul `audit_employees` de pe
    // tabelă, care scrie rândul întreg before+after pentru fiecare angajat atins.
    entityId: (input) => input.employee_ids[0] ?? "",
    allow: ["employee_ids", "department_id"],
  },
  // `/organigrama` afișează departamentul fiecărui nod, deci se învechește și ea.
  revalidate: ["/departamente", "/angajati", "/organigrama"],
  handler: async (ctx, input) => {
    const db = await createServerSupabase();

    if (input.department_id !== null) {
      const { data: departament, error: eroareDepartament } = await db
        .from("departments")
        .select("id")
        .eq("id", input.department_id)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("deleted_at", null)
        .maybeSingle();
      if (eroareDepartament !== null) throw mapPostgrestError(eroareDepartament, ctx.requestId);
      if (departament === null) throw notFound("Departamentul selectat nu a fost găsit.");
    }

    const { data, error } = await db
      .from("employees")
      .update({ department_id: input.department_id, updated_by: ctx.user.id })
      .in("id", input.employee_ids)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id");
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);

    const mutati = data?.length ?? 0;
    if (mutati !== input.employee_ids.length) {
      throw businessRule(
        `Au fost mutate ${String(mutati)} din ${String(input.employee_ids.length)} persoane. Restul au fost refuzate: fișele au fost șterse între timp sau nu aveți dreptul de a le modifica. Reîncărcați pagina.`,
      );
    }

    return { mutati };
  },
});
