import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrinGeam } from "./prin-geam";

/**
 * Ce apără fișierul ăsta: promisiunile pe care banda le face unei pagini
 * PUBLICE de conversie, și pe care nici typecheck-ul, nici lint-ul nu le văd.
 *
 * Trei dintre ele sunt lecții plătite, nu precauții teoretice:
 *
 * 1. Nota „datele sunt inventate" trebuie să fie VIZIBILĂ. Într-o versiune
 *    anterioară stătea într-un element cu `overflow-hidden` și raport de aspect
 *    fix, iar 6,5px din ea ieșeau din casetă — măsurați în Chromium headless, pe
 *    CSS-ul compilat real. Un avertisment tăiat nu apără pe nimeni.
 * 2. Imaginea trebuie să-și declare dimensiunile. Fără ele, o imagine leneșă
 *    aterizează după layout și împinge pagina — CLS pe pagina de vânzare.
 * 3. Fișierul NU are voie să devină `"use client"`. Când era, un export al lui
 *    chemat din Server Component rupea prerandarea tuturor celor nouăsprezece
 *    pagini `/module/*`, iar singura poartă care vedea asta era `next build`.
 */
describe("banda cu captura ecranului", () => {
  it("nu randează nimic pentru un modul fără captură", () => {
    const { container } = render(<PrinGeam cheie="courses" titlu="Cursuri" />);
    expect(container.firstChild).toBeNull();
  });

  it("arată captura leneș, cu dimensiuni declarate", () => {
    const { container } = render(<PrinGeam cheie="leave" titlu="Concedii" />);
    const poza = container.querySelector("figure img");

    expect(poza).not.toBeNull();
    expect(poza?.getAttribute("src")).toBe("/capturi/leave-1920.webp");
    // `srcset` cu două lățimi: pe telefon se descarcă 28 KB în loc de 71.
    expect(poza?.getAttribute("srcset")).toMatch(/leave-960\.webp 960w/);
    expect(poza?.getAttribute("loading")).toBe("lazy");
    // Fără `width`/`height`, browserul nu știe raportul înainte să sosească
    // fișierul, iar imaginea împinge pagina când aterizează.
    expect(poza?.getAttribute("width")).toBe("1920");
    expect(poza?.getAttribute("height")).toBe("1200");
  });

  it("spune că datele sunt inventate, într-un loc care nu poate fi tăiat", () => {
    const { container } = render(<PrinGeam cheie="leave" titlu="Concedii" />);
    const legenda = container.querySelector("figcaption");

    // `/inventa/`, nu `/inventat/`: textul spune „inventați", cu ț cu virgulă
    // dedesubt (U+021B) pe poziția a șaptea. Un tipar scris în grabă pe forma
    // masculină n-ar fi potrivit niciodată.
    expect(legenda?.textContent).toMatch(/inventa/i);

    // Lecția din decembrie: legenda NU are voie să stea sub un strămoș care
    // taie conținutul, fiindcă atunci dispare fără ca nimic să se plângă.
    let parinte = legenda?.parentElement ?? null;
    while (parinte !== null && parinte !== container) {
      expect(parinte.className).not.toMatch(/overflow-hidden/);
      parinte = parinte.parentElement;
    }
  });

  it("se mărește printr-un control accesibil cu tastatura, legat de popover", () => {
    const { container } = render(<PrinGeam cheie="leave" titlu="Concedii" />);
    const buton = screen.getByRole("button", { name: /apasă pentru a mări/i });
    const tinta = buton.getAttribute("popovertarget");

    expect(tinta).toBeTruthy();
    // Ținta chiar există și chiar e un popover — un `popovertarget` care arată
    // spre nimic nu dă nicio eroare, doar nu face nimic.
    const marit = container.querySelector(`#${tinta ?? ""}`);
    expect(marit).not.toBeNull();
    expect(marit?.getAttribute("popover")).toBe("auto");
  });

  it("varianta mărită are propriul buton de închidere", () => {
    render(<PrinGeam cheie="leave" titlu="Concedii" />);
    const inchide = screen.getByRole("button", { name: /închide/i });

    // `Escape` și clicul în afară închid oricum, dar niciunul nu se VEDE:
    // cine deschide cu degetul pe telefon are nevoie de un buton.
    expect(inchide.getAttribute("popovertargetaction")).toBe("hide");
  });

  it("fișierul nu e `use client` — altfel exporturile lui ar rupe build-ul", () => {
    const sursa = readFileSync("src/app/(marketing)/_componente/prin-geam.tsx", "utf8");

    // Aceeași poartă ca în `vitrine.test.ts`, din același motiv: un fișier de
    // client ale cărui exporturi sunt atinse din graful de server rupe
    // prerandarea, iar `tsc`, ESLint și vitest tac toate trei.
    expect(sursa).not.toMatch(/^\s*["']use client["']/m);
  });
});
