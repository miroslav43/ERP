// src/app/(marketing)/unelte/programare-concedii/model.test.ts
import { describe, expect, it } from "vitest";

import { constructorPentru } from "@/lib/unelte/registru";

import { INTREBARI_PROGRAMARE } from "./intrebari";
import { citesteProgramare, construiesteProgramare } from "./model";

const citeste = (s: string, azi = "2026-10-08") => citesteProgramare(new URLSearchParams(s), azi);

describe("citesteProgramare", () => {
  it("în octombrie, implicit e anul următor (art. 148 alin. (1)); 20 de zile", () => {
    expect(citeste("")).toEqual({
      parametri: { an: 2027, firma: "", compartiment: "", angajati: [], zileCuvenite: 20 },
      avertismente: [],
    });
    expect(citeste("", "2026-03-01").parametri.an).toBe(2026);
  });

  it("sub minimul legal sau necitibil: 20, cu motivul", () => {
    expect(citeste("zile=15")).toMatchObject({
      parametri: { zileCuvenite: 20 },
      avertismente: [
        "Zile cuvenite: „15” nu e un număr între 20 și 60 (minimul legal e de 20 de zile lucrătoare, art. 145 alin. (1)); am folosit 20.",
      ],
    });
    expect(citeste("zile=25").parametri.zileCuvenite).toBe(25);
  });

  it("un an din afara calendarului e spus, nu înlocuit tăcut", () => {
    expect(citeste("an=2040").avertismente).toEqual([
      "Anul „2040” e în afara intervalului 2024–2035; am folosit 2027.",
    ]);
  });

  it("numele, câte unul pe rând", () => {
    expect(citeste("angajati=Popa%20Ion%0AIlie%20Maria").parametri.angajati).toEqual([
      "Popa Ion",
      "Ilie Maria",
    ]);
  });
});

describe("documentul", () => {
  const d = construiesteProgramare(
    citeste("an=2027&angajati=Popa%20Ion%0AIlie%20Maria&zile=21&firma=Administrativo%20Demo%20SRL")
      .parametri,
  );

  it("antetul are lunile cu zilele lucrătoare ale anului", () => {
    expect(d.coloane).toHaveLength(17);
    expect(d.coloane.map((c) => c.eticheta).slice(3, 15)).toEqual([
      "Ian\n18 z.l.",
      "Feb\n20 z.l.",
      "Mar\n23 z.l.",
      "Apr\n21 z.l.",
      "Mai\n20 z.l.",
      "Iun\n20 z.l.",
      "Iul\n22 z.l.",
      "Aug\n22 z.l.",
      "Sep\n22 z.l.",
      "Oct\n21 z.l.",
      "Noi\n21 z.l.",
      "Dec\n22 z.l.",
    ]);
  });

  it("un rând pe om, cu zilele cuvenite; titlul și firma", () => {
    expect(d.titlu).toBe("Programarea concediilor de odihnă pe anul 2027");
    expect(d.subtitlu).toBe("Administrativo Demo SRL");
    expect(d.randuri).toHaveLength(2);
    expect(d.randuri[0]).toEqual(["1", "Popa Ion", "21", ...Array.from({ length: 14 }, () => "")]);
    expect(d.orientare).toBe("peisaj");
  });

  it("notele: sărbătorile din zile lucrătoare și art. 148 alin. (1) și (5)", () => {
    const note = d.note.join("\n");
    expect(note).toContain("30 aprilie (Vinerea Mare)");
    expect(note).toContain("3 mai (A doua zi de Paște)");
    expect(note).not.toContain("1 mai (Ziua Muncii)"); // sâmbătă în 2027
    expect(note).toContain("art. 148 alin. (1)");
    expect(note).toContain("10 zile lucrătoare");
  });

  it("fără nume: zece rânduri goale, de completat de mână", () => {
    const gol = construiesteProgramare(citeste("an=2027").parametri);
    expect(gol.randuri).toHaveLength(10);
    expect(gol.randuri[0]?.[1]).toBe("");
    expect(gol.randuri[0]?.[2]).toBe("");
  });

  it("e servită de ruta comună", () => {
    expect(constructorPentru("programare-concedii")).toBeTypeOf("function");
  });
});

describe("întrebările paginii", () => {
  it("se termină cu „?”, răspunsurile cu punct, fără ș/ț cu sedilă", () => {
    for (const r of INTREBARI_PROGRAMARE) {
      expect(r.q).toMatch(/\?$/u);
      expect(r.a).toMatch(/\.$/u);
      expect(`${r.q}${r.a}${r.temei ?? ""}`).not.toMatch(/[\u015E\u015F\u0162\u0163]/u);
    }
  });
});
