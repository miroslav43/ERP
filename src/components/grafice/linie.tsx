// src/components/grafice/linie.tsx
import { scaleLinear, scalePoint } from "@visx/scale";
import { line as generatorTraseu } from "@visx/shape";
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

import { InvelisGrafic, type Punct, type PropsGrafic, culoareSerie } from "./comun";

/**
 * Graficul de linie. Pentru evoluție în timp cu axă citibilă — efectiv pe luni,
 * ore lucrate pe săptămâni, consum mediu pe vehicul.
 *
 * ── DE CE LINIA NU E OBLIGATĂ SĂ PORNEASCĂ DE LA ZERO ─────────────────────
 * Bara comunică prin lungime, deci tăiată de jos minte (vezi `bare.tsx`). Linia
 * comunică prin PANTĂ, iar panta nu se schimbă când muți originea. Un efectiv
 * care oscilează între 118 și 124 de oameni, desenat de la zero, e o dreaptă
 * plată care ascunde exact informația cerută. Domeniul se rotunjește cu
 * `nice: true` și axa **arată cifrele**, deci cititorul vede unde e originea.
 *
 * ── DE CE MARCAJELE SUNT HTML, NU `<circle>` ──────────────────────────────
 * `preserveAspectRatio="none"` întinde SVG-ul pe lățime ca graficul să umple
 * coloana. Sub scalare neuniformă un `<circle>` devine ELIPSĂ, iar o linie se
 * îngroașă pe orizontală. Traseele scapă cu `vectorEffect="non-scaling-stroke"`;
 * marcajele nu au echivalent, deci stau în HTML, poziționate procentual peste
 * un container `relative` — cerc perfect la orice lățime.
 */
export type Serie = Readonly<{
  nume: string;
  puncte: readonly Punct[];
}>;

export type PropsLinie = PropsGrafic &
  Readonly<{
    /** Toate seriile împart aceleași etichete, în aceeași ordine. */
    serii: readonly Serie[];
    inaltime?: number;
    /** Forțează originea în zero — pentru mărimi unde „zero" e o stare reală. */
    dePlaZero?: boolean;
    formateaza?: (v: number) => string;
  }>;

const LATIME_AXA = 40; // px pentru coloana de cifre din stânga

export function Linie({
  serii,
  inaltime = 200,
  dePlaZero = false,
  formateaza = (v) => String(v),
  titlu,
  unitate,
  className,
}: PropsLinie): ReactElement | null {
  const etichete = serii[0]?.puncte.map((p) => p.eticheta) ?? [];
  if (etichete.length < 2) return null;

  const valori = serii.flatMap((s) => s.puncte.map((p) => p.valoare));
  const minBrut = Math.min(...valori);
  const maxBrut = Math.max(...valori);

  const y = scaleLinear({
    domain: [dePlaZero ? 0 : minBrut, maxBrut],
    range: [inaltime, 0],
    nice: true,
  });
  // `.ticks(n)` întoarce APROXIMATIV n — d3 alege pași rotunzi, nu un număr fix.
  const trepte = y.ticks(4);

  // `padding: 0.5` nu e cosmetic: fără el primul punct cade pe marginea stângă
  // (0%) și ultimul pe dreapta (100%), în timp ce etichetele de dedesubt se
  // centrează în coloane de `1fr` — adică la 12,5% și 87,5% pentru patru puncte.
  // Verificat numeric: cu padding 0,5 cele două șiruri coincid exact.
  const x = scalePoint({ domain: etichete, range: [0, 100], padding: 0.5 });

  const traseu = (s: Serie): string | null =>
    generatorTraseu<Punct>()
      .x((p) => x(p.eticheta) ?? 0)
      .y((p) => y(p.valoare))(s.puncte);

  // Tabelul ascuns al învelișului poartă o singură serie; când sunt mai multe,
  // fiecare valoare își ia numele seriei în etichetă, ca să rămână citibilă.
  const puncteTabel: readonly Punct[] =
    serii.length === 1
      ? (serii[0]?.puncte ?? [])
      : serii.flatMap((s) =>
          s.puncte.map((p) => ({ ...p, eticheta: `${s.nume} · ${p.eticheta}` })),
        );

  return (
    <InvelisGrafic
      titlu={titlu}
      {...(unitate === undefined ? {} : { unitate })}
      puncte={puncteTabel}
      {...(className === undefined ? {} : { className })}
    >
      {serii.length > 1 ? (
        <ul className="text-nota mb-2 flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
          {serii.map((s, i) => (
            <li key={s.nume} className="text-muted-foreground flex items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: culoareSerie(i) }}
              />
              {s.nume}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        {/* Cifrele axei: HTML, nu `<text>` — vezi comentariul de sus. */}
        <div
          className="text-muted-foreground text-nota relative shrink-0 tabular-nums"
          style={{ width: LATIME_AXA, height: inaltime }}
          aria-hidden="true"
        >
          {trepte.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
              style={{ top: y(t) }}
            >
              {formateaza(t)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: inaltime }}>
            <svg
              aria-hidden="true"
              viewBox={`0 0 100 ${inaltime}`}
              preserveAspectRatio="none"
              className="block h-full w-full [print-color-adjust:exact]"
            >
              {trepte.map((t) => (
                <line
                  key={t}
                  x1={0}
                  x2={100}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  // Grila e o riglă, nu conținut: la 40% se citește ca fundal.
                  opacity={0.4}
                />
              ))}
              {serii.map((s, i) => {
                const d = traseu(s);
                return d === null ? null : (
                  <path
                    key={s.nume}
                    d={d}
                    fill="none"
                    stroke={culoareSerie(i)}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {/* Capătul fiecărei serii — cerc perfect fiindcă e HTML. */}
            {serii.map((s, i) => {
              const ultim = s.puncte.at(-1);
              return ultim === undefined ? null : (
                <span
                  key={s.nume}
                  aria-hidden="true"
                  className="border-surface absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: `${x(ultim.eticheta) ?? 0}%`,
                    top: y(ultim.valoare),
                    background: culoareSerie(i),
                  }}
                />
              );
            })}
          </div>

          <div
            className={cn("text-muted-foreground text-nota mt-1 grid")}
            style={{ gridTemplateColumns: `repeat(${etichete.length}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {etichete.map((e) => (
              <span key={e} className="truncate text-center">
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>
    </InvelisGrafic>
  );
}
