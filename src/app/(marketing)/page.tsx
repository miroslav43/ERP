// src/app/(marketing)/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { Cadru } from "./_componente/cadru";
import { PaginaLanding } from "./_componente/pagina";

export const metadata: Metadata = {
  title: { absolute: RO.meta.titlu },
  description: RO.meta.descriere,
  alternates: { canonical: "/", languages: { ro: "/", en: "/en" } },
};

export default function PaginaPrincipala() {
  return (
    <Cadru text={RO}>
      <PaginaLanding text={RO} />
    </Cadru>
  );
}
