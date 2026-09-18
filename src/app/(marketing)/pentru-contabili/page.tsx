// src/app/(marketing)/pentru-contabili/page.tsx
import type { Metadata } from "next";

import {
  CE_NU_FACE,
  CE_PRIMESTI,
  CONTUL_TAU,
  type SectiuneContabili,
} from "@/content/landing/pentru-contabili";
import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../_componente/antet-secundar";
import { Banda } from "../_componente/banda";
import { Cadru } from "../_componente/cadru";

/**
 * Pagina contabilului.
 *
 * Tot situl vorbește cu administratorul unei firme. Contabilul e celălalt
 * cititor — cel care are zece firme, nu una, și care decide de multe ori ce
 * program folosește clientul. Pagina răspunde la întrebările lui, în ordinea în
 * care le pune: cum arată contul, ce fișiere primesc, ce nu face.
 *
 * Aceeași croială ca `/pontaj-pe-telefon`, din același motiv: sunt pagini de
 * pași, nu de obligații legale, deci nu intră pe tiparul `PaginaLege`.
 */
export const metadata: Metadata = {
  title: "Pentru contabili: un cont, toate firmele",
  description:
    "Cum arată aplicația pentru cine ține zece firme: o apartenență per client, comutare fără delogare, nota contabilă și D112 exportate, iar depunerea rămâne la tine.",
  alternates: { canonical: "/pentru-contabili" },
};

/** Pașii unei secțiuni: titlu scurt și explicația lui, pe un rând. */
function Pasi({ sectiune }: { sectiune: SectiuneContabili }) {
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

export default function PaginaPentruContabili() {
  return (
    <Cadru text={RO}>
      <AntetSecundar
        text={RO.pagini.pentruContabili}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Pentru contabili", href: "/pentru-contabili" },
        ]}
      />
      {/* Contul întâi: e întrebarea care decide dacă merită citit mai departe. */}
      <Pasi sectiune={CONTUL_TAU} />
      <Pasi sectiune={CE_PRIMESTI} />
      <Pasi sectiune={CE_NU_FACE} />
    </Cadru>
  );
}
