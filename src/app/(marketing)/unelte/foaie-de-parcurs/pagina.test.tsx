import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PaginaFoaieParcurs from "./page";

const deschide = async (parametri: Record<string, string>) =>
  render(await PaginaFoaieParcurs({ searchParams: Promise.resolve(parametri) }));

const PLIN = {
  an: "2026",
  luna: "10",
  auto: "B-123-ABC",
  marca: "Dacia Logan",
  sofer: "Radu Andrei",
  firma: "Construct SRL",
  cui: "RO12345678",
  nr: "17",
  categorie: "autoutilitara",
  combustibil: "motorina",
  utilizare: "agent",
  norma: "6,5",
  km: "125000",
  stoc: "20",
  curse: "3",
};

describe("pagina foii de parcurs", { timeout: 30_000 }, () => {
  it("formularul păstrează fiecare valoare din adresă", async () => {
    const { container } = await deschide(PLIN);
    const valoare = (nume: string) =>
      (container.querySelector(`[name="${nume}"]`) as HTMLInputElement | HTMLSelectElement | null)
        ?.value;
    expect(
      ["auto", "marca", "sofer", "firma", "cui", "nr", "categorie", "combustibil", "utilizare"].map(
        valoare,
      ),
    ).toEqual([
      "B-123-ABC",
      "Dacia Logan",
      "Radu Andrei",
      "Construct SRL",
      "RO12345678",
      "17",
      "autoutilitara",
      "motorina",
      "agent",
    ]);
    expect([valoare("norma"), valoare("km"), valoare("stoc"), valoare("curse")]).toEqual([
      "6,5",
      "125000",
      "20",
      "3",
    ]);
  });

  it("previzualizarea are categoria, norma, cele trei curse pe zi și tabelele de la final", async () => {
    const { container } = await deschide(PLIN);
    const documentul = container.querySelector("#documentul") as HTMLElement;
    const d = within(documentul);
    expect(d.getByText("Categoria vehiculului:").nextElementSibling?.textContent).toBe(
      "Autoutilitară",
    );
    expect(d.getByText("Norma proprie de consum:").nextElementSibling?.textContent).toBe(
      "6,5 l/100 km (0,065 l/km)",
    );
    const [curse, alimentari, rezumat] = [...documentul.querySelectorAll("table")];
    expect(curse?.querySelectorAll("tbody tr")).toHaveLength(31 * 3);
    expect(alimentari?.querySelector("caption")?.textContent).toBe("Alimentări cu combustibil");
    expect(rezumat?.querySelector("caption")?.textContent).toBe("Rezumatul lunii");
  });

  it("o normă scrisă greșit se spune pe pagină, nu dispare tăcut", async () => {
    await deschide({ ...PLIN, norma: "6,5 litri" });
    expect(screen.getByRole("status").textContent).toContain("Norma de consum „6,5 litri”");
  });

  it("fără parametri: selecturile rămân pe „de completat de mână”, un rând pe zi", async () => {
    const { container } = await deschide({});
    for (const nume of ["categorie", "combustibil", "utilizare"]) {
      expect((container.querySelector(`[name="${nume}"]`) as HTMLSelectElement).value).toBe("");
    }
    expect((container.querySelector('[name="curse"]') as HTMLSelectElement).value).toBe("1");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
