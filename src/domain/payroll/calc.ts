// src/domain/payroll/calc.ts
//
// Motorul de calcul al salariului — funcție PURĂ, fără import din `lib/supabase`,
// `next` sau ceasul de sistem. Luna de referință, setările și pontajul aprobat
// intră toate ca date. Consecința: aceeași funcție rulează în Server Action, în
// simularea din UI și în teste, garantat cu același rezultat.
//
// CE ACOPERĂ AZI:
//   - trei axe de spor — zi lucrătoare, repaus săptămânal, sărbătoare legală —
//     cu regula „maxim, nu sumă" preluată din `app.sporuri_pontaj`;
//   - norma din CONTRACTUL angajatului, nu cea a organizației (part-time);
//   - baze separate pentru CAS și CASS, cu regimul tichetelor configurabil;
//   - plafonul minim al bazei de contribuții, cu avertisment pentru excepții;
//   - avantajele în natură: intră în brut, se scad din restul de plată.
//
// CE RĂMÂNE SIMPLIFICAT, deliberat și marcat prin avertismente:
//   - concediul medical NU intră în calcul (indemnizația CNAS/FNUASS are cod
//     de indemnizație, bază pe mai multe luni și plătitor împărțit între firmă
//     și fond — vezi `medical_leave_codes`); zilele medicale ies din baza de
//     zile plătite și apar ca avertisment, nu ca linie calculată;
//   - indemnizația de concediu de odihnă se plătește la rata zilnică a
//     salariului de bază, NU la media ultimelor 3 luni;
//   - un singur procent per axă de spor, fără trepte în interiorul zilei
//     („primele 8 ore" vs restul);
//   - diurna nu intră încă în calcul, deși modulul ei calculează deja partea
//     impozabilă și pe cea neimpozabilă.
//
// NIMIC din modulul ăsta nu e certificat. Fiecare cotă vine din
// `PayrollSettingsSnapshot`, niciodată hardcodată — vezi banner-ul din UI.

import { rotunjesteLaBani } from "../bani";
import { descriereCompleta, problema, problemaDinEtapa, type CodProblema } from "./erori";
import { calculeazaCompensarea, type IntrareCompensare } from "./etape/compensare-ore";
import { calculeazaIndemnizatieCm, type IntrareIndemnizatieCm } from "./etape/indemnizatie-cm";
import { calculeazaIndemnizatieCo, type IntrareIndemnizatieCo } from "./etape/indemnizatie-co";

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
  /**
   * Tichetele intră în baza CASS (nu și în cea CAS). Implicit `false`: o
   * valoare implicită `true` ar schimba tăcut netul fiecărui angajat la prima
   * recalculare. ⚠️ Regim de confirmat de contabil — vezi NOTES.md §3.
   */
  readonly ticheteSupuseCass?: boolean;
  /** Setările au fost confirmate de contabil. Cât timp e `false`, motorul avertizează. */
  readonly verificatDeContabil?: boolean;
  readonly deducerePersonala: readonly PragDeducerePersonala[];
  readonly rotunjireLei: boolean;
  /** ⚠️ De confirmat de contabil. Pragul minim al bazei de contribuții. */
  readonly salariuMinimBrut?: number;
  /** Ridică baza CAS/CASS la salariul minim. Implicit stins — vezi 0055. */
  readonly aplicaMinimContributii?: boolean;
  /** Cum se plătește indemnizația de concediu de odihnă. Vezi `etape/indemnizatie-co.ts`. */
  readonly modCalculIndemnizatieCo?: "baza" | "media_3_luni" | "cea_mai_avantajoasa";
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
  /** Implicitul pentru ambele baze, când nu se dau steaguri separate. */
  readonly supusContributii: boolean;
  /**
   * Suprascriu implicitul de mai sus. `salary_component_types` are de mult
   * coloanele `intra_in_baza_cas` și `intra_in_baza_cass` — o componentă poate
   * intra în baza de sănătate fără să intre în cea de pensie.
   */
  readonly intraInBazaCas?: boolean;
  readonly intraInBazaCass?: boolean;
  /**
   * Avantaj primit ÎN NATURĂ (mașină de serviciu folosită personal, cazare,
   * abonament). Intră în brut și se impozitează ca orice venit, dar NU se
   * plătește în bani: angajatul l-a primit deja. Se scade la restul de plată.
   */
  readonly esteAvantajInNatura?: boolean;
}

export interface DeductionInput {
  readonly suma: number;
  readonly procentMaximDinNet: number | null;
}

