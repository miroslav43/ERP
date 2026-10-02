/**
 * Singurul flux de SCRIERE din suita de capăt la capăt: o cerere de concediu de
 * odihnă, de la depunere la aprobare, apoi retrasă.
 *
 *   1. angajatul (demo_employee, Ioana Georgescu, DEMO-004) o depune din portal;
 *   2. managerul ei (demo_manager, Radu Pop, DEMO-003) o aprobă din
 *      `/concedii/aprobari` — în seed, `DEMO-004.seful = "DEMO-003"`, iar pe
 *      staging `employees.manager_employee_id` al Ioanei arată spre fișa lui
 *      Radu Pop (verificat 2026-10-02); faptul că sarcina apare în coada LUI e
 *      chiar dovada legăturii;
 *   3. angajatul vede „Aprobată";
 *   4. curățenia: angajatul renunță la concediul aprobat („Renunț la
 *      concediu", permis de la 0079 cât timp concediul n-a început), deci
 *      cererea ajunge „Anulată" și zilele se întorc în sold.
 *
 * ── RE-RULABIL ─────────────────────────────────────────────────────────────
 * Ziua se alege dintr-o fereastră de zile lucrătoare de ANUL VIITOR fără
 * sărbători legale (1 septembrie – 27 noiembrie), sărind peste orice zi care
 * are deja o cerere ACTIVĂ în „Concediile mele" (cele anulate nu ocupă ziua:
 * nu intră nici în verificarea de suprapunere, nici în coada managerului).
 *
 * Curățenia are trei plase, fiindcă prima versiune a lăsat în urmă trei cereri
 * APROBATE cu testul verde: butonul de renunțare era numărat înainte să apară
 * în pagină, `count()` dădea 0, iar funcția ieșea tăcut.
 *   · la final, renunțarea e OBLIGATORIE și verificată pe o încărcare nouă;
 *   · blocul `finally` reîncearcă, dacă un pas a căzut la mijloc;
 *   · la început, orice cerere încă activă din fereastră (rămasă de la o rulare
 *     oprită brutal) se anulează înainte de a depune una nouă.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

import { caleStare, type Rol } from "./conturi";
import { navigheaza } from "./navigare";

const TIP = "Concediu de odihnă";

/** Stările din care angajatul își mai poate retrage cererea (`etichete.ts` din portal). */
const ACTIVE = /Ciornă|Trimisă spre aprobare|În aprobare|Aprobată/;

// Al doilea test citește notificarea produsă de primul.
test.describe.configure({ mode: "serial" });

/** Ziua ISO → „zz.ll.aaaa", exact ca `formatDate` din `src/lib/format/date.ts`. */
function laRo(zi: string): string {
  const [an, luna, data] = zi.split("-");
  return `${data ?? ""}.${luna ?? ""}.${an ?? ""}`;
}

/** Zilele luni–vineri din fereastra fără sărbători a anului dat. */
function candidati(an: number): string[] {
  const zile: string[] = [];
  for (let t = Date.UTC(an, 8, 1); t <= Date.UTC(an, 10, 27); t += 24 * 60 * 60 * 1000) {
    const zi = new Date(t);
    const ziSaptamana = zi.getUTCDay();
    if (ziSaptamana !== 0 && ziSaptamana !== 6) zile.push(zi.toISOString().slice(0, 10));
  }
  return zile;
}

