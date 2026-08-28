// src/app/(app)/salarizare/[id]/[entryId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { Fluturas } from "@/components/payroll/fluturas";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  citesteInregistrare,
  citestePerioada,
  listeazaBonusuriSiRetineri,
} from "@/lib/queries/payroll";

import { AVERTISMENT_SALARIZARE } from "../../etichete";

export const metadata: Metadata = { title: "Fluturaș" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string; readonly entryId: string }>;
}

export default async function PaginaFluturas({ params }: ProprietatiPagina) {
  const { id, entryId } = await params;
  idDinRuta(id);
  const idInregistrare = idDinRuta(entryId);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:read", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta salarizarea." />
      </div>
    );
  }

  const inregistrare = await citesteInregistrare(tenant.organizationId, idInregistrare);
  if (inregistrare === null) notFound();
  // Amândouă depind de `inregistrare`, dar nu una de alta — deci un val, nu două.
  const [perioada, { bonusuri, retineri }] = await Promise.all([
    // Aici perioada CHIAR se poate citi: ecranul cere `payroll:read = "all"`,
    // adică exact ce cere `payroll_periods_select`. În portal nu se poate — vezi
    // nota de pe `perioada` din `Fluturas`.
    citestePerioada(tenant.organizationId, inregistrare.period_id),
    listeazaBonusuriSiRetineri(
      tenant.organizationId,
      inregistrare.period_id,
      inregistrare.employee_id,
    ),
  ]);

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href={`/salarizare/${id}`} className="underline-offset-2 hover:underline">
            Perioada de salarizare
          </Link>
        </p>
        <AntetPagina
          titlu={inregistrare.angajat?.full_name ?? inregistrare.angajat?.marca ?? "Angajat"}
        />
      </div>

      <div
        role="note"
        className="border-warning/40 bg-warning/8 rounded-panou text-nota border p-4"
      >
        {AVERTISMENT_SALARIZARE}
      </div>

      <Fluturas
        inregistrare={inregistrare}
        bonusuri={bonusuri}
        retineri={retineri}
        perioada={perioada === null ? null : { an: perioada.an, luna: perioada.luna }}
      />

      <a
        href={`/api/export/salarizare/fluturas?inregistrare=${inregistrare.id}`}
        className={buton({ varianta: "secundar" })}
      >
        Descarcă fluturașul (PDF)
      </a>
    </div>
  );
}
