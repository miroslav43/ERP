// src/lib/email/send.ts
import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { getEmailConfig } from "@/lib/email/config";
import { trimiteViaResend } from "@/lib/email/resend";
import { renderEmail, type EmailMessage } from "@/lib/email/templates";

/**
 * `db` este injectat de apelant (actions.ts / route.ts, singurele locuri unde e permis
 * importul clientului admin) — de aceea send.ts nu importă @/lib/supabase/admin.
 */
export type EmailDb = SupabaseClient<Database>;

const FEREASTRA_DEDUPE_SECUNDE = 300;
const adresaSchema = z.email();

export type SendEmailInput = EmailMessage &
  Readonly<{
    db: EmailDb;
    to: string;
    /** Entitatea care a declanșat emailul (id invitație, id user, id cerere demo). Intră în cheia de idempotență. */
    entityId: string;
    subject?: string;
    dedupeWindowSeconds?: number;
  }>;

export type SendEmailResult =
  | Readonly<{
      ok: true;
      status: "queued" | "sent" | "duplicat";
      logId: string | null;
      providerId: string | null;
    }>
  | Readonly<{
      ok: false;
      motiv: "adresa_invalida" | "config_lipsa" | "provider" | "baza_de_date";
      message: string;
      logId: string | null;
    }>;

/**
 * IDEMPOTENȚĂ, fără tabele noi: cheia (destinatar, șablon, entitate) este consumată prin
 * `consume_rate_limit` (tabela `rate_limits` din 1a) cu limit = 1 pe fereastra dată.
 * Funcția RPC face un UPSERT atomic cu contor în Postgres, deci două cereri concurente
 * nu pot primi ambele `allowed = true`: a doua vede contorul deja la 1 și e refuzată.
 * Adresa e hash-uită (sha256) ca să nu stocăm email-uri în chei de rate limit.
 */
const cheieDedupe = (template: string, entityId: string, to: string): string =>
  `email:${template}:${entityId}:${createHash("sha256").update(to).digest("hex").slice(0, 32)}`;

type LogInsert = Readonly<{
  destinatar: string;
  subiect: string;
  template: string;
  status: "queued";
}>;

async function insereazaLog(db: EmailDb, values: LogInsert): Promise<string | null> {
  const { data, error } = await db.from("email_log").insert(values).select("id").single();
  if (error !== null) {
    console.error("[email] inserare email_log eșuată", {
      template: values.template,
      message: error.message,
    });
    return null;
  }
  return data.id;
}

async function actualizeazaLog(
  db: EmailDb,
  id: string,
  patch: Readonly<{
    status: "sent" | "failed";
    providerId?: string;
    error?: string;
    sentAt?: string;
  }>,
): Promise<void> {
  const { error } = await db
    .from("email_log")
    .update({
      status: patch.status,
      ...(patch.providerId === undefined ? {} : { provider_id: patch.providerId }),
      ...(patch.error === undefined ? {} : { error: patch.error }),
      ...(patch.sentAt === undefined ? {} : { sent_at: patch.sentAt }),
    })
    .eq("id", id);
  if (error !== null) {
    console.error("[email] actualizare email_log eșuată", { id, message: error.message });
  }
}

/**
 * În modul „test” nu atinge rețeaua: scrie în email_log cu status „queued” și se oprește.
 * În modul „live” trimite prin Resend și înregistrează provider_id sau eroarea.
 * Nu aruncă niciodată — un email eșuat nu trebuie să anuleze acțiunea de business.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const destinatar = input.to.trim().toLowerCase();
  const adresa = adresaSchema.safeParse(destinatar);
  if (!adresa.success) {
    return {
      ok: false,
      motiv: "adresa_invalida",
      message: "Adresa de email nu este validă.",
      logId: null,
    };
  }

  const config = getEmailConfig();
  const fereastra = input.dedupeWindowSeconds ?? FEREASTRA_DEDUPE_SECUNDE;
  const cheie = cheieDedupe(input.template, input.entityId, adresa.data);
  const limita = await consumeRateLimit({ key: cheie, limit: 1, windowSeconds: fereastra });
  if (!limita.allowed) {
    return { ok: true, status: "duplicat", logId: null, providerId: null };
  }

  const randat = renderEmail(input, { appUrl: config.appUrl });
  const subiect = input.subject ?? randat.subject;
  const logId = await insereazaLog(input.db, {
    destinatar: adresa.data,
    subiect,
    template: input.template,
    status: "queued",
  });
  if (logId === null) {
    return {
      ok: false,
      motiv: "baza_de_date",
      message: "Emailul nu a putut fi înregistrat în jurnal.",
      logId: null,
    };
  }

  if (config.mode === "test") {
    return { ok: true, status: "queued", logId, providerId: null };
  }
  if (config.apiKey === null) {
    const mesaj = "Lipsește RESEND_API_KEY, deși EMAIL_MODE este „live”.";
    await actualizeazaLog(input.db, logId, { status: "failed", error: mesaj });
    return { ok: false, motiv: "config_lipsa", message: mesaj, logId };
  }

  const rezultat = await trimiteViaResend(
    { to: adresa.data, subject: subiect, html: randat.html, text: randat.text },
    cheie,
  );
  if (!rezultat.ok) {
    await actualizeazaLog(input.db, logId, { status: "failed", error: rezultat.error });
    return { ok: false, motiv: "provider", message: rezultat.error, logId };
  }
  await actualizeazaLog(input.db, logId, {
    status: "sent",
    providerId: rezultat.id,
    sentAt: new Date().toISOString(),
  });
  return { ok: true, status: "sent", logId, providerId: rezultat.id };
}
