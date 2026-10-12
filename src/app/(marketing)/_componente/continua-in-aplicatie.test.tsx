import { readFileSync, readdirSync, existsSync } from "node:fs";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";

import { fisaModulului } from "@/content/landing/fise-module";
import { PRETURI_MODULE, PRET_NUCLEU } from "@/content/landing/preturi";
import {
  adresaInregistrare,
  areCtaPropriu,
  ctaPentru,
  pretPentru,
} from "@/content/landing/cta-unelte";
import { SLUGURI_UNELTE, sursaDinParametri } from "@/lib/unelte/masurare";

/** Ca în `comutator-vizualizare.test.tsx`: doar atributele verificate ajung pe `<a>`. */
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: Record<string, unknown>) =>
      createElement(
        "a",
        {
          href: props["href"] as string,
          "data-umami-event": props["data-umami-event"] as string | undefined,
        },
        props["children"] as ReactNode,
      ),
  };
});

import { ContinuaInAplicatie, aGenerat } from "./continua-in-aplicatie";

describe("aGenerat", () => {
  it("doar valorile din formular contează, nu campania sau marcajul de audit", () => {
    expect(aGenerat({})).toBe(false);
    expect(aGenerat({ m: "1791483495" })).toBe(false);
    expect(aGenerat({ utm_source: "fisier", utm_campaign: "unelte" })).toBe(false);
    expect(aGenerat({ luna: "10" })).toBe(true);
    expect(aGenerat({ angajati: ["Ana", "Ion"] })).toBe(true);
    expect(aGenerat({ luna: undefined })).toBe(false);
  });
});

describe("ContinuaInAplicatie", () => {
  it("după generare: înregistrarea cu sursa uneltei și pagina modulului", () => {
    const { container } = render(<ContinuaInAplicatie unealta="foaie-de-pontaj" generat />);
    const sectiune = container.querySelector("#continua-foaie-de-pontaj") as HTMLElement;
    expect(sectiune.hidden).toBe(false);
    expect(sectiune.getAttribute("data-tipar")).toBe("ascunde");

    const inscriere = screen.getByText("Creează cont · prima lună gratuită");
    const href = inscriere.getAttribute("href") ?? "";
    expect(href).toBe(adresaInregistrare("foaie-de-pontaj", "dupa-document"));
    expect(sursaDinParametri(Object.fromEntries(new URL(href, "http://x").searchParams))).toBe(
      "foaie-de-pontaj",
    );
    expect(inscriere.getAttribute("data-umami-event")).toBe("cta-foaie-de-pontaj");

    expect(container.querySelector('a[href="/module/pontaj"]')).not.toBeNull();
    expect(container.textContent).toContain(`${PRET_NUCLEU} lei / lună`);
    expect(container.textContent).toContain("prima lună gratuită");
    expect(container.textContent).toContain("fără TVA");
  });

  it("înainte de generare stă ascuns și apare la primul clic pe o descărcare", () => {
    const { container } = render(
      <>
        <button type="button" name="format" value="pdf">
          Descarcă PDF
        </button>
        <ContinuaInAplicatie unealta="condica-de-prezenta" generat={false} />
      </>,
    );
    const sectiune = container.querySelector("#continua-condica-de-prezenta") as HTMLElement;
    expect(sectiune.hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Descarcă PDF" }));
    expect(sectiune.hidden).toBe(false);
  });

  it("un clic pe alt buton nu-l arată", () => {
    const { container } = render(
      <>
        <button type="button">Generează</button>
        <ContinuaInAplicatie unealta="condica-de-prezenta" generat={false} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Generează" }));
    expect((container.querySelector("#continua-condica-de-prezenta") as HTMLElement).hidden).toBe(
      true,
    );
  });

  it("SSM: spune cinstit că fișa semnată rămâne pe hârtie și dă prețul modulului", () => {
    const { container } = render(<ContinuaInAplicatie unealta="fisa-instruire-ssm" generat />);
    expect(container.textContent).toContain("Fișa semnată rămâne pe hârtie");
    expect(container.textContent).toContain(`${PRETURI_MODULE.ssm} lei / lună`);
    expect(container.querySelector('a[href="/module/ssm"]')).not.toBeNull();
  });
});

describe("textele pe unealtă", () => {
  it("fiecare unealtă din hartă are textul ei și un modul cu pagină", () => {
    for (const slug of SLUGURI_UNELTE) {
      expect(areCtaPropriu(slug), `${slug}: scrie-i intrarea în cta-unelte.ts`).toBe(true);
      expect(fisaModulului(ctaPentru(slug).modul), slug).toBeDefined();
    }
  });

  it("o unealtă necunoscută primește pachetul de bază, nu o eroare", () => {
    expect(ctaPentru("unealta-noua").modul).toBe("nucleu");
  });

  it("prețul vine din preturi.ts: nucleu fără „se adaugă”, modul opțional cu suma lui", () => {
    expect(pretPentru("attendance")).not.toContain("se adaugă");
    expect(pretPentru("fleet")).toContain(`${PRETURI_MODULE.fleet} lei / lună`);
  });
});

describe("paginile de unelte", () => {
  const RADACINA = "src/app/(marketing)/unelte";
  const pagini = readdirSync(RADACINA, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`${RADACINA}/${d.name}/page.tsx`))
    .map((d) => d.name);

  it("fiecare pune îndemnul după document, cu propriul slug", () => {
    expect(pagini.length).toBeGreaterThanOrEqual(7);
    for (const slug of pagini) {
      const sursa = readFileSync(`${RADACINA}/${slug}/page.tsx`, "utf8");
      const cta = sursa.search(new RegExp(`<ContinuaInAplicatie\\s+unealta="${slug}"`, "u"));
      const document = Math.max(sursa.indexOf('id="documentul"'), sursa.indexOf('id="rezultat"'));
      expect(cta, `${slug}: lipsește <ContinuaInAplicatie unealta="${slug}"`).toBeGreaterThan(-1);
      expect(document, `${slug}: n-are id="documentul" sau id="rezultat"`).toBeGreaterThan(-1);
      expect(cta, `${slug}: îndemnul stă înaintea documentului`).toBeGreaterThan(document);
      expect(sursa, slug).toContain("generat={aGenerat(");
    }
  });

  it("nicio legătură spre înregistrare nu pleacă fără sursa uneltei", () => {
    for (const slug of pagini) {
      const sursa = readFileSync(`${RADACINA}/${slug}/page.tsx`, "utf8");
      expect(sursa, slug).not.toContain("RO.hero.ctaPrimar.href");
      expect(sursa, slug).not.toMatch(/href="\/inregistrare/u);
    }
  });
});
