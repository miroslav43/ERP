// src/schemas/auth.ts
import { z } from "zod";

/**
 * Cale internă. `//evil.com` și `/\evil.com` sunt URL-uri ABSOLUTE pentru browser
 * (protocol-relative), deci un simplu `startsWith("/")` nu este suficient.
 * Respingem și backslash-ul și spațiile albe, care pot fi normalizate diferit.
 */
const CALE_INTERNA = /^\/(?![/\\])[^\s\\]*$/;

export const internalPathSchema = z
  .string()
  .max(512, "Calea de redirecționare este prea lungă.")
  .regex(CALE_INTERNA, "Redirecționarea este permisă doar către o pagină din aplicație.");

/** Normalizează orice valoare venită din URL sau din formular la o cale internă sigură. */
export function caleInterna(brut: unknown, implicit = "/"): string {
  const rezultat = internalPathSchema.safeParse(typeof brut === "string" ? brut : "");
  return rezultat.success ? rezultat.data : implicit;
}

/** `searchParams` poate întoarce și `string[]`; luăm doar forma scalară. */
export function param(valoare: string | string[] | undefined): string | null {
  return typeof valoare === "string" ? valoare : null;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Adresa de e-mail este obligatorie.")
  .max(254, "Adresa de e-mail este prea lungă.")
  .pipe(z.email("Adresa de e-mail nu este validă."));

/** 72 = limita bcrypt; peste ea caracterele sunt tăcut ignorate la hashing. */
export const parolaSchema = z
  .string()
  .min(12, "Parola trebuie să aibă cel puțin 12 caractere.")
  .max(72, "Parola poate avea maximum 72 de caractere.");

export const autentificareSchema = z.object({
  email: emailSchema,
  parola: z.string().min(1, "Parola este obligatorie.").max(72),
});

export const linkMagicSchema = z.object({ email: emailSchema });

export const resetareParolaSchema = z.object({ email: emailSchema });

export const parolaNouaSchema = z
  .object({ parola: parolaSchema, confirmare: z.string() })
  .refine((v) => v.parola === v.confirmare, {
    error: "Cele două parole nu coincid.",
    path: ["confirmare"],
  });

/** Tokenul este `base64url(randomBytes(32))` = 43 de caractere. Acceptăm o marjă. */
export const tokenInvitatieSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{32,128}$/, "Invitația nu mai este validă.");

export type AutentificareInput = z.infer<typeof autentificareSchema>;
export type ParolaNouaInput = z.infer<typeof parolaNouaSchema>;
