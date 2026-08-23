// src/app/(app)/ssm/stingatoare/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteStingator, verificariStingator } from "@/lib/queries/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import {
  ETICHETE_REZULTAT_VERIFICARE,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_STINGATOR,
  ETICHETE_TIP_VERIFICARE_STINGATOR,
  TONURI_SCADENTA,
  TONURI_STATUS_STINGATOR,
} from "../../etichete";
import { FormularVerificare } from "./formular-verificare";

export const metadata: Metadata = { title: "Fișa stingătorului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaStingator({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta stingătoarele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const stingator = await citesteStingator(tenant.organizationId, id);
  if (stingator === null) notFound();

  const verificari = await verificariStingator(stingator.id);
  const azi = todayInBucharest();
  const poateInregistra = can(permisiuni, "ssm:create", "team");

  const obligatii = [
    {
      cheie: "verificare" as const,
      titlu: "Verificare tehnică",
      data: stingator.ultima_verificare,
      scadenta: stingator.scadenta_verificare,
    },
    {
      cheie: "reincarcare" as const,
      titlu: "Reîncărcare",
      data: stingator.ultima_reincarcare,
      scadenta: stingator.scadenta_reincarcare,
    },
    {
      cheie: "proba_presiune" as const,
      titlu: "Probă de presiune",
      data: stingator.ultima_proba_presiune,
      scadenta: stingator.scadenta_proba_presiune,
    },
  ];

  // `descriere` e șir, nu JSX: componenta o cere așa. Textul rămâne identic.
  const unde = `${stingator.tip} · ${stingator.locatie}${
    stingator.cladire === null ? "" : ` · ${stingator.cladire}`
  }`;

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <p className="text-muted-foreground text-corp">
        <Link href="/ssm/stingatoare" className="underline-offset-2 hover:underline">
          Stingătoare
        </Link>
      </p>

      <AntetPagina
        titlu={stingator.cod}
        descriere={unde}
        actiuni={
          <>
            {can(permisiuni, "ssm:update", "team") ? (
              <Link
                href={`/ssm/stingatoare/${stingator.id}/editeaza`}
                className={buton({ varianta: "secundar" })}
              >
                Editează
              </Link>
            ) : null}
            <Badge ton={TONURI_STATUS_STINGATOR[stingator.status]}>
              {ETICHETE_STATUS_STINGATOR[stingator.status]}
            </Badge>
          </>
        }
      />

      <section
        aria-label="Cele trei obligații de întreținere"
        className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-3"
      >
        {obligatii.map((o) => {
          const stare = stareScadentaSsm(o.data !== null, o.scadenta, azi);
          return (
            <div key={o.cheie}>
              <dt className="text-muted-foreground text-nota">{o.titlu}</dt>
              <dd className="mt-1 space-y-1">
                <Badge ton={TONURI_SCADENTA[stare]} cuAvertisment={stare === "expirat"}>
                  {ETICHETE_SCADENTA[stare]}
                </Badge>
                <p className="text-corp">
                  {o.data === null ? "niciodată" : `ultima: ${formatDate(o.data)}`}
                </p>
                {o.scadenta === null ? null : (
                  <p className="text-muted-foreground text-nota">
                    scadență: {formatDate(o.scadenta)}
                  </p>
                )}
              </dd>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="istoric-verificari" className="space-y-3">
        <h2 id="istoric-verificari" className="text-sectiune font-semibold">
          Istoric verificări
        </h2>
        {verificari.length === 0 ? (
          <p className="text-muted-foreground text-corp">Nicio verificare înregistrată.</p>
        ) : (
          <div className="border-border rounded-panou overflow-x-auto border">
            <table className="text-corp w-full">
              <thead className="bg-surface text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Tip
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Firmă autorizată
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Rezultat
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {verificari.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(v.data)}</td>
                    <td className="px-4 py-3">
                      {ETICHETE_TIP_VERIFICARE_STINGATOR[v.tip_verificare]}
                    </td>
                    <td className="px-4 py-3">{v.firma_autorizata ?? v.executant ?? "—"}</td>
                    <td className="px-4 py-3">{ETICHETE_REZULTAT_VERIFICARE[v.rezultat]}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {v.cost === null ? "—" : formatLei(v.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {poateInregistra ? <FormularVerificare extinguisherId={stingator.id} /> : null}
    </div>
  );
}
