// src/domain/payroll/contabil/nota.test.ts
//
// Invariantul pe care îl apără fișierul ăsta: nota de salarii SE ÎNCHIDE.
// Suma debitelor egalează suma creditelor, pentru orice set de totaluri coerent
// — lună completă, lună fără avansuri, lună cu sume mărunte, lună goală. Dacă
// vreun test de mai jos începe să treacă cu `echilibrata: false` „acceptabil",
// înseamnă că se pot trimite în contabilitate note pe care balanța le respinge.
//
// Al doilea invariant, la fel de important: când totalurile NU sunt coerente,
// nota nu se aranjează singură ca să pară închisă. Ridică
// `SAL_NOTA_DEZECHILIBRATA` și lasă cifrele așa cum sunt.
//
// Conturile din teste sunt planul de conturi general, dar intră ca DATE, exact
// ca la o organizație reală — niciun cod de cont nu e citit din implementare.

import { describe, expect, it } from "vitest";

import { rotunjesteLaBani } from "../../bani";
import {
  construiesteNota,
  type ConturiNota,
  type LinieNota,
  type RezultatNota,
  type TotaluriPerioada,
} from "./nota";

/** Maparea uzuală din planul de conturi general. Se poate suprascrie punctual. */
function conturi(peste: Partial<ConturiNota> = {}): ConturiNota {
  return {
    cheltuialaSalarii: "641",
    cheltuialaContributieAngajator: "6451",
    salariiDatorate: "421",
    casRetinut: "4315",
    cassRetinut: "4316",
    impozit: "444",
    retineriTerti: "427",
    avansuri: "425",
    ...peste,
  };
}

/**
 * Totalurile unei luni. `restDePlata` se DEDUCE din celelalte, ca în realitate,
 * ca să nu fie nevoie de o cifră recalculată de mână la fiecare variantă. Cine
 * vrea un rest incoerent — cazul de dezechilibru — îl dă explicit.
 */
function totaluri(peste: Partial<TotaluriPerioada> = {}): TotaluriPerioada {
  const partial = {
    brut: 5000,
    cas: 1250,
    cass: 500,
    impozit: 325,
    camAngajator: 112.5,
    avansuri: 500,
    retineriTerti: 200,
    ...peste,
  };
  const restDedus = rotunjesteLaBani(
    partial.brut -
      partial.cas -
      partial.cass -
      partial.impozit -
      partial.avansuri -
      partial.retineriTerti,
  );
  return { ...partial, restDePlata: peste.restDePlata ?? restDedus };
}

function linia(rezultat: RezultatNota, cont: string): LinieNota | undefined {
  return rezultat.linii.find((linie) => linie.cont === cont);
}

function coduri(rezultat: RezultatNota): readonly string[] {
  return rezultat.probleme.map((problema) => problema.cod);
}

