// src/app/(marketing)/domenii/[domeniu]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FEATURES } from "@/config/features";
import { DOMENII, domeniulDupaSlug } from "@/content/landing/domenii";
import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";

/**
 * Cele patru pagini de domeniu, dintr-un singur fișier.
 *
 * ── DE CE O RUTĂ DINAMICĂ ȘI NU PATRU DIRECTOARE ──────────────────────────
 * Structura e identică, diferă doar textul. Patru fișiere ar fi însemnat patru
 * locuri de corectat la fiecare schimbare de aspect, iar în practică trei
 * corectate și unul uitat.
 *
 * `generateStaticParams` le pre-randează pe toate la build, deci sunt statice,
 * exact ca patru pagini scrise separat. `dynamicParams = false` face ca orice
 * alt segment să dea 404 în loc să încerce o randare la cerere — un
 * `/domenii/orice` care ar întoarce 200 cu conținut gol e mai rău decât un 404.
 *
 * ── DE CE NUMELE MODULELOR VIN DIN `FEATURES` ─────────────────────────────
 * Conținutul poartă chei, nu denumiri. O denumire scrisă de mână aici ar fi
 * rămas în urmă la prima redenumire din catalog; cu cheia, o greșeală nu trece
 * de typecheck.
 */

export const dynamicParams = false;

export function generateStaticParams(): { domeniu: string }[] {
  return DOMENII.map((d) => ({ domeniu: d.slug }));
}

type Proprietati = Readonly<{ params: Promise<{ domeniu: string }> }>;

export async function generateMetadata({ params }: Proprietati): Promise<Metadata> {
  const { domeniu } = await params;
  const d = domeniulDupaSlug(domeniu);
  if (d === undefined) return {};
  return {
    title: d.metaTitlu,
    description: d.metaDescriere,
    alternates: { canonical: `/domenii/${d.slug}` },
  };
}

export default async function PaginaDomeniu({ params }: Proprietati) {
  const { domeniu } = await params;
  const d = domeniulDupaSlug(domeniu);
  if (d === undefined) notFound();

  const celelalte = DOMENII.filter((x) => x.slug !== d.slug);

  return (
    <Cadru text={RO}>
      <AntetSecundar text={{ supratitlu: "Domeniu", titlu: d.titlu, lead: d.lead }} />

      <Banda inaltime="medie" titlu="Ce se rupe de obicei">
        <div className="border-mk-rigla/40 mt-8 border-t">
          {d.dureri.map((durere) => (
            <div
              key={durere.titlu}
              className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
            >
              <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-5">
                {durere.titlu}
              </h3>
              <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-7">
                {durere.text}
              </p>
            </div>
          ))}
        </div>
      </Banda>

      <Banda
        fundal="cerneala"
        inaltime="medie"
        titlu="Modulele care contează aici"
        lead="Sunt aceleași module ca peste tot. Se schimbă doar ordinea în care merită pornite."
        aliniereTitlu="larg"
      >
        <div className="border-mk-rigla-inv/40 mt-8 border-t">
          {d.module.map((m) => (
            <div
              key={m.cheie}
              className="border-mk-rigla-inv/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
            >
              <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                {FEATURES[m.cheie].denumire}
              </h3>
              <p className="text-mk-text-inv-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
                {m.deCe}
              </p>
            </div>
          ))}
        </div>
      </Banda>

      <Banda inaltime="medie" titlu="De la ce se începe">
        <div className="mt-6 max-w-[68ch] space-y-4">
          {d.ordinea.map((p) => (
            <p key={p} className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={RO.hero.ctaPrimar.href}
            data-umami-event={`cta-domeniu-${d.slug}`}
            className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {RO.hero.ctaPrimar.eticheta}
          </Link>
          <Link
            href="/evidenta-orelor-de-munca"
            className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
          >
            Ce cere legea la evidența orelor
          </Link>
        </div>
      </Banda>

      {/* Legătura între cele patru: fără ea, fiecare pagină e o fundătură, iar
          un vizitator care nu se regăsește exact în domeniul nimerit pleacă. */}
      <Banda inaltime="scurta" supratitlu="Celelalte domenii" titlu="Nu e domeniul tău?">
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
          {celelalte.map((alt) => (
            <Link
              key={alt.slug}
              href={`/domenii/${alt.slug}`}
              className="text-[0.9375rem] underline underline-offset-4"
            >
              {alt.eticheta}
            </Link>
          ))}
        </div>
        <p className="text-mk-text-slab mt-6 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
          {RO.verticale.nota}
        </p>
      </Banda>
    </Cadru>
  );
}
