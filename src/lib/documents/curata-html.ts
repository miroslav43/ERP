// src/lib/documents/curata-html.ts
// Curăță HTML-ul unui șablon scris de o firmă, reconstruindu-l.
//
// ── DE CE A DEVENIT NECESAR ─────────────────────────────────────────────────
// Până acum, `continut_html` venea EXCLUSIV din migrări scrise de noi. Pe
// premisa asta se sprijineau două decizii: `din-html.ts` n-are parser de HTML
// („marcajul care poate ajunge aici nu e ceva venit de la un utilizator"), iar
// `randeaza()` evadează VALORILE interpolate, nu și șablonul
// (`generator.ts:42`). Din clipa în care un `org_admin` își editează singur
// șablonul, premisa e falsă în ambele locuri — iar `paginaTiparibila` inserează
// HTML-ul brut într-o pagină servită de `/documente/[id]` (`generator.ts:142`).
// Adică o suprafață XSS reală, nu teoretică.
//
// ── DE CE RECONSTRUIEȘTE, ÎN LOC SĂ FILTREZE ────────────────────────────────
// Un filtru („scoate `<script>`, scoate `on*`") e o listă neagră deghizată: e
// corect exact cât de completă e lista, iar istoria sanitizatoarelor scrise de
// mână e istoria lucrurilor uitate din listă. Aici NIMIC din intrare nu ajunge
// în ieșire neatins: numele etichetelor se compară cu o mulțime de șapte, se
// emit din nou din literale, iar ATRIBUTELE NU SE COPIAZĂ DELOC. Nu există „am
// uitat să filtrez `onerror`", fiindcă niciun atribut nu supraviețuiește.
// Textul se decodează și se reevadează, deci nu poate rămâne niciun `<`.
//
// Cu o gramatică de șapte etichete și zero atribute, asta e sigur prin
// construcție și nu cere o dependență nouă.
//
// ── CONTRACTUL CU RESTUL LANȚULUI ───────────────────────────────────────────
// Mulțimea de mai jos e exact ce știe să randeze `src/lib/pdf/din-html.ts` și
// exact ce poate produce editorul din `sabloane-documente/editor-sablon.tsx`.
// Cele trei se schimbă împreună, altfel utilizatorul formatează ceva ce nu
// ajunge pe hârtie.
import { escapeHtml } from "@/lib/email/templates/layout";

/** Blocuri de sine stătătoare. */
const BLOC = new Set(["h2", "p"]);
/** Containere de listă. */
const LISTA = new Set(["ul", "ol"]);
/** Marcaj în interiorul unui bloc. */
const INLINE = new Set(["strong"]);
/** Etichete fără conținut. */
const VIDE = new Set(["br"]);
/**
 * Etichete al căror CONȚINUT se aruncă, nu doar eticheta.
 *
 * Fără asta, `<script>alert(1)</script>` ar pierde etichetele, dar ar păstra
 * „alert(1)" ca text vizibil în contract. Inofensiv, dar absurd pe hârtie.
 */
const CU_TOT_CU_CONTINUT = new Set(["script", "style", "template", "head", "title"]);

/** Un `<li>` are voie doar într-o listă; `<strong>`/`<br>`, doar într-un bloc sau `<li>`. */
function permis(eticheta: string, parinte: string | null): boolean {
  if (BLOC.has(eticheta) || LISTA.has(eticheta)) return parinte === null;
  if (eticheta === "li") return parinte === "ul" || parinte === "ol";
  if (INLINE.has(eticheta) || VIDE.has(eticheta)) {
    return parinte !== null && (BLOC.has(parinte) || parinte === "li");
  }
  return false;
}

/**
 * Entitățile, decodate înainte de a fi evadate la loc.
 *
 * Fără pasul ăsta, ieșirea editorului (care e deja evadată) s-ar evada a doua
 * oară și „Ionescu &amp; Fiii" ar apărea pe hârtie ca „Ionescu &amp;amp; Fiii".
 *
 * `&amp;` se decodează ULTIMUL — altfel „&amp;lt;" ar deveni „<" în doi pași,
 * adică exact evadarea pe care textul o cerea păstrată. Aceeași ordine ca în
 * `din-html.ts:47-63`.
 */
