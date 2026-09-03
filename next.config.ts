import type { NextConfig } from "next";

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
