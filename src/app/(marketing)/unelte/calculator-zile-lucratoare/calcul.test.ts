// src/app/(marketing)/unelte/calculator-zile-lucratoare/calcul.test.ts
import { describe, expect, it } from "vitest";

import { calculeaza, citesteCalculul, titluRezultat } from "./calcul";
import { intrebariZileLucratoare } from "./intrebari";

const q = (s: string) => new URLSearchParams(s);
const AZI = "2026-10-08";

describe("citesteCalculul", () => {
  it("fără nimic: luna curentă, numărată între prima și ultima zi", () => {
    expect(citesteCalculul(q(""), AZI)).toEqual({
      mod: "interval",
      deLa: "2026-10-01",
      panaLa: "2026-10-31",
      zile: 20,
      probleme: [],
    });
  });

  it("februarie într-un an bisect se termină pe 29", () => {
    expect(citesteCalculul(q(""), "2028-02-10").panaLa).toBe("2028-02-29");
  });

  it("o dată greșită e spusă pe nume, nu înlocuită tăcut", () => {
    const c = citesteCalculul(q("de_la=2026-02-30&pana_la=2026-03-10"), AZI);
    expect(c.probleme).toEqual(["De la: „2026-02-30” nu e o zi reală între 2024 și 2035."]);
  });

  it("intervalul inversat e o problemă", () => {
    const c = citesteCalculul(q("de_la=2026-12-20&pana_la=2026-12-10"), AZI);
    expect(c.probleme).toEqual(["Data de sfârșit e înaintea celei de început."]);
  });

  it("modul „adaugă”: numărul de zile e citit și validat", () => {
    expect(citesteCalculul(q("mod=adauga&de_la=2026-10-08&zile=20"), AZI)).toMatchObject({
      mod: "adauga",
      deLa: "2026-10-08",
      zile: 20,
      probleme: [],
    });
    expect(citesteCalculul(q("mod=adauga&zile=abc"), AZI).probleme).toEqual([
      "Zile lucrătoare: „abc” nu e un număr întreg între 0 și 400.",
    ]);
    // În modul „între două date”, câmpul de zile nu contează.
    expect(citesteCalculul(q("zile=abc"), AZI).probleme).toEqual([]);
  });
});

describe("calculeaza", () => {
  it("intervalul: octombrie 2026 are 22 de zile lucrătoare", () => {
    const r = calculeaza(citesteCalculul(q(""), AZI));
    expect(r.mod).toBe("interval");
    if (r.mod !== "interval") return;
    expect(r.interval.zileLucratoare).toBe(22);
    expect(titluRezultat(r)).toBe("22 de zile lucrătoare");
  });

  it("intervalul doar cu sărbători: „nicio zi lucrătoare”", () => {
    const r = calculeaza(citesteCalculul(q("de_la=2026-11-30&pana_la=2026-12-01"), AZI));
    expect(titluRezultat(r)).toBe("nicio zi lucrătoare");
  });

  it("adaugă: a 20-a zi lucrătoare după 10 dec 2026 sare peste sărbători", () => {
    const r = calculeaza(citesteCalculul(q("mod=adauga&de_la=2026-12-10&zile=20"), AZI));
    expect(r).toMatchObject({ mod: "adauga", rezultat: "2027-01-13" });
    if (r.mod !== "adauga") return;
    expect(r.sarite.map((s) => s.data)).toEqual([
      "2026-12-25",
      "2027-01-01",
      "2027-01-06",
      "2027-01-07",
    ]);
    expect(titluRezultat(r)).toBe("miercuri, 13 ianuarie 2027");
  });

  it("un termen dincolo de 2035 e o eroare cu mesaj", () => {
    expect(() =>
      calculeaza(citesteCalculul(q("mod=adauga&de_la=2035-12-20&zile=20"), AZI)),
    ).toThrow(/2035/u);
  });
});

describe("întrebările paginii", () => {
  it("se termină cu „?”, răspunsurile cu punct, fără ș/ț cu sedilă", () => {
    for (const r of intrebariZileLucratoare(2026)) {
      expect(r.q).toMatch(/\?$/u);
      expect(r.a).toMatch(/\.$/u);
      expect(`${r.q}${r.a}`).not.toMatch(/[\u015E\u015F\u0162\u0163]/u);
    }
  });

  it("totalurile anuale vin din calendar, nu sunt scrise de mână", () => {
    const texte = intrebariZileLucratoare(2026)
      .map((r) => r.a)
      .join(" ");
    expect(texte).toContain("250 de zile lucrătoare");
    expect(texte).toContain("252 de zile lucrătoare");
  });
});
