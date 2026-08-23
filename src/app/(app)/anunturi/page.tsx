// src/app/(app)/anunturi/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { listeazaAnunturi } from "@/lib/queries/announcements";
import { Megaphone, Pin } from "lucide-react";

import { FormularAnuntNou } from "./formular-anunt-nou";

export const metadata: Metadata = { title: "Anunțuri" };

export default async function PaginaAnunturi() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "announcements");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "announcements:read", "own")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta avizierul." />
      </div>
    );
  }

  const poateAdministra = can(permisiuni, "announcements:update", "all");
  const anunturi = await listeazaAnunturi(tenant.organizationId);
  const acum = new Date();

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina titlu="Anunțuri" descriere="Avizierul organizației." />

      {poateAdministra ? <FormularAnuntNou /> : null}

      {anunturi.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Megaphone}
          titlu="Niciun anunț"
          descriere={
            poateAdministra
              ? "Scrieți primul anunț mai sus."
              : "Nu există încă niciun anunț publicat."
          }
        />
      ) : (
        <ul className="divide-border border-border rounded-panou divide-y border">
          {anunturi.map((a) => {
            const ciorna = a.publicat_la === null;
            const expirat =
              a.expira_la !== null && new Date(a.expira_la).getTime() < acum.getTime();
            return (
              <li key={a.id} className="p-4">
                <Link
                  href={`/anunturi/${a.id}`}
                  className="flex flex-wrap items-center gap-2 underline-offset-2 hover:underline"
                >
                  {a.fixat ? <Pin className="text-primary size-4 shrink-0" aria-hidden /> : null}
                  <span className="font-medium">{a.titlu}</span>
                  {ciorna ? (
                    <span className="bg-surface text-muted-foreground text-nota rounded px-2 py-0.5">
                      Ciornă
                    </span>
                  ) : null}
                  {expirat ? (
                    <span className="bg-surface text-muted-foreground text-nota rounded px-2 py-0.5">
                      Expirat
                    </span>
                  ) : null}
                </Link>
                <p className="text-muted-foreground text-nota mt-1">
                  {a.publicat_la === null
                    ? `Creat ${formatDateTime(a.created_at)}`
                    : `Publicat ${formatDateTime(a.publicat_la)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
