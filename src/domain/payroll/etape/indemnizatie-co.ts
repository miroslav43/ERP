// src/domain/payroll/etape/indemnizatie-co.ts
//
// Indemnizația de concediu de odihnă — etapă pură din lanțul de salarizare.
//
// REGULA LEGALĂ. Codul muncii (Legea 53/2003), art. 150, cu norma de aplicare
// din HG 250/1992:
//
//   alin. (1) — indemnizația NU POATE FI MAI MICĂ decât salariul de bază,
//   indemnizațiile și sporurile cu caracter permanent cuvenite pentru perioada
//   respectivă. E un PLANȘEU, nu o formulă de calcul.
//
//   alin. (2) — indemnizația REPREZINTĂ media zilnică a drepturilor salariale
//   din ULTIMELE 3 LUNI anterioare celei în care se efectuează concediul,
//   înmulțită cu numărul zilelor de concediu.
//
// DE CE DOUĂ VARIANTE ȘI DE CE SE IA CEA MAI MARE. Cele două aliniate nu sunt
// alternative la alegerea angajatorului: alin. (2) dă formula, alin. (1) îi
// pune o limită de jos. Când media ultimelor trei luni iese SUB rata zilnică a
// salariului de bază curent — angajatul a avut o lună slabă sau a primit între
// timp o majorare — plata la medie ar coborî sub planșeul din alin. (1). Când
// media iese PESTE — angajatul a avut sporuri permanente în perioada de
// referință — plata la bază i-ar tăia din drepturi. De aici practica uniformă
// în controalele ITM: se acordă varianta mai avantajoasă pentru salariat.
// Acesta e modul `cea_mai_avantajoasa`, singurul corect pentru un calcul real.
// Celelalte două moduri există pentru comparație pe fluturaș și pentru
// organizațiile care au fixat prin regulament intern o singură bază — ele NU
// verifică planșeul și nu trebuie folosite ca implicit.
//
// CE INTRĂ ÎN „DREPTURI SALARIALE". Salariul de bază plus sporurile cu caracter
// PERMANENT (vechime, condiții de muncă, fidelitate) — cele care se cuvin lună
// de lună indiferent de prestația punctuală. NU intră sporurile variabile: ore
// suplimentare, noapte, repaus săptămânal, sărbătoare legală, prime ocazionale.
// Selecția o face apelantul; etapa asta primește `drepturiSalariale` deja
// filtrate și nu are cum să verifice ce s-a pus în ele.
//
// DE CE MEDIA SE FACE PE ZILE LUCRATE, NU PE ZILE LUCRĂTOARE. Media zilnică a
// unei luni e „drepturile lunii / zilele efectiv lucrate în ea". O lună cu
// concediu medical sau fără plată are mai puține zile lucrate; împărțind la
// ele, rezultatul rămâne rata zilnică reală a angajatului, nu una diluată de
// absențe. O lună cu ZERO zile lucrate nu are nicio medie — se sare peste ea și
// se raportează, pentru că altfel ar trage media în jos cu o valoare inventată.
//
// Funcție PURĂ: fără ceas de sistem, fără I/O, fără aleator. Luna de concediu,
// istoricul de venit și modul de calcul intră toate ca date, ca să dea același
// rezultat în Server Action, în simularea din UI și în teste.
//
// NIMIC din modulul ăsta nu e certificat contabil — vezi NOTES.md.

import { rotunjesteLaBani } from "../../bani";
import type { ProblemaEtapa } from "./probleme";

export type { ProblemaEtapa };

/** O lună din istoricul de venit, folosită la medie. */
export interface LunaIstoricCo {
  readonly an: number;
  readonly luna: number;
  /** Salariu de bază + sporuri permanente ale lunii, în lei. */
  readonly drepturiSalariale: number;
  /** Zilele efectiv lucrate în acea lună. Zero înseamnă lună fără bază de medie. */
  readonly zileLucrate: number;
}

export type ModCalculCo = "baza" | "media_3_luni" | "cea_mai_avantajoasa";

