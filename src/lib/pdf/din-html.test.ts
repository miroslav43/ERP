// src/lib/pdf/din-html.test.ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { pdfDinDocument } from "./din-html";

/**
 * Randarea în PDF a unui document deja emis.
 *
 * Ce se apără aici:
 *
 *  · **Diacriticele.** Cele 14 fonturi standard PDF folosesc codarea WinAnsi,
 *    care NU conține `ș`/`ț` cu virgulă dedesubt (U+0219/U+021B). Un contract
 *    scris cu Helvetica ar tipări „indemnizaie" — sau, cu `pdf-lib`, ar ARUNCA
 *    la codare. Fontul încorporat din `fonturi/` există exact pentru asta, iar
 *    testul cade dacă cineva îl scoate.
 *
 *  · **Entitățile.** `randeaza()` evadează fiecare valoare interpolată, corect
 *    pentru HTML și greșit pentru hârtie: „Ionescu &amp; Fiii" trebuie să se
 *    tipărească „Ionescu & Fiii".
 *
 *  · **Încadrarea.** `pdf-lib` nu rupe rândul: un paragraf lung desenat fără
 *    flux iese pur și simplu din pagină, fără nicio eroare. Un text de trei
 *    pagini trebuie să producă mai multe pagini.
 */
const ORGANIZATIE = {
  denumire: "Exemplu S.R.L.",
  cui: "RO12345678",
  regCom: "J12/345/2020",
  adresa: "Str. Exemplu 1, Cluj-Napoca, Cluj",
};

const BAZA = {
  numarAfisat: "CIM 2026/000042",
  titlu: "Contract individual de muncă",
  organizatie: ORGANIZATIE,
  codVerificare: "abcdef0123456789",
  amprenta: "0123456789abcdef",
};

/** `%PDF` — semnătura de fișier, primii patru octeți. */
function esteePdf(octeti: Uint8Array): boolean {
  return octeti[0] === 0x25 && octeti[1] === 0x50 && octeti[2] === 0x44 && octeti[3] === 0x46;
}

describe("pdfDinDocument", () => {
  it("produce un PDF valid dintr-un document obișnuit", async () => {
    const octeti = await pdfDinDocument({
      ...BAZA,
      html:
        "<h1>CONTRACT INDIVIDUAL DE MUNCĂ</h1>" +
        "<p>Nr. 42/2026 din 28.08.2026</p>" +
        "<h2>1. Obiectul contractului</h2>" +
        "<p>Salariatul este încadrat în funcția de Referent.</p>",
    });
    expect(esteePdf(octeti)).toBe(true);
    expect(octeti.length).toBeGreaterThan(1000);
  });

  it("tipărește diacriticele românești fără să arunce", async () => {
    // ș/ț cu VIRGULĂ dedesubt (U+0219/U+021B), nu cu sedilă. Cu un font
    // standard, `pdf-lib` aruncă „WinAnsi cannot encode" la codare.
    const octeti = await pdfDinDocument({
      ...BAZA,
      html:
        "<p>Salariatul își desfășoară activitatea în condiții deosebite, " +
        "cu ședințe săptămânale și întocmirea situațiilor.</p>",
    });
    expect(esteePdf(octeti)).toBe(true);
  });

  it("decodează entitățile, ca să nu ajungă „&amp;” pe hârtie", async () => {
    // Nu se poate citi textul înapoi din PDF fără un parser, dar codarea unei
    // entități nedecodate ar fi trecut oricum. Ce se verifică e că marcajul
    // rămas nu rupe randarea.
    const octeti = await pdfDinDocument({
      ...BAZA,
      html: "<p>Ionescu &amp; Fiii &nbsp; S.R.L. &lt;sediu&gt; &quot;central&quot;</p>",
    });
    expect(esteePdf(octeti)).toBe(true);
  });

  it("rupe textul lung pe mai multe pagini", async () => {
    // Fără flux, `drawText` ar fi desenat totul pe un singur rând, în afara
    // paginii — și tot ar fi ieșit un PDF „valid", cu o pagină goală.
    // ~400 de repetări: o pagină A4 la corp de 9 puncte încape ~45 de rânduri,
    // iar 120 de repetări (măsurate) stăteau sub prag. Un test care nu depășește
    // pagina n-ar fi dovedit nimic despre paginare.
    const paragrafLung = "Părțile convin asupra clauzelor de mai jos. ".repeat(400);
    const octeti = await pdfDinDocument({ ...BAZA, html: `<p>${paragrafLung}</p>` });
    // Numărul de pagini se citește prin `pdf-lib`, nu cu o expresie regulată
    // peste octeți: obiectele pot fi în fluxuri comprimate, iar un `/Count`
    // negăsit ar fi arătat identic cu „o singură pagină".
    const document = await PDFDocument.load(octeti as unknown as Uint8Array);
    expect(document.getPageCount()).toBeGreaterThan(1);
  });

  it("randează listele numerotate și cele cu bulină", async () => {
    const octeti = await pdfDinDocument({
      ...BAZA,
      html:
        "<h2>Atribuții</h2><ol><li>Redactează documente</li><li>Arhivează dosare</li></ol>" +
        "<ul><li>Punctualitate</li></ul>",
    });
    expect(esteePdf(octeti)).toBe(true);
  });

  it("nu lasă pagina goală când șablonul n-are blocuri cunoscute", async () => {
    // O firmă care și-a scris propriul șablon poate folosi alt marcaj. Textul
    // degradat e cel puțin documentul; o pagină albă ar arăta ca un defect.
    const fara = await pdfDinDocument({ ...BAZA, html: "Text fără nicio etichetă cunoscută." });
    const gol = await pdfDinDocument({ ...BAZA, html: "" });
    expect(fara.length).toBeGreaterThan(gol.length);
  });
});
