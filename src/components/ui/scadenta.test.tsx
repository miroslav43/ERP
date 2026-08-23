// src/components/ui/scadenta.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  maiGravaScadenta,
  RANG_SCADENTA,
  Scadenta,
  treaptaDinScadenta,
  type TreaptaScadenta,
} from "./scadenta";

/**
 * Ce se apără aici nu e aspectul, ci cele trei reguli pe care compilatorul nu
 * le vede:
 *
 * 1. Primitiva NU ghicește ce înseamnă `null` — același `null` are trei
 *    severități în cele trei module.
 * 2. Fiecare treaptă are o a doua marcă în afară de culoare (WCAG 1.4.1), iar
 *    `neaplicabil` nu are NICIUNA de alarmă.
 * 3. Textul vine din afară. Marketingul e bilingv și importă aceleași
 *    primitive, deci o pastilă care își scrie singură cuvântul e o traducere
 *    pierdută.
 */

const TOATE_TREPTELE: readonly TreaptaScadenta[] = [
  "neaplicabil",
  "in_regula",
  "curand",
  "critic",
  "expirat",
  "lipsa",
];

const AZI = "2026-06-15";

/** Numele lucide al pictogramei randate — `lucide-clock`, `lucide-minus`… */
function numePictograma(container: HTMLElement): string {
  const clase = container.querySelector("svg")?.getAttribute("class") ?? "";
  return clase.split(/\s+/).find((c) => c.startsWith("lucide-") && c !== "lucide") ?? "";
}

describe("Scadenta — cuvântul", () => {
  it.each(TOATE_TREPTELE)("treapta %s afișează textul primit", (treapta) => {
    render(<Scadenta treapta={treapta}>Expiră în 12 zile</Scadenta>);
    expect(screen.getByText("Expiră în 12 zile")).toBeDefined();
  });

  it("nu adaugă niciun cuvânt propriu", () => {
    // „Expiră în 12 zile”, „Expirat de 3 zile” și „Niciodată efectuată” pot
    // împărți aceeași treaptă. Dacă pastila ar compune ea textul, cele trei
    // propoziții ar deveni una singură — și n-ar mai avea cum să fie traduse.
    const { container } = render(<Scadenta treapta="expirat">Expirat de 3 zile</Scadenta>);
    expect(container.textContent).toBe("Expirat de 3 zile");
  });
});

