// src/app/(app)/salarizare/legaturi-avertismente.ts
//
// Atenționarea de calcul duce la ecranul care o repară.
//
// Catalogul din `domain/payroll/erori.ts` știe pentru fiecare cod `unde` — ruta
// generică a ecranului de reparat („/angajati", „/pontaj", „/concedii"). La
// salvare rămân doar `{cod, mesaj}` (actions.ts), iar fluturașul le arăta ca
// text (analiza 2026-10-08, salarizare-L2/P2, concedii-L18/P15). Traducerea se
// face AICI, la randare, din cod: nu cere schimbarea formei salvate și acoperă
// fluturașii vechi.
//
// Ruta generică devine una CONCRETĂ, cu contextul fluturașului: `/angajati`
// devine fișa omului, `/pontaj` luna lui, `/concedii` cererile lui din lună,
// `/salarizare` perioada. Fiecare țintă trece prin poarta ei (`poateDeschide`),
// nu prin a paginii de salarizare: `hr` n-are `per_diem:read`, deci „/diurna"
// nu-i apare ca link.
import { poateDeschide, type ContextPorti } from "@/config/porti-ruta";
import { problemaDinEtapa } from "@/domain/payroll/erori";

export interface ContextFluturas {
  readonly periodId: string;
  readonly employeeId: string;
  readonly an: number;
  readonly luna: number;
}

function ultimaZi(an: number, luna: number): string {
  const zi = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  return `${String(an)}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
}

/** Ruta concretă pentru o rută generică din catalog, sau `null` dacă nu are corespondent. */
export function rutaConcreta(unde: string | null, fluturas: ContextFluturas): string | null {
  const luna = String(fluturas.luna).padStart(2, "0");
  const parametriLuna = `an=${String(fluturas.an)}&luna=${String(fluturas.luna)}`;
  switch (unde) {
    case null:
      return null;
    case "/angajati":
      return `/angajati/${fluturas.employeeId}`;
    case "/pontaj":
      return `/pontaj?${parametriLuna}&angajat=${fluturas.employeeId}`;
    case "/concedii":
      // Nu `/concedii` gol: pentru HR redirectează spre calendar, departe de
      // cererile despre care vorbește atenționarea.
      return `/concedii/echipa?employee_id=${fluturas.employeeId}&de_la=${String(fluturas.an)}-${luna}-01&pana_la=${ultimaZi(fluturas.an, fluturas.luna)}`;
    case "/salarizare":
      return `/salarizare/${fluturas.periodId}`;
    case "/salarizare/istoric-venituri":
      return `/salarizare/istoric-venituri?angajat=${fluturas.employeeId}`;
    case "/diurna":
      return `/diurna?angajat=${fluturas.employeeId}`;
    case "/setari":
      // „/setari" n-are pagină; profilul firmei e ecranul de sub el.
      return "/setari/organizatie";
    default:
      return unde;
  }
}

/**
 * Adresa atenționării cu codul dat, dacă rolul poate deschide ecranul-țintă.
 * Un cod necunoscut (fluturaș vechi, etapă nouă) nu aruncă: `problemaDinEtapa`
 * îl traduce în problema generică, fără `unde`, deci rezultatul e `null`.
 */
export function hrefAvertisment(
  cod: string,
  fluturas: ContextFluturas,
  context: ContextPorti,
): string | null {
  const href = rutaConcreta(problemaDinEtapa(cod, "").unde, fluturas);
  if (href === null) return null;
  return poateDeschide(href, context) ? href : null;
}
