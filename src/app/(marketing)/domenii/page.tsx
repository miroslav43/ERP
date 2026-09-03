// src/app/(marketing)/domenii/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../_componente/antet-secundar";
import { BandaVerticale } from "../_componente/benzi/incredere";
import { Cadru } from "../_componente/cadru";

/**
 * Domeniile, ca pagină.
 *
 * În subsol existau patru etichete distincte — construcții, producție,
 * transport, servicii — care duceau TOATE la aceeași ancoră, `/#verticale`.
 * Patru promisiuni de navigare și o singură destinație.
 *
 * Aici e o pagină reală pentru toate patru. Împărțirea în
 * `/domenii/constructii` și celelalte cere text propriu pentru fiecare, nu
 * aceleași patru rânduri redistribuite — deci e o livrare separată, nu o
 * redenumire de rută.
 */
export const metadata: Metadata = {
  title: "Administrativo pe domenii: construcții, producție, transport",
  description:
    "Aceleași module, altă ordine de pornire. Ce se schimbă pentru firmele din construcții, producție, transport și servicii — și ce rămâne la fel.",
  alternates: { canonical: "/domenii" },
};

export default function PaginaDomenii() {
  return (
    <Cadru text={RO}>
      <AntetSecundar text={RO.pagini.domenii} />
      <BandaVerticale text={RO} />
    </Cadru>
  );
}
