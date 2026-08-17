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
     * Excepțiile: chiar fișierul admin, Server Actions, Route Handlers și
     * scripturile de întreținere au voie să importe clientul admin.
     */
    name: "administrativo/securitate-exceptii",
    files: [
      "src/lib/supabase/admin.ts",
      "src/**/actions.ts",
      "src/app/api/**/route.ts",
      "scripts/**/*.ts",
      "tests/**/*.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "docs/design/**"]),
]);

export default eslintConfig;
