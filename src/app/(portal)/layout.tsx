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
import { monoCifre } from "@/lib/ui/fonturi";
import { ZonaToast } from "@/components/ui/toast";
import { ZonaAsistent } from "@/components/asistent/zona-asistent";

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
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    citesteProfilPropriu(user.id),
    numaraNecitite(tenant.organizationId, user.id),
    listUserOrganizations(),
  ]);

  const { grupuri, bara } = buildPortalNavigation({ features, permissions: permisiuni });

  return (
    <div className={`${monoCifre.variable} bg-background flex min-h-dvh flex-col md:flex-row`}>
      <a
        href="#continut"
        className="bg-primary text-primary-foreground focus:rounded-control focus:text-corp sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2"
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
        {/*
          Lățimea maximă aparține învelișului, ca în `(app)`. Portalul e gândit
          pentru telefon, unde nu contează — dar pe laptop, fără ea, o listă de
          concedii se întinde de la rail până în marginea dreaptă a ecranului.
          Înainte fiecare pagină își punea propriul `max-w-2xl`; erau 21 de
          copii ale aceleiași valori, iar a 22-a lipsea.

          `max-w-3xl`, nu `2xl`: portalul are acum antete cu acțiuni pe rândul
          titlului, care la 42rem se rup pe două rânduri.
        */}
        <main
          id="continut"
          data-zona="portal"
          className="mx-auto w-full max-w-3xl min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
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
      {/* Montată o singură dată pe zonă. `arataToast()` se poate chema de
          oriunde, fără provider — depozitarul e la nivel de modul. */}
      <ZonaToast zona="portal" />
      {features.has("asistent") ? <ZonaAsistent zona="portal" /> : null}
    </div>
  );
}
