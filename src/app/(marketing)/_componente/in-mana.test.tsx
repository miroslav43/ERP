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

  it("grila are atâtea coloane câte imagini, nu trei mereu", () => {
    /*
     * Defect măsurat în browser pe 18 sept 2026, pe `/module/portal-angajat`:
     * clasa `lg:grid-cols-3`, scrisă pentru banda cu trei imagini, rămăsese și
     * pe cea cu două. `gridTemplateColumns` calculat era `370,656px × 3` cu
     * doar două celule — o treime de bandă albă în dreapta.
     *
     * Testul se uită la CLASĂ, nu la randare: jsdom n-are layout, deci
     * `gridTemplateColumns` n-ar spune nimic aici.
     */
    const grila = (chei: readonly string[]) => {
      const { container } = render(<InMana supratitlu="S" titlu="T" chei={chei} />);
      return container.querySelector("figure")?.parentElement?.className ?? "";
    };

    expect(grila(["portal-pontare", "portal-scanare"])).not.toContain("lg:grid-cols-3");
    expect(grila(["portal-pontare", "portal-scanare", "afis-pontare"])).toContain("lg:grid-cols-3");
    // Două coloane rămân în ambele cazuri: pe tabletă, trei ar fi prea înguste.
    expect(grila(["portal-pontare", "portal-scanare"])).toContain("sm:grid-cols-2");
  });

  it("doar prima imagine e prioritară, și numai când banda stă sus", () => {
    /*
     * Măsurat cu Lighthouse pe 18 sept 2026: pe `/module/portal-angajat` prima
     * imagine a benzii E elementul LCP al paginii, și avea `loading="lazy"`
     * fără `fetchpriority` — își întârzia singură descoperirea.
     *
     * Restul rămân leneșe, iar pe paginile unde banda e sub linia de plutire
     * (`/pontaj-pe-telefon`) rămân leneșe toate: altfel am plăti o descărcare
     * devreme pentru o imagine pe care nimeni n-o vede.
     */
    const poze = (susInPagina: boolean) => {
      const { container } = render(
        <InMana
          supratitlu="S"
          titlu="T"
          chei={["portal-pontare", "portal-scanare", "afis-pontare"]}
          susInPagina={susInPagina}
        />,
      );
      return [...container.querySelectorAll("figure > button img")];
    };

    const sus = poze(true);
    expect(sus[0]?.getAttribute("loading")).toBe("eager");
    expect(sus[0]?.getAttribute("fetchpriority")).toBe("high");
    for (const poza of sus.slice(1)) {
      expect(poza.getAttribute("loading")).toBe("lazy");
      expect(poza.getAttribute("fetchpriority")).toBe("auto");
    }

    for (const poza of poze(false)) {
      expect(poza.getAttribute("loading")).toBe("lazy");
      expect(poza.getAttribute("fetchpriority")).toBe("auto");
    }
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
