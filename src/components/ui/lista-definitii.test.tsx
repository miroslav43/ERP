// src/components/ui/lista-definitii.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ListaDefinitii, type Definitie, type NumarColoane } from "./lista-definitii";

/**
 * Regula fișierului: o valoare lipsă NU e un gol.
 *
 * Restul testelor apără marcajul propriu-zis — în șapte fișiere din depozit
 * `<dt>`/`<dd>` sunt scrise fără niciun `<dl>` deasupra, deci relația
 * etichetă–valoare nu se formează, iar cititorul de ecran citește două texte
 * alăturate. Nici `tsc`, nici ESLint, nici `next build` nu văd asta.
 */

const LIPSA = "Necompletat";

function primulDd(container: HTMLElement): HTMLElement {
  return container.querySelector("dd") as HTMLElement;
}

function lista(definitii: readonly Definitie[], coloane?: NumarColoane) {
  return render(
    <ListaDefinitii
      definitii={definitii}
      textNecompletat={LIPSA}
      {...(coloane === undefined ? {} : { coloane })}
    />,
  );
}

describe("ListaDefinitii — marcajul", () => {
  it("fiecare etichetă e un <dt> din <dl>, urmat imediat de <dd>-ul ei", () => {
    const { container } = lista([
      { eticheta: "Nume", valoare: "Ionescu" },
      { eticheta: "Prenume", valoare: "Maria" },
      { eticheta: "Funcție", valoare: "Operator" },
    ]);
    const dl = container.querySelector("dl");
    expect(dl).not.toBeNull();

    const etichete = Array.from(container.querySelectorAll("dt"));
    expect(etichete).toHaveLength(3);
    for (const eticheta of etichete) {
      // Fără `<dl>`, perechea nu există pentru cititorul de ecran — exact
      // defectul din `flota/[id]`, `ssm/accidente/[id]` și încă cinci fișiere.
      expect(eticheta.closest("dl")).toBe(dl);
      expect(eticheta.nextElementSibling?.tagName).toBe("DD");
    }
    expect(container.querySelectorAll("dd")).toHaveLength(3);
  });
});

describe("ListaDefinitii — valoarea lipsă", () => {
  it.each([null, undefined, "", "   "])(
    "valoarea %o randează marcajul de necompletat, nu un <dd> mut",
    (valoare) => {
      // Un `<dd>` gol nu se aude ca „lipsește”, ci ca „am completat, e nimic”.
      // Iar „—”, folosit de 75 de ori în depozit, nu se anunță deloc la
      // nivelul implicit de punctuație al NVDA și JAWS — sună tot a gol.
      const { container } = lista([{ eticheta: "CNP", valoare }]);
      const dd = primulDd(container);
      expect(dd.textContent).toBe(LIPSA);
      expect(dd.querySelector("[data-necompletat]")).not.toBeNull();
    },
  );

  it("valoarea 0 NU e o valoare lipsă", () => {
    // Capcana clasică, `valoare || "—"`: un sold de 0 zile rămase e o
    // informație, adesea cea mai importantă de pe ecran.
    const { container } = lista([{ eticheta: "Zile rămase", valoare: 0 }]);
    const dd = primulDd(container);
    expect(dd.textContent).toBe("0");
    expect(dd.querySelector("[data-necompletat]")).toBeNull();
  });

  it("marcajul lipsei rămâne la contrast plin, distins prin cursiv", () => {
    // `text-muted-foreground/70 italic`, cum e azi în fișa angajatului, dă
    // 2,99:1 pe crem — sub AA. Diluarea e interzisă în tot proiectul, la fel
    // ca `disabled:opacity-*`.
    const { container } = lista([{ eticheta: "IBAN", valoare: null }]);
    const dd = primulDd(container);
    expect(dd.className).toContain("text-muted-foreground");
    expect(dd.className).toContain("italic");
    expect(dd.className).not.toMatch(/text-muted-foreground\/\d/);
    // `cn()` trebuie să fi eliminat `text-foreground`, dar să fi PĂSTRAT
    // mărimea `text-corp` — cazul documentat în `src/lib/ui/cn.ts`.
    expect(dd.className).not.toContain("text-foreground");
    expect(dd.className).toContain("text-corp");
  });

  it("nu are niciun șir propriu: tot ce se citește vine din props", () => {
    const { container } = lista([{ eticheta: "Data încetării", valoare: null }]);
    expect(container.textContent).toBe(`Data încetării${LIPSA}`);
  });
});

