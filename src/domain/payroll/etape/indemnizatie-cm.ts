// src/domain/payroll/etape/indemnizatie-cm.ts
//
// Indemnizația de concediu medical (OUG 158/2005) — etapă SEPARATĂ de motorul
// din `calc.ts`. Acolo zilele medicale ies din baza de zile plătite și rămân ca
// avertisment (`SAL_CM_NECALCULAT`); aici se calculează efectiv suma, împărțită
// între firmă și FNUASS.
//
// REGULA LEGALĂ, pe pași:
//
//   1. BAZA DE CALCUL — media veniturilor BRUTE din ultimele `luniBazaCalcul`
//      luni (6 la codurile obișnuite), împărțită la numărul de zile LUCRATE în
//      acele luni. Rezultatul e o bază ZILNICĂ, nu una lunară.
//   2. PLAFONAREA — când codul are `plafonSalariiMinime`, baza zilnică nu poate
//      depăși `(plafon × salariul minim brut) / zilele lucrătoare ale lunii`.
//   3. PROCENTUL codului (75%, 85%, 100%) se aplică bazei zilnice.
//   4. PLĂTITORUL — primele `zileAngajator` zile CALENDARISTICE ale EPISODULUI
//      de boală sunt suportate de firmă, restul de FNUASS. Un certificat de
//      CONTINUARE nu redeschide acele zile; de aceea intrarea poartă
//      `zileAngajatorDejaConsumate`. Un certificat care NU e continuare deschide
//      un episod nou și repornește contorul.
//
// APROXIMĂRI ȘI CONVENȚII, marcate explicit — nu sunt scăpări:
//
//   (a) REPARTIZAREA ZILELOR LUCRĂTOARE. Zilele de angajator se numără în zile
//       CALENDARISTICE, dar indemnizația se plătește pe zile LUCRĂTOARE. Funcția
//       nu are defalcarea zi cu zi a certificatului (nici calendarul de
//       sărbători legale al organizației), deci partea firmei se obține
//       PROPORȚIONAL:
//         `round(zileLucratoare × zileCalendaristiceAngajator / zileCalendaristice)`.
//       Pe un certificat de 10 zile calendaristice cu 8 lucrătoare și 5 zile de
//       angajator rezultă 4/4. Realitatea poate fi 5/3 sau 3/5, după cum cad
//       weekendurile și sărbătorile. ⚠️ De confirmat de contabil înainte de o
//       plată reală; reparația corectă e defalcarea pe zile, nu altă formulă.
//   (b) O SINGURĂ BAZĂ pe lună. `luniBazaCalcul` și `plafonSalariiMinime` se iau
//       din codul PRIMULUI certificat, fiindcă rezultatul are un singur câmp
//       `bazaZilnica`. PROCENTUL, în schimb, se ia de la fiecare certificat în
//       parte — două coduri diferite în aceeași lună se plătesc corect fiecare.
//   (c) FĂRĂ ARITMETICĂ DE DATE. `dataInceput`/`dataSfarsit` sunt șiruri
//       'AAAA-LL-ZZ' folosite doar pentru identificare; funcția nu construiește
//       niciun `Date`, nu resortează certificatele și nu verifică suprapunerile.
//       Numărul de zile calendaristice și lucrătoare vine deja calculat.
//   (d) ZILELE DIN REZULTAT SUNT LUCRĂTOARE. `zileAngajator`/`zileFnuass` din
//       `IndemnizatiePeCertificat` sunt zilele LUCRĂTOARE pe care s-a plătit
//       fiecare parte, nu zilele calendaristice ale împărțirii. Așa suma se
//       poate reface pe hârtie: `sumaX = indemnizația zilnică × zileX`, iar
//       `zileAngajator + zileFnuass` dă exact `zileLucratoare` ale
//       certificatului.
//
// Funcție PURĂ: fără ceas, fără I/O, fără `Date`. Sumele sunt în LEI, rotunjite
// la ban prin regula unică a aplicației.
//
// ⚠️ Valorile din nomenclatorul `medical_leave_codes` (procente, zile de
// angajator, plafoane) sunt marcate „DE VERIFICAT DE JURIST" în migrarea 0009.
// Modulul le aplică așa cum vin; nu le corectează și nu le presupune.

