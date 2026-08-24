// src/components/ui/nivel.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Nivel, type TonNivel } from "./nivel";

/**
 * Ce se apără aici nu e aspectul barei, ci cele patru reguli pe care niciun
 * compilator nu le vede:
 *
 *  1. depășirea NU arată ca o bară plină (bara existentă din popriri clampează
 *     la `Math.min(100, …)`, deci 103 % și 100 % desenează același dreptunghi);
 *  2. zero rămâne o bară GOALĂ vizibilă, nu un ecran fără nimic pe el;
 *  3. primitiva nu decide singură că „mult” e rău;
 *  4. `aria-valuenow` nu iese niciodată din `[valuemin, valuemax]`, altfel
 *     cititorul de ecran raportează 100 % exact acolo unde s-a depășit.
 */

const TOATE_TONURILE: readonly TonNivel[] = ["neutru", "bun", "atentie", "rau"];

const CLASA_TONULUI: Readonly<Record<TonNivel, string>> = {
  neutru: "bg-primary",
  bun: "bg-success",
  atentie: "bg-warning",
  rau: "bg-danger",
};

function bara(container: HTMLElement): HTMLElement {
  return container.querySelector('[role="progressbar"]') as HTMLElement;
}

function umplut(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-parte="umplut"]') as HTMLElement;
}

function exces(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-parte="depasire"]');
}

describe("Nivel — ce se aude", () => {
  it("anunță textul primit, nu cifra din care nu se înțelege nimic", () => {
    // Un om care aude „14” nu știe din ce. Cu `aria-valuetext` prezent,
    // cititorul de ecran anunță textul ÎN LOCUL procentului.
    render(
      <Nivel
        valoare={14}
        din={21}
        eticheta="Zile de concediu folosite"
        text="14 zile folosite din 21 cuvenite"
      />,
    );
    const progres = screen.getByRole("progressbar");
    expect(progres.getAttribute("aria-valuetext")).toBe("14 zile folosite din 21 cuvenite");
    expect(progres.getAttribute("aria-label")).toBe("Zile de concediu folosite");
    expect(progres.getAttribute("aria-valuemin")).toBe("0");
    expect(progres.getAttribute("aria-valuenow")).toBe("14");
    expect(progres.getAttribute("aria-valuemax")).toBe("21");
  });

  it.each([
    [0, 21],
    [14, 21],
    [21, 21],
    [23, 21],
    [3, 0],
    [Number.NaN, 21],
  ])("valoarea %s din %s ține `now` în intervalul declarat", (valoare, din) => {
    // O bară cu `now > max` e nevalidă, iar cititoarele o raportează atunci ca
    // 100 % — adică exact minciuna pe care componenta o repară vizual.
    const { container } = render(<Nivel valoare={valoare} din={din} eticheta="e" text="t" />);
    const progres = bara(container);
    const acum = Number(progres.getAttribute("aria-valuenow"));
    const minim = Number(progres.getAttribute("aria-valuemin"));
    const maxim = Number(progres.getAttribute("aria-valuemax"));
    expect(Number.isFinite(acum)).toBe(true);
    expect(acum).toBeGreaterThanOrEqual(minim);
    expect(acum).toBeLessThanOrEqual(maxim);
  });
});

