// src/domain/payroll/bancar/sepa.ts
//
// Ordin de plată colectiv SEPA Credit Transfer — ISO 20022, schema
// `pain.001.001.03`.
//
// REGULA DE FORMAT. `pain.001.001.03` („Customer Credit Transfer Initiation")
// e o schemă PUBLICĂ, publicată de ISO și adoptată de Consiliul European al
// Plăților pentru schema SCT. Spre deosebire de D112 sau REVISAL — ale căror
// specificații nu le avem și pe care nu le inventăm — aceasta se poate
// implementa complet: ce iese de aici trebuie să treacă validarea băncii din
// prima încărcare, fără intervenție manuală.
//
// Ce impune standardul și unde se vede în cod:
//
//   1. XML BINE FORMAT. Numele și explicațiile vin din baza de date, unde o
//      firmă se poate numi „Popescu & Fiii" sau „S.C. <ceva> S.R.L.".
//      Nescapate, caracterele astea rup fișierul, iar banca respinge ÎNTREGUL
//      ordin, nu doar linia vinovată. Toate valorile textuale, inclusiv
//      atributul `Ccy`, trec prin `escapeazaXml`.
//   2. IBAN VALID: structura ISO 13616 (două litere de țară, două cifre de
//      control, lungime fixă pe țară) plus cifra de control ISO 7064
//      mod-97-10. Un IBAN greșit nu e întotdeauna respins la încărcare —
//      uneori banii ajung într-un cont care există, dar e al altcuiva.
//   3. SUME cu exact două zecimale și PUNCT ca separator zecimal, fără
//      separator de mii. `123,45` și `123.4` sunt respinse de parser.
//   4. `CtrlSum` = suma exactă a tuturor `InstdAmt`, la ban. E controlul pe
//      care banca îl face înainte de a executa ordinul: dacă nu corespunde,
//      fișierul e respins în întregime. De aceea totalul se acumulează în
//      ÎNTREGI (bani), prin `dinLei` din `src/domain/bani.ts`, nu în virgulă
//      mobilă — altfel 0,1 + 0,2 iese 0,30000000000000004.
//   5. LIMITE DE LUNGIME: 35 de caractere pentru identificatori (`MsgId`,
//      `PmtInfId`, `EndToEndId`), 70 pentru nume, 140 pentru explicație. Peste
//      limită, banca fie taie tăcut, fie respinge. Tăiem noi și RAPORTĂM, ca
//      omul care semnează ordinul să știe dinainte ce va vedea beneficiarul pe
//      extras.
//   6. O PLATĂ INVALIDĂ NU INTRĂ ÎN FIȘIER. Un ordin bancar nu se trimite „pe
//      jumătate greșit": plata cu IBAN invalid sau cu sumă nepozitivă e
//      exclusă, cu problemă raportată, iar `NbOfTxs` și `CtrlSum` descriu ce a
//      rămas efectiv în fișier — niciodată ce s-a primit la intrare.
//   7. UN DEFECT DE ANTET NU EMITE NIMIC. Contul plătitorului și moneda se scriu
//      o dată, dar se aplică întregului fișier: greșite, banca respinge tot, deci
//      nu are sens să triem plățile. Se raportează toate defectele de antet
//      deodată, apoi se iese cu `xml` gol.
//
// NICIODATĂ NU ARUNCĂ. E o etapă de calcul: sumele nefinite, cele nepozitive și
// cele de peste `Number.MAX_SAFE_INTEGER` bani se RAPORTEAZĂ ca probleme și se
// exclud. O excepție dintr-un generator de fișiere ar cădea în Server Action ca
// 500, fără să spună care rând din stat e de vină.
//
// ⚠️ DE CONFIRMAT CU BANCA ORGANIZAȚIEI ÎNAINTE DE PRIMA PLATĂ REALĂ:
//   - SETUL DE CARACTERE. Schema SCT admite doar setul latin de bază
//     (`a-z A-Z 0-9 / - ? : ( ) . , ' +` și spațiul). Diacriticele românești
//     (ș, ț, ă, î, â) NU fac parte din el: unele bănci le transliterează
//     tăcut, altele resping fișierul. Modulul NU transliterează — ar schimba
//     numele oamenilor fără ca cineva să fi cerut asta. Dacă banca o cere, se
//     adaugă ca etapă separată, explicită și testată.
//   - `<DbtrAgt>` LIPSEȘTE complet când BIC-ul nu e cunoscut. Unele bănci
//     acceptă omiterea (deduc agentul din IBAN-ul plătitorului), altele cer
//     `<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>`.
//   - `<PmtTpInf>`, `<ChrgBr>`, `<BtchBookg>` sunt opționale în schemă și nu
//     se pun „la noroc": dacă banca le cere, se adaugă cu valorile ei.
//
// PRECONDIȚIE A APELANTULUI: `numeBeneficiar` nu e gol. `<Nm>` e obligatoriu
// în schemă, iar catalogul de probleme al etapei nu are cod pentru „nume
// lipsă"; modulul nu inventează un nume și nu îl deduce. În bază coloana e
// NOT NULL, deci un nume gol înseamnă un defect în stratul care compune
// plățile, nu o situație de tratat aici.
//
// Funcție PURĂ: momentul generării și data execuției INTRĂ ca date. Nu se
// citește ceasul — același set de plăți trebuie să producă exact același
// fișier în Server Action, în previzualizarea din UI și în teste, ca
// regenerarea după o eroare să fie identică octet cu octet.

