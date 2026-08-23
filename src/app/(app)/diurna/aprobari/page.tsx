// src/app/(app)/diurna/aprobari/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { angajatiDupaId, listeazaDeplasari, type RandDeplasare } from "@/lib/queries/per-diem";

import { NavDiurna } from "../nav-diurna";
import { DecizieDeplasare } from "./decizie-deplasare";

export const metadata: Metadata = { title: "Deplasări de aprobat" };

function ListaGrup({
  titlu,
  randuri,
  angajati,
  status,
}: {
  readonly titlu: string;
  readonly randuri: readonly RandDeplasare[];
  readonly angajati: ReadonlyMap<string, Readonly<{ full_name: string | null; marca: string }>>;
  readonly status: "in_aprobare" | "aprobata";
}) {
  if (randuri.length === 0) return null;

  return (
    <section aria-labelledby={`titlu-${status}`} className="space-y-3">
      <h2 id={`titlu-${status}`} className="text-sectiune font-medium">
        {titlu}
      </h2>
      <ul className="space-y-3">
        {randuri.map((r) => {
          const angajat = angajati.get(r.employee_id);
          return (
            <li key={r.id} className="border-border rounded-panou border p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium">
                    <Link href={`/diurna/${r.id}`} className="underline-offset-2 hover:underline">
                      {r.scop}
                    </Link>
                    {angajat === undefined ? null : (
                      <span className="text-muted-foreground">
                        {" "}
                        · {angajat.full_name ?? "—"} ({angajat.marca})
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-corp">
                    {formatDateTime(new Date(r.plecare_la))} –{" "}
                    {formatDateTime(new Date(r.sosire_la))}
                    {r.localitate === null ? "" : ` · ${r.localitate}`}
                  </p>
                </div>
                <DecizieDeplasare id={r.id} status={status} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function ListaDeAprobat({ organizationId }: { readonly organizationId: string }) {
  const [inAprobare, aprobate] = await Promise.all([
    listeazaDeplasari(organizationId, { status: "in_aprobare", cursor: null, limita: 100 }),
    listeazaDeplasari(organizationId, { status: "aprobata", cursor: null, limita: 100 }),
  ]);

  if (inAprobare.randuri.length === 0 && aprobate.randuri.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={CheckCircle2}
        titlu="Nimic de aprobat"
        descriere="Nicio deplasare în aprobare și nicio deplasare aprobată în așteptarea decontului."
      />
    );
  }

  const idAngajati = [...inAprobare.randuri, ...aprobate.randuri].map((r) => r.employee_id);
  const angajati = await angajatiDupaId(organizationId, idAngajati);

  return (
    <div className="space-y-8">
      <ListaGrup
        titlu="În aprobare"
        randuri={inAprobare.randuri}
        angajati={angajati}
        status="in_aprobare"
      />
      <ListaGrup
        titlu="Aprobate — de decontat"
        randuri={aprobate.randuri}
        angajati={angajati}
        status="aprobata"
      />
    </div>
  );
}

export default async function PaginaAprobari() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "per_diem:approve", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a aproba deplasări. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Deplasări de aprobat"
        descriere="Nu vă puteți aproba propria deplasare — regula e verificată de baza de date, indiferent de rol."
        file={<NavDiurna poateAproba />}
      />

      <Suspense fallback={<Schelet forma="lista" />}>
        <ListaDeAprobat organizationId={tenant.organizationId} />
      </Suspense>
    </div>
  );
}
