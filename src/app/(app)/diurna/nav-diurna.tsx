"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Fila {
  readonly href: string;
  readonly eticheta: string;
}

/**
 * File în pagină, nu intrări noi de meniu.
 *
 * Primește BOOLEENI, nu harta de permisiuni: o componentă client nu poate
 * importa `can` sau orice atinge `@/lib/auth`, `@/lib/supabase`,
 * `@/lib/tenant` — trag după ele `server-only` și `next/headers`. Exact asta
 * a picat la flotă: typecheck, lint și toate testele au trecut, a prins-o
 * doar `pnpm build`.
 *
 * Ascunderea unei file pentru cine nu are dreptul NU e barieră de securitate:
 * fiecare pagină verifică din nou permisiunea, iar RLS respinge rândurile
 * chiar dacă cineva tastează URL-ul direct.
 */
interface Proprietati {
  readonly poateAproba: boolean;
}

export function NavDiurna({ poateAproba }: Proprietati) {
  const cale = usePathname();

  const file: readonly Fila[] = [
    { href: "/diurna", eticheta: "Deplasări" },
    ...(poateAproba ? [{ href: "/diurna/aprobari", eticheta: "De aprobat" }] : []),
    { href: "/diurna/politica", eticheta: "Politica" },
  ];

  return (
    <nav
      aria-label="Navigare diurnă"
      className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-700"
    >
      {file.map((fila) => {
        const activ = cale === fila.href;
        return (
          <Link
            key={fila.href}
            href={fila.href}
            aria-current={activ ? "page" : undefined}
            className={
              activ
                ? "border-b-2 border-blue-700 px-4 py-2 text-sm font-medium text-blue-800 dark:border-blue-400 dark:text-blue-300"
                : "border-b-2 border-transparent px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }
          >
            {fila.eticheta}
          </Link>
        );
      })}
    </nav>
  );
}
