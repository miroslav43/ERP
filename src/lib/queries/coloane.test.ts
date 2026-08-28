// src/lib/queries/coloane.test.ts
//
// Poarta care compară coloanele CERUTE de citiri cu coloanele care există
// cu adevărat, așa cum le descrie `src/types/database.ts`.
//
// ── DE CE EXISTĂ ────────────────────────────────────────────────────────────
// Modulul de cursuri a cerut la prima livrare `employees.nume` și
// `employees.prenume`. Tabela are `first_name`, `last_name` și `full_name`
// (generată de bază ca `last_name || ' ' || first_name`). Patru ecrane cădeau
// cu 42703 — conformitatea, atribuirea, regulile și, după prima înrolare,
// stadiul — iar utilizatorul vedea doar „A apărut o problemă”.
//
// Nimic nu l-a prins, și nu din întâmplare: fiecare citire își impune tipul
// prin generic explicit — `.returns<AngajatBrut[]>()`, `.maybeSingle<T>()` —
// iar genericul ÎNLOCUIEȘTE tipul dedus din tipurile generate. Genericul spune
// ce crede autorul, nu ce are baza. `tsc` verifică fericit un contract pe care
// Postgres nu l-a semnat.
//
// În aceeași zi, aceeași clasă de defect a lovit de două ori: `RandCurs.termen_zile`
// rămăsese `number` după ce migrarea 0085 a făcut coloana nullable, iar trei
// ecrane scriau literal „null zile”. Un tip scris de mână care se abate de bază
// nu produce NICIO eroare — de aceea comparația trebuie făcută pe text.
//
// ── CE ACOPERĂ ȘI CE NU ─────────────────────────────────────────────────────
// Acoperă `.select("…")` cu literal (inclusiv relațiile încorporate,
// `alias:tabela!cheie(coloane)`) și `.order("coloana")` cu literal, pentru
// toate fișierele din `src/lib/queries/`.
//
// NU acoperă selecturile construite prin interpolare pe care n-o poate rezolva
// (numărul lor e afirmat mai jos, ca acoperirea să fie o cifră, nu o impresie),
// și nici `.eq()` / `.ilike()` / `.or()`: acolo lanțul trece frecvent printr-o
// funcție-ajutor, iar legarea de tabelă ar fi o ghiceală. O poartă care
// ghicește produce raportări false, iar o raportare falsă o face să fie
// ignorată — vezi comentariul lui `faraComentarii`.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DIRECTOR = join(process.cwd(), "src/lib/queries");
const TIPURI = join(process.cwd(), "src/types/database.ts");

// ── Coloanele reale ─────────────────────────────────────────────────────────

/**
 * Blocurile `Row` din tipurile generate, pentru tabele ȘI vederi: ambele sunt
 * ținte legitime pentru `.from()`, iar forma lor în fișier e identică.
 */
