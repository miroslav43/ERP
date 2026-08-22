// src/domain/payroll/erori.ts
//
// Catalogul problemelor de CALCUL ale salarizării. Modul PUR — fără import din
// `next`, `lib/supabase` sau ceasul de sistem — ca să fie folosibil deopotrivă
// în motorul de calcul, în Server Actions, în ecranul de perioadă și în
// componenta de fluturaș montată în portal.
//
// Distincția față de `src/app/(app)/salarizare/erori.ts`: acela traduce coduri
// POSTGRES (o scriere respinsă de bază). Acesta descrie situații pe care baza
// le acceptă fără să clipească, dar care fac cifra greșită sau incompletă —
// clasa de defecte care a scăpat repetat în acest proiect fiindcă nu produce
// nicio eroare.
//
// Textul fix (mesaj, cauză, reparare) trăiește în catalog, o singură dată.
// CIFRELE vin per instanță, în `detalii` — ele se pot afla doar din date.
//
// Catalogul crește pe faze: aici sunt codurile care au deja un emitent real.
// Un cod fără emitent e cod mort și nu se poate testa, deci nu se declară în
// avans; se adaugă în faza care îl ridică.

export type SeveritateProblema = "blocant" | "avertisment" | "informativ";

export const CODURI_PROBLEMA = [
  "SAL_TRUNCHIERE_CITIRE",
  "SAL_CONTRACT_LIPSA",
  "SAL_NORMA_INVALIDA",
  "SAL_ZILE_PESTE_LUNA",
  "SAL_CONTRACT_SCHIMBAT_IN_LUNA",
  "SAL_SPOR_SARBATOARE_NECONFIGURAT",
  "SAL_SPOR_REPAUS_NECONFIGURAT",
  "SAL_TICHETE_REGIM_NECONFIRMAT",
  "SAL_CAS_LA_MINIM",
  "SAL_AVANTAJ_NATURA_PESTE_NET",
  "SAL_CM_NECALCULAT",
  "SAL_CO_BAZA_SIMPLIFICATA",
  "SAL_SCUTIRE_FARA_PROCENT",
  "SAL_SCUTIRI_MULTIPLE",
  "SAL_RETINERE_PLAFONATA",
] as const;

export type CodProblema = (typeof CODURI_PROBLEMA)[number];

export interface ProblemaSalarizare {
  readonly cod: CodProblema;
  readonly severitate: SeveritateProblema;
  /** Ce s-a întâmplat. Propoziție completă, în română, terminată cu punct. */
  readonly mesaj: string;
  /** Cifrele cazului: sume, zile, luni, nume. `null` când problema nu are cifre. */
  readonly detalii: string | null;
  /** De ce s-a întâmplat — cauza, nu simptomul. */
  readonly cauza: string;
  /** Pasul concret de reparare. */
  readonly cumSeRepara: string;
  /** Ruta ecranului care repară, sau `null` dacă reparația e în afara aplicației. */
  readonly unde: string | null;
  /** Angajatul vizat, când problema e nominală. */
  readonly employeeId: string | null;
}

type IntrareCatalog = Omit<ProblemaSalarizare, "cod" | "detalii" | "employeeId">;

