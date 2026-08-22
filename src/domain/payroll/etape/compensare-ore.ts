import type { ProblemaEtapa } from "./probleme";

export type { ProblemaEtapa };
// src/domain/payroll/etape/compensare-ore.ts
//
// Etapa de compensare: decide CÂTE ore se plătesc cu spor și câte au fost deja
// stinse cu timp liber. Modul PUR — fără import, fără `Date`, fără ceas, fără
// I/O. Aceeași funcție rulează în motorul de salarizare, în simularea din UI și
// în teste, garantat cu același rezultat.
//
// REGULA LEGALĂ — ore suplimentare (Codul muncii)
//   Munca suplimentară se compensează cu ore libere plătite în următoarele 90
//   de zile calendaristice de la efectuare. Doar orele care NU au fost
//   compensate în acest termen se plătesc cu spor la salariul de bază.
//
//   De aici vine singura regulă care contează pentru cifra finală: orele deja
//   compensate cu timp liber NU se mai plătesc. Angajatul a primit deja
//   contravaloarea lor sub formă de timp liber PLĂTIT — ora liberă e plătită ca
//   oră lucrată. A o plăti a doua oară cu spor ar însemna plată dublă pentru
//   aceeași oră de muncă: firma plătește de două ori, iar statul primește
//   contribuții pe o bază inventată. De aceea `oreCompensate` se raportează
//   separat și nu intră NICIODATĂ în `oreDePlata`.
//
//   Orele marcate `oreExpirate` sunt cazul opus: termenul a trecut fără ca ele
//   să fi fost luate ca timp liber, deci dreptul la compensare s-a stins și
//   obligația de plată a rămas. Ele intră MEREU în `oreDePlata`, indiferent
//   dacă restul înregistrării mai e sau nu în termen.
//
// REGULA LEGALĂ — muncă în sărbătoare legală
//   Munca prestată în zilele de sărbătoare legală se compensează cu timp liber
//   corespunzător în următoarele 30 de zile; abia dacă acest lucru nu e posibil,
//   se plătește un spor. Cele două forme se exclud: dacă ziua liberă a fost
//   efectiv ACORDATĂ, sporul nu se mai datorează. Dacă termenul de acordare a
//   trecut fără ca ziua liberă să fi fost dată, sporul devine obligatoriu.
//   O sărbătoare încă în termen nu e nici plătită, nici compensată — soarta ei
//   nu se cunoaște încă și nu are ce căuta în niciunul dintre totaluri.
//
// CE NU FACE modulul
//   Întoarce ORE, nu sume. Tariful orar, procentele de spor și conversia în lei
//   sunt treaba orchestratorului de salarizare, care le are din setări. Aici nu
//   se înmulțește nimic cu bani, tocmai ca regula legală să poată fi citită și
//   verificată fără să treci prin aritmetica salariului.
//
// COMPARAREA DATELOR
//   Toate datele sunt șiruri 'AAAA-LL-ZZ', exact cum ies dintr-o coloană `date`
//   Postgres. În formatul ăsta ordinea lexicografică ESTE ordinea cronologică,
//   deci comparațiile se fac direct pe șiruri. Nu se construiește niciun obiect
//   `Date`: `new Date('2026-03-01')` ar interpreta șirul ca UTC și, pe un server
//   cu fus estic, ar întoarce 28 februarie — clasa de defecte care mută tăcut un
//   termen cu o zi și schimbă cine se plătește.
//
// SURSA DATELOR (referință, nu dependență)
//   `public.overtime_compensation` și `public.holiday_compensation` din
//   `0013_attendance.sql`, populate de triggerele de pontaj.

/** O înregistrare de ore suplimentare cu starea compensării ei. */
export interface OreSuplimentareCompensabile {
  readonly ore: number;
  readonly oreFolosite: number;
  readonly oreExpirate: number;
  /** 'AAAA-LL-ZZ'. Comparabilă lexicografic; nu construi niciun `Date`. */
  readonly termenFolosire: string;
}

export interface SarbatoareCompensabila {
  readonly dataSarbatorii: string;
  readonly oreLucrate: number;
  readonly tip: "zi_libera" | "spor";
  readonly acordata: boolean;
  readonly termenAcordare: string | null;
  /** Procent 0-100 din nomenclatorul de pontaj; `null` când tipul e zi liberă. */
  readonly sporProcent: number | null;
}

export interface IntrareCompensare {
  readonly suplimentare: readonly OreSuplimentareCompensabile[];
  readonly sarbatori: readonly SarbatoareCompensabila[];
  /** Ultima zi a lunii calculate, 'AAAA-LL-ZZ'. Referința pentru termene. */
  readonly ziReferinta: string;
  /** Câte zile mai devreme se avertizează despre un termen care se apropie. */
  readonly zileAvertizareTermen: number;
}

