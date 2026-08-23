// src/app/(portal)/portal/pontajul-meu/zi/[data]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { ziDinRuta } from "@/lib/rute/parametri";
import { formatDate } from "@/lib/format/date";
import { citestePerioada } from "@/lib/queries/attendance";
import { fisaMea, pontajulMeu } from "@/lib/queries/portal";

import { FaraFisa } from "../../../fara-fisa";
import { ETICHETE_TIP_ZI } from "../../../etichete";
import { FormularZi } from "./formular-zi";

export const metadata: Metadata = { title: "Ziua mea de pontaj" };

export default async function PaginaZiPontaj({
  params,
}: {
  readonly params: Promise<{ readonly data: string }>;
}) {
  const { data } = await params;
  const zi = ziDinRuta(data);

  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:create", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a completa pontajul." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const an = Number(zi.slice(0, 4));
  const luna = Number(zi.slice(5, 7));
  const [perioada, zileLuna] = await Promise.all([
    citestePerioada(tenant.organizationId, an, luna),
    pontajulMeu(tenant.organizationId, an, luna, stare.fisa.id),
  ]);
  const existenta = zileLuna.find((z) => z.data === zi) ?? null;

  const antet = (
    <header>
      <h1 className="text-foreground text-xl font-semibold">{formatDate(zi)}</h1>
      <p className="text-muted-foreground text-sm">Pontajul dumneavoastră pe ziua aceasta.</p>
    </header>
  );

  const inapoi = (
    <p>
      <Link
        href="/portal/pontajul-meu"
        className="text-primary text-sm underline-offset-2 hover:underline"
      >
        Înapoi la pontajul meu
      </Link>
    </p>
  );

  // Luna închisă: refuzul se dă ÎNAINTE de a arăta formularul, nu după drumul la
  // server. Triggerul `internal.pontaj_intrare_pregateste` ridică oricum P0001,
  // dar un buton care duce sigur în eroare e un defect de ecran.
  if (perioada === null || perioada.status !== "deschisa") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {antet}
        <EmptyState
          icon={Lock}
          title="Luna nu este deschisă pentru pontaj"
          description="Pontajul se completează doar cât timp luna e deschisă de resursele umane. Pentru o corectură, întrebați responsabilul de pontaj."
        />
        {inapoi}
      </div>
    );
  }

  // Ziua venită din concediu se modifică din cererea de concediu, nu de aici:
  // altfel cele două s-ar contrazice, iar sincronizarea ar suprascrie tăcut.
  const dinConcediu =
    existenta !== null && (existenta.tip_zi === "concediu" || existenta.tip_zi === "medical");

  if (dinConcediu) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {antet}
        <div className="bg-surface border-border rounded-lg border p-4">
          <p className="text-foreground text-sm font-medium">
            {ETICHETE_TIP_ZI[existenta.tip_zi] ?? existenta.tip_zi}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Ziua vine din concediul aprobat și se modifică de acolo, nu din pontaj.
          </p>
        </div>
        {inapoi}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {antet}
      <FormularZi
        data={zi}
        oreInitiale={String(existenta?.ore_lucrate ?? 8)}
        suplimentareInitiale={String(existenta?.ore_suplimentare ?? 0)}
        observatiiInitiale={existenta?.observatii ?? ""}
      />
      {inapoi}
    </div>
  );
}
