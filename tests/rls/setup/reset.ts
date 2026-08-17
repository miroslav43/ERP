// tests/rls/setup/reset.ts
/**
 * Resetarea bazei de test — poartă de siguranță în TypeScript, peste cea din
 * `scripts/reset-test-db.sh`.
 *
 * Verificarea este DUBLĂ intenționat: un `db reset` executat din greșeală pe
 * proiectul de dezvoltare sau de producție nu se poate repara. Ambele straturi
 * folosesc LISTĂ ALBĂ (ce e permis), niciodată listă neagră (ce e interzis): o
 * listă neagră uită mereu proiectul creat săptămâna viitoare.
 *
 * Ca `globalSetup` în vitest.config.mts, proiectul `rls`:
 *   globalSetup: ["tests/rls/setup/reset.ts"]
 * Sări peste reset (rulare locală rapidă, pe o bază deja pregătită):
 *   RLS_FARA_RESET=1 pnpm test:rls
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mediuTest } from "./discover";

const executaProces = promisify(execFile);

/**
 * ⚠️ COMPLETEAZĂ cu ref-ul proiectului Supabase DEDICAT testelor, apoi comite.
 * Ține sincron cu `REFURI_PERMISE` din scripts/reset-test-db.sh.
 * `nybmhorngsajoqaxjlbr` este proiectul de dezvoltare/producție și nu are ce
 * căuta aici NICIODATĂ.
 */
export const REFURI_DE_TEST_PERMISE: readonly string[] = [
  // "administrativo-test — completează ref-ul aici",
];

export const REFURI_INTERZISE: readonly string[] = ["nybmhorngsajoqaxjlbr"];

export function verificaTintaResetului(): string {
  const { projectRef, url, dbUrl } = mediuTest();

  if (REFURI_DE_TEST_PERMISE.length === 0) {
    throw new Error(
      "REFUZ: lista albă de proiecte de test este goală. Completează REFURI_DE_TEST_PERMISE " +
        "în tests/rls/setup/reset.ts și REFURI_PERMISE în scripts/reset-test-db.sh.",
    );
  }
  if (!REFURI_DE_TEST_PERMISE.includes(projectRef)) {
    throw new Error(
      `REFUZ: proiectul "${projectRef}" nu este în lista albă de proiecte de test. ` +
        "Resetul șterge complet schema; nu rulează decât pe un proiect declarat explicit.",
    );
  }
  if (REFURI_INTERZISE.includes(projectRef)) {
    throw new Error(`REFUZ: "${projectRef}" este proiectul de dezvoltare/producție.`);
  }
  // Coerența țintei: lista albă verifică ref-ul, dar psql se conectează la DB_URL.
  if (!url.includes(projectRef)) {
    throw new Error(`REFUZ: TEST_SUPABASE_URL (${url}) nu conține ref-ul ${projectRef}.`);
  }
  if (!dbUrl.includes(projectRef)) {
    throw new Error(
      `REFUZ: TEST_SUPABASE_DB_URL nu conține ref-ul ${projectRef} — ar reseta altă bază.`,
    );
  }
  return projectRef;
}

export async function reseteazaBazaDeTest(): Promise<void> {
  const ref = verificaTintaResetului();
  const { stdout } = await executaProces("bash", ["scripts/reset-test-db.sh"], {
    timeout: 10 * 60_000,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env },
  });
  process.stdout.write(`Baza de test ${ref} resetată.\n${stdout}`);
}

export async function setup(): Promise<void> {
  if (process.env["RLS_FARA_RESET"] === "1") {
    process.stdout.write("RLS_FARA_RESET=1 — se sare peste resetul bazei de test.\n");
    return;
  }
  await reseteazaBazaDeTest();
}

export default setup;
