// src/app/(app)/diurna/[id]/editeaza/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { cn } from "@/lib/ui/cn";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteDeplasare, tari } from "@/lib/queries/per-diem";

import { ETICHETE_STATUS_DEPLASARE } from "../../etichete";
import { FormularEditareDeplasare } from "../formular-editare";

export const metadata: Metadata = { title: "Corectează deplasarea" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaEditareDeplasare({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "per_diem"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "per_diem:update", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a modifica deplasări. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const deplasare = await citesteDeplasare(tenant.organizationId, id);
  if (deplasare === null) notFound();

  const editabila = deplasare.status === "ciorna" || deplasare.status === "respinsa";

  return (
    <div className={cn(LATIMI.detaliu, "space-y-6")}>
      <AntetPagina
        firimituri={[
          { eticheta: "Deplasări", href: "/diurna" },
          { eticheta: deplasare.scop, href: `/diurna/${deplasare.id}` },
          { eticheta: "Corectură" },
        ]}
        titlu="Corectează deplasarea"
        descriere="Se pot corecta datele de bază cât timp deplasarea e ciornă sau a fost respinsă. Traseul pe etape și cheltuielile se administrează pe fișă."
        actiuni={
          <Link href={`/diurna/${deplasare.id}`} className={buton({ varianta: "secundar" })}>
            Înapoi la fișă
          </Link>
        }
      />

      {editabila ? (
        <FormularEditareDeplasare deplasare={deplasare} tari={await tari()} />
      ) : (
        /* Poarta e aici, nu doar în bază: politica `business_trips_update` ar
           respinge oricum scrierea, dar un UPDATE respins de clauza USING
           afectează ZERO rânduri fără nicio eroare — omul ar fi completat
           formularul întreg ca să afle la final că nu s-a scris nimic. */
        <Callout
          fel="atentie"
          titlu={`Deplasarea e în starea „${ETICHETE_STATUS_DEPLASARE[deplasare.status]}”`}
          actiune={
            <Link href={`/diurna/${deplasare.id}`} className={buton({ varianta: "secundar" })}>
              Deschide fișa
            </Link>
          }
        >
          Datele de bază se pot corecta doar cât timp deplasarea e ciornă sau a fost respinsă. După
          trimiterea spre aprobare, o schimbare cere întâi o decizie a aprobatorului.
        </Callout>
      )}
    </div>
  );
}