export interface RezultatCompensare {
  /** Ore suplimentare care TREBUIE plătite (necompensate și cu termen depășit). */
  readonly oreDePlata: number;
  /** Ore compensate cu timp liber — nu se plătesc. */
  readonly oreCompensate: number;
  /** Ore încă în termen: nici plătite, nici pierdute. */
  readonly oreInTermen: number;
  /** Ore de sărbătoare care trebuie plătite cu spor. */
  readonly oreSarbatoareDePlata: number;
  /** Ore de sărbătoare compensate cu zi liberă acordată. */
  readonly oreSarbatoareCompensate: number;
  readonly probleme: readonly ProblemaEtapa[];
}

/**
 * Codurile ridicate de etapă. Sunt șiruri libere în `ProblemaEtapa` ca etapa să
 * rămână independentă de catalogul din `../erori.ts`; constantele de mai jos
 * există ca să nu fie scrise de mână în două locuri.
 */
export const COD_ORE_SUPL_NECOMPENSATE = "SAL_ORE_SUPL_NECOMPENSATE";
export const COD_ORE_SUPL_EXPIRATE = "SAL_ORE_SUPL_EXPIRATE";
export const COD_ZI_LIBERA_SARBATOARE_NEACORDATA = "SAL_ZI_LIBERA_SARBATOARE_NEACORDATA";
export const COD_SPOR_SARBATOARE_FARA_PROCENT = "SAL_SPOR_SARBATOARE_FARA_PROCENT";

const FORMAT_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Un an este bisect dacă e divizibil cu 4, dar nu cu 100 — cu excepția celor divizibili cu 400. */
function esteBisect(an: number): boolean {
  return (an % 4 === 0 && an % 100 !== 0) || an % 400 === 0;
}

/** Câte zile are luna `luna` (1-12) din anul `an`. Februarie depinde de an. */
function zileInLuna(an: number, luna: number): number {
  if (luna === 2) return esteBisect(an) ? 29 : 28;
  if (luna === 4 || luna === 6 || luna === 9 || luna === 11) return 30;
  return 31;
}

function cuDouaCifre(valoare: number): string {
  return valoare < 10 ? `0${valoare}` : `${valoare}`;
}

/**
 * Adună `zile` zile calendaristice la o dată 'AAAA-LL-ZZ' și întoarce tot
 * 'AAAA-LL-ZZ'.
 *
 * Aritmetica se face pe componente de dată — an, lună, zi — cu numărul real de
 * zile al fiecărei luni traversate, inclusiv 29 februarie în anii bisecți.
 * NU se construiește niciun obiect `Date`: fusul orar al serverului nu are voie
 * să influențeze un termen legal.
 *
 * Un `zile` negativ sau nefinit e tratat ca 0 — etapa nu extinde niciodată un
 * termen înapoi în trecut. O dată cu format neașteptat e întoarsă neschimbată,
 * ceea ce degenerează fereastra de avertizare la zero zile în loc să producă
 * un șir „NaN-NaN-NaN" care ar compara aiurea.
 */
export function adaugaZile(data: string, zile: number): string {
  if (!FORMAT_DATA.test(data)) return data;

  let ramase = Number.isFinite(zile) ? Math.max(0, Math.trunc(zile)) : 0;

  let an = Number(data.slice(0, 4));
  let luna = Number(data.slice(5, 7));
  let zi = Number(data.slice(8, 10));

  if (luna < 1 || luna > 12 || zi < 1 || zi > zileInLuna(an, luna)) return data;

  while (ramase > 0) {
    const panaLaFinalulLunii = zileInLuna(an, luna) - zi;
    if (ramase <= panaLaFinalulLunii) {
      zi += ramase;
      ramase = 0;
    } else {
      // Consumăm zilele rămase din luna curentă plus saltul în ziua 1 a lunii
      // următoare — de aici „+ 1".
      ramase -= panaLaFinalulLunii + 1;
      zi = 1;
      luna += 1;
      if (luna > 12) {
        luna = 1;
        an += 1;
      }
    }
  }

  return `${an}-${cuDouaCifre(luna)}-${cuDouaCifre(zi)}`;
}

/**
 * Orele vin din coloane `numeric(5, 2)`, deci au cel mult două zecimale. Le
 * rotunjim la două zecimale la ieșire ca acumularea în virgulă mobilă să nu
 * producă totaluri de forma 12.299999999999999, care ar ajunge ca atare pe
 * fluturaș.
 */
function rotunjesteOre(valoare: number): number {
  return Math.round(valoare * 100) / 100;
}

/** Apără totalurile de valori nefinite sau negative venite dintr-o citire coruptă. */
function normalizeazaOre(valoare: number): number {
  return Number.isFinite(valoare) ? Math.max(0, valoare) : 0;
}

/** Scrie un număr de ore fără zecimale inutile, pentru mesajele către om. */
function scrieOre(valoare: number): string {
  // Separatorul zecimal românesc e virgula; un întreg nu conține punct,
  // deci înlocuirea e fără efect.
  return `${rotunjesteOre(valoare)}`.replace(".", ",");
}

