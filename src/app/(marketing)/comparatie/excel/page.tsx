// src/app/(marketing)/comparatie/excel/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import {
  ANTET_COMPARATIE,
  CAND_RAMAI,
  CE_SE_PASTREAZA,
  PERECHI,
} from "@/content/legal/comparatie-excel";
import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";

/**
 * Pontaj în Excel sau în aplicație.
 *
 * Concurentul real al produsului nu e alt program, e foaia de calcul: așa
 * lucrează majoritatea firmelor de 5-50 de oameni. Cine caută comparația asta
 * nu caută un produs, caută un răspuns la „chiar merită să schimb?".
 *
 * Pagina conține o secțiune în care răspunsul e „nu". Nu din modestie: o
 * comparație care pierde de fiecare dată se citește ca reclamă, iar cititorul
 * atent — exact cel care caută comparații înainte să cumpere — o închide.
 */
export const metadata: Metadata = {
  title: "Pontaj în Excel sau în aplicație: când merită schimbarea",
  description:
    "Unde se rupe foaia de calcul la pontaj și unde nu se rupe deloc. Comparație pe opt aspecte concrete, plus situațiile în care e în regulă să rămâi la Excel.",
  alternates: { canonical: "/comparatie/excel" },
};

export default function PaginaComparatieExcel() {
  return (
    <Cadru text={RO}>
      <AntetSecundar text={ANTET_COMPARATIE} />

      <Banda inaltime="medie">
        <div className="border-mk-rigla/40 border-t">
          <div className="border-mk-rigla/40 hidden border-b py-3 md:grid md:grid-cols-12 md:gap-8">
            <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase md:col-span-3">
              Aspect
            </p>
            <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase md:col-span-4">
              În Excel
            </p>
            <p className="font-mk-date border-mk-rigla/40 text-[0.6875rem] font-medium tracking-[0.14em] uppercase md:col-span-5 md:border-l md:pl-8">
              În Administrativo
            </p>
          </div>
          {PERECHI.map((p) => (
            <div
              key={p.aspect}
              className="border-mk-rigla/40 grid gap-3 border-b py-5 md:grid-cols-12 md:gap-8"
            >
              <p className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-3">
                {p.aspect}
              </p>
              <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-4">
                {p.excel}
              </p>
              <p className="border-mk-rigla/40 text-[0.9375rem] leading-[1.6] md:col-span-5 md:border-l md:pl-8">
                {p.aplicatie}
              </p>
            </div>
          ))}
        </div>
      </Banda>

      {/*
        Secțiunea în care răspunsul e „rămâi la Excel". E partea care face
        pagina credibilă, deci nu se scoate când vine presiunea de conversie.
      */}
      <Banda fundal="cerneala" inaltime="medie" titlu={CAND_RAMAI.titlu} aliniereTitlu="larg">
        <div className="mt-8 max-w-[68ch] space-y-4">
          {CAND_RAMAI.paragrafe.map((p) => (
            <p key={p} className="text-mk-text-inv-slab text-[0.9375rem] leading-[1.7]">
              {p}
            </p>
          ))}
        </div>
      </Banda>

      <Banda inaltime="medie" titlu={CE_SE_PASTREAZA.titlu}>
        <div className="mt-6 max-w-[68ch] space-y-4">
          {CE_SE_PASTREAZA.paragrafe.map((p) => (
            <p key={p} className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={RO.hero.ctaPrimar.href}
            data-umami-event="cta-comparatie-excel"
            className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {RO.hero.ctaPrimar.eticheta}
          </Link>
          <Link
            href="/pontaj-pe-telefon"
            className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
          >
            Cum se pontează
          </Link>
        </div>
      </Banda>
    </Cadru>
  );
}
