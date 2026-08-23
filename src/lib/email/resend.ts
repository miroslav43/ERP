// src/lib/email/resend.ts
// Client Resend minimal, peste `fetch`. Fără pachetul `resend`: un singur endpoint HTTP
// nu justifică o dependență în plus (pachetul aduce și tipuri React-email de care nu avem nevoie).
import "server-only";
import { z } from "zod";
import { getEmailConfig } from "@/lib/email/config";

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

/**
 * Un atașament, cu conținutul deja codat base64.
 *
 * Resend acceptă `attachments: [{ filename, content }]`, unde `content` e
 * base64 pur, fără prefix `data:`. Limita lor e de 40 MB pe mesaj — un fluturaș
 * PDF are câțiva zeci de kilobytes, deci nu se atinge niciodată.
 */
export type AtasamentEmail = Readonly<{ filename: string; contentBase64: string }>;

export type ResendPayload = Readonly<{
  to: string;
  subject: string;
  html: string;
  text: string;
  atasamente?: readonly AtasamentEmail[];
}>;

export type ResendResult =
  Readonly<{ ok: true; id: string }> | Readonly<{ ok: false; error: string }>;

const okSchema = z.object({ id: z.string().min(1) });
const errSchema = z.object({ name: z.string().optional(), message: z.string().optional() });

const describeError = (status: number, raw: unknown): string => {
  const parsed = errSchema.safeParse(raw);
  const detaliu = parsed.success ? (parsed.data.message ?? parsed.data.name ?? "") : "";
  if (status === 401 || status === 403) return "Cheia Resend a fost respinsă (401/403).";
  if (status === 422) return `Resend a respins mesajul: ${detaliu || "date invalide"}.`;
  if (status === 429) return "Resend a limitat trimiterile (429). Reîncearcă mai târziu.";
  return `Resend a răspuns cu status ${status}${detaliu ? `: ${detaliu}` : ""}.`;
};

/**
 * Trimite efectiv prin Resend. Nu aruncă niciodată: întoarce un rezultat discriminat,
 * ca eșecul unui email să nu doboare acțiunea care l-a declanșat.
 * `idempotencyKey` este trimis și providerului, ca a doua plasă de siguranță.
 */
export async function trimiteViaResend(
  payload: ResendPayload,
  idempotencyKey: string,
): Promise<ResendResult> {
  const config = getEmailConfig();
  if (config.mode !== "live") {
    return { ok: false, error: "Clientul Resend a fost apelat în modul test." };
  }
  if (config.apiKey === null) {
    return { ok: false, error: "Lipsește RESEND_API_KEY, deși EMAIL_MODE este „live”." };
  }
  const body = {
    from: config.from,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    ...(config.replyTo === null ? {} : { reply_to: config.replyTo }),
    ...(payload.atasamente === undefined || payload.atasamente.length === 0
      ? {}
      : {
          attachments: payload.atasamente.map((a) => ({
            filename: a.filename,
            content: a.contentBase64,
          })),
        }),
  };
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: describeError(response.status, raw) };
    const parsed = okSchema.safeParse(raw);
    if (!parsed.success)
      return { ok: false, error: "Răspuns neașteptat de la Resend (lipsește id-ul)." };
    return { ok: true, id: parsed.data.id };
  } catch (cause) {
    const timeout =
      cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
    return {
      ok: false,
      error: timeout ? "Resend nu a răspuns în 10 secunde." : "Rețeaua către Resend a eșuat.",
    };
  }
}
