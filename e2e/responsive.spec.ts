/**
 * Derularea laterală a PAGINII, măsurată în browser real (W3-07: UX-005,
 * UX-045, ANG-033, ONB-037, UX-013 și nomenclatorul registrului).
 *
 * ── DE CE AICI ȘI NU ÎN TESTELE DE COMPONENTĂ ─────────────────────────────
 * happy-dom nu calculează stil: gărzile din `*.test.tsx` apără CLASA
 * (`relative` pe containerul derulabil), nu efectul. Cauza comună a
 * depășirilor — spanuri `sr-only` (`position: absolute`) fără strămoș
 * poziționat, a căror poziție statică, adânc într-un tabel lat, întinde
 * `documentElement` — se vede doar cu CSS-ul real. Iar panoul lateral deplasat
 * 16 px (ONB-037) e o chestiune de cascadă în `globals.css`, pe care un DOM
 * simulat n-o aplică deloc.
 *
 * ── CE SE MĂSOARĂ ─────────────────────────────────────────────────────────
 * `scrollWidth <= clientWidth` pe `<html>` ȘI, după `scrollTo(500, 0)`,
 * `scrollX === 0`. `scrollWidth` singur minte în unele cazuri; gestul de
 * derulare e ce simte omul.
 *
 * Rulează pe staging (`pnpm test:e2e`), NU în CI și nu în `verify`.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

import { caleStare, type Rol } from "./conturi";
import { navigheaza } from "./navigare";

type Ecran = { readonly width: number; readonly height: number };

const TELEFON: Ecran = { width: 390, height: 844 };
const TABLETA: Ecran = { width: 820, height: 1180 };
const LAPTOP: Ecran = { width: 1440, height: 900 };

async function pagina(browser: Browser, rol: Rol, viewport: Ecran): Promise<Page> {
  // `browser.newContext` NU moștenește `use` din config: baza, autentificarea
  // de bază a staging-ului și restul se trec explicit (ca în `concediu.spec.ts`).
  const { baseURL, httpCredentials, locale, timezoneId } = test.info().project.use;
  const context = await browser.newContext({
    ...(baseURL === undefined ? {} : { baseURL }),
    ...(httpCredentials === undefined ? {} : { httpCredentials }),
    ...(locale === undefined ? {} : { locale }),
    ...(timezoneId === undefined ? {} : { timezoneId }),
    viewport,
    storageState: caleStare(rol),
  });
  return context.newPage();
}

async function derulareaPaginii(
  page: Page,
): Promise<{ scrollWidth: number; clientWidth: number; scrollX: number }> {
  return page.evaluate(() => {
    const d = document.documentElement;
    window.scrollTo(500, 0);
    return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, scrollX: window.scrollX };
  });
}

const CAZURI: readonly {
  readonly cale: string;
  readonly rol: Rol;
  readonly ecrane: readonly Ecran[];
}[] = [
  { cale: "/pontaj?vizualizare=lista", rol: "org_admin", ecrane: [TELEFON, TABLETA] },
  { cale: "/pontaj?vizualizare=luna", rol: "org_admin", ecrane: [TELEFON, TABLETA] },
  // Rolul cu `th`-ul de acțiuni (`poateScrie`); `hr` nu l-a văzut niciodată.
  { cale: "/registru/nomenclator", rol: "org_admin", ecrane: [TELEFON, TABLETA] },
  { cale: "/portal/pontajul-meu", rol: "employee", ecrane: [TELEFON, TABLETA] },
  {
    cale: "/concedii/calendar?vedere=planificator",
    rol: "org_admin",
    ecrane: [TELEFON, TABLETA, LAPTOP],
  },
];

for (const { cale, rol, ecrane } of CAZURI) {
  for (const ecran of ecrane) {
    test(`${cale} (${rol}) nu derulează pagina lateral la ${String(ecran.width)} px`, async ({
      browser,
    }) => {
      const page = await pagina(browser, rol, ecran);
      await navigheaza(page, cale);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const m = await derulareaPaginii(page);
      expect(m.scrollWidth, JSON.stringify(m)).toBeLessThanOrEqual(m.clientWidth);
      expect(m.scrollX, JSON.stringify(m)).toBe(0);
      await page.context().close();
    });
  }
}

test("planificatorul de concedii arată ziua 31 fără derulare la 1440 px (UX-013)", async ({
  browser,
}) => {
  const page = await pagina(browser, "org_admin", LAPTOP);
  await navigheaza(page, "/concedii/calendar?vedere=planificator&an=2026&luna=10");
  const tabel = page.getByRole("table").first();
  await expect(tabel).toBeVisible();
  const container = await tabel.evaluate((t) => {
    const c = t.parentElement;
    return c === null ? null : { scrollWidth: c.scrollWidth, clientWidth: c.clientWidth };
  });
  expect(container).not.toBeNull();
  expect(container?.scrollWidth ?? Infinity).toBeLessThanOrEqual(container?.clientWidth ?? 0);
  await page.context().close();
});

test("panoul „Persoane nerepartizate” rămâne în ecran la 1440 px (ONB-037)", async ({
  browser,
}) => {
  const page = await pagina(browser, "org_admin", LAPTOP);
  // Panoul se deschide din adresă (`?departament=nerepartizati`).
  await navigheaza(page, "/departamente?departament=nerepartizati");
  // NU primul `<dialog>`: acela e paleta de comenzi (⌘K).
  const panou = page.locator('dialog[data-panou="lateral"][open]');
  await expect(panou).toBeVisible();
  // `poll` acoperă tranziția de intrare (`--durata-lent`).
  await expect
    .poll(() => panou.evaluate((el) => el.getBoundingClientRect().right - window.innerWidth))
    .toBeLessThanOrEqual(0);
  await page.context().close();
});
