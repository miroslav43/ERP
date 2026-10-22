// src/lib/rute/segmente-dinamice.test.ts
//
// Poartă de FORMĂ: fiecare `page.tsx` / `route.ts` de sub un segment dinamic
// care poartă un UUID trece segmentul prin `idDinRuta` (pagini) sau prin
// `esteIdDeRuta` (route handler-e cu răspuns text/plain), ambele din
// `@/lib/rute/parametri`.
//
// De ce pe sursă: paginile n-au teste unitare, iar `tsc`, `eslint` și `vitest`
// tac toate trei pe un `.eq("id", sirBrut)` — șirul e `string`, coloana e
// `string`, totul compilează. Defectul apare abia la Postgres, ca 22P02
// („invalid input syntax for type uuid"), și iese la suprafață ca ecran de
// eroare cu cod de incident (PRM-003, ADM-043) sau ca 500 pe handler-e.
// Helper-ul există din august 2026, iar docblock-ul lui a prezis exact asta:
// „A cincea [pagină] va fi scrisă de altcineva" — la campania QA erau 15.
//
// Segmentele se clasifică PE NUME, în două liste explicite. Un segment nou cu
// alt nume (ex. `[contractId]`) nu e ghicit: testul cade și cere să fie pus
// într-una dintre liste. Un regex lax pe `\[.*\]` ar fi dat fals-pozitive pe
// `[cod]`, `[token]`, `[domeniu]`, `[modul]`, `[unealta]`, `[data]`, iar poarta
// ar fi fost stinsă la primul zgomot.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Segmentele care poartă un UUID: cer `idDinRuta` sau `esteIdDeRuta`. */
const SEGMENTE_UUID: ReadonlySet<string> = new Set([
  "[id]",
  "[orgId]",
  "[versiuneId]",
  "[entryId]",
  "[alocare]",
  "[lectieId]",
  "[pv]", // flota/[id]/pv/[pv] — procesul-verbal de predare (0215), `idDinRuta`
]);

/** Segmentele care NU sunt UUID-uri; fiecare își validează valoarea altfel. */
const SEGMENTE_NON_UUID: ReadonlySet<string> = new Set([
  "[cod]", // sabloane-documente (catalog → notFound), portal/ponteaza (cod de pontaj)
  "[token]", // invitatie — `tokenInvitatieSchema.safeParse`
  "[domeniu]", // marketing — catalog → notFound()
  "[modul]", // marketing — catalog → notFound()
  "[unealta]", // api/unelte — `constructorPentru === undefined` → 404
  "[data]", // portal/pontajul-meu/zi — `ziDinRuta`
]);

function fisiereDeRuta(radacina: string): string[] {
  const gasite: string[] = [];
  const mergi = (cale: string) => {
    for (const intrare of readdirSync(cale, { withFileTypes: true })) {
      const plin = join(cale, intrare.name);
      if (intrare.isDirectory()) mergi(plin);
      else if (intrare.name === "page.tsx" || intrare.name === "route.ts") {
        gasite.push(plin.replaceAll("\\", "/"));
      }
    }
  };
  mergi(radacina);
  return gasite.sort();
}

function segmenteDinamice(cale: string): string[] {
  return cale.split("/").filter((segment) => segment.startsWith("["));
}

/**
 * Codul fără comentarii: un comentariu care citează `idDinRuta` nu validează
 * nimic. Aproximarea e suficientă — nicio pagină nu pune `//` sau `/*` într-un
 * șir lângă numele helper-ului.
 */
function cod(fisier: string): string {
  return readFileSync(fisier, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const IMPORT_HELPER =
  /import\s*\{[^}]*\b(?:idDinRuta|esteIdDeRuta)\b[^}]*\}\s*from\s*["']@\/lib\/rute\/parametri["']/;
const APEL_HELPER = /\b(?:idDinRuta|esteIdDeRuta)\(/;

const SUB_SEGMENT_DINAMIC = fisiereDeRuta("src/app").filter(
  (fisier) => segmenteDinamice(fisier).length > 0,
);
const SUB_SEGMENT_UUID = SUB_SEGMENT_DINAMIC.filter((fisier) =>
  segmenteDinamice(fisier).some((segment) => SEGMENTE_UUID.has(segment)),
);

describe("segmentele dinamice de rută — PRM-003, ADM-043", () => {
  it("fiecare segment dinamic e clasificat explicit: UUID sau non-UUID", () => {
    const neclasificate = SUB_SEGMENT_DINAMIC.flatMap((fisier) =>
      segmenteDinamice(fisier)
        .filter((segment) => !SEGMENTE_UUID.has(segment) && !SEGMENTE_NON_UUID.has(segment))
        .map((segment) => `${segment} în ${fisier}`),
    );
    expect(
      neclasificate,
      "Segment dinamic nou. Dacă poartă un UUID, adaugă-l în SEGMENTE_UUID și trece-l prin " +
        "idDinRuta/esteIdDeRuta; altfel, în SEGMENTE_NON_UUID, cu un comentariu despre cum se validează.",
    ).toEqual([]);
  });

  it("fiecare pagină sau handler de sub un segment UUID trece segmentul prin helper", () => {
    const vinovate = SUB_SEGMENT_UUID.filter((fisier) => {
      const sursa = cod(fisier);
      return !IMPORT_HELPER.test(sursa) || !APEL_HELPER.test(sursa);
    });
    expect(
      vinovate,
      "Un segment care nu e UUID ajunge la Postgres ca 22P02 și iese ca ecran de eroare sau 500. " +
        "Pagini: `const id = idDinRuta(idBrut)` imediat după `await params`. Handler-e text/plain: " +
        "`if (!esteIdDeRuta(id)) return raspunsText(<textul rândului lipsă>, 404)`.",
    ).toEqual([]);
  });

  it("sonda: parcurgerea și expresiile prind forma pe care o caută", () => {
    expect(SUB_SEGMENT_UUID).toContain("src/app/(app)/concedii/[id]/page.tsx");
    expect(SUB_SEGMENT_UUID).toContain("src/app/(app)/documente/[id]/route.ts");
    expect(SUB_SEGMENT_UUID).not.toContain(
      "src/app/(app)/angajati/sabloane-documente/[cod]/page.tsx",
    );

    expect(IMPORT_HELPER.test('import { idDinRuta } from "@/lib/rute/parametri";')).toBe(true);
    expect(
      IMPORT_HELPER.test('import {\n  esteIdDeRuta,\n  ziDinRuta,\n} from "@/lib/rute/parametri";'),
    ).toBe(true);
    expect(IMPORT_HELPER.test('import { filtreDinUrl } from "@/lib/rute/parametri";')).toBe(false);
    expect(APEL_HELPER.test("const id = idDinRuta(idBrut);")).toBe(true);
    expect(APEL_HELPER.test("if (!esteIdDeRuta(id)) return")).toBe(true);
    // `cod()` taie comentariile: propoziția de mai jos stă doar în docblock-ul
    // helper-ului, deci un comentariu care citează helper-ul nu poate trece poarta.
    expect(cod("src/lib/rute/parametri.ts")).not.toContain("A cincea va fi scrisă");
  });
});
