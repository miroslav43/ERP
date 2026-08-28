// src/lib/invitatii/creeaza.ts
// Crearea unei invitații: locuri, duplicate, token, rând, e-mail.
//
// ── DE CE UN MODUL, ȘI NU UN APEL ÎNTRE ACȚIUNI ────────────────────────────
// `invitaMembru` e construit cu `createAction`, care nu întoarce o funcție
// obișnuită, ci un handler cu opt straturi proprii — autentificare, tenant,
// modul, permisiune, validare, audit, revalidare. Chemat din `inroleazaAngajat`,
// ar rula a doua oară TOT lanțul, cu ALTĂ permisiune cerută (`users:create`) și
// cu al doilea rând de audit pentru aceeași apăsare de buton.
//
// Aici stă doar munca: cele două verificări de business, tokenul, INSERT-ul și
// e-mailul. Cine o cheamă își aduce propriul context și propria permisiune —
// `users:create` din ecranul de membri, `employees:invite` de la înrolare.
import { createHash, randomBytes } from "node:crypto";

import { businessRule, limitExceeded, notFound } from "@/lib/actions/errors";
import { trimiteEmailInvitatie } from "@/lib/email/invitations";
import type { ServerSupabase } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

/** Șapte zile: destul cât să prindă un concediu scurt, nu cât să fie uitat. */
export const ZILE_VALABILITATE = 7;

export type RolInvitabil = "org_admin" | "manager" | "hr" | "employee";

export type ParametriInvitatie = Readonly<{
  db: ServerSupabase;
  organizationId: string;
  email: string;
  rol: RolInvitabil;
  /** Fișa de personal pe care o va prelua contul. NULL = invitație de membru pur. */
  employeeId?: string | null;
  /** Cine invită — apare în e-mail. */
  invitatDe: string;
  /**
   * `false` pentru adresele SINTETICE (`marca-0042@firma.intern`, vezi
   * `adresa.ts`): domeniul e rezervat prin RFC 8375 și n-are server. Un mesaj
   * trimis acolo nu eșuează util — se întoarce ca bounce, murdărește reputația
   * domeniului expeditor și umple `email_log` cu eșecuri care par defecte.
   * Invitația rămâne perfect validă; ajunge la om pe hârtie.
   */
  trimiteEmail?: boolean;
  userId: string;
  acum: Date;
}>;

export type InvitatieCreata = Readonly<{
  id: string;
  email: string;
  /** Tokenul în clar, întors o singură dată: linkul se compune din el. */
  token: string;
  emailTrimis: boolean;
}>;

export async function creeazaInvitatie(parametri: ParametriInvitatie): Promise<InvitatieCreata> {
  const { db, organizationId } = parametri;

  const limita = await consumeRateLimit({
    key: `invite:${organizationId}`,
    limit: 20,
    windowSeconds: 3600,
  });
  if (!limita.allowed) {
    throw limitExceeded("S-au trimis prea multe invitații în ultima oră. Reîncercați mai târziu.");
  }

  const email = parametri.email.trim().toLowerCase();

  const [{ count: membriActivi }, { data: invitatiiPendinte }, { data: organizatie }] =
    await Promise.all([
      db
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active"),
      db
        .from("invitations")
        .select("id, email")
        .eq("organization_id", organizationId)
        .eq("status", "pending"),
      db.from("organizations").select("seats_limit, name").eq("id", organizationId).maybeSingle(),
    ]);

  if (organizatie === null) throw notFound("Organizația nu a fost găsită.");

  const pendinte = invitatiiPendinte ?? [];
  if (pendinte.some((invitatie) => invitatie.email.toLowerCase() === email)) {
    throw businessRule("Există deja o invitație în așteptare pentru această adresă.");
  }
  if ((membriActivi ?? 0) + pendinte.length >= organizatie.seats_limit) {
    throw limitExceeded(
      `Ați atins limita de ${String(organizatie.seats_limit)} locuri. Dezactivați un membru sau extindeți contractul.`,
    );
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expira = new Date(parametri.acum.getTime() + ZILE_VALABILITATE * 24 * 60 * 60 * 1000);

  const { data, error } = await db
    .from("invitations")
    .insert({
      organization_id: organizationId,
      email,
      role: parametri.rol,
      token_hash: tokenHash,
      expires_at: expira.toISOString(),
      status: "pending",
      invited_by: parametri.userId,
      // Legătura cu fișa (0099). La acceptare, triggerul
      // `internal.membru_creeaza_fisa_de_angajat` scrie `employees.user_id`.
      employee_id: parametri.employeeId ?? null,
    })
    .select("id, email")
    .single();

  if (error !== null) throw error;

  // Linkul îl compune șablonul, din `NEXT_PUBLIC_APP_URL` validat la boot.
  // Construit aici, fiecare loc de apel ar putea produce alt domeniu, iar
  // `process.env` citit direct ar ocoli validarea din `config/env.ts`.
  let emailTrimis = false;
  if (parametri.trimiteEmail === false) {
    return { id: data.id, email: data.email, token, emailTrimis: false };
  }
  try {
    await trimiteEmailInvitatie({
      db,
      destinatar: email,
      organizatie: organizatie.name,
      invitatDe: parametri.invitatDe,
      rol: parametri.rol,
      token,
      expiraLa: expira.toISOString(),
      invitationId: data.id,
    });
    emailTrimis = true;
  } catch (eroare) {
    // Invitația rămâne validă chiar dacă e-mailul eșuează; linkul se poate copia
    // manual din ecranul de membri.
    console.error("[email] Invitația nu a putut fi trimisă", {
      invitationId: data.id,
      mesaj: eroare instanceof Error ? eroare.message : "necunoscut",
    });
  }

  return { id: data.id, email: data.email, token, emailTrimis };
}
