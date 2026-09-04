// src/app/(portal)/portal/notificarile-mele/legaturi.ts

/**
 * Traduce `notifications.link` — scris pentru învelișul `(app)` — într-o cale de
 * portal.
 *
 * Legăturile din notificări sunt scrise de TRIGGERE, în bază, cu rute de
 * aplicație mare codificate literal. Cele pe care le poate primi un angajat:
 *
 *   `/concedii/<uuid>`  — `0048_concedii_notificari.sql:201`, trimisă la
 *                          aprobarea sau respingerea cererii lui;
 *   `/pontaj/saptamana` — `0042_pontaj_saptamanal_notificari.sql:103,137`;
 *   `/ticketing/<uuid>` — `0046_ticketing_it_reguli.sql:101`, către solicitant;
 *   `/anunturi/<uuid>`  — `(app)/anunturi/actions.ts`, la publicare.
 *
 * Netradusă, fiecare devine un clic care îl scoate din portal și îl aduce înapoi
 * pe ecranul de start: angajatul citește „Cererea a fost respinsă”, apasă, și
 * ajunge unde era. Motivul respingerii rămâne de negăsit.
 *
 * Traducerea se face la RANDARE, nu printr-o migrare care rescrie triggerele:
 * rândurile deja scrise în `notifications` nu se mai ating, iar ele sunt exact
 * cele pe care oamenii le au acum în inbox.
 *
 * Listă albă, nu rescriere cu expresii regulate. O legătură necunoscută întoarce
 * `null` și rândul se randează ca text — o cale ghicită ar duce într-un 404, iar
 * un 404 dintr-o notificare arată ca o notificare falsă.
 *
 * `/concedii/<uuid>` ESTE EXCEPȚIA: vezi `ContextDestinatar` mai jos.
 */

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const TIPAR_CONCEDIU = new RegExp(`^/concedii/(${UUID})$`, "u");
const TIPAR_TICHET = new RegExp(`^/ticketing/(${UUID})$`, "u");

/**
 * Ce știe apelantul despre DESTINATARUL notificării — nu despre link.
 *
 * `/concedii/<uuid>` e singura legătură pe care lista albă nu o poate traduce
 * doar uitându-se la ea, fiindcă în portal duce la „cererea MEA", iar aceeași
 * legătură ajunge la trei feluri de oameni:
 *
 *   `0048_concedii_notificari.sql:201` → SOLICITANTUL, la decizie. Traducerea e
 *                                        corectă: cererea chiar e a lui.
 *   `0056_concedii_hr_nu_aproba.sql:95` → HR, „de înregistrat".
 *   `0079_concedii_anulare_dupa_aprobare.sql:338` → APROBATORII, la anulare.
 *
 * Pentru ultimele două, `/portal/concediile-mele/<uuid>` cheamă `notFound()`
 * (`concediile-mele/[id]/page.tsx:60`, garda de proprietate, 404 deliberat).
 * Linkul din bază NU e greșit — pe ERP-ul de birou, HR-ul și aprobatorul chiar
 * au dreptul să deschidă cererea; greșită era doar traducerea, care presupunea
 * că orice notificare de concediu se adresează solicitantului.
 *
 * Pe baza vie, la 2026-09-04: 15 notificări cu această formă — 5 către
 * solicitant, 10 către HR/aprobatori. Două din trei duceau într-o pagină goală.
 *
 * `/ticketing/<uuid>` E ACEEAȘI CLASĂ, nu încă un caz. `0046:106` trimite
 * legătura MANAGERULUI direct la o cerere IT nouă și SOLICITANTULUI la fiecare
 * schimbare de status — iar `tichetele-mele/[id]/page.tsx:63` are aceeași gardă
 * de proprietate. Astăzi ticketing-ul nu e cablat în aplicație și baza vie are
 * zero astfel de rânduri; se tratează totuși aici, fiindcă în ziua în care e
 * cablat defectul apare gata făcut, iar cine îl cablează n-are de unde ști.
 *
 * IMPLICITUL E SIGUR. Fără context, niciuna din cele două nu se traduce: rândul
 * cade pe cutia poștală, unde mesajul se citește oricum întreg. Un apelant
 * viitor care uită să dea contextul pierde o aterizare bună; nu produce un 404.
 */
