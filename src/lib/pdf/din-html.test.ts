// src/lib/pdf/din-html.test.ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { curataHtml } from "@/lib/documents/curata-html";

import { inSegmente, pdfDinDocument } from "./din-html";

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

  /*
   * Timeout explicit, nu implicitul de 5 s al vitest.
   *
   * Cazul ăsta încadrează ~150 de rânduri și încorporează fontul cu diacritice
   * la fiecare rulare. În izolare durează ~1,5 s; în suita întreagă, cu
   * lucrătorii în paralel pe aceeași mașină, a atins 5364 ms și a picat pe
   * TIMEOUT — nu pe aserțiune. Un test care pică după cât de ocupată e mașina
   * învață pe toată lumea să reruleze suita până iese verde.
   */
  it("rupe textul lung pe mai multe pagini", { timeout: 30_000 }, async () => {
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

  it("încorporează fontul aldin când textul are `<strong>`", async () => {
    /*
     * De când firmele își editează singure șabloanele, bara editorului are un
     * buton de îngroșare. Până la `paragrafBogat`, `decodeaza` ștergea TOATE
     * etichetele, deci `<strong>` ajungea text simplu: formatarea se vedea pe
     * ecran și dispărea de pe hârtie, fără niciun mesaj.
     *
     * Fonturile se încorporează subsetate și DOAR dacă sunt folosite, deci
     * prezența celui aldin se vede în dimensiune. Fără randarea aldinelor, cele
     * două PDF-uri de mai jos ar fi fost practic identice.
     */
    const cuAldin = await pdfDinDocument({
      ...BAZA,
      html: "<p>Salariul de bază este <strong>5.000 lei</strong> pe lună.</p>",
    });
    const faraAldin = await pdfDinDocument({
      ...BAZA,
      html: "<p>Salariul de bază este 5.000 lei pe lună.</p>",
    });
    expect(esteePdf(cuAldin)).toBe(true);
    expect(cuAldin.length).toBeGreaterThan(faraAldin.length);
  });

  it("randează `<strong>` și în elementele de listă", async () => {
    const octeti = await pdfDinDocument({
      ...BAZA,
      html: "<ul><li>Concediu de <strong>21 de zile</strong></li><li>Tichete</li></ul>",
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

/**
 * Tăierea pe `<strong>`, testată direct.
 *
 * Diferența dintre „este 5.000 lei" și „este5.000lei" NU se vede în
 * dimensiunea PDF-ului: se desenează aceleași glife, doar la alte coordonate.
 * Un test pe octeți ar fi trecut și cu spațiile pierdute — de aceea funcția e
 * exportată și verificată ca funcție pură.
 */
describe("inSegmente", () => {
  it("păstrează spațiile de la granițele lui `<strong>`", () => {
    expect(inSegmente("este <strong>5.000</strong> lei")).toEqual([
      { text: "este ", aldin: false },
      { text: "5.000", aldin: true },
      { text: " lei", aldin: false },
    ]);
  });

  it("nu inventează spații acolo unde nu erau", () => {
    // `text<strong>aldin</strong>` e UN cuvânt cu două greutăți. Dacă tăierea
    // ar adăuga un spațiu, contractul ar scrie „text aldin".
    expect(inSegmente("este<strong>5.000</strong>lei")).toEqual([
      { text: "este", aldin: false },
      { text: "5.000", aldin: true },
      { text: "lei", aldin: false },
    ]);
  });

  it("sare peste bucățile goale", () => {
    expect(inSegmente("<strong>doar aldin</strong>")).toEqual([
      { text: "doar aldin", aldin: true },
    ]);
  });

  it("decodează entitățile în fiecare bucată", () => {
    expect(inSegmente("<strong>Ionescu &amp; Fiii</strong>")).toEqual([
      { text: "Ionescu & Fiii", aldin: true },
    ]);
  });

  it("acceptă mai multe porțiuni aldine în același paragraf", () => {
    expect(inSegmente("a <strong>b</strong> c <strong>d</strong>")).toEqual([
      { text: "a ", aldin: false },
      { text: "b", aldin: true },
      { text: " c ", aldin: false },
      { text: "d", aldin: true },
    ]);
  });

  it("întoarce o singură bucată normală când nu există `<strong>`", () => {
    expect(inSegmente("text simplu")).toEqual([{ text: "text simplu", aldin: false }]);
  });
});

/**
 * CONTRACTUL DINTRE EDITOR, CURĂȚARE ȘI PDF.
 *
 * Cele trei trebuie să acopere aceeași mulțime de etichete. Dacă `curataHtml`
 * lasă să treacă ceva ce `din-html` nu randează, utilizatorul formatează în
 * editor, salvarea acceptă, iar formatarea dispare de pe hârtie — fără nicio
 * eroare, nicăieri. Exact felul de defect tăcut pe care nimic nu-l prinde până
 * când cineva compară ecranul cu PDF-ul tipărit.
 */
describe("editor → curățare → PDF", () => {
  it("randează tot ce poate produce curățarea", async () => {
    const dinEditor =
      "<h2>Art. 1 — Obiectul</h2>" +
      "<p>Salariul de bază este <strong>{{salariu_brut}}</strong> lei.<br>Plata se face lunar.</p>" +
      "<ul><li>concediu de <strong>21</strong> de zile</li><li>tichete de masă</li></ul>" +
      "<ol><li>primul termen</li></ol>";

    // Ce iese din curățare e EXACT ce s-a scris: nimic din marcajul de mai sus
    // nu e în afara mulțimii de șapte.
    const curat = curataHtml(dinEditor);
    expect(curat).toBe(dinEditor);

    const octeti = await pdfDinDocument({ ...BAZA, html: curat });
    expect(esteePdf(octeti)).toBe(true);
  });

  it("nu lasă marcaj ostil să ajungă până la randare", async () => {
    const curat = curataHtml('<p>bun</p><script>alert(1)</script><img src=x onerror="alert(1)">');
    expect(curat).toBe("<p>bun</p>");
    expect(esteePdf(await pdfDinDocument({ ...BAZA, html: curat }))).toBe(true);
  });
});
