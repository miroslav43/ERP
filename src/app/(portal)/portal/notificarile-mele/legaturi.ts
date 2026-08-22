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
 */

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const REGULI: readonly Readonly<{ tipar: RegExp; portal: (id: string) => string }>[] = [
  {
    tipar: new RegExp(`^/concedii/(${UUID})$`, "u"),
    portal: (id) => `/portal/concediile-mele/${id}`,
  },
  { tipar: new RegExp(`^/anunturi/(${UUID})$`, "u"), portal: (id) => `/portal/anunturi/${id}` },
  {
    tipar: new RegExp(`^/ticketing/(${UUID})$`, "u"),
    portal: (id) => `/portal/tichetele-mele/${id}`,
  },
];

/** Rute fără identificator, traduse una la una. */
const FIXE: Readonly<Record<string, string>> = {
  "/pontaj/saptamana": "/portal/pontajul-meu/saptamana",
  "/anunturi": "/portal/anunturi",
  "/concedii": "/portal/concediile-mele",
  "/pontaj": "/portal/pontajul-meu",
};

export function caleaDePortal(link: string | null): string | null {
  if (link === null || link.length === 0) return null;

  // Deja o cale de portal: se lasă neatinsă.
  if (link === "/portal" || link.startsWith("/portal/")) return link;

  const fixa = FIXE[link];
  if (fixa !== undefined) return fixa;

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
