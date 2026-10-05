// src/content/legal/pagini.ts
import { CONCEDIU_ODIHNA } from "./concediu-odihna";
import { CONTROL_ITM } from "./control-itm";
import { DIURNA } from "./diurna";
import { DIURNA_EXTERNA } from "./diurna-externa";
import { EVIDENTA_ORELOR } from "./evidenta-orelor";
import { ORE_SUPLIMENTARE } from "./ore-suplimentare";
import { REGES } from "./reges";
import { SPOR_DE_NOAPTE } from "./spor-de-noapte";
import type { PaginaLege } from "./tipuri";

/**
 * Toate paginile-lege, într-un singur loc.
 *
 * Până pe 5 oct 2026 erau importate pe rând în `harta.ts`, `ghid/page.tsx` și
 * în teste — un ghid nou putea scăpa unei verificări fără ca nimic să cadă.
 * Testele de formă iterează lista asta; un ghid nou intră aici sau nu e verificat.
 */
export const PAGINI_LEGE: readonly PaginaLege[] = [
  EVIDENTA_ORELOR,
  REGES,
  CONTROL_ITM,
  CONCEDIU_ODIHNA,
  DIURNA,
  DIURNA_EXTERNA,
  ORE_SUPLIMENTARE,
  SPOR_DE_NOAPTE,
];
