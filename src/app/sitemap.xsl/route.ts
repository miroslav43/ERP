/**
 * Foaia de stil a lui `sitemap.xml`.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Spațiul de nume `xhtml`, pe care îl folosim pentru hreflang, dezactivează
 * vizualizatorul XML implicit din Chrome — verificat cu reproducere minimă:
 * două fișiere identice în afară de `xmlns:xhtml`, cel fără pornește
 * vizualizatorul, cel cu el nu. Rezultatul, în browser, e un perete de text.
 *
 * Leacul nu e scoaterea hreflang-ului, care e informație reală pentru motoare,
 * ci o foaie proprie. Ea bate oricum vizualizatorul implicit, arată la fel în
 * toate browserele și poate spune lucruri pe care acela nu le știe — de pildă
 * câte traduceri are un rând.
 *
 * ── DE CE RUTĂ ȘI NU FIȘIER ÎN `public/` ──────────────────────────────────
 * Un browser aplică o foaie XSLT numai dacă vine cu un tip de conținut din
 * familia XML — `text/xsl` sau `application/xslt+xml`. Ce tip pune un server
 * static pentru extensia `.xsl` variază, iar când greșește nu apare nicio
 * eroare: pagina arată exact ca înainte, adică nestilizată. Aici tipul e scris
 * explicit, deci nu depinde de nimeni.
 *
 * ── DE CE GRUPAREA SE CALCULEAZĂ AICI ─────────────────────────────────────
 * Secțiunile („Obligații legale", „Domenii") sunt prezentare, nu date pentru
 * motoare. Emise în XML ar fi cerut un spațiu de nume privat într-un document
 * al cărui rost e să fie citit de mașini. Se deduc din prefixul adresei, în
 * stratul căruia îi aparțin. Ordinea rândurilor vine din `harta.ts` și e păzită
 * de un test, ca grupele să iasă adiacente.
 */

export const dynamic = "force-static";

