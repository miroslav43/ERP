// src/domain/payroll/etape/indemnizatie-co.test.ts
//
// Invariantul pe care îl apără fișierul ăsta: art. 150 din Codul muncii nu dă
// două formule alternative, ci o formulă (media pe trei luni) și un planșeu
// (rata salariului de bază). Orice test de mai jos care ar începe să treacă cu
// „cea mai mică dintre cele două" înseamnă că angajatul e plătit sub lege.

import { describe, expect, it } from "vitest";

import {
  calculeazaIndemnizatieCo,
  type IntrareIndemnizatieCo,
  type LunaIstoricCo,
  type ModCalculCo,
} from "./indemnizatie-co";

/** O lună de istoric, scrisă scurt. Anul și luna nu intră în calcul. */
function luna(drepturiSalariale: number, zileLucrate: number, indice = 1): LunaIstoricCo {
  return { an: 2026, luna: indice, drepturiSalariale, zileLucrate };
}

function intrare(peste: Partial<IntrareIndemnizatieCo> = {}): IntrareIndemnizatieCo {
  return {
    mod: "cea_mai_avantajoasa",
    zileConcediu: 10,
    salariuBaza: 5000,
    zileLucratoareLuna: 20,
    istoric: [luna(6000, 20, 3), luna(6000, 20, 2), luna(6000, 20, 1)],
    luniNecesare: 3,
    ...peste,
  };
}

const TOATE_MODURILE: readonly ModCalculCo[] = ["baza", "media_3_luni", "cea_mai_avantajoasa"];

describe("rata zilnică a salariului de bază", () => {
  it("e salariul de bază împărțit la zilele lucrătoare ale lunii", () => {
    const rezultat = calculeazaIndemnizatieCo(intrare({ mod: "baza" }));

    expect(rezultat.rataZilnicaBaza).toBe(250);
  });

  it("suma se calculează din rata EXACTĂ, nu din cea afișată", () => {
    // 5000 / 21 = 238,095238... Rata afișată e rotunjită la 238,10, dar suma
    // NU se calculează din ea: 238,095238 x 3 = 714,29, nu 714,30.
    //
    // Diferența pare neînsemnată până e privită pe an: rotunjirea ratei
    // înainte de înmulțire adaugă bani care nu există, pe fiecare angajat, în
    // fiecare lună. Vezi testul „o RATĂ nu se materializează niciodată în
    // bani" din `src/domain/bani.test.ts`.
    const rezultat = calculeazaIndemnizatieCo(
      intrare({ mod: "baza", salariuBaza: 5000, zileLucratoareLuna: 21, zileConcediu: 3 }),
    );

    expect(rezultat.rataZilnicaBaza).toBe(238.1);
    expect(rezultat.suma).toBe(714.29);
  });

  it("INVARIANT: o lună întreagă de concediu dă exact salariul lunii", () => {
    // Proba pe care o face contabilul întâi. Cu rata rotunjită înainte de
    // înmulțire, 21 x 238,10 ar da 5000,10 — zece bani apăruți din nimic.
    for (const [salariu, zile] of [
      [5000, 21],
      [4321, 19],
      [3000, 23],
      [7777, 20],
    ] as const) {
      const rezultat = calculeazaIndemnizatieCo(
        intrare({
          mod: "baza",
          salariuBaza: salariu,
          zileLucratoareLuna: zile,
          zileConcediu: zile,
        }),
      );
      expect(rezultat.suma, `${String(salariu)} lei / ${String(zile)} zile`).toBe(salariu);
    }
  });

  it("zilele lucrătoare zero sau negative opresc calculul, nu produc o sumă infinită", () => {
    expect(() => calculeazaIndemnizatieCo(intrare({ zileLucratoareLuna: 0 }))).toThrow(RangeError);
    expect(() => calculeazaIndemnizatieCo(intrare({ zileLucratoareLuna: -5 }))).toThrow(RangeError);
    expect(() => calculeazaIndemnizatieCo(intrare({ zileLucratoareLuna: 0 }))).toThrow(
      /strict pozitiv/,
    );
  });
});

