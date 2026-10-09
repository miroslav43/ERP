import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { pornesteDocument } from "@/lib/pdf/document";
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";
import { latimiColoane, randeazaPdfMultiplu } from "@/lib/unelte/pdf";

import { construiesteFoaie, normalizeazaAngajati } from "./foaie";
import {
  documenteleFoii,
  fisaIndividualaCaDocument,
  foaieCaDocument,
  pontajColectivCaDocument,
} from "./foaie-document";
import { construiestePontaj, parametriPontaj } from "./pontaj";

describe("foaia de pontaj ca document", () => {
  it("are o coloană pe zi, plus numele și totalul, și umbrește weekendurile și sărbătorile", () => {
    // Decembrie 2026: 1 dec (Ziua Națională, marți), 25–26 dec (Crăciun).
    const foaie = construiesteFoaie(2026, 12, ["Popa Ion"], 8);
    const d = foaieCaDocument(foaie);
    expect(d.coloane).toHaveLength(31 + 2);
    // Pe două rânduri: „12 M” nu încape pe o coloană de zi în A4 peisaj și se
    // tăia în „1…” — văzut în PDF-ul randat, nu presupus.
    expect(d.coloane[1]?.eticheta).toBe("1\nM");
    expect(d.umbrite).toContain(1); // 1 decembrie, sărbătoare
    expect(d.umbrite).toContain(5); // 5 decembrie, sâmbătă
    expect(d.umbrite).not.toContain(2); // 2 decembrie, miercuri lucrătoare
    expect(d.randuri[0]?.[0]).toBe("Popa Ion");
    expect(d.orientare).toBe("peisaj");
    expect(d.numeFisier).toBe("pontaj-2026-12");
    expect(d.note.join(" ")).toMatch(/Crăciun/u);
  });
});

describe("numele angajaților", () => {
  it("sunt tăiate la 80 de caractere, ca HTML-ul și fișierele să rămână identice și ieftine", () => {
    const nume = normalizeazaAngajati("a".repeat(8000));
    expect(nume[0]).toHaveLength(80);
  });
});

const pontaj = (q: Record<string, string>) =>
  construiestePontaj(parametriPontaj(new URLSearchParams({ an: "2026", luna: "12", ...q })));

/**
 * Lățimile se aleg pe fontul REAL (DejaVu 8 pt): `taie` taie la `w − 4`, iar o
 * etichetă tăiată („Ore\nnoap…”) e un cap de tabel pe care nu-l mai citește
 * nimeni. Întoarce lista celor care nu încap, ca eșecul să le numească.
 */
async function prealungi(
  d: DocumentTabelar,
  corp: Readonly<Record<number, readonly string[]>>,
): Promise<string[]> {
  const { fonturi } = await pornesteDocument("proba", "proba");
  const latimi = latimiColoane(d);
  const prea: string[] = [];
  d.coloane.forEach((c, i) => {
    const loc = (latimi[i] ?? 0) - 4;
    for (const linie of c.eticheta.split("\n")) {
      if (fonturi.aldin.widthOfTextAtSize(linie, 8) > loc) prea.push(`antet „${linie}”`);
    }
    for (const text of corp[i] ?? []) {
      if (fonturi.normal.widthOfTextAtSize(text, 8) > loc)
        prea.push(`coloana ${String(i)}: „${text}”`);
    }
  });
  return prea;
}

describe("foaia colectivă", () => {
  it("are numele, h/zi, o coloană pe zi și totalurile pe ore și pe coduri", () => {
    const d = pontajColectivCaDocument(pontaj({ angajati: "Popa Ion\nIlie Maria | 4" }));
    expect(d.coloane).toHaveLength(2 + 31 + 8);
    expect(d.coloane.slice(-8).map((c) => c.eticheta)).toEqual([
      "Ore\nlucr.",
      "Ore\nsupl.",
      "Ore\nnoapte",
      "CO",
      "CM",
      "CFS",
      "AN",
      "D",
    ]);
    expect(d.coloane[2]?.eticheta).toBe("1\nM");
    const [popa, ilie] = d.randuri;
    expect(popa?.slice(0, 2)).toEqual(["Popa Ion", "8"]);
    expect(ilie?.slice(0, 2)).toEqual(["Ilie Maria", "4"]);
    expect(ilie?.[2]).toBe("SL"); // 1 decembrie
    expect(ilie?.[3]).toBe(""); // 2 decembrie, miercuri
    expect(ilie?.[6]).toBe("L"); // 5 decembrie, sâmbătă
    expect(d.umbrite).toContain(2);
    expect(d.umbrite).toContain(6);
    expect(d.umbrite).not.toContain(3);
    expect(d.subtitlu).toContain("21 de zile lucrătoare");
    expect(d.note.join(" ")).toMatch(/Crăciunul/u);
    expect(d.note.join(" ")).toMatch(/CFS = concediu fără salariu/u);
    expect(d.numeFisier).toBe("pontaj-2026-12");
  });

  it("antetul firmei stă în subtitlu, înaintea normei", () => {
    const d = pontajColectivCaDocument(pontaj({ firma: "Construct SRL", cui: "14399840" }));
    expect(d.subtitlu?.startsWith("Construct SRL · CUI 14399840 — 21 de zile")).toBe(true);
  });

  it("pe ture nu se umbrește și nu se pune nimic dinainte", () => {
    const d = pontajColectivCaDocument(pontaj({ program: "ture", angajati: "Popa Ion" }));
    expect(d.umbrite).toEqual([]);
    expect(d.randuri[0]?.slice(2, 33).every((c) => c === "")).toBe(true);
  });

  it("foaia goală are rânduri fără nume și fără h/zi, de completat de mână", () => {
    const d = pontajColectivCaDocument(pontaj({}));
    expect(d.randuri).toHaveLength(10);
    expect(d.randuri[0]?.slice(0, 2)).toEqual(["", ""]);
  });

  it("nicio etichetă și niciun conținut tipic nu se taie în PDF, pe o lună de 31 de zile", async () => {
    const d = pontajColectivCaDocument(pontaj({ angajati: "Țăranu Ioana-Maria | 10:30" }));
    const zile = Object.fromEntries(
      Array.from({ length: 31 }, (_, i) => [i + 2, ["SL", "L", "12"]]),
    );
    expect(await prealungi(d, { 0: ["Țăranu Ioana-Maria"], 1: ["10:30"], ...zile })).toEqual([]);
  });
});

