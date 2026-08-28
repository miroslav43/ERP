// src/lib/reges/jeton.ts
import "server-only";

/**
 * Jetonul OIDC al fiecărei firme-client, obținut de la Keycloak-ul REGES.
 *
 * FLUXUL, VERIFICAT EMPIRIC
 * Ambele medii rulează Keycloak, realm `API`. Documentele de discovery
 * (`/.well-known/openid-configuration`) declară `password` și `refresh_token`
 * printre `grant_types_supported`, iar `client_secret_post` printre metodele de
 * autentificare a clientului. Deci fluxul e ROPC: `client_id` + `client_secret`
 * + `username` + `password`, toate patru ale ANGAJATORULUI. Nu există o cheie
 * globală a dezvoltatorului — `client_secret`-ul publicat în documentația
 * oficială e al mediului de TEST, iar în producție fiecare firmă își generează
 * cheile din portalul propriu.
 *
 * CINE ATINGE TABELA
 * `reges_credentiale` n-are nicio politică RLS și niciun privilegiu pentru
 * `authenticated`: jetonul se citește și se scrie exclusiv cu clientul de
 * serviciu, primit ca argument. Modulul nu-l creează el însuși — ESLint permite
 * `createAdminSupabase` doar în `actions.ts`, `api/**\/route.ts` și scripturi, iar
 * regula e acolo tocmai ca ocolirea RLS să fie vizibilă la locul apelului.
 */

import { catreBytea, decrypt, dinBytea, encrypt, versiuneCaNumar } from "@/lib/crypto/aes-gcm";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { BAZE_SSO, type Mediu } from "./client";
import type { CredentialeReges } from "./credentiale";

const TERMEN_MS = 15_000;
/** Se reîmprospătează cu un minut înainte de expirare, nu la expirare. */
const MARJA_SECUNDE = 60;

export type RezultatJeton =
  | Readonly<{ ok: true; jeton: string; expiraLa: Date }>
  | Readonly<{ ok: false; motiv: "credentiale" | "indisponibil"; mesaj: string }>;

type RaspunsKeycloak = Readonly<{
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
}>;

function urlToken(mediu: Mediu): string {
  return `${BAZE_SSO[mediu]}/protocol/openid-connect/token`;
}

async function cereJeton(
  mediu: Mediu,
  corp: URLSearchParams,
): Promise<RezultatJeton & { reimprospatare?: string }> {
  try {
    const raspuns = await fetch(urlToken(mediu), {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(TERMEN_MS),
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: corp,
    });

    const brut = await raspuns.text();
    if (!raspuns.ok) {
      // Keycloak distinge `invalid_grant` (parolă greșită sau refresh expirat)
      // de `unauthorized_client` (client_id/secret greșite). Ambele sunt
      // probleme de configurare, nu pene — reîncercarea n-ar ajuta.
      const detaliu = brut.length > 300 ? `${brut.slice(0, 300)}…` : brut;
      return {
        ok: false,
        motiv: raspuns.status === 400 || raspuns.status === 401 ? "credentiale" : "indisponibil",
        mesaj:
          raspuns.status === 400 || raspuns.status === 401
            ? `Inspecția Muncii a refuzat cheile API (${raspuns.status}). Verificați-le în portalul REGES, la „Setări → Acces → Chei API". ${detaliu}`
            : `Serverul de autentificare al Inspecției Muncii a răspuns cu ${raspuns.status}.`,
      };
    }

    const date = JSON.parse(brut) as RaspunsKeycloak;
    if (typeof date.access_token !== "string" || date.access_token === "") {
      return {
        ok: false,
        motiv: "indisponibil",
        mesaj: "Răspunsul de autentificare n-a conținut niciun jeton.",
      };
    }
    const secunde = typeof date.expires_in === "number" ? date.expires_in : 300;

    return {
      ok: true,
      jeton: date.access_token,
      expiraLa: new Date(Date.now() + secunde * 1000),
      ...(typeof date.refresh_token === "string" ? { reimprospatare: date.refresh_token } : {}),
    };
  } catch (eroare) {
    const nume = eroare instanceof Error ? eroare.name : "";
    return {
      ok: false,
      motiv: "indisponibil",
      mesaj:
        nume === "TimeoutError" || nume === "AbortError"
          ? "Serverul de autentificare al Inspecției Muncii nu a răspuns la timp."
          : "Nu s-a putut deschide legătura cu serverul de autentificare al Inspecției Muncii.",
    };
  }
}

/** Autentificare de la zero, cu utilizator și parolă. */
export function autentifica(cred: CredentialeReges) {
  return cereJeton(
    cred.mediu,
    new URLSearchParams({
      grant_type: "password",
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
      username: cred.utilizator,
      password: cred.parola,
    }),
  );
}

function reimprospateaza(cred: CredentialeReges, jetonReimprospatare: string) {
  return cereJeton(
    cred.mediu,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
      refresh_token: jetonReimprospatare,
    }),
  );
}

