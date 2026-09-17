// src/app/(marketing)/legal/confidentialitate/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";
import {
  AVERTISMENT_CONFIDENTIALITATE,
  DATA_CONFIDENTIALITATE,
  SECTIUNI_CONFIDENTIALITATE,
} from "@/content/legal/confidentialitate";

import { Cadru } from "../../_componente/cadru";

/**
 * Politica de confidențialitate.
 *
 * Aceeași transformare ca la `legal/termeni`: pagina era un schelet — note „ce
 * va scrie aici” și „DE COMPLETAT DE JURIST” sub fiecare dintre cele zece
 * secțiuni, plus o locație a serverelor „DE CONFIRMAT” pe care termenii o
 * spuneau deja. Bara de consimțământ trimite aici, deci scheletul era exact
 * documentul pe care îl citea cineva înainte să apese „Accept”.
 *
 * Textul vine acum din `content/legal/confidentialitate.ts`, redactat din cod;
 * stadiul juridic se spune o dată, sus.
 */
export const metadata: Metadata = {
  title: "Politica de confidențialitate",
  description:
    "Ce date prelucrează Administrativo, de ce, cât le păstrează, cine are acces și care sunt drepturile tale conform GDPR. Document în curs de validare juridică.",
  // Vezi nota din `legal/termeni`: canonical da, `languages` nu — nu există
  // varianta engleză.
  alternates: { canonical: "/legal/confidentialitate" },
};

export default function PaginaConfidentialitate() {
  return (
    <Cadru text={RO}>
      <div className="mx-auto w-full max-w-3xl px-[clamp(1rem,4vw,2.5rem)] py-16 sm:py-24">
        <h1 className="font-mk-display text-[clamp(2rem,4vw,3rem)] leading-[1.04] font-semibold tracking-[-0.02em]">
          Politica de confidențialitate
        </h1>
        <p className="font-mk-date text-mk-text-slab mt-4 text-[0.6875rem] tracking-[0.14em] uppercase">
          Actualizată la {DATA_CONFIDENTIALITATE}
        </p>

        <p className="border-mk-sl bg-mk-sl-hartie text-mk-sl-apasat mt-6 rounded border p-4 text-[0.875rem] leading-[1.6]">
          {AVERTISMENT_CONFIDENTIALITATE}
        </p>

        <div className="mt-10 space-y-9">
          {SECTIUNI_CONFIDENTIALITATE.map((sectiune) => (
            <section key={sectiune.titlu}>
              <h2 className="font-mk-display text-[1.125rem] leading-[1.3] font-semibold">
                {sectiune.titlu}
              </h2>
              {sectiune.paragrafe.map((paragraf) => (
                <p key={paragraf} className="text-mk-text-slab mt-3 text-[0.9375rem] leading-[1.7]">
                  {paragraf}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </Cadru>
  );
}