describe("nota unei luni complete", () => {
  // Brut 5000, CAS 25% = 1250, CASS 10% = 500, impozit 325, CAM 2,25% = 112,50,
  // un avans de 500 și o reținere de 200. Restul de plată: 2225.
  const rezultat = construiesteNota(totaluri(), conturi());

  it("are toate cele opt linii, debitele înaintea creditelor", () => {
    expect(rezultat.linii.map((linie) => linie.cont)).toEqual([
      "641",
      "6451",
      "4315",
      "4316",
      "444",
      "425",
      "427",
      "421",
    ]);
  });

  it("trece fondul brut în debitul contului de cheltuială cu salariile", () => {
    expect(linia(rezultat, "641")).toMatchObject({ debit: 5000, credit: 0 });
  });

  it("trece contribuția angajatorului în debit și tot pe atât în credit", () => {
    // CAM e o cheltuială a angajatorului ȘI o datorie a lui: apare o dată pe
    // fiecare parte, deci nu poate dezechilibra nota, oricare i-ar fi valoarea.
    expect(linia(rezultat, "6451")).toMatchObject({ debit: 112.5, credit: 0 });
    expect(linia(rezultat, "444")?.credit).toBe(325 + 112.5);
  });

  it("creditează reținerile din salariu pe conturile lor", () => {
    expect(linia(rezultat, "4315")).toMatchObject({ credit: 1250, debit: 0 });
    expect(linia(rezultat, "4316")).toMatchObject({ credit: 500, debit: 0 });
    expect(linia(rezultat, "425")).toMatchObject({ credit: 500, debit: 0 });
    expect(linia(rezultat, "427")).toMatchObject({ credit: 200, debit: 0 });
  });

  it("lasă în contul de personal exact restul de plată", () => {
    expect(linia(rezultat, "421")).toMatchObject({ credit: 2225, debit: 0 });
  });

  it("se închide: 5112,50 lei pe fiecare parte", () => {
    expect(rezultat.totalDebit).toBe(5112.5);
    expect(rezultat.totalCredit).toBe(5112.5);
    expect(rezultat.echilibrata).toBe(true);
    expect(rezultat.probleme).toEqual([]);
  });

  it("spune pe linia de impozit că sunt două obligații la un loc", () => {
    // ⚠️ Cumulul impozit + CAM pe același cont e o alegere impusă de maparea cu
    // opt conturi, nu practica din planul general (unde CAM stă în 436).
    // Reconcilierea cu D112 se face pe fiecare separat, deci nota trebuie s-o
    // spună, altfel diferența e descoperită abia la control.
    expect(linia(rezultat, "444")?.explicatie).toContain("contribuția asigurătorie pentru muncă");
  });
});

describe("liniile de zero nu intră în notă", () => {
  it("o lună fără avansuri și fără rețineri n-are liniile lor", () => {
    const rezultat = construiesteNota(totaluri({ avansuri: 0, retineriTerti: 0 }), conturi());

    expect(rezultat.linii.map((linie) => linie.cont)).toEqual([
      "641",
      "6451",
      "4315",
      "4316",
      "444",
      "421",
    ]);
    expect(linia(rezultat, "425")).toBeUndefined();
    expect(linia(rezultat, "427")).toBeUndefined();
    // Restul de plată crește exact cu ce nu s-a mai reținut, iar nota se închide
    // la fel de bine cu șase linii ca și cu opt.
    expect(linia(rezultat, "421")?.credit).toBe(2925);
    expect(rezultat.echilibrata).toBe(true);
  });

  it("o lună în care reținerile epuizează netul n-are linie de salarii datorate", () => {
    // ⚠️ Cazul lipsea. Setul „reținere mare, care duce restul de plată la zero"
    // din invariantul de mai jos îl construia, dar nu verifica decât echilibrul
    // — adică exact partea care rămâne adevărată și dacă linia de 421 ar fi
    // rămas în notă cu zero. Nota rezultată n-are NICIUN cont de personal: e
    // corectă, dar e lucrul pe care cineva trebuie să-l vadă scris undeva,
    // fiindcă la prima vedere arată ca o notă din care lipsește un rând.
    const rezultat = construiesteNota(
      totaluri({
        brut: 7333.33,
        cas: 1833.33,
        cass: 733.33,
        impozit: 476.67,
        camAngajator: 165,
        avansuri: 0,
        retineriTerti: 4290,
      }),
      conturi(),
    );

    expect(linia(rezultat, "421")).toBeUndefined();
    expect(rezultat.linii.map((linie) => linie.cont)).toEqual([
      "641",
      "6451",
      "4315",
      "4316",
      "444",
      "427",
    ]);
    expect(rezultat.echilibrata).toBe(true);
  });

  it("INVARIANT: nicio linie a notei nu are debit și credit zero", () => {
    const cazuri: readonly TotaluriPerioada[] = [
      totaluri(),
      totaluri({ avansuri: 0 }),
      totaluri({ retineriTerti: 0 }),
      totaluri({ camAngajator: 0 }),
      totaluri({ avansuri: 0, retineriTerti: 0, camAngajator: 0 }),
      // Restul de plată zero — singurul caz în care lipsește contul de personal.
      totaluri({ brut: 1000, cas: 250, cass: 100, impozit: 65, avansuri: 0, retineriTerti: 585 }),
    ];

    for (const caz of cazuri) {
      for (const linie of construiesteNota(caz, conturi()).linii) {
        expect(linie.debit !== 0 || linie.credit !== 0).toBe(true);
      }
    }
  });

  it("o perioadă fără nicio sumă nu produce nicio linie", () => {
    const goale: TotaluriPerioada = {
      brut: 0,
      cas: 0,
      cass: 0,
      impozit: 0,
      camAngajator: 0,
      avansuri: 0,
      retineriTerti: 0,
      restDePlata: 0,
    };

    const rezultat = construiesteNota(goale, conturi());

    expect(rezultat.linii).toEqual([]);
    expect(rezultat.totalDebit).toBe(0);
    expect(rezultat.totalCredit).toBe(0);
    // Zero egalează zero: o notă goală e echilibrată. Faptul că n-are ce
    // înregistra e treaba apelantului, nu un dezechilibru.
    expect(rezultat.echilibrata).toBe(true);
  });
});

