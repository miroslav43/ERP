// src/components/ui/callout.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Callout, type FelCallout } from "./callout";

/**
 * Blocul de mesaj a înlocuit ~30 de casete scrise de mână, cu cinci rețete
 * concurente și patru opacități pentru același înțeles. Ce se apără aici sunt
 * cele trei reguli care nu se văd în niciun screenshot: cine întrerupe
 * cititorul de ecran, cine supraviețuiește tipăririi alb-negru, și unde are
 * voie să existe roșu.
 */

const TOATE_FELURILE: readonly FelCallout[] = ["neutru", "informativ", "atentie", "eroare"];

const radacina = (container: HTMLElement): HTMLElement =>
  container.firstElementChild as HTMLElement;

describe("Callout — anunțul", () => {
  it('`fel="eroare"` are `role="alert"`', () => {
    // Eroarea apare după o acțiune eșuată, când focusul e pe buton. Fără
    // `role="alert"`, nimeni nu află de ce nu s-a întâmplat nimic.
    render(<Callout fel="eroare">Salvarea a eșuat.</Callout>);
    expect(screen.getByRole("alert").textContent).toContain("Salvarea a eșuat.");
  });

  it.each(["neutru", "informativ", "atentie"] as const)(
    '`fel="%s"` NU are `role="alert"`',
    (fel) => {
      // Un `role="alert"` pe un mesaj neutru întrerupe cititorul de ecran
      // degeaba — și, repetat pe o pagină cu trei casete, îl face inutilizabil.
      const { container } = render(<Callout fel={fel}>Nu există rânduri.</Callout>);
      expect(radacina(container).hasAttribute("role")).toBe(false);
    },
  );
});

describe("Callout — pictograma", () => {
  it.each(TOATE_FELURILE)(
    '`fel="%s"` randează o pictogramă ascunsă de cititorul de ecran',
    (fel) => {
      // Inclusiv `neutru`: un bloc identificat doar prin chenar dispare la
      // tipărire alb-negru și pentru cine nu distinge roșul de verde.
      // `aria-hidden`, fiindcă pictograma doar repetă ce spune textul.
      const { container } = render(<Callout fel={fel}>Mesaj.</Callout>);
      const pictograma = container.querySelector("svg");
      expect(pictograma).not.toBeNull();
      expect(pictograma?.getAttribute("aria-hidden")).toBe("true");
    },
  );
});

describe("Callout — culorile", () => {
  it.each(TOATE_FELURILE)('corpul lui `fel="%s"` nu poartă culoare de stare', (fel) => {
    // Pe `bg-danger/8`, cerneala dă 13,11:1 și roșul 5,36:1 — amândouă trec,
    // dar amestecul lor în același bloc arată ca două sisteme. Roșul rămâne al
    // pictogramei; ca text ar fi decor, nu semnal.
    //
    // Asertiunea a fost o vreme mai slabă — verifica doar absența roșului —
    // fiindcă `twMerge` ȘTERGEA `text-foreground`: nu știa că `text-corp` e o
    // mărime din `@theme`, o clasifica drept culoare și le punea în conflict.
    // Defectul e reparat în `src/lib/ui/cn.ts` și fixat de `cn.test.ts`, deci
    // aici se poate cere din nou ce trebuie cerut: cerneala E declarată.
    const { container } = render(<Callout fel={fel}>Mesaj.</Callout>);
    const c = radacina(container).className;
    expect(c).toMatch(/(^|\s)text-foreground(\s|$)/);
    expect(c).not.toMatch(/(^|\s)text-danger(\s|$)/);
    expect(c).not.toMatch(/(^|\s)text-warning(\s|$)/);
  });

  it('pe `fel="eroare"` roșul e al pictogramei, nu al corpului', () => {
    const { container } = render(<Callout fel="eroare">Salvarea a eșuat.</Callout>);
    expect(radacina(container).className).toMatch(/(^|\s)text-foreground(\s|$)/);
    expect(radacina(container).className).not.toMatch(/(^|\s)text-danger(\s|$)/);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("text-danger");
  });

  it('`fel="informativ"` e neutru cromatic — fără albastru', () => {
    // Albastrul nu există în paleta acestui produs, iar „informativ” nu e o
    // stare care cere culoare.
    const { container } = render(<Callout fel="informativ">Se recalculează nocturn.</Callout>);
    const html = container.innerHTML;
    expect(html).not.toContain("blue");
    expect(html).not.toContain("sky");
  });
});

describe("Callout — titlul și acțiunea", () => {
  it("`titlu` apare când e dat", () => {
    render(
      <Callout fel="atentie" titlu="Sold insuficient">
        Mai ai 2 zile.
      </Callout>,
    );
    expect(screen.getByText("Sold insuficient")).toBeDefined();
    expect(screen.getByText("Mai ai 2 zile.")).toBeDefined();
  });

  it("`titlu` lipsește când nu e dat, fără element gol în locul lui", () => {
    // Un `<p>` gol lasă spațiu vertical inexplicabil sub pictogramă.
    const { container } = render(<Callout fel="neutru">Mai ai 2 zile.</Callout>);
    expect(container.querySelector("p")).toBeNull();
  });

  it("`actiune` apare când e dată și lipsește când nu", () => {
    const cu = render(
      <Callout fel="neutru" actiune={<button type="button">Șterge filtrele</button>}>
        Niciun rezultat.
      </Callout>,
    );
    expect(cu.container.querySelector("button")).not.toBeNull();

    const fara = render(<Callout fel="neutru">Niciun rezultat.</Callout>);
    expect(fara.container.querySelector("button")).toBeNull();
  });
});
