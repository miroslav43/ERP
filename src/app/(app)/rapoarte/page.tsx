// src/app/(app)/rapoarte/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Bare } from "@/components/grafice/bare";
import { Callout } from "@/components/ui/callout";
import { Indicator } from "@/components/ui/indicator";
import { Inel } from "@/components/grafice/inel";
import { Sparkline } from "@/components/grafice/sparkline";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { formatMonthShort } from "@/lib/format/date";
import { statisticiAnuale } from "@/lib/queries/rapoarte";

export const metadata: Metadata = { title: "Rapoarte" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  /*
   * Seriile pentru grafice vin din `perLuna`, adică de pe RÂNDUL de perioadă,
   * unde totalurile sunt deja scrise. Nu se re-agregă din `payroll_entries`:
   * ar fi a doua sursă de adevăr pentru aceeași cifră, iar cele două ar putea
   * să difere fără ca cineva să afle care e greșită.
   *
   * Lunile fără perioadă LIPSESC din serie, nu apar ca zero. Un zero desenat
   * spune „am măsurat și a ieșit nimic"; aici nu s-a măsurat.
   */
  const serieCost = statistici.perLuna.map((l) => ({
    eticheta: formatMonthShort(l.luna),
    valoare: l.totalCostAngajator,
  }));
  const serieBrut = statistici.perLuna.map((l) => ({
    eticheta: formatMonthShort(l.luna),
    valoare: l.totalBrut,
  }));
  const serieNet = statistici.perLuna.map((l) => ({
    eticheta: formatMonthShort(l.luna),
    valoare: l.totalNet,
  }));

  const costTotalAngajator = statistici.perLuna.reduce((s, l) => s + l.totalCostAngajator, 0);
  const lunaEvidentiata = an === anulCurent ? formatMonthShort(new Date().getMonth() + 1) : null;

  /*
   * Cele trei destinații ale costului, calculate ca DIFERENȚE, ca să însumeze
   * exact costul total — dacă le-aș fi citit separat, rotunjirile ar fi lăsat
   * un rest, iar inelul ar fi mințit cu câțiva lei.
   */
  const feliiCost = [
    { eticheta: "Net, la angajat", valoare: statistici.totalVenitNetAnual },
    {
      eticheta: "Taxe reținute din brut",
      valoare: statistici.totalVenitBrutAnual - statistici.totalVenitNetAnual,
    },
    {
      eticheta: "Contribuții ale firmei",
      valoare: costTotalAngajator - statistici.totalVenitBrutAnual,
    },
  ];

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
          {statistici.luniInCiorna.length === 0 ? null : (
            <Callout fel="atentie" titlu="Anul nu e închis">
              {statistici.luniInCiorna.length === 1
                ? `Luna ${formatMonthShort(statistici.luniInCiorna[0] ?? 1)} e încă în ciornă, iar cifrele ei intră în totalurile de mai jos.`
                : `${String(statistici.luniInCiorna.length)} luni sunt încă în ciornă (${statistici.luniInCiorna
                    .map(formatMonthShort)
                    .join(", ")}), iar cifrele lor intră în totalurile de mai jos.`}{" "}
              Se vor schimba la recalculare.
            </Callout>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Indicator
              eticheta="Venit brut anual"
              valoare={formatLei(statistici.totalVenitBrutAnual)}
              serie={
                <Sparkline
                  titlu="Venit brut pe luni"
                  unitate="Lei"
                  puncte={serieBrut}
                  latime={140}
                />
              }
            />
            <Indicator
              eticheta="Venit net anual"
              valoare={formatLei(statistici.totalVenitNetAnual)}
              serie={
                <Sparkline titlu="Venit net pe luni" unitate="Lei" puncte={serieNet} latime={140} />
              }
            />
            <Indicator
              eticheta="Cost total angajator"
              valoare={formatLei(costTotalAngajator)}
              nota="Brut plus contribuțiile datorate de firmă."
            />
            <Indicator
              eticheta="Tichete de masă"
              valoare={`${String(statistici.totalTicheteNumar)} buc · ${formatLei(statistici.totalTicheteValoare)}`}
            />
            <Indicator
              eticheta="Ore suplimentare"
              valoare={`${statistici.totalOreSuplimentare.toFixed(1)} ore`}
            />
            <Indicator
              eticheta="Zile de concediu"
              valoare={`${statistici.totalZileConcediuOdihna.toFixed(1)} odihnă · ${statistici.totalZileConcediuMedical.toFixed(1)} medical`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <section
              aria-labelledby="titlu-cost-lunar"
              className="border-border rounded-panou border p-4 lg:col-span-3"
            >
              <h2 id="titlu-cost-lunar" className="text-sectiune text-foreground font-semibold">
                Costul salarial, lună de lună
              </h2>
              <p className="text-muted-foreground text-nota mt-0.5">
                Brutul plus contribuțiile firmei, din perioadele existente. Lunile fără perioadă nu
                apar deloc — nu se desenează un zero care n-a fost măsurat.
              </p>
              <div className="mt-4">
                <Bare
                  titlu={`Cost salarial pe luni, ${String(an)}`}
                  unitate="Lei"
                  puncte={serieCost}
                  formateaza={(v) => formatLei(v)}
                  {...(lunaEvidentiata === null ? {} : { evidentiaza: lunaEvidentiata })}
                />
              </div>
            </section>

            <section
              aria-labelledby="titlu-impartire"
              className="border-border rounded-panou border p-4 lg:col-span-2"
            >
              <h2 id="titlu-impartire" className="text-sectiune text-foreground font-semibold">
                Unde se duce costul
              </h2>
              <p className="text-muted-foreground text-nota mt-0.5">
                Împărțirea costului anual al firmei pe cele trei destinații.
              </p>
              <div className="mt-4">
                <Inel
                  titlu={`Împărțirea costului salarial, ${String(an)}`}
                  unitate="Lei"
                  felii={feliiCost}
                  formateaza={formatLei}
                  subtitluCentral="cost total"
                  marime={168}
                />
              </div>
            </section>
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
