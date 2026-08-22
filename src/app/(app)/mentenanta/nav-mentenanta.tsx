"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Fila {
  readonly href: string;
  readonly eticheta: string;
}

const FILE: readonly Fila[] = [
  { href: "/mentenanta", eticheta: "Panou" },
  { href: "/mentenanta/echipamente", eticheta: "Echipamente" },
  { href: "/mentenanta/planuri", eticheta: "Planuri" },
  { href: "/mentenanta/interventii", eticheta: "Intervenții" },
  { href: "/mentenanta/sesizari", eticheta: "Sesizări" },
];

/**
 * File în pagină, nu intrări noi de meniu.
 *
 * Fără proprietăți: cine ajunge în ramura care randează acest component are
 * deja `maintenance:read` la scope „team” (poarta din `page.tsx`), care
 * acoperă și pragul mai mic („own”) cerut de `/mentenanta/sesizari`. Fiecare
 * pagină își repetă oricum propria verificare — fila de aici nu e barieră de
 * securitate, doar navigare (vezi `flota/nav-flota.tsx`).
 */
export function NavMentenanta() {
  const cale = usePathname();

  return (
    <nav aria-label="Navigare mentenanță" className="border-border flex flex-wrap gap-1 border-b">
      {FILE.map((fila) => {
        const activ = fila.href === "/mentenanta" ? cale === fila.href : cale.startsWith(fila.href);
        return (
          <Link
            key={fila.href}
            href={fila.href}
            aria-current={activ ? "page" : undefined}
            className={
              activ
                ? "border-primary text-primary border-b-2 px-4 py-2 text-sm font-medium"
                : "text-muted-foreground hover:text-foreground border-b-2 border-transparent px-4 py-2 text-sm"
            }
          >
            {fila.eticheta}
          </Link>
        );
      })}
    </nav>
  );
}
