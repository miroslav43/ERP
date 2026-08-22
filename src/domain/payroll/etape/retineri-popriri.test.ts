// src/domain/payroll/etape/retineri-popriri.test.ts
//
// Invariantul pe care îl apără fișierul ăsta: plafonul urmăririi silite e o
// limită în FAVOAREA salariatului, iar ordinea reținerilor e o limită în
// favoarea creditorului de întreținere. Orice test de mai jos care ar începe
// să treacă cu sume mai mari decât plafonul înseamnă un salariu urmărit peste
// lege; orice test care ar începe să treacă cu întreținerea servită după o
// creanță comercială înseamnă o pensie alimentară plătită din ce rămâne.
//
// Al doilea invariant, verificabil cu creionul pe fluturaș:
// `totalRetinut + netRamas === net`, iar `totalRetinut` e suma liniilor.

import { describe, expect, it } from "vitest";

import { rotunjesteLaBani } from "../../bani";
import {
  calculeazaRetinerile,
  type IntrareRetineri,
  type Poprire,
  type RetinereSimpla,
  type RezultatRetineri,
} from "./retineri-popriri";

const O_TREIME = 1 / 3;
const O_JUMATATE = 1 / 2;

function poprire(peste: Partial<Poprire> = {}): Poprire {
  return {
    id: "P1",
    sumaLunara: 500,
    soldRamas: 5000,
    esteIntretinere: false,
    prioritate: 1,
    dosar: "1234/300/2026",
    ...peste,
  };
}

function retinere(peste: Partial<RetinereSimpla> = {}): RetinereSimpla {
  return { id: "R1", tip: "alta", suma: 100, motiv: "reținere internă", ...peste };
}

function intrare(peste: Partial<IntrareRetineri> = {}): IntrareRetineri {
  return {
    net: 3000,
    popriri: [],
    retineri: [],
    plafonPoprireUnica: O_TREIME,
    plafonPopririConcurente: O_JUMATATE,
    ...peste,
  };
}

function coduri(rezultat: RezultatRetineri): readonly string[] {
  return rezultat.probleme.map((p) => p.cod);
}

function totalPopriri(rezultat: RezultatRetineri): number {
  return rotunjesteLaBani(
    rezultat.aplicate.filter((a) => a.tip === "poprire").reduce((t, a) => t + a.aplicata, 0),
  );
}

describe("plafonul unei singure popriri", () => {
  it("nu atinge o poprire care cere mai puțin de o treime din net", () => {
    const rezultat = calculeazaRetinerile(
      intrare({ net: 3000, popriri: [poprire({ sumaLunara: 500, soldRamas: 5000 })] }),
    );

    expect(rezultat.aplicate[0]?.aplicata).toBe(500);
    expect(rezultat.aplicate[0]?.soldDupa).toBe(4500);
    expect(rezultat.plafonAplicat).toBe(1000);
    expect(rezultat.probleme).toEqual([]);
    expect(rezultat.netRamas).toBe(2500);
  });

  it("taie la o treime poprirea care cere mai mult, și spune cu cât", () => {
    const rezultat = calculeazaRetinerile(
      intrare({ net: 3000, popriri: [poprire({ sumaLunara: 1500, soldRamas: 5000 })] }),
    );

    expect(rezultat.aplicate[0]?.ceruta).toBe(1500);
    expect(rezultat.aplicate[0]?.aplicata).toBe(1000);
    expect(rezultat.aplicate[0]?.soldDupa).toBe(4000);
    expect(coduri(rezultat)).toEqual(["SAL_RETINERE_PLAFONATA"]);
    expect(rezultat.probleme[0]?.detalii).toContain("1500.00");
    expect(rezultat.probleme[0]?.detalii).toContain("1000.00");
    expect(rezultat.probleme[0]?.detalii).toContain("plafonul legal de urmărire");
  });

  it("plafonul rămâne EXACT în calcul; doar suma reținută se rotunjește la ban", () => {
    // 1/3 din 5000 = 1666,666… Plafonul materializat în bani înainte de
    // împărțire ar muta bani de la un creditor la altul; aici se rotunjește
    // doar rezultatul, o singură dată.
    const rezultat = calculeazaRetinerile(
      intrare({ net: 5000, popriri: [poprire({ sumaLunara: 3000, soldRamas: 99_999 })] }),
    );

    expect(rezultat.plafonAplicat).toBe(1666.67);
    expect(rezultat.aplicate[0]?.aplicata).toBe(1666.67);
    expect(rezultat.netRamas).toBe(3333.33);
  });
});

