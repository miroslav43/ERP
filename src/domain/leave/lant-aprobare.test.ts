// src/domain/leave/lant-aprobare.test.ts
import { describe, expect, it } from "vitest";
import { grupeazaPeTrepte, type SarcinaDeGrupat } from "./lant-aprobare";

const baza = (peste: Partial<SarcinaDeGrupat> & { id: string }): SarcinaDeGrupat => ({
  ordine: 1,
  status: "in_asteptare",
  comentariu: null,
  decis_la: null,
  termen_la: "2026-08-25T18:06:00Z",
  ...peste,
});

describe("gruparea lanțului de aprobare", () => {
  it("patru aprobatori pe aceeași treaptă dau O SINGURĂ treaptă", () => {
    // Regresia raportată: „Pasul 1” apărea de patru ori pentru o cerere.
    const trepte = grupeazaPeTrepte([
      baza({ id: "a" }),
      baza({ id: "b" }),
      baza({ id: "c" }),
      baza({ id: "d" }),
    ]);
    expect(trepte).toHaveLength(1);
    expect(trepte[0]?.ordine).toBe(1);
    expect(trepte[0]?.candidatiVizibili).toBe(4);
    expect(trepte[0]?.status).toBe("in_asteptare");
  });

  it("decizia care a contat devine starea treptei", () => {
    const trepte = grupeazaPeTrepte([
      baza({ id: "a", status: "anulata" }),
      baza({
        id: "b",
        status: "aprobata",
        comentariu: "De acord",
        decis_la: "2026-08-23T10:00:00Z",
      }),
      baza({ id: "c", status: "anulata" }),
    ]);
    expect(trepte[0]?.status).toBe("aprobata");
    expect(trepte[0]?.comentariu).toBe("De acord");
    expect(trepte[0]?.decis_la).toBe("2026-08-23T10:00:00Z");
  });

  it("respingerea are aceeași greutate ca aprobarea", () => {
    const trepte = grupeazaPeTrepte([
      baza({ id: "a", status: "anulata" }),
      baza({ id: "b", status: "respinsa", comentariu: "Bugetul e epuizat" }),
    ]);
    expect(trepte[0]?.status).toBe("respinsa");
    expect(trepte[0]?.comentariu).toBe("Bugetul e epuizat");
  });

  it("o treaptă cu toate sarcinile anulate rămâne anulată", () => {
    const trepte = grupeazaPeTrepte([
      baza({ id: "a", status: "anulata" }),
      baza({ id: "b", status: "anulata" }),
    ]);
    expect(trepte[0]?.status).toBe("anulata");
  });

  it("o sarcină deschisă ține treapta în așteptare, chiar lângă anulări", () => {
    const trepte = grupeazaPeTrepte([
      baza({ id: "a", status: "anulata" }),
      baza({ id: "b", status: "in_asteptare" }),
    ]);
    expect(trepte[0]?.status).toBe("in_asteptare");
  });

  it("treptele multiple rămân separate și ordonate", () => {
    const trepte = grupeazaPeTrepte([
      baza({ id: "c", ordine: 2 }),
      baza({ id: "a", ordine: 1, status: "aprobata" }),
      baza({ id: "d", ordine: 2 }),
      baza({ id: "b", ordine: 1, status: "anulata" }),
    ]);
    expect(trepte.map((t) => t.ordine)).toEqual([1, 2]);
    expect(trepte[0]?.status).toBe("aprobata");
    expect(trepte[1]?.status).toBe("in_asteptare");
    expect(trepte[1]?.candidatiVizibili).toBe(2);
  });

  it("un singur aprobator nu declanșează formularea „oricare dintre”", () => {
    const trepte = grupeazaPeTrepte([baza({ id: "a" })]);
    expect(trepte[0]?.candidatiVizibili).toBe(1);
  });

  it("lista goală dă lanț gol, nu aruncă", () => {
    expect(grupeazaPeTrepte([])).toEqual([]);
  });
});
