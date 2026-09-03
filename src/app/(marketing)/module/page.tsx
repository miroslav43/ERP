// src/app/(marketing)/module/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../_componente/antet-secundar";
import {
  BandaEcrane,
  BandaFluxuri,
  BandaModule,
  BandaPlatforma,
  BandaRoluri,
} from "../_componente/benzi/produs";
import { Cadru } from "../_componente/cadru";

/**
 * Hub-ul de module.
 *
 * Cele șapte sute cincizeci de cuvinte ale catalogului stăteau pe pagina de
 * start, unde nu puteau ieși pe nimic: un fragment într-o pagină de 415 KB nu
 * intră întreg în ce citește un motor. Aici sunt pagina, nu secțiunea.
 *
 * Pe lângă catalog, pagina adună tot ce răspunde la „cum funcționează”:
 * legăturile dintre module, ce ecrane mai există, cum arată o lună de la un
 * capăt la altul, și cine ce vede. Sunt aceleași benzi, aceeași ordine — mutate,
 * nu rescrise.
 */
export const metadata: Metadata = {
  title: "Module Administrativo: pontaj, concedii, salarizare, SSM",
  description:
    "Cele șaptesprezece module ale Administrativo și ce face fiecare. Pornești doar ce folosești; restul nu apare nici în meniu, nici pe factură.",
  alternates: { canonical: "/module" },
};

export default function PaginaModule() {
  return (
    <Cadru text={RO}>
      <AntetSecundar text={RO.pagini.module} />
      <BandaModule text={RO} />
      <BandaPlatforma text={RO} />
      <BandaEcrane text={RO} />
      <BandaFluxuri text={RO} />
      <BandaRoluri text={RO} />
    </Cadru>
  );
}
