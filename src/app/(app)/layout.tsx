// src/app/(app)/layout.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Sidebar, SidebarProvider } from "@/components/layout/sidebar";
import { MeniuLateral } from "@/components/layout/meniu-lateral";
import { ScheletNav, ScheletTopbar } from "@/components/layout/schelet-nav";
import { Topbar } from "@/components/layout/topbar";
import { RaporteazaProblema } from "@/components/layout/raporteaza-problema";
import { getEnabledFeatures } from "@/lib/auth/features";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { stareFirmei } from "@/lib/tenant/stare-firma";
import { POARTA_PORTAL_ACTIVA, RUTA_PORTAL } from "@/config/routes";
import { monoCifre } from "@/lib/ui/fonturi";
import type { AuthUser, Tenant } from "@/lib/tenant/types";
import { ZonaToast } from "@/components/ui/toast";
import { ZonaAsistent } from "@/components/asistent/zona-asistent";

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
  if (POARTA_PORTAL_ACTIVA && tenant.role === "employee") redirect(RUTA_PORTAL);

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

  /*
   * Doar ce are nevoie CARCASA: `features` pentru butonul de sesizare, cookie-ul
   * pentru starea colapsată a railului. Harta de permisiuni a plecat odată cu
   * meniul, în `<MeniuLateral>` — e memoizată cu `React.cache()`, deci n-o
   * plătește nimeni de două ori, dar nu mai ține primul pixel.
   */
  const [features, store] = await Promise.all([
    getEnabledFeatures(tenant.organizationId),
    cookies(),
  ]);

  return (
    <>
      <a
        href="#continut"
        className="bg-primary text-primary-foreground rounded-control focus:z-plutitor text-corp sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:px-3 focus:py-2"
      >
        Sari la conținut
      </a>
      <SidebarProvider
        defaultCollapsed={store.get(COOKIE_SIDEBAR)?.value === "colapsat"}
        className={monoCifre.variable}
      >
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
