// src/components/ui/tabel.test.tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * `RandTabel` cheamă `useRouter()` ca să facă rândul apăsabil fără să înfășoare
 * fiecare celulă într-un link. În afara aplicației nu există router montat, deci
 * i se dă unul inert: testele de aici verifică MARCAJUL, nu navigarea.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/angajati",
  useSearchParams: () => new URLSearchParams(),
}));

import { Tabel, type Coloana } from "./tabel";

/**
 * Regulile pe care le apără fișierul, toate invizibile pentru compilator:
 * tabelul se anunță, se poate sorta fără JavaScript, și pe telefon nu devine o
 * bară de derulare orizontală.
 */

type Rand = Readonly<{ id: string; nume: string; marca: string; suma: number; stare: string }>;

const RANDURI: readonly Rand[] = [
  { id: "1", nume: "Ionescu Ana", marca: "DEMO-001", suma: 4200, stare: "Activ" },
  { id: "2", nume: "Pop Radu", marca: "DEMO-003", suma: 3800, stare: "Activ" },
];

const COLOANE: readonly Coloana<Rand>[] = [
  {
    cheie: "avatar",
    antet: "Fotografie",
    antetAscuns: true,
    peTelefon: "ascuns",
    celula: () => "◯",
  },
  { cheie: "nume", antet: "Nume", sortabil: true, peTelefon: "titlu", celula: (r) => r.nume },
  { cheie: "marca", antet: "Marcă", sortabil: true, peTelefon: "meta", celula: (r) => r.marca },
  { cheie: "suma", antet: "Sumă", numeric: true, peTelefon: "meta", celula: (r) => r.suma },
  { cheie: "stare", antet: "Stare", peTelefon: "insigna", celula: (r) => r.stare },
];

function randeaza(extra: Partial<Parameters<typeof Tabel<Rand>>[0]> = {}) {
  return render(
    <Tabel<Rand>
      caption="Lista angajaților"
      coloane={COLOANE}
      randuri={RANDURI}
      cheieRand={(r) => r.id}
      gol={<p>Nimic aici.</p>}
      {...extra}
    />,
  );
}