describe("popriri concurente", () => {
  it("două popriri active împart plafonul de o jumătate, nu două treimi", () => {
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 4000,
        popriri: [
          poprire({ id: "A", dosar: "1/2026", prioritate: 1, sumaLunara: 1500, soldRamas: 9000 }),
          poprire({ id: "B", dosar: "2/2026", prioritate: 2, sumaLunara: 1500, soldRamas: 9000 }),
        ],
      }),
    );

    expect(rezultat.plafonAplicat).toBe(2000);
    expect(rezultat.aplicate.map((a) => a.aplicata)).toEqual([1500, 500]);
    expect(totalPopriri(rezultat)).toBe(2000);
    expect(coduri(rezultat)).toEqual(["SAL_POPRIRI_CONCURENTE_PLAFON", "SAL_RETINERE_PLAFONATA"]);
    expect(rezultat.probleme[0]?.detalii).toContain("2");
    expect(rezultat.probleme[0]?.detalii).toContain("2000.00");
    expect(rezultat.netRamas).toBe(2000);
  });

  it("întreținerea se satisface prima, chiar cu prioritate și id mai slabe", () => {
    // Dosarul comercial „A" are prioritatea 1 și ar veni primul și alfabetic.
    // Singurul lucru care îl trece pe locul doi e natura celuilalt: dacă
    // testul ăsta cade, pensia alimentară se plătește din ce rămâne.
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 3000,
        popriri: [
          poprire({
            id: "A",
            dosar: "comercial",
            prioritate: 1,
            sumaLunara: 1000,
            soldRamas: 9000,
          }),
          poprire({
            id: "Z",
            dosar: "intretinere",
            prioritate: 9,
            sumaLunara: 1200,
            soldRamas: 9000,
            esteIntretinere: true,
          }),
        ],
      }),
    );

    expect(rezultat.aplicate.map((a) => a.id)).toEqual(["Z", "A"]);
    expect(rezultat.aplicate[0]?.aplicata).toBe(1200);
    expect(rezultat.aplicate[1]?.aplicata).toBe(300);
    expect(totalPopriri(rezultat)).toBe(1500);
    expect(rezultat.plafonAplicat).toBe(1500);
  });

  it("un dosar stins nu contează ca poprire concurentă și nu ridică plafonul la 1/2", () => {
    // Capcana: un dosar închis, uitat în evidență, ar lărgi partea urmăribilă
    // a salariului de la o treime la jumătate fără ca nimeni să încaseze ceva.
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 3000,
        popriri: [
          poprire({ id: "A", prioritate: 1, sumaLunara: 1500, soldRamas: 9000 }),
          poprire({ id: "B", prioritate: 2, sumaLunara: 1000, soldRamas: 0, dosar: "vechi/2019" }),
        ],
      }),
    );

    expect(rezultat.plafonAplicat).toBe(1000);
    expect(totalPopriri(rezultat)).toBe(1000);
    expect(coduri(rezultat)).not.toContain("SAL_POPRIRI_CONCURENTE_PLAFON");
    expect(coduri(rezultat)).toContain("SAL_POPRIRE_STINSA");
  });

  it("un dosar cu sold sub un ban e stins, nu concurent: nu ridică plafonul la 1/2", () => {
    // 0,004 lei = zero bani. Dosarul nu poate încasa nimic, dar dacă e numărat
    // ca poprire activă ridică plafonul de la 1.000 la 1.500 de lei — 500 de
    // lei luați în plus salariatului pentru un creditor care nu primește nimic.
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 3000,
        popriri: [
          poprire({ id: "A", prioritate: 1, sumaLunara: 1500, soldRamas: 9000 }),
          poprire({ id: "B", prioritate: 2, sumaLunara: 1000, soldRamas: 0.004 }),
        ],
      }),
    );

    expect(rezultat.plafonAplicat).toBe(1000);
    expect(totalPopriri(rezultat)).toBe(1000);
    expect(coduri(rezultat)).not.toContain("SAL_POPRIRI_CONCURENTE_PLAFON");
    expect(coduri(rezultat)).toContain("SAL_POPRIRE_STINSA");
  });

  it("un dosar care cere sub un ban nu e activ și nu ridică plafonul", () => {
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 3000,
        popriri: [
          poprire({ id: "A", prioritate: 1, sumaLunara: 1500, soldRamas: 9000 }),
          poprire({ id: "B", prioritate: 2, sumaLunara: 0.004, soldRamas: 9000 }),
        ],
      }),
    );

    expect(rezultat.plafonAplicat).toBe(1000);
    expect(coduri(rezultat)).not.toContain("SAL_POPRIRI_CONCURENTE_PLAFON");
  });

  it("o poprire cu suma lunară zero nu e activă și nu ridică plafonul", () => {
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 3000,
        popriri: [
          poprire({ id: "A", prioritate: 1, sumaLunara: 1500, soldRamas: 9000 }),
          poprire({ id: "B", prioritate: 2, sumaLunara: 0, soldRamas: 9000 }),
        ],
      }),
    );

    expect(rezultat.plafonAplicat).toBe(1000);
    expect(coduri(rezultat)).not.toContain("SAL_POPRIRI_CONCURENTE_PLAFON");
  });
});

