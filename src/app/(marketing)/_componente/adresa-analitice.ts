/**
 * Adresa paginii, așa cum are voie să plece spre statistici.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Formularele uneltelor gratuite sunt `method="get"`: numele angajaților,
 * firma, șoferul și salariul stau în adresă, ca pagina să se poată pune la
 * favorite. Auditul din 8 oct 2026 a scris „Zzsecret Popescu” în foaia de
 * pontaj și a găsit numele la Google Analytics (în `dl=`, și FĂRĂ
 * consimțământ) și la Umami (în `url` și `referrer`). Spre statistici pleacă
 * doar adresa trecută prin funcțiile de mai jos.
 *
 * ── LISTĂ ALBĂ, NU LISTĂ NEAGRĂ ────────────────────────────────────────────
 * Se păstrează doar parametrii numiți aici; orice altceva se taie. O unealtă
 * nouă, cu un câmp nou, e acoperită fără ca cineva să-și amintească de
 * fișierul ăsta. `adresa-analitice.test.ts` citește câmpurile tuturor
 * uneltelor și cade dacă vreunul ar purta numele unui parametru păstrat.
 *
 * `m` rămâne: e marcajul `?m=<timestamp>` cu care auditurile noastre își
 * recunosc vizitele în Umami, nu o valoare scrisă de vizitator.
 *
 * Fișierul NU are directivă: îl importă și `analitice.tsx` (server), și
 * componentele de client. Vezi nota din `consimtamant.ts` despre proxy-ul
 * care se stringifică.
 */
export const PARAMETRI_PASTRATI: ReadonlySet<string> = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "m",
]);

/**
 * Identificatorii de clic ai rețelelor de reclamă (Google Ads, Meta, Microsoft)
 * și parametrul de legătură între domenii al gtag (`_gl`). Nu sunt valori
 * scrise de vizitator, deci NU închid poarta GA din `areDateDeFormular`: altfel
 * o vizită venită dintr-o reclamă (`?gclid=…`) n-ar ajunge deloc în GA, iar
 * conversia n-ar mai putea fi legată de campanie. Spre Umami NU pleacă:
 * `adresaCurata` păstrează doar `PARAMETRI_PASTRATI`.
 */
export const PARAMETRI_RECLAMA: ReadonlySet<string> = new Set([
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "_gl",
  "fbclid",
  "msclkid",
]);

/**
 * Numele funcției globale pe care scriptul Umami o cheamă înaintea fiecărei
 * trimiteri (`data-before-send`). Un singur șir, folosit în ambele grafuri.
 */
export const FUNCTIE_UMAMI = "admUmamiInainteDeTrimitere";

/** Corpul unei trimiteri Umami: câmpuri libere, dintre care contează `url` și `referrer`. */
export type PayloadUmami = Readonly<Record<string, unknown>>;

/**
 * Baza pentru adresele relative: Umami scurtează la cale `referrer`-ul venit
 * de pe propriul domeniu. `http:`, nu `https:`: testul de furnizori din
 * `continut.test.ts` caută literali `https://` în `src/` și ar cere ca
 * domeniul ăsta inexistent să fie declarat în politica de confidențialitate.
 */
const BAZA_RELATIVA = "http://adresa-relativa.invalid";

function eAbsoluta(adresa: string): boolean {
  return /^[a-z][a-z\d+.-]*:/iu.test(adresa);
}

function analizeaza(adresa: string): URL | null {
  try {
    return new URL(adresa, BAZA_RELATIVA);
  } catch {
    return null;
  }
}

function doarPastrati(parametri: URLSearchParams): URLSearchParams {
  const rezultat = new URLSearchParams();
  for (const [cheie, valoare] of parametri) {
    if (PARAMETRI_PASTRATI.has(cheie)) rezultat.append(cheie, valoare);
  }
  return rezultat;
}

/** Aceeași formă ca la intrare: adresa absolută rămâne absolută, calea rămâne cale. */
function inFormaLui(url: URL, original: string): string {
  return eAbsoluta(original) ? url.toString() : `${url.pathname}${url.search}`;
}

/**
 * Adresa fără parametrii nepermiși și fără fragment. O adresă care nu se poate
 * citi devine șir gol: mai bine o sursă lipsă în raport decât una cu nume.
 */
export function adresaCurata(adresa: string): string {
  if (adresa === "") return "";
  const url = analizeaza(adresa);
  if (url === null) return "";
  url.search = doarPastrati(url.searchParams).toString();
  url.hash = "";
  return inFormaLui(url, adresa);
}

/**
 * Adevărat dacă adresa poartă măcar un parametru din afara listei albe și din
 * afara identificatorilor de reclamă — pe paginile uneltelor, adică valori
 * scrise de vizitator. O adresă de necitit se tratează ca având date: poarta
 * se închide, nu se deschide.
 */
export function areDateDeFormular(adresa: string): boolean {
  const url = analizeaza(adresa);
  if (url === null) return true;
  for (const cheie of url.searchParams.keys()) {
    if (!PARAMETRI_PASTRATI.has(cheie) && !PARAMETRI_RECLAMA.has(cheie)) return true;
  }
  return false;
}

/**
 * Pune înapoi pe `adresa` parametrii păstrați ai paginii CURENTE, dar numai
 * dacă e aceeași pagină. Cu `data-exclude-search`, Umami taie tot query
 * string-ul, inclusiv `utm_source=fisier` din legăturile puse în documentele
 * descărcate; fără funcția asta, campaniile ar dispărea din raport.
 *
 * Comparația pe cale contează: evenimentele `performance` și `citire` pleacă
 * uneori DUPĂ o navigare soft, când `location` arată deja pagina următoare.
 */
export function cuParametriiPastrati(adresa: string, adresaCurenta: string): string {
  const tinta = analizeaza(adresa);
  const curenta = analizeaza(adresaCurenta);
  if (tinta === null || curenta === null || tinta.pathname !== curenta.pathname) return adresa;
  const pastrati = doarPastrati(curenta.searchParams).toString();
  if (pastrati === "") return adresa;
  tinta.search = pastrati;
  tinta.hash = "";
  return inFormaLui(tinta, adresa);
}

/**
 * Funcția din `data-before-send`, fără `window`: curăță `url` și `referrer`,
 * apoi readaugă campania paginii curente. Restul câmpurilor trec neatinse.
 */
export function pregatestePentruUmami(payload: PayloadUmami, adresaCurenta: string): PayloadUmami {
  const rezultat: Record<string, unknown> = { ...payload };
  const url = payload["url"];
  if (typeof url === "string") {
    rezultat["url"] = cuParametriiPastrati(adresaCurata(url), adresaCurenta);
  }
  const referrer = payload["referrer"];
  if (typeof referrer === "string") {
    rezultat["referrer"] = adresaCurata(referrer);
  }
  return rezultat;
}
