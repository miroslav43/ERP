// src/components/payroll/taxe-pie-chart.tsx
// Server Component pur — fără interactivitate JS, tooltip nativ prin <title>.
// Culorile vin ca `var(--color-*)`, niciodată hex, ca personalizarea de temă
// per organizație să nu fie ignorată.

import { formatLei } from "@/lib/format/money";

export interface FelieTaxe {
  readonly eticheta: string;
  readonly valoare: number;
  readonly culoareVar: string;
}

interface Proprietati {
  readonly felii: readonly FelieTaxe[];
  readonly titluCentral?: string;
}

const RAZA = 70;
const GROSIME = 26;
const CIRCUMFERINTA = 2 * Math.PI * RAZA;

export function TaxePieChart({ felii, titluCentral = "din brut" }: Proprietati) {
  const total = felii.reduce((s, f) => s + f.valoare, 0);
  if (total <= 0) return null;

  const { arce } = felii
    .filter((f) => f.valoare > 0)
    .reduce<{
      readonly acumulat: number;
      readonly arce: readonly (FelieTaxe & {
        readonly procent: number;
        readonly lungimeArc: number;
        readonly decalaj: number;
      })[];
    }>(
      (stare, f) => {
        const procent = f.valoare / total;
        const lungimeArc = procent * CIRCUMFERINTA;
        const decalaj = -stare.acumulat * CIRCUMFERINTA;
        return {
          acumulat: stare.acumulat + procent,
          arce: [...stare.arce, { ...f, procent, lungimeArc, decalaj }],
        };
      },
      { acumulat: 0, arce: [] },
    );

  return (
    <figure className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg
        viewBox="0 0 200 200"
        width={200}
        height={200}
        role="img"
        aria-label={felii.map((f) => `${f.eticheta}: ${formatLei(f.valoare)}`).join(", ")}
      >
        <g transform="rotate(-90 100 100)">
          {arce.map((arc) => (
            <circle
              key={arc.eticheta}
              cx={100}
              cy={100}
              r={RAZA}
              fill="none"
              strokeWidth={GROSIME}
              strokeDasharray={`${arc.lungimeArc} ${CIRCUMFERINTA - arc.lungimeArc}`}
              strokeDashoffset={arc.decalaj}
              style={{ stroke: arc.culoareVar }}
            >
              <title>{`${arc.eticheta}: ${formatLei(arc.valoare)} (${(arc.procent * 100).toFixed(1)}%)`}</title>
            </circle>
          ))}
        </g>
        <text
          x={100}
          y={96}
          textAnchor="middle"
          className="fill-foreground text-[15px] font-medium"
        >
          {formatLei(total)}
        </text>
        <text x={100} y={114} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {titluCentral}
        </text>
      </svg>
      <ul className="text-corp space-y-1.5">
        {felii.map((f) => (
          <li key={f.eticheta} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              style={{ backgroundColor: f.culoareVar }}
              className="size-2.5 shrink-0 rounded-full"
            />
            <span className="flex-1">{f.eticheta}</span>
            <span className="font-medium tabular-nums">{formatLei(f.valoare)}</span>
            <span className="text-muted-foreground text-nota">
              ({total > 0 ? ((f.valoare / total) * 100).toFixed(1) : "0"}%)
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
