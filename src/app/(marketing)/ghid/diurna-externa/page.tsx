// src/app/(marketing)/ghid/diurna-externa/page.tsx
import type { Metadata } from "next";

import { DIURNA_EXTERNA } from "@/content/legal/diurna-externa";

import { CalculatorDiurnaExterna } from "../../_componente/calculator-diurna-externa";
import { metadatePagina } from "../../_componente/metadate";
import { RandarePaginaLege } from "../../_componente/pagina-lege";

/**
 * Ghid: diurna în străinătate, pe fiecare țară.
 *
 * Tabelul complet din anexa HG 518/1995, cu plafonul neimpozabil calculat și o
 * ancoră pe fiecare rând (`/ghid/diurna-externa#germania`) — căutările vin cu
 * țara în coadă.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Diurna externă 2026: cuantumul pe țări",
  descriere:
    "Diurna externă 2026 pe fiecare țară din HG 518/1995 și plafonul neimpozabil de 2,5 ori: Germania 87,50 €, Bulgaria 80 €. Toate cele 166 de țări.",
  cale: "/ghid/diurna-externa",
});

export default function PaginaDiurnaExterna() {
  return (
    <RandarePaginaLege
      text={DIURNA_EXTERNA}
      calculator={{
        titlu: "Calculator de diurnă externă",
        lead: "Alegi țara și orele la care ai trecut frontiera; afli câte zile de diurnă ies, cât e plafonul neimpozabil și, dacă scrii suma plătită, cât din ea se impozitează.",
        continut: <CalculatorDiurnaExterna />,
      }}
    />
  );
}
