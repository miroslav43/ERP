// src/app/(app)/functii/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { businessRule, mapPostgrestError, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaFunctieSchema,
  atribuieAngajatiSchema,
  creeazaFunctieSchema,
  dezactiveazaFunctieSchema,
} from "@/schemas/job-position";

type FunctieIdentificata = Readonly<{ id: string }>;

const CAMPURI_AUDITATE_CREARE = [
  "cod",
  "denumire",
  "cod_cor",
  "nivel_studii",
  "descriere",
] as const;
const CAMPURI_AUDITATE_ACTUALIZARE = ["denumire", "cod_cor", "nivel_studii", "descriere"] as const;

// RLS pe job_positions (0005_hr_rls.sql) verifică resursa 'departments', nu
// una nouă — la fel ca la puncte_lucru: structura organizatorică e o singură
// resursă de permisiuni, indiferent de tabela concretă.
export const creeazaFunctie = createAction<typeof creeazaFunctieSchema, FunctieIdentificata>({
  name: "job_positions.create",
  permission: "departments:create",
  minScope: "all",
  input: creeazaFunctieSchema,
  audit: {
    action: "create",
    entityType: "job_positions",
    entityId: (_input, data) => data.id,
    allow: CAMPURI_AUDITATE_CREARE,
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("job_positions")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        activ: true,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    revalidatePath("/functii");
    return { id: data.id };
  },
});

export const actualizeazaFunctie = createAction<
  typeof actualizeazaFunctieSchema,
  FunctieIdentificata
>({
  name: "job_positions.update",
  permission: "departments:update",
  minScope: "all",
  input: actualizeazaFunctieSchema,
  audit: {
    action: "update",
    entityType: "job_positions",
    entityId: (input) => input.id,
    allow: CAMPURI_AUDITATE_ACTUALIZARE,
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;
    const { data, error } = await db
      .from("job_positions")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) throw notFound("Funcția nu a fost găsită.");
    revalidatePath("/functii");
    return { id };
  },
});

export const dezactiveazaFunctie = createAction<
  typeof dezactiveazaFunctieSchema,
  FunctieIdentificata
