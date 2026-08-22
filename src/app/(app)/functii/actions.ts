// src/app/(app)/functii/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { businessRule, mapPostgrestError, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaFunctieSchema,
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

    const { error } = await db
      .from("job_positions")
      .update({ activ: false, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    revalidatePath("/functii");
    return { id: input.id };
  },
});