export interface IntrareIndemnizatieCo {
  readonly mod: ModCalculCo;
  /** Zile de concediu de odihnă din luna calculată. */
  readonly zileConcediu: number;
  readonly salariuBaza: number;
  readonly zileLucratoareLuna: number;
  /** Lunile anterioare, cele mai recente PRIMELE. Poate fi mai scurt de 3. */
  readonly istoric: readonly LunaIstoricCo[];
  /** Câte luni cere regula. Implicit 3 la apelant; aici e explicit. */
  readonly luniNecesare: number;
}

export interface RezultatIndemnizatieCo {
  readonly suma: number;
  readonly rataZilnicaAplicata: number;
  readonly rataZilnicaBaza: number;
  /** `null` când istoricul nu permite nicio medie. */
  readonly rataZilnicaMedie: number | null;
  readonly luniFolosite: number;
  readonly probleme: readonly ProblemaEtapa[];
}

/** Istoricul are mai puține luni utilizabile decât cere regula. */
const COD_MEDIE_INCOMPLETA = "SAL_CO_MEDIE_INCOMPLETA";

/** Nicio lună utilizabilă — s-a căzut pe rata zilnică a salariului de bază. */
const COD_FARA_ISTORIC = "SAL_CO_FARA_ISTORIC";

/** Media a ieșit sub planșeul din art. 150 alin. (1); s-a aplicat baza. */
const COD_MEDIA_MAI_MICA = "SAL_CO_MEDIA_MAI_MICA";

/**
 * Indemnizația de concediu de odihnă pentru zilele de CO ale unei luni.
 *
 * Toate ratele întoarse sunt deja rotunjite la ban, iar `suma` se calculează
 * din rata rotunjită, nu din cea brută: pe fluturaș, „rata zilnică × zile" scris
 * de un contabil trebuie să dea exact suma plătită. Diferența față de calculul
 * la precizie plină e de ordinul banilor și se pierde oricum la plată, dar o
 * coloană care nu se verifică cu creionul e prima reclamată la control.
 *
 * @throws RangeError dacă `zileLucratoareLuna` nu e un număr strict pozitiv.
 */