describe("soldul datoriei", () => {
  it("nu se reține mai mult decât mai are de recuperat dosarul", () => {
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 6000,
        popriri: [poprire({ sumaLunara: 800, soldRamas: 300, dosar: "77/2026" })],
      }),
    );

    expect(rezultat.aplicate[0]?.ceruta).toBe(800);
    expect(rezultat.aplicate[0]?.aplicata).toBe(300);
    expect(rezultat.aplicate[0]?.soldDupa).toBe(0);
    expect(coduri(rezultat)).toEqual(["SAL_RETINERE_PLAFONATA", "SAL_POPRIRE_STINSA"]);
    expect(rezultat.probleme[0]?.detalii).toContain("soldul rămas al datoriei");
    expect(rezultat.probleme[1]?.detalii).toContain("77/2026");
    expect(rezultat.netRamas).toBe(5700);
  });

  it("o poprire cu sold zero e stinsă: nu se reține nimic pe ea", () => {
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 6000,
        popriri: [poprire({ sumaLunara: 800, soldRamas: 0, dosar: "88/2019" })],
      }),
    );

    expect(rezultat.aplicate[0]?.aplicata).toBe(0);
    expect(rezultat.aplicate[0]?.soldDupa).toBe(0);
    expect(rezultat.totalRetinut).toBe(0);
    expect(rezultat.netRamas).toBe(6000);
    expect(coduri(rezultat)).toContain("SAL_POPRIRE_STINSA");
    // Un dosar stins nu e o cerere legitimă, deci nu declanșează alarma de
    // „rețineri peste net": altfel fiecare fluturaș ar căra alarma la infinit.
    expect(coduri(rezultat)).not.toContain("SAL_RETINERI_PESTE_NET");
  });

  it("dosarul se închide chiar în luna în care ultima rată stinge soldul", () => {
    const rezultat = calculeazaRetinerile(
      intrare({ net: 9000, popriri: [poprire({ sumaLunara: 500, soldRamas: 500 })] }),
    );

    expect(rezultat.aplicate[0]?.aplicata).toBe(500);
    expect(rezultat.aplicate[0]?.soldDupa).toBe(0);
    expect(coduri(rezultat)).toEqual(["SAL_POPRIRE_STINSA"]);
    expect(rezultat.probleme[0]?.detalii).toContain("stinge integral soldul");
  });
});

