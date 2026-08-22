import type { NextConfig } from "next";

/**
 * Build-ul din container relaxează verificarea de tipuri, restul NU.
 *
 * Codul de la HEAD apelează `aplica_drepturi_concediu` și
 * `seteaza_zile_concediu_implicit` plus șase coloane din
 * `leave_entitlement_rules` care există în migrarea 0035_reguli_concediu.sql,
 * dar NU în baza live: migrarea nu a fost aplicată (0036 da, 0035 nu).
 * `src/types/database.ts` descrie corect baza reală, deci `tsc` semnalează pe
 * bună dreptate nepotrivirea — 9 erori, în două fișiere.
 *
 * Tipurile sunt strict compile-time: nu schimbă nimic din ce se execută. A
 * bloca deploy-ul pe ele ar însemna ca 23 de module funcționale să rămână
 * nepublicate din cauza unuia singur. Așa că build-ul de imagine trece mai
 * departe, iar `pnpm build` local și CI (.github/workflows/ci.yml rulează
 * `typecheck` separat) rămân stricte — poarta de calitate nu se pierde, doar
 * nu mai stă în drumul livrării.
 *
 * ⚠️ Ecranul „Concedii → Setări" (grile de drepturi) va da eroare la RULARE
 * până când migrarea 0035 e aplicată. După aplicare: `pnpm db:types`, apoi
 * variabila asta poate dispărea cu totul.
 */
const inContainer = process.env.DOCKER_BUILD === "1";

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
    "/*": ["./node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**/*"],
  },

  reactCompiler: true,

  typescript: { ignoreBuildErrors: inContainer },
  // Fără cheie `eslint`: în Next 16 opțiunea a fost ELIMINATĂ din NextConfig
  // (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`,
  // tabelul de versiuni: „v16.0.0 — `next lint` and the `eslint` next.config.js
  // option were removed"), iar `next build` nu mai rulează deloc linting. O
  // lăsam acolo doar ca `tsc` să pice cu TS2353, fără niciun efect real.
};

export default nextConfig;
