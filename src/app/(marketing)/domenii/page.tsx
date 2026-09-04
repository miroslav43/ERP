// src/app/(marketing)/domenii/page.tsx
import type { Metadata } from "next";

import Link from "next/link";

import { DOMENII } from "@/content/landing/domenii";
import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../_componente/antet-secundar";
import { Banda } from "../_componente/banda";
import { BandaVerticale } from "../_componente/benzi/incredere";
import { Cadru } from "../_componente/cadru";

/**
 * Domeniile, ca hub.
 *
 * În subsol existau patru etichete distincte — construcții, producție,
 * transport, servicii — care duceau TOATE la aceeași ancoră, `/#verticale`.
 * Patru promisiuni de navigare și o singură destinație.
 *
 * Fiecare are acum pagina lui, cu text propriu: `/domenii/<slug>`. Pagina asta
 * a rămas rezumatul comparativ — se citește când nu știi încă în care dintre
 * cele patru te regăsești — și trimite mai departe.
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

      <Banda
        inaltime="medie"
        supratitlu="În detaliu"
        titlu="Fiecare domeniu, pe larg"
        lead="Ce se rupe de obicei, ce module contează și de la care se începe — scris separat pentru fiecare."
      >
        <div className="border-mk-rigla/40 mt-8 border-t">
          {DOMENII.map((d) => (
            <Link
              key={d.slug}
              href={`/domenii/${d.slug}`}
              className="border-mk-rigla/40 hover:bg-mk-text/[0.02] grid gap-2 border-b py-5 transition-colors md:grid-cols-12 md:gap-8"
            >
              <span className="font-mk-display text-[1.0625rem] leading-[1.25] font-semibold md:col-span-4">
                {d.eticheta}
              </span>
              <span className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
                {d.lead}
              </span>
            </Link>
          ))}
        </div>
      </Banda>
    </Cadru>
  );
}
