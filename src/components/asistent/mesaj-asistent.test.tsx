// src/components/asistent/mesaj-asistent.test.tsx
/**
 * Testele astea apără promisiunea făcută omului: orice pastilă pe care o vede
 * duce undeva, iar mecanismul intern al asistentului nu ajunge niciodată pe
 * ecran.
 *
 * Sunt verificări de RANDARE, nu de parsare — aceea e testată pur în
 * `marcaje.test.ts`. Aici se verifică drumul întreg, până la `<a href>`.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Destinatie } from "@/lib/asistent/destinatii";
import type { MesajAfisat } from "@/lib/asistent/depozit";

import { MesajAsistent } from "./mesaj-asistent";

const FARA_EFEMERE: ReadonlyMap<string, Destinatie> = new Map();

const alAsistentului = (text: string): MesajAfisat => ({ id: 1, rol: "asistent", text });

function deseneaza(
  text: string,
  optiuni: Readonly<{ inCurs?: boolean; efemere?: ReadonlyMap<string, Destinatie> }> = {},
): void {
  render(
    <MesajAsistent
      mesaj={alAsistentului(text)}
      inCurs={optiuni.inCurs ?? false}
      efemere={optiuni.efemere ?? FARA_EFEMERE}
    />,
  );
}

describe("mesajul omului", () => {
  it("se randează ca text, cu rândurile păstrate", () => {
    const { container } = render(
      <MesajAsistent
        mesaj={{ id: 1, rol: "om", text: "unde\ntrec orele?" }}
        inCurs={false}
        efemere={FARA_EFEMERE}
      />,
    );
    // Se citește `textContent`, nu `getByText`: testing-library normalizează
    // spațiul alb, deci ar șterge exact rândul nou pe care îl verificăm.
    const bula = container.querySelector("p");
    expect(bula?.textContent).toBe("unde\ntrec orele?");
    expect(bula?.className).toContain("whitespace-pre-wrap");
  });
});

describe("referința către o destinație", () => {
  it("devine o legătură cu href-ul real al paginii", () => {
    deseneaza("Orele se trec aici. [[ruta:pontaj.saptamana]]");
    const legatura = screen.getByRole("link");
    expect(legatura.getAttribute("href")).toBe("/pontaj/saptamana");
  });

  it("arată eticheta paginii și drumul de click, nu identificatorul", () => {
    deseneaza("[[ruta:pontaj.perioade]]");
    expect(screen.getByText("Perioade de pontaj")).toBeDefined();
    expect(screen.getByText("Operațiuni › Pontaj › Perioade")).toBeDefined();
    expect(screen.queryByText(/pontaj\.perioade/)).toBeNull();
  });

  it("nu repetă eticheta în drum, când ele coincid", () => {
    // `/profil` n-are părinte de meniu, deci drumul e chiar eticheta lui.
    deseneaza("[[ruta:profil]]");
    expect(screen.getAllByText("Profilul meu")).toHaveLength(1);
  });
});

describe("ce se întâmplă cu o halucinație", () => {
  it("nu randează nicio legătură pentru un identificator inventat", () => {
    deseneaza("Orele se trec în [[ruta:pontaj.orele-mele]] zilnic.");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("păstrează fraza întreagă în jurul referinței aruncate", () => {
    deseneaza("Orele se trec în [[ruta:habar-nu-am]] zilnic.");
    expect(screen.getByText(/Orele se trec în\s+zilnic\./)).toBeDefined();
  });

  it("nu lasă NICIODATĂ marcajul brut să ajungă pe ecran", () => {
    for (const text of [
      "a [[ruta:inventat]] b",
      "a [[ruta:]] b",
      "a [[ruta:MAJUSCULE]] b",
      "a [[ruta:pontaj]] b",
    ]) {
      const { container, unmount } = render(
        <MesajAsistent mesaj={alAsistentului(text)} inCurs={false} efemere={FARA_EFEMERE} />,
      );
      expect(container.textContent ?? "", text).not.toContain("[[");
      expect(container.textContent ?? "", text).not.toContain("ruta:");
      unmount();
    }
  });
});

describe("cât timp răspunsul curge", () => {
  it("nu arată marcajul pe jumătate scris", () => {
    deseneaza("Mergi la [[ruta:ponta", { inCurs: true });
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Mergi la")).toBeDefined();
  });
});

describe("fișa unui om, întoarsă de o unealtă", () => {
  const fisa: Destinatie = {
    id: "fisa.11111111-2222-3333-4444-555555555555",
    href: "/angajati/11111111-2222-3333-4444-555555555555",
    eticheta: "Ion Popescu",
    zona: "app",
    parinte: "angajati",
    fila: null,
    featureKey: null,
    permission: "employees:read",
    minScope: "team",
    descriere: "Fișa angajatului Ion Popescu.",
    drum: ["Personal", "Angajați", "Ion Popescu"],
  };

  it("duce direct la fișa lui, nu la lista de angajați", () => {
    deseneaza(`Fișa lui este [[ruta:${fisa.id}]].`, { efemere: new Map([[fisa.id, fisa]]) });
    expect(screen.getByRole("link").getAttribute("href")).toBe(fisa.href);
    expect(screen.getByText("Ion Popescu")).toBeDefined();
  });

  it("aruncă un UUID pe care nicio unealtă nu l-a întors", () => {
    deseneaza("Fișa e la [[ruta:fisa.00000000-0000-0000-0000-000000000000]].", {
      efemere: new Map([[fisa.id, fisa]]),
    });
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("textul răspunsului", () => {
  it("randează liste și îngroșat", () => {
    deseneaza("Ai de făcut:\n- **una**\n- alta");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("una")).toBeDefined();
  });

  it("nu transformă niciodată textul în markup", () => {
    // Fără librărie de markdown nu există drum de la text la HTML; testul ține
    // proprietatea asta în loc, dacă vine cineva să adauge una.
    const { container } = render(
      <MesajAsistent
        mesaj={alAsistentului('<img src=x onerror="alert(1)"> și <b>gros</b>')}
        inCurs={false}
        efemere={FARA_EFEMERE}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent ?? "").toContain("<img");
  });
});
