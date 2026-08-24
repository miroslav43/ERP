// src/components/ui/comutator-vizualizare.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";

/**
 * `next/link` are nevoie de runtime-ul Next (prefetch, router) care nu există în
 * happy-dom. Mock-ul randează DOAR atributele verificate mai jos — nu ce dă
 * componenta — ca testul să nu treacă din întâmplare, prin props scurse pe un
 * `<a>` real.
 */
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: Record<string, unknown>) =>
      createElement(
        "a",
        {
          href: props["href"] as string,
          "aria-current": props["aria-current"] as string | undefined,
        },
        props["children"] as ReactNode,
      ),
  };
});

import { ComutatorVizualizare, adresaVizualizare } from "./comutator-vizualizare";

/**
 * Defectele reale apărate aici, toate din comutatoare deja existente în
 * depozit: cel din `/rapoarte` ARUNCĂ restul query string-ului la comutare, iar
 * cel din `/ssm/instruiri` anunță `role="tablist"` fără `tabpanel`, fără
 * `aria-controls` și fără roving tabindex — un cititor de ecran promite o
 * interacțiune cu săgeți care nu există.
 */

const OPTIUNI = [
  { cheie: "lista", eticheta: "Listă" },
  { cheie: "organigrama", eticheta: "Organigramă" },
] as const;

describe("adresaVizualizare", () => {
  it("păstrează parametrii necunoscuți schemei", () => {
    const adresa = adresaVizualizare(
      "/departamente",
      { q: "vanzari", sort: "-cod" },
      "vizualizare",
      "organigrama",
      "lista",
    );
    expect(adresa).toContain("q=vanzari");
    expect(adresa).toContain("sort=-cod");
    expect(adresa).toContain("vizualizare=organigrama");
  });

  it("ȘTERGE valoarea implicită din adresă în loc s-o scrie", () => {
    const adresa = adresaVizualizare("/departamente", {}, "vizualizare", "lista", "lista");
    expect(adresa).toBe("/departamente");
  });

  it("scoate valoarea implicită dintr-o adresă care o avea deja scrisă", () => {
    const adresa = adresaVizualizare(
      "/departamente",
      { vizualizare: "organigrama", q: "x" },
      "vizualizare",
      "lista",
      "lista",
    );
    expect(adresa).not.toContain("vizualizare");
    expect(adresa).toContain("q=x");
  });

  it("șterge întotdeauna cursorul", () => {
    // Citirile folosesc cursor keyset: un cursor rămas din vizualizarea
    // precedentă ar continua de la un rând care nu mai e în rezultat.
    const adresa = adresaVizualizare(
      "/departamente",
      { cursor: "eyJ4IjoxfQ" },
      "vizualizare",
      "organigrama",
      "lista",
    );
    expect(adresa).not.toContain("cursor");
  });

  it("păstrează o cheie repetată, nu doar ultima valoare", () => {
    const adresa = adresaVizualizare(
      "/departamente",
      { stare: ["activ", "inactiv"] },
      "vizualizare",
      "organigrama",
      "lista",
    );
    expect(adresa.match(/stare=/gu)?.length).toBe(2);
  });

  it("sare peste parametrii nedefiniți", () => {
    const adresa = adresaVizualizare(
      "/departamente",
      { q: undefined },
      "vizualizare",
      "lista",
      "lista",
    );
    expect(adresa).toBe("/departamente");
  });
});

describe("ComutatorVizualizare", () => {
  it("marchează segmentul curent cu aria-current, pe celălalt nu", () => {
    render(
      <ComutatorVizualizare
        eticheta="Cum se afișează structura"
        cheieParametru="vizualizare"
        optiuni={OPTIUNI}
        curenta="organigrama"
        implicita="lista"
        parametri={{}}
        cale="/departamente"
      />,
    );
    expect(screen.getByRole("link", { name: "Organigramă" }).getAttribute("aria-current")).toBe(
      "true",
    );
    expect(screen.getByRole("link", { name: "Listă" }).getAttribute("aria-current")).toBeNull();
  });

  it("expune un grup cu nume accesibil, NU un tablist", () => {
    const { container } = render(
      <ComutatorVizualizare
        eticheta="Cum se afișează structura"
        cheieParametru="vizualizare"
        optiuni={OPTIUNI}
        curenta="lista"
        implicita="lista"
        parametri={{}}
        cale="/departamente"
      />,
    );
    expect(screen.getByRole("group", { name: "Cum se afișează structura" })).toBeTruthy();
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector('[role="tab"]')).toBeNull();
  });

  it("dă fiecărui segment adresa lui, cu parametrii păstrați", () => {
    render(
      <ComutatorVizualizare
        eticheta="Vizualizare"
        cheieParametru="vizualizare"
        optiuni={OPTIUNI}
        curenta="lista"
        implicita="lista"
        parametri={{ q: "it" }}
        cale="/departamente"
      />,
    );
    expect(screen.getByRole("link", { name: "Listă" }).getAttribute("href")).toBe(
      "/departamente?q=it",
    );
    expect(screen.getByRole("link", { name: "Organigramă" }).getAttribute("href")).toBe(
      "/departamente?q=it&vizualizare=organigrama",
    );
  });
});
