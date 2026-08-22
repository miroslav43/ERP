// src/domain/payroll/etape/diurna-plafoane.ts
//
// Diurna de delegare și detașare — regula DUBLULUI PLAFON, etapă pură din
// lanțul de salarizare.
//
// REGULA FISCALĂ. Diurna nu e neimpozabilă „până la un plafon", ci până la DOUĂ
// plafoane care se aplică simultan, din Codul fiscal (Legea 227/2015):
//
//   (a) PLAFONUL ZILNIC — art. 76 alin. (2) lit. k) și alin. (4) lit. h):
//       diurna e neimpozabilă în limita a ⚠️ DE 2,5 ORI nivelul legal stabilit
//       pentru personalul instituțiilor publice, pe zi și PE ȚARĂ. Baremul
//       diferă de la o țară la alta (⚠️ HG 714/2018 pentru deplasarea internă,
//       ⚠️ HG 518/1995 pentru cea externă) — de aceea baremul intră ca dată pe
//       fiecare zi, nu ca o constantă a lunii: o lună poate cuprinde zile în
//       țară și zile în trei state diferite.
//
//   (b) PLAFONUL LUNAR — art. 76 alin. (4^1), introdus prin ⚠️ Legea 72/2022:
//       totalul lunii nu poate depăși ⚠️ 33% din salariul de bază brut LUNAR
//       corespunzător locului de muncă ocupat.
//
// Aceleași plafoane se aplică și la contribuții — art. 142 lit. r) pentru CAS,
// art. 157 pentru CASS — deci partea din plafon iese complet din baza de calcul,
// iar partea de peste ORICARE dintre ele devine venit asimilat salariului: intră
// în brut și trece prin CAS + CASS + impozit. Partea neimpozabilă nu trece prin
// nimic și merge direct în restul de plată.
//
// DE CE PLAFONUL LUNAR SE VERIFICĂ CUMULAT. Plafonul (b) e al LUNII, nu al
// deplasării. Două delegări care, luate separat, stau amândouă sub 33% din
// salariu pot împreună să treacă peste — iar dacă fiecare deplasare și-ar
// verifica propriul plafon, depășirea n-ar fi văzută de nimeni și diferența ar
// rămâne neimpozitată. De aici forma etapei: primește TOATE zilele lunii
// deodată, nu o deplasare pe rând.
//
// ORDINEA DE IMPUTARE. Întâi plafonul zilnic, pe fiecare zi în parte; abia apoi
// cel lunar, peste totalul rămas neimpozabil. Ordinea inversă ar da alt
// rezultat: plafonul lunar aplicat pe suma BRUTĂ ar lăsa neimpozabilă o parte
// din ce plafonul zilnic tocmai a declarat impozabil, iar suma de peste baremul
// zilnic ar scăpa de impozit prin simplul fapt că luna a fost slabă.
//
// REPARTIZAREA REDUCERII LUNARE. Când plafonul lunar taie, reducerea se împarte
// între deplasări PROPORȚIONAL cu partea neimpozabilă a fiecăreia — nu „în
// ordinea deplasărilor, până se umple plafonul". Imputarea cronologică ar fi la
// fel de apărabilă fiscal (legea nu o prescrie), dar ar face ca rezultatul unei
// deplasări să depindă de ordinea în care au fost citite rândurile din bază:
// aceeași lună, recalculată după un sort diferit, ar da alte sume pe fluturaș.
// Proporțional, rezultatul e o funcție doar de date. Restul de bani care nu se
// împarte exact merge la resturile cele mai mari, cu departajare după
// `deplasareId`, ca să rămână determinist inclusiv la egalitate perfectă.
//
// ⚠️ CEI 33% SUNT UN PLAFON COMUN, NU AL DIURNEI. Art. 76 alin. (4^1) pune sub
// aceeași limită lunară mai multe avantaje: diurna, indemnizația de telemuncă,
// abonamentele sportive, contribuțiile la Pilonul III, primele de asigurare
// voluntară de sănătate, serviciile turistice. Etapa asta primește ca
// `fractiePlafonLunar` DOAR partea alocată diurnei din plafonul comun — decizia
// de repartizare între avantaje e a angajatorului (regulament intern sau
// contract colectiv) și nu se poate lua aici, unde celelalte avantaje nici nu se
// văd. Apelantul care trimite 0,33 în timp ce plătește și abonamente sportive
// din același plafon obține o diurnă neimpozabilă mai mare decât cea legală.
//
// Funcție PURĂ: fără ceas de sistem, fără I/O, fără aleator. Zilele sunt șiruri
// 'AAAA-LL-ZZ' și nu intră deloc în aritmetică — sunt acolo pentru raportare și
// pentru ca apelantul să poată dovedi ce lună a fost calculată.
//
// NIMIC din modulul ăsta nu e certificat contabil — vezi NOTES.md.

