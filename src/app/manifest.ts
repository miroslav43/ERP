// src/app/manifest.ts
import type { MetadataRoute } from "next";

import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";

/**
 * Manifestul aplicației instalabile.
 *
 * ── `id`, PUS ACUM CÂT TIMP NU DOARE ────────────────────────────────────────
 * Identitatea unei aplicații instalate e `id`; când lipsește, browserul cade pe
 * `start_url` ca rezervă. Consecința e că orice schimbare ulterioară de
 * `start_url` ARATĂ ca o aplicație nouă: instalările existente rămân orfane, iar
 * utilizatorul are două iconițe pe ecranul de start și nu știe care e cea vie.
 * Se scrie acum, cât timp instalările sunt aproape zero, tocmai ca `start_url`
 * să rămână liber de schimbat mai târziu.
 *
 * ── `start_url`, DIN CONSTANTĂ, NU LITERAL ──────────────────────────────────
 * Înainte era `"/"`, cu argumentul că manifestul e al aplicației întregi. Numai
 * că `"/"` e rută PUBLICĂ (`src/proxy.ts:69`): un telefon fără sesiune deschidea
 * landing-ul de marketing în mod standalone — fără bară de adrese, fără buton de
 * login evident, fără drum înapoi. Exact ecranul care face un om să șteargă
 * iconița.
 *
 * `/panou` nu e publică, deci același telefon aterizează pe `/autentificare`, cu
 * destinația păstrată în `?redirect=` (`proxy.ts:111`). Cu sesiune, poarta din
 * `(app)/layout.tsx` duce angajatul în portal, iar `org_admin` rămâne pe panou —
 * adică fix principiul din comentariul vechi („rutarea pe rol o fac trei locuri
 * care știu cine e utilizatorul"), doar că acum pornirea e într-un loc unde
 * rutarea aceea chiar rulează.
 *
 * Se importă constanta, nu se scrie calea: `src/config/routes.ts` explică de ce
 * — la trecerea pe subdomenii, `RUTA_DUPA_AUTENTIFICARE` devine `/` pe host-ul
 * firmei, iar un literal aici ar rămâne în urmă tăcut.
 *
 * ── ICONIȚE: 192 ȘI 512 ─────────────────────────────────────────────────────
 * Criteriul de instalare pe Android le cere pe amândouă. Cu una singură,
 * instalarea poate fi refuzată fără nicio eroare vizibilă. Vezi `icon1.tsx`.
 *
 * ── `display: "standalone"` ─────────────────────────────────────────────────
 * Scoate bara de adrese: pe telefon, portalul deschis de pe ecranul de start
 * arată ca o aplicație, nu ca un site. De aici vine și nevoia de
 * `viewportFit: "cover"` din `layout.tsx` — în mod standalone, conținutul ajunge
 * sub crestătură și sub indicatorul de gesturi.
 *
 * ── FĂRĂ SERVICE WORKER, VERIFICAT DIN NOU ──────────────────────────────────
 * Decizia veche se menține, dar acum cu dovadă în loc de presupunere. Codul
 * Chromium de azi nu mai are NICIO verificare de service worker în lanțul de
 * instalabilitate: `installable_params.h` n-are niciun câmp de worker,
 * `app_banner_manager.cc` nu conține deloc cuvântul, iar cele cinci coduri de
 * stare legate de SW (`NO_MATCHING_SERVICE_WORKER`, `NOT_OFFLINE_CAPABLE`, …)
 * sunt marcate DEPRECATED. Nota Chrome care cerea un handler `fetch` e din
 * 2023-12-05 și n-a fost confirmată de nicio sursă ulterioară.
 *
 * Motivul original rămâne și el valabil: scrierile trec prin Server Actions cu
 * RLS și audit, iar o coadă offline ar trebui să rejoace acțiuni pe care
 * politicile le pot refuza la sincronizare. E un subsistem, nu o setare.
 *
 * DACĂ butonul de instalare nu apare pe Android, ordinea de căutat e: (a)
 * lipsește 192×192, (b) origine nesigură, (c) `prefer_related_applications`,
 * (d) aplicația e deja instalată, (e) nu s-a atins pragul de angajament al
 * Chrome (un tap și ~30 s pe pagină). Adăugarea unui service worker NU e pe
 * listă.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Administrativo",
    short_name: "Administrativo",
    description: "Pontajul, concediile, salariul și documentele dumneavoastră, la îndemână.",
    start_url: RUTA_DUPA_AUTENTIFICARE,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ro",
    dir: "ltr",
    background_color: "#faf7f0",
    theme_color: "#0f1e3d",
    icons: [
      { src: "/icon1", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Meniul de la apăsarea lungă pe iconiță. Android îl arată; iOS îl ignoră
    // fără eroare, deci nu e nevoie de nicio ramură.
    shortcuts: [
      {
        name: "Pontează ziua",
        short_name: "Pontează",
        description: "Un singur buton pentru ziua de azi.",
        url: "/portal/ceas",
      },
      {
        name: "Cerere de concediu",
        short_name: "Concediu",
        description: "Trimite o cerere nouă.",
        url: "/portal/concediile-mele/noua",
      },
    ],
  };
}
