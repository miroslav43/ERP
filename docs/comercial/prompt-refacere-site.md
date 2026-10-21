# Prompt — refacerea sitului de prezentare

_21 oct 2026. Se lipește ca prim mesaj într-o sesiune nouă de Claude Code, în
rădăcina repo-ului. Tot ce e sub linie e promptul._

De ce arată așa:

- **Refacerea din 6 oct a adăugat, n-a tăiat.** Pagina de start a crescut de la
  8.498 la 15.204 px și de la 1.857 la 2.991 de cuvinte, în 12 benzi
  ([`refacere-site-2026-10-06.md`](refacere-site-2026-10-06.md) §1). Textul a
  devenit mai cinstit, dar nu mai prietenos. Promptul pune plafoane explicite.
- **Designul n-a fost atins atunci** („hârtia, cerneala, Fira, riglele”). Acum
  are voie să se schimbe.
- **SEO-ul tehnic e făcut și e păzit de teste.** Uneltele și ghidurile aduc
  aproape toată cererea de căutare. O refacere care mută adrese sau scoate
  pagini din sitemap pierde exact ce s-a câștigat. Promptul le îngheață.
- **Pagina de start spune „5–50 de angajați”**, iar
  [`grup-tinta.md`](grup-tinta.md) (12 oct) spune „10–150, firme cu birou”.
  Promptul cere alinierea la cel nou.

---

Refacem situl de prezentare Administrativo (`src/app/(marketing)/`, textele în
`src/content/landing/`). Cel de acum e corect și cinstit, dar nu e prietenos:
e lung, dens și vorbește ca un inginer. Vreau un sit care arată ca al unui
produs SaaS serios, pe care un patron îl înțelege în cinci secunde și din care
pleacă vrând o demonstrație. Lucrezi până la capăt, fără să mă întrebi pe
parcurs: alegi implicitul rezonabil și îl notezi în raport. Singurele decizii
care rămân ale mele sunt listate la final.

## Cititorul

Patronul sau omul de la birou dintr-o firmă românească cu **10–150 de angajați
care au un birou**: IT, contabilitate și consultanță, arhitectură și inginerie,
agenții, clinici private, distribuție. Un singur om ține toată administrația:
pontajul în Excel, concediile pe WhatsApp, REGES-ul de mână, SSM-ul în dulap,
mașinile într-un caiet. Nu știe ce e o bază de date și nu-l interesează. Vrea
să afle trei lucruri: **ce scap de pe cap, cât costă, cât de greu e să încep.**

Al doilea cititor e **contabilul extern**, care poate aduce mai mulți clienți.
Are pagina lui (`/pentru-contabili`); pe pagina de start primește un rând, nu o
bandă.

## Faza 1 — cercetare (scrii rezultatul, nu-l ții în cap)

1. **Situl de acum, măsurat.** Pornești serverul de dev și măsori pagina de
   start, `/preturi`, `/module` și o pagină de modul ca vizitator fără
   sesiune. Chrome-ul local e logat și trimite `/` la `/panou`, deci folosești
   Chromium-ul din `node_modules/@playwright/test`, la 1440 și 390 px, cu
   `reducedMotion: "reduce"`. Notezi înălțimea, cuvintele din `<main>`,
   numărul de benzi și ce se vede deasupra pliului. Faci capturi „înainte”.
2. **Cum arată un sit profesionist în categoria asta.** Citește homepage-ul și
   pagina de prețuri la 8–10 produse:
   - internaționale: Factorial, Personio, BambooHR, Connecteam, Deputy, Rippling;
   - românești, pe același cumpărător: SmartBill, Keez, Pontajj, HRiFlow.

   Extrage tiparele, nu textele: formula titlului, ce e deasupra pliului, câte
   secțiuni au, cât text, cum arată produsul (capturi, telefon, animație), unde
   stă prețul, ce reduce riscul lângă buton, cum compensează lipsa de clienți.
   Analiza concurenților din 6 oct (§4 din
   [`refacere-site-2026-10-06.md`](refacere-site-2026-10-06.md)) există deja;
   n-o refaci, o completezi cu ce ține de **design și ritm**, care atunci n-a
   contat.

3. **Aplicația, tradusă în rezultate.** Citește
   [`vestventures/_surse/fapte.md`](../../vestventures/_surse/fapte.md) (§1
   module, §2 prețuri, §7 telefon, §10 **ce NU se afirmă**),
   [`grup-tinta.md`](grup-tinta.md) (§5 are pitch-ul vorbit, cea mai bună
   formulare de până acum) și `src/content/landing/preturi.ts`. Pentru fiecare
   modul scrii o singură frază de rezultat („concediul aprobat apare singur pe
   pontaj și în salariu”), nu de funcție. Nu citești tot codul aplicației:
   `fapte.md` e verificat pe cod. Dacă o frază nouă depinde de ceva ce nu e
   acolo, verifici în cod înainte s-o scrii.

