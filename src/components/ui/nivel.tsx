// src/components/ui/nivel.tsx
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Bara de umplere: cât s-a consumat dintr-un reper. Zile luate din zile
 * cuvenite, pași bifați dintr-un checklist de înrolare, sumă recuperată dintr-o
 * datorie, locuri ocupate dintr-un plafon.
 *
 * În tot depozitul existau DOUĂ bare: un singur `role="progressbar"` scris de
 * mână (`salarizare/popriri/page.tsx:118`) și un singur `<progress>` nativ
 * (`onboarding/page.tsx:150`), colorat `accent-blue-700` — o nuanță din paleta
 * implicită Tailwind, care nu e niciunul dintre tokenii platformei. Restul
 * locurilor care ar fi avut nevoie de bară scriu doar text: „3 din 8 pași”,
 * „12 din 25 locuri ocupate”, „folosite 14 · rămase 7”.
 *
 * ── DE CE DEPĂȘIREA NU E O BARĂ PLINĂ ─────────────────────────────────────
 * Bara existentă calculează `Math.min(100, Math.round(recuperat / total * 100))`.
 * Consecința, măsurabilă pe același ecran: 99,6 %, 100 % și 103 % desenează
 * EXACT același dreptunghi. Clamparea nu e o rotunjire, e o pierdere de
 * informație — același fel de refuz tăcut ca UPDATE-ul respins de `USING`, care
 * întoarce zero rânduri fără eroare: nimic nu semnalează că s-a întâmplat ceva.
 *
 * Aici scara barei e `max(valoare, din)`, nu `din`. Cât timp nu se depășește,
 * capătul barei ESTE reperul și nu se schimbă nimic față de o bară obișnuită.
 * Când se depășește, reperul se mută înăuntru și rămâne vizibil ca o crestătură
 * în culoarea fundalului: se vede unde era limita ȘI cât s-a trecut peste ea,
 * proporțional. 23 de zile din 21 se citesc ca „bară plină, cu limita la 91 %
 * din lungime” — niciodată ca 21 din 21.
 *
 * Crestătura e semnalul care NU e culoare. 2px de crem peste umplere dau
 * 15,41:1 pe navy, 6,11:1 pe roșu, 4,91:1 pe verde și 3,40:1 pe chihlimbar —
 * toate peste pragul de 3:1 al WCAG 1.4.11, deci se văd și tipărite alb-negru,
 * și pentru cine nu distinge nicio culoare. Hașura de peste porțiunea în exces
 * e REDUNDANTĂ, exact ca bulina din `badge.tsx`: repetă ce spune crestătura.
 *
 * ── DE CE PORȚIUNEA ÎN EXCES PĂSTREAZĂ TONUL ──────────────────────────────
 * Depășirea nu se vopsește singură în roșu. La zile de concediu LUATE, mult nu
 * e rău — e chiar scopul concediului; la un plafon de locuri sau la un plafon
 * neimpozabil de diurnă, e o factură. Care dintre ele e știe doar apelantul,
 * deci `ton` vine ca prop și primitiva nu-l calculează niciodată din valori.
 *
 * ── DE CE ZERO RĂMÂNE VIZIBIL ─────────────────────────────────────────────
 * Pista din popriri e `bg-background` într-un card `bg-surface`: 1,09:1,
 * calculat, nu estimat. La 0 % recuperat nu se vede că EXISTĂ o bară — ecranul
 * arată ca și cum nu s-ar fi desenat nimic, iar „zero recuperat” devine
 * indistinct de „nu s-a măsurat”. Aici pista are contur `border-muted-foreground`:
 * 5,55:1 pe fundal și 5,08:1 pe card. E același argument ca la bulina „ciornă”
 * din `badge.tsx` — conturul spune „există un loc, nu s-a umplut încă”.
 *
 * Umplerea la zero rămâne de fix 0 %. O fâșie minimă „ca să se vadă ceva” ar fi
 * o minciună de 2px într-un produs în care oamenii compară bare pe verticală.
 *
 * ── DE CE `text` E OBLIGATORIU ────────────────────────────────────────────
 * Când `aria-valuetext` e prezent, cititorul de ecran anunță TEXTUL în locul
 * procentului. Fără el se aude „14” și nu se știe din ce. Textul vine ca prop,
 * ca în toate primitivele: aici nu se poate ști dacă unitatea e ziua, pasul,
 * leul sau locul.
 *
 * Fișierul n-are `"use client"`: nicio stare, niciun efect, niciun handler.
 * Lățimile sunt `style` inline fiindcă sunt valori de DATE, nu de temă — nicio
 * clasă Tailwind nu poate exprima 63,49 %.
 */
