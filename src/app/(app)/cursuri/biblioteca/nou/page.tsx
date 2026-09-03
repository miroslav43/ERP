// src/app/(app)/cursuri/biblioteca/nou/page.tsx
// Pagină proprie, nu dialog: asistentul are încărcare de fișier și cinci pași,
// iar sub 768px dialogul devine foaie cu corp derulabil — butonul de acțiune ar
// ajunge sub linia vizibilă exact la pasul cu cele mai multe câmpuri.
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { AsistentMaterial } from "./asistent-material";

export const metadata: Metadata = { title: "Material nou" };

export default async function PaginaMaterialNou() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "courses"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "courses:create", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a adăuga materiale." />;
  }

  return <AsistentMaterial />;
}
