// src/components/grafice/grafice.test.tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BandaZile } from "./banda-zile";
import { Bare } from "./bare";
import { Inel } from "./inel";
import { Linie } from "./linie";
import { Sparkline } from "./sparkline";

/**
 * Ce apără fișierul: geometria. Un grafic care compilează, trece lint-ul și se
 * randează poate în același timp să MINTĂ — o bară tăiată de jos, un arc care
 * nu închide cercul, o serie plată lipită de marginea de sus. Nimic altceva din
 * lanțul de verificare nu se uită la cifrele din `d` și din `strokeDasharray`.
 */

const LUNI = [
  { eticheta: "ian.", valoare: 12 },
  { eticheta: "feb.", valoare: 15 },
  { eticheta: "mar.", valoare: 9 },
];

describe("Toate graficele — tabelul ascuns", () => {
  it("poartă fiecare punct, ca datele să nu fie doar desen", () => {
    render(<Bare titlu="Efectiv pe luni" unitate="Angajați" puncte={LUNI} />);
    const tabel = screen.getByRole("table", { name: "Efectiv pe luni" });
    expect(within(tabel).getAllByRole("row")).toHaveLength(4); // antet + 3
    expect(within(tabel).getByText("feb.")).toBeDefined();
    expect(within(tabel).getByText("15")).toBeDefined();
  });

  it("antetul primei coloane se poate traduce — landing-ul e bilingv", () => {
    // Regula proiectului: primitivele n-au șiruri proprii. `Perioadă` scris în
    // componentă ar fi fost singurul cuvânt românesc dintr-o pagină englezească.
    render(<Bare titlu="Headcount" unitate="People" antetCategorie="Month" puncte={LUNI} />);
    expect(screen.getByText("Month")).toBeDefined();
  });

  it("`<svg>` e ascuns pentru cititorul de ecran, numele stă pe înveliș", () => {
    const { container } = render(<Bare titlu="Efectiv" puncte={LUNI} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("img", { name: "Efectiv" })).toBeDefined();
  });
});

