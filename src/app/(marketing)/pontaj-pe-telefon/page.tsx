// src/app/(marketing)/pontaj-pe-telefon/page.tsx
import type { Metadata } from "next";

import {
  CE_ALEGE_FIRMA,
  CE_NU_MERGE,
  CUM_PONTEAZA,
  type SectiunePontajTelefon,
} from "@/content/landing/pontaj-telefon";
import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../_componente/antet-secundar";
import { Banda } from "../_componente/banda";
import { BandaPontajLivrat, BandaPontajViitor } from "../_componente/benzi/produs";
import { Cadru } from "../_componente/cadru";
import { InMana } from "../_componente/in-mana";

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

/** Pașii unei secțiuni: titlu scurt și explicația lui, pe un rând. */
function Pasi({ sectiune }: { sectiune: SectiunePontajTelefon }) {
  return (
    <Banda
      inaltime="medie"
      supratitlu={sectiune.supratitlu}
      titlu={sectiune.titlu}
      {...(sectiune.lead !== undefined && { lead: sectiune.lead })}
    >
      <div className="border-mk-rigla/40 mt-8 border-t">
        {sectiune.pasi.map((pas) => (
          <div
            key={pas.titlu}
            className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
          >
            <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
              {pas.titlu}
            </h3>
            <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
              {pas.text}
            </p>
          </div>
        ))}
      </div>
    </Banda>
  );
}

export default function PaginaPontajPeTelefon() {
  return (
    <Cadru text={RO}>
      <AntetSecundar text={RO.pagini.pontajTelefon} />
      {/* Întâi drumul omului — pagina e căutată de cine vrea butonul, nu de cine
          administrează luna —, apoi ce se configurează, apoi limitele. */}
      <Pasi sectiune={CUM_PONTEAZA} />
      {/*
        Imediat după pași, nu la sfârșit: pagina descrie un buton pe care
        nimeni nu-l poate vedea din text. Ordinea capturilor o urmează pe a
        pașilor — butonul (3), ecranul de după scanare (4), apoi hârtia care
        produce scanarea.
      */}
      <InMana
        supratitlu="Ecrane reale"
        titlu="Cum arată pașii de mai sus"
        chei={["portal-pontare", "portal-scanare", "afis-pontare"]}
      />
      <Pasi sectiune={CE_ALEGE_FIRMA} />
      <BandaPontajLivrat text={RO} />
      <BandaPontajViitor text={RO} />
      <Pasi sectiune={CE_NU_MERGE} />
    </Cadru>
  );
}
