// src/app/(app)/angajati/[id]/componente-actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { mapPostgrestError, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import {
  asociazaComponentaSchema,
  incheieComponentaAngajatSchema,
} from "@/schemas/salary-component";

export const asociazaComponenta = createAction<
  typeof asociazaComponentaSchema,
  Readonly<{ id: string }>
>({
  name: "salary_components.create",
  feature: "payroll",
  permission: "payroll:create",
  minScope: "all",
  input: asociazaComponentaSchema,
  audit: {
    action: "create",
    entityType: "salary_components",
    entityId: (_input, data) => data.id,
    allow: [
      "employee_id",
      "component_type_id",
      "kind",
      "valabil_de_la",
      "valabil_pana",
      // procent/suma rămân în afara jurnalului — sunt cifre salariale, ca la contract.
    ],
  },
  handler: async (ctx, input) => {
    const { employee_id, ...campuri } = input;
    const { data, error } = await ctx.supabase
      .from("salary_components")
      .insert({
        ...campuri,
        employee_id,
        organization_id: ctx.tenant.organizationId,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    revalidatePath(`/angajati/${employee_id}`);
    return { id: data.id };
  },
});

export const incheieComponentaAngajat = createAction<
  typeof incheieComponentaAngajatSchema,
  Readonly<{ id: string }>
>({
  name: "salary_components.end",
  feature: "payroll",
  permission: "payroll:update",
  minScope: "all",
  input: incheieComponentaAngajatSchema,
  audit: {
    action: "update",
    entityType: "salary_components",
    entityId: (input) => input.id,
    allow: ["employee_id"],
  },
  handler: async (ctx, input) => {
    const azi = ctx.now.toISOString().slice(0, 10);
    const { data, error } = await ctx.supabase
      .from("salary_components")
      .update({ valabil_pana: azi, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("employee_id", input.employee_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) throw notFound("Componenta salarială nu a fost găsită.");
    revalidatePath(`/angajati/${input.employee_id}`);
    return { id: data.id };
  },
});
