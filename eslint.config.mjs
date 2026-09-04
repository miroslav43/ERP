import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Regulile de mai jos nu sunt preferințe de stil. Fiecare oprește o clasă de
 * bug de securitate care, într-un sistem multi-tenant, se traduce în scurgere
 * de date între firme-client.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: "administrativo/securitate",
    rules: {
      /**
       * `lib/supabase/admin.ts` construiește un client cu `service_role`, care
       * OCOLEȘTE COMPLET RLS. Are voie să fie importat exclusiv din Server
       * Actions, Route Handlers și scripturi — niciodată dintr-o componentă.
       *
       * Fișierul este deja marcat `server-only`, ceea ce sparge build-ul dacă
       * ajunge într-un bundle de client. Regula asta prinde greșeala mai
       * devreme, în editor, și o face vizibilă la review.
       */
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/supabase/admin", "@/lib/supabase/admin"],
              /*
               * `import type { AdminSupabase }` e permis: tipul se șterge la
               * compilare și nu poate ocoli nimic. Restricția e despre FABRICĂ —
               * `createAdminSupabase()` — nu despre semnătura funcțiilor care
               * primesc clientul ca argument. Fără excepția asta, orice modul
               * care declară „mi se dă un client de serviciu" ar trebui trecut în
               * lista albă de mai jos, iar lista ar înceta să mai fie evidența
               * locurilor unde service_role INTRĂ efectiv în joc.
               */
              allowTypeImports: true,
              message:
                "Clientul admin folosește service_role și ocolește RLS. Importă-l doar în Server Actions, Route Handlers sau scripturi — și explică într-un comentariu de ce e nevoie să ocolești RLS.",
            },
          ],
        },
      ],

      /**
       * `any` anulează exact garanția pentru care ținem `strict: true`. Tipurile
       * bazei sunt generate; dacă ceva nu se potrivește, se corectează schema
       * sau se folosește `unknown` cu îngustare explicită.
       */
      "@typescript-eslint/no-explicit-any": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    /**
     * Lista celor care au voie să ocolească RLS. Este scurtă intenționat și
     * fiecare intrare are un motiv scris: aceasta este evidența auditabilă a
     * locurilor unde `service_role` intră în joc. Un `eslint-disable` presărat
     * prin cod ar avea același efect tehnic, dar ar dispărea din vedere la
     * primul review.
     */
    name: "administrativo/securitate-exceptii",
    files: [
      "src/lib/supabase/admin.ts", // chiar constructorul clientului
      "src/**/actions.ts", // Server Actions — rulează exclusiv pe server
      // Tot Server Actions (`"use server"` în capul fișierului), separate de
      // `actions.ts` fiindcă fiecare produce un efect IREVERSIBIL în registrul
      // oficial al Inspecției Muncii. `service_role` e necesar acolo pentru două
      // lucruri imposibile altfel: `reges_credentiale` n-are nicio politică RLS
      // și niciun privilegiu pentru `authenticated` (jetonul OIDC se citește și
      // se scrie doar așa), iar jurnalul de apeluri trebuie scris chiar și când
      // apelul extern a eșuat. Fiecare interogare filtrează explicit pe
      // `organization_id` luat din `ctx.tenant`, niciodată dintr-un argument.
      "src/app/(app)/reges/actiuni-api.ts",
      "src/app/api/**/route.ts", // Route Handlers — idem
      // Limitarea de rată trebuie să funcționeze ȘI pentru cereri
      // neautentificate (login, resetare de parolă), unde nu există sesiune
      // care să treacă prin RLS. Cheia se compune server-side.
      "src/lib/utils/rate-limit.ts",
      "scripts/**/*.ts",
      "tests/**/*.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },

  {
    /**
     * Stratul de demonstrație publică nu are voie să atingă serverul.
     *
     * `/vitrina/*` randează ecranele REALE ale aplicației, alimentate cu date
     * fabricate, și e încadrat prin `<iframe>` în paginile publice de modul.
     * Pe pagina aceea scrie, negru pe alb: „Date fictive. Nimic din ce faci
     * aici nu se salvează." Promisiunea e ținută azi de construcție — niciun
     * `fetch`, nicio Server Action — dar construcția e o stare, nu o garanție:
     * un singur import de `@/lib/supabase/server` într-un fișier de demo, la
     * al optsprezecelea modul, ar transforma un text de vânzare într-o
     * minciună publicată, fără ca nimic să cadă.
     *
     * Regula o face imposibilă mecanic, exact cum lista de mai sus ține
     * `service_role` în șapte locuri numărate. Trei familii interzise:
     *
     *   `server-only`   — marca fișierelor care rup build-ul dacă ajung în
     *                     bundle-ul de client; într-un demo n-are ce căuta;
     *   `@/lib/supabase/*` — orice client de bază, cu sau fără RLS;
     *   `next/headers`  — `cookies()`/`headers()` ar face pagina dinamică pe
     *                     sesiunea vizitatorului, adică ar lega demonstrația de
     *                     cine o privește.
     *
     * Blocul vine DUPĂ excepțiile de mai sus, deci le bate pentru fișierele
     * lui; `@/lib/supabase/*` acoperă și clientul admin, care e tot acolo.
     */
    name: "administrativo/demo-fara-server",
    files: ["src/demo/**", "src/app/(vitrina)/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "Demonstrația rulează în browserul vizitatorului. Un modul `server-only` aici înseamnă că datele demo ating serverul — exact ce neagă textul de pe pagina publică.",
            },
            {
              name: "next/headers",
              message:
                "`cookies()`/`headers()` leagă demonstrația de sesiunea vizitatorului. Vitrina trebuie să arate la fel pentru oricine, fără să știe cine privește.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/supabase/*", "@/lib/supabase/*"],
              allowTypeImports: true,
              message:
                "Stratul de demonstrație nu atinge baza de date. Datele lui sunt fabricate (`src/demo/lume.ts`) și trăiesc doar în sesiunea de browser — pagina publică promite exact asta.",
            },
          ],
        },
      ],
    },
  },

  // `.remember/` e directorul de lucru al plugin-ului cu același nume: fișiere
  // temporare, ignorate de git prin propriul `.remember/.gitignore`. ESLint nu
  // citește `.gitignore`, deci le parcurgea și raporta erori într-un cod pe
  // care nimeni nu-l scrie și nimeni nu-l livrează. Prettier îl ignoră deja.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "docs/design/**",
    ".remember/**",
    // Aplicația mobilă are propriul lanț de unelte, propriul tsconfig și
    // propriul lockfile. Regulile de aici — granița server/client, restricția pe
    // clientul admin — n-au niciun înțeles în React Native.
    "mobil/**",
  ]),
]);

export default eslintConfig;
