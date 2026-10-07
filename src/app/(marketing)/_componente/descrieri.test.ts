import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Descrierea fiecărei pagini publice, așa cum o DECLARĂ pagina — importată, nu
 * citită din sursă.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Auditul din 6 oct 2026 a găsit 20 din 56 de descrieri peste 160 de caractere
 * (cea de pe `/unelte`, 195). Google taie fragmentul pe la 155–160 și pune „…"
 * exact peste coada care spunea „Model gratuit" sau „cu articolul de lege".
 * Niciun test nu le măsura: descrierile stau în 30 de fișiere, unele construite
 * din constante (`/en/preturi`) sau din conținut (`/domenii/[domeniu]`,
 * `/module/[modul]`), deci un `grep` pe sursă nu le vede pe toate.
 *
 * De aceea testul IMPORTĂ fiecare `page.tsx` și citește `metadata` sau
 * `generateMetadata`, pe fiecare parametru din `generateStaticParams` — aceeași
 * valoare care ajunge în `<meta name="description">`.
 */

const RADACINA = "src/app/(marketing)";
const MAXIM = 160;
const MINIM = 70;

function pagini(dir: string): string[] {
  return readdirSync(dir).flatMap((nume) => {
    const cale = join(dir, nume);
    if (statSync(cale).isDirectory()) return pagini(cale);
    return nume === "page.tsx" ? [cale] : [];
  });
}

type ModulPagina = {
  metadata?: { description?: unknown };
  generateMetadata?: (a: {
    params: Promise<Record<string, string>>;
  }) => Promise<{ description?: unknown }>;
  generateStaticParams?: () => Promise<Record<string, string>[]> | Record<string, string>[];
};

async function descrieri(): Promise<{ unde: string; text: string }[]> {
  const rezultat: { unde: string; text: string }[] = [];
  for (const fisier of pagini(RADACINA)) {
    const modul = (await import(/* @vite-ignore */ resolve(fisier))) as ModulPagina;
    const parametri = modul.generateStaticParams ? await modul.generateStaticParams() : [{}];
    for (const p of parametri) {
      const date = modul.generateMetadata
        ? await modul.generateMetadata({ params: Promise.resolve(p) })
        : modul.metadata;
      const unde = `${fisier.replace(RADACINA, "")} ${JSON.stringify(p)}`;
      rezultat.push({ unde, text: typeof date?.description === "string" ? date.description : "" });
    }
  }
  return rezultat;
}

describe("descrierile paginilor publice", { timeout: 120_000 }, () => {
  it(`au între ${String(MINIM)} și ${String(MAXIM)} de caractere și sunt unice`, async () => {
    const toate = await descrieri();
    // Sonda de control: dacă importul ar eșua tăcut, lista ar fi goală și
    // testul ar trece fără să fi măsurat nimic. 36 de fișiere, 57 de pagini.
    expect(toate.length).toBeGreaterThan(50);

    for (const { unde, text } of toate) {
      expect(text.length, `${unde}: ${text}`).toBeGreaterThanOrEqual(MINIM);
      expect(text.length, `${unde}: ${text}`).toBeLessThanOrEqual(MAXIM);
    }

    const vazute = new Map<string, string>();
    for (const { unde, text } of toate) {
      expect(
        vazute.get(text),
        `${unde} repetă descrierea de la ${String(vazute.get(text))}`,
      ).toBeUndefined();
      vazute.set(text, unde);
    }
  });
});
