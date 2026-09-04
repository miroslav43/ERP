# Sitemap-ul, robots.txt și Search Console

Cum e construită harta sitului, ce am verificat la sursă, și ce trebuie făcut ca
Google să ne indexeze.

Actualizat: 4 septembrie 2026.

---

## 1. Ce am verificat, și unde m-am înșelat

Punctul de plecare a fost o observație a lui Miro: `sitemap.xml` arăta în browser
ca un perete de text, în timp ce alte site-uri îl arată ca un arbore colorat.

Prima explicație plauzibilă — tipul de conținut greșit — **era falsă**. Amândouă
serveau `application/xml`. A doua — o politică de securitate a conținutului care
blochează vizualizatorul — **era și ea falsă**: niciunul din site-uri n-are CSP.

Cauza reală, izolată cu două fișiere identice în afară de o linie:

```
cu    xmlns:xhtml  →  rădăcina rămâne <urlset>, vizualizatorul NU pornește
fără  xmlns:xhtml  →  rădăcina devine <html>,   vizualizatorul pornește
```

Spațiul de nume `xhtml`, pe care îl folosim ca să declarăm alternativele
`hreflang`, dezactivează vizualizatorul XML implicit din Chrome. Sitemap-ul
nostru era, cu alte cuvinte, **mai bogat** decât cel de comparație, iar browserul
renunța tocmai din cauza asta.

Leacul corect nu e scoaterea lui `hreflang`, care e informație reală pentru
motoare, ci o foaie de stil proprie — `sitemap.xsl`. Ea bate oricum vizualizatorul
implicit, arată la fel în toate browserele, și poate spune lucruri pe care acela
nu le știe.

---

## 2. Ce citește Google și ce ignoră

Verificat în documentația oficială, nu din memorie
([Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)).

| Element                 | Verdict                                    | Ce facem                               |
| ----------------------- | ------------------------------------------ | -------------------------------------- |
| `<loc>`                 | folosit                                    | emis, absolut, escapat                 |
| `<lastmod>`             | folosit, **dar numai dacă e de încredere** | emis, scris de mână                    |
| `<changefreq>`          | **ignorat**                                | **nu se emite**                        |
| `<priority>`            | **ignorat**                                | emis, dar pentru foaia noastră de stil |
| `xhtml:link` (hreflang) | folosit                                    | emis, reciproc, cu `x-default`         |

Formularea Google despre ultimele două e textuală:

> Google ignores `<priority>` and `<changefreq>` values.

Iar despre `lastmod`:

> Google uses the `<lastmod>` value if it's consistently and verifiably (for
> example by comparing to the last modification of the page) accurate.

**De aici vin două decizii.**

`changefreq` nu se mai emite deloc. Nu-l citește Google, nu-l citește foaia
noastră de stil, deci nu-l citește nimeni — era o declarație despre viitor pe
care nimeni n-o verifică.

`priority` rămâne, dar dintr-un motiv concret: îl citește `sitemap.xsl` și
desenează din el bara de importanță din pagina randată. E ierarhia noastră,
scrisă o dată și vizibilă, nu o încercare de a instrui un motor de căutare.
Pagina randată o spune explicit, ca să nu inducă în eroare pe cine o citește.

`lastmod` **se scrie de mână**, în `src/content/landing/harta.ts`. Nu e
`new Date()`: o dată de build pusă automat ar pretinde că toate cele 22 de pagini
s-au schimbat la fiecare livrare. Google spune limpede că se uită dacă data e
verificabilă — o dată în care nu se poate avea încredere e ignorată, iar
încrederea se pierde o singură dată.

---

## 3. hreflang — regula pe care se cade cel mai des

Din [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions):

> Each `<url>` element must have a child element that lists **every alternate
> version of the page, including itself**.

> If page X links to page Y, page Y must link back to page X. If this is not the
> case for all pages that use `hreflang` annotations, those annotations **may be
> ignored** or not interpreted correctly.

Reciprocitatea nu e o recomandare: o trimitere fără întoarcere invalidează
**întreaga grupă**, nu doar rândul greșit.

