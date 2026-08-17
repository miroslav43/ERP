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
        resolve: { tsconfigPaths: true },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
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