import { rotunjesteLaBani } from "../../bani";
import type { ProblemaEtapa } from "./probleme";

export type { ProblemaEtapa };

export type PlatitorCm = "angajator" | "fnuass" | "mixt";

export interface CodIndemnizatie {
  readonly cod: string;
  /** Procent 0-100, așa cum vine din nomenclator. */
  readonly procent: number;
  /** Zile CALENDARISTICE suportate de angajator. */
  readonly zileAngajator: number;
  readonly platitor: PlatitorCm;
  readonly luniBazaCalcul: number;
  /** Multiplu al salariului minim; `null` = fără plafon. */
  readonly plafonSalariiMinime: number | null;
  /**
   * Ce se REȚINE din indemnizația codului (0127). Cele trei nu merg împreună:
   * CAS din toate, impozitul din toate în afară de maternitate (11) și risc
   * maternal (15), CASS doar din boala obișnuită (01). Absente ⇒ implicitele
   * majoritare, ca un cod vechi să nu schimbe comportamentul la citire.
   */
  readonly retineCas?: boolean;
  readonly retineImpozit?: boolean;
  readonly retineCass?: boolean;
}

export interface CertificatMedical {
  readonly serie: string;
  readonly numar: string;
  /** 'AAAA-LL-ZZ'. Comparabile lexicografic; nu construi niciun `Date`. */
  readonly dataInceput: string;
  readonly dataSfarsit: string;
  readonly zileCalendaristice: number;
  /** Zilele lucrătoare acoperite — pe ele se plătește indemnizația. */
  readonly zileLucratoare: number;
  readonly esteContinuare: boolean;
  readonly cod: CodIndemnizatie;
}

export interface LunaIstoricCm {
  readonly an: number;
  readonly luna: number;
  /** Venit BRUT realizat în lună, în lei. */
  readonly venitBrut: number;
  readonly zileLucrate: number;
}

export interface IntrareIndemnizatieCm {
  /** Certificatele care ating luna calculată, în ordine cronologică. */
  readonly certificate: readonly CertificatMedical[];
  /** Lunile anterioare, cele mai recente PRIMELE. */
  readonly istoric: readonly LunaIstoricCm[];
  readonly salariuMinimBrut: number;
  readonly zileLucratoareLuna: number;
  /** Zile de angajator deja consumate în episodul curent de boală. */
  readonly zileAngajatorDejaConsumate: number;
}

export interface IndemnizatiePeCertificat {
  readonly serie: string;
  readonly numar: string;
  readonly cod: string;
  /** Zile LUCRĂTOARE plătite de firmă — vezi aproximarea (a) și convenția (d). */
  readonly zileAngajator: number;
  /** Zile LUCRĂTOARE plătite din FNUASS. */
  readonly zileFnuass: number;
  readonly sumaAngajator: number;
  readonly sumaFnuass: number;
}

export interface RezultatIndemnizatieCm {
  readonly totalAngajator: number;
  readonly totalFnuass: number;
  readonly total: number;
  /**
   * Cât din indemnizația lunii intră în FIECARE bază, după steagurile codului.
   *
   * Sunt trei numere, nu unul, fiindcă o lună poate purta certificate cu coduri
   * diferite: 10 zile de boală obișnuită (CAS + CASS + impozit) urmate de 5 de
   * risc maternal (doar CAS) dau trei sume distincte. `calc.ts` le adună la
   * bazele lui — aici nu se aplică nicio cotă, fiindcă procentele sunt ale
   * organizației, nu ale nomenclatorului.
   */
  readonly bazaCas: number;
  readonly bazaCass: number;
  readonly bazaImpozit: number;
  readonly bazaZilnica: number;
  readonly bazaZilnicaPlafonata: boolean;
  readonly luniFolosite: number;
  readonly peCertificat: readonly IndemnizatiePeCertificat[];
  readonly probleme: readonly ProblemaEtapa[];
}

