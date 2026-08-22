// src/app/(app)/layout.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar, SidebarProvider } from "@/components/layout/sidebar";
import { SidebarNav, type NavGroupView } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { RaporteazaProblema } from "@/components/layout/raporteaza-problema";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { buildNavigation } from "@/lib/navigation/build-navigation";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { stareFirmei } from "@/lib/tenant/stare-firma";
import { RUTA_PORTAL } from "@/config/routes";
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

  // ── Poarta angajatului ──────────────────────────────────────────────────
  // Angajatul nu vede niciodată învelișul de administrare. Redirect tăcut, nu
  // un ecran de „acces interzis": n-are ce face cu informația că există o
  // aplicație în care nu are voie, iar un refuz pe pagina de start arată ca o
  // defecțiune.
  //
  // Un singur `if`, într-un singur fișier, deliberat: cele ~90 de pagini din
  // `(app)` sunt acoperite fără nicio modificare per pagină, iar dezactivarea în
  // producție e un revert de trei linii, nu arheologie prin proxy și rute.
  //
  // NU e o barieră de securitate și nu trebuie tratată ca atare la review:
  //   · Server Actions — un layout nu rulează la un POST; `createAction` reface
  //     verificarea de modul, permisiune și prag. Suprafața de scriere a
  //     angajatului rămâne EXACT cea de dinainte.
  //   · Route handlers — nu trec prin layout. `documente/[id]/route.ts` rămâne
  //     deschis intenționat: `hr_issued_select` are ramură `own`, deci e singurul
  //     drum prin care angajatul își tipărește o adeverință. Nu-l „repara".
  //   · RLS rămâne ultima linie, indiferent de toate cele de mai sus.
  //
  // Fără condiție pe `employee_portal`: modulul nu e de nucleu, deci majoritatea
  // firmelor îl au stins. Portalul funcționează și așa — „Acasă" nu depinde de
  // el, iar restul intrărilor sunt păzite de modulele lor proprii.
  if (tenant.role === "employee") redirect(RUTA_PORTAL);

  // ── Poarta firmei neconfigurate ─────────────────────────────────────────
  // `pending` = datele firmei nu sunt complete. Super-adminul poate crea o
  // firmă doar cu denumirea, CUI-ul și administratorul, lăsându-i acestuia
  // restul; până le completează, aplicația n-are cu ce lucra — salarizarea are
  // nevoie de date bancare, SSM de responsabil, documentele de reprezentant legal.
  //
  // Destinațiile sunt ÎN AFARA lui `(app)`, în `(onboarding)`. Dacă ar fi aici,
  // ar trece prin acest layout, ar fi redirectate spre ele însele și pagina n-ar
  // mai încărca niciodată — o buclă din care nu se iese decât ștergând cookie-ul.
  //
  // Rolul contează: doar `org_admin` poate completa datele. Unui `hr` sau
  // `manager` i-am cere capitalul social și IBAN-ul firmei — o fundătură cu
  // câmpuri pe care n-are cum să le știe. Ei primesc un ecran care explică.
  const stare = await stareFirmei(tenant.organizationId);
  if (stare === "pending") {
    redirect(tenant.role === "org_admin" ? "/bun-venit" : "/firma-in-configurare");
  }

  const [features, permissions, store] = await Promise.all([
    getEnabledFeatures(tenant.organizationId),
    getPermissionMap(tenant.organizationId, tenant.role),
    cookies(),
  ]);

  // Harta se predă întreagă, nu turtită într-un `Set` de chei. `scope = 'none'`
  // rămâne refuz explicit — dar acum îl tratează `meetsScope` din
  // `buildNavigation`, împreună cu pragul `minScope` al fiecărei intrări, care
  // înainte se pierdea pe drum.
  const grupuri = buildNavigation({ features, permissions, badges: {} });

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
          {/* Prezent pe fiecare pagină, deliberat discret: e o ieșire de
              siguranță, nu o acțiune pe care o cauți. Modulul se deduce din
              calea curentă și ajunge precompletat în formular. */}
          {features.has("ticketing") ? <RaporteazaProblema /> : null}
        </div>
      </SidebarProvider>
    </>
  );
}
