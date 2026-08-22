// src/domain/payroll/bancar/sepa.test.ts
//
// Invariantul apărat aici: fișierul care iese din modul e ACCEPTAT de bancă din
// prima încărcare, sau nu există deloc. Nu există stare intermediară — un ordin
// „aproape corect" e un ordin care fie e respins integral după ce salariile
// erau deja anunțate, fie, mai rău, trimite bani în conturi greșite.
//
// De aceea testele de mai jos verifică trei lucruri diferite:
//   - că fișierul e BINE FORMAT chiar și cu date urâte („Popescu & Fiii");
//   - că `CtrlSum` corespunde EXACT sumei liniilor rămase în fișier;
//   - că o plată dubioasă e ținută AFARĂ, nu strecurată înăuntru.

import { describe, expect, it } from "vitest";

import {
  escapeazaXml,
  esteIbanValid,
  formateazaSumaSepa,
  genereazaSepa,
  normalizeazaIban,
  type IntrarePlata,
  type PlataSepa,
} from "./sepa";

/** Conturi cu cifra de control corectă, verificate prin mod-97-10. */
const IBAN_PLATITOR = "RO21INGB0000999901234567";
const IBAN_ANGAJAT_1 = "RO49AAAA1B31007593840000";
const IBAN_ANGAJAT_2 = "RO46RNCB0082044172680001";
const IBAN_ANGAJAT_3 = "RO65BTRLRONCRT0123456789";

/** Același cont ca `IBAN_ANGAJAT_1`, cu ultima cifră schimbată. */
const IBAN_CONTROL_GRESIT = "RO49AAAA1B31007593840001";
/** Trece mod-97-10, dar are 22 de caractere în loc de 24. */
const IBAN_PREA_SCURT = "RO98AAAA1B310075938400";
/** Trece mod-97-10, dar „ZZ" nu e o țară din registrul IBAN. */
const IBAN_TARA_NECUNOSCUTA = "ZZ41AAAA1B31007593840000";

function plata(peste: Partial<PlataSepa> = {}): PlataSepa {
  return {
    referinta: "SAL-2026-08-0001",
    numeBeneficiar: "Ion Popescu",
    iban: IBAN_ANGAJAT_1,
    suma: 3500,
    explicatie: "Salariu august 2026",
    ...peste,
  };
}

function intrare(peste: Partial<IntrarePlata> = {}): IntrarePlata {
  return {
    mesajId: "SAL-2026-08",
    creatLa: "2026-09-05T09:30:00",
    dataExecutiei: "2026-09-10",
    numePlatitor: "Administrativo SRL",
    ibanPlatitor: IBAN_PLATITOR,
    bicPlatitor: "BTRLRO22",
    moneda: "RON",
    plati: [plata()],
    ...peste,
  };
}

/** Conținutul tuturor elementelor cu numele dat, în ordinea din fișier. */
function valori(xml: string, nume: string): readonly string[] {
  const potriviri = [...xml.matchAll(new RegExp(`<${nume}(?:\\s[^>]*)?>([^<]*)</${nume}>`, "gu"))];
  return potriviri.map((potrivire) => potrivire[1] ?? "");
}

function cateOri(xml: string, fragment: string): number {
  return xml.split(fragment).length - 1;
}

/** „1234.56" → 123456 de bani. Comparațiile de total se fac în întregi. */
function inBani(text: string): number {
  const [lei, subunitati] = text.split(".");
  return Number(lei ?? "0") * 100 + Number(subunitati ?? "0");
}

function coduri(rezultat: { readonly probleme: readonly { readonly cod: string }[] }): string[] {
  return rezultat.probleme.map((problema) => problema.cod);
}

