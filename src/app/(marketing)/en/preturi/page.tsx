// src/app/(marketing)/en/preturi/page.tsx
import type { Metadata } from "next";

import { EN } from "@/content/landing/en";

import { Cadru } from "../../_componente/cadru";
import { PaginaPreturi } from "../../_componente/pagina-preturi";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Administrativo plans and the modules each one includes. Pricing is on request, based on headcount and the modules you switch on.",
  alternates: { canonical: "/en/preturi", languages: { ro: "/preturi", en: "/en/preturi" } },
};

export default function Pricing() {
  return (
    <Cadru text={EN}>
      <PaginaPreturi text={EN} />
    </Cadru>
  );
}
