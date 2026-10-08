// src/components/ui/file-modul.tsx
import type { ReactElement } from "react";

import { poateDeschide } from "@/config/porti-ruta";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/tenant/types";

import { FileClient, type FilaModul } from "./file-client";

export type { FilaModul } from "./file-client";

/**
 * Banda de file a unui modul, filtrată prin registrul porților de rută.
 *
 * ── DE CE O COMPONENTĂ DE SERVER, ȘI NU ÎNCĂ UN `nav-*.tsx` ──────────────
 * Fiecare modul își scria banda cu booleeni proprii — `poateVedeaFoi`,
 * `poateSetari`, `poateCiti` — calculați în fiecare pagină, cu permisiunea pe
 * care și-o amintea autorul, nu cu cea pe care o cere pagina-țintă. Analiza din
 * 2026-10-08 a găsit file care duceau în refuz în patru module: „Vehicule"
 * pentru managerul fără `vehicles:read`, filele de evaluări pentru firma doar
 * cu KPI, filele de mentenanță pentru un membru cu `read = own`, „Coduri QR"
 * fără `departments:update`.
 *
 * Aici condiția nu se mai scrie: fila apare dacă `poateDeschide(href)` spune
 * că pagina ei se deschide pentru omul curent, cu modulele firmei. Aceeași
 * întrebare pe care o pune pagina în preambul, din același registru.
 *
 * `getEnabledFeatures` și `getPermissionMap` sunt memoizate pe cerere
 * (`React.cache()`), deci banda nu costă nicio interogare în plus față de
 * pagina care o randează.
 *
 * O bandă cu o singură filă nu se randează: o filă singură nu e navigare, e
 * un titlu repetat.
 */
export async function FileModul({
  eticheta,
  file,
  tenant,
}: Readonly<{
  /** `aria-label`-ul benzii: „Navigare parc auto”. */
  eticheta: string;
  file: readonly FilaModul[];
  tenant: Readonly<{ organizationId: string; role: AppRole; memberId?: string | undefined }>;
}>): Promise<ReactElement | null> {
  const [features, permissions] = await Promise.all([
    getEnabledFeatures(tenant.organizationId),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  const vizibile = file.filter((fila) => poateDeschide(fila.href, { features, permissions }));
  if (vizibile.length <= 1) return null;
  return <FileClient eticheta={eticheta} file={vizibile} />;
}