describe("INVARIANT: nota se închide, indiferent de cifre", () => {
  const SETURI: readonly { readonly nume: string; readonly totaluri: TotaluriPerioada }[] = [
    {
      nume: "lună completă, cu avans și rețineri",
      totaluri: totaluri(),
    },
    {
      nume: "salariu minim, fără avans și fără rețineri",
      // ⚠️ Cifrele sunt plauzibile, nu normative — nu se folosesc ca referință
      // pentru salariul minim al vreunui an.
      totaluri: totaluri({
        brut: 4050,
        cas: 1013,
        cass: 405,
        impozit: 152,
        camAngajator: 91.13,
        avansuri: 0,
        retineriTerti: 0,
      }),
    },
    {
      nume: "sume cu bani, care nu se împart rotund",
      totaluri: totaluri({
        brut: 12345.67,
        cas: 3086.42,
        cass: 1234.57,
        impozit: 800.34,
        camAngajator: 277.78,
        avansuri: 1000,
        retineriTerti: 333.33,
      }),
    },
    {
      nume: "reținere mare, care duce restul de plată la zero",
      totaluri: totaluri({
        brut: 7333.33,
        cas: 1833.33,
        cass: 733.33,
        impozit: 476.67,
        camAngajator: 165,
        avansuri: 0,
        retineriTerti: 4290,
      }),
    },
    {
      nume: "fără contribuția angajatorului",
      totaluri: totaluri({ camAngajator: 0 }),
    },
  ];

  for (const set of SETURI) {
    it(`debitul egalează creditul — ${set.nume}`, () => {
      const rezultat = construiesteNota(set.totaluri, conturi());

      expect(rezultat.totalDebit).toBe(rezultat.totalCredit);
      expect(rezultat.echilibrata).toBe(true);
      expect(coduri(rezultat)).not.toContain("SAL_NOTA_DEZECHILIBRATA");
    });

    it(`fiecare total e suma componentelor lui de intrare — ${set.nume}`, () => {
      // ⚠️ Testul de aici se chema „totalurile sunt suma liniilor tipărite" și
      // era o TAUTOLOGIE: aduna exact valorile pe care implementarea le pusese
      // pe linii și le compara cu acumulatorul din care implementarea își
      // făcuse totalul — aceleași numere, în aceeași ordine. Nu putea pica.
      // Comentariul lui pretindea că prinde rotunjirea mutată de pe intrări pe
      // totaluri; proba a fost făcută, scoțând `rotunjesteLaBani` din
      // construcția lui `sume`: toate cele cinci instanțe au trecut mai
      // departe (au picat alte două teste, nu ele).
      //
      // Invariantul care contează e „partea însumează întregul", cu întregul
      // calculat din INTRĂRI, independent de implementare. Așa se prinde și
      // clasa de defecte pe care egalitatea debit = credit o ratează: o
      // componentă omisă, dublată sau pusă pe partea greșită, care lasă nota
      // închisă (CAM scos din ambele părți, de pildă) dar nota e alta.
      const intrari = set.totaluri;
      const rezultat = construiesteNota(intrari, conturi());

      const debitAsteptat = rotunjesteLaBani(
        rotunjesteLaBani(intrari.brut) + rotunjesteLaBani(intrari.camAngajator),
      );
      const creditAsteptat = rotunjesteLaBani(
        rotunjesteLaBani(intrari.cas) +
          rotunjesteLaBani(intrari.cass) +
          rotunjesteLaBani(intrari.impozit) +
          rotunjesteLaBani(intrari.camAngajator) +
          rotunjesteLaBani(intrari.avansuri) +
          rotunjesteLaBani(intrari.retineriTerti) +
          rotunjesteLaBani(intrari.restDePlata),
      );

      expect(rezultat.totalDebit).toBe(debitAsteptat);
      expect(rezultat.totalCredit).toBe(creditAsteptat);

      // Și proba pe care o face contabilul cu creionul: adună coloana tipărită
      // și compară cu totalul de sub ea. Slabă singură — de-asta nu mai e
      // singură — dar prinde o linie tipărită cu altă sumă decât cea adunată.
      const adunatDebit = rezultat.linii.reduce((total, linie) => total + linie.debit, 0);
      const adunatCredit = rezultat.linii.reduce((total, linie) => total + linie.credit, 0);

      expect(rotunjesteLaBani(adunatDebit)).toBe(debitAsteptat);
      expect(rotunjesteLaBani(adunatCredit)).toBe(creditAsteptat);
    });
  }

  it("zgomotul de virgulă mobilă nu trece drept dezechilibru", () => {
    // 0,1 + 0,2 dă 0,30000000000000004 în virgulă mobilă. Fără rotunjirea
    // totalurilor, nota de mai jos ar fi raportată dezechilibrată cu o
    // diferență de 1e-16 lei — o sumă care nu există.
    const rezultat = construiesteNota(
      totaluri({
        brut: 0.7,
        cas: 0.1,
        cass: 0.2,
        impozit: 0.3,
        camAngajator: 0,
        avansuri: 0.1,
        retineriTerti: 0,
      }),
      conturi(),
    );

    expect(rezultat.totalDebit).toBe(0.7);
    expect(rezultat.totalCredit).toBe(0.7);
    expect(rezultat.echilibrata).toBe(true);
  });
});

