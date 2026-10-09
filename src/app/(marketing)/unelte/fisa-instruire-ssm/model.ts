import { deplaseazaLuna, numarZileLuna, ziIso } from "@/domain/calendar/grila-lunara";
import { formatDate, parseDateRo } from "@/lib/format/date";
import { LINIE_GOALA, type Coloana, type DocumentTabelar } from "@/lib/unelte/document-tabelar";

/**
 * Fișa individuală de instruire SSM, după anexa nr. 11 la normele metodologice
 * aprobate prin HG 1425/2006, în forma consolidată din 7 martie 2022 (Portalul
 * Legislativ, doc. 252029, descărcată cu curl și recitită pe 8 oct 2026; istoricul
 * de consolidări: 27.09.2010, 27.12.2011, 21.10.2016, 07.03.2022 — anexa 11 n-a
 * fost modificată de niciunul dintre actele care au schimbat normele).
 *
 * ── CE E LUAT DIN ANEXĂ ───────────────────────────────────────────────────
 * Toate rubricile, în ordinea anexei: antetul cu datele lucrătorului; instruirea
 * la angajare 1) introductiv-generală, 2) la locul de muncă, 3) admis la lucru;
 * „Instruirea periodică”; „Instruirea periodică suplimentară” (cu „Data
 * efectuării”); „Rezultatele testărilor”; „Accidente de muncă sau îmbolnăviri
 * profesionale suferite”; „Sancțiuni aplicate…”; „CONTROL MEDICAL PERIODIC” și
 * „TESTAREA PSIHOLOGICĂ PERIODICĂ”, câte șase casete.
 *
 * Până pe 8 oct 2026 fișa avea doar primele trei, iar periodica și suplimentara
 * stăteau în același tabel. Art. 89 alin. (2) lit. a) cere ca rezultatul
 * testului de la angajare să se consemneze „în fișa de instruire individuală,
 * conform modelului prevăzut în anexa nr. 11”, deci fișa trebuie să aibă rubrica.
 *
 * ── CE NU SE CERE ÎN FORMULAR ─────────────────────────────────────────────
 * Grupa sanguină (dată despre sănătate, art. 9 GDPR), domiciliul, data și locul
 * nașterii rămân linii de completat de mână: formularul e GET, deci valorile ar
 * sta în adresă. CNP-ul nu e o rubrică a anexei și nu apare deloc.
 *
 * ── CE DECIDE OMUL ────────────────────────────────────────────────────────
 * Câte rânduri de instruire periodică: periodicitatea × anii acoperiți. Restul
 * tabelelor au numărul de rânduri din anexă; casetele medicale și psihologice
 * cresc cu anii (una pe an, cel puțin șase).
 */

export const PERIODICITATI = {
  lunara: { eticheta: "lunară", luni: 1 },
  trimestriala: { eticheta: "trimestrială", luni: 3 },
  semestriala: { eticheta: "semestrială (cel mult 6 luni)", luni: 6 },
  anuala: { eticheta: "anuală (doar personal tehnico-administrativ)", luni: 12 },
} as const;

export type Periodicitate = keyof typeof PERIODICITATI;

export const ANI_ACOPERITI = [1, 2, 3, 5, 10] as const;

export const PERIODICITATE_IMPLICITA: Periodicitate = "semestriala";
export const ANI_IMPLICITI = 5;

/** Câte rânduri are fiecare tabel în anexa 11 (în afară de periodică, care crește cu anii). */
export const RANDURI_ANEXA = { suplimentara: 6, testari: 5, accidente: 5, sanctiuni: 5 } as const;
/** Casetele de control medical și de testare psihologică: șase în anexă. */
export const CASETE_ANEXA = 6;
/** Rând de tabel cât să încapă o semnătură de mână: 28 pt ≈ 9,9 mm. */
export const INALT_RAND_FISA = 28;

export type ParametriFisaSsm = Readonly<{
  nume: string;
  marca: string;
  calificare: string;
  functie: string;
  locMunca: string;
  firma: string;
  /** Instruirea introductiv-generală: ziua ISO, orele, cine a făcut-o. */
  dataIg: string | null;
  oreIg: number | null;
  instructorIg: string;
  functieIg: string;
  /** Instruirea la locul de muncă. */
  dataLm: string | null;
  oreLm: number | null;
  instructorLm: string;
  functieLm: string;
  /** Cine admite la lucru (art. 94: șeful ierarhic al celui care a instruit). */
  admisNume: string;
  admisFunctie: string;
  periodicitate: Periodicitate;
  ani: number;
}>;

