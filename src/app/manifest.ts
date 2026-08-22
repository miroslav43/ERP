// src/app/manifest.ts
import type { MetadataRoute } from "next";

/**
 * Manifestul aplicației instalabile.
 *
 * `start_url: "/"`, NU `/portal`: manifestul e al aplicației întregi, iar un
 * `org_admin` care o instalează n-are ce căuta în portal. Rutarea pe rol o fac
 * `proxy.ts`, callback-ul de autentificare și poarta din layout — trei locuri
 * care știu cine e utilizatorul, spre deosebire de un fișier static.
 *
 * `display: "standalone"` scoate bara de adrese: pe telefon, portalul deschis de
 * pe ecranul de start arată ca o aplicație, nu ca un site. De aici vine și nevoia
 * de `viewportFit: "cover"` din `layout.tsx` — în mod standalone, conținutul
 * ajunge sub crestătură și sub indicatorul de gesturi.
 *
 * Fără service worker și fără offline, deliberat: scrierile trec prin Server
 * Actions cu RLS și audit, iar o coadă offline ar trebui să rejoace acțiuni pe
 * care politicile le pot refuza la sincronizare. E un subsistem, nu o setare.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Administrativo",
    short_name: "Administrativo",
    description: "Pontajul, concediile, salariul și documentele dumneavoastră, la îndemână.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ro",
    dir: "ltr",
    background_color: "#faf7f0",
    theme_color: "#0f1e3d",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
