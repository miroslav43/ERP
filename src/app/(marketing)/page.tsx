// src/app/(marketing)/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { Cadru } from "./_componente/cadru";
import { metadatePagina } from "./_componente/metadate";
import { PaginaLanding } from "./_componente/pagina";

export const metadata: Metadata = metadatePagina({
  titlu: RO.meta.titlu,
  titluAbsolut: true,
  descriere: RO.meta.descriere,
  cale: "/",
  limbi: { ro: "/", en: "/en", "x-default": "/" },
});

export default function PaginaPrincipala() {
  return (
    <Cadru text={RO}>
      <PaginaLanding text={RO} />
    </Cadru>
  );
}
