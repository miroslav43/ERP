// src/domain/payroll/etape/compensare-ore.test.ts
import { describe, expect, it } from "vitest";
import {
  adaugaZile,
  calculeazaCompensarea,
  COD_ORE_SUPL_EXPIRATE,
  COD_ORE_SUPL_NECOMPENSATE,
  COD_SPOR_SARBATOARE_FARA_PROCENT,
  COD_ZI_LIBERA_SARBATOARE_NEACORDATA,
  type IntrareCompensare,
  type OreSuplimentareCompensabile,
  type SarbatoareCompensabila,
} from "./compensare-ore";

/**
 * Ziua de referință e ultima zi a lunii calculate. Toate termenele din teste se
 * raportează la ea, niciodată la ceasul mașinii — un test care ar depinde de
 * data de azi ar trece azi și ar cădea peste trei luni.
 */
const ZI_REFERINTA = "2026-06-30";

function intrare(parti: Partial<IntrareCompensare> = {}): IntrareCompensare {
  return {
    suplimentare: [],
    sarbatori: [],
    ziReferinta: ZI_REFERINTA,
    zileAvertizareTermen: 15,
    ...parti,
  };
}

function suplimentare(
  parti: Partial<OreSuplimentareCompensabile> = {},
): OreSuplimentareCompensabile {
  return { ore: 8, oreFolosite: 0, oreExpirate: 0, termenFolosire: "2026-09-30", ...parti };
}

function sarbatoare(parti: Partial<SarbatoareCompensabila> = {}): SarbatoareCompensabila {
  return {
    dataSarbatorii: "2026-05-01",
    oreLucrate: 8,
    tip: "zi_libera",
    acordata: false,
    termenAcordare: "2026-07-31",
    sporProcent: null,
    ...parti,
  };
}

function coduri(probleme: readonly { readonly cod: string }[]): string[] {
  return probleme.map((problema) => problema.cod);
}

describe("calculeazaCompensarea — liste goale", () => {
  const rezultat = calculeazaCompensarea(intrare());

  it("întoarce zero pe toate axele, fără probleme", () => {
    expect(rezultat).toEqual({
      oreDePlata: 0,
      oreCompensate: 0,
      oreInTermen: 0,
      oreSarbatoareDePlata: 0,
      oreSarbatoareCompensate: 0,
      probleme: [],
    });
  });
});

describe("ore suplimentare — complet compensate cu timp liber", () => {
  const rezultat = calculeazaCompensarea(
    intrare({
      suplimentare: [suplimentare({ ore: 8, oreFolosite: 8, termenFolosire: "2026-09-30" })],
    }),
  );

  it("nu se plătește nimic — ar fi plată dublă", () => {
    expect(rezultat.oreDePlata).toBe(0);
  });

  it("cele 8 ore apar ca ore compensate", () => {
    expect(rezultat.oreCompensate).toBe(8);
  });

  it("nu mai rămâne nimic în termen", () => {
    expect(rezultat.oreInTermen).toBe(0);
  });

  it("nu ridică nicio problemă", () => {
    expect(rezultat.probleme).toEqual([]);
  });
});

describe("ore suplimentare — complet compensate, dar cu termenul deja trecut", () => {
  const rezultat = calculeazaCompensarea(
    intrare({
      suplimentare: [suplimentare({ ore: 8, oreFolosite: 8, termenFolosire: "2026-05-31" })],
    }),
  );

  it("nu se plătește nimic: orele au fost luate ca timp liber înainte de termen", () => {
    expect(rezultat.oreDePlata).toBe(0);
    expect(rezultat.oreCompensate).toBe(8);
  });

  it("nu semnalează expirare — n-a rămas nicio oră de pierdut", () => {
    expect(coduri(rezultat.probleme)).toEqual([]);
  });
});

describe("ore suplimentare — parțial compensate, încă în termen", () => {
  const rezultat = calculeazaCompensarea(
    intrare({
      zileAvertizareTermen: 15,
      suplimentare: [suplimentare({ ore: 10, oreFolosite: 4, termenFolosire: "2026-09-30" })],
    }),
  );

  it("cele 4 ore luate ca timp liber nu se plătesc", () => {
    expect(rezultat.oreCompensate).toBe(4);
    expect(rezultat.oreDePlata).toBe(0);
  });

  it("restul de 6 ore rămâne în termen — nici plătit, nici pierdut", () => {
    expect(rezultat.oreInTermen).toBe(6);
  });

  it("nu avertizează: termenul e departe de fereastră", () => {
    expect(coduri(rezultat.probleme)).toEqual([]);
  });
});

