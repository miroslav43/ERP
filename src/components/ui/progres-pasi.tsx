// src/components/ui/progres-pasi.tsx
import type { ReactElement } from "react";

/**
 * Indicatorul de pași al unui asistent.
 *
 * Corpul e cel scris pentru înrolarea firmei, mutat aici fiindcă al doilea
 * asistent (materialul de curs) avea nevoie de aceeași bandă cu alte etichete,
 * iar `ProgresAsistent` le avea scrise în fișier. `ProgresAsistent` rămâne —
 * își pasează propriile etichete — deci cei trei consumatori de acolo nu se
 * ating.
 *
 * Fără `"use client"`: n-are stare proprie, doar desenează. O primitivă
 * marcată client fără motiv trage granița server→client peste tot unde e
 * folosită.
 */
export type PropsProgresPasi = Readonly<{
  /** Etichetele, în ordine. Numerotarea afișată se derivă din ele. */
  etichete: readonly string[];
  /** Pasul curent, numerotat de la 1. */
  pasCurent: number;
  /** Numele grupului, pentru cititoarele de ecran: „Pașii înrolării”. */
  eticheta: string;
  /**
   * Când e dat, pașii devin butoane și se poate sări direct la oricare.
   *
   * Fără el rămân `span`-uri: un element care arată apăsabil dar nu face nimic
   * e mai rău decât unul care arată inert. Nu inventăm interactivitate.
   */
  onSalt?: (numarPas: number) => void;
  /**
   * Pași scoși din flux, numerotați de la 1.
   *
   * Numerotarea afișată se RECALCULEAZĂ după filtrare, ca să nu apară un
   * „1, 2, 3, 5" fără explicație.
   */
  pasiAscunsi?: readonly number[];
}>;

export function ProgresPasi({
  etichete,
  pasCurent,
  eticheta,
  onSalt,
  pasiAscunsi = [],
}: PropsProgresPasi): ReactElement {
  const vizibili = etichete
    .map((text, index) => ({ text, numarReal: index + 1 }))
    .filter((pas) => !pasiAscunsi.includes(pas.numarReal));

  return (
    <ol className="text-corp flex flex-wrap gap-x-4 gap-y-2" aria-label={eticheta}>
      {vizibili.map((pas, indexAfisat) => {
        const activ = pas.numarReal === pasCurent;
        const parcurs = pas.numarReal < pasCurent;
        const numarAfisat = indexAfisat + 1;

        const bulina =
          "flex size-6 shrink-0 items-center justify-center rounded-full text-nota font-medium " +
          (activ
            ? "bg-primary text-primary-foreground"
            : parcurs
              ? "bg-primary/20 text-primary"
              : "bg-surface text-muted-foreground border-border border");
        const clasaText = activ ? "text-foreground font-medium" : "text-muted-foreground";

        const continut = (
          <>
            <span className={bulina}>{numarAfisat}</span>
            <span className={clasaText}>{pas.text}</span>
          </>
        );

        return (
          <li key={pas.text} aria-current={activ ? "step" : undefined}>
            {onSalt ? (
              <button
                type="button"
                onClick={() => {
                  onSalt(pas.numarReal);
                }}
                // `button`, nu `div` cu onClick: primește focus din tastatură,
                // e anunțat ca acțiune de cititoarele de ecran și răspunde la
                // Enter și Space fără cod suplimentar.
                className="rounded-control flex items-center gap-2 px-1 py-0.5 transition hover:opacity-80"
              >
                {continut}
              </button>
            ) : (
              <span className="flex items-center gap-2 px-1 py-0.5">{continut}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