export interface PayrollCalcInput {
  readonly settings: PayrollSettingsSnapshot;
  /**
   * Cele trei etape de mai jos sunt OPȚIONALE, deliberat.
   *
   * Absente, motorul se comportă exact ca înainte: concediul de odihnă se
   * plătește la rata zilnică a salariului de bază, concediul medical nu se
   * calculează, iar orele suplimentare se plătesc toate. Așa rămân valabile
   * apelanții existenți și cele douăzeci și trei de teste care sunt contractul
   * de non-regresie al acestui modul.
   *
   * Prezente, fiecare preia bucata ei de calcul, iar avertismentul de
   * simplificare corespunzător dispare — nu mai are ce semnala.
   */
  readonly concediuOdihna?: Omit<
    IntrareIndemnizatieCo,
    "zileConcediu" | "salariuBaza" | "zileLucratoareLuna"
  >;
  readonly concediuMedical?: Omit<IntrareIndemnizatieCm, "zileLucratoareLuna">;
  readonly compensari?: Omit<IntrareCompensare, "ziReferinta"> & { readonly ziReferinta: string };
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
  readonly indemnizatieCo: number;
  readonly indemnizatieCmAngajator: number;
  readonly indemnizatieCmFnuass: number;
  readonly zileCmAngajator: number;
  readonly zileCmFnuass: number;
  readonly bazaZilnicaCm: number;
  readonly oreSuplCompensate: number;
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
  /** ÎNVECHIT: egal cu `bazaCas`. Păstrat cât timp consumatorii încă îl citesc. */
  readonly bazaCasCass: number;
  readonly bazaCas: number;
  readonly bazaCass: number;
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
  readonly avantajeNatura: number;
  readonly restDePlata: number;
  readonly costTotalAngajator: number;
  readonly breakdown: readonly Readonly<{ pas: string; valoare: number }>[];
  readonly warnings: readonly PayrollCalcWarning[];
}

/**
 * Rotunjire aritmetică la ban, din regula unică a aplicației (`domain/bani.ts`).
 *
 * Varianta locală de dinainte folosea un epsilon ABSOLUT, iar `lib/format/money.ts`
 * unul RELATIV: pe 2,675 dădeau 2,67 și 2,68. O sumă putea fi afișată altfel
 * decât fusese calculată — pe un fluturaș, asta e o discrepanță pe care omul o
 * vede și nu o poate explica.
 */
