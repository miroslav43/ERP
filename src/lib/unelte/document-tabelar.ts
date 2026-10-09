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
  // „DOCX” sau „ docx ” înseamnă tot Word; până pe 8 oct 2026 primeau tăcut un PDF.
  const format = brut?.trim().toLowerCase();
  return format === "docx" || format === "xlsx" ? format : "pdf";
}

export type Coloana = Readonly<{
  /** Poate conține `\n`: toate randările îl afișează ca rând nou în antet. */
  eticheta: string;
  /** Lățime RELATIVĂ; randările o transformă în procente din lățimea utilă. */
  latime: number;
  /**
   * În PDF, textul lung se rupe pe rânduri și rândul crește, în loc să se taie
   * cu „…”. Fără el, tăierea rămâne (foaia de pontaj ține rânduri de aceeași
   * înălțime). Auditul din 8 oct 2026 a găsit criteriile fișei de evaluare
   * tăiate la ~60 de caractere, sub semnătura angajatului.
   */
  rupe?: boolean;
}>;

/** Text liber după note: titlu, textul completat și rânduri goale de scris de mână. */
export type Rubrica = Readonly<{
  titlu: string;
  /** Poate fi gol; `\n` desparte paragrafele. */
  text: string;
  /** Rândurile goale când `text` e gol; cu text, rămâne unul singur. */
  randuriGoale: number;
}>;

/** Un tabel după cel principal, cu coloanele lui. */
export type TabelSuplimentar = Readonly<{
  titlu: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
}>;

export type DocumentTabelar = Readonly<{
  titlu: string;
  subtitlu: string | null;
  /** Perechi „Angajat: Popa Ion”. Valoare goală = linie de completat de mână. */
  campuri: readonly Readonly<{ eticheta: string; valoare: string }>[];
  /**
   * PDF: câmpurile se așază pe două coloane, de la stânga la dreapta. Pentru
   * antetele lungi (foaia de parcurs are 12), care altfel mănâncă o treime din
   * prima pagină. Lipsă = o coloană, ca până acum.
   */
  campuriPeDouaColoane?: boolean;
  /** Proză înaintea tabelului (corpul unei cereri). Gol pentru formularele tabelare. */
  paragrafe: readonly string[];
  /** Fără coloane, tabelul nu se randează deloc. */
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
  /** Indicii coloanelor umbrite (weekend, sărbători). */
  umbrite: readonly number[];
  /**
   * Tabele mai mici, randate după cel principal și înaintea notelor, fiecare cu
   * titlul și coloanele lui (alimentările și rezumatul foii de parcurs). Fără
   * umbrire. Cheia lipsă = niciun tabel, deci celelalte unelte rămân neatinse.
   */
  tabeleSuplimentare?: readonly TabelSuplimentar[];
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
  /**
   * Înălțimea minimă a unui rând din corpul tabelului, în puncte. Absentă = 16,
   * cât încape un rând de text. Condica o ridică la 22: acolo se semnează de
   * mână pe fiecare rând (auditul din 8 oct 2026 a măsurat 5,6 mm).
   */
  inaltimeRand?: number;
  /**
   * Părțile de după tabelul principal, în ordine. Lipsă = niciuna, deci uneltele
   * care nu le cer ies neschimbate. Le folosește fișa SSM: anexa 11 la HG
   * 1425/2006 are trei puncte de text cu semnături, cinci tabele și două grupuri
   * de casete de viză.
   */
  sectiuni?: readonly Sectiune[];
  /**
   * Rândul de sus de pe paginile 2+ și din antetul Word, când titlul și
   * subtitlul nu spun destul. Fișa SSM pune aici numele lucrătorului: o foaie
   * desprinsă dintr-o fișă de 4 pagini trebuie să poată fi atribuită omului ei
   * (auditul din 8 oct 2026). Lipsă = `titlu · subtitlu`.
   */
  antetRulant?: string;
  /**
   * Rubrici de text liber, după note și înaintea semnăturilor (fișa de
   * evaluare: obiective, plan de dezvoltare, comentariile angajatului).
   */
  rubrici?: readonly Rubrica[];
  /** Sub fiecare semnătură, un rând „Data: ____”. */
  dataLaSemnaturi?: boolean;
}>;

/** Text cu titlu, urmat de rubrici de semnătură etichetate, pe un rând. */
export type SectiuneText = Readonly<{
  tip: "text";
  titlu: string | null;
  paragrafe: readonly string[];
  /** Fiecare etichetă primește o casetă cu loc de semnat sub ea. */
  semnaturi: readonly string[];
}>;

/** Un tabel cu titlul lui; rândurile goale sunt locul de completat de mână. */
export type SectiuneTabel = Readonly<{
  tip: "tabel";
  titlu: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
  /** Ca `inaltimeRand` al documentului, dar doar pentru tabelul ăsta. Lipsă = 16 pt. */
  inaltimeRand?: number;
}>;