Scrii totul în `docs/comercial/refacere-site-<data de azi>.md`: ce ai măsurat,
tiparele găsite, cu sursa, și planul de mai jos. Documentul se comite odată cu
codul.

## Faza 2 — mesajul și structura

**Titlul** trece testul celor cinci secunde: cine citește doar titlul și
subtitlul știe ce e produsul, pentru cine e și ce câștigă. Rezultatul, nu
categoria. Termenii căutați („program de pontaj și HR”) stau în supratitlu și
în `<title>`, nu în H1. Propune 3 variante în document, alege una și spune de
ce.

**Pagina de start: mai puțin, nu mai mult.** Plafoane, pe desktop la 1440 px:

- **cel mult 8 secțiuni**, sub ~7.000 px, sub ~1.100 de cuvinte în `<main>`;
- fiecare secțiune are o idee, un titlu scurt și cel mult două fraze de text
  sub el; restul e imagine, listă scurtă sau legătură spre pagina care explică;
- deasupra pliului, pe 390 px: titlul, o frază, butonul principal și ceva din
  produs.

Ordinea orientativă (o schimbi doar cu motiv scris):

1. Eroul: rezultatul, butonul principal (cont gratuit / prima lună gratuită —
   verifici formularea exactă pe ce face fluxul de înscriere), butonul
   secundar (demonstrație), ce NU riști (fără card, nimic de instalat), produsul
   real în imagine.
2. Durerea, în trei scene scurte. Banda „Luni dimineața” e cel mai bun text de
   pe sit; o scurtezi, nu o arunci.
3. Cum se leagă: o singură imagine sau animație cu fluxul cerere de concediu →
   pontaj → salariu → REGES. E diferențiatorul față de Pontajj și trebuie să
   se vadă, nu să se citească.
4. Ce face: 4–6 carduri de rezultat, fiecare cu un ecran real și o legătură spre
   pagina modulului. Catalogul celor 19 module rămâne pe `/module`, nu aici.
5. Pentru cine: patron, HR, contabil, angajat, câte o frază fiecare.
6. Unelte gratuite: un rând de carduri, calculatorul de salariu primul. E
   motorul de trafic al sitului (§3 din refacerea din 6 oct) și pagina de start
   trebuie să lege spre el.
7. Prețul, pe scurt: o cifră, ce include, „nu pe angajat”, legătura spre
   `/preturi`. Cifrele vin din `preturi.ts`, nu le rescrii de mână.
8. Încredere și start: cine suntem (firma, orașul, telefonul la care răspunde un
   om), promisiunile cinstite din „Suntem la început”, datele în UE, 4–5
   întrebări frecvente scurte, butonul final.

Ce scoți de pe pagina de start se mută pe pagina care îi corespunde
(`/module`, `/incredere`, `/intrebari`, `/preturi`), nu se pierde.

## Faza 3 — designul

Ai voie să schimbi aspectul: paletă, tipografie, spațiere, componente, ilustrații.
Rămân: sigla (`docs/comercial/sigla/`), numele, tonul cald și direct. Ținta e un
sit pe care îl pui lângă Factorial sau Personio și nu pare făcut în weekend.

- **Produsul se vede.** Folosește ecranele reale din `public/capturi/`
  (webp, la 960/1440/1920), în ramă de browser sau de telefon. Pontajul pe
  telefon merită un telefon desenat. Demo-ul fără cont `/vitrina/leave` e un
  argument; legi spre el din eroul sau din cardul de concedii.
- **Mult aer, puțin text, ierarhie clară.** Un singur H1. Titluri de secțiune
  scurte. Butonul principal are aceeași culoare peste tot.
- **Mișcare cu măsură:** apariții discrete la derulare, nimic care întârzie
  textul și totul oprit sub `prefers-reduced-motion`.
- **Telefonul întâi.** Totul se verifică la 390 px: fără depășire orizontală,
  ținte de atingere de minimum 44 px, câmpuri de 16 px (Safari mărește altfel).
- Contrast AA, imagini cu `alt` descriptiv, navigare din tastatură.
- Antetul și subsolul se refac în același limbaj vizual și se aplică pe **toate**
  paginile din `(marketing)`, nu doar pe cea de start.

Înainte de cod, citește ghidurile din `node_modules/next/dist/docs/`
pentru ce atingi (metadate, imagini, fonturi). E Next 16.3, nu cel din memorie.
Te uiți și la componentele existente din `_componente/` înainte să scrii
altele noi: o parte (`json-ld`, `metadate`, `date-structurate`, `analitice`,
`bara-consimtamant`) se păstrează așa cum sunt.

## Ce NU se strică (SEO)

