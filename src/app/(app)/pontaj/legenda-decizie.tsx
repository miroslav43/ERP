// src/app/(app)/pontaj/legenda-decizie.tsx
//
// Ce înseamnă cele trei tente din foaia colectivă și din calendarul lunii.
//
// ── DE CE O LEGENDĂ, DACĂ FIECARE CELULĂ ARE DEJA `title` ───────────────────
// `title` se vede la hover, adică pe o singură celulă, cu mausul, după ce te-ai
// întrebat deja ce înseamnă culoarea. Legenda răspunde la întrebarea aia
// înainte să fie pusă, o singură dată pe ecran, și rămâne pe hârtie la
// tipărire — unde tentele se pierd, iar linia tăiată și punctul sunt tot ce mai
// rămâne.
//
// Stă într-un fișier propriu fiindcă o folosesc două ecrane. O a doua copie ar
// fi însemnat două legende care se pot despărți de aceleași trei clase.
import type { ReactElement } from "react";

import { CLASE_STARE_DECIZIE, ETICHETE_STARE_DECIZIE } from "./etichete";
import type { StareDecizie } from "@/domain/attendance/stare-decizie";

/** Ordinea: ce cere acțiune, apoi cele două stări încheiate. */
const ORDINE: readonly StareDecizie[] = ["de_decis", "aprobata", "respinsa"];

export function LegendaDecizie({ className }: { readonly className?: string }): ReactElement {
  return (
    <p
      className={`text-muted-foreground text-nota flex flex-wrap gap-x-4 gap-y-1 ${className ?? ""}`}
    >
      {ORDINE.map((stare) => (
        <span key={stare} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`border-border inline-block size-3 rounded border ${CLASE_STARE_DECIZIE[stare]}`}
          />
          {ETICHETE_STARE_DECIZIE[stare]}
          {stare === "de_decis" ? (
            <span aria-hidden="true" className="text-muted-foreground">
              (cu punct)
            </span>
          ) : null}
          {stare === "respinsa" ? (
            <span aria-hidden="true" className="text-muted-foreground line-through">
              (tăiat)
            </span>
          ) : null}
        </span>
      ))}
    </p>
  );
}