Generatorul pe care l-am avut înainte prefixa orb `/en` la fiecare cale și emitea
`hreflang` către `/en/cere-demo`, `/en/legal/termeni` și
`/en/legal/confidentialitate` — trei rute care nu există. Acum perechea se
**declară pe rând**, iar un test o verifică în ambele sensuri.

Cele patru pagini cu traducere emit fiecare trei alternative: `ro`, `en` și
`x-default`. `x-default` arată către română, fiindcă publicul e din România și
engleza există pentru excepții; fără el, motoarele aleg singure pentru
vizitatorii care nu se potrivesc cu nicio limbă declarată.

---

## 4. Cum e construit

```
src/content/landing/harta.ts     datele: cale, prioritate, limbă, pereche, lastmod, secțiune
src/app/sitemap.xml/route.ts     randează XML-ul, cu legătura către foaie
src/app/sitemap.xsl/route.ts     foaia de stil, servită ca text/xsl
src/app/robots.ts                regulile de crawlare + linia Sitemap:
```

**De ce nu mai e `src/app/sitemap.ts`.** Generatorul din Next emite XML-ul singur
și nu lasă loc pentru instrucțiunea `<?xml-stylesheet?>`, care trebuie să stea
înaintea elementului rădăcină. Fără ea, nu există foaie de stil.

**De ce foaia e o rută și nu un fișier în `public/`.** Un browser aplică o foaie
XSLT numai dacă vine cu un tip de conținut din familia XML — `text/xsl` sau
`application/xslt+xml`. Ce tip pune un server static pentru extensia `.xsl`
variază, iar când greșește **nu apare nicio eroare**: pagina arată exact ca
înainte, adică nestilizată. Într-o rută, tipul e scris explicit.

**Ordinea elementelor.** Schema oficială definește conținutul lui `<url>` ca o
secvență: `loc`, `lastmod`, `changefreq`, `priority`. `xhtml:link` nu apare în ea.
Exemplele Google îl pun imediat după `<loc>` și îl acceptă acolo; noi îl punem la
coadă, fiindcă un validator strict care tolerează elemente străine printr-un
`xsd:any` le tolerează la sfârșit, nu la mijlocul secvenței. Google acceptă ambele
forme.

**Excepția din proxy.** `sitemap.xsl` trebuie adăugat în matcher-ul din
`src/proxy.ts`. Cererea pentru foaie o face browserul **după** ce a primit XML-ul,
ca resursă separată; dacă primește 307 către autentificare, transformarea eșuează
în tăcere și fișierul apare nestilizat — exact simptomul pe care foaia trebuia
să-l repare.

### Ce păzesc testele

`src/content/landing/continut.test.ts`:

- fiecare adresă din sitemap are `page.tsx` pe disc și trece de proxy
- sitemap și `llms.txt` arată aceleași pagini, în ambele sensuri
- cele patru pagini de domeniu sunt **exact** cele generate de
  `generateStaticParams` — un slug inventat pică testul
- rândurile vin grupate pe secțiuni fără întreruperi, fiindcă foaia de stil scrie
  un cap de grupă la fiecare schimbare de etichetă

---

## 5. Limitele protocolului, și de ce nu ne ating

| Limită                              | Noi                          |
| ----------------------------------- | ---------------------------- |
| 50.000 de adrese per fișier         | 22                           |
| 50 MB necomprimat                   | sub 10 KB                    |
| Codare UTF-8 obligatorie            | da                           |
| Adrese absolute, complet calificate | da                           |
| Valorile escapate                   | da, cele cinci caractere XML |

**Fișier index?** Nu. Se folosește când se depășesc limitele de mai sus, iar noi
suntem la 0,04% din prima. Un index acum ar fi un nivel de indirectare în plus,
fără niciun câștig.

**O inconsecvență cunoscută, lăsată intenționat.** Canonicalul paginii de start
e `https://administrativo.ro`, fără bară finală; sitemap-ul emite
`https://administrativo.ro/`, cu bară. Google normalizează exact acest caz —
originea goală și originea cu bară sunt aceeași adresă. Un caz special în cod
pentru o diferență pe care motorul o șterge oricum ar fi înrăutățit codul pentru
zero câștig.

---

