// src/app/(app)/ticketing/coada/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { listeazaTichete, rezumatCoada } from "@/lib/queries/ticketing";
import { filtreTicheteSchema } from "@/schemas/ticketing";
import { filtreDinUrl } from "@/lib/rute/parametri";

import { TabelTichete } from "../tabel-tichete";

export const metadata: Metadata = { title: "Coada de tichete" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function Cifra({ eticheta, valoare }: Readonly<{ eticheta: string; valoare: number }>) {
  return (
    <div className="border-border bg-surface rounded-panou border p-4">
      <p className="text-muted-foreground text-nota">{eticheta}</p>
      <p className="text-foreground text-titlu mt-1 font-semibold">{valoare}</p>
    </div>
  );
}

async function Continut({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreTicheteSchema, parametri);
  const [rezumat, { randuri }] = await Promise.all([
    rezumatCoada(organizationId),
    listeazaTichete(organizationId, filtre),
  ]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Cifra eticheta="Deschise" valoare={rezumat.deschise} />
        <Cifra eticheta="De aprobat" valoare={rezumat.deAprobat} />
        <Cifra eticheta="Așteaptă solicitantul" valoare={rezumat.asteaptaSolicitantul} />
        <Cifra eticheta="Mai vechi de 7 zile" valoare={rezumat.restanteste7Zile} />
      </div>

      {randuri.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={LifeBuoy}
          titlu="Nimic în coadă"
          descriere="Tichetele echipei apar aici pe măsură ce sunt deschise."
        />
      ) : (
        <TabelTichete randuri={randuri} aratSolicitantul />
      )}
    </>
  );
}

export default async function PaginaCoada({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  // `team`: coada e pentru cine are oameni în subordine sau răspunde de modul.
  // Un angajat obișnuit are doar `own` și rămâne pe „Tichetele mele”.
  if (!can(permisiuni, "tickets:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Coada de tichete e vizibilă managerilor și administratorilor. Tichetele proprii le găsiți în „Tichetele mele”." />
    );
  }

  const parametri = await searchParams;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Coada de tichete"
        descriere="Tichetele la care ai acces, cu cererile care așteaptă decizia ta."
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={7} />}>
        <Continut organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