describe("media zilnică a perioadei de referință", () => {
  it("se calculează pe totaluri, nu ca medie a mediilor lunare", () => {
    // 6000/5 = 1200 pe zi într-o lună scurtă, 4200/21 = 200 în celelalte două.
    // Media mediilor ar da 533,33; media pe totaluri dă (6000+4200+4200)/47.
    const rezultat = calculeazaIndemnizatieCo(
      intrare({
        mod: "media_3_luni",
        istoric: [luna(6000, 5, 3), luna(4200, 21, 2), luna(4200, 21, 1)],
      }),
    );

    expect(rezultat.rataZilnicaMedie).toBe(306.38);
    expect(rezultat.luniFolosite).toBe(3);
  });

  it("folosește cel mult `luniNecesare` luni, luate din capul listei", () => {
    // A patra lună are drepturi duble; dacă ar intra în medie, rata ar crește.
    const rezultat = calculeazaIndemnizatieCo(
      intrare({
        mod: "media_3_luni",
        istoric: [luna(6000, 20, 4), luna(6000, 20, 3), luna(6000, 20, 2), luna(12000, 20, 1)],
      }),
    );

    expect(rezultat.rataZilnicaMedie).toBe(300);
    expect(rezultat.luniFolosite).toBe(3);
    expect(rezultat.probleme).toHaveLength(0);
  });

  it("respectă un `luniNecesare` diferit de 3", () => {
    const rezultat = calculeazaIndemnizatieCo(
      intrare({
        mod: "media_3_luni",
        luniNecesare: 2,
        istoric: [luna(6000, 20, 3), luna(6000, 20, 2), luna(12000, 20, 1)],
      }),
    );

    expect(rezultat.rataZilnicaMedie).toBe(300);
    expect(rezultat.luniFolosite).toBe(2);
    expect(rezultat.probleme).toHaveLength(0);
  });
});

describe("lunile fără zile lucrate", () => {
  it("nu intră în medie, oricât venit ar avea trecut pe ele", () => {
    // Luna a doua are 1500 lei și zero zile lucrate — o indemnizație plătită
    // fără prestație. Inclusă, ar urca media la 337,50 lei pe zi, dintr-o zi
    // care nu s-a lucrat niciodată.
    const rezultat = calculeazaIndemnizatieCo(
      intrare({
        mod: "media_3_luni",
        istoric: [luna(6000, 20, 3), luna(1500, 0, 2), luna(6000, 20, 1)],
      }),
    );

    expect(rezultat.rataZilnicaMedie).toBe(300);
    expect(rezultat.luniFolosite).toBe(2);
  });

  it("nu consumă un loc din perioada de referință — căutarea merge mai în spate", () => {
    const rezultat = calculeazaIndemnizatieCo(
      intrare({
        mod: "media_3_luni",
        istoric: [luna(0, 0, 4), luna(6000, 20, 3), luna(6000, 20, 2), luna(6000, 20, 1)],
      }),
    );

    expect(rezultat.luniFolosite).toBe(3);
    expect(rezultat.rataZilnicaMedie).toBe(300);
    expect(rezultat.probleme).toHaveLength(0);
  });
});

describe("modul „baza”", () => {
  it("aplică rata de bază și nu calculează deloc media", () => {
    const rezultat = calculeazaIndemnizatieCo(intrare({ mod: "baza" }));

    expect(rezultat.rataZilnicaAplicata).toBe(250);
    expect(rezultat.rataZilnicaMedie).toBeNull();
    expect(rezultat.luniFolosite).toBe(0);
    expect(rezultat.suma).toBe(2500);
  });

  it("nu raportează nimic despre istoric, nici măcar când e gol", () => {
    // N-a fost consultat, deci n-are ce reproșa. Un avertisment aici ar fi un
    // reproș la o alegere pe care organizația a făcut-o deliberat.
    const rezultat = calculeazaIndemnizatieCo(intrare({ mod: "baza", istoric: [] }));

    expect(rezultat.probleme).toHaveLength(0);
    expect(rezultat.rataZilnicaAplicata).toBe(250);
  });
});

describe("modul „media_3_luni”", () => {
  it("aplică media când e peste rata de bază", () => {
    const rezultat = calculeazaIndemnizatieCo(intrare({ mod: "media_3_luni" }));

    expect(rezultat.rataZilnicaMedie).toBe(300);
    expect(rezultat.rataZilnicaAplicata).toBe(300);
    expect(rezultat.suma).toBe(3000);
    expect(rezultat.probleme).toHaveLength(0);
  });

  it("aplică media și când e SUB rata de bază — modul cere media, nu planșeul", () => {
    const rezultat = calculeazaIndemnizatieCo(
      intrare({
        mod: "media_3_luni",
        salariuBaza: 6000,
        istoric: [luna(5000, 20, 3), luna(5000, 20, 2), luna(5000, 20, 1)],
        zileConcediu: 5,
      }),
    );

    expect(rezultat.rataZilnicaBaza).toBe(300);
    expect(rezultat.rataZilnicaMedie).toBe(250);
    expect(rezultat.rataZilnicaAplicata).toBe(250);
    expect(rezultat.suma).toBe(1250);
    // `SAL_CO_MEDIA_MAI_MICA` e informativ DOAR în modul care compară.
    expect(rezultat.probleme).toHaveLength(0);
  });

  it("cade pe rata de bază când nu există nicio lună utilizabilă", () => {
    const rezultat = calculeazaIndemnizatieCo(intrare({ mod: "media_3_luni", istoric: [] }));

    expect(rezultat.rataZilnicaMedie).toBeNull();
    expect(rezultat.rataZilnicaAplicata).toBe(250);
    expect(rezultat.suma).toBe(2500);
    expect(rezultat.probleme.map((p) => p.cod)).toEqual(["SAL_CO_FARA_ISTORIC"]);
  });
});

