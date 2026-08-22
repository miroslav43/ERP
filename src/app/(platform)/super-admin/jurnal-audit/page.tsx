// src/app/(platform)/super-admin/audit/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { JurnalAudit } from "@/components/audit/jurnal-audit";
import { ScheletAudit } from "@/components/audit/schelet-audit";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { cheieFiltre, parseazaFiltre } from "@/lib/queries/audit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jurnal de audit",
  description: "Evenimentele înregistrate pe toate organizațiile din platformă.",
};

const CALE = "/super-admin/audit";

type Props = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function PaginaAuditPlatforma({ searchParams }: Props) {
  // Verificare server-side, chiar dacă layout-ul o face deja (S2).
  await requirePlatformAdmin();

  const brute = await searchParams;
  const filtre = parseazaFiltre(brute);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-foreground text-xl font-semibold">Jurnal de audit</h1>
        <p className="text-muted-foreground text-sm">
          Toate evenimentele înregistrate în platformă, pe toate organizațiile. Înregistrările nu
          pot fi modificate sau șterse.
        </p>
      </header>

      <Suspense key={cheieFiltre(filtre)} fallback={<ScheletAudit />}>
        <JurnalAudit cale={CALE} filtre={filtre} mod="platforma" />
      </Suspense>
    </main>
  );
}
