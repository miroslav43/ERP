import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Capcana #45: `revalidatePath("/", "layout")` + o rută dinamică cu
 * `dynamicParams = false` = 404 permanent pe replica pe care a rulat acțiunea,
 * pentru toate paginile acelei rute. Nici `tsc`, nici build-ul, nici testele
 * de randare nu o văd — defectul apare abia la a doua cerere după o
 * deconectare, într-un proces viu. De aici porțile pe sursă.
 */

function fisiere(radacina: string): string[] {
  const gasite: string[] = [];
  const mergi = (cale: string) => {
    for (const intrare of readdirSync(cale)) {
      const plin = join(cale, intrare);
      if (statSync(plin).isDirectory()) mergi(plin);
      else if (/\.tsx?$/.test(plin) && !/\.test\.tsx?$/.test(plin)) {
        gasite.push(plin.replaceAll("\\", "/"));
      }
    }
  };
  mergi(radacina);
  return gasite;
}

/**
 * Codul fără comentarii: explicațiile capcanei citează forma interzisă, iar un
 * comentariu nu invalidează nimic. Aproximarea e suficientă aici — nicio
 * sursă din proiect nu pune `//` sau `/*` într-un șir lângă `revalidatePath`.
 */
function cod(f: string): string {
  return readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const SURSE = fisiere("src");

describe("capcana #45 — invalidarea care scoate paginile publice din Google", () => {
  it("nimeni nu invalidează rădăcina: se folosește reimprospateazaAplicatia()", () => {
    const vinovate = SURSE.filter((f) => /revalidatePath\(\s*["'`]\/["'`]/.test(cod(f)));
    expect(
      vinovate,
      'revalidatePath("/") expiră cache-ul TUTUROR paginilor, inclusiv al celor publice. ' +
        "Folosește reimprospateazaAplicatia() din src/lib/actions/reimprospatare.ts.",
    ).toEqual([]);
  });

  it("nicio rută prerandată nu refuză regenerarea cu dynamicParams = false", () => {
    const vinovate = SURSE.filter((f) => {
      const sursa = cod(f);
      return (
        /export\s+(async\s+)?function\s+generateStaticParams/.test(sursa) &&
        /export\s+const\s+dynamicParams\s*=\s*false/.test(sursa)
      );
    });
    expect(
      vinovate,
      "Cu dynamicParams = false, o pagină prerandată a cărei intrare din cache a fost " +
        "invalidată răspunde 404 până la restart. Pentru adrese necunoscute cheamă notFound() în pagină.",
    ).toEqual([]);
  });

  it("sonda: expresiile prind forma pe care o caută", () => {
    expect(/revalidatePath\(\s*["'`]\/["'`]/.test('revalidatePath("/", "layout")')).toBe(true);
    expect(/revalidatePath\(\s*["'`]\/["'`]/.test('revalidatePath("/(app)", "layout")')).toBe(
      false,
    );
    expect(
      /export\s+const\s+dynamicParams\s*=\s*false/.test("export const dynamicParams = false;"),
    ).toBe(true);
  });
});
