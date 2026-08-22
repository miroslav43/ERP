// src/domain/payroll/calc.ts
//
// Motorul de calcul al salariului — funcție PURĂ, fără import din `lib/supabase`,
// `next` sau ceasul de sistem. Luna de referință, setările și pontajul aprobat
// intră toate ca date. Consecința: aceeași funcție rulează în Server Action, în
// simularea din UI și în teste, garantat cu același rezultat.
//
// Scop DELIBERAT restrâns față de un motor de salarizare complet:
//   - o singură treaptă de spor pentru orele suplimentare (nu „primele 8h" vs
//     „restul" — nuanța există legal, dar procentul rămâne configurabil);
//   - concediul medical NU intră în calcul (indemnizația CNAS/FNUASS e un
//     proces de decontare separat, cu cod de indemnizație și bază de calcul
//     proprii — vezi `medical_leave_codes`); zilele medicale ies din baza de
//     zile plătite și apar ca avertisment, nu ca linie calculată.
//   - indemnizația de concediu de odihnă se plătește la rata zilnică a
//     salariului de bază, NU la media ultimelor 3 luni (simplificare marcată
//     explicit — vezi avertismentul `INDEMNIZATIE_CO_SIMPLIFICATA`).
//
// NIMIC din modulul ăsta nu e certificat. Fiecare cotă vine din
// `PayrollSettingsSnapshot`, niciodată hardcodată — vezi banner-ul din UI.

import { descriereCompleta, problema, type CodProblema } from "./erori";

export interface PragDeducerePersonala {
  readonly nrPersoaneIntretinereMin: number;
  /** `null` = fără plafon superior de persoane în întreținere (4+). */
  readonly nrPersoaneIntretinereMax: number | null;
  readonly venitBrutMax: number;
  readonly valoare: number;
}

export interface PayrollSettingsSnapshot {
  readonly valabilDeLa: string;
  readonly cotaCas: number;
  readonly cotaCass: number;
  readonly cotaImpozit: number;
  readonly cotaCamAngajator: number;
  readonly normaZilnicaOre: number;
  readonly procentSporNoapte: number;
  readonly procentSporWeekend: number;
  /**
   * Sporul distinct pentru sărbătoare legală. Lipsește din `payroll_settings`;
   * sursa lui de drept e `attendance_settings.spor_sarbatoare_procent`, care
   * încă nu alimentează calculul. Cât timp lipsește, orele de sărbătoare se
   * plătesc cu sporul de repaus și se ridică un avertisment.
   */
  readonly procentSporSarbatoare?: number;
  readonly procentOreSuplimentare: number;
  readonly valoareTichetMasa: number;
  readonly ticheteImpozabile: boolean;
  readonly deducerePersonala: readonly PragDeducerePersonala[];
  readonly rotunjireLei: boolean;
}

/**
 * Scutire fiscală per-angajat (cod CAEN IT/Construcții/Agricultură/Industria
 * Alimentară, persoană cu handicap, cercetare-dezvoltare) — `procent_scutire`
 * e opțional în `employee_tax_exemptions`: `null` înseamnă că nimeni nu a
 * configurat procentul, deci NU se aplică automat (vezi avertismentul
 * `SCUTIRE_FARA_PROCENT`), nu se presupune scutire totală.
 */
export interface TaxExemptionSnapshot {
  /** Fracție 0-1 (nu procent 0-100) — convertit la citirea din baza de date. */
  readonly procentScutire: number | null;
  readonly plafonLunar: number | null;
}

export interface EmployeeContractSnapshot {
  readonly salariuBaza: number;
  readonly nrPersoaneIntretinere: number;
  /**
   * Norma zilnică din CONTRACTUL angajatului. Când lipsește, se cade pe cea din
   * setările organizației — dar atunci un angajat cu normă parțială (4h) e
   * plătit ca full-time la ore suplimentare și la sporul de noapte, fiindcă
   * tariful orar se obține împărțind la norma greșită.
   */
  readonly normaZilnicaOre?: number;
  readonly exemptii?: readonly TaxExemptionSnapshot[];
}

