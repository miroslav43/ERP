// src/app/(app)/setari/audit/page.tsx
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { JurnalAudit } from "@/components/audit/jurnal-audit";
import { ScheletAudit } from "@/components/audit/schelet-audit";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { cheieFiltre, parseazaFiltre } from "@/lib/queries/audit";
import {
  RUTA_ALEGE_ORGANIZATIA,
  RUTA_AUTENTIFICARE,
  RUTA_DUPA_AUTENTIFICARE,
} from "@/config/routes";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jurnal de audit",
  description: "Evenimentele înregistrate în organizația ta.",
};

const CALE = "/setari/audit";

type Props = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function PaginaAuditOrganizatie({ searchParams }: Props) {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") redirect(RUTA_AUTENTIFICARE);
  if (rezolvare.status === "alegere_necesara") redirect(RUTA_ALEGE_ORGANIZATIA);
  if (rezolvare.status !== "ok") redirect(RUTA_DUPA_AUTENTIFICARE);

  const { tenant } = rezolvare;
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const scope = scopeFor(permisiuni, "audit:read");

  // `none` este refuz explicit, la fel ca orice scope mai mic decât `all` (S3).
  if (scope !== "all") {
    return (
      <div className={LATIMI.formular}>
        <div className="border-border bg-surface rounded-panou border p-8 text-center">
          <Lock aria-hidden="true" className="text-warning mx-auto size-6" />
          <h1 className="text-foreground text-sectiune mt-3 font-semibold">Acces restricționat</h1>
          <p className="text-muted-foreground text-corp mt-2">
            Jurnalul de audit poate fi consultat doar de administratorii organizației. Cere-i
            administratorului tău dreptul necesar dacă ai nevoie de el.
          </p>
        </div>
      </div>
    );
  }

  const brute = await searchParams;
  // Organizația se derivă din tenant, niciodată din ceea ce trimite clientul (S1).
  const filtre = { ...parseazaFiltre(brute), organizationId: tenant.organizationId };

  return (
    <div className={`${LATIMI.lista} space-y-6`}>
      <AntetPagina
        titlu="Jurnal de audit"
        descriere={`Ce s-a întâmplat în ${tenant.name}: cine, ce și când. Înregistrările nu pot fi modificate sau șterse.`}
      />

      <Suspense key={cheieFiltre(filtre)} fallback={<ScheletAudit />}>
        <JurnalAudit cale={CALE} filtre={filtre} mod="organizatie" />
      </Suspense>
    </div>
  );
}
