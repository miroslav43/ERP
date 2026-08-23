// src/app/(app)/diurna/[id]/etape.tsx
// Traseul real al deplasării (`business_trip_legs`) și calculul diurnei
// pornind de la el — motorul PUR din `@/domain/per-diem`, cu datele reale ale
// deplasării, nu previzualizarea cu o singură țară de la creare.

import { Tabel, type Coloana } from "@/components/ui/tabel";
import { formatDateTime } from "@/lib/format/date";
import { formatAmount, formatLei } from "@/lib/format/money";
import {
  calculeazaDiurnaDeplasare,
  type Deplasare,
  type EtapaDeplasare,
  type PoliticaRand,
  type Tara,
} from "@/lib/queries/per-diem";
import type { BaremTara } from "@/domain/per-diem/sume";

function numeTara(tari: ReadonlyMap<string, Tara>, id: string): string {
  return tari.get(id)?.denumire ?? id;
}

export function Etape({
  deplasare,
  etape,
  politica,
  baremuri,
  tari,
}: {
  readonly deplasare: Deplasare;
  readonly etape: readonly EtapaDeplasare[];
  readonly politica: PoliticaRand | null;
  readonly baremuri: readonly BaremTara[];
  readonly tari: ReadonlyMap<string, Tara>;
}) {
  return (
    <div className="space-y-6">
      {etape.length === 0 ? (
        <p className="text-muted-foreground text-corp">
          Deplasarea nu are încă nicio etapă înregistrată — calculul de mai jos folosește o singură
          țară, cea a deplasării.
        </p>
      ) : (
        <ol className="text-corp space-y-2">
          {etape.map((e) => (
            <li key={e.id} className="border-border rounded-control border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {numeTara(tari, e.from_country_id)} → {numeTara(tari, e.to_country_id)}
                </span>
                <span className="text-muted-foreground text-nota">Etapa {e.ordine}</span>
              </div>
              <p className="text-muted-foreground">
                {formatDateTime(new Date(e.plecare_la))} – {formatDateTime(new Date(e.sosire_la))}
                {e.localitate_sosire === null ? "" : ` · ${e.localitate_sosire}`}
              </p>
            </li>
          ))}
        </ol>
      )}

      {politica === null ? (
        <p className="text-foreground text-corp">
          Nu există o politică de diurnă valabilă la data plecării — calculul nu poate fi afișat.
        </p>
      ) : (
        <CalculDiurna
          deplasare={deplasare}
          etape={etape}
          politica={politica}
          baremuri={baremuri}
          tari={tari}
        />
      )}
    </div>
  );
}

function CalculDiurna({
  deplasare,
  etape,
  politica,
  baremuri,
  tari,
}: {
  readonly deplasare: Deplasare;
  readonly etape: readonly EtapaDeplasare[];
  readonly politica: PoliticaRand;
  readonly baremuri: readonly BaremTara[];
  readonly tari: ReadonlyMap<string, Tara>;
}) {
  const { ferestre, rezultat, durataOre } = calculeazaDiurnaDeplasare(
    {
      countryId: deplasare.country_id,
      plecareLa: deplasare.plecare_la,
      sosireLa: deplasare.sosire_la,
      plecareEfectivaLa: deplasare.plecare_efectiva_la,
      sosireEfectivaLa: deplasare.sosire_efectiva_la,
      cursDiurna: deplasare.curs_diurna,
    },
    etape.map((e) => ({
      ordine: e.ordine,
      fromCountryId: e.from_country_id,
      toCountryId: e.to_country_id,
      sosireLa: e.sosire_la,
    })),
    politica,
    baremuri,
  );

  if (ferestre.length === 0) {
    return (
      <p className="text-foreground text-corp">
        <strong>0 zile de diurnă</strong> — deplasarea a durat {formatAmount(durataOre)} ore, sub
        pragul de {formatAmount(politica.prag_ore_minim)} ore din politică.
      </p>
    );
  }

  /**
   * Ferestrele se calculează în memorie, nu se citesc paginat — nu există
   * cursor, deci niciun antet nu e sortabil.
   */
  const coloane: readonly Coloana<(typeof ferestre)[number]>[] = [
    {
      cheie: "numar",
      antet: "#",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (f) => f.numarFereastra,
    },
    {
      cheie: "interval",
      antet: "Interval",
      peTelefon: "titlu",
      celula: (f) => `${formatDateTime(f.deLa)} – ${formatDateTime(f.panaLa)}`,
    },
    {
      cheie: "tara",
      antet: "Țară",
      peTelefon: "meta",
      celula: (f) => numeTara(tari, f.taraId),
    },
    {
      cheie: "fractiune",
      antet: "Fracțiune",
      numeric: true,
      peTelefon: "meta",
      celula: (f) => formatAmount(f.fractiune),
    },
    {
      cheie: "motiv",
      antet: "Motiv",
      peTelefon: "meta",
      celula: (f) => <span className="text-muted-foreground">{f.motiv}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <Tabel
        caption="Ferestrele de 24 de ore ale diurnei și fracțiunea acordată fiecăreia."
        coloane={coloane}
        randuri={ferestre}
        cheieRand={(f) => String(f.numarFereastra)}
        densitate="compact"
        gol={null}
      />

      <dl className="border-border rounded-panou grid grid-cols-2 gap-4 border p-4 sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-nota tracking-wide uppercase">Zile total</dt>
          <dd className="text-corp mt-0.5 font-medium">{formatAmount(rezultat.zileTotal)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-nota tracking-wide uppercase">Valoare</dt>
          <dd className="text-corp mt-0.5 font-medium">
            {rezultat.valoareLei === null ? "necunoscută" : formatLei(rezultat.valoareLei)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-nota tracking-wide uppercase">Neimpozabil</dt>
          <dd className="text-corp mt-0.5 font-medium">
            {rezultat.parteNeimpozabilaLei === null
              ? "—"
              : formatLei(rezultat.parteNeimpozabilaLei)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-nota tracking-wide uppercase">Impozabil</dt>
          <dd className="text-corp mt-0.5 font-medium">
            {rezultat.parteImpozabilaLei === null ? "—" : formatLei(rezultat.parteImpozabilaLei)}
          </dd>
        </div>
      </dl>

      {rezultat.baremLipsa ? (
        <p className="text-foreground text-corp">
          Lipsește baremul de diurnă pentru cel puțin o țară din traseu, la data respectivă — sumele
          nu pot fi calculate integral.
        </p>
      ) : rezultat.cursIncomplet ? (
        <p className="text-foreground text-corp">
          Zilele sunt calculate; suma în lei necesită cursul valutar (curs diurnă).
        </p>
      ) : null}
    </div>
  );
}