import { bani, dinLei, inLei } from "../../bani";
import type { ProblemaEtapa } from "../etape/probleme";

export type { ProblemaEtapa };

/** O plată din ordinul colectiv — un angajat, un cont, o sumă. */
export interface PlataSepa {
  /** Identificator unic al plății in mesaj, max 35 de caractere. */
  readonly referinta: string;
  readonly numeBeneficiar: string;
  readonly iban: string;
  /** Suma in lei, pozitiva. */
  readonly suma: number;
  /** Textul care apare pe extras, max 140 de caractere. */
  readonly explicatie: string;
}

export interface IntrarePlata {
  readonly mesajId: string;
  /** Momentul generarii, 'AAAA-LL-ZZTHH:MM:SS' — INTRA ca data, nu se citeste ceasul. */
  readonly creatLa: string;
  /** Data solicitata a executiei, 'AAAA-LL-ZZ'. */
  readonly dataExecutiei: string;
  readonly numePlatitor: string;
  readonly ibanPlatitor: string;
  /** BIC-ul bancii platitoare; `null` cand nu e cunoscut. */
  readonly bicPlatitor: string | null;
  readonly moneda: string;
  readonly plati: readonly PlataSepa[];
}

export interface RezultatSepa {
  /** Fișierul complet. Șir GOL când nu s-a putut emite nicio plată. */
  readonly xml: string;
  /** Câte plăți au intrat efectiv în fișier — nu câte au fost primite. */
  readonly numarPlati: number;
  /** Totalul plăților INCLUSE, în lei. Egal cu `CtrlSum` din fișier. */
  readonly sumaControl: number;
  readonly probleme: readonly ProblemaEtapa[];
}

/** Un IBAN nu trece validarea ISO 13616 / mod-97-10. Plata nu poate fi emisă. */
export const COD_IBAN_INVALID = "SAL_SEPA_IBAN_INVALID";
/** Sumă zero, negativă, nefinită, peste limita de reprezentare exactă sau care se rotunjește la zero bani. */
export const COD_SUMA_INVALIDA = "SAL_SEPA_SUMA_INVALIDA";
/** Moneda nu e un cod de trei litere. Fișierul nu se poate emite deloc. */
export const COD_MONEDA_INVALIDA = "SAL_SEPA_MONEDA_INVALIDA";
/** Un text a depășit limita standardului și a fost tăiat. */
export const COD_TEXT_TRUNCHIAT = "SAL_SEPA_TEXT_TRUNCHIAT";
/** Nicio plată validă: fișierul ar fi fost gol, deci nu s-a emis. */
export const COD_FARA_PLATI = "SAL_SEPA_FARA_PLATI";

const SPATIU_NUME = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03";