export interface AttendanceSummary {
  readonly zileLucratoareLuna: number;
  readonly zileLucrate: number;
  readonly oreLucrate: number;
  readonly oreSuplimentare: number;
  readonly oreNoapte: number;
  readonly zileConcediuOdihna: number;
  readonly zileConcediuMedical: number;
  readonly zileAbsentaNemotivata: number;
  /**
   * Zilele și orele lucrate în repaus săptămânal și în sărbătoare legală.
   *
   * Opționale ca să nu rupă apelanții existenți, dar ABSENȚA lor a fost, până
   * acum, un defect: agregarea pontajului arunca pur și simplu rândurile cu
   * `tip_zi` weekend/sarbatoare, iar cine muncea sâmbăta nu era plătit deloc.
   *
   * Zilele NU intră în `zileLucrate`: acela împarte salariul lunar la zilele
   * lucrătoare ale lunii. Orele de aici se plătesc SEPARAT, la tarif orar.
   */
  readonly zileRepausLucrate?: number;
  readonly zileSarbatoareLucrate?: number;
  readonly oreNormaleRepaus?: number;
  readonly oreSuplimentareRepaus?: number;
  readonly oreNormaleSarbatoare?: number;
  readonly oreSuplimentareSarbatoare?: number;
}

export interface BonusInput {
  readonly suma: number;
  readonly impozabil: boolean;
  readonly supusContributii: boolean;
}

export interface DeductionInput {
  readonly suma: number;
  readonly procentMaximDinNet: number | null;
}

export interface PayrollCalcInput {
  readonly settings: PayrollSettingsSnapshot;
  readonly contract: EmployeeContractSnapshot;
  readonly attendance: AttendanceSummary;
  readonly bonuses: readonly BonusInput[];
  readonly deductions: readonly DeductionInput[];
}

export interface PayrollCalcWarning {
  readonly cod: string;
  readonly mesaj: string;
}

export interface PayrollCalcResult {
  readonly bazaSalariu: number;
  readonly sumaOreSuplimentare: number;
  readonly sporNoapte: number;
  readonly oreRepaus: number;
  readonly sporRepaus: number;
  readonly oreSarbatoare: number;
  readonly sporSarbatoare: number;
  readonly primeTotal: number;
  readonly brut: number;
  readonly nrTichete: number;
  readonly valoareTichete: number;
  readonly bazaCasCass: number;
  readonly cas: number;
  readonly cass: number;
  readonly deducerePersonala: number;
  readonly scutireFiscala: number;
  readonly bazaImpozit: number;
  readonly impozit: number;
  readonly camAngajator: number;
  readonly net: number;
  readonly retineriTotal: number;
  readonly netDePlata: number;
  readonly costTotalAngajator: number;
  readonly breakdown: readonly Readonly<{ pas: string; valoare: number }>[];
  readonly warnings: readonly PayrollCalcWarning[];
}

/** Rotunjire aritmetică la ban — nu „half to even", care ar surprinde la o verificare manuală. */
function rotund2(valoare: number): number {
  return Math.round((valoare + Number.EPSILON) * 100) / 100;
}

function rotundLeu(valoare: number, rotunjireLei: boolean): number {
  return rotunjireLei ? Math.round(valoare) : rotund2(valoare);
}

function cautaPragDeducere(
  praguri: readonly PragDeducerePersonala[],
  nrPersoane: number,
  venitBrut: number,
): number {
  const potrivite = praguri.filter(
    (p) =>
      nrPersoane >= p.nrPersoaneIntretinereMin &&
      (p.nrPersoaneIntretinereMax === null || nrPersoane <= p.nrPersoaneIntretinereMax) &&
      venitBrut <= p.venitBrutMax,
  );
  if (potrivite.length === 0) return 0;
  // Cel mai mic plafon care încă acoperă venitul e pragul corect — praguri
  // suprapuse din greșeală de configurare nu trebuie să aleagă la întâmplare.
  const ales = [...potrivite].sort((a, b) => a.venitBrutMax - b.venitBrutMax)[0];
  return ales?.valoare ?? 0;
}

