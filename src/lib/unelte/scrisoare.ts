import type { Format } from "./document-tabelar";
import { faraCaractereDeControl } from "./text-curat";

/**
 * O cerere scrisă ca scrisoare: „Către” în dreapta, „CERERE” centrat, corpul,
 * locul și data în stânga, semnătura în dreapta, iar jos rubrica angajatorului.
 *
 * ── DE CE NU `DocumentTabelar` ─────────────────────────────────────────────
 * `DocumentTabelar` e un formular: titlu la stânga, câmpuri, tabel. Pe el,
 * PDF-ul cererii ieșea cu titlul aliniat la stânga, „Către” gri la 9 pt și
 * locul și data gri la 8 pt, în timp ce previzualizarea arăta o cerere clasică
 * (auditul din 8 oct 2026). Un model propriu, citit de toate trei randările
 * (HTML, PDF, Word), închide diferența: ce e pe ecran e ce se descarcă.
 */
export type RubricaAngajator = Readonly<{
  titlu: string;
  /** Rânduri de completat de angajator: decizia, apoi soldul. */
  randuri: readonly string[];
  /** Semnăturile de aprobare, de la stânga la dreapta. */
  semnaturi: readonly string[];
}>;

export type Scrisoare = Readonly<{
  /** Titlul fișierului, în metadatele PDF și Word. */
  titluDocument: string;
  /** Rândul de înregistrare din colțul din stânga sus. */
  inregistrare: string;
  /** „Către: Firma SRL”, aliniat la dreapta. */
  catre: string;
  /** „CERERE”, centrat. */
  titlu: string;
  /** Ce fel de cerere, sub titlu. */
  subtitlu: string | null;
  paragrafe: readonly string[];
  /** „Arad, 08.10.2026”, în stânga. */
  locSiData: string;
  /** Eticheta semnăturii, în dreapta, deasupra liniei. */
  semnatura: string;
  rubrica: RubricaAngajator | null;
  /** Temeiul, tipărit mic la final. */
  note: readonly string[];
  /** Fără extensie; trece prin `numeFisierSigur`. */
  numeFisier: string;
  /** Pagina uneltei, fără domeniu; subsolul fișierului duce acolo. */
  sursa: string;
}>;

/**
 * Adresa din subsolul fișierului. Aceiași parametri UTM ca `adresaDinFisier`
 * din `document-tabelar.ts`, care însă cere un `DocumentTabelar` întreg.
 */
export function adresaScrisoare(s: Pick<Scrisoare, "sursa">, format: Format, site: string): string {
  const parametri = new URLSearchParams({
    utm_source: "fisier",
    utm_medium: format,
    utm_campaign: "unelte",
  });
  return `${site}${s.sursa}?${parametri.toString()}`;
}

/**
 * Ultima curățare înainte de randare. Câmpurile sunt deja normalizate de
 * unealtă; asta e plasa pentru orice text adăugat în model fără să treacă pe
 * acolo — un singur U+000B face Word-ul de nedeschis.
 */
export function curataScrisoarea(s: Scrisoare): Scrisoare {
  const c = faraCaractereDeControl;
  return {
    ...s,
    titluDocument: c(s.titluDocument),
    inregistrare: c(s.inregistrare),
    catre: c(s.catre),
    titlu: c(s.titlu),
    subtitlu: s.subtitlu === null ? null : c(s.subtitlu),
    paragrafe: s.paragrafe.map(c),
    locSiData: c(s.locSiData),
    semnatura: c(s.semnatura),
    rubrica:
      s.rubrica === null
        ? null
        : {
            titlu: c(s.rubrica.titlu),
            randuri: s.rubrica.randuri.map(c),
            semnaturi: s.rubrica.semnaturi.map(c),
          },
    note: s.note.map(c),
  };
}