describe("ordinea de aplicare", () => {
  it("avansul reduce netul, dar plafonul rămâne raportat la netul INIȚIAL", () => {
    // Dacă plafonul s-ar calcula pe netul rămas după avans (2500), ar ieși
    // 833,33 lei. Adică angajatorul ar putea micșora partea urmăribilă a
    // salariatului plătindu-i o parte ca avans.
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 3000,
        retineri: [retinere({ id: "AV", tip: "avans", suma: 500, motiv: "avans chenzinal" })],
        popriri: [poprire({ sumaLunara: 1200, soldRamas: 5000 })],
      }),
    );

    expect(rezultat.plafonAplicat).toBe(1000);
    expect(rezultat.aplicate.map((a) => a.tip)).toEqual(["avans", "poprire"]);
    expect(rezultat.aplicate.map((a) => a.aplicata)).toEqual([500, 1000]);
    expect(rezultat.totalRetinut).toBe(1500);
    expect(rezultat.netRamas).toBe(1500);
  });

  it("cele cinci tipuri se aplică în secvența legală, fiecare pe netul rămas", () => {
    // Intrarea e amestecată intenționat: ordinea de pe fluturaș vine din lege,
    // nu din ordinea rândurilor citite din bază.
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 2000,
        retineri: [
          retinere({ id: "S", tip: "retinere_sindicat", suma: 100, motiv: "cotizație sindicat" }),
          retinere({ id: "R", tip: "rata_interna", suma: 500, motiv: "rată credit intern" }),
          retinere({ id: "I", tip: "imputatie", suma: 400, motiv: "imputație lipsă gestiune" }),
          retinere({ id: "AV", tip: "avans", suma: 300, motiv: "avans chenzinal" }),
        ],
        popriri: [poprire({ id: "P", sumaLunara: 1000, soldRamas: 10_000 })],
      }),
    );

    expect(rezultat.aplicate.map((a) => a.tip)).toEqual([
      "avans",
      "poprire",
      "imputatie",
      "rata_interna",
      "retinere_sindicat",
    ]);
    expect(rezultat.aplicate.map((a) => a.aplicata)).toEqual([300, 666.67, 400, 500, 100]);
    expect(rezultat.totalRetinut).toBe(1966.67);
    expect(rezultat.netRamas).toBe(33.33);
  });

  it("reținerile fără loc în secvența legală se aplică ultimele, după sindicat", () => {
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 1000,
        retineri: [
          retinere({ id: "X", tip: "alta", suma: 50, motiv: "diverse" }),
          retinere({ id: "S", tip: "retinere_sindicat", suma: 20, motiv: "cotizație sindicat" }),
        ],
      }),
    );

    expect(rezultat.aplicate.map((a) => a.id)).toEqual(["S", "X"]);
  });

  it("mai multe rețineri de același tip se departajează după id, nu după ordinea rândurilor", () => {
    // Testul vechi cerea invers — „păstrează ordinea în care au venit" — și
    // codifica un defect: pe un net care nu acoperă ambele rețineri, ordinea
    // rândurilor decide CINE încasează. Un `select` fără `order by` nu promite
    // nicio ordine, deci același angajat, în aceeași lună, putea primi două
    // fluturașe diferite. Vezi „ordinea de intrare nu schimbă rezultatul".
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 5000,
        retineri: [
          retinere({ id: "I2", tip: "imputatie", suma: 100, motiv: "a doua" }),
          retinere({ id: "I1", tip: "imputatie", suma: 100, motiv: "prima" }),
        ],
      }),
    );

    expect(rezultat.aplicate.map((a) => a.id)).toEqual(["I1", "I2"]);
  });

  it("pe un net care nu ajunge, ordinea rândurilor NU decide cine încasează", () => {
    const strans = (lista: readonly RetinereSimpla[]): IntrareRetineri =>
      intrare({ net: 150, retineri: lista });
    const prima = retinere({ id: "I1", tip: "imputatie", suma: 100, motiv: "prima" });
    const doua = retinere({ id: "I2", tip: "imputatie", suma: 100, motiv: "a doua" });

    const intaiPrima = calculeazaRetinerile(strans([prima, doua]));
    const intaiDoua = calculeazaRetinerile(strans([doua, prima]));

    expect(intaiPrima).toEqual(intaiDoua);
    expect(intaiPrima.aplicate.map((a) => [a.id, a.aplicata])).toEqual([
      ["I1", 100],
      ["I2", 50],
    ]);
  });

  it("o poprire strecurată în lista de rețineri simple NU se aplică", () => {
    // Acolo nu există nici dosar, nici sold, deci n-ar putea fi ținută sub
    // plafon. Aplicată tăcut, ar fi exact urmărirea peste plafon pe care
    // art. 729 o interzice; se raportează în loc să dispară.
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 3000,
        retineri: [
          retinere({ id: "FALS", tip: "poprire", suma: 2500, motiv: "poprire pe salariu" }),
        ],
      }),
    );

    expect(rezultat.totalRetinut).toBe(0);
    expect(rezultat.netRamas).toBe(3000);
    expect(coduri(rezultat)).toContain("SAL_RETINERE_PLAFONATA");
    expect(rezultat.probleme.at(-1)?.detalii).toContain("lista de popriri");
  });

  it("poprirea refuzată nu declanșează alarma de „rețineri peste net”", () => {
    // Reținerea nu se aplică deloc, deci netul n-are nicio vină. Numărată în
    // cererea lunii, aprindea o alarmă al cărei text — „s-au aplicat în ordinea
    // legală, până la epuizarea netului" — e fals: nu s-a aplicat nimic, iar
    // operatorul era trimis să caute un salariu prea mic în loc de rândul
    // declarat greșit.
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 3000,
        retineri: [retinere({ id: "FALS", tip: "poprire", suma: 9000, motiv: "poprire" })],
      }),
    );

    expect(coduri(rezultat)).toEqual(["SAL_RETINERE_PLAFONATA"]);
    expect(rezultat.netRamas).toBe(3000);
  });
});

