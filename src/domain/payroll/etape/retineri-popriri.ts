// src/domain/payroll/etape/retineri-popriri.ts
//
// Reținerile din salariu și limitele urmăririi silite — etapă pură din lanțul
// de salarizare.
//
// REGULA LEGALĂ. Codul de procedură civilă, art. 729 („Limitele urmăririi
// veniturilor bănești"), cu ordinea de imputare din regulamentul intern:
//
//   - o SINGURĂ poprire nu poate lua mai mult de 1/3 din salariul net lunar;
//   - POPRIRI CONCURENTE nu pot lua, CUMULAT, mai mult de 1/2 din net;
//   - creanțele de ÎNTREȚINERE se satisfac ÎNAINTEA celorlalte;
//   - reținerea se OPREȘTE de la sine când soldul datoriei ajunge la zero —
//     un dosar stins nu mai produce rețineri, oricât ar cere popritorul;
//   - avansul și celelalte rețineri interne (imputații, rate, cotizația
//     sindicală) NU sunt popriri: nu intră în plafoane, dar se scad din net.
//
// DE CE PLAFONUL SE CALCULEAZĂ PE NETUL INIȚIAL, NU PE CEL RĂMAS DUPĂ AVANS.
// Legea raportează plafonul la „venitul lunar net", adică la dreptul salarial
// al lunii, nu la ce a mai rămas din el după ce angajatorul și-a luat înapoi
// avansul. Dacă plafonul s-ar calcula pe netul rămas, orice angajator ar putea
// micșora partea urmăribilă a unui salariat plătindu-i jumătate ca avans —
// adică ar putea goli poprirea de conținut printr-o decizie internă.
//
// DE CE ÎNTREȚINEREA E PRIMA. Creanța de întreținere are ca obiect subzistența
// creditorului (copil, fost soț, părinte). Când plafonul nu ajunge pentru
// toate dosarele, ordinea nu e o preferință administrativă: dosarele de
// întreținere se satisfac integral, iar restul împart ce mai rămâne.
//
// ORDINEA DE APLICARE, fixă: avans → popriri → imputații → rate interne →
// reținere sindicat → alte rețineri. Fiecare pas lucrează pe netul RĂMAS după
// cel anterior, deci o reținere nu poate coborî netul sub zero: se taie la cât
// mai e și se raportează diferența.
//
// ⚠️ DE CONFIRMAT DE JURIST — trei puncte pe care etapa asta NU le decide
// singură, fiindcă ele privesc încadrarea, nu aritmetica:
//
//   1. Art. 729 alin. (1) lit. a) CPC ridică plafonul la 1/2 pentru sumele
//      datorate cu titlu de OBLIGAȚIE DE ÎNTREȚINERE sau alocație pentru
//      copii, chiar când dosarul e singur. Modelul de aici primește plafoanele
//      ca PARAMETRI (`plafonPoprireUnica`, `plafonPopririConcurente`) tocmai ca
//      apelantul să poată trimite 1/2 într-un asemenea caz; etapa nu deduce
//      singură plafonul din `esteIntretinere`.
//   2. Art. 729 alin. (3) CPC: veniturile din muncă mai mici decât salariul
//      minim net pe economie pot fi urmărite numai asupra părții ce depășește
//      jumătate din acest salariu minim. Plafonul acela NU e implementat aici —
//      cere valoarea legală a salariului minim, care se schimbă anual.
//   3. Sumele rotunjite. Plafonul se păstrează EXACT în calcul și se rotunjește
//      doar suma efectiv reținută, la ban, cu regula unică a aplicației. La
//      1/3 din 5.000 lei asta înseamnă 1.666,67 lei reținuți față de un plafon
//      exact de 1.666,666… — o treime de ban peste plafon, în favoarea
//      creditorului. Alternativa (trunchierea în jos) ar introduce o a doua
//      regulă de rotunjire în aplicație, exact lucrul de care avertizează
//      antetul din `src/domain/bani.ts`.
//
// Funcție PURĂ: fără ceas de sistem, fără I/O, fără aleator. Ordinea dosarelor
// e complet determinată de date (întreținere → prioritate → id → dosar), iar
// ordinea reținerilor simple la fel (rangul tipului → id), ca aceleași intrări
// să dea același fluturaș în Server Action, în simularea din UI și în teste.
// NIMIC nu depinde de ordinea în care apelantul a primit rândurile: un `select`
// fără `order by` nu promite nicio ordine, iar pe un net care nu acoperă toate
// reținerile ordinea decide CINE încasează.
//
// NIMIC din modulul ăsta nu e certificat juridic — vezi NOTES.md.

