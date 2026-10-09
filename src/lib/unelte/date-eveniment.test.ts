import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TIPURI_CERERE } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/variante";
import { CATEGORII } from "@/app/(marketing)/unelte/foaie-de-parcurs/model";

import { CAMPURI_EVENIMENT, dateCalcul, dateDescarcare, treaptaBrut } from "./date-eveniment";

const RADACINA = "src/app/(marketing)/unelte";

/**
 * Numele tuturor câmpurilor pe care le citește o unealtă, scoase din surse:
 * `name="…"` în JSX, `nume: "…"` în listele de câmpuri și cheile citite din
 * adresă (`q.get("…")`, `brut("…")`, `text("…")`, `data("…")`). Antetul de
 * firmă (firmă, CUI, compartiment) e comun și stă în `src/lib/unelte`.
 */
function campuriDinSurse(slug: string): Set<string> {
  const surse = readdirSync(join(RADACINA, slug), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/u.test(f) && !/\.test\.tsx?$/u.test(f))
    .map((f) => readFileSync(join(RADACINA, slug, f), "utf8"));
  surse.push(readFileSync("src/lib/unelte/antet-firma.ts", "utf8"));
  const chei = new Set<string>();
  for (const sursa of surse) {
    for (const m of sursa.matchAll(
      /(?:\bname="|\bnume: "|\.get(?:All)?\("|\bbrut\("|\btext\("|\bdata\(")([a-z_0-9]+)"/gu,
    )) {
      if (m[1] !== undefined) chei.add(m[1]);
    }
  }
  // Cheile construite dinamic (fracțiunile concediului, notele fișei).
  for (const k of [2, 3, 4]) {
    chei.add(`de_la_${String(k)}`);
    chei.add(`pana_la_${String(k)}`);
  }
  return chei;
}

const UNELTE_DESCARCABILE = Object.keys(CAMPURI_EVENIMENT);

/** Ce ar putea scrie un vizitator într-un câmp liber: nume, firmă, CUI, traseu, sumă. */
const SANTINELE = [
  "Zzsecret Popescu",
  "Firma Zzsecret SRL",
  "RO14399840",
  "14399840",
  "Cluj-Napoca – Zzsecret Turda",
  "7351,25",
  "B 123 ZZS",
];

describe("datele evenimentului nu poartă nimic scris de vizitator", () => {
  it("scanarea găsește câmpurile libere (altfel testul ar trece gol)", () => {
    const pontaj = campuriDinSurse("foaie-de-pontaj");
    expect(pontaj).toContain("angajati");
    expect(pontaj).toContain("firma");
    expect(pontaj).toContain("cui");
    expect(campuriDinSurse("foaie-de-parcurs")).toContain("sofer");
    expect(campuriDinSurse("adeverinta-salariat")).toContain("nume");
    expect(campuriDinSurse("fisa-evaluare")).toContain("evaluator");
    expect(campuriDinSurse("cerere-concediu-de-odihna")).toContain("de_la");
  });

  it("toate câmpurile tuturor uneltelor, umplute cu text liber, nu ajung în eveniment", () => {
    for (const slug of UNELTE_DESCARCABILE) {
      const chei = campuriDinSurse(slug);
      expect(chei.size, slug).toBeGreaterThanOrEqual(3);
      for (const santinela of SANTINELE) {
        const q = new URLSearchParams();
        for (const cheie of chei) q.set(cheie, santinela);
        const date = JSON.stringify(dateDescarcare(slug, q));
        for (const bucata of santinela.split(/[\s–,-]+/u).filter((b) => b.length >= 4)) {
          expect(date, `${slug} / ${santinela}`).not.toContain(bucata);
        }
      }
    }
  });

  it("din lista de angajați pleacă doar câți sunt", () => {
    const q = new URLSearchParams({
      angajati: "Zzsecret Popescu\nIon Ionescu | 4\n\n  \nMaria Pop",
      an: "2026",
      luna: "10",
      program: "ture",
      varianta: "individuala",
      firma: "Zzsecret SRL",
      cui: "RO14399840",
    });
    expect(dateDescarcare("foaie-de-pontaj", q)).toEqual({
      an: 2026,
      luna: 10,
      angajati: 3,
      program: "ture",
      varianta: "individuala",
    });
  });

  it("salariul din adeverință pleacă doar pe treaptă, niciodată suma", () => {
    const q = new URLSearchParams({ salariu: "7.351,25", durata: "determinata", ore: "6" });
    const date = dateDescarcare("adeverinta-salariat", q);
    expect(date).toEqual({ durata: "determinata", ore: 6, brut: "5000-10000" });
    expect(JSON.stringify(date)).not.toMatch(/7351|7\.351/u);
  });

  it("valorile din afara mulțimii modelului nu trec, nici cu altă scriere", () => {
    const q = new URLSearchParams({ categorie: "Autoturism ", combustibil: "kerosen", curse: "9" });
    expect(dateDescarcare("foaie-de-parcurs", q)).toEqual({});
    expect(
      dateDescarcare("foaie-de-parcurs", new URLSearchParams({ categorie: CATEGORII[0] })),
    ).toEqual({ categorie: CATEGORII[0] });
  });

  it("din data concediului pleacă doar luna și anul", () => {
    const q = new URLSearchParams({ tip: TIPURI_CERERE[0] ?? "", de_la: "2026-12-21" });
    const date = dateDescarcare("cerere-concediu-de-odihna", q);
    expect(date).toEqual({ tip: TIPURI_CERERE[0], an: 2026, luna: 12 });
    expect(JSON.stringify(date)).not.toContain("21");
  });

  it("o unealtă fără listă și cheile moștenite nu dau nimic", () => {
    const q = new URLSearchParams({ an: "2026" });
    expect(dateDescarcare("calculator-salariu", q)).toEqual({});
    expect(dateDescarcare("__proto__", q)).toEqual({});
    expect(dateDescarcare("constructor", q)).toEqual({});
  });
});

describe("treptele de brut", () => {
  it("sunt trei, largi", () => {
    expect(treaptaBrut(4999)).toBe("sub-5000");
    expect(treaptaBrut(5000)).toBe("5000-10000");
    expect(treaptaBrut(10_000)).toBe("5000-10000");
    expect(treaptaBrut(10_001)).toBe("peste-10000");
  });

  it("calculul de salariu pleacă cu perioada, sensul și treapta brutului rezultat", () => {
    const q = new URLSearchParams({ suma: "4.325", din: "net", perioada: "2026-2", nume: "Zz" });
    expect(dateCalcul(q, 7412)).toEqual({ din: "net", perioada: "2026-2", brut: "5000-10000" });
    expect(dateCalcul(new URLSearchParams({ perioada: "2030-1" }), null)).toEqual({ din: "brut" });
    expect(JSON.stringify(dateCalcul(q, 7412))).not.toMatch(/4325|4\.325|7412/u);
  });
});
