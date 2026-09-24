// src/lib/documents/bloc-firma.ts
// Blocul de identificare a firmei emitente, compus o singură dată pentru toate
// documentele oficiale: contract, fișa postului, anexe, adeverințe, fluturași,
// state de plată.
//
// ── CE CERE LEGEA, ȘI DE CE FUNCȚIA ASTA EXISTĂ SEPARAT ─────────────────────
// Legea 31/1990 art. 74 alin. (1): denumirea, forma juridică, sediul social,
// numărul din registrul comerțului și codul unic de înregistrare. Alin. (3):
// capitalul social pentru SRL; pentru SA și SCA, atât cel SUBSCRIS, cât și cel
// VĂRSAT. Alin. (2): mențiunea „societate administrată în sistem dualist" când
// SA-ul a optat pentru sistemul dualist. Sancțiunea: art. 270^3 alin. (1),
// 2.500–5.000 lei. Aceleași elemente, mai larg, în Legea 265/2022 art. 128
// (prinde și PFA/II/IF) și în OMFP 2634/2015 Anexa 1 pct. 3, care le cere pe
// ORICE document emis de o entitate.
//
// Regula „ce se scrie" e deci juridică, nu grafică — iar tipărirea are două
// capete foarte diferite (`pdf-lib`, cu coordonate absolute, și HTML-ul de
// tipărit din browser). Dacă regula ar sta în oricare dintre ele, al doilea ar
// fi o a doua interpretare a aceluiași articol de lege, liberă să diveargă în
// tăcere. Aici e o funcție pură, cu teste per formă juridică.
//
// ── DE CE FIȘIER-FRUNZĂ ÎN `documents/`, NU ÎN `pdf/` ───────────────────────
// `paginaTiparibila` (generator.ts) o folosește la fel de mult ca PDF-ul, iar
// cardul de previzualizare din pagina de șabloane e un component CLIENT: dacă
// blocul ar sta sub `pdf/`, previzualizarea ar trage după ea `pdf-lib` și
// fonturile în bundle-ul de browser. Singurul import de aici e formatarea
// sumelor, care e pură prin construcție.
import { formatLei } from "@/lib/format/money";

/** Unde se tipărește blocul. Oglindește enum-ul `public.pozitie_antet` (0157). */
export type PozitieAntet = "antet" | "subsol";

/** Sigla, citită din bucket-ul `org-branding` și gata de încorporat în PDF. */
export type SiglaOrganizatie = Readonly<{
  octeti: Uint8Array;
  /** Doar PNG și JPEG: sunt singurele formate pe care `pdf-lib` le încorporează. */
  tip: "image/png" | "image/jpeg";
}>;

export type AntetOrganizatie = Readonly<{
  /** Denumirea legală dacă e completată, altfel cea uzuală. */
  denumire: string;
  formaJuridica: string | null;
  cui: string | null;
  regCom: string | null;
  /** Sediul social, dintr-o bucată: stradă, oraș, județ. */
  adresa: string | null;
  /** Capitalul social subscris. Pentru SRL, singurul cerut de lege. */
  capitalSocial: number | null;
  /** Capitalul vărsat. Se tipărește doar la SA/SCA — art. 74 alin. (3). */
  capitalVarsat: number | null;
  /** SA administrată în sistem dualist — art. 74 alin. (2). */
  sistemDualist: boolean;
  telefon: string | null;
  email: string | null;
  pozitie: PozitieAntet;
  sigla: SiglaOrganizatie | null;
}>;

/**
 * Formele juridice pentru care legea cere capitalul subscris ȘI cel vărsat.
 *
 * Comparația se face pe forma normalizată (fără puncte, spații, diacritice),
 * fiindcă în câmpul liber de 40 de caractere din profilul firmei ajung deopotrivă
 * „SA", „S.A.", „S.A" și „societate pe acțiuni”.
 */
const FORME_PE_ACTIUNI = new Set([
  "sa",
  "sca",
  "societatepeactiuni",
  "societateincomanditapeactiuni",
]);

/** Fără puncte, spații, cratime și diacritice — pentru comparat forme juridice. */
function normalizeaza(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "");
}

/** `true` dacă forma juridică e SA sau SCA, singurele cu capital subscris/vărsat. */
export function estePeActiuni(formaJuridica: string | null): boolean {
  if (formaJuridica === null) return false;
  return FORME_PE_ACTIUNI.has(normalizeaza(formaJuridica));
}

const gol = (valoare: string | null): boolean => valoare === null || valoare.trim().length === 0;

