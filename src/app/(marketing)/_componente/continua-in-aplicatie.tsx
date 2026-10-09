import Link from "next/link";

import { adresaInregistrare, ctaPentru, pretPentru } from "@/content/landing/cta-unelte";
import { RO } from "@/content/landing/ro";
import { slugModul } from "@/content/landing/slug-module";
import type { ParametriPagina } from "@/lib/unelte/masurare";

import { areDateDeFormular } from "./adresa-analitice";
import { Banda } from "./banda";
import { RevelareDupaDescarcare } from "./revelare-dupa-descarcare";

/** Adevărat dacă vizitatorul a completat ceva: aceeași listă albă ca statistica (A2). */
export function aGenerat(p: ParametriPagina): boolean {
  const q = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(p)) {
    if (valoare === undefined) continue;
    for (const v of Array.isArray(valoare) ? valoare : [valoare]) q.append(cheie, v);
  }
  return areDateDeFormular(`?${q.toString()}`);
}

/**
 * Îndemnul de după document. Randat mereu, ascuns până la generare sau până la
 * primul clic pe o descărcare; ascuns și la tipar (`data-tipar="ascunde"`).
 */
export function ContinuaInAplicatie({
  unealta,
  generat,
}: Readonly<{ unealta: string; generat: boolean }>) {
  const cta = ctaPentru(unealta);
  const id = `continua-${unealta}`;
  return (
    <div id={id} hidden={!generat} data-tipar="ascunde">
      <Banda inaltime="scurta" supratitlu="Mai departe" titlu={cta.titlu} lead={cta.text}>
        <p className="text-mk-text-slab mt-4 max-w-[62ch] text-[0.9375rem] leading-[1.6]">
          {pretPentru(cta.modul)}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={adresaInregistrare(unealta, "dupa-document")}
            data-umami-event={`cta-${unealta}`}
            className="bg-mk-cerneala text-mk-text-inv inline-flex min-h-12 items-center rounded px-6 py-3 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {RO.hero.ctaPrimar.eticheta}
          </Link>
          <Link
            href={`/module/${slugModul(cta.modul)}`}
            data-umami-event={`modul-din-${unealta}`}
            className="border-mk-rigla hover:border-mk-text inline-flex min-h-12 items-center rounded border px-6 py-3 text-[0.9375rem] font-medium transition-colors"
          >
            Cum arată în aplicație
          </Link>
        </div>
      </Banda>
      <RevelareDupaDescarcare tinta={id} />
    </div>
  );
}