import { rotunjesteLaBani } from "../../bani";
import type { ProblemaEtapa } from "./probleme";

export type { ProblemaEtapa };

export type TipRetinere =
  "avans" | "poprire" | "imputatie" | "rata_interna" | "retinere_sindicat" | "alta";

export interface Poprire {
  readonly id: string;
  /** Suma cerută în luna curentă. */
  readonly sumaLunara: number;
  /** Cât a mai rămas de recuperat din datorie. Reținerea nu îl poate depăși. */
  readonly soldRamas: number;
  /** Creanțele de întreținere se satisfac primele. */
  readonly esteIntretinere: boolean;
  /** Ordine între popriri de aceeași natură; mai mic = mai devreme. */
  readonly prioritate: number;
  readonly dosar: string;
}

export interface RetinereSimpla {
  readonly id: string;
  readonly tip: TipRetinere;
  readonly suma: number;
  readonly motiv: string;
}

export interface IntrareRetineri {
  readonly net: number;
  readonly popriri: readonly Poprire[];
  readonly retineri: readonly RetinereSimpla[];
  /** Fracțiunea maximă pentru o singură poprire (ex. 1/3). */
  readonly plafonPoprireUnica: number;
  /** Fracțiunea maximă cumulată pentru popriri concurente (ex. 1/2). */
  readonly plafonPopririConcurente: number;
}

export interface RetinereAplicata {
  readonly id: string;
  readonly tip: TipRetinere;
  readonly ceruta: number;
  readonly aplicata: number;
  /** Soldul după reținere, doar pentru popriri; `null` în rest. */
  readonly soldDupa: number | null;
}

export interface RezultatRetineri {
  readonly totalRetinut: number;
  readonly netRamas: number;
  readonly plafonAplicat: number;
  readonly aplicate: readonly RetinereAplicata[];
  readonly probleme: readonly ProblemaEtapa[];
}

/** O reținere nu s-a aplicat integral — plafon, sold sau net insuficient. */
const COD_RETINERE_PLAFONATA = "SAL_RETINERE_PLAFONATA";

/** Sunt mai multe popriri active, deci s-a folosit plafonul cumulat (1/2). */
const COD_POPRIRI_CONCURENTE = "SAL_POPRIRI_CONCURENTE_PLAFON";

/** Un dosar de poprire a ajuns la sold zero și nu mai produce rețineri. */
const COD_POPRIRE_STINSA = "SAL_POPRIRE_STINSA";

/** Totalul cerut depășește netul disponibil al lunii. */
const COD_RETINERI_PESTE_NET = "SAL_RETINERI_PESTE_NET";

/**
 * Rangul fiecărui tip în secvența de aplicare.
 *
 * E un `Record` COMPLET, nu o listă de tipuri: un tip nou adăugat în
 * `TipRetinere` fără loc aici oprește compilarea. Cu o listă, reținerea de tip
 * nou n-ar fi fost nici aplicată, nici trecută pe fluturaș — ar fi dispărut
 * tăcut, exact lucrul pe care etapa asta refuză să-l facă.
 *
 * `avans` are rangul 0 fiindcă se scade înaintea popririlor. `poprire` are
 * ultimul rang fiindcă în lista de rețineri simple e o eroare de modelare: se
 * raportează pe fluturaș cu zero, nu se aplică (vezi coada funcției).
 */
