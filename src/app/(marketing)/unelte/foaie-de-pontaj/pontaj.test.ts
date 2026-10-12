import { describe, expect, it } from "vitest";

import { MAX_ANGAJATI, notaOmisi } from "./foaie";
import {
  angajatiPentruFise,
  construiestePontaj,
  liniiAngajati,
  numeFisierPontaj,
  oreDinText,
  oreScurt,
  parametriPontaj,
  rezumatNorma,
  zileDinLuna,
} from "./pontaj";

/*
 * Decembrie 2026: 1 dec (marți) și 25 dec (vineri) sunt sărbători în timpul
 * săptămânii, 26 dec e sărbătoare într-o sâmbătă. 21 de zile lucrătoare.
 */

describe("zilele lunii, după program", () => {
  it("luni–vineri: weekendul primește L, sărbătoarea SL, restul rămân libere", () => {
    const zile = zileDinLuna(2026, 12, "lv");
    const zi = (n: number) => zile[n - 1];
    expect(zi(1)?.codImplicit).toBe("SL");
    expect(zi(2)?.codImplicit).toBe("");
    expect(zi(5)?.codImplicit).toBe("L");
    expect(zi(6)?.codImplicit).toBe("L");
    expect(zi(26)?.codImplicit).toBe("SL");
    expect(zile.filter((z) => z.inProgram)).toHaveLength(21);
    expect(zi(1)).toMatchObject({
      data: "01.12.2026",
      dataScurta: "01.12",
      numeZi: "marți",
      ziScurta: "Ma",
    });
  });

  it("luni–sâmbătă: sâmbetele intră în program, sâmbăta de Crăciun nu", () => {
    const zile = zileDinLuna(2026, 12, "ls");
    expect(zile[4]?.inProgram).toBe(true); // 5 dec, sâmbătă
    expect(zile[25]?.codImplicit).toBe("SL"); // 26 dec, sâmbătă și sărbătoare
    expect(zile[5]?.codImplicit).toBe("L"); // 6 dec, duminică
    expect(zile.filter((z) => z.inProgram)).toHaveLength(24);
  });

  it("ture: toate zilele sunt deschise, fără cod pus dinainte", () => {
    const zile = zileDinLuna(2026, 12, "ture");
    expect(zile.every((z) => z.inProgram && z.codImplicit === "")).toBe(true);
    expect(zile[24]?.sarbatoare).toBe("Crăciunul"); // marcajul rămâne în date
  });
});

describe("liniile cu angajați", () => {
  it("citesc norma după bară sau după TAB, în ore, zecimale sau ceas", () => {
    const l = liniiAngajati(
      "Popa Ion\nIlie Maria | 4\nRadu Andrei\t6:30\n\nVasile Ana | 7,5\nDinu Ioan | 4h",
      8,
    );
    expect(l.angajati).toEqual([
      { nume: "Popa Ion", oreZi: 8 },
      { nume: "Ilie Maria", oreZi: 4 },
      { nume: "Radu Andrei", oreZi: 6.5 },
      { nume: "Vasile Ana", oreZi: 7.5 },
      { nume: "Dinu Ioan", oreZi: 4 },
    ]);
    expect(l.avertismente).toEqual([]);
    expect(l.lista).toMatchObject({ total: 5, omisi: 0 });
  });

  it("„Popa⇥Ion”, fără număr după TAB, rămâne un singur om (regula lui B: tabul e spațiu)", () => {
    const l = liniiAngajati("Popa\tIon", 8);
    expect(l.angajati).toEqual([{ nume: "Popa Ion", oreZi: 8 }]);
    expect(l.avertismente).toEqual([]);
  });

  it("acceptă două coloane lipite din Excel, cu CRLF și TAB final", () => {
    const l = liniiAngajati("Popa Ion\t4\r\nIlie Maria\t\r\nRadu\tAndrei\t6\r\n", 8);
    expect(l.angajati).toEqual([
      { nume: "Popa Ion", oreZi: 4 },
      { nume: "Ilie Maria", oreZi: 8 },
      { nume: "Radu Andrei", oreZi: 6 },
    ]);
  });

  it("o normă care nu se citește păstrează omul, cu norma comună și un avertisment", () => {
    const l = liniiAngajati("Ilie Maria | patru\nPopa Ion | 30", 8);
    expect(l.angajati).toEqual([
      { nume: "Ilie Maria", oreZi: 8 },
      { nume: "Popa Ion", oreZi: 8 },
    ]);
    expect(l.avertismente).toHaveLength(2);
    expect(l.avertismente[0]).toMatch(/Ilie Maria/u);
    for (const a of l.avertismente) expect(a.endsWith(".")).toBe(true);
  });

  it("lista goală dă zece rânduri necompletate, cu norma comună", () => {
    const l = liniiAngajati("  \n\n", 6);
    expect(l.angajati).toHaveLength(10);
    expect(l.angajati.every((a) => a.nume === "" && a.oreZi === 6)).toBe(true);
    expect(l.lista).toMatchObject({ total: 0, omisi: 0 });
  });

  it(`peste ${String(MAX_ANGAJATI)} de nume, lista spune câți au rămas pe dinafară (pentru avizul și nota lui B)`, () => {
    const brut = Array.from({ length: MAX_ANGAJATI + 5 }, (_, i) => `Om ${String(i)} | 4`).join(
      "\n",
    );
    const l = liniiAngajati(brut, 8);
    expect(l.angajati).toHaveLength(MAX_ANGAJATI);
    expect(l.angajati.every((a) => a.oreZi === 4)).toBe(true);
    expect(l.lista).toMatchObject({ total: MAX_ANGAJATI + 5, omisi: 5, scurtate: 0 });
    expect(l.lista.nume).toEqual(l.angajati.map((a) => a.nume));
    expect(notaOmisi(l.lista)).toContain("ceilalți 5 nu apar aici");
  });
});

