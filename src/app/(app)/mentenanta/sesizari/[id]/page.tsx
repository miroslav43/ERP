// src/app/(app)/mentenanta/sesizari/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { angajatiDupaId, citesteSesizare } from "@/lib/queries/maintenance";

import {
  CLASE_STATUS_SESIZARE,
  CLASE_URGENTA_SESIZARE,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
} from "../../etichete";
import { cautaEchipament } from "../../actions";
import { ActiuniSesizare } from "./actiuni-sesizare";

export const metadata: Metadata = { title: "Sesizare de defecțiune" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaSesizare({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const sesizare = await citesteSesizare(tenant.organizationId, id);
  if (sesizare === null) notFound();

  // `equipment` nu se poate citi cu clientul utilizatorului pentru un
  // `employee` (col=null ⇒ cere „team”) — reutilizăm acțiunea de căutare,
  // apelată direct dintr-un Server Component, cu id-ul exact (capcane.md #27/#34).
  const [echipamentRezultat, numeAngajati] = await Promise.all([
    cautaEchipament({ q: sesizare.equipment_id }),
    angajatiDupaId(
      tenant.organizationId,
      sesizare.raportat_de_employee_id === null ? [] : [sesizare.raportat_de_employee_id],
    ),
  ]);
  const echipament =
    echipamentRezultat.ok && echipamentRezultat.data.length > 0 ? echipamentRezultat.data[0] : null;

  const poateGestiona = can(permisiuni, "maintenance:update", "team");
  const esteTerminala = sesizare.status === "rezolvat" || sesizare.status === "respins";

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/mentenanta/sesizari" className="underline-offset-2 hover:underline">
            Sesizări
          </Link>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">
            {echipament === undefined || echipament === null
              ? "Echipament necunoscut"
              : `${echipament.cod} — ${echipament.denumire}`}
          </h1>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${CLASE_URGENTA_SESIZARE[sesizare.urgenta]}`}
            >
              {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${CLASE_STATUS_SESIZARE[sesizare.status]}`}
            >
              {ETICHETE_STATUS_SESIZARE[sesizare.status]}
            </span>
          </div>
        </div>
      </div>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">Raportată de</dt>
            <dd className="mt-0.5 text-sm">
              {sesizare.raportat_de_employee_id === null
                ? "—"
                : (numeAngajati.get(sesizare.raportat_de_employee_id)?.full_name ?? "—")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">Raportată la</dt>
            <dd className="mt-0.5 text-sm">{formatDateTime(sesizare.raportat_la)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">Descriere</dt>
            <dd className="mt-0.5 text-sm">{sesizare.descriere}</dd>
          </div>
          {sesizare.opreste_functionarea ? (
            <div className="sm:col-span-2">
              <p className="text-danger text-sm font-medium">
                Defecțiunea oprește funcționarea echipamentului.
              </p>
            </div>
          ) : null}
          {sesizare.motiv_respingere !== null ? (
            <div className="sm:col-span-2">
              <dt className="text-danger text-xs tracking-wide uppercase">Motivul respingerii</dt>
              <dd className="mt-0.5 text-sm">{sesizare.motiv_respingere}</dd>
            </div>
          ) : null}
          {sesizare.rezolvat_la !== null ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Rezolvată la
              </dt>
              <dd className="mt-0.5 text-sm">{formatDateTime(sesizare.rezolvat_la)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {poateGestiona && !esteTerminala ? (
        <section aria-labelledby="actiuni-sesizare" className="space-y-3">
          <h2 id="actiuni-sesizare" className="text-lg font-semibold">
            Triaj și rezolvare
          </h2>
          <ActiuniSesizare sesizareId={sesizare.id} />
        </section>
      ) : null}
    </main>
  );
}
