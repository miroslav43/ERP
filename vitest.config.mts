import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Două proiecte, cu cerințe diferite.
 *
 * `unit` acoperă `src/domain/` și `src/lib/format/` — logică pură, fără I/O,
 * fără mock-uri. Rulează în milisecunde și este locul unde trăiesc calculele
 * costisitoare la greșeală (zile lucrătoare, sold de concediu, ore de pontaj,
 * salariu, diurnă).
 *
 * `rls` verifică izolarea între tenanți pe un proiect Supabase real, dedicat
 * testelor. Rulează serial: testele își resetează baza între ele, iar
 * paralelismul le-ar face să și-o tragă de sub picioare reciproc.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        resolve: {
          tsconfigPaths: true,
          // Vezi `tests/stub/server-only.ts`: pachetul real aruncă la import,
          // ceea ce ar face netestabile funcțiile pure din fișierele marcate
          // `server-only`. Aliasul e strict pentru teste; build-ul folosește
          // pachetul adevărat.
          // `fileURLToPath`, NU `.pathname`: pe Windows acesta din urmă întoarce
          // `/C:/Users/...`, cu bară în față, iar Vite nu rezolvă calea — toate
          // testele care ating un fișier `server-only` cădeau local cu „Cannot
          // find package 'server-only'”. Pe Linux, în CI, trecea.
          alias: {
            "server-only": fileURLToPath(new URL("./tests/stub/server-only.ts", import.meta.url)),
          },
        },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          // `src/config/env.ts` validează configurația la IMPORT DE MODUL, nu la
          // primul request — o valoare lipsă oprește aplicația imediat, ceea ce
          // e corect în producție și blochează orice test care importă un modul
          // din `src/lib/`. Aceleași placeholdere ca în `.github/workflows/ci.yml`,
          // pentru pasul de build: suficiente cât să treacă validarea Zod, fără
          // să atingă nimic real. Testele `unit` nu fac I/O.
          env: {
            NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
            NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-placeholder",
            NEXT_PUBLIC_APP_URL: "http://localhost:3000",
            SUPABASE_SERVICE_ROLE_KEY: "ci-placeholder",
            HR_ENCRYPTION_KEYS: '{"1":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="}',
            HR_ENCRYPTION_ACTIVE_KEY: "1",
            HR_HASH_KEY: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
            TENANT_COOKIE_SECRET: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            EMAIL_MODE: "test",
          },
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "rls",
          environment: "node",
          include: ["tests/rls/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
