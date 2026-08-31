import { describe, expect, it } from "vitest";

import {
  avertismenteLuna,
  avertismenteSaptamana,
  avertismenteZi,
  limiteleFirmei,
  type LimiteFirmei,
  type ZiLucrata,
} from "./limite-legale";

/**
 * Ce apără fișierul ăsta: că parametrii pe care firma îi confirmă juridic în
 * `/pontaj/setari` produc un semnal când pontajul îi depășește — și că NU
 * produc niciunul când firma n-a configurat nimic.
 *
 * A doua parte e la fel de importantă ca prima. Un plafon inventat („48, că așa
 * e legea") ar pune un avertisment cu cifră juridică pe ecranul unei firme care
 * n-a confirmat-o niciodată, iar cifra aia ar călători mai departe ca și cum ar
 * fi fost aleasă.
 */

const LIMITE: LimiteFirmei = {
  orePeSaptamana: 40,
  oreMaximeSaptamanale: 48,
  perioadaReferintaLuni: 4,
  repausZilnicMinimOre: 12,
  repausSaptamanalMinimOre: 48,
  termenCompensareSarbatoareZile: 30,
  admiteOreSuplimentare: true,
  lucreazaNoaptea: true,
  lucreazaWeekend: true,
  lucreazaSarbatori: true,
};

/** O zi obișnuită; testul suprascrie doar ce îl interesează. */
function zi(data: string, peste: Partial<ZiLucrata> = {}): ZiLucrata {
  return {
    data,
    oraInceput: "08:00",
    oraSfarsit: "16:00",
    oreLucrate: 8,
    oreSuplimentare: 0,
    oreNoapte: 0,
    esteSarbatoare: false,
    ...peste,
  };
}

/** Luni–vineri din săptămâna care începe la 2026-08-24. */
const LUNI = "2026-08-24";
const SAPTAMANA_LUCRATA = ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];

function coduri(avertismente: readonly { readonly cod: string }[]): readonly string[] {
  return avertismente.map((a) => a.cod);
}

describe("limiteleFirmei", () => {
  it("întoarce null pentru firma fără rând de setări — nu implicite inventate", () => {
    expect(limiteleFirmei(null)).toBeNull();
  });

  it("citește rândul așa cum vine din bază, fără să interpreteze nimic", () => {
    const limite = limiteleFirmei({
      ore_pe_saptamana: 40,
      ore_maxime_saptamanale: 48,
      perioada_referinta_luni: 4,
      repaus_zilnic_minim_ore: 12,
      repaus_saptamanal_minim_ore: 48,
      termen_compensare_sarbatoare_zile: 30,
      admite_ore_suplimentare: false,
      lucreaza_noaptea: false,
      lucreaza_weekend: false,
      lucreaza_sarbatori: false,
    });
    expect(limite).toEqual(LIMITE_FARA_FELURI);
  });
});

const LIMITE_FARA_FELURI: LimiteFirmei = {
  ...LIMITE,
  admiteOreSuplimentare: false,
  lucreazaNoaptea: false,
  lucreazaWeekend: false,
  lucreazaSarbatori: false,
};

describe("firma neconfigurată", () => {
  const zile = SAPTAMANA_LUCRATA.map((d) => zi(d, { oreLucrate: 14, oraSfarsit: "22:00" }));

  it("nu primește niciun avertisment, pe nicio cale", () => {
    expect(
      avertismenteZi({
        zi: zile[0] ?? zi(LUNI),
        ziuaDinainte: null,
        saptamana: zile,
        referinta: { ore: 1000, saptamani: 10 },
        limite: null,
      }),
    ).toEqual([]);
    expect(
      avertismenteSaptamana({
        saptamanaStart: LUNI,
        zile,
        ziuaDinainte: null,
        referinta: null,
        limite: null,
      }),
    ).toEqual([]);
    expect(avertismenteLuna({ zile, limite: null })).toEqual([]);
  });
});

