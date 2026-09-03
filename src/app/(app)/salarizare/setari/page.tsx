// src/app/(app)/salarizare/setari/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
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
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "payroll"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "payroll:update", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a configura salarizarea." />
      </div>
    );
  }

  const [curente, istoric] = await Promise.all([
    citesteSetariValabile(tenant.organizationId, todayInBucharest()),
    listeazaIstoricSetari(tenant.organizationId),
  ]);

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/salarizare" className="underline-offset-2 hover:underline">
            Salarizare
          </Link>
        </p>
        <AntetPagina titlu="Setări salarizare" />
      </div>

      <div
        role="note"
        className="border-warning/40 bg-warning/8 rounded-panou text-corp border p-4"
      >
        {AVERTISMENT_SALARIZARE} Fiecare modificare creează o versiune NOUĂ, valabilă de la o dată —
        versiunile vechi rămân neschimbate, fiindcă fluturașii deja calculați le păstrează într-o
        fotografie proprie.
      </div>

      <FormularSetari setariCurente={curente} />

      {istoric.length === 0 ? null : (
        <section aria-labelledby="istoric-setari" className="space-y-2">
          <h2 id="istoric-setari" className="text-corp font-semibold">
            Istoricul versiunilor
          </h2>
          <ul className="divide-border border-border rounded-panou text-corp divide-y border">
            {istoric.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2">
                <span>Valabil de la {formatDate(s.valabil_de_la)}</span>
                <span className="text-muted-foreground text-nota">
                  {s.verificat_de_contabil ? "verificat de contabil" : "neverificat"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
