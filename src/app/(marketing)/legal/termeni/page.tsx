// src/app/(marketing)/legal/termeni/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";
import {
  AVERTISMENT,
  DATA_TERMENI,
  SECTIUNI_ANEXA,
  SECTIUNI_TERMENI,
  VERSIUNE_TERMENI,
  type SectiuneLegala,
} from "@/content/legal/termeni";

import { Cadru } from "../../_componente/cadru";

/**
 * Termenii și condițiile.
 *
 * Pagina era un SCHELET: titluri de secțiune cu note „ce va scrie aici" și
 * marcajul „DE COMPLETAT DE JURIST" repetat de zece ori. Onest, dar inutil —
 * iar de când situl publică prețuri și are un formular cu bifă de acceptare, e
 * și insuficient: bifa trimite undeva.
 *
 * Acum e o redactare completă. Ce rămâne neschimbat e onestitatea despre stadiu:
 * avertismentul de sus spune că textul n-a trecut încă pe la un jurist, o
 * singură dată și la vedere, în loc de zece marcaje care goleau fiecare
 * secțiune de sens.
 */
export const metadata: Metadata = {
  title: "Termeni și condiții",
  description:
    "Condițiile în care se folosește Administrativo: obiect, preț, durată, disponibilitate, răspundere, plus anexa de prelucrare a datelor cerută de articolul 28 din RGPD.",
  // Fără `languages`: pagina n-are variantă engleză, iar o pereche hreflang
  // declarată către o rută inexistentă invalidează întreaga grupă, nu doar
  // rândul greșit. Se adaugă odată cu traducerea, nu înainte.
  alternates: { canonical: "/legal/termeni" },
};

function Sectiuni({ sectiuni }: { sectiuni: readonly SectiuneLegala[] }) {
  return (
    <div className="mt-10 space-y-9">
      {sectiuni.map((sectiune) => (
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
  );
}

export default function PaginaTermeni() {
  return (
    <Cadru text={RO}>
      <div className="mx-auto w-full max-w-3xl px-[clamp(1rem,4vw,2.5rem)] py-16 sm:py-24">
        <h1 className="font-mk-display text-[clamp(2rem,4vw,3rem)] leading-[1.04] font-semibold tracking-[-0.02em]">
          Termeni și condiții
        </h1>
        <p className="font-mk-date text-mk-text-slab mt-4 text-[0.6875rem] tracking-[0.14em] uppercase">
          Versiunea {VERSIUNE_TERMENI} · {DATA_TERMENI}
        </p>

        {/*
          Un singur avertisment, sus, în locul celor zece marcaje care goleau
          fiecare secțiune. Spune același lucru — textul n-a trecut pe la un
          jurist — dar lasă documentul să fie citit.
        */}
        <p className="border-mk-sl bg-mk-sl-hartie text-mk-sl-apasat mt-6 rounded border p-4 text-[0.875rem] leading-[1.6]">
          {AVERTISMENT}
        </p>

        <Sectiuni sectiuni={SECTIUNI_TERMENI} />

        <div className="border-mk-rigla mt-16 border-t pt-10">
          <h2 className="font-mk-display text-[1.5rem] leading-[1.15] font-semibold tracking-[-0.015em]">
            Anexă — prelucrarea datelor cu caracter personal
          </h2>
          <p className="text-mk-text-slab mt-3 text-[0.9375rem] leading-[1.7]">
            Anexa are valoarea acordului dintre operator și persoana împuternicită cerut de
            articolul 28 din Regulamentul general privind protecția datelor. Face parte din contract
            și se aplică din momentul creării contului.
          </p>
          <Sectiuni sectiuni={SECTIUNI_ANEXA} />
        </div>
      </div>
    </Cadru>
  );
}
