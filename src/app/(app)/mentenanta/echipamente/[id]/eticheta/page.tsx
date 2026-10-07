// src/app/(app)/mentenanta/echipamente/[id]/eticheta/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteEchipament, planuriEchipament } from "@/lib/queries/maintenance";

import { ButonTiparEtichete } from "../../buton-tipar-etichete";
import { EtichetaQr, adresaEticheta } from "../../eticheta-qr";

export const metadata: Metadata = { title: "Etichetă QR" };

/**
 * Eticheta QR a unui echipament, de tipărit și lipit pe utilaj. Codul duce la
 * `/mentenanta/sesizari/noua?echipament=<id>` — forma pe care o au deja
 * autocolantele lipite în hale, păstrată ca redirect spre caseta de sesizare.
 */
export default async function PaginaEtichetaEchipament({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const id = idDinRuta((await params).id);
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  if (!can(permisiuni, "maintenance:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a tipări etichete de echipament." />;
  }

  const echipament = await citesteEchipament(tenant.organizationId, id);
  if (echipament === null) notFound();
  const planuri = echipament.folosit_in_afara_sediului
    ? await planuriEchipament(tenant.organizationId, echipament.id)
    : [];
  const legal = planuri.find((p) => p.tip === "verificare_legala" && p.activ) ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <p className="text-muted-foreground text-corp print:hidden">
        <Link
          href={`/mentenanta/echipamente/${echipament.id}`}
          className="underline-offset-2 hover:underline"
        >
          {echipament.cod}
        </Link>
        {" / Etichetă QR"}
      </p>

      <div className="flex justify-center">
        <EtichetaQr
          date={{
            id: echipament.id,
            cod: echipament.cod,
            denumire: echipament.denumire,
            locatie: echipament.locatie,
            ultimaVerificare: legal?.ultima_executie ?? null,
            urmatoareaScadenta: legal?.urmatoarea_scadenta ?? null,
            folositInAfaraSediului: echipament.folosit_in_afara_sediului,
          }}
        />
      </div>

      <div className="text-muted-foreground text-corp space-y-2 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <ButonTiparEtichete cate={1} />
          <p>Tipăriți și lipiți eticheta pe utilaj, într-un loc vizibil și ferit de ulei.</p>
        </div>
        <p>
          Codul duce la:{" "}
          <span className="text-foreground break-all">{adresaEticheta(echipament.id)}</span>
        </p>
        <p>
          Cine scanează ajunge în caseta de sesizare cu utilajul precompletat; dacă nu e logat, se
          autentifică întâi și e adus înapoi.
        </p>
      </div>
    </div>
  );
}