/** Zero luni utilizabile în istoric — nu există bază de calcul. */
const FARA_ISTORIC = "SAL_CM_FARA_ISTORIC";
/** Mai puține luni cu zile lucrate decât cere codul. */
const ISTORIC_INCOMPLET = "SAL_CM_ISTORIC_INCOMPLET";
/** Baza zilnică a fost tăiată la plafonul de salarii minime. */
const BAZA_PLAFONATA = "SAL_CM_BAZA_PLAFONATA";
/** Continuare care nu mai primește zile de angajator. */
const ZILE_ANGAJATOR_EPUIZATE = "SAL_CM_ZILE_ANGAJATOR_EPUIZATE";

/** Sumele apar în mesaje ca pe fluturaș: două zecimale, oricât de rotundă e cifra. */
function lei(valoare: number): string {
  return valoare.toFixed(2);
}

const REZULTAT_GOL: RezultatIndemnizatieCm = {
  totalAngajator: 0,
  totalFnuass: 0,
  total: 0,
  bazaCas: 0,
  bazaCass: 0,
  bazaImpozit: 0,
  bazaZilnica: 0,
  bazaZilnicaPlafonata: false,
  luniFolosite: 0,
  peCertificat: [],
  probleme: [],
};

/**
 * Indemnizația de concediu medical pentru certificatele care ating luna
 * calculată, împărțită între angajator și FNUASS.
 *
 * Fără certificate întoarce rezultatul gol, FĂRĂ probleme: nu e o lipsă de
 * date, ci o lună fără concediu medical. Codul de indemnizație — deci și
 * numărul de luni de bază — se află abia din primul certificat, așa că nici
 * lipsa istoricului nu se poate reproșa cuiva înainte de a exista un certificat.
 */
