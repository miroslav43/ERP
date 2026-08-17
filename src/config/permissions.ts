// src/config/permissions.ts
/**
 * Cheile de permisiune și algebra scope-urilor.
 *
 * Aici stau doar TIPURILE și ordinea. Valorile efective (ce scope primește
 * fiecare rol) trăiesc în `public.role_permissions`, cu suprascriere per
 * organizație — nu în cod, altfel fiecare client ar cere un deploy.
 *
 * Formatul cheii este `resursa:acțiune` și trebuie să respecte constrângerile
 * din 0001_kernel.sql: `resource ~ '^[a-z][a-z0-9_.]{1,63}$'`,
 * `action ~ '^[a-z][a-z0-9_]{1,31}$'`.
 */

export const PERMISSION_SCOPES = ["none", "own", "team", "all"] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

/**
 * `none` = REFUZ EXPLICIT, nu absența rândului. De aceea nu poate fi cerut ca
 * prag: o acțiune cu `minScope: "none"` ar trece pentru oricine. Excluderea la
 * nivel de tip face configurația greșită imposibil de scris.
 */
export type MinScope = Exclude<PermissionScope, "none">;

export const RANK: Readonly<Record<PermissionScope, number>> = {
  none: 0,
  own: 1,
  team: 2,
  all: 3,
};

/** Absența permisiunii se tratează identic cu `none`: refuz. */
export function meetsScope(granted: PermissionScope | undefined, min: MinScope): boolean {
  return RANK[granted ?? "none"] >= RANK[min];
}

/**
 * Vocabularul de permisiuni. **Sursa de adevăr este seed-ul din
 * `0002_authz.sql`**, nu această listă: politicile RLS interoghează acele
 * rânduri, iar o cheie inventată aici pur și simplu nu are corespondent și
 * întoarce `none` — adică refuz tăcut.
 *
 * Nepotrivirea a fost reală o dată: codul cerea `leave_requests:read`,
 * `organization:update`, `members:manage`, iar baza avea `leave:read`,
 * `organizations:update`, `users:update`. Efectul nu era o eroare, ci un meniu
 * gol pentru toată lumea, inclusiv pentru `org_admin`. Testul `permisiuni.test.ts`
 * compară acum cele două liste și eșuează dacă diverg din nou.
 *
 * Resurse: announcements, attendance, audit, branding, checklists, compliance,
 * departments, employees, features, inventory, leave, maintenance,
 * organizations, payroll, per_diem, reports, roles, ssm, trip_sheets, users,
 * vehicles. Acțiuni: read, create, update, delete, approve, export.
 */
export const PERMISSION_KEYS = [
  "announcements:read",
  "announcements:create",
  "attendance:read",
  "attendance:create",
  "attendance:approve",
  "audit:read",
  "branding:update",
  "checklists:read",
  "checklists:update",
  "compliance:read",
  "departments:read",
  "employees:read",
  "employees:create",
  "employees:update",
  "employees:delete",
  "features:read",
  "features:update",
  "inventory:read",
  "inventory:update",
  "leave:read",
  "leave:create",
  "leave:update",
  "leave:approve",
  "maintenance:read",
  "maintenance:update",
  "organizations:read",
  "organizations:update",
  "payroll:read",
  "payroll:update",
  "per_diem:read",
  "per_diem:create",
  "reports:read",
  "roles:read",
  "roles:update",
  "ssm:read",
  "ssm:create",
  "trip_sheets:read",
  "users:read",
  "users:create",
  "users:update",
  "vehicles:read",
  "vehicles:update",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Filtru la granița cu baza: `resource:action` venit din DB poate fi vechi. */
export const isPermissionKey = (value: string): value is PermissionKey =>
  (PERMISSION_KEYS as readonly string[]).includes(value);
