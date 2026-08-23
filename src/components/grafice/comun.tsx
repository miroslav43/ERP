// src/components/grafice/comun.tsx
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Temelia comună a graficelor.
 *
 * ── DE CE SERVER COMPONENTS, DEȘI EXISTĂ O BIBLIOTECĂ ─────────────────────
 * `visx` e folosit ca bibliotecă de MATEMATICĂ, nu de componente: `@visx/scale`
 * și generatoarele de traseu din `@visx/shape` rulează în Node pur — verificat,
 * nu presupus — deci scalele și `d` -urile se calculează pe server, iar noi
 * emitem `<svg>`-ul.
 *
 * Alternativa, Recharts, măsoară DOM-ul ca să se dimensioneze
 * (`ResponsiveContainer`), deci fiecare grafic ar fi devenit obligatoriu Client
 * Component: ~95 KB de JavaScript pentru trei sparkline-uri pe panou, și
 * randare goală la tipărire dacă pagina n-a apucat să se hidrateze.
 *
 * ── CULORILE VIN CA `var(--color-*)`, NICIODATĂ CA HEX ────────────────────
 * Regula e deja scrisă în singurul grafic care exista în proiect
 * (`payroll/taxe-pie-chart.tsx`): „ca personalizarea de temă per organizație să
 * nu fie ignorată". Un hex într-un `fill` e o culoare care nu se mai poate
 * schimba din `<html>`.
 *
 * ── DE CE FIECARE GRAFIC POARTĂ UN TABEL ASCUNS ───────────────────────────
 * Un `aria-label` pe un `<svg>` spune „graficul arată evoluția efectivului" —
 * adică exact atât cât se vede din titlu. Datele rămân inaccesibile. Un
 * `<table>` `sr-only` cu aceleași cifre le face citibile rând cu rând, se
 * copiază, și supraviețuiește tipăririi. Costă câteva zeci de octeți de HTML.
 */
export type Punct = Readonly<{
  /** Ce scrie pe axă și în tabelul ascuns: „ian.", „S12", „2026-08". */
  eticheta: string;
  valoare: number;
}>;

export type PropsGrafic = Readonly<{
  /** Numele graficului, pentru cititorul de ecran. Nu se afișează. */
  titlu: string;
  /** Cum se numesc valorile în tabelul ascuns: „Angajați", „Lei". */
  unitate?: string;
  className?: string;
}>;

/**
 * Învelișul: `role="img"` cu nume, plus tabelul ascuns cu datele.
 *
 * `<svg>` primește `aria-hidden`, fiindcă altfel cititorul de ecran ar parcurge
 * fiecare `<rect>` și `<path>` pe rând — zgomot fără înțeles.
 */
export function InvelisGrafic({
  titlu,
  unitate = "Valoare",
  puncte,
  children,
  className,
}: PropsGrafic & {
  puncte: readonly Punct[];
  children: ReactNode;
}): ReactElement {
  return (
    <figure className={cn("m-0", className)}>
      <div role="img" aria-label={titlu}>
        {children}
      </div>
      <table className="sr-only">
        <caption>{titlu}</caption>
        <thead>
          <tr>
            <th scope="col">Perioadă</th>
            <th scope="col">{unitate}</th>
          </tr>
        </thead>
        <tbody>
          {puncte.map((p) => (
            <tr key={p.eticheta}>
              <th scope="row">{p.eticheta}</th>
              <td>{p.valoare}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * Paleta categorică a graficelor.
 *
 * NU sunt tokenii de STARE (`success`, `warning`, `danger`): aceia poartă un
 * verdict — „e bine", „e rău" — iar o serie dintr-un grafic de structură nu e
 * nici bună, nici rea. Folosiți împreună, cele două vocabulare se calcă:
 * o felie verde ar însemna „partea reușită din cost".
 *
 * Sunt trepte ale navy-ului, plus auriul o singură dată. Pe navy, auriul dă
 * 6,82:1; pe crem ar da 2,26:1 — de aceea apare doar ca umplutură, niciodată
 * ca text sau ca linie subțire pe fundal deschis.
 */
export const SERII = [
  "var(--color-primary)",
  "var(--color-primary-active)",
  "var(--color-accent)",
  "var(--color-muted-foreground)",
  "var(--color-border)",
] as const;

/** Culoarea seriei `i`, ciclic. */
export function culoareSerie(i: number): string {
  return SERII[i % SERII.length] ?? SERII[0];
}
