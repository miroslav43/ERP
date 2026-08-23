// src/components/payroll/fluturas.tsx
// Afișarea unui fluturaș — folosită atât în ecranul de administrare
// (`/salarizare/[id]/[entryId]`), cât și în portalul angajatului
// (`/portal/salariul-meu`). Pur, fără citiri proprii: primește datele deja
// autorizate de pagina care o montează.

import { formatLei } from "@/lib/format/money";
import { ETICHETE_TIP_PRIMA, ETICHETE_TIP_RETINERE } from "@/domain/payroll/etichete";
import type {
  DetaliuInregistrare,
  RandPrimaPerioada,
  RandRetinerePerioada,
} from "@/lib/queries/payroll";
import { Inel } from "@/components/grafice/inel";

const ETICHETE_PAS: Record<string, string> = {
  bazaSalariu: "Salariu de bază (zile plătite)",
  indemnizatieCo: "Indemnizație de concediu de odihnă",
  indemnizatieCmAngajator: "Concediu medical — suportat de firmă",
  indemnizatieCmFnuass: "Concediu medical — de la fondul de sănătate",
  sumaOreSuplimentare: "Ore suplimentare",
  sporNoapte: "Spor de noapte",
  sporRepaus: "Ore lucrate în zile de repaus săptămânal",
  sporSarbatoare: "Ore lucrate în zile de sărbătoare legală",
  primeTotal: "Prime",
  brut: "Total brut",
  valoareTichete: "Tichete de masă",
  bazaCas: "Bază CAS (pensie)",
  bazaCass: "Bază CASS (sănătate)",
  bazaCasCass: "Bază CAS/CASS",
  cas: "CAS",
  cass: "CASS",
  deducerePersonala: "Deducere personală",
  scutireFiscala: "Scutire fiscală",
  bazaImpozit: "Bază de impozit",
  impozit: "Impozit pe venit",
  camAngajator: "CAM (angajator)",
  net: "Net",
  retineriTotal: "Rețineri",
  avantajeNatura: "Avantaje primite în natură (scăzute din plată)",
  diurnaImpozabila: "Diurnă peste plafon (impozitată)",
  diurnaNeimpozabila: "Diurnă neimpozabilă",
  restDePlata: "Rest de plată",
  netDePlata: "Net de plată",
  costTotalAngajator: "Cost total angajator",
};

interface Proprietati {
  readonly inregistrare: DetaliuInregistrare;
  readonly bonusuri: readonly RandPrimaPerioada[];
  readonly retineri: readonly RandRetinerePerioada[];
}

export function Fluturas({ inregistrare, bonusuri, retineri }: Proprietati) {
  /*
   * Feliile nu-și mai aleg culoarea: o iau din paleta categorică a graficelor.
   *
   * Înainte foloseau tokeni de STARE — net = `success` (verde), CAS =
   * `warning`, impozit = `danger` (roșu). Într-un document pe care îl citește
   * fiecare angajat, asta nu e informație, e o opinie: contribuția la pensie nu
   * e o avertizare, iar impozitul pe venit nu e o eroare. Cele patru felii sunt
   * părți dintr-un întreg, nu verdicte.
   */
  const felii = [
    { eticheta: "Net (rămas angajatului)", valoare: inregistrare.net },
    { eticheta: "CAS (pensie)", valoare: inregistrare.cas },
    { eticheta: "CASS (sănătate)", valoare: inregistrare.cass },
    { eticheta: "Impozit pe venit", valoare: inregistrare.impozit },
  ];

  return (
    <div className="space-y-6">
      <section
        aria-label="Zile și ore"
        className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-4"
      >
        <Camp eticheta="Zile lucrătoare lună" valoare={String(inregistrare.zile_lucratoare_luna)} />
        <Camp eticheta="Zile lucrate" valoare={String(inregistrare.zile_lucrate)} />
        <Camp eticheta="Zile CO" valoare={String(inregistrare.zile_concediu_odihna)} />
        <Camp eticheta="Ore suplimentare" valoare={String(inregistrare.ore_suplimentare)} />
        {inregistrare.zile_concediu_medical > 0 ? (
          <Camp
            eticheta="Zile concediu medical"
            valoare={String(inregistrare.zile_concediu_medical)}
          />
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
              className="border-warning/40 bg-warning/8 rounded-control text-corp border p-3"
            >
              {w.mesaj}
            </li>
          ))}
        </ul>
      )}

      <section
        aria-label="Împărțirea salariului brut"
        className="border-border rounded-panou border p-4"
      >
        <Inel
          titlu="Împărțirea salariului brut pe contribuții"
          unitate="Lei"
          felii={felii}
          formateaza={formatLei}
          subtitluCentral="din brut"
        />
        {inregistrare.retineri_total > 0 ? (
          <p className="text-muted-foreground text-corp mt-3">
            Din net, {formatLei(inregistrare.retineri_total)} rețineri → net de plată efectiv:{" "}
            <strong className="text-foreground">{formatLei(inregistrare.net_de_plata)}</strong>.
          </p>
        ) : null}
        <p className="text-muted-foreground text-nota mt-1">
          Cost total angajator: {formatLei(inregistrare.cost_total_angajator)} (din care CAM
          angajator: {formatLei(inregistrare.cam_angajator)} — cost suplimentar al angajatorului, nu
          se scade din salariul dvs.).
        </p>
      </section>

      {bonusuri.length === 0 && retineri.length === 0 ? null : (
        <section
          aria-label="Prime și rețineri individuale"
          className="border-border rounded-panou border"
        >
          <ul className="divide-border text-corp divide-y">
            {bonusuri.map((b) => (
              <li key={b.id} className="text-success flex items-center gap-2 px-4 py-2">
                <span className="tabular-nums">+ {formatLei(b.suma)}</span>
                <span className="text-muted-foreground">
                  {ETICHETE_TIP_PRIMA[b.tip] ?? b.tip} — {b.motiv}
                </span>
              </li>
            ))}
            {retineri.map((r) => (
              <li key={r.id} className="text-danger flex items-center gap-2 px-4 py-2">
                <span className="tabular-nums">− {formatLei(r.suma)}</span>
                <span className="text-muted-foreground">
                  {ETICHETE_TIP_RETINERE[r.tip] ?? r.tip} — {r.motiv}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Calculul detaliat" className="border-border rounded-panou border">
        <table className="text-corp w-full">
          <tbody className="divide-border divide-y">
            {inregistrare.calc_breakdown.map((pas) => (
              <tr
                key={pas.pas}
                className={pas.pas === "netDePlata" ? "bg-surface font-medium" : ""}
              >
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
      <dt className="text-muted-foreground text-nota">{eticheta}</dt>
      <dd className="text-corp font-medium">{valoare}</dd>
    </div>
  );
}
