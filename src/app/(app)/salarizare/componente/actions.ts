// src/app/(app)/salarizare/componente/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { mapPostgrestError, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import {
  actualizeazaSablonComponentaSchema,
  creeazaSablonComponentaSchema,
  dezactiveazaSablonComponentaSchema,
} from "@/schemas/salary-component";

type SablonIdentificat = Readonly<{ id: string }>;

const CAMPURI_AUDITATE_CREARE = [
  "cod",
  "denumire",
  "kind",
  "impozabil",
  "intra_in_baza_cas",
  "intra_in_baza_cass",
  "cod_revisal",
] as const;
const CAMPURI_AUDITATE_ACTUALIZARE = [
  "denumire",
  "impozabil",
  "intra_in_baza_cas",
  "intra_in_baza_cass",
  "cod_revisal",
] as const;

export const creeazaSablonComponenta = createAction<
  typeof creeazaSablonComponentaSchema,
  SablonIdentificat
>({
  name: "salary_component_types.create",
  feature: "payroll",
  permission: "payroll:create",
  minScope: "all",
  input: creeazaSablonComponentaSchema,
  audit: {
    action: "create",
    entityType: "salary_component_types",
    entityId: (_input, data) => data.id,
    allow: CAMPURI_AUDITATE_CREARE,
  },
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("salary_component_types")
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
    revalidatePath("/salarizare/componente");
    return { id: data.id };
  },
});

export const actualizeazaSablonComponenta = createAction<
  typeof actualizeazaSablonComponentaSchema,
  SablonIdentificat
>({
  name: "salary_component_types.update",
  feature: "payroll",
  permission: "payroll:update",
  minScope: "all",
  input: actualizeazaSablonComponentaSchema,
  audit: {
    action: "update",
    entityType: "salary_component_types",
    entityId: (input) => input.id,
    allow: CAMPURI_AUDITATE_ACTUALIZARE,
  },
  handler: async (ctx, input) => {
    const { id, ...campuri } = input;
    const { data, error } = await ctx.supabase
      .from("salary_component_types")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) throw notFound("Șablonul nu a fost găsit.");
    revalidatePath("/salarizare/componente");
    return { id };
  },
});

export const dezactiveazaSablonComponenta = createAction<
  typeof dezactiveazaSablonComponentaSchema,
  SablonIdentificat
>({
  name: "salary_component_types.deactivate",
  feature: "payroll",
  permission: "payroll:update",
  minScope: "all",
  input: dezactiveazaSablonComponentaSchema,
  audit: {
    action: "update",
    entityType: "salary_component_types",
    entityId: (input) => input.id,
    allow: [],
  },
  handler: async (ctx, input) => {
    const { error } = await ctx.supabase
      .from("salary_component_types")
      .update({ activ: false, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    revalidatePath("/salarizare/componente");
    return { id: input.id };
  },
});
