// src/domain/leave/drepturi.ts

/**
 * Previzualizarea CLIENT-SIDE a dreptului anual de concediu al unui angajat,
 * pe un tip de concediu, pentru un an dat.
 *
 * Replică EXACT `app.drept_concediu` (supabase/migrations/0035_reguli_concediu.sql):
 * bază (`leave_types.zile_implicite`) + suma CUMULATIVĂ a grilelor active,
 * valabile la 31 decembrie din anul dat. Data de referință e fixă — nu
 * depinde de ceasul sistemului, ca rezultatul să fie reproductibil oricând
 * (esențial pentru previzualizarea din `/concedii/setari`, care compară
 * „vechi" cu „nou" pe fiecare angajat).
 *
 * Vechimea se calculează din `employees.hired_on` — nu există un câmp
 * separat de „vechime în muncă anterioară”; grilele de vechime se raportează
 * la vechimea în ACEASTĂ firmă.
 *
 * Funcție PURĂ: regulile și datele angajatului se primesc ca parametri,
 * citite o singură dată pe server.
 */

export type CriteriuGrila =
  "vechime" | "conditii_munca" | "grad_handicap" | "varsta_sub_18" | "departament" | "functie";

export interface RegulaConcediu {
  readonly tipCriteriu: CriteriuGrila;
  /** Doar pentru `tipCriteriu === "vechime"`. */
  readonly vechimeAniMin: number | null;
  /** Doar pentru `"conditii_munca"` (`"deosebite" | "speciale"`) sau `"grad_handicap"` (`"accentuat" | "grav"`). */
  readonly valoareText: string | null;
  /** Doar pentru `"departament"`. */
  readonly departmentId: string | null;
  /** Doar pentru `"functie"`. */
  readonly jobPositionId: string | null;
  readonly zileSuplimentare: number;
  readonly activ: boolean;
  readonly valabilDeLa: Date;
  readonly valabilPanaLa: Date | null;
}

export interface AngajatPentruDrept {
  readonly hiredOn: Date | null;
  readonly dataNasterii: Date | null;
  readonly conditiiMunca: string;
  readonly gradHandicap: string | null;
  readonly departmentId: string | null;
  readonly jobPositionId: string | null;
}

/**
 * Luni calendaristice ÎNTREGI de la `start` la `sfarsit` — echivalentul
 * `extract(year from age(sfarsit, start)) * 12 + extract(month from age(...))`
 * din Postgres: se scade luna și, dacă ziua din `sfarsit` e mai mică decât
 * ziua din `start`, luna în curs nu se consideră încă împlinită.
 */
function luniCalendaristiceIntregi(start: Date, sfarsit: Date): number {
  let luni =
    (sfarsit.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (sfarsit.getUTCMonth() - start.getUTCMonth());
  if (sfarsit.getUTCDate() < start.getUTCDate()) {
    luni -= 1;
  }
  return Math.max(luni, 0);
}

/** Vârsta împlinită (ani întregi) la data de referință. */
function varstaAniLaData(dataNasterii: Date, referinta: Date): number {
  let ani = referinta.getUTCFullYear() - dataNasterii.getUTCFullYear();
  const ziuaImplinita =
    referinta.getUTCMonth() > dataNasterii.getUTCMonth() ||
    (referinta.getUTCMonth() === dataNasterii.getUTCMonth() &&
      referinta.getUTCDate() >= dataNasterii.getUTCDate());
  if (!ziuaImplinita) {
    ani -= 1;
  }
  return ani;
}

function seAplicaRegula(
  regula: RegulaConcediu,
  angajat: AngajatPentruDrept,
  vechimeLuni: number,
  referinta: Date,
): boolean {
  switch (regula.tipCriteriu) {
    case "vechime":
      return regula.vechimeAniMin !== null && vechimeLuni >= regula.vechimeAniMin * 12;
    case "conditii_munca":
      return regula.valoareText !== null && regula.valoareText === angajat.conditiiMunca;
    case "grad_handicap":
      return (
        regula.valoareText !== null &&
        angajat.gradHandicap !== null &&
        regula.valoareText === angajat.gradHandicap
      );
    case "varsta_sub_18":
      return angajat.dataNasterii !== null && varstaAniLaData(angajat.dataNasterii, referinta) < 18;
    case "departament":
      return (
        regula.departmentId !== null &&
        angajat.departmentId !== null &&
        regula.departmentId === angajat.departmentId
      );
    case "functie":
      return (
        regula.jobPositionId !== null &&
        angajat.jobPositionId !== null &&
        regula.jobPositionId === angajat.jobPositionId
      );
    default: {
      const necunoscut: never = regula.tipCriteriu;
      throw new RangeError(`Criteriu de grilă de concediu necunoscut: ${String(necunoscut)}`);
    }
  }
}

function esteInVigoare(regula: RegulaConcediu, referinta: Date): boolean {
  if (!regula.activ) return false;
  if (regula.valabilDeLa.getTime() > referinta.getTime()) return false;
  if (regula.valabilPanaLa !== null && regula.valabilPanaLa.getTime() < referinta.getTime()) {
    return false;
  }
  return true;
}

/**
 * Subsetul de reguli care chiar contribuie la dreptul angajatului la 31
 * decembrie din `an` — folosit atât de `calculeazaDreptAnual` (sumă), cât și
 * de UI-ul care explică „de ce" (fișa angajatului: „bază 21 + vechime 4 +
 * condiții deosebite 3"), fără să dubleze logica de potrivire.
 */
export function regulileAplicabile(
  reguli: readonly RegulaConcediu[],
  angajat: AngajatPentruDrept,
  an: number,
): readonly RegulaConcediu[] {
  if (!Number.isInteger(an) || an < 2000 || an > 2199) {
    throw new RangeError("Anul trebuie să fie un număr întreg între 2000 și 2199.");
  }
  const referinta = new Date(Date.UTC(an, 11, 31));
  const vechimeLuni =
    angajat.hiredOn === null || angajat.hiredOn.getTime() > referinta.getTime()
      ? 0
      : luniCalendaristiceIntregi(angajat.hiredOn, referinta);

  return reguli.filter(
    (regula) =>
      esteInVigoare(regula, referinta) && seAplicaRegula(regula, angajat, vechimeLuni, referinta),
  );
}

/**
 * Dreptul anual de concediu = bază + suma zilelor suplimentare din regulile
 * companiei active, valabile la 31 decembrie din `an`, care se potrivesc
 * angajatului. Regulile sunt CUMULATIVE — un angajat poate întruni mai multe.
 */
export function calculeazaDreptAnual(
  zileImplicite: number,
  reguli: readonly RegulaConcediu[],
  angajat: AngajatPentruDrept,
  an: number,
): number {
  if (!Number.isFinite(zileImplicite) || zileImplicite < 0) {
    throw new RangeError("Zilele implicite ale tipului de concediu nu pot fi negative.");
  }
  const suplimentar = regulileAplicabile(reguli, angajat, an).reduce(
    (suma, regula) => suma + regula.zileSuplimentare,
    0,
  );
  return Math.round((zileImplicite + suplimentar) * 100) / 100;
}