describe("netul insuficient", () => {
  it("nicio reținere nu lasă netul negativ; ce nu încape se raportează", () => {
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 1000,
        retineri: [
          retinere({ id: "AV", tip: "avans", suma: 800, motiv: "avans chenzinal" }),
          retinere({ id: "I", tip: "imputatie", suma: 500, motiv: "imputație" }),
        ],
      }),
    );

    expect(rezultat.aplicate.map((a) => a.aplicata)).toEqual([800, 200]);
    expect(rezultat.totalRetinut).toBe(1000);
    expect(rezultat.netRamas).toBe(0);
    expect(coduri(rezultat)).toEqual(["SAL_RETINERI_PESTE_NET", "SAL_RETINERE_PLAFONATA"]);
    expect(rezultat.probleme.at(-1)?.detalii).toContain("netul rămas");
  });

  it("net zero: nu se reține nimic, dar cererea se raportează", () => {
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 0,
        retineri: [retinere({ id: "AV", tip: "avans", suma: 500, motiv: "avans chenzinal" })],
        popriri: [poprire({ sumaLunara: 300, soldRamas: 1000 })],
      }),
    );

    expect(rezultat.aplicate.every((a) => a.aplicata === 0)).toBe(true);
    expect(rezultat.totalRetinut).toBe(0);
    expect(rezultat.netRamas).toBe(0);
    expect(rezultat.plafonAplicat).toBe(0);
    expect(coduri(rezultat)).toContain("SAL_RETINERI_PESTE_NET");
  });

  it("net zero fără nicio cerere nu inventează probleme", () => {
    const rezultat = calculeazaRetinerile(intrare({ net: 0 }));

    expect(rezultat.probleme).toEqual([]);
    expect(rezultat.aplicate).toEqual([]);
  });

  it("un net negativ rămâne negativ, nu e turtit la zero", () => {
    // Regularizările în minus trebuie să ajungă vizibile în etapa următoare.
    const rezultat = calculeazaRetinerile(
      intrare({
        net: -200,
        retineri: [retinere({ id: "AV", tip: "avans", suma: 100, motiv: "avans chenzinal" })],
      }),
    );

    expect(rezultat.totalRetinut).toBe(0);
    expect(rezultat.netRamas).toBe(-200);
    expect(coduri(rezultat)).toContain("SAL_RETINERI_PESTE_NET");
  });

  it("o sumă negativă nu se transformă într-o plată către salariat", () => {
    const rezultat = calculeazaRetinerile(
      intrare({ net: 1000, retineri: [retinere({ suma: -500, motiv: "corecție greșită" })] }),
    );

    expect(rezultat.aplicate[0]?.ceruta).toBe(0);
    expect(rezultat.aplicate[0]?.aplicata).toBe(0);
    expect(rezultat.netRamas).toBe(1000);
    expect(rezultat.probleme).toEqual([]);
  });
});

