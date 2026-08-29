// src/components/payroll/fluturas.tsx
// Afișarea unui fluturaș — folosită atât în ecranul de administrare
// (`/salarizare/[id]/[entryId]`), cât și în portalul angajatului
// (`/portal/salariul-meu`). Pur, fără citiri proprii: primește datele deja
// autorizate de pagina care o montează.

import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { formatLei } from "@/lib/format/money";
import { formatOre } from "@/lib/format/ore";
import { formatMonthYear } from "@/lib/format/date";
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
  /**
   * Luna pentru care e emis fluturașul, sau `null` când nu se poate afla.
   *
   * NU e opțional, și asta e toată ideea: un fluturaș fără lună nu e un
   * document — dintr-un teanc de hârtii identice nu se mai poate spune care e
   * a cărei luni. Omisiunea a trăit exact fiindcă se putea face TĂCUT.
   *
   * `null` nu e o comoditate: în portal chiar nu se poate citi. `payroll_entries`
   * poartă doar `period_id`, iar `payroll_periods_select` (0026:483) cere
   * `payroll:read = "all"` — un angajat n-are decât `own`, deci rândul cu `an`
   * și `luna` îi e refuzat de RLS, fără eroare. Un embed PostgREST ar lovi
   * exact bug-ul închis în 0027. Se repară cu o migrare (denormalizare pe
   * `payroll_entries` sau o politică de scop propriu), nu din interfață.
   */
  readonly perioada: { readonly an: number; readonly luna: number } | null;
}

export function Fluturas({ inregistrare, bonusuri, retineri, perioada }: Proprietati) {
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
      {/* Antetul documentului. Pe hârtie e singurul lucru care spune CE ține
          omul în mână; pe ecran, care lună se citește. */}
      <header className="border-border flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
        <h2 className="text-foreground text-sectiune font-semibold">Fluturaș de salariu</h2>
        <p className="text-muted-foreground text-corp">
          {perioada === null
            ? "cel mai recent calculat"
            : formatMonthYear(perioada.an, perioada.luna)}
        </p>
      </header>

      <section aria-label="Zile și ore" className="border-border rounded-panou border p-4">
        {/*
         * `<Camp>`-ul local randa `<dt>` și `<dd>` într-un `<div>`, iar în tot
         * fișierul nu exista niciun `<dl>`. Marcaj nevalid, și — mai important
         * pe un document pe care îl citește fiecare angajat — relația
         * etichetă–valoare nu exista deloc pentru cititorul de ecran: „Zile
         * lucrate" și „21" se auzeau ca două texte alăturate, nu ca o pereche.
         *
         * Cele două rânduri condiționate rămân condiționate: o zi de concediu
         * medical care nu există n-are de ce să apară scrisă „0" pe un document
         * oficial.
         */}
        <ListaDefinitii
          coloane={4}
          textNecompletat="—"
          definitii={[
            { eticheta: "Zile lucrătoare lună", valoare: inregistrare.zile_lucratoare_luna },
            { eticheta: "Zile lucrate", valoare: inregistrare.zile_lucrate },
            { eticheta: "Zile CO", valoare: inregistrare.zile_concediu_odihna },
            {
              eticheta: "Ore suplimentare",
              valoare: formatOre(inregistrare.ore_suplimentare),
            },
            ...(inregistrare.zile_concediu_medical > 0
              ? [
                  {
                    eticheta: "Zile concediu medical",
                    valoare: inregistrare.zile_concediu_medical,
                  },
                ]
              : []),
            ...(inregistrare.zile_absenta_nemotivata > 0
              ? [
                  {
                    eticheta: "Zile absență nemotivată",
                    valoare: inregistrare.zile_absenta_nemotivata,
                  },
                ]
              : []),
          ]}
        />
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
