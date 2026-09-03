// src/app/(marketing)/incredere/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../_componente/antet-secundar";
import { BandaConformitate, BandaIzolare } from "../_componente/benzi/incredere";
import { Cadru } from "../_componente/cadru";

/**
 * Pagina de încredere: unde stă bariera dintre firme și ce reguli românești sunt
 * în produs.
 *
 * E întrebarea de la a treia vizită, nu de la prima — de aceea nu mai ocupă două
 * benzi pe pagina de start. Dar e și singura pagină care poate fi trimisă ca
 * răspuns când cineva întreabă „unde stau datele noastre?”, iar un link nu se
 * poate trimite către o ancoră dintr-o pagină de patru mii de cuvinte.
 */
export const metadata: Metadata = {
  title: "Securitatea datelor de personal: izolarea între firme",
  description:
    "Cum ține Administrativo datele fiecărei firme separate: regula e impusă în Postgres, nu în aplicație. Plus termenele de păstrare, pe fiecare fel de dată.",
  alternates: { canonical: "/incredere" },
};

export default function PaginaIncredere() {
  return (
    <Cadru text={RO}>
      <AntetSecundar text={RO.pagini.incredere} />
      <BandaIzolare text={RO} />
      <BandaConformitate text={RO} />
    </Cadru>
  );
}
