// src/domain/evaluations/scor.test.ts
import { describe, expect, it } from "vitest";

import type { CriteriuSablon } from "./criterii";
import {
  aliniazaRaspunsuri,
  calculeazaScor,
  mediaProcentelor,
  noteInAfaraScalei,
  type RaspunsCriteriu,
} from "./scor";

const c = (cod: string, extra: Partial<CriteriuSablon> = {}): CriteriuSablon => ({
  cod,
  denumire: cod,
  descriere: null,
  tip: "scala",
  scala_max: 5,
  pondere: null,
  ...extra,
});

const r = (criteriu_cod: string, scor: number | null): RaspunsCriteriu => ({
  criteriu_cod,
  scor,
  raspuns_text: null,
  comentariu: null,
});

describe("calculeazaScor — fără ponderi", () => {
  it("adună punctele brute și raportează procentul", () => {
    const p = calculeazaScor([c("a"), c("b")], [r("a", 4), r("b", 3)]);
    expect(p.punctaj).toBe(7);
    expect(p.din).toBe(10);
    expect(p.procent).toBe(70);
    expect(p.ponderat).toBe(false);
  });

  it("scalele diferite cântăresc diferit, ca la o notă din 10 față de una din 5", () => {
    const p = calculeazaScor([c("a"), c("b", { scala_max: 10 })], [r("a", 5), r("b", 5)]);
    expect(p.din).toBe(15);
    expect(p.punctaj).toBe(10);
  });
});

describe("calculeazaScor — criteriul necompletat NU e zero", () => {
  it("scoate din numitor criteriile fără notă", () => {
    // Defectul vechi: `scor ?? 0` pe toate criteriile șablonului dădea 4/10 = 40 %.
    const p = calculeazaScor([c("a"), c("b")], [r("a", 4), r("b", null)]);
    expect(p.punctaj).toBe(4);
    expect(p.din).toBe(5);
    expect(p.procent).toBe(80);
    expect(p.completate).toBe(1);
    expect(p.necompletate).toBe(1);
  });

  it("tratează un răspuns absent din listă la fel ca unul cu scor null", () => {
    const p = calculeazaScor([c("a"), c("b")], [r("a", 4)]);
    expect(p.necompletate).toBe(1);
    expect(p.procent).toBe(80);
  });

  it("un zero notat explicit rămâne zero, nu se confundă cu necompletatul", () => {
    const p = calculeazaScor([c("a")], [r("a", 0)]);
    expect(p.completate).toBe(1);
    expect(p.necompletate).toBe(0);
    expect(p.procent).toBe(0);
  });

  it("procentul unei ciorne goale e null, nu zero", () => {
    const p = calculeazaScor([c("a"), c("b")], []);
    expect(p.procent).toBeNull();
    expect(p.necompletate).toBe(2);
  });
});

describe("calculeazaScor — cu ponderi", () => {
  it("cântărește fiecare criteriu cu ponderea lui, nu cu scala lui", () => {
    // Nota maximă pe criteriul de 20 % contează mai puțin decât jumătate din
    // cel de 80 %, deși scalele sunt identice.
    const p = calculeazaScor(
      [c("greu", { pondere: 80 }), c("usor", { pondere: 20 })],
      [r("greu", 5), r("usor", 0)],
    );
    expect(p.ponderat).toBe(true);
    expect(p.punctaj).toBe(80);
    expect(p.din).toBe(100);
    expect(p.procent).toBe(80);
  });

  it("normalizează peste ponderile completate, nu peste toate", () => {
    const p = calculeazaScor(
      [c("a", { pondere: 50 }), c("b", { pondere: 50 })],
      [r("a", 5), r("b", null)],
    );
    // 50 din 50 posibile pe ce s-a completat, nu 50 din 100.
    expect(p.din).toBe(50);
    expect(p.procent).toBe(100);
    expect(p.necompletate).toBe(1);
  });

  it("scala nu deformează ponderea: un 5 din 10 dă jumătate din greutate", () => {
    const p = calculeazaScor([c("a", { pondere: 100, scala_max: 10 })], [r("a", 5)]);
    expect(p.procent).toBe(50);
  });
});

