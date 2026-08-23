// src/app/(app)/rapoarte/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { statisticiAnuale } from "@/lib/queries/rapoarte";

export const metadata: Metadata = { title: "Rapoarte" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function CardTotal({ eticheta, valoare }: { readonly eticheta: string; readonly valoare: string }) {
  return (
    <div className="border-border bg-surface rounded-panou border p-4">
      <p className="text-muted-foreground text-nota tracking-wide uppercase">{eticheta}</p>
      <p className="text-foreground text-titlu mt-1 font-semibold">{valoare}</p>
    </div>
  );
}

export default async function PaginaRapoarte({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:read", "all")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta rapoartele. Această operațiune este rezervată administratorilor organizației." />
    );
  }

  const parametri = await searchParams;
  const anulCurent = new Date().getFullYear();
  const anParam = typeof parametri["an"] === "string" ? Number(parametri["an"]) : anulCurent;
  const an = Number.isInteger(anParam) && anParam >= 2020 && anParam <= 2100 ? anParam : anulCurent;

  const statistici = await statisticiAnuale(tenant.organizationId, an);

  const aniDisponibili = Array.from({ length: 5 }, (_, i) => anulCurent - i);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Rapoarte"
        descriere="Concediu, venit, tichete de masă și ore suplimentare — pe angajat și agregat pe organizație, din perioadele de salarizare calculate."
        actiuni={
          <nav aria-label="Alege anul" className="flex flex-wrap gap-1.5">
            {aniDisponibili.map((valoare) => (
              <Link
                key={valoare}
                href={`/rapoarte?an=${String(valoare)}`}
                className={`rounded-control text-corp border px-3 py-1.5 font-medium ${
                  valoare === an
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:bg-surface"
                }`}
              >
                {valoare}
              </Link>
            ))}
          </nav>
        }
      />

      {statistici.perAngajat.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={BarChart3}
          titlu={`Nicio perioadă calculată în ${String(an)}`}
          descriere="Statisticile apar după ce cel puțin o perioadă de salarizare din acest an a fost calculată."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CardTotal
              eticheta="Venit brut anual"
              valoare={formatLei(statistici.totalVenitBrutAnual)}
            />
            <CardTotal
              eticheta="Venit net anual"
              valoare={formatLei(statistici.totalVenitNetAnual)}
            />
            <CardTotal
              eticheta="Tichete de masă"
              valoare={`${String(statistici.totalTicheteNumar)} buc · ${formatLei(statistici.totalTicheteValoare)}`}
            />
            <CardTotal
              eticheta="Ore suplimentare"
              valoare={`${statistici.totalOreSuplimentare.toFixed(1)} ore`}
            />
            <CardTotal
              eticheta="Zile concediu de odihnă"
              valoare={`${statistici.totalZileConcediuOdihna.toFixed(1)} zile`}
            />
            <CardTotal
              eticheta="Zile concediu medical"
              valoare={`${statistici.totalZileConcediuMedical.toFixed(1)} zile`}
            />
          </div>

          <div className="border-border rounded-panou overflow-x-auto border">
            <table className="text-corp w-full">
              <caption className="sr-only">Statistici anuale per angajat, {an}.</caption>
              <thead className="bg-surface text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Angajat
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Venit brut
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Venit net
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Tichete
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Ore supl.
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Zile CO
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Zile medicale
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {statistici.perAngajat.map((angajat) => (
                  <tr key={angajat.employeeId} className="hover:bg-surface">
                    <td className="px-4 py-3">
                      <Link
                        href={`/angajati/${angajat.employeeId}`}
                        className="text-primary hover:underline"
                      >
                        {angajat.fullName}
                      </Link>
                      <span className="text-muted-foreground text-nota ml-1.5 font-mono">
                        {angajat.marca}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatLei(angajat.venitBrutAnual)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatLei(angajat.venitNetAnual)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {angajat.ticheteNumar} · {formatLei(angajat.ticheteValoare)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {angajat.oreSuplimentare.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {angajat.zileConcediuOdihna.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {angajat.zileConcediuMedical.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
