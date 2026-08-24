// src/components/ui/badge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, type TonStare } from "./badge";

/**
 * Regula fișierului: culoarea e redundantă, CUVÂNTUL poartă înțelesul.
 *
 * Pastila a înlocuit 27 de hărți `CLASE_*` din 13 fișiere, 125 de celule cu
 * nouă familii de nuanțe pentru șase stări. Ce se apără aici nu e paleta, ci
 * cele două invariante care fac pastila lizibilă tipărită alb-negru și peste
 * un rând care își schimbă fundalul la hover.
 */

const TOATE_TONURILE: readonly TonStare[] = ["succes", "atentie", "pericol", "neutru", "ciorna"];

describe("Badge — cuvântul", () => {
  it.each(TOATE_TONURILE)("tonul %s afișează textul primit, nu doar culoarea", (ton) => {
    // Dacă `children` s-ar pierde, pastila ar rămâne un punct colorat —
    // adică exact zero informație pentru cine nu distinge culorile.
    render(<Badge ton={ton}>Aprobat</Badge>);
    expect(screen.getByText("Aprobat")).toBeDefined();
  });
});

describe("Badge — fundalul", () => {
  it.each(TOATE_TONURILE)("tonul %s nu-și pune fundal pe rădăcină", (ton) => {
    // O pastilă cu fundal propriu se bate cu starea rândului pe care stă:
    // rândul la hover devine `bg-surface`, iar pastila peste el arată ca o a
    // treia culoare, neintenționată. Bulina interioară are voie — e 6px.
    const { container } = render(<Badge ton={ton}>Aprobat</Badge>);
    const radacina = container.firstElementChild as HTMLElement;
    expect(radacina.className).not.toMatch(/(^|\s)bg-/);
  });

  it("bulina interioară e singurul loc cu fundal", () => {
    const { container } = render(<Badge ton="succes">Aprobat</Badge>);
    const bulina = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(bulina.className).toContain("bg-success");
  });
});

describe("Badge — bulina", () => {
  it.each(TOATE_TONURILE)("tonul %s randează o bulină ascunsă de cititorul de ecran", (ton) => {
    // Bulina doar REPETĂ vizual ce spune cuvântul. Anunțată, ar fi zgomot:
    // „aprobat, imagine” pe fiecare rând dintr-o listă de 50.
    const { container } = render(<Badge ton={ton}>Aprobat</Badge>);
    const bulina = container.querySelector('span[aria-hidden="true"]');
    expect(bulina).not.toBeNull();
    expect(bulina?.getAttribute("aria-hidden")).toBe("true");
  });

  it('`ton="ciorna"` are bulina GOALĂ — contur, fundal transparent', () => {
    // „Neînceput”: conturul spune „există un loc, nu s-a umplut încă”. O bulină
    // plină ar arăta identic cu „neutru”, care înseamnă altceva.
    const { container } = render(<Badge ton="ciorna">Ciornă</Badge>);
    const bulina = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(bulina.className).toContain("bg-transparent");
    expect(bulina.className).toContain("border-muted-foreground");
  });
});

describe("Badge — culorile interzise", () => {
  it('`ton="atentie"` păstrează textul `text-foreground`, nu `text-warning`', () => {
    // Chihlimbarul ca text dă 3,40:1 — interzis la orice dimensiune sub 18,66px
    // bold, iar pastila e `text-nota`. Chihlimbarul rămâne al bulinei.
    const { container } = render(<Badge ton="atentie">În lucru</Badge>);
    const radacina = container.firstElementChild as HTMLElement;
    expect(radacina.className).toContain("text-foreground");
    expect(radacina.className).not.toContain("text-warning");
    // …dar bulina îl poartă, ca semnal redundant.
    const bulina = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(bulina.className).toContain("bg-warning");
  });

  it.each(TOATE_TONURILE)("tonul %s nu folosește auriul în nicio formă", (ton) => {
    // `--color-accent` pe crem dă 2,26:1. Auriul e culoarea mărcii, nu a stării.
    const { container } = render(<Badge ton={ton}>Aprobat</Badge>);
    expect(container.innerHTML).not.toContain("accent");
  });
});

describe("Badge — avertismentul", () => {
  it("`cuAvertisment` înlocuiește bulina cu o pictogramă", () => {
    // „Expirat” trebuie să se distingă de „Respinsă” pe o listă tipărită
    // alb-negru, unde ambele buline roșii devin același gri.
    const { container } = render(
      <Badge ton="pericol" cuAvertisment>
        Expirat
      </Badge>,
    );
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
  });

  it("fără `cuAvertisment` nu apare nicio pictogramă", () => {
    const { container } = render(<Badge ton="pericol">Respinsă</Badge>);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull();
  });
});
