// src/components/layout/carcasa-app.tsx
import { Suspense, type ReactNode } from "react";

import { Sidebar, SidebarProvider } from "@/components/layout/sidebar";
import { MeniuLateral } from "@/components/layout/meniu-lateral";
import { ScheletNav, ScheletTopbar } from "@/components/layout/schelet-nav";
import { Topbar } from "@/components/layout/topbar";
import { RaporteazaProblema } from "@/components/layout/raporteaza-problema";
import { OpresteAnaliticele } from "@/components/layout/opreste-analiticele";
import { ZonaAsistent } from "@/components/asistent/zona-asistent";
import { ZonaToast } from "@/components/ui/toast";
import type { FeatureKey } from "@/config/features";
import { monoCifre } from "@/lib/ui/fonturi";
import type { AuthUser, Tenant } from "@/lib/tenant/types";

/** Cookie-ul în care `sidebar.tsx` ține starea colapsată a railului. */
export const COOKIE_SIDEBAR = "adm_sidebar";

/**
 * Carcasa aplicației de firmă: bara laterală, antetul, `<main>`-ul și zonele
 * plutitoare.
 *
 * Mutată din `src/app/(app)/layout.tsx` ca s-o poată randa și 404-ul rădăcină
 * (`src/app/not-found.tsx`, UX-043): o adresă fără nicio rută nu trece prin
 * layout-ul `(app)`, deci fără extragere utilizatorul logat își pierdea meniul
 * și antetul exact când greșea o adresă.
 *
 * NU conține nicio poartă. Redirectul angajatului în portal și cel al firmei
 * neconfigurate rămân în layout, înaintea carcasei — cine o randează în altă
 * parte decide singur cui o arată.
 */
export function CarcasaApp({
  user,
  tenant,
  features,
  colapsat,
  children,
}: Readonly<{
  user: AuthUser;
  tenant: Tenant;
  features: ReadonlySet<FeatureKey>;
  colapsat: boolean;
  children: ReactNode;
}>) {
  return (
    <>
      <OpresteAnaliticele />
      <a
        href="#continut"
        className="bg-primary text-primary-foreground rounded-control focus:z-plutitor text-corp sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:px-3 focus:py-2"
      >
        Sari la conținut
      </a>
      <SidebarProvider defaultCollapsed={colapsat} className={monoCifre.variable}>
        <Sidebar organizationName={tenant.name}>
          {/*
            Meniul se randează ÎN AFARA căii critice.

            `contoarePanouPentru` face un fan-out de unsprezece ramuri (~21 de
            interogări, unele cu paginare) doar ca să pună cifrele din dreptul
            intrărilor. Chemat din corpul layout-ului, ținea primul pixel al
            întregii aplicații — și, fiindcă un layout care citește date runtime
            NU e acoperit de `loading.tsx`, niciunul dintre cele 83 de schelete
            ale produsului nu apărea în tot acest timp.

            Ce rămâne în corp: cele două porți de redirect. Vezi docblock-ul din
            `meniu-lateral.tsx` — un `redirect()` dintr-un context streamat devine
            meta-tag pe client, iar angajatul ar apuca să vadă carcasa aplicației
            de administrare înainte să fie mutat în portal.
          */}
          <Suspense fallback={<ScheletNav />}>
            <MeniuLateral
              organizationId={tenant.organizationId}
              role={tenant.role}
              memberId={tenant.memberId}
              userId={user.id}
            />
          </Suspense>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* `Topbar` este Server Component fără props: își rezolvă singur
              tenantul, utilizatorul și lista de organizații. Streamat din același
              motiv ca meniul: cheamă și el `contoarePanouPentru`, pentru
              insignele paletei de comenzi. */}
          <Suspense fallback={<ScheletTopbar />}>
            <Topbar />
          </Suspense>
          {/*
            Landmark-ul, umplutura și lățimea maximă aparțin EXCLUSIV învelișului.
            Înainte, fiecare dintre cele 94 de pagini randa încă un `<main>` cu
            `p-6` propriu înăuntrul acestuia: două landmark-uri „main” pe același
            ecran (HTML invalid, două regiuni principale pentru cititorul de
            ecran) și umplutură dublă — pe un telefon de 375px rămâneau 295 de
            pixeli utili. Pe ramura de acces restricționat erau TREI.

            Lățimea maximă lipsea cu totul: pe un monitor de 27" un tabel de șase
            coloane se întindea pe 2400 de pixeli, iar ochiul pierdea rândul între
            prima și ultima celulă. Paginile care au nevoie de o coloană mai
            îngustă (formulare, fișe) o cer ele, cu `max-w-3xl` pe propriul înveliș.
          */}
          <main
            id="continut"
            data-zona="app"
            className="mx-auto w-full max-w-[104rem] min-w-0 flex-1 p-4 md:p-6"
          >
            {children}
          </main>
          {/* Prezent pe fiecare pagină, deliberat discret: e o ieșire de
              siguranță, nu o acțiune pe care o cauți. Modulul se deduce din
              calea curentă și ajunge precompletat în formular. */}
          {features.has("ticketing") ? <RaporteazaProblema /> : null}
          {/* Montată o singură dată pe zonă. `arataToast()` se poate chema de
              oriunde, fără provider — depozitarul e la nivel de modul. */}
          <ZonaToast />
          {features.has("asistent") ? <ZonaAsistent zona="app" /> : null}
        </div>
      </SidebarProvider>
    </>
  );
}
