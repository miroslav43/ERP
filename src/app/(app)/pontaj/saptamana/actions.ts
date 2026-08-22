// src/app/(app)/pontaj/saptamana/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { notFound } from "@/lib/actions/errors";
import { decideSaptamanaPontajSchema, trimiteSaptamanaPontajSchema } from "@/schemas/attendance";
import { traduEroare } from "../erori";

const CAI_REVALIDARE = [
  "/pontaj/saptamana",
  "/pontaj/aprobare",
  "/portal",
  "/portal/pontajul-meu",
  "/portal/pontajul-meu/saptamana",
] as const;

/**
 * Singurul drum de scriere pentru angajat: apelează `trimite_saptamana_pontaj`
 * (security definer, 0040_pontaj_saptamanal.sql) — validează, apoi upsert +
 * regenerare completă a zilelor. Editabil oricând planul nu e încă aprobat
 * (reapelarea suprascrie zilele anterioare).
 */
export const trimiteSaptamanaPontaj = createAction<
  typeof trimiteSaptamanaPontajSchema,
  Readonly<{ id: string }>
>({
  name: "attendance.week.submit",
  feature: "attendance",
  permission: "attendance:create",
  minScope: "own",
  input: trimiteSaptamanaPontajSchema,
  audit: {
    action: "create",
    entityType: "attendance_week_submission",
    entityId: (_input, data) => data.id,
    allow: ["saptamana_start", "status"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase.rpc("trimite_saptamana_pontaj", {
      p_organization_id: ctx.tenant.organizationId,
      p_saptamana_start: input.saptamana_start,
      p_status: input.status,
      p_zile: input.zile,
    });
    if (error !== null) traduEroare(error);
    return { id: data };
  },
});

/**
 * Aprobare/respingere individuală, pe toată săptămâna dintr-o singură
 * decizie — tipar identic cu `decideCerere` (concedii/actions.ts). Cu un
 * singur pas de aprobare (managerul direct ∪ patronul, la aceeași `ordine`),
 * orice decizie anulează automat sarcinile surori
 * (`trg_approval_tasks_anuleaza_surori`, deja generic) — nu mai e nevoie să
 * numărăm sarcini rămase, ca la concediu (mai multe trepte posibile acolo).
 */
export const decideSaptamanaPontaj = createAction<
  typeof decideSaptamanaPontajSchema,
  Readonly<{ id: string }>
>({
  name: "attendance.week.decide",
  feature: "attendance",
  permission: "attendance:approve",
  minScope: "team",
  input: decideSaptamanaPontajSchema,
  audit: {
    action: "update",
    entityType: "attendance_week_submission",
    entityId: (input) => input.taskId,
    allow: ["taskId", "decizie", "comentariu", "motivRespingere"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data: sarcina, error: eroareSarcina } = await ctx.supabase
      .from("approval_tasks")
      .select("id, entity_id")
      .eq("id", input.taskId)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("entity_type", "attendance_week_submission")
      .eq("status", "in_asteptare")
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareSarcina !== null) throw eroareSarcina;
    if (sarcina === null) {
      throw notFound("Sarcina de aprobare nu a fost găsită sau a fost deja rezolvată.");
    }

    const acum = ctx.now.toISOString();
    const { error: eroareUpdateSarcina } = await ctx.supabase
      .from("approval_tasks")
      .update({ status: input.decizie, comentariu: input.comentariu, decis_la: acum })
      .eq("id", sarcina.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (eroareUpdateSarcina !== null) traduEroare(eroareUpdateSarcina);

    const { error: eroareDecizie } = await ctx.supabase
      .from("attendance_week_submissions")
      .update({
        status: input.decizie,
        decis_de: ctx.user.id,
        decis_la: acum,
        motiv_respingere: input.decizie === "respinsa" ? input.motivRespingere : null,
      })
      .eq("id", sarcina.entity_id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (eroareDecizie !== null) traduEroare(eroareDecizie);

    return { id: sarcina.entity_id };
  },
});