const CATALOG: Readonly<Record<CodProblema, IntrareCatalog>> = {
  SAL_TRUNCHIERE_CITIRE: {
    severitate: "blocant",
    mesaj: "Datele citite din baza de date au fost trunchiate, deci calculul ar fi incomplet.",
    cauza:
      "Interfața de date întoarce cel mult 1000 de rânduri pe cerere și taie restul fără să semnaleze nimic. O citire care se oprește exact la limită înseamnă că sigur au mai fost rânduri.",
    cumSeRepara:
      "Nu aprobați perioada. Semnalați problema — citirea trebuie paginată; până atunci, cifrele calculate nu sunt de încredere.",
    unde: null,
  },
  SAL_CONTRACT_LIPSA: {
    severitate: "blocant",
    mesaj: "Angajatul este activ, dar nu are niciun contract de muncă activ în luna calculată.",
    cauza:
      "Salariul de bază se citește din contract. Fără contract activ nu există nicio sumă de la care să pornească calculul.",
    cumSeRepara:
      "Adăugați contractul de muncă pe fișa angajatului, sau schimbați-i starea dacă nu mai lucrează în firmă.",
    unde: "/angajati",
  },
  SAL_NORMA_INVALIDA: {
    severitate: "blocant",
    mesaj: "Norma de lucru a angajatului nu este validă pentru calcul.",
    cauza:
      "Tariful orar se obține împărțind salariul la zile lucrătoare × ore pe zi. O normă zero sau negativă face împărțirea imposibilă.",
    cumSeRepara: "Corectați norma zilnică din contractul de muncă al angajatului.",
    unde: "/angajati",
  },
  SAL_ZILE_PESTE_LUNA: {
    severitate: "blocant",
    mesaj:
      "Zilele plătite depășesc zilele lucrătoare ale lunii, deci pontajul și concediile se suprapun.",
    cauza:
      "Aceeași zi apare și ca zi lucrată, și ca zi de concediu — de regulă după o cerere de concediu aprobată peste un pontaj deja completat manual.",
    cumSeRepara:
      "Deschideți pontajul lunii, rulați sincronizarea cu concediile și verificați zilele în conflict.",
    unde: "/pontaj",
  },
  SAL_CONTRACT_SCHIMBAT_IN_LUNA: {
    severitate: "avertisment",
    mesaj:
      "Termenii contractului s-au schimbat pe parcursul lunii, iar luna nu a fost împărțită pe intervale.",
    cauza:
      "Un act adițional a intrat în vigoare la mijlocul lunii. Calculul folosește termenii valabili în ultima zi, deci îi aplică întregii luni.",
    cumSeRepara:
      "Verificați cu contabilul dacă diferența trebuie corectată manual pentru zilele dinaintea actului adițional.",
    unde: "/angajati",
  },
  SAL_SPOR_SARBATOARE_NECONFIGURAT: {
    severitate: "avertisment",
    mesaj:
      "S-a lucrat în zile de sărbătoare legală, dar nu există un procent de spor configurat separat pentru ele.",
    cauza:
      "Setările de salarizare au un singur procent pentru zilele de repaus. Sporul distinct de sărbătoare legală se configurează în setările de pontaj, care încă nu alimentează calculul.",
    cumSeRepara:
      "Orele au fost plătite cu sporul de repaus, ca să nu rămână neplătite. Verificați cu contabilul dacă procentul aplicat e cel corect pentru sărbători.",
    unde: "/salarizare/setari",
  },
  SAL_SPOR_REPAUS_NECONFIGURAT: {
    severitate: "avertisment",
    mesaj:
      "S-a lucrat în zile de repaus sau de sărbătoare, dar sporul configurat pentru ele este zero.",
    cauza:
      "Procentul de spor din setările de salarizare a rămas pe valoarea implicită. Orele au fost plătite la tariful orar simplu, fără niciun spor.",
    cumSeRepara:
      "Configurați procentul de spor pentru zilele de repaus în setările de salarizare, apoi recalculați perioada.",
    unde: "/salarizare/setari",
  },
  SAL_TICHETE_REGIM_NECONFIRMAT: {
    severitate: "informativ",
    mesaj: "Regimul fiscal al tichetelor de masă nu a fost confirmat de contabil.",
    cauza:
      "Tichetele nu intră în baza de pensie, dar pot intra în cea de sănătate — regula s-a schimbat de mai multe ori în ultimii ani. Motorul aplică setarea curentă, oricare ar fi ea.",
    cumSeRepara:
      "Confirmați cu contabilul dacă tichetele se supun CASS, potriviți comutatorul din setările de salarizare și bifați setările ca verificate.",
    unde: "/salarizare/setari",
  },
  SAL_CAS_LA_MINIM: {
    severitate: "informativ",
    mesaj: "Baza de contribuții a fost ridicată la salariul minim.",
    cauza:
      "Venitul brut al lunii e sub salariul minim, iar contribuțiile se calculează cel puțin la acesta.",
    cumSeRepara:
      "Verificați dacă angajatul se încadrează într-o excepție legală (elev sau student sub 26 de ani, pensionar, persoană cu handicap, cumul de contracte). Excepțiile nu sunt încă înregistrate în aplicație, deci motorul nu le poate aplica singur.",
    unde: "/angajati",
  },
  SAL_AVANTAJ_NATURA_PESTE_NET: {
    severitate: "avertisment",
    mesaj: "Avantajele primite în natură depășesc netul rămas de virat.",
    cauza:
      "Valoarea avantajelor intră în brut și se impozitează, apoi se scade din suma virată. Când depășește netul, nu mai rămâne nimic de plătit și diferența nu poate fi reținută dintr-o sumă inexistentă.",
    cumSeRepara:
      "Verificați evaluarea avantajelor pe fișa angajatului. Diferența trebuie recuperată separat, nu prin restul de plată.",
    unde: "/angajati",
  },
  SAL_CM_NECALCULAT: {
    severitate: "avertisment",
    mesaj: "Zilele de concediu medical nu sunt incluse în acest calcul.",
    cauza:
      "Indemnizația de concediu medical are bază de calcul proprie (media pe mai multe luni) și un plătitor care se împarte între firmă și fondul de sănătate. Motorul nu o calculează încă.",
    cumSeRepara:
      "Zilele medicale au fost scoase din zilele plătite. Indemnizația se calculează separat, prin contabil, până când modulul o acoperă.",
    unde: "/concedii",
  },
  SAL_CO_BAZA_SIMPLIFICATA: {
    severitate: "avertisment",
    mesaj:
      "Indemnizația de concediu de odihnă a fost plătită la rata zilnică a salariului de bază.",
    cauza:
      "Legea cere media zilnică a drepturilor salariale din ultimele trei luni, comparată cu salariul curent, în varianta mai avantajoasă pentru angajat. Motorul aplică deocamdată doar salariul curent.",
    cumSeRepara:
      "Dacă angajatul a avut sporuri permanente în ultimele trei luni, verificați manual cu contabilul dacă suma i se cuvine mai mare.",
    unde: null,
  },
  SAL_SCUTIRE_FARA_PROCENT: {
    severitate: "avertisment",
    mesaj: "Angajatul are o scutire fiscală activă fără procent configurat.",
    cauza:
      "Procentul scutirii este opțional pe fișa angajatului. Lipsa lui nu se interpretează ca scutire totală — ar fi o presupunere costisitoare.",
    cumSeRepara: "Completați procentul scutirii pe fișa angajatului, apoi recalculați perioada.",
    unde: "/angajati",
  },
  SAL_SCUTIRI_MULTIPLE: {
    severitate: "avertisment",
    mesaj: "Angajatul are mai multe scutiri fiscale active în aceeași lună.",
    cauza:
      "Scutirile au fost însumate. Nu toate facilitățile fiscale se pot cumula legal, iar regula diferă de la una la alta.",
    cumSeRepara:
      "Verificați cu contabilul dacă scutirile se pot cumula; dacă nu, închideți-o pe cea care nu se aplică.",
    unde: "/angajati",
  },
  SAL_RETINERE_PLAFONATA: {
    severitate: "avertisment",
    mesaj: "O reținere a fost plafonată și nu s-a aplicat integral.",
    cauza:
      "Reținerile nu pot depăși partea din salariul net permisă de lege, iar ce rămâne din net trebuie să acopere reținerea.",
    cumSeRepara:
      "Diferența rămâne de reținut în lunile următoare. Verificați dacă suma reportată e urmărită corect.",
    unde: "/salarizare",
  },
};

