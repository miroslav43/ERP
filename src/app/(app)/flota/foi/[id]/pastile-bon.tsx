// src/app/(app)/flota/foi/[id]/pastile-bon.tsx

import { Badge } from "@/components/ui/badge";
import { diferenteFataDeBon } from "@/domain/fleet/bon-ocr";
import type { Alimentare } from "@/lib/queries/fleet";

/**
 * Ce s-a citit de pe bon, lângă alimentare (F12a §8.12), pentru cine aprobă
 * foaia: „Citit de pe bon”, „Diferă de bon” cu diferențele scrise, și „Poza a
 * fost schimbată după citire” când calea pozei nu mai e cea citită.
 *
 * Prinde greșelile de bună-credință, nu frauda: citirea e opțională, iar o
 * alimentare fără propunere arată normal (pastila „Necitit” e la cerere, M2).
 * Diferențele se scriu ca text, nu doar în `title`: pe telefon nu există hover.
 *
 * Fără „use client”: randat pe server, în celula tabelului, pe ambele foi
 * (`/flota/foi/[id]` și portalul).
 */
export function PastileBon({ alimentare }: Readonly<{ alimentare: Alimentare }>) {
  const propunere = alimentare.ocr_propunere;
  if (propunere === null) return null;
  const diferente = diferenteFataDeBon(alimentare, propunere);
  const pozaSchimbata = propunere.cale !== alimentare.fisier_bon_path;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      <Badge ton="neutru">Citit de pe bon</Badge>
      {diferente.length === 0 ? null : <Badge ton="atentie">Diferă de bon</Badge>}
      {pozaSchimbata ? <Badge ton="atentie">Poza a fost schimbată după citire</Badge> : null}
      {diferente.length === 0 ? null : (
        <span className="text-muted-foreground block w-full text-xs">
          {diferente.map((d) => d.text).join(" · ")}
        </span>
      )}
    </span>
  );
}
