import { describe, expect, it } from "vitest";

import {
  formatOraZi,
  formatOre,
  formatOreCuUnitate,
  mascheazaOraZi,
  normalizeazaOraZi,
  parseOre,
  plafoneazaMinutele,
} from "./ore";

describe("formatOre", () => {
  it("scrie jumătatea de oră ca 30 de minute, nu ca „,5”", () => {
    expect(formatOre(8.5)).toBe("8:30");
  });

  it("pune întotdeauna minutele, chiar și la o oră rotundă", () => {
    // „8 h” lângă „8:30 h” într-o coloană de tabel rupe alinierea și pare
    // altă unitate de măsură.
    expect(formatOre(8)).toBe("8:00");
    expect(formatOre(0)).toBe("0:00");
  });

  it("acoperă sferturile de oră", () => {
    expect(formatOre(7.75)).toBe("7:45");
    expect(formatOre(0.25)).toBe("0:15");
  });

  it("rotunjește la minut, nu la sutimea de oră", () => {
    // `oreleZilei` întoarce 8.17 pentru 08:00–16:10, prin `round(x * 100)/100`.
    expect(formatOre(8.17)).toBe("8:10");
    expect(formatOre(0.01)).toBe("0:01");
  });

  it("ține semnul în fața ceasului, nu pe fiecare parte", () => {
    expect(formatOre(-1.5)).toBe("\u22121:30");
  });

  it("grupează miile, fiindcă totalurile anuale trec de 1000 de ore", () => {
    expect(formatOre(1198.5)).toBe("1.198:30");
  });

  it("renunță la grupare când valoarea trebuie să se poată tasta la loc", () => {
    expect(formatOre(1198.5, { grupeaza: false })).toBe("1198:30");
    expect(parseOre(formatOre(1198.5, { grupeaza: false }))).toBe(1198.5);
  });

  it("acceptă șirul cu care `numeric` sosește din Postgres", () => {
    expect(formatOre("8.50")).toBe("8:30");
  });

  it("respinge o valoare care nu e un număr", () => {
    expect(() => formatOre("nu-e-o-durată")).toThrow(TypeError);
  });
});

describe("formatOreCuUnitate", () => {
  it("lipește unitatea scurtă", () => {
    expect(formatOreCuUnitate(8.5)).toBe("8:30 h");
  });
});

describe("formatOraZi", () => {
  it("taie secundele cu care sosește o coloană `time`", () => {
    expect(formatOraZi("08:30:00")).toBe("08:30");
  });

  it("completează ora la două cifre", () => {
    expect(formatOraZi("8:30")).toBe("08:30");
  });

  it("păstrează ora de după-amiază pe 24 de ore", () => {
    expect(formatOraZi("17:30:00")).toBe("17:30");
    expect(formatOraZi("23:59")).toBe("23:59");
  });

  it("întoarce null pentru lipsă sau format invalid, în loc să arunce", () => {
    expect(formatOraZi(null)).toBeNull();
    expect(formatOraZi("")).toBeNull();
    expect(formatOraZi("24:00")).toBeNull();
    expect(formatOraZi("5:30 PM")).toBeNull();
  });
});

describe("parseOre", () => {
  it("citește ceasul înapoi în zecimale, pentru bază", () => {
    expect(parseOre("8:30")).toBe(8.5);
    expect(parseOre("08:30")).toBe(8.5);
    expect(parseOre("7:45")).toBe(7.75);
  });

  it("acceptă ora rotundă fără minute", () => {
    expect(parseOre("8")).toBe(8);
  });

  it("acceptă și scrierea cu h, cum o tastează oamenii", () => {
    expect(parseOre("8h30")).toBe(8.5);
    expect(parseOre("8 h 30")).toBe(8.5);
  });

  it("RESPINGE zecimalele — altfel convenția veche supraviețuiește în date", () => {
    expect(parseOre("8,5")).toBeNull();
    expect(parseOre("8.5")).toBeNull();
  });

  it("respinge minutele peste 59 și intrarea goală", () => {
    expect(parseOre("8:60")).toBeNull();
    expect(parseOre("   ")).toBeNull();
    expect(parseOre("PM")).toBeNull();
  });

  it("închide bucla cu formatOre", () => {
    for (const zecimal of [0, 0.25, 7.75, 8, 8.5, 12.1]) {
      expect(parseOre(formatOre(zecimal, { grupeaza: false }))).toBeCloseTo(zecimal, 2);
    }
  });
});

