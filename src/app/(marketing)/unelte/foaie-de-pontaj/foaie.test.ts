import { describe, expect, it } from "vitest";

import {
  avizAngajati,
  avizeParametri,
  citesteAngajati,
  construiesteFoaie,
  normalizeazaAngajati,
  normalizeazaLuna,
  notaOmisi,
  oreFoaie,
  textNorma,
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

/**
 * Regula produsului (`src/lib/format/ore.ts`): orele se scriu în ceas, nu în
 * zecimale. Pe 8 oct 2026, `ore=7.3` pe iunie 2026 afișa
 * „153.29999999999998 h normă”, cu punct.
 */
describe("orele foii", () => {
  it("norma nu poartă erori de virgulă mobilă: 21 × 7:18 h = 153:18 h", () => {
    const f = construiesteFoaie(2026, 6, ["A"], 7.3);
    expect(f.zileLucratoare).toBe(21);
    expect(f.normaLunara).toBe(153.3);
    expect(textNorma(f)).toBe("21 de zile lucrătoare × 7:18 h = 153:18 h normă");
  });

  it("înmulțirea afișată se verifică: ziua se rotunjește la minut ÎNAINTE de normă", () => {
    // `ore=7.33` dintr-o adresă scrisă de mână: ziua se afișează 7:20 h. Cu
    // rotunjirea doar pe total ieșea „× 7:20 h = 153:56 h”, iar 21 × 7:20 = 154:00.
    expect(textNorma(construiesteFoaie(2026, 6, ["A"], 7.33))).toBe(
      "21 de zile lucrătoare × 7:20 h = 154 h normă",
    );
    expect(textNorma(construiesteFoaie(2026, 6, ["A"], 7.99))).toBe(
      "21 de zile lucrătoare × 7:59 h = 167:39 h normă",
    );
  });

  it("orele întregi rămân fără „:00”, jumătățile în ceas", () => {
    expect(oreFoaie(8)).toBe("8 h");
    expect(oreFoaie(7.5)).toBe("7:30 h");
    expect(oreFoaie(168)).toBe("168 h");
    expect(oreFoaie(1198)).toBe("1.198 h");
  });

  it("„de” apare de la 20 în sus", () => {
    expect(textNorma(construiesteFoaie(2026, 12, ["A"], 8))).toBe(
      "21 de zile lucrătoare × 8 h = 168 h normă",
    );
    expect(textNorma(construiesteFoaie(2026, 1, ["A"], 8))).toBe(
      "18 zile lucrătoare × 8 h = 144 h normă",
    );
  });
});

/**
 * API-ul rămâne tolerant (un link vechi dă tot un fișier), dar pagina spune ce
 * a corectat. Înainte, `an=1999&luna=13` dădea foaia lunii curente fără semn.
 */
describe("avizele pentru parametrii corectați", () => {
  const ALES = { an: 2026, luna: 10 };

  it("anul și luna din afara limitelor se spun pe nume, cu valoarea folosită", () => {
    expect(avizeParametri({ an: "1999", luna: "13" }, ALES)).toEqual([
      "Anul „1999” nu e un an între 2020 și 2035; am folosit 2026.",
      "Luna „13” nu e între 1 și 12; am folosit octombrie.",
    ]);
  });

  it("„2e1” nu mai trece tăcut drept februarie", () => {
    expect(
      avizeParametri({ luna: "2e1" }, { an: 2026, luna: normalizeazaLuna("2e1", 10) }),
    ).toEqual(["Luna „2e1” nu e între 1 și 12; am folosit februarie."]);
  });

  it("valorile bune, cu zero în față sau cu spații, nu dau aviz", () => {
    expect(avizeParametri({ an: " 2026 ", luna: "05", ore: "7,5" }, { an: 2026, luna: 5 })).toEqual(
      [],
    );
  });

  it("parametrii lipsă sau goi nu dau aviz", () => {
    expect(avizeParametri({ an: "", luna: undefined, ore: "  " }, ALES)).toEqual([]);
  });

  it("orele: avizul spune valoarea folosită de fapt", () => {
    expect(avizeParametri({ ore: "abc" }, ALES)).toEqual([
      "Orele pe zi „abc” nu sunt un număr între 0 și 24; am folosit 8 h.",
    ]);
    // parseFloat citește „7,5abc” drept 7,5: foaia e pe 7:30 h, iar avizul trebuie s-o spună.
    expect(avizeParametri({ ore: "7,5abc" }, ALES)).toEqual([
      "Orele pe zi „7,5abc” nu sunt un număr între 0 și 24; am folosit 7:30 h.",
    ]);
  });

  it("textul primit se citează scurtat la 24 de caractere", () => {
    const [aviz] = avizeParametri({ an: "x".repeat(100) }, ALES);
    expect(aviz).toContain(`„${"x".repeat(24)}…”`);
    expect(aviz).not.toContain("x".repeat(25));
  });
});
