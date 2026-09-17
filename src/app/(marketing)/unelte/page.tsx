// src/app/(marketing)/unelte/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";
import { ANTET_FOAIE_PONTAJ } from "@/content/landing/unelte";

import { AntetSecundar } from "../_componente/antet-secundar";
import { Banda } from "../_componente/banda";
import { Cadru } from "../_componente/cadru";
import { ListaHub } from "../_componente/lista-hub";

/**
 * Uneltele gratuite, ca hub.
 *
 * `/unelte` dădea 404 până la 17 sept 2026, deși `/unelte/foaie-de-pontaj` exista.
 * O singură unealtă azi; lista se scrie ca listă ca a doua să nu ceară o pagină
 * nouă.
 */
export const metadata: Metadata = {
  title: "Unelte gratuite pentru HR: foaie de pontaj lunar",
  description:
    "Unelte care se folosesc fără cont: foaia de pontaj lunar cu sărbătorile legale calculate, de tipărit sau descărcat în Excel.",
  alternates: { canonical: "/unelte" },
};

const PAGINI = [
  {
    href: "/unelte/foaie-de-pontaj",
    titlu: ANTET_FOAIE_PONTAJ.titlu,
    lead: ANTET_FOAIE_PONTAJ.lead,
  },
];

export default function PaginaUnelte() {
  return (
    <Cadru text={RO}>
      <AntetSecundar
        text={RO.pagini.unelte}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Unelte", href: "/unelte" },
        ]}
      />
      <Banda inaltime="medie" supratitlu="Toate uneltele" titlu="Gata de folosit">
        <ListaHub pagini={PAGINI} />
      </Banda>
    </Cadru>
  );
}
