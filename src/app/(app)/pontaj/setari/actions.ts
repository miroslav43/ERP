"use server";

import { createAction } from "@/lib/actions/create-action";
import { setariPontajSchema } from "@/schemas/attendance";
import { createServerSupabase } from "@/lib/supabase/server";

import { traduEroare } from "../erori";

/**
 * Salvează o versiune nouă a parametrilor de dreptul muncii.
 *
 * Versionare prin `valabil_de_la`, ca la setările de salarizare: o modificare
 * NU rescrie trecutul. O lună deja calculată trebuie să rămână explicabilă cu
 * parametrii care erau în vigoare atunci, nu cu cei de azi.
 */
export const salveazaSetariPontaj = createAction({
  name: "attendance.settings.save",
  feature: "attendance",
  permission: "attendance:update",
  minScope: "all",
  input: setariPontajSchema,
  audit: { action: "create", entityType: "attendance_settings", allow: ["valabil_de_la"] },
  revalidate: ["/pontaj", "/pontaj/setari"],
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("attendance_settings")
      .insert({ organization_id: ctx.tenant.organizationId, ...input })
      .select("id")
      .single<{ id: string }>();
    if (error !== null) traduEroare(error);
    return { id: data.id };
  },
});
