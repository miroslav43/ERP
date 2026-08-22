// src/domain/payroll/contabil/nota.ts
//
// Nota contabilă lunară de salarii — liniile de debit și de credit care se
// trimit în contabilitatea financiară.
//
// REGULA DE FORMAT. Partida dublă (Legea contabilității 82/1991, cu planul de
// conturi general din OMFP 1802/2014): fiecare operațiune se înregistrează
// simultan în debitul unui cont și în creditul altuia, iar suma debitelor unei
// note este EGALĂ cu suma creditelor ei. Nu e o convenție de prezentare, ci
// condiția în care nota poate fi preluată în balanță. O notă dezechilibrată nu
// se „ajustează la import": e respinsă, iar luna rămâne neînregistrată.
// De aceea `echilibrata` e o poartă, nu o informație: apelantul nu are voie să
// trimită nota mai departe când e `false`.
//
// CONTURILE SUNT DATE, NU COD. Planul de conturi general dă cadrul (641
// cheltuieli cu salariile, 6451/6452/6458 contribuții ale unității, 421
// personal — salarii datorate, 4315 CAS reținut, 4316 CASS reținut, 444
// impozit pe venituri din salarii, 427 rețineri datorate terților, 425
// avansuri), dar ⚠️ maparea efectivă diferă de la firmă la firmă: unele
// folosesc analitice (421.01, 444.02), altele conturi impuse de programul de
// contabilitate în care se importă nota. Niciun cod de cont nu apare ca literal
// în fișierul ăsta; toate intră prin `ConturiNota`, iar testele își aduc
// propriile coduri.
//
// DE CE SE ÎNCHIDE NOTA — aritmetica, verificată, nu presupusă.
//
//   debit  = brut + camAngajator
//   credit = cas + cass + (impozit + camAngajator) + avansuri + retineriTerti
//            + restDePlata
//
//   debit − credit = brut − cas − cass − impozit − avansuri − retineriTerti
//                    − restDePlata
//
// `camAngajator` se simplifică: apare o dată pe fiecare parte. Ce rămâne e
// exact definiția restului de plată —
//
//   restDePlata = brut − cas − cass − impozit − avansuri − retineriTerti
//
// — deci nota se închide pentru ORICE set de totaluri coerent. Când nu se
// închide, defectul e în totalurile primite, nu în structura notei; cel mai
// frecvent e restul de plată calculat ca salariu NET (brut minus contribuții
// și impozit), fără scăderea avansului și a reținerilor, care apoi sunt
// creditate încă o dată pe liniile lor. Dezechilibrul e fix suma dublată.
//
// ⚠️ DECIZIA DESPRE CAM — de confirmat de contabil. Contribuția asigurătorie
// pentru muncă (2,25%, OUG 79/2017, aplicabilă din 2018) e datorată de
// ANGAJATOR și nu se reține din salariu. În planul de conturi general creditul
// ei stă în 436 „contribuția asigurătorie pentru muncă", nu în 444. `ConturiNota`
// nu are un câmp separat pentru ea, deci creditul CAM intră în linia contului
// de impozit, așa cum cere structura dată.
//
// Pe echilibru asta nu schimbă nimic: CAM apare o dată în debit și o dată în
// credit, deci se simplifică indiferent în ce cont de credit e pus — un „cont
// distinct pentru CAM" nu ar fi putut repara un dezechilibru, fiindcă CAM nu
// produce niciunul. Obiecția e strict contabilă: linia contului de impozit
// cumulează două obligații către două poziții bugetare diferite, iar
// reconcilierea cu D112 se face pe fiecare separat. De aceea explicația liniei
// SPUNE că sunt două sume la un loc. Dacă contabilul respinge cumulul, remediul
// e un al nouălea câmp în `ConturiNota` și mutarea liniei acolo — fără niciun
// efect asupra echilibrului.
//
// ⚠️ Un singur cont de cheltuială pentru contribuția angajatorului e suficient
// astăzi, tocmai pentru că din 2018 a rămas o singură contribuție în sarcina
// lui. Trioul 6451/6452/6458 e moștenirea perioadei în care angajatorul datora
// CAS, șomaj și fond de risc separat; o firmă cu istoric anterior lui 2018 în
// aceeași bază va cere conturi diferite pe perioade diferite.
//
// ROTUNJIRE. Modulul primește numai SUME deja calculate, niciodată rate (tarif
// orar, bază zilnică, curs). Regula „o rată nu se materializează în bani" se
// aplică în etapele care produc totalurile astea, nu aici. Aici rotunjirea se
// face o singură dată per intrare, ÎNAINTE de orice adunare: dacă s-ar rotunji
// abia totalurile, suma coloanei tipărite n-ar mai fi egală cu totalul afișat
// sub ea — prima verificare pe care o face un contabil cu creionul.
//
// Funcție PURĂ: fără ceas de sistem, fără I/O, fără aleator. Aceleași totaluri
// și aceeași mapare de conturi dau aceeași notă în Server Action, în previzualizarea
// din UI și în teste.
//
// NIMIC din modulul ăsta nu e certificat contabil — vezi NOTES.md.