export type TonNivel = "neutru" | "bun" | "atentie" | "rau";

const UMPLERE: Readonly<Record<TonNivel, string>> = {
  neutru: "bg-primary",
  bun: "bg-success",
  atentie: "bg-warning",
  rau: "bg-danger",
};

export type MarimeNivel = "subtire" | "implicit";

/**
 * 8px și 12px, din care conturul mănâncă 2px. Sub 6px de umplere o bară
 * încetează să mai fie comparabilă cu vecina ei dintr-o listă — devine o linie.
 */
const INALTIME: Readonly<Record<MarimeNivel, string>> = {
  subtire: "h-2",
  implicit: "h-3",
};

/**
 * `NaN`, `Infinity` și negativele nu sunt „aproape zero”. Într-un `style` ajung
 * ca `width: NaN%`, pe care browserul îl ignoră TĂCUT — iar elementul își ia
 * lățimea din fluxul normal, adică bara pare plină. Se opresc aici, o dată.
 */
function marimeSigura(numar: number): number {
  return Number.isFinite(numar) && numar > 0 ? numar : 0;
}

export type PropsNivel = Readonly<{
  /** Cât s-a consumat. Are voie să depășească `din` — asta e ideea. */
  valoare: number;
  /** Reperul: zile cuvenite, pași totali, plafon, datorie inițială. */
  din: number;
  /** Numele accesibil al barei — „Zile de concediu folosite”. */
  eticheta: string;
  /** Ce se AUDE în locul procentului, în litere: „14 zile din 21 cuvenite”. */
  text: string;
  ton?: TonNivel;
  marime?: MarimeNivel;
  className?: string;
}>;

export function Nivel({
  valoare,
  din,
  eticheta,
  text,
  ton = "neutru",
  marime = "implicit",
  className,
}: PropsNivel): ReactElement {
  const consumat = marimeSigura(valoare);
  const reper = marimeSigura(din);
  const scara = Math.max(consumat, reper);
  const inReper = Math.min(consumat, reper);
  const depaseste = consumat > reper;

  const procent = (parte: number): string =>
    `${(scara === 0 ? 0 : (parte / scara) * 100).toFixed(2)}%`;

  return (
    <div
      role="progressbar"
      aria-label={eticheta}
      aria-valuemin={0}
      /*
       * Maximul e reperul cât timp nu se depășește. Peste el, `aria-valuenow`
       * ar ieși din interval, iar o bară cu `now > max` e pur și simplu
       * nevalidă — cititoarele de ecran o raportează atunci ca 100 %, adică
       * exact minciuna pe care componenta o repară vizual. De aceea maximul
       * urcă odată cu valoarea, iar adevărul îl duce `aria-valuetext`.
       */
      aria-valuemax={scara}
      aria-valuenow={consumat}
      aria-valuetext={text}
      data-depasire={depaseste ? "da" : undefined}
      className={cn(
        "border-muted-foreground bg-background relative w-full overflow-hidden rounded-full border",
        INALTIME[marime],
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-parte="umplut"
        className={cn("absolute inset-y-0 left-0", UMPLERE[ton])}
        style={{ width: procent(inReper) }}
      />
      {depaseste ? (
        <span
          aria-hidden="true"
          data-parte="depasire"
          /*
           * Crestătura e `border-l-2 border-background` pe porțiunea în exces,
           * nu un al treilea element: așa nu poate exista o limită desenată
           * fără depășire, nici o depășire fără limită desenată. La o depășire
           * sub 2px porțiunea se reduce la crestătura însăși — corect, fiindcă
           * semnalul care contează e „s-a trecut linia”, nu cu cât.
           */
          className={cn("hasura border-background absolute inset-y-0 border-l-2", UMPLERE[ton])}
          style={{ left: procent(inReper), width: procent(consumat - inReper) }}
        />
      ) : null}
    </div>
  );
}
