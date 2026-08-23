// src/components/grafice/sparkline.tsx
import { scaleLinear } from "@visx/scale";
import { area, line } from "@visx/shape";
import type { ReactElement } from "react";

import { InvelisGrafic, type Punct, type PropsGrafic } from "./comun";

/**
 * Seria scurtă de lângă o cifră. Nu are axe, nu are grilă, nu are legendă: e
 * un adjectiv pentru numărul de deasupra, nu un grafic de sine stătător.
 *
 * ── DE CE CAPĂTUL E MARCAT ────────────────────────────────────────────────
 * Fără punctul de la capăt, ochiul nu știe în ce direcție curge timpul. Cu el,
 * „acum" e evident dintr-o privire — și e singura informație pe care o
 * sparkline chiar o poartă.
 *
 * ── DE CE NU SE DESENEAZĂ O SERIE PLATĂ ───────────────────────────────────
 * Când toate valorile sunt egale, scala ar avea domeniu zero și linia ar cădea
 * pe marginea de sus sau de jos, sugerând un maxim sau un minim care nu există.
 * Se desenează la mijloc, drept — ceea ce e adevărat.
 */
export type PropsSparkline = PropsGrafic &
  Readonly<{
    puncte: readonly Punct[];
    latime?: number;
    inaltime?: number;
    /** Verdictul, dacă seria îl are: coboară e bine la fluctuație, rău la efectiv. */
    ton?: "neutru" | "bun" | "rau";
  }>;

const CULOARE = {
  neutru: "var(--color-primary)",
  bun: "var(--color-success)",
  rau: "var(--color-danger)",
} as const;

export function Sparkline({
  puncte,
  latime = 132,
  inaltime = 30,
  ton = "neutru",
  titlu,
  unitate,
  antetCategorie = "Perioadă",
  className,
}: PropsSparkline): ReactElement | null {
  if (puncte.length < 2) return null;

  const valori = puncte.map((p) => p.valoare);
  const min = Math.min(...valori);
  const max = Math.max(...valori);
  const plat = min === max;

  const x = scaleLinear({ domain: [0, puncte.length - 1], range: [1.5, latime - 1.5] });
  const y = plat
    ? () => inaltime / 2
    : scaleLinear({ domain: [min, max], range: [inaltime - 3, 3] });

  const date = puncte.map((p, i) => ({ i, v: p.valoare }));
  const traseu = line<{ i: number; v: number }>()
    .x((d) => x(d.i))
    .y((d) => y(d.v))(date);
  const umplere = area<{ i: number; v: number }>()
    .x((d) => x(d.i))
    .y0(inaltime)
    .y1((d) => y(d.v))(date);

  const ultimul = date.at(-1);
  const culoare = CULOARE[ton];

  return (
    <InvelisGrafic
      titlu={titlu}
      antetCategorie={antetCategorie}
      {...(unitate === undefined ? {} : { unitate })}
      puncte={puncte}
      {...(className === undefined ? {} : { className })}
    >
      <svg
        aria-hidden="true"
        width={latime}
        height={inaltime}
        viewBox={`0 0 ${latime} ${inaltime}`}
        // `print-color-adjust` — altfel browserul scoate umplerile la tipărire
        // „ca să economisească cerneală", iar graficul ajunge o linie singură.
        className="block [print-color-adjust:exact]"
      >
        {umplere === null ? null : <path d={umplere} fill={culoare} fillOpacity={0.07} />}
        {traseu === null ? null : (
          <path
            d={traseu}
            fill="none"
            stroke={culoare}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {ultimul === undefined ? null : (
          <circle cx={x(ultimul.i)} cy={y(ultimul.v)} r={2.4} fill={culoare} />
        )}
      </svg>
    </InvelisGrafic>
  );
}
