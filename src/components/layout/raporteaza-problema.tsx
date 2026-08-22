// src/components/layout/raporteaza-problema.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bug } from "lucide-react";

import { NAV_ITEMS } from "@/config/navigation";

/**
 * Deduce modulul din calea curentă, ca angajatul să nu fie pus să-l aleagă.
 *
 * Se caută cea mai lungă potrivire: `/inventar/import` trebuie să dea
 * „Inventar”, nu prima intrare care se întâmplă să înceapă la fel. Dacă nu se
 * potrivește nimic, se trimite calea brută — tot e mai util pentru cine
 * citește raportul decât un câmp gol.
 */
function modulDinCale(cale: string): string {
  let gasit: string | null = null;
  let lungime = 0;
  for (const item of NAV_ITEMS) {
    if ((cale === item.href || cale.startsWith(`${item.href}/`)) && item.href.length > lungime) {
      gasit = item.label;
      lungime = item.href.length;
    }
  }
  return gasit ?? cale;
}

/**
 * Prezent în subsolul fiecărei pagini. Nu deschide un modal propriu: duce la
 * formularul existent, cu tipul și modulul precompletate. Un al doilea formular
 * ar fi însemnat a doua listă de câmpuri de ținut în acord cu prima.
 */
export function RaporteazaProblema() {
  const cale = usePathname();
  const href = useMemo(
    () => `/ticketing/nou?modul=${encodeURIComponent(modulDinCale(cale))}`,
    [cale],
  );

  return (
    <footer className="border-border mt-8 border-t px-4 py-3 md:px-6">
      <Link
        href={href}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs"
      >
        <Bug aria-hidden="true" className="size-3.5" />
        Raportează o problemă
      </Link>
    </footer>
  );
}