/** `MsgId`, `PmtInfId`, `EndToEndId` — max 35 de caractere în schemă. */
const LIMITA_IDENTIFICATOR = 35;
/** `Nm` (plătitor, beneficiar, parte inițiatoare) — max 70. */
const LIMITA_NUME = 70;
/** `RmtInf/Ustrd` — max 140. E textul care apare pe extrasul beneficiarului. */
const LIMITA_EXPLICATIE = 140;

/**
 * `EndToEndId` e obligatoriu în schemă. Când apelantul nu are o referință,
 * standardul prevede exact literalul ăsta — nu inventăm un identificator, care
 * ar părea o referință reală în reconcilierea de mai târziu.
 */
const REFERINTA_LIPSA = "NOTPROVIDED";

function tabelLungimi(sursa: string): ReadonlyMap<string, number> {
  const perechi = sursa
    .trim()
    .split(/\s+/u)
    .map((intrare): readonly [string, number] => [intrare.slice(0, 2), Number(intrare.slice(2))]);
  return new Map(perechi);
}

/**
 * Lungimea IBAN-ului pe țară, din registrul IBAN (ISO 13616-2).
 *
 * DE CE E OBLIGATORIE, pe lângă cifra de control: mod-97-10 nu vede lungimea.
 * Un IBAN românesc din care s-a pierdut un caracter poate avea, întâmplător,
 * restul 1 — și trece validarea aritmetică fiind, de fapt, un cont inexistent.
 *
 * O țară care nu apare aici e RESPINSĂ. Într-un fișier de salarii, un prefix
 * necunoscut e aproape sigur o greșeală de tastare, iar tabelul acoperă toată
 * zona SEPA plus vecinătatea. ⚠️ De actualizat când registrul IBAN se schimbă.
 */
const LUNGIMI_IBAN = tabelLungimi(`
  AD24 AE23 AL28 AT20 AZ28 BA20 BE16 BG22 BH22 BR29 BY28 CH21 CR22 CY28 CZ24
  DE22 DK18 DO28 EE20 EG29 ES24 FI18 FO18 FR27 GB22 GE22 GI23 GL18 GR27 GT28
  HR21 HU28 IE22 IL23 IQ23 IS26 IT27 JO30 KW30 KZ20 LB28 LC32 LI21 LT20 LU20
  LV21 LY25 MC27 MD24 ME22 MK19 MR27 MT31 MU30 NL18 NO15 PK24 PL28 PS29 PT25
  QA29 RO24 RS22 SA24 SC31 SE24 SI19 SK24 SM27 ST25 SV28 TL23 TN24 TR26 UA29
  VA22 VG24 XK20
`);

/** Formatul unui IBAN înainte de verificarea aritmetică. */
const FORMA_IBAN = /^[A-Z]{2}[0-9]{2}[0-9A-Z]{1,30}$/u;

/**
 * `Ccy` e `ActiveOrHistoricCurrencyCode` în schemă: EXACT trei litere mari.
 *
 * Un `Ccy=""` sau `Ccy="LEI ROMANESTI"` nu strică o linie, ci întregul fișier —
 * și îl strică TĂCUT: XML-ul e bine format, deci nimic din generare nu se
 * plânge, iar respingerea vine abia de la bancă, după ce salariile au fost
 * anunțate. Se verifică aici, ca defect de ANTET, la fel ca IBAN-ul plătitorului.
 */
const FORMA_MONEDA = /^[A-Z]{3}$/u;

/** Scoate spațiile și separatoarele de grupare cu care e scris IBAN-ul pe hârtie. */
export function normalizeazaIban(valoare: string): string {
  return valoare.replace(/[\s.\-_]/gu, "").toUpperCase();
}

/**
 * Restul ISO 7064 mod-97-10: primele patru caractere trec la coadă, fiecare
 * literă devine două cifre (A=10 … Z=35), iar restul împărțirii la 97 trebuie
 * să fie 1.
 *
 * Restul se calculează cifră cu cifră, nu prin `BigInt` sau `Number`: un IBAN
 * de 34 de caractere devine un număr de peste 40 de cifre, care în virgulă
 * mobilă și-ar pierde exact cifrele de la coadă, adică pe cele care contează.
 */
