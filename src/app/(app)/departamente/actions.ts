// src/app/(app)/departamente/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { businessRule, mapPostgrestError, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { createServerSupabase } from "@/lib/supabase/server";
import { decideApartenentaManagerului } from "@/domain/departments/manager-membru";
import {
  aplicaRolurile,
  aplicaSubordonarea,
  decideSchimbareaSefului,
  type ContextSef,
} from "@/lib/departamente/sef";
import type { ActionContext } from "@/lib/actions/types";
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
  "muta_managerul_in_departament",
] as const;

const CAMPURI_AUDITATE_ACTUALIZARE = [
  "denumire",
  "descriere",
  "parent_id",
  "manager_employee_id",
  "cost_center",
  // Consimțământul se auditează: el explică de ce cineva a plecat dintr-un
  // departament la o salvare care, în rest, schimba doar o denumire.
  "muta_managerul_in_departament",
] as const;

/**
 * Departamentul în care e repartizat ACUM angajatul ales ca manager.
 *
 * Se citește ÎNAINTE de scrierea pe `departments`, și nu din comoditate: după
 * UPDATE, `manager_employee_id` e deja cel nou, iar de unde vine omul n-ar mai
 * fi de aflat decât din jurnal.
 */
async function departamentulManagerului(
  ctx: ActionContext,
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  managerId: string | null,
): Promise<string | null> {
  if (managerId === null) return null;
  const { data, error } = await db
    .from("employees")
    .select("department_id")
    .eq("id", managerId)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw mapPostgrestError(error, ctx.requestId);
  // Nu e o verificare de prisos: `departments.manager_employee_id` ARE trigger de
  // organizație (0004_hr.sql), dar o fișă ștearsă logic între alegerea din
  // listă și apăsarea butonului ar trece de el.
  if (data === null) throw notFound("Angajatul ales ca manager nu a fost găsit.");
  return data.department_id;
}

/**
 * Repartizarea managerului în departamentul pe care tocmai l-a primit.
 *
 * Regula stă în `@/domain/departments/manager-membru`, testată separat. Aici
 * rămâne doar scrierea — și cele două lucruri pe care le poate face greșit:
 *
 * 1. `.select()` după `.update()`. `employees_update` refuză prin `USING` cu
 *    ZERO RÂNDURI ȘI FĂRĂ EROARE. Fără el, un refuz ar fi raportat drept
 *    reușită, iar omul ar rămâne exact cu defectul pe care îl repară funcția.
 * 2. Mesajul spune CE S-A SCRIS DEJA. Departamentul e salvat înaintea acestei
 *    scrieri, iar PostgREST nu deschide o tranzacție peste două cereri: „a
 *    eșuat" ar fi o minciună despre rândul deja scris.
 */
async function repartizeazaManagerul(
  ctx: ActionContext,
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  departamentId: string,
  decizie: ReturnType<typeof decideApartenentaManagerului>,
  ceEsteDejaScris: string,
): Promise<void> {
  if (decizie.fel === "nimic") return;

  const { data, error } = await db
    .from("employees")
    .update({ department_id: departamentId, updated_by: ctx.user.id })
    .eq("id", decizie.employeeId)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error !== null) throw mapPostgrestError(error, ctx.requestId);
  if (data === null) {
    throw businessRule(
      `${ceEsteDejaScris}, dar managerul nu a putut fi repartizat în el: fișa lui a fost ștearsă între timp sau nu aveți dreptul de a o modifica. Repartizați-l din panoul departamentului.`,
    );
  }
}

/**
 * Contextul regulii „șef de departament ⇒ rol de manager".
 *
 * `autorEsteAdministrator` se ia din ROLUL apelantului, nu din permisiuni, și nu
 * din prudență: `organization_members_update` cere `app.has_role(org,
 * ['org_admin'])`. Un `hr` are `departments:update = all`, deci ajunge până aici
 * cu drepturi depline asupra structurii — și niciunul asupra rolurilor.
 */