describe("ore suplimentare — termen depășit, necompensate", () => {
  const rezultat = calculeazaCompensarea(
    intrare({
      suplimentare: [suplimentare({ ore: 10, oreFolosite: 4, termenFolosire: "2026-06-29" })],
    }),
  );

  it("cele 6 ore rămase se plătesc obligatoriu cu spor", () => {
    expect(rezultat.oreDePlata).toBe(6);
  });

  it("cele 4 ore luate ca timp liber rămân doar compensate", () => {
    expect(rezultat.oreCompensate).toBe(4);
    expect(rezultat.oreInTermen).toBe(0);
  });

  it("ridică SAL_ORE_SUPL_EXPIRATE cu orele și termenul în detalii", () => {
    expect(coduri(rezultat.probleme)).toEqual([COD_ORE_SUPL_EXPIRATE]);
    expect(rezultat.probleme[0]?.detalii).toContain("6 ore");
    expect(rezultat.probleme[0]?.detalii).toContain("2026-06-29");
    expect(rezultat.probleme[0]?.detalii.endsWith(".")).toBe(true);
  });
});

describe("ore suplimentare — termenul cade exact pe ziua de referință", () => {
  const rezultat = calculeazaCompensarea(
    intrare({ suplimentare: [suplimentare({ ore: 8, termenFolosire: ZI_REFERINTA })] }),
  );

  it("nu e încă depășit: comparația e strictă, ziua de referință e ultima zi bună", () => {
    expect(rezultat.oreDePlata).toBe(0);
    expect(rezultat.oreInTermen).toBe(8);
  });

  it("intră însă în fereastra de avertizare", () => {
    expect(coduri(rezultat.probleme)).toEqual([COD_ORE_SUPL_NECOMPENSATE]);
  });
});

describe("ore suplimentare — ore marcate expirate", () => {
  const rezultat = calculeazaCompensarea(
    intrare({
      suplimentare: [
        suplimentare({ ore: 10, oreFolosite: 2, oreExpirate: 3, termenFolosire: "2026-09-30" }),
      ],
    }),
  );

  it("orele expirate se plătesc chiar dacă înregistrarea e încă în termen", () => {
    expect(rezultat.oreDePlata).toBe(3);
  });

  it("restul de 5 ore rămâne în termen", () => {
    expect(rezultat.oreInTermen).toBe(5);
    expect(rezultat.oreCompensate).toBe(2);
  });

  it("nu le numără de două ori când termenul e și el depășit", () => {
    const depasit = calculeazaCompensarea(
      intrare({
        suplimentare: [
          suplimentare({ ore: 10, oreFolosite: 2, oreExpirate: 3, termenFolosire: "2026-01-31" }),
        ],
      }),
    );
    // 3 expirate + 5 rămase = 8, nu 11.
    expect(depasit.oreDePlata).toBe(8);
    expect(depasit.oreInTermen).toBe(0);
    expect(coduri(depasit.probleme)).toEqual([COD_ORE_SUPL_EXPIRATE]);
  });
});

describe("ore suplimentare — fereastra de avertizare", () => {
  it("avertizează pentru un termen din interiorul ferestrei", () => {
    const rezultat = calculeazaCompensarea(
      intrare({
        zileAvertizareTermen: 15,
        suplimentare: [suplimentare({ ore: 8, termenFolosire: "2026-07-10" })],
      }),
    );
    expect(coduri(rezultat.probleme)).toEqual([COD_ORE_SUPL_NECOMPENSATE]);
    expect(rezultat.probleme[0]?.detalii).toContain("2026-07-10");
    expect(rezultat.oreInTermen).toBe(8);
    expect(rezultat.oreDePlata).toBe(0);
  });

  it("avertizează și pentru un termen fix pe ziua-limită a ferestrei", () => {
    // 2026-06-30 + 15 zile = 2026-07-15.
    const rezultat = calculeazaCompensarea(
      intrare({
        zileAvertizareTermen: 15,
        suplimentare: [suplimentare({ termenFolosire: "2026-07-15" })],
      }),
    );
    expect(coduri(rezultat.probleme)).toEqual([COD_ORE_SUPL_NECOMPENSATE]);
  });

  it("tace pentru un termen aflat cu o zi după fereastră", () => {
    const rezultat = calculeazaCompensarea(
      intrare({
        zileAvertizareTermen: 15,
        suplimentare: [suplimentare({ termenFolosire: "2026-07-16" })],
      }),
    );
    expect(rezultat.probleme).toEqual([]);
    expect(rezultat.oreInTermen).toBe(8);
  });

  it("nu avertizează când nu mai e nicio oră de folosit", () => {
    const rezultat = calculeazaCompensarea(
      intrare({
        zileAvertizareTermen: 15,
        suplimentare: [suplimentare({ ore: 8, oreFolosite: 8, termenFolosire: "2026-07-01" })],
      }),
    );
    expect(rezultat.probleme).toEqual([]);
  });

  it("o fereastră de zero zile lasă doar ziua de referință să avertizeze", () => {
    const azi = calculeazaCompensarea(
      intrare({
        zileAvertizareTermen: 0,
        suplimentare: [suplimentare({ termenFolosire: ZI_REFERINTA })],
      }),
    );
    const maine = calculeazaCompensarea(
      intrare({
        zileAvertizareTermen: 0,
        suplimentare: [suplimentare({ termenFolosire: "2026-07-01" })],
      }),
    );
    expect(coduri(azi.probleme)).toEqual([COD_ORE_SUPL_NECOMPENSATE]);
    expect(maine.probleme).toEqual([]);
  });
});

