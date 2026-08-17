// src/lib/tenant/tenant-cookie.ts
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { clientEnv, serverEnv } from "@/config/env";

export const TENANT_COOKIE = "adm_org";

const SEPARATOR = ".";

/**
 * Secretul e validat la boot ca 32 de octeți base64. HMAC-ul se calculează pe
 * octeți, nu pe textul base64: altfel entropia efectivă a cheii scade.
 */
const CHEIE = Buffer.from(serverEnv.TENANT_COOKIE_SECRET, "base64");

/**
 * Opțiunile cookie-ului de organizație. `httpOnly` — JS-ul din pagină nu are
 * de ce să îl citească; `SameSite=Lax` — un POST cross-site nu trebuie să
 * poată comuta organizația altcuiva.
 *
 * `secure` se derivă din APP_URL: în dezvoltare, pe http://localhost, unele
 * browsere refuză cookie-urile `Secure` și rezultatul ar fi un comutator care
 * „nu face nimic”, foarte greu de diagnosticat.
 */
export const TENANT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: clientEnv.NEXT_PUBLIC_APP_URL.startsWith("https://"),
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
} as const;

function semnatura(valoare: string): Buffer {
  return createHmac("sha256", CHEIE).update(valoare, "utf8").digest();
}

/** Format: `<organizationId>.<HMAC-SHA256 base64url>`. */
export function signTenantCookie(organizationId: string): string {
  return `${organizationId}${SEPARATOR}${semnatura(organizationId).toString("base64url")}`;
}

/**
 * Întoarce valoarea semnată sau `null` dacă semnătura nu se verifică.
 *
 * ATENȚIE la ce NU face funcția asta: nu spune că utilizatorul are acces la
 * organizația respectivă. Semnătura dovedește doar că valoarea a fost emisă de
 * noi. Apartenența se verifică separat, în `resolveTenant()`, printr-un lookup
 * în `organization_members`. Rolul HMAC-ului este să facă distincția între
 * „cookie vechi” și „cookie falsificat”, ca a doua situație să ajungă în audit.
 */
export function verifyTenantCookie(brut: string): string | null {
  const idx = brut.lastIndexOf(SEPARATOR);
  if (idx <= 0 || idx === brut.length - 1) return null;

  const valoare = brut.slice(0, idx);
  const primita = Buffer.from(brut.slice(idx + 1), "base64url");
  const asteptata = semnatura(valoare);

  // Comparație în timp constant: `===` pe șiruri iese la primul octet diferit,
  // iar diferența de timp permite ghicirea semnăturii octet cu octet.
  // `timingSafeEqual` aruncă dacă lungimile diferă, deci verificarea de lungime
  // rămâne obligatorie — și nu scurge nimic secret, lungimea fiind fixă.
  if (primita.length !== asteptata.length) return null;
  return timingSafeEqual(primita, asteptata) ? valoare : null;
}