describe("Bare — pornesc de la zero", () => {
  it("baza fiecărei bare cade pe aceeași linie", () => {
    // Regula fără excepție: bara comunică prin LUNGIME, deci tăiată de jos
    // transformă o creștere de 3 % într-o dublare vizuală.
    const { container } = render(<Bare titlu="t" puncte={LUNI} inaltime={180} />);
    const baze = Array.from(container.querySelectorAll("rect")).map(
      (r) => Number(r.getAttribute("y")) + Number(r.getAttribute("height")),
    );
    expect(new Set(baze.map((b) => b.toFixed(6))).size).toBe(1);
  });

  it("bara cea mai mare atinge plafonul, cea mai mică nu dispare", () => {
    const { container } = render(<Bare titlu="t" puncte={LUNI} inaltime={180} />);
    const inaltimi = Array.from(container.querySelectorAll("rect")).map((r) =>
      Number(r.getAttribute("height")),
    );
    expect(Math.max(...inaltimi)).toBeGreaterThan(Math.min(...inaltimi));
    expect(Math.min(...inaltimi)).toBeGreaterThan(0);
  });

  it("o valoare de zero rămâne o bară de zero, nu una minimă mincinoasă", () => {
    const { container } = render(
      <Bare
        titlu="t"
        puncte={[
          { eticheta: "a", valoare: 0 },
          { eticheta: "b", valoare: 5 },
        ]}
      />,
    );
    const inaltimi = Array.from(container.querySelectorAll("rect")).map((r) =>
      Number(r.getAttribute("height")),
    );
    expect(inaltimi[0]).toBe(0);
  });

  it("fără puncte nu randează nimic", () => {
    const { container } = render(<Bare titlu="t" puncte={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("Inel — feliile închid cercul", () => {
  const FELII = [
    { eticheta: "Net", valoare: 3510 },
    { eticheta: "CAS", valoare: 1500 },
    { eticheta: "CASS", valoare: 600 },
    { eticheta: "Impozit", valoare: 390 },
  ];

  it("suma arcelor e exact circumferința — nicio felie pierdută", () => {
    const { container } = render(<Inel titlu="Brut" felii={FELII} />);
    const CIRC = 2 * Math.PI * 70;
    const arce = Array.from(container.querySelectorAll("circle"))
      .filter((c) => c.getAttribute("stroke") === null) // feliile, nu tăieturile
      .map((c) => Number((c.getAttribute("stroke-dasharray") ?? "").split(" ")[0]));
    expect(arce).toHaveLength(4);
    expect(arce.reduce((s, a) => s + a, 0)).toBeCloseTo(CIRC, 6);
  });

  it("decalajul fiecărei felii e suma celor dinaintea ei", () => {
    const { container } = render(<Inel titlu="Brut" felii={FELII} />);
    const felii = Array.from(container.querySelectorAll("circle")).filter(
      (c) => c.getAttribute("stroke") === null,
    );
    const lungimi = felii.map((c) =>
      Number((c.getAttribute("stroke-dasharray") ?? "").split(" ")[0]),
    );
    const decalaje = felii.map((c) => Number(c.getAttribute("stroke-dashoffset")));
    // `-0` serializat în atribut devine "0"; `toBe` folosește `Object.is`,
    // pentru care `-0` și `0` sunt valori diferite.
    expect(decalaje[0]).toBe(0);
    expect(decalaje[1]).toBeCloseTo(-(lungimi[0] as number), 6);
    expect(decalaje[2]).toBeCloseTo(-((lungimi[0] as number) + (lungimi[1] as number)), 6);
  });

  it("feliile alăturate se despart structural, nu cromatic", () => {
    // Două serii nu pot atinge 3:1 între ele dacă toate sunt vizibile pe crem
    // (maximul, căutat exhaustiv, e 2,08:1). Deci granița e un contur.
    const { container } = render(<Inel titlu="Brut" felii={FELII} />);
    const taieturi = Array.from(container.querySelectorAll("circle")).filter(
      (c) => c.getAttribute("stroke") === "var(--color-background)",
    );
    expect(taieturi).toHaveLength(4);
  });

  it("o singură felie n-are ce despărți", () => {
    const { container } = render(<Inel titlu="Brut" felii={[{ eticheta: "Tot", valoare: 10 }]} />);
    expect(container.querySelectorAll('circle[stroke="var(--color-background)"]')).toHaveLength(0);
  });

  it("un întreg de zero nu se desenează deloc", () => {
    const { container } = render(<Inel titlu="Brut" felii={[{ eticheta: "a", valoare: 0 }]} />);
    expect(container.firstChild).toBeNull();
  });

  it("legenda arată și feliile de zero — absența s-ar citi ca «nu există categoria»", () => {
    render(
      <Inel
        titlu="Brut"
        felii={[
          { eticheta: "Prezent", valoare: 5 },
          { eticheta: "Absent", valoare: 0 },
        ]}
      />,
    );
    // apare o dată în legendă și o dată în tabelul ascuns
    expect(screen.getAllByText("Absent").length).toBeGreaterThanOrEqual(2);
  });
});

describe("Sparkline — seria plată", () => {
  it("se desenează la mijloc, nu lipită de o margine", () => {
    // Cu domeniu zero, scala ar trimite totul pe marginea de sus sau de jos,
    // sugerând un maxim sau un minim care nu există.
    const { container } = render(
      <Sparkline
        titlu="Constant"
        inaltime={30}
        puncte={[
          { eticheta: "a", valoare: 7 },
          { eticheta: "b", valoare: 7 },
          { eticheta: "c", valoare: 7 },
        ]}
      />,
    );
    const y = Array.from(
      (container.querySelector("path[stroke]")?.getAttribute("d") ?? "").matchAll(/,([\d.]+)/g),
    ).map((m) => Number(m[1]));
    expect(new Set(y).size).toBe(1);
    expect(y[0]).toBe(15);
  });

  it("sub două puncte nu e o serie", () => {
    const { container } = render(<Sparkline titlu="t" puncte={[{ eticheta: "a", valoare: 1 }]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("Linie", () => {
  it("marcajele de capăt sunt HTML, ca să rămână cercuri sub scalare neuniformă", () => {
    // `preserveAspectRatio="none"` întinde SVG-ul pe lățime: un `<circle>`
    // dinăuntru ar ieși elipsă.
    const { container } = render(
      <Linie titlu="Efectiv" serii={[{ nume: "Total", puncte: LUNI }]} />,
    );
    expect(container.querySelectorAll("svg circle")).toHaveLength(0);
    expect(container.querySelectorAll("span.rounded-full").length).toBeGreaterThan(0);
  });

  it("mai multe serii primesc legendă și etichete prefixate în tabel", () => {
    render(
      <Linie
        titlu="Comparație"
        serii={[
          { nume: "2025", puncte: LUNI },
          { nume: "2026", puncte: LUNI },
        ]}
      />,
    );
    const tabel = screen.getByRole("table", { name: "Comparație" });
    expect(within(tabel).getByText("2025 · feb.")).toBeDefined();
    expect(within(tabel).getByText("2026 · feb.")).toBeDefined();
  });

  it("o serie cu un singur punct nu e o evoluție", () => {
    const { container } = render(
      <Linie titlu="t" serii={[{ nume: "a", puncte: [{ eticheta: "x", valoare: 1 }] }]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("BandaZile", () => {
  const ZILE = [
    { cheie: "2026-08-01", eticheta: "1", ton: "bun" as const, descriere: "Prezent 8 h" },
    { cheie: "2026-08-02", eticheta: "2", ton: "gol" as const, descriere: "Weekend" },
    { cheie: "2026-08-03", eticheta: "3", ton: "inchis" as const, descriere: "Lună închisă" },
  ];

  it("fiecare zi ajunge în tabelul ascuns, cu starea în litere", () => {
    render(<BandaZile titlu="August" zile={ZILE} />);
    const tabel = screen.getByRole("table", { name: "August" });
    expect(within(tabel).getByText("Prezent 8 h")).toBeDefined();
    expect(within(tabel).getByText("Lună închisă")).toBeDefined();
  });

  it("starea «închis» poartă hașură, nu doar altă culoare", () => {
    // WCAG 1.4.1: informația nu se transmite numai prin culoare. Hașura
    // supraviețuiește și tipăririi alb-negru.
    const { container } = render(<BandaZile titlu="August" zile={ZILE} />);
    expect(container.querySelector(".hasura")).not.toBeNull();
  });

  it("fiecare celulă are `title`, deci un indiciu la mouse fără JavaScript", () => {
    const { container } = render(<BandaZile titlu="August" zile={ZILE} />);
    const cuTitlu = container.querySelectorAll("[title]");
    expect(cuTitlu).toHaveLength(3);
  });

  it("fără zile nu randează nimic", () => {
    const { container } = render(<BandaZile titlu="t" zile={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
