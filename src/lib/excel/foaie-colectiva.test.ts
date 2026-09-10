// src/lib/excel/foaie-colectiva.test.ts
//
// Testele părții pure a generatorului de foaie colectivă. Nu se atinge ExcelJS:
// ce contează aici e ce AJUNGE în celule, nu cum arată ele.
//
// Instantaneul de mai jos e scris de mână, ca ieșirea lui
// `internal.pontaj_instantaneu_luna` — inclusiv orele venite ca șiruri, cum le
// dă `jsonb` peste `numeric(5,2)` prin driverul PostgREST în unele versiuni. De
// aceea schema folosește `z.coerce.number()`: fără el, un „8.00" ar fi trecut
// prin `parse` și ar fi ajuns text într-o coloană de ore, unde nu se însumează.
import { describe, expect, it } from "vitest";

import {
  celulaZi,
  citesteInstantaneu,
  construiesteFoaie,
  etichetaLuna,
  numeFisierArhiva,
  numeLuna,
} from "./foaie-colectiva";

const instantaneu = {
  versiune_format: 1,
  firma: {
    denumire: "Șantier Construcții",
    denumire_legala: "Șantier Construcții SRL",
    cui: "RO12345678",
    reg_com: "J40/1234/2020",
  },
  perioada: { an: 2026, luna: 8, zile_in_luna: 31 },
  angajati: [
    {
      marca: "001",
      nume: "Popescu Ștefăniță",
      functie: "Zidar",
      departament: "Producție",
      zile: [
        {
          z: 3,
          t: "lucratoare",
          i: "08:00",
          s: "16:30",
          o: "8.00",
          sup: "0.00",
          n: "0.00",
          obs: null,
        },
        {
          z: 4,
          t: "lucratoare",
          i: "08:00",
          s: "18:00",
          o: "9.50",
          sup: "1.50",
          n: "0.00",
          obs: "prelungit",
        },
        { z: 8, t: "weekend", i: null, s: null, o: "0.00", sup: "0.00", n: "0.00", obs: null },
        { z: 11, t: "concediu", i: null, s: null, o: "0.00", sup: "0.00", n: "0.00", obs: null },
        { z: 12, t: "lucratoare", i: null, s: null, o: "0.00", sup: "0.00", n: "0.00", obs: null },
      ],
      total: { ore: "17.50", sup: "1.50", noapte: "0.00", zile_lucrate: 2 },
    },
  ],
  total_general: { angajati: 1, ore: "17.50", sup: "1.50", noapte: "0.00" },
};

describe("citesteInstantaneu", () => {
  it("acceptă forma scrisă de migrarea 0134, cu ore ca șiruri", () => {
    const inst = citesteInstantaneu(instantaneu);
    expect(inst.angajati[0]?.total.ore).toBe(17.5);
    expect(typeof inst.angajati[0]?.total.ore).toBe("number");
  });

  it("păstrează diacriticele cu virgulă dedesubt", () => {
    const inst = citesteInstantaneu(instantaneu);
    expect(inst.angajati[0]?.nume).toBe("Popescu Ștefăniță");
    expect(inst.firma.denumire_legala).toContain("Șantier");
  });

  it("refuză un format mai nou decât știe codul", () => {
    expect(() => citesteInstantaneu({ ...instantaneu, versiune_format: 2 })).toThrow(/formatul 2/);
  });

  it("refuză un instantaneu fără angajați ca listă", () => {
    expect(() => citesteInstantaneu({ ...instantaneu, angajati: "niciunul" })).toThrow();
  });

  it("acceptă o lună fără niciun angajat", () => {
    const gol = {
      ...instantaneu,
      angajati: [],
      total_general: { angajati: 0, ore: 0, sup: 0, noapte: 0 },
    };
    expect(citesteInstantaneu(gol).angajati).toHaveLength(0);
  });
});

