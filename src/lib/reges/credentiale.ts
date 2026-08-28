// src/lib/reges/credentiale.ts
import "server-only";

/**
 * Citirea și scrierea cheilor API REGES ale unei firme-client.
 *
 * DE CE PRIN RPC ȘI NU DIRECT PE TABELĂ
 * `reges_credentiale` are toate privilegiile revocate pentru `authenticated` și
 * nicio politică RLS: refuz total, deliberat. Accesul trece prin
 * `reges_read_credentiale` / `reges_write_credentiale`, care verifică
 * `reges:configure = all` și scriu în `audit_logs` NUMELE câmpurilor atinse,
 * niciodată valorile. Un `select` direct ar fi o cale care ocolește auditul.
 *
 * DE CE REFOLOSIM `HR_ENCRYPTION_KEYS`
 * Aceeași cheie AES-256-GCM care protejează CNP-urile și IBAN-urile. Un al
 * doilea set de chei ar însemna un al doilea secret de rotit, de pus în
 * `docker secret` și de pierdut. Compromisul: cine are cheia HR are și cheile
 * REGES — dar cine are cheia HR are deja CNP-urile tuturor angajaților, deci
 * separarea n-ar apăra nimic în plus.
 */

import {
  catreBytea,
  decrypt,
  dinBytea,
  encrypt,
  versiuneCaNumar,
  versiuneaActiva,
} from "@/lib/crypto/aes-gcm";
import type { createServerSupabase } from "@/lib/supabase/server";
import type { Mediu } from "./client";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type CredentialeReges = Readonly<{
  organizationId: string;
  mediu: Mediu;
  cuiAngajator: string;
  clientId: string;
  utilizator: string;
  clientSecret: string;
  parola: string;
  consumerId: string;
  activ: boolean;
}>;

export type RezumatCredentiale = Readonly<{
  organizationId: string;
  mediu: Mediu;
  cuiAngajator: string;
  clientId: string;
  utilizator: string;
  consumerId: string;
  areSecret: boolean;
  areParola: boolean;
  tokenExpiraLa: string | null;
  verificatLa: string | null;
  verificatOk: boolean | null;
  verificatMesaj: string | null;
  activ: boolean;
}>;

/** Cvartetul criptografic, așa cum vine din bază. */
type Cvartet = Readonly<{
  ciphertext: string | null;
  iv: string | null;
  tag: string | null;
  keyVersion: number | null;
}>;

function descifreaza(c: Cvartet): string | null {
  if (c.ciphertext === null || c.iv === null || c.tag === null || c.keyVersion === null) {
    return null;
  }
  return decrypt({
    ciphertext: dinBytea(c.ciphertext),
    iv: dinBytea(c.iv),
    tag: dinBytea(c.tag),
    keyVersion: String(c.keyVersion),
  });
}

function cifreaza(valoare: string, prefix: string): Record<string, string | number> {
  const criptat = encrypt(valoare, versiuneaActiva());
  return {
    [`p_${prefix}_ciphertext`]: catreBytea(criptat.ciphertext),
    [`p_${prefix}_iv`]: catreBytea(criptat.iv),
    [`p_${prefix}_tag`]: catreBytea(criptat.tag),
    [`p_${prefix}_key_version`]: versiuneCaNumar(criptat.keyVersion),
  };
}

/**
 * Rezumatul pentru ecranul de setări: ce e configurat, fără secretele în clar.
 *
 * Întoarce `null` pentru „nu e configurat" — o stare normală, nu o eroare.
 */
export async function citesteRezumatCredentiale(
  db: ServerSupabase,
  organizationId: string,
): Promise<RezumatCredentiale | null> {
  const { data, error } = await db.rpc("reges_read_credentiale", { p_org: organizationId });
  if (error !== null) throw error;

  const rand = Array.isArray(data) ? data[0] : null;
  if (rand === null || rand === undefined) return null;

  return {
    organizationId: rand.organization_id,
    mediu: rand.mediu as Mediu,
    cuiAngajator: rand.cui_angajator,
    clientId: rand.client_id,
    utilizator: rand.utilizator,
    consumerId: rand.consumer_id,
    areSecret: rand.client_secret_ciphertext !== null,
    areParola: rand.parola_ciphertext !== null,
    tokenExpiraLa: rand.token_expira_la,
    verificatLa: rand.verificat_la,
    verificatOk: rand.verificat_ok,
    verificatMesaj: rand.verificat_mesaj,
    activ: rand.activ,
  };
}

/**
 * Credențialele complete, descifrate. Numai pentru apelul efectiv către REGES.
 *
 * Întoarce `null` dacă firma n-are configurare completă — apelantul nu trebuie
 * să distingă „lipsă" de „incompletă": în ambele cazuri nu se poate transmite.
 */
export async function citesteCredentiale(
  db: ServerSupabase,
  organizationId: string,
): Promise<CredentialeReges | null> {
  const { data, error } = await db.rpc("reges_read_credentiale", { p_org: organizationId });
  if (error !== null) throw error;

  const rand = Array.isArray(data) ? data[0] : null;
  if (rand === null || rand === undefined) return null;

  const clientSecret = descifreaza({
    ciphertext: rand.client_secret_ciphertext,
    iv: rand.client_secret_iv,
    tag: rand.client_secret_tag,
    keyVersion: rand.client_secret_key_version,
  });
  const parola = descifreaza({
    ciphertext: rand.parola_ciphertext,
    iv: rand.parola_iv,
    tag: rand.parola_tag,
    keyVersion: rand.parola_key_version,
  });
  if (clientSecret === null || parola === null) return null;

  return {
    organizationId: rand.organization_id,
    mediu: rand.mediu as Mediu,
    cuiAngajator: rand.cui_angajator,
    clientId: rand.client_id,
    utilizator: rand.utilizator,
    clientSecret,
    parola,
    consumerId: rand.consumer_id,
    activ: rand.activ,
  };
}

export type ScriereCredentiale = Readonly<{
  organizationId: string;
  mediu: Mediu;
  cuiAngajator: string;
  clientId: string;
  utilizator: string;
  /** `null` = nu s-a atins câmpul; funcția SQL păstrează valoarea existentă. */
  clientSecret: string | null;
  parola: string | null;
}>;

export async function scrieCredentiale(
  db: ServerSupabase,
  input: ScriereCredentiale,
): Promise<void> {
  const { error } = await db.rpc("reges_write_credentiale", {
    p_org: input.organizationId,
    p_mediu: input.mediu,
    p_cui_angajator: input.cuiAngajator,
    p_client_id: input.clientId,
    p_utilizator: input.utilizator,
    // Absența cheilor din obiect e semnalul „nu s-a atins": funcția SQL face
    // `coalesce(excluded.x, c.x)`, deci `null` păstrează valoarea veche.
    ...(input.clientSecret === null ? {} : cifreaza(input.clientSecret, "client_secret")),
    ...(input.parola === null ? {} : cifreaza(input.parola, "parola")),
  });
  if (error !== null) throw error;
}
