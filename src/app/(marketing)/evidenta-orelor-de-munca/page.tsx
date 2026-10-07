// src/app/(marketing)/evidenta-orelor-de-munca/page.tsx
import type { Metadata } from "next";

import { EVIDENTA_ORELOR } from "@/content/legal/evidenta-orelor";

import { metadatePagina } from "../_componente/metadate";
import { RandarePaginaLege } from "../_componente/pagina-lege";

/**
 * Evidența orelor de muncă — art. 119 din Codul muncii.
 *
 * Slug ASCII fără diacritice, conținut cu diacritice: e regula de rutare a
 * proiectului. „evidenta-orelor-de-munca" e și forma tastată efectiv în căutare.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Evidența orelor de muncă: art. 119 în 2026",
  descriere:
    "Legea cere ora de începere și de sfârșit, zilnic, nu doar numărul de ore. Regulile din art. 119, amenzile și ce verifică ITM, cu articolul lângă fiecare.",
  cale: "/evidenta-orelor-de-munca",
});

export default function PaginaEvidentaOrelor() {
  return <RandarePaginaLege text={EVIDENTA_ORELOR} />;
}
