import type { ReactElement } from "react";

import {
  NOTA_FOLOSINTA_MIXTA,
  mutaLuna,
  sugereazaAvantaj,
  type SugestieAvantaj,
} from "@/domain/fleet/fiscal";
import { formatDate, formatMonthYear } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { avantajeNaturaAuto, type FapteAvantajAlocare } from "@/lib/queries/flota-fiscal";

/**
 * Avantajul în natură din mașina de serviciu folosită și în scop personal
 * (0202, F10), ca SUGESTIE pe fișa angajatului: 1,7% pe lună din valoarea de
 * intrare sau chiria vehiculului închiriat (HG 1/2016, titlul IV pct. 12
 * alin. (5) lit. a)), doar când firma are impozit pe profit și vehiculul nu e
 * în regimul de 50% (Codul fiscal, art. 76 alin. (4) lit. ț) și ț^1)).
 *
 * Componentă de SERVER, montată doar pentru cine face statul de plată
 * (`payroll:read = all`); baza o judecă oricum (`public.avantaj_natura_flota`
 * dă zero rânduri oricui altcuiva). NU scrie nimic: omul care face salarizarea
 * adaugă manual componenta „Beneficiu în natură” din „Sporuri și prime”.
 */
interface Proprietati {
  readonly organizationId: string;
  readonly employeeId: string;
  /** `AAAA-LL-ZZ`, ziua României. */
  readonly azi: string;
  readonly className?: string;
}

function numeLuna(luna: string): string {
  const [an, nr] = luna.split("-").map(Number) as [number, number];
  return formatMonthYear(an, nr);
}

function perioada(f: FapteAvantajAlocare): string {
  const de = formatDate(f.de_la.slice(0, 10));
  return f.pana_la === null
    ? `din ${de}, în curs`
    : `${de} – ${formatDate(f.pana_la.slice(0, 10))}`;
}

function Rand({
  fapte,
  sugestie,
  luna,
}: Readonly<{
  fapte: FapteAvantajAlocare;
  sugestie: SugestieAvantaj;
  luna: string;
}>): ReactElement {
  return (
    <li className="border-border rounded-control space-y-1 border p-3">
      <p className="font-medium">
        {fapte.vehicul_nr}
        <span className="text-muted-foreground text-nota ml-2 font-normal">{perioada(fapte)}</span>
      </p>
      {sugestie.fel === "sugestie" ? (
        <>
          <p className="text-corp">
            {sugestie.formula}
            <span className="text-muted-foreground text-nota block">{sugestie.temei}</span>
          </p>
          {sugestie.avertismente.map((a) => (
            <p key={a} className="text-corp">
              <span className="font-medium">Atenție: </span>
              {a}
            </p>
          ))}
          <p className="text-muted-foreground text-nota">
            Se adaugă manual, pentru {numeLuna(luna)}, ca „Beneficiu în natură” de{" "}
            {formatLei(sugestie.valoareLunara)}, din „Sporuri și prime” → „Spor sau primă nouă”.
          </p>
        </>
      ) : sugestie.fel === "neaplicabil" ? (
        <p className="text-corp">
          {sugestie.motiv}
          <span className="text-muted-foreground text-nota block">{sugestie.temei}</span>
        </p>
      ) : (
        <p className="text-corp">{sugestie.motiv}</p>
      )}
    </li>
  );
}

export async function SugestieAvantajAuto({
  organizationId,
  employeeId,
  azi,
  className,
}: Proprietati): Promise<ReactElement | null> {
  const lunaCurenta = azi.slice(0, 7);
  const lunaTrecuta = mutaLuna(lunaCurenta, -1);
  const [curenta, trecuta] = await Promise.all([
    avantajeNaturaAuto(organizationId, employeeId, lunaCurenta),
    avantajeNaturaAuto(organizationId, employeeId, lunaTrecuta),
  ]);
  if (curenta.length === 0 && trecuta.length === 0) return null;

  const grupuri = [
    { luna: lunaCurenta, randuri: curenta },
    { luna: lunaTrecuta, randuri: trecuta },
  ].filter((g) => g.randuri.length > 0);

  return (
    <section aria-labelledby="titlu-avantaj-auto" className={className}>
      <h2 id="titlu-avantaj-auto" className="text-sectiune mb-1 font-medium">
        Avantaj în natură: mașina de serviciu
      </h2>
      <p className="text-muted-foreground text-corp mb-3">
        Angajatul are o mașină cu drept de folosință personală. Sugestia de mai jos nu se aplică
        singură: nimic nu intră pe statul de plată fără ca cineva să adauge componenta.
      </p>
      <div className="space-y-4">
        {grupuri.map((g) => (
          <div key={g.luna} className="space-y-2">
            <h3 className="text-corp font-semibold">{numeLuna(g.luna)}</h3>
            <ul className="space-y-2">
              {g.randuri.map((fapte) => (
                <Rand
                  key={`${fapte.assignment_id}-${g.luna}`}
                  fapte={fapte}
                  sugestie={sugereazaAvantaj(fapte)}
                  luna={g.luna}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-nota mt-3">
        {NOTA_FOLOSINTA_MIXTA} Sugestia e pe lună întreagă; pentru o lună în care mașina a fost
        alocată doar o parte din zile, cereți confirmarea contabilului. Tratamentul fiscal al
        mașinii personale folosite în interes de serviciu (comodat sau chirie) se stabilește tot cu
        contabilul.
      </p>
    </section>
  );
}
