# Vizibilitatea organică: de ce nu ne găsește nimeni și ce facem

Actualizat: **20 septembrie 2026**. Toate cifrele de mai jos sunt măsurate, cu
sursa lângă ele. Când o cifră îmbătrânește, se reface măsurătoarea — nu se
actualizează din memorie.

> **Verdictul, într-o frază:** situl nu e slab, e invizibil. Google îl consideră
> potrivit pentru exact interogările pe care le vindem, dar nu-l consideră
> important — fiindcă nimeni nu leagă spre el.

Partea tehnică a sitemap-ului și a robots.txt stă separat, în
[`docs/sitemap.md`](../sitemap.md). Aici e strategia, nu mecanica.

---

## 1. Ce măsurăm azi

### Search Console (proprietate verificată pe 20 sept, date de la ~5 sept)

| Măsură                        | Valoare       | Citire                          |
| ----------------------------- | ------------- | ------------------------------- |
| Afișări, 2,5 săptămâni        | 69            | Google ne arată                 |
| Clicuri                       | **0**         | Nimeni nu ajunge                |
| CTR                           | 0 %           | Consecință a poziției, nu cauză |
| Poziție medie                 | **48,1**      | Pagina 5 din rezultate          |
| Pagini indexate               | **13 din 48** | Restul n-au fost citite         |
| „Descoperită – nu e indexată” | **28**        | Ultima accesare: _niciodată_    |

Cele 28 stau neatinse din **5 septembrie**, linie dreaptă pe grafic. Printre ele
sunt slug-urile vechi, englezești (`/module/attendance`, `/module/announcements`,
`/module/employee_portal`), pe care le-am înlocuit pe 17 septembrie — Google nu
le-a citit nici până acum, deși redirecționează corect cu 308.

### Interogările care ne scot

| Interogare              | Afișări | Clicuri |
| ----------------------- | ------- | ------- |
| `program salarizare`    | 28      | 0       |
| `program salarii`       | 17      | 0       |
| `foaie de pontaj lunar` | 7       | 0       |
| `soft concedii`         | 1       | 0       |

**Astea sunt exact interogările comerciale pe care le țintim.** Google a înțeles
corect despre ce e situl. Conținutul funcționează; doar că nimeni nu-l vede.

### Performanță (PageSpeed Insights, mobil, 20 sept)

|             | `/`    | `/preturi` | `/ghid/concediu-de-odihna` |
| ----------- | ------ | ---------- | -------------------------- |
| Performanță | 66     | 69         | 67                         |
| FCP         | 3,3 s  | 3,1 s      | 3,4 s                      |
| LCP         | 6,2 s  | 5,9 s      | 6,2 s                      |
| TBT         | 170 ms | 80 ms      | 110 ms                     |

**SEO: 100/100. Accesibilitate: 97/100.** Nu mai e nimic de reparat la SEO
tehnic — cine ne-ar vinde „optimizare SEO” ne-ar vinde munca deja făcută.

Core Web Vitals la utilizatori reali (CrUX): **„trafic insuficient”**. Google
n-are destui vizitatori ca să măsoare situl.

### Linkuri (Common Crawl, release ian–mar 2026)

**Zero.** Nici `administrativo.ro`, nici domeniul anterior `infomeditatii.ro`
n-au avut vreodată prezență măsurabilă în graful de linkuri. Nu e un artefact al
mutării de domeniu: niciunul n-a fost vreodată acolo.

---

## 2. Diagnosticul

Google clasează pe două axe: **cât de potrivit** e conținutul și **cât de mult
contează** situl.

- **Potrivire: bună.** Dovada e chiar în tabelul de interogări.
- **Importanță: zero.** Dovada e în Common Crawl.

De aici pornește un cerc care se închide singur:

```
fără linkuri → prioritate mică de crawl → 28 de pagini necitite
     ↑                                              ↓
  nimeni nu linkează  ←  nimeni nu găsește  ←  ce se indexează iese la poziția 48
```

**Poziția 48 pentru un domeniu de două săptămâni și jumătate, fără niciun link,
nu e un eșec — e exact ce trebuie să vezi.** Zero clicuri la poziția 48 e
aritmetică, nu o problemă de titluri sau de descrieri.

---

## 3. Ce NU facem

- **Nu plătim o agenție SEO să „optimizeze” situl.** Google ne dă 100/100 la SEO
  tehnic. N-au ce optimiza.
- **Nu cumpărăm linkuri, nu acceptăm „pachete de 50 de directoare”.** Penalizabil,
  iar un domeniu nou nu supraviețuiește unui profil artificial.
- **Nu rescriem conținutul iar.** Nu el e problema; funcționează.
- **Nu atacăm acum termenii comerciali grei.** `program salarizare` e național și
  îl țin firme cu ani de vechime. Nu se câștigă anul ăsta.
