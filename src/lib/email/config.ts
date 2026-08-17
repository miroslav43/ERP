// src/lib/email/config.ts
// Configurarea emailului. Funcție PURĂ peste `env` ca să poată fi testată fără process.env,
// plus un getter memoizat (inițializare leneșă) pentru runtime.
import { z } from "zod";

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

const envSchema = z.object({
  EMAIL_MODE: z.enum(["test", "live"]).default("test"),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(5).default("Administrativo <notificari@administrativo.ro>"),
  EMAIL_REPLY_TO: z.email().optional(),
  EMAIL_ECHIPA: z.email().optional(),
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
    apiKey: value.RESEND_API_KEY ?? null,
    from: value.EMAIL_FROM,
    replyTo: value.EMAIL_REPLY_TO ?? null,
    appUrl: normalizeUrl(value.NEXT_PUBLIC_APP_URL),
    echipaEmail: value.EMAIL_ECHIPA ?? null,
    webhookSecret: value.RESEND_WEBHOOK_SECRET ?? null,
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
