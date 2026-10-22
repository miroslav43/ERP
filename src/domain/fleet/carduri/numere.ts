// src/domain/fleet/carduri/numere.ts
//
// Numerele din extrasele de card: litri, prețuri, sume. Fiecare emitent (și
// fiecare Excel cu setări regionale) le scrie altfel: „1.234,56”, „1,234.56”,
// „1 234,56” (cu spațiu, NBSP sau spațiu îngust), „(12,50)” pentru storno,
// „12,50 L”, „RON 12,50”. Separatorul zecimal se hotărăște pe TOATĂ coloana
// (`detecteazaSeparatorZecimal`), nu pe valoare: „1,234” singur e ambiguu.

export type SeparatorZecimal = "," | ".";

/** Cum arată o singură valoare: ce separator sugerează, sau dacă e ambiguă. */
type Indiciu = SeparatorZecimal | "ambiguu" | "fara";

const SPATII = /[\s  ']/gu;

/** Doar cifrele, semnele și separatorii; restul (unități, monedă) pleacă. */
function curata(text: string): { readonly corp: string; readonly negativ: boolean } | null {
  let t = text.trim();
  if (t.length === 0) return null;
  let negativ = false;
  if (/^\(.*\)$/u.test(t)) {
    negativ = true;
    t = t.slice(1, -1);
  }
  t = t.replace(SPATII, "");
  if (t.endsWith("-")) {
    // „12,50-”, forma SAP a stornoului.
    negativ = !negativ;
    t = t.slice(0, -1);
  }
  // Unitățile și moneda, la început sau la final („RON12,50”, „12,50L”).
  t = t.replace(/^[^\d+\-.,]+/u, "").replace(/[^\d.,]+$/u, "");
  if (t.startsWith("-")) {
    negativ = !negativ;
    t = t.slice(1);
  } else if (t.startsWith("+")) {
    t = t.slice(1);
  }
  if (!/^[\d.,]+$/u.test(t) || !/\d/u.test(t)) return null;
  return { corp: t, negativ };
}

function indiciu(corp: string): Indiciu {
  const virgule = (corp.match(/,/gu) ?? []).length;
  const puncte = (corp.match(/\./gu) ?? []).length;
  if (virgule === 0 && puncte === 0) return "fara";
  if (virgule > 0 && puncte > 0) {
    return corp.lastIndexOf(",") > corp.lastIndexOf(".") ? "," : ".";
  }
  const semn: SeparatorZecimal = virgule > 0 ? "," : ".";
  const celalalt: SeparatorZecimal = semn === "," ? "." : ",";
  if (virgule + puncte > 1) return celalalt; // „1,234,567”: semnul se repetă ⇒ e de mii
  const dupa = corp.slice(corp.indexOf(semn) + 1);
  if (dupa.length === 3 && /^\d{1,3}[.,]\d{3}$/u.test(corp)) return "ambiguu";
  return semn;
}

/**
 * Separatorul zecimal al unei coloane întregi. Valorile fără separator nu
 * votează; una cu ambele semne sau cu semnul repetat votează sigur; „x,yyy”
 * e ambiguă. Voturi contradictorii, sau doar valori ambigue ⇒ `null`: se
 * cere profilul de import (omul alege).
 */
export function detecteazaSeparatorZecimal(valori: readonly string[]): SeparatorZecimal | null {
  const voturi = new Set<SeparatorZecimal>();
  let ambigue = 0;
  for (const valoare of valori) {
    const c = curata(valoare);
    if (c === null) continue;
    const i = indiciu(c.corp);
    if (i === "ambiguu") ambigue += 1;
    else if (i !== "fara") voturi.add(i);
  }
  if (voturi.size > 1) return null;
  const [singurul] = [...voturi];
  if (singurul !== undefined) return singurul;
  // Niciun vot: fie toate sunt întregi (orice alegere e corectă), fie toate ambigue.
  return ambigue > 0 ? null : ".";
}

/**
 * O valoare numerică. `null` pentru orice nu e număr.
 *
 * Separatorul dat decide DOAR valorile ambigue („1,234”). O valoare care se
 * spune singură („52.3”, „1.234,56”) se citește după ea: altfel un profil
 * salvat de pe un CSV cu virgulă ar citi celula numerică a unui XLSX („52.3”,
 * scrisă de `String(număr)`) drept 523 de litri. La `auto`, ambiguu ⇒ `null`.
 */
export function parseazaNumar(text: string, separator: SeparatorZecimal | "auto"): number | null {
  const c = curata(text);
  if (c === null) return null;
  const i = indiciu(c.corp);
  let sep: SeparatorZecimal;
  if (i === "ambiguu") {
    if (separator === "auto") return null;
    sep = separator;
  } else {
    sep = i === "fara" ? "." : i;
  }
  const mii = sep === "," ? "." : ",";
  const faraMii = c.corp.split(mii).join("");
  if ((faraMii.match(sep === "," ? /,/gu : /\./gu) ?? []).length > 1) return null;
  const normal = sep === "," ? faraMii.replace(",", ".") : faraMii;
  if (!/^\d*\.?\d+$|^\d+\.?$/u.test(normal)) return null;
  const n = Number(normal);
  if (!Number.isFinite(n)) return null;
  return c.negativ ? -n : n;
}

/** Rotunjirea la `zecimale`, pentru chei de dedup și comparații stabile. */
export function rotunjeste(n: number, zecimale: number): number {
  const f = 10 ** zecimale;
  return Math.round((n + Number.EPSILON) * f) / f;
}