- **Nu adăugăm `FAQPage` sau `HowTo`.** Google a retras rezultatele îmbogățite FAQ
  pentru toate siturile în mai 2026; `HowTo` e depreciat din 2023.

---

## 4. Planul, în ordinea impactului

### A. Schimbăm bătălia: long tail întâi

Termenii comerciali nu se câștigă fără autoritate. Interogările de nișă se pot
câștiga **acum**, fiindcă acolo concurența e formată din bloguri vechi și fișiere
Word. Paginile există deja:

| Interogare țintă                   | Pagina care o servește              | Stare                  |
| ---------------------------------- | ----------------------------------- | ---------------------- |
| diurnă 2026 plafon neimpozabil     | `/ghid/diurna`                      | scrisă                 |
| cerere concediu de odihnă model    | `/unelte/cerere-concediu-de-odihna` | scrisă                 |
| concediu de odihnă zile lucrătoare | `/ghid/concediu-de-odihna`          | scrisă                 |
| REGES termene transmitere          | `/reges-online`                     | scrisă                 |
| evidența orelor art. 119           | `/evidenta-orelor-de-munca`         | scrisă                 |
| foaie de pontaj lunar              | `/unelte/foaie-de-pontaj`           | **aduce deja afișări** |
| control ITM ce documente           | `/ghid/control-itm`                 | scrisă                 |

Nu e de scris nimic nou aici. E de așteptat să fie indexate și de împins (punctul
E). Traficul de pe ele aduce primele semnale, iar semnalele deschid drumul spre
termenii grei.

### B. Primul link real — **cel mai important pas din tot documentul**

Un singur link de pe un sit pe care Google îl crawlează des schimbă prioritatea
pentru **tot domeniul**. Căi curate, în ordinea efortului:

- [ ] **Directoare de software B2B** — Capterra, GetApp, Software Advice. Acceptă
      furnizori noi, gratuit. _O după-amiază de completat profiluri._
- [ ] **Pagină de firmă pe LinkedIn** — mic ca link, dar ne dă entitatea de marcă
      pe care acum n-o avem deloc: `Organization` din datele structurate nu leagă
      spre nimic din afara sitului (lipsește `sameAs`). _30 de minute._
- [ ] **ANIS** (patronatul de software) sau **Camera de Comerț Timiș** — afiliere
      reală, cu link de membru. _Depinde de eligibilitate și cotizație._
- [ ] **Pagini de parteneri ale furnizorilor** — multe platforme listează clienții
      care cer. _Un e-mail fiecare._

Când apare pagina de LinkedIn, se adaugă `sameAs` în JSON-LD — e o linie de cod,
o fac eu.

### C. Un material pe care presa de business îl poate publica

Avem ceva ce aproape nimeni n-are: **REGES prin API, funcțional în producție**,
și documentația oficială greșită în puncte verificate de noi (vezi memoria
`reges-api-fapte-verificate`). Asta e materie primă reală, nu reclamă.

- [ ] Un material de fond: „ce greșește documentația oficială REGES”, scris din
      ce am verificat implementând.
- [ ] Trimis la Startup Cafe, Ziarul Financiar (secțiunea HR/tech), publicații de
      HR.

Aduce exact genul de link care contează și e, în același timp, dovadă de
expertiză — factorul măsurat la 55/100, cel mai slab de pe sit.

### D. Primul client referențiabil

- [ ] Un caz de utilizare, chiar anonimizat: „firmă de construcții, 30 de
      angajați, Timiș”, cu cifre reale.

Deblochează simultan trei lucruri: **încrederea** (măsurată la 10 din 25, cea mai
slabă celulă de pe tot situl), ceva de citat în conținut, și de obicei un link de
pe pagina lor de furnizori.

Fraza „primii clienți sunt în implementare, te punem în legătură cu unul” există
deja pe pagina de start și pe `/pentru-contabili`. Un caz scris o face să nu mai
depindă de un telefon.

### E. Împingem manual ce avem deja

Nu urcă poziții, dar bagă paginile în cursă. În Search Console → bara „Inspectează
orice adresă” → **„Solicită indexarea”**. Circa 10 pe zi.

Ordinea recomandată:

- [ ] `/module/salarizare`
- [ ] `/module/pontaj`
- [ ] `/module/concedii`
- [ ] `/unelte/foaie-de-pontaj`
- [ ] `/unelte/cerere-concediu-de-odihna`
- [ ] `/ghid/diurna`
- [ ] `/ghid/concediu-de-odihna`
- [ ] `/pentru-contabili`
- [ ] `/module`
- [ ] `/reges-online`