describe("Tabel — cum se anunță", () => {
  it("are un nume accesibil, prin <caption> ascuns vizual", () => {
    randeaza();
    expect(screen.getByRole("table", { name: "Lista angajaților" })).toBeDefined();
  });

  it("antetul fără nume util se anunță, dar nu se vede", () => {
    // Un `<th>` gol nu spune nimic cititorului de ecran despre coloana lui.
    randeaza();
    const th = screen.getByText("Fotografie");
    expect(th.className).toContain("sr-only");
  });

  it("arată starea goală în loc de un tabel cu zero rânduri", () => {
    render(
      <Tabel<Rand>
        caption="Lista"
        coloane={COLOANE}
        randuri={[]}
        cheieRand={(r) => r.id}
        gol={<p>Nimic aici.</p>}
      />,
    );
    expect(screen.getByText("Nimic aici.")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("Tabel — sortarea, fără JavaScript", () => {
  it("fără `hrefSortare`, antetele rămân text — nu butoane care nu fac nimic", () => {
    randeaza();
    const tabel = screen.getByRole("table");
    expect(within(tabel).queryAllByRole("link")).toHaveLength(0);
  });

  it("cu `hrefSortare`, antetul sortabil devine LINK, nu buton", () => {
    // Sortarea e stare de URL. Un `<button onClick>` ar fi cerut client
    // component, iar toate cele 94 de pagini din `(app)` sunt server.
    randeaza({ hrefSortare: (s) => `?sort=${s.directie === "desc" ? "-" : ""}${s.cheie}` });
    const tabel = screen.getByRole("table");
    const linkuri = within(tabel).getAllByRole("link");
    expect(linkuri).toHaveLength(2); // doar cele două coloane `sortabil`
    expect(linkuri[0]?.getAttribute("href")).toBe("?sort=nume");
  });

  it("`aria-sort` spune după ce e ordonat — era ZERO în tot proiectul", () => {
    randeaza({
      sortare: { cheie: "nume", directie: "asc" },
      hrefSortare: (s) => `?sort=${s.cheie}`,
    });
    const antete = screen.getAllByRole("columnheader");
    const nume = antete.find((a) => a.textContent?.includes("Nume"));
    const marca = antete.find((a) => a.textContent?.includes("Marcă"));
    expect(nume?.getAttribute("aria-sort")).toBe("ascending");
    expect(marca?.getAttribute("aria-sort")).toBe("none");
  });

  it("un al doilea clic pe coloana activă inversează direcția", () => {
    randeaza({
      sortare: { cheie: "nume", directie: "asc" },
      hrefSortare: (s) => `?sort=${s.directie === "desc" ? "-" : ""}${s.cheie}`,
    });
    const link = within(screen.getByRole("table")).getAllByRole("link")[0];
    expect(link?.getAttribute("href")).toBe("?sort=-nume");
  });

  it("o coloană inactivă pornește crescător, nu invers", () => {
    randeaza({
      sortare: { cheie: "nume", directie: "desc" },
      hrefSortare: (s) => `?sort=${s.directie === "desc" ? "-" : ""}${s.cheie}`,
    });
    const linkuri = within(screen.getByRole("table")).getAllByRole("link");
    expect(linkuri[1]?.getAttribute("href")).toBe("?sort=marca");
  });
});

describe("Tabel — pe telefon", () => {
  it("randează AMBELE marcaje și ascunde unul cu CSS", () => {
    // Zero dintre cele 57 de tabele aveau vreun tratament sub 768px: fiecare
    // devenea o bară de derulare orizontală.
    const { container } = randeaza();
    const tabel = container.querySelector("div.md\\:block");
    const lista = container.querySelector("ul.md\\:hidden");
    expect(tabel).not.toBeNull();
    expect(lista).not.toBeNull();
    expect(within(lista as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
  });

  it("coloana `ascuns` nu apare în varianta de card", () => {
    const { container } = randeaza();
    const lista = container.querySelector("ul.md\\:hidden") as HTMLElement;
    expect(lista.textContent).not.toContain("◯");
  });

  it("titlul, insigna și metadatele ajung fiecare la locul lui", () => {
    const { container } = randeaza();
    const lista = container.querySelector("ul.md\\:hidden") as HTMLElement;
    const primul = within(lista).getAllByRole("listitem")[0] as HTMLElement;
    expect(primul.textContent).toContain("Ionescu Ana"); // titlu
    expect(primul.textContent).toContain("Activ"); // insignă
    expect(primul.textContent).toContain("DEMO-001"); // meta
  });
});

describe("Tabel — rândul apăsabil", () => {
  it("cardul are un singur link, care acoperă tot rândul", () => {
    const { container } = randeaza({ href: (r) => `/angajati/${r.id}` });
    const lista = container.querySelector("ul.md\\:hidden") as HTMLElement;
    const primul = within(lista).getAllByRole("listitem")[0] as HTMLElement;
    const linkuri = within(primul).getAllByRole("link");
    expect(linkuri).toHaveLength(1);
    expect(linkuri[0]?.className).toContain("after:inset-0");
  });
});

describe("Tabel — cifrele", () => {
  it("coloana numerică se aliniază la dreapta, cu cifre de lățime egală", () => {
    const { container } = randeaza();
    const celule = container.querySelectorAll("tbody td");
    const suma = Array.from(celule).find((c) => c.textContent === "4200");
    expect(suma?.className).toContain("text-right");
    expect(suma?.className).toContain("tabular-nums");
  });
});

describe("Tabel — trunchierea", () => {
  it("tace când lista e completă", () => {
    randeaza();
    expect(screen.queryByText(/tăiată la primele/)).toBeNull();
  });

  it("spune limpede când citirea a fost tăiată", () => {
    // `max_rows = 1000` trunchiază TĂCUT în PostgREST. Într-un ERP financiar,
    // o cifră greșită fără eroare e mai rea decât o eroare.
    randeaza({ trunchiat: true });
    expect(screen.getByText(/tăiată la primele/)).toBeDefined();
  });
});
