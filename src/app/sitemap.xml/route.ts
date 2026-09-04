import { intrariSitemap } from "@/content/landing/harta";

/**
 * `sitemap.xml`, scris de mână în loc de generatorul din Next.
 *
 * ── DE CE NU `app/sitemap.ts` ─────────────────────────────────────────────
 * Generatorul din Next emite XML-ul singur și nu lasă loc pentru instrucțiunea
 * de procesare care leagă foaia de stil. Fără ea, fișierul deschis în browser e
 * un perete de text — `xmlns:xhtml`, necesar pentru hreflang, dezactivează
 * vizualizatorul XML implicit din Chrome. Verificat cu reproducere minimă: două
 * fișiere identice în afară de spațiul de nume, unul pornește vizualizatorul,
 * celălalt nu.
 *
 * Ce se pierde: nimic. Ce se câștigă: o pagină care se citește de om, și o
 * ordine a elementelor pe care o controlăm.
 *
 * ── ESCAPAREA ─────────────────────────────────────────────────────────────
 * Adresele de azi n-au niciun caracter special, dar `&` într-un `<loc>` rupe
 * documentul, iar un sitemap invalid nu e citit deloc — nu parțial. Escapăm
 * întotdeauna, ca să nu depindă de ce cale se adaugă mâine.
 */

export const dynamic = "force-static";

/** Cele cinci caractere pe care XML le cere escapate într-un text sau atribut. */
function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET(): Response {
  const intrari = intrariSitemap();

  const randuri = intrari.map((intrare) => {
    const alternative = intrare.alternative
      .map(
        (a) => `    <xhtml:link rel="alternate" hreflang="${xml(a.limba)}" href="${xml(a.url)}"/>`,
      )
      .join("\n");

    /*
     * Ordinea elementelor nu e cosmetică.
     *
     * Schema oficială sitemaps.org 0.9 definește conținutul lui `<url>` ca o
     * SECVENȚĂ: loc, lastmod, changefreq, priority. Elementele din alt spațiu de
     * nume, cum e `xhtml:link`, nu apar deloc în ea — exemplele Google le pun
     * imediat după `<loc>`, iar Google le acceptă acolo.
     *
     * Aici stau la coadă, după elementele din schemă. Motivul e îngust: un
     * validator strict care le tolerează printr-un `xsd:any` le tolerează la
     * sfârșit, nu la mijlocul secvenței. Google acceptă ambele forme, deci forma
     * asta e acceptată de mai mulți fără să piardă nimic.
     */
    return [
      "  <url>",
      `    <loc>${xml(intrare.url)}</loc>`,
      `    <lastmod>${xml(intrare.lastModified)}</lastmod>`,
      /*
       * `<changefreq>` NU se emite.
       *
       * Documentația Google spune, textual: „Google ignores <priority> and
       * <changefreq> values." Nici foaia noastră de stil nu-l folosește, deci
       * nu-l citește absolut nimeni — e o declarație despre viitor pe care
       * nimeni n-o verifică și nimeni n-o consumă.
       *
       * `<priority>` rămâne, dintr-un motiv concret, nu din obișnuință: îl
       * citește `sitemap.xsl`, care desenează din el bara de importanță din
       * pagina randată. E ierarhia NOASTRĂ, scrisă o dată și vizibilă, nu o
       * încercare de a instrui un motor de căutare.
       */
      `    <priority>${intrare.priority.toFixed(1)}</priority>`,
      alternative,
      "  </url>",
    ]
      .filter((linie) => linie !== "")
      .join("\n");
  });

  const corp = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    // Legătura către foaia de stil. Trebuie să stea ÎNAINTEA elementului
    // rădăcină, imediat după declarația XML.
    '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...randuri,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(corp, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
