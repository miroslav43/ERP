/**
 * Autentificarea, O SINGURĂ DATĂ per rol, înaintea tuturor testelor.
 *
 * ── DE CE O SINGURĂ DATĂ ───────────────────────────────────────────────────
 * `autentificarePrinParola` (src/app/(auth)/autentificare/actions.ts:35-42)
 * limitează la 5 încercări per cont în 15 minute și 20 per IP. O matrice
 * rol × modul care s-ar loga la fiecare test ar consuma limita din a șasea
 * pagină și ar vedea apoi „Prea multe încercări" — un roșu care n-ar spune
 * nimic despre aplicație.
 *
 * Mai mult: dacă `e2e/.auth/<rol>.json` există și sesiunea din el e încă
 * valabilă, nu ne logăm deloc. Rulările repetate în aceeași oră nu ating
 * limitatorul.
 *
 * ── CONTURILE ──────────────────────────────────────────────────────────────
 * Cele patru conturi „pure" din `scripts/demo/seed-demo.mjs`, toate în
 * „Administrativo Demo SRL". NU `demo_admin@gmail.com`: e administrator de
 * PLATFORMĂ și vede firmele reale ale clienților.
 */
import { mkdirSync } from "node:fs";

import { chromium, type FullConfig } from "@playwright/test";

import { CONTURI, ROLURI, caleStare, type Rol } from "./conturi";

const PAROLA = process.env["E2E_PAROLA"] ?? "12345678";

export default async function globalSetup(config: FullConfig): Promise<void> {
  const use = config.projects[0]?.use;
  const baza = use?.baseURL;
  if (baza === undefined) throw new Error("playwright.config.ts nu definește baseURL.");

  mkdirSync("e2e/.auth", { recursive: true });
  const browser = await chromium.launch(use?.launchOptions ?? {});
  try {
    for (const rol of ROLURI) {
      await asiguraSesiune(browser, baza, use?.httpCredentials, rol);
    }
  } finally {
    await browser.close();
  }
}

async function asiguraSesiune(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  baza: string,
  httpCredentials: { username: string; password: string } | undefined,
  rol: Rol,
): Promise<void> {
  const cont = CONTURI[rol];
  const cale = caleStare(rol);
  const optiuni = {
    baseURL: baza,
    locale: "ro-RO",
    ...(httpCredentials === undefined ? {} : { httpCredentials }),
  };

  // Încercarea întâi: sesiunea salvată la o rulare anterioară.
  try {
    const context = await browser.newContext({ ...optiuni, storageState: cale });
    const pagina = await context.newPage();
    await pagina.goto(cont.acasa, { waitUntil: "domcontentloaded" });
    const valabila = !new URL(pagina.url()).pathname.startsWith("/autentificare");
    if (valabila) await context.storageState({ path: cale });
    await context.close();
    if (valabila) return;
  } catch {
    // Fișier absent sau corupt — ne logăm de la zero.
  }

  const context = await browser.newContext(optiuni);
  const pagina = await context.newPage();
  await pagina.goto("/autentificare", { waitUntil: "domcontentloaded" });
  await pagina.fill("#email", cont.email);
  await pagina.fill("#parola", PAROLA);
  await Promise.all([
    pagina.waitForURL(
      (u) => !u.pathname.startsWith("/autentificare") || u.search.includes("eroare"),
      {
        timeout: 45_000,
      },
    ),
    pagina.click('button[type="submit"]'),
  ]);

  const url = new URL(pagina.url());
  const eroare = url.searchParams.get("eroare");
  if (eroare !== null) {
    await context.close();
    throw new Error(
      `Autentificarea ${cont.email} pe ${baza} a eșuat cu „${eroare}". ` +
        (eroare === "limita"
          ? "Limita de 5 încercări / 15 minute e atinsă — așteaptă."
          : "Contul lipsește? Populează staging-ul: ADM_MEDIU=staging node scripts/demo/seed-demo.mjs"),
    );
  }
  // Acțiunea redirectează întâi spre `/` (câmpul ascuns `redirect`), iar abia
  // de acolo aplicația alege ecranul de start al rolului. Verificăm ȚINTA
  // rolului direct, nu prima adresă de după formular.
  await pagina.goto(cont.acasa, { waitUntil: "domcontentloaded" });
  const ajuns = new URL(pagina.url()).pathname;
  if (!ajuns.startsWith(cont.acasa)) {
    await context.close();
    throw new Error(
      `${cont.email} a fost trimis de pe ${cont.acasa} pe ${ajuns}. Rolul din firma demo s-a schimbat?`,
    );
  }

  await context.storageState({ path: cale });
  await context.close();
}
