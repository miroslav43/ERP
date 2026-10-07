// src/app/(marketing)/ghid/spor-de-noapte/page.tsx
import type { Metadata } from "next";

import { SPOR_DE_NOAPTE } from "@/content/legal/spor-de-noapte";

import { metadatePagina } from "../../_componente/metadate";
import { RandarePaginaLege } from "../../_componente/pagina-lege";

export const metadata: Metadata = metadatePagina({
  titlu: "Spor de noapte: Codul muncii și calculul",
  descriere:
    "Sporul de noapte în Codul muncii: 25% din salariul de bază sau o oră mai puțin, pragul de 3 ore, intervalul 22–6 și un exemplu de calcul, cu articolul de lege.",
  cale: "/ghid/spor-de-noapte",
});

export default function PaginaSporDeNoapte() {
  return <RandarePaginaLege text={SPOR_DE_NOAPTE} />;
}
