"use client";

import { usePathname } from "next/navigation";
import { BandaFile, Fila } from "@/components/ui/file";

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

interface IntrareFila {
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

  const file: readonly IntrareFila[] = [
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
    <BandaFile eticheta="Navigare SSM și PSI">
      {file.map((fila) => {
        const activ = fila.href === "/ssm" ? cale === "/ssm" : cale.startsWith(fila.href);
        return (
          <Fila key={fila.href} href={fila.href} activ={activ}>
            {fila.eticheta}
          </Fila>
        );
      })}
    </BandaFile>
  );
}
