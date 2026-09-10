// src/app/(app)/pontaj/buton-setari.tsx
import Link from "next/link";
import type { ReactElement } from "react";

import { buton } from "@/components/ui/buton";

/**
 * Butonul de configurare al modulului de pontaj, pentru colțul din dreapta sus
 * al oricărui ecran din `/pontaj`.
 *
 * ── DE CE ÎNAPOI ÎN ANTET, DUPĂ CE FUSESE MUTAT ÎN BANDĂ ──────────────────
 * Configurarea a stat întâi ca buton scris de mână în antetul foii colective,
 * apoi ca filă în banda de navigare. Al doilea pas rezolva o problemă reală —
 * butonul exista pe UN singur ecran, deci dispărea la orice pas în lateral —
 * dar o rezolva mutând lucrul greșit: banda de file e pentru VIZUALIZĂRI ale
 * aceluiași pontaj (prezența, planul, perioadele, aprobarea, arhiva), iar o
 * filă către un ecran de administrare stă în același rând cu ele și se citește
 * ca a șasea vizualizare.
 *
 * Concediile rezolvaseră deja aceeași problemă altfel, și mai bine: o
 * componentă unică, pusă în antetul FIECĂRUI ecran al modulului. Butonul nu mai
 * dispare la schimbarea filei, iar banda rămâne ce spune că e. Pontajul face
 * acum la fel — vezi `concedii/buton-setari.tsx`, geamănul acestui fișier.
 *
 * ── CE NU E ───────────────────────────────────────────────────────────────
 * `poateConfigura` vine din `fileDePontaj`, adică `attendance:update` pe scope
 * `all` — aceeași cheie pe care o cere pagina țintă. Ascunderea butonului NU e
 * bariera: `/pontaj/setari` își verifică din nou permisiunea, iar RLS respinge
 * scrierile chiar dacă cineva tastează ruta direct. Butonul lipsește pentru că
 * unul care se vede și răspunde „nu aveți dreptul" e mai rău decât niciunul.
 */
export function ButonSetariPontaj({
  poateConfigura,
}: {
  readonly poateConfigura: boolean;
}): ReactElement | null {
  if (!poateConfigura) return null;

  return (
    <Link href="/pontaj/setari" className={buton({ varianta: "secundar" })}>
      Setări
    </Link>
  );
}
