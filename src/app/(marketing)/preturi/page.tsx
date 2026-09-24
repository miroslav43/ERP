// src/app/(marketing)/preturi/page.tsx
import type { Metadata } from "next";

import { lunar, PRAG_ANGAJATI, PRET_NUCLEU } from "@/content/landing/preturi";
import { RO } from "@/content/landing/ro";

import { Cadru } from "../_componente/cadru";
import { metadatePagina } from "../_componente/metadate";
import { PaginaPreturi } from "../_componente/pagina-preturi";

/**
 * Descrierea e fragmentul pe care îl afișează motorul de căutare, deci se
 * construiește din tabelul canonic. Până la 17 sept 2026 spunea „Prețul se dă la
 * cerere” deasupra unui H1 cu „149 de lei pe lună” — aceeași pagină își nega
 * prețul chiar în rezultatul de căutare.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Prețuri",
  descriere: `Nucleul Administrativo costă ${lunar(PRET_NUCLEU, "ro")}, până la ${PRAG_ANGAJATI} de angajați; prima lună e gratuită. Pachetele și prețul fiecărui modul, sume finale, fără TVA adăugat.`,
  cale: "/preturi",
  limbi: { ro: "/preturi", en: "/en/preturi", "x-default": "/preturi" },
});

export default function Preturi() {
  return (
    <Cadru text={RO}>
      <PaginaPreturi text={RO} />
    </Cadru>
  );
}