const rotund2 = rotunjesteLaBani;

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

  if (attendance.zileConcediuMedical > 0 && input.concediuMedical === undefined) {
    warnings.push({
      cod: "CONCEDIU_MEDICAL_NECALCULAT",
      mesaj: `${String(attendance.zileConcediuMedical)} zile de concediu medical nu sunt incluse în acest calcul — indemnizația CNAS se calculează separat.`,
    });
  }
  if (attendance.zileConcediuOdihna > 0 && input.concediuOdihna === undefined) {
    warnings.push({
      cod: "INDEMNIZATIE_CO_SIMPLIFICATA",
      mesaj:
        "Indemnizația de concediu de odihnă e plătită la rata zilnică a salariului de bază, nu la media ultimelor 3 luni.",
    });
  }

  const salariuZi = contract.salariuBaza / attendance.zileLucratoareLuna;
  // Când etapa de indemnizație preia concediul de odihnă, zilele ei ies din
  // baza de salariu — altfel ar fi plătite de două ori, o dată la rata de bază
  // și o dată la rata de indemnizație.
  const zilePlatite =
    input.concediuOdihna === undefined
      ? attendance.zileLucrate + attendance.zileConcediuOdihna
      : attendance.zileLucrate;
  if (
    attendance.zileLucrate + attendance.zileConcediuOdihna >
    attendance.zileLucratoareLuna + 0.01
  ) {
    throw new RangeError(
      "Zilele lucrate plus zilele de concediu de odihnă depășesc zilele lucrătoare ale lunii.",
    );
  }
  const bazaSalariu = inregistreaza("bazaSalariu", salariuZi * zilePlatite);

  const oreRata = contract.salariuBaza / (attendance.zileLucratoareLuna * normaZilnica);

  // Orele compensate cu timp liber NU se mai plătesc — ar fi plată dublă.
  // Când evidența compensărilor e dată, ea e autoritativă asupra pontajului:
  // pontajul spune ce s-a lucrat, compensările spun ce s-a stins deja altfel.
  let oreSuplDePlata = attendance.oreSuplimentare;
  let oreSuplCompensate = 0;
  if (input.compensari !== undefined) {
    const comp = calculeazaCompensarea(input.compensari);
    oreSuplDePlata = comp.oreDePlata;
    oreSuplCompensate = comp.oreCompensate;
    for (const pb of comp.probleme) {
      const completa = problemaDinEtapa(pb.cod, pb.detalii);
      warnings.push({ cod: completa.cod, mesaj: descriereCompleta(completa) });
    }
  }
  const sumaOreSuplimentare = inregistreaza(
    "sumaOreSuplimentare",
    oreSuplDePlata * oreRata * (1 + settings.procentOreSuplimentare),
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

  const raporteaza = (probleme: readonly { cod: string; detalii: string }[]): void => {
    for (const pb of probleme) {
      const completa = problemaDinEtapa(pb.cod, pb.detalii);
      warnings.push({ cod: completa.cod, mesaj: descriereCompleta(completa) });
    }
  };

  // Indemnizația de concediu de odihnă: media perioadei de referință față de
  // rata curentă, în varianta mai avantajoasă pentru angajat.
  let indemnizatieCo = 0;
  if (input.concediuOdihna !== undefined && attendance.zileConcediuOdihna > 0) {
    const co = calculeazaIndemnizatieCo({
      ...input.concediuOdihna,
      zileConcediu: attendance.zileConcediuOdihna,
      salariuBaza: contract.salariuBaza,
      zileLucratoareLuna: attendance.zileLucratoareLuna,
    });
    indemnizatieCo = co.suma;
    raporteaza(co.probleme);
  }
  inregistreaza("indemnizatieCo", indemnizatieCo);

  // Concediul medical: bază pe mai multe luni, plafon, procent, și împărțirea
  // între firmă și fondul de sănătate.
  let indemnizatieCmAngajator = 0;
  let indemnizatieCmFnuass = 0;
  let zileCmAngajator = 0;
  let zileCmFnuass = 0;
  let bazaZilnicaCm = 0;
  if (input.concediuMedical !== undefined) {
    const cm = calculeazaIndemnizatieCm({
      ...input.concediuMedical,
      zileLucratoareLuna: attendance.zileLucratoareLuna,
    });
    indemnizatieCmAngajator = cm.totalAngajator;
    indemnizatieCmFnuass = cm.totalFnuass;
    bazaZilnicaCm = cm.bazaZilnica;
    for (const linie of cm.peCertificat) {
      zileCmAngajator += linie.zileAngajator;
      zileCmFnuass += linie.zileFnuass;
    }
    raporteaza(cm.probleme);
  }
  inregistreaza("indemnizatieCmAngajator", indemnizatieCmAngajator);
  inregistreaza("indemnizatieCmFnuass", indemnizatieCmFnuass);

  const primeTotal = inregistreaza(
    "primeTotal",
    bonuses.reduce((s, b) => s + b.suma, 0),
  );
  const primeInBazaCas = bonuses
    .filter((b) => b.intraInBazaCas ?? b.supusContributii)
    .reduce((s, b) => s + b.suma, 0);
  const primeInBazaCass = bonuses
    .filter((b) => b.intraInBazaCass ?? b.supusContributii)
    .reduce((s, b) => s + b.suma, 0);
  const primeImpozabileFaraContributii = bonuses
    .filter((b) => b.impozabil && !b.supusContributii)
    .reduce((s, b) => s + b.suma, 0);

  const brut = inregistreaza(
    "brut",
    bazaSalariu +
      indemnizatieCo +
      indemnizatieCmAngajator +
      indemnizatieCmFnuass +
      sumaOreSuplimentare +
      sporNoapte +
      sporRepaus +
      sporSarbatoare +
      primeTotal,
  );

  // Numărul de tichete se acordă pe zilele efectiv LUCRATE, nu pe cele plătite
  // (concediul de odihnă nu dă tichete) — convenția cea mai răspândită.
  //
  // Regimul lor fiscal e mai jos, la baze: NU intră în baza de pensie, iar în
  // cea de sănătate intră sau nu, după setare. Comentariul de aici susținea
  // până la 0054 că „nu intră niciodată în baza CAS/CASS — regulă legală, nu
  // opțiune de configurare"; jumătatea despre CASS era greșită.
  const nrTichete = attendance.zileLucrate;
  const valoareTichete = inregistreaza("valoareTichete", nrTichete * settings.valoareTichetMasa);

  // Baza comună a celor două contribuții — drepturile din muncă propriu-zise.
  const bazaComuna = bazaSalariu + sumaOreSuplimentare + sporNoapte + sporRepaus + sporSarbatoare;

  // Tichetele de masă NU intră în baza de pensie. În cea de sănătate intră sau
  // nu, după regimul fiscal în vigoare — de aceea e o setare, nu o constantă.
  const ticheteInCass = (settings.ticheteSupuseCass ?? false) ? valoareTichete : 0;
  if (valoareTichete > 0 && settings.verificatDeContabil === false) {
    avertizeaza(
      "SAL_TICHETE_REGIM_NECONFIRMAT",
      `${valoareTichete.toFixed(2)} lei în tichete, tratate ${ticheteInCass > 0 ? "CU" : "FĂRĂ"} CASS.`,
    );
  }

  const bazaCas = inregistreaza("bazaCas", bazaComuna + primeInBazaCas);
  const bazaCass = inregistreaza("bazaCass", bazaComuna + primeInBazaCass + ticheteInCass);
  // Plafonul minim al bazei de contribuții. Legea prevede EXCEPȚII (elevi și
  // studenți sub 26 de ani, pensionari, persoane cu handicap, cumul de
  // contracte) pentru care schema nu are încă niciun câmp — de aceea motorul
  // ridică baza și AVERTIZEAZĂ, în loc să decidă singur.
  const minim = settings.salariuMinimBrut ?? 0;
  const aplicaMinim = (settings.aplicaMinimContributii ?? false) && minim > 0;
  const bazaCasFinala = aplicaMinim ? Math.max(bazaCas, minim) : bazaCas;
  const bazaCassFinala = aplicaMinim ? Math.max(bazaCass, minim) : bazaCass;
  if (aplicaMinim && (bazaCasFinala > bazaCas || bazaCassFinala > bazaCass)) {
    avertizeaza(
      "SAL_CAS_LA_MINIM",
      `Baza a fost ridicată de la ${bazaCas.toFixed(2)} la ${minim.toFixed(2)} lei.`,
    );
  }

  const cas = inregistreaza("cas", bazaCasFinala * settings.cotaCas);
  const cass = inregistreaza("cass", bazaCassFinala * settings.cotaCass);
  const bazaCasCass = bazaCasFinala;

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
      bazaCasFinala +
        indemnizatieCmAngajator +
        indemnizatieCmFnuass -
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

  // Avantajele în natură au fost deja adunate în brut și impozitate; aici se
  // scad din suma VIRATĂ, fiindcă angajatul le-a primit în natură, nu în bani.
  const avantajeNatura = inregistreaza(
    "avantajeNatura",
    bonuses.filter((b) => b.esteAvantajInNatura === true).reduce((s, b) => s + b.suma, 0),
  );
  const restBrut = netDePlata - avantajeNatura;
  if (restBrut < -0.005) {
    avertizeaza(
      "SAL_AVANTAJ_NATURA_PESTE_NET",
      `Lipsesc ${Math.abs(restBrut).toFixed(2)} lei: avantajele depășesc netul rămas.`,
    );
  }
  // Nu se poate vira o sumă negativă. Diferența rămâne de recuperat altfel, iar
  // avertismentul de mai sus o numește în cifre.
  const restDePlata = inregistreaza("restDePlata", Math.max(0, restBrut));
  const costTotalAngajator = inregistreaza(
    "costTotalAngajator",
    brut + camAngajator + valoareTichete,
  );

  const r = settings.rotunjireLei;
  return {
    bazaSalariu: rotundLeu(bazaSalariu, r),
    indemnizatieCo: rotundLeu(indemnizatieCo, r),
    indemnizatieCmAngajator: rotundLeu(indemnizatieCmAngajator, r),
    indemnizatieCmFnuass: rotundLeu(indemnizatieCmFnuass, r),
    zileCmAngajator,
    zileCmFnuass,
    bazaZilnicaCm: rotundLeu(bazaZilnicaCm, r),
    oreSuplCompensate,
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
    bazaCas: rotundLeu(bazaCasFinala, r),
    bazaCass: rotundLeu(bazaCassFinala, r),
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
    avantajeNatura: rotundLeu(avantajeNatura, r),
    restDePlata: rotundLeu(restDePlata, r),
    costTotalAngajator: rotundLeu(costTotalAngajator, r),
    breakdown,
    warnings,
  };
}
