/**
 * Fluxul complet al unei sesizări de defecțiune, de la echipamentul nou la
 * confirmarea raportorului, pe patru conturi demo:
 *
 *   1. `org_admin` (Ana Ionescu) adaugă un echipament din CASETA de pe listă
 *      (`/mentenanta/echipamente?echipament=nou`) și ajunge pe fișa lui;
 *   2. aceeași persoană deschide eticheta QR a echipamentului și citește adresa pe
 *      care o codifică: forma veche, TIPĂRITĂ pe autocolante
 *      (`/mentenanta/sesizari/noua?echipament=<id>`);
 *   3. `employee` (Ioana Georgescu) deschide exact acea adresă — ca și cum ar
 *      scana autocolantul — și ajunge în portal, în caseta de sesizare cu utilajul
 *      precompletat; trimite sesizarea;
 *   4. `org_admin` o triază („În analiză") și o atribuie lui Radu Pop;
 *   5. `manager` (Radu Pop), ca tehnician ATRIBUIT — nu ca manager —, începe
 *      lucrul și o rezolvă, cu intervenția înregistrată în aceeași casetă;
 *   6. `employee` (raportorul) confirmă rezolvarea: sesizarea devine „Închisă";
 *   7. curățenie: `org_admin` șterge echipamentul de probă (cu codul tastat).
 *
 * ── CE ARE NOU FAȚĂ DE `concediu.spec.ts` ──────────────────────────────────
 * Primul spec cu CASETE (`<dialog>` nativ, `showModal()`): rolul `dialog` e
 * găsit de Playwright, dar un clic dat ÎNAINTE de hidratare nu are niciun efect
 * și nicio eroare — de aceea fiecare casetă se deschide cu `deschideCaseta`, care
 * reîncearcă declanșatorul până apare caseta, la fel cum `apasaPanaApare` din
 * `concediu.spec.ts` reîncearcă un buton.
 *
 * ── RE-RULABIL ─────────────────────────────────────────────────────────────
 * Codul echipamentului poartă un sufix de timp, deci două rulări nu se ciocnesc
 * pe unicitatea codului; curățenia (pasul 7) rulează și din `finally`, când un
 * pas din mijloc a căzut. O sesizare rămasă deschisă blochează ștergerea
 * echipamentului (baza o refuză, cazul 17) — atunci rămâne în evidență, cu codul
 * `E2E-…`, ușor de recunoscut.
 *
 * ── NU SE RULEAZĂ LOCAL ────────────────────────────────────────────────────
 * Ca toate specurile de aici, rulează pe STAGING, după deploy
 * (`pnpm test:e2e e2e/mentenanta.spec.ts`). Verificare fără rulare:
 * `pnpm exec playwright test --list e2e/mentenanta.spec.ts`.
 */
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

import { caleStare, type Rol } from "./conturi";
import { navigheaza } from "./navigare";

test.describe.configure({ mode: "serial" });

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

async function pagina(browser: Browser, rol: Rol): Promise<Page> {
  // `browser.newContext` NU moștenește `use` din config: baza, autentificarea
  // de bază a staging-ului și restul se trec explicit (ca în `concediu.spec.ts`).
  const { baseURL, httpCredentials, locale, timezoneId, viewport } = test.info().project.use;
  const context = await browser.newContext({
    ...(baseURL === undefined ? {} : { baseURL }),
    ...(httpCredentials === undefined ? {} : { httpCredentials }),
    ...(locale === undefined ? {} : { locale }),
    ...(timezoneId === undefined ? {} : { timezoneId }),
    ...(viewport === undefined ? {} : { viewport }),
    storageState: caleStare(rol),
  });
  return context.newPage();
}

/**
 * Deschide o casetă: dacă `?…=nou` a deschis-o deja la montare, nu face nimic;
 * altfel apasă declanșatorul până apare `<dialog>`-ul.
 */
