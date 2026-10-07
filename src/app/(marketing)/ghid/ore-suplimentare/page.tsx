// src/app/(marketing)/ghid/ore-suplimentare/page.tsx
import type { Metadata } from "next";

import { ORE_SUPLIMENTARE } from "@/content/legal/ore-suplimentare";

import { metadatePagina } from "../../_componente/metadate";
import { RandarePaginaLege } from "../../_componente/pagina-lege";

export const metadata: Metadata = metadatePagina({
  titlu: "Ore suplimentare: ce spune Codul muncii",
  descriere:
    "Ore suplimentare în Codul muncii: cel mult 48 de ore pe săptămână în medie, timp liber în 90 de zile, apoi spor de minimum 75%. Amenda și articolul.",
  cale: "/ghid/ore-suplimentare",
});

export default function PaginaOreSuplimentare() {
  return <RandarePaginaLege text={ORE_SUPLIMENTARE} />;
}
