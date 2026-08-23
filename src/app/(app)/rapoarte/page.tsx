// src/app/(app)/rapoarte/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
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

  /**
   * Toate coloanele de cifre sunt `numeric`: aliniate la dreapta, cu
   * `tabular-nums`. Fără asta, sumele nu se pot compara pe verticală — și e
   * singurul ecran din produs unde compararea pe verticală e tot scopul.
   *
   * Nicio coloană nu e `sortabil`: `statisticiAnuale` întoarce anul întreg
   * dintr-o singură citire, fără cursor, deci n-ar avea ce să ordoneze în bază.
   * Un antet care pare sortabil și nu face nimic e mai rău decât unul care nu
   * pare.
   */
  const coloane: readonly Coloana<(typeof statistici.perAngajat)[number]>[] = [
    {
      cheie: "angajat",
      antet: "Angajat",
      peTelefon: "titlu",
      celula: (angajat) => (
        <>
          <Link href={`/angajati/${angajat.employeeId}`} className="text-primary hover:underline">
            {angajat.fullName}
          </Link>
          <span className="text-muted-foreground text-nota ml-1.5 font-mono">{angajat.marca}</span>
        </>
      ),
    },
    {
      cheie: "venit_brut",
      antet: "Venit brut",
      numeric: true,
      peTelefon: "meta",
      celula: (angajat) => formatLei(angajat.venitBrutAnual),
    },
    {
      cheie: "venit_net",
      antet: "Venit net",
      numeric: true,
      peTelefon: "meta",
      celula: (angajat) => formatLei(angajat.venitNetAnual),
    },
    {
      cheie: "tichete",
      antet: "Tichete",
      numeric: true,
      peTelefon: "meta",
      celula: (angajat) => `${String(angajat.ticheteNumar)} · ${formatLei(angajat.ticheteValoare)}`,
    },
    {
      cheie: "ore_suplimentare",
      antet: "Ore supl.",
      numeric: true,
      peTelefon: "meta",
      celula: (angajat) => angajat.oreSuplimentare.toFixed(1),
    },
    {
      cheie: "zile_co",
      antet: "Zile CO",
      numeric: true,
      peTelefon: "meta",
      celula: (angajat) => angajat.zileConcediuOdihna.toFixed(1),
    },
    {
      cheie: "zile_medicale",
      antet: "Zile medicale",
      numeric: true,
      peTelefon: "meta",
      celula: (angajat) => angajat.zileConcediuMedical.toFixed(1),
    },
  ];

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

          <Tabel
            caption={`Statistici anuale per angajat, ${String(an)}.`}
            coloane={coloane}
            randuri={statistici.perAngajat}
            cheieRand={(angajat) => angajat.employeeId}
            gol={null}
            subsol={
              <tr>
                <th scope="row" className="px-4 py-3 text-left">
                  Total organizație
                </th>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatLei(statistici.totalVenitBrutAnual)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatLei(statistici.totalVenitNetAnual)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {statistici.totalTicheteNumar} · {formatLei(statistici.totalTicheteValoare)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {statistici.totalOreSuplimentare.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {statistici.totalZileConcediuOdihna.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {statistici.totalZileConcediuMedical.toFixed(1)}
                </td>
              </tr>
            }
          />
        </>
      )}
    </div>
  );
}