/** Casete de viză (medicina muncii, psiholog), câte două pe rând. */
export type SectiuneCasete = Readonly<{
  tip: "casete";
  titlu: string;
  numar: number;
  /** Capul fiecărei casete („Observații de specialitate”). */
  rubrica: string;
  /** Etichetele din josul casetei, de la stânga la dreapta. */
  semnaturi: readonly string[];
  /** Nota de sub casete (asteriscul din anexă), sau `null`. */
  nota: string | null;
}>;

export type Sectiune = SectiuneText | SectiuneTabel | SectiuneCasete;

/** Textul rândului de jos, același în toate formatele. */
export const SEMNATURA_FISIER = "Generat gratuit cu administrativo.ro";

/**
 * Rândul de sus de pe paginile 2+ (PDF) și din antetul Word: o foaie ruptă din
 * teanc spune singură ce lună și ce firmă are.
 */
export function textAntetRulant(d: DocumentTabelar): string {
  if (d.antetRulant !== undefined) return d.antetRulant;
  return d.subtitlu === null ? d.titlu : `${d.titlu} · ${d.subtitlu}`;
}

/** „Pagina 2 din 5”. Un document de o singură pagină nu primește număr. */
export function textPagina(index: number, total: number): string | null {
  return total <= 1 ? null : `Pagina ${String(index + 1)} din ${String(total)}`;
}

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

/**
 * Același document, cu `f` aplicată pe FIECARE text al lui: titlul, câmpurile,
 * proza, etichetele de coloană, celulele, tabelele suplimentare, secțiunile,
 * antetul rulant, notele și semnăturile. Funcție pură.
 *
 * O singură listă a locurilor cu text, folosită de curățare și de glifele PDF:
 * o cheie nouă a modelului (`tabeleSuplimentare`, 8 oct 2026) se adaugă aici o
 * dată, nu în fiecare transformare, unde a doua ar fi uitat-o.
 */
export function mapeazaTexte(d: DocumentTabelar, f: (text: string) => string): DocumentTabelar {
  const coloane = (lista: readonly Coloana[]) =>
    lista.map((c) => ({ ...c, eticheta: f(c.eticheta) }));
  const randuri = (lista: readonly (readonly string[])[]) =>
    lista.map((rand) => rand.map((celula) => f(celula)));
  return {
    ...d,
    titlu: f(d.titlu),
    subtitlu: d.subtitlu === null ? null : f(d.subtitlu),
    campuri: d.campuri.map((c) => ({ eticheta: f(c.eticheta), valoare: f(c.valoare) })),
    paragrafe: d.paragrafe.map((p) => f(p)),
    coloane: coloane(d.coloane),
    randuri: randuri(d.randuri),
    note: d.note.map((n) => f(n)),
    semnaturi: d.semnaturi.map((s) => f(s)),
    // `exactOptionalPropertyTypes`: cheia lipsește, nu e `undefined`.
    ...(d.tabeleSuplimentare === undefined
      ? {}
      : {
          tabeleSuplimentare: d.tabeleSuplimentare.map((t) => ({
            titlu: f(t.titlu),
            coloane: coloane(t.coloane),
            randuri: randuri(t.randuri),
          })),
        }),
    ...(d.sectiuni === undefined ? {} : { sectiuni: d.sectiuni.map((s) => mapeazaSectiune(s, f)) }),
    ...(d.antetRulant === undefined ? {} : { antetRulant: f(d.antetRulant) }),
    ...(d.rubrici === undefined
      ? {}
      : {
          rubrici: d.rubrici.map((r) => ({
            ...r,
            titlu: f(r.titlu),
            text: f(r.text),
          })),
        }),
  };
}

/** O secțiune, cu `f` aplicată pe fiecare text al ei; numerele rămân. */
export function mapeazaSectiune(s: Sectiune, f: (text: string) => string): Sectiune {
  switch (s.tip) {
    case "text":
      return {
        ...s,
        titlu: s.titlu === null ? null : f(s.titlu),
        paragrafe: s.paragrafe.map((p) => f(p)),
        semnaturi: s.semnaturi.map((e) => f(e)),
      };
    case "tabel":
      return {
        ...s,
        titlu: f(s.titlu),
        coloane: s.coloane.map((c) => ({ ...c, eticheta: f(c.eticheta) })),
        randuri: s.randuri.map((rand) => rand.map((celula) => f(celula))),
      };
    case "casete":
      return {
        ...s,
        titlu: f(s.titlu),
        rubrica: f(s.rubrica),
        semnaturi: s.semnaturi.map((e) => f(e)),
        nota: s.nota === null ? null : f(s.nota),
      };
  }
}

/** Același document, cu fiecare text trecut prin `curataText`. Funcție pură. */
export function curataDocument(d: DocumentTabelar): DocumentTabelar {
  return mapeazaTexte(d, curataText);
}

/** O secțiune, cu fiecare text trecut prin `curataText`; numerele rămân. */
export function curataSectiune(s: Sectiune): Sectiune {
  return mapeazaSectiune(s, curataText);
}

/**
 * Intrare pe care o unealtă refuză s-o transforme în document (un interval de
 * concediu inversat, de exemplu). Ruta o traduce în 400 cu mesajul, nu în 500
 * și nici într-un fișier gata de semnat cu conținut fals.
 */
export class EroareIntrare extends Error {
  override readonly name = "EroareIntrare";
}