export type ContextDestinatar = Readonly<{
  /** Id-urile cererilor de concediu care îi APARȚIN destinatarului. */
  concediiProprii: ReadonlySet<string>;
  /** Id-urile tichetelor IT al căror SOLICITANT e destinatarul. */
  ticheteProprii: ReadonlySet<string>;
}>;

/**
 * Id-ul cererii dintr-un `/concedii/<uuid>`, sau `null`.
 *
 * Exportat ca apelanții să poată aduna, dintr-un singur drum la bază, exact
 * cererile care apar în lotul lor — și să construiască `ContextDestinatar` fără
 * să-și scrie fiecare propria expresie regulată, care ar diverge de asta.
 */
export function idCerereDeConcediu(link: string | null): string | null {
  if (link === null) return null;
  return TIPAR_CONCEDIU.exec(link)?.[1] ?? null;
}

/** Id-ul tichetului dintr-un `/ticketing/<uuid>`, sau `null`. Vezi mai sus. */
export function idTichet(link: string | null): string | null {
  if (link === null) return null;
  return TIPAR_TICHET.exec(link)?.[1] ?? null;
}

/**
 * Legăturile care se traduc doar uitându-te la ele.
 *
 * `/anunturi/<uuid>` rămâne aici, și nu printre cele care cer context: anunțul
 * e difuzat întregii firme, iar `portal/anunturi/[id]` n-are gardă de
 * proprietate — nu există „anunțul altcuiva". Pe baza vie: 7 rânduri, toate
 * corecte.
 */
const REGULI: readonly Readonly<{ tipar: RegExp; portal: (id: string) => string }>[] = [
  { tipar: new RegExp(`^/anunturi/(${UUID})$`, "u"), portal: (id) => `/portal/anunturi/${id}` },
];

/** Rute fără identificator, traduse una la una. */
const FIXE: Readonly<Record<string, string>> = {
  "/pontaj/saptamana": "/portal/pontajul-meu/saptamana",
  "/anunturi": "/portal/anunturi",
  "/concedii": "/portal/concediile-mele",
  "/pontaj": "/portal/pontajul-meu",
};

export function caleaDePortal(link: string | null, context?: ContextDestinatar): string | null {
  if (link === null || link.length === 0) return null;

  // Deja o cale de portal: se lasă neatinsă.
  if (link === "/portal" || link.startsWith("/portal/")) return link;

  const fixa = FIXE[link];
  if (fixa !== undefined) return fixa;

  // Înaintea listei generale: singurele reguli care depind de CINE primește, nu
  // doar de cum arată linkul. `=== true`, nu `?? false` — fără context,
  // `context?.…has()` e `undefined`, adică „nu se traduce".
  const idConcediu = idCerereDeConcediu(link);
  if (idConcediu !== null) {
    return context?.concediiProprii.has(idConcediu) === true
      ? `/portal/concediile-mele/${idConcediu}`
      : null;
  }

  const idTichetul = idTichet(link);
  if (idTichetul !== null) {
    return context?.ticheteProprii.has(idTichetul) === true
      ? `/portal/tichetele-mele/${idTichetul}`
      : null;
  }

  for (const regula of REGULI) {
    const potrivire = regula.tipar.exec(link);
    const id = potrivire?.[1];
    if (id !== undefined) return regula.portal(id);
  }

  // Legăturile de aprobator (`/concedii/aprobari`, `/pontaj/aprobare`) ajung
  // aici: un angajat nu le primește, dar dacă totuși le primește, un text fără
  // link e mai onest decât o cale inventată.
  return null;
}
