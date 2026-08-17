import { z } from "zod";

/**
 * Validarea variabilelor de mediu, executată la încărcarea modulului.
 *
 * Regula: o configurație greșită trebuie să oprească aplicația la boot, nu să
 * producă o eroare obscură la primul request al primului utilizator. De aceea
 * schema rulează la import, nu la cerere.
 *
 * Separarea client/server este structurală, nu convențională: `clientEnv` conține
 * exclusiv variabile `NEXT_PUBLIC_*`, iar `serverEnv` este protejat de
 * `server-only` prin fișierul care îl consumă. Next.js înlocuiește literalele
 * `process.env.NEXT_PUBLIC_*` la build, deci accesul trebuie scris explicit,
 * nu prin indexare dinamică.
 */

const base64Key = (bytes: number, eticheta: string) =>
  z
    .string()
    .min(1, `${eticheta} lipsește`)
    .refine((value) => {
      try {
        return Buffer.from(value, "base64").length === bytes;
      } catch {
        return false;
      }
    }, `${eticheta} trebuie să fie ${bytes} de octeți codificați base64 (generează cu: openssl rand -base64 ${bytes})`);

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL trebuie să fie un URL valid"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY lipsește"),
  NEXT_PUBLIC_APP_URL: z.url("NEXT_PUBLIC_APP_URL trebuie să fie un URL valid"),
});

/**
 * Cheile de criptare pentru datele sensibile (CNP, IBAN), indexate pe versiune.
 *
 * Structura pe versiuni permite rotația cheii fără re-criptarea întregii baze:
 * rândurile vechi păstrează `key_version` cu care au fost scrise, cele noi
 * folosesc cheia activă. O cheie nu se șterge niciodată din acest obiect cât
 * timp există măcar un rând scris cu ea.
 */
const encryptionKeysSchema = z
  .string()
  .min(1, "HR_ENCRYPTION_KEYS lipsește")
  .transform((raw, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: 'HR_ENCRYPTION_KEYS trebuie să fie JSON valid, ex: {"1":"<cheie base64>"}',
      });
      return z.NEVER;
    }
    const result = z.record(z.string(), base64Key(32, "Cheia de criptare")).safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: z.prettifyError(result.error) });
      return z.NEVER;
    }
    if (Object.keys(result.data).length === 0) {
      ctx.addIssue({ code: "custom", message: "HR_ENCRYPTION_KEYS nu conține nicio cheie" });
      return z.NEVER;
    }
    return result.data;
  });

const serverSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY lipsește"),
    HR_ENCRYPTION_KEYS: encryptionKeysSchema,
    HR_ENCRYPTION_ACTIVE_KEY: z.string().min(1, "HR_ENCRYPTION_ACTIVE_KEY lipsește"),
    TENANT_COOKIE_SECRET: base64Key(32, "TENANT_COOKIE_SECRET"),
    EMAIL_MODE: z.enum(["test", "live"]).default("test"),
    RESEND_API_KEY: z.string().default(""),
    EMAIL_FROM: z.string().min(1).default("Administrativo <noreply@administrativo.ro>"),
    RESEND_WEBHOOK_SECRET: z.string().default(""),
  })
  .refine((env) => env.HR_ENCRYPTION_ACTIVE_KEY in env.HR_ENCRYPTION_KEYS, {
    error: "HR_ENCRYPTION_ACTIVE_KEY nu are corespondent în HR_ENCRYPTION_KEYS",
    path: ["HR_ENCRYPTION_ACTIVE_KEY"],
  })
  .refine((env) => env.EMAIL_MODE !== "live" || env.RESEND_API_KEY.length > 0, {
    error: 'RESEND_API_KEY este obligatorie când EMAIL_MODE="live"',
    path: ["RESEND_API_KEY"],
  });

function parseOrExit<T extends z.ZodType>(
  schema: T,
  input: unknown,
  eticheta: string,
): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Configurație invalidă (${eticheta}):\n${z.prettifyError(result.error)}\n\n` +
        "Verifică `.env.local` față de `.env.example`.",
    );
  }
  return result.data;
}

export const clientEnv = parseOrExit(
  clientSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  "client",
);

/**
 * Variabilele de server nu se validează în browser: acolo nu există și
 * validarea ar arunca inutil. Modulele care le consumă sunt marcate
 * `server-only`, deci accesul din client eșuează deja la build.
 */
export const serverEnv =
  typeof window === "undefined"
    ? parseOrExit(serverSchema, process.env, "server")
    : (undefined as never);

export type ClientEnv = typeof clientEnv;
export type ServerEnv = z.output<typeof serverSchema>;