describe("modul „cea_mai_avantajoasa”", () => {
  it("alege media când e mai mare decât baza", () => {
    const rezultat = calculeazaIndemnizatieCo(intrare());

    expect(rezultat.rataZilnicaBaza).toBe(250);
    expect(rezultat.rataZilnicaMedie).toBe(300);
    expect(rezultat.rataZilnicaAplicata).toBe(300);
    expect(rezultat.suma).toBe(3000);
    expect(rezultat.probleme).toHaveLength(0);
  });

  it("alege baza când media e mai mică și spune de ce", () => {
    // Planșeul din art. 150 alin. (1): angajatul care a primit o majorare nu
    // poate fi plătit în concediu la venitul de dinaintea ei.
    const rezultat = calculeazaIndemnizatieCo(
      intrare({
        salariuBaza: 6000,
        istoric: [luna(5000, 20, 3), luna(5000, 20, 2), luna(5000, 20, 1)],
        zileConcediu: 5,
      }),
    );

    expect(rezultat.rataZilnicaAplicata).toBe(300);
    expect(rezultat.rataZilnicaMedie).toBe(250);
    expect(rezultat.suma).toBe(1500);
    expect(rezultat.probleme.map((p) => p.cod)).toEqual(["SAL_CO_MEDIA_MAI_MICA"]);
    expect(rezultat.probleme[0]?.detalii).toContain("250.00");
    expect(rezultat.probleme[0]?.detalii.endsWith(".")).toBe(true);
  });

  it("la egalitate perfectă nu raportează nimic — planșeul nu e încălcat", () => {
    const rezultat = calculeazaIndemnizatieCo(
      intrare({ istoric: [luna(5000, 20, 3), luna(5000, 20, 2), luna(5000, 20, 1)] }),
    );

    expect(rezultat.rataZilnicaMedie).toBe(250);
    expect(rezultat.rataZilnicaAplicata).toBe(250);
    expect(rezultat.probleme).toHaveLength(0);
  });

  it("ignoră media inexistentă și cade pe bază", () => {
    const rezultat = calculeazaIndemnizatieCo(intrare({ istoric: [luna(1500, 0, 1)] }));

    expect(rezultat.rataZilnicaMedie).toBeNull();
    expect(rezultat.rataZilnicaAplicata).toBe(250);
    expect(rezultat.luniFolosite).toBe(0);
    expect(rezultat.probleme.map((p) => p.cod)).toEqual(["SAL_CO_FARA_ISTORIC"]);
  });
});

describe("istoricul incomplet", () => {
  it("dă `SAL_CO_MEDIE_INCOMPLETA` cu numărul găsit și cel cerut", () => {
    const rezultat = calculeazaIndemnizatieCo(
      intrare({ istoric: [luna(6000, 20, 2), luna(6000, 20, 1)] }),
    );

    expect(rezultat.luniFolosite).toBe(2);
    expect(rezultat.rataZilnicaMedie).toBe(300);
    expect(rezultat.probleme.map((p) => p.cod)).toEqual(["SAL_CO_MEDIE_INCOMPLETA"]);
    expect(rezultat.probleme[0]?.detalii).toContain("2");
    expect(rezultat.probleme[0]?.detalii).toContain("3");
    expect(rezultat.probleme[0]?.detalii.endsWith(".")).toBe(true);
  });

  it("numără lunile UTILIZABILE, nu lungimea listei primite", () => {
    // Trei luni în listă, dar una fără zile lucrate: media stă pe două luni,
    // deci e incompletă — altfel media parțială ar trece tăcut drept completă.
    const rezultat = calculeazaIndemnizatieCo(
      intrare({ istoric: [luna(6000, 20, 3), luna(0, 0, 2), luna(6000, 20, 1)] }),
    );

    expect(rezultat.luniFolosite).toBe(2);
    expect(rezultat.probleme.map((p) => p.cod)).toEqual(["SAL_CO_MEDIE_INCOMPLETA"]);
  });

  it("istoricul gol dă doar `SAL_CO_FARA_ISTORIC`, fără să-l dubleze cu «incomplet»", () => {
    const rezultat = calculeazaIndemnizatieCo(intrare({ istoric: [] }));

    expect(rezultat.probleme.map((p) => p.cod)).toEqual(["SAL_CO_FARA_ISTORIC"]);
  });

  it("poate raporta și incompletitudinea, și aplicarea bazei, în aceeași lună", () => {
    const rezultat = calculeazaIndemnizatieCo(
      intrare({ salariuBaza: 6000, istoric: [luna(5000, 20, 1)] }),
    );

    expect(rezultat.rataZilnicaAplicata).toBe(300);
    expect(rezultat.probleme.map((p) => p.cod)).toEqual([
      "SAL_CO_MEDIE_INCOMPLETA",
      "SAL_CO_MEDIA_MAI_MICA",
    ]);
  });
});