describe("poarta de dezechilibru", () => {
  it("prinde restul de plată calculat ca salariu net, fără avans și rețineri", () => {
    // Greșeala clasică: „rest de plată" completat cu netul (brut − contribuții −
    // impozit = 2925), în timp ce avansul și reținerea sunt creditate încă o
    // dată pe liniile lor. Nota iese umflată cu exact 700 de lei.
    const rezultat = construiesteNota(totaluri({ restDePlata: 2925 }), conturi());

    expect(rezultat.echilibrata).toBe(false);
    expect(coduri(rezultat)).toContain("SAL_NOTA_DEZECHILIBRATA");
  });

  it("spune ambele totaluri și diferența, ca să se vadă cât lipsește", () => {
    const rezultat = construiesteNota(totaluri({ restDePlata: 2925 }), conturi());
    const problema = rezultat.probleme.find(
      (candidat) => candidat.cod === "SAL_NOTA_DEZECHILIBRATA",
    );

    expect(problema?.detalii).toContain("5112,50");
    expect(problema?.detalii).toContain("5812,50");
    expect(problema?.detalii).toContain("-700,00");
  });

  it("nu raportează dezechilibru pe o notă care se închide", () => {
    const rezultat = construiesteNota(totaluri(), conturi());

    expect(coduri(rezultat)).not.toContain("SAL_NOTA_DEZECHILIBRATA");
  });
});

