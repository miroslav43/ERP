// src/app/(app)/cursuri/nav-cursuri.tsx
import type { ReactElement } from "react";

import { BandaFile, Fila } from "@/components/ui/file";

/**
 * Fila activă se decide pe SERVER, din pagina care randează banda. Nicio
 * componentă client, niciun `usePathname`: cele două file sunt rute reale, iar
 * `aria-current="page"` trebuie să fie corect încă din HTML-ul trimis.
 */
export function NavCursuri({
  activ,
}: {
  readonly activ: "cursuri" | "biblioteca" | "conformitate";
}): ReactElement {
  return (
    <BandaFile eticheta="Secțiunile modulului de cursuri">
      <Fila href="/cursuri" activ={activ === "cursuri"}>
        Cursuri
      </Fila>
      <Fila href="/cursuri/biblioteca" activ={activ === "biblioteca"}>
        Bibliotecă
      </Fila>
      <Fila href="/cursuri/conformitate" activ={activ === "conformitate"}>
        Conformitate
      </Fila>
    </BandaFile>
  );
}
