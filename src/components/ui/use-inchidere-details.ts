// src/components/ui/use-inchidere-details.ts
"use client";

import { useEffect, type RefObject } from "react";

/**
 * Închide un `<details>` folosit ca meniu la Escape și la clic în afara lui.
 *
 * `<details>` se deschide și se închide nativ — fără stare React, cu tastatura
 * gratis —, dar numai prin propriul `summary`. Meniul contului rămânea deschis
 * după Escape și după un clic în pagină, peste butoanele din dreapta-sus
 * (UX-041). Hook-ul adaugă exact cele două ieșiri și nimic altceva.
 *
 * Clicul pe `summary` e ÎNĂUNTRUL elementului, deci comutarea rămâne a
 * browserului: hook-ul nu se bate cu ea. Escape mută focusul înapoi pe
 * `summary`, altfel ar rămâne pe un buton din panoul tocmai ascuns.
 *
 * Ascultătorii stau pe `document`, câte unul per instanță. Cu două meniuri
 * deschise deodată, Escape le închide pe amândouă — comportamentul așteptat.
 */
export function useInchidereDetails(ref: RefObject<HTMLDetailsElement | null>): void {
  useEffect(() => {
    function laTasta(eveniment: KeyboardEvent): void {
      const details = ref.current;
      if (details === null || !details.open || eveniment.key !== "Escape") return;
      details.open = false;
      details.querySelector("summary")?.focus();
    }

    function laApasare(eveniment: PointerEvent): void {
      const details = ref.current;
      if (details === null || !details.open) return;
      const tinta = eveniment.target;
      if (tinta instanceof Node && details.contains(tinta)) return;
      details.open = false;
    }

    document.addEventListener("keydown", laTasta);
    document.addEventListener("pointerdown", laApasare);
    return () => {
      document.removeEventListener("keydown", laTasta);
      document.removeEventListener("pointerdown", laApasare);
    };
  }, [ref]);
}