describe("Scadenta — a doua marcă", () => {
  it.each(TOATE_TREPTELE)("treapta %s poartă o pictogramă, nu doar culoare", (treapta) => {
    const { container } = render(<Scadenta treapta={treapta}>Text</Scadenta>);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("cele șase trepte au șase forme DIFERITE", () => {
    // `expirat` și `lipsa` sunt amândouă roșii, `curand` și `critic` amândouă
    // chihlimbar. Fără forme distincte, patru trepte din șase ar arăta identic
    // pe o listă tipărită alb-negru și pentru cine nu distinge roșul de verde.
    const forme = TOATE_TREPTELE.map((treapta) => {
      const { container } = render(<Scadenta treapta={treapta}>Text</Scadenta>);
      return numePictograma(container);
    });
    expect(forme).toHaveLength(6);
    expect(forme.filter((f) => f === "")).toHaveLength(0);
    expect(new Set(forme).size).toBe(6);
  });

  it.each(TOATE_TREPTELE)("pictograma treptei %s e ascunsă de cititorul de ecran", (treapta) => {
    // Pictograma doar REPETĂ vizual ce spune cuvântul. Anunțată, ar fi zgomot:
    // „expirat, imagine” pe fiecare rând dintr-o listă de 50.
    const { container } = render(<Scadenta treapta={treapta}>Text</Scadenta>);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Scadenta — `neaplicabil` nu alarmează", () => {
  it("nu folosește nici roșul, nici chihlimbarul", () => {
    // „Nu e cazul” nu e o problemă de rezolvat: un tip de instruire fără
    // periodicitate legală nu expiră NICIODATĂ odată efectuat. O pastilă
    // portocalie acolo ar trimite omul să caute o scadență inexistentă.
    const { container } = render(<Scadenta treapta="neaplicabil">Nu expiră</Scadenta>);
    expect(container.innerHTML).not.toContain("danger");
    expect(container.innerHTML).not.toContain("warning");
    expect(container.innerHTML).not.toContain("success");
  });

  it("poartă totuși o a doua marcă — linia, nu absența ei", () => {
    const { container } = render(<Scadenta treapta="neaplicabil">Nu expiră</Scadenta>);
    expect(numePictograma(container)).toBe("lucide-minus");
  });

  it("scrie cu cerneala stinsă", () => {
    const { container } = render(<Scadenta treapta="neaplicabil">Nu expiră</Scadenta>);
    const radacina = container.firstElementChild as HTMLElement;
    expect(radacina.className).toContain("text-muted-foreground");
  });
});

describe("Scadenta — culorile", () => {
  it.each(TOATE_TREPTELE)("treapta %s nu-și pune fundal pe rădăcină", (treapta) => {
    // Aceeași regulă ca la `Badge`: pastila stă pe un rând care devine
    // `bg-surface` la hover, iar un fundal propriu ar arăta ca o a treia
    // culoare, neintenționată.
    const { container } = render(<Scadenta treapta={treapta}>Text</Scadenta>);
    const radacina = container.firstElementChild as HTMLElement;
    expect(radacina.className).not.toMatch(/(^|\s)bg-/);
  });

  it.each(TOATE_TREPTELE)("treapta %s nu folosește auriul în nicio formă", (treapta) => {
    // `--color-accent` pe crem dă 2,26:1. Auriul e culoarea mărcii, nu a stării.
    const { container } = render(<Scadenta treapta={treapta}>Text</Scadenta>);
    expect(container.innerHTML).not.toContain("accent");
  });

  it.each(["curand", "critic"] as const)(
    "treapta %s ține chihlimbarul în pictogramă, nu în text",
    (treapta) => {
      // Chihlimbarul dă 3,40:1 pe crem și 3,12:1 pe rândul la hover — sub 4,5,
      // deci interzis ca text. Ca pictogramă pragul e 3:1 și trece în ambele.
      const { container } = render(<Scadenta treapta={treapta}>Expiră curând</Scadenta>);
      const radacina = container.firstElementChild as HTMLElement;
      expect(radacina.className).toContain("text-foreground");
      expect(radacina.className).not.toContain("text-warning");
      expect(container.querySelector("svg")?.getAttribute("class")).toContain("text-warning");
    },
  );

  it.each(["expirat", "lipsa"] as const)("treapta %s scrie cu roșu (6,11:1)", (treapta) => {
    const { container } = render(<Scadenta treapta={treapta}>Expirat</Scadenta>);
    const radacina = container.firstElementChild as HTMLElement;
    expect(radacina.className).toContain("text-danger");
  });
});

describe("Scadenta — treapta rămâne citibilă din afară", () => {
  it.each(TOATE_TREPTELE)("treapta %s ajunge în `data-treapta`", (treapta) => {
    // Ca un test sau un Playwright să poată verifica severitatea fără să
    // citească o culoare, și ca o foaie de tipar să prindă ce pierde cerneala.
    const { container } = render(<Scadenta treapta={treapta}>Text</Scadenta>);
    const radacina = container.firstElementChild as HTMLElement;
    expect(radacina.getAttribute("data-treapta")).toBe(treapta);
  });
});

describe("RANG_SCADENTA", () => {
  it("crește strict în ordinea celor șase trepte", () => {
    expect(TOATE_TREPTELE.map((t) => RANG_SCADENTA[t])).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("pune „lipsa” DEASUPRA lui „expirat”", () => {
    // Decizia de produs, nu o preferință: ce lipsește n-are dată de la care să
    // numere, deci nu se aprinde niciodată singur. Ce a expirat s-a aprins deja.
    expect(RANG_SCADENTA.lipsa).toBeGreaterThan(RANG_SCADENTA.expirat);
    expect(maiGravaScadenta("expirat", "lipsa")).toBe("lipsa");
    expect(maiGravaScadenta("lipsa", "expirat")).toBe("lipsa");
  });

  it("pune „neaplicabil” SUB „in_regula”", () => {
    // „Nu se aplică” nu e o veste bună, e o non-veste. Nu are ce să urce peste
    // un termen respectat.
    expect(RANG_SCADENTA.neaplicabil).toBeLessThan(RANG_SCADENTA.in_regula);
    expect(maiGravaScadenta("neaplicabil", "in_regula")).toBe("in_regula");
  });
});

describe("treaptaDinScadenta — `null` nu se ghicește", () => {
  it("întoarce EXACT ce a cerut apelantul pentru `null`", () => {
    // O singură intrare, trei răspunsuri corecte, câte unul pe domeniu: flota
    // („lipsește”), SSM („nu expiră niciodată”), mentenanța („fără scadență”).
    expect(treaptaDinScadenta(null, AZI, { avertizareZile: 30, laNull: "lipsa" })).toBe("lipsa");
    expect(treaptaDinScadenta(null, AZI, { avertizareZile: 30, laNull: "neaplicabil" })).toBe(
      "neaplicabil",
    );
    expect(treaptaDinScadenta(null, AZI, { avertizareZile: 15, laNull: "in_regula" })).toBe(
      "in_regula",
    );
  });

  it("nu inventează niciodată `lipsa` sau `neaplicabil` dintr-o dată", () => {
    // Dintr-un calendar se pot deduce patru trepte. Celelalte două spun ceva
    // despre EXISTENȚA înregistrării, nu despre timp.
    const intrari = ["2020-01-01", AZI, "2026-07-15", "2027-01-01"];
    const rezultate = new Set(
      intrari.map((d) =>
        treaptaDinScadenta(d, AZI, { avertizareZile: 30, criticZile: 7, laNull: "lipsa" }),
      ),
    );
    expect([...rezultate].sort()).toEqual(["critic", "curand", "expirat", "in_regula"]);
  });
});

describe("treaptaDinScadenta — pragurile", () => {
  const praguriFlota = { avertizareZile: 30, laNull: "lipsa" } as const;

  it("este `expirat` pentru o dată trecută", () => {
    expect(treaptaDinScadenta("2026-06-14", AZI, praguriFlota)).toBe("expirat");
  });

  it("ziua de azi NU e încă expirată", () => {
    // Capcana de fus orar: `new Date("2026-06-15")` e miezul nopții UTC, adică
    // 03:00 în București. Comparația lexicografică pe ISO nu are fus orar.
    expect(treaptaDinScadenta(AZI, AZI, praguriFlota)).toBe("curand");
  });

  it("este `curand` exact la prag și `in_regula` imediat peste", () => {
    expect(treaptaDinScadenta("2026-07-15", AZI, praguriFlota)).toBe("curand");
    expect(treaptaDinScadenta("2026-07-16", AZI, praguriFlota)).toBe("in_regula");
  });

  it("fără `criticZile` nu produce NICIODATĂ `critic`", () => {
    // Flota și mentenanța n-au al doilea prag. O treaptă neatinsă nu strică
    // nimic; una impusă ar fi obligat modulele să mintă.
    for (const data of [AZI, "2026-06-16", "2026-06-22", "2026-07-15"]) {
      expect(treaptaDinScadenta(data, AZI, praguriFlota)).not.toBe("critic");
    }
  });

  it("cu `criticZile` reproduce semaforul SSM: 7 zile critic, 30 avertizare", () => {
    const praguriSsm = { avertizareZile: 30, criticZile: 7, laNull: "neaplicabil" } as const;
    expect(treaptaDinScadenta("2026-06-22", AZI, praguriSsm)).toBe("critic");
    expect(treaptaDinScadenta("2026-06-23", AZI, praguriSsm)).toBe("curand");
    expect(treaptaDinScadenta("2026-07-15", AZI, praguriSsm)).toBe("curand");
    expect(treaptaDinScadenta("2026-07-16", AZI, praguriSsm)).toBe("in_regula");
  });

  it("numără corect peste lună și peste an", () => {
    expect(treaptaDinScadenta("2027-01-05", "2026-12-31", praguriFlota)).toBe("curand");
    expect(treaptaDinScadenta("2026-03-01", "2026-02-28", praguriFlota)).toBe("curand");
    expect(treaptaDinScadenta("2026-02-28", "2026-03-01", praguriFlota)).toBe("expirat");
  });
});

describe("Scadenta — mărimea textului supraviețuiește lui `cn()`", () => {
  it("`text-nota` nu e înghițit de clasa de culoare", () => {
    /*
     * `src/lib/ui/cn.ts` numește asta „cazul care a dat peste cap trei
     * primitive deodată": `twMerge` clasifica `text-nota` drept CULOARE, deci
     * o punea în același grup cu `text-danger` și ștergea mărimea — tăcut, la
     * randare, fără nicio eroare. Merge azi fiindcă `text-nota` e înregistrat
     * explicit în grupul `font-size` din `cn.ts`. Testele care verifică doar
     * culoarea ar trece și dacă mărimea ar dispărea din nou.
     */
    for (const treapta of ["expirat", "curand", "in_regula", "neaplicabil"] as const) {
      const { container } = render(<Scadenta treapta={treapta}>Text</Scadenta>);
      const radacina = container.querySelector("[data-treapta]");
      expect(radacina?.className).toContain("text-nota");
    }
  });
});