import { rotunjesteLaBani } from "../../bani";
import type { ProblemaEtapa } from "../etape/probleme";

export type { ProblemaEtapa };

/**
 * Maparea conturilor, adusă de organizație. Toate câmpurile sunt coduri de cont
 * ca text — inclusiv analiticele, care nu sunt numere.
 */
export interface ConturiNota {
  readonly cheltuialaSalarii: string;
  readonly cheltuialaContributieAngajator: string;
  readonly salariiDatorate: string;
  readonly casRetinut: string;
  readonly cassRetinut: string;
  readonly impozit: string;
  readonly retineriTerti: string;
  readonly avansuri: string;
}

/** Totalurile perioadei, în lei. Sume, nu rate. */
export interface TotaluriPerioada {
  readonly brut: number;
  readonly cas: number;
  readonly cass: number;
  readonly impozit: number;
  readonly camAngajator: number;
  readonly avansuri: number;
  readonly retineriTerti: number;
  /** brut − cas − cass − impozit − avansuri − retineriTerti. Vezi antetul. */
  readonly restDePlata: number;
}

/** O linie de notă. Una dintre `debit` / `credit` e zero; niciodată amândouă. */
export interface LinieNota {
  readonly cont: string;
  readonly debit: number;
  readonly credit: number;
  readonly explicatie: string;
}

export interface RezultatNota {
  readonly linii: readonly LinieNota[];
  readonly totalDebit: number;
  readonly totalCredit: number;
  /** Poarta: `false` înseamnă că nota NU se trimite în contabilitate. */
  readonly echilibrata: boolean;
  readonly probleme: readonly ProblemaEtapa[];
}

/** Debitul nu egalează creditul — nota nu poate fi înregistrată. */
const COD_DEZECHILIBRATA = "SAL_NOTA_DEZECHILIBRATA";

/** Un total de intrare e negativ. */
const COD_VALOARE_NEGATIVA = "SAL_NOTA_VALOARE_NEGATIVA";

/** O linie a ajuns în notă fără cod de cont. */
const COD_CONT_LIPSA = "SAL_NOTA_CONT_LIPSA";

/**
 * Sub pragul ăsta diferența e zgomot de virgulă mobilă, nu dezechilibru.
 *
 * Totalurile se întorc deja rotunjite la ban, deci o diferență reală e cel
 * puțin un ban (0,01). Jumătatea de ban lasă loc doar erorii de reprezentare
 * acumulate în adunarea liniilor și nu poate ascunde niciodată o diferență
 * contabilă.
 */
const TOLERANTA_ECHILIBRU = 0.005;

/** Cheile totalurilor, în ordinea în care se raportează problemele. */
const ORDINEA_TOTALURILOR = [
  "brut",
  "cas",
  "cass",
  "impozit",
  "camAngajator",
  "avansuri",
  "retineriTerti",
  "restDePlata",
] as const satisfies readonly (keyof TotaluriPerioada)[];

/** Numele în clar ale totalurilor, pentru mesajele de problemă. */
const ETICHETE_TOTALURI: Readonly<Record<keyof TotaluriPerioada, string>> = {
  brut: "fondul brut de salarii",
  cas: "contribuția de asigurări sociale reținută",
  cass: "contribuția de asigurări sociale de sănătate reținută",
  impozit: "impozitul pe veniturile din salarii",
  camAngajator: "contribuția asigurătorie pentru muncă",
  avansuri: "avansurile acordate personalului",
  retineriTerti: "reținerile datorate terților",
  restDePlata: "restul de plată",
};

/** Sumă în lei, scrisă cu virgulă zecimală și doi bani, ca pe notă. */
function scrieSuma(lei: number): string {
  return rotunjesteLaBani(lei).toFixed(2).replace(".", ",");
}

