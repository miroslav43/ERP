// src/components/ui/file.tsx
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Banda de file dintr-un modul. Aspectul, o singură dată; logica rămâne la
 * fiecare modul.
 *
 * Cele șapte componente `nav-*.tsx` (concedii, diurnă, flotă, mentenanță,
 * onboarding, pontaj, SSM) au fiecare exact același rând de file, scris de
 * mână — dar au și logică pe care NU trebuie s-o piardă: fila de calendar a
 * concediilor își duce `an` și `luna` în href, ca o ieșire și o revenire prin
 * file să nu te arunce înapoi pe luna curentă. De aceea aici stă doar forma;
 * ce file există și unde duc rămâne treaba modulului.
 *
 * Fila activă e `text-foreground` cu subliniere navy, nu `text-primary`: două
 * semnale pentru aceeași stare (culoarea textului ȘI linia) ar fi redundant,
 * iar linia e cea care se vede din reflex. `aria-current="page"` o spune și
 * pentru cine nu vede niciuna.
 */
export function BandaFile({
  eticheta,
  children,
  className,
}: Readonly<{ eticheta: string; children: ReactNode; className?: string }>): ReactElement {
  return (
    <nav
      aria-label={eticheta}
      className={cn("border-border -mb-px flex flex-wrap gap-1 border-b", className)}
    >
      {children}
    </nav>
  );
}

export function Fila({
  href,
  activ,
  contor,
  children,
}: Readonly<{
  href: string;
  activ: boolean;
  /** Absent sau zero = fără pastilă. Un „0" afișat e zgomot, nu informație. */
  contor?: number;
  children: ReactNode;
}>): ReactElement {
  return (
    <Link
      href={href}
      aria-current={activ ? "page" : undefined}
      className={cn(
        "text-corp -mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 font-medium transition-colors md:min-h-0 md:py-2",
        activ
          ? "border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground border-transparent",
      )}
    >
      {children}
      {contor !== undefined && contor > 0 ? (
        <span
          className={cn(
            "text-nota rounded-full px-1.5 font-mono font-semibold tabular-nums",
            activ ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground",
          )}
        >
          {contor}
        </span>
      ) : null}
    </Link>
  );
}
