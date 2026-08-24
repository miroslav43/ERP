// src/lib/queries/numaratoare-paginata.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Poarta contra unei cifre greșite fără eroare, pe fiecare listă paginată.
 *
 * ── DEFECTUL ──────────────────────────────────────────────────────────────
 * `count: "exact"` pus pe ACEEAȘI interogare care poartă și predicatul keyset
 * numără doar rândurile rămase DUPĂ cursor. Predicatul de cursor e un filtru ca
 * oricare altul; PostgREST nu are de unde ști că e „paginare".
 *
 * Consecința se vede de la pagina a doua: `<Paginare>` scrie „25 din 30 de
 * rânduri" acolo unde sunt 55, iar totalul SCADE cu fiecare „mai departe".
 * Nimic nu semnalează nimic — lista e corectă, doar numărul minte.
 *
 * Argumentul care a produs defectul era el însuși corect: „numărătoarea pe
 * aceeași interogare respectă filtrele ȘI politicile RLS, fără un al doilea
 * drum la bază". Rata doar că predicatul keyset intră în aceleași filtre.
 *
 * ── DE CE UN TEST CARE CITEȘTE FIȘIERE ────────────────────────────────────
 * Fiindcă defectul nu se vede la citirea unei singure funcții — arată exact ca
 * varianta corectă — și fiindcă reapare la fiecare listă nouă care copiază
 * tiparul de la vecina ei. Cele cincisprezece funcții afectate l-au primit toate
 * prin copiere.
 *
 * Forma corectă: numărătoarea e o A DOUA interogare, cu ACELEAȘI filtre
 * (aplicate de aceeași funcție, ca să nu poată diverge) și `head: true`, fără
 * cursor, fără ordine, fără limită. Referința e `listeazaAngajati` din
 * `employees.ts`.
 */

const DIR = join(process.cwd(), "src/lib/queries");

/**
 * Sursa fără comentarii.
 *
 * Prima versiune a porții scana textul brut, iar asta o făcea să dea
 * FALS-POZITIVE: regexul căuta `count: "exact"` neurmat de `head: true`, dar
 * proza dintre ele conține paranteze, iar o paranteză oprește lookahead-ul.
 * Un agent a nimerit exact cazul — comentariul lui pomenea „(`app.ssm_acces`
 * din 0011_ssm.sql)" — și a fost marcat vinovat cu codul corect.
 *
 * O poartă care acuză pe nedrept se stinge: următorul care o vede roșie o
 * declară zgomot și n-o mai citește. De aceea comentariile ies înainte de orice
 * analiză, iar ce rămâne e numai cod.
 */
function faraComentarii(sursa: string): string {
  return sursa.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/** Corpul fiecărei funcții exportate dintr-un fișier de citiri. */
function functii(sursa: string): readonly Readonly<{ nume: string; corp: string }>[] {
  const rezultat: { nume: string; corp: string }[] = [];
  const tipar = /export async function (\w+)\(/g;
  let m: RegExpExecArray | null;
  while ((m = tipar.exec(sursa)) !== null) {
    const urmatoarea = sursa.indexOf("\nexport ", m.index + 1);
    rezultat.push({
      nume: m[1] ?? "",
      corp: sursa.slice(m.index, urmatoarea > 0 ? urmatoarea : sursa.length),
    });
  }
  return rezultat;
}

/**
 * Funcția paginează prin cursor?
 *
 * NU se caută doar numele ajutorului comun. `ticketing.ts` avea, la un moment
 * dat, predicatul scris de mână — `created_at.lt.…,and(created_at.eq.…,id.lt.…)`
 * — și ar fi trecut poarta cu defectul în el. Aceeași formă mai există azi în
 * `attendance.ts` și `audit.ts`. Semnalul structural e `and(` într-un `.or(`:
 * asta E un predicat keyset, oricine l-ar fi scris.
 */
function paginat(corp: string): boolean {
  return (
    corp.includes("predicatKeyset") ||
    corp.includes("decodificaKeyset") ||
    /\.or\(\s*`[^`]*\band\(/.test(corp)
  );
}

describe("numărătoarea unei liste paginate nu se îngustează cu cursorul", () => {
  it("nicio funcție paginată nu numără pe interogarea cu predicat keyset", () => {
    const vinovate: string[] = [];
    for (const fisier of readdirSync(DIR).filter(
      (f) => f.endsWith(".ts") && !f.includes(".test."),
    )) {
      const sursa = faraComentarii(readFileSync(join(DIR, fisier), "utf8"));
      for (const { nume, corp } of functii(sursa)) {
        if (!paginat(corp)) continue;
        // Numărătoarea corectă e separată și nu aduce rânduri: `head: true`.
        // Cea greșită stă pe interogarea de date, care poartă și cursorul.
        const gresite = [...corp.matchAll(/count:\s*"exact"(?![\s\S]{0,80}?head:\s*true)/g)].length;
        if (gresite > 0) vinovate.push(`${fisier}:${nume}`);
      }
    }
    expect(vinovate).toEqual([]);
  });

  it("poarta CHIAR poate cădea — pe o sursă construită cu defectul", () => {
    // Un test care nu poate deveni roșu nu apără nimic. Verificarea de mai jos
    // rulează aceeași logică pe o sursă scrisă anume, în memorie.
    const defect = `
export async function listaGresita() {
  let interogare = db.from("t").select("id", { count: "exact" }).limit(26);
  interogare = interogare.or(predicatKeyset("id", cursor, "asc"));
}
`;
    const gasite = functii(faraComentarii(defect)).filter(
      (f) =>
        paginat(f.corp) &&
        [...f.corp.matchAll(/count:\s*"exact"(?![\s\S]{0,80}?head:\s*true)/g)].length > 0,
    );
    expect(gasite.map((f) => f.nume)).toEqual(["listaGresita"]);
  });

  it("recunoaște și un predicat keyset scris de mână, nu doar ajutorul comun", () => {
    const defect = `
export async function listaCuPredicatDeMana() {
  let q = db.from("t").select("id", { count: "exact" }).limit(26);
  q = q.or(\`created_at.lt."\${c.m}",and(created_at.eq."\${c.m}",id.lt."\${c.id}")\`);
}
`;
    const f = functii(faraComentarii(defect))[0];
    expect(f === undefined ? false : paginat(f.corp)).toBe(true);
  });
});
