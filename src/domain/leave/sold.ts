// src/domain/leave/sold.ts

/**
 * Modul de rotunjire a fracțiunilor de zi rezultate din calculul
 * proporțional al dreptului de concediu. Corespunde exact enumerării
 * `public.leave_rounding_mode` din supabase/migrations/0009_leave.sql.
 *
 * NU există o regulă legală unică de rotunjire (vezi nota C din migrare):
 * Codul Muncii stabilește dreptul minim anual, nu cum se rotunjesc
 * fracțiile. De aceea modul e parametru, niciodată o constantă în cod.
 *
 * Cele două moduri care rotunjeau la jumătate de zi au dispărut în 0112,
 * odată cu concediul pe jumătate de zi: dădeau un sold de forma „12,5 zile"
 * din care ultima jumătate nu se mai putea cheltui pe nicio cerere. Migrarea
 * le-a mutat pe `zi_in_sus` / `zi_in_jos` și le refuză printr-o constrângere
 * pe `leave_types.mod_rotunjire_acumulare`.
 */
export type ModRotunjire = "fara_rotunjire" | "zi_in_sus" | "zi_in_jos" | "matematic";

/**
 * Rotunjește un număr de zile de concediu conform modului configurat.
 * Rezultatul e calculat întâi la precizie de 2 zecimale, pentru a
 * elimina zgomotul de virgulă mobilă (echivalent cu `numeric(6,2)` din
 * baza de date), apoi se aplică regula de rotunjire.
 */
export function rotunjesteZileConcediu(valoare: number, mod: ModRotunjire): number {
  const laDouaZecimale = Math.round(valoare * 100) / 100;
  switch (mod) {
    case "fara_rotunjire":
      return laDouaZecimale;
    case "zi_in_sus":
      return Math.ceil(laDouaZecimale);
    case "zi_in_jos":
      return Math.floor(laDouaZecimale);
    case "matematic":
      return Math.round(laDouaZecimale);
    default: {
      const modNerecunoscut: never = mod;
      throw new RangeError(`Mod de rotunjire necunoscut: ${String(modNerecunoscut)}`);
    }
  }
}

/**
 * Calculează dreptul de concediu ACUMULAT proporțional pentru un angajat,
 * într-un an dat, ținând cont de data angajării și de câte luni din anul
 * respectiv sunt deja „consumate” la data de referință `astazi`.
 *
 * Regula (vezi nota B din migrare): drept_lunar = drept_anual / 12,
 * drept_acumulat = drept_lunar × numărul de luni lucrate în anul `an`.
 * O lună se consideră lucrată integral dacă angajatul era încadrat în
 * acea lună, indiferent de ziua exactă a angajării în lună.
 *
 * - Dacă angajatul a fost încadrat într-un an anterior lui `an`, luna
 *   de start e ianuarie.
 * - Dacă anul `an` s-a încheiat deja (e anterior anului lui `astazi`),
 *   luna de final e decembrie; altfel e luna curentă la `astazi`.
 * - Dacă angajatul nu era încă încadrat în `an`, sau `an` nu a început
 *   încă la data `astazi`, rezultatul e 0.
 *
 * Funcție PURĂ: `astazi` e primit ca parametru, nu citit din ceasul
 * sistemului — determinismul testelor depinde de asta.
 */
export function calculeazaAcumulareProportionala(
  dataAngajarii: Date,
  an: number,
  dreptAnual: number,
  modRotunjire: ModRotunjire,
  astazi: Date,
): number {
  if (!Number.isInteger(an) || an < 2000 || an > 2199) {
    throw new RangeError(
      "Anul de calcul al soldului trebuie să fie un număr întreg între 2000 și 2199.",
    );
  }
  if (!Number.isFinite(dreptAnual) || dreptAnual < 0) {
    throw new RangeError("Dreptul anual de concediu nu poate fi negativ.");
  }
  if (Number.isNaN(dataAngajarii.getTime()) || Number.isNaN(astazi.getTime())) {
    throw new RangeError("Data angajării sau data de referință este invalidă.");
  }

  const anAngajarii = dataAngajarii.getUTCFullYear();
  const anAstazi = astazi.getUTCFullYear();

  if (anAngajarii > an || anAstazi < an) {
    return 0;
  }

  const primaLuna = anAngajarii === an ? dataAngajarii.getUTCMonth() + 1 : 1;
  const ultimaLuna = anAstazi === an ? astazi.getUTCMonth() + 1 : 12;

  if (primaLuna > ultimaLuna) {
    return 0;
  }

  const luniLucrate = ultimaLuna - primaLuna + 1;
  const dreptAcumulat = (dreptAnual / 12) * luniLucrate;

  return rotunjesteZileConcediu(dreptAcumulat, modRotunjire);
}
