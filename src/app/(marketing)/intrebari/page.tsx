// src/app/(marketing)/intrebari/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../_componente/antet-secundar";
import { BandaIntrebari } from "../_componente/benzi/comercial";
import { Cadru } from "../_componente/cadru";

/**
 * Întrebările frecvente, ca pagină.
 *
 * NU se marchează cu `FAQPage`: rezultatele îmbogățite s-au retras la 7 mai
 * 2026, iar un marcaj care nu mai produce nimic e cod care pretinde că lucrează.
 * Ce rămâne valoros e structura însăși — o întrebare urmată imediat de răspunsul
 * ei e unitatea pe care un motor o poate cita întreagă, indiferent de marcaj.
 */
export const metadata: Metadata = {
  title: "Întrebări frecvente despre Administrativo",
  description:
    "Ce ne întreabă firmele înainte să semneze: cum se face pontajul, cine vede ce, ce se întâmplă cu datele la plecare, de ce nu scrie prețul pe site.",
  alternates: { canonical: "/intrebari" },
};

export default function PaginaIntrebari() {
  return (
    <Cadru text={RO}>
      <AntetSecundar text={RO.pagini.intrebari} />
      <BandaIntrebari text={RO} />
    </Cadru>
  );
}