describe("mascheazaOraZi", () => {
  it("închide ora din prima tastă când n-are cum să continue", () => {
    // O oră de două cifre începe doar cu 0, 1 sau 2 — deci `8` e deja ora opt.
    expect(mascheazaOraZi("8")).toBe("08:");
    expect(mascheazaOraZi("83")).toBe("08:3");
    expect(mascheazaOraZi("830")).toBe("08:30");
  });

  it("așteaptă a doua cifră când ora ar putea avea două", () => {
    expect(mascheazaOraZi("1")).toBe("1");
    expect(mascheazaOraZi("17")).toBe("17:");
    expect(mascheazaOraZi("1730")).toBe("17:30");
    expect(mascheazaOraZi("0830")).toBe("08:30");
  });

  it("se răzgândește când a doua cifră duce peste 23", () => {
    // `2` apoi `5`: nu există ora 25, deci `2` era ora și `5` e minutul.
    expect(mascheazaOraZi("25")).toBe("02:5");
    expect(mascheazaOraZi("259")).toBe("02:59");
    expect(mascheazaOraZi("23")).toBe("23:");
  });

  it("acoperă capetele: miezul nopții și ultimul minut", () => {
    expect(mascheazaOraZi("00")).toBe("00:");
    expect(mascheazaOraZi("2359")).toBe("23:59");
  });

  it("nu corectează minutul — corectura e treaba câmpului, la predare", () => {
    // Masca arată exact ce s-a tastat, iar validatorul îl respinge. Plafonarea
    // la `17:59` se face în `plafoneazaMinutele`, chemată de `IntrareOra` când
    // ora se închide — două roluri, nu unul care face tăcut amândouă.
    expect(mascheazaOraZi("1775")).toBe("17:75");
    expect(normalizeazaOraZi("17:75")).toBeNull();
  });

  it("ignoră ce nu e cifră, inclusiv două punctele tastate de mână", () => {
    expect(mascheazaOraZi("17:30")).toBe("17:30");
    expect(mascheazaOraZi("5:30 PM")).toBe("05:30");
    expect(mascheazaOraZi("")).toBe("");
  });
});

describe("normalizeazaOraZi", () => {
  it("completează ora rotundă tastată din două cifre", () => {
    expect(normalizeazaOraZi("8")).toBe("08:00");
    expect(normalizeazaOraZi("17")).toBe("17:00");
  });

  it("citește ora tastată fără două puncte", () => {
    expect(normalizeazaOraZi("830")).toBe("08:30");
    expect(normalizeazaOraZi("1730")).toBe("17:30");
  });

  it("acceptă secundele cu care o coloană `time` ajunge în câmp", () => {
    expect(normalizeazaOraZi("08:30:00")).toBe("08:30");
  });

  it("citește ora lăsată de mască fără minute ca oră întreagă", () => {
    // Cine scrie `8` și trece la câmpul următor lasă în urmă `"08:"`.
    expect(normalizeazaOraZi("08:")).toBe("08:00");
    expect(normalizeazaOraZi("17:")).toBe("17:00");
  });

  it("completează minutele scrise cu o cifră", () => {
    expect(normalizeazaOraZi("17:5")).toBe("17:05");
    expect(normalizeazaOraZi("8:30")).toBe("08:30");
  });

  it("respinge ce nu e o oră de pe un ceas de 24", () => {
    expect(normalizeazaOraZi("24:00")).toBeNull();
    expect(normalizeazaOraZi("8:75")).toBeNull();
    expect(normalizeazaOraZi("5:30 PM")).toBeNull();
    expect(normalizeazaOraZi("")).toBeNull();
  });
});

describe("plafoneazaMinutele", () => {
  it("aduce minutul peste 59 la ultimul minut al aceleiași ore", () => {
    expect(plafoneazaMinutele("17:75")).toBe("17:59");
    expect(plafoneazaMinutele("8:99")).toBe("08:59");
    expect(plafoneazaMinutele("0:60")).toBe("00:59");
  });

  it("citește și forma fără două puncte, ca masca", () => {
    // `preda` primește textul mascat, dar funcția trebuie să despartă la fel ca
    // `normalizeazaOraZi` — altfel două ecrane ar citi altfel același șir.
    expect(plafoneazaMinutele("1775")).toBe("17:59");
    expect(plafoneazaMinutele("875")).toBe("08:59");
  });

  it("lasă neatinsă ora care era deja bună", () => {
    expect(plafoneazaMinutele("17:59")).toBe("17:59");
    expect(plafoneazaMinutele("08:30")).toBe("08:30");
    expect(plafoneazaMinutele("17:")).toBe("17:00");
    expect(plafoneazaMinutele("8")).toBe("08:00");
  });

  it("NU plafonează ora — `25:30` ar deveni `23:30`, adică alt moment din zi", () => {
    expect(plafoneazaMinutele("25:30")).toBeNull();
    expect(plafoneazaMinutele("24:00")).toBeNull();
  });

  it("respinge ce nu e nici măcar o încercare de oră", () => {
    expect(plafoneazaMinutele("5:30 PM")).toBeNull();
    expect(plafoneazaMinutele("abc")).toBeNull();
    expect(plafoneazaMinutele("")).toBeNull();
  });
});
