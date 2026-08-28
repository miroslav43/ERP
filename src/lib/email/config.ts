// src/lib/email/config.ts
// Configurarea emailului. Funcție PURĂ peste `env` ca să poată fi testată fără process.env,
// plus un getter memoizat (inițializare leneșă) pentru runtime.
import { z } from "zod";

import { optional } from "@/schemas/comun";

export type EmailMode = "test" | "live";

export type EmailConfig = Readonly<{
  mode: EmailMode;
  apiKey: string | null;
  from: string;
  replyTo: string | null;
  appUrl: string;
  echipaEmail: string | null;
  webhookSecret: string | null;
}>;

/*
 * ── DE CE `optional()`, ȘI NU `.optional()` ─────────────────────────────────
 * `docker-stack.yml:62` trimite `RESEND_WEBHOOK_SECRET=${RESEND_WEBHOOK_SECRET:-}`,
 * adică ȘIRUL GOL când variabila nu e definită. `.optional()` acceptă
 * `undefined`, nu `""`, deci `.min(1)` respingea valoarea, `resolveEmailConfig`
 * arunca, iar `getEmailConfig()` cădea la PRIMUL apel.
 *
 * Efectul: NICIUN e-mail nu a plecat vreodată din aplicație. Nici invitațiile,
 * nici fluturașii. Toți apelanții prind excepția și o scriu în jurnal, deci
 * defectul era complet mut: `email_log` a rămas gol de la începutul
 * proiectului, iar invitații primeau doar mesajul implicit al Supabase.
 *
 * O variabilă de mediu setată pe gol înseamnă „neconfigurată", niciodată
 * „invalidă”. `optional()` din `@/schemas/comun` e exact ajutorul scris pentru
 * capcana asta — aceeași care ținuse modulul de cursuri mort la scriere.
 */
const envSchema = z.object({
  EMAIL_MODE: z.enum(["test", "live"]).default("test"),
  RESEND_API_KEY: optional(z.string().min(1)),
  RESEND_WEBHOOK_SECRET: optional(z.string().min(1)),
  EMAIL_FROM: z.string().min(5).default("Administrativo <notificari@administrativo.ro>"),
  EMAIL_REPLY_TO: optional(z.email()),
  EMAIL_ECHIPA: optional(z.email()),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

/** Elimină slash-ul final ca linkurile din șabloane să nu conțină „//”. */
const normalizeUrl = (value: string): string => value.replace(/\/+$/, "");

export const resolveEmailConfig = (env: Record<string, string | undefined>): EmailConfig => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Configurare email invalidă:\n${z.prettifyError(parsed.error)}`);
  }
  const value = parsed.data;
  return {
    mode: value.EMAIL_MODE,
    apiKey: value.RESEND_API_KEY,
    from: value.EMAIL_FROM,
    replyTo: value.EMAIL_REPLY_TO,
    appUrl: normalizeUrl(value.NEXT_PUBLIC_APP_URL),
    echipaEmail: value.EMAIL_ECHIPA,
    webhookSecret: value.RESEND_WEBHOOK_SECRET,
  };
};

let cached: EmailConfig | null = null;

export const getEmailConfig = (): EmailConfig => {
  if (cached === null) {
    cached = resolveEmailConfig(process.env);
  }
  return cached;
};

/** Doar pentru teste: golește memoizarea. */
export const resetEmailConfigCache = (): void => {
  cached = null;
};
