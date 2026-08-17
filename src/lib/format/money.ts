/**
 * Formatarea și citirea sumelor în convenția românească: punct pentru mii,
 * virgulă pentru zecimale — `1.234,56 lei`.
 *
 * Funcții pure, fără I/O. Sunt folosite și pe server (PDF, Excel), și în client,
 * deci nu depind de nimic din `lib/supabase` sau din contextul de request.
 *
 * Sumele sosesc din Postgres ca `numeric`, pe care driverul le livrează ca
 * string tocmai ca să nu piardă precizie prin `double`. De aceea intrarea
 * acceptă și string, iar conversia se face aici, într-un singur loc.
 */

const CURRENCY_FRACTION_DIGITS = 2;

const formatter = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: CURRENCY_FRACTION_DIGITS,
  maximumFractionDigits: CURRENCY_FRACTION_DIGITS,
});

/** Suma așa cum sosește din DB (`numeric` → string) sau din calcul. */
export type Amount = number | string;

function toFiniteNumber(value: Amount): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    throw new TypeError(`Sumă invalidă: ${JSON.stringify(value)}`);
  }
  return parsed;
}

/**
 * `Intl.NumberFormat` rotunjește „half to even" pe unele valori care în
 * virgulă mobilă cad chiar sub jumătate (2.675 este de fapt 2.67499...).
 * Pentru bani, așteptarea contabilului este rotunjirea aritmetică la doi
 * zecimali, așa că o forțăm explicit înainte de formatare.
 */
function roundToBani(value: number): number {
  const scaled = value * 100;
  const rounded = Math.round(scaled + Math.sign(scaled) * Number.EPSILON * Math.abs(scaled));
  return rounded / 100;
}

/** `1234.56` → `"1.234,56"`. Fără simbol monetar — pentru coloane de tabel. */
export function formatAmount(value: Amount, currency?: string): string {
  const formatted = formatter.format(roundToBani(toFiniteNumber(value)));
  return currency === undefined ? formatted : `${formatted} ${currency}`;
}

/** `1234.56` → `"1.234,56 lei"`. Formatul implicit al aplicației. */
export function formatLei(value: Amount): string {
  return formatAmount(value, "lei");
}

/**
 * Citește o sumă introdusă de utilizator, tolerant la felul în care oamenii
 * chiar tastează: cu sau fără separator de mii, cu virgulă sau cu punct
 * zecimal, cu spații rămase din copy-paste (inclusiv spațiul neîntrerupt pe
 * care îl produce Excel).
 *
 * Întoarce `null` în loc să ghicească atunci când intrarea e ambiguă — apelantul
 * decide dacă asta e o eroare de validare sau un câmp gol.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s  ]/g, "");
  if (cleaned.length === 0) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized: string;
  if (hasComma && hasDot) {
    // Ambele prezente: ultimul separator este cel zecimal.
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  } else {
    normalized = cleaned;
  }

  // Un singur separator zecimal și cifre în rest. Respinge „1,2,3”.
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