describe("Nivel — depășirea", () => {
  it("23 din 21 nu se desenează la fel ca 21 din 21", () => {
    const exact = render(<Nivel valoare={21} din={21} eticheta="Zile" text="21 din 21" />);
    const peste = render(<Nivel valoare={23} din={21} eticheta="Zile" text="23 din 21" />);
    expect(bara(exact.container).innerHTML).not.toBe(bara(peste.container).innerHTML);
    expect(bara(exact.container).getAttribute("data-depasire")).toBeNull();
    expect(bara(peste.container).getAttribute("data-depasire")).toBe("da");
  });

  it("reperul se mută înăuntru, proporțional cu cât s-a trecut peste el", () => {
    // Scara devine 23, deci limita de 21 stă la 21/23 = 91,30 %, iar cele două
    // zile în plus ocupă restul de 8,70 %. Ambele cifre se VĂD.
    const { container } = render(<Nivel valoare={23} din={21} eticheta="Zile" text="23 din 21" />);
    const portiuneExces = exces(container) as HTMLElement;
    expect(Number.parseFloat(umplut(container).style.width)).toBeCloseTo(91.3, 1);
    expect(Number.parseFloat(portiuneExces.style.left)).toBeCloseTo(91.3, 1);
    expect(Number.parseFloat(portiuneExces.style.width)).toBeCloseTo(8.7, 1);
  });

  it("depășirea poartă un semnal care NU e culoare", () => {
    // Crestătura în culoarea fundalului și hașura supraviețuiesc unei liste
    // tipărite alb-negru și oricărei deficiențe de percepție a culorii.
    // Testul apără și trecerea prin `cn()`: `hasura` e un utilitar propriu, iar
    // `tailwind-merge` a mai înghițit tăcut clase pe care nu le recunoaște.
    const { container } = render(
      <Nivel valoare={23} din={21} ton="bun" eticheta="Zile" text="23 din 21" />,
    );
    const portiuneExces = exces(container) as HTMLElement;
    expect(portiuneExces.className).toContain("hasura");
    expect(portiuneExces.className).toContain("border-l-2");
    expect(portiuneExces.className).toContain("border-background");
  });

  it("3 pași dintr-un checklist de 0 pași sunt integral depășire", () => {
    // `din` zero nu e o eroare de programare: `progres.get(id) ?? { total: 0 }`
    // e chiar valoarea implicită din ecranul de onboarding.
    const { container } = render(<Nivel valoare={3} din={0} eticheta="Pași" text="3 din 0" />);
    expect(bara(container).getAttribute("data-depasire")).toBe("da");
    expect(Number.parseFloat(umplut(container).style.width)).toBe(0);
    expect(Number.parseFloat((exces(container) as HTMLElement).style.width)).toBe(100);
  });
});

describe("Nivel — zero", () => {
  it("rămâne o bară goală vizibilă, nu dispare", () => {
    // Pista din popriri e `bg-background` pe un card `bg-surface`: 1,09:1. La
    // 0 % nu se vede că EXISTĂ o bară, deci „zero” devine indistinct de „nu s-a
    // măsurat”. Conturul e ce face golul vizibil ca gol — 5,55:1 pe fundal.
    const { container } = render(<Nivel valoare={0} din={21} eticheta="Zile" text="0 din 21" />);
    expect(bara(container)).not.toBeNull();
    expect(bara(container).className).toContain("border-muted-foreground");
    expect(bara(container).className).toContain("border");
    expect(bara(container).getAttribute("data-depasire")).toBeNull();
  });

  it("umplerea la zero e de fix 0 %, fără fâșie de complezență", () => {
    const { container } = render(<Nivel valoare={0} din={21} eticheta="Zile" text="0 din 21" />);
    expect(Number.parseFloat(umplut(container).style.width)).toBe(0);
  });

  it("o valoare nefinită nu ajunge niciodată `width: NaN%`", () => {
    // Browserul ignoră TĂCUT o lățime nevalidă, iar elementul își ia lățimea
    // din flux — adică bara ar arăta plină exact când datele lipsesc.
    const { container } = render(
      <Nivel valoare={Number.NaN} din={Number.POSITIVE_INFINITY} eticheta="e" text="t" />,
    );
    expect(umplut(container).style.width).not.toContain("NaN");
    expect(Number.parseFloat(umplut(container).style.width)).toBe(0);
  });
});

describe("Nivel — tonul", () => {
  it.each(TOATE_TONURILE)("tonul %s colorează și umplerea, și porțiunea în exces", (ton) => {
    const { container } = render(
      <Nivel valoare={30} din={21} ton={ton} eticheta="e" text="30 din 21" />,
    );
    expect(umplut(container).className).toContain(CLASA_TONULUI[ton]);
    expect((exces(container) as HTMLElement).className).toContain(CLASA_TONULUI[ton]);
  });

  it("depășirea nu se vopsește singură în roșu", () => {
    // La zile de concediu LUATE, mult nu e rău — e chiar scopul concediului.
    // Cine știe dacă depășirea e o problemă e apelantul, nu primitiva.
    const { container } = render(
      <Nivel valoare={30} din={21} ton="bun" eticheta="Zile luate" text="30 din 21" />,
    );
    expect(container.innerHTML).not.toContain("bg-danger");
    expect(container.innerHTML).not.toContain("bg-warning");
  });
});

describe("Nivel — regulile de stil ale proiectului", () => {
  it.each(TOATE_TONURILE)(
    "tonul %s nu scrie culori în hex și nu diluează prin opacitate",
    (ton) => {
      const { container } = render(
        <Nivel valoare={23} din={21} ton={ton} eticheta="e" text="t" marime="subtire" />,
      );
      expect(container.innerHTML).not.toContain("#");
      expect(container.innerHTML).not.toContain("opacity");
    },
  );
});
