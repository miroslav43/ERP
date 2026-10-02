/**
 * Testele de capăt la capăt — rulează împotriva STAGING-ului, niciodată a
 * producției.
 *
 *   pnpm test:e2e
 *   E2E_BAZA=https://staging.administrativo.ro pnpm test:e2e
 *
 * ── DE CE NU LOCALHOST ─────────────────────────────────────────────────────
 * `.env.local` arată spre baza de PRODUCȚIE (`nybmhorn…`). Un `next dev` local
 * ar face ca fluxul de concediu din `e2e/concediu.spec.ts` să scrie cereri în
 * datele reale. Staging are proiect Supabase separat (`mjyuonhc…`, vezi
 * `ops/_lib.sh` și `docs/superpowers/specs/2026-09-04-staging-subdomeniu-design.md`).
 * `E2E_BAZA` poate ținti alt mediu de probă, dar config-ul REFUZĂ domeniul de
 * producție, ca o variabilă rămasă în shell să nu poată schimba ținta tăcut.
 *
 * ── AUTENTIFICAREA DE BAZĂ ─────────────────────────────────────────────────
 * Staging stă în spatele lui `auth_basic` din nginx
 * (`deploy/nginx/32-staging.administrativo.ro.conf`). Credențialele vin din
 * `E2E_AUTENTIFICARE_BASIC="utilizator:parola"` (același format ca
 * `ADM_AUTENTIFICARE_BASIC` din `scripts/checks/rute-publice.mjs`), iar în lipsa
 * ei din `~/.secrete/administrativo/parola-staging.txt`, cu utilizatorul
 * `coleg`. Nu se afișează niciodată.
 *
 * ── BROWSERUL ──────────────────────────────────────────────────────────────
 * Același tipar ca `scripts/capturi/capturi.mjs`: `headless_shell` din cache-ul
 * Playwright, cu `--no-sandbox`. Chrome-ul de sistem lipsește pe VM.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

const BAZA = process.env["E2E_BAZA"] ?? "https://staging.administrativo.ro";

const DOMENII_INTERZISE = new Set(["administrativo.ro", "www.administrativo.ro"]);
const gazda = new URL(BAZA).hostname.toLowerCase();
if (DOMENII_INTERZISE.has(gazda)) {
  throw new Error(
    `E2E_BAZA=${BAZA} este PRODUCȚIA. Testele de capăt la capăt scriu date ` +
      "(cereri de concediu) și rulează doar pe staging.",
  );
}

function credentialeBasic(): { username: string; password: string } | undefined {
  const dinMediu = process.env["E2E_AUTENTIFICARE_BASIC"] ?? process.env["ADM_AUTENTIFICARE_BASIC"];
  if (dinMediu !== undefined && dinMediu.includes(":")) {
    const separator = dinMediu.indexOf(":");
    return { username: dinMediu.slice(0, separator), password: dinMediu.slice(separator + 1) };
  }
  const fisier = join(homedir(), ".secrete", "administrativo", "parola-staging.txt");
  if (existsSync(fisier)) {
    return { username: "coleg", password: readFileSync(fisier, "utf8").trim() };
  }
  return undefined;
}

const basic = credentialeBasic();

const EXECUTABIL_CHROMIUM =
  process.env["CHROMIUM"] ??
  `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Două, nu mai multe: staging are o singură replică, iar fiecare pagină de
  // modul face zeci de interogări. Mai mult paralelism măsoară coada, nu
  // aplicația.
  workers: 2,
  // O singură reîncercare: pe VM, Chromium anulează rar o navigare cu
  // `ERR_NETWORK_CHANGED` (vezi `e2e/navigare.ts`) — 1 cădere în ~440 de teste
  // rulate pe 2 oct 2026, nereprodusă în 4 rulări repetate. Playwright raportează
  // testul trecut abia la a doua încercare drept „flaky”, deci nu se ascunde: un
  // test care pică de două ori rămâne roșu.
  retries: 1,
  fullyParallel: true,
  forbidOnly: process.env["CI"] !== undefined,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BAZA,
    ...(basic === undefined ? {} : { httpCredentials: basic }),
    locale: "ro-RO",
    timezoneId: "Europe/Bucharest",
    viewport: { width: 1440, height: 900 },
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: EXECUTABIL_CHROMIUM,
      args: ["--no-sandbox"],
    },
  },
});
