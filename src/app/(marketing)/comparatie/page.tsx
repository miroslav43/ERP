// src/app/(marketing)/comparatie/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";
import { ANTET_COMPARATIE } from "@/content/legal/comparatie-excel";

import { AntetSecundar } from "../_componente/antet-secundar";
import { Banda } from "../_componente/banda";
import { Cadru } from "../_componente/cadru";
import { ListaHub } from "../_componente/lista-hub";

/**
 * Comparațiile, ca hub.
 *
 * `/comparatie` dădea 404 până la 17 sept 2026, deși `/comparatie/excel` exista.
 */
export const metadata: Metadata = {
  title: "Comparații: pontaj în Excel sau într-o aplicație",
  description:
    "Unde se rupe foaia de calcul la pontaj și unde nu se rupe deloc, inclusiv situațiile în care e mai bine să rămâi la Excel.",
  alternates: { canonical: "/comparatie" },
};

const PAGINI = [
  { href: "/comparatie/excel", titlu: ANTET_COMPARATIE.titlu, lead: ANTET_COMPARATIE.lead },
];

export default function PaginaComparatie() {
  return (
    <Cadru text={RO}>
      <AntetSecundar
        text={RO.pagini.comparatie}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Comparații", href: "/comparatie" },
        ]}
      />
      <Banda inaltime="medie" supratitlu="Toate comparațiile" titlu="Față în față">
        <ListaHub pagini={PAGINI} />
      </Banda>
    </Cadru>
  );
}
