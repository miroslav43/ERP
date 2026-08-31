// src/app/(app)/concedii/calendar/planificator-concedii.test.tsx
/**
 * Ce apără testele astea: promisiunea vizuală a planificatorului.
 *
 * Culoarea spune TIPUL, forma spune STAREA, iar hover-ul le scrie pe amândouă.
 * Niciuna dintre cele trei nu e verificabilă din `planificator.ts` — acolo se
 * testează decizia, aici drumul ei până la atributul de pe ecran. Un `title`
 * pierdut la o refactorizare, o hașură ajunsă și pe cererile aprobate sau o
 * legendă care numără de două ori același tip trec de typecheck, de lint și de
 * toate testele pure.
 *
 * E și primul test de randare dintr-o pagină din `src/app/` — proiectul `ui`
 * din `vitest.config.mts` include `src/**​/*.test.tsx` exact pentru asta.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  cheieCelula,
  zilelePlanificatorului,
  type AbsentaCelula,
} from "@/domain/leave/planificator";

import { PlanificatorConcedii, type RandAngajatPlanificator } from "./planificator-concedii";

const ODIHNA = "#2563EB";
const MEDICAL = "#DC2626";

const ANGAJATI: readonly RandAngajatPlanificator[] = [
  { id: "e1", nume: "Ionescu Ana", marca: "A-001" },
  { id: "e2", nume: "Popa Ion", marca: "A-002" },
];

const aprobata = (culoare: string, denumire: string): AbsentaCelula => ({
  tipId: denumire,
  tipDenumire: denumire,
  tipCuloare: culoare,
  stare: "aprobata",
});
const inAprobare = (culoare: string, denumire: string): AbsentaCelula => ({
  tipId: denumire,
  tipDenumire: denumire,
  tipCuloare: culoare,
  stare: "in_aprobare",
});

/** Martie 2026: 1 e duminică, deci 2 e luni. Fără sărbători, ca să fie previzibil. */
const ZILE = zilelePlanificatorului(2026, 3, [], [], []);

function deseneaza(
  celule: Readonly<Record<string, readonly AbsentaCelula[]>>,
  azi = "2026-03-10",
): HTMLElement {
  const { container } = render(
    <PlanificatorConcedii zile={ZILE} angajati={ANGAJATI} celule={celule} azi={azi} />,
  );
  return container;
}

/** Celula unui angajat într-o zi, găsită după rândul lui. */
function celula(container: HTMLElement, indexRand: number, indexZi: number): HTMLElement {
  const randuri = container.querySelectorAll("tbody tr");
  const rand = randuri[indexRand];
  if (rand === undefined) throw new Error(`Rândul ${String(indexRand)} nu există.`);
  const celule = rand.querySelectorAll("td");
  const gasita = celule[indexZi];
  if (gasita === undefined) throw new Error(`Ziua ${String(indexZi)} nu există.`);
  return gasita;
}

describe("rândurile", () => {
  it("desenează un rând pentru fiecare angajat, chiar și fără nicio absență", () => {
    const container = deseneaza({});
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(screen.getByText("Ionescu Ana")).toBeDefined();
    expect(screen.getByText("Popa Ion")).toBeDefined();
    // Rândul gol e chiar răspunsul la „cine e disponibil": nu se ascunde.
    expect(screen.getByText("A-002")).toBeDefined();
  });

  it("desenează o coloană pentru fiecare zi a lunii", () => {
    const container = deseneaza({});
    // 31 de zile + coloana de nume.
    expect(container.querySelectorAll("thead th")).toHaveLength(32);
    expect(celula(container, 0, 30)).toBeDefined();
  });

  it("spune că nu are rânduri, în loc să arate un tabel gol", () => {
    render(<PlanificatorConcedii zile={ZILE} angajati={[]} celule={{}} azi="2026-03-10" />);
    expect(screen.getByText(/nu are rânduri/u)).toBeDefined();
  });
});

describe("culoarea e tipul, forma e starea", () => {
  it("umple caseta cu culoarea tipului când cererea e aprobată", () => {
    const container = deseneaza({
      [cheieCelula("e1", "2026-03-09")]: [aprobata(ODIHNA, "Concediu de odihnă")],
    });
    const caseta = celula(container, 0, 8).querySelector("span[aria-hidden]");
    expect(caseta).not.toBeNull();
    // `happy-dom` păstrează hexul așa cum a fost scris; `jsdom` l-ar fi
    // normalizat la `rgb(…)`. Comparația se face cu ce randează chiar mediul
    // proiectului (v. `vitest.config.mts`, de ce nu e jsdom).
    expect((caseta as HTMLElement).style.backgroundColor).toBe(ODIHNA);
    // Fără hașură: umplerea plină E semnalul „decis".
    expect((caseta as HTMLElement).style.backgroundImage).toBe("");
  });

  it("hașurează caseta, în aceeași culoare, când cererea nu e decisă", () => {
    const container = deseneaza({
      [cheieCelula("e1", "2026-03-09")]: [inAprobare(ODIHNA, "Concediu de odihnă")],
    });
    const caseta = celula(container, 0, 8).querySelector("span[aria-hidden]") as HTMLElement;
    expect(caseta.style.backgroundImage).toContain("repeating-linear-gradient");
    expect(caseta.style.backgroundImage).toContain(ODIHNA);
    // Umplerea plină ar șterge distincția: fundalul rămâne al paginii.
    expect(caseta.style.backgroundColor).toBe("");
    expect(caseta.className).toContain("bg-background");
  });

  it("nu desenează nicio casetă într-o zi liberă de concediu", () => {
    const container = deseneaza({});
    expect(celula(container, 0, 8).querySelector("span[aria-hidden]")).toBeNull();
  });
});

