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
}>;

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
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
  return curat === "" ? "document" : curat;
}

/**
 * Intrare pe care o unealtă refuză s-o transforme în document (un interval de
 * concediu inversat, de exemplu). Ruta o traduce în 400 cu mesajul, nu în 500
 * și nici într-un fișier gata de semnat cu conținut fals.
 */
export class EroareIntrare extends Error {
  override readonly name = "EroareIntrare";
}
