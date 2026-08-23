// src/app/(app)/diurna/politica/page.tsx
import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { politiciOrganizatie, tari } from "@/lib/queries/per-diem";

import { ETICHETE_REGULA_TRECERE } from "../etichete";
import { NavDiurna } from "../nav-diurna";
import { FormularPolitica } from "./formular-politica";

export const metadata: Metadata = { title: "Politica de diurnă" };

export default async function PaginaPolitica() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta politica de diurnă. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateAproba = can(permisiuni, "per_diem:approve", "team");
  const poateEdita = can(permisiuni, "per_diem:update", "all");

  const [politici, listaTari] = await Promise.all([
    politiciOrganizatie(tenant.organizationId),
    tari(),
  ]);
  const hartaTari = new Map(listaTari.map((t) => [t.id, t.denumire]));

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Politica de diurnă</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Politica e versionată: fiecare deplasare se calculează cu versiunea valabilă la data
          plecării, nu cu cea curentă. Adăugarea unei versiuni noi nu schimbă istoricul.
        </p>
      </header>

      <NavDiurna poateAproba={poateAproba} />

      {politici.length === 0 ? (
        <EmptyState
          icon={Settings}
          title="Nicio versiune de politică încă"
          description={
            poateEdita
              ? "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Configurați prima versiune mai jos."
              : "Organizația nu are încă nicio versiune de politică de diurnă. Cereți administratorului să o configureze."
          }
        />
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Versiunile politicii de diurnă, cea mai recentă primă.
            </caption>
            <thead className="bg-surface text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Denumire
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Valabilă
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Țara internă
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Diurnă internă
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Trecere frontieră
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {politici.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.denumire}</td>
                  <td className="px-4 py-3">
                    {formatDate(p.valabil_de_la)}
                    {p.valabil_pana === null ? " – prezent" : ` – ${formatDate(p.valabil_pana)}`}
                  </td>
                  <td className="px-4 py-3">
                    {hartaTari.get(p.country_id_intern) ?? p.country_id_intern}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatLei(p.diurna_interna_zi)}
                  </td>
                  <td className="px-4 py-3">{ETICHETE_REGULA_TRECERE[p.regula_tara_trecere]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {poateEdita ? (
        <FormularPolitica tari={listaTari} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Politica se configurează de administratorii organizației.
        </p>
      )}
    </main>
  );
}
