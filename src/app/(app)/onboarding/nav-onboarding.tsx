"use client";

import { usePathname } from "next/navigation";
import { BandaFile, Fila } from "@/components/ui/file";

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
    { href: "/onboarding/sarcinile-mele", eticheta: "Sarcinile mele" },
    { href: "/onboarding/sabloane", eticheta: "Șabloane" },
  ] as const;

  return (
    <BandaFile eticheta="Navigare onboarding">
      {file.map((fila) => {
        const activ = fila.href === "/onboarding" ? cale === fila.href : cale.startsWith(fila.href);
        return (
          <Fila key={fila.href} href={fila.href} activ={activ}>
            {fila.eticheta}
          </Fila>
        );
      })}
    </BandaFile>
  );
}