describe("orele scrise de om", () => {
  it("oreDinText acceptă 4, 4h, 7,5, 7.25 și 6:30, refuză restul", () => {
    expect(oreDinText("4")).toBe(4);
    expect(oreDinText("4h")).toBe(4);
    expect(oreDinText("7,5")).toBe(7.5);
    expect(oreDinText("7.25")).toBe(7.25);
    expect(oreDinText("6:30")).toBe(6.5);
    for (const rau of ["0", "25", "8:75", "patru", "", "4 ore"]) expect(oreDinText(rau)).toBeNull();
  });

  it("oreScurt scrie orele întregi ca număr și restul ca ceas (oreFoaie fără „ h”)", () => {
    expect(oreScurt(8)).toBe("8");
    expect(oreScurt(7.5)).toBe("7:30");
    expect(oreScurt(10.5)).toBe("10:30");
  });
});

describe("pontajul din adresă", () => {
  it("citește programul, varianta, orele și antetul", () => {
    const p = parametriPontaj(
      new URLSearchParams({
        an: "2026",
        luna: "12",
        ore: "6",
        program: "ture",
        varianta: "individuala",
        firma: " Construct  SRL ",
        cui: "RO 14399840",
        angajati: "Popa Ion",
      }),
    );
    expect(p).toMatchObject({
      an: 2026,
      luna: 12,
      oreZi: 6,
      program: "ture",
      varianta: "individuala",
    });
    expect(p.antet.firma).toBe("Construct SRL");
    expect(p.linii.angajati).toEqual([{ nume: "Popa Ion", oreZi: 6 }]);
  });

  it("fără parametri: luna curentă, luni–vineri, colectivă", () => {
    const p = parametriPontaj(new URLSearchParams(), new Date(Date.UTC(2026, 9, 8)));
    expect(p).toMatchObject({ an: 2026, luna: 10, oreZi: 8, program: "lv", varianta: "colectiva" });
  });

  it("norma rămâne pe zilele de luni–vineri, oricare ar fi programul, rotunjită și scrisă în ceas", () => {
    for (const program of ["lv", "ls", "ture"]) {
      const pontaj = construiestePontaj(
        parametriPontaj(new URLSearchParams({ an: "2026", luna: "12", ore: "7.3", program })),
      );
      expect(pontaj.zileLucratoare).toBe(21);
    }
    const pontaj = construiestePontaj(
      parametriPontaj(new URLSearchParams({ an: "2026", luna: "12", ore: "7.3" })),
    );
    // Auditul: „153.29999999999998 h normă”. 7,3 h = 7:18; 21 × 7,3 = 153,3 h = 153:18.
    expect(rezumatNorma(pontaj)).toBe(
      "21 de zile lucrătoare × 7:18 h = 153:18 h normă · program luni–vineri",
    );
  });

  it("norma se înmulțește din ziua rotunjită la minut, ca în textul normei lui B", () => {
    // 7,33 h se afișează „7:20”; 21 × 7:20 = 154:00, nu 153:56 (af72ee0).
    const pontaj = construiestePontaj(
      parametriPontaj(new URLSearchParams({ an: "2026", luna: "12", ore: "7.33" })),
    );
    expect(rezumatNorma(pontaj)).toBe(
      "21 de zile lucrătoare × 7:20 h = 154 h normă · program luni–vineri",
    );
  });

  it("pontajul poartă nota de listă tăiată a lui B, doar când lista a fost tăiată", () => {
    const multi = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");
    const taiat = construiestePontaj(parametriPontaj(new URLSearchParams({ angajati: multi })));
    expect(taiat.notaAngajati).toBe(
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.",
    );
    const intreg = construiestePontaj(
      parametriPontaj(new URLSearchParams({ angajati: "Popa Ion" })),
    );
    expect(intreg.notaAngajati).toBeNull();
  });

  it("fișele individuale: fără nume, o singură fișă necompletată", () => {
    const pontaj = construiestePontaj(
      parametriPontaj(new URLSearchParams({ an: "2026", luna: "12", varianta: "individuala" })),
    );
    expect(angajatiPentruFise(pontaj)).toEqual([{ nume: "", oreZi: 8 }]);
    expect(numeFisierPontaj(pontaj)).toBe("fise-pontaj-2026-12");
  });

  it("numele fișierului colectiv rămâne cel de până acum", () => {
    const pontaj = construiestePontaj(
      parametriPontaj(new URLSearchParams({ an: "2026", luna: "3" })),
    );
    expect(numeFisierPontaj(pontaj)).toBe("pontaj-2026-03");
    expect(pontaj.eticheta).toBe("martie 2026");
  });
});
