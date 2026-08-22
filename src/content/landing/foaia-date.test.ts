import { describe, expect, it } from "vitest";

import { sarbatoriAnului } from "@/domain/calendar/sarbatori";
import type { Database } from "@/types/database";

import {
  AN_FOAIE,
  FOAIA,
  LUNA_FOAIE,
  NORMA_LUNARA,
  ORE_NORMA_ZI,
  COD_ZI,
  formateazaOre,
  type TipZiFoaie,
} from "./foaia-date";

/**
 * Verificare la COMPILARE: codurile de pe landing sunt exact enum-ul
 * `attendance_day_type` din bază, nici unul în plus, nici unul în minus. Dacă
 * cineva adaugă un al optulea tip de zi în migrare fără să atingă pagina — sau
 * inventează un cod pentru pagină — `tsc` cade înainte de orice test.
 */
type TipBaza = Database["public"]["Enums"]["attendance_day_type"];
const _paginaEsteInBaza: TipZiFoaie extends TipBaza ? true : false = true;
const _bazaEsteInPagina: TipBaza extends TipZiFoaie ? true : false = true;
void _paginaEsteInBaza;
void _bazaEsteInPagina;

describe("foaia din hero se închide", () => {
  it("suma pe rânduri, suma pe coloane și totalul general sunt același număr", () => {
    const peRanduri = FOAIA.randuri.reduce((s, r) => s + r.ore, 0);
    const peColoane = FOAIA.totaluriPeZi.reduce((s, o) => s + o, 0);

    expect(peRanduri).toBe(peColoane);
    expect(peRanduri).toBe(FOAIA.total);
    // Cifra afișată ca monument. Dacă se schimbă o celulă, se schimbă și asta —
    // exact rostul testului: nimeni nu poate edita foaia pe tăcute.
    expect(FOAIA.total).toBe(1198.5);
  });

  it("afișează totalul în forma românească", () => {
    expect(formateazaOre(FOAIA.total)).toBe("1.198,5");
  });

  it("orele suplimentare și cele de noapte sunt SUBSETURI, nu adaosuri", () => {
    for (const rand of FOAIA.randuri) {
      for (const celula of rand.celule) {
        // Oglindește cele două CHECK-uri din `0013_attendance.sql`.
        expect(celula.suplimentare).toBeLessThanOrEqual(celula.ore);
        expect(celula.noapte).toBeLessThanOrEqual(celula.ore);
      }
    }
    expect(FOAIA.suplimentare).toBe(7);
    expect(FOAIA.noapte).toBe(32);
    expect(FOAIA.suplimentare).toBeLessThan(FOAIA.total);
    expect(FOAIA.noapte).toBeLessThan(FOAIA.total);
  });

  it("are opt rânduri și treizeci de coloane", () => {
    expect(FOAIA.randuri).toHaveLength(8);
    expect(FOAIA.zile).toHaveLength(30);
    for (const rand of FOAIA.randuri) {
      expect(rand.celule).toHaveLength(30);
    }
  });
});

describe("aprilie 2026 e ales pentru ce demonstrează", () => {
  it("are douăzeci de zile lucrătoare, adică o sută șaizeci de ore normă", () => {
    expect(FOAIA.zileLucratoare).toBe(20);
    expect(NORMA_LUNARA).toBe(160);
    expect(ORE_NORMA_ZI).toBe(8);
  });

  it("sărbătorile de pe foaie vin din calendarul produsului, nu dintr-o listă scrisă aici", () => {
    const dinDomeniu = sarbatoriAnului(AN_FOAIE)
      .filter((s) => s.data.getUTCMonth() === LUNA_FOAIE - 1)
      .map((s) => s.data.getUTCDate())
      .sort((a, b) => a - b);

    // Vinerea Mare, Paștele, a doua zi de Paște.
    expect(dinDomeniu).toEqual([10, 12, 13]);

    const peFoaie = FOAIA.zile.filter((z) => z.sarbatoare !== null).map((z) => z.zi);
    // Paștele (12) cade duminică: e sărbătoare legală, dar nu adaugă o zi
    // liberă, deci pe foaie rămâne weekend. Asta e chiar argumentul.
    expect(peFoaie).toEqual([10, 13]);
    expect(FOAIA.zile[11]?.litera).toBe("D");
    expect(FOAIA.zile[11]?.nelucratoare).toBe(true);
  });

  it("weekendurile cad unde le arată calendarul", () => {
    const weekend = FOAIA.zile.filter((z) => z.litera === "S" || z.litera === "D").map((z) => z.zi);
    expect(weekend).toEqual([4, 5, 11, 12, 18, 19, 25, 26]);
    expect(FOAIA.zile[0]?.litera).toBe("M"); // 1 aprilie 2026, miercuri
  });
});

describe("reconcilierea supraviețuiește pe ecran îngust", () => {
  it("cele două jumătăți se adună înapoi la totalul lunii", () => {
    expect(FOAIA.jumatati.map((j) => j.total)).toEqual([556, 642.5]);
    expect(FOAIA.jumatati.reduce((s, j) => s + j.total, 0)).toBe(FOAIA.total);
  });

  it("cele cinci săptămâni se adună înapoi la totalul lunii", () => {
    expect(FOAIA.saptamani.map((s) => s.total)).toEqual([192, 236, 239.5, 272, 259]);
    expect(FOAIA.saptamani.reduce((s, f) => s + f.total, 0)).toBe(FOAIA.total);
  });

  it("ferestrele acoperă luna o singură dată, fără goluri și fără suprapuneri", () => {
    for (const set of [FOAIA.jumatati, FOAIA.saptamani]) {
      const acoperite = set.flatMap((f) =>
        Array.from({ length: f.ultima - f.prima + 1 }, (_, i) => f.prima + i),
      );
      expect(acoperite).toEqual(FOAIA.zile.map((z) => z.zi));
    }
  });
});

describe("codurile din legendă", () => {
  it("ziua lucrătoare și weekendul nu au cod — o foaie scrie ore, nu litere", () => {
    expect(COD_ZI.lucratoare).toBeNull();
    expect(COD_ZI.weekend).toBeNull();
  });

  it("o zi de concediu arată zero ore, ca adunarea să se poată face pe ecran", () => {
    const concedii = FOAIA.randuri
      .flatMap((r) => r.celule)
      .filter((c) => c.tip === "concediu" || c.tip === "medical" || c.tip === "absenta_nemotivata");
    expect(concedii.length).toBeGreaterThan(0);
    for (const celula of concedii) {
      expect(celula.ore).toBe(0);
    }
  });

  it("delegația e muncă prestată, deci are ore", () => {
    const delegatii = FOAIA.randuri.flatMap((r) => r.celule).filter((c) => c.tip === "delegatie");
    expect(delegatii).toHaveLength(3);
    for (const celula of delegatii) {
      expect(celula.ore).toBe(ORE_NORMA_ZI);
    }
  });
});