const text = (v: string | null) => (v ?? "").trim().slice(0, 120);
const LINIE = "__________";
/** Un rând întreg de scris de mână, cât lățimea utilă a unui A4 portret la 9–10 pt. */
const RAND_DE_SCRIS = `${LINIE_GOALA} ${LINIE_GOALA} ${LINIE_GOALA}`;
const sauLinie = (v: string, linie = LINIE) => (v === "" ? linie : v);

/** Ziua din `<input type="date">` (2026-10-08) sau scrisă de mână (08.10.2026); altfel `null`. */
function ziua(v: string | null): string | null {
  const brut = (v ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(brut);
  return iso === null ? parseDateRo(brut) : parseDateRo(`${iso[3]}.${iso[2]}.${iso[1]}`);
}

/** Ore întregi între 1 și 40: art. 80¹ cere cel puțin o oră pe fiecare fază. */
function ore(v: string | null): number | null {
  const brut = (v ?? "").trim();
  if (!/^\d{1,2}$/u.test(brut)) return null;
  const n = Number(brut);
  return n >= 1 && n <= 40 ? n : null;
}

function periodicitate(v: string | null): Periodicitate {
  return v !== null && Object.hasOwn(PERIODICITATI, v)
    ? (v as Periodicitate)
    : PERIODICITATE_IMPLICITA;
}

function ani(v: string | null): number {
  const n = Number(v);
  return (ANI_ACOPERITI as readonly number[]).includes(n) ? n : ANI_IMPLICITI;
}

export function parametriFisaSsm(q: URLSearchParams): ParametriFisaSsm {
  return {
    nume: text(q.get("nume")),
    marca: text(q.get("marca")),
    calificare: text(q.get("calificare")),
    functie: text(q.get("functie")),
    locMunca: text(q.get("loc")),
    firma: text(q.get("firma")),
    dataIg: ziua(q.get("data_ig")),
    oreIg: ore(q.get("ore_ig")),
    instructorIg: text(q.get("instructor_ig")),
    functieIg: text(q.get("functie_ig")),
    dataLm: ziua(q.get("data_lm")),
    oreLm: ore(q.get("ore_lm")),
    instructorLm: text(q.get("instructor_lm")),
    functieLm: text(q.get("functie_lm")),
    admisNume: text(q.get("admis_nume")),
    admisFunctie: text(q.get("admis_functie")),
    periodicitate: periodicitate(q.get("periodicitate")),
    ani: ani(q.get("ani")),
  };
}

/** Rândurile de instruire periodică: câte instruiri încap în anii aleși. */
export function randuriPeriodice(p: Periodicitate, numarAni: number): number {
  return (12 / PERIODICITATI[p].luni) * numarAni;
}

/** O casetă pe an, cel puțin cele șase din anexă, număr par (două pe rând). */
export function caseteViza(numarAni: number): number {
  const n = Math.max(CASETE_ANEXA, numarAni);
  return n % 2 === 0 ? n : n + 1;
}

/**
 * Termenele-limită ale instruirilor periodice, socotite de la ziua `start`
 * (ISO): fiecare e cu `luni` mai târziu decât precedentul. 31 august + 6 luni
 * cade pe ultima zi a lui februarie, nu pe 3 martie: intervalul e un maxim.
 */
export function scadentePeriodice(start: string, luni: number, numar: number): readonly string[] {
  const [an, luna, zi] = start.split("-").map(Number);
  if (an === undefined || luna === undefined || zi === undefined) return [];
  return Array.from({ length: numar }, (_, k) => {
    const tinta = deplaseazaLuna(an, luna, (k + 1) * luni);
    return ziIso(tinta.an, tinta.luna, Math.min(zi, numarZileLuna(tinta.an, tinta.luna)));
  });
}

const COLOANE_INSTRUIRE = (primaColoana: string): readonly Coloana[] => [
  { eticheta: primaColoana, latime: 2.2 },
  { eticheta: "Durata\n(h)", latime: 1.4 },
  { eticheta: "Ocupația", latime: 3 },
  { eticheta: "Materialul predat", latime: 4.2 },
  { eticheta: "Semnătura\ncelui\ninstruit", latime: 2.4 },
  { eticheta: "Semnătura\ncelui care\na instruit", latime: 2.4 },
  { eticheta: "Semnătura\ncelui care\na verificat", latime: 2.4 },
];

const SEMNATURI_ANGAJARE = [
  "Semnătura celui instruit",
  "Semnătura celui care a efectuat instruirea",
  "Semnătura celui care a verificat însușirea cunoștințelor",
] as const;

const goale = (n: number, coloane: number, prima: readonly string[] = []) =>
  Array.from({ length: n }, () => [
    ...prima,
    ...Array.from({ length: coloane - prima.length }, () => ""),
  ]);

export function construiesteFisaSsm(o: ParametriFisaSsm): DocumentTabelar {
  const data = (v: string | null) => (v === null ? LINIE : formatDate(v));
  const nrOre = (v: number | null) => (v === null ? LINIE : String(v));
  // Ocupația se scrie în a treia coloană a fiecărui rând; restul rămâne de completat.
  const randInstruire = (n: number) => goale(n, 7, o.functie === "" ? [] : ["", "", o.functie]);
  const casete = caseteViza(o.ani);
  return {
    titlu: "Fișă de instruire individuală privind securitatea și sănătatea în muncă",
    subtitlu: `Întreprinderea/unitatea: ${o.firma === "" ? LINIE.repeat(2) : o.firma}`,
    campuri: [
      { eticheta: "Numele și prenumele", valoare: o.nume },
      { eticheta: "Legitimația, marca", valoare: o.marca },
      { eticheta: "Grupa sanguină", valoare: "" },
      { eticheta: "Domiciliul", valoare: "" },
      { eticheta: "Data și locul nașterii", valoare: "" },
      { eticheta: "Calificarea", valoare: o.calificare },
      { eticheta: "Funcția", valoare: o.functie },
      { eticheta: "Locul de muncă", valoare: o.locMunca },
      { eticheta: "Autorizații (ISCIR ș.a.)", valoare: "" },
      { eticheta: "Traseul de deplasare la/de la serviciu", valoare: "" },
    ],
    paragrafe: [],
    coloane: [],
    randuri: [],
    umbrite: [],
    sectiuni: [
      {
        tip: "text",
        titlu: "Instruirea la angajare",
        paragrafe: [
          `1) Instruirea introductiv-generală a fost efectuată la data ${data(o.dataIg)}, timp de ${nrOre(o.oreIg)} ore, de către ${sauLinie(o.instructorIg, LINIE.repeat(2))}, având funcția de ${sauLinie(o.functieIg, LINIE.repeat(2))}.`,
          "Conținutul instruirii:",
          RAND_DE_SCRIS,
          RAND_DE_SCRIS,
        ],
        semnaturi: SEMNATURI_ANGAJARE,
      },
      {
        tip: "text",
        titlu: null,
        paragrafe: [
          `2) Instruirea la locul de muncă a fost efectuată la data ${data(o.dataLm)}, loc de muncă/post de lucru ${sauLinie(o.locMunca, LINIE.repeat(2))}, timp de ${nrOre(o.oreLm)} ore, de către ${sauLinie(o.instructorLm, LINIE.repeat(2))}, având funcția de ${sauLinie(o.functieLm, LINIE.repeat(2))}.`,
          "Conținutul instruirii:",
          RAND_DE_SCRIS,
          RAND_DE_SCRIS,
        ],
        semnaturi: SEMNATURI_ANGAJARE,
      },
      {
        tip: "text",
        titlu: null,
        paragrafe: [
          `3) Admis la lucru. Numele și prenumele ${sauLinie(o.admisNume, LINIE.repeat(2))}, funcția (șef secție, atelier, șantier etc.) ${sauLinie(o.admisFunctie, LINIE.repeat(2))}, data și semnătura ${LINIE.repeat(2)}.`,
        ],
        semnaturi: [],
      },
      {
        tip: "tabel",
        titlu: "Instruirea periodică",
        coloane: COLOANE_INSTRUIRE("Data\ninstruirii"),
        randuri: randInstruire(randuriPeriodice(o.periodicitate, o.ani)),
        inaltimeRand: INALT_RAND_FISA,
      },
      {
        tip: "tabel",
        titlu: "Instruirea periodică suplimentară",
        coloane: COLOANE_INSTRUIRE("Data\nefectuării"),
        randuri: randInstruire(RANDURI_ANEXA.suplimentara),
        inaltimeRand: INALT_RAND_FISA,
      },
      {
        tip: "tabel",
        titlu: "Rezultatele testărilor",
        coloane: [
          { eticheta: "Data", latime: 2.2 },
          { eticheta: "Materialul examinat", latime: 8 },
          { eticheta: "Calificativ", latime: 3 },
          { eticheta: "Examinator", latime: 4.8 },
        ],
        randuri: goale(RANDURI_ANEXA.testari, 4),
        inaltimeRand: INALT_RAND_FISA,
      },
      {
        tip: "tabel",
        titlu: "Accidente de muncă sau îmbolnăviri profesionale suferite",
        coloane: [
          { eticheta: "Data producerii\nevenimentului", latime: 3.4 },
          { eticheta: "Diagnosticul medical", latime: 6.4 },
          { eticheta: "Nr. și data PV de\ncercetare a evenimentului", latime: 4.6 },
          { eticheta: "Nr. zile\nITM", latime: 1.6 },
        ],
        randuri: goale(RANDURI_ANEXA.accidente, 4),
        inaltimeRand: INALT_RAND_FISA,
      },
      {
        tip: "tabel",
        titlu:
          "Sancțiuni aplicate pentru nerespectarea reglementărilor de securitate și sănătate în muncă",
        coloane: [
          { eticheta: "Abaterea săvârșită", latime: 7 },
          { eticheta: "Sancțiunea administrativă", latime: 5 },
          { eticheta: "Nr. și data deciziei", latime: 4 },
        ],
        randuri: goale(RANDURI_ANEXA.sanctiuni, 3),
        inaltimeRand: INALT_RAND_FISA,
      },
      {
        tip: "casete",
        titlu: "Control medical periodic",
        numar: casete,
        rubrica: "Observații de specialitate",
        semnaturi: ["Semnătura și parafa medicului de medicina muncii", "Data vizei"],
        nota: null,
      },
      {
        tip: "casete",
        titlu: "Testarea psihologică periodică",
        numar: casete,
        rubrica: "Apt psihologic pentru:*",
        semnaturi: ["Semnătura psihologului", "Data"],
        nota: "* lucru la înălțime, lucru în condiții de izolare, conducători auto etc.",
      },
    ],
    note: [
      "Fișa se completează olograf sau electronic, imediat după verificarea instruirii, și se semnează de lucrătorul instruit și de persoanele care au efectuat și au verificat instruirea — art. 81 alin. (2)–(3¹) din normele aprobate prin HG 1425/2006.",
      "Se păstrează la conducătorul locului de muncă, însoțită de o copie a ultimei fișe de aptitudini de la medicina muncii, de la angajare până la încetarea raporturilor de muncă — art. 81 alin. (4)–(5).",
    ],
    semnaturi: [],
    orientare: "portret",
    numeFisier: `fisa-instruire-ssm-${o.nume === "" ? "necompletata" : o.nume}`,
    antetRulant: `Fișă de instruire individuală SSM — ${o.nume === "" ? `Numele și prenumele: ${LINIE_GOALA}` : o.nume}${o.firma === "" ? "" : ` — ${o.firma}`}`,
  };
}

export function fisaSsmDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteFisaSsm(parametriFisaSsm(q));
}