export function calculatePayrollEntry(input: PayrollCalcInput): PayrollCalcResult {
  const { settings, contract, attendance, bonuses, deductions } = input;
  const warnings: PayrollCalcWarning[] = [];
  const breakdown: Readonly<{ pas: string; valoare: number }>[] = [];
  const inregistreaza = (pas: string, valoare: number): number => {
    breakdown.push({ pas, valoare: rotund2(valoare) });
    return valoare;
  };

  // Norma contractului bate norma organizației: tariful orar al unui angajat cu
  // normă parțială se calculează la norma LUI, nu la cele 8 ore implicite.
  const normaZilnica = contract.normaZilnicaOre ?? settings.normaZilnicaOre;
  if (normaZilnica <= 0) {
    throw new RangeError("Norma zilnică de ore trebuie să fie pozitivă.");
  }
  if (attendance.zileLucratoareLuna <= 0) {
    throw new RangeError("Numărul de zile lucrătoare din lună trebuie să fie pozitiv.");
  }

  if (attendance.zileConcediuMedical > 0) {
    warnings.push({
      cod: "CONCEDIU_MEDICAL_NECALCULAT",
      mesaj: `${String(attendance.zileConcediuMedical)} zile de concediu medical nu sunt incluse în acest calcul — indemnizația CNAS se calculează separat.`,
    });
  }
  if (attendance.zileConcediuOdihna > 0) {
    warnings.push({
      cod: "INDEMNIZATIE_CO_SIMPLIFICATA",
      mesaj:
        "Indemnizația de concediu de odihnă e plătită la rata zilnică a salariului de bază, nu la media ultimelor 3 luni.",
    });
  }

  const salariuZi = contract.salariuBaza / attendance.zileLucratoareLuna;
  const zilePlatite = attendance.zileLucrate + attendance.zileConcediuOdihna;
  if (zilePlatite > attendance.zileLucratoareLuna + 0.01) {
    throw new RangeError(
      "Zilele lucrate plus zilele de concediu de odihnă depășesc zilele lucrătoare ale lunii.",
    );
  }
  const bazaSalariu = inregistreaza("bazaSalariu", salariuZi * zilePlatite);

  const oreRata = contract.salariuBaza / (attendance.zileLucratoareLuna * normaZilnica);
  const sumaOreSuplimentare = inregistreaza(
    "sumaOreSuplimentare",
    attendance.oreSuplimentare * oreRata * (1 + settings.procentOreSuplimentare),
  );
  const sporNoapte = inregistreaza(
    "sporNoapte",
    attendance.oreNoapte * oreRata * settings.procentSporNoapte,
  );

  // Zilele de repaus săptămânal și de sărbătoare legală.
  //
  // Regula, preluată din `app.sporuri_pontaj` (0013_attendance.sql:686): pe
  // aceeași axă, sărbătoarea și orele suplimentare NU se însumează — se aplică
  // procentul MAI MARE. Un spor de 100% pentru sărbătoare plus 75% pentru ore
  // suplimentare nu fac 175%; ambele compensează același lucru, munca într-o zi
  // în care nu trebuia să lucrezi.
  const procentRepaus = settings.procentSporWeekend;
  const procentSarbatoare = settings.procentSporSarbatoare ?? settings.procentSporWeekend;

  const oreNormaleRepaus = attendance.oreNormaleRepaus ?? 0;
  const oreSuplRepaus = attendance.oreSuplimentareRepaus ?? 0;
  const oreNormaleSarbatoare = attendance.oreNormaleSarbatoare ?? 0;
  const oreSuplSarbatoare = attendance.oreSuplimentareSarbatoare ?? 0;

  // NU trec prin `inregistreaza`: `breakdown` e o listă de SUME în lei, iar
  // fluturașul o formatează integral cu `formatLei`. Un număr de ore strecurat
  // acolo s-ar tipări drept „8,00 lei" pe un document pe care angajatul îl
  // semnează.
  const oreRepaus = oreNormaleRepaus + oreSuplRepaus;
  const oreSarbatoare = oreNormaleSarbatoare + oreSuplSarbatoare;

  const sporRepaus = inregistreaza(
    "sporRepaus",
    oreNormaleRepaus * oreRata * (1 + procentRepaus) +
      oreSuplRepaus * oreRata * (1 + Math.max(procentRepaus, settings.procentOreSuplimentare)),
  );
  const sporSarbatoare = inregistreaza(
    "sporSarbatoare",
    oreNormaleSarbatoare * oreRata * (1 + procentSarbatoare) +
      oreSuplSarbatoare *
        oreRata *
        (1 + Math.max(procentSarbatoare, settings.procentOreSuplimentare)),
  );

  const avertizeaza = (cod: CodProblema, detalii: string | null = null): void => {
    const p = problema(cod, { detalii });
    warnings.push({ cod: p.cod, mesaj: descriereCompleta(p) });
  };
  if (oreSarbatoare > 0 && settings.procentSporSarbatoare === undefined) {
    avertizeaza(
      "SAL_SPOR_SARBATOARE_NECONFIGURAT",
      `${oreSarbatoare.toFixed(2)} ore lucrate în zile de sărbătoare legală.`,
    );
  }
  if (oreRepaus + oreSarbatoare > 0 && procentRepaus === 0 && procentSarbatoare === 0) {
    avertizeaza(
      "SAL_SPOR_REPAUS_NECONFIGURAT",
      `${(oreRepaus + oreSarbatoare).toFixed(2)} ore plătite la tariful orar simplu, fără spor.`,
    );
  }

  const primeTotal = inregistreaza(
    "primeTotal",
    bonuses.reduce((s, b) => s + b.suma, 0),
  );
  const primeSupuseContributii = bonuses
    .filter((b) => b.supusContributii)
    .reduce((s, b) => s + b.suma, 0);
  const primeImpozabileFaraContributii = bonuses
    .filter((b) => b.impozabil && !b.supusContributii)
    .reduce((s, b) => s + b.suma, 0);

  const brut = inregistreaza(
    "brut",
    bazaSalariu + sumaOreSuplimentare + sporNoapte + sporRepaus + sporSarbatoare + primeTotal,
  );

  // Tichetele de masă nu intră niciodată în baza CAS/CASS — regulă legală, nu
  // opțiune de configurare. Zilele plătite (lucrate, nu și CO) sunt baza de
  // acordare, cea mai răspândită convenție.
  const nrTichete = attendance.zileLucrate;
  const valoareTichete = inregistreaza("valoareTichete", nrTichete * settings.valoareTichetMasa);

  const bazaCasCass = inregistreaza(
    "bazaCasCass",
    bazaSalariu +
      sumaOreSuplimentare +
      sporNoapte +
      sporRepaus +
      sporSarbatoare +
      primeSupuseContributii,
  );
  const cas = inregistreaza("cas", bazaCasCass * settings.cotaCas);
  const cass = inregistreaza("cass", bazaCasCass * settings.cotaCass);

  const deducerePersonala = inregistreaza(
    "deducerePersonala",
    cautaPragDeducere(settings.deducerePersonala, contract.nrPersoaneIntretinere, brut),
  );

  const exemptii = contract.exemptii ?? [];
  const exemptiiAplicabile = exemptii.filter((e) => e.procentScutire !== null);
  if (exemptii.some((e) => e.procentScutire === null)) {
    warnings.push({
      cod: "SCUTIRE_FARA_PROCENT",
      mesaj:
        "Există o scutire fiscală activă fără procent configurat — nu a fost aplicată automat la calcul.",
    });
  }
  if (exemptiiAplicabile.length > 1) {
    warnings.push({
      cod: "SCUTIRI_FISCALE_MULTIPLE",
      mesaj:
        "Angajatul are mai multe scutiri fiscale active simultan — verificați manual dacă se pot cumula legal.",
    });
  }
  // Scutirile reduc baza de impozit pe venit (uz cel mai răspândit — ex. IT),
  // niciodată baza CAS/CASS: cazurile în care legea scutește și contribuțiile
  // ies din scopul acestei simplificări (vezi antetul modulului).
  const scutireFiscala = inregistreaza(
    "scutireFiscala",
    exemptiiAplicabile.reduce((suma, e) => {
      const procent = e.procentScutire ?? 0;
      const bazaScutibila = e.plafonLunar === null ? brut : Math.min(brut, e.plafonLunar);
      return suma + bazaScutibila * procent;
    }, 0),
  );

  const bazaImpozit = inregistreaza(
    "bazaImpozit",
    Math.max(
      0,
      bazaCasCass -
        cas -
        cass -
        deducerePersonala +
        primeImpozabileFaraContributii +
        (settings.ticheteImpozabile ? valoareTichete : 0) -
        scutireFiscala,
    ),
  );
  const impozit = inregistreaza("impozit", bazaImpozit * settings.cotaImpozit);

  const camAngajator = inregistreaza("camAngajator", brut * settings.cotaCamAngajator);

  const net = inregistreaza("net", brut - cas - cass - impozit);

  let netRamas = net;
  let retineriTotal = 0;
  for (const deducere of deductions) {
    const plafon =
      deducere.procentMaximDinNet === null ? netRamas : net * deducere.procentMaximDinNet;
    const aplicata = Math.min(deducere.suma, Math.max(0, plafon), netRamas);
    if (aplicata < deducere.suma - 0.005) {
      warnings.push({
        cod: "RETINERE_PLAFONATA",
        mesaj: `O reținere de ${deducere.suma.toFixed(2)} lei a fost plafonată la ${aplicata.toFixed(2)} lei.`,
      });
    }
    retineriTotal += aplicata;
    netRamas -= aplicata;
  }
  inregistreaza("retineriTotal", retineriTotal);

  const netDePlata = inregistreaza("netDePlata", net - retineriTotal);
  const costTotalAngajator = inregistreaza(
    "costTotalAngajator",
    brut + camAngajator + valoareTichete,
  );

  const r = settings.rotunjireLei;
  return {
    bazaSalariu: rotundLeu(bazaSalariu, r),
    sumaOreSuplimentare: rotundLeu(sumaOreSuplimentare, r),
    sporNoapte: rotundLeu(sporNoapte, r),
    oreRepaus,
    sporRepaus: rotundLeu(sporRepaus, r),
    oreSarbatoare,
    sporSarbatoare: rotundLeu(sporSarbatoare, r),
    primeTotal: rotundLeu(primeTotal, r),
    brut: rotundLeu(brut, r),
    nrTichete,
    valoareTichete: rotundLeu(valoareTichete, r),
    bazaCasCass: rotundLeu(bazaCasCass, r),
    cas: rotundLeu(cas, r),
    cass: rotundLeu(cass, r),
    deducerePersonala: rotundLeu(deducerePersonala, r),
    scutireFiscala: rotundLeu(scutireFiscala, r),
    bazaImpozit: rotundLeu(bazaImpozit, r),
    impozit: rotundLeu(impozit, r),
    camAngajator: rotundLeu(camAngajator, r),
    net: rotundLeu(net, r),
    retineriTotal: rotundLeu(retineriTotal, r),
    netDePlata: rotundLeu(netDePlata, r),
    costTotalAngajator: rotundLeu(costTotalAngajator, r),
    breakdown,
    warnings,
  };
}