import { dinLei } from "../../bani";
import type { ProblemaEtapa } from "./probleme";

export type { ProblemaEtapa };

export interface ZiDiurna {
  /** 'AAAA-LL-ZZ'. */
  readonly data: string;
  /** Suma acordată efectiv pentru ziua aceea, în lei. */
  readonly sumaAcordata: number;
  /** Baremul legal pe zi pentru țara deplasării, în lei. */
  readonly baremLegalZi: number;
  /** Identificatorul deplasării, doar pentru raportare. */
  readonly deplasareId: string;
}

export interface IntrareDiurna {
  readonly zile: readonly ZiDiurna[];
  /** Multiplul baremului legal sub care ziua rămâne neimpozabilă (ex. 2.5). */
  readonly multiplicatorPlafonZilnic: number;
  /** Fracțiunea din salariul de bază care plafonează luna (ex. 0.33). */
  readonly fractiePlafonLunar: number;
  readonly salariuBazaBrut: number;
}

export interface DiurnaPeDeplasare {
  readonly deplasareId: string;
  readonly sumaTotala: number;
  readonly neimpozabila: number;
  readonly impozabila: number;
}

export interface RezultatDiurna {
  readonly totalAcordat: number;
  readonly neimpozabila: number;
  readonly impozabila: number;
  readonly plafonLunar: number;
  /** În ordinea primei apariții în `zile`. Sumele NU depind de ordinea aceea. */
  readonly peDeplasare: readonly DiurnaPeDeplasare[];
  readonly probleme: readonly ProblemaEtapa[];
}

/** Cel puțin o zi a depășit de 2,5 ori baremul legal al țării ei. */
const COD_PESTE_PLAFON_ZILNIC = "SAL_DIURNA_PESTE_PLAFON_ZILNIC";

/** Totalul lunii a depășit fracțiunea din salariul de bază. */
const COD_PESTE_PLAFON_LUNAR = "SAL_DIURNA_PESTE_PLAFON_LUNAR";

/** Fără salariu de bază nu există plafon lunar, deci nici diurnă neimpozabilă. */
const COD_FARA_SALARIU_BAZA = "SAL_DIURNA_FARA_SALARIU_BAZA";

/**
 * Sub-unitatea în care se ACUMULEAZĂ luna: o milionime de ban.
 *
 * DE CE NU ÎN LEI, PE VIRGULĂ MOBILĂ. Adunarea în virgulă mobilă nu e asociativă:
 * `a + b + c` depinde de ORDINEA termenilor. Cu date perfect obișnuite — sume cu
 * două zecimale, bareme legale, multiplicatorul 2,5 — suma exactă a depășirilor
 * zilnice cade des pe EXACT o jumătate de ban, iar pe ce parte a jumătății
 * aterizează virgula mobilă decide ordinea în care au ieșit rândurile din bază.
 * Cazul din testul „ordinea rândurilor nu poate muta un ban": cinci zile a căror
 * depășire însumează exact 370,955 lei dădeau 709,57 lei neimpozabili în 110 din
 * cele 120 de permutări și 709,58 în celelalte 10. Un ban mutat între partea
 * neimpozabilă și baza de CAS, CASS și impozit, fără nicio schimbare de date —
 * doar un `order by` diferit. Pe întregi, ordinea nu mai poate influența nimic.
 *
 * DE CE ATÂT DE FIN ȘI NU DIRECT ÎN BANI. Plafonul zilnic e o RATĂ (barem x 2,5)
 * și are jumătăți de ban: 23,33 x 2,5 = 58,325 lei. Cuantizat la BAN înainte de a
 * fi aplicat pe 20 de zile ar da 1166,60 în loc de 1166,50 — exact capcana pe care
 * modulul o ocolește. La o milionime de ban, eroarea de cuantizare a unei luni
 * întregi rămâne sub 2 x 10^-5 bani, adică de zeci de mii de ori mai mică decât
 * jumătatea de ban care decide rotunjirea finală. Rata rămâne rată.
 */
const SUBBANI_PE_BAN = 1_000_000;

/** Lei → sub-bani întregi. */
function inSubbani(lei: number): number {
  return Math.round(lei * 100 * SUBBANI_PE_BAN);
}