function contextSef(
  ctx: ActionContext,
  db: Awaited<ReturnType<typeof createServerSupabase>>,
): ContextSef {
  return {
    db,
    organizationId: ctx.tenant.organizationId,
    requestId: ctx.requestId,
    userId: ctx.user.id,
    memberIdAutor: ctx.tenant.memberId,
    autorEsteAdministrator: ctx.tenant.role === "org_admin",
  };
}

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
    // `muta_managerul_in_departament` NU e o coloană a tabelei: e consimțământ,
    // nu date. Lăsat în spread, PostgREST ar respinge inserarea cu PGRST204.
    const { muta_managerul_in_departament: mutaManagerul, ...campuri } = input;

    const departamentulLui = await departamentulManagerului(ctx, db, campuri.manager_employee_id);

    const { data, error } = await db
      .from("departments")
      .insert({
        ...campuri,
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

    await repartizeazaManagerul(
      ctx,
      db,
      data.id,
      decideApartenentaManagerului({
        managerId: campuri.manager_employee_id,
        departamentId: data.id,
        // Un departament proaspăt creat e `activ: true` prin construcție.
        departamentActiv: true,
        departamentulManagerului: departamentulLui,
        mutaDinAltDepartament: mutaManagerul,
      }),
      "Departamentul a fost creat",
    );

    // Rolul, dar NU subordonarea: un departament proaspăt creat n-are pe cine să
    // pună în subordinea șefului. Singurul om din el e chiar el, dacă tocmai a
    // fost repartizat mai sus.
    const contextul = contextSef(ctx, db);
    await aplicaRolurile(
      contextul,
      await decideSchimbareaSefului(contextul, {
        sefAnteriorId: null,
        sefNouId: campuri.manager_employee_id,
        departamentId: data.id,
      }),
      "Departamentul a fost creat",
    );

    return { id: data.id };
  },
  /** Vezi nota de la `actualizeazaDepartament`: managerul poate fi repartizat aici. */
  revalidate: ["/departamente", "/angajati", "/organigrama"],
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
    // Ca la creare: consimțământul nu e o coloană a tabelei.
    const { id, muta_managerul_in_departament: mutaManagerul, ...campuri } = input;

    const departamentulLui = await departamentulManagerului(ctx, db, campuri.manager_employee_id);

    // Cine conducea ÎNAINTE. Se citește acum sau niciodată: după UPDATE coloana
    // are deja valoarea nouă, iar fostul șef — cel pe care regula îl retrogradează
    // — n-ar mai fi de aflat decât din jurnal.
    const inainte = await db
      .from("departments")
      .select("manager_employee_id")
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (inainte.error !== null) throw mapPostgrestError(inainte.error, ctx.requestId);
    const sefAnteriorId = inainte.data?.manager_employee_id ?? null;

    // `activ` se cere ÎN `.select()`, nu printr-o citire separată: e valoarea de
    // după scriere, singura pe care regula are voie să se sprijine. `parent_id`
    // la fel — subordonarea ridică șeful sub șeful părinte, iar părintele poate
    // fi tocmai ce s-a schimbat la această salvare.
    const { data, error } = await db
      .from("departments")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, activ, parent_id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) throw notFound("Departamentul nu a fost găsit.");

    await repartizeazaManagerul(
      ctx,
      db,
      id,
      decideApartenentaManagerului({
        managerId: campuri.manager_employee_id,
        departamentId: id,
        departamentActiv: data.activ,
        departamentulManagerului: departamentulLui,
        mutaDinAltDepartament: mutaManagerul,
      }),
      "Departamentul a fost salvat",
    );

    const sefNouId = campuri.manager_employee_id;
    const contextul = contextSef(ctx, db);
    await aplicaRolurile(
      contextul,
      await decideSchimbareaSefului(contextul, {
        sefAnteriorId,
        sefNouId,
        departamentId: id,
      }),
      "Departamentul a fost salvat",
    );

    // Subordonarea NU e condiționată de rolul autorului, spre deosebire de
    // scrierea rolului: `employees_update` cere `employees:update`, pe care `hr`
    // îl are la `all`. HR-ul construiește structura chiar dacă drepturile le dă
    // altcineva — organigrama iese corectă, doar rolul rămâne de acordat.
    if (sefNouId !== null && sefNouId !== sefAnteriorId) {
      await aplicaSubordonarea(
        contextul,
        { departamentId: id, sefId: sefNouId, parentId: data.parent_id },
        "Departamentul a fost salvat",
      );
    }

    return { id };
  },
  /**
   * Declarat, nu chemat din handler: repartizarea managerului scrie pe FIȘA
   * lui, deci se învechesc și listele de angajați, și organigrama — la fel ca
   * la `mutaAngajati`, mai jos. Forma declarativă rulează după succesul complet
   * al acțiunii, inclusiv după scrierea jurnalului.
   */
  revalidate: ["/departamente", "/angajati", "/organigrama"],
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
      // `manager_employee_id` se ia din chiar rândul scris: dezactivarea nu-l
      // golește (vezi `manager-membru.ts`), deci valoarea de după UPDATE e tot
      // cine conducea. O citire separată ar fi fost o interogare în plus pentru
      // exact aceeași informație.
      .select("id, manager_employee_id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (departamentDezactivat === null) {
      throw businessRule(
        "Departamentul nu a fost dezactivat: a fost șters între timp sau nu aveți dreptul de a modifica structura organizatorică. Reîncărcați pagina.",
      );
    }

    // Un departament închis nu mai e condus de nimeni: cine îl conducea și n-a
    // rămas șef nicăieri altundeva se întoarce la rolul de angajat.
    const contextul = contextSef(ctx, db);
    await aplicaRolurile(
      contextul,
      await decideSchimbareaSefului(contextul, {
        sefAnteriorId: departamentDezactivat.manager_employee_id,
        sefNouId: null,
        departamentId: input.id,
      }),
      "Departamentul a fost dezactivat",
    );

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
      .select("id, manager_employee_id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (reactivat === null) {
      throw businessRule(
        "Departamentul nu a fost reactivat: a fost șters între timp sau nu aveți dreptul de a modifica structura organizatorică. Reîncărcați pagina.",
      );
    }

    // Simetric cu dezactivarea. Fără ramura asta, un departament închis și
    // redeschis din greșeală și-ar recăpăta șeful pe card, dar nu și drepturile
    // lui — iar diferența n-ar fi vizibilă nicăieri.
    const contextul = contextSef(ctx, db);
    await aplicaRolurile(
      contextul,
      await decideSchimbareaSefului(contextul, {
        sefAnteriorId: null,
        sefNouId: reactivat.manager_employee_id,
        departamentId: input.id,
      }),
      "Departamentul a fost reactivat",
    );

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
        .select("id, activ")
        .eq("id", input.department_id)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("deleted_at", null)
        .maybeSingle();
      if (eroareDepartament !== null) throw mapPostgrestError(eroareDepartament, ctx.requestId);
      if (departament === null) throw notFound("Departamentul selectat nu a fost găsit.");
      // Un departament dezactivat nu primește oameni. Altfel regula de mai sus
      // s-ar contrazice singură: `dezactiveazaDepartament` refuză închiderea
      // până când departamentul e gol, iar imediat după ce reușești l-ai putea
      // repopula fără niciun avertisment — dezactivarea n-ar mai însemna nimic.
      if (!departament.activ) {
        throw businessRule(
          "Departamentul selectat este dezactivat. Reactivați-l înainte de a repartiza persoane în el.",
        );
      }
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