describe("ListaDefinitii — aranjamentul", () => {
  it.each([1, 2, 3, 4] as const)("sub `md`, %s coloane cad tot pe una singură", (coloane) => {
    const { container } = lista([{ eticheta: "Nume", valoare: "Ionescu" }], coloane);
    const dl = container.querySelector("dl") as HTMLElement;
    expect(dl.className).toContain("grid");
    expect(dl.className).toContain("grid-cols-1");
  });

  it("numărul cerut apare ca prag responsiv, nu ca valoare fixă", () => {
    const trei = lista([{ eticheta: "Nume", valoare: "Ionescu" }], 3);
    const dlTrei = trei.container.querySelector("dl") as HTMLElement;
    expect(dlTrei.className).toContain("md:grid-cols-2");
    expect(dlTrei.className).toContain("lg:grid-cols-3");

    const una = lista([{ eticheta: "Nume", valoare: "Ionescu" }], 1);
    const dlUna = una.container.querySelector("dl") as HTMLElement;
    expect(dlUna.className).not.toContain("md:grid-cols-");
    expect(dlUna.className).not.toContain("lg:grid-cols-");
  });

  it("un câmp `lat` ocupă tot rândul", () => {
    const { container } = lista([
      { eticheta: "Adresă de domiciliu", valoare: "Str. Lungă nr. 1", lat: true },
    ]);
    const element = container.querySelector("dl > div") as HTMLElement;
    expect(element.className).toContain("col-span-full");
  });

  it("o valoare lungă nu poate lăți coloana", () => {
    // Fără `min-w-0`, pista de grilă își ia lățimea minimă din cel mai lung
    // cuvânt NECURMAT al copilului — un IBAN de 24 de caractere e un singur
    // cuvânt, deci pagina capătă derulare orizontală.
    const { container } = lista([
      { eticheta: "IBAN", valoare: "RO49AAAA1B31007593840000", identificator: true },
    ]);
    const element = container.querySelector("dl > div") as HTMLElement;
    expect(element.className).toContain("min-w-0");
    expect(primulDd(container).className).toContain("break-all");
  });
});

describe("ListaDefinitii — identificatorii", () => {
  it("cifrele unui identificator sunt monospațiate și tabulare; un nume, nu", () => {
    const { container } = lista([
      { eticheta: "CNP", valoare: "1980101123456", identificator: true },
      { eticheta: "Localitate", valoare: "Cluj-Napoca" },
    ]);
    const celule = container.querySelectorAll("dd");
    const cnp = celule[0] as HTMLElement;
    const localitate = celule[1] as HTMLElement;
    expect(cnp.className).toContain("font-mono");
    expect(cnp.className).toContain("tabular-nums");
    // Pe text obișnuit, `break-all` ar tăia numele oamenilor la mijloc.
    expect(localitate.className).not.toContain("font-mono");
    expect(localitate.className).toContain("break-words");
  });

  it("nu scrie culori în hex și nu diluează nimic prin opacitate", () => {
    const { container } = lista([
      { eticheta: "CNP", valoare: null, identificator: true },
      { eticheta: "Nume", valoare: "Ionescu" },
    ]);
    expect(container.innerHTML).not.toContain("#");
    expect(container.innerHTML).not.toContain("opacity");
  });
});