const RANG_APLICARE: Record<TipRetinere, number> = {
  avans: 0,
  imputatie: 1,
  rata_interna: 2,
  retinere_sindicat: 3,
  alta: 4,
  poprire: 5,
};

/** Sumele negative nu au sens ca reținere: o reținere negativă ar fi o plată. */
function pozitiv(valoare: number): number {
  return Number.isFinite(valoare) && valoare > 0 ? valoare : 0;
}

/**
 * Suma primită, curățată o singură dată: nefinită sau negativă → zero, restul
 * rotunjit la ban.
 *
 * TOATE deciziile etapei se iau pe valoarea asta, nu pe cea brută. Altfel un
 * sold de 0,004 lei — adică zero bani, un dosar care nu mai poate încasa nimic
 * — trecea drept dosar ACTIV și ridica plafonul de la 1/3 la 1/2, adică exact
 * lărgirea părții urmăribile de care se ferește secțiunea 2.
 */
function banValid(valoare: number): number {
  return rotunjesteLaBani(pozitiv(valoare));
}

/**
 * Comparație pe coduri de caracter, nu `localeCompare`: aceasta din urmă
 * depinde de locale-ul mașinii, iar un calcul de salariu care iese altfel pe
 * serverul de producție decât în CI e imposibil de apărat în fața unui control.
 */
