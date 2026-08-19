// src/app/(app)/salarizare/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiActiviCuContract,
  citestePerioada,
  listeazaInregistrari,
  primeSiRetineriPerioada,
  type RandPrimaPerioada,
  type RandRetinerePerioada,
} from "@/lib/queries/payroll";
import { Users } from "lucide-react";

import { CLASE_STATUS_PERIOADA, ETICHETE_STATUS_PERIOADA, numeLuna } from "../etichete";
import { ActiuniPerioada } from "./actiuni-perioada";
import { RandAngajatDraft } from "./rand-angajat-draft";

export const metadata: Metadata = { title: "Perioadă de salarizare" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaPerioada({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "payroll:read", "all")) {
    return (
      <main className="p-6">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta salarizarea." />
      </main>
    );
  }

  const perioada = await citestePerioada(tenant.organizationId, id);
  if (perioada === null) notFound();

  const inregistrari = perioada.status === "draft" ? [] : await listeazaInregistrari(perioada.id);
  const poateCalcula = can(permisiuni, "payroll:create", "all");
  const poateAproba = can(permisiuni, "payroll:approve", "all");

  const angajatiDraft =
    perioada.status === "draft" && poateCalcula
      ? await angajatiActiviCuContract(tenant.organizationId)
      : [];
  const { prime, retineri } =
    perioada.status === "draft" && poateCalcula
      ? await primeSiRetineriPerioada(tenant.organizationId, perioada.id)
      : { prime: [], retineri: [] };

  const primePeAngajat = new Map<string, RandPrimaPerioada[]>();
  for (const p of prime) {
    primePeAngajat.set(p.employee_id, [...(primePeAngajat.get(p.employee_id) ?? []), p]);
  }
  const retineriPeAngajat = new Map<string, RandRetinerePerioada[]>();
  for (const r of retineri) {
    retineriPeAngajat.set(r.employee_id, [...(retineriPeAngajat.get(r.employee_id) ?? []), r]);
  }

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">
            <Link href="/salarizare" className="underline-offset-2 hover:underline">
              Salarizare
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">
            {numeLuna(perioada.luna)} {perioada.an}
          </h1>
        </div>
        <span
          className={`rounded px-3 py-1 text-sm font-medium ${CLASE_STATUS_PERIOADA[perioada.status] ?? ""}`}
        >
          {ETICHETE_STATUS_PERIOADA[perioada.status] ?? perioada.status}
        </span>
      </header>

      <section
        aria-label="Totaluri"
        className="border-border grid gap-4 rounded-lg border p-4 sm:grid-cols-3"
      >
        <div>
          <dt className="text-muted-foreground text-xs">Total brut</dt>
          <dd className="text-lg font-medium">{formatLei(perioada.total_brut)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Total net</dt>
          <dd className="text-lg font-medium">{formatLei(perioada.total_net)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Cost total angajator</dt>
          <dd className="text-lg font-medium">{formatLei(perioada.total_cost_angajator)}</dd>
        </div>
      </section>

      <ActiuniPerioada
        id={perioada.id}
        status={perioada.status}
        poateCalcula={poateCalcula}
        poateAproba={poateAproba}
      />

      {perioada.status === "draft" ? (
        <>
          <EmptyState
            icon={Users}
            title="Perioada nu a fost încă calculată"
            description="Adăugați bonusuri sau rețineri per angajat mai jos, apoi apăsați „Calculează” pentru a genera fluturașii tuturor angajaților activi cu contract activ, pe baza pontajului blocat al lunii."
          />
          {poateCalcula && angajatiDraft.length > 0 ? (
            <ul className="border-border divide-border divide-y rounded-lg border">
              {angajatiDraft.map((a) => (
                <li key={a.employee_id} className="p-4">
                  <RandAngajatDraft
                    periodId={perioada.id}
                    employeeId={a.employee_id}
                    nume={a.full_name || a.marca}
                    salariuBaza={a.salariu_baza}
                    prime={primePeAngajat.get(a.employee_id) ?? []}
                    retineri={retineriPeAngajat.get(a.employee_id) ?? []}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Angajat
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Brut
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Net
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Net de plată
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Cost angajator
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {inregistrari.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/salarizare/${perioada.id}/${r.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {r.angajat?.full_name ?? r.angajat?.marca ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatLei(r.brut)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatLei(r.net)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatLei(r.net_de_plata)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatLei(r.cost_total_angajator)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
