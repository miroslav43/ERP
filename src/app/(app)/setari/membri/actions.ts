// src/app/(app)/setari/membri/actions.ts
"use server";

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { creeazaInvitatie, type InvitatieCreata } from "@/lib/invitatii/creeaza";
import { numaraAdminiActivi, ROLURI_ATRIBUIBILE, schimbaRolul } from "@/lib/membri/schimba-rol";

// Aceeași listă și pentru invitație, și pentru schimbarea rolului: cine poate fi
// invitat e exact cine poate fi devenit. A doua copie a listei ar fi locul unde
// se despart tăcut.
const roluriInvitabile = z.enum(ROLURI_ATRIBUIBILE);

export type { InvitatieCreata };

export const invitaMembru = createAction({
  name: "members.invite",
  input: z.object({
    email: z.email("Adresa de e-mail nu este validă."),
    role: roluriInvitabile,
    jobTitle: z.string().trim().max(120).optional(),
  }),
  permission: "users:create",
  minScope: "all",
  audit: {
    action: "invite_sent",
    entityType: "invitations",
    entityId: (_input, data: InvitatieCreata) => data.id,
    // ALLOW-LIST: tokenul și hash-ul lui nu ajung NICIODATĂ în audit (S7).
    allow: ["email", "role"],
  },
  revalidate: ["/setari/membri"],
  handler: async (ctx, input): Promise<InvitatieCreata> =>
    // Munca stă în `@/lib/invitatii/creeaza`, ca s-o poată face și înrolarea
    // unui angajat. Aici rămâne doar contextul: cine invită și cu ce drept.
    creeazaInvitatie({
      db: ctx.supabase,
      organizationId: ctx.tenant.organizationId,
      email: input.email,
      rol: input.role,
      invitatDe: ctx.user.fullName ?? ctx.user.email,
      userId: ctx.user.id,
      acum: ctx.now,
    }),
});

export const revocaInvitatia = createAction({
  name: "members.revoke_invite",
  input: z.object({ invitationId: z.uuid() }),
  permission: "users:create",
  minScope: "all",
  audit: {
    action: "invite_revoked",
    entityType: "invitations",
    entityId: (input) => input.invitationId,
    allow: ["invitationId"],
  },
  revalidate: ["/setari/membri"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", input.invitationId)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error !== null) {
      throw error;
    }
    if (data === null) {
      throw notFound("Invitația nu mai există sau a fost deja folosită.");
    }
    return { id: data.id };
  },
});

export const schimbaRolulMembrului = createAction({
  name: "members.change_role",
  input: z.object({ memberId: z.uuid(), role: roluriInvitabile }),
  permission: "users:update",
  minScope: "all",
  audit: {
    action: "role_changed",
    entityType: "organization_members",
    entityId: (input) => input.memberId,
    allow: ["memberId", "role"],
  },
  revalidate: ["/setari/membri"],
  handler: async (ctx, input): Promise<Readonly<{ id: string; role: string }>> =>
    // Munca stă în `@/lib/membri/schimba-rol`, ca s-o poată face și pagina de
    // permisiuni a angajatului, și regula de la desemnarea unui șef de
    // departament. Aici rămâne doar contextul: cine schimbă și cu ce drept.
    schimbaRolul({
      db: ctx.supabase,
      organizationId: ctx.tenant.organizationId,
      memberId: input.memberId,
      rol: input.role,
      memberIdAutor: ctx.tenant.memberId,
    }),
});

export const seteazaStareaMembrului = createAction({
  name: "members.set_status",
  input: z.object({ memberId: z.uuid(), status: z.enum(["active", "suspended", "inactive"]) }),
  permission: "users:update",
  minScope: "all",
  audit: {
    action: "update",
    entityType: "organization_members",
    entityId: (input) => input.memberId,
    allow: ["memberId", "status"],
  },
  revalidate: ["/setari/membri"],
  handler: async (ctx, input): Promise<Readonly<{ id: string; status: string }>> => {
    if (input.memberId === ctx.tenant.memberId) {
      throw businessRule("Nu vă puteți dezactiva propriul cont din această organizație.");
    }
    if (
      input.status !== "active" &&
      (await numaraAdminiActivi(ctx.supabase, ctx.tenant.organizationId, input.memberId)) === 0
    ) {
      throw businessRule("Organizația trebuie să aibă cel puțin un administrator activ.");
    }

    const dezactivare =
      input.status === "active"
        ? { deactivated_at: null, deactivated_by: null }
        : { deactivated_at: ctx.now.toISOString(), deactivated_by: ctx.user.id };

    const { data, error } = await ctx.supabase
      .from("organization_members")
      .update({ status: input.status, ...dezactivare })
      .eq("id", input.memberId)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id, status")
      .maybeSingle();

    if (error !== null) {
      throw error;
    }
    if (data === null) {
      throw notFound("Membrul nu a fost găsit în această organizație.");
    }
    return { id: data.id, status: data.status };
  },
});
