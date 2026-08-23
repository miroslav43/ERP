// src/app/(portal)/portal/diurna-mea/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { formatDate, formatDateTime } from "@/lib/format/date";
import {
  baremeleTarilor,
  cheltuielile,
  citesteDeplasare,
  etapele,
  politicaLaData,
  tari,
} from "@/lib/queries/per-diem";
import { fisaMea } from "@/lib/queries/portal";
import { ActiuniDeplasare } from "@/app/(app)/diurna/[id]/actiuni-deplasare";
import { Etape } from "@/app/(app)/diurna/[id]/etape";
import { FormularCheltuiala } from "@/app/(app)/diurna/[id]/formular-cheltuiala";
import { ETICHETE_STATUS_DEPLASARE, TONURI_STATUS_DEPLASARE } from "@/app/(app)/diurna/etichete";

import { FaraFisa } from "../../fara-fisa";

export const metadata: Metadata = { title: "Deplasarea mea" };

export default async function PaginaDeplasareaMea({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const deplasareId = idDinRuta(id);

  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta deplasările." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const deplasare = await citesteDeplasare(tenant.organizationId, deplasareId);
  if (deplasare === null) notFound();

  // Garda de proprietate: `app.poate_accesa_deplasare` are ramuri pentru manager
  // și pentru `per_diem:read = all`, legitime în aplicația mare. Aici, ruta
  // spune „deplasarea mea".
  if (deplasare.employee_id !== stare.fisa.id) notFound();

  const [etapeTrip, cheltuieliTrip, listaTari] = await Promise.all([
    etapele(deplasare.id),
    cheltuielile(deplasare.id),
    tari(),
  ]);

  const politica = await politicaLaData(tenant.organizationId, deplasare.plecare_la.slice(0, 10));

  const idTariImplicate = [
    ...new Set(
      [
        deplasare.country_id,
        politica?.country_id_intern ?? null,
        ...etapeTrip.flatMap((e) => [e.from_country_id, e.to_country_id]),
      ].filter((v): v is string => v !== null),
    ),
  ];
  const baremuri = await baremeleTarilor(idTariImplicate);
  // `Etape` cere o hartă, nu o listă: caută țara etapei după identificator.
  const hartaTari = new Map(listaTari.map((t) => [t.id, t]));

  const editabila = deplasare.status === "ciorna" || deplasare.status === "respinsa";
  const poateTrimite = can(permisiuni, "per_diem:update", "own") && editabila;
  const poateSterge = can(permisiuni, "per_diem:delete", "own") && deplasare.status === "ciorna";
  const poateAdaugaCheltuiala = can(permisiuni, "per_diem:update", "own");

  return (
    <div className={`${LATIMI.detaliu} space-y-4 p-4`}>
      <AntetPagina
        titlu={deplasare.scop}
        descriere={`${formatDate(deplasare.plecare_la)} – ${formatDate(deplasare.sosire_la)}${
          deplasare.localitate === null ? "" : ` · ${deplasare.localitate}`
        }`}
        actiuni={
          <Badge className="shrink-0" ton={TONURI_STATUS_DEPLASARE[deplasare.status]}>
            {ETICHETE_STATUS_DEPLASARE[deplasare.status]}
          </Badge>
        }
      />

      {politica === null ? (
        <p className="border-warning/40 bg-warning/10 text-foreground rounded-panou text-corp border p-3">
          Nu există o politică de diurnă valabilă la data plecării, deci suma nu poate fi calculată.
          Anunțați administratorul organizației.
        </p>
      ) : (
        <Etape
          deplasare={deplasare}
          etape={etapeTrip}
          politica={politica}
          baremuri={baremuri}
          tari={hartaTari}
        />
      )}

      <section aria-labelledby="cheltuieli" className="space-y-2">
        <h2 id="cheltuieli" className="text-foreground text-corp font-semibold">
          Cheltuieli
        </h2>
        {cheltuieliTrip.length === 0 ? (
          <p className="bg-surface border-border text-muted-foreground rounded-panou text-corp border p-4">
            Nicio cheltuială înregistrată. Cazarea, transportul și restul se adaugă mai jos.
          </p>
        ) : (
          <ul className="divide-border border-border bg-surface rounded-panou divide-y border">
            {cheltuieliTrip.map((cheltuiala) => (
              <li key={cheltuiala.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-foreground text-corp">
                    {cheltuiala.descriere ?? cheltuiala.tip}
                  </p>
                  <p className="text-muted-foreground text-nota">
                    {formatDate(cheltuiala.data_cheltuielii)}
                  </p>
                </div>
                <span className="text-foreground text-corp shrink-0 font-medium tabular-nums">
                  {cheltuiala.suma.toLocaleString("ro-RO")} {cheltuiala.moneda}
                </span>
              </li>
            ))}
          </ul>
        )}
        {poateAdaugaCheltuiala ? <FormularCheltuiala tripId={deplasare.id} /> : null}
      </section>

      {deplasare.observatii === null ? null : (
        <p className="text-muted-foreground text-corp">{deplasare.observatii}</p>
      )}

      <p className="text-muted-foreground text-nota">
        Înregistrată {formatDateTime(deplasare.created_at)}
      </p>

      {poateTrimite || poateSterge ? (
        <ActiuniDeplasare
          id={deplasare.id}
          poateTrimite={poateTrimite}
          poateSterge={poateSterge}
          // Decontarea e a aprobatorului (`per_diem:approve` / `team`), pe care
          // un angajat nu-l are. Butonul n-are ce căuta în portal.
          poateDeconta={false}
          caleDupaStergere="/portal/diurna-mea"
        />
      ) : null}

      <p>
        <Link href="/portal/diurna-mea" className={buton({ varianta: "link" })}>
          Înapoi la diurna mea
        </Link>
      </p>
    </div>
  );
}
