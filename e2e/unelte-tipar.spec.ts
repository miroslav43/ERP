/**
 * Tipărirea uneltelor gratuite, pe staging: build de producție, cu hidratare.
 *
 * Auditul din 8 oct 2026: foaia de pontaj tipărită din browser ieșea pe 4–5
 * pagini, cu meniul, bara de cookie-uri și subsolul; cererea de concediu pe 3.
 * Local, `next dev` nu termină hidratarea și bara de cookie-uri nu apare deloc,
 * deci ea se poate verifica doar aici. Testul cere ÎNTÂI ca bara să fie
 * vizibilă pe ecran: fără asta, „ascunsă la tipar” ar trece și cu o bară care
 * nu s-a montat niciodată.
 */
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const nume = (n: number) =>
  encodeURIComponent(
    Array.from({ length: n }, (_, i) => `Angajat Numărul ${String(i + 1)}`).join("\n"),
  );

/**
 * `eticheta` dă titlul testului. Fără ea, cele două foi de pontaj aveau același
 * titlu (primele 60 de caractere ale adresei sunt identice), iar Playwright
 * refuză titlurile duplicate dintr-un fișier.
 */
const PAGINI: readonly {
  eticheta: string;
  cale: string;
  culcat: boolean;
  pagini: readonly [number, number];
}[] = [
  {
    eticheta: "foaie de pontaj, 10 nume",
    cale: `/unelte/foaie-de-pontaj?luna=5&an=2027&angajati=${nume(10)}`,
    culcat: true,
    pagini: [1, 1],
  },
  {
    eticheta: "foaie de pontaj, 60 de nume",
    cale: `/unelte/foaie-de-pontaj?luna=5&an=2027&angajati=${nume(60)}`,
    culcat: true,
    pagini: [2, 4],
  },
  {
    eticheta: "cerere de concediu",
    cale: "/unelte/cerere-concediu-de-odihna?salariat=Popa%20Ion&de_la=2026-11-16&pana_la=2026-11-20",
    culcat: false,
    pagini: [1, 1],
  },
  {
    eticheta: "condica de prezență",
    cale: `/unelte/condica-de-prezenta?luna=5&an=2027&angajati=${nume(1)}`,
    culcat: false,
    pagini: [1, 2],
  },
  {
    eticheta: "foaie de parcurs",
    cale: "/unelte/foaie-de-parcurs?luna=5&an=2027",
    culcat: true,
    pagini: [1, 3],
  },
  { eticheta: "fișa SSM", cale: "/unelte/fisa-instruire-ssm", culcat: true, pagini: [1, 3] },
  { eticheta: "fișa de evaluare", cale: "/unelte/fisa-evaluare", culcat: false, pagini: [1, 2] },
];

for (const p of PAGINI) {
  test(`tipar: ${p.eticheta}`, async ({ page }) => {
    await page.goto(p.cale);
    const bara = page.getByRole("region", { name: "Cookie-uri de analiză" });
    await expect(bara).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(bara).toBeHidden();
    const vizibile = await page.evaluate(() =>
      [...document.querySelectorAll("section, header, footer, [role=region]")]
        .filter((e) => e.getClientRects().length > 0)
        .filter((e) => e.id === "documentul" || e.closest("#documentul") === null)
        .map((e) => e.id || e.tagName.toLowerCase()),
    );
    expect(vizibile).toEqual(["documentul"]);

    // Pe mai multe pagini, capul de tabel se repetă (globals.css: thead → table-header-group).
    const thead = await page.evaluate(() => {
      const el = document.querySelector("#documentul thead");
      return el === null ? null : getComputedStyle(el).display;
    });
    if (thead !== null) expect(thead).toBe("table-header-group");

    const pdf = await PDFDocument.load(await page.pdf({ format: "A4", preferCSSPageSize: true }));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(p.pagini[0]);
    expect(pdf.getPageCount()).toBeLessThanOrEqual(p.pagini[1]);
    for (const foaie of pdf.getPages()) {
      expect(foaie.getWidth() > foaie.getHeight()).toBe(p.culcat);
    }
  });
}
