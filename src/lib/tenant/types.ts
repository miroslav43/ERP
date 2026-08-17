// src/lib/tenant/types.ts
/**
 * Tipurile stratului de tenancy.
 *
 * Fără dependență de `@/types/database`: fișierul acela se generează din baza
 * reală (`pnpm db:types`) și nu există încă. Când apare, `AppRole` devine
 * `Enums<"app_role">`, iar restul rămâne neschimbat.
 */

export const APP_ROLES = ["super_admin", "org_admin", "manager", "hr", "employee"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(valoare: string): valoare is AppRole {
  return (APP_ROLES as readonly string[]).includes(valoare);
}

/**
 * Organizația activă, stabilită EXCLUSIV de `resolveTenant()` printr-un lookup
 * validat în `organization_members`. Niciun câmp de aici nu provine din ceva ce
 * a trimis clientul.
 *
 * `role` nu poate fi niciodată `super_admin`: schema are CHECK care îl
 * interzice în `organization_members`, iar rolul de platformă stă în
 * `platform_admins`.
 */
export type Tenant = Readonly<{
  organizationId: string;
  slug: string;
  name: string;
  role: AppRole;
  /** id-ul rândului din `organization_members` — util pentru audit și pentru FK. */
  memberId: string;
  /** Fusul orar al organizației; implicit „Europe/Bucharest”. */
  timezone: string;
}>;

export type AuthUser = Readonly<{
  id: string;
  email: string;
  fullName: string | null;
}>;

/** Rândul din comutatorul de organizație. Doar organizațiile cu apartenență activă. */
export type OrgSummary = Readonly<{
  id: string;
  slug: string;
  name: string;
  role: AppRole;
}>;

/**
 * Uniune discriminată: apelantul e obligat de compilator să trateze toate
 * cele patru situații. Un `TenantResolution` cu `status: "ok"` este singura
 * dovadă că există organizație activă.
 */
export type TenantResolution =
  | Readonly<{ status: "ok"; user: AuthUser; tenant: Tenant }>
  | Readonly<{ status: "neautentificat" }>
  | Readonly<{ status: "fara_organizatie"; user: AuthUser }>
  | Readonly<{
      status: "alegere_necesara";
      user: AuthUser;
      organizations: readonly OrgSummary[];
    }>;
