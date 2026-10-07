// src/app/(marketing)/ghid/spor-de-noapte/page.tsx
import type { Metadata } from "next";

import { SPOR_DE_NOAPTE } from "@/content/legal/spor-de-noapte";

import { metadatePagina } from "../../_componente/metadate";
import { RandarePaginaLege } from "../../_componente/pagina-lege";

export const metadata: Metadata = metadatePagina({
  titlu: "Spor de noapte: Codul muncii și calculul",
  descriere:
    "Sporul de noapte în Codul muncii: 25% din salariul de bază sau o oră mai puțin, de la 3 ore lucrate între 22 și 6. Calcul cu exemplu și articolul.",
  cale: "/ghid/spor-de-noapte",
});

export default function PaginaSporDeNoapte() {
  return <RandarePaginaLege text={SPOR_DE_NOAPTE} />;
}