describe("ore suplimentare — date defensive", () => {
  it("nu produce ore negative când folositele plus expiratele depășesc totalul", () => {
    const rezultat = calculeazaCompensarea(
      intrare({
        suplimentare: [
          suplimentare({ ore: 4, oreFolosite: 5, oreExpirate: 2, termenFolosire: "2026-09-30" }),
        ],
      }),
    );
    expect(rezultat.oreInTermen).toBe(0);
    expect(rezultat.oreDePlata).toBe(2);
  });

  it("însumează mai multe înregistrări fără reziduuri de virgulă mobilă", () => {
    const rezultat = calculeazaCompensarea(
      intrare({
        suplimentare: [
          suplimentare({ ore: 0.1, termenFolosire: "2026-09-30" }),
          suplimentare({ ore: 0.2, termenFolosire: "2026-09-30" }),
        ],
      }),
    );
    expect(rezultat.oreInTermen).toBe(0.3);
  });
});

describe("sărbători — zi liberă acordată", () => {
  const rezultat = calculeazaCompensarea(
    intrare({ sarbatori: [sarbatoare({ tip: "zi_libera", acordata: true, oreLucrate: 8 })] }),
  );

  it("nu se mai plătește spor — ziua liberă a fost dată", () => {
    expect(rezultat.oreSarbatoareDePlata).toBe(0);
    expect(rezultat.oreSarbatoareCompensate).toBe(8);
  });

  it("nu ridică nicio problemă", () => {
    expect(rezultat.probleme).toEqual([]);
  });
});

describe("sărbători — zi liberă neacordată, termen depășit", () => {
  const rezultat = calculeazaCompensarea(
    intrare({
      sarbatori: [
        sarbatoare({
          dataSarbatorii: "2026-01-01",
          oreLucrate: 8,
          tip: "zi_libera",
          acordata: false,
          termenAcordare: "2026-01-31",
        }),
      ],
    }),
  );

  it("se plătește spor pe orele lucrate", () => {
    expect(rezultat.oreSarbatoareDePlata).toBe(8);
    expect(rezultat.oreSarbatoareCompensate).toBe(0);
  });

  it("ridică SAL_ZI_LIBERA_SARBATOARE_NEACORDATA cu data și termenul", () => {
    expect(coduri(rezultat.probleme)).toEqual([COD_ZI_LIBERA_SARBATOARE_NEACORDATA]);
    expect(rezultat.probleme[0]?.detalii).toContain("2026-01-01");
    expect(rezultat.probleme[0]?.detalii).toContain("2026-01-31");
  });
});

describe("sărbători — zi liberă neacordată, încă în termen", () => {
  const rezultat = calculeazaCompensarea(
    intrare({
      sarbatori: [sarbatoare({ tip: "zi_libera", acordata: false, termenAcordare: "2026-07-31" })],
    }),
  );

  it("nu intră în niciunul dintre totaluri — soarta ei nu se cunoaște încă", () => {
    expect(rezultat.oreSarbatoareDePlata).toBe(0);
    expect(rezultat.oreSarbatoareCompensate).toBe(0);
  });

  it("nu ridică nicio problemă", () => {
    expect(rezultat.probleme).toEqual([]);
  });

  it("termenul exact pe ziua de referință nu e încă depășit", () => {
    const rezultatLimita = calculeazaCompensarea(
      intrare({ sarbatori: [sarbatoare({ termenAcordare: ZI_REFERINTA })] }),
    );
    expect(rezultatLimita.oreSarbatoareDePlata).toBe(0);
    expect(rezultatLimita.probleme).toEqual([]);
  });

  it("fără termen stabilit nu se plătește nimic", () => {
    const faraTermen = calculeazaCompensarea(
      intrare({ sarbatori: [sarbatoare({ termenAcordare: null })] }),
    );
    expect(faraTermen.oreSarbatoareDePlata).toBe(0);
    expect(faraTermen.oreSarbatoareCompensate).toBe(0);
    expect(faraTermen.probleme).toEqual([]);
  });
});

