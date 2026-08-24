// src/app/(app)/evaluari/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { businessRule, mapPostgrestError } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import {
  creeazaEvaluareSchema,
  creeazaSablonEvaluareSchema,
  dezactiveazaSablonEvaluareSchema,
} from "@/schemas/evaluation";

/** Cod stabil dintr-o linie de criteriu — fără diacritice, spații → underscore. */
function codDinDenumire(denumire: string): string {
  return denumire
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 80);
}

export const creeazaSablonEvaluare = createAction<
  typeof creeazaSablonEvaluareSchema,
  Readonly<{ id: string }>
>({
  name: "evaluation_templates.create",
  feature: "evaluations",
  // Șablonul e comun pe firmă — îl creează administratorul sau HR-ul, nu un
  // manager pentru echipa lui. Cerința spune „creat standard de super user sau
  // poate fi creat și de manager direct" — evaluarea propriu-zisă e cea pe care
  // o creează managerul, mai jos.
  permission: "evaluations:update",
  minScope: "all",
  input: creeazaSablonEvaluareSchema,
  audit: {
    action: "create",
    entityType: "evaluation_templates",
    entityId: (_input, data) => data.id,
    allow: ["denumire", "descriere"],
  },
  handler: async (ctx, input) => {
    const linii = input.criterii_text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const criterii = linii.map((denumire) => ({
      cod: codDinDenumire(denumire),
      denumire,
      scala_max: 5,
    }));

    const { data, error } = await ctx.supabase
      .from("evaluation_templates")
      .insert({
        organization_id: ctx.tenant.organizationId,
        denumire: input.denumire,
        descriere: input.descriere,
        criterii,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    revalidatePath("/evaluari/sabloane");
    return { id: data.id };
  },
});

export const dezactiveazaSablonEvaluare = createAction<
  typeof dezactiveazaSablonEvaluareSchema,
  Readonly<{ id: string }>
>({
  name: "evaluation_templates.deactivate",
  feature: "evaluations",
  // Dezactivarea unui ȘABLON e o schimbare pe toată firma, nu pe o echipă:
  // șablonul e comun. De aici `update` cu scope `all`, spre deosebire de
  // crearea unei evaluări, care e a managerului direct.
  permission: "evaluations:update",
  minScope: "all",
  input: dezactiveazaSablonEvaluareSchema,
  audit: {
    action: "update",
    entityType: "evaluation_templates",
    entityId: (input) => input.id,
    allow: [],
  },
  handler: async (ctx, input) => {
    // `.select()` obligatoriu: un UPDATE respins de clauza USING a politicii
    // `evaluation_templates_update` atinge ZERO rânduri și NU ridică eroare.
    // Poarta acelei politici NU e `evaluations:update` (cea verificată în
    // preambul), ci `employees:update in ('all','team')` — un rol care are una
    // fără cealaltă primea „dezactivat” pe un șablon rămas activ. La fel un
    // identificator care nu mai există sau nu aparține firmei.
    const { data, error } = await ctx.supabase
      .from("evaluation_templates")
      .update({ activ: false, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule(
        "Șablonul nu a fost dezactivat: fie nu mai există, fie nu aveți dreptul să îl modificați. A rămas activ — reîncărcați lista de șabloane.",
      );
    }
    revalidatePath("/evaluari/sabloane");
    return { id: input.id };
  },
});

export const creeazaEvaluare = createAction<typeof creeazaEvaluareSchema, Readonly<{ id: string }>>(
  {
    name: "employee_evaluations.create",
    feature: "evaluations",
    permission: "evaluations:create",
    minScope: "team",
    input: creeazaEvaluareSchema,
    audit: {
      action: "create",
      entityType: "employee_evaluations",
      entityId: (_input, data) => data.id,
      // `raspunsuri`/`concluzie` rămân în afara jurnalului — conținut de evaluare,
      // nu doar metadate, la fel ca la CNP/salariu în alte tabele.
      allow: ["employee_id", "template_id", "data_evaluarii", "status"],
    },
    handler: async (ctx, input) => {
      const { data, error } = await ctx.supabase
        .from("employee_evaluations")
        .insert({
          organization_id: ctx.tenant.organizationId,
          employee_id: input.employee_id,
          template_id: input.template_id,
          evaluator_id: ctx.user.id,
          data_evaluarii: input.data_evaluarii,
          raspunsuri: input.raspunsuri,
          concluzie: input.concluzie,
          status: input.status,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })
        .select("id")
        .single();
      if (error !== null) throw mapPostgrestError(error, ctx.requestId);
      revalidatePath(`/angajati/${input.employee_id}`);
      return { id: data.id };
    },
  },
);
