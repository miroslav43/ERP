// src/app/(marketing)/en/preturi/page.tsx
import type { Metadata } from "next";

import { EN } from "@/content/landing/en";
import { lunar, PRAG_ANGAJATI, PRET_NUCLEU } from "@/content/landing/preturi";

import { Cadru } from "../../_componente/cadru";
import { PaginaPreturi } from "../../_componente/pagina-preturi";

// Construită din tabelul canonic, ca varianta românească — vezi `preturi/page.tsx`.
export const metadata: Metadata = {
  title: "Pricing",
  description: `The Administrativo core costs ${lunar(PRET_NUCLEU, "en")} for up to ${PRAG_ANGAJATI} employees; the first month is free. Packages and the price of every module, final amounts with no VAT added.`,
  alternates: { canonical: "/en/preturi", languages: { ro: "/preturi", en: "/en/preturi" } },
};

export default function Pricing() {
  return (
    <Cadru text={EN}>
      <PaginaPreturi text={EN} />
    </Cadru>
  );
}
