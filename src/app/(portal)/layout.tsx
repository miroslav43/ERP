// src/app/(portal)/layout.tsx
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { buildPortalNavigation } from "@/lib/navigation/build-portal-navigation";
import { numaraNecitite } from "@/lib/queries/notifications";
import { listUserOrganizations } from "@/lib/queries/organizations";
import { citesteProfilPropriu } from "@/lib/queries/profile";
import { urlAvatar } from "@/lib/avatar/cale";
import {
  POARTA_PORTAL_ACTIVA,
  RUTA_ALEGE_ORGANIZATIA,
  RUTA_AUTENTIFICARE,
  RUTA_DUPA_AUTENTIFICARE,
} from "@/config/routes";

import { RaporteazaProblema } from "@/components/layout/raporteaza-problema";

import { AntetPortal } from "./_components/antet-portal";
import { BaraPortal } from "./_components/bara-portal";
import { RailPortal } from "./_components/rail-portal";

export const dynamic = "force-dynamic";

/**
 * Portalul angajatului: același nucleu de autorizare, alt înveliș.
 *
 * Diferența față de `(app)` nu e cosmetică. Acolo, ecranul e al unui om care
 * administrează organizația de la birou; aici, al unuia care își verifică
 * concediul din camion sau de pe schelă. De aceea navigarea stă JOS pe telefon,
 * la degetul mare, și într-un rail îngust pe laptop — nu într-un sidebar cu
 * cincisprezece intrări din care îl privesc trei.
 *
 * Layout-ul NU e barieră de securitate: fiecare pagină reface verificarea,
 * fiecare Server Action o reface prin `createAction`, iar RLS respinge rândul
 * chiar dacă cineva ajunge aici pe altă cale.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") redirect(RUTA_AUTENTIFICARE);
  if (rezolvare.status !== "ok") redirect(RUTA_ALEGE_ORGANIZATIA);

  const { tenant, user } = rezolvare;

  // ── Poarta, cealaltă jumătate ───────────────────────────────────────────
  // Perechea simetrică a celei din `(app)/layout.tsx`: angajatul intră aici,
  // restul rolurilor ies. Portalul arată date proprii, iar un cont cu scope
  // `all` care l-ar deschide și-ar vedea propriile rânduri corect, dar ar avea
  // un al doilea loc din care să administreze firma — fără să poată. Un singur
  // înveliș per rol, fără suprapunere.
  if (POARTA_PORTAL_ACTIVA && tenant.role !== "employee") redirect(RUTA_DUPA_AUTENTIFICARE);

  const [features, permisiuni, profil, necitite, organizatii] = await Promise.all([
    getEnabledFeatures(tenant.organizationId),
    getPermissionMap(tenant.organizationId, tenant.role),
    citesteProfilPropriu(user.id),
    numaraNecitite(tenant.organizationId, user.id),
    listUserOrganizations(),
  ]);

  const { grupuri, bara } = buildPortalNavigation({ features, permissions: permisiuni });

  return (
    <div data-zona="portal" className="bg-background flex min-h-dvh flex-col md:flex-row">
      <a
        href="#continut"
        className="bg-primary text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm"
      >
        Sari la conținut
      </a>

      <RailPortal grupuri={grupuri} numeOrganizatie={tenant.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AntetPortal
          numeOrganizatie={tenant.name}
          numeAfisat={profil?.full_name ?? user.fullName ?? user.email}
          email={user.email}
          avatarUrl={urlAvatar(profil?.avatar_path ?? null)}
          necitite={necitite}
          organizatii={organizatii.map((o) => ({ id: o.id, name: o.name }))}
          organizatiaCurentaId={tenant.organizationId}
        />

        {/*
          Rezerva de jos e înălțimea reală a barei plus zona de siguranță, nu un
          `pb-20` ales din ochi: bara e `fixed`, deci fără ea ultimul rând al
          fiecărei liste rămâne sub degete. Pe laptop bara nu există, deci
          rezerva ar fi spațiu mort — `md:pb-0`.
        */}
        <main
          id="continut"
          className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}

          {/* Scris explicit pentru angajat („ca angajatul să nu fie pus să-l
              aleagă" — comentariul din componentă), dar montat până acum doar în
              învelișul de administrare, unde angajatul n-are ce căuta. */}
          {features.has("ticketing") ? (
            <RaporteazaProblema caleFormular="/portal/tichetele-mele/nou" zona="portal" />
          ) : null}
        </main>
      </div>

      <BaraPortal primare={bara.primare} secundare={bara.secundare} />
    </div>
  );
}
