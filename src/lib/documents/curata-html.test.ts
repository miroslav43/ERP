// src/lib/documents/curata-html.test.ts
import { describe, expect, it } from "vitest";

import { curataHtml, variabileFolosite } from "./curata-html";

/**
 * POARTA XSS.
 *
 * `curataHtml` e singurul lucru care stă între ce tastează un `org_admin` în
 * editor și `paginaTiparibila`, care inserează `continut_html` BRUT într-o
 * pagină servită de `/documente/[id]` (`generator.ts:142`). Un test care doar
 * verifică drumul fericit („`<p>` rămâne `<p>`") ar fi verde și inutil.
 *
 * Regula pe care o apără testele de mai jos: în ieșire nu există niciodată un
 * `<` care să nu fie începutul uneia dintre cele șapte etichete permise, și nu
 * există NICIUN atribut.
 */

/** Orice `<` rămas trebuie să fie una dintre cele șapte etichete, fără atribute. */
function doarEticheteCunoscute(html: string): boolean {
  return html.replace(/<\/?(?:h2|p|ul|ol|li|strong|br)>/gu, "").indexOf("<") === -1;
}

describe("curataHtml — marcaj ostil", () => {
  const ATACURI: readonly (readonly [string, string])[] = [
    ["script simplu", "<p>bun</p><script>alert(1)</script>"],
    ["script cu atribute", '<script type="text/javascript" src="//x.tld/a.js"></script>'],
    ["script neînchis", "<p>bun</p><script>alert(1)"],
    ["img cu onerror", '<img src=x onerror="alert(1)">'],
    ["svg cu script", "<svg><script>alert(1)</script></svg>"],
    ["iframe", '<iframe src="//x.tld"></iframe>'],
    ["object și embed", '<object data="x"></object><embed src="y">'],
    ["link javascript:", '<a href="javascript:alert(1)">clic</a>'],
    ["atribut pe etichetă permisă", '<p onclick="alert(1)" style="x">text</p>'],
    ["atribut cu > în ghilimele", '<p title="a>b">text</p>'],
    ["style cu expression", "<style>body{background:url(javascript:alert(1))}</style>"],
    ["etichetă ruptă în două", "<scr<script>ipt>alert(1)</script>"],
    ["majuscule și spații", "<SCRIPT >alert(1)</SCRIPT >"],
    ["comentariu condiționat", "<!--[if IE]><script>alert(1)</script><![endif]-->"],
    ["doctype și meta", '<!doctype html><meta http-equiv="refresh" content="0;url=//x">'],
    ["formular", '<form action="//x"><input name="p" type="password"></form>'],
    ["entitate în două trepte", "<p>&amp;lt;script&amp;gt;</p>"],
    ["CDATA", "<![CDATA[<script>alert(1)</script>]]>"],
  ];

  it.each(ATACURI)("neutralizează: %s", (_nume, ostil) => {
    const curat = curataHtml(ostil);

    expect(curat, `A rămas marcaj necunoscut în: ${curat}`).toSatisfy(doarEticheteCunoscute);
    expect(curat.toLowerCase()).not.toContain("<script");
    expect(curat.toLowerCase()).not.toContain("javascript:");
    expect(curat.toLowerCase()).not.toContain("onerror");
    expect(curat.toLowerCase()).not.toContain("onclick");
  });

  it("aruncă și CONȚINUTUL unui `<script>`, nu doar etichetele", () => {
    // Dacă s-ar scoate doar etichetele, „alert(1)" ar rămâne text vizibil în
    // contract: inofensiv, dar absurd pe hârtie.
    expect(curataHtml("<p>bun</p><script>alert(1)</script>")).toBe("<p>bun</p>");
  });

  it("nu copiază niciun atribut de pe o etichetă permisă", () => {
    expect(curataHtml('<p class="x" onclick="alert(1)">text</p>')).toBe("<p>text</p>");
  });
});

