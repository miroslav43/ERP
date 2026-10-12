import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PaginaFisaSsm, { metadata } from "./page";

const cu = async (parametri: Record<string, string>) =>
  render(await PaginaFisaSsm({ searchParams: Promise.resolve(parametri) }));

/**
 * Pagina uneltei: formularul are câmpurile pe care le citește `parametriFisaSsm`,
 * descărcările sunt doar Word și PDF, termenele apar doar când există o dată de
 * pornire, iar normele spun cine face fiecare instruire.
 */
describe("pagina fișei de instruire SSM", () => {
  it("formularul trimite toate câmpurile pe care le citește modelul", async () => {
    const { container } = await cu({});
    const nume = [...container.querySelectorAll("form [name]")].map((e) => e.getAttribute("name"));
    for (const n of [
      "nume",
      "marca",
      "calificare",
      "functie",
      "loc",
      "firma",
      "data_ig",
      "ore_ig",
      "instructor_ig",
      "functie_ig",
      "data_lm",
      "ore_lm",
      "instructor_lm",
      "functie_lm",
      "admis_nume",
      "admis_functie",
      "periodicitate",
      "ani",
    ]) {
      expect(nume, n).toContain(n);
    }
    const formate = [...container.querySelectorAll('button[name="format"]')].map((b) =>
      b.getAttribute("value"),
    );
    expect(formate).toEqual(["docx", "pdf"]);
  });

  it("nu are câmpuri pentru grupa sanguină, domiciliu, data nașterii sau CNP", async () => {
    const { container } = await cu({});
    const etichete = [...container.querySelectorAll("form label")].map((l) => l.textContent ?? "");
    for (const interzis of [/sanguin/iu, /domicil/iu, /nașter/iu, /CNP/u]) {
      expect(
        etichete.some((e) => interzis.test(e)),
        String(interzis),
      ).toBe(false);
    }
  });

  it("previzualizarea are toate părțile anexei 11, cu datele completate", async () => {
    const { container } = await cu({ nume: "Popa Ion", functie: "Sudor", data_ig: "2026-10-05" });
    const doc = container.querySelector("#documentul")?.textContent ?? "";
    for (const parte of [
      "Instruirea la angajare",
      "Instruirea periodică suplimentară",
      "Rezultatele testărilor",
      "Accidente de muncă sau îmbolnăviri profesionale suferite",
      "Control medical periodic",
      "Testarea psihologică periodică",
    ]) {
      expect(doc, parte).toContain(parte);
    }
    expect(doc).toContain("la data 05.10.2026");
    expect(doc).not.toContain("mai cuprinde");
  });

  it("deschide secțiunea de angajare doar când are date", async () => {
    const gol = await cu({});
    expect(gol.container.querySelector<HTMLDetailsElement>("form details")?.open).toBe(false);
    const plin = await cu({ instructor_ig: "Ionescu Maria" });
    expect(plin.container.querySelector<HTMLDetailsElement>("form details")?.open).toBe(true);
  });

  it("arată termenele periodice de la instruirea la locul de muncă, nu din document", async () => {
    const { container } = await cu({
      nume: "Popa Ion",
      data_ig: "2026-10-05",
      data_lm: "2026-10-06",
      periodicitate: "semestriala",
      ani: "1",
    });
    const termene = [...container.querySelectorAll("[data-scadente] li")].map(
      (li) => li.textContent,
    );
    expect(termene).toEqual(["06.04.2027", "06.10.2027"]);
    expect(container.querySelector("#documentul")?.textContent ?? "").not.toContain("06.04.2027");
    expect((await cu({})).container.querySelectorAll("[data-scadente] li")).toHaveLength(0);
  });

  it("spune câte rânduri periodice va avea fișa", async () => {
    const { container } = await cu({ periodicitate: "lunara", ani: "2" });
    expect(container.querySelector("[data-rinduri]")?.getAttribute("data-rinduri")).toBe("24");
    expect(container.textContent).toContain("24 de rânduri");
  });

  it("normele: art. 98 complet, anexa 12 și legătura spre modulul SSM", async () => {
    const { container } = await cu({});
    const text = container.textContent ?? "";
    expect(text).toContain("98 lit. a)–g)");
    expect(text).toContain("anexa 12");
    expect(text).toContain("fișe de aptitudini");
    expect(container.querySelector('a[href="/module/ssm"]')).not.toBeNull();
  });

  it("periodicitatea anuală spune pe pagină cui i se aplică", async () => {
    const aviz =
      "Intervalul de 12 luni e permis doar personalului tehnico-administrativ (art. 96 alin. (3)); pentru ceilalți, cel mult 6 luni (art. 96 alin. (2¹)).";
    expect((await cu({ periodicitate: "anuala" })).container.textContent).toContain(aviz);
    expect((await cu({ periodicitate: "semestriala" })).container.textContent).not.toContain(aviz);
  });

  it("semnalează instruirea la locul de muncă datată înaintea celei introductiv-generale", async () => {
    const aviz =
      "Instruirea la locul de muncă se face după cea introductiv-generală (art. 90 alin. (1)).";
    const inversat = await cu({ data_ig: "2026-10-06", data_lm: "2026-10-05" });
    expect(inversat.container.querySelector('[role="status"]')?.textContent).toContain(aviz);
    // Fișa rămâne descărcabilă: avizul nu blochează nimic.
    expect(inversat.container.querySelectorAll('button[name="format"]')).toHaveLength(2);
    for (const date of [
      { data_ig: "2026-10-05", data_lm: "2026-10-06" },
      { data_ig: "2026-10-05", data_lm: "2026-10-05" },
      { data_lm: "2026-10-05" },
    ]) {
      expect((await cu(date)).container.textContent).not.toContain(aviz);
    }
  });

  it("titlul paginii are cel mult 48 de caractere", () => {
    const titlu = typeof metadata.title === "string" ? metadata.title : "";
    expect(titlu.length).toBeGreaterThan(0);
    expect(titlu.length).toBeLessThanOrEqual(48);
  });
});
