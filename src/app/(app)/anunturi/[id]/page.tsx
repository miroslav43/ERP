// src/app/(app)/anunturi/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { idFisaProprie } from "@/lib/queries/employees";
import { citesteAnunt, cititoriAnunt, numarAngajatiCuCont } from "@/lib/queries/announcements";

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
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta avizierul." />
      </div>
    );
  }

  const anunt = await citesteAnunt(tenant.organizationId, id);
  if (anunt === null) notFound();

  const poateAdministra = can(permisiuni, "announcements:update", "all");
  const propriaFisaId = await idFisaProprie(tenant.organizationId, user.id);
  const publicat = anunt.publicat_la !== null;

  // Numitorul e numărul de angajați activi CU CONT, nu numărul de angajați
  // activi: confirmarea se scrie din portal, iar un angajat fără `user_id` nu
  // se poate autentifica, deci nu poate confirma niciodată. Cu vechiul numitor,
  // „3 / 47” nu putea ajunge la 47 nici dacă toată lumea citea.
  const [cititori, totalConturi] = poateAdministra
    ? await Promise.all([cititoriAnunt(anunt.id), numarAngajatiCuCont(tenant.organizationId)])
    : [null, null];

  const descriere =
    (publicat
      ? `Publicat ${formatDateTime(anunt.publicat_la as string)}`
      : "Ciornă — nepublicat încă") +
    (anunt.expira_la === null ? "" : ` · expiră ${formatDateTime(anunt.expira_la)}`);

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/anunturi" className="underline-offset-2 hover:underline">
            Anunțuri
          </Link>
        </p>
        <AntetPagina titlu={anunt.titlu} descriere={descriere} />
      </div>

      {!publicat && poateAdministra ? <PublicaButon id={anunt.id} /> : null}

      <div className="border-border rounded-panou text-corp border p-4 whitespace-pre-wrap">
        {anunt.continut}
      </div>

      {publicat && propriaFisaId !== null ? <MarcheazaCitit id={anunt.id} /> : null}

      {poateAdministra && cititori !== null ? (
        <section aria-labelledby="cititori" className="space-y-2">
          <h2 id="cititori" className="text-corp font-semibold">
            Confirmări de citire ({cititori.length}
            {totalConturi === null ? "" : ` / ${totalConturi}`})
          </h2>
          {totalConturi === null ? null : (
            <p className="text-muted-foreground text-nota">
              Numitorul e numărul angajaților activi care au cont în aplicație — ceilalți nu au de
              unde confirma.
            </p>
          )}
          {cititori.length === 0 ? (
            <p className="text-muted-foreground text-corp">Nimeni nu l-a citit încă.</p>
          ) : (
            <ul className="divide-border border-border rounded-panou text-corp divide-y border">
              {cititori.map((c) => (
                <li key={c.employee_id} className="flex items-center justify-between px-4 py-2">
                  <span>{c.angajat?.full_name ?? c.angajat?.marca ?? "—"}</span>
                  <span className="text-muted-foreground text-nota">
                    {formatDateTime(c.citit_la)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
