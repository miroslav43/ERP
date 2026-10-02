import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

/**
 * Fișa individuală de instruire SSM, după anexa nr. 11 la normele metodologice
 * aprobate prin HG 1425/2006 (forma din Portalul Legislativ, doc. 134138,
 * citită la 2 oct 2026).
 *
 * ── CE E LUAT DIN ANEXĂ ȘI CE NU ──────────────────────────────────────────
 * Antetul (datele lucrătorului), instruirea la angajare în cele trei momente
 * ale ei (introductiv-generală, la locul de muncă, admiterea la lucru) și
 * tabelul instruirilor periodice, cu cele trei semnături, sunt ale anexei.
 *
 * Anexa are tabele separate pentru instruirea periodică și cea periodică
 * suplimentară (art. 98), plus rezultatele testărilor, accidentele și
 * sancțiunile. Modelul comun are un singur tabel, deci periodica și
 * suplimentara stau în același tabel cu o coloană „Tipul”, iar celelalte trei
 * secțiuni sunt numite în notă. Grupa sanguină, cerută de anexă, rămâne linie
 * de completat de mână: formularul public nu cere date despre sănătate.
 */

export type ParametriFisaSsm = Readonly<{
  nume: string;
  functie: string;
  locMunca: string;
  firma: string;
}>;

const text = (v: string | null) => (v ?? "").trim().slice(0, 120);
const LINIE = "__________";
const RANDURI_PERIODICA = 8;
const RANDURI_SUPLIMENTARA = 4;

export function construiesteFisaSsm(o: ParametriFisaSsm): DocumentTabelar {
  const gol = (n: number, tip: string) =>
    Array.from({ length: n }, () => [tip, "", "", "", "", "", "", ""]);
  return {
    titlu: "Fișă de instruire individuală privind securitatea și sănătatea în muncă",
    subtitlu: `Întreprinderea/unitatea: ${o.firma === "" ? LINIE.repeat(2) : o.firma}`,
    campuri: [
      { eticheta: "Numele și prenumele", valoare: o.nume },
      { eticheta: "Legitimația, marca", valoare: "" },
      { eticheta: "Grupa sanguină", valoare: "" },
      { eticheta: "Domiciliul", valoare: "" },
      { eticheta: "Data și locul nașterii", valoare: "" },
      { eticheta: "Calificarea", valoare: "" },
      { eticheta: "Funcția", valoare: o.functie },
      { eticheta: "Locul de muncă", valoare: o.locMunca },
      { eticheta: "Autorizații (ISCIR ș.a.)", valoare: "" },
      { eticheta: "Traseul de deplasare la/de la serviciu", valoare: "" },
    ],
    paragrafe: [
      `Instruirea la angajare. 1) Instruirea introductiv-generală a fost efectuată la data ${LINIE}, timp de ${LINIE} ore, de către ${LINIE.repeat(2)}, având funcția de ${LINIE.repeat(2)}. Conținutul instruirii: ${LINIE.repeat(4)}. Semnătura celui instruit / a celui care a efectuat instruirea / a celui care a verificat însușirea cunoștințelor: ${LINIE} / ${LINIE} / ${LINIE}.`,
      `2) Instruirea la locul de muncă a fost efectuată la data ${LINIE}, loc de muncă/post de lucru ${LINIE.repeat(2)}, timp de ${LINIE} ore, de către ${LINIE.repeat(2)}, având funcția de ${LINIE.repeat(2)}. Conținutul instruirii: ${LINIE.repeat(4)}. Semnăturile: ${LINIE} / ${LINIE} / ${LINIE}.`,
      `3) Admis la lucru. Numele și prenumele ${LINIE.repeat(2)}, funcția (șef secție, atelier, șantier etc.) ${LINIE.repeat(2)}, data și semnătura ${LINIE.repeat(2)}.`,
    ],
    coloane: [
      { eticheta: "Tipul", latime: 2.5 },
      { eticheta: "Data\ninstruirii", latime: 2 },
      { eticheta: "Durata\n(h)", latime: 1.2 },
      { eticheta: "Ocupația", latime: 2.5 },
      { eticheta: "Materialul predat", latime: 6 },
      { eticheta: "Semnătura\ncelui instruit", latime: 2.6 },
      { eticheta: "Semnătura celui\ncare a instruit", latime: 2.6 },
      { eticheta: "Semnătura celui\ncare a verificat", latime: 2.6 },
    ],
    randuri: [...gol(RANDURI_PERIODICA, "Periodică"), ...gol(RANDURI_SUPLIMENTARA, "Suplimentară")],
    umbrite: [],
    note: [
      "Rezultatul instruirii se consemnează obligatoriu în fișă, cu materialul predat, durata și data, cu pix sau stilou, imediat după verificare — art. 81 din normele aprobate prin HG 1425/2006.",
      "Anexa nr. 11 mai cuprinde: rezultatele testărilor, accidentele de muncă sau îmbolnăvirile profesionale suferite și sancțiunile aplicate pentru nerespectarea regulilor SSM.",
    ],
    semnaturi: [],
    orientare: "peisaj",
    numeFisier: `fisa-instruire-ssm-${o.nume === "" ? "necompletata" : o.nume}`,
  };
}

export function parametriFisaSsm(q: URLSearchParams): ParametriFisaSsm {
  return {
    nume: text(q.get("nume")),
    functie: text(q.get("functie")),
    locMunca: text(q.get("loc")),
    firma: text(q.get("firma")),
  };
}

export function fisaSsmDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteFisaSsm(parametriFisaSsm(q));
}

/**
 * Regulile din banda „Când se face fiecare instruire”, cu articolul din normele
 * aprobate prin HG 1425/2006. Minimul de 8 ore apare la toate trei instruirile
 * care îl au în norme — prima variantă îl dădea doar la cea introductiv-generală.
 */
export const INSTRUIRI_SSM = [
  {
    tip: "Cele trei faze",
    regula: "Instruirea SSM are trei faze: introductiv-generală, la locul de muncă și periodică.",
    temei: "art. 77",
  },
  {
    tip: "Introductiv-generală",
    regula:
      "La angajare, cu o durată stabilită prin instrucțiuni proprii, dar nu mai mică de 8 ore.",
    temei: "art. 87 alin. (2)",
  },
  {
    tip: "La locul de muncă",
    regula:
      "După cea introductiv-generală, la postul de lucru, cu o durată stabilită prin instrucțiuni proprii de conducătorul locului de muncă, dar nu mai mică de 8 ore.",
    temei: "art. 92 alin. (2)",
  },
  {
    tip: "Periodică",
    regula:
      "Intervalul dintre două instruiri periodice nu va fi mai mare de 6 luni; pentru personalul tehnico-administrativ, de cel mult 12 luni.",
    temei: "art. 96 alin. (2¹) și (3)",
  },
  {
    tip: "Suplimentară",
    regula:
      "În plus față de cea programată, de cel puțin 8 ore: când lucrătorul a lipsit peste 30 de zile lucrătoare, la reluarea activității după un accident de muncă, la schimbarea echipamentului, a tehnologiei sau a procedurilor de lucru, la lucrări speciale.",
    temei: "art. 98 și 99",
  },
  {
    tip: "Consemnarea",
    regula:
      "Obligatoriu în fișa individuală, cu materialul predat, durata și data; fișa se păstrează de la angajare până la încetarea raporturilor de muncă.",
    temei: "art. 81",
  },
] as const;
