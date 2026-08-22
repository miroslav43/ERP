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
  ]),
]);

export default eslintConfig;
