// src/app/(portal)/portal/pontajul-meu/saptamana/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { citesteSaptamanaPontaj } from "@/lib/queries/attendance";
import { fisaMea } from "@/lib/queries/portal";
import {
  adaugaZile,
  esteLuni,
  lunieaUrmatoare,
  zileleSaptamanii,
} from "@/domain/attendance/saptamana";
import { FormularSaptamana } from "@/app/(app)/pontaj/saptamana/formular-saptamana";
import { CLASE_STARE_SAPTAMANA, ETICHETE_STARE_SAPTAMANA } from "@/app/(app)/pontaj/etichete";

import { FaraFisa } from "../../fara-fisa";

export const metadata: Metadata = { title: "Planul săptămânii" };

export default async function PaginaSaptamanaPortal({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:create", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a completa un plan de prezență." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const parametri = await searchParams;
  const brut = parametri["saptamana"];
  // Valoarea din bara de adrese se acceptă doar dacă e chiar o zi de luni.
  // Orice altceva cade pe implicit — nu ajunge la Postgres ca text.
  const cerut = typeof brut === "string" ? brut : "";
  const saptamanaStart = esteLuni(cerut) ? cerut : lunieaUrmatoare(todayInBucharest());

  const submisie = await citesteSaptamanaPontaj(
    tenant.organizationId,
    stare.fisa.id,
    saptamanaStart,
  );

  const zileInitiale = zileleSaptamanii(saptamanaStart).map((data) => {
    const existenta = submisie?.zile.find((z) => z.data === data) ?? null;
    return {
      data,
      tip_prezenta: existenta?.tip_prezenta ?? "birou",
      ore_planificate: String(existenta?.ore_planificate ?? 8),
      observatii: existenta?.observatii ?? "",
    };
  });

  // O săptămână aprobată nu se mai retrage: `attendance_week_submissions_update`
  // (`0041:388`) n-are ramură pentru autor, deci un UPDATE ar afecta zero rânduri,
  // tăcut. Formularul se blochează, nu lasă butonul activ ca să ducă în refuz.
  const poateEdita = submisie === null || submisie.status !== "aprobata";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header>
        <h1 className="text-foreground text-xl font-semibold">Planul săptămânii</h1>
        <p className="text-muted-foreground text-sm">
          Săptămâna care începe {formatDate(saptamanaStart)}: cum veniți la lucru și câte ore
          planificați.
        </p>
      </header>

      <nav aria-label="Alege săptămâna" className="flex flex-wrap items-center gap-2">
        <Link
          href={`/portal/pontajul-meu/saptamana?saptamana=${adaugaZile(saptamanaStart, -7)}`}
          className="border-border hover:border-primary text-foreground inline-flex min-h-11 items-center gap-1 rounded-md border px-3 text-sm"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Anterioară
        </Link>
        <Link
          href={`/portal/pontajul-meu/saptamana?saptamana=${adaugaZile(saptamanaStart, 7)}`}
          className="border-border hover:border-primary text-foreground inline-flex min-h-11 items-center gap-1 rounded-md border px-3 text-sm"
        >
          Următoarea
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
        {submisie === null ? null : (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${CLASE_STARE_SAPTAMANA[submisie.status]}`}
          >
            {ETICHETE_STARE_SAPTAMANA[submisie.status]}
          </span>
        )}
      </nav>

      {/* Motivul respingerii, înaintea formularului: e informația pentru care
          omul a deschis ecranul, iar notificarea care l-a adus aici n-o conține. */}
      {submisie?.status === "respinsa" && submisie.motivRespingere !== null ? (
        <p className="border-danger/40 bg-danger/10 text-foreground rounded-lg border p-3 text-sm">
          <strong className="font-medium">Motivul respingerii:</strong> {submisie.motivRespingere}
        </p>
      ) : null}

      <FormularSaptamana
        saptamanaStart={saptamanaStart}
        zileInitiale={zileInitiale}
        poateEdita={poateEdita}
      />

      <p>
        <Link
          href="/portal/pontajul-meu"
          className="text-primary text-sm underline-offset-2 hover:underline"
        >
          Înapoi la pontajul meu
        </Link>
      </p>
    </div>
  );
}
