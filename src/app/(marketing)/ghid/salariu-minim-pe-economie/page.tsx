// src/app/(marketing)/ghid/salariu-minim-pe-economie/page.tsx
import type { Metadata } from "next";

import { CIFRE_SALARIU_MINIM, SALARIU_MINIM } from "@/content/legal/salariu-minim";

import { metadatePagina } from "../../_componente/metadate";
import { RandarePaginaLege } from "../../_componente/pagina-lege";

const { brut, net, costTotal, lei } = CIFRE_SALARIU_MINIM;

/**
 * Keyword Planner, oct 2026: „salariu minim pe economie 2026”, 10.000–100.000 de
 * căutări pe lună. Cifrele din titlu și din descriere vin din același calcul ca
 * pagina — vezi `src/content/legal/salariu-minim.ts`.
 */
export const metadata: Metadata = metadatePagina({
  titlu: `Salariul minim pe economie 2026: ${lei(brut)} brut`,
  descriere: `Salariul minim brut e ${lei(brut)} din 1 iulie 2026: ${lei(net)} net și ${lei(costTotal)} cost pentru firmă. Suma scutită, capcana de 1 leu, amenda și REGES.`,
  cale: "/ghid/salariu-minim-pe-economie",
});

export default function PaginaSalariuMinim() {
  return <RandarePaginaLege text={SALARIU_MINIM} />;
}