function restMod9710(iban: string): number {
  const rearanjat = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let rest = 0;
  for (const caracter of rearanjat) {
    const cod = caracter.charCodeAt(0);
    const bucata = cod >= 65 && cod <= 90 ? String(cod - 55) : caracter;
    for (const cifra of bucata) {
      rest = (rest * 10 + (cifra.charCodeAt(0) - 48)) % 97;
    }
  }
  return rest;
}

/** Structură + lungime pe țară + cifră de control. Pură, fără dependențe. */
export function esteIbanValid(valoare: string): boolean {
  const iban = normalizeazaIban(valoare);
  if (!FORMA_IBAN.test(iban)) {
    return false;
  }
  const lungimeTarii = LUNGIMI_IBAN.get(iban.slice(0, 2));
  if (lungimeTarii === undefined || iban.length !== lungimeTarii) {
    return false;
  }
  return restMod9710(iban) === 1;
}

/**
 * Cât din IBAN se scrie într-un mesaj de problemă.
 *
 * Mijlocul rămâne mascat: problemele ajung în jurnale și pe ecrane la care au
 * acces mai mulți oameni decât cei care au voie să vadă contul unui angajat.
 * Primele și ultimele patru caractere sunt suficiente ca să recunoști rândul.
 */
function indiciuIban(iban: string): string {
  return iban.length >= 8 ? `${iban.slice(0, 4)}…${iban.slice(-4)}` : iban;
}

/**
 * Caracterele de control (inclusiv sfârșitul de linie), cele invizibile de
 * formatare și SURogatele ORFANE nu au ce căuta într-un câmp bancar: fie rup
 * fișierul, fie ajung pe extras ca gunoi. Se înlocuiesc cu spațiu, iar spațiile
 * se colapsează.
 *
 * `\p{Cs}` e acolo pentru un motiv precis: un U+0000 sau o jumătate de pereche
 * surogat rămasă dintr-un `substring` făcut mai sus pe UNITĂȚI UTF-16 sunt
 * caractere ILEGALE în XML 1.0 — nu invalide față de schemă, ci imposibil de
 * parsat, și fără entitate prin care să fie scăpate. Escaparea nu ajută;
 * singura apărare e să nu ajungă în fișier. Perechile întregi trec neatinse.
 *
 * Rulează ÎNAINTE de trunchiere, ca limita să se măsoare pe textul real, și
 * înainte de escapare, ca să nu tăiem vreodată o entitate `&amp;` în două.
 */
