"use client";

import { usePathname } from "next/navigation";
import { BandaFile, Fila } from "@/components/ui/file";

interface IntrareFila {
  readonly href: string;
  readonly eticheta: string;
}

const FILE: readonly IntrareFila[] = [
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
    <BandaFile eticheta="Navigare mentenanță">
      {FILE.map((fila) => {
        const activ = fila.href === "/mentenanta" ? cale === fila.href : cale.startsWith(fila.href);
        return (
          <Fila key={fila.href} href={fila.href} activ={activ}>
            {fila.eticheta}
          </Fila>
        );
      })}
    </BandaFile>
  );
}