const ORDINE: Readonly<Record<SeveritateProblema, number>> = {
  blocant: 0,
  avertisment: 1,
  informativ: 2,
};

/**
 * Construiește o problemă din catalog, adăugându-i cifrele cazului.
 *
 * `detalii` e singura parte care nu poate fi scrisă în avans: „3 din 6 luni",
 * „1.240,00 lei plafonați la 980,00 lei", numele angajatului.
 */
export function problema(
  cod: CodProblema,
  optiuni: Readonly<{ detalii?: string | null; employeeId?: string | null }> = {},
): ProblemaSalarizare {
  const intrare = CATALOG[cod];
  return {
    cod,
    severitate: intrare.severitate,
    mesaj: intrare.mesaj,
    detalii: optiuni.detalii ?? null,
    cauza: intrare.cauza,
    cumSeRepara: intrare.cumSeRepara,
    unde: intrare.unde,
    employeeId: optiuni.employeeId ?? null,
  };
}

export function esteBlocanta(p: ProblemaSalarizare): boolean {
  return p.severitate === "blocant";
}

export function areBlocante(probleme: readonly ProblemaSalarizare[]): boolean {
  return probleme.some(esteBlocanta);
}

/** Blocantele primele, apoi avertismentele, apoi informativele. Stabilă în rest. */
export function sorteazaProbleme(
  probleme: readonly ProblemaSalarizare[],
): readonly ProblemaSalarizare[] {
  return [...probleme].sort((a, b) => ORDINE[a.severitate] - ORDINE[b.severitate]);
}

/**
 * Textul complet, așa cum îl citește utilizatorul: ce s-a întâmplat, cu ce
 * cifre, din ce cauză și ce are de făcut. Un singur loc care decide ordinea,
 * ca toate ecranele să spună la fel.
 */
export function descriereCompleta(p: ProblemaSalarizare): string {
  const parti = [p.mesaj, p.detalii, p.cauza, p.cumSeRepara];
  return parti.filter((parte): parte is string => parte !== null && parte.length > 0).join(" ");
}
