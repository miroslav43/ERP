// src/app/(marketing)/ghid/ore-suplimentare/page.tsx
import type { Metadata } from "next";

import { ORE_SUPLIMENTARE } from "@/content/legal/ore-suplimentare";

import { metadatePagina } from "../../_componente/metadate";
import { RandarePaginaLege } from "../../_componente/pagina-lege";

export const metadata: Metadata = metadatePagina({
  titlu: "Ore suplimentare: ce spune Codul muncii",
  descriere:
    "Orele suplimentare în Codul muncii: limita de 48 de ore pe săptămână, timp liber în 90 de zile, sporul de minimum 75% și amenda, cu articolul de lege.",
  cale: "/ghid/ore-suplimentare",
});

export default function PaginaOreSuplimentare() {
  return <RandarePaginaLege text={ORE_SUPLIMENTARE} />;
}
