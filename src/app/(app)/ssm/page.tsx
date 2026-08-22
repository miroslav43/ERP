// src/app/(app)/ssm/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Flame,
  FireExtinguisher,
  GraduationCap,
  HardHat,
  ShieldAlert,
  Stethoscope,
  Thermometer,
} from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import {
  accidenteNecomunicate,
  angajatiDupaId,
  contorAutorizatiiNominale,
  contorEip,
  contorFiseAptitudine,
  contorInstruiri,
  contorStingatoare,
} from "@/lib/queries/ssm";
import { momentLimitaComunicareItm, oreRamasePanaLaTermen } from "@/domain/ssm/termen-itm";

import { DosarulMeu } from "./dosarul-meu";
import { ETICHETE_TIP_ACCIDENT, CLASE_TIP_ACCIDENT } from "./etichete";
import { NavSsm } from "./nav-ssm";

export const metadata: Metadata = { title: "SSM și PSI" };

interface CardPanou {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly titlu: string;
  readonly numar: number;
}

function Card({ href, icon: Icon, titlu, numar }: CardPanou) {
  return (
    <Link
      href={href}
      className="border-border hover:bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex items-center justify-between">
        <Icon aria-hidden="true" className="text-muted-foreground size-5" />
        {numar > 0 ? (
          <span className="bg-warning/12 text-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
            {numar}
          </span>
        ) : null}
      </div>
      <p className="text-sm font-medium">{titlu}</p>
      <p className="text-muted-foreground text-xs">
        {numar === 0 ? "Nimic de atenționat" : `${numar} de atenționat`}
      </p>
    </Link>
  );
}

async function BandaAccidente({ organizationId }: { readonly organizationId: string }) {
  const accidente = await accidenteNecomunicate(organizationId);
  if (accidente.length === 0) return null;

  const angajati = await angajatiDupaId(
    organizationId,
    accidente.map((a) => a.employee_id).filter((id): id is string => id !== null),
  );
  const acum = new Date();

  return (
    <section
      aria-labelledby="accidente-necomunicate"
      role="alert"
      className="border-danger/40 bg-danger/8 space-y-3 rounded-lg border p-4"
    >
      <h2
        id="accidente-necomunicate"
        className="text-danger flex items-center gap-2 text-sm font-semibold"
      >
        <ShieldAlert aria-hidden="true" className="size-4" />
        Accidente necomunicate la ITM
      </h2>
      <ul className="space-y-2">
        {accidente.map((a) => {
          const ore = a.termen_comunicare_ore ?? 24;
          const limita = momentLimitaComunicareItm(a.data_producerii, a.ora_producerii, ore);
          const raman = oreRamasePanaLaTermen(limita, acum);
          const angajat = a.employee_id === null ? undefined : angajati.get(a.employee_id);
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span
                  className={`mr-2 rounded px-2 py-0.5 text-xs font-medium ${CLASE_TIP_ACCIDENT[a.tip]}`}
                >
                  {ETICHETE_TIP_ACCIDENT[a.tip]}
                </span>
                {angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`}
                {" · "}
                {formatDate(a.data_producerii)}
              </span>
              <span className="text-danger font-medium">
                {raman >= 0
                  ? `mai sunt ${raman.toFixed(1)} ore`
                  : `termen depășit cu ${Math.abs(raman).toFixed(1)} ore`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function PaginaSsm() {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  // `can(..., "own")` și nu `scopeFor(...) !== null`: scope-ul „none" e refuz
  // explicit ȘI e truthy, deci a doua formă ar lăsa poarta deschisă.
  if (!can(permisiuni, "ssm:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta dosarele SSM/PSI. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <DosarulMeu organizationId={tenant.organizationId} />
      </main>
    );
  }

  const [instruiri, stingatoare, fise, autorizatii, eip] = await Promise.all([
    contorInstruiri(tenant.organizationId),
    contorStingatoare(tenant.organizationId),
    contorFiseAptitudine(tenant.organizationId),
    contorAutorizatiiNominale(tenant.organizationId),
    contorEip(tenant.organizationId),
  ]);
  const ssm = instruiri.find((c) => c.domeniu === "ssm")?.deAtentionat ?? 0;
  const psi = instruiri.find((c) => c.domeniu === "psi")?.deAtentionat ?? 0;

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">SSM și PSI</h1>
        <p className="text-muted-foreground text-sm">
          Situația la zi a instruirilor, medicinei muncii și apărării împotriva incendiilor.
        </p>
      </header>

      <NavSsm
        poateVedeaInstruiri={
          can(permisiuni, "ssm:read", "team") && can(permisiuni, "employees:read", "team")
        }
        poateVedeaMedicina={can(permisiuni, "ssm:read", "team")}
        poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
        poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
        poateVedeaEip={can(permisiuni, "ssm:read", "team")}
        poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
      />

      <BandaAccidente organizationId={tenant.organizationId} />

      {/* Șase carduri SEPARATE: instruirile SSM și PSI sunt obligații legale
          distincte, cu periodicități proprii — NICIODATĂ însumate. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          href="/ssm/instruiri?domeniu=ssm"
          icon={GraduationCap}
          titlu="Instruiri SSM"
          numar={ssm}
        />
        <Card href="/ssm/instruiri?domeniu=psi" icon={Flame} titlu="Instruiri PSI" numar={psi} />
        <Card
          href="/ssm/medicina-muncii"
          icon={Stethoscope}
          titlu="Fișe de aptitudine"
          numar={fise}
        />
        <Card
          href="/ssm/stingatoare"
          icon={FireExtinguisher}
          titlu="Stingătoare — verificare"
          numar={stingatoare.verificare}
        />
        <Card
          href="/ssm/stingatoare"
          icon={FireExtinguisher}
          titlu="Stingătoare — reîncărcare"
          numar={stingatoare.reincarcare}
        />
        <Card
          href="/ssm/stingatoare"
          icon={Thermometer}
          titlu="Stingătoare — probă de presiune"
          numar={stingatoare.probaPresiune}
        />
        <Card
          href="/ssm/autorizatii"
          icon={BadgeCheck}
          titlu="Autorizații nominale"
          numar={autorizatii}
        />
        <Card href="/ssm/eip" icon={HardHat} titlu="Echipament de protecție (EIP)" numar={eip} />
      </div>
    </main>
  );
}
