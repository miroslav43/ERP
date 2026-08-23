// src/app/(app)/onboarding/[id]/dovada/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FileCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { angajatiDupaId, citesteInstanta, dovadaParcurgerii } from "@/lib/queries/checklist";
import { continutDovadaSchema } from "@/schemas/checklist";

import { ETICHETE_STATUS_ITEM, ETICHETE_TIP, ETICHETE_TIP_DOVADA } from "../../etichete";
import { ButonTiparire } from "./buton-tiparire";

export const metadata: Metadata = { title: "Dovada de parcurgere" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaDovada({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta checklisturile de integrare. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  // `citesteInstanta` confirmă că instanța există și e vizibilă — un id
  // valid dar dintr-o altă organizație (sau invizibil pentru RLS) dă 404,
  // exact ca la pagina detaliului, nu un ecran gol nedeslușit.
  const instanta = await citesteInstanta(tenant.organizationId, id);
  if (instanta === null) notFound();

  const dovada = await dovadaParcurgerii(tenant.organizationId, id);

  if (dovada === null) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <p className="text-muted-foreground text-sm print:hidden">
          <Link href={`/onboarding/${id}`} className="underline-offset-2 hover:underline">
            Înapoi la checklist
          </Link>
        </p>
        <EmptyState
          icon={FileCheck}
          title="Dovada nu există încă"
          description="Dovada se generează automat la finalizarea checklistului. Reveniți după ce toți pașii obligatorii sunt bifați."
        />
      </main>
    );
  }

  // Conținutul jsonb se validează la graniță — niciun `any`, niciun cast.
  // O nepotrivire aici e semn de date corupte sau de schimbare a formei
  // scrise de trigger; se lasă să treacă la `error.tsx`, nu se ascunde.
  const continut = continutDovadaSchema.parse(dovada.continut);

  const poateVedeaAngajati = can(permisiuni, "employees:read", "team");
  const angajat = poateVedeaAngajati
    ? (await angajatiDupaId(tenant.organizationId, [dovada.employee_id])).get(dovada.employee_id)
    : undefined;

  return (
    <main className="bg-background mx-auto w-full max-w-3xl space-y-6 p-6 text-black print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/onboarding/${id}`} className="text-sm underline-offset-2 hover:underline">
          Înapoi la checklist
        </Link>
        <ButonTiparire />
      </div>

      <header className="border-foreground/60 space-y-1 border-b pb-4 print:break-inside-avoid">
        <h1 className="text-xl font-semibold">Dovadă de parcurgere a checklistului</h1>
        <p className="text-sm">
          {angajat === undefined
            ? "Angajat"
            : `${angajat.full_name ?? angajat.marca} (${angajat.marca})`}{" "}
          · {ETICHETE_TIP[dovada.tip]} · Ciclul {dovada.ciclu}
        </p>
        <p className="text-sm">Finalizată la {formatDateTime(dovada.finalizata_la)}</p>
        <p className="text-sm">
          {dovada.pasi_bifati} din {dovada.total_pasi} pași bifați, {dovada.pasi_obligatorii}{" "}
          obligatorii
        </p>
        <p className="text-muted-foreground font-mono text-xs">
          Amprenta documentului: {dovada.continut_checksum}
        </p>
      </header>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Pașii checklistului, așa cum erau la finalizare.</caption>
        <thead>
          <tr className="border-foreground/60 border-b text-left">
            <th scope="col" className="py-2 pr-2 font-medium">
              #
            </th>
            <th scope="col" className="py-2 pr-2 font-medium">
              Pas
            </th>
            <th scope="col" className="py-2 pr-2 font-medium">
              Dovadă
            </th>
            <th scope="col" className="py-2 pr-2 font-medium">
              Stare
            </th>
            <th scope="col" className="py-2 font-medium">
              Bifat la
            </th>
          </tr>
        </thead>
        <tbody>
          {continut.map((pas) => (
            <tr key={pas.ordine} className="border-border border-b print:break-inside-avoid">
              <td className="py-2 pr-2 align-top">{pas.ordine}</td>
              <td className="py-2 pr-2 align-top">
                {pas.titlu}
                {pas.obligatoriu ? <span className="ml-1 text-xs">(obligatoriu)</span> : null}
                {pas.observatii === null ? null : (
                  <p className="text-muted-foreground text-xs">{pas.observatii}</p>
                )}
              </td>
              <td className="py-2 pr-2 align-top">{ETICHETE_TIP_DOVADA[pas.tip_dovada]}</td>
              <td className="py-2 pr-2 align-top">{ETICHETE_STATUS_ITEM[pas.status]}</td>
              <td className="py-2 align-top">
                {pas.bifat_la === null ? "—" : formatDateTime(pas.bifat_la)}
                {pas.bifat_automat ? " (automat)" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
