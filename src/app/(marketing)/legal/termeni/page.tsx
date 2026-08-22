// src/app/(marketing)/legal/termeni/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { Cadru } from "../../_componente/cadru";

export const metadata: Metadata = {
  title: "Termeni și condiții",
  description:
    "Schelet de termeni și condiții pentru Administrativo, în curs de redactare juridică.",
};

const SECTIUNI = [
  {
    titlu: "1. Părțile contractante",
    nota: "Denumirea completă a furnizorului, CUI, sediu, date de contact și reprezentant legal.",
  },
  {
    titlu: "2. Obiectul serviciului",
    nota: "Ce anume se pune la dispoziție, sub formă de abonament, și ce nu este inclus.",
  },
  {
    titlu: "3. Conturi, roluri și responsabilitatea clientului",
    nota: "Cine administrează conturile din organizație și cine răspunde pentru accesul acordat colegilor.",
  },
  {
    titlu: "4. Planuri, prețuri și facturare",
    nota: "Planurile disponibile, limita de utilizatori, perioada de probă, modul și termenul de facturare.",
  },
  {
    titlu: "5. Disponibilitate și suport",
    nota: "Nivelul de disponibilitate asumat, ferestrele de mentenanță și canalele de suport.",
  },
  {
    titlu: "6. Datele clientului",
    nota: "Cine deține datele introduse, cum se exportă și ce se întâmplă cu ele la încetarea contractului.",
  },
  { titlu: "7. Utilizare acceptabilă", nota: "Interdicții clare și consecințele încălcării lor." },
  {
    titlu: "8. Limitarea răspunderii",
    nota: "Plafon de răspundere și excluderi, formulate conform legislației aplicabile.",
  },
  {
    titlu: "9. Suspendarea și încetarea",
    nota: "Motivele de suspendare a organizației, termenul de notificare și procedura de reziliere.",
  },
  {
    titlu: "10. Modificarea termenilor",
    nota: "Cum se anunță modificările și de când produc efecte.",
  },
  {
    titlu: "11. Legea aplicabilă și soluționarea litigiilor",
    nota: "Legea română, instanțe competente, ANPC și platforma SOL.",
  },
] as const;

export default function PaginaTermeni() {
  return (
    <Cadru text={RO}>
      <div className="mx-auto w-full max-w-3xl px-[clamp(1rem,4vw,2.5rem)] py-16 sm:py-24">
        <h1 className="font-mk-display text-[clamp(2rem,4vw,3rem)] leading-[1.04] font-semibold tracking-[-0.02em]">
          Termeni și condiții
        </h1>
        <p className="text-mk-text-slab mt-4 text-base leading-relaxed">
          Documentul este în curs de redactare. Preferăm să spunem deschis acest lucru decât să
          publicăm un text care pare valabil juridic, dar nu este. Mai jos este structura convenită,
          cu marcajele rămase de completat.
        </p>
        <p className="border-mk-sl bg-mk-sl-hartie text-mk-sl-apasat mt-6 rounded border p-4 text-sm">
          DE COMPLETAT DE JURIST — niciunul dintre paragrafele de mai jos nu are, în acest moment,
          valoare contractuală.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIUNI.map((sectiune) => (
            <section key={sectiune.titlu}>
              <h2 className="font-mk-display text-[1.125rem] font-semibold">{sectiune.titlu}</h2>
              <p className="text-mk-text-slab mt-2 text-sm leading-relaxed">{sectiune.nota}</p>
              <p className="text-mk-sl-apasat mt-2 text-sm font-medium">DE COMPLETAT DE JURIST</p>
            </section>
          ))}
        </div>
      </div>
    </Cadru>
  );
}
