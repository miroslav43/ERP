"use client";

import { usePathname } from "next/navigation";
import { BandaFile, Fila } from "@/components/ui/file";

interface IntrareFila {
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

  const file: readonly IntrareFila[] = [
    { href: "/diurna", eticheta: "Deplasări" },
    ...(poateAproba ? [{ href: "/diurna/aprobari", eticheta: "De aprobat" }] : []),
    { href: "/diurna/politica", eticheta: "Politica" },
  ];

  return (
    <BandaFile eticheta="Navigare diurnă">
      {file.map((fila) => {
        const activ = cale === fila.href;
        return (
          <Fila key={fila.href} href={fila.href} activ={activ}>
            {fila.eticheta}
          </Fila>
        );
      })}
    </BandaFile>
  );
}
