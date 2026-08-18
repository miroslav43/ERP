"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, FileText, House } from "lucide-react";

interface Intrare {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

/**
 * Iconițele se aleg AICI, după id, nu se primesc ca proprietăți.
 *
 * `NAV_ITEMS` le ține ca referințe de componentă, iar o componentă nu poate
 * traversa granița server → client ca valoare. În aplicația mare, layout-ul le
 * randează pe server tocmai din motivul ăsta; aici, unde bara e client (are
 * nevoie de `usePathname`), harta pe id e soluția simplă.
 */
const ICONITE: Readonly<Record<string, typeof House>> = {
  "portal-acasa": House,
  "portal-concedii": CalendarDays,
  "portal-pontaj": Clock,
  "portal-documente": FileText,
};

export function BaraPortal({ intrari }: { readonly intrari: readonly Intrare[] }) {
  const cale = usePathname();

  return (
    <nav
      aria-label="Navigare portal"
      // Fixă jos: pe telefon, degetul mare ajunge acolo, nu în colțul de sus.
      // `pb-[env(safe-area-inset-bottom)]` ține bara deasupra indicatorului de
      // pe iPhone, care altfel ar acoperi jumătate din butoane.
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {intrari.map((intrare) => {
          const Iconita = ICONITE[intrare.id] ?? House;
          // Potrivire exactă pentru „Acasă", altfel prefixul „/portal" ar face-o
          // activă pe toate paginile.
          const activ =
            intrare.href === "/portal" ? cale === "/portal" : cale.startsWith(intrare.href);
          return (
            <li key={intrare.id} className="flex-1">
              <Link
                href={intrare.href}
                aria-current={activ ? "page" : undefined}
                className={
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-xs " +
                  (activ ? "text-primary font-medium" : "text-muted-foreground")
                }
              >
                <Iconita aria-hidden="true" className="size-5" />
                <span className="text-center leading-tight">{intrare.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
