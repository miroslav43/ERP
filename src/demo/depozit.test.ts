// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { citesteDepozit, scrieDepozit } from "./depozit";

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

/**
 * Garda de formă e un parametru OBLIGATORIU al lui `citesteDepozit` — vezi
 * motivarea din `depozit.ts`. Testele o dau explicit, ca orice apelant.
 */
const esteNumarat = (x: unknown): x is { n: number } =>
  typeof x === "object" && x !== null && typeof (x as { n?: unknown }).n === "number";

describe("depozitul de sesiune", () => {
  it("întoarce implicitul când nu s-a scris nimic", () => {
    expect(citesteDepozit("proba", { n: 1 }, esteNumarat)).toEqual({ n: 1 });
  });

  it("citește înapoi ce a scris", () => {
    scrieDepozit("proba", { n: 42 });
    expect(citesteDepozit("proba", { n: 1 }, esteNumarat)).toEqual({ n: 42 });
  });

  it("întoarce implicitul când valoarea stocată e JSON stricat", () => {
    window.sessionStorage.setItem("proba", "{ nu e json");
    expect(citesteDepozit("proba", { n: 7 }, esteNumarat)).toEqual({ n: 7 });
  });

  it("nu aruncă atunci când sessionStorage însuși aruncă", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocat");
      },
      setItem: () => {
        throw new Error("blocat");
      },
    });
    expect(() => scrieDepozit("proba", { n: 1 })).not.toThrow();
    expect(citesteDepozit("proba", { n: 9 }, esteNumarat)).toEqual({ n: 9 });
  });

  /**
   * `JSON.parse` reușește, dar forma nu e cea așteptată — o valoare de altă
   * schemă scrisă sub aceeași cheie, de o versiune anterioară a demonstrației,
   * sau o manipulare din devtools. Consumatorul (`vitrina-leave.tsx`) iterează
   * rezultatul cu `for...of`: fără gardă, o valoare non-tablou ar arunca
   * `TypeError` direct în randare și ar cădea tot ecranul public, fără
   * recuperare. Garda întoarce implicitul în loc să dea mai departe o valoare
   * greșit tipată.
   */
  it("întoarce implicitul când valoarea stocată nu trece garda de formă", () => {
    window.sessionStorage.setItem("proba", JSON.stringify({ nu: "e un tablou" }));
    const esteTablou = (x: unknown): x is readonly unknown[] => Array.isArray(x);
    expect(citesteDepozit("proba", [], esteTablou)).toEqual([]);
  });

  it("întoarce valoarea stocată atunci când trece garda de formă", () => {
    window.sessionStorage.setItem("proba", JSON.stringify([{ n: 1 }]));
    const esteTablou = (x: unknown): x is readonly unknown[] => Array.isArray(x);
    expect(citesteDepozit("proba", [], esteTablou)).toEqual([{ n: 1 }]);
  });

  it("garda de formă e un parametru obligatoriu", async () => {
    /*
     * Verificarea e pe SURSĂ fiindcă opționalitatea unui parametru dispare la
     * compilare: un apel care omite garda ar trece typecheck-ul, ar trece
     * testele de mai sus, și ar readuce prăbușirea ecranului public la primul
     * `for...of` peste o valoare de altă formă. Semnul `?` e singurul loc unde
     * regresia se vede.
     */
    const { readFileSync } = await import("node:fs");
    const sursa = readFileSync("src/demo/depozit.ts", "utf8");
    expect(sursa).toMatch(/esteValid: \(x: unknown\) => x is T,/);
    expect(sursa).not.toMatch(/esteValid\?/);
  });
});
