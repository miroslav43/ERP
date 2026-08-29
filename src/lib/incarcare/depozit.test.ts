// src/lib/incarcare/depozit.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aboneaza, goleste, porneste, surseCurente } from "./depozit";
import { PLAFON_TARE } from "./praguri";

/**
 * Ce apără fișierul: că depozitarul e un CONTOR, nu un boolean.
 *
 * Defectul pe care îl previne e cel care apare abia la utilizatori: două
 * așteptări se suprapun — o aprobare într-un dialog și un `router.refresh()`
 * pornit de altundeva — iar cea care se termină prima stinge voalul peste cea
 * care încă lucrează. Ecranul spune „gata" în timp ce serverul scrie.
 */

describe("depozitul de încărcare", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    goleste();
  });
  afterEach(() => {
    goleste();
    vi.useRealTimers();
  });

  it("rămâne pornit până se opresc TOATE sursele", () => {
    const opresteA = porneste("prima");
    const opresteB = porneste("a doua");
    expect(surseCurente()).toHaveLength(2);

    opresteA();
    expect(surseCurente()).toHaveLength(1);

    opresteB();
    expect(surseCurente()).toHaveLength(0);
  });

  it("ignoră a doua oprire a aceleiași surse", () => {
    const opreste = porneste();
    const alta = porneste();
    opreste();
    opreste();
    opreste();
    // Fără idempotență, apelantul care cheamă și din `finally`, și din curățarea
    // unui `useEffect`, ar stinge sursa altcuiva.
    expect(surseCurente()).toHaveLength(1);
    alta();
  });

  it("stinge din oficiu o sursă scursă, la PLAFON_TARE", () => {
    porneste("uitată");
    expect(surseCurente()).toHaveLength(1);
    vi.advanceTimersByTime(PLAFON_TARE + 1);
    expect(surseCurente()).toHaveLength(0);
  });

  it("anunță ascultătorii la fiecare schimbare și se poate dezabona", () => {
    const vazut: number[] = [];
    const dezaboneaza = aboneaza((s) => vazut.push(s.length));

    const opreste = porneste();
    opreste();
    dezaboneaza();
    porneste()();

    expect(vazut).toEqual([1, 0]);
  });

  it("păstrează eticheta primei surse, ca voalul să știe ce să scrie", () => {
    porneste("panoul");
    porneste("altceva");
    expect(surseCurente()[0]?.eticheta).toBe("panoul");
  });
});
