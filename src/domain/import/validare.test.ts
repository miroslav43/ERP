// src/domain/import/validare.test.ts
import { describe, expect, it } from "vitest";
import { areCnpCifraControlValida, esteIbanValid, valideazaRanduri } from "./validare";
import type { RandMapat } from "./mapare";

// CNP sintetic: construim cifra de control din primele 12 cifre alese arbitrar.
// Nu folosim CNP-uri reale nici în teste, nici în fixture-uri.
const PONDERI = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
function cnpSintetic(prefix12: string): string {
  const suma = [...prefix12].reduce((acc, c, i) => acc + Number(c) * (PONDERI[i] ?? 0), 0);
  const rest = suma % 11;
  return prefix12 + String(rest === 10 ? 1 : rest);
}
const CNP_VALID = cnpSintetic("190050112345"); // bărbat, 1990-05-01, județ 12

function rand(rand: number, valori: RandMapat["valori"]): RandMapat {
  return { rand, valori };
}
const BAZA = {
  marca: "A-001",
  nume_complet: "Popescu Ion Vasile",
  data_angajarii: "01.03.2024",
} as const;

describe("areCnpCifraControlValida", () => {
  it("acceptă un CNP sintetic corect și respinge unul cu cifra de control schimbată", () => {
    expect(areCnpCifraControlValida(CNP_VALID)).toBe(true);
    const gresit = CNP_VALID.slice(0, 12) + String((Number(CNP_VALID[12]) + 1) % 10);
    expect(areCnpCifraControlValida(gresit)).toBe(false);
    expect(areCnpCifraControlValida("12345")).toBe(false);
  });
});

describe("esteIbanValid", () => {
  it("validează mod-97 și lungimea pentru RO", () => {
    expect(esteIbanValid("RO49 AAAA 1B31 0075 9384 0000")).toBe(true);
    expect(esteIbanValid("RO50AAAA1B31007593840000")).toBe(false);
  });
});

describe("valideazaRanduri", () => {
  it("normalizează datele, sumele și numele complet", () => {
    const { valide, invalide } = valideazaRanduri([
      rand(2, {
        ...BAZA,
        salariu: "3.500,50",
        data_nasterii: "1990-05-01",
        cnp: CNP_VALID,
        gen: "M",
      }),
    ]);
    expect(invalide).toEqual([]);
    expect(valide[0]).toMatchObject({
      last_name: "Popescu",
      first_name: "Ion Vasile",
      hired_on: "2024-03-01",
      salariu: 3500.5,
      gen: "masculin",
    });
  });

  it("adună toate erorile rândului, nu se oprește la prima", () => {
    const { valide, invalide } = valideazaRanduri([
      rand(4, {
        nume_complet: "Ionescu Ana",
        data_angajarii: "31.02.2024",
        email: "ana(at)exemplu.ro",
        salariu: "trei mii",
      }),
    ]);
    expect(valide).toEqual([]);
    const campuri = invalide.map((e) => e.camp);
    // „Marcă" nu mai apare: din 0069 e opțională, iar când lipsește o atribuie
    // contorul organizației la inserție.
    expect(campuri).toEqual(
      expect.arrayContaining(["Data angajării", "E-mail personal", "Salariu de bază"]),
    );
    expect(campuri).not.toContain("Marcă");
    expect(invalide.every((e) => e.rand === 4)).toBe(true);
  });

  it("păstrează rândurile bune și le respinge doar pe cele stricate", () => {
    const { valide, invalide } = valideazaRanduri([
      rand(2, BAZA),
      rand(3, { marca: "A-002", nume_complet: "Marin Dan", data_angajarii: "ieri" }),
      rand(4, { marca: "A-003", nume_complet: "Radu Elena", data_angajarii: "15.04.2024" }),
    ]);
    expect(valide.map((a) => a.marca)).toEqual(["A-001", "A-003"]);
    expect(invalide).toHaveLength(1);
    expect(invalide[0]?.rand).toBe(3);
  });

  it("respinge marca duplicată din același fișier, indicând rândul anterior", () => {
    const { invalide } = valideazaRanduri([
      rand(2, BAZA),
      rand(3, { ...BAZA, nume_complet: "Alt Nume" }),
    ]);
    expect(invalide[0]?.mesaj).toContain("rândul 2");
  });

  it("semnalează nepotrivirea dintre CNP și data nașterii", () => {
    const { invalide } = valideazaRanduri([
      rand(2, { ...BAZA, cnp: CNP_VALID, data_nasterii: "02.05.1990" }),
    ]);
    expect(invalide[0]?.camp).toBe("Data nașterii");
  });
});

describe("marca opțională la import (0069)", () => {
  it("acceptă un rând fără marcă", () => {
    const { valide, invalide } = valideazaRanduri([
      rand(2, { marca: "", nume_complet: "Popescu Ana", data_angajarii: "01.03.2024" }),
    ]);
    expect(invalide.filter((e) => e.camp === "Marcă")).toEqual([]);
    expect(valide).toHaveLength(1);
    expect(valide[0]?.marca).toBeUndefined();
  });

  it("nu confundă două rânduri fără marcă cu un duplicat", () => {
    // Dedublarea privește doar mărcile SCRISE în fișier. Două goluri nu sunt
    // acelasi lucru cu două „0001".
    const { valide, invalide } = valideazaRanduri([
      rand(2, { marca: "", nume_complet: "Popescu Ana", data_angajarii: "01.03.2024" }),
      rand(3, { marca: "", nume_complet: "Ionescu Dan", data_angajarii: "01.03.2024" }),
    ]);
    expect(invalide).toEqual([]);
    expect(valide).toHaveLength(2);
  });

  it("păstrează dedublarea pentru mărcile scrise explicit", () => {
    const { invalide } = valideazaRanduri([
      rand(2, { marca: "A-1", nume_complet: "Popescu Ana", data_angajarii: "01.03.2024" }),
      rand(3, { marca: "a-1", nume_complet: "Ionescu Dan", data_angajarii: "01.03.2024" }),
    ]);
    expect(invalide.some((e) => e.camp === "Marcă")).toBe(true);
  });
});
