// src/lib/asistent/unelte/flota/context-de-test.ts
/**
 * Contextul uneltelor de flotă pentru teste, pe cele cinci roluri, cu
 * matricea de permisiuni din seed (citită pe bancul local, 0002 + 0199 + 0204 +
 * 0216). Fără `getPermissionMap`: uneltele primesc harta gata făcută, exact ca
 * din rută, deci testul fixează ce face unealta cu un scope, nu cum se citește.
 *
 * Doar pentru teste; nu e importat din cod.
 */
import type { FeatureKey } from "@/config/features";
import type { PermissionScope } from "@/config/permissions";
import type { PermissionMap } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/tenant/types";

import type { ContextUnealta } from "../tip";

export const ORG = "11111111-1111-4111-8111-111111111111";
export const FISA = "33333333-3333-4333-8333-333333333333";

type Rol = AppRole;

/** Cheile flotei din seed, pe rol. `none` lipsește din hartă, ca în `getPermissionMap`. */
const SEED: Readonly<Record<string, Readonly<Record<string, PermissionScope>>>> = {
  super_admin: {
    "vehicles:read": "all",
    "trip_sheets:read": "all",
    "trip_sheets:create": "all",
    "driver_licenses:read": "all",
    "vehicle_fines:read": "all",
    "vehicle_reservations:read": "all",
    "vehicle_reservations:create": "all",
    "employees:read": "all",
  },
  org_admin: {
    "vehicles:read": "all",
    "trip_sheets:read": "all",
    "trip_sheets:create": "all",
    "driver_licenses:read": "all",
    "vehicle_fines:read": "all",
    "vehicle_reservations:read": "all",
    "vehicle_reservations:create": "all",
    "employees:read": "all",
  },
  manager: {
    "vehicles:read": "team",
    "trip_sheets:read": "team",
    "trip_sheets:create": "own",
    "driver_licenses:read": "team",
    "vehicle_reservations:read": "team",
    "vehicle_reservations:create": "own",
    "employees:read": "team",
  },
  hr: {
    "driver_licenses:read": "all",
    "employees:read": "all",
  },
  employee: {
    "vehicles:read": "own",
    "trip_sheets:read": "own",
    "trip_sheets:create": "own",
    "driver_licenses:read": "own",
    "vehicle_reservations:read": "own",
    "vehicle_reservations:create": "own",
    "employees:read": "own",
  },
};

export function hartaRol(rol: Rol): PermissionMap {
  return new Map(Object.entries(SEED[rol] ?? {})) as PermissionMap;
}

export function contextFlota(rol: Rol, partial: Partial<ContextUnealta> = {}): ContextUnealta {
  return {
    organizationId: ORG,
    userId: "44444444-4444-4444-8444-444444444444",
    memberId: "membru",
    role: rol,
    employeeId: FISA,
    numeUtilizator: "Ana Popescu",
    permisiuni: hartaRol(rol),
    features: new Set<FeatureKey>(["nucleu", "fleet"]),
    aziISO: "2026-10-22",
    zona: rol === "employee" ? "portal" : "app",
    ...partial,
  };
}
