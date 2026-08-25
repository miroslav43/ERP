// src/app/(portal)/portal/cursurile-mele/[id]/page.tsx
// Cuprinsul cursului: lecțiile în ordine, cu starea fiecăreia, și UN SINGUR
// buton primar — următoarea lecție neparcursă. Restul sunt linkuri.

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Circle, FileText, Film } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Nivel } from "@/components/ui/nivel";
import { buton } from "@/components/ui/buton";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { formatDate } from "@/lib/format/date";
import { citesteInrolare, citesteCurs, lectiileInrolarii } from "@/lib/queries/cursuri";
import { durataCitibila } from "@/domain/cursuri/scadente";

import { ETICHETE_STATUS_LECTIE, TONURI_STATUS_LECTIE } from "@/app/(app)/cursuri/etichete";
import { FaraFisa } from "../../fara-fisa";
import { fisaMea } from "@/lib/queries/portal";

export const metadata: Metadata = { title: "Curs" };

export default async function PaginaCurs({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const inrolareId = idDinRuta(id);

  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "courses");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cursurile." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const inrolare = await citesteInrolare(tenant.organizationId, inrolareId);
  if (inrolare === null) notFound();
  // A doua poartă, peste RLS: un cont cu `courses:read = all` ar putea citi
  // înrolarea altcuiva, iar ecranul ăsta spune „al meu".
  if (inrolare.employee_id !== stare.fisa.id) notFound();

  const [curs, lectii] = await Promise.all([
    citesteCurs(tenant.organizationId, inrolare.course_id),
    lectiileInrolarii(tenant.organizationId, inrolareId),
  ]);

  const urmatoarea = lectii.find((l) => l.status !== "finalizat");
  const gata = lectii.filter((l) => l.status === "finalizat").length;
  const terminat = inrolare.status === "finalizat";

  return (
    <div className="space-y-6 p-4">
      <AntetPagina
        titlu={curs?.denumire ?? "Curs"}
        descriere={curs?.descriere ?? undefined}
        firimituri={[
          { eticheta: "Cursurile mele", href: "/portal/cursurile-mele" },
          { eticheta: curs?.denumire ?? "Curs" },
        ]}
      />

      <Nivel
        valoare={gata}
        din={Math.max(1, lectii.length)}
        eticheta="Progresul cursului"
        text={`${String(gata)} din ${String(lectii.length)} lecții parcurse`}
        ton={terminat ? "bun" : "neutru"}
      />

      {terminat ? (
        <Callout
          fel="informativ"
          titlu="Ați parcurs acest curs"
          actiune={
            <Link
              href={`/portal/cursurile-mele/${inrolareId}/adeverinta`}
              className={buton({ varianta: "secundar" })}
            >
              Adeverință
            </Link>
          }
        >
          {inrolare.finalizat_la === null
            ? "Felicitări."
            : `Finalizat pe ${formatDate(inrolare.finalizat_la.slice(0, 10))}.`}
          {inrolare.expira_la === null
            ? ""
            : ` Valabil până la ${formatDate(inrolare.expira_la)}, apoi cursul reapare singur.`}
        </Callout>
      ) : null}

      <ol className="divide-border border-border rounded-panou divide-y border">
        {lectii.map((lectie, i) => {
          const parcursa = lectie.status === "finalizat";
          const esteUrmatoarea = urmatoarea?.id === lectie.id;
          return (
            <li key={lectie.id} className="flex items-start gap-3 p-3">
              {parcursa ? (
                <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <span className="text-muted-foreground text-nota mr-1 tabular-nums">
                    {i + 1}.
                  </span>
                  {lectie.titlu}
                </p>
                <p className="text-muted-foreground text-nota mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {lectie.fel === "pdf" ? (
                    <FileText className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Film className="size-3.5" aria-hidden="true" />
                  )}
                  <span>{lectie.fel === "pdf" ? "Document" : "Film"}</span>
                  {lectie.durata_secunde === null ? null : (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{durataCitibila(lectie.durata_secunde)}</span>
                    </>
                  )}
                  {lectie.obligatoriu ? null : <Badge ton="neutru">Opțională</Badge>}
                  <Badge ton={TONURI_STATUS_LECTIE[lectie.status]}>
                    {ETICHETE_STATUS_LECTIE[lectie.status]}
                  </Badge>
                </p>
              </div>
              <Link
                href={`/portal/cursurile-mele/${inrolareId}/${lectie.id}`}
                className={buton({ varianta: esteUrmatoarea ? "primar" : "tertiar" })}
              >
                {parcursa ? "Revezi" : esteUrmatoarea ? "Continuați" : "Deschide"}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