/** Descrierea unei linii înainte de a ști dacă intră sau nu în notă. */
interface SpecificatieLinie {
  readonly cheie: keyof ConturiNota;
  readonly cont: string;
  readonly parte: "debit" | "credit";
  readonly suma: number;
  readonly explicatie: string;
}

/**
 * Construiește nota contabilă a perioadei din totalurile ei și din maparea de
 * conturi a organizației.
 *
 * Nu aruncă pentru date greșite din punct de vedere contabil — un total negativ
 * sau un cont lipsă se raportează în `probleme` și nota se construiește oricum,
 * ca apelantul să vadă unde anume se rupe. Singurul lucru care oprește complet
 * trimiterea e `echilibrata: false`.
 *
 * @throws RangeError dacă un total nu e un număr finit (`NaN`, `Infinity`) —
 *   asta nu e o problemă de contabilitate, ci un calcul rupt mai devreme în
 *   lanț, iar o notă construită peste el ar ascunde defectul. Mesajul NUMEȘTE
 *   totalul vinovat.
 */
export function construiesteNota(totaluri: TotaluriPerioada, conturi: ConturiNota): RezultatNota {
  // Verificarea se face ÎNAINTE de rotunjire, pe fiecare total, pe nume.
  // `rotunjesteLaBani` ar arunca oricum un `RangeError` pe `NaN` sau `Infinity`,
  // dar cu mesajul lui generic („O sumă trebuie să fie un număr finit."), care
  // nu spune CARE sumă — inutil la capătul unui calcul de ~40 de pași, unde
  // singura întrebare e din ce etapă a ieșit valoarea ruptă. Ordinea de aici e
  // și ordinea în care se raportează problemele, deci prima abatere semnalată e
  // mereu aceeași pentru aceleași intrări.
  for (const cheie of ORDINEA_TOTALURILOR) {
    const valoare = totaluri[cheie];
    if (!Number.isFinite(valoare)) {
      throw new RangeError(
        `Totalul „${ETICHETE_TOTALURI[cheie]}" (${cheie}) nu e un număr finit: ${String(valoare)}. Nota nu se construiește peste un calcul rupt mai devreme în lanț.`,
      );
    }
  }

  // Rotunjirea se face O SINGURĂ DATĂ, aici, pe intrări. Tot ce urmează adună
  // valori deja la ban, deci liniile tipărite se adună exact la totalul de sub
  // ele. Vezi „ROTUNJIRE" în antet.
  const sume: Readonly<Record<keyof TotaluriPerioada, number>> = {
    brut: rotunjesteLaBani(totaluri.brut),
    cas: rotunjesteLaBani(totaluri.cas),
    cass: rotunjesteLaBani(totaluri.cass),
    impozit: rotunjesteLaBani(totaluri.impozit),
    camAngajator: rotunjesteLaBani(totaluri.camAngajator),
    avansuri: rotunjesteLaBani(totaluri.avansuri),
    retineriTerti: rotunjesteLaBani(totaluri.retineriTerti),
    restDePlata: rotunjesteLaBani(totaluri.restDePlata),
  };

  const probleme: ProblemaEtapa[] = [];

  // Un total negativ se raportează, dar nu oprește construcția: cel mai adesea
  // nota tot se închide (semnul se propagă simetric), iar atunci singurul semn
  // că ceva e greșit e problema asta. O corecție de lună anterioară se face
  // prin storno pe partea opusă, nu printr-o sumă negativă pe partea ei.
  for (const cheie of ORDINEA_TOTALURILOR) {
    const valoare = sume[cheie];
    if (valoare < 0) {
      probleme.push({
        cod: COD_VALOARE_NEGATIVA,
        detalii: `Totalul „${ETICHETE_TOTALURI[cheie]}" (${cheie}) e negativ: ${scrieSuma(valoare)} lei. O notă contabilă nu conține sume negative — corecția se face prin storno pe partea opusă.`,
      });
    }
  }

  // Ordinea e cea a notei tipărite: întâi debitele, apoi creditele.
  const specificatii: readonly SpecificatieLinie[] = [
    {
      cheie: "cheltuialaSalarii",
      cont: conturi.cheltuialaSalarii,
      parte: "debit",
      suma: sume.brut,
      explicatie: "Cheltuieli cu salariile personalului — fondul brut al perioadei.",
    },
    {
      cheie: "cheltuialaContributieAngajator",
      cont: conturi.cheltuialaContributieAngajator,
      parte: "debit",
      suma: sume.camAngajator,
      explicatie: "Contribuția asigurătorie pentru muncă, datorată de angajator.",
    },
    {
      cheie: "casRetinut",
      cont: conturi.casRetinut,
      parte: "credit",
      suma: sume.cas,
      explicatie: "Contribuția de asigurări sociale reținută salariaților.",
    },
    {
      cheie: "cassRetinut",
      cont: conturi.cassRetinut,
      parte: "credit",
      suma: sume.cass,
      explicatie: "Contribuția de asigurări sociale de sănătate reținută salariaților.",
    },
    {
      cheie: "impozit",
      cont: conturi.impozit,
      parte: "credit",
      // Două obligații pe o singură linie, fiindcă maparea nu are cont separat
      // pentru CAM. Vezi „⚠️ DECIZIA DESPRE CAM" în antet — explicația spune
      // asta pe notă, ca reconcilierea cu D112 să nu pornească greșit.
      suma: rotunjesteLaBani(sume.impozit + sume.camAngajator),
      explicatie:
        "Impozit pe veniturile din salarii, cumulat cu contribuția asigurătorie pentru muncă.",
    },
    {
      cheie: "avansuri",
      cont: conturi.avansuri,
      parte: "credit",
      suma: sume.avansuri,
      explicatie: "Avansuri acordate personalului, reținute din drepturile perioadei.",
    },
    {
      cheie: "retineriTerti",
      cont: conturi.retineriTerti,
      parte: "credit",
      suma: sume.retineriTerti,
      explicatie: "Rețineri din salarii datorate terților.",
    },
    {
      cheie: "salariiDatorate",
      cont: conturi.salariiDatorate,
      parte: "credit",
      suma: sume.restDePlata,
      explicatie: "Salarii nete datorate personalului.",
    },
  ];

  const linii: LinieNota[] = [];
  let sumaDebit = 0;
  let sumaCredit = 0;

  for (const specificatie of specificatii) {
    const debit = specificatie.parte === "debit" ? specificatie.suma : 0;
    const credit = specificatie.parte === "credit" ? specificatie.suma : 0;

    // O lună fără avansuri nu are linie de avansuri. Un rând de zero nu spune
    // nimic în balanță, dar face nota mai lungă decât operațiunile ei reale, iar
    // pe hârtie un rând gol e citit ca „lipsește o valoare", nu ca „nu există".
    if (debit === 0 && credit === 0) {
      continue;
    }

    // Un cod format doar din spații e la fel de neutilizabil ca unul gol: nu
    // există cont pe care să se înregistreze linia.
    const cont = specificatie.cont.trim();
    if (cont === "") {
      // Se verifică doar conturile liniilor care AJUNG în notă. Un câmp gol
      // pentru o linie omisă (avansuri necompletate într-o lună fără avansuri)
      // nu împiedică nimic luna asta, iar raportarea lui ar produce alarme pe
      // care nimeni nu le poate închide.
      probleme.push({
        cod: COD_CONT_LIPSA,
        detalii: `Linia „${specificatie.explicatie}" (${scrieSuma(debit + credit)} lei) nu are cod de cont — câmpul „${specificatie.cheie}" din maparea de conturi e gol.`,
      });
    }

    // Linia rămâne în notă chiar fără cont: scoasă, ar dezechilibra nota și ar
    // înlocui o problemă precisă („lipsește contul X") cu una vagă.
    linii.push({ cont, debit, credit, explicatie: specificatie.explicatie });
    sumaDebit += debit;
    sumaCredit += credit;
  }

  const totalDebit = rotunjesteLaBani(sumaDebit);
  const totalCredit = rotunjesteLaBani(sumaCredit);
  const diferenta = totalDebit - totalCredit;
  const echilibrata = Math.abs(diferenta) < TOLERANTA_ECHILIBRU;

  if (!echilibrata) {
    probleme.push({
      cod: COD_DEZECHILIBRATA,
      detalii: `Nota nu se închide: total debit ${scrieSuma(totalDebit)} lei, total credit ${scrieSuma(totalCredit)} lei, diferență ${scrieSuma(diferenta)} lei. Verifică restul de plată — trebuie să fie brutul minus contribuțiile, impozitul, avansurile și reținerile, nu salariul net.`,
    });
  }

  return { linii, totalDebit, totalCredit, echilibrata, probleme };
}
