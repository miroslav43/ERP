// src/app/(app)/evaluari/actions.ts
"use server";

import { completeazaCoduri, normalizeazaCriterii } from "@/domain/evaluations/criterii";
import { aliniazaRaspunsuri, calculeazaScor, noteInAfaraScalei } from "@/domain/evaluations/scor";
import { businessRule, mapPostgrestError, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import type { ActionContext } from "@/lib/actions/types";
import type { Json } from "@/types/database";
import {
  actualizeazaEvaluareSchema,
  actualizeazaSablonEvaluareSchema,
  arhiveazaSablonEvaluareSchema,
  creeazaEvaluareSchema,
  creeazaSablonEvaluareSchema,
  duplicaSablonEvaluareSchema,
  finalizeazaEvaluareSchema,
  reactiveazaSablonEvaluareSchema,
  redeschideEvaluareSchema,
  type CriteriuSablonIntrare,
} from "@/schemas/evaluation";

/**
 * ── DE CE `revalidate` E DECLARAT, NU CHEMAT ──────────────────────────────
 * Versiunea anterioară a fișierului chema `revalidatePath()` din interiorul
 * fiecărui handler. `create-action.ts` rulează revalidarea la pasul 8, DUPĂ
 * audit, și numai pe reușită. Chemat din handler, `revalidatePath` se executa
 * și pe drumul care apoi arunca — golind cache-ul pentru o scriere care nu s-a
 * produs.
 */
const CAI_SABLOANE = ["/evaluari", "/evaluari/sabloane"] as const;

/**
 * Trecerea unei liste tipate către o coloană `jsonb`.
 *
 * `Json` din tipurile generate cere structuri cu semnătură de index, pe care o
 * interfață numită nu o are. Serializarea nu e o formalitate de tipuri: ea
 * garantează că în coloană ajunge exact ce se poate reciti de acolo — fără
 * `undefined`, fără metode, fără referințe circulare. Același tipar există în
 * `salarizare/actions.ts` pentru instantaneul de configurări.
 */
const caJson = (valoare: unknown): Json => JSON.parse(JSON.stringify(valoare)) as Json;

/** Rândul de șablon citit înainte de o scriere, cât să decidem ce e permis. */
interface SablonExistent {
  readonly id: string;
  readonly denumire: string;
  readonly criterii: unknown;
  readonly versiune: number;
  readonly activ: boolean;
  readonly organization_id: string | null;
}

/**
 * Pregătește criteriile pentru scriere: coduri completate, ordine păstrată.
 *
 * Codurile deja existente NU se regenerează, nici când se schimbă denumirea.
 * Ele sunt cheia sub care stau răspunsurile din evaluările deja date; un cod
 * rescris ar rupe legătura cu istoricul, iar ecranul ar afișa codul brut acolo
 * unde ar trebui să scrie denumirea.
 */
function pregatesteCriterii(criterii: readonly CriteriuSablonIntrare[]): readonly Readonly<{
  cod: string;
  denumire: string;
  descriere: string | null;
  tip: string;
  scala_max: number;
  pondere: number | null;
}>[] {
  const coduri = completeazaCoduri(criterii);
  return criterii.map((c, i) => ({
    cod: coduri[i] ?? c.denumire,
    denumire: c.denumire,
    descriere: c.descriere,
    tip: c.tip,
    scala_max: c.scala_max,
    pondere: c.pondere,
  }));
}

// ── Șabloane ──────────────────────────────────────────────────────────────────

export const creeazaSablonEvaluare = createAction<
  typeof creeazaSablonEvaluareSchema,
  Readonly<{ id: string }>
>({
  name: "evaluation_templates.create",
  feature: "evaluations",
  // Șablonul e artefact pe TOATĂ firma: îl folosește oricine evaluează pe
  // oricine. De aici scope-ul `all`, spre deosebire de evaluarea propriu-zisă,
  // pe care o scrie managerul pentru echipa lui. Politica din `0071` cere
  // exact același lucru, ca preambulul și baza să nu mai spună lucruri
  // diferite — `0038` cerea aici `employees:update`, cheie pe care rolul
  // `manager` n-o are la niciun scope.
  permission: "evaluations:update",
  minScope: "all",
  input: creeazaSablonEvaluareSchema,
  audit: {
    action: "create",
    entityType: "evaluation_templates",
    entityId: (_input, data) => data.id,
    allow: ["denumire", "descriere"],
  },
  revalidate: CAI_SABLOANE,
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("evaluation_templates")
      .insert({
        organization_id: ctx.tenant.organizationId,
        denumire: input.denumire,
        descriere: input.descriere,
        criterii: caJson(pregatesteCriterii(input.criterii)),
        versiune: 1,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    return { id: data.id };
  },
});

export const actualizeazaSablonEvaluare = createAction<
  typeof actualizeazaSablonEvaluareSchema,
  Readonly<{ id: string; versiune: number }>
>({
  name: "evaluation_templates.update",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "all",
  input: actualizeazaSablonEvaluareSchema,
  audit: {
    action: "update",
    entityType: "evaluation_templates",
    entityId: (input) => input.id,
    allow: ["denumire", "descriere"],
  },
  revalidate: CAI_SABLOANE,
  handler: async (ctx, input) => {
    const { data: existent, error: eroareCitire } = await ctx.supabase
      .from("evaluation_templates")
      .select("id, denumire, criterii, versiune, activ, organization_id")
      .eq("id", input.id)
      .is("deleted_at", null)
      .maybeSingle<SablonExistent>();
    if (eroareCitire !== null) throw mapPostgrestError(eroareCitire, ctx.requestId);
    if (existent === null) throw notFound("Șablonul nu mai există.");
    // Politica de UPDATE îl refuză oricum (`organization_id is not null`), dar
    // un refuz al bazei ar ieși ca „zero rânduri", adică un mesaj despre
    // drepturi. Aici se poate spune exact ce e de făcut.
    if (existent.organization_id === null) {
      throw businessRule(
        "Șabloanele de platformă nu se pot modifica. Duplicați-l în firma dumneavoastră și editați copia.",
      );
    }

    // Versiunea crește numai când se schimbă efectiv criteriile. O corectură de
    // titlu n-are de ce să facă din „v3" un „v4" în toate evaluările viitoare.
    const criteriiNoi = pregatesteCriterii(input.criterii);
    const criteriiVechi = normalizeazaCriterii(existent.criterii);
    const sAuSchimbat =
      JSON.stringify(criteriiVechi) !== JSON.stringify(normalizeazaCriterii(criteriiNoi));
    const versiune = sAuSchimbat ? existent.versiune + 1 : existent.versiune;

    // `.select()` obligatoriu: un UPDATE respins de clauza USING atinge ZERO
    // rânduri și NU ridică eroare.
    const { data, error } = await ctx.supabase
      .from("evaluation_templates")
      .update({
        denumire: input.denumire,
        descriere: input.descriere,
        criterii: caJson(criteriiNoi),
        versiune,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id, versiune")
      .maybeSingle<{ id: string; versiune: number }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule(
        "Șablonul nu a fost modificat: fie nu mai există, fie nu aveți dreptul să îl modificați. A rămas neschimbat.",
      );
    }
    return { id: data.id, versiune: data.versiune };
  },
});

/**
 * Duplicarea, care e și singura cale prin care un șablon de platformă devine
 * editabil: RLS-ul îi interzice orice UPDATE, deci ecranul oferă
 * „Personalizează", nu „Editează". Un buton condamnat e mai rău decât niciunul.
 */
export const duplicaSablonEvaluare = createAction<
  typeof duplicaSablonEvaluareSchema,
  Readonly<{ id: string }>
>({
  name: "evaluation_templates.duplicate",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "all",
  input: duplicaSablonEvaluareSchema,
  audit: {
    action: "create",
    entityType: "evaluation_templates",
    entityId: (_input, data) => data.id,
    allow: ["denumire"],
  },
  revalidate: CAI_SABLOANE,
  handler: async (ctx, input) => {
    // Sursa poate fi un șablon de platformă (vizibil, nemodificabil) sau unul
    // al firmei. Politica de SELECT le acoperă pe amândouă.
    const { data: sursa, error: eroareCitire } = await ctx.supabase
      .from("evaluation_templates")
      .select("id, denumire, descriere, criterii")
      .eq("id", input.id)
      .is("deleted_at", null)
      .maybeSingle<{
        id: string;
        denumire: string;
        descriere: string | null;
        criterii: unknown;
      }>();
    if (eroareCitire !== null) throw mapPostgrestError(eroareCitire, ctx.requestId);
    if (sursa === null) throw notFound("Șablonul de copiat nu mai există.");

    const { data, error } = await ctx.supabase
      .from("evaluation_templates")
      .insert({
        organization_id: ctx.tenant.organizationId,
        denumire: input.denumire,
        descriere: sursa.descriere,
        criterii: caJson(normalizeazaCriterii(sursa.criterii)),
        versiune: 1,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    return { id: data.id };
  },
});

/**
 * Arhivarea, cu perechea ei.
 *
 * `0038` avea doar `dezactiveaza`, fără drum înapoi: un șablon scos din
 * greșeală rămânea scos pentru totdeauna. Comentariul din vechiul
 * `actiuni-sablon-evaluare.tsx` o și recunoștea („nicio acțiune nu pune `activ`
 * înapoi pe `true`").
 */
function comutaActiv(activ: boolean) {
  return async (
    ctx: ActionContext,
    input: Readonly<{ id: string }>,
  ): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("evaluation_templates")
      .update({ activ, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("activ", !activ)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule(
        activ
          ? "Șablonul nu a fost reactivat: fie era deja activ, fie nu mai există, fie nu aveți dreptul să îl modificați."
          : "Șablonul nu a fost arhivat: fie era deja arhivat, fie nu mai există, fie nu aveți dreptul să îl modificați.",
      );
    }
    return { id: input.id };
  };
}

export const arhiveazaSablonEvaluare = createAction<
  typeof arhiveazaSablonEvaluareSchema,
  Readonly<{ id: string }>
>({
  name: "evaluation_templates.archive",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "all",
  input: arhiveazaSablonEvaluareSchema,
  audit: {
    action: "update",
    entityType: "evaluation_templates",
    entityId: (input) => input.id,
    allow: [],
  },
  revalidate: CAI_SABLOANE,
  handler: comutaActiv(false),
});

export const reactiveazaSablonEvaluare = createAction<
  typeof reactiveazaSablonEvaluareSchema,
  Readonly<{ id: string }>
>({
  name: "evaluation_templates.reactivate",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "all",
  input: reactiveazaSablonEvaluareSchema,
  audit: {
    action: "update",
    entityType: "evaluation_templates",
    entityId: (input) => input.id,
    allow: [],
  },
  revalidate: CAI_SABLOANE,
  handler: comutaActiv(true),
});

// ── Evaluări ──────────────────────────────────────────────────────────────────

const caiEvaluare = (employeeId: string): readonly string[] => [
  "/evaluari",
  `/angajati/${employeeId}`,
];

interface SablonPentruEvaluare {
  readonly id: string;
  readonly criterii: unknown;
  readonly versiune: number;
  readonly activ: boolean;
}

interface EvaluareExistenta {
  readonly id: string;
  readonly employee_id: string;
  readonly status: "draft" | "finalizat";
  readonly criterii_sablon: unknown;
}

export const creeazaEvaluare = createAction<
  typeof creeazaEvaluareSchema,
  Readonly<{ id: string; employee_id: string }>
>({
  name: "employee_evaluations.create",
  feature: "evaluations",
  permission: "evaluations:create",
  minScope: "team",
  input: creeazaEvaluareSchema,
  audit: {
    action: "create",
    entityType: "employee_evaluations",
    entityId: (_input, data) => data.id,
    // `raspunsuri`/`concluzie` rămân în afara jurnalului — conținut de
    // evaluare, nu metadate, la fel ca CNP-ul sau salariul în alte tabele.
    allow: ["employee_id", "template_id", "data_evaluarii", "status"],
  },
  revalidate: (_input, data) => caiEvaluare(data.employee_id),
  handler: async (ctx, input) => {
    const { data: sablon, error: eroareSablon } = await ctx.supabase
      .from("evaluation_templates")
      .select("id, criterii, versiune, activ")
      .eq("id", input.template_id)
      .is("deleted_at", null)
      .maybeSingle<SablonPentruEvaluare>();
    if (eroareSablon !== null) throw mapPostgrestError(eroareSablon, ctx.requestId);
    if (sablon === null) throw notFound("Șablonul de evaluare nu mai există.");
    if (!sablon.activ) {
      throw businessRule("Șablonul a fost arhivat între timp. Alegeți altul.");
    }

    const criterii = normalizeazaCriterii(sablon.criterii);
    if (criterii.length === 0) {
      throw businessRule("Șablonul nu are niciun criteriu. Completați-l înainte de a evalua.");
    }

    const gresite = noteInAfaraScalei(criterii, input.raspunsuri);
    if (gresite.length > 0) {
      throw businessRule(`Nota depășește scala la: ${gresite.join(", ")}.`);
    }

    const raspunsuri = aliniazaRaspunsuri(criterii, input.raspunsuri);
    if (input.status === "finalizat" && calculeazaScor(criterii, raspunsuri).completate === 0) {
      throw businessRule(
        "O evaluare finalizată trebuie să aibă cel puțin o notă. Salvați-o ca ciornă dacă nu ați terminat.",
      );
    }

    const { data, error } = await ctx.supabase
      .from("employee_evaluations")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: input.employee_id,
        template_id: input.template_id,
        evaluator_id: ctx.user.id,
        data_evaluarii: input.data_evaluarii,
        raspunsuri: caJson(raspunsuri),
        // Instantaneul. Din clipa asta evaluarea nu mai depinde de șablon:
        // editarea lui nu are voie să schimbe sensul notelor deja date.
        criterii_sablon: caJson(criterii),
        versiune_sablon: sablon.versiune,
        concluzie: input.concluzie,
        status: input.status,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, employee_id")
      .single();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    return { id: data.id, employee_id: data.employee_id };
  },
});

/**
 * Corectarea unei ciorne.
 *
 * Nu exista deloc: o evaluare salvată ca ciornă rămânea îngheațată pentru
 * totdeauna, fiindcă politica de UPDATE era în bază, dar n-o folosea nicio
 * acțiune. Răspunsurile se realiniază la INSTANTANEUL evaluării, nu la
 * șablonul curent — șablonul poate fi între timp la altă versiune.
 */
export const actualizeazaEvaluare = createAction<
  typeof actualizeazaEvaluareSchema,
  Readonly<{ id: string; employee_id: string }>
>({
  name: "employee_evaluations.update",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "team",
  input: actualizeazaEvaluareSchema,
  audit: {
    action: "update",
    entityType: "employee_evaluations",
    entityId: (input) => input.id,
    allow: ["data_evaluarii"],
  },
  revalidate: (_input, data) => caiEvaluare(data.employee_id),
  handler: async (ctx, input) => {
    const { data: existenta, error: eroareCitire } = await ctx.supabase
      .from("employee_evaluations")
      .select("id, employee_id, status, criterii_sablon")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle<EvaluareExistenta>();
    if (eroareCitire !== null) throw mapPostgrestError(eroareCitire, ctx.requestId);
    if (existenta === null) throw notFound("Evaluarea nu mai există.");
    if (existenta.status !== "draft") {
      throw businessRule(
        "Evaluarea e finalizată și nu se mai poate modifica. Redeschideți-o mai întâi.",
      );
    }

    const criterii = normalizeazaCriterii(existenta.criterii_sablon);
    const gresite = noteInAfaraScalei(criterii, input.raspunsuri);
    if (gresite.length > 0) {
      throw businessRule(`Nota depășește scala la: ${gresite.join(", ")}.`);
    }

    const { data, error } = await ctx.supabase
      .from("employee_evaluations")
      .update({
        data_evaluarii: input.data_evaluarii,
        raspunsuri: caJson(aliniazaRaspunsuri(criterii, input.raspunsuri)),
        concluzie: input.concluzie,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "draft")
      .select("id, employee_id")
      .maybeSingle<{ id: string; employee_id: string }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule(
        "Evaluarea nu a fost salvată: fie a fost finalizată între timp, fie nu aveți dreptul să o modificați. A rămas neschimbată.",
      );
    }
    return { id: data.id, employee_id: data.employee_id };
  },
});

export const finalizeazaEvaluare = createAction<
  typeof finalizeazaEvaluareSchema,
  Readonly<{ id: string; employee_id: string }>
>({
  name: "employee_evaluations.finalize",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "team",
  input: finalizeazaEvaluareSchema,
  audit: {
    action: "update",
    entityType: "employee_evaluations",
    entityId: (input) => input.id,
    allow: [],
  },
  revalidate: (_input, data) => caiEvaluare(data.employee_id),
  handler: async (ctx, input) => {
    const { data: existenta, error: eroareCitire } = await ctx.supabase
      .from("employee_evaluations")
      .select("id, employee_id, status, criterii_sablon, raspunsuri")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle<EvaluareExistenta & { raspunsuri: unknown }>();
    if (eroareCitire !== null) throw mapPostgrestError(eroareCitire, ctx.requestId);
    if (existenta === null) throw notFound("Evaluarea nu mai există.");
    if (existenta.status === "finalizat") {
      throw businessRule("Evaluarea era deja finalizată.");
    }

    // O evaluare finalizată fără nicio notă e o semnătură pe o foaie goală.
    const criterii = normalizeazaCriterii(existenta.criterii_sablon);
    const raspunsuri = Array.isArray(existenta.raspunsuri)
      ? aliniazaRaspunsuri(criterii, existenta.raspunsuri as never)
      : [];
    if (calculeazaScor(criterii, raspunsuri).completate === 0) {
      throw businessRule("Completați cel puțin o notă înainte de a finaliza evaluarea.");
    }

    const { data, error } = await ctx.supabase
      .from("employee_evaluations")
      .update({ status: "finalizat", updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "draft")
      .select("id, employee_id")
      .maybeSingle<{ id: string; employee_id: string }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule(
        "Evaluarea nu a fost finalizată: fie a finalizat-o altcineva între timp, fie nu aveți dreptul. Reîncărcați pagina.",
      );
    }
    return { id: data.id, employee_id: data.employee_id };
  },
});

/**
 * Redeschiderea, rezervată scope-ului `all`.
 *
 * Politica din `0071` face evaluarea finalizată imuabilă pentru cine are scope
 * de echipă: managerul nu-și poate rescrie propria semnătură. Corectura după
 * finalizare rămâne posibilă pentru hr / org_admin, cu urmă în jurnal.
 */
export const redeschideEvaluare = createAction<
  typeof redeschideEvaluareSchema,
  Readonly<{ id: string; employee_id: string }>
>({
  name: "employee_evaluations.reopen",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "all",
  input: redeschideEvaluareSchema,
  audit: {
    action: "update",
    entityType: "employee_evaluations",
    entityId: (input) => input.id,
    allow: [],
  },
  revalidate: (_input, data) => caiEvaluare(data.employee_id),
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("employee_evaluations")
      .update({ status: "draft", updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "finalizat")
      .select("id, employee_id")
      .maybeSingle<{ id: string; employee_id: string }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule(
        "Evaluarea nu a fost redeschisă: fie era deja ciornă, fie nu mai există, fie nu aveți dreptul.",
      );
    }
    return { id: data.id, employee_id: data.employee_id };
  },
});
