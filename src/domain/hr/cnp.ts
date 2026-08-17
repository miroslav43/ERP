// src/domain/hr/cnp.ts
// Validarea codului numeric personal: cifră de control, dată de naștere, cod de județ.

const CHEIE_CONTROL: readonly number[] = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
const JUDET_MAXIM = 52;
const JUDET_BUCURESTI_STRAINI = 70;

export type GenDinCnp = "masculin" | "feminin" | "nedeclarat";

export type RezultatCnp =
  | {
      readonly valid: true;
      readonly cnp: string;
      readonly dataNasterii: string | null;
      readonly gen: GenDinCnp;
    }
  | { readonly valid: false; readonly motiv: string };

export function normalizeazaCnp(valoare: string): string {
  return valoare.replace(/\D/gu, "");
}

export function ultimeleCifreCnp(valoare: string): string {
  return normalizeazaCnp(valoare).slice(-4);
}

export function mascheazaCnp(valoare: string): string {
  const cnp = normalizeazaCnp(valoare);
  if (cnp.length < 4) return "•••••••••••••";
  return `${"•".repeat(cnp.length - 4)}${cnp.slice(-4)}`;
}

/** Secolul nașterii se deduce doar pentru cifrele 1-6; 7/8/9 (rezidenți, străini) rămân ambigue. */
function secolPentruSex(cifra: number): number | null {
  if (cifra === 1 || cifra === 2) return 1900;
  if (cifra === 3 || cifra === 4) return 1800;
  if (cifra === 5 || cifra === 6) return 2000;
  return null;
}

function esteDataReala(an: number, luna: number, zi: number): boolean {
  const data = new Date(Date.UTC(an, luna - 1, zi));
  return (
    data.getUTCFullYear() === an && data.getUTCMonth() === luna - 1 && data.getUTCDate() === zi
  );
}

export function validateazaCnp(valoare: string): RezultatCnp {
  const cnp = normalizeazaCnp(valoare);
  if (cnp.length !== 13) {
    return { valid: false, motiv: "CNP-ul trebuie să conțină exact 13 cifre." };
  }

  const cifre: readonly number[] = Array.from(cnp, (caracter) => Number(caracter));
  const la = (index: number): number => cifre[index] ?? 0;

  const sex = la(0);
  if (sex < 1 || sex > 9) {
    return {
      valid: false,
      motiv: "Prima cifră a CNP-ului nu corespunde niciunui sex/rezidență valid.",
    };
  }

  let suma = 0;
  for (let i = 0; i < 12; i += 1) {
    suma += la(i) * (CHEIE_CONTROL[i] ?? 0);
  }
  const rest = suma % 11;
  const control = rest === 10 ? 1 : rest;
  if (control !== la(12)) {
    return {
      valid: false,
      motiv: "Cifra de control a CNP-ului nu corespunde. Verificați cifrele introduse.",
    };
  }

  const judet = la(7) * 10 + la(8);
  if (!((judet >= 1 && judet <= JUDET_MAXIM) || judet === JUDET_BUCURESTI_STRAINI)) {
    return { valid: false, motiv: "Codul de județ din CNP nu există." };
  }

  const luna = la(3) * 10 + la(4);
  const zi = la(5) * 10 + la(6);
  const secol = secolPentruSex(sex);
  let dataNasterii: string | null = null;
  if (secol !== null) {
    const an = secol + la(1) * 10 + la(2);
    if (!esteDataReala(an, luna, zi)) {
      return { valid: false, motiv: "Data nașterii codificată în CNP nu există în calendar." };
    }
    dataNasterii = `${String(an)}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
  }

  const gen: GenDinCnp = sex === 9 ? "nedeclarat" : sex % 2 === 1 ? "masculin" : "feminin";
  return { valid: true, cnp, dataNasterii, gen };
}