## 6. Ce trebuie făcut în Search Console

Sitemap-ul nu se trimite până nu dovedești că domeniul e al tău.

### Pasul 1 — dovada de proprietate

Două căi. **Prima e mai bună.**

**A. Proprietate pe domeniu, prin DNS.** În Search Console, „Add property" →
**Domain** → `administrativo.ro`. Google dă un rând TXT; se adaugă în DNS-ul
domeniului (la Cloudflare: DNS → Add record → TXT, nume `@`, conținut rândul dat).
Verificarea prinde în câteva minute.

De ce e mai bună: acoperă dintr-o dată `www` și fără `www`, `http` și `https`, și
toate subdomeniile — inclusiv `analitice.administrativo.ro`. Nu cere nicio
livrare de cod și nu se pierde dacă cineva schimbă antetul paginii.

**B. Etichetă în HTML.** Dacă DNS-ul nu e la îndemână: Search Console →
„URL prefix" → `https://administrativo.ro` → metoda „HTML tag". Google dă un cod;
se pune în `.env.production`:

```
GOOGLE_SITE_VERIFICATION=codul-dat-de-google
```

și se relivrează. Codul se citește la randare, nu la build, și nu ajunge în
pachetul de client. Există și `BING_SITE_VERIFICATION`, pentru Bing Webmaster
Tools, care merge la fel.

### Pasul 2 — trimiterea sitemap-ului

Search Console → **Sitemaps** → „Add a new sitemap" → se scrie:

```
sitemap.xml
```

Atât — calea, nu adresa întreagă. Starea trece în „Success" de obicei în câteva
minute; numărul de adrese descoperite apare mai târziu.

Sitemap-ul e declarat **și** în `robots.txt`, pe rândul
`Sitemap: https://administrativo.ro/sitemap.xml`. Ăsta e felul în care îl găsesc
celelalte motoare, care n-au o consolă în care să-l trimiți.

### Pasul 3 — ce se urmărește după

- **Pages** → „Indexed" față de „Not indexed", cu motivul pentru fiecare.
  Pe un domeniu nou, „Discovered – currently not indexed" e normal câteva
  săptămâni; „Crawled – currently not indexed" e semnalul că pagina a fost citită
  și n-a convins.
- **Page indexing → Redirect error** sau **Not found (404)** pe adrese din
  sitemap: înseamnă că am trimis pagini care nu răspund. S-a întâmplat deja o
  dată — codul era împins, dar nedesfășurat, iar cinci pagini publice întorceau
  307 spre autentificare.
- Nu se retrimite sitemap-ul la fiecare schimbare. Google îl recitește singur.

### Ce NU face un sitemap

Nu garantează indexarea și nu influențează clasarea. Spune „paginile astea
există și astea sunt datele lor". Restul îl decid conținutul și legăturile.

---

## 7. robots.txt

Generat din `src/app/robots.ts`. Două lucruri merită știute.

**`Disallow` se potrivește pe prefix, nu pe segment.** Un rând `Disallow: /reges`
ar bloca și `/reges-online`; `Disallow: /pontaj` ar bloca `/pontaj-pe-telefon` —
exact paginile publice pe care le construim. De aceea fiecare modul al aplicației
primește **două** reguli: `$` pentru calea exactă și `/` pentru subarbore.

**Paginile de sesiune NU sunt în `Disallow`.** Primesc `noindex` din metadata
layout-ului `(auth)`. E deliberat: o cale interzisă în `robots.txt` nu poate fi
citită, deci robotul nu ajunge niciodată să vadă `noindex`, iar adresa poate
rămâne în index fără conținut. Ca să scoți ceva din index, trebuie să-l lași să
intre.

---

## 8. Ce rămâne de făcut

- Cele 19 pagini `/module/<cheie>` nu sunt în sitemap. Sunt descoperibile prin
  legături interne din `/module`. A fost decizia corectă cât erau subțiri; merită
  reevaluată acum.
- Nu există `/ghid` și `/unelte` ca pagini. Cine taie adresa înapoi la părinte
  primește 404.
- Verificarea de proprietate nu e făcută încă — nimic nu se poate trimite până
  atunci.
