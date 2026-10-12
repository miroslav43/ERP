// src/app/(app)/onboarding/noua/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { angajatiActivi, sabloaneActive } from "@/lib/queries/checklist";
import { todayInBucharest } from "@/lib/format/date";

import { FormularInstanta } from "./formular-instanta";

export const metadata: Metadata = { title: "Instanță de checklist nouă" };

const TIPAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidDin(valoare: string | string[] | undefined): string | null {
  return typeof valoare === "string" && TIPAR_UUID.test(valoare) ? valoare : null;
}

export default async function PaginaInstantaNoua({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "onboarding"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "checklists:create", "all")) {
    return (
      <AccesRestrictionat mesaj="Pornirea unui checklist e rezervată celor care administrează integrarea angajaților. Solicitați dreptul necesar dacă aveți nevoie de el." />
    );
  }

  // Preselecții din adresă (pagina șablonului, fișa angajatului): un UUID
  // valid sau nimic. Un id necunoscut nu se potrivește cu nicio opțiune și
  // selectul cade pe prima — fără eroare.
  const parametri = await searchParams;
  const sablonImplicit = uuidDin(parametri["sablon"]);
  const angajatImplicit = uuidDin(parametri["angajat"]);

  const sabloane = await sabloaneActive(tenant.organizationId);
  if (sabloane.length === 0) {
    return (
      <div className={`${LATIMI.formular} space-y-6`}>
        <StareGoala
          fel="initiala"
          pictograma={ListChecks}
          titlu="Niciun șablon activ"
          descriere="O instanță de checklist pornește dintr-un șablon. Creați întâi unul, în secțiunea Șabloane."
          actiune={{ eticheta: "Creează un șablon", href: "/onboarding/sabloane/nou" }}
        />
      </div>
    );
  }

  // `employees:read < team`: câmpul devine un input de identificator, cu
  // mesaj explicativ, nu un `<select>` gol.
  const poateVedeaAngajati = can(permisiuni, "employees:read", "team");
  const angajati = poateVedeaAngajati ? await angajatiActivi(tenant.organizationId) : null;

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/onboarding" className="underline-offset-2 hover:underline">
            Onboarding
          </Link>
        </p>
        <AntetPagina
          titlu="Instanță de checklist nouă"
          descriere="Pașii se copiază automat din șablon la salvare, pe baza datei de referință alese."
        />
      </div>

      <FormularInstanta
        sabloane={sabloane}
        angajati={angajati}
        astazi={todayInBucharest()}
        sablonImplicit={sablonImplicit}
        angajatImplicit={angajatImplicit}
      />
    </div>
  );
}
