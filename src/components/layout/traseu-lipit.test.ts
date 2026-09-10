// src/components/layout/traseu-lipit.test.ts
//
// POARTA: o coloană laterală nu are voie să fie în același timp TRASEUL vopsit
// și PARTEA LIPITĂ.
//
// ── DEFECTUL PE CARE ÎL PRINDE ──────────────────────────────────────────────
// `bg-primary sticky top-0 h-dvh` pe același element pare corect și se comportă
// corect la derulare obișnuită. Dar `h-dvh` înseamnă „o înălțime de fereastră",
// iar fundalul se oprește acolo: pe orice pagină mai lungă decât ecranul,
// restul coloanei rămâne fundalul paginii. Lipirea ascunde golul cât timp
// funcționează — și nu funcționează la o captură de pagină întreagă, la
// tipărire, sau dacă vreun strămoș capătă `overflow` altul decât `visible`,
// care rupe `position: sticky` fără niciun avertisment.
//
// Reparația e structurală, nu cosmetică: elementul exterior e traseul (static,
// întins cât containerul, cu fundalul pe el), iar învelișul dinăuntru e partea
// lipită (`sticky top-0 h-dvh`). Verificat măsurând, pe un document de 2621px:
// bara rămâne fixată identic, iar coloana se vopsește până jos.
//
// ── DE CE REGULA CERE ȘI `bg-` ──────────────────────────────────────────────
// `sticky` împreună cu `h-dvh` e perfect legitim — chiar așa arată învelișul
// interior după reparație. Ce nu e legitim e ca ACELAȘI element să poarte și
// fundalul: atunci vopseaua e legată de înălțimea ferestrei, nu de a coloanei.
// Cele trei împreună sunt defectul; oricare două, nu.
//
// Găsit pe 10 sept 2026, în `components/layout/sidebar.tsx` (aplicația) și în
// `(portal)/_components/rail-portal.tsx` (portalul), amândouă cu același tipar.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const RADACINA = join(import.meta.dirname, "..", "..");

/** Aceeași plimbare ca în `src/config/filtru-gol.test.ts`, fără dependență nouă. */
function plimba(dir: string): string[] {
  const gasite: string[] = [];
  for (const intrare of readdirSync(dir, { withFileTypes: true })) {
    const cale = join(dir, intrare.name);
    if (intrare.isDirectory()) gasite.push(...plimba(cale));
    else if (/\.tsx$/u.test(intrare.name) && !/\.test\.tsx$/u.test(intrare.name)) gasite.push(cale);
  }
  return gasite;
}

/** Clasele care fac un element lipit, cu sau fără prefix de ecran. */
const LIPIT = /(?:^|\s|")(?:[a-z]{2}:)?sticky(?:\s|"|$)/;
/** Înălțimile legate de fereastră, nu de conținut. */
const INALTIME_FEREASTRA = /(?:^|\s)(?:[a-z]{2}:)?(?:h-dvh|h-screen)(?:\s|"|$)/;
/** Un fundal opac pe același element. `bg-transparent` nu vopsește nimic. */
const FUNDAL = /(?:^|\s)(?:[a-z]{2}:)?bg-(?!transparent|none)[a-z]/;

/** Șirurile de clase dintr-un fișier, oricum ar fi scrise. */
function claseDin(sursa: string): readonly string[] {
  return [...sursa.matchAll(/"([^"\n]*)"/g)].map((m) => m[1] ?? "");
}

describe("traseul lipit nu poartă și fundalul", () => {
  const fisiere = plimba(RADACINA);

  it("găsește fișiere de analizat", () => {
    expect(fisiere.length).toBeGreaterThan(100);
  });

  it("niciun element nu e deodată lipit, înalt cât fereastra și vopsit", () => {
    const vinovate: string[] = [];

    for (const relativ of fisiere) {
      const sursa = readFileSync(relativ, "utf8");
      for (const clase of claseDin(sursa)) {
        if (LIPIT.test(clase) && INALTIME_FEREASTRA.test(clase) && FUNDAL.test(clase)) {
          vinovate.push(`${relative(RADACINA, relativ)}: ${clase.slice(0, 90)}`);
        }
      }
    }

    expect(
      vinovate,
      "Un element lipit cu înălțime de fereastră ȘI fundal vopsește doar primul ecran; " +
        "restul coloanei rămâne gol pe o pagină lungă. Separă traseul (exterior, static, " +
        "cu fundalul) de partea lipită (interior, `sticky top-0 h-dvh`).",
    ).toEqual([]);
  });
});