export function calculeazaIndemnizatieCo(intrare: IntrareIndemnizatieCo): RezultatIndemnizatieCo {
  const { mod, zileConcediu, salariuBaza, zileLucratoareLuna, istoric, luniNecesare } = intrare;

  // Zero zile lucrătoare ar da o rată zilnică infinită, adică o sumă infinită
  // trecută tăcut mai departe în lanț. Se oprește aici, nu peste trei etape.
  if (!Number.isFinite(zileLucratoareLuna) || zileLucratoareLuna <= 0) {
    throw new RangeError(
      `Zilele lucrătoare ale lunii trebuie să fie un număr strict pozitiv, nu ${String(zileLucratoareLuna)}.`,
    );
  }

  // O RATĂ nu se materializează în bani. Rotunjită înainte de înmulțire, ea
  // rupe identitatea pe care contabilul o verifică prima: 21 de zile de
  // concediu într-o lună de 21 de zile lucrătoare trebuie să dea EXACT
  // salariul lunii. Cu rata rotunjită, 5000/21 = 238,10, iar 238,10 x 21 =
  // 5000,10 — zece bani apăruți din rotunjire, pe fiecare angajat, în fiecare
  // lună. Rata exactă se păstrează pentru calcul, cea rotunjită doar pentru
  // afișare. Vezi testul „o RATĂ nu se materializează niciodată în bani" din
  // `src/domain/bani.test.ts`.
  const rataBazaExacta = salariuBaza / zileLucratoareLuna;
  const rataZilnicaBaza = rotunjesteLaBani(rataBazaExacta);

  // Modul „baza" nu atinge deloc istoricul: e alegerea explicită de a plăti la
  // rata salariului curent, deci nu are ce raporta despre o medie pe care n-a
  // calculat-o. `rataZilnicaMedie` rămâne `null` tocmai ca să se vadă asta.
  if (mod === "baza") {
    return {
      suma: rotunjesteLaBani(rataBazaExacta * zileConcediu),
      rataZilnicaAplicata: rataZilnicaBaza,
      rataZilnicaBaza,
      rataZilnicaMedie: null,
      luniFolosite: 0,
      probleme: [],
    };
  }

  // Lunile fără zile lucrate se elimină ÎNAINTE de a număra cele trei luni de
  // referință, deci o lună goală trimite căutarea mai în spate în istoric în
  // loc să consume un loc. Apelantul decide cât de departe merge istoricul.
  const luniUtilizabile = istoric
    .filter((lunaIstoric) => lunaIstoric.zileLucrate > 0)
    .slice(0, Math.max(0, luniNecesare));

  const totalDrepturi = luniUtilizabile.reduce((total, l) => total + l.drepturiSalariale, 0);
  const totalZileLucrate = luniUtilizabile.reduce((total, l) => total + l.zileLucrate, 0);

  // Media e pe TOTALURI, nu media mediilor lunare: o lună cu 5 zile lucrate nu
  // are aceeași greutate ca una cu 21, iar media mediilor i-ar da-o.
  // Perechea merge împreună, ca TypeScript să îngusteze o singură dată: exacta
  // pentru comparații și pentru sumă, rotunjita pentru afișare.
  const medie =
    totalZileLucrate > 0
      ? (() => {
          const exacta = totalDrepturi / totalZileLucrate;
          return { exacta, rotunjita: rotunjesteLaBani(exacta) };
        })()
      : null;
  const rataZilnicaMedie = medie === null ? null : medie.rotunjita;

  const probleme: ProblemaEtapa[] = [];

  // Istoric parțial, dar nu gol: media e validă, doar mai îngustă decât cere
  // legea. Cazul „nicio lună" își are propriul cod, mai grav, și nu-l dublează.
  if (luniUtilizabile.length > 0 && luniUtilizabile.length < luniNecesare) {
    probleme.push({
      cod: COD_MEDIE_INCOMPLETA,
      detalii: `Media s-a calculat pe ${String(luniUtilizabile.length)} luni din ${String(luniNecesare)} cerute — istoricul de venit nu acoperă toată perioada de referință.`,
    });
  }

  let rataZilnicaAplicata: number;
  let rataAplicataExacta: number;

  if (medie === null) {
    // Angajat nou sau întors dintr-o suspendare lungă: nu există perioadă de
    // referință. Planșeul din alin. (1) rămâne singurul reper aplicabil.
    rataZilnicaAplicata = rataZilnicaBaza;
    rataAplicataExacta = rataBazaExacta;
    probleme.push({
      cod: COD_FARA_ISTORIC,
      detalii:
        "Nicio lună cu zile lucrate în istoricul de venit — indemnizația s-a calculat la rata zilnică a salariului de bază.",
    });
  } else if (mod === "media_3_luni") {
    // Modul cere media și atât. Nu se compară cu baza, deci nici nu se
    // raportează că media ar fi mai mică: ar fi un reproș la o alegere făcută.
    rataZilnicaAplicata = medie.rotunjita;
    rataAplicataExacta = medie.exacta;
  } else if (medie.exacta < rataBazaExacta) {
    rataZilnicaAplicata = rataZilnicaBaza;
    rataAplicataExacta = rataBazaExacta;
    probleme.push({
      cod: COD_MEDIA_MAI_MICA,
      detalii: `Media zilnică a perioadei de referință (${medie.rotunjita.toFixed(2)} lei) e sub rata zilnică a salariului de bază (${rataZilnicaBaza.toFixed(2)} lei) — s-a aplicat baza, mai avantajoasă pentru angajat.`,
    });
  } else {
    rataZilnicaAplicata = medie.rotunjita;
    rataAplicataExacta = medie.exacta;
  }

  return {
    suma: rotunjesteLaBani(rataAplicataExacta * zileConcediu),
    rataZilnicaAplicata,
    rataZilnicaBaza,
    rataZilnicaMedie,
    luniFolosite: luniUtilizabile.length,
    // Fără zile de concediu nu se plătește nicio indemnizație, deci nimic din
    // ce s-ar fi reproșat istoricului nu are consecință. Raportarea lor ar
    // umple fluturașul fiecărei luni fără concediu cu avertismente inutile,
    // iar un avertisment pe care toată lumea îl ignoră le acoperă și pe cele
    // care contează.
    probleme: zileConcediu === 0 ? [] : probleme,
  };
}