/**
 * Sub-bani → bani, rotunjire aritmetică (jumătatea urcă), doar pentru valori
 * nenegative. `%` și scăderea sunt EXACTE pe întregi siguri, deci nu se strecoară
 * nicio eroare de virgulă mobilă tocmai la pasul care decide banul — `x / 10^6`
 * urmat de `Math.round` ar reintroduce-o.
 *
 * Monoton: `a <= b` implică `inBani(a) <= inBani(b)`. De aici, depășirea unei
 * deplasări nu poate ieși peste totalul ei după rotunjire.
 */
function inBani(subbani: number): number {
  const rest = subbani % SUBBANI_PE_BAN;
  const intregi = (subbani - rest) / SUBBANI_PE_BAN;
  return rest * 2 >= SUBBANI_PE_BAN ? intregi + 1 : intregi;
}

/**
 * Peste ~90 de milioane de lei într-o singură deplasare, aritmetica pe întregi
 * în sub-bani iese din intervalul exact al lui `Number` și ar începe să piardă
 * tăcut. E pragul la care o sumă e aproape sigur lei confundați cu bani, nu o
 * diurnă.
 */
function intregSigur(valoare: number, unde: string): number {
  if (!Number.isSafeInteger(valoare)) {
    throw new RangeError(
      `Sumele de diurnă (${unde}) ies din intervalul în care aritmetica pe întregi mai e exactă — peste ~90 de milioane de lei. Aproape sigur lei confundați cu bani.`,
    );
  }
  return valoare;
}

/** Lei, pentru mesaje. Aceeași formă ca în celelalte etape. */
function lei(sumaBani: number): string {
  return (sumaBani / 100).toFixed(2);
}

/** „într-o zi" / „în 3 zile" / „în 20 de zile" — acordul, ca mesajul să sune a română. */
function inZile(numar: number): string {
  if (numar === 1) return "într-o zi";
  const ultimeleDoua = numar % 100;
  const cuDe = ultimeleDoua === 0 || ultimeleDoua >= 20;
  return `în ${String(numar)} ${cuDe ? "de zile" : "zile"}`;
}

/**
 * O rată (multiplicator, fracțiune) care e NaN sau negativă ar produce plafoane
 * negative, adică o diurnă integral impozabilă, fără nicio eroare. Se oprește
 * aici, nu peste trei etape, pe fluturașul unui om.
 */
function verificaRata(nume: string, valoare: number): void {
  if (!Number.isFinite(valoare) || valoare < 0) {
    throw new RangeError(
      `${nume} trebuie să fie un număr finit și nenegativ, nu ${String(valoare)}.`,
    );
  }
}

function verificaSuma(nume: string, valoare: number): void {
  if (!Number.isFinite(valoare) || valoare < 0) {
    throw new RangeError(
      `${nume} trebuie să fie o sumă finită și nenegativă, nu ${String(valoare)}. O corecție negativă nu are unde intra în regula dublului plafon — se face pe altă linie de fluturaș.`,
    );
  }
}

/** Sumele unei deplasări în sub-bani, înainte de rotunjirea la ban. */
interface AcumulatorDeplasare {
  readonly deplasareId: string;
  totalSubbani: number;
  depasireZilnicaSubbani: number;
}

/** Aceleași sume, în bani întregi, plus partea alocată de plafonul lunar. */
interface ParteDeplasare {
  readonly deplasareId: string;
  readonly totalBani: number;
  readonly neimpozabilZilnicBani: number;
  alocatBani: number;
}

/**
 * Diurna lunii, împărțită în parte neimpozabilă și parte impozabilă.
 *
 * @throws RangeError dacă o rată sau o sumă din intrare e negativă ori nefinită,
 *   sau dacă sumele unei deplasări ies din intervalul în care aritmetica pe
 *   întregi rămâne exactă (~90 de milioane de lei).
 */
