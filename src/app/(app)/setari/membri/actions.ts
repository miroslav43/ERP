// src/app/(app)/setari/membri/actions.ts
"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, limitExceeded, notFound } from "@/lib/actions/errors";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { trimiteEmailInvitatie } from "@/lib/email/invitations";

const ZILE_VALABILITATE = 7;
const roluriInvitabile = z.enum(["org_admin", "manager", "hr", "employee"]);

export type InvitatieCreata = Readonly<{
  id: string;
  email: string;
  /** Tokenul în clar, returnat o singură dată: linkul se compune din el. */
  token: string;
  emailTrimis: boolean;
}>;

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
  handler: async (ctx, input): Promise<InvitatieCreata> => {
    const limita = await consumeRateLimit({
      key: `invite:${ctx.tenant.organizationId}`,
      limit: 20,
      windowSeconds: 3600,
    });
    if (!limita.allowed) {
      throw limitExceeded(
        "S-au trimis prea multe invitații în ultima oră. Reîncercați mai târziu.",
      );
    }

    const email = input.email.trim().toLowerCase();

    const [{ count: membriActivi }, { data: invitatiiPendinte }, { data: organizatie }] =
      await Promise.all([
        ctx.supabase
          .from("organization_members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", ctx.tenant.organizationId)
          .eq("status", "active"),
        ctx.supabase
          .from("invitations")
          .select("id, email")
          .eq("organization_id", ctx.tenant.organizationId)
          .eq("status", "pending"),
        ctx.supabase
          .from("organizations")
          .select("seats_limit, name")
          .eq("id", ctx.tenant.organizationId)
          .maybeSingle(),
      ]);

    if (organizatie === null) {
      throw notFound("Organizația nu a fost găsită.");
    }
    const pendinte = invitatiiPendinte ?? [];
    if (pendinte.some((invitatie) => invitatie.email.toLowerCase() === email)) {
      throw businessRule("Există deja o invitație în așteptare pentru această adresă.");
    }
    if ((membriActivi ?? 0) + pendinte.length >= organizatie.seats_limit) {
      throw limitExceeded(
        `Ați atins limita de ${organizatie.seats_limit} locuri. Dezactivați un membru sau extindeți contractul.`,
      );
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expira = new Date(ctx.now.getTime() + ZILE_VALABILITATE * 24 * 60 * 60 * 1000);

    const { data, error } = await ctx.supabase
      .from("invitations")
      .insert({
        organization_id: ctx.tenant.organizationId,
        email,
        role: input.role,
        token_hash: tokenHash,
        expires_at: expira.toISOString(),
        status: "pending",
        invited_by: ctx.user.id,
      })
      .select("id, email")
      .single();

    if (error !== null) {
      throw error;
    }

    // Linkul îl compune șablonul, din `NEXT_PUBLIC_APP_URL` validat la boot.
    // Construit aici, fiecare loc de apel ar putea produce alt domeniu, iar
    // `process.env` citit direct ar ocoli validarea din `config/env.ts`.
    let emailTrimis = false;
    try {
      await trimiteEmailInvitatie({
        db: ctx.supabase,
        destinatar: email,
        organizatie: organizatie.name,
        invitatDe: ctx.user.fullName ?? ctx.user.email,
        rol: input.role,
        token,
        expiraLa: expira.toISOString(),
        invitationId: data.id,
      });
      emailTrimis = true;
    } catch (eroare) {
      // Invitația rămâne validă chiar dacă e-mailul eșuează; linkul se poate copia manual.
      console.error("[email] Invitația nu a putut fi trimisă", {
        invitationId: data.id,
        mesaj: eroare instanceof Error ? eroare.message : "necunoscut",
      });
    }

    return { id: data.id, email: data.email, token, emailTrimis };
  },
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

async function numaraAdminiActivi(
  ctx: Parameters<Parameters<typeof createAction>[0]["handler"]>[0],
  exceptaMembrul: string,
): Promise<number> {
  const { count } = await ctx.supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.tenant.organizationId)
    .eq("role", "org_admin")
    .eq("status", "active")
    .neq("id", exceptaMembrul);
  return count ?? 0;
}

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
  handler: async (ctx, input): Promise<Readonly<{ id: string; role: string }>> => {
    if (input.memberId === ctx.tenant.memberId) {
      throw businessRule("Nu vă puteți schimba propriul rol. Rugați alt administrator.");
    }
    if (input.role !== "org_admin" && (await numaraAdminiActivi(ctx, input.memberId)) === 0) {
      throw businessRule("Organizația trebuie să aibă cel puțin un administrator activ.");
    }

    const { data, error } = await ctx.supabase
      .from("organization_members")
      .update({ role: input.role })
      .eq("id", input.memberId)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id, role")
      .maybeSingle();

    if (error !== null) {
      throw error;
    }
    if (data === null) {
      throw notFound("Membrul nu a fost găsit în această organizație.");
    }
    return { id: data.id, role: data.role };
  },
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
    if (input.status !== "active" && (await numaraAdminiActivi(ctx, input.memberId)) === 0) {
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
