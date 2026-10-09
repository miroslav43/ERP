import { describe, expect, it } from "vitest";

import {
  avizAngajati,
  citesteAngajati,
  construiesteFoaie,
  normalizeazaAngajati,
  notaOmisi,
} from "./foaie";

/**
 * Foaia de pontaj pe anii pe care formularul îi acceptă (2020–2035).
 *
 * Auditul din 8 oct 2026: ianuarie 2022 ieșea „18 zile × 8 h = 144 h”, fiindcă
 * 6 și 7 ianuarie erau socotite sărbători și înainte de Legea 52/2023. Cifrele
 * de mai jos sunt numărate pe calendar, nu derivate din funcția testată.
 */
describe("zilele lucrătoare ale foii", () => {
  it.each([
    [2020, 20],
    [2021, 20],
    [2022, 20],
    [2023, 20],
    [2024, 20],
    [2026, 18],
  ])("zile lucrătoare în ianuarie %i: %i", (an, zile) => {
    expect(construiesteFoaie(an, 1, ["Popa Ion"], 8).zileLucratoare).toBe(zile);
  });

  it("ianuarie 2022: 160 h normă, iar 6 și 7 ianuarie sunt zile obișnuite", () => {
    const f = construiesteFoaie(2022, 1, ["Popa Ion"], 8);
    expect(f.normaLunara).toBe(160);
    expect(f.zile[5]?.sarbatoare).toBeNull(); // 6 ianuarie 2022, joi
    expect(f.zile[6]?.sarbatoare).toBeNull(); // 7 ianuarie 2022, vineri
  });

  it("din 2024, 6 și 7 ianuarie sunt sărbători", () => {
    const f = construiesteFoaie(2025, 1, ["Popa Ion"], 8);
    expect(f.zile[5]?.sarbatoare).toBe("Bobotează");
    expect(f.zile[6]?.sarbatoare).toBe("Soborul Sfântului Ioan Botezătorul");
  });
});

/**
 * Pagina spune „câte un nume pe rând”. Până pe 8 oct 2026, virgula și punctul
 * și virgula despărțeau și ele, deci „Popescu, Ion” ieșea pe două rânduri.
 */
describe("lista de angajați", () => {
  it("virgula și punctul și virgula fac parte din nume", () => {
    expect(normalizeazaAngajati("Popescu, Ion\nIonescu Maria; ing.")).toEqual([
      "Popescu, Ion",
      "Ionescu Maria; ing.",
    ]);
    expect(normalizeazaAngajati('&amp; "quote"')).toEqual(['&amp; "quote"']);
  });

  it("orice fel de rând nou desparte: LF, CRLF (trimis de formular), CR, rândul manual din Word", () => {
    expect(normalizeazaAngajati("A\r\nB\rC\u000BD")).toEqual(["A", "B", "C", "D"]);
    expect(normalizeazaAngajati(`E${String.fromCodePoint(0x2028)}F`)).toEqual(["E", "F"]);
  });

  it("tabul dintre două coloane lipite din Excel devine un spațiu", () => {
    expect(normalizeazaAngajati("Popa\tIon\nIlie \t Maria")).toEqual(["Popa Ion", "Ilie Maria"]);
  });

  it("rândurile cu doar spații invizibile nu sunt angajați (formularul trimite CRLF)", () => {
    const lista = citesteAngajati("A\r\n\u{A0}\u{A0}\r\n\u{200B}\r\n\t\r\nB");
    expect(lista.nume).toEqual(["A", "B"]);
    expect(lista.total).toBe(2);
  });

  it("o listă goală dă zece rânduri goale, de completat cu pixul", () => {
    const lista = citesteAngajati("\u{200B}\n  \n\t");
    expect(lista.total).toBe(0);
    expect(lista.omisi).toBe(0);
    expect(lista.nume).toHaveLength(10);
    expect(lista.nume.every((n) => n === "")).toBe(true);
  });

  it("numără ce a rămas pe dinafară peste 60", () => {
    const lista = citesteAngajati(
      Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n"),
    );
    expect(lista.nume).toHaveLength(60);
    expect(lista.nume.at(-1)).toBe("Om 60");
    expect(lista.total).toBe(70);
    expect(lista.omisi).toBe(10);
  });

  it("numără numele scurtate la 80 de caractere", () => {
    const lista = citesteAngajati(`${"a".repeat(81)}\nScurt`);
    expect(lista.scurtate).toBe(1);
    expect(lista.nume[0]).toHaveLength(80);
  });
});

describe("avizul și nota pentru lista tăiată", () => {
  const SAPTEZECI = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");

  it("pagina spune câți au rămas pe dinafară", () => {
    expect(avizAngajati(citesteAngajati(SAPTEZECI))).toEqual([
      "Am păstrat primii 60 din 70 de angajați. Pentru ceilalți 10, generează încă o foaie doar cu numele lor.",
    ]);
  });

  it("numele scurtate se spun și ele", () => {
    expect(avizAngajati(citesteAngajati(`${"a".repeat(81)}\nScurt`))).toEqual([
      "Un nume avea peste 80 de caractere și l-am scurtat.",
    ]);
    expect(avizAngajati(citesteAngajati(`${"a".repeat(81)}\n${"b".repeat(90)}`))).toEqual([
      "2 nume aveau peste 80 de caractere și le-am scurtat.",
    ]);
  });

  it("fișierul primește o notă, fiindcă circulă fără pagină", () => {
    expect(notaOmisi(citesteAngajati(SAPTEZECI))).toBe(
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.",
    );
    expect(notaOmisi(citesteAngajati("Popa Ion"))).toBeNull();
  });

  it("cu un singur nume pe dinafară, avizul și nota nu spun „ceilalți 1”", () => {
    const lista = citesteAngajati(
      Array.from({ length: 61 }, (_, i) => `Om ${String(i + 1)}`).join("\n"),
    );
    expect(avizAngajati(lista)).toEqual([
      "Am păstrat primii 60 din 61 de angajați. Pentru ultimul, generează încă o foaie doar cu numele lui.",
    ]);
    expect(notaOmisi(lista)).toBe(
      "Documentul cuprinde primii 60 din 61 de angajați trimiși; ultimul nu apare aici.",
    );
  });

  it("fără nimic tăiat, niciun aviz", () => {
    expect(avizAngajati(citesteAngajati("Popa Ion\nIlie Maria"))).toEqual([]);
  });
});