describe("plafonul săptămânal", () => {
  it("semnalează săptămâna peste maximul cu ore suplimentare, cu cifra firmei", () => {
    // 5 × 14 = 70 de ore, exemplul din raportul de defect.
    const zile = SAPTAMANA_LUCRATA.map((d) =>
      zi(d, { oreLucrate: 14, oraSfarsit: "22:00", oreSuplimentare: 6 }),
    );
    const gasite = avertismenteSaptamana({
      saptamanaStart: LUNI,
      zile,
      ziuaDinainte: null,
      referinta: null,
      limite: LIMITE,
    });
    const plafon = gasite.find((a) => a.cod === "saptamana_peste_maxim");
    expect(plafon?.severitate).toBe("avertisment");
    expect(plafon?.mesaj).toContain("70:00 h");
    expect(plafon?.mesaj).toContain("48:00 h");
    expect(plafon?.zi).toBe(LUNI);
  });

  it("tace exact pe plafon — `>`, nu `>=`", () => {
    const zile = SAPTAMANA_LUCRATA.map((d) =>
      zi(d, { oreLucrate: 9.6, oraSfarsit: "17:36", oreSuplimentare: 1.6 }),
    );
    expect(
      coduri(
        avertismenteSaptamana({
          saptamanaStart: LUNI,
          zile,
          ziuaDinainte: null,
          referinta: null,
          limite: LIMITE,
        }),
      ),
    ).not.toContain("saptamana_peste_maxim");
  });

  it("peste normă, dar sub plafon, e informativ — orele suplimentare sunt legale", () => {
    const zile = SAPTAMANA_LUCRATA.map((d) =>
      zi(d, { oreLucrate: 8.5, oraSfarsit: "16:30", oreSuplimentare: 0.5 }),
    );
    const gasite = avertismenteSaptamana({
      saptamanaStart: LUNI,
      zile,
      ziuaDinainte: null,
      referinta: null,
      limite: LIMITE,
    });
    const norma = gasite.find((a) => a.cod === "saptamana_peste_norma");
    expect(norma?.severitate).toBe("informativ");
    expect(norma?.mesaj).toContain("42:30 h");
  });

  it("nu spune de două ori aceeași săptămână: peste plafon, norma tace", () => {
    const zile = SAPTAMANA_LUCRATA.map((d) => zi(d, { oreLucrate: 14, oraSfarsit: "22:00" }));
    const gasite = coduri(
      avertismenteSaptamana({
        saptamanaStart: LUNI,
        zile,
        ziuaDinainte: null,
        referinta: null,
        limite: LIMITE,
      }),
    );
    expect(gasite).toContain("saptamana_peste_maxim");
    expect(gasite).not.toContain("saptamana_peste_norma");
  });
});

describe("repausul zilnic", () => {
  it("calculează exact când ambele intervale se cunosc", () => {
    // Marți 14:00–23:00, miercuri 06:00–14:00 → 7 ore de repaus.
    const marti = zi("2026-08-25", { oraInceput: "14:00", oraSfarsit: "23:00", oreLucrate: 9 });
    const miercuri = zi("2026-08-26", { oraInceput: "06:00", oraSfarsit: "14:00" });
    const gasite = avertismenteZi({
      zi: miercuri,
      ziuaDinainte: marti,
      saptamana: [marti, miercuri],
      referinta: null,
      limite: LIMITE,
    });
    const repaus = gasite.find((a) => a.cod === "repaus_zilnic");
    expect(repaus?.mesaj).toContain("7:00 h");
    expect(repaus?.mesaj).toContain("12:00 h");
    // Fără interval necunoscut, cifra nu e o estimare și n-are voie să pretindă.
    expect(repaus?.mesaj).not.toContain("estimat");
  });

  it("estimează `24 − orele de ieri` când ziua n-are interval, și o spune", () => {
    const marti = zi("2026-08-25", { oraInceput: null, oraSfarsit: null, oreLucrate: 14 });
    const miercuri = zi("2026-08-26");
    const repaus = avertismenteZi({
      zi: miercuri,
      ziuaDinainte: marti,
      saptamana: [marti, miercuri],
      referinta: null,
      limite: LIMITE,
    }).find((a) => a.cod === "repaus_zilnic");
    expect(repaus?.mesaj).toContain("estimat");
    expect(repaus?.mesaj).toContain("10:00 h");
  });

  it("nu compară zile care nu sunt consecutive", () => {
    const luni = zi("2026-08-24", { oraSfarsit: "23:00", oreLucrate: 15 });
    const miercuri = zi("2026-08-26", { oraInceput: "06:00" });
    expect(
      coduri(
        avertismenteZi({
          zi: miercuri,
          ziuaDinainte: luni,
          saptamana: [luni, miercuri],
          referinta: null,
          limite: LIMITE,
        }),
      ),
    ).not.toContain("repaus_zilnic");
  });

  it("nu semnalează repaus pentru o zi nelucrată", () => {
    const marti = zi("2026-08-25", { oraSfarsit: "23:00", oreLucrate: 15 });
    const miercuri = zi("2026-08-26", {
      oraInceput: null,
      oraSfarsit: null,
      oreLucrate: 0,
    });
    expect(
      coduri(
        avertismenteZi({
          zi: miercuri,
          ziuaDinainte: marti,
          saptamana: [marti, miercuri],
          referinta: null,
          limite: LIMITE,
        }),
      ),
    ).not.toContain("repaus_zilnic");
  });
});