/**
 * Denumirea urmată de forma juridică — art. 74 alin. (1) le cere pe amândouă.
 *
 * Forma juridică NU se adaugă când denumirea o conține deja. Firmele își scriu
 * de regulă `legal_name` întreg („ACME PRODUCTION S.R.L."), iar o concatenare
 * oarbă ar tipări „ACME PRODUCTION S.R.L. S.R.L." pe contractul de muncă.
 * Comparația e pe forma normalizată, deci prinde și „SRL" scris fără puncte.
 */
export function denumireCuForma(denumire: string, formaJuridica: string | null): string {
  const nume = denumire.trim();
  if (gol(formaJuridica)) return nume;
  const forma = (formaJuridica as string).trim();
  return normalizeaza(nume).endsWith(normalizeaza(forma)) ? nume : `${nume} ${forma}`;
}

/**
 * Cele trei rânduri ale blocului, în ordinea în care se tipăresc.
 *
 * Rândul 1 e denumirea cu forma juridică; rândurile 2 și 3 grupează restul.
 * Un rând care ar rămâne gol (firmă fără telefon, fără capital completat) NU se
 * întoarce deloc — un rând vid în antet arată ca un defect de randare.
 *
 * Nu se inventează nimic: un câmp necompletat în profilul firmei lipsește din
 * bloc. Completitudinea juridică se semnalează în interfață, pe ecranul de
 * configurare, nu prin text inventat pe un contract.
 */
export function randuriBlocFirma(antet: AntetOrganizatie): readonly string[] {
  const randuri: string[] = [denumireCuForma(antet.denumire, antet.formaJuridica)];

  const identificare: string[] = [];
  if (!gol(antet.cui)) identificare.push(`CUI ${(antet.cui as string).trim()}`);
  if (!gol(antet.regCom)) identificare.push(`Reg. com. ${(antet.regCom as string).trim()}`);
  identificare.push(...capitalul(antet));
  // Mențiunea dualistă stă lângă capital: art. 74 alin. (2) și (3) descriu
  // amândouă societatea pe acțiuni, iar cititorul le caută în același loc.
  if (antet.sistemDualist) identificare.push("societate administrată în sistem dualist");
  if (identificare.length > 0) randuri.push(identificare.join(" · "));

  const contact: string[] = [];
  if (!gol(antet.adresa)) contact.push((antet.adresa as string).trim());
  if (!gol(antet.telefon)) contact.push(`tel. ${(antet.telefon as string).trim()}`);
  if (!gol(antet.email)) contact.push((antet.email as string).trim());
  if (contact.length > 0) randuri.push(contact.join(" · "));

  return randuri;
}

/**
 * Capitalul social, în forma cerută de forma juridică.
 *
 * SRL: un singur capital — „capital social 45.000,00 lei".
 * SA/SCA: subscris ȘI vărsat, art. 74 alin. (3). Când vărsatul nu e completat
 * se tipărește doar subscrisul, etichetat ca atare: „capital social subscris
 * 90.000,00 lei". Eticheta explicită e mai onestă decât un „capital social" care
 * ar putea fi citit drept vărsat.
 */
function capitalul(antet: AntetOrganizatie): readonly string[] {
  if (antet.capitalSocial === null) return [];
  if (!estePeActiuni(antet.formaJuridica)) {
    return [`capital social ${formatLei(antet.capitalSocial)}`];
  }
  if (antet.capitalVarsat === null) {
    return [`capital social subscris ${formatLei(antet.capitalSocial)}`];
  }
  return [
    `capital social subscris ${formatLei(antet.capitalSocial)}, vărsat ${formatLei(antet.capitalVarsat)}`,
  ];
}

/**
 * Câmpurile cerute de lege care lipsesc din profilul firmei.
 *
 * Folosit de ecranul de configurare ca să spună ce anume face antetul
 * incomplet, ÎNAINTE ca cineva să tipărească un contract cu el. Nu blochează
 * nimic: un document fără antet complet e tot mai bun decât un document
 * neemis, iar răspunderea contravențională e a firmei, nu a aplicației.
 */
export function campuriLegaleLipsa(antet: AntetOrganizatie): readonly string[] {
  const lipsa: string[] = [];
  if (gol(antet.formaJuridica)) lipsa.push("forma juridică");
  if (gol(antet.cui)) lipsa.push("codul unic de înregistrare");
  if (gol(antet.regCom)) lipsa.push("numărul din registrul comerțului");
  if (gol(antet.adresa)) lipsa.push("sediul social");
  if (antet.capitalSocial === null) lipsa.push("capitalul social");
  else if (estePeActiuni(antet.formaJuridica) && antet.capitalVarsat === null) {
    lipsa.push("capitalul social vărsat");
  }
  return lipsa;
}
