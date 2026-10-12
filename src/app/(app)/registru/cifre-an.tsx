// src/app/(app)/registru/cifre-an.tsx
//
// Banda de cifre a anului: total, pe sensuri, anulate, în lucru. Fiecare cifră
// e un LINK care pune filtrul ei — nu un decor. Server Component, fără stare:
// adresele vin gata construite din pagină, care singură știe parametrii.

import Link from "next/link";
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

export type CifraAn = Readonly<{
  eticheta: string;
  valoare: number;
  href: string;
  activ: boolean;
}>;

export function CifreAn({ cifre }: Readonly<{ cifre: readonly CifraAn[] }>): ReactElement {
  return (
    <ul
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      aria-label="Cifrele anului"
    >
      {cifre.map((c) => (
        <li key={c.eticheta}>
          <Link
            href={c.href}
            aria-current={c.activ ? "true" : undefined}
            className={cn(
              "rounded-panou block border px-3 py-2 transition-colors",
              c.activ
                ? "border-primary bg-primary/5"
                : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            <span className="text-foreground block font-mono text-xl font-semibold tabular-nums">
              {c.valoare}
            </span>
            <span className="text-muted-foreground text-nota block">{c.eticheta}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
