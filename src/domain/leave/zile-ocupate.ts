// src/domain/leave/zile-ocupate.ts
//
// Zilele pe care un angajat le are deja prinse într-o cerere de concediu.
//
// ── DE CE EXISTĂ ────────────────────────────────────────────────────────────
// Refuzul suprapunerii era corect, dar venea prea târziu: omul alegea perioada,
// completa motivul, apăsa „Trimite" și abia atunci afla că are deja concediu
// atunci. Constrângerea `leave_requests_fara_suprapunere` (0009) și verificarea
// din `verificaInainteDeTrimitere` rămân judecătorul; asta e doar semnalizarea
// din calendar, ca drumul greșit să nu se poată apuca.
//
// ── DE CE INTERVALE, NU ZILE, DIN BAZĂ ──────────────────────────────────────
// O firmă de cincizeci de oameni are câteva sute de cereri pe an, dar zeci de
// mii de ZILE de concediu. Serverul trimite capetele, clientul le desface —
// desfacerea e o buclă peste cel mult 366 de pași per cerere.
import { adaugaZileIso } from "@/domain/calendar/grila-lunara";

/** O cerere existentă, redusă la ce trebuie desenat în calendar. */
export interface IntervalOcupat {
  readonly employeeId: string;
  /** ISO, inclusiv. */
  readonly dataInceput: string;
  /** ISO, inclusiv. */
  readonly dataSfarsit: string;
  /** Ce se scrie în tooltip: „Concediu de odihnă, aprobată". */
  readonly eticheta: string;
}

/**
 * Câte zile poate acoperi o singură cerere înainte să ne oprim.
 *
 * Creșterea copilului merge până la 1095 de zile (varianta din
 * `leave_type_variants`), deci plafonul nu poate fi „un an". E o plasă contra
 * unui interval stricat în bază, nu o regulă de domeniu: fără ea, o
 * `data_sfarsit` din 9999 ar învârti bucla până cade fila.
 */
const MAXIM_ZILE_PER_CERERE = 1200;

/**
 * Zilele ocupate ale unui angajat, ca hartă ISO → explicație.
 *
 * `employeeId` null (nu s-a ales încă persoana) întoarce o hartă goală: fără să
 * știm despre CINE e vorba, orice marcaj ar fi o minciună. `excludeId` scoate
 * cererea aflată în editare, ca propriile ei zile să nu se blocheze singure.
 */
export function zileOcupate(
  intervale: readonly IntervalOcupat[],
  employeeId: string | null,
): Readonly<Record<string, string>> {
  if (employeeId === null) return {};

  const harta: Record<string, string> = {};
  for (const interval of intervale) {
    if (interval.employeeId !== employeeId) continue;
    if (interval.dataSfarsit < interval.dataInceput) continue;

    let zi = interval.dataInceput;
    for (let pas = 0; pas < MAXIM_ZILE_PER_CERERE; pas += 1) {
      // Prima cerere care prinde ziua rămâne stăpâna tooltipului. Ordinea vine
      // din interogare (cronologică), deci e stabilă între randări.
      harta[zi] ??= interval.eticheta;
      if (zi >= interval.dataSfarsit) break;
      zi = adaugaZileIso(zi, 1);
    }
  }
  return harta;
}
