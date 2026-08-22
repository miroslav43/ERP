// src/components/onboarding/progres-asistent.tsx
"use client";

export const ETICHETE_PASI = [
  "Date fiscale",
  "Reprezentant legal",
  "Date financiare",
  "Structură și locații",
  "SSM / PSI",
  "Cont proprietar",
  "Confirmare",
] as const;

interface ProprietatiProgres {
  readonly pasCurent: number;
  /**
   * Când e dat, pașii devin butoane și se poate sări direct la oricare.
   *
   * Fără el rămân `span`-uri: un element care arată apăsabil dar nu face nimic
   * e mai rău decât unul care arată inert. Nu inventăm interactivitate.
   */
  readonly onSalt?: (numarPas: number) => void;
  /**
   * Pași scoși din flux, numerotați de la 1.
   *
   * Administratorul care își completează propria firmă nu vede pasul 6 („Cont
   * proprietar") — el ESTE proprietarul. Numerotarea afișată se recalculează,
   * ca să nu apară un „1, 2, 3, 4, 5, 7" fără explicație.
   */
  readonly pasiAscunsi?: readonly number[];
}

export function ProgresAsistent({ pasCurent, onSalt, pasiAscunsi = [] }: ProprietatiProgres) {
  const vizibili = ETICHETE_PASI.map((eticheta, index) => ({
    eticheta,
    numarReal: index + 1,
  })).filter((pas) => !pasiAscunsi.includes(pas.numarReal));

  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Pașii înrolării">
      {vizibili.map((pas, indexAfisat) => {
        const activ = pas.numarReal === pasCurent;
        const parcurs = pas.numarReal < pasCurent;
        const numarAfisat = indexAfisat + 1;

        const bulina =
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium " +
          (activ
            ? "bg-primary text-primary-foreground"
            : parcurs
              ? "bg-primary/20 text-primary"
              : "bg-surface text-muted-foreground border-border border");
        const text = activ ? "text-foreground font-medium" : "text-muted-foreground";

        const continut = (
          <>
            <span className={bulina}>{numarAfisat}</span>
            <span className={text}>{pas.eticheta}</span>
          </>
        );

        return (
          <li key={pas.eticheta} aria-current={activ ? "step" : undefined}>
            {onSalt ? (
              <button
                type="button"
                onClick={() => onSalt(pas.numarReal)}
                // `button`, nu `div` cu onClick: primește focus din tastatură,
                // e anunțat ca acțiune de cititoarele de ecran și răspunde la
                // Enter și Space fără cod suplimentar.
                className="focus-visible:ring-ring flex items-center gap-2 rounded-md px-1 py-0.5 transition hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
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
