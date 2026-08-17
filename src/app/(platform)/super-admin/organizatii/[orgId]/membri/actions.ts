// src/app/(platform)/super-admin/organizatii/[orgId]/membri/actions.ts
"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/types";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  ETICHETE_ROL,
  schemaActiuneInvitatie,
  schemaActiuneMembru,
  schemaInvitatie,
  schemaSchimbareRol,
  ZILE_EXPIRARE_IMPLICIT,
  type RolAtribuibil,
} from "@/schemas/membership";

import {
  campuriInvalide,
  doarCampuri,
  esuat,
  idCerere,
  reusit,
  scrieAudit,
  traduEroareBd,
} from "../../../_lib/platform";

type ClientAdmin = ReturnType<typeof createAdminSupabase>;

type RandOrganizatie = Readonly<{
  id: string;
  name: string;
  seats_limit: number | null;
  status: "pending" | "active" | "suspended" | "archived";
}>;

type Context = Readonly<{ actorId: string; org: RandOrganizatie; admin: ClientAdmin }>;

const CAMPURI_INVITATIE = ["email", "role", "expires_at", "status"] as const;
const CAMPURI_MEMBRU = ["role", "status"] as const;
const ZI_IN_MS = 24 * 60 * 60 * 1000;

function dinValidare(eroare: z.ZodError, requestId: string): ActionResult<never> {
  return esuat(
    "VALIDARE",
    "Verifică datele introduse și încearcă din nou.",
    requestId,
    campuriInvalide(z.flattenError(eroare).fieldErrors),
  );
}

/**
 * Verifică dreptul (S1/S2) și încarcă organizația țintă. `organizationId` vine
 * din ruta panoului de super-admin, dar accesul este validat aici, server-side.
 */
async function context(
  organizationId: string,
  requestId: string,
): Promise<
  Readonly<{ ok: true; ctx: Context }> | Readonly<{ ok: false; eroare: ActionResult<never> }>
> {
  const actor = await requirePlatformAdmin().catch(() => null);
  if (!actor) {
    return {
      ok: false,
      eroare: esuat("INTERZIS", "Nu ai dreptul să administrezi membrii organizațiilor.", requestId),
    };
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("organizations")
    .select("id, name, seats_limit, status, deleted_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    const tradus = traduEroareBd(error.message);
    return { ok: false, eroare: esuat(tradus.code, tradus.message, requestId) };
  }
  if (!data || data.deleted_at !== null) {
    return { ok: false, eroare: esuat("NEGASIT", "Organizația nu a fost găsită.", requestId) };
  }

  const org: RandOrganizatie = {
    id: data.id,
    name: data.name,
    seats_limit: data.seats_limit,
    status: data.status,
  };
  return { ok: true, ctx: { actorId: actor.id, org, admin } };
}

async function numaraLocuri(
  admin: ClientAdmin,
  organizationId: string,
): Promise<Readonly<{ activi: number; invitatii: number; total: number }>> {
  const acum = new Date().toISOString();
  const [rezMembri, rezInvitatii] = await Promise.all([
    admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active"),
    admin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .gt("expires_at", acum),
  ]);
  const activi = rezMembri.count ?? 0;
  const invitatii = rezInvitatii.count ?? 0;
  return { activi, invitatii, total: activi + invitatii };
}

function mesajPlafon(limita: number, activi: number, invitatii: number): string {
  const membriText = activi === 1 ? "1 membru activ" : `${activi} membri activi`;
  const invitatiiText =
    invitatii === 1 ? "1 invitație în așteptare" : `${invitatii} invitații în așteptare`;
  return `Planul curent permite ${limita} utilizatori. Organizația are deja ${membriText} și ${invitatiiText}. Mărește plafonul de locuri din pagina organizației sau eliberează un loc înainte de a continua.`;
}

async function numaraAdminiActivi(admin: ClientAdmin, organizationId: string): Promise<number> {
  const { count } = await admin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "org_admin")
    .eq("status", "active");
  return count ?? 0;
}

