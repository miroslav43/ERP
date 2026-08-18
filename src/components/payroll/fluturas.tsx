// src/components/payroll/fluturas.tsx
// Afișarea unui fluturaș — folosită atât în ecranul de administrare
// (`/salarizare/[id]/[entryId]`), cât și în portalul angajatului
// (`/portal/salariul-meu`). Pur, fără citiri proprii: primește datele deja
// autorizate de pagina care o montează.

import { formatLei } from "@/lib/format/money";
import type { DetaliuInregistrare } from "@/lib/queries/payroll";

const ETICHETE_PAS: Record<string, string> = {
  bazaSalariu: "Salariu de bază (zile plătite)",
  sumaOreSuplimentare: "Ore suplimentare",
  sporNoapte: "Spor de noapte",
  primeTotal: "Prime",
  brut: "Total brut",
  valoareTichete: "Tichete de masă",
  bazaCasCass: "Bază CAS/CASS",
  cas: "CAS",
  cass: "CASS",
  deducerePersonala: "Deducere personală",
  bazaImpozit: "Bază de impozit",
  impozit: "Impozit pe venit",
  camAngajator: "CAM (angajator)",
  net: "Net",
  retineriTotal: "Rețineri",
  netDePlata: "Net de plată",
  costTotalAngajator: "Cost total angajator",
};

export function Fluturas({ inregistrare }: { readonly inregistrare: DetaliuInregistrare }) {
  return (
    <div className="space-y-6">
      <section
        aria-label="Zile și ore"
        className="border-border grid gap-4 rounded-lg border p-4 sm:grid-cols-4"
      >
        <Camp eticheta="Zile lucrătoare lună" valoare={String(inregistrare.zile_lucratoare_luna)} />
        <Camp eticheta="Zile lucrate" valoare={String(inregistrare.zile_lucrate)} />
        <Camp eticheta="Zile CO" valoare={String(inregistrare.zile_concediu_odihna)} />
        <Camp eticheta="Ore suplimentare" valoare={String(inregistrare.ore_suplimentare)} />
        {inregistrare.zile_concediu_medical > 0 ? (
          <Camp eticheta="Zile concediu medical" valoare={String(inregistrare.zile_concediu_medical)} />
        ) : null}
        {inregistrare.zile_absenta_nemotivata > 0 ? (
          <Camp
            eticheta="Zile absență nemotivată"
            valoare={String(inregistrare.zile_absenta_nemotivata)}
          />
        ) : null}
      </section>

      {inregistrare.calc_warnings.length === 0 ? null : (
        <ul className="space-y-1">
          {inregistrare.calc_warnings.map((w, i) => (
            <li
              key={i}
              role="alert"
              className="border-warning/40 bg-warning/8 rounded-md border p-3 text-sm"
            >
              {w.mesaj}
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Calculul detaliat" className="border-border rounded-lg border">
        <table className="w-full text-sm">
          <tbody className="divide-border divide-y">
            {inregistrare.calc_breakdown.map((pas) => (
              <tr key={pas.pas} className={pas.pas === "netDePlata" ? "bg-surface font-medium" : ""}>
                <td className="px-4 py-2">{ETICHETE_PAS[pas.pas] ?? pas.pas}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatLei(pas.valoare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Camp({ eticheta, valoare }: { readonly eticheta: string; readonly valoare: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{eticheta}</dt>
      <dd className="text-sm font-medium">{valoare}</dd>
    </div>
  );
}
