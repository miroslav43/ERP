import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { adresaInregistrare } from "@/content/landing/cta-unelte";

import { metadata } from "./page";
import PaginaFisaEvaluare from "./page";

/**
 * Pagina fișei de evaluare, randată cu adresa pe care o trimite formularul.
 * Paginile n-au alte teste unitare (CLAUDE.md, „Datorie cunoscută”); aici se
 * verifică ce promite pagina: rândurile ajung în document, legea are temeiul
 * scris, iar formularul încape într-o adresă pe care Cloudflare o acceptă.
 */
async function pagina(parametri: Record<string, string | string[]>) {
  return render(await PaginaFisaEvaluare({ searchParams: Promise.resolve(parametri) }));
}

describe("pagina fișei de evaluare", () => {
  it("rândurile din adresă ajung în previzualizare, cu nota finală și calificativul", async () => {
    const { container } = await pagina({
      nume: "Ilie Maria",
      criteriu: ["Calitatea muncii", "Termene"],
      pondere: ["60", "40"],
      nota: ["4", "5"],
      utm_source: "fisier",
    });
    const document = container.querySelector("#documentul");
    const randuri = [...(document?.querySelectorAll("tbody tr") ?? [])].map((r) =>
      [...r.querySelectorAll("td")].map((c) => c.textContent),
    );
    expect(randuri.slice(-2)).toEqual([
      ["Total (nota finală)", "100", "", "4,40", ""],
      ["Calificativ", "", "", "", "Bine"],
    ]);
    expect(document?.textContent).toContain("Ilie Maria");
  });

  it("o pondere goală la mijloc nu mută notele pe alt rând", async () => {
    const { container } = await pagina({
      criteriu: ["A", "B", "C"],
      pondere: ["50", "", "50"],
      nota: ["4", "3", "5"],
    });
    const randuri = [...container.querySelectorAll("#documentul tbody tr")].map((r) =>
      [...r.querySelectorAll("td")].slice(0, 3).map((c) => c.textContent),
    );
    expect(randuri.slice(0, 3)).toEqual([
      ["A", "50", "4"],
      ["B", "", "3"],
      ["C", "50", "5"],
    ]);
  });

  it("legea: fiecare articol verificat apare cu temeiul lui", async () => {
    const { container } = await pagina({});
    const text = container.textContent ?? "";
    for (const temei of [
      "art. 40 alin. (1) lit. f)",
      "art. 17 alin. (1) și (3) lit. e)",
      "art. 17 alin. (4)",
      "art. 17 alin. (5)",
      "art. 242 lit. i)",
      "art. 194 alin. (1)",
      "art. 69 alin. (3)",
      "art. 61 lit. d), art. 63 alin. (2)",
      "art. 64 alin. (1) și (2)",
      "art. 62 alin. (1)",
      "art. 75 alin. (1) și (2)",
      "art. 268 alin. (1) lit. a), art. 78",
    ]) {
      expect(text, temei).toContain(temei);
    }
    expect(
      screen.getByRole("heading", { name: "Concedierea pentru necorespundere profesională" }),
    ).toBeDefined();
  });

  it("banda modulului duce la evaluări și la crearea contului", async () => {
    await pagina({});
    const banda = screen
      .getByRole("heading", { name: "Evaluările, cu istoric pe fiecare om" })
      .closest("section");
    const legaturi = [...(banda?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href"));
    expect(legaturi).toContain("/module/evaluari");
    // J5: înregistrarea poartă sursa uneltei (utm_campaign), ca să se știe de unde vine contul.
    expect(legaturi).toContain(adresaInregistrare("fisa-evaluare", "banda"));
  });

  it("formularul are data, grila și rubricile, toate cu limită", async () => {
    const { container } = await pagina({});
    expect(container.querySelector('input[type="date"][name="data"]')).not.toBeNull();
    expect(container.querySelectorAll('input[name="criteriu"]')).toHaveLength(6);
    for (const nume of ["puncte_forte", "de_imbunatatit", "obiective", "dezvoltare"]) {
      expect(
        container.querySelector(`textarea[name="${nume}"]`)?.getAttribute("maxlength"),
        nume,
      ).toBe("500");
    }
    for (const camp of container.querySelectorAll("form input[type=text], form textarea")) {
      expect(camp.getAttribute("maxlength"), camp.getAttribute("name") ?? "").not.toBeNull();
    }
  });

  /*
   * Auditul din 8 oct 2026: peste ~12,5 KB, Cloudflare răspunde „error code:
   * 520”, fără mesaj. Formularul plin, cu 15 criterii de 120 de caractere și
   * toate rubricile la 500, cu o literă din zece cu diacritică (6 octeți în
   * adresă), trebuie să rămână sub prag.
   */
  it("formularul plin la toate limitele încape într-o adresă sub 12 KB", () => {
    const text = (n: number) =>
      Array.from({ length: n }, (_, i) => (i % 10 === 0 ? "ș" : "a")).join("");
    const q = new URLSearchParams();
    for (const nume of ["nume", "functie", "perioada", "evaluator", "firma"])
      q.set(nume, text(120));
    q.set("data", "2026-12-15");
    q.set("set", "administrativ");
    for (let i = 0; i < 15; i += 1) {
      q.append("criteriu", text(120));
      q.append("pondere", "100%");
      q.append("nota", "5");
    }
    for (const nume of ["prag_fb", "prag_b", "prag_s"]) q.set(nume, "4,50");
    for (const nume of ["puncte_forte", "de_imbunatatit", "obiective", "dezvoltare"]) {
      q.set(nume, text(500));
    }
    q.set("format", "xlsx");
    const adresa = `https://administrativo.ro/api/unelte/fisa-evaluare?${q.toString()}`;
    expect(new TextEncoder().encode(adresa).length).toBeLessThan(12_000);
  });

  it("titlul încape în 48 de caractere, descrierea în 160", () => {
    expect(String(metadata.title).length).toBeLessThanOrEqual(48);
    expect(String(metadata.description).length).toBeLessThanOrEqual(160);
  });
});
