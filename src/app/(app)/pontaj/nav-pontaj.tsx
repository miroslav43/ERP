"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Fila {
  readonly href: string;
  readonly eticheta: string;
}

/**
 * File în pagină, nu intrări noi de meniu. Primește BOOLEENI, nu harta de
 * permisiuni — o componentă client nu poate importa `can` sau orice atinge
 * `@/lib/auth`, `@/lib/supabase`, `@/lib/tenant` (trag după ele `server-only`
 * și `next/headers`); boolenii se calculează pe server și se pasează ca
 * proprietăți.
 *
 * `src/config/navigation.ts` cere doar ruta rădăcină `/pontaj`. Ascunderea
 * unei file pentru cine nu are dreptul NU e barieră de securitate: fiecare
 * pagină verifică din nou permisiunea, iar RLS respinge rândurile chiar dacă
 * cineva tastează URL-ul direct.
 */
interface Proprietati {
  readonly poateAproba: boolean;
}

export function NavPontaj({ poateAproba }: Proprietati) {
  const cale = usePathname();

  const file: readonly Fila[] = [
    { href: "/pontaj", eticheta: "Foaie" },
    { href: "/pontaj/saptamana", eticheta: "Planul săptămânii" },
    { href: "/pontaj/perioade", eticheta: "Perioade" },
    ...(poateAproba ? [{ href: "/pontaj/aprobare", eticheta: "Aprobare" }] : []),
  ];

  return (
    <nav
      aria-label="Navigare pontaj"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      {file.map((fila) => {
        const activ = fila.href === "/pontaj" ? cale === fila.href : cale.startsWith(fila.href);
        return (
          <Link
            key={fila.href}
            href={fila.href}
            aria-current={activ ? "page" : undefined}
            className={
              activ
                ? "border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary"
                : "border-b-2 border-transparent px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {fila.eticheta}
          </Link>
        );
      })}
    </nav>
  );
}
