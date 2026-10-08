"use client";

import { useEffect } from "react";

import { FUNCTIE_UMAMI, pregatestePentruUmami, type PayloadUmami } from "./adresa-analitice";

/**
 * Pune pe `window` funcția numită în `data-before-send` a scriptului Umami.
 *
 * Umami 3.3.1 o caută ca `window[nume]` la FIECARE trimitere (afișare,
 * eveniment, `performance`, `track(fn)` din `masurare-citire.tsx`), deci
 * ajunge să existe înainte de prima. Efectul rulează la hidratare, iar
 * scriptul `afterInteractive` se execută abia după ce sosește din rețea.
 *
 * Tăierea query string-ului o face Umami însuși (`data-exclude-search`).
 * Funcția readaugă doar campania paginii curente și curăță încă o dată
 * `url`/`referrer`, ca plasă dacă atributul ar dispărea. Dacă funcția
 * lipsește, se pierd doar UTM-urile, nu se scurge nimic.
 *
 * Nu se scoate la demontare: scriptul rămâne viu în document după o navigare
 * soft, iar fără funcție ar trimite tot fără query, doar fără UTM.
 */
export function PregatireUmami() {
  useEffect(() => {
    (window as unknown as Record<string, unknown>)[FUNCTIE_UMAMI] = (
      _tip: string,
      payload: PayloadUmami,
    ): PayloadUmami => pregatestePentruUmami(payload, window.location.href);
  }, []);

  return null;
}
