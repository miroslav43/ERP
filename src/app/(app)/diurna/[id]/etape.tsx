// src/app/(app)/diurna/[id]/etape.tsx
// Traseul real al deplasării (`business_trip_legs`) și calculul diurnei
// pornind de la el — motorul PUR din `@/domain/per-diem`, cu datele reale ale
// deplasării, nu previzualizarea cu o singură țară de la creare.

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
        <p className="text-sm text-muted-foreground">
          Deplasarea nu are încă nicio etapă înregistrată — calculul de mai jos folosește o
          singură țară, cea a deplasării.
        </p>
      ) : (
        <ol className="space-y-2 text-sm">
          {etape.map((e) => (
            <li key={e.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {numeTara(tari, e.from_country_id)} → {numeTara(tari, e.to_country_id)}
                </span>
                <span className="text-xs text-muted-foreground">Etapa {e.ordine}</span>
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
        <p className="text-sm text-foreground">
          Nu există o politică de diurnă valabilă la data plecării — calculul nu poate fi afișat.
        </p>
      ) : (
        <CalculDiurna deplasare={deplasare} etape={etape} politica={politica} baremuri={baremuri} tari={tari} />
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
    etape.map((e) => ({ ordine: e.ordine, fromCountryId: e.from_country_id, toCountryId: e.to_country_id, sosireLa: e.sosire_la })),
    politica,
    baremuri,
  );

  if (ferestre.length === 0) {
    return (
      <p className="text-sm text-foreground">
        <strong>0 zile de diurnă</strong> — deplasarea a durat {formatAmount(durataOre)} ore, sub
        pragul de {formatAmount(politica.prag_ore_minim)} ore din politică.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Ferestrele de 24 de ore ale diurnei și fracțiunea acordată fiecăreia.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">#</th>
              <th scope="col" className="px-3 py-2 font-medium">Interval</th>
              <th scope="col" className="px-3 py-2 font-medium">Țară</th>
              <th scope="col" className="px-3 py-2 font-medium">Fracțiune</th>
              <th scope="col" className="px-3 py-2 font-medium">Motiv</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ferestre.map((f) => (
              <tr key={f.numarFereastra}>
                <td className="px-3 py-2 tabular-nums">{f.numarFereastra}</td>
                <td className="px-3 py-2">
                  {formatDateTime(f.deLa)} – {formatDateTime(f.panaLa)}
                </td>
                <td className="px-3 py-2">{numeTara(tari, f.taraId)}</td>
                <td className="px-3 py-2 tabular-nums">{formatAmount(f.fractiune)}</td>
                <td className="px-3 py-2 text-muted-foreground">{f.motiv}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">Zile total</dt>
          <dd className="mt-0.5 text-sm font-medium">{formatAmount(rezultat.zileTotal)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">Valoare</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {rezultat.valoareLei === null ? "necunoscută" : formatLei(rezultat.valoareLei)}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">Neimpozabil</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {rezultat.parteNeimpozabilaLei === null ? "—" : formatLei(rezultat.parteNeimpozabilaLei)}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">Impozabil</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {rezultat.parteImpozabilaLei === null ? "—" : formatLei(rezultat.parteImpozabilaLei)}
          </dd>
        </div>
      </dl>

      {rezultat.baremLipsa ? (
        <p className="text-sm text-foreground">
          Lipsește baremul de diurnă pentru cel puțin o țară din traseu, la data respectivă —
          sumele nu pot fi calculate integral.
        </p>
      ) : rezultat.cursIncomplet ? (
        <p className="text-sm text-foreground">
          Zilele sunt calculate; suma în lei necesită cursul valutar (curs diurnă).
        </p>
      ) : null}
    </div>
  );
}
