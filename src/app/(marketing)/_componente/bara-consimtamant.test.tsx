// src/app/(marketing)/_componente/bara-consimtamant.test.tsx
import { readFileSync } from "node:fs";

import { render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONSIMTAMANT_IMPLICIT } from "./analitice";
import { BaraConsimtamant } from "./bara-consimtamant";
import { ATRIBUT_CONSIMTAMANT, CHEIE_CONSIMTAMANT, EVENIMENT_CONSIMTAMANT } from "./consimtamant";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(ATRIBUT_CONSIMTAMANT);
});

describe("BaraConsimtamant", () => {
  it("la „Accept” anunță alegerea pe window, apoi dispare", async () => {
    const auzite: unknown[] = [];
    const asculta = (e: Event) => auzite.push((e as CustomEvent<unknown>).detail);
    window.addEventListener(EVENIMENT_CONSIMTAMANT, asculta);
    try {
      render(<BaraConsimtamant />);
      (await screen.findByRole("button", { name: "Accept" })).click();
      await waitFor(() =>
        expect(screen.queryByRole("region", { name: "Cookie-uri de analiză" })).toBeNull(),
      );
      expect(auzite).toEqual(["acceptat"]);
    } finally {
      window.removeEventListener(EVENIMENT_CONSIMTAMANT, asculta);
    }
  });
});

/** Rulează scriptul de consimțământ cum îl rulează browserul la parsare. */
function ruleazaScriptul() {
  // `new Function` e voit: textul e chiar scriptul emis în pagină, iar testul îl
  // execută ca browserul. (Configul ESLint nu are `no-new-func`, deci fără
  // directivă: una nefolosită ar da avertisment.)
  new Function(CONSIMTAMANT_IMPLICIT)();
}

describe("bara din primul cadru", () => {
  it("serverul randează bara, ca s-o vopsească odată cu pagina", () => {
    const html = renderToStaticMarkup(<BaraConsimtamant />);
    expect(html).toContain("data-bara-consimtamant");
    expect(html).toContain("Cookie-uri de analiză");
  });

  it("fără alegere salvată, scriptul de la parsare o cere", () => {
    ruleazaScriptul();
    expect(document.documentElement.getAttribute(ATRIBUT_CONSIMTAMANT)).toBe("cere");
  });

  it("cu alegerea salvată, n-o cere", () => {
    localStorage.setItem(CHEIE_CONSIMTAMANT, "refuzat");
    ruleazaScriptul();
    expect(document.documentElement.getAttribute(ATRIBUT_CONSIMTAMANT)).toBeNull();
  });

  it("cu stocarea blocată (fereastră privată), o cere", () => {
    // `vi.spyOn` pe instanță, nu `Storage.prototype.getItem = …`: în happy-dom
    // `localStorage` nu trece prin prototip, iar înlocuirea de pe prototip nu
    // ajunge la script (verificat la 8 oct 2026: atributul rămânea `null`).
    // Alegerea salvată e „refuzat”, ca testul să pice dacă `getItem` n-ar arunca.
    localStorage.setItem(CHEIE_CONSIMTAMANT, "refuzat");
    const spion = vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("Stocare blocată.");
    });
    try {
      ruleazaScriptul();
      expect(document.documentElement.getAttribute(ATRIBUT_CONSIMTAMANT)).toBe("cere");
    } finally {
      spion.mockRestore();
    }
  });

  it("CSS-ul ascunde bara implicit și o arată doar sub atribut", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\n\[data-bara-consimtamant\] \{\n {2}display: none;\n\}/u);
    expect(css).toContain(':root[data-consimtamant="cere"] [data-bara-consimtamant] {');
  });
});
