import { readFileSync } from "node:fs";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InMana } from "./in-mana";

/**
 * Sora lui `prin-geam.test.tsx`, pentru banda de capturi înalte.
 *
 * Aceleași trei promisiuni — nota vizibilă, dimensiunile declarate, fișierul
 * care nu devine `"use client"` — plus două proprii benzii ăsteia:
 *
 * 4. Dimensiunile NU mai sunt comune. `PrinGeam` putea scrie 1920×1200 în două
 *    constante; aici fiecare captură are raportul ei (telefon 1:2,16, hârtie
 *    3:4). O singură pereche greșită pune un dreptunghi de altă formă în
 *    pagină și mută tot ce e dedesubt când imaginea aterizează.
 * 5. O cheie necunoscută se SARE, nu randează un gol. Banda cu trei imagini din
 *    care una lipsește arată ca o pagină stricată; poarta din `vitrine.test.ts`
 *    prinde oricum cheia fără fișier, deci aici alegem tăcerea.
 */
describe("banda de capturi înalte", () => {
  it("nu randează nimic dacă nicio cheie nu e cunoscută", () => {
    const { container } = render(
      <InMana supratitlu="Ecrane reale" titlu="Nimic" chei={["inexistenta", "toString"]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("sare peste cheile necunoscute, dar randează restul", () => {
    const { container } = render(
      <InMana supratitlu="Ecrane reale" titlu="Două" chei={["portal-pontare", "inexistenta"]} />,
    );
    expect(container.querySelectorAll("figure")).toHaveLength(1);
  });

  it("fiecare captură își declară dimensiunile ei, nu unele comune", () => {
    const { container } = render(
      <InMana
        supratitlu="Ecrane reale"
        titlu="Trei"
        chei={["portal-pontare", "portal-scanare", "afis-pontare"]}
      />,
    );
    const pozeVizibile = [...container.querySelectorAll("figure > button img")];
    expect(pozeVizibile).toHaveLength(3);

    const rapoarte = pozeVizibile.map((p) => {
      const w = Number(p.getAttribute("width"));
      const h = Number(p.getAttribute("height"));
      expect(Number.isFinite(w) && w > 0, "lățime lipsă sau invalidă").toBe(true);
      expect(Number.isFinite(h) && h > 0, "înălțime lipsă sau invalidă").toBe(true);
      return (w / h).toFixed(3);
    });

    // Telefonul și hârtia NU pot avea același raport. Dacă ajung să-l aibă,
    // cineva a copiat o pereche de dimensiuni în loc s-o măsoare.
    expect(new Set(rapoarte).size).toBeGreaterThan(1);
  });

  it("fiecare captură își poartă avertismentul de date inventate", () => {
    const { container } = render(
      <InMana
        supratitlu="Ecrane reale"
        titlu="Trei"
        chei={["portal-pontare", "portal-scanare", "afis-pontare"]}
      />,
    );
    const note = [...container.querySelectorAll("figcaption")];
    expect(note).toHaveLength(3);
    for (const nota of note) {
      // Capturile astea au pe ele un nume de om și o sumă de salariu. Cine se
      // uită la a treia imagine n-are de unde să știe ce scria sub prima.
      expect(nota.textContent ?? "").toMatch(/inventați/);
    }
  });

  it("imaginile se încarcă leneș și au srcset cu două lățimi", () => {
    const { container } = render(
      <InMana supratitlu="Ecrane reale" titlu="Una" chei={["portal-pontare"]} />,
    );
    const poza = container.querySelector("figure > button img");
    expect(poza?.getAttribute("loading")).toBe("lazy");
    expect(poza?.getAttribute("src")).toBe("/capturi/portal-pontare-780.webp");
    expect((poza?.getAttribute("srcset") ?? "").split(",")).toHaveLength(2);
  });

  it("fișierul nu e marcat `use client`", () => {
    /*
     * `/pontaj-pe-telefon` și `/module/portal-angajat` sunt prerandate static.
     * Directiva aici ar face din `InMana` o referință de client apelată din
     * graful de server — exact defectul reparat în `prin-geam.tsx`, pe care
     * numai `next build` îl vede, la trei minute după ce a fost introdus.
     */
    const sursa = readFileSync("src/app/(marketing)/_componente/in-mana.tsx", "utf8");
    expect(/^\s*["']use client["']/m.test(sursa)).toBe(false);
  });
});