describe("celulaZi", () => {
  it("scrie cifra când s-au lucrat ore", () => {
    expect(celulaZi({ t: "lucratoare", o: 8 })).toBe(8);
    expect(celulaZi({ t: "sarbatoare", o: 4 })).toBe(4);
  });

  it("scrie codul consacrat când nu s-au lucrat ore", () => {
    expect(celulaZi({ t: "weekend", o: 0 })).toBe("L");
    expect(celulaZi({ t: "concediu", o: 0 })).toBe("CO");
    expect(celulaZi({ t: "medical", o: 0 })).toBe("CM");
    expect(celulaZi({ t: "absenta_nemotivata", o: 0 })).toBe("AN");
  });

  it("distinge ziua lucrătoare cu zero ore de ziua fără intrare", () => {
    // „0" înseamnă zi ÎNREGISTRATĂ cu zero ore. Ziua fără nicio intrare rămâne
    // goală, iar diferența se vede în `construiesteFoaie`, nu aici.
    expect(celulaZi({ t: "lucratoare", o: 0 })).toBe("0");
  });

  it("nu tace pe un tip de zi necunoscut", () => {
    expect(celulaZi({ t: "inventat", o: 0 })).toBe("?");
  });
});

describe("construiesteFoaie", () => {
  const foaie = construiesteFoaie(citesteInstantaneu(instantaneu));

  it("dă o coloană pentru fiecare zi din lună", () => {
    expect(foaie.zile).toHaveLength(31);
    expect(foaie.randuri[0]?.celule).toHaveLength(31);
  });

  it("lasă goale zilele fără nicio intrare", () => {
    // 1 și 2 august n-au rând în instantaneu; 3 are.
    expect(foaie.randuri[0]?.celule[0]).toBeNull();
    expect(foaie.randuri[0]?.celule[1]).toBeNull();
    expect(foaie.randuri[0]?.celule[2]).toBe(8);
  });

  it("pune codul pe zilele fără ore și cifra pe cele cu ore", () => {
    expect(foaie.randuri[0]?.celule[3]).toBe(9.5); // 4 august
    expect(foaie.randuri[0]?.celule[7]).toBe("L"); // 8 august, weekend
    expect(foaie.randuri[0]?.celule[10]).toBe("CO"); // 11 august, concediu
    expect(foaie.randuri[0]?.celule[11]).toBe("0"); // 12 august, lucrătoare cu 0 ore
  });

  it("duce totalurile din instantaneu, fără să le recalculeze", () => {
    expect(foaie.randuri[0]?.totalOre).toBe(17.5);
    expect(foaie.randuri[0]?.totalSuplimentare).toBe(1.5);
    expect(foaie.totalOre).toBe(17.5);
  });

  it("scrie titlul cu numele lunii în română", () => {
    expect(foaie.titlu).toBe("Foaie colectivă de prezență — august 2026");
    expect(foaie.eticheta).toBe("08.2026");
  });

  it("respectă lungimea lunilor scurte", () => {
    const februarie = construiesteFoaie(
      citesteInstantaneu({
        ...instantaneu,
        perioada: { an: 2025, luna: 2, zile_in_luna: 28 },
      }),
    );
    expect(februarie.zile).toHaveLength(28);
    expect(februarie.randuri[0]?.celule).toHaveLength(28);
  });

  it("nu cade pe o lună fără angajați", () => {
    const gol = construiesteFoaie(
      citesteInstantaneu({
        ...instantaneu,
        angajati: [],
        total_general: { angajati: 0, ore: 0, sup: 0, noapte: 0 },
      }),
    );
    expect(gol.randuri).toHaveLength(0);
    expect(gol.totalOre).toBe(0);
  });
});

describe("etichete și nume de fișier", () => {
  it("completează luna cu zero în față", () => {
    expect(etichetaLuna(2026, 3)).toBe("03.2026");
    expect(numeFisierArhiva(2026, 3)).toBe("foaie-colectiva-2026-03.xlsx");
  });

  it("dă numele lunii în română", () => {
    expect(numeLuna(1)).toBe("ianuarie");
    expect(numeLuna(12)).toBe("decembrie");
  });
});