function coloaneDinTipuri(cale: string): ReadonlyMap<string, ReadonlySet<string>> {
  const linii = readFileSync(cale, "utf8").split("\n");
  const harta = new Map<string, Set<string>>();
  for (let i = 0; i < linii.length; i += 1) {
    const antet = /^ {6}(\w+): \{$/u.exec(linii[i] ?? "");
    if (antet === null) continue;
    if (!/^ {8}Row: \{$/u.test(linii[i + 1] ?? "")) continue;
    const coloane = new Set<string>();
    for (let j = i + 2; j < linii.length; j += 1) {
      if (/^ {8}\}$/u.test(linii[j] ?? "")) break;
      const c = /^ {10}(\w+)\??:/u.exec(linii[j] ?? "");
      if (c !== null) coloane.add(c[1] as string);
    }
    const existent = harta.get(antet[1] as string);
    if (existent === undefined) harta.set(antet[1] as string, coloane);
    else for (const c of coloane) existent.add(c);
  }
  return harta;
}

// ── Coloanele cerute ────────────────────────────────────────────────────────

/**
 * Comentariile se scot ÎNAINTE de căutare. Prima versiune a porții a raportat
 * `attendance_approval_batches.data` — luat dintr-un comentariu care explica
 * `.order("data").order("id")` al ALTEI interogări, de mai jos. O poartă care
 * citește documentația ca pe cod nu e o poartă, e zgomot.
 */
function faraComentarii(sursa: string): string {
  return sursa
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .split("\n")
    .filter((linie) => !/^\s*(\/\/|\*)/u.test(linie))
    .join("\n");
}

/** Desparte lista de coloane la virgulele de nivel ZERO, nu la cele din embed. */
function despartePeVirgule(text: string): readonly string[] {
  const parti: string[] = [];
  let adanc = 0;
  let curent = "";
  for (const ch of text) {
    if (ch === "(") adanc += 1;
    if (ch === ")") adanc -= 1;
    if (ch === "," && adanc === 0) {
      parti.push(curent);
      curent = "";
      continue;
    }
    curent += ch;
  }
  if (curent.trim() !== "") parti.push(curent);
  return parti.map((p) => p.trim()).filter((p) => p !== "");
}

interface Cerere {
  readonly tabela: string;
  readonly coloana: string;
}

/** `alias:tabela!cheie(coloane)` intră recursiv, pe tabela lui, nu pe a părintelui. */
function cereri(tabela: string, selectie: string, out: Cerere[]): void {
  for (const parte of despartePeVirgule(selectie)) {
    const paren = parte.indexOf("(");
    if (paren !== -1) {
      const cap = parte.slice(0, paren).trim();
      const inner = parte.slice(paren + 1, parte.lastIndexOf(")"));
      const numeTabela = (cap.split(":").pop() ?? "").split("!")[0]?.trim() ?? "";
      if (numeTabela !== "") cereri(numeTabela, inner, out);
      continue;
    }
    const nume = (parte.split(":").pop() ?? "").trim().replace(/::.*$/u, "");
    // `*` nu numește nimic, iar `count` e un agregat, nu o coloană.
    if (nume === "*" || nume === "" || nume === "count") continue;
    out.push({ tabela, coloana: nume });
  }
}

/** `const EMBED_X = "…"` din același fișier, ca `${EMBED_X}` să fie rezolvabil. */
function constanteText(sursa: string): ReadonlyMap<string, string> {
  const harta = new Map<string, string>();
  const re = /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*(["'`])([^"'`]*)\2/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sursa)) !== null) harta.set(m[1] as string, m[3] as string);
  return harta;
}

function rezolva(text: string, constante: ReadonlyMap<string, string>): string {
  let anterior: string | null = null;
  let curent = text;
  for (let i = 0; i < 5 && curent !== anterior; i += 1) {
    anterior = curent;
    curent = curent.replace(/\$\{(\w+)\}/gu, (intreg, nume: string) =>
      constante.has(nume) ? (constante.get(nume) as string) : intreg,
    );
  }
  return curent;
}

/** Primul argument-șir al lui `.select(`, cu ghilimeaua de deschidere de la `idx`. */
function literalDupa(sursa: string, idx: number): { text: string } | null {
  const m = /^\s*(["'`])/u.exec(sursa.slice(idx));
  if (m === null) return null;
  const ghilimea = m[1] as string;
  const start = idx + (m[0] as string).length;
  let text = "";
  for (let i = start; i < sursa.length; i += 1) {
    const ch = sursa[i] as string;
    if (ch === "\\") {
      i += 1;
      continue;
    }
    if (ch === ghilimea) return { text };
    text += ch;
  }
  return null;
}

export interface Analiza {
  readonly cerute: readonly Cerere[];
  readonly sarite: number;
}

export function analizeaza(sursaBruta: string): Analiza {
  const sursa = faraComentarii(sursaBruta);
  const constante = constanteText(sursa);
  const cerute: Cerere[] = [];
  let sarite = 0;

  const re = /\.from\(\s*["'`](\w+)["'`]\s*\)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sursa)) !== null) {
    const tabela = m[1] as string;
    const idxSelect = sursa.indexOf(".select(", m.index);
    if (idxSelect === -1) continue;
    // Dacă între `.from` și `.select` mai apare un `.from`, selectul e al ALTEI
    // interogări — se sare, în loc să fie legat de tabela greșită.
    if (/\.from\(/u.test(sursa.slice(m.index + (m[0] as string).length, idxSelect))) continue;

    const lit = literalDupa(sursa, idxSelect + ".select(".length);
    if (lit === null) {
      sarite += 1;
    } else {
      const text = rezolva(lit.text, constante);
      if (text.includes("${")) sarite += 1;
      else cereri(tabela, text.replace(/\s+/gu, " "), cerute);
    }

    // `.order("coloana")` e tot o referință de coloană — chiar cea care a
    // însoțit defectul original (`.order("nume")`). Doar literalii: un
    // `.order(coloana)` cu variabilă nu se poate verifica static.
    const pana = sursa.indexOf(".from(", m.index + (m[0] as string).length);
    const bucata = sursa.slice(m.index, pana === -1 ? sursa.length : pana);
    const reOrder = /\.order\(\s*"(\w+)"/gu;
    let o: RegExpExecArray | null;
    while ((o = reOrder.exec(bucata)) !== null) {
      cerute.push({ tabela, coloana: o[1] as string });
    }
  }

  return { cerute, sarite };
}

// ── Testele ─────────────────────────────────────────────────────────────────

const COLOANE = coloaneDinTipuri(TIPURI);

const FISIERE = readdirSync(DIRECTOR)
  .filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))
  .map((n) => ({ nume: n, analiza: analizeaza(readFileSync(join(DIRECTOR, n), "utf8")) }));

describe("coloanele cerute de citiri există în bază", () => {
  it("tipurile generate au fost citite", () => {
    // Dacă parserul se rupe la o regenerare, harta rămâne goală și toate
    // testele de mai jos ar trece cu zero verificări. Asta e sonda de control.
    expect(COLOANE.size).toBeGreaterThan(100);
    expect(COLOANE.get("employees")?.has("full_name")).toBe(true);
    expect(COLOANE.get("employees")?.has("nume")).toBe(false);
  });

  it("acoperirea rămâne semnificativă", () => {
    const total = FISIERE.reduce((n, f) => n + f.analiza.cerute.length, 0);
    expect(FISIERE.length).toBeGreaterThan(10);
    expect(total).toBeGreaterThan(1000);
  });

  it.each(FISIERE.map((f) => [f.nume] as const))("%s", (nume) => {
    const fisier = FISIERE.find((f) => f.nume === nume);
    if (fisier === undefined) throw new Error("fișier negăsit");
    const probleme = fisier.analiza.cerute
      .filter(({ tabela, coloana }) => {
        const coloane = COLOANE.get(tabela);
        return coloane === undefined || !coloane.has(coloana);
      })
      .map(({ tabela, coloana }) =>
        COLOANE.has(tabela) ? `${tabela}.${coloana}` : `tabela necunoscută „${tabela}”`,
      );
    expect([...new Set(probleme)], `coloane inexistente în ${nume}`).toEqual([]);
  });

  it("prinde o coloană inventată", () => {
    // Proba că poarta mușcă, făcută pe o sursă sintetică: reproduce exact
    // defectul din `cursuri.ts`, fără să strice fișierul real.
    const { cerute } = analizeaza(`
      const q = db.from("employees").select("id, nume, prenume").order("nume");
    `);
    const lipsa = cerute.filter((c) => !(COLOANE.get(c.tabela)?.has(c.coloana) ?? false));
    expect(lipsa.map((c) => c.coloana).sort()).toEqual(["nume", "nume", "prenume"]);
  });

  it("nu confundă relația încorporată cu tabela-părinte", () => {
    // `angajat:employees!employee_id(full_name)` pe `payroll_lines`: `full_name`
    // trebuie căutat în `employees`, nu în tabela din `.from()`.
    const { cerute } = analizeaza(`
      db.from("payroll_lines").select("id, angajat:employees!employee_id(full_name, marca)");
    `);
    expect(cerute).toContainEqual({ tabela: "employees", coloana: "full_name" });
    expect(cerute).not.toContainEqual({ tabela: "payroll_lines", coloana: "full_name" });
  });
});
