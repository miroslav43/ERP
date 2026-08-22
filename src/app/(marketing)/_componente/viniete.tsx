import type { ReactNode } from "react";

import { TaxePieChart } from "@/components/payroll/taxe-pie-chart";
import { formatLei } from "@/lib/format/money";

/**
 * Vinietele de interfață.
 *
 * NU sunt ilustrații stilizate în paleta landing-ului și NU sunt capturi de
 * ecran: sunt reconstrucții în HTML ale ecranelor reale, desenate cu TOKENII
 * APLICAȚIEI — crem, navy, aceleași chenare, aceeași rază, același font de corp.
 * Consecința e dublă: vizitatorul a văzut aplicația de trei ori înainte să
 * intre în ea, iar dacă tokenii aplicației se schimbă, vinietele se schimbă
 * odată cu ei — exact ca donut-ul de taxe, care e refolosit mai jos neatins.
 *
 * Fiecare poartă discret cuvântul „exemplu", ca să nu poată fi citită drept
 * captură reală de la un client.
 */
export function Vinieta({
  titlu,
  eticheta = "exemplu",
  subsol,
  children,
}: {
  titlu: string;
  eticheta?: string;
  subsol?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="rounded-mk-rama border-mk-rigla overflow-hidden border">
      <figcaption className="bg-mk-cerneala text-mk-text-inv flex items-baseline justify-between gap-4 px-4 py-2">
        <span className="font-mk-date text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
          {titlu}
        </span>
        <span className="font-mk-date text-mk-text-inv-slab text-[0.6875rem] tracking-[0.08em]">
          {eticheta}
        </span>
      </figcaption>
      {/* De aici în jos suntem în aplicație: tokenii ei, nu ai landing-ului. */}
      <div className="bg-background text-foreground p-4 sm:p-5">{children}</div>
      {subsol !== undefined && (
        <div className="bg-mk-cerneala text-mk-text-inv-slab px-4 py-3 text-[0.8125rem] leading-[1.5]">
          {subsol}
        </div>
      )}
    </figure>
  );
}

/**
 * Vinieta care PIERDE rânduri.
 *
 * Singura imagine de pe pagină care DEMONSTREAZĂ o politică de acces în loc s-o
 * afirme: patru din șase rânduri nu sunt estompate, ci înlocuite de bare
 * hașurate, cu numele politicii care le-a refuzat. Rândurile lipsă nu sunt
 * ascunse de interfață — baza de date nu le-a trimis niciodată.
 */
