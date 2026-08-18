// src/app/(portal)/layout.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { getEnabledFeatures } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { PORTAL_NAV_ITEMS } from "@/config/navigation";
import { RUTA_ALEGE_ORGANIZATIA, RUTA_AUTENTIFICARE } from "@/config/routes";

import { BaraPortal } from "./bara-portal";

export const dynamic = "force-dynamic";

/**
 * Portalul angajatului: același nucleu de autorizare, alt înveliș.
 *
 * Diferența față de `(app)` nu e cosmetică. Acolo, ecranul e al unui om care
 * administrează organizația de la birou; aici, al unuia care își verifică
 * concediul din camion sau de pe schelă. De aceea navigarea stă JOS, la degetul
 * mare, iar meniul are patru intrări, nu cincisprezece.
 *
 * Layout-ul NU e barieră de securitate: fiecare pagină reface verificarea, iar
 * RLS respinge rândurile chiar dacă cineva ajunge aici pe altă cale.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") redirect(RUTA_AUTENTIFICARE);
  if (rezolvare.status !== "ok") redirect(RUTA_ALEGE_ORGANIZATIA);

  const { tenant } = rezolvare;
  const [features, permisiuni] = await Promise.all([
    getEnabledFeatures(tenant.organizationId),
    getPermissionMap(tenant.organizationId, tenant.role),
  ]);

  // Aceleași două condiții ca în aplicația mare: modulul activ ȘI permisiunea cu
  // pragul ei. `can` tratează absența cheii identic cu `none` — refuz.
  const intrari = PORTAL_NAV_ITEMS.filter((item) => {
    if (item.featureKey !== null && !features.has(item.featureKey)) return false;
    if (item.permission === null) return true;
    return can(permisiuni, item.permission, item.minScope);
  }).map((item) => ({ id: item.id, label: item.label, href: item.href }));

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-muted-foreground text-xs">{tenant.name}</p>
          <p className="text-foreground text-sm font-semibold">Portalul meu</p>
        </div>
        <Link
          href="/portal/profilul-meu"
          aria-label="Profilul meu"
          className="hover:bg-background flex size-9 shrink-0 items-center justify-center rounded-full"
        >
          <UserRound className="text-muted-foreground size-5" aria-hidden />
        </Link>
      </header>

      {/* `pb-20` lasă loc barei de jos, care e fixă: fără el, ultimul rând al
          fiecărei liste ar rămâne sub degete, inaccesibil. */}
      <main className="flex-1 pb-20">{children}</main>

      <BaraPortal intrari={intrari} />
    </div>
  );
}
