// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { citesteDepozit, scrieDepozit } from "./depozit";

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("depozitul de sesiune", () => {
  it("întoarce implicitul când nu s-a scris nimic", () => {
    expect(citesteDepozit("proba", { n: 1 })).toEqual({ n: 1 });
  });

  it("citește înapoi ce a scris", () => {
    scrieDepozit("proba", { n: 42 });
    expect(citesteDepozit("proba", { n: 1 })).toEqual({ n: 42 });
  });

  it("întoarce implicitul când valoarea stocată e JSON stricat", () => {
    window.sessionStorage.setItem("proba", "{ nu e json");
    expect(citesteDepozit("proba", { n: 7 })).toEqual({ n: 7 });
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
    expect(citesteDepozit("proba", { n: 9 })).toEqual({ n: 9 });
  });
});