function curataText(valoare: string): string {
  return valoare
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

interface TextLimitat {
  readonly text: string;
  readonly trunchiat: boolean;
}

/**
 * Taie la limita standardului, numărând PUNCTE DE COD, nu unități UTF-16: o
 * tăiere la jumătatea unei perechi surogat ar produce un caracter invalid în
 * XML, iar banca ar respinge fișierul pentru un motiv imposibil de ghicit din
 * mesajul ei de eroare.
 */
function limiteaza(valoare: string, limita: number): TextLimitat {
  const curat = curataText(valoare);
  const caractere = [...curat];
  if (caractere.length <= limita) {
    return { text: curat, trunchiat: false };
  }
  return { text: caractere.slice(0, limita).join("").trimEnd(), trunchiat: true };
}

const INLOCUIRI_XML: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escapare XML pentru ORICE valoare textuală, fără excepții.
 *
 * `"` și `'` nu sunt strict obligatorii în conținutul unui element, dar sunt în
 * atribute (`Ccy="RON"`), iar o singură funcție folosită peste tot e mai greu
 * de uitat decât două cu domenii diferite de aplicare. `&` se tratează prin
 * aceeași trecere, nu separat: o a doua trecere ar re-escapa ce a produs prima.
 */
export function escapeazaXml(valoare: string): string {
  return valoare.replace(/[&<>"']/gu, (caracter) => INLOCUIRI_XML[caracter] ?? caracter);
}

/** Bani (întreg) → șirul cerut de standard: două zecimale, punct, fără mii. */
function formateazaBani(suma: number): string {
  const semn = suma < 0 ? "-" : "";
  const absolut = Math.abs(suma);
  const lei = Math.floor(absolut / 100);
  const subunitati = absolut % 100;
  return `${semn}${String(lei)}.${String(subunitati).padStart(2, "0")}`;
}

/**
 * Lei → `InstdAmt`. Trece prin `dinLei`, deci prin regula unică de rotunjire a
 * aplicației: `toFixed(2)` ar da „1.00" pentru 1,005, adică un ban în minus
 * față de ce a calculat statul de plată.
 */
export function formateazaSumaSepa(lei: number): string {
  return formateazaBani(dinLei(lei));
}

const INDENTARE = "  ";

function deschide(nivel: number, nume: string): string {
  return `${INDENTARE.repeat(nivel)}<${nume}>`;
}

function inchide(nivel: number, nume: string): string {
  return `${INDENTARE.repeat(nivel)}</${nume}>`;
}

function element(nivel: number, nume: string, valoare: string): string {
  return `${INDENTARE.repeat(nivel)}<${nume}>${escapeazaXml(valoare)}</${nume}>`;
}

/** O plată care a trecut triajul și are toate câmpurile gata de scris. */
interface RandPregatit {
  readonly referinta: string;
  readonly nume: string;
  readonly iban: string;
  readonly sumaBani: number;
  readonly explicatie: string;
}

function descrieBeneficiar(nume: string, referinta: string): string {
  const numit = nume.length > 0 ? `beneficiarul „${nume}"` : "un beneficiar fără nume";
  return referinta.length > 0 ? `${numit} (referința „${referinta}")` : numit;
}

export function genereazaSepa(intrare: IntrarePlata): RezultatSepa {
  const probleme: ProblemaEtapa[] = [];

  const idMesaj = limiteaza(intrare.mesajId, LIMITA_IDENTIFICATOR);
  if (idMesaj.trunchiat) {
    probleme.push({
      cod: COD_TEXT_TRUNCHIAT,
      detalii: `Identificatorul mesajului a fost tăiat la ${String(LIMITA_IDENTIFICATOR)} de caractere: „${idMesaj.text}".`,
    });
  }

  const numePlatitor = limiteaza(intrare.numePlatitor, LIMITA_NUME);
  if (numePlatitor.trunchiat) {
    probleme.push({
      cod: COD_TEXT_TRUNCHIAT,
      detalii: `Numele plătitorului a fost tăiat la ${String(LIMITA_NUME)} de caractere: „${numePlatitor.text}".`,
    });
  }

  // DEFECTELE DE ANTET se validează ÎNAINTE de plăți și opresc tot: contul
  // plătitor și moneda sunt scrise o singură dată, dar se aplică întregului
  // fișier. Dacă unul e greșit, nici măcar o plată corectă nu se execută, iar un
  // raport de 300 de rânduri despre beneficiari ar ascunde singurul lucru de
  // reparat. Se adună TOATE și se raportează deodată — cine repară ordinul le
  // vede dintr-o singură trecere, nu câte una pe rulare.
  const ibanPlatitor = normalizeazaIban(intrare.ibanPlatitor);
  const moneda = curataText(intrare.moneda).toUpperCase();
  const defecteAntet: ProblemaEtapa[] = [];

  if (!esteIbanValid(ibanPlatitor)) {
    defecteAntet.push({
      cod: COD_IBAN_INVALID,
      detalii: `Contul plătitorului „${curataText(intrare.numePlatitor)}" (${indiciuIban(ibanPlatitor)}) nu trece validarea IBAN.`,
    });
  }

  if (!FORMA_MONEDA.test(moneda)) {
    defecteAntet.push({
      cod: COD_MONEDA_INVALIDA,
      detalii:
        moneda.length === 0
          ? `Moneda ordinului lipsește; schema cere un cod de trei litere, ca „RON".`
          : `Moneda „${moneda}" nu e un cod de trei litere, ca „RON".`,
    });
  }

  if (defecteAntet.length > 0) {
    probleme.push(...defecteAntet, {
      cod: COD_FARA_PLATI,
      detalii: "Antetul ordinului nu e valid, deci niciun ordin de plată nu poate fi emis.",
    });
    return { xml: "", numarPlati: 0, sumaControl: 0, probleme };
  }

  const incluse: RandPregatit[] = [];
  let totalBani = 0;

  for (const plata of intrare.plati) {
    const numeCurat = curataText(plata.numeBeneficiar);
    const referintaCurata = curataText(plata.referinta);
    const descriere = descrieBeneficiar(numeCurat, referintaCurata);

    const iban = normalizeazaIban(plata.iban);
    if (!esteIbanValid(iban)) {
      probleme.push({
        cod: COD_IBAN_INVALID,
        detalii: `Plata către ${descriere} a fost exclusă: IBAN-ul ${indiciuIban(iban)} nu trece validarea.`,
      });
      continue;
    }

    // Finitudinea se verifică ÎNAINTE de `dinLei`: acesta aruncă `RangeError`
    // pe `NaN` și pe infinit, iar o etapă de calcul raportează probleme, nu
    // aruncă.
    if (!Number.isFinite(plata.suma) || plata.suma <= 0) {
      probleme.push({
        cod: COD_SUMA_INVALIDA,
        detalii: `Plata către ${descriere} a fost exclusă: suma ${String(plata.suma)} nu e un număr pozitiv.`,
      });
      continue;
    }

    const sumaBani = dinLei(plata.suma);
    if (sumaBani <= 0) {
      probleme.push({
        cod: COD_SUMA_INVALIDA,
        detalii: `Plata către ${descriere} a fost exclusă: suma ${String(plata.suma)} lei se rotunjește la 0,00 lei.`,
      });
      continue;
    }

    // `dinLei` întoarce un întreg, dar nu neapărat unul SIGUR: peste
    // `Number.MAX_SAFE_INTEGER` bani, virgula mobilă nu mai reprezintă exact
    // fiecare întreg. Consecințele sunt două, ambele tăcute până prea târziu:
    // `formateazaBani` scrie „1e+21.00" în loc de o sumă, iar `bani(totalBani)`
    // de la final ARUNCĂ `RangeError` — exact ce nu are voie să facă o etapă de
    // calcul, care raportează probleme (vezi și garda de finitudine de mai sus).
    // Se verifică și TOTALUL, nu doar plata: fiecare linie poate fi
    // reprezentabilă, iar suma lor să nu mai fie.
    if (!Number.isSafeInteger(sumaBani) || !Number.isSafeInteger(totalBani + sumaBani)) {
      probleme.push({
        cod: COD_SUMA_INVALIDA,
        detalii: `Plata către ${descriere} a fost exclusă: suma ${String(plata.suma)} lei trece peste limita până la care sumele se mai pot reprezenta exact la ban.`,
      });
      continue;
    }

    // Trunchierile se raportează DOAR pentru plățile care intră în fișier: un
    // avertisment despre un text tăiat într-o plată exclusă e zgomot, textul
    // acela nu ajunge nicăieri.
    const nume = limiteaza(plata.numeBeneficiar, LIMITA_NUME);
    if (nume.trunchiat) {
      probleme.push({
        cod: COD_TEXT_TRUNCHIAT,
        detalii: `Numele lui ${descriere} a fost tăiat la ${String(LIMITA_NUME)} de caractere: „${nume.text}".`,
      });
    }

    const referinta = limiteaza(plata.referinta, LIMITA_IDENTIFICATOR);
    if (referinta.trunchiat) {
      probleme.push({
        cod: COD_TEXT_TRUNCHIAT,
        detalii: `Referința plății către ${descriere} a fost tăiată la ${String(LIMITA_IDENTIFICATOR)} de caractere: „${referinta.text}".`,
      });
    }

    const explicatie = limiteaza(plata.explicatie, LIMITA_EXPLICATIE);
    if (explicatie.trunchiat) {
      probleme.push({
        cod: COD_TEXT_TRUNCHIAT,
        detalii: `Explicația plății către ${descriere} a fost tăiată la ${String(LIMITA_EXPLICATIE)} de caractere: „${explicatie.text}".`,
      });
    }

    totalBani += sumaBani;
    incluse.push({
      referinta: referinta.text.length > 0 ? referinta.text : REFERINTA_LIPSA,
      nume: nume.text,
      iban,
      sumaBani,
      explicatie: explicatie.text,
    });
  }

  if (incluse.length === 0) {
    probleme.push({
      cod: COD_FARA_PLATI,
      detalii:
        intrare.plati.length === 0
          ? "Lista de plăți e goală."
          : `Nicio plată validă din cele ${String(intrare.plati.length)} primite.`,
    });
    return { xml: "", numarPlati: 0, sumaControl: 0, probleme };
  }

  // `CreDtTm` și `ReqdExctnDt` vin ca text din stratul care compune ordinul și
  // erau singurele valori care ajungeau în fișier NECURĂȚATE. Escaparea nu le
  // salvează: U+0000 e ilegal în XML 1.0 și nu are entitate, deci un octet nul
  // rămas dintr-o coloană ar face fișierul imposibil de PARSAT, nu doar de
  // validat — iar invariantul 1 din antet spune „XML bine format", fără excepții.
  const creatLa = curataText(intrare.creatLa);
  const dataExecutiei = curataText(intrare.dataExecutiei);
  const numarTranzactii = String(incluse.length);
  const sumaControl = formateazaBani(totalBani);
  const bic = intrare.bicPlatitor === null ? "" : curataText(intrare.bicPlatitor).toUpperCase();

  const linii: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Document xmlns="${SPATIU_NUME}">`,
    deschide(1, "CstmrCdtTrfInitn"),
    deschide(2, "GrpHdr"),
    element(3, "MsgId", idMesaj.text),
    element(3, "CreDtTm", creatLa),
    element(3, "NbOfTxs", numarTranzactii),
    element(3, "CtrlSum", sumaControl),
    deschide(3, "InitgPty"),
    element(4, "Nm", numePlatitor.text),
    inchide(3, "InitgPty"),
    inchide(2, "GrpHdr"),
    deschide(2, "PmtInf"),
    // Un singur bloc `PmtInf` pentru tot ordinul: aceeași dată de execuție,
    // același cont plătitor, aceeași monedă. `PmtInfId` reia `MsgId` — există
    // un singur bloc, deci nu are ce să dezambiguizeze.
    element(3, "PmtInfId", idMesaj.text),
    element(3, "PmtMtd", "TRF"),
    element(3, "NbOfTxs", numarTranzactii),
    element(3, "CtrlSum", sumaControl),
    element(3, "ReqdExctnDt", dataExecutiei),
    deschide(3, "Dbtr"),
    element(4, "Nm", numePlatitor.text),
    inchide(3, "Dbtr"),
    deschide(3, "DbtrAcct"),
    deschide(4, "Id"),
    element(5, "IBAN", ibanPlatitor),
    inchide(4, "Id"),
    inchide(3, "DbtrAcct"),
  ];

  if (bic.length > 0) {
    linii.push(
      deschide(3, "DbtrAgt"),
      deschide(4, "FinInstnId"),
      element(5, "BIC", bic),
      inchide(4, "FinInstnId"),
      inchide(3, "DbtrAgt"),
    );
  }

  for (const rand of incluse) {
    linii.push(
      deschide(3, "CdtTrfTxInf"),
      deschide(4, "PmtId"),
      element(5, "EndToEndId", rand.referinta),
      inchide(4, "PmtId"),
      deschide(4, "Amt"),
      `${INDENTARE.repeat(5)}<InstdAmt Ccy="${escapeazaXml(moneda)}">${formateazaBani(rand.sumaBani)}</InstdAmt>`,
      inchide(4, "Amt"),
      deschide(4, "Cdtr"),
      element(5, "Nm", rand.nume),
      inchide(4, "Cdtr"),
      deschide(4, "CdtrAcct"),
      deschide(5, "Id"),
      element(6, "IBAN", rand.iban),
      inchide(5, "Id"),
      inchide(4, "CdtrAcct"),
    );
    // `RmtInf` e opțional în schemă: fără explicație, blocul lipsește cu totul.
    // Un `<Ustrd></Ustrd>` gol e respins de unele bănci ca element fără valoare.
    if (rand.explicatie.length > 0) {
      linii.push(deschide(4, "RmtInf"), element(5, "Ustrd", rand.explicatie), inchide(4, "RmtInf"));
    }
    linii.push(inchide(3, "CdtTrfTxInf"));
  }

  linii.push(inchide(2, "PmtInf"), inchide(1, "CstmrCdtTrfInitn"), "</Document>");

  return {
    xml: linii.join("\n"),
    numarPlati: incluse.length,
    sumaControl: inLei(bani(totalBani)),
    probleme,
  };
}
