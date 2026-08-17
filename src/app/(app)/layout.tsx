// src/app/(app)/layout.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar, SidebarProvider } from "@/components/layout/sidebar";
import { SidebarNav, type NavGroupView } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { buildNavigation } from "@/lib/navigation/build-navigation";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import type { AuthUser, Tenant } from "@/lib/tenant/types";

export const dynamic = "force-dynamic";

const COOKIE_SIDEBAR = "adm_sidebar";

/**
 * `resolveTenant()` este singurul care decide organizația activă; aici doar
 * traducem starea în navigare. Layout-ul NU este un boundary de securitate:
 * fiecare Server Action reface verificarea prin `createAction`.
 */
async function requireTenant(): Promise<{ user: AuthUser; tenant: Tenant }> {
  const rezolvare = await resolveTenant();
  switch (rezolvare.status) {
    case "ok":
      return { user: rezolvare.user, tenant: rezolvare.tenant };
    case "neautentificat":
      redirect("/autentificare");
    case "fara_organizatie":
    case "alegere_necesara":
      redirect("/alege-organizatia");
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { tenant } = await requireTenant();

  const [features, permissions, store] = await Promise.all([
    getEnabledFeatures(tenant.organizationId),
    getPermissionMap(tenant.organizationId, tenant.role),
    cookies(),
  ]);

  // `scope = 'none'` este REFUZ EXPLICIT, nu absența rândului: cheia există în
  // hartă, deci filtrarea trebuie făcută pe valoare, nu pe prezență.
  const permise = new Set(
    Array.from(permissions.entries())
      .filter(([, scope]) => scope !== "none")
      .map(([cheie]) => cheie),
  );

  const grupuri = buildNavigation({ features, permissions: permise, badges: {} });

  // Iconițele sunt componente: trec granița server → client ca elemente randate.
  const navigare: readonly NavGroupView[] = grupuri.map((grup) => ({
    id: grup.id,
    label: grup.label,
    items: grup.items.map(({ icon: Icon, ...item }) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      icon: <Icon className="size-4 shrink-0" aria-hidden />,
      // `exactOptionalPropertyTypes`: o cheie absentă nu este același lucru cu
      // una setată pe `undefined`, deci o omitem în loc să o setăm.
      ...(item.badgeCount === undefined ? {} : { badgeCount: item.badgeCount }),
      ...(item.children === undefined
        ? {}
        : {
            children: item.children.map((copil) => ({
              id: copil.id,
              label: copil.label,
              href: copil.href,
            })),
          }),
    })),
  }));

  return (
    <>
      <a
        href="#continut"
        className="bg-primary text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm"
      >
        Sari la conținut
      </a>
      <SidebarProvider defaultCollapsed={store.get(COOKIE_SIDEBAR)?.value === "colapsat"}>
        <Sidebar organizationName={tenant.name}>
          <SidebarNav groups={navigare} />
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* `Topbar` este Server Component fără props: își rezolvă singur
              tenantul, utilizatorul și lista de organizații. */}
          <Topbar />
          <main id="continut" className="min-w-0 flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </>
  );
}