describe("curataHtml — marcaj legitim", () => {
  it("păstrează cele șapte etichete", () => {
    const brut =
      "<h2>Art. 1</h2><p>Salariul este <strong>5.000</strong> lei.<br>Plata lunar.</p>" +
      "<ul><li>concediu</li><li>tichete</li></ul><ol><li>primul</li></ol>";
    expect(curataHtml(brut)).toBe(brut);
  });

  it("lasă `{{variabilele}}` neatinse", () => {
    expect(curataHtml("<p>Salariul de bază este {{salariu_brut}}.</p>")).toBe(
      "<p>Salariul de bază este {{salariu_brut}}.</p>",
    );
  });

  it("nu evadează de două ori", () => {
    // Ieșirea editorului e deja evadată. Fără decodare înainte de reevadare,
    // „Ionescu & Fiii" ar ajunge pe hârtie „Ionescu &amp; Fiii".
    expect(curataHtml("<p>Ionescu &amp; Fiii</p>")).toBe("<p>Ionescu &amp; Fiii</p>");
  });

  it("e idempotent", () => {
    // Șablonul se salvează de mai multe ori. Dacă o a doua trecere schimba
    // rezultatul, textul s-ar degrada la fiecare salvare.
    const brut = '<h2>Titlu</h2><p onclick="x">A &amp; B</p><ul><li>unu</li></ul>';
    const odata = curataHtml(brut);
    expect(curataHtml(odata)).toBe(odata);
  });

  it("împachetează în `<p>` textul rămas fără bloc", () => {
    // Cine lipește din Word trimite adesea rânduri fără nicio etichetă.
    // Aruncarea lor tăcută ar fi cel mai prost răspuns posibil.
    expect(curataHtml("Text lipit fără etichete")).toBe("<p>Text lipit fără etichete</p>");
  });

  it("închide etichetele lăsate deschise", () => {
    // `din-html.ts` caută `<p>…</p>` cu o expresie regulată: un `<p>` neînchis
    // ar face paragraful invizibil în PDF, fără nicio eroare.
    expect(curataHtml("<p>neînchis")).toBe("<p>neînchis</p>");
  });

  it("desface blocurile imbricate", () => {
    expect(curataHtml("<p>unu<p>doi</p>")).toBe("<p>unu</p><p>doi</p>");
  });

  it("aplatizează listele imbricate fără să piardă text", () => {
    const curat = curataHtml("<ul><li>a<ul><li>b</li></ul></li></ul>");
    expect(curat).toContain("a");
    expect(curat).toContain("b");
    expect(curat).toSatisfy(doarEticheteCunoscute);
  });

  it("scoate `<li>` de la rădăcină, dar păstrează textul", () => {
    expect(curataHtml("<li>fără listă</li>")).toBe("<p>fără listă</p>");
  });

  it("elimină blocurile rămase goale", () => {
    expect(curataHtml("<p></p><ul></ul><p>text</p>")).toBe("<p>text</p>");
  });

  it("întoarce șirul gol pentru intrare goală sau doar marcaj", () => {
    expect(curataHtml("")).toBe("");
    expect(curataHtml("<script>alert(1)</script>")).toBe("");
  });
});

describe("variabileFolosite", () => {
  it("le găsește o singură dată, în ordinea apariției", () => {
    expect(variabileFolosite("<p>{{b}} {{a}} {{b}}</p>")).toEqual(["b", "a"]);
  });

  it("acceptă spațiile din interiorul acoladelor", () => {
    // `RE_VARIABILA` din `generator.ts:29` le acceptă, deci și validarea
    // trebuie: altfel `{{ nume }}` ar trece de salvare și ar cădea la emitere.
    expect(variabileFolosite("<p>{{  angajat_nume  }}</p>")).toEqual(["angajat_nume"]);
  });

  it("nu întoarce nimic dintr-un text fără variabile", () => {
    expect(variabileFolosite("<p>text simplu</p>")).toEqual([]);
  });
});