function comparaSiruri(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Ca `comparaSiruri`, pentru numere. Fără scădere: `Infinity - Infinity` = NaN. */
function comparaNumere(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Ordinea dosarelor de poprire: întreținere întâi, apoi prioritatea crescător,
 * apoi id-ul, apoi restul câmpurilor.
 *
 * Criteriile de după id par exagerate — id-ul e cheia primară a rândului, deci
 * n-ar trebui să se repete. Sunt acolo fiindcă o ordine PARȚIALĂ cade înapoi pe
 * ordinea rândurilor primite exact în cazurile pe care nu le-a prevăzut nimeni,
 * iar aici ordinea decide cine încasează. Două rânduri identice pe toate
 * câmpurile sunt interschimbabile: rezultatul e același oricum le-ai lua.
 */
function comparaPopriri(a: Poprire, b: Poprire): number {
  if (a.esteIntretinere !== b.esteIntretinere) {
    return a.esteIntretinere ? -1 : 1;
  }
  return (
    comparaNumere(a.prioritate, b.prioritate) ||
    comparaSiruri(a.id, b.id) ||
    comparaSiruri(a.dosar, b.dosar) ||
    comparaNumere(a.sumaLunara, b.sumaLunara) ||
    comparaNumere(a.soldRamas, b.soldRamas)
  );
}

/**
 * Ordinea reținerilor simple: rangul tipului, apoi id-ul.
 *
 * Tiebreak-ul pe id NU e cosmetic. Fără el, două rețineri de ACELAȘI tip se
 * aplicau în ordinea rândurilor primite, iar pe un net care nu le acoperă pe
 * amândouă ordinea aceea decide cine încasează și cine rămâne cu zero: același
 * angajat, aceeași lună, alt fluturaș, după cum a întors baza rândurile.
 */
function comparaRetineri(a: RetinereSimpla, b: RetinereSimpla): number {
  return (
    comparaNumere(RANG_APLICARE[a.tip], RANG_APLICARE[b.tip]) ||
    comparaSiruri(a.id, b.id) ||
    comparaSiruri(a.motiv, b.motiv) ||
    comparaNumere(a.suma, b.suma)
  );
}

/**
 * Care dintre limite a mușcat. Se cheamă doar când s-a reținut mai puțin decât
 * s-a cerut, iar la egalitate ordinea de vinovăție e sold → plafon → net:
 * un dosar stins rămâne stins indiferent cât net ar fi disponibil.
 */
function cauzaLimitarii(
  ceruta: number,
  sold: number,
  plafonRamas: number,
  disponibil: number,
): string {
  const minim = Math.min(ceruta, sold, plafonRamas, disponibil);
  if (sold === minim) {
    return "soldul rămas al datoriei";
  }
  if (plafonRamas === minim) {
    return "plafonul legal de urmărire";
  }
  return "netul rămas după reținerile anterioare";
}

/**
 * Reținerile lunii, în ordinea legală, cu plafoanele urmăririi silite.
 *
 * Invariantul pe care se sprijină orchestratorul: `totalRetinut + netRamas`
 * dă exact `net` (la ban), iar `totalRetinut` e suma câmpurilor `aplicata`
 * din `aplicate`. Fluturașul se poate deci verifica pe coloană, cu creionul.
 *
 * `aplicate` conține TOATE reținerile primite, inclusiv cele cu zero reținut:
 * un dosar de poprire care nu a produs nimic luna asta trebuie să apară pe
 * fluturaș ca linie, altfel angajatul nu are cum să vadă că e în evidență.
 *
 * @throws RangeError dacă `net` nu e finit sau dacă un plafon nu e o fracțiune
 *   din intervalul [0, 1] — o valoare invalidă acolo ar trece tăcut mai departe
 *   ca sumă infinită, ca plafon negativ (zero rețineri fără explicație) sau,
 *   mai rău, ca `33` în loc de `0,33`: un plafon de 3.300% e același lucru cu
 *   niciun plafon, adică tot salariul urmărit fără ca nimic să semnaleze.
 */
export function calculeazaRetinerile(intrare: IntrareRetineri): RezultatRetineri {
  const { net, popriri, retineri, plafonPoprireUnica, plafonPopririConcurente } = intrare;

  if (!Number.isFinite(net)) {
    throw new RangeError(`Netul lunii trebuie să fie un număr finit, nu ${String(net)}.`);
  }
  // Marginea de sus contează la fel de mult ca cea de jos: `33` în loc de
  // `0,33` e confuzia fracție/procent împotriva căreia avertizează antetul din
  // `src/domain/bani.ts`, iar aici ea nu produce o sumă absurdă și vizibilă, ci
  // un plafon mai mare decât salariul — adică urmărire fără plafon, tăcut.
  for (const [nume, fractie] of [
    ["plafonPoprireUnica", plafonPoprireUnica],
    ["plafonPopririConcurente", plafonPopririConcurente],
  ] as const) {
    if (!Number.isFinite(fractie) || fractie < 0 || fractie > 1) {
      throw new RangeError(
        `Plafonul „${nume}" trebuie să fie o fracțiune între 0 și 1 (0,33 pentru o treime, nu 33), nu ${String(fractie)}.`,
      );
    }
  }

  const probleme: ProblemaEtapa[] = [];
  const aplicate: RetinereAplicata[] = [];

  // Un net negativ (regularizări în minus, restituiri) nu e o sursă de
  // reținere: nu se reține nimic, iar minusul se transmite mai departe intact.
  const netUrmaribil = Math.max(0, rotunjesteLaBani(net));
  let disponibil = netUrmaribil;

  // Cererea LEGITIMĂ a lunii: popririle se numără doar până la soldul lor
  // (ce trece peste sold nu e datorat), reținerile simple integral. Comparația
  // cu netul se face pe cererea asta, nu pe cea brută, ca un dosar deja stins
  // să nu declanșeze o alarmă de „rețineri peste net" care n-are obiect.
  const cerutPopriri = popriri.reduce(
    (total, p) => total + Math.min(banValid(p.sumaLunara), banValid(p.soldRamas)),
    0,
  );
  // Reținerile declarate cu tipul `poprire` lipsesc din total: etapa le REFUZĂ
  // (vezi coada funcției), deci netul nu are nicio vină că n-au fost aplicate.
  // Numărate aici, aprindeau alarma „rețineri peste net" și trimiteau
  // operatorul să caute un salariu prea mic, când problema e un rând declarat
  // greșit — iar textul alarmei („s-au aplicat până la epuizarea netului") era
  // pur și simplu fals.
  const cerutSimple = retineri.reduce(
    (total, r) => total + (r.tip === "poprire" ? 0 : banValid(r.suma)),
    0,
  );
  const totalCerut = rotunjesteLaBani(cerutPopriri + cerutSimple);

  if (totalCerut > netUrmaribil) {
    probleme.push({
      cod: COD_RETINERI_PESTE_NET,
      detalii: `Reținerile cerute (${totalCerut.toFixed(2)} lei) depășesc netul disponibil (${netUrmaribil.toFixed(2)} lei) — s-au aplicat în ordinea legală, până la epuizarea netului.`,
    });
  }

  /** Aplică o reținere simplă pe netul rămas. Fără plafon, doar limita netului. */
  function aplicaSimpla(retinere: RetinereSimpla): void {
    const ceruta = banValid(retinere.suma);
    const suma = rotunjesteLaBani(Math.min(ceruta, disponibil));
    disponibil = rotunjesteLaBani(disponibil - suma);

    aplicate.push({
      id: retinere.id,
      tip: retinere.tip,
      ceruta,
      aplicata: suma,
      soldDupa: null,
    });

    if (suma < ceruta) {
      probleme.push({
        cod: COD_RETINERE_PLAFONATA,
        detalii: `Reținerea „${retinere.motiv}": s-au cerut ${ceruta.toFixed(2)} lei, s-au reținut ${suma.toFixed(2)} lei — netul rămas nu acoperă diferența.`,
      });
    }
  }

  // Coada reținerilor simple, ordonată o singură dată: rangul tipului, apoi
  // id-ul. `avans` iese din ea aici, popririle se aplică între timp, restul
  // urmează după. Ordinea rândurilor primite nu mai influențează nimic.
  const coada = [...retineri].sort(comparaRetineri);

  // ─── 1. Avansul ─────────────────────────────────────────────────────────
  // Se scade primul și fără plafon: nu e o urmărire silită, ci recuperarea
  // unei sume deja plătite din salariul aceleiași luni.
  for (const retinere of coada) {
    if (retinere.tip === "avans") {
      aplicaSimpla(retinere);
    }
  }

  // ─── 2. Popririle ───────────────────────────────────────────────────────
  // „Activă" = cere ceva ȘI mai are ce recupera, măsurat în BANI (`banValid`),
  // exact ca în bucla de mai jos. Un dosar cu sold zero sau cu suma lunară zero
  // nu concurează, deci nu ridică plafonul la 1/2: altfel un dosar stins, uitat
  // în evidență, ar lărgi partea urmăribilă a salariului. Cu `pozitiv` brut, un
  // sold de 0,004 lei — zero bani la aplicare — trecea drept dosar activ și
  // făcea exact asta.
  const active = popriri.filter((p) => banValid(p.sumaLunara) > 0 && banValid(p.soldRamas) > 0);
  const fractiePlafon =
    active.length >= 2 ? plafonPopririConcurente : active.length === 1 ? plafonPoprireUnica : 0;

  // Plafonul se raportează la netul INIȚIAL al lunii, nu la `disponibil` —
  // avansul deja scăzut nu micșorează partea urmăribilă. Rămâne EXACT în
  // calcul: rotunjit înainte de a fi împărțit între dosare, ar muta bani de la
  // un creditor la altul. Vezi „o RATĂ nu se materializează niciodată în bani"
  // din `src/domain/bani.test.ts`.
  const plafonExact = netUrmaribil * fractiePlafon;
  const plafonAplicat = rotunjesteLaBani(plafonExact);

  if (active.length >= 2 && plafonExact > 0) {
    probleme.push({
      cod: COD_POPRIRI_CONCURENTE,
      detalii: `${String(active.length)} popriri active pe același salariu — s-a aplicat plafonul cumulat de ${plafonAplicat.toFixed(2)} lei, nu plafonul unei popriri singulare.`,
    });
  }

  let plafonRamas = plafonExact;

  for (const poprire of [...popriri].sort(comparaPopriri)) {
    const ceruta = banValid(poprire.sumaLunara);
    const sold = banValid(poprire.soldRamas);
    // Limitele de dinaintea dosarului, păstrate ca să se poată spune DUPĂ
    // reținere care dintre ele a mușcat.
    const plafonInainte = plafonRamas;
    const disponibilInainte = disponibil;
    const suma = rotunjesteLaBani(
      Math.max(0, Math.min(ceruta, sold, plafonInainte, disponibilInainte)),
    );
    const soldDupa = rotunjesteLaBani(sold - suma);

    // Plafonul consumat se scade ROTUNJIT, ca dosarele următoare să nu poată
    // recupera fracțiunea de ban pierdută la rotunjirea celui dinaintea lor.
    plafonRamas = Math.max(0, plafonRamas - suma);
    disponibil = rotunjesteLaBani(disponibil - suma);

    aplicate.push({
      id: poprire.id,
      tip: "poprire",
      ceruta,
      aplicata: suma,
      soldDupa,
    });

    if (suma < ceruta) {
      probleme.push({
        cod: COD_RETINERE_PLAFONATA,
        detalii: `Poprirea din dosarul ${poprire.dosar}: s-au cerut ${ceruta.toFixed(2)} lei, s-au reținut ${suma.toFixed(2)} lei — a limitat ${cauzaLimitarii(ceruta, sold, plafonInainte, disponibilInainte)}.`,
      });
    }

    if (soldDupa === 0) {
      probleme.push({
        cod: COD_POPRIRE_STINSA,
        detalii:
          suma > 0
            ? `Dosarul ${poprire.dosar}: reținerea de ${suma.toFixed(2)} lei stinge integral soldul — poprirea se închide și nu mai produce rețineri în lunile următoare.`
            : `Dosarul ${poprire.dosar}: soldul datoriei e deja zero — poprirea e stinsă și nu se mai reține nimic pe ea.`,
      });
    }
  }

  // ─── 3-6. Coada reținerilor interne ─────────────────────────────────────
  // Aceeași coadă ordonată ca la pasul 1; avansul e deja aplicat, deci se sare.
  //
  // O reținere cu tipul `poprire` ajunsă în `retineri` e o eroare de modelare:
  // acolo nu există nici sold, nici prioritate, deci nu poate fi ținută sub
  // plafon. Nu se aplică deloc — o poprire strecurată pe lângă plafon ar fi
  // exact abuzul pe care art. 729 îl interzice — și se raportează, ca să nu
  // dispară tăcut din fluturaș.
  for (const retinere of coada) {
    if (retinere.tip === "avans") {
      continue;
    }
    if (retinere.tip === "poprire") {
      const ceruta = banValid(retinere.suma);
      aplicate.push({ id: retinere.id, tip: "poprire", ceruta, aplicata: 0, soldDupa: null });
      probleme.push({
        cod: COD_RETINERE_PLAFONATA,
        detalii: `Reținerea „${retinere.motiv}": s-au cerut ${ceruta.toFixed(2)} lei, s-au reținut 0,00 lei — o poprire se declară în lista de popriri, cu dosar și sold, altfel nu poate fi ținută sub plafonul legal.`,
      });
      continue;
    }
    aplicaSimpla(retinere);
  }

  const totalRetinut = rotunjesteLaBani(aplicate.reduce((total, r) => total + r.aplicata, 0));

  // Din `net`, nu din `netUrmaribil`: un net negativ trebuie să rămână vizibil
  // ca minus în etapa următoare, nu turtit la zero aici.
  const ramas = rotunjesteLaBani(net - totalRetinut);

  return {
    totalRetinut,
    // `|| 0` ar fi ascuns și un NaN; comparația explicită schimbă DOAR `-0`.
    // Un net dat cu mai mult de doi zecimali (1.000,006 lei) lasă în urmă un
    // rest de −0,004, care se rotunjește la `-0`, iar `(-0).toFixed(2)` scrie
    // pe fluturaș „-0,00 lei" — un minus fără sumă, pe care niciun angajat n-are
    // cum să și-l explice.
    netRamas: ramas === 0 ? 0 : ramas,
    plafonAplicat,
    aplicate,
    probleme,
  };
}