/**
 * Împarte orele suplimentare și munca în sărbătoare în ce se plătește, ce e
 * deja compensat și ce e încă în termen.
 *
 * Funcție pură: același `intrare` dă mereu același rezultat. Toate deciziile de
 * termen se raportează la `intrare.ziReferinta`, niciodată la ceasul mașinii —
 * altfel recalcularea unei luni închise ar da alt rezultat luna următoare.
 */
export function calculeazaCompensarea(intrare: IntrareCompensare): RezultatCompensare {
  const probleme: ProblemaEtapa[] = [];

  // Ziua până la care un termen se consideră „pe cale să expire". Inclusivă:
  // un termen fix pe ziua-limită încă avertizează.
  const ziLimitaAvertizare = adaugaZile(intrare.ziReferinta, intrare.zileAvertizareTermen);

  let oreDePlata = 0;
  let oreCompensate = 0;
  let oreInTermen = 0;

  for (const inregistrare of intrare.suplimentare) {
    const ore = normalizeazaOre(inregistrare.ore);
    const oreFolosite = normalizeazaOre(inregistrare.oreFolosite);
    const oreExpirate = normalizeazaOre(inregistrare.oreExpirate);

    // Orele luate ca timp liber sunt stinse: plătite o dată, ca timp liber
    // plătit. Nu se mai plătesc a doua oară.
    oreCompensate += oreFolosite;

    // Orele expirate au pierdut dreptul la timp liber, deci se plătesc MEREU —
    // independent de starea termenului pe restul înregistrării.
    oreDePlata += oreExpirate;

    // Nu poate fi negativ nici dacă datele contrazic constrângerea din bază.
    const oreRamase = Math.max(0, ore - oreFolosite - oreExpirate);
    const termenDepasit = inregistrare.termenFolosire < intrare.ziReferinta;

    if (termenDepasit) {
      // Termenul a trecut: ce n-a fost luat ca timp liber se plătește cu spor.
      oreDePlata += oreRamase;
      if (oreRamase + oreExpirate > 0) {
        probleme.push({
          cod: COD_ORE_SUPL_EXPIRATE,
          detalii: `${scrieOre(oreRamase + oreExpirate)} ore suplimentare au depășit termenul de compensare ${inregistrare.termenFolosire} și se plătesc cu spor.`,
        });
      }
      continue;
    }

    // Încă în termen: nici plătite, nici pierdute. Pot fi luate ca timp liber.
    oreInTermen += oreRamase;
    if (oreRamase > 0 && inregistrare.termenFolosire <= ziLimitaAvertizare) {
      probleme.push({
        cod: COD_ORE_SUPL_NECOMPENSATE,
        detalii: `${scrieOre(oreRamase)} ore suplimentare rămân necompensate, cu termen de folosire ${inregistrare.termenFolosire}.`,
      });
    }
  }

  let oreSarbatoareDePlata = 0;
  let oreSarbatoareCompensate = 0;

  for (const sarbatoare of intrare.sarbatori) {
    const oreLucrate = normalizeazaOre(sarbatoare.oreLucrate);

    if (sarbatoare.tip === "spor") {
      oreSarbatoareDePlata += oreLucrate;
      if (sarbatoare.sporProcent === null) {
        probleme.push({
          cod: COD_SPOR_SARBATOARE_FARA_PROCENT,
          detalii: `Sărbătoarea din ${sarbatoare.dataSarbatorii} (${scrieOre(oreLucrate)} ore) se plătește cu spor, dar nu are procentul de spor completat.`,
        });
      }
      continue;
    }

    // tip === "zi_libera"
    if (sarbatoare.acordata) {
      // Ziua liberă a fost dată: sporul nu se mai datorează.
      oreSarbatoareCompensate += oreLucrate;
      continue;
    }

    if (sarbatoare.termenAcordare !== null && sarbatoare.termenAcordare < intrare.ziReferinta) {
      // Termenul a trecut fără ca ziua liberă să fie acordată: sporul devine
      // obligatoriu.
      oreSarbatoareDePlata += oreLucrate;
      probleme.push({
        cod: COD_ZI_LIBERA_SARBATOARE_NEACORDATA,
        detalii: `Ziua liberă pentru sărbătoarea din ${sarbatoare.dataSarbatorii} (${scrieOre(oreLucrate)} ore) trebuia acordată până la ${sarbatoare.termenAcordare} și nu a fost; se plătește spor.`,
      });
    }

    // Altfel — neacordată, dar încă în termen (sau fără termen stabilit): nu
    // intră în niciun total. Nu se știe încă dacă va fi zi liberă sau spor, iar
    // a o pune în oricare dintre totaluri ar fi o presupunere despre viitor.
  }

  return {
    oreDePlata: rotunjesteOre(oreDePlata),
    oreCompensate: rotunjesteOre(oreCompensate),
    oreInTermen: rotunjesteOre(oreInTermen),
    oreSarbatoareDePlata: rotunjesteOre(oreSarbatoareDePlata),
    oreSarbatoareCompensate: rotunjesteOre(oreSarbatoareCompensate),
    probleme,
  };
}
