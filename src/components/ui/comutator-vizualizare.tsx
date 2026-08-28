// src/components/ui/comutator-vizualizare.tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

import { buton } from "./buton";

/**
 * Comutatorul de vizualizare, cu starea în adresă.
 *
 * ── DE CE O PRIMITIVĂ, ACUM ───────────────────────────────────────────────
 * Existau patru comutatoare scrise de mână: `/concedii` (corect),
 * `/ssm/instruiri`, `/rapoarte`, `/reges`. Diferă între ele în feluri care
 * contează:
 *
 * · cel din `/rapoarte` construiește adresa de la zero, deci ARUNCĂ restul
 *   query string-ului — filtrele aplicate dispar la comutare;
 * · cel din `/ssm/instruiri` anunță `role="tablist"`, dar fără `tabpanel`, fără
 *   `aria-controls` și fără roving tabindex. Un cititor de ecran promite atunci
 *   navigare cu săgeți, iar săgețile nu fac nimic — exact promisiunea neonorată
 *   despre care `bara-actiuni.tsx` spune în scris că trebuie evitată.
 *
 * Primitiva asta extrage tiparul CORECT, cel din `/concedii`: `role="group"` cu
 * nume accesibil și `aria-current` pe segmentul activ. Nu e un tablist, fiindcă
 * nu comută panouri în aceeași pagină — schimbă adresa, iar rezultatul e o
 * navigare adevărată, cu buton de „înapoi" care funcționează.
 *
 * ── DE CE NU E „use client" ───────────────────────────────────────────────
 * Segmentele sunt `<Link replace>`, nu butoane cu `onClick`. Comutatorul nu
 * livrează niciun octet de JavaScript, iar starea supraviețuiește reîncărcării
 * paginii și partajării adresei prin copy-paste.
 *
 * `replace`, nu o intrare nouă în istoric: comutarea între două feluri de a
 * privi ACEEAȘI pagină nu e un pas înapoi pe care cineva ar vrea să-l refacă de
 * cinci ori cu butonul browserului.
 */

export type OptiuneVizualizare = Readonly<{
  cheie: string;
  eticheta: string;
  pictograma?: LucideIcon;
}>;

/** Forma dată de `await searchParams` în Next 16. */
export type ParametriAdresa = Readonly<Record<string, string | readonly string[] | undefined>>;

export type PropsComutatorVizualizare = Readonly<{
  /** Numele accesibil al grupului — ce aude cineva la cititorul de ecran. */
  eticheta: string;
  cheieParametru: string;
  optiuni: readonly OptiuneVizualizare[];
  curenta: string;
  /** Valoarea care se ȘTERGE din adresă în loc să fie scrisă. */
  implicita: string;
  parametri: ParametriAdresa;
  cale: string;
  className?: string;
}>;

/**
 * Adresa unui segment.
 *
 * Pornește din parametrii EXISTENȚI, nu dintr-un `URLSearchParams` gol: altfel
 * comutarea pierde filtrele deja aplicate. Exportată separat ca să fie testabilă
 * fără DOM — partea cu adevărat predispusă la greșeli e construcția adresei, nu
 * marcajul.
 */
export function adresaVizualizare(
  cale: string,
  parametri: ParametriAdresa,
  cheieParametru: string,
  cheie: string,
  implicita: string,
): string {
  const p = new URLSearchParams();
  for (const [nume, valoare] of Object.entries(parametri)) {
    if (valoare === undefined) continue;
    // `typeof`, nu `Array.isArray`: acesta din urmă nu îngustează un
    // `readonly string[]` în TypeScript.
    if (typeof valoare === "string") p.set(nume, valoare);
    else for (const element of valoare) p.append(nume, element);
  }

  if (cheie === implicita) p.delete(cheieParametru);
  else p.set(cheieParametru, cheie);

  // Citirile folosesc cursor keyset, nu `.range()`: un cursor rămas din
  // vizualizarea precedentă ar continua de la un rând care nu mai e în rezultat.
  // Invariantul e respectat de toate comutatoarele existente.
  p.delete("cursor");

  const interogare = p.toString();
  return interogare === "" ? cale : `${cale}?${interogare}`;
}

export function ComutatorVizualizare({
  eticheta,
  cheieParametru,
  optiuni,
  curenta,
  implicita,
  parametri,
  cale,
  className,
}: PropsComutatorVizualizare): ReactElement {
  return (
    <div
      role="group"
      aria-label={eticheta}
      className={cn("border-border rounded-control inline-flex border p-0.5", className)}
    >
      {optiuni.map((optiune) => {
        const curent = optiune.cheie === curenta;
        const Pictograma = optiune.pictograma;
        return (
          <Link
            key={optiune.cheie}
            href={adresaVizualizare(cale, parametri, cheieParametru, optiune.cheie, implicita)}
            replace
            aria-current={curent ? "true" : undefined}
            className={cn(buton({ varianta: curent ? "primar" : "tertiar" }), "rounded")}
          >
            {Pictograma === undefined ? null : <Pictograma aria-hidden="true" className="size-4" />}
            {optiune.eticheta}
          </Link>
        );
      })}
    </div>
  );
}
