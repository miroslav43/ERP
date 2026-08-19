// src/app/(app)/puncte-lucru/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { mapPostgrestError, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaPunctLucruSchema,
  creeazaPunctLucruSchema,
  dezactiveazaPunctLucruSchema,
} from "@/schemas/punct-lucru";

type PunctLucruIdentificat = Readonly<{ id: string }>;

const CAMPURI_AUDITATE = [
  "denumire",
  "adresa",
  "judet",
  "oras",
  "cod_postal",
  "sediu_principal",
  "observatii",
] as const;

export const creeazaPunctLucru = createAction<
  typeof creeazaPunctLucruSchema,
  PunctLucruIdentificat
>({
  name: "puncte_lucru.create",
  permission: "departments:create",
  minScope: "all",
  input: creeazaPunctLucruSchema,
  audit: {
    action: "create",
    entityType: "puncte_lucru",
    entityId: (_input, data) => data.id,
    allow: CAMPURI_AUDITATE,
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("puncte_lucru")
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
    revalidatePath("/puncte-lucru");
    return { id: data.id };
  },
});

export const actualizeazaPunctLucru = createAction<
  typeof actualizeazaPunctLucruSchema,
  PunctLucruIdentificat
>({
  name: "puncte_lucru.update",
  permission: "departments:update",
  minScope: "all",
  input: actualizeazaPunctLucruSchema,
  audit: {
    action: "update",
    entityType: "puncte_lucru",
    entityId: (input) => input.id,
    allow: CAMPURI_AUDITATE,
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;
    const { data, error } = await db
      .from("puncte_lucru")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) throw notFound("Punctul de lucru nu a fost găsit.");
    revalidatePath("/puncte-lucru");
    return { id };
  },
});

export const dezactiveazaPunctLucru = createAction<
  typeof dezactiveazaPunctLucruSchema,
  PunctLucruIdentificat
>({
  name: "puncte_lucru.deactivate",
  permission: "departments:update",
  minScope: "all",
  input: dezactiveazaPunctLucruSchema,
  audit: {
    action: "update",
    entityType: "puncte_lucru",
    entityId: (input) => input.id,
    allow: [],
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { error } = await db
      .from("puncte_lucru")
      .update({ activ: false, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    revalidatePath("/puncte-lucru");
    return { id: input.id };
  },
});
