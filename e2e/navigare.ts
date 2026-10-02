import type { Page, Response } from "@playwright/test";

/**
 * `page.goto` cu reîncercare, și numai pentru erorile de REȚEA ale mașinii.
 *
 * Pe VM-ul ăsta, Chromium anulează din când în când navigarea în curs cu
 * `net::ERR_NETWORK_CHANGED` — semnalul lui că s-a schimbat o adresă sau o
 * interfață a mașinii. Măsurat pe 2026-10-02: 2–3 din ~110 teste per rulare, pe
 * rute fără nicio legătură între ele, iar o reîncercare unică a căzut uneori în
 * aceeași rafală. Cauza exactă NU e dovedită (bănuiala: interfețele virtuale
 * ale Docker Swarm; două minute de `ip monitor link address` în repaus n-au
 * arătat nimic). Aceeași eroare apare și ca „interrupted by another navigation
 * to chrome-error://chromewebdata/" — pagina de eroare de REȚEA a lui
 * Chromium, care nu poate proveni dintr-un răspuns HTTP (urma o arată cu
 * `ERR_NETWORK_CHANGED` dedesubt).
 *
 * Un 4xx/5xx, o limită de eroare sau un redirect greșit NU se reîncearcă: trec
 * neatinse mai departe, la aserțiunile testului.
 */
const SEMNE_RETEA = ["ERR_NETWORK_CHANGED", "chrome-error://chromewebdata/"];

/** Câte încercări în total. Rafalele de evenimente de rețea țin câteva sute de ms. */
const INCERCARI = 4;

export async function navigheaza(page: Page, cale: string): Promise<Response | null> {
  for (let incercare = 1; ; incercare += 1) {
    try {
      return await page.goto(cale, { waitUntil: "domcontentloaded" });
    } catch (eroare) {
      const text = String(eroare);
      if (incercare >= INCERCARI || !SEMNE_RETEA.some((semn) => text.includes(semn))) throw eroare;
      await page.waitForTimeout(1_500 * incercare);
    }
  }
}
