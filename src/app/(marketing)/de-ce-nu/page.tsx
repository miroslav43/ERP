// src/app/(marketing)/de-ce-nu/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../_componente/antet-secundar";
import { BandaComparatie, BandaOnestitate } from "../_componente/benzi/incredere";
import { Cadru } from "../_componente/cadru";

/**
 * Ce NU facem.
 *
 * Contraintuitiv, e cel mai citabil conținut de pe tot situl: o listă de limite
 * asumate e informație pe care un motor generativ n-o găsește nicăieri altundeva,
 * fiindcă niciun furnizor n-o publică. Stătea la banda 12 din 19, unde nu ajungea
 * nimeni.
 *
 * Tot aici a venit și comparația „cum se lucrează azi / cum se lucrează cu noi”:
 * e aceeași conversație — ce se schimbă și ce nu — și e mai onestă lângă lista de
 * limite decât singură.
 */
export const metadata: Metadata = {
  title: "Ce nu face Administrativo",
  description:
    "Lista limitelor, scrisă înainte să întrebi: fără raportare la ANAF, fără fișier REVISAL oficial, fără aplicație în magazine. Și de ce e mai ieftin așa.",
  alternates: { canonical: "/de-ce-nu" },
};

export default function PaginaDeCeNu() {
  return (
    <Cadru text={RO}>
      <AntetSecundar text={RO.pagini.deCeNu} />
      <BandaOnestitate text={RO} />
      <BandaComparatie text={RO} />
    </Cadru>
  );
}
