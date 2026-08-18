"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * File în pagină, nu intrări noi de meniu.
 *
 * Ambele destinații cer `checklists:read ≥ own` — exact poarta verificată de
 * fiecare pagină în parte, deci nu sunt necesari booleeni de vizibilitate ca
 * la `NavFlota`. Ascunderea unei file NU e barieră de securitate: pagina și
 * RLS refuză din nou, independent de meniu.
 */
export function NavOnboarding() {
  const cale = usePathname();

  const file = [
    { href: "/onboarding", eticheta: "Instanțe" },
    { href: "/onboarding/sabloane", eticheta: "Șabloane" },
  ] as const;

  return (
    <nav
      aria-label="Navigare onboarding"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      {file.map((fila) => {
        const activ = fila.href === "/onboarding" ? cale === fila.href : cale.startsWith(fila.href);
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
