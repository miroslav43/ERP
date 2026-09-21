import { readFileSync } from "node:fs";

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FOAIA } from "@/content/landing/foaia-date";
import { RO } from "@/content/landing/ro";

import { Foaia } from "./foaia";

const SURSA_FOAIA = readFileSync("src/app/(marketing)/_componente/foaia.tsx", "utf8");
const SURSA_VIE = readFileSync("src/app/(marketing)/_componente/foaia-vie.tsx", "utf8");

/**
 * Ce apără fișierul: separarea dintre hârtie și partea vie a foii.
 *
 * ── DE CE ────────────────────────────────────────────────────────────────
 * Până pe 20 sept 2026, `foaia.tsx` era marcat `"use client"` ca să-și poată
 * atașa trei `onClick`. Costul nu se vedea în niciun test: React hidrata tot
 * arborele, cu cele peste trei sute de celule ale lui. Măsurat pe producție,
 * profil mobil cu procesorul încetinit de patru ori, pagina de start avea
 * 1920 ms de script față de 890-1113 ms pe paginile fără foaie.
 *
 * Reîntoarcerea e ieftină și tăcută: un `onClick` pus pe o celulă cere
 * `"use client"`, iar de acolo se hidratează iar tot tabelul. Nimic nu s-ar
 * plânge — nici `tsc`, nici build-ul, nici ochiul. De-aia poarta asta.
 */
describe("foaia din erou", () => {
  it("hârtia NU e componentă de client", () => {
    expect(
      /^\s*["']use client["']/m.test(SURSA_FOAIA),
      "`foaia.tsx` a redevenit `use client` — cele peste 300 de celule se hidratează din nou.",
    ).toBe(false);

    // Markerul prin care se strecoară înapoi: un handler pe o celulă.
    expect(
      /onClick=/.test(SURSA_FOAIA),
      "un `onClick` în `foaia.tsx` cere `use client`. Clicurile se prind prin delegare, în `foaia-vie.tsx`.",
    ).toBe(false);
  });

  it("partea vie E componentă de client, și doar ea", () => {
    expect(/^\s*["']use client["']/m.test(SURSA_VIE)).toBe(true);
  });

  it("tabelul e complet fără JavaScript, cu toate celulele și totalurile", () => {
    /*
     * Prima dintre cele trei decizii scrise în capul lui `foaia.tsx`: foaia e
     * completă fără JavaScript. De când tabelul e randat pe server, afirmația e
     * literală — aici se și verifică, numărând ce iese din randare.
     */
    const { container } = render(<Foaia text={RO.foaie} />);

    // `tbody`, nu tot tabelul: rândul de total are și el câte o celulă pe zi,
    // iar fără restrângere numărătoarea iese cu 30 mai mare decât realitatea.
    const celule = container.querySelectorAll("tbody td[data-zi]");
    expect(celule.length).toBe(FOAIA.randuri.length * FOAIA.zile.length);

    // Capetele de coloană și rândul de total au și ele câte o celulă pe zi.
    expect(container.querySelectorAll("th[data-zi]").length).toBe(FOAIA.zile.length);
    expect(container.querySelectorAll("tfoot [data-zi]").length).toBe(FOAIA.zile.length);

    // Butoanele există în HTML-ul de server, deci sunt focusabile cu tastatura
    // chiar înainte ca insula să se monteze.
    expect(container.querySelectorAll("table button").length).toBe(
      FOAIA.zile.length + FOAIA.randuri.length,
    );
  });

  it("randarea de server nu poartă stare de interacțiune", () => {
    /*
     * `data-activ` și `hidden` sunt puse din afara lui React, de insulă. Dacă
     * reapar în randarea de server înseamnă că starea s-a întors în componentă
     * — adică și hidratarea odată cu ea.
     */
    const { container } = render(<Foaia text={RO.foaie} />);
    expect(container.querySelectorAll("[data-activ]").length).toBe(0);
    expect(container.querySelectorAll("table [hidden]").length).toBe(0);

    // `data-fereastra` lipsește: cât timp lipsește, fereastra o dă CSS-ul, deci
    // și cine n-are JavaScript vede o lună tăiată corect.
    expect(container.querySelector(".mk-foaie")?.hasAttribute("data-fereastra")).toBe(false);
  });

  it("clicul pe o zi aprinde coloana, iar al doilea o stinge", () => {
    /*
     * Testul care contează cel mai mult după mutarea tabelului pe server:
     * butoanele nu mai au `onClick`, deci dacă delegarea din `foaia-vie.tsx`
     * n-ar funcționa, foaia ar deveni INERTĂ — fără nicio eroare, fără nimic
     * roșu. Arată exact la fel, doar că nu mai face nimic.
     */
    const { container } = render(<Foaia text={RO.foaie} />);
    const butonZi = container.querySelector<HTMLButtonElement>('th[data-zi="3"] button');
    expect(butonZi).not.toBeNull();

    fireEvent.click(butonZi as HTMLButtonElement);
    const aprinse = container.querySelectorAll('[data-zi="3"][data-activ]');
    // Capul de coloană, cele opt celule ale zilei și celula din rândul de total.
    expect(aprinse.length).toBe(FOAIA.randuri.length + 2);

    fireEvent.click(butonZi as HTMLButtonElement);
    expect(container.querySelectorAll("[data-activ]").length).toBe(0);
  });

  it("clicul pe un nume aprinde rândul lui, nu coloana", () => {
    const { container } = render(<Foaia text={RO.foaie} />);
    const primulRand = container.querySelector("tbody tr");
    const butonNume = primulRand?.querySelector<HTMLButtonElement>('th[data-col="nume"] button');
    expect(butonNume).not.toBeNull();

    fireEvent.click(butonNume as HTMLButtonElement);
    // Numele, cele treizeci de zile ale rândului și totalul lui pe ore.
    expect(primulRand?.querySelectorAll("[data-activ]").length).toBe(FOAIA.zile.length + 2);
    // Rândul de total NU se aprinde: e coloană, nu rând.
    expect(container.querySelectorAll("tfoot [data-activ]").length).toBe(0);
  });

  it("zilele poartă marcajele pe care se sprijină CSS-ul fără JavaScript", () => {
    // `globals.css` ascunde zilele prin `:not([data-j1])` și `:not([data-s1])`.
    // Fără marcaje, foaia s-ar derula lateral pe telefon — exact ce interzice
    // decizia a doua din capul componentei.
    const { container } = render(<Foaia text={RO.foaie} />);
    const primaZi = container.querySelector('th[data-zi="1"]');
    expect(primaZi?.getAttribute("data-j1")).toBe("1");
    expect(primaZi?.getAttribute("data-s1")).toBe("1");

    const ziTarzie = container.querySelector('th[data-zi="20"]');
    expect(ziTarzie?.hasAttribute("data-j1")).toBe(false);
    expect(ziTarzie?.hasAttribute("data-s1")).toBe(false);
  });
});