describe("structura fișierului pain.001.001.03", () => {
  it("un ordin cu două plăți are un singur bloc PmtInf și câte o tranzacție per angajat", () => {
    const rezultat = genereazaSepa(
      intrare({
        plati: [
          plata({ referinta: "SAL-1", numeBeneficiar: "Ion Popescu", suma: 3500 }),
          plata({
            referinta: "SAL-2",
            numeBeneficiar: "Maria Ionescu",
            iban: IBAN_ANGAJAT_2,
            suma: 4250.75,
          }),
        ],
      }),
    );

    expect(rezultat.numarPlati).toBe(2);
    expect(cateOri(rezultat.xml, "<PmtInf>")).toBe(1);
    expect(cateOri(rezultat.xml, "<CdtTrfTxInf>")).toBe(2);
    expect(valori(rezultat.xml, "EndToEndId")).toEqual(["SAL-1", "SAL-2"]);
    expect(valori(rezultat.xml, "InstdAmt")).toEqual(["3500.00", "4250.75"]);
    expect(valori(rezultat.xml, "IBAN")).toEqual([IBAN_PLATITOR, IBAN_ANGAJAT_1, IBAN_ANGAJAT_2]);
    expect(rezultat.probleme).toEqual([]);
  });

  it("declarația și rădăcina poartă spațiul de nume al schemei", () => {
    const rezultat = genereazaSepa(intrare());

    expect(rezultat.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(rezultat.xml).toContain(
      '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">',
    );
    expect(rezultat.xml.endsWith("</Document>")).toBe(true);
  });

  it("antetul poartă datele primite, nu ceasul sistemului", () => {
    const rezultat = genereazaSepa(
      intrare({ mesajId: "SAL-2026-08", creatLa: "2026-09-05T09:30:00" }),
    );

    expect(valori(rezultat.xml, "MsgId")).toEqual(["SAL-2026-08"]);
    expect(valori(rezultat.xml, "CreDtTm")).toEqual(["2026-09-05T09:30:00"]);
    expect(valori(rezultat.xml, "ReqdExctnDt")).toEqual(["2026-09-10"]);
    expect(valori(rezultat.xml, "PmtMtd")).toEqual(["TRF"]);
    expect(valori(rezultat.xml, "Nm")).toEqual([
      "Administrativo SRL",
      "Administrativo SRL",
      "Ion Popescu",
    ]);
  });

  it("INVARIANT: aceeași intrare produce exact același fișier, octet cu octet", () => {
    // Fără asta, regenerarea fișierului după o eroare de încărcare ar da un
    // document diferit, iar banca ar putea executa de două ori aceleași plăți.
    //
    // Cele două intrări se CONSTRUIESC separat, nu se dă de două ori același
    // obiect: versiunea veche pasa aceeași referință, iar o funcție pură ar fi
    // trecut testul și dacă ar fi ținut minte ceva între apeluri.
    expect(genereazaSepa(intrare()).xml).toBe(genereazaSepa(intrare()).xml);
  });

  it("INVARIANT: aceleași plăți în altă ordine dau același total, aceleași linii și aceleași probleme", () => {
    // Ordinea rândurilor în fișier urmează ordinea din listă — asta e voit.
    // Ce NU are voie să depindă de ordine e CIFRA: `CtrlSum`, `NbOfTxs` și
    // triajul. Dacă acumularea ar aluneca în virgulă mobilă, două rulări ale
    // aceluiași stat, citit din bază cu alt `order by`, ar declara totaluri
    // diferite pentru exact aceiași bani.
    const set = [
      plata({ referinta: "A", iban: IBAN_ANGAJAT_1, suma: 1234.56 }),
      plata({ referinta: "B", iban: IBAN_ANGAJAT_2, suma: 0.07 }),
      plata({ referinta: "C", iban: IBAN_ANGAJAT_3, suma: 99999.99 }),
      plata({ referinta: "D", iban: IBAN_CONTROL_GRESIT, suma: 500 }),
      plata({ referinta: "E", iban: IBAN_ANGAJAT_1, suma: 0.004 }),
      plata({ referinta: "F", iban: IBAN_ANGAJAT_2, suma: 10.005 }),
    ];
    const directa = genereazaSepa(intrare({ plati: set }));
    const inversa = genereazaSepa(intrare({ plati: [...set].reverse() }));

    expect(directa.sumaControl).toBe(inversa.sumaControl);
    expect(directa.numarPlati).toBe(inversa.numarPlati);
    expect(directa.numarPlati).toBe(4);
    expect(valori(directa.xml, "CtrlSum")).toEqual(valori(inversa.xml, "CtrlSum"));
    expect([...coduri(directa)].sort()).toEqual([...coduri(inversa)].sort());
    expect([...valori(directa.xml, "EndToEndId")].sort()).toEqual(
      [...valori(inversa.xml, "EndToEndId")].sort(),
    );
  });
});

describe("escaparea XML", () => {
  it("un nume cu & și paranteze unghiulare nu rupe fișierul", () => {
    const rezultat = genereazaSepa(
      intrare({
        plati: [plata({ numeBeneficiar: "Popescu & Fiii <SRL>" })],
      }),
    );

    expect(rezultat.xml).toContain("<Nm>Popescu &amp; Fiii &lt;SRL&gt;</Nm>");
    expect(rezultat.xml).not.toContain("<Nm>Popescu & Fiii");
  });

  it("explicația cu & și ghilimele e escapată", () => {
    const rezultat = genereazaSepa(
      intrare({
        plati: [plata({ explicatie: 'Salariu & spor "noapte" <august>' })],
      }),
    );

    expect(rezultat.xml).toContain(
      "<Ustrd>Salariu &amp; spor &quot;noapte&quot; &lt;august&gt;</Ustrd>",
    );
  });

  it("INVARIANT: în tot fișierul nu rămâne niciun & neescapat", () => {
    // Versiunea veche punea aici `moneda: 'R"N'`. De când moneda invalidă
    // oprește fișierul, `xml` ar fi ieșit gol, iar `not.toContain("&")` ar fi
    // trecut pe un șir gol — testul s-ar fi oprit din a testa fără să pice.
    // Moneda rămâne validă; textele urâte sunt în restul câmpurilor.
    const rezultat = genereazaSepa(
      intrare({
        mesajId: "SAL&2026",
        numePlatitor: 'S.C. "A & B" <Grup> SRL',
        plati: [
          plata({
            referinta: "REF&1",
            numeBeneficiar: "Ana & Ion <Popescu>",
            explicatie: "Salariu & prime",
          }),
        ],
      }),
    );
    const faraEntitati = rezultat.xml.replace(/&(?:amp|lt|gt|quot|apos);/gu, "");

    expect(rezultat.xml).not.toBe("");
    expect(faraEntitati).not.toContain("&");
  });

  it('escaparea e o SINGURĂ trecere: un text care conține deja „&amp;" nu se re-escapează pe furiș', () => {
    // Numele vechi al testului promitea că „un & deja escapat nu devine
    // &amp;amp;", dar cele două aserții nu-i dădeau niciodată la intrare un
    // text deja escapat — verificau altceva decât spuneau. Adevărul e invers și
    // el e cel care contează: `escapeazaXml` tratează intrarea ca TEXT, deci
    // „&amp;" DEVINE „&amp;amp;" (corect — literalul acela e cinci caractere).
    // Ce nu are voie să se întâmple e ca generatorul să escapeze de două ori.
    expect(escapeazaXml("A & B")).toBe("A &amp; B");
    expect(escapeazaXml("<a href='x'>")).toBe("&lt;a href=&apos;x&apos;&gt;");
    expect(escapeazaXml(escapeazaXml("A & B"))).toBe("A &amp;amp; B");

    const rezultat = genereazaSepa(
      intrare({ plati: [plata({ numeBeneficiar: "Ana &amp; Ion" })] }),
    );

    expect(rezultat.xml).toContain("<Nm>Ana &amp;amp; Ion</Nm>");
  });

  it("escaparea acoperă și caracterele care rup un atribut, nu doar conținutul", () => {
    // Vechiul test cerea ca `moneda: 'R"N'` să AJUNGĂ în fișier ca
    // `Ccy="R&quot;N"` — adică fixa în teste exact comportamentul greșit:
    // un fișier bine format, dar respins de bancă (`Ccy` e `[A-Z]{3}` în
    // schemă), fără nicio problemă raportată. Moneda e acum respinsă din antet;
    // escaparea atributului rămâne, ca plasă, și se verifică la nivelul ei.
    expect(escapeazaXml('R"N')).toBe("R&quot;N");
    expect(genereazaSepa(intrare({ moneda: "ron" })).xml).toContain('<InstdAmt Ccy="RON">');
  });
});

describe("validarea IBAN", () => {
  it("acceptă conturi românești cu cifra de control corectă", () => {
    for (const iban of [IBAN_PLATITOR, IBAN_ANGAJAT_1, IBAN_ANGAJAT_2, IBAN_ANGAJAT_3]) {
      expect(esteIbanValid(iban)).toBe(true);
    }
  });

  it("acceptă conturi din alte țări SEPA, cu lungimea lor proprie", () => {
    expect(esteIbanValid("DE89370400440532013000")).toBe(true);
    expect(esteIbanValid("FR1420041010050500013M02606")).toBe(true);
    expect(esteIbanValid("NL91ABNA0417164300")).toBe(true);
    expect(esteIbanValid("BE68539007547034")).toBe(true);
  });

  it("respinge un IBAN cu o singură cifră schimbată", () => {
    expect(esteIbanValid(IBAN_CONTROL_GRESIT)).toBe(false);
    expect(esteIbanValid("DE89370400440532013001")).toBe(false);
  });

  it("respinge un IBAN care trece mod-97-10 dar are lungimea greșită pentru țară", () => {
    // Capcana pe care cifra de control singură NU o prinde: dintr-un IBAN
    // românesc s-a pierdut un caracter, iar restul a rămas, întâmplător, 1.
    expect(IBAN_PREA_SCURT).toHaveLength(22);
    expect(esteIbanValid(IBAN_PREA_SCURT)).toBe(false);
  });

  it("respinge un prefix de țară care nu există în registrul IBAN", () => {
    expect(esteIbanValid(IBAN_TARA_NECUNOSCUTA)).toBe(false);
  });

  it("respinge șirul gol, textul liber și caracterele nepermise", () => {
    expect(esteIbanValid("")).toBe(false);
    expect(esteIbanValid("nu am cont")).toBe(false);
    expect(esteIbanValid("RO49AAAA1B310075938400@0")).toBe(false);
    expect(esteIbanValid("4949AAAA1B31007593840000")).toBe(false);
  });

  it("scrierea pe grupuri de patru și literele mici nu schimbă verdictul", () => {
    expect(normalizeazaIban("ro49 aaaa 1b31 0075 9384 0000")).toBe(IBAN_ANGAJAT_1);
    expect(esteIbanValid("ro49 aaaa 1b31 0075 9384 0000")).toBe(true);
    expect(esteIbanValid("RO49-AAAA-1B31-0075-9384-0000")).toBe(true);
  });

  it("plata cu IBAN invalid e exclusă din fișier și raportată cu beneficiarul", () => {
    const rezultat = genereazaSepa(
      intrare({
        plati: [
          plata({ numeBeneficiar: "Ion Popescu", suma: 3500 }),
          plata({
            referinta: "SAL-2",
            numeBeneficiar: "Maria Ionescu",
            iban: IBAN_CONTROL_GRESIT,
            suma: 4000,
          }),
        ],
      }),
    );

    expect(rezultat.numarPlati).toBe(1);
    expect(cateOri(rezultat.xml, "<CdtTrfTxInf>")).toBe(1);
    expect(rezultat.xml).not.toContain(IBAN_CONTROL_GRESIT);
    expect(coduri(rezultat)).toEqual(["SAL_SEPA_IBAN_INVALID"]);
    expect(rezultat.probleme[0]?.detalii).toContain("Maria Ionescu");
  });

  it("contul din care se plătește oprește tot fișierul dacă e invalid", () => {
    // O plată corectă dintr-un cont inexistent nu se execută oricum, iar un
    // raport lung despre beneficiari ar ascunde singurul lucru de reparat.
    const rezultat = genereazaSepa(
      intrare({ ibanPlatitor: IBAN_CONTROL_GRESIT, plati: [plata(), plata({ iban: "gresit" })] }),
    );

    expect(rezultat.xml).toBe("");
    expect(rezultat.numarPlati).toBe(0);
    expect(coduri(rezultat)).toEqual(["SAL_SEPA_IBAN_INVALID", "SAL_SEPA_FARA_PLATI"]);
    expect(rezultat.probleme[0]?.detalii).toContain("Administrativo SRL");
  });

  it("mesajul de problemă nu scrie IBAN-ul întreg", () => {
    const rezultat = genereazaSepa(intrare({ plati: [plata({ iban: IBAN_CONTROL_GRESIT })] }));

    expect(rezultat.probleme[0]?.detalii).toContain("RO49…0001");
    expect(rezultat.probleme[0]?.detalii).not.toContain(IBAN_CONTROL_GRESIT);
  });
});

describe("formatul sumelor", () => {
  it("are exact două zecimale, cu punct, și fără separator de mii", () => {
    expect(formateazaSumaSepa(1000)).toBe("1000.00");
    expect(formateazaSumaSepa(0.5)).toBe("0.50");
    expect(formateazaSumaSepa(123.45)).toBe("123.45");
    expect(formateazaSumaSepa(1234.5)).toBe("1234.50");
    expect(formateazaSumaSepa(1234567.89)).toBe("1234567.89");
  });

  it("rotunjirea trece prin regula unică a aplicației, nu prin toFixed", () => {
    // `(1.005).toFixed(2)` dă „1.00" — un ban în minus față de statul de plată,
    // pe fiecare angajat, în fiecare lună.
    expect(formateazaSumaSepa(1.005)).toBe("1.01");
    expect(formateazaSumaSepa(2.675)).toBe("2.68");
  });

  it("suma ajunge în fișier în formatul cerut de standard", () => {
    const rezultat = genereazaSepa(
      intrare({
        plati: [plata({ suma: 1000 }), plata({ referinta: "SAL-2", suma: 0.5 })],
      }),
    );

    expect(rezultat.xml).toContain('<InstdAmt Ccy="RON">1000.00</InstdAmt>');
    expect(rezultat.xml).toContain('<InstdAmt Ccy="RON">0.50</InstdAmt>');
    expect(rezultat.xml).not.toContain("1000,00");
  });

  it("rotunjirea sumelor SCRISE ÎN FIȘIER trece prin regula unică, nu prin trunchiere", () => {
    // Golul găsit la revizuire: testul „rotunjirea trece prin regula unică"
    // verifică `formateazaSumaSepa` — o funcție pe care `genereazaSepa` NU o
    // apelează niciodată. Rotunjirea sumelor care ajung efectiv în fișier nu
    // era ținută pe loc de nimic: înlocuind `dinLei(plata.suma)` cu
    // `Math.trunc(plata.suma * 100)` treceau TOATE cele 54 de teste. Fișierul
    // rămâne coerent (`CtrlSum` se potrivește cu liniile), banca îl acceptă, și
    // fiecare angajat primește cu până la un ban mai puțin decât scrie pe
    // fluturaș — clasa de defect care nu produce nicio eroare nicăieri.
    const rezultat = genereazaSepa(
      intrare({
        plati: [
          plata({ referinta: "SAL-1", iban: IBAN_ANGAJAT_1, suma: 1.005 }),
          plata({ referinta: "SAL-2", iban: IBAN_ANGAJAT_2, suma: 2.675 }),
          plata({ referinta: "SAL-3", iban: IBAN_ANGAJAT_3, suma: 3500.129 }),
        ],
      }),
    );

    expect(valori(rezultat.xml, "InstdAmt")).toEqual(["1.01", "2.68", "3500.13"]);
    expect(valori(rezultat.xml, "CtrlSum")).toEqual(["3503.82", "3503.82"]);
    expect(rezultat.sumaControl).toBe(3503.82);
  });

  it("suma zero e respinsă, nu scrisă ca 0.00", () => {
    const rezultat = genereazaSepa(intrare({ plati: [plata({ suma: 0 })] }));

    expect(rezultat.xml).toBe("");
    expect(coduri(rezultat)).toEqual(["SAL_SEPA_SUMA_INVALIDA", "SAL_SEPA_FARA_PLATI"]);
  });

  it("suma negativă e respinsă — un ordin de plată nu retrage bani", () => {
    const rezultat = genereazaSepa(intrare({ plati: [plata({ suma: -100 })] }));

    expect(coduri(rezultat)).toContain("SAL_SEPA_SUMA_INVALIDA");
    expect(rezultat.numarPlati).toBe(0);
  });

  it("o sumă care se rotunjește la zero bani e respinsă, nu trecută ca 0.00", () => {
    const rezultat = genereazaSepa(intrare({ plati: [plata({ suma: 0.004 })] }));

    expect(coduri(rezultat)).toContain("SAL_SEPA_SUMA_INVALIDA");
    expect(rezultat.probleme[0]?.detalii).toContain("0,00");
  });

  it("o sumă care nu e număr finit e raportată, nu aruncată ca excepție", () => {
    const rezultat = genereazaSepa(
      intrare({ plati: [plata({ suma: Number.NaN }), plata({ suma: Number.POSITIVE_INFINITY })] }),
    );

    expect(coduri(rezultat)).toEqual([
      "SAL_SEPA_SUMA_INVALIDA",
      "SAL_SEPA_SUMA_INVALIDA",
      "SAL_SEPA_FARA_PLATI",
    ]);
  });

  it("o sumă finită, dar peste limita de reprezentare exactă, e raportată — nu aruncată", () => {
    // Golul găsit la revizuire: `1e15` e finit și pozitiv, deci trecea de ambele
    // gărzi, iar `dinLei` dădea 1e17 bani — un întreg care NU mai e sigur.
    // Urmarea: `formateazaBani` scria „100000000000000020.00" în `InstdAmt`, iar
    // `bani(totalBani)` de la final arunca `RangeError`. Adică modulul cădea cu
    // excepție exact acolo unde antetul lui promite un raport, iar Server Action
    // ar fi întors 500 fără să spună care rând din stat e de vină.
    const rezultat = genereazaSepa(
      intrare({
        plati: [
          plata({ referinta: "SAL-1", suma: 1000 }),
          plata({ referinta: "SAL-2", iban: IBAN_ANGAJAT_2, suma: 1e15 }),
        ],
      }),
    );

    expect(coduri(rezultat)).toEqual(["SAL_SEPA_SUMA_INVALIDA"]);
    expect(rezultat.numarPlati).toBe(1);
    expect(rezultat.sumaControl).toBe(1000);
    expect(rezultat.xml).not.toContain("e+");
  });

  it("un TOTAL peste limita de reprezentare exactă oprește plata care îl depășește, nu tot fișierul", () => {
    // Fiecare linie e reprezentabilă; suma lor nu mai e. Fără verificarea pe
    // total, `bani(totalBani)` arunca după ce fișierul era deja construit.
    const mare = 90_000_000_000_000;
    const rezultat = genereazaSepa(
      intrare({
        plati: [
          plata({ referinta: "SAL-1", suma: mare }),
          plata({ referinta: "SAL-2", iban: IBAN_ANGAJAT_2, suma: mare }),
          plata({ referinta: "SAL-3", iban: IBAN_ANGAJAT_3, suma: 250 }),
        ],
      }),
    );

    expect(rezultat.numarPlati).toBe(2);
    expect(coduri(rezultat)).toEqual(["SAL_SEPA_SUMA_INVALIDA"]);
    expect(valori(rezultat.xml, "EndToEndId")).toEqual(["SAL-1", "SAL-3"]);
    expect(rezultat.xml).not.toContain("e+");

    // Totalul se verifică față de LINIILE SCRISE, nu față de `mare + 250`:
    // peste ~2,2 × 10¹³ lei, nudge-ul relativ din `rotundSimetric` (`bani.ts`)
    // depășește o jumătate de ban și mută el însuși ultima subunitate, iar
    // drumul dus-întors lei → bani → lei nu mai e stabil. E încă un motiv
    // pentru care garda de mai sus există: dincolo de pragul ăsta nicio cifră
    // nu mai e exactă. Invariantul care trebuie să țină e „CtrlSum = suma
    // liniilor din fișier", iar el ține și aici.
    const totalLinii = valori(rezultat.xml, "InstdAmt").reduce(
      (total, suma) => total + inBani(suma),
      0,
    );

    for (const control of valori(rezultat.xml, "CtrlSum")) {
      expect(inBani(control)).toBe(totalLinii);
    }
  });
});

describe("moneda ordinului", () => {
  it("o monedă care nu e cod de trei litere oprește tot fișierul", () => {
    // `Ccy` e `ActiveOrHistoricCurrencyCode` în schemă: exact trei litere mari.
    // Înainte, orice text ajungea în atribut, escapat frumos — fișier bine
    // format, respins de bancă, cu zero probleme raportate.
    for (const moneda of ["", "   ", "RO", "RONX", "lei romanesti", 'R"N']) {
      const rezultat = genereazaSepa(intrare({ moneda }));

      expect(rezultat.xml).toBe("");
      expect(rezultat.numarPlati).toBe(0);
      expect(rezultat.sumaControl).toBe(0);
      expect(coduri(rezultat)).toEqual(["SAL_SEPA_MONEDA_INVALIDA", "SAL_SEPA_FARA_PLATI"]);
    }
  });

  it("moneda scrisă cu litere mici sau cu spații în plus e acceptată, normalizată", () => {
    expect(genereazaSepa(intrare({ moneda: " eur " })).xml).toContain('Ccy="EUR"');
  });

  it("defectele de antet se raportează TOATE deodată, nu unul pe rulare", () => {
    const rezultat = genereazaSepa(intrare({ ibanPlatitor: IBAN_CONTROL_GRESIT, moneda: "" }));

    expect(coduri(rezultat)).toEqual([
      "SAL_SEPA_IBAN_INVALID",
      "SAL_SEPA_MONEDA_INVALIDA",
      "SAL_SEPA_FARA_PLATI",
    ]);
  });
});

describe("CtrlSum", () => {
  it("INVARIANT: CtrlSum e suma exactă a tuturor InstdAmt din fișier", () => {
    const rezultat = genereazaSepa(
      intrare({
        plati: [
          plata({ referinta: "SAL-1", suma: 3500.33 }),
          plata({ referinta: "SAL-2", iban: IBAN_ANGAJAT_2, suma: 4250.75 }),
          plata({ referinta: "SAL-3", iban: IBAN_ANGAJAT_3, suma: 1899.99 }),
        ],
      }),
    );
    const sumeScrise = valori(rezultat.xml, "InstdAmt").reduce(
      (total, suma) => total + inBani(suma),
      0,
    );
    const controale = valori(rezultat.xml, "CtrlSum");

    expect(controale).toEqual(["9651.07", "9651.07"]);
    expect(inBani(controale[0] ?? "0")).toBe(sumeScrise);
    expect(rezultat.sumaControl).toBe(9651.07);
  });

  it("acumularea se face în bani, deci 0,1 + 0,2 + 0,3 dă 0.60, nu 0.6000000000000001", () => {
    const rezultat = genereazaSepa(
      intrare({
        plati: [
          plata({ referinta: "SAL-1", suma: 0.1 }),
          plata({ referinta: "SAL-2", iban: IBAN_ANGAJAT_2, suma: 0.2 }),
          plata({ referinta: "SAL-3", iban: IBAN_ANGAJAT_3, suma: 0.3 }),
        ],
      }),
    );

    expect(valori(rezultat.xml, "CtrlSum")).toEqual(["0.60", "0.60"]);
    expect(rezultat.sumaControl).toBe(0.6);
  });

  it("CtrlSum numără doar plățile INCLUSE, nu și pe cele excluse", () => {
    // Banca respinge fișierul dacă totalul declarat nu se potrivește cu suma
    // liniilor. Plata scoasă afară nu are voie să rămână în total.
    const rezultat = genereazaSepa(
      intrare({
        plati: [
          plata({ referinta: "SAL-1", suma: 1000 }),
          plata({ referinta: "SAL-2", iban: IBAN_CONTROL_GRESIT, suma: 500 }),
          plata({ referinta: "SAL-3", iban: IBAN_ANGAJAT_2, suma: 0 }),
        ],
      }),
    );

    expect(rezultat.numarPlati).toBe(1);
    expect(valori(rezultat.xml, "NbOfTxs")).toEqual(["1", "1"]);
    expect(valori(rezultat.xml, "CtrlSum")).toEqual(["1000.00", "1000.00"]);
    expect(rezultat.sumaControl).toBe(1000);
  });

  it("INVARIANT pe 400 de seturi generate: părțile însumează întregul, indiferent de ordine", () => {
    // Un singur set de trei plăți nu apără un invariant de sumă: eroarea de
    // acumulare apare pe combinații de sume cu zecimale la limita rotunjirii, nu
    // pe cifre alese cu mâna. Generatorul e determinist (sămânță fixă), ca un
    // eșec să fie reproductibil, nu „a picat o dată în CI".
    let stare = 20260822;
    const urmator = (): number => {
      stare = (stare * 1103515245 + 12345) % 2147483648;
      return stare / 2147483648;
    };
    const conturi = [IBAN_ANGAJAT_1, IBAN_ANGAJAT_2, IBAN_ANGAJAT_3, IBAN_CONTROL_GRESIT];

    for (let rulare = 0; rulare < 400; rulare += 1) {
      const cate = 1 + Math.floor(urmator() * 12);
      const plati = Array.from({ length: cate }, (_, i) =>
        plata({
          referinta: `SAL-${String(i)}`,
          iban: conturi[Math.floor(urmator() * conturi.length)] ?? IBAN_ANGAJAT_1,
          // Trei zecimale: fiecare a treia sumă cade exact pe jumătatea de ban.
          suma: Math.round(urmator() * 5_000_000) / 1000,
        }),
      );
      const rezultat = genereazaSepa(intrare({ plati }));
      const inversat = genereazaSepa(intrare({ plati: [...plati].reverse() }));

      // Ordinea nu schimbă nici totalul, nici câte linii rămân.
      expect(rezultat.sumaControl).toBe(inversat.sumaControl);
      expect(rezultat.numarPlati).toBe(inversat.numarPlati);

      if (rezultat.xml === "") {
        expect(rezultat.numarPlati).toBe(0);
        expect(rezultat.sumaControl).toBe(0);
        continue;
      }

      const linii = valori(rezultat.xml, "InstdAmt");
      const totalLinii = linii.reduce((total, suma) => total + inBani(suma), 0);

      // Partea = întregul, la ban, în toate cele trei locuri unde e scris.
      expect(linii).toHaveLength(rezultat.numarPlati);
      for (const control of valori(rezultat.xml, "CtrlSum")) {
        expect(inBani(control)).toBe(totalLinii);
      }
      for (const numar of valori(rezultat.xml, "NbOfTxs")) {
        expect(numar).toBe(String(rezultat.numarPlati));
      }
      expect(inBani(formateazaSumaSepa(rezultat.sumaControl))).toBe(totalLinii);
      // Sumele nu ies niciodată în notație exponențială sau cu virgulă.
      for (const suma of linii) {
        expect(suma).toMatch(/^\d+\.\d{2}$/u);
      }
    }
  });
});

describe("limitele de lungime ale standardului", () => {
  it("numele beneficiarului se taie la 70 de caractere și se raportează", () => {
    const nume = "A".repeat(80);
    const rezultat = genereazaSepa(intrare({ plati: [plata({ numeBeneficiar: nume })] }));
    const numeScrise = valori(rezultat.xml, "Nm");

    expect(numeScrise[2]).toBe("A".repeat(70));
    expect(coduri(rezultat)).toEqual(["SAL_SEPA_TEXT_TRUNCHIAT"]);
    expect(rezultat.probleme[0]?.detalii).toContain("70");
  });

  it("explicația se taie la 140 de caractere și se raportează", () => {
    const explicatie = "B".repeat(200);
    const rezultat = genereazaSepa(intrare({ plati: [plata({ explicatie })] }));

    expect(valori(rezultat.xml, "Ustrd")).toEqual(["B".repeat(140)]);
    expect(coduri(rezultat)).toEqual(["SAL_SEPA_TEXT_TRUNCHIAT"]);
  });

  it("referința se taie la 35 de caractere și se raportează", () => {
    const rezultat = genereazaSepa(intrare({ plati: [plata({ referinta: "C".repeat(40) })] }));

    expect(valori(rezultat.xml, "EndToEndId")).toEqual(["C".repeat(35)]);
    expect(coduri(rezultat)).toEqual(["SAL_SEPA_TEXT_TRUNCHIAT"]);
  });

  it("identificatorul mesajului se taie la 35 de caractere, în MsgId și în PmtInfId", () => {
    const rezultat = genereazaSepa(intrare({ mesajId: "M".repeat(50) }));

    expect(valori(rezultat.xml, "MsgId")).toEqual(["M".repeat(35)]);
    expect(valori(rezultat.xml, "PmtInfId")).toEqual(["M".repeat(35)]);
    expect(coduri(rezultat)).toEqual(["SAL_SEPA_TEXT_TRUNCHIAT"]);
  });

  it("numele plătitorului se taie la 70 de caractere, în InitgPty și în Dbtr", () => {
    const rezultat = genereazaSepa(intrare({ numePlatitor: "S".repeat(90) }));
    const numeScrise = valori(rezultat.xml, "Nm");

    expect(numeScrise[0]).toBe("S".repeat(70));
    expect(numeScrise[1]).toBe("S".repeat(70));
    expect(coduri(rezultat)).toEqual(["SAL_SEPA_TEXT_TRUNCHIAT"]);
  });

  it("un text exact pe limită nu e raportat ca trunchiat", () => {
    const rezultat = genereazaSepa(
      intrare({
        plati: [
          plata({
            numeBeneficiar: "A".repeat(70),
            explicatie: "B".repeat(140),
            referinta: "C".repeat(35),
          }),
        ],
      }),
    );

    expect(rezultat.probleme).toEqual([]);
    expect(rezultat.numarPlati).toBe(1);
  });

  it("trunchierea nu se raportează pentru o plată exclusă din fișier", () => {
    // Textul acela nu ajunge nicăieri; singurul lucru de reparat e IBAN-ul.
    const rezultat = genereazaSepa(
      intrare({
        plati: [plata({ iban: IBAN_CONTROL_GRESIT, numeBeneficiar: "A".repeat(200) })],
      }),
    );

    expect(coduri(rezultat)).toEqual(["SAL_SEPA_IBAN_INVALID", "SAL_SEPA_FARA_PLATI"]);
  });

  it("tăierea numără PUNCTE DE COD, deci nu rupe o pereche surogat în două", () => {
    // Golul de acoperire găsit la revizuire: `limiteaza` documentează explicit
    // că numără puncte de cod (`[...text]`), dar toate datele din teste erau
    // ASCII — `curat.slice(0, limita)` ar fi trecut toate cele 45 de teste.
    // Un surogat orfan e caracter INVALID în XML: banca respinge fișierul, iar
    // mesajul ei nu spune niciodată de ce.
    const nume = "𝔄".repeat(80);
    const rezultat = genereazaSepa(intrare({ plati: [plata({ numeBeneficiar: nume })] }));
    const scris = valori(rezultat.xml, "Nm")[2] ?? "";

    expect([...scris]).toHaveLength(70);
    expect(scris).toBe("𝔄".repeat(70));
    expect(/[\uD800-\uDFFF]/u.test(rezultat.xml)).toBe(false);
  });

  it("tăierea nu rupe o entitate XML în două", () => {
    // Numele se taie ÎNAINTE de escapare. Invers, „&amp;" tăiat la mijloc ar
    // produce „&am", adică un fișier respins de bancă.
    const rezultat = genereazaSepa(
      intrare({ plati: [plata({ numeBeneficiar: `${"A".repeat(69)}&&&` })] }),
    );

    expect(rezultat.xml).toContain(`<Nm>${"A".repeat(69)}&amp;</Nm>`);
    expect(rezultat.xml).not.toContain("&am<");
  });
});

describe("fișierul care nu se emite", () => {
  it("lista goală nu produce niciun fișier", () => {
    const rezultat = genereazaSepa(intrare({ plati: [] }));

    expect(rezultat.xml).toBe("");
    expect(rezultat.numarPlati).toBe(0);
    expect(rezultat.sumaControl).toBe(0);
    expect(coduri(rezultat)).toEqual(["SAL_SEPA_FARA_PLATI"]);
  });

  it("toate plățile invalide înseamnă fișier inexistent, nu fișier gol", () => {
    const rezultat = genereazaSepa(
      intrare({
        plati: [plata({ iban: IBAN_CONTROL_GRESIT }), plata({ referinta: "SAL-2", suma: 0 })],
      }),
    );

    expect(rezultat.xml).toBe("");
    expect(coduri(rezultat)).toEqual([
      "SAL_SEPA_IBAN_INVALID",
      "SAL_SEPA_SUMA_INVALIDA",
      "SAL_SEPA_FARA_PLATI",
    ]);
    expect(rezultat.probleme[2]?.detalii).toContain("2");
  });
});

describe("BIC-ul băncii plătitoare", () => {
  it("apare în DbtrAgt când e cunoscut", () => {
    const rezultat = genereazaSepa(intrare({ bicPlatitor: "INGBROBU" }));

    expect(rezultat.xml).toContain("<BIC>INGBROBU</BIC>");
    expect(rezultat.xml).toContain("<DbtrAgt>");
  });

  it("elementul nu apare deloc când BIC-ul e null", () => {
    const rezultat = genereazaSepa(intrare({ bicPlatitor: null }));

    expect(rezultat.xml).not.toContain("DbtrAgt");
    expect(rezultat.xml).not.toContain("BIC");
    expect(rezultat.numarPlati).toBe(1);
  });

  it("un BIC format doar din spații e tratat ca absent, nu scris gol", () => {
    const rezultat = genereazaSepa(intrare({ bicPlatitor: "   " }));

    expect(rezultat.xml).not.toContain("DbtrAgt");
  });
});

describe("curățarea textului venit din baza de date", () => {
  it("sfârșiturile de linie dintr-un nume nu ajung în fișier", () => {
    const rezultat = genereazaSepa(
      intrare({ plati: [plata({ numeBeneficiar: "Ion\nPopescu\t Marin " })] }),
    );

    expect(rezultat.xml).toContain("<Nm>Ion Popescu Marin</Nm>");
  });

  it("explicația goală lasă blocul RmtInf afară", () => {
    const rezultat = genereazaSepa(intrare({ plati: [plata({ explicatie: "  " })] }));

    expect(rezultat.xml).not.toContain("RmtInf");
    expect(rezultat.xml).not.toContain("Ustrd");
    expect(rezultat.numarPlati).toBe(1);
  });

  it("referința lipsă devine NOTPROVIDED, nu un identificator inventat", () => {
    const rezultat = genereazaSepa(intrare({ plati: [plata({ referinta: "" })] }));

    expect(valori(rezultat.xml, "EndToEndId")).toEqual(["NOTPROVIDED"]);
  });

  it("caracterele invizibile de formatare nu ajung în fișier", () => {
    // BOM, ZWSP și marcajul de direcție vin lipite de text la copiere din Excel
    // sau din PDF. Nu se văd nicăieri, dar sunt caractere reale în câmp: unele
    // bănci resping câmpul, altele le trimit mai departe pe extras.
    const rezultat = genereazaSepa(
      intrare({ plati: [plata({ numeBeneficiar: "\uFEFFIon\u200BPopescu\u200E" })] }),
    );

    expect(rezultat.xml).toContain("<Nm>Ion Popescu</Nm>");
    expect(/[\uFEFF\u200B\u200E]/u.test(rezultat.xml)).toBe(false);
  });

  it("o jumătate de pereche surogat, rămasă dintr-o tăiere de mai sus, nu ajunge în fișier", () => {
    // Un `substring(0, 70)` făcut oriunde mai sus, pe unități UTF-16, lasă un
    // surogat orfan. E caracter ILEGAL în XML 1.0 — nu doar invalid față de
    // schemă, ci imposibil de parsat — și nu are entitate prin care să fie
    // escapat: singura apărare e să nu intre.
    const rezultat = genereazaSepa(
      intrare({
        plati: [plata({ numeBeneficiar: "Ion\uD83DPopescu", explicatie: "Salariu\uDC00" })],
      }),
    );

    expect(rezultat.xml).toContain("<Nm>Ion Popescu</Nm>");
    expect(valori(rezultat.xml, "Ustrd")).toEqual(["Salariu"]);
    expect(/[\uD800-\uDFFF]/u.test(rezultat.xml)).toBe(false);
  });

  it("un caracter astral întreg NU e curățat — se curăță doar jumătățile orfane", () => {
    const rezultat = genereazaSepa(
      intrare({ plati: [plata({ numeBeneficiar: "Ion 𝔄 Popescu" })] }),
    );

    expect(rezultat.xml).toContain("<Nm>Ion 𝔄 Popescu</Nm>");
  });

  it("data și momentul generării se curăță la fel ca restul, nu doar se escapează", () => {
    // Golul găsit la revizuire: `creatLa` și `dataExecutiei` erau SINGURELE
    // valori care ajungeau în fișier fără `curataText`. Escaparea nu le salvează:
    // U+0000 e ilegal în XML 1.0 și nu are entitate, deci un octet nul rămas
    // dintr-o coloană ar fi făcut fișierul imposibil de PARSAT — nu doar invalid
    // față de schemă, ci nedeschidibil de niciun parser.
    const rezultat = genereazaSepa(
      intrare({ creatLa: "2026-09-05T09:30:00\u0000", dataExecutiei: "2026-09-10\n" }),
    );

    expect(valori(rezultat.xml, "CreDtTm")).toEqual(["2026-09-05T09:30:00"]);
    expect(valori(rezultat.xml, "ReqdExctnDt")).toEqual(["2026-09-10"]);
    expect(rezultat.xml).not.toContain("\u0000");
  });
});
