// src/app/(app)/angajati/[id]/scutiri-actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { mapPostgrestError } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { createServerSupabase } from "@/lib/supabase/server";
import { creeazaScutireFiscalaSchema } from "@/schemas/employee";

export const adaugaScutireFiscala = createAction<
  typeof creeazaScutireFiscalaSchema,
  Readonly<{ id: string }>
>({
  name: "employees.tax_exemption.create",
  feature: "payroll",
  permission: "payroll:create",
  minScope: "all",
  input: creeazaScutireFiscalaSchema,
  audit: {
    action: "create",
    entityType: "employee_tax_exemptions",
    entityId: (_input, data) => data.id,
    allow: [
      "employee_id",
      "exemption_type",
      "valabil_de_la",
      "valabil_pana",
      "procent_scutire",
      "plafon_lunar",
    ],
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { employee_id, ...campuri } = input;
    const { data, error } = await db
      .from("employee_tax_exemptions")
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
