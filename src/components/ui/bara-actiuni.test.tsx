// src/components/ui/bara-actiuni.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BaraActiuni } from "./bara-actiuni";
import { Buton } from "./buton";

/**
 * Regulile apărate aici sunt exact cele pe care `typecheck`, `lint` și `build`
 * nu le pot vedea: ordinea din DOM față de ordinea de pe ecran, distanța
 * garantată până la acțiunea distructivă și zona sigură de pe telefon. Toate
 * trei arată perfect într-o captură de ecran și se rup doar la tastatură sau
 * pe un iPhone.
 */

function numeleButoanelor(radacina: HTMLElement): readonly string[] {
  return Array.from(radacina.querySelectorAll("button")).map((b) => b.textContent ?? "");
}

describe("BaraActiuni — ordinea din DOM e ordinea de la tabulare", () => {
  it("randează butoanele exact în ordinea primită", () => {
    const { container } = render(
      <BaraActiuni>
        <Buton varianta="primar">Salvează</Buton>
        <Buton varianta="secundar">Renunță</Buton>
      </BaraActiuni>,
    );
    expect(numeleButoanelor(container)).toEqual(["Salvează", "Renunță"]);
  });

  it("nu inversează niciodată ordinea vizuală față de cea din marcaj", () => {
    // `flex-row-reverse`, `flex-col-reverse` și `order-*` mută pixelii fără să
    // miște DOM-ul: omul vede „Renunță | Salvează” și tabulează invers.
    const { container } = render(
      <BaraActiuni aliniere="final">
        <Buton varianta="primar">Salvează</Buton>
        <Buton varianta="secundar">Renunță</Buton>
      </BaraActiuni>,
    );
    const bara = container.firstElementChild as HTMLElement;
    expect(bara.className).not.toMatch(/flex-(row|col)-reverse/);
    expect(bara.className).not.toMatch(/(^|\s|:)order-/);
    // Dreapta se obține mutând GRUPUL, nu elementele din el.
    expect(bara.className).toContain("justify-end");
    expect(numeleButoanelor(container)).toEqual(["Salvează", "Renunță"]);
  });

  it("alinierea implicită e la început — 48 de rânduri față de 3", () => {
    const { container } = render(
      <BaraActiuni>
        <Buton varianta="primar">Salvează</Buton>
      </BaraActiuni>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain("justify-start");
  });
});

describe("BaraActiuni — acțiunea distructivă", () => {
  it("stă ULTIMA în DOM, deci și ultima la tabulare", () => {
    // Azi, în `pontaj/celula-zi.tsx:392`, „Șterge ziua” e PRIMA: cine vine din
    // câmpuri și apasă Tab o dată cade direct pe ea.
    const { container } = render(
      <BaraActiuni
        distructiva={<Buton varianta="distructiv">Șterge ziua</Buton>}
        eticheta="Acțiuni pentru zi"
      >
        <Buton varianta="primar">Salvează</Buton>
        <Buton varianta="secundar">Renunță</Buton>
      </BaraActiuni>,
    );
    expect(numeleButoanelor(container)).toEqual(["Salvează", "Renunță", "Șterge ziua"]);
  });

  it("are o distanță GARANTATĂ față de rest, nu doar spațiul liber rămas", () => {
    // `ms-auto` singur se strânge la zero când bara e îngustă sau se rupe pe
    // două rânduri — și atunci „Șterge” ajunge iar lângă „Salvează”.
    render(
      <BaraActiuni distructiva={<Buton varianta="distructiv">Casează</Buton>}>
        <Buton varianta="primar">Salvează</Buton>
      </BaraActiuni>,
    );
    const invelis = screen.getByRole("button", { name: "Casează" }).parentElement as HTMLElement;
    expect(invelis.className).toContain("ms-auto");
    expect(invelis.className).toContain("border-s");
    expect(invelis.className).toContain("ps-3");
  });

  it("folosește proprietăți logice, nu stânga/dreapta fizice", () => {
    render(
      <BaraActiuni distructiva={<Buton varianta="distructiv">Casează</Buton>}>
        <Buton varianta="primar">Salvează</Buton>
      </BaraActiuni>,
    );
    const clase = (screen.getByRole("button", { name: "Casează" }).parentElement as HTMLElement)
      .className;
    expect(clase).not.toMatch(/(^|\s)ml-auto(\s|$)/);
    expect(clase).not.toMatch(/(^|\s)border-l(\s|$)/);
  });

  it("fără distructivă nu adaugă niciun înveliș suplimentar", () => {
    const { container } = render(
      <BaraActiuni>
        <Buton varianta="primar">Salvează</Buton>
      </BaraActiuni>,
    );
    const bara = container.firstElementChild as HTMLElement;
    expect(bara.children.length).toBe(1);
    expect(bara.className).not.toContain("ms-auto");
  });
});

describe("BaraActiuni — lipită jos pe telefon", () => {
  it("respectă zona sigură a ecranului, nu doar `bottom-0`", () => {
    // `layout.tsx` declară `viewportFit: "cover"`, deci `bottom: 0` e marginea
    // FIZICĂ a ecranului: fără inset, „Salvează” stă sub bara de gesturi.
    const { container } = render(
      <BaraActiuni lipitaPeTelefon>
        <Buton varianta="primar">Salvează</Buton>
      </BaraActiuni>,
    );
    const clase = (container.firstElementChild as HTMLElement).className;
    expect(clase).toContain("env(safe-area-inset-bottom)");
    // `max()`, nu `env()` gol: pe un telefon fără crestătură insetul e 0 și
    // bara ar rămâne complet fără umplutură de jos.
    expect(clase).toContain("max(0.75rem,env(safe-area-inset-bottom))");
    expect(clase).toContain("max-md:sticky");
    expect(clase).toContain("max-md:bottom-0");
  });

  it("păstrează umplutura de sus — `pb-[…]` ar fi înghițit un `py-3`", () => {
    // `cn` știe că `pb` intră în conflict cu `py` și ar șterge tot `py-3`,
    // inclusiv partea de sus. Defect tăcut: bara arată lipită de câmpuri.
    const { container } = render(
      <BaraActiuni lipitaPeTelefon>
        <Buton varianta="primar">Salvează</Buton>
      </BaraActiuni>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain("max-md:pt-3");
  });

  it("stă pe un token de stivuire, sub sertarul mobil și sub notificări", () => {
    // `z-scrim` 50 și `z-sertar` 60 (sidebar.tsx), `z-plutitor` 70 (toast.tsx).
    // Pe `z-plutitor`, „Salvează” ar pluti peste meniul deschis.
    const { container } = render(
      <BaraActiuni lipitaPeTelefon>
        <Buton varianta="primar">Salvează</Buton>
      </BaraActiuni>,
    );
    const clase = (container.firstElementChild as HTMLElement).className;
    expect(clase).toContain("max-md:z-antet");
    expect(clase).not.toContain("z-plutitor");
    expect(clase).not.toMatch(/z-\d/);
  });

  it("nu se lipește dacă nu i se cere — un footer de dialog n-are voie", () => {
    const { container } = render(
      <BaraActiuni aliniere="final">
        <Buton varianta="primar">Confirmă</Buton>
      </BaraActiuni>,
    );
    const clase = (container.firstElementChild as HTMLElement).className;
    expect(clase).not.toContain("sticky");
    expect(clase).not.toContain("fixed");
  });
});

describe("BaraActiuni — accesibilitate", () => {
  it("nu se declară `toolbar`: ar promite navigare cu săgeți", () => {
    // `toolbar` cere roving tabindex — o singură oprire de tabulare pentru tot
    // grupul. Nu-l implementăm, deci promisiunea ar fi o pierdere netă.
    const { container } = render(
      <BaraActiuni eticheta="Acțiuni formular">
        <Buton varianta="primar">Salvează</Buton>
      </BaraActiuni>,
    );
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
    expect(screen.getByRole("group", { name: "Acțiuni formular" })).toBeDefined();
  });

  it("fără etichetă nu emite niciun rol — un grup anonim e doar zgomot", () => {
    const { container } = render(
      <BaraActiuni>
        <Buton varianta="primar">Salvează</Buton>
      </BaraActiuni>,
    );
    const bara = container.firstElementChild as HTMLElement;
    expect(bara.hasAttribute("role")).toBe(false);
    expect(bara.hasAttribute("aria-label")).toBe(false);
  });

  it("nu-și scrie propriul inel de focus și nu folosește opacitate", () => {
    const { container } = render(
      <BaraActiuni separata lipitaPeTelefon eticheta="Acțiuni">
        <Buton varianta="primar">Salvează</Buton>
      </BaraActiuni>,
    );
    const clase = (container.firstElementChild as HTMLElement).className;
    expect(clase).not.toMatch(/focus-visible:/);
    expect(clase).not.toMatch(/outline-none/);
    expect(clase).not.toMatch(/opacity-/);
  });
});
