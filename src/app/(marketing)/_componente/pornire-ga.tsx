"use client";

import { useEffect } from "react";

import { adresaCurata, areDateDeFormular } from "./adresa-analitice";

type FereastraGa = { gtag?: (...argumente: unknown[]) => void; __admGaPornit?: boolean };

/**
 * Pornirea Google Analytics: `js` + `config`, o singură dată pe document.
 *
 * ── DE CE NU MAI E SCRIPT INLINE ──────────────────────────────────────────
 * Până la 8 oct 2026, `ga-pornire` din `analitice.tsx` făcea `gtag('config')`
 * cu adresa brută. Pe o unealtă trimisă prin GET, adresa e
 * `?angajati=Popescu+Ion…`. Auditul a văzut-o plecând la Google în `dl=` pe
 * `page_view`, `click`, `scroll` și `user_engagement`, și FĂRĂ consimțământ:
 * Consent Mode trimite semnale fără cookie-uri, dar cu adresa întreagă.
 *
 * ── POARTA ───────────────────────────────────────────────────────────────
 * Un document deschis cu date de formular în adresă (`areDateDeFormular`) nu
 * configurează GA DELOC, cât trăiește documentul. Fără `config` nu există
 * etichetă, deci gtag nu trimite nimic, nici după „Accept”. Am ales poarta în
 * locul unui `page_location` curățat, fiindcă felul în care gtag completează
 * `dl`/`dr` la navigările din istorie nu e documentat. Dacă efectul nu
 * rulează, GA tace: poarta se închide la eroare.
 *
 * Steagul stă pe `window`, nu în modul: `window` trăiește exact cât
 * documentul. Layout-ul `(marketing)` se remontează la trecerea prin alt grup
 * de rute, iar un al doilea `config` ar număra o a doua afișare.
 *
 * Costul: pagina generată și navigările soft de după ea nu apar în GA. GA e
 * oricum o felie (sub consimțământ). Cifra reală e în Umami, care primește
 * aceeași pagină fără query string (`ScriptUmami`).
 */
export function PornireGa({ id }: Readonly<{ id: string }>) {
  useEffect(() => {
    const fereastra = window as unknown as FereastraGa;
    if (fereastra.__admGaPornit === true) return;
    const gtag = fereastra.gtag;
    if (gtag === undefined) return;
    fereastra.__admGaPornit = true;
    if (areDateDeFormular(window.location.href)) return;
    gtag("js", new Date());
    // `document.referrer` poate fi pagina unei unelte deschise cu valori, într-un
    // browser care ignoră `Referrer-Policy: strict-origin` (nginx).
    gtag(
      "config",
      id,
      areDateDeFormular(document.referrer)
        ? { page_referrer: adresaCurata(document.referrer) }
        : {},
    );
  }, [id]);

  return null;
}
