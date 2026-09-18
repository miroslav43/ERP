// src/app/api/csp-report/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Colectorul rapoartelor de încălcare a politicii de securitate a conținutului.
 *
 * `next.config.ts` trimite azi politica ca `Content-Security-Policy-Report-Only`,
 * deci nimic nu e blocat: singurul efect al politicii sunt rapoartele care ajung
 * aici. Ele spun ce ar fi căzut dacă ar fi fost pusă în vigoare — adică exact
 * inventarul pe care citirea codului nu-l poate produce.
 *
 * ── DE CE NU `createPublicAction` ─────────────────────────────────────────
 * Acela e învelișul Server Actions: validare Zod, audit, limitare de debit
 * într-un rând de Postgres. Aici sosește un POST de la BROWSER, fără sesiune,
 * cu un tip de conținut pe care nu-l alegem noi (`application/csp-report`).
 * Mai important: limitarea de debit prin bază ar scrie un rând PER RAPORT, iar
 * o singură pagină cu o bibliotecă zgomotoasă trimite zeci de rapoarte pe
 * încărcare. Poarta trebuie să fie în proces și gratuită.
 *
 * ── DE CE SE ÎNGHIT DUPLICATELE ───────────────────────────────────────────
 * Cele două valori care contează — directiva încălcată și resursa blocată — se
 * repetă identic la fiecare încărcare de pagină, pentru fiecare vizitator.
 * Fără dedublare, jurnalul ar avea o mie de exemplare ale aceleiași informații
 * și zero din a doua. Se ține o amprentă per fereastră de timp; ce s-a mai
 * văzut în fereastra curentă se numără, dar nu se mai scrie.
 *
 * Starea e per PROCES și se pierde la repornire. Asta e în regulă: nu e
 * evidență, e un filtru de zgomot pentru jurnal.
 */

/** Fereastra de dedublare. O oră: rapoartele sunt utile ca inventar, nu ca serie de timp. */
const FEREASTRA_MS = 60 * 60 * 1000;

/**
 * Plafonul de amprente DISTINCTE ținute minte. Peste el, harta se golește.
 *
 * Un plafon, nu o hartă nemărginită: `blocked-uri` conține adresa resursei, iar
 * o pagină care încarcă resurse cu adrese unice (cache-busting) ar produce o
 * amprentă nouă la fiecare cerere — adică o scurgere de memorie alimentată din
 * afară, în procesul care servește aplicația.
 */
const PLAFON_AMPRENTE = 500;

const vazute = new Map<string, number>();

/** Adevărat dacă amprenta e nouă în fereastra curentă — deci merită scrisă. */
function eNoua(amprenta: string): boolean {
  const acum = Date.now();
  const ultima = vazute.get(amprenta);
  if (ultima !== undefined && acum - ultima < FEREASTRA_MS) return false;
  if (vazute.size >= PLAFON_AMPRENTE) vazute.clear();
  vazute.set(amprenta, acum);
  return true;
}

/** Taie o valoare de câmp la o lungime rezonabilă pentru un rând de jurnal. */
function scurt(valoare: unknown, maxim = 200): string {
  if (typeof valoare !== "string") return "";
  return valoare.length > maxim ? `${valoare.slice(0, maxim)}…` : valoare;
}

/**
 * Cele două formate de raport, citite fără schemă.
 *
 * Vechiul `report-uri` trimite `{"csp-report": {...}}`; `Reporting API` trimite
 * un TABLOU de `{type, body}`. Aici nu se validează nimic cu Zod dinadins:
 * corpul vine de la un browser oarecare, orice câmp poate lipsi, iar un refuz
 * pe schemă ar arunca exact raportul neobișnuit — cel mai interesant dintre
 * toate. Se citesc două câmpuri, apărate de `typeof`, și se ignoră restul.
 */
function extrage(date: unknown): readonly Readonly<{ directiva: string; resursa: string }>[] {
  const corpuri: unknown[] = Array.isArray(date)
    ? date.map((r) => (typeof r === "object" && r !== null ? Reflect.get(r, "body") : null))
    : [typeof date === "object" && date !== null ? Reflect.get(date, "csp-report") : null];

  return corpuri.flatMap((corp) => {
    if (typeof corp !== "object" || corp === null) return [];
    const directiva = scurt(
      Reflect.get(corp, "effectiveDirective") ?? Reflect.get(corp, "violated-directive"),
      80,
    );
    const resursa = scurt(Reflect.get(corp, "blockedURL") ?? Reflect.get(corp, "blocked-uri"));
    if (directiva === "" && resursa === "") return [];
    return [{ directiva, resursa }];
  });
}

export async function POST(cerere: Request): Promise<Response> {
  // Un corp mai mare de 64 KB nu e un raport, e altceva. Se citește ca text ca
  // să nu depindem de `content-type`: browserele trimit trei valori diferite.
  const brut = await cerere.text().catch(() => "");
  if (brut === "" || brut.length > 64 * 1024) return new Response(null, { status: 204 });

  let date: unknown;
  try {
    date = JSON.parse(brut);
  } catch {
    return new Response(null, { status: 204 });
  }

  for (const { directiva, resursa } of extrage(date)) {
    const amprenta = `${directiva}|${resursa}`;
    if (!eNoua(amprenta)) continue;
    // Un singur rând, pe stdout: jurnalul containerului e deja locul în care se
    // uită toată lumea. `console.warn`, nu `error` — nimic nu e stricat, e o
    // politică încă neaplicată care ar fi avut de obiectat.
    console.warn(`[csp] ${directiva} ← ${resursa}`);
  }

  // 204 mereu, chiar și pentru un corp de nerecunoscut: browserul n-are ce face
  // cu un cod de eroare aici, iar un 4xx ar umple consola vizitatorului cu o
  // problemă care nu e a lui.
  return new Response(null, { status: 204 });
}