describe("repausul săptămânal", () => {
  it("weekend liber după cinci zile fără interval înseamnă exact 48 de ore, deci tăcere", () => {
    const zile = SAPTAMANA_LUCRATA.map((d) =>
      zi(d, { oraInceput: null, oraSfarsit: null, oreLucrate: 8 }),
    );
    expect(
      coduri(
        avertismenteSaptamana({
          saptamanaStart: LUNI,
          zile,
          ziuaDinainte: null,
          referinta: null,
          limite: LIMITE,
        }),
      ),
    ).not.toContain("repaus_saptamanal");
  });

  it("sâmbăta lucrată taie repausul la o zi și îl semnalează", () => {
    const zile = [...SAPTAMANA_LUCRATA, "2026-08-29"].map((d) => zi(d));
    const repaus = avertismenteSaptamana({
      saptamanaStart: LUNI,
      zile,
      ziuaDinainte: null,
      referinta: null,
      limite: LIMITE,
    }).find((a) => a.cod === "repaus_saptamanal");
    expect(repaus?.severitate).toBe("avertisment");
    // Sâmbătă 16:00 → duminică 24:00 = 32 de ore.
    expect(repaus?.mesaj).toContain("32:00 h");
    expect(repaus?.mesaj).toContain("48:00 h");
  });

  it("nu măsoară repausul într-o săptămână în care nu s-a lucrat deloc", () => {
    const zile = SAPTAMANA_LUCRATA.map((d) =>
      zi(d, { oraInceput: null, oraSfarsit: null, oreLucrate: 0 }),
    );
    expect(
      avertismenteSaptamana({
        saptamanaStart: LUNI,
        zile,
        ziuaDinainte: null,
        referinta: null,
        limite: LIMITE,
      }),
    ).toEqual([]);
  });
});

describe("felurile de muncă pe care firma a declarat că nu le are", () => {
  it("semnalează orele suplimentare la o firmă care nu le admite", () => {
    const gasite = avertismenteZi({
      zi: zi(LUNI, { oreLucrate: 10, oraSfarsit: "18:00", oreSuplimentare: 2 }),
      ziuaDinainte: null,
      saptamana: [],
      referinta: null,
      limite: { ...LIMITE, admiteOreSuplimentare: false },
    });
    const supl = gasite.find((a) => a.cod === "suplimentare_nepermise");
    expect(supl?.mesaj).toContain("2:00 h");
    expect(supl?.mesaj).toContain("nu se lucrează ore suplimentare");
  });

  it("semnalează orele de noapte la o firmă fără tură de noapte", () => {
    const gasite = coduri(
      avertismenteZi({
        zi: zi(LUNI, { oraInceput: "20:00", oraSfarsit: "23:30", oreLucrate: 3.5, oreNoapte: 1.5 }),
        ziuaDinainte: null,
        saptamana: [],
        referinta: null,
        limite: { ...LIMITE, lucreazaNoaptea: false },
      }),
    );
    expect(gasite).toContain("noapte_nepermisa");
  });

  it("semnalează duminica lucrată la o firmă de birou", () => {
    // 2026-08-30 e duminică.
    const gasite = avertismenteZi({
      zi: zi("2026-08-30"),
      ziuaDinainte: null,
      saptamana: [],
      referinta: null,
      limite: { ...LIMITE, lucreazaWeekend: false },
    });
    expect(gasite.find((a) => a.cod === "zi_de_repaus_lucrata")?.mesaj).toContain("30.08.2026");
  });

  it("semnalează sărbătoarea lucrată, după `tip_zi`, nu după calendarul propriu", () => {
    const gasite = coduri(
      avertismenteZi({
        zi: zi("2026-08-26", { esteSarbatoare: true }),
        ziuaDinainte: null,
        saptamana: [],
        referinta: null,
        limite: { ...LIMITE, lucreazaSarbatori: false },
      }),
    );
    expect(gasite).toContain("sarbatoare_lucrata");
  });

  it("spune termenul zilei libere pentru sărbătoare, chiar la o firmă care lucrează de sărbători", () => {
    // Singurul loc din produs unde `termen_compensare_sarbatoare_zile` ajunge
    // pe ecran; cifra e aceeași pe care tocmai a scris-o triggerul din 0013 în
    // `holiday_compensation`.
    const compensare = avertismenteZi({
      zi: zi("2026-08-15", { esteSarbatoare: true }),
      ziuaDinainte: null,
      saptamana: [],
      referinta: null,
      limite: LIMITE,
    }).find((a) => a.cod === "compensare_sarbatoare");
    expect(compensare?.severitate).toBe("informativ");
    expect(compensare?.mesaj).toContain("14.09.2026");
  });

  it("nu vorbește despre compensare pentru o sărbătoare nelucrată", () => {
    expect(
      coduri(
        avertismenteZi({
          zi: zi("2026-08-15", {
            esteSarbatoare: true,
            oreLucrate: 0,
            oraInceput: null,
            oraSfarsit: null,
          }),
          ziuaDinainte: null,
          saptamana: [],
          referinta: null,
          limite: LIMITE,
        }),
      ),
    ).not.toContain("compensare_sarbatoare");
  });

  it("tace când firma chiar lucrează așa", () => {
    expect(
      avertismenteZi({
        zi: zi("2026-08-30", {
          oreLucrate: 10,
          oraSfarsit: "18:00",
          oreSuplimentare: 2,
          oreNoapte: 1,
        }),
        ziuaDinainte: null,
        saptamana: [],
        referinta: null,
        limite: LIMITE,
      }),
    ).toEqual([]);
  });
});