describe("calculeazaScor — tipuri și date stricate", () => {
  it("criteriile de tip text nu intră în niciun numitor", () => {
    const p = calculeazaScor(
      [c("a"), c("obs", { tip: "text", scala_max: 0 })],
      [
        r("a", 5),
        { criteriu_cod: "obs", scor: null, raspuns_text: "merge bine", comentariu: null },
      ],
    );
    expect(p.din).toBe(5);
    expect(p.completate).toBe(1);
    expect(p.necompletate).toBe(0);
  });

  it("`da_nu` se punctează pe scala 1", () => {
    const p = calculeazaScor(
      [c("da", { tip: "da_nu", scala_max: 1 }), c("nu", { tip: "da_nu", scala_max: 1 })],
      [r("da", 1), r("nu", 0)],
    );
    expect(p.punctaj).toBe(1);
    expect(p.din).toBe(2);
    expect(p.procent).toBe(50);
  });

  it("un șablon numai din criterii text nu are procent", () => {
    expect(calculeazaScor([c("obs", { tip: "text", scala_max: 0 })], []).procent).toBeNull();
  });

  it("plafonează un scor mai mare decât scala în loc să arunce", () => {
    // Cazul real: scala șablonului a scăzut de la 10 la 5 după ce nota a fost dată.
    const p = calculeazaScor([c("a", { scala_max: 5 })], [r("a", 9)]);
    expect(p.punctaj).toBe(5);
    expect(p.procent).toBe(100);
  });

  it("ignoră un scor negativ și unul nefinit", () => {
    expect(calculeazaScor([c("a")], [r("a", -3)]).punctaj).toBe(0);
    expect(calculeazaScor([c("a")], [r("a", Number.NaN)]).necompletate).toBe(1);
  });

  it("la coduri duplicate în jsonb câștigă ultimul răspuns", () => {
    const p = calculeazaScor([c("a")], [r("a", 1), r("a", 5)]);
    expect(p.punctaj).toBe(5);
  });

  it("rotunjește procentul la o zecimală, fără zgomot de virgulă mobilă", () => {
    const p = calculeazaScor([c("a"), c("b"), c("c")], [r("a", 5), r("b", 5), r("c", 4)]);
    expect(p.procent).toBe(93.3);
  });
});

describe("mediaProcentelor", () => {
  it("mediază numai evaluările care au procent", () => {
    expect(mediaProcentelor([80, null, 100])).toBe(90);
  });

  it("întoarce null când nu e nimic de mediat, niciodată zero", () => {
    expect(mediaProcentelor([])).toBeNull();
    expect(mediaProcentelor([null, null])).toBeNull();
  });
});

describe("aliniazaRaspunsuri", () => {
  it("reconstruiește lista din criterii, în ordinea șablonului", () => {
    const aliniate = aliniazaRaspunsuri([c("a"), c("b")], [r("b", 3), r("a", 5)]);
    expect(aliniate.map((x) => x.criteriu_cod)).toStrictEqual(["a", "b"]);
    expect(aliniate[0]?.scor).toBe(5);
  });

  it("pune null pe criteriile fără răspuns, nu le omite", () => {
    const aliniate = aliniazaRaspunsuri([c("a"), c("b")], [r("a", 4)]);
    expect(aliniate).toHaveLength(2);
    expect(aliniate[1]).toStrictEqual({
      criteriu_cod: "b",
      scor: null,
      raspuns_text: null,
      comentariu: null,
    });
  });

  it("aruncă codurile care nu există în șablon", () => {
    // Cazul real: șablonul s-a editat între deschiderea formularului și trimitere.
    const aliniate = aliniazaRaspunsuri([c("a")], [r("a", 3), r("criteriu_sters", 5)]);
    expect(aliniate).toHaveLength(1);
    expect(aliniate[0]?.criteriu_cod).toBe("a");
  });

  it("criteriul text păstrează textul și nu primește scor", () => {
    const aliniate = aliniazaRaspunsuri(
      [c("obs", { tip: "text", scala_max: 0 })],
      [{ criteriu_cod: "obs", scor: 4, raspuns_text: "de acord", comentariu: null }],
    );
    expect(aliniate[0]?.scor).toBeNull();
    expect(aliniate[0]?.raspuns_text).toBe("de acord");
  });

  it("criteriul de scală nu păstrează text parazit", () => {
    const aliniate = aliniazaRaspunsuri(
      [c("a")],
      [{ criteriu_cod: "a", scor: 3, raspuns_text: "ceva", comentariu: "notă" }],
    );
    expect(aliniate[0]?.raspuns_text).toBeNull();
    expect(aliniate[0]?.comentariu).toBe("notă");
  });
});

describe("noteInAfaraScalei", () => {
  it("raportează nota peste maximul scalei, cu denumirea criteriului", () => {
    expect(
      noteInAfaraScalei([c("a", { denumire: "Calitate", scala_max: 5 })], [r("a", 8)]),
    ).toStrictEqual(["Calitate"]);
  });

  it("nu se plânge de necompletat sau de coduri necunoscute", () => {
    expect(noteInAfaraScalei([c("a")], [r("a", null), r("altul", 99)])).toStrictEqual([]);
  });

  it("acceptă exact maximul", () => {
    expect(noteInAfaraScalei([c("a", { scala_max: 5 })], [r("a", 5)])).toStrictEqual([]);
  });
});