describe("valorile negative", () => {
  it("raportează totalul negativ, cu numele lui în clar", () => {
    const rezultat = construiesteNota(totaluri({ retineriTerti: -200 }), conturi());
    const problema = rezultat.probleme.find(
      (candidat) => candidat.cod === "SAL_NOTA_VALOARE_NEGATIVA",
    );

    expect(problema).toBeDefined();
    expect(problema?.detalii).toContain("retineriTerti");
    expect(problema?.detalii).toContain("-200,00");
  });

  it("raportează fiecare total negativ separat, nu doar primul", () => {
    const rezultat = construiesteNota(totaluri({ avansuri: -100, retineriTerti: -200 }), conturi());

    expect(
      rezultat.probleme.filter((problema) => problema.cod === "SAL_NOTA_VALOARE_NEGATIVA"),
    ).toHaveLength(2);
  });

  it("un total negativ NU dezactivează verificarea echilibrului", () => {
    // Semnul se propagă simetric, deci nota se poate închide perfect cu o sumă
    // negativă în ea. Dacă singurul semnal ar fi echilibrul, greșeala ar trece.
    const rezultat = construiesteNota(totaluri({ retineriTerti: -200 }), conturi());

    expect(rezultat.echilibrata).toBe(true);
    expect(coduri(rezultat)).toContain("SAL_NOTA_VALOARE_NEGATIVA");
  });

  it("nu raportează nimic pentru totaluri de zero", () => {
    const rezultat = construiesteNota(
      totaluri({ avansuri: 0, retineriTerti: 0, camAngajator: 0 }),
      conturi(),
    );

    expect(coduri(rezultat)).not.toContain("SAL_NOTA_VALOARE_NEGATIVA");
  });
});

describe("totalurile nefinite rup nota, nu o produc", () => {
  // ⚠️ Contractul din JSDoc promitea `@throws RangeError`, dar niciun test nu-l
  // verifica: garanția venea indirect, din `rotunjesteLaBani`, cu mesajul lui
  // generic „O sumă trebuie să fie un număr finit." — care nu spune CARE total.
  // Un `NaN` scăpat dintr-o etapă anterioară (o împărțire la zero pe zile
  // lucrătoare, de pildă) trebuie să oprească nota și să spună de unde vine.

  // Totalurile se scriu aici pe litere, nu prin `totaluri()`: helper-ul deduce
  // restul de plată printr-o scădere, iar o valoare nefinită în ea l-ar face pe
  // EL să arunce. Testul ar fi trecut fără ca `construiesteNota` să fie apelată
  // vreodată — exact genul de test care nu testează nimic.
  const coerente: TotaluriPerioada = {
    brut: 5000,
    cas: 1250,
    cass: 500,
    impozit: 325,
    camAngajator: 112.5,
    avansuri: 500,
    retineriTerti: 200,
    restDePlata: 2225,
  };

  const nefinite: readonly (readonly [string, number])[] = [
    ["NaN", Number.NaN],
    ["plus infinit", Number.POSITIVE_INFINITY],
    ["minus infinit", Number.NEGATIVE_INFINITY],
  ];

  for (const [nume, valoare] of nefinite) {
    it(`aruncă RangeError pentru ${nume}`, () => {
      expect(() => construiesteNota({ ...coerente, brut: valoare }, conturi())).toThrow(RangeError);
    });
  }

  it("numește totalul vinovat, ca să se știe ce etapă s-a rupt", () => {
    // Mesajul lui `rotunjesteLaBani` („O sumă trebuie să fie un număr finit.")
    // e adevărat și inutil: la capătul a ~40 de pași singura întrebare e CARE
    // sumă. Aserția e pe numele câmpului, nu pe fraza din jur.
    expect(() => construiesteNota({ ...coerente, camAngajator: Number.NaN }, conturi())).toThrow(
      /camAngajator/,
    );
    expect(() =>
      construiesteNota({ ...coerente, restDePlata: Number.POSITIVE_INFINITY }, conturi()),
    ).toThrow(/restDePlata/);
  });

  it("se rupe înainte de a construi ceva — niciun rezultat parțial", () => {
    // Verificarea stă ÎNAINTEA rotunjirii, deci un total nefinit oprește nota
    // oricare i-ar fi poziția în ordine, nu doar dacă e primul rotunjit.
    let rezultat: RezultatNota | undefined;

    expect(() => {
      rezultat = construiesteNota({ ...coerente, retineriTerti: Number.NaN }, conturi());
    }).toThrow(RangeError);
    expect(rezultat).toBeUndefined();
  });
});

