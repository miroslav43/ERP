// src/app/(marketing)/ghid/diurna/page.tsx
import type { Metadata } from "next";

import { DIURNA } from "@/content/legal/diurna";

import { metadatePagina } from "../../_componente/metadate";
import { RandarePaginaLege } from "../../_componente/pagina-lege";

/**
 * Ghid: diurna și plafoanele ei.
 *
 * Singura pagină-lege din site care traversează două coduri — al muncii pentru
 * ce e delegarea și cât ține, cel fiscal pentru cât din indemnizație rămâne
 * neimpozabil. Despărțite, ambele jumătăți induc în eroare: cine citește doar
 * Codul muncii crede că diurna e liberă, cine citește doar Codul fiscal crede
 * că plafonul e o obligație de plată.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Diurna 2026 în țară: plafonul neimpozabil",
  descriere:
    "Diurna neimpozabilă în 2026: 57,50 lei pe zi în țară (2,5 × 23 lei) și plafonul lunar de 3 salarii de bază. Ce spune Codul muncii despre delegare.",
  cale: "/ghid/diurna",
});

export default function PaginaDiurna() {
  return <RandarePaginaLege text={DIURNA} />;
}
