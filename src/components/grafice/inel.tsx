// src/components/grafice/inel.tsx
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

import { InvelisGrafic, type PropsGrafic, culoareSerie } from "./comun";

/**
 * Inelul: împărțirea unui întreg pe categorii. Salariul brut pe contribuții,
 * flota pe stări de document, bugetul pe capitole.
 *
 * ── DE CE CULOAREA E OPȚIONALĂ, DEȘI ÎNAINTE ERA OBLIGATORIE ──────────────
 * Predecesorul (`payroll/taxe-pie-chart.tsx`) cerea un `culoareVar: string` pe
 * fiecare felie și îl punea direct în `style={{ stroke }}`. Cele două locuri
 * care îl chemau foloseau convenții DIFERITE:
 *
 *   fluturas.tsx  →  "var(--color-success)"   ✔ valoare CSS
 *   viniete.tsx   →  "--color-primary"        ✗ NUME de proprietate
 *
 * `stroke: --color-primary` e o declarație invalidă: CSSOM o respinge, `stroke`
 * rămâne nesetat, iar implicitul e `none`. Inelul de pe pagina publică de
 * marketing se desena, așadar, INVIZIBIL — cerc gol, pastile de legendă
 * transparente, fără nicio eroare nicăieri.
 *
 * Un tip `string` nu poate deosebi cele două. Aici culoarea e OPȚIONALĂ și cade
 * pe paleta categorică din `comun.tsx`, deci cazul obișnuit nu mai are cum să
 * fie greșit; cine chiar vrea altă culoare o dă ca valoare CSS completă, iar
 * numele proprietății spune asta.
 *
 * ── DE CE `strokeDasharray` ȘI NU `<path>` DE ARC ─────────────────────────
 * Un inel e un cerc cu contur gros, tăiat. Un singur `<circle>` per felie, cu
 * lungimea arcului în `strokeDasharray` și poziția în `strokeDashoffset`, e mai
 * scurt și mai exact decât aritmetica de arce, și nu are cazul special al
 * feliei de 100 % (unde `A`-ul din SVG degenerează, fiindcă punctul de start și
 * cel de final coincid).
 */
export type Felie = Readonly<{
  eticheta: string;
  valoare: number;
  /** Valoare CSS COMPLETĂ, de obicei `var(--color-…)`. Implicit: paleta seriilor. */
  culoare?: string;
}>;

export type PropsInel = PropsGrafic &
  Readonly<{
    felii: readonly Felie[];
    /** Cum se scriu cifrele — în centru și în legendă. Fără ea, se scriu brut. */
    formateaza?: (v: number) => string;
    /** Rândul mic de sub total, în mijlocul inelului. Text, deci vine ca prop. */
    subtitluCentral?: string;
    marime?: number;
  }>;

type Arc = Felie & Readonly<{ culoare: string; procent: number; lungime: number; decalaj: number }>;

const RAZA = 70;
const GROSIME = 26;
const CIRCUMFERINTA = 2 * Math.PI * RAZA;

export function Inel({
  felii,
  formateaza = (v) => String(v),
  subtitluCentral,
  marime = 200,
  titlu,
  unitate,
  antetCategorie = "Categorie",
  className,
}: PropsInel): ReactElement | null {
  const total = felii.reduce((s, f) => s + f.valoare, 0);
  // Un inel dintr-un întreg de zero n-are ce împărți. Starea goală e treaba
  // apelantului: el știe dacă „zero" înseamnă „încă nimic" sau „nu se aplică".
  if (total <= 0) return null;

  // Decalajul fiecărei felii e suma lungimilor dinaintea ei — o sumă prefix.
  // Se acumulează prin `reduce`, nu printr-o variabilă mutată din interiorul
  // unui `map`: React Compiler respinge reatribuirea într-un callback de
  // randare (`react-hooks/immutability`), și are dreptate — closure-ul ar putea
  // supraviețui randării.
  const arce = felii
    .map((f, i) => ({ ...f, culoare: f.culoare ?? culoareSerie(i) }))
    .filter((f) => f.valoare > 0)
    .reduce<readonly Arc[]>((asezate, f) => {
      const procent = f.valoare / total;
      const decalaj = -asezate.reduce((s, a) => s + a.lungime, 0);
      return [...asezate, { ...f, procent, lungime: procent * CIRCUMFERINTA, decalaj }];
    }, []);

  return (
    <InvelisGrafic
      titlu={titlu}
      antetCategorie={antetCategorie}
      {...(unitate === undefined ? {} : { unitate })}
      puncte={felii.map((f) => ({ eticheta: f.eticheta, valoare: f.valoare }))}
      {...(className === undefined ? {} : { className })}
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <svg
          aria-hidden="true"
          viewBox="0 0 200 200"
          width={marime}
          height={marime}
          className="block shrink-0 [print-color-adjust:exact]"
        >
          {/* Rotit ca prima felie să înceapă la ora 12, unde o caută ochiul. */}
          <g transform="rotate(-90 100 100)">
            {arce.map((arc) => (
              <circle
                key={arc.eticheta}
                cx={100}
                cy={100}
                r={RAZA}
                fill="none"
                strokeWidth={GROSIME}
                strokeDasharray={`${arc.lungime} ${CIRCUMFERINTA - arc.lungime}`}
                strokeDashoffset={arc.decalaj}
                style={{ stroke: arc.culoare }}
              />
            ))}
            {/* Conturul de separare, desenat PESTE felii: două serii alăturate
                nu pot atinge 3:1 între ele (vezi `globals.css`), deci granița
                se face structural, nu cromatic. Merge la orice pereche. */}
            {arce.length < 2
              ? null
              : arce.map((arc) => (
                  <circle
                    key={`taietura-${arc.eticheta}`}
                    cx={100}
                    cy={100}
                    r={RAZA}
                    fill="none"
                    strokeWidth={GROSIME}
                    stroke="var(--color-background)"
                    strokeDasharray={`2 ${CIRCUMFERINTA - 2}`}
                    strokeDashoffset={arc.decalaj}
                  />
                ))}
          </g>
          <text
            x={100}
            y={96}
            textAnchor="middle"
            className="fill-foreground text-[15px] font-medium"
          >
            {formateaza(total)}
          </text>
          {subtitluCentral === undefined ? null : (
            <text x={100} y={114} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {subtitluCentral}
            </text>
          )}
        </svg>

        {/* Legenda arată TOATE feliile, inclusiv cele de zero: absența unei linii
            s-ar citi ca „nu există categoria", nu ca „e zero". */}
        <ul className="text-corp w-full space-y-1.5" aria-hidden="true">
          {felii.map((f, i) => (
            <li key={f.eticheta} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full [print-color-adjust:exact]"
                style={{ background: f.culoare ?? culoareSerie(i) }}
              />
              <span className="min-w-0 flex-1 truncate">{f.eticheta}</span>
              <span className={cn("font-medium tabular-nums")}>{formateaza(f.valoare)}</span>
              <span className="text-muted-foreground text-nota tabular-nums">
                {((f.valoare / total) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </InvelisGrafic>
  );
}
