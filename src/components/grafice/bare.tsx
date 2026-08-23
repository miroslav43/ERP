// src/components/grafice/bare.tsx
import { scaleBand, scaleLinear } from "@visx/scale";
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

import { InvelisGrafic, type Punct, type PropsGrafic } from "./comun";

/**
 * Graficul cu bare. Pentru mărimi comparate între perioade sau categorii —
 * cost salarial pe lună, zile de concediu pe departament.
 *
 * ── DE CE PORNEȘTE DE LA ZERO, ÎNTOTDEAUNA ────────────────────────────────
 * O bară comunică prin LUNGIME. Tăiată de jos, raportul dintre două bare devine
 * o minciună vizuală: o creștere de 3% arată ca o dublare. Regula nu are
 * excepție aici; dacă diferențele sunt prea mici ca să se vadă de la zero,
 * întrebarea era pentru o linie, nu pentru bare.
 *
 * ── DE CE ETICHETELE SE ROTESC ÎN LOC SĂ SE RĂREASCĂ ──────────────────────
 * O axă din care lipsesc etichete îl obligă pe cititor să numere. Pe douăsprezece
 * luni încap drept; peste, se înclină. Nu se sar niciodată.
 */
export type PropsBare = PropsGrafic &
  Readonly<{
    puncte: readonly Punct[];
    inaltime?: number;
    /** Formatare pentru valoarea de deasupra barei. Fără ea, cifra nu apare. */
    formateaza?: (v: number) => string;
    /** Marchează o bară anume — luna curentă, perioada selectată. */
    evidentiaza?: string;
  }>;

export function Bare({
  puncte,
  inaltime = 180,
  formateaza,
  evidentiaza,
  titlu,
  unitate,
  antetCategorie = "Perioadă",
  className,
}: PropsBare): ReactElement | null {
  if (puncte.length === 0) return null;

  const MARGINE_JOS = 26;
  const MARGINE_SUS = formateaza === undefined ? 6 : 18;
  const latime = 100; // procente: viewBox e relativ, deci graficul se întinde
  const inaltimeGrafic = inaltime - MARGINE_JOS - MARGINE_SUS;

  const max = Math.max(...puncte.map((p) => p.valoare), 0);
  const x = scaleBand({
    domain: puncte.map((p) => p.eticheta),
    range: [0, latime],
    padding: 0.25,
  });
  // Domeniul pornește MEREU de la zero — vezi comentariul de sus.
  const y = scaleLinear({ domain: [0, max === 0 ? 1 : max], range: [inaltimeGrafic, 0] });
  const inclinat = puncte.length > 12;

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
        viewBox={`0 0 ${latime} ${inaltime}`}
        preserveAspectRatio="none"
        className="block h-auto w-full [print-color-adjust:exact]"
        style={{ height: inaltime }}
      >
        {/* Linia de zero e singura riglă: o grilă completă ar concura cu barele
            pentru atenție, iar valorile exacte sunt oricum deasupra lor. */}
        <line
          x1={0}
          x2={latime}
          y1={MARGINE_SUS + inaltimeGrafic}
          y2={MARGINE_SUS + inaltimeGrafic}
          stroke="var(--color-border)"
          strokeWidth={0.4}
          vectorEffect="non-scaling-stroke"
        />
        {puncte.map((p) => {
          const bx = x(p.eticheta) ?? 0;
          const bw = x.bandwidth();
          const bh = inaltimeGrafic - y(p.valoare);
          const activ = p.eticheta === evidentiaza;
          return (
            <rect
              key={p.eticheta}
              x={bx}
              y={MARGINE_SUS + y(p.valoare)}
              width={bw}
              height={Math.max(bh, p.valoare > 0 ? 0.8 : 0)}
              rx={0.6}
              // Bara evidențiată se distinge prin INTENSITATE, nu prin altă
              // culoare: o a doua culoare ar sugera o a doua serie.
              fill="var(--color-primary)"
              fillOpacity={activ ? 1 : 0.55}
            />
          );
        })}
      </svg>

      {/* Etichetele stau în HTML, nu în SVG: `preserveAspectRatio="none"` întinde
          graficul pe lățime, iar un `<text>` dinăuntru s-ar fi întins cu el. */}
      <div
        className={cn("text-muted-foreground text-nota mt-1 grid", inclinat ? "gap-0" : "gap-0.5")}
        style={{ gridTemplateColumns: `repeat(${puncte.length}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {puncte.map((p) => (
          <span key={p.eticheta} className="flex flex-col items-center gap-0.5 overflow-hidden">
            {formateaza === undefined ? null : (
              <span className="text-foreground font-mono font-medium tabular-nums">
                {formateaza(p.valoare)}
              </span>
            )}
            <span className={cn("truncate", inclinat ? "-rotate-45 text-[0.6rem]" : "")}>
              {p.eticheta}
            </span>
          </span>
        ))}
      </div>
    </InvelisGrafic>
  );
}
