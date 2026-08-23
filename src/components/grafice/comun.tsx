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
  /**
   * Antetul primei coloane din tabelul ascuns. Fiecare grafic îl are pe al lui
   * implicit („Perioadă" la serii de timp, „Categorie" la inel), dar rămâne
   * prop fiindcă landing-ul de marketing randează ACELEAȘI componente în
   * engleză — iar un `<th>` scris în componentă ar fi fost singurul cuvânt
   * românesc dintr-o pagină englezească.
   */
  antetCategorie?: string;
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
  antetCategorie,
  puncte,
  children,
  className,
}: PropsGrafic & {
  antetCategorie: string;
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
            <th scope="col">{antetCategorie}</th>
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
 * Paleta categorică a graficelor. Definiția și cifrele stau în `globals.css`,
 * lângă ceilalți tokeni; aici e doar ordinea de folosire.
 *
 * Prima versiune a acestei liste era „trepte ale navy-ului, plus auriul", aleasă
 * la ochi. Calculată, avea două defecte reale:
 *   · `--color-border` dădea 1,29:1 pe pânza crem — felie invizibilă;
 *   · `--color-accent` (auriul de brand) dădea 2,26:1 — sub pragul 1.4.11.
 * Iar seriile 1↔2 aveau între ele 1,54:1, adică nu se deosebeau deloc.
 *
 * Paleta de acum e verificată: fiecare serie ≥ 3:1 pe pânză. Ce NU promite —
 * și nici nu poate promite — e 3:1 ÎNTRE serii alăturate; motivul, cu numerele,
 * e scris în `globals.css`. De aceea inelul desparte feliile cu un contur în
 * culoarea pânzei, iar identificarea se face prin legendă și prin tabelul
 * ascuns, nu prin nuanță.
 */
export const SERII = [
  "var(--color-serie-1)",
  "var(--color-serie-2)",
  "var(--color-serie-3)",
  "var(--color-serie-4)",
  "var(--color-serie-5)",
] as const;

/** Culoarea seriei `i`, ciclic. */
export function culoareSerie(i: number): string {
  return SERII[i % SERII.length] ?? SERII[0];
}