describe("fișa individuală", () => {
  it("are fiecare zi a lunii, cu ziua, codul pus dinainte și sărbătoarea la observații", () => {
    const d = fisaIndividualaCaDocument(pontaj({}), { nume: "Popa Ion", oreZi: 4 });
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Data",
      "Ziua",
      "Ora\nînceput",
      "Ora\nsfârșit",
      "Pauză\n(min)",
      "Ore\nlucrate",
      "Ore\nsupl.",
      "Ore\nnoapte",
      "Cod",
      "Semnătura",
      "Observații",
    ]);
    expect(d.randuri).toHaveLength(31 + 1);
    expect(d.randuri[0]).toEqual([
      "01.12",
      "Ma",
      "",
      "",
      "",
      "",
      "",
      "",
      "SL",
      "",
      "Ziua Națională a României",
    ]);
    expect(d.randuri[4]?.[8]).toBe("L"); // 5 decembrie, sâmbătă
    expect(d.randuri[31]?.[0]).toBe("Total");
    expect(d.campuri).toEqual([
      { eticheta: "Angajat", valoare: "Popa Ion" },
      {
        eticheta: "Normă",
        valoare: "4 h/zi × 21 de zile lucrătoare = 84 h · program luni–vineri",
      },
    ]);
    expect(d.orientare).toBe("portret");
  });

  it("varianta individuală dă câte o fișă pe om; fără nume, una necompletată", () => {
    const trei = documenteleFoii(
      pontaj({ varianta: "individuala", angajati: "Popa Ion\nIlie Maria | 4\nRadu Andrei" }),
    );
    expect(trei.map((d) => d.campuri[0]?.valoare)).toEqual([
      "Popa Ion",
      "Ilie Maria",
      "Radu Andrei",
    ]);
    const goala = documenteleFoii(pontaj({ varianta: "individuala" }));
    expect(goala).toHaveLength(1);
    expect(goala[0].campuri[0]?.valoare).toBe("");
    expect(documenteleFoii(pontaj({}))).toHaveLength(1); // colectiva: un singur document
  });

  it("nota lui B4 de listă tăiată: ultima pe foaia colectivă, pe prima fișă din teanc", () => {
    const multi = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");
    const NOTA =
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.";
    expect(pontajColectivCaDocument(pontaj({ angajati: multi })).note.at(-1)).toBe(NOTA);
    const fise = documenteleFoii(pontaj({ varianta: "individuala", angajati: multi }));
    expect(fise).toHaveLength(60);
    expect(fise[0].note.at(-1)).toBe(NOTA);
    expect(fise[1]?.note).not.toContain(NOTA);
    expect(pontajColectivCaDocument(pontaj({ angajati: "Popa Ion" })).note.join(" ")).not.toMatch(
      /nu apar aici/u,
    );
  });

  it("fiecare fișă încape pe O pagină A4, chiar și pe 31 de zile cu antetul cel mai lung", async () => {
    const lunga = "Societatea de Construcții și Instalații Moldova-Nord SRL ".repeat(3);
    const documente = documenteleFoii(
      pontaj({
        varianta: "individuala",
        firma: lunga,
        cui: "RO 14399840",
        compartiment: "Producție și întreținere utilaje, schimbul de noapte",
        angajati: "Popa Ion\nIlie Maria | 4\nȚăranu Ioana-Maria | 6:30",
      }),
    );
    const pdf = await PDFDocument.load(await randeazaPdfMultiplu(documente));
    expect(pdf.getPageCount()).toBe(3);
  });

  it("nicio etichetă și niciun conținut tipic nu se taie în PDF", async () => {
    const d = fisaIndividualaCaDocument(pontaj({}), { nume: "Popa Ion", oreZi: 8 });
    expect(
      await prealungi(d, { 0: ["01.12", "28.02"], 1: ["Sâ", "Du", "Mi"], 8: ["CFS", "SL"] }),
    ).toEqual([]);
  });
});