async function bazaAplicatiei(): Promise<string> {
  const configurat = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configurat) return configurat.replace(/\/+$/, "");
  const antete = await headers();
  const gazda = antete.get("host") ?? "localhost:3000";
  const protocol =
    antete.get("x-forwarded-proto") ?? (gazda.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${gazda}`;
}

/**
 * Tokenul se generează aici, în Server Action. În bază se scrie DOAR amprenta
 * sha256; valoarea în clar există exclusiv în linkul returnat o singură dată.
 */
async function generateazaToken(): Promise<
  Readonly<{ token: string; hash: string; link: string }>
> {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const baza = await bazaAplicatiei();
  return { token, hash, link: `${baza}/invitatie/${token}` };
}

function reimprospateaza(organizationId: string): void {
  revalidatePath(`/super-admin/organizatii/${organizationId}/membri`);
}

export type RezultatInvitatie = Readonly<{
  invitationId: string;
  email: string;
  role: RolAtribuibil;
  expiraLa: string;
  linkInvitatie: string;
  mesaj: string;
}>;

export async function invitaMembru(raw: unknown): Promise<ActionResult<RezultatInvitatie>> {
  const requestId = idCerere();
  const parsare = schemaInvitatie.safeParse(raw);
  if (!parsare.success) return dinValidare(parsare.error, requestId);
  const input = parsare.data;

  const rezContext = await context(input.organizationId, requestId);
  if (!rezContext.ok) return rezContext.eroare;
  const { actorId, org, admin } = rezContext.ctx;

  if (org.status === "suspended" || org.status === "archived") {
    return esuat(
      "CONFLICT",
      "Organizația nu este activă, așa că nu poate primi membri noi. Reactiveaz-o mai întâi.",
      requestId,
    );
  }

  const email = input.email.trim().toLowerCase();

  const { data: profil } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profil) {
    const { data: membru } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", org.id)
      .eq("user_id", profil.id)
      .maybeSingle();
    if (membru) {
      return esuat("CONFLICT", "Această persoană face deja parte din organizație.", requestId, {
        email: ["Persoana este deja membru."],
      });
    }
  }

  const { data: invExistenta } = await admin
    .from("invitations")
    .select("id")
    .eq("organization_id", org.id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (invExistenta) {
    return esuat(
      "CONFLICT",
      "Există deja o invitație în așteptare pentru această adresă. Poți să o retrimiți sau să o revoci.",
      requestId,
      { email: ["Există deja o invitație în așteptare."] },
    );
  }

  const locuri = await numaraLocuri(admin, org.id);
  if (org.seats_limit !== null && locuri.total >= org.seats_limit) {
    return esuat(
      "LIMITA_DEPASITA",
      mesajPlafon(org.seats_limit, locuri.activi, locuri.invitatii),
      requestId,
    );
  }

  const { hash, link } = await generateazaToken();
  const expiraLa = new Date(Date.now() + input.expiraInZile * ZI_IN_MS).toISOString();

  const { data: invitatie, error } = await admin
    .from("invitations")
    .insert({
      organization_id: org.id,
      email,
      role: input.role,
      token_hash: hash,
      expires_at: expiraLa,
      status: "pending",
      invited_by: actorId,
    })
    .select("id, email, role, expires_at")
    .single();

  const server = await createServerSupabase();

  if (error || !invitatie) {
    const tradus = traduEroareBd(error?.message ?? "");
    await scrieAudit(server, {
      actiune: "invite_sent",
      status: "failure",
      organizationId: org.id,
      entityType: "invitations",
      entityId: null,
      before: null,
      after: doarCampuri({ email, role: input.role }, CAMPURI_INVITATIE),
      requestId,
      errorCode: tradus.code,
    });
    return esuat(tradus.code, tradus.message, requestId);
  }

  await scrieAudit(server, {
    actiune: "invite_sent",
    status: "success",
    organizationId: org.id,
    entityType: "invitations",
    entityId: invitatie.id,
    before: null,
    after: doarCampuri(
      {
        email: invitatie.email,
        role: invitatie.role,
        expires_at: invitatie.expires_at,
        status: "pending",
      },
      CAMPURI_INVITATIE,
    ),
    requestId,
  });

  reimprospateaza(org.id);

  return reusit({
    invitationId: invitatie.id,
    email: invitatie.email,
    role: input.role,
    expiraLa,
    linkInvitatie: link,
    mesaj: `Invitația pentru ${invitatie.email} a fost creată, cu rolul „${ETICHETE_ROL[input.role]}”.`,
  });
}

export type RezultatRetrimitere = Readonly<{
  invitationId: string;
  email: string;
  expiraLa: string;
  linkInvitatie: string;
  mesaj: string;
}>;

export async function retrimiteInvitatie(raw: unknown): Promise<ActionResult<RezultatRetrimitere>> {
  const requestId = idCerere();
  const parsare = schemaActiuneInvitatie.safeParse(raw);
  if (!parsare.success) return dinValidare(parsare.error, requestId);
  const input = parsare.data;

  const rezContext = await context(input.organizationId, requestId);
  if (!rezContext.ok) return rezContext.eroare;
  const { actorId, org, admin } = rezContext.ctx;

  const { data: invitatie } = await admin
    .from("invitations")
    .select("id, email, role, status")
    .eq("id", input.invitationId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!invitatie) return esuat("NEGASIT", "Invitația nu a fost găsită.", requestId);
  if (invitatie.status === "accepted") {
    return esuat("CONFLICT", "Invitația a fost deja acceptată.", requestId);
  }
  if (invitatie.status === "revoked") {
    return esuat(
      "CONFLICT",
      "Invitația a fost revocată. Trimite o invitație nouă pentru această adresă.",
      requestId,
    );
  }

  const { hash, link } = await generateazaToken();
  const expiraLa = new Date(Date.now() + ZILE_EXPIRARE_IMPLICIT * ZI_IN_MS).toISOString();

  const { error } = await admin
    .from("invitations")
    .update({ token_hash: hash, expires_at: expiraLa, status: "pending", invited_by: actorId })
    .eq("id", invitatie.id)
    .eq("organization_id", org.id);

  if (error) {
    const tradus = traduEroareBd(error.message);
    return esuat(tradus.code, tradus.message, requestId);
  }

  const server = await createServerSupabase();
  await scrieAudit(server, {
    actiune: "invite_sent",
    status: "success",
    organizationId: org.id,
    entityType: "invitations",
    entityId: invitatie.id,
    before: doarCampuri({ status: invitatie.status }, CAMPURI_INVITATIE),
    after: doarCampuri(
      { email: invitatie.email, role: invitatie.role, expires_at: expiraLa, status: "pending" },
      CAMPURI_INVITATIE,
    ),
    requestId,
  });

  reimprospateaza(org.id);

  return reusit({
    invitationId: invitatie.id,
    email: invitatie.email,
    expiraLa,
    linkInvitatie: link,
    mesaj: `Invitația pentru ${invitatie.email} a fost regenerată. Linkul anterior nu mai este valabil.`,
  });
}

export type RezultatSimplu = Readonly<{ mesaj: string }>;

export async function revocaInvitatie(raw: unknown): Promise<ActionResult<RezultatSimplu>> {
  const requestId = idCerere();
  const parsare = schemaActiuneInvitatie.safeParse(raw);
  if (!parsare.success) return dinValidare(parsare.error, requestId);
  const input = parsare.data;

  const rezContext = await context(input.organizationId, requestId);
  if (!rezContext.ok) return rezContext.eroare;
  const { org, admin } = rezContext.ctx;

  const { data: invitatie } = await admin
    .from("invitations")
    .select("id, email, status")
    .eq("id", input.invitationId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!invitatie) return esuat("NEGASIT", "Invitația nu a fost găsită.", requestId);
  if (invitatie.status !== "pending") {
    return esuat("CONFLICT", "Doar invitațiile în așteptare pot fi revocate.", requestId);
  }

  const { error } = await admin
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitatie.id)
    .eq("organization_id", org.id);

  if (error) {
    const tradus = traduEroareBd(error.message);
    return esuat(tradus.code, tradus.message, requestId);
  }

  const server = await createServerSupabase();
  await scrieAudit(server, {
    actiune: "invite_revoked",
    status: "success",
    organizationId: org.id,
    entityType: "invitations",
    entityId: invitatie.id,
    before: doarCampuri({ email: invitatie.email, status: "pending" }, CAMPURI_INVITATIE),
    after: doarCampuri({ email: invitatie.email, status: "revoked" }, CAMPURI_INVITATIE),
    requestId,
  });

  reimprospateaza(org.id);
  return reusit({ mesaj: `Invitația pentru ${invitatie.email} a fost revocată.` });
}

export async function schimbaRol(raw: unknown): Promise<ActionResult<RezultatSimplu>> {
  const requestId = idCerere();
  const parsare = schemaSchimbareRol.safeParse(raw);
  if (!parsare.success) return dinValidare(parsare.error, requestId);
  const input = parsare.data;

  const rezContext = await context(input.organizationId, requestId);
  if (!rezContext.ok) return rezContext.eroare;
  const { actorId, org, admin } = rezContext.ctx;

  const { data: membru } = await admin
    .from("organization_members")
    .select("id, user_id, role, status")
    .eq("id", input.memberId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!membru) return esuat("NEGASIT", "Membrul nu a fost găsit.", requestId);
  if (membru.user_id === actorId) {
    return esuat("CONFLICT", "Nu îți poți schimba propriul rol.", requestId);
  }
  if (membru.role === input.role) {
    return reusit({ mesaj: `Membrul avea deja rolul „${ETICHETE_ROL[input.role]}”.` });
  }

  if (membru.role === "org_admin" && membru.status === "active") {
    const adminiActivi = await numaraAdminiActivi(admin, org.id);
    if (adminiActivi <= 1) {
      return esuat(
        "CONFLICT",
        "Acesta este ultimul administrator activ al organizației. Promovează pe altcineva înainte de a-i schimba rolul.",
        requestId,
      );
    }
  }

  const { error } = await admin
    .from("organization_members")
    .update({ role: input.role })
    .eq("id", membru.id)
    .eq("organization_id", org.id);

  const server = await createServerSupabase();

  if (error) {
    const tradus = traduEroareBd(error.message);
    await scrieAudit(server, {
      actiune: "role_changed",
      status: "failure",
      organizationId: org.id,
      entityType: "organization_members",
      entityId: membru.id,
      before: doarCampuri({ role: membru.role }, CAMPURI_MEMBRU),
      after: doarCampuri({ role: input.role }, CAMPURI_MEMBRU),
      requestId,
      errorCode: tradus.code,
    });
    return esuat(tradus.code, tradus.message, requestId);
  }

  await scrieAudit(server, {
    actiune: "role_changed",
    status: "success",
    organizationId: org.id,
    entityType: "organization_members",
    entityId: membru.id,
    before: doarCampuri({ role: membru.role }, CAMPURI_MEMBRU),
    after: doarCampuri({ role: input.role }, CAMPURI_MEMBRU),
    requestId,
  });

  reimprospateaza(org.id);
  return reusit({ mesaj: `Rolul a fost schimbat în „${ETICHETE_ROL[input.role]}”.` });
}

export async function suspendaMembru(raw: unknown): Promise<ActionResult<RezultatSimplu>> {
  const requestId = idCerere();
  const parsare = schemaActiuneMembru.safeParse(raw);
  if (!parsare.success) return dinValidare(parsare.error, requestId);
  const input = parsare.data;

  const rezContext = await context(input.organizationId, requestId);
  if (!rezContext.ok) return rezContext.eroare;
  const { actorId, org, admin } = rezContext.ctx;

  const { data: membru } = await admin
    .from("organization_members")
    .select("id, user_id, role, status")
    .eq("id", input.memberId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!membru) return esuat("NEGASIT", "Membrul nu a fost găsit.", requestId);
  if (membru.user_id === actorId) {
    return esuat("CONFLICT", "Nu îți poți suspenda propriul cont.", requestId);
  }
  if (membru.status === "suspended") {
    return reusit({ mesaj: "Membrul era deja suspendat." });
  }
  if (membru.role === "org_admin" && membru.status === "active") {
    const adminiActivi = await numaraAdminiActivi(admin, org.id);
    if (adminiActivi <= 1) {
      return esuat(
        "CONFLICT",
        "Acesta este ultimul administrator activ al organizației și nu poate fi suspendat. Promovează mai întâi pe altcineva.",
        requestId,
      );
    }
  }

  const { error } = await admin
    .from("organization_members")
    .update({
      status: "suspended",
      deactivated_at: new Date().toISOString(),
      deactivated_by: actorId,
    })
    .eq("id", membru.id)
    .eq("organization_id", org.id);

  const server = await createServerSupabase();

  if (error) {
    const tradus = traduEroareBd(error.message);
    await scrieAudit(server, {
      actiune: "update",
      status: "failure",
      organizationId: org.id,
      entityType: "organization_members",
      entityId: membru.id,
      before: doarCampuri({ status: membru.status }, CAMPURI_MEMBRU),
      after: doarCampuri({ status: "suspended" }, CAMPURI_MEMBRU),
      requestId,
      errorCode: tradus.code,
    });
    return esuat(tradus.code, tradus.message, requestId);
  }

  await scrieAudit(server, {
    actiune: "update",
    status: "success",
    organizationId: org.id,
    entityType: "organization_members",
    entityId: membru.id,
    before: doarCampuri({ status: membru.status }, CAMPURI_MEMBRU),
    after: doarCampuri({ status: "suspended" }, CAMPURI_MEMBRU),
    requestId,
  });

  reimprospateaza(org.id);
  return reusit({ mesaj: "Membrul a fost suspendat și nu mai are acces la organizație." });
}

export async function reactiveazaMembru(raw: unknown): Promise<ActionResult<RezultatSimplu>> {
  const requestId = idCerere();
  const parsare = schemaActiuneMembru.safeParse(raw);
  if (!parsare.success) return dinValidare(parsare.error, requestId);
  const input = parsare.data;

  const rezContext = await context(input.organizationId, requestId);
  if (!rezContext.ok) return rezContext.eroare;
  const { org, admin } = rezContext.ctx;

  const { data: membru } = await admin
    .from("organization_members")
    .select("id, status")
    .eq("id", input.memberId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!membru) return esuat("NEGASIT", "Membrul nu a fost găsit.", requestId);
  if (membru.status === "active") return reusit({ mesaj: "Membrul era deja activ." });

  const locuri = await numaraLocuri(admin, org.id);
  if (org.seats_limit !== null && locuri.total >= org.seats_limit) {
    return esuat(
      "LIMITA_DEPASITA",
      mesajPlafon(org.seats_limit, locuri.activi, locuri.invitatii),
      requestId,
    );
  }

  const { error } = await admin
    .from("organization_members")
    .update({ status: "active", deactivated_at: null, deactivated_by: null })
    .eq("id", membru.id)
    .eq("organization_id", org.id);

  if (error) {
    const tradus = traduEroareBd(error.message);
    return esuat(tradus.code, tradus.message, requestId);
  }

  const server = await createServerSupabase();
  await scrieAudit(server, {
    actiune: "update",
    status: "success",
    organizationId: org.id,
    entityType: "organization_members",
    entityId: membru.id,
    before: doarCampuri({ status: membru.status }, CAMPURI_MEMBRU),
    after: doarCampuri({ status: "active" }, CAMPURI_MEMBRU),
    requestId,
  });

  reimprospateaza(org.id);
  return reusit({ mesaj: "Membrul a fost reactivat și are din nou acces." });
}
