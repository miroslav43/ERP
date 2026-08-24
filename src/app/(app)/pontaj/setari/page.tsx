// src/app/(app)/pontaj/setari/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { cn } from "@/lib/ui/cn";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { istoricSetariPontaj, setariPontajComplete } from "@/lib/queries/attendance";

import { FormularSetariPontaj } from "./formular-setari-pontaj";

export const metadata: Metadata = { title: "Setări pontaj" };

export default async function PaginaSetariPontaj() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:update", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a configura parametrii de pontaj." />
      </div>
    );
  }

  const [curente, istoric] = await Promise.all([
    setariPontajComplete(tenant.organizationId, todayInBucharest()),
    istoricSetariPontaj(tenant.organizationId),
  ]);

  return (
    <div className={cn(LATIMI.formular, "space-y-6")}>
      <div className="space-y-2">
        <p className="text-muted-foreground text-corp">
          <Link href="/pontaj" className="underline-offset-2 hover:underline">
            Pontaj
          </Link>
        </p>
        <AntetPagina titlu="Setări pontaj" />
      </div>

      <div
        role="note"
        className="border-warning/40 bg-warning/8 rounded-panou text-corp border p-4"
      >
        <strong>Niciuna dintre valorile de mai jos nu e verificată juridic.</strong> Tabela a fost
        creată intenționat fără valori implicite, ca nimeni să nu calculeze un salariu pe cifre
        presupuse. Confirmați fiecare parametru cu un jurist sau cu inspectoratul teritorial de
        muncă înainte de o plată reală.
      </div>

      {curente === null ? (
        <div
          role="alert"
          className="border-danger/40 bg-danger/8 rounded-panou text-corp border p-4"
        >
          <strong>Nu există niciun set de parametri configurat.</strong> Până acum, sporul de
          noapte, cel de weekend și cel de sărbătoare, intervalul nocturn și termenele de compensare
          nu erau definite nicăieri, iar salarizarea cădea pe valorile din setările ei proprii.
          Completați formularul de mai jos.
        </div>
      ) : (
        <p className="text-muted-foreground text-corp">
          În vigoare de la <strong>{formatDate(curente.valabil_de_la)}</strong>. O salvare nouă nu
          rescrie trecutul: creează o versiune cu altă dată de intrare în vigoare, iar lunile deja
          calculate rămân explicabile cu parametrii de atunci.
        </p>
      )}

      <FormularSetariPontaj setariCurente={curente} />

      {istoric.length <= 1 ? null : (
        <section
          aria-label="Versiuni anterioare"
          className="border-border rounded-panou border p-4"
        >
          <h2 className="text-corp mb-2 font-medium">Versiuni</h2>
          <ul className="text-muted-foreground text-corp space-y-1">
            {istoric.map((versiune) => (
              <li key={versiune.id}>
                de la {formatDate(versiune.valabil_de_la)} — normă {versiune.ore_pe_zi} h/zi, spor
                noapte {versiune.spor_noapte_procent}%, spor sărbătoare{" "}
                {versiune.spor_sarbatoare_procent}%
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