Și: în **Sitemaps**, verifică periodic că `sitemap.xml` apare „Reușit” cu 48 de
adrese.

---

## 5. Ce rămâne în cod — partea mea

Mărginită, și nu prima pe listă:

- [ ] **LCP ~6 s pe toate paginile.** TTFB e bun (42–125 ms), deci întârzierea e
      în ce blochează randarea. Google numește exact: _„Render-blocking requests,
      ~600 ms”_ și _„146 KiB de JavaScript nefolosit”_. De atacat după deploy-ul
      curent, ca să măsor pe codul nou.
- [ ] **IndexNow.** Împinge adresele noi direct la Bing și Yandex, instant.
      **Nu ajută la Google**, care nu-l folosește, dar Bing indexează mult mai
      repede un domeniu nou.
- [ ] **`sameAs`** în `Organization`, imediat ce există pagina de LinkedIn.
- [ ] **Reguli Cloudflare** — HTML-ul încă nu se cachează la margine
      (`cf-cache-status: DYNAMIC`). Nu limitează clasamentul acum, fiindcă TTFB-ul
      e bun; contează la scalare.
- [ ] **Domeniul vechi.** `infomeditatii.ro` întoarce **526**, nu 404 — DNS-ul încă
      rezolvă pe Cloudflare, dar vhost-ul a fost șters fără redirect. O regulă de
      redirect (gratuită) recuperează traficul direct și ce echitate reziduală
      există. Decizia „lasă-l să moară” a fost luată; merită reconsiderată,
      fiindcă acum nu moare, ci dă eroare.

---

## 6. Calendar și așteptări

| Orizont                        | Ce ar trebui să vedem                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| **O lună**                     | Cele 28 de pagini indexate. Poziție medie 30–40. Primele clicuri, pe termeni lungi.                |
| **Trei luni**, dacă se fac A–D | Pagina 1–2 pe interogări de nișă (`diurnă plafon`, `cerere concediu model`). Trafic mic, dar real. |
| **Șase luni+**                 | Termenii comerciali grei — și numai cu linkuri acumulate între timp.                               |

**Partea incomodă, scrisă ca s-o avem în față:** SEO nu aduce clienți luna asta.
E un canal care se coace în luni. Dacă avem nevoie de primii clienți _acum_ — și
avem, fiindcă tot restul depinde de ei — vin din vânzare directă: contabili care
țin mai multe firme, asociații patronale locale, eventual reclame plătite pe
termenii pe care organic nu-i câștigăm încă.

Ironia utilă: **primii clienți sunt și soluția pentru SEO.** Ei aduc cazurile,
linkurile și mențiunile care rup cercul din secțiunea 2.

---

## 7. Cum verificăm progresul

Se reia lunar, în ordinea asta:

1. **Search Console → Indexarea paginilor.** Scade numărul din „Descoperită – nu
   e indexată”? Ăsta e primul semn că prioritatea de crawl a crescut.
2. **Search Console → Performanță.** Urcă poziția medie? Apar clicuri? Se
   diversifică interogările dincolo de cele patru de azi?
3. **Linkuri.** `claude-seo run backlinks_*` sau, mai simplu, căutare directă. Un
   singur domeniu care ne referă e o schimbare de stare, nu o cifră.
4. **Performanță de teren.** Când CrUX începe să întoarcă date în loc de „trafic
   insuficient”, înseamnă că avem destui vizitatori reali — un prag în sine.

Uneltele sunt configurate: cheia Google stă în
`~/.config/claude-seo/google-api.json` (PageSpeed + CrUX). Search Console prin API
cere încă OAuth — merită făcut după ce se adună date.

---

## 8. Ce s-a făcut deja, ca să nu se refacă

Trei audituri complete pe 17–18 septembrie, de la **63** la **79** și apoi la
tehnic 86 / conținut 84 / schema 88.

- Sitemap, canonice, robots, hreflang — corecte, verificate.
- Antete de securitate: HSTS, CSP raportat, Permissions-Policy, fără `x-powered-by`.
- Cinci pagini juridice scrise din textul consolidat de pe Portalul Legislativ,
  cu articolul lângă fiecare afirmație.
- Două unelte gratuite, `/pentru-contabili`, capturi de ecran reale.
- Duplicarea între paginile de modul: rezolvată (Jaccard maxim 0,130, de la
  34–40 % n-grame comune).
- Porți automate care apără ce s-a câștigat: `pnpm check:lastmod`, tokenurile de
  stil, pasajele citabile, datele din `Article`.

**Plafonul a ceea ce se poate câștiga din cod e aproape atins.** De aici încolo,
secțiunile B, C și D decid mai mult decât orice linie pe care aș mai scrie-o.
