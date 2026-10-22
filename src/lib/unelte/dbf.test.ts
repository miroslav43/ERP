// src/lib/unelte/dbf.test.ts
import { describe, expect, it } from "vitest";

import { CAMPURI_NC } from "@/domain/fleet/contabil/format-saga";

import { scrieDbf, type CampDbf, type ValoareDbf } from "./dbf";

/** Un cititor minimal, scris aici: reface câmpurile și rândurile din octeți. */
function citesteDbf(octeti: Uint8Array): {
  campuri: { nume: string; tip: string; lungime: number; zecimale: number }[];
  randuri: string[][];
} {
  const vedere = new DataView(octeti.buffer, octeti.byteOffset, octeti.byteLength);
  const numar = vedere.getUint32(4, true);
  const lungimeAntet = vedere.getUint16(8, true);
  const lungimeInregistrare = vedere.getUint16(10, true);
  const campuri: { nume: string; tip: string; lungime: number; zecimale: number }[] = [];
  for (let p = 32; octeti[p] !== 0x0d; p += 32) {
    const nume = String.fromCharCode(...octeti.slice(p, p + 11)).replace(/\0+$/u, "");
    campuri.push({
      nume,
      tip: String.fromCharCode(octeti[p + 11] ?? 0),
      lungime: octeti[p + 16] ?? 0,
      zecimale: octeti[p + 17] ?? 0,
    });
  }
  const randuri: string[][] = [];
  for (let r = 0; r < numar; r += 1) {
    let p = lungimeAntet + r * lungimeInregistrare;
    expect(octeti[p]).toBe(0x20);
    p += 1;
    const rand: string[] = [];
    for (const c of campuri) {
      rand.push(String.fromCharCode(...octeti.slice(p, p + c.lungime)));
      p += c.lungime;
    }
    randuri.push(rand);
  }
  return { campuri, randuri };
}

const RAND_NC: ValoareDbf[] = [
  "4521",
  "6022",
  "542",
  1234.5,
  null,
  0,
  0,
  "2026-10-03",
  "Combustibil B123ABC, bon 4521",
  null,
];

describe("scrieDbf — dBase III, cu cele zece câmpuri ale articolelor Saga", () => {
  const octeti = scrieDbf(CAMPURI_NC, [RAND_NC, RAND_NC], "2026-10-22");
  const vedere = new DataView(octeti.buffer);

  it("antetul: versiunea 0x03, data actualizării, numărul de rânduri și lungimile", () => {
    expect(octeti[0]).toBe(0x03);
    expect([octeti[1], octeti[2], octeti[3]]).toEqual([126, 10, 22]);
    expect(vedere.getUint32(4, true)).toBe(2);
    expect(vedere.getUint16(8, true)).toBe(32 + 32 * 10 + 1);
    // 16 + 20 + 20 + 15 + 3 + 15 + 14 + 8 + 48 + 16 = 175, plus octetul de ștergere.
    expect(vedere.getUint16(10, true)).toBe(176);
    expect(octeti[32 + 32 * 10]).toBe(0x0d);
    expect(octeti.length).toBe(353 + 2 * 176 + 1);
    expect(octeti[octeti.length - 1]).toBe(0x1a);
  });

  it("valorile: N15,2 aliniat la dreapta, D = AAAALLZZ, C completat cu spații, null = spații", () => {
    const { randuri } = citesteDbf(octeti);
    const [rand] = randuri;
    expect(rand?.[3]).toBe("        1234.50");
    expect(rand?.[7]).toBe("20261003");
    expect(rand?.[0]).toBe("4521            ");
    expect(rand?.[4]).toBe("   ");
    expect(rand?.[5]).toBe("         0.0000");
  });

  it("dus-întors: câmpurile și rândurile se refac din octeți", () => {
    const { campuri, randuri } = citesteDbf(octeti);
    expect(campuri.map((c) => [c.nume, c.tip, c.lungime, c.zecimale])).toEqual([
      ["NDP", "C", 16, 0],
      ["CONT_D", "C", 20, 0],
      ["CONT_C", "C", 20, 0],
      ["SUMA", "N", 15, 2],
      ["COD_VALUTA", "C", 3, 0],
      ["CURS", "N", 15, 4],
      ["SUMA_VAL", "N", 14, 2],
      ["DATA", "D", 8, 0],
      ["EXPLICATIE", "C", 48, 0],
      ["GRUPA", "C", 16, 0],
    ]);
    expect(randuri.map((r) => r.map((v) => v.trim()))).toEqual([
      [
        "4521",
        "6022",
        "542",
        "1234.50",
        "",
        "0.0000",
        "0.00",
        "20261003",
        "Combustibil B123ABC, bon 4521",
        "",
      ],
      [
        "4521",
        "6022",
        "542",
        "1234.50",
        "",
        "0.0000",
        "0.00",
        "20261003",
        "Combustibil B123ABC, bon 4521",
        "",
      ],
    ]);
  });
});

describe("scrieDbf — refuzurile, în loc să taie tăcut", () => {
  const C: CampDbf[] = [{ nume: "TEXT", tip: "C", lungime: 4 }];
  const N: CampDbf[] = [{ nume: "NR", tip: "N", lungime: 5, zecimale: 2 }];

  it("un text peste lungimea câmpului aruncă", () => {
    expect(() => scrieDbf(C, [["abcde"]], "2026-10-22")).toThrow(RangeError);
  });

  it("un caracter din afara ASCII tipăribil aruncă", () => {
    expect(() => scrieDbf(C, [["ș"]], "2026-10-22")).toThrow(RangeError);
    expect(() => scrieDbf(C, [["a\nb"]], "2026-10-22")).toThrow(RangeError);
  });

  it("un număr care nu încape aruncă", () => {
    expect(() => scrieDbf(N, [[1234.5]], "2026-10-22")).toThrow(RangeError);
    expect(scrieDbf(N, [[12.5]], "2026-10-22")).toBeInstanceOf(Uint8Array);
  });

  it("un rând cu alt număr de valori aruncă", () => {
    expect(() => scrieDbf(C, [["a", "b"]], "2026-10-22")).toThrow(RangeError);
  });

  it("o listă goală dă un fișier valid, fără înregistrări", () => {
    const octeti = scrieDbf(C, [], "2026-10-22");
    expect(octeti.length).toBe(32 + 32 + 1 + 1);
    expect(octeti[octeti.length - 1]).toBe(0x1a);
  });
});
