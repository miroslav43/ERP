import { describe, expect, it } from "vitest";

import { sarciniPortal, type IntrareSarcini } from "./sarcini";

const LINISTE: IntrareSarcini = {
  cursuriDeFacut: 0,
  termenCursuri: null,
  zileNepontate: 0,
  anunturiNecitite: 0,
  azi: "2026-09-12",
};

describe("sarciniPortal", () => {
  it("ziua fără nimic de făcut întoarce lista goală", () => {
    expect(sarciniPortal(LINISTE)).toEqual([]);
  });

  it("ordinea e cea a costului de a le lăsa baltă", () => {
    const sarcini = sarciniPortal({
      ...LINISTE,
      cursuriDeFacut: 2,
      zileNepontate: 3,
      anunturiNecitite: 1,
    });
    expect(sarcini.map((s) => s.id)).toEqual(["cursuri", "pontaj", "anunturi"]);
  });

  it("un termen depășit face cursul urgent, unul viitor nu", () => {
    const depasit = sarciniPortal({
      ...LINISTE,
      cursuriDeFacut: 1,
      termenCursuri: "2026-09-01",
    })[0];
    expect(depasit?.urgenta).toBe(true);
    expect(depasit?.detaliu).toBe("Termenul a trecut");

    const viitor = sarciniPortal({
      ...LINISTE,
      cursuriDeFacut: 1,
      termenCursuri: "2026-10-01",
    })[0];
    expect(viitor?.urgenta).toBe(false);
    expect(viitor?.detaliu).toBeNull();
  });

  it("singularul se scrie ca singular", () => {
    expect(sarciniPortal({ ...LINISTE, cursuriDeFacut: 1 })[0]?.eticheta).toBe(
      "Un curs de parcurs",
    );
    expect(sarciniPortal({ ...LINISTE, zileNepontate: 1 })[0]?.eticheta).toBe(
      "O zi nepontată luna aceasta",
    );
    expect(sarciniPortal({ ...LINISTE, anunturiNecitite: 1 })[0]?.eticheta).toBe(
      "Un anunț necitit",
    );
  });

  it("pluralul poartă cifra", () => {
    expect(sarciniPortal({ ...LINISTE, zileNepontate: 4 })[0]?.eticheta).toBe(
      "4 zile nepontate luna aceasta",
    );
  });

  it("nepontatul nu e urgent de la prima zi", () => {
    expect(sarciniPortal({ ...LINISTE, zileNepontate: 9 })[0]?.urgenta).toBe(false);
  });

  it("fiecare rând duce undeva", () => {
    const sarcini = sarciniPortal({
      ...LINISTE,
      cursuriDeFacut: 1,
      zileNepontate: 1,
      anunturiNecitite: 1,
    });
    expect(sarcini.map((s) => s.href)).toEqual([
      "/portal/cursurile-mele",
      "/portal/pontajul-meu",
      "/portal/anunturi",
    ]);
  });
});
