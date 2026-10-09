import { describe, expect, it } from "vitest";

import { pornesteDocument } from "@/lib/pdf/document";
import { latimiColoane } from "@/lib/unelte/pdf";

import { condicaDinParametri, condicaDocument, parametriCondica, randuriCondica } from "./model";

/*
 * Decembrie 2026: 21 de zile lucrătoare; 1 și 25 dec sărbători în timpul
 * săptămânii, 26 dec sărbătoare într-o sâmbătă; sâmbete 5, 12, 19, 26.
 * Auditul din 8 oct 2026 (MAJOR): condica sărea toate sâmbetele, duminicile și
 * sărbătorile, deci comerțul, HoReCa și turele nu puteau trece orele de atunci.
 */
const parametri = (q: Record<string, string>) =>
  parametriCondica(
    new URLSearchParams({ an: "2026", luna: "12", angajati: "Popa Ion\nIlie Maria", ...q }),
  );
const pe = (d: { randuri: readonly (readonly string[])[] }, data: string) =>
  d.randuri.filter((r) => r[0] === data);

describe("condica de prezență", () => {
  it("luni–vineri: rânduri pe om în zilele lucrătoare, câte un rând marcat în rest", () => {
    const d = condicaDocument(parametri({}));
    expect(d.randuri).toHaveLength(21 * 2 + 10);
    expect(d.randuri[0]).toEqual([
      "01.12.2026",
      "Ziua Națională a României",
      "",
      "",
      "",
      "",
      "",
      "",
      "SL",
    ]);
    expect(d.randuri[1]?.slice(0, 2)).toEqual(["02.12.2026", "Popa Ion"]);
    expect(pe(d, "05.12.2026")).toEqual([
      ["05.12.2026", "Sâmbătă — zi de repaus", "", "", "", "", "", "", "L"],
    ]);
    expect(pe(d, "25.12.2026")).toHaveLength(1);
  });

  it("luni–sâmbătă: sâmbetele au rânduri pe om, sâmbăta de Crăciun rămâne marcată", () => {
    const d = condicaDocument(parametri({ program: "ls" }));
    expect(d.randuri).toHaveLength(24 * 2 + 7);
    expect(pe(d, "05.12.2026").map((r) => r[1])).toEqual(["Popa Ion", "Ilie Maria"]);
    expect(pe(d, "26.12.2026")).toEqual([
      ["26.12.2026", "A doua zi de Crăciun", "", "", "", "", "", "", "SL"],
    ]);
  });

  it("ture: fiecare zi are rânduri pe om, iar sărbătoarea are și un rând SL deasupra", () => {
    const d = condicaDocument(parametri({ program: "ture" }));
    expect(d.randuri).toHaveLength(31 * 2 + 3);
    expect(pe(d, "25.12.2026").map((r) => [r[1], r[8]])).toEqual([
      ["Crăciunul", "SL"],
      ["Popa Ion", ""],
      ["Ilie Maria", ""],
    ]);
    expect(pe(d, "06.12.2026").map((r) => r[1])).toEqual(["Popa Ion", "Ilie Maria"]);
  });

  it("fără nume dă câte zece rânduri pe zi lucrătoare, plus marcajele", () => {
    const d = condicaDinParametri(new URLSearchParams({ an: "2026", luna: "12" }));
    expect(d.randuri).toHaveLength(21 * 10 + 10);
  });

  it("are pauza, orele lucrate și observațiile, cu rânduri de semnătură de 22 pt", () => {
    const d = condicaDocument(parametri({}));
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Data",
      "Nume și prenume",
      "Ora\nsosirii",
      "Semnătura",
      "Ora\nplecării",
      "Semnătura",
      "Pauză\n(min)",
      "Ore\nlucrate",
      "Observații",
    ]);
    expect(d.inaltimeRand).toBe(22);
    // Nota începe cu majusculă („Art. 119 alin. (1)…”): regex sensibil la majuscule.
    expect(d.note.join(" ")).toMatch(/Art\. 119/u);
    expect(d.note.join(" ")).toMatch(/CFS = /u);
  });

  it("antetul firmei e subtitlul documentului", () => {
    const d = condicaDocument(
      parametri({ firma: "Construct SRL", cui: "14399840", compartiment: "Bucătărie" }),
    );
    expect(d.subtitlu).toBe("Construct SRL · CUI 14399840 · Compartiment: Bucătărie");
    expect(condicaDocument(parametri({})).subtitlu).toBeNull();
  });

  it("norma scrisă după nume (ca la foaia de pontaj) nu ajunge în condică", () => {
    const d = condicaDocument(parametri({ angajati: "Popa Ion | 4" }));
    expect(new Set(d.randuri.map((r) => r[1]))).toContain("Popa Ion");
    expect(d.randuri.some((r) => r[1]?.includes("|"))).toBe(false);
  });

  it("randuriCondica deosebește marcajele de rândurile pe om", () => {
    const [primul, al2lea] = randuriCondica(parametri({}));
    expect(primul).toMatchObject({ fel: "marcaj", zi: 1, cod: "SL" });
    expect(al2lea).toMatchObject({ fel: "om", zi: 2, nume: "Popa Ion" });
  });

  it("cu peste 60 de nume, documentul spune că lista e incompletă (testul lui B4, păstrat)", () => {
    const multi = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");
    const d = condicaDinParametri(new URLSearchParams({ an: "2026", luna: "12", angajati: multi }));
    expect(d.note.at(-1)).toBe(
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.",
    );
  });

  /*
   * B4 verifica aici „notele rămân cele două de dinainte”. Din E11 notele sunt
   * trei — art. 119, programul cu zilele marcate, legenda —, deci se verifică
   * ce voia B4 de fapt: fără tăiere, nicio notă de listă.
   */
  it("fără tăiere, nicio notă de listă tăiată", () => {
    const d = condicaDinParametri(new URLSearchParams({ angajati: "Popa Ion" }));
    expect(d.note).toHaveLength(3);
    expect(d.note.join(" ")).not.toMatch(/nu apar aici/u);
  });

  it("condica e mărginită la intrare enormă", () => {
    const q = new URLSearchParams({
      an: "9999",
      luna: "13",
      angajati: Array.from({ length: 10_000 }, (_, i) => `Om ${String(i)}`).join("\n"),
      firma: "F".repeat(5000),
    });
    const p = parametriCondica(q);
    expect(p.angajati.length).toBeLessThanOrEqual(60);
    expect(p.an).toBeGreaterThanOrEqual(2020);
    expect(p.an).toBeLessThanOrEqual(2035);
    expect(p.luna).toBeGreaterThanOrEqual(1);
    expect(p.luna).toBeLessThanOrEqual(12);
    expect(p.antet.firma.length).toBeLessThanOrEqual(120);
    const d = condicaDinParametri(q);
    expect(new Set(d.randuri.map((r) => r[1])).size).toBeLessThanOrEqual(60 + 31);
  });

  it("nicio etichetă și niciun conținut tipic nu se taie în PDF", async () => {
    const d = condicaDocument(parametri({}));
    const { fonturi } = await pornesteDocument("proba", "proba");
    const latimi = latimiColoane(d);
    const corp: Readonly<Record<number, readonly string[]>> = {
      0: ["31.12.2026"],
      1: ["Țăranu Ioana-Maria", "Sâmbătă — zi de repaus", "Ziua Națională a României"],
      8: ["CFS", "SL"],
    };
    const prea: string[] = [];
    d.coloane.forEach((c, i) => {
      const loc = (latimi[i] ?? 0) - 4;
      for (const linie of c.eticheta.split("\n")) {
        if (fonturi.aldin.widthOfTextAtSize(linie, 8) > loc) prea.push(`antet „${linie}”`);
      }
      for (const t of corp[i] ?? []) {
        if (fonturi.normal.widthOfTextAtSize(t, 8) > loc) prea.push(`coloana ${String(i)}: „${t}”`);
      }
    });
    expect(prea).toEqual([]);
  });
});