describe("determinismul ordinii", () => {
  it("aceleași dosare, ordine de intrare diferită, același rezultat", () => {
    const a = poprire({ id: "A", dosar: "a/2026", prioritate: 1, sumaLunara: 1000 });
    const b = poprire({ id: "B", dosar: "b/2026", prioritate: 1, sumaLunara: 1000 });

    const intaiA = calculeazaRetinerile(intrare({ net: 2000, popriri: [a, b] }));
    const intaiB = calculeazaRetinerile(intrare({ net: 2000, popriri: [b, a] }));

    expect(intaiA).toEqual(intaiB);
    // Prioritate egală, natură egală: departajează id-ul, nu norocul.
    expect(intaiA.aplicate.map((x) => x.id)).toEqual(["A", "B"]);
    expect(intaiA.aplicate.map((x) => x.aplicata)).toEqual([1000, 0]);
  });

  it("două dosare cu același id se departajează după numărul de dosar", () => {
    // Id-ul e cheia primară, deci n-ar trebui să se repete — dar dacă se
    // repetă, sortarea trebuie să aibă un criteriu FINAL, altfel cade înapoi
    // pe ordinea rândurilor și cei doi creditori își schimbă locurile.
    const unu = poprire({ id: "X", dosar: "d1", sumaLunara: 1000, soldRamas: 9000 });
    const doi = poprire({ id: "X", dosar: "d2", sumaLunara: 1000, soldRamas: 50 });

    const intaiUnu = calculeazaRetinerile(intrare({ net: 3000, popriri: [unu, doi] }));
    const intaiDoi = calculeazaRetinerile(intrare({ net: 3000, popriri: [doi, unu] }));

    expect(intaiUnu).toEqual(intaiDoi);
    expect(intaiUnu.aplicate.map((a) => [a.ceruta, a.aplicata])).toEqual([
      [1000, 1000],
      [1000, 50],
    ]);
  });

  it("prioritatea mai mică vine prima între dosare de aceeași natură", () => {
    const rezultat = calculeazaRetinerile(
      intrare({
        net: 3000,
        popriri: [
          poprire({ id: "A", prioritate: 5, sumaLunara: 1000, soldRamas: 9000 }),
          poprire({ id: "B", prioritate: 2, sumaLunara: 1000, soldRamas: 9000 }),
        ],
      }),
    );

    expect(rezultat.aplicate.map((x) => x.id)).toEqual(["B", "A"]);
  });
});

describe("intrări imposibile", () => {
  it("un net care nu e număr oprește calculul aici, nu peste trei etape", () => {
    expect(() => calculeazaRetinerile(intrare({ net: Number.NaN }))).toThrow(RangeError);
  });

  it("un plafon negativ e o eroare de configurare, nu zero rețineri tăcute", () => {
    expect(() => calculeazaRetinerile(intrare({ plafonPoprireUnica: -0.5 }))).toThrow(RangeError);
    expect(() =>
      calculeazaRetinerile(intrare({ plafonPopririConcurente: Number.POSITIVE_INFINITY })),
    ).toThrow(RangeError);
  });

  it("un plafon dat ca PROCENT (33 în loc de 0,33) e refuzat, nu aplicat", () => {
    // Confuzia fracție/procent nu produce aici o sumă absurdă și vizibilă, ci
    // un plafon de 3.300% — adică mai mare decât salariul, adică urmărire fără
    // plafon. Netul ar ieși zero, iar fluturașul n-ar semnala nimic.
    expect(() => calculeazaRetinerile(intrare({ plafonPoprireUnica: 33 }))).toThrow(RangeError);
    expect(() => calculeazaRetinerile(intrare({ plafonPopririConcurente: 50 }))).toThrow(
      RangeError,
    );
    expect(() => calculeazaRetinerile(intrare({ plafonPoprireUnica: 1 }))).not.toThrow();
  });
});