describe("sărbători — compensare cu spor", () => {
  it("orele se plătesc, iar procentul completat nu ridică nimic", () => {
    const rezultat = calculeazaCompensarea(
      intrare({
        sarbatori: [
          sarbatoare({ tip: "spor", acordata: false, termenAcordare: null, sporProcent: 100 }),
        ],
      }),
    );
    expect(rezultat.oreSarbatoareDePlata).toBe(8);
    expect(rezultat.oreSarbatoareCompensate).toBe(0);
    expect(rezultat.probleme).toEqual([]);
  });

  it("se plătesc chiar dacă termenul de acordare a trecut — forma aleasă e sporul", () => {
    const rezultat = calculeazaCompensarea(
      intrare({
        sarbatori: [sarbatoare({ tip: "spor", termenAcordare: "2026-01-31", sporProcent: 100 })],
      }),
    );
    expect(rezultat.oreSarbatoareDePlata).toBe(8);
    expect(coduri(rezultat.probleme)).toEqual([]);
  });

  it("ridică SAL_SPOR_SARBATOARE_FARA_PROCENT când procentul lipsește, dar tot plătește orele", () => {
    const rezultat = calculeazaCompensarea(
      intrare({
        sarbatori: [
          sarbatoare({
            dataSarbatorii: "2026-05-01",
            tip: "spor",
            termenAcordare: null,
            sporProcent: null,
          }),
        ],
      }),
    );
    expect(rezultat.oreSarbatoareDePlata).toBe(8);
    expect(coduri(rezultat.probleme)).toEqual([COD_SPOR_SARBATOARE_FARA_PROCENT]);
    expect(rezultat.probleme[0]?.detalii).toContain("2026-05-01");
  });
});

describe("calculeazaCompensarea — cele două axe se calculează independent", () => {
  const rezultat = calculeazaCompensarea(
    intrare({
      suplimentare: [
        suplimentare({ ore: 10, oreFolosite: 10, termenFolosire: "2026-09-30" }),
        suplimentare({ ore: 6, termenFolosire: "2026-05-31" }),
        suplimentare({ ore: 4, termenFolosire: "2026-07-05" }),
      ],
      sarbatori: [
        sarbatoare({ tip: "zi_libera", acordata: true, oreLucrate: 8 }),
        sarbatoare({ dataSarbatorii: "2026-01-01", termenAcordare: "2026-01-31", oreLucrate: 4 }),
        sarbatoare({
          dataSarbatorii: "2026-12-25",
          tip: "spor",
          termenAcordare: null,
          oreLucrate: 6,
          sporProcent: 100,
        }),
      ],
    }),
  );

  it("orele suplimentare se împart corect între cele trei totaluri", () => {
    expect(rezultat.oreCompensate).toBe(10);
    expect(rezultat.oreDePlata).toBe(6);
    expect(rezultat.oreInTermen).toBe(4);
  });

  it("orele de sărbătoare se împart corect", () => {
    expect(rezultat.oreSarbatoareCompensate).toBe(8);
    expect(rezultat.oreSarbatoareDePlata).toBe(10);
  });

  it("problemele se acumulează în ordinea înregistrărilor", () => {
    expect(coduri(rezultat.probleme)).toEqual([
      COD_ORE_SUPL_EXPIRATE,
      COD_ORE_SUPL_NECOMPENSATE,
      COD_ZI_LIBERA_SARBATOARE_NEACORDATA,
    ]);
  });

  it("nu amestecă orele de sărbătoare cu cele suplimentare", () => {
    expect(rezultat.oreDePlata).not.toBe(rezultat.oreSarbatoareDePlata);
  });
});

