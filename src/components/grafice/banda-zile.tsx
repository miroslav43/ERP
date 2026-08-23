// src/components/grafice/banda-zile.tsx
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Banda de calendar: o celulă pe zi, colorată după ce s-a întâmplat în ziua aia.
 * Pentru pontajul lunii, prezența unei echipe, acoperirea cu concedii.
 *
 * ── DE CE COMPONENTA NU ȘTIE CE E O SĂRBĂTOARE ────────────────────────────
 * Primește zilele gata calculate. Calendarul legal românesc — inclusiv Paștele
 * ortodox, care se calculează — trăiește deja în `src/domain/calendar/`
 * (`sarbatori.ts`, `paste-ortodox.ts`, cu teste). O a doua implementare aici ar
 * fi însemnat două adevăruri despre aceeași zi de 24 aprilie.
 *
 * ── DE CE CULOAREA NU E SINGURUL PURTĂTOR ─────────────────────────────────
 * WCAG 1.4.1: informația nu se transmite numai prin culoare. Fiecare celulă are
 * `title` (apare la mouse, gratuit, fără JavaScript) și intră în tabelul ascuns
 * de dedesubt cu numele stării scris în litere. Hașura pentru „închis" e a doua
 * marcă vizuală, nu doar altă nuanță.
 *
 * ── DE CE UN TABEL ASCUNS ȘI NU `aria-label` PE FIECARE CELULĂ ────────────
 * Treizeci de celule cu `aria-label` sunt treizeci de opriri pentru cititorul de
 * ecran, fără nicio structură. Un tabel are antet de coloană și se parcurge cu
 * comenzile de tabel, care există exact pentru asta.
 */
export type TonZi = "gol" | "neutru" | "bun" | "atentie" | "rau" | "inchis";

export type Zi = Readonly<{
  /** Cheie unică și text pentru tabelul ascuns: de obicei data ISO. */
  cheie: string;
  /** Ce scrie sub celulă, dacă se scrie ceva: „1", „L", „23". */
  eticheta?: string;
  ton: TonZi;
  /** Starea în litere: „Prezent 8 h", „Concediu de odihnă", „Lună închisă". */
  descriere: string;
}>;

const CLASE: Record<TonZi, string> = {
  gol: "bg-border/40",
  neutru: "bg-primary/70",
  bun: "bg-success",
  atentie: "bg-warning",
  rau: "bg-danger",
  // `hasura` e tokenul pentru „nu s-a întâmplat și nu se mai poate scrie aici".
  inchis: "bg-border/30 hasura",
};

export type PropsBandaZile = Readonly<{
  /** Numele benzii, pentru cititorul de ecran. Nu se afișează. */
  titlu: string;
  zile: readonly Zi[];
  /** Perechi ton → nume, afișate sub bandă. Fără ele, culorile sunt mute. */
  legenda?: readonly Readonly<{ ton: TonZi; nume: string }>[];
  className?: string;
}>;

export function BandaZile({
  titlu,
  zile,
  legenda,
  className,
}: PropsBandaZile): ReactElement | null {
  if (zile.length === 0) return null;

  const cuEtichete = zile.some((z) => z.eticheta !== undefined);

  return (
    <figure className={cn("m-0 flex flex-col gap-2", className)}>
      <div
        role="img"
        aria-label={titlu}
        className="grid gap-px"
        style={{ gridTemplateColumns: `repeat(${zile.length}, minmax(0, 1fr))` }}
      >
        {zile.map((z) => (
          <div key={z.cheie} className="flex min-w-0 flex-col items-center gap-1">
            <div
              // `title` e singurul indiciu la mouse care nu costă JavaScript.
              title={z.descriere}
              className={cn("rounded-control h-7 w-full [print-color-adjust:exact]", CLASE[z.ton])}
            />
            {cuEtichete ? (
              <span className="text-muted-foreground text-nota truncate tabular-nums">
                {z.eticheta}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {legenda === undefined || legenda.length === 0 ? null : (
        <ul className="text-nota flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
          {legenda.map((l) => (
            <li key={l.ton} className="text-muted-foreground flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded-control size-3 shrink-0 border border-black/5",
                  CLASE[l.ton],
                )}
              />
              {l.nume}
            </li>
          ))}
        </ul>
      )}

      <table className="sr-only">
        <caption>{titlu}</caption>
        <thead>
          <tr>
            <th scope="col">Zi</th>
            <th scope="col">Stare</th>
          </tr>
        </thead>
        <tbody>
          {zile.map((z) => (
            <tr key={z.cheie}>
              <th scope="row">{z.eticheta ?? z.cheie}</th>
              <td>{z.descriere}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
