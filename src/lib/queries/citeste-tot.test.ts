// src/lib/queries/citeste-tot.test.ts
import { describe, expect, it } from "vitest";

import { citesteTot } from "./citeste-tot";

/**
 * Ce apără fișierul: că o agregare nu mai poate întoarce tăcut o cifră mai
 * mică. Toate scenariile de mai jos treceau „cu succes" înainte.
 */

type Rand = Readonly<{ id: string }>;

/** Un tabel fals care se comportă ca PostgREST: taie la `plafon` rânduri. */
function tabelFals(total: number, plafon = 1000) {
  const toate: Rand[] = Array.from({ length: total }, (_, i) => ({
    id: String(i + 1).padStart(6, "0"),
  }));
  let cereri = 0;
  return {
    get cereri() {
      return cereri;
    },
    cerePagina(dupa: string | null, pas: number) {
      cereri += 1;
      const dupaIndice = dupa === null ? 0 : toate.findIndex((r) => r.id === dupa) + 1;
      return Promise.resolve({
        data: toate.slice(dupaIndice, dupaIndice + Math.min(pas, plafon)),
        error: null,
      });
    },
  };
}

describe("citesteTot", () => {
  it("întoarce TOATE rândurile, nu primele 1000", async () => {
    // Cazul real: `payroll_entries` peste 12 perioade × 84 de angajați.
    const t = tabelFals(2500);
    const randuri = await citesteTot<Rand>(t.cerePagina, (r) => r.id);
    expect(randuri).toHaveLength(2500);
    expect(randuri.at(-1)?.id).toBe("002500");
  });

  it("o listă sub plafon se citește dintr-o singură cerere", async () => {
    const t = tabelFals(40);
    const randuri = await citesteTot<Rand>(t.cerePagina, (r) => r.id);
    expect(randuri).toHaveLength(40);
    expect(t.cereri).toBe(1);
  });

  it("o listă goală nu e o eroare", async () => {
    const t = tabelFals(0);
    expect(await citesteTot<Rand>(t.cerePagina, (r) => r.id)).toHaveLength(0);
  });

  it("o listă exact cât o pagină cere încă o pagină, ca să știe că s-a terminat", async () => {
    const t = tabelFals(1000);
    const randuri = await citesteTot<Rand>(t.cerePagina, (r) => r.id);
    expect(randuri).toHaveLength(1000);
    expect(t.cereri).toBe(2);
  });

  it("nu duplică rânduri la granița dintre pagini", async () => {
    const randuri = await citesteTot<Rand>(tabelFals(2001).cerePagina, (r) => r.id);
    expect(new Set(randuri.map((r) => r.id)).size).toBe(2001);
  });

  it("aruncă, în loc să se învârtă la infinit, dacă cheia nu avansează", async () => {
    // Se întâmplă când `cheie()` întoarce altă coloană decât cea din `order()`.
    const cerePagina = (): Promise<{ data: Rand[]; error: null }> =>
      Promise.resolve({
        data: Array.from({ length: 1000 }, () => ({ id: "acelasi" })),
        error: null,
      });
    await expect(citesteTot<Rand>(cerePagina, (r) => r.id, { nume: "test" })).rejects.toThrow(
      /nu avansează/,
    );
  });

  it("aruncă la plafon, în loc să înghită memoria", async () => {
    const t = tabelFals(60_000);
    await expect(
      citesteTot<Rand>(t.cerePagina, (r) => r.id, { maxim: 5000, nume: "test" }),
    ).rejects.toThrow(/a depășit 5000/);
  });

  it("propagă eroarea bazei, n-o transformă în listă goală", async () => {
    const cerePagina = (): Promise<{ data: null; error: { message: string } }> =>
      Promise.resolve({ data: null, error: { message: "permission denied" } });
    await expect(citesteTot<Rand>(cerePagina, (r) => r.id)).rejects.toMatchObject({
      message: "permission denied",
    });
  });
});
