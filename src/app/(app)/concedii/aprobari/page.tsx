// src/app/(app)/concedii/aprobari/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatAmount } from "@/lib/format/money";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { deAprobat } from "@/lib/queries/leave";

import { NavConcedii } from "../nav-concedii";
import { DecizieAprobare } from "./decizie-aprobare";

export const metadata: Metadata = { title: "Aprobări concedii" };

export default async function PaginaAprobariConcedii() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "leave:approve", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a aproba cereri de concediu. Această secțiune este rezervată managerilor și personalului de resurse umane." />
    );
  }

  const poateVedeaCalendar = can(permisiuni, "leave:read", "team");
  const poateConfigura = can(permisiuni, "leave:update", "all");
  const sarcini = await deAprobat(tenant.organizationId, user.id);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Aprobări"
        descriere="Cererile de concediu care așteaptă decizia dumneavoastră."
        file={
          <NavConcedii
            poateAproba={true}
            poateVedeaCalendar={poateVedeaCalendar}
            poateConfigura={poateConfigura}
          />
        }
      />

      {sarcini.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={ClipboardCheck}
          titlu="Nimic de aprobat"
          descriere="Nu aveți nicio cerere de concediu în așteptarea deciziei dumneavoastră."
        />
      ) : (
        <ul className="space-y-3">
          {sarcini.map((sarcina) => (
            <li key={sarcina.taskId} className="border-border rounded-panou border p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    <span
                      className="mr-2 inline-block size-2.5 rounded-full align-middle"
                      style={{ backgroundColor: sarcina.tip?.culoare ?? "#94a3b8" }}
                      aria-hidden="true"
                    />
                    {sarcina.angajat === null
                      ? "Angajat"
                      : `${sarcina.angajat.fullName} (${sarcina.angajat.marca})`}
                    {" · "}
                    {sarcina.tip?.denumire ?? "Concediu"}
                  </p>
                  <p className="text-muted-foreground text-corp mt-1">
                    {formatDate(sarcina.cerere.dataInceput)} –{" "}
                    {formatDate(sarcina.cerere.dataSfarsit)} ·{" "}
                    {formatAmount(sarcina.cerere.zileLucratoare)} zile lucrătoare
                  </p>
                  {sarcina.termenLa !== null ? (
                    <p className="text-foreground text-nota mt-1">
                      Termen de decizie: {formatDateTime(sarcina.termenLa)}
                    </p>
                  ) : null}
                  <Link
                    href={`/concedii/${sarcina.cerere.id}`}
                    className="text-primary text-nota mt-1 inline-block underline-offset-2 hover:underline"
                  >
                    Vezi cererea completă
                  </Link>
                </div>
                <DecizieAprobare taskId={sarcina.taskId} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
