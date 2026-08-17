// src/lib/tenant/tenant-hint.ts
import "server-only";

import { cookies, headers } from "next/headers";

import { TENANT_COOKIE, verifyTenantCookie } from "./tenant-cookie";

export type TenantHintSource = "cookie" | "subdomain" | "none";

export type TenantHint = Readonly<{
  source: TenantHintSource;
  /** id (cookie) sau slug (subdomeniu). NEÎNCREZUT până la lookup. */
  slugOrId: string | null;
  /** Semnătură invalidă ⇒ cineva a umblat la cookie. Ajunge în `audit_logs`. */
  tampered: boolean;
}>;

type TenantStrategy = "cookie" | "subdomain";

/**
 * ────────────────────────────────────────────────────────────────────────────
 * PUNCTUL UNIC DE SCHIMBARE pentru trecerea la `firma.administrativo.ro`.
 *
 * Azi (Faza 1a): host unic `app.administrativo.ro` + cookie semnat.
 *
 * Migrarea la subdomenii înseamnă, în ordine:
 *   1. constanta de mai jos trece pe "subdomain" — atât, în tot codul TypeScript;
 *   2. DNS wildcard `*.administrativo.ro` + certificat wildcard;
 *   3. `organizations.slug` devine sursa hintului; coloana, formatul de
 *      subdomeniu, lista de sluguri rezervate și indexul unic există deja în
 *      `0001_kernel.sql`.
 *
 * Ce NU se schimbă: `readTenantHint()` are aceeași semnătură, iar
 * `resolveTenant()` primește în continuare un `slugOrId` neîncrezut pe care îl
 * validează prin `organization_members`. Modelul de securitate e identic în
 * ambele variante — subdomeniul e la fel de falsificabil ca un cookie.
 * ────────────────────────────────────────────────────────────────────────────
 */
const STRATEGIE: TenantStrategy = "cookie";

/** Aceeași listă ca `organizations_slug_rezervat_ck` din 0001. */
const SUBDOMENII_REZERVATE: ReadonlySet<string> = new Set([
  "app",
  "www",
  "api",
  "admin",
  "auth",
  "static",
  "cdn",
  "mail",
  "status",
  "docs",
]);

export async function readTenantHint(): Promise<TenantHint> {
  if (STRATEGIE === "subdomain") {
    const host = (await headers()).get("host") ?? "";
    const subdomeniu = host.split(":")[0]?.split(".")[0] ?? "";
    if (subdomeniu.length > 0 && !SUBDOMENII_REZERVATE.has(subdomeniu)) {
      return { source: "subdomain", slugOrId: subdomeniu, tampered: false };
    }
  }

  const brut = (await cookies()).get(TENANT_COOKIE)?.value;
  if (brut === undefined || brut.length === 0) {
    return { source: "none", slugOrId: null, tampered: false };
  }

  const verificat = verifyTenantCookie(brut);
  return verificat === null
    ? { source: "cookie", slugOrId: null, tampered: true }
    : { source: "cookie", slugOrId: verificat, tampered: false };
}