describe("calculeazaCompensarea — puritate", () => {
  it("aceeași intrare dă același rezultat", () => {
    const date = intrare({
      suplimentare: [suplimentare({ ore: 7.5, termenFolosire: "2026-07-02" })],
      sarbatori: [sarbatoare({ termenAcordare: "2026-02-28" })],
    });
    expect(calculeazaCompensarea(date)).toEqual(calculeazaCompensarea(date));
  });

  it("nu modifică listele primite", () => {
    const listaSuplimentare = [suplimentare({ ore: 8 })];
    const listaSarbatori = [sarbatoare()];
    calculeazaCompensarea(intrare({ suplimentare: listaSuplimentare, sarbatori: listaSarbatori }));
    expect(listaSuplimentare).toHaveLength(1);
    expect(listaSuplimentare[0]?.ore).toBe(8);
    expect(listaSarbatori[0]?.acordata).toBe(false);
  });
});

describe("adaugaZile — aritmetică de calendar fără obiect Date", () => {
  it("adună zile în interiorul aceleiași luni", () => {
    expect(adaugaZile("2026-06-01", 10)).toBe("2026-06-11");
  });

  it("zero zile întoarce aceeași dată", () => {
    expect(adaugaZile("2026-06-30", 0)).toBe("2026-06-30");
  });

  it("trece corect peste granița de lună", () => {
    expect(adaugaZile("2026-06-30", 1)).toBe("2026-07-01");
    expect(adaugaZile("2026-06-25", 15)).toBe("2026-07-10");
  });

  it("respectă lunile de 30 și de 31 de zile", () => {
    expect(adaugaZile("2026-04-30", 1)).toBe("2026-05-01");
    expect(adaugaZile("2026-05-31", 1)).toBe("2026-06-01");
    expect(adaugaZile("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("trece corect peste granița de an", () => {
    expect(adaugaZile("2026-12-31", 1)).toBe("2027-01-01");
    expect(adaugaZile("2026-12-20", 30)).toBe("2027-01-19");
  });

  it("traversează mai multe luni deodată", () => {
    // Cele 90 de zile din Codul muncii, pornind din ianuarie într-un an nebisect.
    expect(adaugaZile("2026-01-15", 90)).toBe("2026-04-15");
  });

  it("recunoaște 29 februarie într-un an bisect", () => {
    expect(adaugaZile("2024-02-28", 1)).toBe("2024-02-29");
    expect(adaugaZile("2024-02-29", 1)).toBe("2024-03-01");
    expect(adaugaZile("2024-02-01", 29)).toBe("2024-03-01");
  });

  it("sare peste 29 februarie într-un an nebisect", () => {
    expect(adaugaZile("2026-02-28", 1)).toBe("2026-03-01");
    expect(adaugaZile("2026-02-01", 28)).toBe("2026-03-01");
  });

  it("numără o zi în plus când traversează un februarie bisect", () => {
    // Aceeași plecare, ani diferiți: 2024 e bisect, 2026 nu.
    expect(adaugaZile("2024-01-31", 30)).toBe("2024-03-01");
    expect(adaugaZile("2026-01-31", 30)).toBe("2026-03-02");
  });

  it("aplică regula seculară: 2000 e bisect, 1900 și 2100 nu sunt", () => {
    expect(adaugaZile("2000-02-28", 1)).toBe("2000-02-29");
    expect(adaugaZile("1900-02-28", 1)).toBe("1900-03-01");
    expect(adaugaZile("2100-02-28", 1)).toBe("2100-03-01");
  });

  it("traversează un an întreg, bisect", () => {
    expect(adaugaZile("2024-01-01", 366)).toBe("2025-01-01");
    expect(adaugaZile("2025-01-01", 365)).toBe("2026-01-01");
  });

  it("păstrează zerourile din față în luni și zile", () => {
    expect(adaugaZile("2026-08-31", 1)).toBe("2026-09-01");
    expect(adaugaZile("2026-09-30", 2)).toBe("2026-10-02");
  });

  it("tratează un număr negativ sau nefinit de zile ca zero", () => {
    expect(adaugaZile("2026-06-30", -5)).toBe("2026-06-30");
    expect(adaugaZile("2026-06-30", Number.NaN)).toBe("2026-06-30");
  });

  it("trunchiază fracțiile de zi", () => {
    expect(adaugaZile("2026-06-01", 1.9)).toBe("2026-06-02");
  });

  it("întoarce neschimbat un șir care nu e o dată validă", () => {
    expect(adaugaZile("nu-e-o-data", 5)).toBe("nu-e-o-data");
    expect(adaugaZile("2026-13-01", 5)).toBe("2026-13-01");
    expect(adaugaZile("2026-02-30", 5)).toBe("2026-02-30");
  });
});