export function VinietaPontaj({
  titlu,
  politica,
  contor,
  nota,
  randuri,
  ascunse,
}: {
  titlu: string;
  politica: string;
  contor: string;
  nota: string;
  randuri: readonly string[];
  ascunse: number;
}) {
  const vizibile = randuri.length - ascunse;
  return (
    <Vinieta
      titlu={titlu}
      subsol={
        <>
          <span className="font-mk-date text-mk-text-inv">{politica}</span> — {nota}
        </>
      }
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{titlu}</caption>
        <thead>
          <tr className="border-border bg-surface border-b">
            <th scope="col" className="text-muted-foreground px-3 py-2 text-xs font-semibold">
              Angajat
            </th>
            <th
              scope="col"
              className="text-muted-foreground px-3 py-2 text-right text-xs font-semibold"
            >
              Ore
            </th>
            <th
              scope="col"
              className="text-muted-foreground px-3 py-2 text-right text-xs font-semibold"
            >
              Stare
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {randuri.map((nume, index) =>
            index < vizibile ? (
              <tr key={nume}>
                <td className="px-3 py-2.5">{nume}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {index === 0 ? "164" : "120"}
                </td>
                <td className="text-success px-3 py-2.5 text-right">Aprobat</td>
              </tr>
            ) : (
              <tr key={nume} aria-hidden="true">
                <td colSpan={3} className="px-3 py-2.5">
                  <span className="mk-hasura border-border block h-4 w-full border" />
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <p className="text-muted-foreground border-border mt-3 border-t pt-3 text-xs">
        {contor.replace("{ascunse}", String(ascunse)).replace("{total}", String(randuri.length))}
      </p>
    </Vinieta>
  );
}

/**
 * Fluturașul. Donut-ul e refolosit din `src/components/payroll/taxe-pie-chart.tsx`
 * aproape neatins: Server Component pur, fără JavaScript, cu culorile luate
 * exclusiv prin `var(--color-*)`, ca tema fiecărei firme să se aplice și aici.
 */
const BRUT = 6000;
const CAS = 1500;
const CASS = 600;
const IMPOZIT = 390;
const NET = BRUT - CAS - CASS - IMPOZIT;

export function VinietaFluturas({ titlu, avertisment }: { titlu: string; avertisment: string }) {
  return (
    <Vinieta titlu={titlu} subsol={avertisment}>
      <TaxePieChart
        felii={[
          { eticheta: "Net de plată", valoare: NET, culoareVar: "--color-primary" },
          { eticheta: "CAS", valoare: CAS, culoareVar: "--color-accent" },
          { eticheta: "CASS", valoare: CASS, culoareVar: "--color-warning" },
          { eticheta: "Impozit", valoare: IMPOZIT, culoareVar: "--color-muted-foreground" },
        ]}
      />
      <dl className="border-border mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-4 text-sm">
        {[
          ["Salariu brut", BRUT],
          ["Contribuții", CAS + CASS],
          ["Impozit pe venit", IMPOZIT],
          ["Net de plată", NET],
        ].map(([eticheta, valoare]) => (
          <div key={String(eticheta)} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{eticheta}</dt>
            <dd className="font-medium tabular-nums">{formatLei(valoare as number)}</dd>
          </div>
        ))}
      </dl>
    </Vinieta>
  );
}

/** Semaforul de scadențe, alimentat din trei module diferite. */
type Stare = "expirat" | "critic" | "atentie" | "ok" | "niciodata";

const CLASE_STARE: Readonly<Record<Stare, string>> = {
  expirat: "text-danger",
  critic: "text-danger",
  atentie: "text-warning",
  ok: "text-success",
  niciodata: "text-danger",
};

const SCADENTE: readonly Readonly<{ ce: string; unde: string; stare: Stare; text: string }>[] = [
  { ce: "ITP — B 12 ABC", unde: "Parc auto", stare: "expirat", text: "expirat de 3 zile" },
  { ce: "RCA — B 12 ABC", unde: "Parc auto", stare: "critic", text: "5 zile rămase" },
  { ce: "Rovinietă — B 44 XYZ", unde: "Parc auto", stare: "atentie", text: "22 de zile rămase" },
  { ce: "Instruire SSM periodică", unde: "SSM și PSI", stare: "ok", text: "în regulă" },
  {
    ce: "Medicina muncii — Toma S.",
    unde: "SSM și PSI",
    stare: "niciodata",
    text: "niciodată făcută",
  },
  { ce: "Verificare stingător", unde: "Mentenanță", stare: "ok", text: "în regulă" },
];

export function VinietaScadente({ titlu, nota }: { titlu: string; nota: string }) {
  return (
    <Vinieta titlu={titlu} subsol={nota}>
      <ul className="divide-border divide-y text-sm">
        {SCADENTE.map((scadenta) => (
          <li key={scadenta.ce} className="flex items-baseline justify-between gap-4 py-2.5">
            <span>
              {scadenta.ce}
              <span className="text-muted-foreground ml-2 text-xs">{scadenta.unde}</span>
            </span>
            <span className={`${CLASE_STARE[scadenta.stare]} shrink-0 text-xs font-medium`}>
              {scadenta.text}
            </span>
          </li>
        ))}
      </ul>
    </Vinieta>
  );
}
