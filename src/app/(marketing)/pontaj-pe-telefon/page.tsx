// src/app/(marketing)/pontaj-pe-telefon/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../_componente/antet-secundar";
import { BandaPontajLivrat, BandaPontajViitor } from "../_componente/benzi/produs";
import { Cadru } from "../_componente/cadru";

/**
 * Pontajul de pe telefon.
 *
 * E singurul loc unde un diferențiator tehnic real — aplicația se adaugă pe
 * ecranul de start din browser, fără magazin de aplicații — corespunde unei
 * interogări pe care oamenii chiar o tastează. Pe pagina de start era una dintre
 * nouăsprezece benzi; aici e subiectul.
 *
 * Cele două benzi rămân împreună, în ordinea asta: hârtia spune ce merge azi,
 * cerneala ce e pe foaia de parcurs. Despărțite, fraza-graniță dintre ele —
 * „de aici în jos vorbesc despre ce vreau să construiesc” — rămâne fără obiect.
 */
export const metadata: Metadata = {
  title: "Aplicație de pontaj pe telefon, fără instalare",
  description:
    "Pontaj de pe telefonul angajatului, direct din browser: se adaugă pe ecranul de start, merge pe Android și iPhone, fără cont în magazinul de aplicații.",
  alternates: { canonical: "/pontaj-pe-telefon" },
};

export default function PaginaPontajPeTelefon() {
  return (
    <Cadru text={RO}>
      <AntetSecundar text={RO.pagini.pontajTelefon} />
      <BandaPontajLivrat text={RO} />
      <BandaPontajViitor text={RO} />
    </Cadru>
  );
}