describe("ce se citește la hover și la atingere", () => {
  it("scrie cine, când, ce tip și dacă e aprobată", () => {
    const container = deseneaza({
      [cheieCelula("e2", "2026-03-09")]: [inAprobare(MEDICAL, "Concediu medical")],
    });
    const zi = celula(container, 1, 8);
    expect(zi.getAttribute("title")).toBe("Popa Ion · 09.03.2026 · Concediu medical · în aprobare");
  });

  it("repetă textul într-un `sr-only`, fiindcă `title` nu există la atingere", () => {
    const container = deseneaza({
      [cheieCelula("e1", "2026-03-09")]: [aprobata(ODIHNA, "Concediu de odihnă")],
    });
    const zi = celula(container, 0, 8);
    const ascuns = zi.querySelector(".sr-only");
    expect(ascuns?.textContent).toContain("Concediu de odihnă");
    expect(ascuns?.textContent).toContain("aprobată");
  });

  it("anunță a doua cerere de pe aceeași zi și desenează cea DECISĂ", () => {
    // Cazul real: un concediu medical nedecis peste o odihnă deja aprobată.
    const container = deseneaza({
      [cheieCelula("e1", "2026-03-09")]: [
        inAprobare(MEDICAL, "Concediu medical"),
        aprobata(ODIHNA, "Concediu de odihnă"),
      ],
    });
    const zi = celula(container, 0, 8);
    expect(zi.getAttribute("title")).toContain("Concediu de odihnă");
    expect(zi.getAttribute("title")).toContain("+1");
    const caseta = zi.querySelector("span[aria-hidden]") as HTMLElement;
    expect(caseta.style.backgroundColor).toBe(ODIHNA);
  });
});

describe("coloanele", () => {
  it("umbrește weekendul, în antet și în celule", () => {
    const container = deseneaza({});
    const antete = container.querySelectorAll("thead th");
    // 1 martie 2026 e duminică: prima coloană de zi.
    expect(antete[1]?.className).toContain("bg-surface");
    expect(celula(container, 0, 0).className).toContain("bg-surface");
    // 2 martie e luni.
    expect(celula(container, 0, 1).className).not.toContain("bg-surface");
  });

  it("marchează ziua de azi în antet", () => {
    const container = deseneaza({}, "2026-03-10");
    const antete = [...container.querySelectorAll("thead th")];
    const azi = antete[10];
    expect(azi?.className).toContain("bg-primary");
    expect(azi?.textContent).toContain("azi");
    expect(antete[11]?.className).not.toContain("bg-primary");
  });

  it("dă fiecărei coloane un nume citibil, nu doar inițiala", () => {
    const container = deseneaza({});
    const antete = [...container.querySelectorAll("thead th")];
    expect(antete[1]?.textContent).toContain("duminică");
    expect(antete[2]?.textContent).toContain("luni");
  });
});

describe("legenda", () => {
  it("listează fiecare tip prezent o singură dată și explică hașura", () => {
    const container = deseneaza({
      [cheieCelula("e1", "2026-03-09")]: [aprobata(ODIHNA, "Concediu de odihnă")],
      [cheieCelula("e1", "2026-03-10")]: [aprobata(ODIHNA, "Concediu de odihnă")],
      [cheieCelula("e2", "2026-03-09")]: [inAprobare(MEDICAL, "Concediu medical")],
    });
    expect(screen.getAllByText("Concediu de odihnă")).toHaveLength(1);
    expect(screen.getAllByText("Concediu medical")).toHaveLength(1);
    expect(screen.getByText(/hașurat/u)).toBeDefined();
    // Semnele de legendă stau în afara tabelului.
    expect(
      within(container)
        .getByText(/hașurat/u)
        .closest("table"),
    ).toBeNull();
  });

  it("nu desenează nicio legendă pentru o lună fără absențe", () => {
    deseneaza({});
    expect(screen.queryByText(/hașurat/u)).toBeNull();
    expect(screen.getByText(/Nicio absență/u)).toBeDefined();
  });
});
