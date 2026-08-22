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
 * Primește BOOLEENI, nu harta de permisiuni. Prima variantă importa `can` din
 * `@/lib/auth/permissions`, care trage după el `server-only` și `next/headers` —
 * într-o componentă client. `pnpm typecheck`, `pnpm lint` și cele 271 de teste
 * au trecut toate; a picat doar `pnpm build`, singurul care compilează efectiv
 * granița server/client. De aceea build-ul e verificarea care contează, nu
 * codul HTTP al unui curl.
 *
 * `src/config/navigation.ts` cere doar ruta rădăcină `/flota`. Ascunderea unei
 * file pentru cine nu are dreptul NU e barieră de securitate: fiecare pagină
 * verifică din nou permisiunea, iar RLS respinge rândurile chiar dacă cineva
 * tastează URL-ul direct.
 */
interface Proprietati {
  readonly poateVedeaFoi: boolean;
  readonly poateAproba: boolean;
  readonly poateVedeaAnomalii: boolean;
}

export function NavFlota({ poateVedeaFoi, poateAproba, poateVedeaAnomalii }: Proprietati) {
  const cale = usePathname();

  const file: readonly Fila[] = [
    { href: "/flota", eticheta: "Vehicule" },
    ...(poateVedeaFoi ? [{ href: "/flota/foi", eticheta: "Foi de parcurs" }] : []),
    ...(poateAproba ? [{ href: "/flota/aprobari", eticheta: "De aprobat" }] : []),
    ...(poateVedeaAnomalii
      ? [{ href: "/flota/anomalii", eticheta: "Anomalii de kilometraj" }]
      : []),
  ];

  return (
    <nav aria-label="Navigare parc auto" className="border-border flex flex-wrap gap-1 border-b">
      {file.map((fila) => {
        const activ = cale === fila.href;
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
