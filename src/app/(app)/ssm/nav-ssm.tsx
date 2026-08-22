"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * File în pagină, nu intrări noi de meniu — la fel ca `NavFlota`.
 *
 * Primește BOOLEENI, nu harta de permisiuni: o componentă client nu poate
 * importa `can` sau orice atinge `@/lib/auth`, `@/lib/supabase`, `@/lib/tenant`
 * — trag după ele `server-only` și `next/headers`. Booleenii se calculează pe
 * server și se pasează ca proprietăți. Exact regula care a picat la flotă:
 * typecheck, lint și testele trec, doar `pnpm build` prinde granița server/client.
 *
 * Ascunderea unei file NU e barieră de securitate: fiecare pagină verifică din
 * nou permisiunea, iar RLS respinge rândurile chiar dacă cineva tastează URL-ul.
 */
interface Proprietati {
  readonly poateVedeaInstruiri: boolean;
  readonly poateVedeaMedicina: boolean;
  readonly poateVedeaAccidente: boolean;
  readonly poateVedeaStingatoare: boolean;
  readonly poateVedeaEip: boolean;
  readonly poateVedeaAutorizatii: boolean;
}

interface Fila {
  readonly href: string;
  readonly eticheta: string;
}

export function NavSsm({
  poateVedeaInstruiri,
  poateVedeaMedicina,
  poateVedeaAccidente,
  poateVedeaStingatoare,
  poateVedeaEip,
  poateVedeaAutorizatii,
}: Proprietati) {
  const cale = usePathname();

  const file: readonly Fila[] = [
    { href: "/ssm", eticheta: "Panou" },
    ...(poateVedeaInstruiri ? [{ href: "/ssm/instruiri", eticheta: "Instruiri" }] : []),
    ...(poateVedeaMedicina ? [{ href: "/ssm/medicina-muncii", eticheta: "Medicina muncii" }] : []),
    ...(poateVedeaAccidente ? [{ href: "/ssm/accidente", eticheta: "Accidente" }] : []),
    ...(poateVedeaStingatoare ? [{ href: "/ssm/stingatoare", eticheta: "Stingătoare" }] : []),
    ...(poateVedeaEip ? [{ href: "/ssm/eip", eticheta: "EIP" }] : []),
    ...(poateVedeaAutorizatii
      ? [{ href: "/ssm/autorizatii", eticheta: "Autorizații nominale" }]
      : []),
  ];

  return (
    <nav aria-label="Navigare SSM și PSI" className="border-border flex flex-wrap gap-1 border-b">
      {file.map((fila) => {
        const activ = fila.href === "/ssm" ? cale === "/ssm" : cale.startsWith(fila.href);
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