export function calculeazaDiurna(intrare: IntrareDiurna): RezultatDiurna {
  const { zile, multiplicatorPlafonZilnic, fractiePlafonLunar, salariuBazaBrut } = intrare;

  verificaRata("Multiplicatorul plafonului zilnic", multiplicatorPlafonZilnic);
  verificaRata("Fracțiunea plafonului lunar", fractiePlafonLunar);
  if (!Number.isFinite(salariuBazaBrut)) {
    // Un salariu absent e o problemă raportată, nu o excepție — vezi
    // `COD_FARA_SALARIU_BAZA`. Un salariu NaN e altceva: o valoare care ar
    // contamina tăcut fiecare comparație de mai jos.
    throw new RangeError(
      `Salariul de bază brut trebuie să fie un număr finit, nu ${String(salariuBazaBrut)}.`,
    );
  }

  const acumulatori: AcumulatorDeplasare[] = [];
  const dupaDeplasare = new Map<string, AcumulatorDeplasare>();
  let zileDepasitePlafonZilnic = 0;

  for (const zi of zile) {
    const unde = `${zi.data} / ${zi.deplasareId}`;
    verificaSuma(`Suma acordată (${unde})`, zi.sumaAcordata);
    verificaSuma(`Baremul legal pe zi (${unde})`, zi.baremLegalZi);

    const sumaZiSubbani = intregSigur(inSubbani(zi.sumaAcordata), unde);

    // Plafonul zilnic e o RATĂ și NU se materializează în bani. Rotunjit la ban
    // aici, apoi aplicat pe zilele lunii, ar adăuga bani care nu există: 20 de
    // zile cu baremul de 23,33 lei dau un plafon de 20 x 58,325 = 1166,50 lei,
    // iar cu plafonul rotunjit la 58,33 ar da 1166,60 — zece bani inventați, pe
    // fiecare angajat, în fiecare lună. Cuantizarea la o milionime de ban de mai
    // jos păstrează jumătatea de ban a ratei; se rotunjește o singură dată, la
    // finalul deplasării. Vezi testul „o RATĂ nu se materializează niciodată în
    // bani" din `src/domain/bani.test.ts`.
    //
    // Plafonul se taie la suma zilei ÎNAINTE de cuantizare: depășirea unei zile
    // nu poate ieși negativă, iar un barem sau un multiplicator absurd de mare
    // (`verificaRata` acceptă orice număr finit nenegativ) nu mai poate arunca
    // acumularea afară din intervalul întregilor exacți.
    const plafonZiLei = Math.min(zi.baremLegalZi * multiplicatorPlafonZilnic, zi.sumaAcordata);
    const depasireZiSubbani = sumaZiSubbani - inSubbani(plafonZiLei);
    if (depasireZiSubbani > 0) zileDepasitePlafonZilnic += 1;

    let acumulator = dupaDeplasare.get(zi.deplasareId);
    if (acumulator === undefined) {
      acumulator = { deplasareId: zi.deplasareId, totalSubbani: 0, depasireZilnicaSubbani: 0 };
      dupaDeplasare.set(zi.deplasareId, acumulator);
      acumulatori.push(acumulator);
    }
    // Acumulare pe ÎNTREGI: `+` e exact și comutativ aici, deci rezultatul e o
    // funcție doar de mulțimea zilelor, nu și de ordinea lor. Verificarea e pe
    // total, care majorează depășirea.
    acumulator.totalSubbani = intregSigur(acumulator.totalSubbani + sumaZiSubbani, unde);
    acumulator.depasireZilnicaSubbani += depasireZiSubbani;
  }

  // Se rotunjește DEPĂȘIREA, iar partea neimpozabilă se obține prin scădere din
  // total. Invers — rotunjind partea neimpozabilă — cele două rotunjiri ar
  // putea, împreună, să nu mai dea totalul, și tocmai suma raportată ca
  // impozabilă ar fi cea care nu se potrivește cu ce se declară în D112.
  const parti: ParteDeplasare[] = acumulatori.map((acumulator) => {
    const totalBani = inBani(acumulator.totalSubbani);
    // `depasireZilnicaSubbani <= totalSubbani` pe întregi, iar `inBani` e
    // monoton, deci `Math.min` nu poate tăia nimic. Rămâne ca plasă de siguranță
    // pentru cazul în care regula de rotunjire se schimbă cândva.
    const depasireBani = Math.min(inBani(acumulator.depasireZilnicaSubbani), totalBani);
    return {
      deplasareId: acumulator.deplasareId,
      totalBani,
      neimpozabilZilnicBani: totalBani - depasireBani,
      alocatBani: 0,
    };
  });

  const totalAcordatBani = parti.reduce((total, parte) => total + parte.totalBani, 0);
  const neimpozabilZilnicBani = parti.reduce(
    (total, parte) => total + parte.neimpozabilZilnicBani,
    0,
  );
  const depasireZilnicaBani = totalAcordatBani - neimpozabilZilnicBani;

  // Un salariu negativ ar da un plafon negativ, adică mai puțin decât nimic.
  // Se oprește la zero și e semnalat prin `COD_FARA_SALARIU_BAZA`.
  // Plafonul lunar e o valoare RAPORTATĂ (`rezultat.plafonLunar`) și un prag,
  // nu o rată înmulțită mai departe cu o cantitate — se rotunjește la ban o
  // singură dată, prin regula unică a aplicației.
  const plafonLunarBani = Math.max(0, dinLei(salariuBazaBrut * fractiePlafonLunar));
  const tintaBani = Math.min(neimpozabilZilnicBani, plafonLunarBani);

  // Comparația se face în bani, nu în lei: sub un ban nu există depășire de
  // plafon, iar altfel eroarea de reprezentare a virgulei mobile ar produce
  // avertismente pentru diferențe de ordinul a 10^-13 lei, pe care rezultatul
  // nici măcar nu le-ar arăta.
  const depasestePlafonulLunar = neimpozabilZilnicBani > plafonLunarBani;

  // Repartizarea proporțională, cu metoda resturilor celor mai mari. Când
  // plafonul lunar nu taie, `tintaBani` e chiar totalul, `intreg` iese exact
  // egal cu ponderea și bucla nu schimbă nimic — un singur drum prin cod
  // pentru amândouă cazurile, deci și cazul rar e acoperit de fiecare test.
  if (neimpozabilZilnicBani > 0) {
    let distribuiti = 0;
    const candidati = parti.map((parte) => {
      const produs = tintaBani * parte.neimpozabilZilnicBani;
      const intreg = Math.floor(produs / neimpozabilZilnicBani);
      parte.alocatBani = intreg;
      distribuiti += intreg;
      return { parte, rest: produs % neimpozabilZilnicBani };
    });

    candidati.sort((a, b) => {
      if (a.rest !== b.rest) return b.rest - a.rest;
      // Departajare stabilă și independentă de ordinea din listă: la resturi
      // egale, banul rămas merge întotdeauna la aceeași deplasare.
      return a.parte.deplasareId < b.parte.deplasareId
        ? -1
        : a.parte.deplasareId > b.parte.deplasareId
          ? 1
          : 0;
    });

    let ramasi = tintaBani - distribuiti;
    for (const candidat of candidati) {
      if (ramasi <= 0) break;
      candidat.parte.alocatBani += 1;
      ramasi -= 1;
    }
  }

  const peDeplasare: DiurnaPeDeplasare[] = parti.map((parte) => ({
    deplasareId: parte.deplasareId,
    sumaTotala: parte.totalBani / 100,
    neimpozabila: parte.alocatBani / 100,
    impozabila: (parte.totalBani - parte.alocatBani) / 100,
  }));

  const neimpozabilaBani = parti.reduce((total, parte) => total + parte.alocatBani, 0);

  const probleme: ProblemaEtapa[] = [];

  if (depasireZilnicaBani > 0) {
    probleme.push({
      cod: COD_PESTE_PLAFON_ZILNIC,
      detalii: `Diurna acordată trece peste plafonul zilnic (baremul legal al țării x ${String(multiplicatorPlafonZilnic)}) ${inZile(zileDepasitePlafonZilnic)} din lună, cu ${lei(depasireZilnicaBani)} lei în total — diferența intră în brut și trece prin CAS, CASS și impozit.`,
    });
  }

  if (salariuBazaBrut > 0) {
    if (depasestePlafonulLunar) {
      probleme.push({
        cod: COD_PESTE_PLAFON_LUNAR,
        detalii: `Diurna neimpozabilă rămasă după plafonul zilnic (${lei(neimpozabilZilnicBani)} lei) depășește plafonul lunar de ${lei(plafonLunarBani)} lei cu ${lei(neimpozabilZilnicBani - plafonLunarBani)} lei — diferența devine venit asimilat salariului.`,
      });
    }
  } else if (totalAcordatBani > 0) {
    // Codul specific îl înlocuiește pe cel generic, nu i se adaugă: fără
    // salariu de bază plafonul lunar e zero, deci e depășit prin definiție, iar
    // un al doilea avertisment care spune același lucru l-ar îneca pe cel care
    // spune DE CE. Fără nicio zi de diurnă nu se raportează nimic — n-a devenit
    // nimic impozabil, deci nu există consecință de semnalat.
    probleme.push({
      cod: COD_FARA_SALARIU_BAZA,
      detalii: `Salariul de bază brut lunar e ${salariuBazaBrut.toFixed(2)} lei, deci plafonul lunar e zero și toată diurna de ${lei(totalAcordatBani)} lei devine impozabilă — aproape sigur o eroare de date, nu o situație reală.`,
    });
  }

  return {
    totalAcordat: totalAcordatBani / 100,
    neimpozabila: neimpozabilaBani / 100,
    impozabila: (totalAcordatBani - neimpozabilaBani) / 100,
    plafonLunar: plafonLunarBani / 100,
    peDeplasare,
    probleme,
  };
}