function decodeaza(text: string): string {
  return text
    .replace(/&nbsp;/gu, " ")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#0*39;|&apos;/gu, "'")
    .replace(/&#x0*27;/giu, "'")
    .replace(/&amp;/gu, "&");
}

/** Tot ce arată a etichetă, comentariu, secțiune CDATA sau instrucțiune de procesare. */
const TIPAR_MARCAJ =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[!?][^>]*>|<\/?([a-zA-Z][^\s/>]*)[^>]*>/gu;

/**
 * Curăță HTML-ul unui șablon, păstrând doar `h2`, `p`, `ul`, `ol`, `li`,
 * `strong` și `br` — fără niciun atribut.
 *
 * Textul rătăcit în afara oricărui bloc nu se pierde: se împachetează într-un
 * `<p>`. Cineva care lipește text din Word trimite adesea rânduri fără nicio
 * etichetă, iar aruncarea lor tăcută ar fi cel mai prost răspuns posibil.
 */
export function curataHtml(brut: string): string {
  const iesire: string[] = [];
  const stiva: string[] = [];
  /** Text de la rădăcină, adunat până se poate decide dacă merită un `<p>`. */
  let rataciti = "";

  const varf = (): string | null => stiva[stiva.length - 1] ?? null;

  function scrieRataciti(): void {
    const text = rataciti.trim();
    rataciti = "";
    if (text !== "") iesire.push(`<p>${escapeHtml(decodeaza(text))}</p>`);
  }

  function scrieText(brutText: string): void {
    if (brutText === "") return;
    if (varf() === null) {
      rataciti += brutText;
      return;
    }
    // Într-o listă, textul dintre `</li>` și `<li>` e doar spațiere.
    if (LISTA.has(varf() ?? "")) return;
    iesire.push(escapeHtml(decodeaza(brutText)));
  }

  function inchidePanaLa(eticheta: string): void {
    if (!stiva.includes(eticheta)) return;
    for (;;) {
      const deschisa = stiva.pop();
      if (deschisa === undefined) return;
      iesire.push(`</${deschisa}>`);
      if (deschisa === eticheta) return;
    }
  }

  function inchideTot(): void {
    for (;;) {
      const deschisa = stiva.pop();
      if (deschisa === undefined) return;
      iesire.push(`</${deschisa}>`);
    }
  }

  let pozitie = 0;
  let potrivire: RegExpExecArray | null;
  TIPAR_MARCAJ.lastIndex = 0;

  while ((potrivire = TIPAR_MARCAJ.exec(brut)) !== null) {
    scrieText(brut.slice(pozitie, potrivire.index));
    pozitie = TIPAR_MARCAJ.lastIndex;

    const intreg = potrivire[0];
    const nume = potrivire[1]?.toLowerCase();
    // Comentariu, CDATA, doctype: se aruncă întregi, fără urmă.
    if (nume === undefined) continue;

    if (CU_TOT_CU_CONTINUT.has(nume)) {
      if (!intreg.startsWith("</")) {
        // Se sare peste tot conținutul, până la eticheta de închidere.
        const inchidere = new RegExp(`</${nume}\\s*>`, "iu");
        const rest = brut.slice(pozitie);
        const gasit = inchidere.exec(rest);
        pozitie = gasit === null ? brut.length : pozitie + gasit.index + gasit[0].length;
        TIPAR_MARCAJ.lastIndex = pozitie;
      }
      continue;
    }

    if (intreg.startsWith("</")) {
      inchidePanaLa(nume);
      continue;
    }

    if (VIDE.has(nume)) {
      if (permis(nume, varf())) iesire.push("<br>");
      continue;
    }

    /*
     * Un bloc sau o listă au voie DOAR la rădăcină, deci deschiderea lor
     * închide întâi tot ce e deschis — la fel ca într-un parser de browser,
     * unde `<p>a<p>b` sunt două paragrafe, nu unul imbricat.
     *
     * Consecința pe liste imbricate: `<ul><li>a<ul><li>b` se aplatizează în
     * două liste alăturate. Deliberat — `din-html.ts` n-are noțiune de nivel,
     * iar o listă aplatizată e un document corect, pe când una imbricată tăcut
     * ar fi ieșit oricum plată în PDF, dar cu text pierdut pe drum.
     */
    if (BLOC.has(nume) || LISTA.has(nume)) inchideTot();

    if (!permis(nume, varf())) continue;

    if (varf() === null) scrieRataciti();
    stiva.push(nume);
    iesire.push(`<${nume}>`);
  }

  scrieText(brut.slice(pozitie));
  inchideTot();
  scrieRataciti();

  // O listă rămasă fără niciun element, sau un paragraf gol, nu sunt conținut:
  // în PDF ar fi spațiu alb inexplicabil, iar în pagina de tipărit, nimic.
  return iesire
    .join("")
    .replace(/<(h2|p|li|strong)>\s*<\/\1>/gu, "")
    .replace(/<(ul|ol)>\s*<\/\1>/gu, "")
    .trim();
}

/** Variabilele `{{…}}` folosite efectiv într-un șablon, fără duplicate, în ordinea apariției. */
export function variabileFolosite(html: string): readonly string[] {
  const gasite: string[] = [];
  const tipar = /\{\{\s*([a-z_]+)\s*\}\}/gu;
  let potrivire: RegExpExecArray | null;
  while ((potrivire = tipar.exec(html)) !== null) {
    const nume = potrivire[1];
    if (nume !== undefined && !gasite.includes(nume)) gasite.push(nume);
  }
  return gasite;
}
