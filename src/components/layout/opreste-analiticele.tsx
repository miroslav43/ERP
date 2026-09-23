"use client";

import { useEffect } from "react";

import { ID_GA } from "@/app/(marketing)/_componente/analitice";

/**
 * Stinge analiticele dacă au supraviețuit intrării în aplicație.
 *
 * ── DEFECTUL PE CARE ÎL ACOPERĂ ─────────────────────────────────────────────
 * `Analitice` e montată doar în `(marketing)`, iar comentariul de acolo explică
 * de ce: montată la rădăcină, ar trimite la Google căile din interiorul
 * aplicației — `/angajati/<uuid>`, `/salarizare/2026-08`, `?q=<nume>`. Într-un
 * produs de HR, până și lista rutelor vizitate spune ceva despre oamenii unei
 * firme.
 *
 * Numai că montarea decide unde PORNEȘTE scriptul, nu unde se OPREȘTE. Grupurile
 * de rute din App Router împart același document: un vizitator care apasă
 * „Autentificare" din antetul paginii publice face o navigare SOFT, deci
 * `gtag.js` rămâne viu în aceeași filă și raportează mai departe fiecare rută
 * din aplicație. Măsurat pe 21 sept 2026, cu Chromium: după login, cererile
 * către `region1.google-analytics.com` purtau `dl=…/autentificare`, apoi rutele
 * de după.
 *
 * ── DE CE DOUĂ MĂSURI, NU UNA ───────────────────────────────────────────────
 * Reparația principală e în `antet.tsx`: linkurile dinspre pagina publică spre
 * aplicație sunt `<a>` obișnuite, deci documentul se schimbă și scriptul moare
 * odată cu el. Componenta asta e plasa de sub ea, pentru orice cale de intrare
 * viitoare (un `<Link>` adăugat din grabă, o redirecționare de client): odată
 * montat învelișul aplicației, GA4 e stins explicit.
 *
 * `window['ga-disable-<ID>'] = true` e comutatorul documentat de Google, singurul
 * care oprește și trimiterile deja programate. Umami nu are nevoie de el: scriptul
 * lui se încarcă doar în `(marketing)` și nu supraviețuiește unei navigări HARD;
 * pe cea soft, îi tăiem urmărirea automată prin același obiect global.
 */
export function OpresteAnaliticele() {
  useEffect(() => {
    const fereastra = window as unknown as Record<string, unknown> & {
      umami?: { track?: unknown };
    };
    fereastra[`ga-disable-${ID_GA}`] = true;
    if (fereastra.umami !== undefined) {
      // Umami urmărește navigările singur; fără `track`, nu mai are cu ce.
      fereastra.umami.track = () => undefined;
    }
  }, []);

  return null;
}
