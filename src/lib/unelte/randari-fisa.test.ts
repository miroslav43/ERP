import JSZip from "jszip";
import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { curataDocument, type DocumentTabelar } from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { imparteCelula, randeazaPdf } from "./pdf";
import { randeazaXlsx } from "./xlsx";

/**
 * Câmpurile opționale ale documentului comun cerute de fișa de evaluare:
 * coloane care se rup pe rânduri (`rupe`), rubrici de text liber și data la
 * semnături. `inaltimeRand` vine din secțiunea E (condica) și se refolosește.
 *
 * Auditul din 8 oct 2026: criteriul de 89 de caractere „Calitatea relației cu
 * clienții și respectarea termenelor de livrare stabilite prin contract” ieșea
 * în PDF „…respectarea termenelor de livr…”, deși Word-ul și pagina îl arătau
 * întreg. Angajatul semna „am luat la cunoștință” sub un criteriu tăiat.
 */
const CRITERIU_LUNG =
  "Calitatea relației cu clienții și respectarea termenelor de livrare stabilite prin contract";

const FISA: DocumentTabelar = {
  titlu: "Fișa de evaluare a performanțelor profesionale",
  subtitlu: null,
  campuri: [{ eticheta: "Angajat", valoare: "Ștefănescu-Țiriac Ana-Maria" }],
  paragrafe: [],
  coloane: [
    { eticheta: "Criteriu", latime: 6.5, rupe: true },
    { eticheta: "Pondere\n(%)", latime: 1.5 },
    { eticheta: "Nota\n(1–5)", latime: 1.5 },
    { eticheta: "Punctaj", latime: 1.5 },
    { eticheta: "Observații", latime: 4.5, rupe: true },
  ],
  randuri: [
    [CRITERIU_LUNG, "40", "4", "1,60", ""],
    ["x".repeat(120), "60", "3", "1,80", ""],
    ["Total (nota finală)", "100", "", "3,40", ""],
  ],
  umbrite: [],
  note: ["Scala notelor: 1 — mult sub cerințele postului."],
  semnaturi: ["Evaluator", "Contrasemnat (opțional)", "Angajat — am luat la cunoștință"],
  dataLaSemnaturi: true,
  inaltimeRand: 26,
  rubrici: [
    {
      titlu: "Obiective pentru perioada următoare",
      text: "Termene\nRaport lunar",
      randuriGoale: 4,
    },
    { titlu: "Comentariile angajatului", text: "", randuriGoale: 4 },
  ],
  orientare: "portret",
  numeFisier: "fisa-evaluare-test",
};

