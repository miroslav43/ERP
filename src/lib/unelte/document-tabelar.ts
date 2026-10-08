/**
 * Documentul pe care îl produce orice unealtă gratuită, înainte de format.
 *
 * ── DE CE UN MODEL, NU TREI GENERATOARE PE UNEALTĂ ────────────────────────
 * Șase unelte × trei formate ar fi optsprezece generatoare care se despart la
 * prima corectură: PDF-ul spune „Semnătura”, Word-ul „Semnatura”. Unealta
 * construiește O DATĂ ce conține documentul; randările din același director
 * decid doar cum arată. Previzualizarea HTML citește același obiect, deci ce
 * vede omul pe ecran e ce descarcă.
 */

export type Format = "pdf" | "docx" | "xlsx";

export const FORMATE: readonly Format[] = ["pdf", "docx", "xlsx"];

export function normalizeazaFormat(brut: string | null): Format {
  return brut === "docx" || brut === "xlsx" ? brut : "pdf";
}

export type Coloana = Readonly<{
  /** Poate conține `\n`: toate randările îl afișează ca rând nou în antet. */
  eticheta: string;
  /** Lățime RELATIVĂ; randările o transformă în procente din lățimea utilă. */
  latime: number;
}>;

export type DocumentTabelar = Readonly<{
  titlu: string;
  subtitlu: string | null;
  /** Perechi „Angajat: Popa Ion”. Valoare goală = linie de completat de mână. */
  campuri: readonly Readonly<{ eticheta: string; valoare: string }>[];
  /** Proză înaintea tabelului (corpul unei cereri). Gol pentru formularele tabelare. */
  paragrafe: readonly string[];
  /** Fără coloane, tabelul nu se randează deloc. */
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
  /** Indicii coloanelor umbrite (weekend, sărbători). */
  umbrite: readonly number[];
  note: readonly string[];
  /** Etichetele liniilor de semnătură, de la stânga la dreapta. */
  semnaturi: readonly string[];
  orientare: "portret" | "peisaj";
  /** Fără extensie; trece prin `numeFisierSigur`. */
  numeFisier: string;
  /**
   * Pagina uneltei, fără domeniu (`/unelte/foaie-de-parcurs`). O pune ruta de
   * descărcare; rândul de jos al fișierului devine legătură spre ea.
   */
  sursa?: string;
}>;

/** Textul rândului de jos, același în toate formatele. */
export const SEMNATURA_FISIER = "Generat gratuit cu administrativo.ro";

/**
 * Adresa spre care trimite rândul de jos al fișierului.
 *
 * Fișierele astea se trimit mai departe și se reîncarcă în alte firme; un rând
 * de text simplu nu aducea pe nimeni înapoi (auditul din 7 oct 2026). Parametrii
 * UTM spun în statistici de unde a venit vizita, iar canonicul paginii îi
 * ignoră, deci nu creează adrese noi pentru motoare.
 */
export function adresaDinFisier(d: DocumentTabelar, format: Format, site: string): string {
  const parametri = new URLSearchParams({
    utm_source: "fisier",
    utm_medium: format,
    utm_campaign: "unelte",
  });
  return `${site}${d.sursa ?? "/unelte"}?${parametri.toString()}`;
}

/** Linia de completat de mână, aceeași în toate cele patru randări. */
export const LINIE_GOALA = "______________________________";

/**
 * Numele de fișier pentru `content-disposition`: ASCII, fără ghilimele.
 *
 * `ș` se descompune în NFD în `s` + U+0326 (virgula de dedesubt), care cade în
 * intervalul semnelor combinante — deci „foaie-ș” devine „foaie-s”, nu „foaie-”.
 */
export function numeFisierSigur(baza: string): string {
  const curat = baza
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[^a-zA-Z0-9-]+/gu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
  return curat === "" ? "document" : curat;
}

/** CRLF și CR singur devin LF: singurul rând nou pe care îl înțeleg toate randările. */
const RAND_NOU = /\r\n?/gu;

/**
 * Caractere care, într-un text scris de om, înseamnă „aici e un spațiu”: tabul
 * (o celulă de Excel lipită), tabul vertical U+000B (rândul manual din Word,
 * Shift+Enter), form feed, NEL și separatorii Unicode de rând și de paragraf.
 */
const SPATIU_DE_CONTROL = /[\t\v\f\u{85}\u{2028}\u{2029}]/gu;

/**
 * Ce nu are voie într-un document XML 1.0 (producția `Char`: sub U+0020 doar
 * tab, LF și CR; nici U+FFFE, U+FFFF sau surogate orfane), plus caracterele
 * invizibile care fac dintr-un rând gol un „nume”: spațiile de lățime zero și
 * BOM-ul. C1 (U+0080–U+009F) e permis de XML, dar e mereu gunoi de codificare.
 */
const INTERZISE =
  /[\u0000-\u0008\u000E-\u001F\u007F-\u{84}\u{86}-\u{9F}\u{200B}-\u{200D}\u{2060}\u{FEFF}\u{FFFE}\u{FFFF}]|\p{Cs}/gu;

/**
 * Textul unui câmp, curățat de ce rupe un document.
 *
 * ── DE CE AICI, O DATĂ ────────────────────────────────────────────────────
 * Auditul din 8 oct 2026: un U+000B lipit din Word sau PowerPoint ajungea
 * neschimbat în `word/document.xml`, iar Word refuza fișierul („not
 * well-formed”), pe toate cele șase unelte, cu HTTP 200. exceljs scoate singur
 * controalele C0, dar lipește cuvintele („Condicade prezență”) și lasă U+FFFE și
 * U+FFFF, care rup `sharedStrings.xml` (verificat cu saxes pe 8 oct 2026); PDF-ul
 * punea spații. Curățarea stă AICI și se aplică
 * în `raspunsDocument` și în previzualizare, nu în cele cinci funcții `text()`
 * ale uneltelor, unde a șasea unealtă ar fi uitat-o.
 *
 * Păstrează `\n`: etichetele de coloană îl folosesc intenționat („1\nM”).
 */
export function curataText(text: string): string {
  return text.replace(RAND_NOU, "\n").replace(SPATIU_DE_CONTROL, " ").replace(INTERZISE, "");
}

/** Același document, cu fiecare text trecut prin `curataText`. Funcție pură. */
export function curataDocument(d: DocumentTabelar): DocumentTabelar {
  return {
    ...d,
    titlu: curataText(d.titlu),
    subtitlu: d.subtitlu === null ? null : curataText(d.subtitlu),
    campuri: d.campuri.map((c) => ({
      eticheta: curataText(c.eticheta),
      valoare: curataText(c.valoare),
    })),
    paragrafe: d.paragrafe.map((p) => curataText(p)),
    coloane: d.coloane.map((c) => ({ ...c, eticheta: curataText(c.eticheta) })),
    randuri: d.randuri.map((rand) => rand.map((celula) => curataText(celula))),
    note: d.note.map((n) => curataText(n)),
    semnaturi: d.semnaturi.map((s) => curataText(s)),
  };
}

/**
 * Intrare pe care o unealtă refuză s-o transforme în document (un interval de
 * concediu inversat, de exemplu). Ruta o traduce în 400 cu mesajul, nu în 500
 * și nici într-un fișier gata de semnat cu conținut fals.
 */
export class EroareIntrare extends Error {
  override readonly name = "EroareIntrare";
}
