// src/app/(app)/cursuri/[id]/editare/page.tsx
//
// Ruta care lipsea. `actualizeazaCurs` exista de la prima livrare, cu cele opt
// straturi ale ei și cu traducerea lui 23505 pe câmpul `cod` — dar n-avea
// NICIUN apelant. Practic, un cod greșit sau un termen pus din reflex rămâneau
// definitive: singura ieșire era ștergerea cursului și refacerea lui, cu tot cu
// lecții și înrolări.
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteCurs } from "@/lib/queries/cursuri";

import { FormularCurs } from "../../nou/formular-curs";
import { StareCurs } from "./stare-curs";

export const metadata: Metadata = { title: "Modifică cursul" };

export default async function PaginaEditareCurs({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const cursId = idDinRuta(id);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "courses"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "courses:update", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a modifica cursurile." />;
  }

  const curs = await citesteCurs(tenant.organizationId, cursId);
  if (curs === null) notFound();

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina
        titlu="Modifică cursul"
        descriere="Schimbările se văd imediat în lista angajaților. Termenele deja calculate nu se recalculează."
        firimituri={[
          { eticheta: "Cursuri", href: "/cursuri" },
          { eticheta: curs.denumire, href: `/cursuri/${cursId}` },
          { eticheta: "Modifică" },
        ]}
      />

      {/*
        Aceeași componentă ca la creare, cu `initial`. Un al doilea formular
        „de editare" ar fi divergat de primul la prima schimbare de câmp — și
        exact așa se nasc două înțelesuri pentru „Termen".
      */}
      <FormularCurs
        initial={{
          id: curs.id,
          cod: curs.cod,
          denumire: curs.denumire,
          descriere: curs.descriere,
          obligatoriu: curs.obligatoriu,
          valabilitate_luni: curs.valabilitate_luni,
          termen_zile: curs.termen_zile,
          prag_avertizare_zile: curs.prag_avertizare_zile,
        }}
      />

      <StareCurs cursId={cursId} denumire={curs.denumire} activ={curs.activ} />
    </div>
  );
}
