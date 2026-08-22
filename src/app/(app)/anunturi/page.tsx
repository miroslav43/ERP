// src/app/(app)/anunturi/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "announcements:read", "own")) {
    return (
      <main className="p-6">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta avizierul." />
      </main>
    );
  }

  const poateAdministra = can(permisiuni, "announcements:update", "all");
  const anunturi = await listeazaAnunturi(tenant.organizationId);
  const acum = new Date();

  return (
    <main className="max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Anunțuri</h1>
        <p className="text-muted-foreground text-sm">Avizierul organizației.</p>
      </header>

      {poateAdministra ? <FormularAnuntNou /> : null}

      {anunturi.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Niciun anunț"
          description={
            poateAdministra
              ? "Scrieți primul anunț mai sus."
              : "Nu există încă niciun anunț publicat."
          }
        />
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
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
                    <span className="bg-surface text-muted-foreground rounded px-2 py-0.5 text-xs">
                      Ciornă
                    </span>
                  ) : null}
                  {expirat ? (
                    <span className="bg-surface text-muted-foreground rounded px-2 py-0.5 text-xs">
                      Expirat
                    </span>
                  ) : null}
                </Link>
                <p className="text-muted-foreground mt-1 text-xs">
                  {a.publicat_la === null
                    ? `Creat ${formatDateTime(a.created_at)}`
                    : `Publicat ${formatDateTime(a.publicat_la)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
