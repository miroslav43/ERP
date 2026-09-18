// src/app/(marketing)/ghid/diurna/page.tsx
import type { Metadata } from "next";

import { DIURNA } from "@/content/legal/diurna";

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
export const metadata: Metadata = {
  title: "Diurna: plafonul neimpozabil și cele 3 salarii",
  description:
    "Cele două plafoane ale diurnei — 2,5 ori nivelul din hotărârea de guvern și 3 salarii de bază calculate lunar — plus ce spune Codul muncii despre delegare și cei 60 de zile.",
  alternates: { canonical: "/ghid/diurna" },
};

export default function PaginaDiurna() {
  return <RandarePaginaLege text={DIURNA} />;
}