/** Tot textul desenat în PDF, în ordinea desenării (pdf-lib nu are extragere de text). */
async function texteDesenate(d: DocumentTabelar): Promise<string[]> {
  const spion = vi.spyOn(PDFPage.prototype, "drawText");
  await randeazaPdf(d);
  return spion.mock.calls.map((apel) => String(apel[0]));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("imparteCelula", () => {
  const masoara = (t: string) => Array.from(t).length * 5;

  it("rupe pe cuvinte, iar cuvântul prea lung în bucăți care încap", () => {
    const randuri = imparteCelula(`scurt ${"a".repeat(45)} final`, 100, masoara);
    for (const r of randuri) expect(masoara(r)).toBeLessThanOrEqual(100);
    expect(randuri.join("").replace(/ /gu, "")).toBe(`scurt${"a".repeat(45)}final`);
  });

  it("nu desparte o pereche surogat", () => {
    const randuri = imparteCelula("😀".repeat(30), 50, masoara);
    for (const r of randuri) expect(r).not.toMatch(/\p{Cs}/u);
    expect(randuri.join("")).toBe("😀".repeat(30));
  });
});

describe("PDF: fișa de evaluare", () => {
  it("criteriul lung apare întreg, rupt pe rânduri, fără „…”", async () => {
    const texte = await texteDesenate(FISA);
    expect(texte.join(" ")).toContain(CRITERIU_LUNG);
    expect(texte.filter((t) => t.endsWith("…"))).toEqual([]);
  });

  it("un cuvânt mai lung decât coloana se rupe în bucăți, fără nicio literă pierdută", async () => {
    const texte = await texteDesenate({ ...FISA, randuri: [["y".repeat(400), "", "", "", ""]] });
    const bucati = texte.filter((t) => /^y+$/u.test(t));
    expect(bucati.length).toBeGreaterThan(1);
    expect(bucati.join("")).toBe("y".repeat(400));
  });

  it("fără `rupe`, celula se taie ca înainte (foaia de pontaj nu se schimbă)", async () => {
    const texte = await texteDesenate({
      ...FISA,
      coloane: FISA.coloane.map((c) => ({ eticheta: c.eticheta, latime: c.latime })),
    });
    expect(texte.some((t) => t.startsWith("Calitatea relației") && t.endsWith("…"))).toBe(true);
  });

  it("o rubrică fără spații (un link lipit) se rupe pe rânduri, nu se taie", async () => {
    const texte = await texteDesenate({
      ...FISA,
      rubrici: [{ titlu: "Obiective", text: "y".repeat(300), randuriGoale: 1 }],
    });
    const bucati = texte.filter((t) => /^y+$/u.test(t));
    expect(bucati.length).toBeGreaterThan(1);
    expect(bucati.join("")).toBe("y".repeat(300));
  });

  it("rubricile și data la fiecare semnătură", async () => {
    const texte = await texteDesenate(FISA);
    expect(texte).toContain("Obiective pentru perioada următoare");
    expect(texte).toContain("Termene");
    expect(texte).toContain("Raport lunar");
    expect(texte).toContain("Comentariile angajatului");
    expect(texte.filter((t) => t.startsWith("Data: "))).toHaveLength(3);
  });

  it("un rând rupt lung trece pe pagina următoare, nu coboară în rezerva de jos", async () => {
    // ~9 rânduri de text în coloana criteriului, adică un rând de ~96 pt, mult
    // peste minimul de 26. Rândurile scurte de dinainte mută locul în care cade
    // primul rând înalt cu câte 26 pt: patru deplasări acoperă fereastra de ~70 pt
    // în care un rând înalt ar fi încăput după minim, dar nu după înălțimea lui.
    const inalt = `${CRITERIU_LUNG} `.repeat(4);
    const chenare = vi.spyOn(PDFPage.prototype, "drawRectangle");
    let pagini = 0;
    for (let scurte = 0; scurte < 4; scurte += 1) {
      const randuri = [
        ...Array.from({ length: scurte }, () => ["scurt", "", "", "", ""]),
        ...Array.from({ length: 12 }, () => [inalt, "", "", "", ""]),
      ];
      const pdf = await PDFDocument.load(await randeazaPdf({ ...FISA, rubrici: [], randuri }));
      pagini = Math.max(pagini, pdf.getPageCount());
    }
    expect(pagini).toBeGreaterThanOrEqual(2);
    // 40 pt margine + 20 pt pentru rândul de jos al fișierului.
    const jos = chenare.mock.calls.map((a) => (a[0] as { y?: number } | undefined)?.y ?? 999);
    expect(jos.filter((y) => y < 60)).toEqual([]);
  }, 20_000);

  it("fără câmpurile noi, nicio dată și nicio rubrică (celelalte unelte rămân la fel)", async () => {
    const { rubrici: _r, dataLaSemnaturi: _d, ...vechi } = FISA;
    const texte = await texteDesenate(vechi);
    expect(texte.filter((t) => t.startsWith("Data: "))).toEqual([]);
    expect(texte).not.toContain("Comentariile angajatului");
  });
});

describe("Word: fișa de evaluare", () => {
  it("rubricile și semnăturile în coloane, fiecare cu dată", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx(FISA));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain(CRITERIU_LUNG);
    expect(xml).toContain("Comentariile angajatului");
    expect(xml).toContain("Raport lunar");
    expect(xml.match(/Data: _+/gu)).toHaveLength(3);
    expect(xml.match(/Semnătura: _+/gu)).toHaveLength(3);
  });

  it("fără `dataLaSemnaturi`, semnăturile rămân pe un rând, ca înainte", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx({ ...FISA, dataLaSemnaturi: false }));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).not.toMatch(/Data: _+/u);
    expect(xml).toContain("Evaluator: ____________________");
  });
});

describe("Excel comun: rubrici și dată", () => {
  it("rubricile și rândul de dată apar și în foaia comună", async () => {
    const zip = await JSZip.loadAsync(await randeazaXlsx(FISA));
    const siruri = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    expect(siruri).toContain("Comentariile angajatului");
    expect(siruri).toContain("Raport lunar");
    expect(siruri).toContain("Data: ______________");
  });
});

describe("curățarea rubricilor", () => {
  it("rubricile trec prin aceeași curățare ca restul textului", () => {
    const curat = curataDocument({
      ...FISA,
      rubrici: [{ titlu: "Obiective\u000b2027", text: "Raport\r\nlunar\u0000", randuriGoale: 2 }],
    });
    expect(curat.rubrici).toEqual([
      { titlu: "Obiective 2027", text: "Raport\nlunar", randuriGoale: 2 },
    ]);
  });

  it("un document fără rubrici nu le capătă la curățare", () => {
    const { rubrici: _r, ...fara } = FISA;
    expect("rubrici" in curataDocument(fara)).toBe(false);
  });
});
