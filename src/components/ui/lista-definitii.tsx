// src/components/ui/lista-definitii.tsx
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Lista de definiții a ecranelor de detaliu: perechea etichetă–valoare, de la
 * fișa angajatului până la fișa vehiculului.
 *
 * ── CE E RUPT AZI ─────────────────────────────────────────────────────────
 * În `(app)`, `(platform)`, `(portal)` și `src/components/` sunt 62 de `<dt>`
 * și doar 33 de `<dl>`. Diferența nu e o rotunjire: în ȘAPTE fișiere perechile
 * `<dt>`/`<dd>` n-au NICIUN `<dl>` deasupra lor —
 * `flota/[id]`, `flota/foi/[id]`, `ssm/stingatoare/[id]`, `ssm/accidente/[id]`,
 * `salarizare/[id]`, `super-admin/_components/cifra.tsx` și
 * `components/payroll/fluturas.tsx`. Un `<dt>` fără `<dl>` nu e „aproape
 * corect”: relația etichetă–valoare pur și simplu NU se formează, iar cititorul
 * de ecran citește două texte alăturate — la fel ca înainte, când erau div-uri.
 *
 * Marcajul e reinventat local de 13 ori, ca funcție privată `Camp` sau `Rand`,
 * în tot atâtea fișiere, cu patru tratamente diferite ale etichetei. Numai fișa
 * angajatului o cheamă de 26 de ori.
 *
 * ── O VALOARE LIPSĂ NU E UN GOL ───────────────────────────────────────────
 * Regula fișierului. Un `<dd>` gol nu se aude ca „lipsește”; se aude ca „am
 * completat, e nimic” — și e imposibil de distins de un câmp completat cu spații.
 *
 * În depozit sunt 75 de `?? "—"` și doar 7 locuri care scriu un CUVÂNT. Linia
 * de despărțire nu repară nimic: NVDA și JAWS, la nivelul implicit de
 * punctuație, nu o anunță deloc, deci `<dd>—</dd>` sună exact ca `<dd></dd>`.
 * Iar pentru un om care vede, „—” la „Data încetării” poate să însemne la fel
 * de bine „nu s-a încheiat” sau „nu s-a completat” — două lucruri opuse.
 *
 * De aceea aici lipsa e un marcaj propriu, cu text venit ca PROP. Primitiva
 * n-are voie să scrie „Necompletat”: marketingul e bilingv și importă
 * primitivele, iar cuvântul corect diferă și în română de la câmp la câmp
 * („Necompletat” pentru CNP, „Nu s-a încheiat” pentru data de sfârșit).
 *
 * Marcajul rămâne la contrast PLIN. Fișa angajatului îl scrie azi
 * `text-muted-foreground/70 italic`, ceea ce dă 2,99:1 pe crem — sub AA,
 * calculat, nu estimat. Ce distinge lipsa de o valoare e cursivul și cuvântul,
 * nu diluarea; același motiv pentru care `disabled:opacity-*` e interzis în tot
 * proiectul.
 *
 * ── DE CE `valoare` NU ACCEPTĂ UN BOOLEAN ─────────────────────────────────
 * `Exclude<ReactNode, boolean>`, deci `valoare={x && <Ceva/>}` NU compilează.
 * React randează `false` ca nimic, adică fabrică exact `<dd>`-ul gol pe care
 * fișierul ăsta îl repară — tăcut, fără să treacă prin ramura de „necompletat”.
 * Scris `x ? <Ceva/> : null`, golul e explicit și ajunge unde trebuie.
 *
 * Zero și șirul „0” NU sunt goluri. `valoare || "—"` e capcana clasică: un sold
 * de 0 zile rămase sau 0 lei reținuți e o informație, nu o absență.
 *
 * Fișierul n-are `"use client"`: nicio stare, niciun handler.
 */
export type ValoareDefinitie = Exclude<ReactNode, boolean>;

export type Definitie = Readonly<{
  eticheta: string;
  /** `null`, `undefined` și șirul din spații înseamnă NECOMPLETAT. `0` nu. */
  valoare: ValoareDefinitie;
  /** CNP, IBAN, VIN, marcă, serie de inventar: cifre monospațiate și tabulare. */
  identificator?: boolean;
  /** Ocupă tot rândul — adrese, observații, motivarea unui refuz. */
  lat?: boolean;
}>;

export type NumarColoane = 1 | 2 | 3 | 4;

/**
 * Șiruri LITERALE, nu `grid-cols-${n}`: Tailwind v4 scanează sursa ca text, iar
 * o clasă compusă la execuție nu se generează niciodată — pagina ar rămâne pe o
 * coloană, fără nicio eroare.
 *
 * Pragul e `md`, nu `sm`: pe fișa angajatului valorile sunt nume complete, IBAN
 * și adrese, iar la 640px două coloane lasă ~18 caractere de coloană.
 */
const COLOANE: Readonly<Record<NumarColoane, string>> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

export type PropsListaDefinitii = Readonly<{
  definitii: readonly Definitie[];
  /** Cuvântul pentru valoarea lipsă — „Necompletat”, „Nu s-a comunicat”. */
  textNecompletat: string;
  coloane?: NumarColoane;
  className?: string;
}>;

/** Spațiile albe contează ca gol: în bază, un câmp „curățat” rămâne des `" "`. */
function esteGol(valoare: ValoareDefinitie): boolean {
  if (valoare === null || valoare === undefined) return true;
  return typeof valoare === "string" && valoare.trim() === "";
}

export function ListaDefinitii({
  definitii,
  textNecompletat,
  coloane = 2,
  className,
}: PropsListaDefinitii): ReactElement {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", COLOANE[coloane], className)}>
      {definitii.map((definitie, indice) => {
        const gol = esteGol(definitie.valoare);
        return (
          <div
            key={`${String(indice)}·${definitie.eticheta}`}
            /*
             * `min-w-0` nu e decor. O pistă de grilă își ia lățimea minimă din
             * cel mai lung cuvânt NECURMAT al copilului, iar un IBAN de 24 de
             * caractere e un singur cuvânt: fără el, coloana se lățește, restul
             * se strâng și pagina capătă derulare orizontală.
             */
            className={cn("min-w-0", definitie.lat === true ? "col-span-full" : "")}
          >
            <dt className="text-muted-foreground text-eticheta tracking-wide uppercase">
              {definitie.eticheta}
            </dt>
            <dd
              className={cn(
                "text-corp text-foreground mt-0.5",
                /*
                 * `break-all` doar pentru identificatori: acolo ruperea la
                 * orice caracter e corectă, fiindcă nu există cuvinte. Pe text
                 * obișnuit ar tăia numele oamenilor la mijloc, deci `break-words`.
                 */
                definitie.identificator === true
                  ? "font-mono break-all tabular-nums"
                  : "break-words",
                gol ? "text-muted-foreground italic" : "",
              )}
            >
              {gol ? <span data-necompletat="da">{textNecompletat}</span> : definitie.valoare}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
