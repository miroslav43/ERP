// src/app/(marketing)/preturi/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { Cadru } from "../_componente/cadru";
import { PaginaPreturi } from "../_componente/pagina-preturi";

export const metadata: Metadata = {
  title: "Prețuri",
  description:
    "Planurile Administrativo și modulele incluse în fiecare. Prețul se dă la cerere, în funcție de numărul de angajați și de modulele pornite.",
  alternates: { canonical: "/preturi", languages: { ro: "/preturi", en: "/en/preturi" } },
};

export default function Preturi() {
  return (
    <Cadru text={RO}>
      <PaginaPreturi text={RO} />
    </Cadru>
  );
}
