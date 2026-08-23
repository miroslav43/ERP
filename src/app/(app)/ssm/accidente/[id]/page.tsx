// src/app/(app)/ssm/accidente/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { angajatiDupaId, citesteAccident } from "@/lib/queries/ssm";
import { momentLimitaComunicareItm, oreRamasePanaLaTermen } from "@/domain/ssm/termen-itm";

import { ETICHETE_TIP_ACCIDENT, TONURI_TIP_ACCIDENT } from "../../etichete";
import { FormularComunicareItm } from "./formular-comunicare-itm";

export const metadata: Metadata = { title: "Accident de muncă" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaAccident({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta registrul de accidente. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const accident = await citesteAccident(tenant.organizationId, id);
  if (accident === null) notFound();

  const angajati = await angajatiDupaId(
    tenant.organizationId,
    accident.employee_id === null ? [] : [accident.employee_id],
  );
  const angajat = accident.employee_id === null ? undefined : angajati.get(accident.employee_id);
  const poateActualiza = can(permisiuni, "ssm:update", "team");

  const termenOre = accident.termen_comunicare_ore ?? 24;
  const momentLimita = momentLimitaComunicareItm(
    accident.data_producerii,
    accident.ora_producerii,
    termenOre,
  );
  const oreRamase =
    accident.comunicat_la_itm_la === null ? oreRamasePanaLaTermen(momentLimita, new Date()) : null;

  // `titlu` și `descriere` sunt șiruri, nu JSX: componenta le cere așa. Textul
  // rămâne cuvânt cu cuvânt, doar nuanțarea numărului intern se pierde.
  const titlu =
    accident.numar_intern === null
      ? formatDate(accident.data_producerii)
      : `${formatDate(accident.data_producerii)} · ${accident.numar_intern}`;
  const cineSiUnde = `${
    angajat === undefined
      ? "Angajat neidentificat"
      : `${angajat.full_name ?? "—"} (${angajat.marca})`
  } · ${accident.locul}`;

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <p className="text-muted-foreground text-corp">
        <Link href="/ssm/accidente" className="underline-offset-2 hover:underline">
          Accidente de muncă
        </Link>
      </p>

      <AntetPagina
        titlu={titlu}
        descriere={cineSiUnde}
        actiuni={
          <Badge ton={TONURI_TIP_ACCIDENT[accident.tip]}>
            {ETICHETE_TIP_ACCIDENT[accident.tip]}
          </Badge>
        }
      />

      {oreRamase === null ? null : (
        <div
          role="alert"
          className={`rounded-panou text-corp border p-4 ${
            oreRamase >= 0
              ? "border-warning/40 bg-warning/12 text-foreground"
              : "border-danger/40 bg-danger/8 text-danger"
          }`}
        >
          {oreRamase >= 0
            ? `Nu a fost încă comunicat la ITM. Mai sunt ${oreRamase.toFixed(1)} ore până la termenul legal.`
            : `Nu a fost încă comunicat la ITM. Termenul legal a fost depășit cu ${Math.abs(oreRamase).toFixed(1)} ore.`}
        </div>
      )}

      <section
        aria-label="Detalii accident"
        className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-2"
      >
        <Camp eticheta="Ora producerii" valoare={accident.ora_producerii ?? "—"} />
        <Camp eticheta="Zile de incapacitate" valoare={String(accident.zile_incapacitate)} />
        <Camp
          eticheta="Comunicat la ITM"
          valoare={
            accident.comunicat_la_itm_la === null
              ? "Nu"
              : formatDate(accident.comunicat_la_itm_la.slice(0, 10))
          }
        />
        <Camp eticheta="Număr proces verbal" valoare={accident.numar_proces_verbal ?? "—"} />
        <Camp
          eticheta="Cercetare finalizată"
          valoare={
            accident.cercetare_finalizata_la === null
              ? "În curs"
              : formatDate(accident.cercetare_finalizata_la)
          }
        />
      </section>

      <section aria-label="Împrejurări" className="text-corp space-y-1">
        <p className="text-muted-foreground">Împrejurări:</p>
        <p className="whitespace-pre-wrap">{accident.imprejurari}</p>
        {accident.urmari === null ? null : (
          <>
            <p className="text-muted-foreground mt-3">Urmări:</p>
            <p className="whitespace-pre-wrap">{accident.urmari}</p>
          </>
        )}
      </section>

      {poateActualiza ? (
        <FormularComunicareItm
          id={accident.id}
          comunicatLaItm={accident.comunicat_la_itm_la}
          cercetareFinalizata={accident.cercetare_finalizata_la}
          zileIncapacitate={accident.zile_incapacitate}
        />
      ) : null}
    </div>
  );
}

function Camp({ eticheta, valoare }: { readonly eticheta: string; readonly valoare: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-nota">{eticheta}</dt>
      <dd className="text-corp font-medium">{valoare}</dd>
    </div>
  );
}
