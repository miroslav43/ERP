// src/app/(app)/anunturi/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { idFisaProprie } from "@/lib/queries/employees";
import { citesteAnunt, cititoriAnunt, numarAngajatiActivi } from "@/lib/queries/announcements";

import { MarcheazaCitit } from "./marcheaza-citit";
import { PublicaButon } from "./publica-buton";

export const metadata: Metadata = { title: "Anunț" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaAnunt({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "announcements");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "announcements:read", "own")) {
    return (
      <main className="p-6">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta avizierul." />
      </main>
    );
  }

  const anunt = await citesteAnunt(tenant.organizationId, id);
  if (anunt === null) notFound();

  const poateAdministra = can(permisiuni, "announcements:update", "all");
  const propriaFisaId = await idFisaProprie(tenant.organizationId, user.id);
  const publicat = anunt.publicat_la !== null;

  const [cititori, totalAngajati] = poateAdministra
    ? await Promise.all([cititoriAnunt(anunt.id), numarAngajatiActivi(tenant.organizationId)])
    : [null, null];

  return (
    <main className="max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">
          <Link href="/anunturi" className="underline-offset-2 hover:underline">
            Anunțuri
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">{anunt.titlu}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {publicat
            ? `Publicat ${formatDateTime(anunt.publicat_la as string)}`
            : "Ciornă — nepublicat încă"}
          {anunt.expira_la === null ? "" : ` · expiră ${formatDateTime(anunt.expira_la)}`}
        </p>
      </header>

      {!publicat && poateAdministra ? <PublicaButon id={anunt.id} /> : null}

      <div className="border-border rounded-lg border p-4 text-sm whitespace-pre-wrap">
        {anunt.continut}
      </div>

      {publicat && propriaFisaId !== null ? <MarcheazaCitit id={anunt.id} /> : null}

      {poateAdministra && cititori !== null ? (
        <section aria-labelledby="cititori" className="space-y-2">
          <h2 id="cititori" className="text-sm font-semibold">
            Confirmări de citire ({cititori.length}
            {totalAngajati === null ? "" : ` / ${totalAngajati}`})
          </h2>
          {cititori.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nimeni nu l-a citit încă.</p>
          ) : (
            <ul className="divide-border border-border divide-y rounded-lg border text-sm">
              {cititori.map((c) => (
                <li key={c.employee_id} className="flex items-center justify-between px-4 py-2">
                  <span>{c.angajat?.full_name ?? c.angajat?.marca ?? "—"}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(c.citit_la)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
