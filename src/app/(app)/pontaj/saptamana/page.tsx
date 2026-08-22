// src/app/(app)/pontaj/saptamana/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";
import { idFisaProprie } from "@/lib/queries/employees";
import { citesteSaptamanaPontaj } from "@/lib/queries/attendance";
import { adaugaZile, esteLuni, lunieaUrmatoare } from "@/domain/attendance/saptamana";

import { NavPontaj } from "../nav-pontaj";
import { ETICHETE_STARE_SAPTAMANA, CLASE_STARE_SAPTAMANA } from "../etichete";
import { FormularSaptamana } from "./formular-saptamana";

export const metadata: Metadata = { title: "Planul săptămânii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaSaptamanaPontaj({ searchParams }: ProprietatiPagina) {
  const { user, tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "attendance:create", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a completa un plan de prezență. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const parametruSaptamana = parametri["saptamana"];
  const saptamanaCeruta = typeof parametruSaptamana === "string" ? parametruSaptamana : "";
  const saptamanaStart = esteLuni(saptamanaCeruta)
    ? saptamanaCeruta
    : lunieaUrmatoare(todayInBucharest());

  const propriaFisaId = await idFisaProprie(tenant.organizationId, user.id);
  if (propriaFisaId === null) {
    return (
      <AccesRestrictionat mesaj="Contul dvs. nu este legat de o fișă de angajat principală în această organizație." />
    );
  }

  const submisie = await citesteSaptamanaPontaj(
    tenant.organizationId,
    propriaFisaId,
    saptamanaStart,
  );

  const zileInitiale = Array.from({ length: 7 }, (_, i) => {
    const data = adaugaZile(saptamanaStart, i);
    const existenta = submisie?.zile.find((z) => z.data === data) ?? null;
    return {
      data,
      tip_prezenta: existenta?.tip_prezenta ?? "birou",
      ore_planificate: String(existenta?.ore_planificate ?? 8),
      observatii: existenta?.observatii ?? "",
    };
  });

  const poateEdita = submisie === null || submisie.status !== "aprobata";

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Planul săptămânii</h1>
        <p className="text-muted-foreground text-sm">
          Declarați, pentru săptămâna care începe{" "}
          {new Date(`${saptamanaStart}T00:00:00Z`).toLocaleDateString("ro-RO")}, cum veniți la lucru
          și câte ore planificați — editabil oricând, până la decizia managerului.
        </p>
      </header>

      <NavPontaj poateAproba={can(permisiuni, "attendance:approve", "team")} />

      <nav aria-label="Alege săptămâna" className="flex flex-wrap items-center gap-3">
        <Link
          href={`/pontaj/saptamana?saptamana=${adaugaZile(saptamanaStart, -7)}`}
          className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-1.5 text-sm"
        >
          ← Săptămâna anterioară
        </Link>
        <Link
          href={`/pontaj/saptamana?saptamana=${adaugaZile(saptamanaStart, 7)}`}
          className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-1.5 text-sm"
        >
          Săptămâna următoare →
        </Link>
        {submisie === null ? null : (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${CLASE_STARE_SAPTAMANA[submisie.status]}`}
          >
            {ETICHETE_STARE_SAPTAMANA[submisie.status]}
          </span>
        )}
      </nav>

      {submisie?.status === "respinsa" && submisie.motivRespingere !== null ? (
        <p className="border-danger/40 bg-danger/8 text-danger rounded-lg border p-3 text-sm">
          <strong>Motivul respingerii:</strong> {submisie.motivRespingere}
        </p>
      ) : null}

      <FormularSaptamana
        saptamanaStart={saptamanaStart}
        zileInitiale={zileInitiale}
        poateEdita={poateEdita}
      />
    </main>
  );
}