describe("media pe perioada de referință", () => {
  it("semnalează media peste plafon, cu numărul de luni al firmei", () => {
    const medie = avertismenteZi({
      zi: zi(LUNI),
      ziuaDinainte: null,
      saptamana: [],
      referinta: { ore: 1020, saptamani: 20 },
      limite: LIMITE,
    }).find((a) => a.cod === "medie_perioada_referinta");
    // 1020 / 20 = 51 de ore pe săptămână.
    expect(medie?.mesaj).toContain("51:00 h");
    expect(medie?.mesaj).toContain("4 luni");
  });

  it("nu împarte la zero pentru un angajat fără pontaj în perioadă", () => {
    expect(
      coduri(
        avertismenteZi({
          zi: zi(LUNI),
          ziuaDinainte: null,
          saptamana: [],
          referinta: { ore: 0, saptamani: 0 },
          limite: LIMITE,
        }),
      ),
    ).not.toContain("medie_perioada_referinta");
  });
});

describe("avertismenteSaptamana", () => {
  it("verifică repausul peste granița săptămânii, din duminica dinainte", () => {
    const duminica = zi("2026-08-23", { oraInceput: "14:00", oraSfarsit: "23:00", oreLucrate: 9 });
    const luni = zi(LUNI, { oraInceput: "06:00", oraSfarsit: "14:00" });
    const gasite = avertismenteSaptamana({
      saptamanaStart: LUNI,
      zile: [luni],
      ziuaDinainte: duminica,
      referinta: null,
      limite: LIMITE,
    });
    expect(gasite.find((a) => a.cod === "repaus_zilnic")?.zi).toBe(LUNI);
  });
});

describe("avertismenteLuna", () => {
  it("grupează pe săptămâni ISO și semnalează doar săptămâna depășită", () => {
    const bune = SAPTAMANA_LUCRATA.map((d) => zi(d));
    const rele = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"].map((d) =>
      zi(d, { oreLucrate: 14, oraSfarsit: "22:00" }),
    );
    const plafoane = avertismenteLuna({ zile: [...bune, ...rele], limite: LIMITE }).filter(
      (a) => a.cod === "saptamana_peste_maxim",
    );
    expect(plafoane).toHaveLength(1);
    expect(plafoane[0]?.zi).toBe("2026-08-31");
  });

  it("leagă zilele consecutive între ele pentru repausul zilnic", () => {
    const zile = [
      zi("2026-08-24", { oraInceput: "14:00", oraSfarsit: "23:00", oreLucrate: 9 }),
      zi("2026-08-25", { oraInceput: "06:00", oraSfarsit: "14:00" }),
    ];
    expect(coduri(avertismenteLuna({ zile, limite: LIMITE }))).toContain("repaus_zilnic");
  });

  it("nu cere zilele să vină ordonate", () => {
    const zile = [
      zi("2026-08-25", { oraInceput: "06:00", oraSfarsit: "14:00" }),
      zi("2026-08-24", { oraInceput: "14:00", oraSfarsit: "23:00", oreLucrate: 9 }),
    ];
    expect(coduri(avertismenteLuna({ zile, limite: LIMITE }))).toContain("repaus_zilnic");
  });
});
