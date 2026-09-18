import type { NextConfig } from "next";

// Cale relativă, nu `@/`: aici rezoluția de module e a lui Node, fără alias.
import { REDIRECTURI_MODULE } from "./src/content/landing/slug-module";

/**
 * Originea unei adrese din mediu, sau `null` dacă lipsește ori e stricată.
 *
 * CSP-ul cere ORIGINI, nu adrese complete: `https://x.y/script.js` într-o
 * directivă e o cale, nu o gazdă, și restrânge politica la exact acel fișier —
 * o capcană care se vede abia la primul raport de încălcare.
 */
function origineDin(valoare: string | undefined): string | null {
  if (valoare === undefined || valoare.trim() === "") return null;
  try {
    return new URL(valoare).origin;
  } catch {
    return null;
  }
}

/**
 * Politica de securitate a conținutului, deocamdată DOAR raportată.
 *
 * ── DE CE `Report-Only` ───────────────────────────────────────────────────
 * Un CSP scris din citirea codului e o ipoteză, nu un inventar: nu prinde
 * originile pe care o bibliotecă le cere la rulare, nici bucata de HTML dintr-o
 * previzualizare de e-mail. `Report-Only` nu blochează nimic și livrează exact
 * lista care lipsește. Se strânge DUPĂ ce rapoartele tac, nu înainte.
 *
 * ── DE CE `'unsafe-inline'` LA SCRIPTURI, ȘI DE CE RĂMÂNE ─────────────────
 * Alternativa e un `nonce` per cerere, iar un nonce cere randare DINAMICĂ:
 * cele nouăsprezece pagini de modul, plus hub-urile, sunt prerandate static și
 * ar deveni toate dinamice. Costul e real (fiecare vizitator plătește o
 * randare), câștigul e teoretic pe un sit fără conținut trimis de utilizatori.
 * Restul directivelor — `object-src`, `base-uri`, `form-action`,
 * `frame-ancestors` — fac munca grea și nu costă nimic.
 *
 * ── DE CE O SINGURĂ POLITICĂ, NU UNA PE GRUP ─────────────────────────────
 * În `headers()`, două intrări care potrivesc aceeași cale și declară aceeași
 * cheie se suprascriu după ordine — un mecanism pe care nu vreau să-l descopăr
 * în producție cu un CSP pe jumătate aplicat. O politică, destul de largă cât
 * să acopere ȘI aplicația; strâmtarea pe `(marketing)` vine ca al doilea pas,
 * cu rapoartele pe masă.
 */
