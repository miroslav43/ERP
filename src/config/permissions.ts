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

export const PERMISSION_KEYS = [
  "dashboard:read",
  "employees:read",
  "employees:create",
  "employees:update",
  "employees:delete",
  "employee_sensitive:read",
  "attendance:read",
  "attendance:create",
  "attendance:approve",
  "leave_requests:read",
  "leave_requests:create",
  "leave_requests:update",
  "leave_requests:approve",
  "leave_balances:read",
  "leave_balances:update",
  "vehicles:read",
  "vehicles:update",
  "ssm_trainings:read",
  "ssm_trainings:create",
  "maintenance:read",
  "maintenance:update",
  "inventory:read",
  "inventory:update",
  "onboarding:read",
  "onboarding:update",
  "announcements:read",
  "announcements:create",
  "payroll:read",
  "payroll:update",
  "per_diem:read",
  "per_diem:create",
  "reports:read",
  "organization:update",
  "members:manage",
  "roles:manage",
  "features:manage",
  "audit:read",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Filtru la granița cu baza: `resource:action` venit din DB poate fi vechi. */
export const isPermissionKey = (value: string): value is PermissionKey =>
  (PERMISSION_KEYS as readonly string[]).includes(value);