type JetonStocat = Readonly<{
  jeton: string | null;
  reimprospatare: string | null;
  expiraLa: Date | null;
}>;

async function citesteJetonStocat(db: AdminSupabase, organizationId: string): Promise<JetonStocat> {
  const { data, error } = await db
    .from("reges_credentiale")
    // Șirul rămâne UN SINGUR literal, deliberat. Concatenat cu `+`, TypeScript îl
    // vede ca `string` oarecare, iar supabase-js nu mai poate infera forma
    // rândului: `data` devine `GenericStringError` și fiecare coloană dă TS2339.
    // Alternativa — un generic explicit — ar înlocui tipul GENERAT cu unul scris
    // de mână, exact ce prinde `src/lib/queries/coloane.test.ts`.
    // prettier-ignore
    .select(
      "acces_token_ciphertext, acces_token_iv, acces_token_tag, acces_token_key_version, reimprospatare_ciphertext, reimprospatare_iv, reimprospatare_tag, reimprospatare_key_version, token_expira_la",
    )
    // Filtru explicit pe organizație: clientul de serviciu ocolește RLS, deci
    // izolarea între firme e răspunderea acestei linii.
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  if (data === null) return { jeton: null, reimprospatare: null, expiraLa: null };

  const desfa = (ct: string | null, iv: string | null, tag: string | null, ver: number | null) =>
    ct === null || iv === null || tag === null || ver === null
      ? null
      : decrypt({
          ciphertext: dinBytea(ct),
          iv: dinBytea(iv),
          tag: dinBytea(tag),
          keyVersion: String(ver),
        });

  return {
    jeton: desfa(
      data.acces_token_ciphertext,
      data.acces_token_iv,
      data.acces_token_tag,
      data.acces_token_key_version,
    ),
    reimprospatare: desfa(
      data.reimprospatare_ciphertext,
      data.reimprospatare_iv,
      data.reimprospatare_tag,
      data.reimprospatare_key_version,
    ),
    expiraLa: data.token_expira_la === null ? null : new Date(data.token_expira_la),
  };
}

async function salveazaJeton(
  db: AdminSupabase,
  organizationId: string,
  jeton: string,
  reimprospatare: string | null,
  expiraLa: Date,
): Promise<void> {
  const a = encrypt(jeton);
  const r = reimprospatare === null ? null : encrypt(reimprospatare);
  const { error } = await db
    .from("reges_credentiale")
    .update({
      acces_token_ciphertext: catreBytea(a.ciphertext),
      acces_token_iv: catreBytea(a.iv),
      acces_token_tag: catreBytea(a.tag),
      acces_token_key_version: versiuneCaNumar(a.keyVersion),
      ...(r === null
        ? {}
        : {
            reimprospatare_ciphertext: catreBytea(r.ciphertext),
            reimprospatare_iv: catreBytea(r.iv),
            reimprospatare_tag: catreBytea(r.tag),
            reimprospatare_key_version: versiuneCaNumar(r.keyVersion),
          }),
      token_expira_la: expiraLa.toISOString(),
    })
    .eq("organization_id", organizationId);
  if (error !== null) throw error;
}

/**
 * Jetonul valid al firmei: din cache dacă mai ține, reîmprospătat dacă se poate,
 * obținut de la zero altfel.
 *
 * Ordinea contează. Reîmprospătarea e mai ieftină și nu trece parola prin rețea;
 * dar dacă `refresh_token` a expirat și el, Keycloak întoarce `invalid_grant`,
 * iar căderea pe autentificare completă e singura care nu blochează firma până
 * la o intervenție manuală.
 */
export async function jetonValid(
  db: AdminSupabase,
  cred: CredentialeReges,
): Promise<RezultatJeton> {
  const stocat = await citesteJetonStocat(db, cred.organizationId);

  const maiTine =
    stocat.jeton !== null &&
    stocat.expiraLa !== null &&
    stocat.expiraLa.getTime() - Date.now() > MARJA_SECUNDE * 1000;
  if (maiTine && stocat.jeton !== null && stocat.expiraLa !== null) {
    return { ok: true, jeton: stocat.jeton, expiraLa: stocat.expiraLa };
  }

  if (stocat.reimprospatare !== null) {
    const reinnoit = await reimprospateaza(cred, stocat.reimprospatare);
    if (reinnoit.ok) {
      await salveazaJeton(
        db,
        cred.organizationId,
        reinnoit.jeton,
        reinnoit.reimprospatare ?? null,
        reinnoit.expiraLa,
      );
      return reinnoit;
    }
    if (reinnoit.motiv === "indisponibil") return reinnoit;
    // `credentiale` pe reîmprospătare = refresh-ul a expirat. Se cade pe
    // autentificarea completă, nu se raportează eșec.
  }

  const nou = await autentifica(cred);
  if (!nou.ok) return nou;
  await salveazaJeton(db, cred.organizationId, nou.jeton, nou.reimprospatare ?? null, nou.expiraLa);
  return nou;
}