export function calculeazaIndemnizatieCm(intrare: IntrareIndemnizatieCm): RezultatIndemnizatieCm {
  const primul = intrare.certificate[0];
  if (primul === undefined) {
    return REZULTAT_GOL;
  }

  const probleme: ProblemaEtapa[] = [];

  // 1. BAZA DE CALCUL — media pe zi LUCRATĂ, nu pe zi calendaristică.
  //
  // O lună fără zile lucrate (angajare la mijlocul perioadei, concediu fără
  // plată, CM anterior) nu se ia în calcul: ar trage media în jos cu un
  // numitor pe care legea nu-l numără. Se filtrează ÎNAINTE de tăierea la
  // `luniBazaCalcul`, ca să se ajungă tot la 6 luni utile când există.
  const luniCerute = primul.cod.luniBazaCalcul;
  const luniFolosite = intrare.istoric.filter((luna) => luna.zileLucrate > 0).slice(0, luniCerute);

  let bazaZilnicaExacta = 0;
  if (luniFolosite.length === 0) {
    // Se ridică DOAR `FARA_ISTORIC`, nu și `ISTORIC_INCOMPLET`: al doilea ar
    // repeta aceeași informație cu un cod mai slab, iar ecranul le-ar afișa pe
    // amândouă.
    probleme.push({
      cod: FARA_ISTORIC,
      detalii:
        `Codul ${primul.cod.cod} cere media pe ${luniCerute} luni, dar niciuna ` +
        `dintre cele ${intrare.istoric.length} luni din istoric nu are zile lucrate. ` +
        `Baza de calcul și toate sumele sunt zero.`,
    });
  } else {
    if (luniFolosite.length < luniCerute) {
      probleme.push({
        cod: ISTORIC_INCOMPLET,
        detalii:
          `S-au găsit ${luniFolosite.length} luni cu zile lucrate din cele ` +
          `${luniCerute} cerute de codul ${primul.cod.cod}. ` +
          `Media s-a calculat pe lunile găsite.`,
      });
    }
    const venitTotal = luniFolosite.reduce((total, luna) => total + luna.venitBrut, 0);
    const zileLucrateTotal = luniFolosite.reduce((total, luna) => total + luna.zileLucrate, 0);
    // Baza zilnică e o RATĂ, nu o sumă de bani: se păstrează EXACTĂ pentru
    // calcul și se rotunjește doar la raportare. Rotunjită înainte de
    // înmulțirea cu procentul și cu zilele, ar adăuga bani inexistenți pe
    // fiecare certificat. Vezi testul „o RATĂ nu se materializează niciodată în
    // bani" din `src/domain/bani.test.ts`.
    bazaZilnicaExacta = venitTotal / zileLucrateTotal;
  }

  // 2. PLAFONAREA la multiplul de salarii minime, când codul o cere.
  //
  // `zileLucratoareLuna <= 0` ar face împărțirea imposibilă: fără zile
  // lucrătoare nu există plafon zilnic de comparat, așa că se sare peste pas.
  // Nu e un caz real (o lună are întotdeauna zile lucrătoare), dar o intrare
  // greșită nu trebuie să producă `Infinity` în fluturaș.
  let bazaZilnicaPlafonata = false;
  const plafonSalariiMinime = primul.cod.plafonSalariiMinime;
  if (plafonSalariiMinime !== null && intrare.zileLucratoareLuna > 0) {
    const plafonZilnic =
      (plafonSalariiMinime * intrare.salariuMinimBrut) / intrare.zileLucratoareLuna;
    if (bazaZilnicaExacta > plafonZilnic) {
      probleme.push({
        cod: BAZA_PLAFONATA,
        detalii:
          `Baza zilnică de ${lei(bazaZilnicaExacta)} lei a fost redusă la ${lei(plafonZilnic)} lei — ` +
          `plafonul codului ${primul.cod.cod}: ${plafonSalariiMinime} × salariul minim brut ` +
          `de ${lei(intrare.salariuMinimBrut)} lei, împărțit la ${intrare.zileLucratoareLuna} ` +
          `zile lucrătoare.`,
      });
      bazaZilnicaExacta = plafonZilnic;
      bazaZilnicaPlafonata = true;
    }
  }

  // 3+4. PROCENTUL și ÎMPĂRȚIREA PLĂTITORULUI, certificat cu certificat.
  //
  // Contorul e pe EPISOD de boală, nu pe certificat: pornește din ce a mai
  // rămas după zilele consumate înainte de luna asta și scade pe măsură ce se
  // consumă. O CONTINUARE nu-l atinge; un certificat nou (`esteContinuare ===
  // false`) deschide alt episod și îl repornește la `zileAngajator` al codului
  // LUI — coduri diferite au praguri diferite.
  //
  // Pentru PRIMUL certificat contorul e cel moștenit, `zileAngajator -
  // zileAngajatorDejaConsumate`, chiar dacă certificatul nu e continuare: cine
  // a completat `zileAngajatorDejaConsumate` a spus explicit că episodul curent
  // are zile consumate, iar a le ignora ar plăti firma de două ori pentru
  // aceleași zile. Un episod cu adevărat nou se transmite cu
  // `zileAngajatorDejaConsumate: 0`.
  let ramaseAngajator = Math.max(0, primul.cod.zileAngajator - intrare.zileAngajatorDejaConsumate);

  const peCertificat: IndemnizatiePeCertificat[] = [];
  let totalAngajator = 0;
  let totalFnuass = 0;
  let bazaCas = 0;
  let bazaCass = 0;
  let bazaImpozit = 0;

  for (const [indice, certificat] of intrare.certificate.entries()) {
    const cod = certificat.cod;
    if (indice > 0 && !certificat.esteContinuare) {
      ramaseAngajator = cod.zileAngajator;
    }

    let zileCalendaristiceAngajator: number;
    if (cod.platitor === "fnuass") {
      // Firma nu suportă nimic, oricât ar spune `zileAngajator` al codului —
      // accident de muncă, boală profesională, sarcină și lăuzie.
      zileCalendaristiceAngajator = 0;
    } else if (cod.platitor === "angajator") {
      zileCalendaristiceAngajator = Math.max(0, certificat.zileCalendaristice);
    } else {
      zileCalendaristiceAngajator = Math.min(
        ramaseAngajator,
        Math.max(0, certificat.zileCalendaristice),
      );
      if (certificat.esteContinuare && ramaseAngajator <= 0 && certificat.zileCalendaristice > 0) {
        probleme.push({
          cod: ZILE_ANGAJATOR_EPUIZATE,
          detalii:
            `Certificatul ${certificat.serie} ${certificat.numar} este continuare, iar cele ` +
            `${cod.zileAngajator} zile de angajator ale codului ${cod.cod} erau deja ` +
            `consumate în episodul curent. Toate cele ${certificat.zileLucratoare} zile ` +
            `lucrătoare se plătesc din FNUASS.`,
        });
      }
    }
    ramaseAngajator = Math.max(0, ramaseAngajator - zileCalendaristiceAngajator);

    // APROXIMAREA (a): zile calendaristice → zile lucrătoare, proporțional.
    const zileLucratoareCertificat = Math.max(0, certificat.zileLucratoare);
    const zileAngajator =
      certificat.zileCalendaristice > 0
        ? Math.min(
            zileLucratoareCertificat,
            Math.max(
              0,
              Math.round(
                zileLucratoareCertificat *
                  (zileCalendaristiceAngajator / certificat.zileCalendaristice),
              ),
            ),
          )
        : 0;
    const zileFnuass = zileLucratoareCertificat - zileAngajator;

    // Și indemnizația zilnică e o rată: se rotunjește abia la sumele finale.
    const indemnizatieZilnica = (bazaZilnicaExacta * cod.procent) / 100;
    const sumaAngajator = rotunjesteLaBani(indemnizatieZilnica * zileAngajator);
    const sumaFnuass = rotunjesteLaBani(indemnizatieZilnica * zileFnuass);

    totalAngajator += sumaAngajator;
    totalFnuass += sumaFnuass;

    // Indemnizația certificatului intră în bazele pe care le cere CODUL lui.
    // Implicitele urmează majoritatea: CAS și impozit da, CASS nu.
    const brutCertificat = sumaAngajator + sumaFnuass;
    if (cod.retineCas ?? true) bazaCas += brutCertificat;
    if (cod.retineImpozit ?? true) bazaImpozit += brutCertificat;
    if (cod.retineCass ?? false) bazaCass += brutCertificat;

    peCertificat.push({
      serie: certificat.serie,
      numar: certificat.numar,
      cod: cod.cod,
      zileAngajator,
      zileFnuass,
      sumaAngajator,
      sumaFnuass,
    });
  }

  // Totalurile trec încă o dată prin rotunjire: adunarea în virgulă mobilă a
  // unor sume deja rotunjite la ban poate scoate 1799,9999999999998.
  const totalAngajatorRotunjit = rotunjesteLaBani(totalAngajator);
  const totalFnuassRotunjit = rotunjesteLaBani(totalFnuass);

  return {
    totalAngajator: totalAngajatorRotunjit,
    totalFnuass: totalFnuassRotunjit,
    total: rotunjesteLaBani(totalAngajatorRotunjit + totalFnuassRotunjit),
    bazaCas: rotunjesteLaBani(bazaCas),
    bazaCass: rotunjesteLaBani(bazaCass),
    bazaImpozit: rotunjesteLaBani(bazaImpozit),
    bazaZilnica: rotunjesteLaBani(bazaZilnicaExacta),
    bazaZilnicaPlafonata,
    luniFolosite: luniFolosite.length,
    peCertificat,
    probleme,
  };
}
