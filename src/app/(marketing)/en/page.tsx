// src/app/(marketing)/en/page.tsx
import type { Metadata } from "next";

import { EN } from "@/content/landing/en";

import { Cadru } from "../_componente/cadru";
import { metadatePagina } from "../_componente/metadate";
import { PaginaLanding } from "../_componente/pagina";

export const metadata: Metadata = metadatePagina({
  titlu: EN.meta.titlu,
  titluAbsolut: true,
  descriere: EN.meta.descriere,
  cale: "/en",
  limba: "en",
  limbi: { ro: "/", en: "/en", "x-default": "/" },
});

export default function EnglishLanding() {
  return (
    <Cadru text={EN}>
      <PaginaLanding text={EN} />
    </Cadru>
  );
}