function politicaCsp(): string {
  const umami = origineDin(process.env.NEXT_PUBLIC_UMAMI_SRC);
  const supabase = origineDin(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const scripturi = ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", umami];
  const conexiuni = [
    "'self'",
    supabase,
    supabase === null ? null : supabase.replace(/^https:/, "wss:"),
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    umami,
  ];

  const directive: readonly (readonly [string, readonly (string | null)[]])[] = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    /*
     * FĂRĂ `frame-ancestors`. Într-o politică `Report-Only` browserele o ignoră
     * — Chrome scrie chiar un avertisment în consolă la fiecare încărcare de
     * pagină, pe tot situl. Munca ei o face deja `X-Frame-Options: SAMEORIGIN`
     * din `deploy/nginx/30-administrativo.ro.conf`. Intră aici în ziua în care
     * politica devine executorie.
     */
    ["form-action", ["'self'"]],
    ["script-src", scripturi],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // `data:` la imagini: codurile QR și diagramele din PDF-uri se randează așa.
    ["img-src", ["'self'", "data:", "blob:", "https://www.googletagmanager.com"]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", conexiuni],
    // Vizualizatorul de lecții încarcă PDF-uri din Storage (`blob:`) și
    // înglobează video de la cei trei furnizori acceptați de `link-extern.ts`.
    [
      "frame-src",
      [
        "'self'",
        "blob:",
        "https://www.youtube-nocookie.com",
        "https://player.vimeo.com",
        "https://www.loom.com",
      ],
    ],
    ["media-src", ["'self'", "blob:", "data:"]],
    ["worker-src", ["'self'", "blob:"]],
    ["report-uri", ["/api/csp-report"]],
  ];

  return directive
    .map(([nume, surse]) => `${nume} ${surse.filter((s) => s !== null).join(" ")}`)
    .join("; ");
}

const nextConfig: NextConfig = {
  /**
   * Build de producție containerizat: `standalone` scrie în `.next/standalone`
   * un server Node cu DOAR dependențele atinse efectiv de cod, urmărite prin
   * trasarea importurilor. Imaginea finală copiază acel director în loc să care
   * `node_modules` întreg, iar `Dockerfile` pornește `node server.js`.
   */
  output: "standalone",

  /**
   * Trasarea importurilor ratează `@swc/helpers`: copiază `cjs/` și
   * package.json, dar NU și `esm/`. Nimic nu îl importă static — Next îl
   * rezolvă la RULARE, prin `require-hook.js`, urmând câmpul `"module":
   * "esm/index.js"` din exports map. Rezultatul e un container care pornește și
   * moare imediat cu MODULE_NOT_FOUND pe `esm/_interop_require_default.js`.
   *
   * Cheia `'/*'` aplică regula tuturor rutelor, iar versiunea e lăsată wildcard
   * ca un bump de `@swc/helpers` să nu reintroducă tăcut aceeași cădere.
   * Vezi node_modules/next/dist/docs/01-app/03-api-reference/05-config/
   * 01-next-config-js/output.md
   */
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**/*",
      /**
       * Fonturile pentru PDF (`src/lib/pdf/fonturi/`).
       *
       * Trasarea importurilor urmărește `import`-uri statice; fonturile se
       * citesc cu `readFileSync` pe o cale construită la rulare, deci ea nu le
       * vede. Fără regula asta, containerul pornește corect și cade abia la
       * primul stat de plată, cu ENOENT — adică exact în momentul cel mai prost.
       */
      "./src/lib/pdf/fonturi/*.ttf",
    ],
  },

  /**
   * Cache-ul de rutare al clientului, pentru rutele dinamice.
   *
   * Implicitul e 0 din v15.0.0 („not cached”), iar interacțiunea cu scheletele
   * de încărcare e contraintuitivă: o rută CU `loading.tsx` se prefetchează în
   * găleata `dynamic`, una FĂRĂ în `static` (5 min) — vezi tabelul din
   * `node_modules/next/dist/docs/01-app/02-guides/prefetching.md:61-62`.
   * Proiectul are 88 de `loading.tsx` care acoperă toate cele 117 pagini, deci
   * TOT prefetch-ul cădea în găleata neîncărcată: învechit în clipa în care
   * ateriza, re-cerut la fiecare navigare. Jurnalul nginx: 11 745 de cereri
   * pentru 336 de documente.
   *
   * 15 secunde, nu mai mult: e o fereastră în care poți vedea o listă fără
   * scrierea altcuiva. Scrierile TALE sunt acoperite oricum de `revalidate:`
   * din `createAction`. Nu e risc de izolare — Router Cache-ul e per-browser,
   * iar comutarea firmei îl purjează de două ori independent.
   */
  experimental: {
    staleTimes: { dynamic: 15 },
  },

  /**
   * Limba paginilor engleze, ca antet HTTP.
   *
   * `<html lang>` e scris o singură dată, în `src/app/layout.tsx`, ca `ro`: un
   * `lang` per rută ar cere fie mai multe layout-uri rădăcină (reîncărcare
   * completă între grupuri și `ZonaIncarcare` ruptă), fie `headers()` în layout,
   * care ar face dinamice toate paginile statice. Conținutul are deja
   * `lang="en"` pe învelișul lui (`_componente/cadru.tsx`), iar Google ignoră
   * oricum atributul și deduce limba din text. Antetul e semnalul ieftin pentru
   * motoarele care îl citesc (Bing), fără niciun cost de randare.
   */
  headers() {
    const engleza = [{ key: "Content-Language", value: "en" }];
    return [
      {
        source: "/:cale*",
        headers: [{ key: "Content-Security-Policy-Report-Only", value: politicaCsp() }],
      },
      { source: "/en", headers: engleza },
      { source: "/en/:path*", headers: engleza },
    ];
  },

  /**
   * `X-Powered-By: Next.js` nu apără pe nimeni și spune unui scaner exact ce
   * familie de vulnerabilități să încerce întâi. Nu e o gaură, e o economie
   * pentru atacator — și un rând în fiecare răspuns al sitului.
   */
  poweredByHeader: false,

  /**
   * Adresele vechi ale paginilor de modul (`/module/attendance`) → slug-urile
   * românești (`/module/pontaj`). Permanente, fiindcă mutarea e definitivă și
   * motoarele trebuie să transfere adresa, nu s-o țină pe amândouă. Rulează
   * înaintea lui `src/proxy.ts`, deci o adresă veche nu plătește verificarea de
   * sesiune. Lista se generează din `slug-module.ts` și conține doar cheile al
   * căror slug diferă — altfel ar fi bucle.
   */
  redirects() {
    return [...REDIRECTURI_MODULE];
  },

  reactCompiler: true,

  // Fără cheie `typescript`: build-ul de imagine relaxa verificarea
  // (`ignoreBuildErrors` când `DOCKER_BUILD=1`), ca ocol pentru cele 9 erori
  // `tsc` din ecranul Concedii → Setări. Cauza reală era `src/types/database.ts`
  // rămas în urma bazei, nu invers; regenerarea l-a rezolvat. Ocolul a fost
  // scos: `next build` e singura poartă care prinde granița server/client, iar
  // în container ea era exact cea dezactivată.
  //
  // Fără cheie `eslint`: în Next 16 opțiunea a fost ELIMINATĂ din NextConfig
  // (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`,
  // tabelul de versiuni: „v16.0.0 — `next lint` and the `eslint` next.config.js
  // option were removed"), iar `next build` nu mai rulează deloc linting. O
  // lăsam acolo doar ca `tsc` să pice cu TS2353, fără niciun efect real.
};

export default nextConfig;
