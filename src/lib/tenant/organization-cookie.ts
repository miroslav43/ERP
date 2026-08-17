import "server-only";

import { cookies } from "next/headers";

import { TENANT_COOKIE, TENANT_COOKIE_OPTIONS, signTenantCookie } from "./tenant-cookie";

/**
 * Scrierea și ștergerea cookie-ului de organizație activă.
 *
 * Separat de `tenant-cookie.ts`, care rămâne pur (semnează și verifică un șir,
 * fără să atingă nimic din contextul cererii) și deci testabil direct. Aici stă
 * singura parte care are nevoie de `cookies()` din Next.
 *
 * Reamintire: cookie-ul este un HINT NEÎNCREZUT. Scrierea lui nu acordă niciun
 * drept — `resolveTenant()` revalidează apartenența la fiecare cerere, iar RLS
 * respinge rândurile oricum. Semnătura există ca să putem deosebi o valoare
 * pusă de noi de una fabricată, și să o înregistrăm în audit pe a doua.
 */

export async function setOrganizationCookie(organizationId: string): Promise<void> {
  const store = await cookies();
  store.set(TENANT_COOKIE, signTenantCookie(organizationId), TENANT_COOKIE_OPTIONS);
}

export async function clearOrganizationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(TENANT_COOKIE);
}