describe("luna fără zile de concediu", () => {
  it("dă sumă zero și nicio problemă, dar calculează ratele", () => {
    // Avertismentele despre istoric n-au consecință dacă nu se plătește nimic.
    // Raportate oricum, ar apărea pe fluturașul fiecărei luni fără concediu.
    const rezultat = calculeazaIndemnizatieCo(
      intrare({ zileConcediu: 0, salariuBaza: 6000, istoric: [luna(5000, 20, 1)] }),
    );

    expect(rezultat.suma).toBe(0);
    expect(rezultat.probleme).toHaveLength(0);
    expect(rezultat.rataZilnicaBaza).toBe(300);
    expect(rezultat.rataZilnicaMedie).toBe(250);
    expect(rezultat.rataZilnicaAplicata).toBe(300);
    expect(rezultat.luniFolosite).toBe(1);
  });

  it("tace în oricare dintre cele trei moduri", () => {
    for (const mod of TOATE_MODURILE) {
      const rezultat = calculeazaIndemnizatieCo(intrare({ mod, zileConcediu: 0, istoric: [] }));

      expect(rezultat.suma).toBe(0);
      expect(rezultat.probleme).toHaveLength(0);
      expect(rezultat.rataZilnicaAplicata).toBe(250);
    }
  });
});

describe("invariantele rezultatului", () => {
  it("suma nu se abate de la rata afișată cu mai mult de un ban pe zi", () => {
    // Suma vine din rata exactă, deci nu egalează întotdeauna produsul ratei
    // AFIȘATE cu zilele. Abaterea e mărginită de rotunjirea ratei: cel mult
    // jumătate de ban pe zi. Testul prinde atât o revenire la rotunjirea
    // prematură, cât și o rată aplicată complet greșită.
    for (const mod of TOATE_MODURILE) {
      for (const zileConcediu of [0, 1, 5, 21]) {
        const rezultat = calculeazaIndemnizatieCo(
          intrare({ mod, zileConcediu, salariuBaza: 4321, zileLucratoareLuna: 19 }),
        );
        const dinRataAfisata = rezultat.rataZilnicaAplicata * zileConcediu;

        expect(
          Math.abs(rezultat.suma - dinRataAfisata),
          `${mod}, ${String(zileConcediu)} zile`,
        ).toBeLessThanOrEqual(0.005 * zileConcediu + 0.005);
      }
    }
  });

  it("rata aplicată e una dintre cele două calculate, niciodată o a treia", () => {
    for (const mod of TOATE_MODURILE) {
      const rezultat = calculeazaIndemnizatieCo(intrare({ mod }));
      const candidati = [rezultat.rataZilnicaBaza, rezultat.rataZilnicaMedie];

      expect(candidati).toContain(rezultat.rataZilnicaAplicata);
    }
  });

  it("în modul avantajos rata aplicată nu coboară niciodată sub planșeul de bază", () => {
    const istorice: readonly (readonly LunaIstoricCo[])[] = [
      [],
      [luna(1000, 20, 1)],
      [luna(9000, 20, 2), luna(9000, 20, 1)],
      [luna(0, 0, 1)],
    ];

    for (const istoric of istorice) {
      const rezultat = calculeazaIndemnizatieCo(intrare({ istoric }));

      expect(rezultat.rataZilnicaAplicata).toBeGreaterThanOrEqual(rezultat.rataZilnicaBaza);
    }
  });
});
