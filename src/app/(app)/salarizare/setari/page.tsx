// src/app/(app)/salarizare/setari/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { citesteSetariValabile, listeazaIstoricSetari } from "@/lib/queries/payroll";

import { AVERTISMENT_SALARIZARE } from "../etichete";
import { FormularSetari } from "./formular-setari";

export const metadata: Metadata = { title: "Setări salarizare" };

export default async function PaginaSetariSalarizare() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:update", "all")) {
    return (
      <main className="p-6">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a configura salarizarea." />
      </main>
    );
  }

  const [curente, istoric] = await Promise.all([
    citesteSetariValabile(tenant.organizationId, todayInBucharest()),
    listeazaIstoricSetari(tenant.organizationId),
  ]);

  return (
    <main className="max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">
          <Link href="/salarizare" className="underline-offset-2 hover:underline">
            Salarizare
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Setări salarizare</h1>
      </header>

      <div role="note" className="border-warning/40 bg-warning/8 rounded-lg border p-4 text-sm">
        {AVERTISMENT_SALARIZARE} Fiecare modificare creează o versiune NOUĂ, valabilă de la o dată —
        versiunile vechi rămân neschimbate, fiindcă fluturașii deja calculați le păstrează într-o
        fotografie proprie.
      </div>

      <FormularSetari setariCurente={curente} />

      {istoric.length === 0 ? null : (
        <section aria-labelledby="istoric-setari" className="space-y-2">
          <h2 id="istoric-setari" className="text-sm font-semibold">
            Istoricul versiunilor
          </h2>
          <ul className="divide-border border-border divide-y rounded-lg border text-sm">
            {istoric.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2">
                <span>Valabil de la {formatDate(s.valabil_de_la)}</span>
                <span className="text-muted-foreground text-xs">
                  {s.verificat_de_contabil ? "verificat de contabil" : "neverificat"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
