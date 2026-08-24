// src/lib/queries/cursor.ts

/**
 * Cursorul keyset, generalizat ca să poată purta o coloană de sortare.
 *
 * ── DE CE NU MERGEA SORTAREA ÎNAINTE ──────────────────────────────────────
 * Fiecare listă își avea propriul cursor, cu COLOANA ÎNCUIATĂ ÎN EL: la
 * angajați era `{ nume, id }`, codificat ca `nume\0id`, iar predicatul de
 * continuare era scris de mână, `full_name.gt.X,and(full_name.eq.X,id.gt.Y)`.
 * O sortare după „Departament" ar fi cerut alt tip de cursor, alt codificator
 * și alt predicat — în fiecare dintre cele ~15 citiri cu cursor.
 *
 * Aici cursorul poartă o VALOARE opacă plus identificatorul, iar coloana e dată
 * de apelant la fiecare citire. Aceeași structură servește orice sortare.
 *
 * ── DE CE NU `.range()` ───────────────────────────────────────────────────
 * Regula proiectului, nu o preferință: cu `OFFSET`, un rând inserat între două
 * pagini face ca ultimul rând al paginii curente să reapară pe următoarea, iar
 * unul șters sare peste un rând. Pe o listă de aprobări, asta înseamnă o cerere
 * pe care n-o vezi niciodată.
 *
 * ── DE CE IDENTIFICATORUL E MEREU AL DOILEA ───────────────────────────────
 * Coloana de sortare nu e unică: doi angajați se pot numi la fel, două
 * intervenții pot fi din aceeași zi. Fără al doilea criteriu stabil, ordinea
 * dintre ele e nedefinită, iar paginarea poate sări sau repeta exact acolo.
 */
export type Cursor = Readonly<{
  /** Valoarea coloanei de sortare a ULTIMULUI rând din pagina curentă. */
  valoare: string;
  /** Identificatorul aceluiași rând. Departajează valorile egale. */
  id: string;
}>;

export type Directie = "asc" | "desc";

/**
 * `\u0000` (octetul nul) ca separator, nu `|` sau `:`: e singurul octet care nu poate apărea
 * într-un text venit din bază, deci o denumire care conține separatorul nu
 * poate rupe decodificarea.
 *
 * Scris ca secvență de evadare, nu ca octet literal în sursă: un octet nul
 * literal e invizibil în diff, iar unele unelte îl înghit tăcut la copiere.
 * `employees.ts` folosea deja aceeași formă.
 */
const SEPARATOR = "\u0000";

export function codificaCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.valoare}${SEPARATOR}${cursor.id}`, "utf8").toString("base64url");
}

/** Întoarce `null` pentru orice intrare stricată — un cursor din URL e text străin. */
export function decodificaCursor(valoare: string): Cursor | null {
  try {
    const bucati = Buffer.from(valoare, "base64url").toString("utf8").split(SEPARATOR);
    const val = bucati[0];
    const id = bucati[1];
    if (val === undefined || id === undefined || id.length === 0) return null;
    return { valoare: val, id };
  } catch {
    return null;
  }
}

/**
 * Ghilimelează o valoare pentru sintaxa `or=` a lui PostgREST.
 *
 * Fără ea, o denumire care conține virgulă („Popescu, Ion") rupe expresia în
 * două condiții, iar una cu paranteză o închide devreme. Rezultatul nu e o
 * eroare, ci o listă subtil greșită.
 */
export function ghilimeleaza(valoare: string): string {
  return `"${valoare.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

/**
 * Predicatul de continuare, pentru `.or()`.
 *
 * „Rândurile de după cel pe care l-am terminat": ori valoarea e strict mai
 * mare, ori e egală și identificatorul e mai mare. Ordinea celor două condiții
 * trebuie să fie EXACT cea din `.order()`, altfel baza întoarce rânduri pe
 * care le-am arătat deja.
 */
export function predicatKeyset(coloana: string, cursor: Cursor, directie: Directie): string {
  const op = directie === "asc" ? "gt" : "lt";
  const v = ghilimeleaza(cursor.valoare);
  return `${coloana}.${op}.${v},and(${coloana}.eq.${v},id.${op}.${ghilimeleaza(cursor.id)})`;
}

/**
 * Sortarea cerută din URL, îngustată la coloanele PERMISE.
 *
 * Numele coloanei ajunge într-un `.order()` și într-un predicat construit ca
 * text, deci NU poate veni liber din query string. Fiecare citire își declară
 * lista, iar orice altceva cade pe implicit — tăcut, nu cu eroare: un URL
 * copiat greșit nu trebuie să strice ecranul.
 */
export function sortareCeruta<T extends string>(
  brut: string | null,
  permise: readonly T[],
  implicit: Readonly<{ cheie: T; directie: Directie }>,
): Readonly<{ cheie: T; directie: Directie }> {
  if (brut === null) return implicit;
  const desc = brut.startsWith("-");
  const cheie = desc ? brut.slice(1) : brut;
  if (!permise.includes(cheie as T)) return implicit;
  return { cheie: cheie as T, directie: desc ? "desc" : "asc" };
}

/** Forma din URL: `nume` pentru crescător, `-nume` pentru descrescător. */
export function scrieSortare(s: Readonly<{ cheie: string; directie: Directie }>): string {
  return s.directie === "desc" ? `-${s.cheie}` : s.cheie;
}
