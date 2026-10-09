import { describe, expect, it } from "vitest";

import {
  avizePonderi,
  calculeazaGrila,
  calificativPentru,
  citesteNota,
  citestePondere,
  citestePraguri,
  citesteSutimi,
  formateazaSutimi,
  PRAGURI_IMPLICITE,
  ponderiEgale,
  SCALA_NOTE,
} from "./calcul";

/**
 * Auditul din 8 oct 2026: pagina promitea „pondere și notă pe fiecare”, dar
 * nimic nu se putea introduce și nimic nu se calcula, nici măcar în Excel.
 * Calculul stă aici, pur, ca să-l folosească la fel documentul și grila.
 */
describe("citirea ponderilor și a notelor", () => {
  it("ponderea: întreg de la 1 la 100, cu sau fără %", () => {
    expect(citestePondere("20")).toBe(20);
    expect(citestePondere(" 20 % ")).toBe(20);
    expect(citestePondere("100")).toBe(100);
    for (const gresit of ["", "0", "101", "150", "12,5", "2e1", "-5", "abc", "1000"]) {
      expect(citestePondere(gresit), gresit).toBeNull();
    }
  });

  it("nota: întreg de la 1 la 5", () => {
    expect(citesteNota("4")).toBe(4);
    expect(citesteNota(" 1 ")).toBe(1);
    for (const gresit of ["", "0", "6", "7", "3.5", "3,456", "x"]) {
      expect(citesteNota(gresit), gresit).toBeNull();
    }
  });

  it("sutimile: virgulă sau punct, între 1,00 și 5,00", () => {
    expect(citesteSutimi("4,5")).toBe(450);
    expect(citesteSutimi("4.50")).toBe(450);
    expect(citesteSutimi("3")).toBe(300);
    expect(citesteSutimi("2,05")).toBe(205);
    for (const gresit of ["0,99", "5,01", "6", "4,555", "", "patru"]) {
      expect(citesteSutimi(gresit), gresit).toBeNull();
    }
  });
});

describe("pragurile calificativelor", () => {
  it("fără câmpuri, implicitele, fără aviz", () => {
    expect(citestePraguri(null, null, "")).toEqual({
      praguri: PRAGURI_IMPLICITE,
      corectate: false,
    });
  });

  it("un prag schimbat păstrează implicitele celorlalte", () => {
    expect(citestePraguri("4,75", null, null)).toEqual({
      praguri: { foarteBine: 475, bine: 350, satisfacator: 250 },
      corectate: false,
    });
  });

  it("praguri care nu descresc cad pe implicite, cu aviz", () => {
    expect(citestePraguri("3", "4", "2")).toEqual({ praguri: PRAGURI_IMPLICITE, corectate: true });
    expect(citestePraguri("4,5", "3,5", "1")).toEqual({
      praguri: PRAGURI_IMPLICITE,
      corectate: true,
    });
    expect(citestePraguri("nouă", null, null).corectate).toBe(true);
  });

  it("calificativul se ia de la prag în sus, inclusiv pragul", () => {
    expect(calificativPentru(450, PRAGURI_IMPLICITE)).toBe("Foarte bine");
    expect(calificativPentru(449, PRAGURI_IMPLICITE)).toBe("Bine");
    expect(calificativPentru(350, PRAGURI_IMPLICITE)).toBe("Bine");
    expect(calificativPentru(250, PRAGURI_IMPLICITE)).toBe("Satisfăcător");
    expect(calificativPentru(249, PRAGURI_IMPLICITE)).toBe("Nesatisfăcător");
    expect(calificativPentru(100, PRAGURI_IMPLICITE)).toBe("Nesatisfăcător");
  });
});

describe("ponderile egale", () => {
  it("fac mereu 100, cu diferență de cel mult 1", () => {
    for (let n = 1; n <= 15; n += 1) {
      const p = ponderiEgale(n);
      expect(p, String(n)).toHaveLength(n);
      expect(
        p.reduce((s, x) => s + x, 0),
        String(n),
      ).toBe(100);
      expect(Math.max(...p) - Math.min(...p), String(n)).toBeLessThanOrEqual(1);
    }
    expect(ponderiEgale(6)).toEqual([17, 17, 17, 17, 16, 16]);
    expect(ponderiEgale(0)).toEqual([]);
  });
});

describe("grila", () => {
  const NOTATA = [
    { pondere: 20, nota: 4 },
    { pondere: 20, nota: 5 },
    { pondere: 15, nota: 3 },
    { pondere: 15, nota: 4 },
    { pondere: 15, nota: 3 },
    { pondere: 15, nota: 4 },
  ];

  it("nota finală e suma punctajelor, exactă la sutime", () => {
    const r = calculeazaGrila(NOTATA, PRAGURI_IMPLICITE);
    expect(r.punctaje).toEqual([80, 100, 45, 60, 45, 60]);
    expect(r.sumaPonderi).toBe(100);
    expect(r.notaFinala).toBe(390);
    expect(formateazaSutimi(r.notaFinala ?? 0)).toBe("3,90");
    expect(r.calificativ).toBe("Bine");
    expect(avizePonderi(r)).toEqual([]);
  });

  it("ponderi care nu fac 100: fără notă finală, cu aviz și suma", () => {
    const r = calculeazaGrila(
      NOTATA.map((x, i) => (i === 0 ? { ...x, pondere: 10 } : x)),
      PRAGURI_IMPLICITE,
    );
    expect(r.sumaPonderi).toBe(90);
    expect(r.notaFinala).toBeNull();
    expect(r.calificativ).toBeNull();
    expect(avizePonderi(r)).toEqual([
      "Ponderile însumează 90%, nu 100%: nota finală nu se poate calcula.",
    ]);
  });

  it("o pondere lipsă se spune, la singular și la plural", () => {
    const una = calculeazaGrila([{ pondere: null, nota: 3 }, ...NOTATA], PRAGURI_IMPLICITE);
    expect(avizePonderi(una)).toEqual([
      "Lipsește ponderea la un criteriu: nota finală nu se poate calcula.",
    ]);
    const doua = calculeazaGrila(
      [{ pondere: null, nota: 3 }, { pondere: null, nota: null }, ...NOTATA],
      PRAGURI_IMPLICITE,
    );
    expect(avizePonderi(doua)[0]).toMatch(/^Lipsește ponderea la 2 criterii:/u);
  });

  it("fișa pentru notat de mână: ponderi fără note, fără aviz, fără notă finală", () => {
    const r = calculeazaGrila(
      NOTATA.map((x) => ({ ...x, nota: null })),
      PRAGURI_IMPLICITE,
    );
    expect(r.faraNota).toBe(6);
    expect(r.punctaje.every((p) => p === null)).toBe(true);
    expect(r.notaFinala).toBeNull();
    expect(avizePonderi(r)).toEqual([]);
  });

  it("extremele scalei dau 1,00 și 5,00", () => {
    const toate = (nota: number) =>
      calculeazaGrila(
        ponderiEgale(7).map((pondere) => ({ pondere, nota })),
        PRAGURI_IMPLICITE,
      ).notaFinala;
    expect(toate(1)).toBe(100);
    expect(toate(5)).toBe(500);
  });

  it("scala are cinci trepte, de la 1 la 5", () => {
    expect(SCALA_NOTE.map((s) => s.nota)).toEqual([1, 2, 3, 4, 5]);
  });
});