async function pagina(browser: Browser, rol: Rol): Promise<Page> {
  // `browser.newContext` NU moștenește `use` din config: baza, autentificarea
  // de bază a staging-ului și restul se trec explicit.
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
 * Deschide fișa cererii și așteaptă să fie randată ÎNTREAGĂ: legătura „Înapoi
 * la concediile mele" stă în DOM după butoanele de acțiune, deci vizibilitatea
 * ei garantează că și butoanele (dacă există) au sosit din stream.
 */
async function deschideFisa(angajat: Page, idCerere: string): Promise<void> {
  await navigheaza(angajat, `/portal/concediile-mele/${idCerere}`);
  await expect(angajat.getByRole("link", { name: "Înapoi la concediile mele" })).toBeVisible();
}

/**
 * Starea afișată în fișa cererii, citită dintr-o încărcare PROASPĂTĂ.
 *
 * Nu ne bazăm pe `router.refresh()` de după acțiune: o rafală de
 * `ERR_NETWORK_CHANGED` (vezi `navigare.ts`) îl poate pierde, iar ecranul
 * rămâne pe starea veche deși baza s-a schimbat — exact asta s-a întâmplat la a
 * treia rulare, cu cererea deja „anulata" în bază.
 */
async function asteaptaStarea(angajat: Page, idCerere: string, eticheta: string): Promise<void> {
  await expect(async () => {
    await deschideFisa(angajat, idCerere);
    await expect(angajat.getByText(eticheta, { exact: true })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
}

/**
 * Apasă un buton de client până când apare ce deschide el. Un clic dat înainte
 * de hidratare nu are niciun efect și nicio eroare; repetarea e sigură, fiindcă
 * butonul dispare chiar din momentul în care clicul a prins.
 */
async function apasaPanaApare(buton: ReturnType<Page["getByRole"]>, tinta: typeof buton) {
  await expect(async () => {
    await buton.click({ timeout: 5_000 });
    await expect(tinta).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/**
 * Renunță la cerere din fișa ei din portal.
 *
 * `obligatoriu`: în fluxul principal, lipsa butonului e o EROARE (cererea
 * aprobată și neîncepută trebuie să se poată retrage). În plasele de siguranță,
 * o cerere deja anulată n-are buton, și asta e în regulă.
 */
async function anuleaza(angajat: Page, idCerere: string, obligatoriu: boolean): Promise<void> {
  await deschideFisa(angajat, idCerere);
  const buton = angajat.getByRole("button", { name: /Renunț la concediu|Anulează cererea/ });
  if (!obligatoriu && (await buton.count()) === 0) return;
  const confirma = angajat.getByRole("button", { name: /Da, renunț|Da, anulează/ });
  await apasaPanaApare(buton, confirma);
  await confirma.click();
  // Caseta de confirmare se închide DOAR la `rezultat.ok` (actiuni-cerere.tsx).
  await expect(confirma).toHaveCount(0, { timeout: 30_000 });
  await asteaptaStarea(angajat, idCerere, "Anulată");
}

/** Rândurile din „Cererile mele": id-ul și textul (tip, interval, stare). */
async function cereriAfisate(angajat: Page): Promise<{ id: string; text: string }[]> {
  const rezultat: { id: string; text: string }[] = [];
  const legaturi = angajat.locator('a[href^="/portal/concediile-mele/"]:not([href$="/noua"])');
  for (const legatura of await legaturi.all()) {
    const href = (await legatura.getAttribute("href")) ?? "";
    const id = /\/portal\/concediile-mele\/([0-9a-f-]{36})$/.exec(href)?.[1];
    if (id !== undefined) rezultat.push({ id, text: await legatura.innerText() });
  }
  return rezultat;
}

test("concediu de odihnă: angajatul cere, managerul aprobă, angajatul vede aprobarea", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const angajat = await pagina(browser, "employee");
  const manager = await pagina(browser, "manager");
  let idCerere: string | null = null;
  const fereastra = candidati(new Date().getFullYear() + 1);

  try {
    await test.step("curăță cererile rămase active în fereastră", async () => {
      await navigheaza(angajat, "/portal/concediile-mele");
      await expect(angajat.getByRole("heading", { name: "Cererile mele" })).toBeVisible();
      const ramase = (await cereriAfisate(angajat))
        .filter((c) => ACTIVE.test(c.text) && fereastra.some((z) => c.text.includes(laRo(z))))
        .map((c) => c.id);
      for (const id of ramase) await anuleaza(angajat, id, false);
    });

    const zi = await test.step("alege o zi liberă de anul viitor", async () => {
      await navigheaza(angajat, "/portal/concediile-mele");
      await expect(angajat.getByRole("heading", { name: "Cererile mele" })).toBeVisible();
      // Doar cererile ACTIVE ocupă o zi: cele anulate nu intră nici în
      // verificarea de suprapunere (`verificaInainteDeTrimitere`), nici în coada
      // managerului. Altfel fereastra s-ar epuiza după ~60 de rulări.
      const ocupate = (await cereriAfisate(angajat))
        .filter((c) => ACTIVE.test(c.text))
        .map((c) => c.text);
      // Pornire dependentă de ceas: două rulări apropiate nu încearcă aceeași zi.
      const start = Math.floor(Date.now() / 60_000) % fereastra.length;
      const rotite = [...fereastra.slice(start), ...fereastra.slice(0, start)];
      const libera = rotite.find((z) => !ocupate.some((text) => text.includes(laRo(z))));
      if (libera === undefined) throw new Error("Nicio zi liberă rămasă în fereastra de test.");
      return libera;
    });
    const ziRo = laRo(zi);

    await test.step(`angajatul depune cererea pentru ${ziRo}`, async () => {
      await navigheaza(angajat, "/portal/concediile-mele/noua");
      await angajat.getByLabel("Tipul de concediu").selectOption({ label: TIP });
      await angajat.getByLabel("Din data").fill(ziRo);
      await angajat.getByLabel("Din data").press("Tab");
      await expect(angajat.getByLabel("Până în data")).toHaveValue(ziRo);
      await expect(angajat.getByText("1 zi lucrătoare", { exact: false })).toBeVisible();
      await angajat.getByRole("button", { name: "Trimite cererea" }).click();

      await angajat.waitForURL(/\/portal\/concediile-mele\/[0-9a-f-]{36}$/);
      idCerere = new URL(angajat.url()).pathname.split("/").pop() ?? null;
      expect(idCerere, "id-ul cererii create").not.toBeNull();
      await asteaptaStarea(angajat, idCerere ?? "", "Trimisă spre aprobare");
    });

    await test.step("managerul o găsește în coada lui și o aprobă", async () => {
      await navigheaza(manager, "/concedii/aprobari");
      const rand = manager
        .getByRole("listitem")
        // Coada afișează „Nume Prenume (marca)": „Georgescu Ioana (DEMO-004)".
        .filter({ hasText: "Georgescu Ioana (DEMO-004)" })
        .filter({ hasText: `${ziRo} – ${ziRo}` });
      await expect(rand).toHaveCount(1);
      const confirma = rand.getByRole("button", { name: "Confirmă aprobarea" });
      await apasaPanaApare(rand.getByRole("button", { name: "Aprobă" }), confirma);
      await confirma.click();
      // Panoul de decizie se închide DOAR la `rezultat.ok` (decizie-aprobare.tsx).
      await expect(confirma).toHaveCount(0, { timeout: 30_000 });
      await expect(async () => {
        await navigheaza(manager, "/concedii/aprobari");
        await expect(manager.getByRole("heading", { level: 1, name: "Aprobări" })).toBeVisible();
        await expect(rand).toHaveCount(0, { timeout: 5_000 });
      }).toPass({ timeout: 45_000 });
    });

    await test.step("angajatul vede cererea aprobată", async () => {
      await asteaptaStarea(angajat, idCerere ?? "", "Aprobată");
    });

    await test.step("curățenie: angajatul renunță la concediul aprobat", async () => {
      await anuleaza(angajat, idCerere ?? "", true);
      idCerere = null;
    });
  } finally {
    if (idCerere !== null) await anuleaza(angajat, idCerere, false).catch(() => undefined);
    await angajat.context().close();
    await manager.context().close();
  }
});

/*
 * Cardul „Ce s-a mai întâmplat" din tabloul portalului randa `notificare.link`
 * BRUT — `/concedii/<uuid>`, ruta aplicației mari scrisă de trigger. Pentru
 * angajat, poarta din `src/app/(app)/layout.tsx` o redirecționează în
 * `/portal`, deci clicul îl aducea înapoi pe același tablou. Reparat (2 oct
 * 2026) prin `caleaDePortal`, ca în „Notificările mele". Rulează după fluxul de
 * mai sus, care garantează cel puțin o notificare de aprobare.
 */
test("notificarea de aprobare din tabloul portalului duce la cererea angajatului", async ({
  browser,
}) => {
  const angajat = await pagina(browser, "employee");
  try {
    await navigheaza(angajat, "/portal");
    const notificare = angajat
      .getByRole("link", { name: /Cererea de concediu a fost aprobată/ })
      .first();
    await expect(notificare).toBeVisible();
    await expect(notificare).toHaveAttribute("href", /^\/portal\/concediile-mele\/[0-9a-f-]{36}$/, {
      timeout: 5_000,
    });
  } finally {
    await angajat.context().close();
  }
});
