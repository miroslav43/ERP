// src/app/(app)/angajati/[id]/avatar-actions.ts
"use server";
// Admin/HR încarcă poza unui coleg din fișa lui. Ținta reală e contul din
// `profiles` (avatarul e legat de cont, nu de fișa de personal — vezi
// 0029_avatare.sql), de-aia gate-ul e `users:update`, nu `employees:update`:
// un angajat fără cont în portal (user_id null) nu poate primi o poză pe
// această cale, indiferent de scope-ul pe `employees`.
import { z } from "zod";
import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { BUCKET_AVATARE, caleAvatar, verificaAvatar } from "@/lib/avatar/cale";
import type { ActionContext } from "@/lib/actions/types";

const idAngajat = z.object({ employeeId: z.uuid() });

async function userIdAngajat(ctx: ActionContext, employeeId: string): Promise<string> {
  const { data } = await ctx.supabase
    .from("employees")
    .select("user_id")
    .eq("id", employeeId)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (data === null) throw notFound("Fișa de angajat nu există sau nu îți este accesibilă.");
  if (data.user_id === null) {
    throw businessRule("Acest angajat nu are cont în portal — nu i se poate atașa o fotografie.");
  }
  return data.user_id;
}

export const pregatesteIncarcareAvatarAngajat = createAction({
  name: "angajati.avatar.pregateste",
  permission: "users:update",
  minScope: "all",
  audit: {
    entityType: "profiles",
    action: "update",
    allow: ["employeeId", "numeFisier", "dimensiune", "mime"],
  },
  input: idAngajat.extend({
    numeFisier: z.string().min(1).max(255),
    dimensiune: z.number().int().positive(),
    mime: z.string().min(3).max(120),
  }),
  handler: async (ctx: ActionContext, input) => {
    const problema = verificaAvatar(input.mime, input.dimensiune);
    if (problema !== null) throw businessRule(problema);
    const userId = await userIdAngajat(ctx, input.employeeId);
    const cale = caleAvatar(userId, input.numeFisier);
    const { data, error } = await ctx.supabase.storage
      .from(BUCKET_AVATARE)
      .createSignedUploadUrl(cale);
    if (error !== null || data === null)
      throw businessRule("Nu am putut pregăti încărcarea fotografiei.");
    return { cale, token: data.token };
  },
});

export const salveazaAvatarAngajat = createAction({
  name: "angajati.avatar.salveaza",
  permission: "users:update",
  minScope: "all",
  audit: { entityType: "profiles", action: "update", allow: ["employeeId"] },
  input: idAngajat.extend({ cale: z.string().min(1).max(400) }),
  revalidate: (input) => [`/angajati/${input.employeeId}`, "/organigrama", "/departamente", "/angajati"],
  handler: async (ctx: ActionContext, input) => {
    const userId = await userIdAngajat(ctx, input.employeeId);
    if (!input.cale.startsWith(`${userId}/`)) {
      throw businessRule("Calea fișierului nu corespunde acestui angajat.");
    }
    const { error } = await ctx.supabase.rpc("set_member_avatar", {
      p_organization_id: ctx.tenant.organizationId,
      p_user_id: userId,
      p_avatar_path: input.cale,
    });
    if (error !== null) throw businessRule("Fotografia nu a putut fi salvată.");
    return { employeeId: input.employeeId };
  },
});