async function deschideCaseta(pag: Page, declansator: string): Promise<Locator> {
  const caseta = pag.getByRole("dialog");
  await expect(async () => {
    if (!(await caseta.isVisible())) {
      await pag.getByRole("button", { name: declansator, exact: true }).first().click({
        timeout: 5_000,
      });
    }
    await expect(caseta).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  return caseta;
}

/** Apasă un buton de client până apare ce deschide el (clic înainte de hidratare = fără efect). */
async function apasaPanaApare(buton: Locator, tinta: Locator): Promise<void> {
  await expect(async () => {
    await buton.click({ timeout: 5_000 });
    await expect(tinta).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/**
 * Starea sesizării, citită dintr-o încărcare PROASPĂTĂ: nu ne bazăm pe
 * `router.refresh()` de după acțiune (vezi `concediu.spec.ts`, `asteaptaStarea`).
 */
async function asteaptaStarea(pag: Page, cale: string, eticheta: string): Promise<void> {
  await expect(async () => {
    await navigheaza(pag, cale);
    await expect(pag.getByText(eticheta, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
}

/** Confirmă un `ConfirmareActiune` deschis de `buton`; caseta se închide DOAR la succes. */
async function confirma(pag: Page, buton: Locator, etichetaConfirmare: RegExp): Promise<void> {
  const caseta = pag.getByRole("dialog");
  const confirmare = caseta.getByRole("button", { name: etichetaConfirmare });
  await apasaPanaApare(buton, confirmare);
  await confirmare.click();
  await expect(caseta).toHaveCount(0, { timeout: 30_000 });
}

/** Șterge echipamentul de probă. `obligatoriu`: în fluxul principal, eșecul e o EROARE. */
async function stergeEchipament(
  admin: Page,
  idEchipament: string,
  cod: string,
  obligatoriu: boolean,
): Promise<void> {
  await navigheaza(admin, `/mentenanta/echipamente/${idEchipament}`);
  const sterge = admin.getByRole("button", { name: "Șterge", exact: true });
  if (!obligatoriu && (await sterge.count()) === 0) return;
  const caseta = admin.getByRole("dialog");
  await apasaPanaApare(sterge, caseta);
  await caseta.getByLabel(/Scrieți/).fill(cod);
  await caseta.getByRole("button", { name: "Șterge echipamentul" }).click();
  await expect(admin).toHaveURL(/\/mentenanta\/echipamente$/, { timeout: 30_000 });
}

test("sesizare de la capăt la capăt: echipament nou, QR, raportare, triaj, tehnician, confirmare", async ({
  browser,
}) => {
  test.setTimeout(420_000);
  const admin = await pagina(browser, "org_admin");
  const angajat = await pagina(browser, "employee");
  const tehnician = await pagina(browser, "manager");

  const cod = `E2E-${Date.now().toString(36).toUpperCase()}`;
  const denumire = `Presă de probă ${cod}`;
  let idEchipament: string | null = null;
  let idSesizare: string | null = null;

  try {
    await test.step("administratorul adaugă echipamentul din casetă", async () => {
      await navigheaza(admin, "/mentenanta/echipamente?echipament=nou");
      const caseta = await deschideCaseta(admin, "Echipament nou");
      await caseta.getByLabel(/^Cod\b/).fill(cod);
      await caseta.getByLabel(/^Denumire\b/).fill(denumire);
      await caseta.getByRole("button", { name: "Adaugă echipamentul" }).click();

      // `laReusita` duce direct pe fișa echipamentului nou.
      await admin.waitForURL(new RegExp(`/mentenanta/echipamente/${UUID}$`), { timeout: 45_000 });
      idEchipament = new URL(admin.url()).pathname.split("/").pop() ?? null;
      expect(idEchipament, "id-ul echipamentului creat").not.toBeNull();
      await expect(admin.getByRole("heading", { level: 1 })).toContainText(denumire);
    });

    const adresaQr =
      await test.step("eticheta QR codifică adresa tipărită pe autocolante", async () => {
        await navigheaza(admin, `/mentenanta/echipamente/${idEchipament ?? ""}/eticheta`);
        await expect(
          admin.getByLabel(`Cod QR pentru sesizarea unei defecțiuni la ${cod}`),
        ).toBeVisible();
        const text = await admin.locator("body").innerText();
        const adresa = /Codul duce la:\s*(\S+)/.exec(text)?.[1];
        expect(adresa, "adresa de sub etichetă").toBeDefined();
        const { pathname, search } = new URL(adresa ?? "");
        // Forma VECHE a adresei, cea de pe autocolantele deja lipite — nu se schimbă
        // niciodată, fiindcă un autocolant nu se actualizează cu un deploy.
        expect(pathname).toBe("/mentenanta/sesizari/noua");
        expect(search).toBe(`?echipament=${idEchipament ?? ""}`);
        return `${pathname}${search}`;
      });

    await test.step("angajatul scanează adresa și trimite sesizarea din portal", async () => {
      await navigheaza(angajat, adresaQr);
      // `employee` nu vede aplicația mare: învelișul îl mută în portal, iar
      // `/portal/sesizari/noua` deschide caseta, cu `?echipament=` păstrat.
      await expect(angajat).toHaveURL(/\/portal\/sesizari\?/, { timeout: 30_000 });
      expect(new URL(angajat.url()).searchParams.get("sesizare")).toBe("noua");
      expect(new URL(angajat.url()).searchParams.get("echipament")).toBe(idEchipament);

      const caseta = await deschideCaseta(angajat, "Sesizare nouă");
      // Utilajul vine precompletat din adresă — omul nu caută nimic.
      await expect(caseta.getByText(cod)).toBeVisible({ timeout: 20_000 });
      await caseta
        .getByLabel(/Ce s-a defectat/)
        .fill("Presa pierde ulei la cilindru și face zgomot la ridicare (probă automată).");
      await caseta.getByRole("button", { name: "Trimite sesizarea" }).click();

      await angajat.waitForURL(new RegExp(`/portal/sesizari/${UUID}$`), { timeout: 45_000 });
      idSesizare = new URL(angajat.url()).pathname.split("/").pop() ?? null;
      expect(idSesizare, "id-ul sesizării create").not.toBeNull();
      await expect(angajat.getByText("Nouă", { exact: true }).first()).toBeVisible();
    });

    const caleAdmin = `/mentenanta/sesizari/${idSesizare ?? ""}`;

    await test.step("administratorul o triază („În analiză”)", async () => {
      await navigheaza(admin, caleAdmin);
      await confirma(
        admin,
        admin.getByRole("button", { name: "În analiză", exact: true }),
        /Trece în „În analiză”/,
      );
      await asteaptaStarea(admin, caleAdmin, "În analiză");
    });

    await test.step("administratorul o atribuie lui Radu Pop", async () => {
      await navigheaza(admin, caleAdmin);
      const caseta = await deschideCaseta(admin, "Atribuie");
      const ales = caseta.getByLabel(/^Tehnician\b/);
      const valoare = await ales
        .locator("option", { hasText: "Pop" })
        .first()
        .getAttribute("value");
      expect(valoare, "Radu Pop în lista de tehnicieni").not.toBeNull();
      await ales.selectOption(valoare ?? "");
      await caseta.getByRole("button", { name: "Salvează atribuirea" }).click();
      await expect(caseta).toHaveCount(0, { timeout: 30_000 });

      await expect(async () => {
        await navigheaza(admin, caleAdmin);
        await expect(admin.locator("dd", { hasText: "Pop" }).first()).toBeVisible({
          timeout: 5_000,
        });
      }).toPass({ timeout: 45_000 });
    });

    await test.step("tehnicianul atribuit începe lucrul", async () => {
      const caleTehnician = `/mentenanta/sesizari/${idSesizare ?? ""}`;
      await navigheaza(tehnician, caleTehnician);
      await confirma(
        tehnician,
        tehnician.getByRole("button", { name: "Începe lucrul", exact: true }),
        /Trece în „În lucru”/,
      );
      await asteaptaStarea(tehnician, caleTehnician, "În lucru");
    });

    await test.step("tehnicianul o rezolvă, cu intervenția în aceeași casetă", async () => {
      await navigheaza(tehnician, `/mentenanta/sesizari/${idSesizare ?? ""}`);
      const caseta = await deschideCaseta(tehnician, "Rezolvă");
      // Exact unul dintre executantul-angajat și firma externă (cazul 33).
      await caseta.getByLabel(/^Executant \(firmă externă\)/).fill("Atelier propriu (probă)");
      await caseta
        .getByLabel(/^Ce s-a făcut\b/)
        .fill("Înlocuită garnitura cilindrului și făcută probă de presiune.");
      await caseta
        .getByLabel(/^Mesaj pentru raportor/)
        .fill("Garnitura a fost schimbată; presa nu mai pierde ulei.");
      await caseta.getByRole("button", { name: "Confirmă rezolvarea" }).click();
      await expect(caseta).toHaveCount(0, { timeout: 45_000 });
      await asteaptaStarea(tehnician, `/mentenanta/sesizari/${idSesizare ?? ""}`, "Rezolvată");
    });

    await test.step("raportorul confirmă din portal: „Închisă”", async () => {
      const caleRaportor = `/portal/sesizari/${idSesizare ?? ""}`;
      await asteaptaStarea(angajat, caleRaportor, "Rezolvată");
      await confirma(
        angajat,
        angajat.getByRole("button", { name: "Confirmă rezolvarea", exact: true }),
        /Confirmă și închide/,
      );
      await asteaptaStarea(angajat, caleRaportor, "Închisă");
    });

    await test.step("curățenie: administratorul șterge echipamentul de probă", async () => {
      await stergeEchipament(admin, idEchipament ?? "", cod, true);
      idEchipament = null;
    });
  } finally {
    if (idEchipament !== null) {
      await stergeEchipament(admin, idEchipament, cod, false).catch(() => undefined);
    }
    await admin.context().close();
    await angajat.context().close();
    await tehnician.context().close();
  }
});
