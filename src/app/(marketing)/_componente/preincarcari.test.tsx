import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RO } from "@/content/landing/ro";

import { BandaProdus } from "./benzi/acasa";
import { InMana } from "./in-mana";
import { PrinGeam } from "./prin-geam";

/**
 * Nicio captură nu se preîncarcă din fereastra de mărire.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Măsurat pe 7 oct 2026, Chromium headless cu rețea mobilă lentă și procesor ×4:
 * pe `/`, imaginea eroului (38 KB, `fetchpriority="high"`) era cerută la 0,37 s
 * și termina la 3,2 s — LCP 3,2 s. Concura cu trei capturi de 1920 px (270 KB)
 * care stau mai jos în pagină și au `loading="lazy"`.
 *
 * Nu ele se descărcau, ci DUBLURA lor din `popover`-ul de mărire: un `<img>`
 * fără `loading`, pentru care React 19 emite singur `<link rel="preload"
 * as="image">` în `<head>`. Aceeași indicație intră și în payload-ul RSC, așa că
 * orice pagină care preia în avans legătura spre `/` (sigla din antet) descărca
 * și ea cele trei capturi, plus eroul — ~300 KB pe fiecare vizită de pe telefon.
 *
 * Un `popover` închis e `display: none`; o imagine leneșă din el se cere abia
 * când fereastra se deschide.
 */
describe("preîncărcările paginilor publice", () => {
  const faraCapturi = (html: string) =>
    expect(html.match(/<link[^>]*rel="preload"[^>]*capturi\/[^>]*>/g) ?? []).toEqual([]);

  it("banda de produs de pe pagina de start nu preîncarcă nicio captură", () => {
    faraCapturi(renderToString(<BandaProdus text={RO} />));
  });

  it("banda cu o captură nu o preîncarcă din fereastra de mărire", () => {
    faraCapturi(renderToString(<PrinGeam cheie="leave" titlu="Concedii" />));
  });

  it("banda de capturi înalte nu le preîncarcă din fereastra de mărire", () => {
    faraCapturi(
      renderToString(
        <InMana supratitlu="S" titlu="T" chei={["portal-pontare", "portal-scanare"]} />,
      ),
    );
  });
});
