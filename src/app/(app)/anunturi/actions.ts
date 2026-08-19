"use server";

import { createAction } from "@/lib/actions/create-action";
import { notFound } from "@/lib/actions/errors";
import { idFisaProprie } from "@/lib/queries/employees";
import type { ServerSupabase } from "@/lib/supabase/server";
import { anuntNouSchema, idAnuntSchema } from "@/schemas/announcement";

const CAI_REVALIDARE = ["/anunturi", "/portal"] as const;

/**
 * Trimite câte o notificare fiecărui membru activ — infrastructura exista deja
 * pregătită: `notification_kind` are valoarea `'announcement'`, iar politica de
 * INSERT pe `notifications` verifică deja explicit `announcements:create`
 * pentru cine poate scrie în numele altui utilizator.
 */
async function anunataMembrii(
  supabase: ServerSupabase,
  organizationId: string,
  announcementId: string,
  titlu: string,
): Promise<void> {
  const { data: membri, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null)
    .returns<{ user_id: string }[]>();
  if (error !== null) throw error;
  if (membri === null || membri.length === 0) return;

  const { error: eroareNotificari } = await supabase.from("notifications").insert(
    membri.map((m) => ({
      organization_id: organizationId,
      user_id: m.user_id,
      kind: "announcement" as const,
      title: "Anunț nou",
      body: titlu,
      link: `/anunturi/${announcementId}`,
      entity_type: "announcement",
      entity_id: announcementId,
    })),
  );
  if (eroareNotificari !== null) throw eroareNotificari;
}

export const creeazaAnunt = createAction({
  name: "announcements.create",
  feature: "announcements",
  permission: "announcements:create",
  minScope: "all",
  input: anuntNouSchema,
  audit: { action: "create", entityType: "announcement", allow: ["titlu", "fixat"] },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("announcements")
      .insert({
        organization_id: ctx.tenant.organizationId,
        titlu: input.titlu,
        continut: input.continut,
        fixat: input.fixat,
        publicat_la: input.publica_acum ? new Date().toISOString() : null,
        expira_la: input.expira_la,
      })
      .select("id")
      .single<{ id: string }>();
    if (error !== null) throw error;

    if (input.publica_acum) {
      await anunataMembrii(ctx.supabase, ctx.tenant.organizationId, data.id, input.titlu);
    }
    return { id: data.id };
  },
});

export const publicaAnunt = createAction({
  name: "announcements.publish",
  feature: "announcements",
  permission: "announcements:update",
  minScope: "all",
  input: idAnuntSchema,
  audit: { action: "update", entityType: "announcement", allow: ["id"] },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("announcements")
      .update({ publicat_la: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id, titlu")
      .maybeSingle<{ id: string; titlu: string }>();
    if (error !== null) throw error;
    if (data === null) throw notFound("Anunțul nu a fost găsit.");

    await anunataMembrii(ctx.supabase, ctx.tenant.organizationId, data.id, data.titlu);
    return null;
  },
});

/**
 * Marcarea „am citit" — pentru orice angajat, indiferent de scope, fiindcă
 * lectura e strict a propriei confirmări. `idFisaProprie` (nu clientul admin):
 * un angajat obișnuit are `employees:read` propriu prin coloana `user_id`, nu
 * are nevoie de ocolire.
 */
export const marcheazaAnuntCitit = createAction({
  name: "announcements.mark_read",
  feature: "announcements",
  permission: "announcements:read",
  minScope: "own",
  input: idAnuntSchema,
  audit: { action: "update", entityType: "announcement_read", allow: ["id"] },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const propriaFisaId = await idFisaProprie(ctx.tenant.organizationId, ctx.user.id);
    if (propriaFisaId === null) return null;

    const { data: existent, error: eroareCautare } = await ctx.supabase
      .from("announcement_reads")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("announcement_id", input.id)
      .eq("employee_id", propriaFisaId)
      .maybeSingle<{ id: string }>();
    if (eroareCautare !== null) throw eroareCautare;
    if (existent !== null) return null;

    const { error } = await ctx.supabase.from("announcement_reads").insert({
      organization_id: ctx.tenant.organizationId,
      announcement_id: input.id,
      employee_id: propriaFisaId,
      user_id: ctx.user.id,
    });
    if (error !== null) throw error;
    return null;
  },
});