describe("codurile de cont lipsă", () => {
  it("raportează contul gol al unei linii care intră în notă", () => {
    const rezultat = construiesteNota(totaluri(), conturi({ impozit: "" }));
    const problema = rezultat.probleme.find((candidat) => candidat.cod === "SAL_NOTA_CONT_LIPSA");

    expect(problema).toBeDefined();
    expect(problema?.detalii).toContain("impozit");
  });

  it("tratează un cod format din spații ca pe unul lipsă", () => {
    const rezultat = construiesteNota(totaluri(), conturi({ salariiDatorate: "   " }));

    expect(coduri(rezultat)).toContain("SAL_NOTA_CONT_LIPSA");
  });

  it("păstrează linia fără cont, ca nota să nu pară închisă din alt motiv", () => {
    // Scoasă din notă, linia de 2225 de lei ar lăsa un dezechilibru de 2225 —
    // adică o problemă precisă („lipsește contul de personal") înlocuită cu una
    // vagă. Linia rămâne, cu contul gol, iar echilibrul rămâne adevărat.
    const rezultat = construiesteNota(totaluri(), conturi({ salariiDatorate: "" }));

    expect(rezultat.linii).toHaveLength(8);
    expect(rezultat.echilibrata).toBe(true);
    expect(rezultat.linii.some((linie) => linie.cont === "" && linie.credit === 2225)).toBe(true);
  });

  it("nu raportează contul gol al unei linii care oricum nu intră în notă", () => {
    // O firmă care nu acordă avansuri n-are de ce să completeze contul lor. Un
    // avertisment pe care nimeni nu-l poate închide se învață repede să fie
    // ignorat, și odată cu el se ignoră și cele reale.
    const rezultat = construiesteNota(
      totaluri({ avansuri: 0, retineriTerti: 0 }),
      conturi({ avansuri: "", retineriTerti: "" }),
    );

    expect(coduri(rezultat)).not.toContain("SAL_NOTA_CONT_LIPSA");
  });

  it("raportează câte o problemă pentru fiecare cont lipsă", () => {
    const rezultat = construiesteNota(
      totaluri(),
      conturi({ impozit: "", salariiDatorate: "", casRetinut: "" }),
    );

    expect(
      rezultat.probleme.filter((problema) => problema.cod === "SAL_NOTA_CONT_LIPSA"),
    ).toHaveLength(3);
  });
});

describe("rotunjirea la ban", () => {
  it("rotunjește fiecare sumă de intrare înainte de a o trece pe linie", () => {
    const rezultat = construiesteNota(totaluri({ camAngajator: 112.504 }), conturi());

    expect(linia(rezultat, "6451")?.debit).toBe(112.5);
    expect(linia(rezultat, "444")?.credit).toBe(437.5);
    expect(rezultat.echilibrata).toBe(true);
  });

  it("INVARIANT: nicio sumă din notă nu are mai mult de doi zecimali", () => {
    const rezultat = construiesteNota(
      totaluri({
        brut: 9876.5432,
        cas: 2469.1358,
        cass: 987.6543,
        impozit: 641.9753,
        camAngajator: 222.2222,
        avansuri: 1111.1111,
        retineriTerti: 333.3333,
      }),
      conturi(),
    );

    for (const linie of rezultat.linii) {
      expect(linie.debit).toBe(rotunjesteLaBani(linie.debit));
      expect(linie.credit).toBe(rotunjesteLaBani(linie.credit));
    }
    expect(rezultat.totalDebit).toBe(rotunjesteLaBani(rezultat.totalDebit));
    expect(rezultat.totalCredit).toBe(rotunjesteLaBani(rezultat.totalCredit));
  });
});

describe("conturile vin din configurație, nu din cod", () => {
  it("folosește analiticele organizației, oricare ar fi ele", () => {
    const rezultat = construiesteNota(
      totaluri(),
      conturi({
        cheltuialaSalarii: "641.01",
        salariiDatorate: "421.02",
        impozit: "444.PJ",
      }),
    );

    expect(linia(rezultat, "641.01")?.debit).toBe(5000);
    expect(linia(rezultat, "421.02")?.credit).toBe(2225);
    expect(linia(rezultat, "444.PJ")?.credit).toBe(437.5);
    expect(rezultat.echilibrata).toBe(true);
  });
});
