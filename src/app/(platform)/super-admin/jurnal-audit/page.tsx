// src/app/(platform)/super-admin/jurnal-audit/page.tsx
import { Suspense } from "react";

import { JurnalAudit } from "@/components/audit/jurnal-audit";
import { ScheletAudit } from "@/components/audit/schelet-audit";
import { metadataPlatforma, requirePlatformAdmin } from "@/lib/auth/platform";
import { cheieFiltre, parseazaFiltre } from "@/lib/queries/audit";

export const dynamic = "force-dynamic";

// Titlul doar pentru administratorul de platformă: altfel 404-ul l-ar trăda
// (PRM-007). Descrierea a căzut odată cu metadatele statice: și ea numea
// „toate organizațiile din platformă” oricui deschidea adresa.
export const generateMetadata = metadataPlatforma("Jurnal de audit");

/**
 * Calea proprie a paginii, transmisă mai jos ca să-și construiască linkurile de
 * filtrare și paginare. Trebuie să rămână identică cu directorul rutei — au
 * divergat o dată și pagina a devenit de negăsit din meniu.
 */
const CALE = "/super-admin/jurnal-audit";

type Props = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function PaginaAuditPlatforma({ searchParams }: Props) {
  // Verificare server-side, chiar dacă layout-ul o face deja (S2).
  await requirePlatformAdmin();

  const brute = await searchParams;
  const filtre = parseazaFiltre(brute);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-titlu font-semibold">Jurnal de audit</h1>
        <p className="text-muted-foreground text-corp">
          Toate evenimentele înregistrate în platformă, pe toate organizațiile. Înregistrările nu
          pot fi modificate sau șterse.
        </p>
      </header>

      <Suspense key={cheieFiltre(filtre)} fallback={<ScheletAudit />}>
        <JurnalAudit cale={CALE} filtre={filtre} mod="platforma" />
      </Suspense>
    </div>
  );
}