describe("invarianții de sumă", () => {
  const SETURI: readonly (readonly [string, IntrareRetineri])[] = [
    ["nimic de reținut", intrare({ net: 4321.55 })],
    [
      "o poprire peste plafon",
      intrare({ net: 5000, popriri: [poprire({ sumaLunara: 4000, soldRamas: 50_000 })] }),
    ],
    [
      "trei popriri concurente",
      intrare({
        net: 3777.77,
        popriri: [
          poprire({ id: "A", prioritate: 1, sumaLunara: 900, soldRamas: 4000 }),
          poprire({ id: "B", prioritate: 2, sumaLunara: 900, soldRamas: 300 }),
          poprire({
            id: "C",
            prioritate: 3,
            sumaLunara: 1200,
            soldRamas: 8000,
            esteIntretinere: true,
          }),
        ],
      }),
    ],
    [
      "toate tipurile pe un net strâmt",
      intrare({
        net: 1234.56,
        retineri: [
          retinere({ id: "AV", tip: "avans", suma: 400, motiv: "avans" }),
          retinere({ id: "I", tip: "imputatie", suma: 333.33, motiv: "imputație" }),
          retinere({ id: "R", tip: "rata_interna", suma: 250, motiv: "rată" }),
          retinere({ id: "S", tip: "retinere_sindicat", suma: 12.35, motiv: "sindicat" }),
          retinere({ id: "X", tip: "alta", suma: 500, motiv: "diverse" }),
        ],
        popriri: [poprire({ sumaLunara: 300, soldRamas: 900 })],
      }),
    ],
    [
      "net care nu se împarte frumos la trei",
      intrare({ net: 3333.33, popriri: [poprire({ sumaLunara: 5000, soldRamas: 90_000 })] }),
    ],
    ["dosar stins pe net mare", intrare({ net: 8000, popriri: [poprire({ soldRamas: 0 })] })],
    [
      "două rețineri de același tip pe un net care nu le acoperă",
      intrare({
        net: 150,
        retineri: [
          retinere({ id: "I2", tip: "imputatie", suma: 100, motiv: "a doua" }),
          retinere({ id: "I1", tip: "imputatie", suma: 100, motiv: "prima" }),
        ],
      }),
    ],
    [
      "net cu mai mult de doi zecimali, consumat integral",
      intrare({
        net: 1000.006,
        retineri: [retinere({ id: "AV", tip: "avans", suma: 2000, motiv: "avans" })],
      }),
    ],
    [
      "poprire declarată greșit ca reținere simplă",
      intrare({
        net: 3000,
        retineri: [retinere({ id: "FALS", tip: "poprire", suma: 5000, motiv: "poprire" })],
      }),
    ],
  ];

  it("totalRetinut + netRamas dă exact netul, la ban", () => {
    for (const [nume, date] of SETURI) {
      const rezultat = calculeazaRetinerile(date);
      expect(rotunjesteLaBani(rezultat.totalRetinut + rezultat.netRamas), nume).toBe(
        rotunjesteLaBani(date.net),
      );
    }
  });

  it("totalRetinut e exact suma liniilor de pe fluturaș", () => {
    for (const [nume, date] of SETURI) {
      const rezultat = calculeazaRetinerile(date);
      const sumaLiniilor = rotunjesteLaBani(
        rezultat.aplicate.reduce((total, a) => total + a.aplicata, 0),
      );
      expect(sumaLiniilor, nume).toBe(rezultat.totalRetinut);
    }
  });

  it("popririle nu depășesc niciodată plafonul aplicat", () => {
    for (const [nume, date] of SETURI) {
      const rezultat = calculeazaRetinerile(date);
      expect(totalPopriri(rezultat), nume).toBeLessThanOrEqual(rezultat.plafonAplicat);
    }
  });

  it("nicio linie nu reține mai mult decât s-a cerut, iar soldul nu scade sub zero", () => {
    for (const [nume, date] of SETURI) {
      const rezultat = calculeazaRetinerile(date);
      for (const linie of rezultat.aplicate) {
        expect(linie.aplicata, `${nume} / ${linie.id}`).toBeLessThanOrEqual(linie.ceruta);
        expect(linie.aplicata, `${nume} / ${linie.id}`).toBeGreaterThanOrEqual(0);
        if (linie.soldDupa !== null) {
          expect(linie.soldDupa, `${nume} / ${linie.id}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("fiecare reținere primită apare pe fluturaș, chiar și cu zero reținut", () => {
    for (const [nume, date] of SETURI) {
      const rezultat = calculeazaRetinerile(date);
      expect(rezultat.aplicate.length, nume).toBe(date.popriri.length + date.retineri.length);
    }
  });

  it("ordinea de intrare nu schimbă rezultatul, pe niciun set", () => {
    // Invariantul cel mai scump la greșeală: apelantul citește popririle și
    // reținerile din bază, iar un `select` fără `order by` nu promite nicio
    // ordine. Dacă rezultatul depinde de ea, doi operatori pot obține două
    // fluturașe diferite din exact aceleași date.
    for (const [nume, date] of SETURI) {
      const drept = calculeazaRetinerile(date);
      const invers = calculeazaRetinerile({
        ...date,
        popriri: [...date.popriri].reverse(),
        retineri: [...date.retineri].reverse(),
      });

      expect(invers, nume).toEqual(drept);
    }
  });

  it("netul rămas nu e negativ dintr-o reținere și nu e minus-zero", () => {
    // `(-0).toFixed(2)` scrie „-0,00 lei" pe fluturaș: un minus fără sumă.
    for (const [nume, date] of SETURI) {
      const rezultat = calculeazaRetinerile(date);
      expect(Object.is(rezultat.netRamas, -0), nume).toBe(false);
      if (date.net >= 0) {
        expect(rezultat.netRamas, nume).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
