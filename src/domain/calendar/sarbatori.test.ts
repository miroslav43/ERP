// src/domain/calendar/sarbatori.test.ts

import { describe, expect, it } from "vitest";
import { pasteOrtodox } from "./paste-ortodox";
import { sarbatoriAnului, type Sarbatoare } from "./sarbatori";

const ZI_IN_MS = 24 * 60 * 60 * 1000;

function gasesteDupaNume(sarbatori: readonly Sarbatoare[], denumire: string): Sarbatoare {
  const gasita = sarbatori.find((s) => s.denumire === denumire);
  if (!gasita) {
    throw new Error(`Sărbătoarea „${denumire}” nu a fost găsită în lista generată.`);
  }
  return gasita;
}

function iso(data: Date): string {
  const an = data.getUTCFullYear().toString().padStart(4, "0");
  const luna = (data.getUTCMonth() + 1).toString().padStart(2, "0");
  const zi = data.getUTCDate().toString().padStart(2, "0");
  return `${an}-${luna}-${zi}`;
}

describe("sarbatoriAnului", () => {
  it("întoarce exact 17 sărbători (12 fixe + 5 mobile)", () => {
    expect(sarbatoriAnului(2026)).toHaveLength(17);
  });

  /**
   * Datele de mai jos sunt SCRISE DE MÂNĂ, nu derivate din `pasteOrtodox`.
   *
   * Distincția nu e pedanterie. Verificările de offset care urmau — „Vinerea
   * Mare cade cu 2 zile înaintea Paștelui” — își luau și termenul de comparație
   * tot din funcția testată. Dacă `pasteOrtodox` ar fi greșit cu o săptămână,
   * offsetul ar fi rămas 2 zile și testul ar fi trecut, cu toate cele cinci
   * sărbători mobile deplasate. Un test care nu poate pica nu demonstrează nimic.
   *
   * Scrise ca literale, ele prind ambele clase de eroare: și offsetul greșit,
   * și data de Paște greșită.
   */
  const SARBATORI_MOBILE: ReadonlyArray<readonly [number, string, string]> = [
    [2026, "Vinerea Mare", "2026-04-10"],
    [2026, "Paștele", "2026-04-12"],
    [2026, "A doua zi de Paște", "2026-04-13"],
    [2026, "Rusaliile", "2026-05-31"],
    [2026, "A doua zi de Rusalii", "2026-06-01"],
    [2027, "Vinerea Mare", "2027-04-30"],
    [2027, "Paștele", "2027-05-02"],
    [2027, "A doua zi de Paște", "2027-05-03"],
    [2027, "Rusaliile", "2027-06-20"],
    [2027, "A doua zi de Rusalii", "2027-06-21"],
    [2028, "Vinerea Mare", "2028-04-14"],
    [2028, "Paștele", "2028-04-16"],
    [2028, "A doua zi de Paște", "2028-04-17"],
    [2028, "Rusaliile", "2028-06-04"],
    [2028, "A doua zi de Rusalii", "2028-06-05"],
  ];

  it.each(SARBATORI_MOBILE)("în %i, „%s” cade pe %s", (an, denumire, asteptat) => {
    expect(iso(gasesteDupaNume(sarbatoriAnului(an), denumire).data)).toBe(asteptat);
  });

  it("păstrează offsetul față de Paște, ca regula să rămână explicită", () => {
    const paste = pasteOrtodox(2026);
    const sarbatori = sarbatoriAnului(2026);
    const decalaj = (denumire: string) =>
      (gasesteDupaNume(sarbatori, denumire).data.getTime() - paste.getTime()) / ZI_IN_MS;
    expect(decalaj("Vinerea Mare")).toBe(-2);
    expect(decalaj("Rusaliile")).toBe(49);
    expect(decalaj("A doua zi de Rusalii")).toBe(50);
  });

  /**
   * 1 iunie 2026 este simultan Ziua Copilului (fixă) și a doua zi de Rusalii
   * (mobilă). Coincidența e reală și rară; o filtrare prin `Set` de date sau o
   * deduplicare „defensivă” ar șterge una dintre ele și ar scădea numărul de
   * sărbători ale anului. Cazul e ancorat aici tocmai ca să pice dacă cineva
   * introduce o astfel de deduplicare.
   */
  it("păstrează ambele sărbători când două cad în aceeași zi (1 iunie 2026)", () => {
    const inAceaZi = sarbatoriAnului(2026).filter((s) => iso(s.data) === "2026-06-01");
    expect(inAceaZi.map((s) => s.denumire).sort()).toEqual([
      "A doua zi de Rusalii",
      "Ziua Copilului",
    ]);
  });

  it("sărbătorile fixe cad pe aceeași zi calendaristică în fiecare an", () => {
    const sarbatori2024 = sarbatoriAnului(2024);
    const anulNou = gasesteDupaNume(sarbatori2024, "Anul Nou");
    expect(anulNou.data.getUTCMonth()).toBe(0);
    expect(anulNou.data.getUTCDate()).toBe(1);

    const craciunul = gasesteDupaNume(sarbatori2024, "Crăciunul");
    expect(craciunul.data.getUTCMonth()).toBe(11);
    expect(craciunul.data.getUTCDate()).toBe(25);
  });

  it("lista e sortată cronologic", () => {
    const timpi = sarbatoriAnului(2025).map((s) => s.data.getTime());
    const timpiSortati = [...timpi].sort((x, y) => x - y);
    expect(timpi).toEqual(timpiSortati);
  });
});