const XSL = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <!-- Eticheta grupei, dedusă din prefixul adresei. -->
  <xsl:template name="sectiune">
    <xsl:param name="u"/>
    <xsl:choose>
      <xsl:when test="contains($u, '/legal/')">Legal</xsl:when>
      <xsl:when test="contains($u, '/domenii')">Domenii</xsl:when>
      <xsl:when test="contains($u, '/ghid/') or contains($u, '/reges-online') or contains($u, '/evidenta-orelor')">Obligații legale</xsl:when>
      <xsl:when test="contains($u, '/unelte/') or contains($u, '/comparatie/')">Unelte și comparații</xsl:when>
      <xsl:when test="contains($u, '/incredere') or contains($u, '/intrebari') or contains($u, '/de-ce-nu')">Înainte să întrebi</xsl:when>
      <xsl:otherwise>Principale</xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="/">
    <html lang="ro">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex, follow"/>
        <title>Harta sitului · Administrativo</title>
        <style>
          :root {
            --hartie: #ecefec; --cerneala: #0e1c21; --text: #16262b;
            --slab: #4a5a5e; --rigla: #7b8982; --liniatura: #c9d2cd;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0; background: var(--hartie); color: var(--text);
            font: 15px/1.55 "Fira Sans Condensed", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
            -webkit-font-smoothing: antialiased;
          }
          .invelis { max-width: 1180px; margin: 0 auto; padding: 0 clamp(1rem, 4vw, 2.5rem); }
          header { background: var(--cerneala); color: var(--hartie); padding: 2.75rem 0 2.25rem; }
          .marca { font-size: .6875rem; letter-spacing: .14em; text-transform: uppercase; opacity: .72; }
          h1 { font-size: clamp(1.6rem, 3.2vw, 2.4rem); line-height: 1.06; margin: .6rem 0 0; font-weight: 600; letter-spacing: -.015em; }
          .lead { margin: .85rem 0 0; max-width: 62ch; opacity: .78; font-size: .9375rem; line-height: 1.6; }
          .cifre { display: flex; flex-wrap: wrap; gap: 2.25rem; margin-top: 1.75rem; }
          .cifra b { display: block; font-size: 1.5rem; font-weight: 600; font-variant-numeric: tabular-nums; }
          .cifra span { font-size: .6875rem; letter-spacing: .1em; text-transform: uppercase; opacity: .66; }
          main { padding: 2.5rem 0 4rem; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: .6875rem; letter-spacing: .12em; text-transform: uppercase; color: var(--slab); font-weight: 500; padding: 0 .9rem .6rem 0; border-bottom: 1px solid var(--rigla); }
          td { padding: .62rem .9rem .62rem 0; border-bottom: 1px solid var(--liniatura); vertical-align: baseline; }
          tr.grupa td { border-bottom: none; padding: 1.9rem 0 .5rem; }
          tr.grupa span { font-size: .6875rem; letter-spacing: .14em; text-transform: uppercase; color: var(--slab); font-weight: 500; }
          tr:hover td { background: rgba(14, 28, 33, .025); }
          a { color: var(--text); text-decoration: none; border-bottom: 1px solid var(--rigla); }
          a:hover { border-bottom-color: var(--text); }
          .data, .prio { font-variant-numeric: tabular-nums; color: var(--slab); font-size: .875rem; white-space: nowrap; }
          .bara { display: inline-block; width: 74px; height: 4px; background: var(--liniatura); vertical-align: middle; margin-right: .55rem; }
          .bara i { display: block; height: 100%; background: var(--cerneala); }
          .limbi { font-size: .75rem; color: var(--slab); letter-spacing: .04em; white-space: nowrap; }
          footer { border-top: 1px solid var(--rigla); padding: 1.5rem 0 3rem; color: var(--slab); font-size: .8125rem; line-height: 1.65; }
          footer a { color: var(--slab); }
          /* Adresele lungi sunt un singur „cuvânt" pentru browser: fără o regulă
             de rupere, tabelul depășește ecranul și târăște toată pagina. */
          td a { word-break: break-all; }
          @media (max-width: 720px) {
            th:nth-child(3), td:nth-child(3), th:nth-child(4), td:nth-child(4) { display: none; }
            table { table-layout: fixed; }
            td, th { padding-right: 0; }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="invelis">
            <p class="marca">Administrativo</p>
            <h1>Harta sitului</h1>
            <p class="lead">
              Fișierul ăsta e scris pentru motoarele de căutare. Pagina pe care o vezi e
              aceleași date, aranjate ca să se citească și de om. Nu e o pagină de navigare —
              nu e legată din site și nu e indexată.
            </p>
            <div class="cifre">
              <div class="cifra">
                <b><xsl:value-of select="count(s:urlset/s:url)"/></b>
                <span>adrese</span>
              </div>
              <div class="cifra">
                <b><xsl:value-of select="count(s:urlset/s:url[xhtml:link])"/></b>
                <span>cu traducere</span>
              </div>
              <div class="cifra">
                <b>
                  <!-- Cea mai mare dată, nu data primului rând. Ordinea din
                       fișier e tematică, nu cronologică, deci [1] arăta pur și
                       simplu altceva decât spunea eticheta. Datele ISO se
                       compară corect ca șiruri, deci o sortare descrescătoare
                       ajunge. -->
                  <xsl:for-each select="s:urlset/s:url">
                    <xsl:sort select="s:lastmod" order="descending"/>
                    <xsl:if test="position() = 1">
                      <xsl:value-of select="substring(s:lastmod, 1, 10)"/>
                    </xsl:if>
                  </xsl:for-each>
                </b>
                <span>cea mai recentă schimbare</span>
              </div>
            </div>
          </div>
        </header>

        <main class="invelis">
          <table>
            <thead>
              <tr>
                <th>Adresă</th>
                <th>Actualizat</th>
                <th>Prioritate</th>
                <th>Limbi</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="s:urlset/s:url">
                <xsl:variable name="eticheta">
                  <xsl:call-template name="sectiune">
                    <xsl:with-param name="u" select="s:loc"/>
                  </xsl:call-template>
                </xsl:variable>
                <xsl:variable name="anterioara">
                  <xsl:call-template name="sectiune">
                    <xsl:with-param name="u" select="preceding-sibling::s:url[1]/s:loc"/>
                  </xsl:call-template>
                </xsl:variable>

                <!-- Testul pe position() nu e redundant: pentru primul rând,
                     preceding-sibling e gol, iar șablonul întoarce pe el ramura
                     implicită — aceeași etichetă ca a primului rând. Cele două
                     se potriveau, deci primul cap de grupă lipsea. -->
                <xsl:if test="position() = 1 or $eticheta != $anterioara">
                  <tr class="grupa">
                    <td colspan="4"><span><xsl:value-of select="$eticheta"/></span></td>
                  </tr>
                </xsl:if>

                <tr>
                  <td>
                    <a href="{s:loc}"><xsl:value-of select="s:loc"/></a>
                  </td>
                  <td class="data"><xsl:value-of select="substring(s:lastmod, 1, 10)"/></td>
                  <td class="prio">
                    <span class="bara"><i style="width: {s:priority * 100}%"></i></span>
                    <xsl:value-of select="s:priority"/>
                  </td>
                  <td class="limbi">
                    <xsl:choose>
                      <xsl:when test="xhtml:link">
                        <xsl:for-each select="xhtml:link[@hreflang != 'x-default']">
                          <xsl:if test="position() &gt; 1"> · </xsl:if>
                          <xsl:value-of select="@hreflang"/>
                        </xsl:for-each>
                      </xsl:when>
                      <xsl:otherwise>—</xsl:otherwise>
                    </xsl:choose>
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </main>

        <footer class="invelis">
          <p>
            Sitemap conform protocolului sitemaps.org 0.9, cu alternative
            <code>hreflang</code> declarate pe rând, reciproc și cu
            <code>x-default</code>. Pentru rezumatul în text al sitului, vezi
            <a href="/llms.txt">/llms.txt</a>; pentru regulile de crawlare,
            <a href="/robots.txt">/robots.txt</a>.
          </p>
          <p>
            Coloana de prioritate e ierarhia noastră, pentru citit. Google
            declară că ignoră <code>priority</code>, iar <code>changefreq</code>
            nu e emis deloc, tocmai fiindcă nu-l citește nimeni. Ce contează
            pentru motoare sunt adresele și <code>lastmod</code> — scris de mână
            la fiecare schimbare reală de conținut, ca să rămână o dată în care
            se poate avea încredere.
          </p>
          <p>Înapoi la <a href="/">administrativo.ro</a>.</p>
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;

export function GET(): Response {
  return new Response(XSL, {
    headers: {
      // `text/xsl` e tipul pe care îl acceptă toate browserele pentru XSLT
      // legat printr-o instrucțiune `xml-stylesheet`. Un tip greșit nu produce
      // nicio eroare vizibilă — pagina rămâne pur și simplu nestilizată.
      "content-type": "text/xsl; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
