// src/app/(app)/puncte-lucru/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { businessRule, mapPostgrestError, notFound } from "@/lib/actions/errors";
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
    // Dezactivarea unui punct de lucru n-are precondiție de business — nicio
    // tabelă nu-l referă — dar tăcerea tot NU e acceptabilă aici: `activ` nu
    // apare în `USING`-ul lui `puncte_lucru_update`, deci o a doua apăsare
    // atinge din nou același rând. Zero rânduri nu înseamnă niciodată „era deja
    // dezactivat”, ci rând șters logic (`deleted_at is null` în `USING`) sau
    // lipsa lui `departments:update = all`. Un mesaj de reușită acolo ar lăsa
    // punctul de lucru selectabil mai departe.
    const { data: punctDezactivat, error } = await db
      .from("puncte_lucru")
      .update({ activ: false, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (punctDezactivat === null) {
      throw businessRule(
        "Punctul de lucru nu a fost dezactivat: a fost șters între timp sau nu aveți dreptul de a modifica structura organizatorică. Reîncărcați pagina.",
      );
    }
    revalidatePath("/puncte-lucru");
    return { id: input.id };
  },
});
