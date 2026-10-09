// src/app/(app)/profil/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { FormularProfil } from "@/components/forms/formular-profil";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { poateDeschide, type ContextPorti } from "@/config/porti-ruta";
import { requireUser } from "@/lib/auth/current-user";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { urlAvatar } from "@/lib/avatar/cale";
import { idFisaProprie } from "@/lib/queries/employees";
import { citesteProfilPropriu } from "@/lib/queries/profile";
import { formatDateTime } from "@/lib/format/date";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";

export const metadata: Metadata = { title: "Profilul meu" };

type Legatura = Readonly<{ href: string; eticheta: string; detaliu: string }>;

/**
 * „Ce ține de mine": fișa de angajat și listele personale din (app), pentru
 * rolurile care nu au portal (org_admin, hr, manager).
 *
 * Pagina rămâne a CONTULUI, nu a apartenenței: `requireUser`, nu
 * `requireTenant`. Tenantul se rezolvă SOFT — `resolveTenant()` întoarce o
 * stare, nu redirectează — și rail-ul apare doar când există o firmă aleasă.
 * Cineva scos din toate firmele își vede în continuare profilul, fără rail.
 */
async function legaturilePersonale(): Promise<readonly Legatura[]> {
  const rezolvare = await resolveTenant();
  if (rezolvare.status !== "ok") return [];
  const { tenant, user } = rezolvare;
  const [permisiuni, module, fisaId] = await Promise.all([
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
    idFisaProprie(tenant.organizationId, user.id),
  ]);
  const context: ContextPorti = { features: module, permissions: permisiuni };
  const legaturi: Legatura[] = [];

  if (fisaId !== null && poateDeschide("/angajati/[id]", context)) {
    legaturi.push({
      href: `/angajati/${fisaId}`,
      eticheta: "Fișa mea de angajat",
      detaliu: "Încadrare, contracte, concedii, documente.",
    });
  }
  if (fisaId !== null) {
    if (poateDeschide("/pontaj/saptamana", context)) {
      legaturi.push({
        href: `/pontaj/saptamana?angajat=${fisaId}`,
        eticheta: "Pontajul meu",
        detaliu: "Săptămâna curentă, pe zile.",
      });
    } else if (poateDeschide("/pontaj", context)) {
      legaturi.push({
        href: `/pontaj?angajat=${fisaId}`,
        eticheta: "Pontajul meu",
        detaliu: "Foaia lunii, doar rândul meu.",
      });
    }
  }
  if (poateDeschide("/concedii", context)) {
    legaturi.push({
      href: "/concedii",
      eticheta: "Concediile mele",
      detaliu: "Cererile și soldul meu.",
    });
  }
  if (poateDeschide("/ticketing", context)) {
    legaturi.push({
      href: "/ticketing",
      eticheta: "Tichetele mele",
      detaliu: "Ce am cerut la IT și unde a ajuns.",
    });
  }
  if (poateDeschide("/inventar/in-primire", context)) {
    legaturi.push({
      href: "/inventar/in-primire",
      eticheta: "În primirea mea",
      detaliu: "Bunurile pentru care am semnat.",
    });
  }
  if (poateDeschide("/notificari", context)) {
    legaturi.push({
      href: "/notificari",
      eticheta: "Notificările mele",
      detaliu: "Tot ce mi s-a trimis.",
    });
  }
  return legaturi;
}

export default async function PaginaProfil() {
  const user = await requireUser();
  const [profil, legaturi] = await Promise.all([
    citesteProfilPropriu(user.id),
    legaturilePersonale(),
  ]);

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina
        titlu="Profilul meu"
        descriere={
          (profil?.email ?? user.email) +
          (profil === null ? "" : ` · cont din ${formatDateTime(profil.created_at)}`)
        }
      />

      <FormularProfil
        numeInitial={profil?.full_name ?? user.fullName ?? ""}
        telefonInitial={profil?.phone ?? null}
        avatarUrlInitial={urlAvatar(profil?.avatar_path ?? null)}
      />

      {legaturi.length === 0 ? null : (
        <section
          aria-labelledby="titlu-ce-tine-de-mine"
          className="border-border bg-surface rounded-panou shadow-ridicat border p-5"
        >
          <h2 id="titlu-ce-tine-de-mine" className="text-sectiune mb-1 font-medium">
            Ce ține de mine
          </h2>
          <p className="text-muted-foreground text-nota mb-4">
            Datele de mai sus sunt ale contului. Ce urmează e al fișei de angajat și al modulelor,
            în firma aleasă.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {legaturi.map((legatura) => (
              <li key={legatura.href}>
                <Link
                  href={legatura.href}
                  className="border-border bg-background rounded-control hover:bg-surface block border p-3 transition-colors"
                >
                  <span className="block font-medium underline-offset-2 hover:underline">
                    {legatura.eticheta}
                  </span>
                  <span className="text-muted-foreground text-nota block">{legatura.detaliu}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