>({
  name: "job_positions.deactivate",
  permission: "departments:update",
  minScope: "all",
  input: dezactiveazaFunctieSchema,
  audit: {
    action: "update",
    entityType: "job_positions",
    entityId: (input) => input.id,
    allow: [],
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { count, error: eroareAngajati } = await db
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("job_position_id", input.id)
      .is("deleted_at", null);
    if (eroareAngajati !== null) throw mapPostgrestError(eroareAngajati, ctx.requestId);
    if ((count ?? 0) > 0) {
      throw businessRule(
        "Funcția are angajați alocați. Mutați-i pe altă funcție înainte de dezactivare.",
      );
    }

    // Precondiția de mai sus („nicio funcție cu angajați alocați”) e o CITIRE
    // separată de scrierea asta: între ele, altcineva poate muta un angajat pe
    // funcție sau o poate șterge logic. Iar `job_positions_update` cere în
    // `USING` și `departments:update = all` și `deleted_at is null` — un refuz
    // înseamnă zero rânduri, fără eroare, deci fără `.select()` ecranul ar
    // arăta funcția dezactivată în timp ce ea rămâne activă.
    const { data: functieDezactivata, error } = await db
      .from("job_positions")
      .update({ activ: false, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (functieDezactivata === null) {
      throw businessRule(
        "Funcția nu a fost dezactivată: a fost ștearsă între timp sau nu aveți dreptul de a modifica structura organizatorică. Reîncărcați pagina.",
      );
    }
    revalidatePath("/functii");
    return { id: input.id };
  },
});

/**
 * Reactivarea unei funcții dezactivate. Vezi nota din
 * `src/app/(app)/departamente/actions.ts`: `activ: true` apărea într-un singur
 * loc în tot modulul — la CREARE — deci o funcție dezactivată din greșeală nu se
 * mai putea readuce din interfață.
 *
 * N-are precondiție, spre deosebire de dezactivare: o funcție activă fără
 * angajați e o stare legitimă.
 */
export const reactiveazaFunctie = createAction<
  typeof dezactiveazaFunctieSchema,
  FunctieIdentificata
>({
  name: "job_positions.reactivate",
  permission: "departments:update",
  minScope: "all",
  input: dezactiveazaFunctieSchema,
  audit: {
    action: "update",
    entityType: "job_positions",
    entityId: (input) => input.id,
    allow: [],
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { data: reactivata, error } = await db
      .from("job_positions")
      .update({ activ: true, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (reactivata === null) {
      throw businessRule(
        "Funcția nu a fost reactivată: a fost ștearsă între timp sau nu aveți dreptul de a modifica structura organizatorică. Reîncărcați pagina.",
      );
    }
    revalidatePath("/functii");
    return { id: input.id };
  },
});

/**
 * Cine deține funcția — atribuire și retragere dintr-o singură apăsare.
 *
 * ── DE CE STĂ AICI, ÎN NOMENCLATOR ────────────────────────────────────────
 * `dezactiveazaFunctie`, mai sus în acest fișier, refuză cu „Mutați-i pe altă
 * funcție înainte de dezactivare". Până acum, unealta la care trimitea mesajul
 * nu exista în modul: singura cale de a schimba funcția cuiva era formularul
 * complet al fișei, deschis pentru fiecare om în parte. Aceeași fundătură pe
 * care `mutaAngajati` a reparat-o la departamente, cu aceeași formă.
 *
 * ── PERMISIUNEA E `employees:update`, NU `departments:update` ─────────────
 * Restul acțiunilor din fișier scriu în `job_positions`, deci cer dreptul pe
 * structura organizatorică. Asta scrie în `employees`. Cerând `departments`,
 * ar fi fost o poartă care nu păzește tabela atinsă — iar `employees_update` ar
 * fi refuzat oricum, tăcut, cu zero rânduri. Ecranul repetă condiția: butonul
 * nu se randează fără `employees:update = all`.
 *
 * ── DE CE DOUĂ SCRIERI ȘI NU UNA ──────────────────────────────────────────
 * Payload-ul e o STARE („ăștia dețin funcția"), nu o operație. Diferența față
 * de bază se desface în două mulțimi disjuncte — cei de adăugat și cei de scos
 * — care cer valori diferite pe aceeași coloană, deci două `UPDATE`-uri.
 * Ordinea nu contează: mulțimile n-au intersecție prin construcție.
 *
 * ── CE NU SE POATE GARANTA, ȘI SE SPUNE ───────────────────────────────────
 * PostgREST nu deschide o tranzacție peste două cereri: dacă a doua e refuzată
 * parțial, prima rămâne scrisă. Mesajul spune atunci exact ce s-a întâmplat, cu
 * cifre — nu „a eșuat", ceea ce ar fi o minciună despre rândurile deja scrise.
 * Aceeași alegere ca la `mutaAngajati`, din același motiv.
 */
export const atribuieAngajatiPeFunctie = createAction<
  typeof atribuieAngajatiSchema,
  { atribuiti: number; retrasi: number }
>({
  name: "job_positions.assign_employees",
  permission: "employees:update",
  minScope: "all",
  input: atribuieAngajatiSchema,
  audit: {
    action: "update",
    entityType: "job_positions",
    entityId: (input) => input.job_position_id,
    allow: ["job_position_id", "employee_ids"],
  },
  // `/angajati` arată funcția pe fiecare rând, `/organigrama` pe fiecare nod.
  revalidate: ["/functii", "/angajati", "/organigrama"],
  handler: async (ctx, input) => {
    const db = await createServerSupabase();

    // Funcția se verifică EXPLICIT că e a organizației: `employees.job_position_id`
    // e o cheie străină simplă, fără componentă pe `organization_id`, deci baza
    // n-ar opri o funcție împrumutată din altă firmă. Aceeași gaură ca la
    // `employees.department_id`, aceeași plasă ca în `mutaAngajati`.
    const { data: functie, error: eroareFunctie } = await db
      .from("job_positions")
      .select("id, denumire, activ")
      .eq("id", input.job_position_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareFunctie !== null) throw mapPostgrestError(eroareFunctie, ctx.requestId);
    if (functie === null) throw notFound("Funcția selectată nu a fost găsită.");
    // O funcție dezactivată nu primește oameni — altfel `dezactiveazaFunctie`
    // s-ar contrazice singură: refuză închiderea până când funcția e goală, dar
    // imediat după ce reușești ai putea-o repopula, fără niciun avertisment.
    // Retragerea rămâne permisă: golirea unei funcții dezactivate e chiar
    // curățenia pe care refuzul o cere.
    if (!functie.activ && input.employee_ids.length > 0) {
      throw businessRule(
        `Funcția „${functie.denumire}” este dezactivată. Reactivați-o înainte de a atribui persoane pe ea.`,
      );
    }

    // Cine o deține ACUM — sub aceleași politici ca lista de pe ecran, deci
    // aceeași mulțime. Diferența se calculează aici, nu în interfață: ecranul
    // trimite starea dorită, nu operațiile.
    const { data: actuali, error: eroareActuali } = await db
      .from("employees")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("job_position_id", input.job_position_id)
      .is("deleted_at", null);
    if (eroareActuali !== null) throw mapPostgrestError(eroareActuali, ctx.requestId);

    const idActuali = new Set((actuali ?? []).map((rand) => rand.id));
    const ceruti = new Set(input.employee_ids);
    const deAdaugat = input.employee_ids.filter((id) => !idActuali.has(id));
    const deScos = [...idActuali].filter((id) => !ceruti.has(id));

    let atribuiti = 0;
    if (deAdaugat.length > 0) {
      const { data, error } = await db
        .from("employees")
        .update({ job_position_id: input.job_position_id, updated_by: ctx.user.id })
        .in("id", deAdaugat)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("deleted_at", null)
        .select("id");
      if (error !== null) throw mapPostgrestError(error, ctx.requestId);
      atribuiti = data?.length ?? 0;
      // `.select()` după `.update()`: politica `employees_update` refuză prin
      // `USING` cu ZERO RÂNDURI ȘI FĂRĂ EROARE. La o scriere în masă, un refuz
      // parțial ar fi altfel raportat drept reușită deplină.
      if (atribuiti !== deAdaugat.length) {
        throw businessRule(
          `Au primit funcția ${String(atribuiti)} din ${String(deAdaugat.length)} persoane. Restul au fost refuzate: fișele au fost șterse între timp sau nu aveți dreptul de a le modifica. Reîncărcați pagina.`,
        );
      }
    }

    let retrasi = 0;
    if (deScos.length > 0) {
      const { data, error } = await db
        .from("employees")
        .update({ job_position_id: null, updated_by: ctx.user.id })
        .in("id", deScos)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("deleted_at", null)
        .select("id");
      if (error !== null) throw mapPostgrestError(error, ctx.requestId);
      retrasi = data?.length ?? 0;
      if (retrasi !== deScos.length) {
        throw businessRule(
          `Au fost scoase de pe funcție ${String(retrasi)} din ${String(deScos.length)} persoane, dar cele ${String(atribuiti)} atribuiri au rămas scrise. Reîncărcați pagina și reluați retragerea.`,
        );
      }
    }

    return { atribuiti, retrasi };
  },
});
