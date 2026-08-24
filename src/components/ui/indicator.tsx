// src/components/ui/indicator.tsx
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Cartela cu o cifră. Panou, rapoarte, tablourile de modul.
 *
 * ── STAREA E ȘI ÎN FORMĂ, NU DOAR ÎN CULOARE ──────────────────────────────
 * Dunga de 2px din capul cartelei repetă ce spune deja nota de dedesubt. Nu e
 * decor: pe o listă tipărită alb-negru, sau pentru cine nu distinge roșul de
 * verde, poziția și grosimea rămân singurele semnale. Consola de platformă
 * folosea deja tiparul (`_components/cifra.tsx`) și e cel mai bun exemplu din
 * depozit.
 *
 * ── DE CE `href` E APROAPE OBLIGATORIU ────────────────────────────────────
 * O cifră fără drum e o fundătură: omul vede „3 documente expiră” și trebuie
 * să caute singur unde. Cartela duce la lista DEJA FILTRATĂ, nu la modul.
 */
export type TonIndicator = "neutru" | "bun" | "atentie" | "pericol";

const DUNGA: Readonly<Record<TonIndicator, string>> = {
  neutru: "bg-border",
  bun: "bg-success",
  atentie: "bg-warning",
  pericol: "bg-danger",
};

export type PropsIndicator = Readonly<{
  eticheta: string;
  /** Cifra sau cuvântul. Un cuvânt („Lipsesc”) primește altă mărime decât o cifră. */
  valoare: ReactNode;
  /** `true` când `valoare` e un cuvânt, nu un număr. */
  esteCuvant?: boolean;
  nota?: string;
  ton?: TonIndicator;
  href?: string;
  /** Serie scurtă, sparkline sau bandă — se randează sub cifră. */
  serie?: ReactNode;
  className?: string;
}>;

export function Indicator({
  eticheta,
  valoare,
  esteCuvant,
  nota,
  ton = "neutru",
  href,
  serie,
  className,
}: PropsIndicator): ReactElement {
  const continut = (
    <>
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-0.5", DUNGA[ton])} />
      <span className="text-muted-foreground text-corp font-medium">{eticheta}</span>
      <span
        className={cn(
          "text-primary mt-0.5 font-semibold",
          esteCuvant === true
            ? cn("text-sectiune", ton === "pericol" ? "text-danger" : "")
            : "text-cifra font-mono leading-none tabular-nums",
        )}
      >
        {valoare}
      </span>
      {serie === undefined ? null : <span className="mt-2 block">{serie}</span>}
      {nota === undefined ? null : (
        <span className="text-muted-foreground text-nota mt-1 block">{nota}</span>
      )}
    </>
  );

  const clase = cn(
    "border-border rounded-panou relative flex flex-col overflow-hidden border p-4",
    ton === "atentie" ? "bg-accent/8" : "bg-background",
    href === undefined ? "" : "hover:bg-surface active:bg-border transition-colors",
    className,
  );

  return href === undefined ? (
    <div className={clase}>{continut}</div>
  ) : (
    <Link href={href} className={clase}>
      {continut}
    </Link>
  );
}
