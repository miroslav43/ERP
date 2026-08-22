// src/app/(marketing)/en/page.tsx
import type { Metadata } from "next";

import { EN } from "@/content/landing/en";

import { Cadru } from "../_componente/cadru";
import { PaginaLanding } from "../_componente/pagina";

export const metadata: Metadata = {
  title: { absolute: EN.meta.titlu },
  description: EN.meta.descriere,
  alternates: { canonical: "/en", languages: { ro: "/", en: "/en" } },
  openGraph: { locale: "en_GB", title: EN.meta.titlu, description: EN.meta.descriere },
};

export default function EnglishLanding() {
  return (
    <Cadru text={EN}>
      <PaginaLanding text={EN} />
    </Cadru>
  );
}