Partea tehnică de SEO e terminată și păzită de teste. Refacerea e de
prezentare, nu de arhitectură:

- **Nicio adresă nu se schimbă și nicio pagină nu dispare.** Cele ~42 de pagini
  din `(marketing)`, uneltele, ghidurile și `/en` rămân la aceleași URL-uri. Dacă
  o pagină chiar trebuie mutată, primește redirect 301 și rămâne în sitemap la
  noua adresă, iar decizia o scrii în raport.
- **Metadatele și datele structurate** (`metadate.ts`, `noduri-json-ld.ts`,
  `seo-unelte.ts`) rămân valide: un `<title>` sub ~60 de caractere și o
  descriere sub ~155 pe fiecare pagină, Organization, SoftwareApplication,
  FAQPage unde sunt întrebări, BreadcrumbList.
- **Legăturile interne** spre unelte și ghiduri nu scad: pagina de start și
  subsolul trebuie să le lege în continuare.
- **Engleza** (`en.ts`) urmează aceeași structură; testul de paritate trebuie să
  treacă.
- `llms.txt` și `sitemap` se actualizează dacă se schimbă ce descriu.
- Testele din `src/content/landing/*.test.ts` (inclusiv `cuvinte-tinta`) sunt
  plasa de siguranță. Dacă unul pică, repari codul, nu testul. Un test se schimbă
  doar când a păzit un text care s-a schimbat intenționat, și spui asta.
- **Performanță:** LCP sub 2,5 s pe mobil, CLS sub 0,1. Imaginea din erou e
  prioritară și dimensionată, fonturile se încarcă prin `next/font`, fără
  biblioteci grele de animație pentru două efecte.

## Regulile textului

- **Pentru patron, fără jargon.** Spui rezultatul, nu mecanismul: „managerul își
  vede doar echipa”, nu „domeniul team impus în baza de date”. Cuvinte interzise
  în textul de marketing: bază de date, server, API, RLS, politică, rând,
  permisiune, criptare la nivel de coloană, SHA, tenant, modul de platformă.
  Varianta tehnică stă doar pe `/incredere` și pe paginile legale.
- **Fraze scurte, verbe concrete, persoana a doua** („închizi luna”, „vezi cine
  lipsește”).
- **Nimic inventat.** Zero clienți plătitori azi: nu scrii testimoniale, logo-uri,
  „sute de firme”, cifre de economie nemăsurate sau parteneriate. Tot ce e în
  `fapte.md` §10 nu se afirmă (geolocalizare la pontaj, cititor de card,
  anunțuri pe e-mail sau pe departament, import din Excel la inventar, prag de
  absenți simultani, aplicație pe iOS sau în Google Play). Fiecare frază nouă
  trebuie să se poată arăta într-o demonstrație de cinci minute.
- **Salarizarea:** valorile legale sunt încă de confirmat de contabil
  (`NOTES.md` §3). Nu scrii „calcul garantat corect” și nu sugerezi că D112 se
  depune singur.
- Română corectă, cu ș și ț cu virgulă dedesubt (U+0219/U+021B), nu cu sedilă.

## Verificarea și livrarea

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — ieșirea comenzilor
   intră în raport. `pnpm build` folosește același `.next` ca serverul de dev:
   oprești serverul înainte și îl repornești după.
2. Măsori din nou, ca în Faza 1, aceleași pagini la 1440 și 390 px: înălțime,
   cuvinte, secțiuni, depășire orizontală, imagini stricate. Faci capturi
   „după”, pe secțiuni.
3. Treci prin fiecare pagină din `(marketing)` cel puțin o dată în Chromium:
   antetul și subsolul noi nu strică nimic.
4. Raportul (documentul din Faza 1) se încheie cu: tabelul înainte/după,
   capturile, titlul ales și alternativele, ce s-a mutat unde, lista frazelor
   scoase pentru că nu se puteau dovedi, și ce rămâne de hotărât.
5. Comiți și împingi pe `main` după ritualul din `CLAUDE.md` (`git status
--short` doar pe căile tale, `git fetch`, `git commit --only`, `git merge
origin/main`, `git push`). Deploy-ul pe producție îl face colegul; la final
   îmi dai un mesaj scurt pentru el.

## Ce rămâne decizia mea (nu bloca lucrul pe ele)

Le pregătești ca opțiuni la sfârșitul raportului; până atunci, alegi varianta
prudentă:

- **numele și fotografiile fondatorilor** pe pagina de start (până atunci:
  firma, orașul, telefonul);
- **o garanție cu banii înapoi** pe prima lună plătită (până atunci: doar prima
  lună gratuită);
- **un domeniu-țintă pus în erou** (ex. „pentru firmele de IT și consultanță”)
  sau o formulare generală (până atunci: generală, cu domeniile în banda „Pentru
  cine”).