/**
 * Regulile din banda „Ce spun normele”, cu articolul din normele aprobate prin
 * HG 1425/2006 (forma consolidată din 07.03.2022, doc. 252029, recitită pe 8 oct
 * 2026). Durata minimă e o oră pe fiecare fază și pe instruirea suplimentară
 * (art. 80¹, din HG 767/2016); restul o stabilește angajatorul, prin programul
 * de instruire-testare.
 */
export const INSTRUIRI_SSM = [
  {
    tip: "Cele trei faze",
    regula: "Instruirea SSM are trei faze: introductiv-generală, la locul de muncă și periodică.",
    cine: "Angajatorul răspunde de toate trei și are programe de instruire-testare pe meserii și activități.",
    temei: "art. 77 și 80",
  },
  {
    tip: "Introductiv-generală",
    regula:
      "La angajare, la detașare, la delegare și la lucrătorul temporar. Durata o stabilește angajatorul prin programul de instruire-testare, după riscurile firmei, dar nu poate fi mai mică de o oră. Se încheie cu un test, iar cine nu și-a însușit cunoștințele nu poate fi angajat.",
    cine: "Angajatorul care și-a asumat atribuțiile SSM, lucrătorul desemnat sau serviciul intern ori extern de prevenire și protecție; individual sau în grupe de cel mult 20 de persoane.",
    temei: "art. 80¹, 83, 85–87 și 89",
  },
  {
    tip: "La locul de muncă",
    regula:
      "După cea introductiv-generală, la postul de lucru, și din nou la schimbarea locului de muncă în firmă. Durata o stabilește angajatorul împreună cu conducătorul locului de muncă, cu lucrătorul desemnat sau cu serviciul de prevenire și protecție, dar nu mai puțin de o oră. Cuprinde obligatoriu demonstrații practice.",
    cine: "Conducătorul direct al locului de muncă, în grupe de cel mult 20 de persoane.",
    temei: "art. 80¹, 90–93",
  },
  {
    tip: "Admiterea la lucru",
    regula:
      "Lucrătorul începe efectiv lucrul abia după ce i se verifică însușirea cunoștințelor, iar verificarea se consemnează în fișă.",
    cine: "Șeful ierarhic superior celui care a făcut instruirea la locul de muncă.",
    temei: "art. 94",
  },
  {
    tip: "Periodică",
    regula:
      "Intervalul dintre două instruiri periodice nu va fi mai mare de 6 luni; pentru personalul tehnico-administrativ, de cel mult 12 luni. Intervalul exact și periodicitatea verificării le stabilește programul de instruire-testare. Se completează obligatoriu cu demonstrații practice.",
    cine: "Conducătorul locului de muncă. O verifică șeful lui ierarhic și, prin sondaj, angajatorul sau serviciul de prevenire, care semnează fișa.",
    temei: "art. 96",
  },
  {
    tip: "Suplimentară",
    regula:
      "În plus față de cea programată, de cel puțin o oră: când lucrătorul a lipsit peste 30 de zile lucrătoare; când s-au schimbat prevederile SSM sau instrucțiunile proprii, inclusiv din cauza evoluției riscurilor ori a unor riscuri noi; la reluarea lucrului după un accident de muncă; la lucrări speciale; la un echipament de muncă nou sau modificat; la tehnologii sau proceduri de lucru modificate ori noi.",
    cine: "Conducătorul locului de muncă, fiindcă e tot o instruire periodică. Durata o stabilește angajatorul, cu conducătorul locului de muncă, lucrătorul desemnat sau serviciul de prevenire și protecție.",
    temei: "art. 80¹, 96 alin. (1), 98 lit. a)–g) și 99",
  },
  {
    tip: "Consemnarea",
    regula:
      "Obligatoriu în fișa individuală, pe hârtie sau în format electronic, cu materialul predat, durata și data. Se completează imediat după verificarea instruirii și o semnează lucrătorul instruit și cei care au efectuat și au verificat instruirea.",
    cine: "Fișa o păstrează conducătorul locului de muncă, însoțită de o copie a ultimei fișe de aptitudini de la medicina muncii, de la angajare până la încetarea raporturilor de muncă.",
    temei: "art. 81 alin. (1)–(5)",
  },
  {
    tip: "Formatul electronic",
    regula:
      "Din martie 2022, fișa se poate ține electronic, semnată olograf sau cu semnătură electronică, avansată ori calificată, cum stabilește regulamentul intern. Procedura semnăturii electronice se trece în contractul individual de muncă, iar angajatorul asigură trasabilitatea și integritatea materialelor fiecărei instruiri electronice. Când instruirea se face electronic, fișa o semnează electronic toți cei implicați.",
    cine: "Angajatorul alege varianta prin regulamentul intern.",
    temei: "art. 81 alin. (3¹)–(3³) și 81¹ (HG 259/2022)",
  },
] as const;
