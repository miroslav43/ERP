import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { pornesteDocument } from "@/lib/pdf/document";

import { SEMNATURA_FISIER } from "./document-tabelar";
import type { Scrisoare } from "./scrisoare";
import {
  asezaScrisoarea,
  LATIME_PAGINA,
  MARGINE_SCRISOARE,
  type OperatieText,
} from "./scrisoare-asezare";
import { randeazaScrisoareDocx } from "./scrisoare-docx";
import { randeazaScrisoarePdf } from "./scrisoare-pdf";

const S: Scrisoare = {
  titluDocument: "Cerere de concediu de odihnă",
  inregistrare: "Nr. înregistrare ________ din ____________",
  catre: "Către: Ștefan Țepeș SRL",
  titlu: "CERERE",
  subtitlu: "de concediu de odihnă",
  paragrafe: [
    "Subsemnatul/Subsemnata Popa\u000BIon, angajat(ă) în funcția de operator, vă rog să binevoiți a-mi aproba efectuarea concediului de odihnă aferent anului 2026, în perioada 16.11.2026 – 20.11.2026 inclusiv, reprezentând 5 zile lucrătoare.",
  ],
  locSiData: "Arad, 08.10.2026",
  semnatura: "Semnătura salariatului",
  rubrica: {
    titlu: "Se completează de angajator",
    randuri: ["☐ Se aprobă / ☐ Nu se aprobă", "Zile rămase după această cerere: ________"],
    semnaturi: ["Șef ierarhic", "Resurse umane", "Conducătorul unității"],
  },
  note: ["Temeiul — art. 145 alin. (3) din Codul muncii."],
  numeFisier: "cerere-odihna-2026-11-16",
  sursa: "/unelte/cerere-concediu-de-odihna",
};

const TINTA = /\/unelte\/cerere-concediu-de-odihna\?utm_source=fisier&(amp;)?utm_medium=/u;

/** Paragraful Word care conține textul dat. */
const paragraful = (xml: string, text: string) =>
  xml.split("</w:p>").find((p) => p.includes(text)) ?? "";

describe("scrisoarea în PDF", () => {
  it("o pagină A4 portret", async () => {
    const pdf = await PDFDocument.load(await randeazaScrisoarePdf(S));
    expect(pdf.getPageCount()).toBe(1);
    const pagina = pdf.getPage(0);
    expect(pagina.getHeight()).toBeGreaterThan(pagina.getWidth());
  });

  it("subsolul duce la pagina uneltei, nu la slug-ul API-ului", async () => {
    const pdf = await PDFDocument.load(await randeazaScrisoarePdf(S));
    const text = new TextDecoder("latin1").decode(await pdf.save({ useObjectStreams: false }));
    expect(text).toMatch(/\/S \/URI/u);
    expect(text).toMatch(TINTA);
  });

  it("un caracter pe care fontul nu-l are (emoji) nu oprește documentul", async () => {
    const pdf = await PDFDocument.load(
      await randeazaScrisoarePdf({ ...S, paragrafe: ["Subsemnata Ana 😀, vă rog."] }),
    );
    expect(pdf.getPageCount()).toBe(1);
  });

  it("cu fontul real și câmpurile la plafon, nimic nu iese din margini", async () => {
    // Testul cu măsura falsă nu vede lățimile DejaVu; ăsta le vede.
    const { fonturi } = await pornesteDocument("sondă", "test");
    const masoara = (t: string, marime: number, aldin: boolean) =>
      (aldin ? fonturi.aldin : fonturi.normal).widthOfTextAtSize(t, marime);
    const plafon: Scrisoare = {
      ...S,
      catre: `Către: ${"Ș".repeat(120)}`,
      paragrafe: [`Subsemnatul ${"Ă".repeat(120)}, având funcția de ${"W".repeat(80)}.`],
      locSiData: `${"Ț".repeat(60)}, 08.10.2026`,
    };
    const pagini = asezaScrisoarea(plafon, masoara);
    expect(pagini).toHaveLength(1);
    for (const o of pagini.flat().filter((x): x is OperatieText => x.tip === "text")) {
      expect(o.x, o.text).toBeGreaterThanOrEqual(MARGINE_SCRISOARE - 1e-6);
      expect(o.x + masoara(o.text, o.marime, o.aldin), o.text).toBeLessThanOrEqual(
        LATIME_PAGINA - MARGINE_SCRISOARE + 1e-6,
      );
    }
  });
});

describe("scrisoarea în Word", () => {
  it("„Către” la dreapta, titlul centrat, corpul justificat", async () => {
    const zip = await JSZip.loadAsync(await randeazaScrisoareDocx(S));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(paragraful(xml, "Către: Ștefan Țepeș SRL")).toContain('<w:jc w:val="right"/>');
    expect(paragraful(xml, ">CERERE<")).toContain('<w:jc w:val="center"/>');
    expect(paragraful(xml, "Subsemnatul")).toContain('<w:jc w:val="both"/>');
  });

  it("rândul de marketing stă în subsolul paginii, nu în corpul semnat", async () => {
    const zip = await JSZip.loadAsync(await randeazaScrisoareDocx(S));
    expect((await zip.file("word/document.xml")?.async("string")) ?? "").not.toContain(
      SEMNATURA_FISIER,
    );
    expect((await zip.file("word/footer1.xml")?.async("string")) ?? "").toContain(SEMNATURA_FISIER);
    expect((await zip.file("word/_rels/footer1.xml.rels")?.async("string")) ?? "").toMatch(TINTA);
  });

  it("niciun caracter de control nu ajunge în XML", async () => {
    const zip = await JSZip.loadAsync(await randeazaScrisoareDocx(S));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Popa Ion");
    for (const caracter of xml) {
      const cod = caracter.codePointAt(0) ?? 0;
      expect(
        cod >= 0x20 || cod === 0x09 || cod === 0x0a || cod === 0x0d,
        `U+${cod.toString(16)}`,
      ).toBe(true);
    }
  });

  it("rubrica angajatorului are decizia și cele trei semnături", async () => {
    const zip = await JSZip.loadAsync(await randeazaScrisoareDocx(S));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    for (const t of [
      "☐ Se aprobă / ☐ Nu se aprobă",
      "Șef ierarhic",
      "Resurse umane",
      "Conducătorul unității",
    ]) {
      expect(xml, t).toContain(t);
    }
  });
});
