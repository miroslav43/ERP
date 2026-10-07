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
 * Primește un BOOLEAN, nu harta de permisiuni: `can` trage după el
 * `server-only`, iar aceasta e o componentă client (lecția lui `nav-flota`).
 * Cine ajunge în ramura care randează acest component are deja
 * `maintenance:read` la scope „team” (poarta din `page.tsx`), care acoperă și
 * pragul mai mic („own”) cerut de `/mentenanta/sesizari`. Fila „Setări” apare
 * doar pentru `maintenance:update = all`; ascunderea ei NU e barieră de
 * securitate — pagina își repetă verificarea, iar RLS refuză rândurile.
 */
export function NavMentenanta({ poateSetari = false }: Readonly<{ poateSetari?: boolean }>) {
  const cale = usePathname();

  const file: readonly IntrareFila[] = [
    { href: "/mentenanta", eticheta: "Panou" },
    { href: "/mentenanta/echipamente", eticheta: "Echipamente" },
    { href: "/mentenanta/planuri", eticheta: "Planuri" },
    { href: "/mentenanta/interventii", eticheta: "Intervenții" },
    { href: "/mentenanta/sesizari", eticheta: "Sesizări" },
    ...(poateSetari ? [{ href: "/mentenanta/setari", eticheta: "Setări" }] : []),
  ];

  return (
    <BandaFile eticheta="Navigare mentenanță">
      {file.map((fila) => {
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
