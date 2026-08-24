// src/app/(app)/rapoarte/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
import { aniCuPerioade, statisticiAnuale } from "@/lib/queries/rapoarte";

export const metadata: Metadata = { title: "Rapoarte" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/*
 * Orele și zilele ieșeau prin `toFixed(1)`, adică cu PUNCT zecimal, în același
 * card cu sume formatate `ro-RO`, cu virgulă: „1234.5 ore" lângă „1.234,56 lei".
 * Formatorul de bani trăiește deja într-un singur loc (`lib/format/money.ts`);
 * pentru mărimile care nu sunt bani nu exista niciunul, iar fiecare ecran își
 * scria propriul `toFixed`. Acesta e local deliberat — mutarea lui lângă
 * `formatAmount` e o schimbare în afara acestui modul.
 */
const formatorZecimal = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `1234.5` → `"1.234,5"`. Pentru ore și zile, nu pentru bani. */
function formatZecimal(valoare: number): string {
  return formatorZecimal.format(valoare);
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

  /*
   * Starea goală recomanda „calculați o perioadă" oricui o vedea, fără să ofere
   * drumul. Butonul apare doar pentru cine chiar poate deschide o perioadă; un
   * `hr` fără `payroll:create` primea altfel o instrucțiune pe care n-o putea
   * executa.
   */
  const poateDeschideSalarizarea = can(permisiuni, "payroll:create", "all");

  const parametri = await searchParams;
  const anulCurent = new Date().getFullYear();
  const anBrut = parametri["an"];
  const anParam = typeof anBrut === "string" ? Number(anBrut) : anulCurent;
  const an = Number.isInteger(anParam) && anParam >= 2020 && anParam <= 2100 ? anParam : anulCurent;

  /*
   * Un `?an` invalid era ignorat tăcut, dar rămânea în bara de adrese: ecranul
   * arăta 2026 iar linkul trimis mai departe spunea 2019. Un raport partajat
   * trebuie să arate ce scrie în URL sau să corecteze URL-ul; a treia variantă
   * — să afișeze altceva decât spune — e singura care nu se poate observa.
   */
  if (typeof anBrut === "string" && anBrut !== String(an)) {
    redirect(`/rapoarte?an=${String(an)}`);
  }

  const [statistici, aniCuDate] = await Promise.all([
    statisticiAnuale(tenant.organizationId, an),
    aniCuPerioade(tenant.organizationId),
  ]);

  /*
   * Anii veneau dintr-o listă fixă de cinci, calculată din ceasul serverului:
   * o firmă înrolată anul acesta primea patru butoane care duceau garantat la
   * starea goală, iar una cu date din 2019 nu-și putea atinge arhiva din
   * interfață, deși validarea de mai sus acceptă `?an=2019`. Anul curent și cel
   * cerut rămân mereu în listă chiar dacă n-au perioade — altfel selectorul ar
   * ascunde exact anul pe care omul îl are pe ecran.
   */
  const aniDisponibili = [...new Set([...aniCuDate, an, anulCurent])].sort((a, b) => b - a);

  /*
   * Seriile vin din `perLuna`, agregat din ACELEAȘI intrări de salarizare din
   * care ies și cifrele mari de deasupra. Veneau de pe rândul de perioadă, deci
   * graficul și indicatorul de lângă el aveau surse diferite pentru aceeași
   * mărime și puteau să nu se însumeze.
   *
   * Lunile fără nicio intrare calculată LIPSESC din serie, nu apar ca zero — și
   * asta include acum și lunile care AU perioadă deschisă dar n-au fost
   * calculate niciodată, care înainte intrau în grafic cu totalul implicit 0 al
   * rândului de perioadă. Un zero desenat spune „am măsurat și a ieșit nimic";
   * acolo nu se măsurase.
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

  const costTotalAngajator = statistici.totalCostAngajatorAnual;
  const lunaEvidentiata = an === anulCurent ? formatMonthShort(new Date().getMonth() + 1) : null;

  /*
   * Cele trei destinații ale costului, calculate ca DIFERENȚE, ca să însumeze
   * exact costul total — dacă le-aș fi citit separat, rotunjirile ar fi lăsat
   * un rest, iar inelul ar fi mințit cu câțiva lei.
   *
   * Ordinea scăderilor e sigură DOAR fiindcă toate trei mărimile vin acum din
   * `payroll_entries`, unde `payroll_entries_valori_ck` (0026:200) impune
   * `cost_total_angajator >= brut` pe fiecare rând. Cât timp costul venea de pe
   * rândul de perioadă, o intrare ștearsă logic după calcul putea să lase
   * `cost < brut` și felia a treia ieșea NEGATIVĂ — iar `Inel` scoate feliile
   * negative din desen dar le ține în numitor, deci procentele treceau de 100 %
   * fără nicio eroare.
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
      celula: (angajat) => formatZecimal(angajat.oreSuplimentare),
    },
    {
      cheie: "zile_co",
      antet: "Zile CO",
      numeric: true,
      peTelefon: "meta",
      celula: (angajat) => formatZecimal(angajat.zileConcediuOdihna),
    },
    {
      cheie: "zile_medicale",
      antet: "Zile medicale",
      numeric: true,
      peTelefon: "meta",
      celula: (angajat) => formatZecimal(angajat.zileConcediuMedical),
    },
  ];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Rapoarte"
        descriere="Concediu, venit, tichete de masă și ore suplimentare — pe angajat și agregat pe organizație, din perioadele de salarizare calculate."
        actiuni={
          /*
            `aria-current="page"` pe anul activ: diferența dintre el și restul
            era exclusiv cromatică, deci un cititor de ecran parcurgea cinci
            linkuri identice și nu putea afla pe care dintre ele se află.
            Fundalul activ era `bg-primary/10`, a treia treaptă de fundal și
            singura translucidă din sistem; activul devine plin, ca butonul
            primar, iar chenarul inactivului urcă la `border-foreground/60`
            (4,23:1) de la `border-border` (1,29:1), care pică 1.4.11 pe un
            control.
          */
          <nav aria-label="Alege anul" className="flex flex-wrap gap-1.5">
            {aniDisponibili.map((valoare) => (
              <Link
                key={valoare}
                href={`/rapoarte?an=${String(valoare)}`}
                {...(valoare === an ? { "aria-current": "page" as const } : {})}
                className={`rounded-control text-corp border px-3 py-1.5 font-medium transition-colors ${
                  valoare === an
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-foreground/60 text-foreground hover:bg-surface active:bg-border"
                }`}
              >
                {valoare}
              </Link>
            ))}
          </nav>
        }
      />

      {/*
        Două goluri diferite, două mesaje diferite. „Anul nu are nicio perioadă"
        e o stare de început; „perioadele există, dar niciuna n-a fost
        calculată" e o problemă operațională cu un drum înainte — omul trebuie
        trimis în salarizare, nu lăsat cu impresia că anul e gol. Distincția o
        dă `luniNecalculate`, care înainte nici nu exista: perioada necalculată
        arăta identic cu perioada absentă.
      */}
      {statistici.perAngajat.length === 0 ? (
        statistici.luniNecalculate.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={BarChart3}
            titlu={`Anul ${String(an)} nu are nicio perioadă de salarizare`}
            descriere="Statisticile apar după ce cel puțin o perioadă de salarizare din acest an a fost calculată."
            {...(poateDeschideSalarizarea
              ? { actiune: { eticheta: "Deschide salarizarea", href: "/salarizare" } }
              : {})}
          />
        ) : (
          <StareGoala
            fel="initiala"
            pictograma={BarChart3}
            titlu={
              statistici.luniNecalculate.length === 1
                ? `Perioada din ${String(an)} nu a fost calculată`
                : `Cele ${String(statistici.luniNecalculate.length)} perioade din ${String(an)} nu au fost calculate`
            }
            descriere={`Raportul se face din intrările de salarizare, iar acestea apar abia la calcul. Fără cifre: ${statistici.luniNecalculate.map(formatMonthShort).join(", ")}.`}
            {...(poateDeschideSalarizarea
              ? { actiune: { eticheta: "Deschide salarizarea", href: "/salarizare" } }
              : {})}
          />
        )
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

          {/*
            Lunile fără niciun calcul nu apar nicăieri în cifre și, mai
            important, nu apar nici în grafic — nu ca zero, ci deloc. Fără
            fraza asta, un an cu opt luni calculate arată exact ca un an
            întreg, iar cine compară două perioade compară intervale diferite
            fără să știe.
          */}
          {statistici.luniNecalculate.length === 0 ? null : (
            <Callout fel="informativ" titlu="Raportul nu acoperă tot anul">
              {`${String(statistici.perLuna.length)} ${statistici.perLuna.length === 1 ? "lună calculată" : "luni calculate"}. `}
              {statistici.luniNecalculate.length === 1
                ? `Luna ${formatMonthShort(statistici.luniNecalculate[0] ?? 1)} are perioadă deschisă, dar niciun calcul, deci lipsește din toate cifrele și din grafice.`
                : `Lunile ${statistici.luniNecalculate.map(formatMonthShort).join(", ")} au perioadă deschisă, dar niciun calcul, deci lipsesc din toate cifrele și din grafice.`}
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
              valoare={`${formatZecimal(statistici.totalOreSuplimentare)} ore`}
            />
            <Indicator
              eticheta="Zile de concediu"
              valoare={`${formatZecimal(statistici.totalZileConcediuOdihna)} odihnă · ${formatZecimal(statistici.totalZileConcediuMedical)} medical`}
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
                  {formatZecimal(statistici.totalOreSuplimentare)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatZecimal(statistici.totalZileConcediuOdihna)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatZecimal(statistici.totalZileConcediuMedical)}
                </td>
              </tr>
            }
          />
        </>
      )}
    </div>
  );
}
