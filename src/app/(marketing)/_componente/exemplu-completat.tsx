// src/app/(marketing)/_componente/exemplu-completat.tsx
import {
  adresaExemplu,
  descarcareExemplu,
  LATURA_CAPTURA,
  srcCaptura,
  type ExempluUnealta,
} from "@/content/landing/exemple-unelte";

import { Banda } from "./banda";

/**
 * Banda „Model completat”: captura exemplului, legătura care îl deschide în
 * unealtă și descărcarea lui.
 *
 * Atributele `data-exemplu*` sunt citite de `scripts/capturi/capturi-unelte.mjs`:
 * scriptul găsește aici unde să ducă browserul și ce fișiere să scrie, deci
 * lista exemplelor nu se repetă în script.
 */
export function ExempluCompletat({ exemplu }: Readonly<{ exemplu: ExempluUnealta | undefined }>) {
  if (exemplu === undefined) return null;
  return (
    <div data-tipar="ascunde">
      <Banda inaltime="scurta" supratitlu="Model completat" titlu="Cum arată completat">
        <figure
          className="mt-6 max-w-[36rem]"
          data-exemplu=""
          data-exemplu-mic={srcCaptura(exemplu, 600)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element --
              capturi statice, deja la mărimea finală (600 și 1200 px, WebP),
              ca în `prin-geam.tsx`: optimizatorul n-ar avea ce adăuga. */}
          <img
            src={srcCaptura(exemplu, 1200)}
            srcSet={`${srcCaptura(exemplu, 600)} 600w, ${srcCaptura(exemplu, 1200)} 1200w`}
            sizes="(min-width: 640px) 36rem, 100vw"
            width={LATURA_CAPTURA}
            height={LATURA_CAPTURA}
            alt={exemplu.alt}
            loading="lazy"
            decoding="async"
            className="border-mk-rigla h-auto w-full border"
          />
          <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
            <a
              href={adresaExemplu(exemplu)}
              data-exemplu-adresa=""
              className="underline underline-offset-4"
            >
              Deschide exemplul și schimbă datele
            </a>
            <a
              href={descarcareExemplu(exemplu, "pdf")}
              data-umami-event={`${exemplu.api}-exemplu-pdf`}
              className="underline underline-offset-4"
            >
              Descarcă exemplul în PDF
            </a>
          </figcaption>
        </figure>
      </Banda>
    </div>
  );
}
