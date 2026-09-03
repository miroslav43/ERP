// src/app/(portal)/portal/anunturi/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Pin } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { anunturiPublicate, idAnunturiCitite } from "@/lib/queries/announcements";
import { fisaMea } from "@/lib/queries/portal";

export const metadata: Metadata = { title: "Anunțuri" };

export default async function PaginaAnunturiPortal() {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "announcements"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "announcements:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a citi anunțurile firmei." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  const anunturi = await anunturiPublicate(tenant.organizationId, new Date().toISOString());
  // Marcajul „necitit" cere fișă de angajat: `announcement_reads` se leagă pe
  // `employee_id`. Fără fișă, anunțurile se citesc, dar niciunul nu apare ca nou.
  const citite =
    stare.stare === "ok"
      ? await idAnunturiCitite(tenant.organizationId, stare.fisa.id)
      : new Set<string>();

  return (
    <div className={`${LATIMI.lista} space-y-4 p-4`}>
      <AntetPagina titlu="Anunțuri" descriere="Avizierul firmei." />

      {anunturi.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Megaphone}
          titlu="Niciun anunț publicat"
          descriere="Comunicările firmei apar aici, iar cele importante rămân fixate sus."
        />
      ) : (
        <ul className="space-y-2">
          {anunturi.map((anunt) => {
            const necitit = !citite.has(anunt.id);
            return (
              <li key={anunt.id}>
                <Link
                  href={`/portal/anunturi/${anunt.id}`}
                  className="bg-surface border-border hover:border-ring rounded-panou flex min-h-16 items-start gap-3 border p-4 transition-colors"
                >
                  {anunt.fixat ? (
                    <Pin aria-label="Fixat" className="text-accent mt-0.5 size-4 shrink-0" />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground text-corp block font-medium">
                      {anunt.titlu}
                    </span>
                    {anunt.publicat_la === null ? null : (
                      <span className="text-muted-foreground text-nota mt-0.5 block">
                        {formatDate(anunt.publicat_la)}
                      </span>
                    )}
                  </span>
                  {necitit ? (
                    <span
                      aria-label="Necitit"
                      className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
