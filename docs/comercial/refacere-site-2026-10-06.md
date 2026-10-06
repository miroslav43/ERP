# Refacerea sitului de prezentare — 6 octombrie 2026

> **Verdictul, într-o frază:** situl era corect tehnic și cinstit, dar vorbea ca
> un inginer cu alt inginer. Spunea ce e produsul, nu-l arăta. Răspundea la
> întrebări pe care patronul nu le pune („ce se întâmplă dacă cineva greșește
> codul?”) și le sărea pe cele pe care le pune („cum arată?”, „cine e în spate?”,
> „ce risc dacă apăs?”).

Designul a rămas neatins: hârtia, cerneala, Fira, riglele, foaia de pontaj din
erou. S-au schimbat textul, ordinea benzilor și ce se arată în ele. Codul e în
[`pagina.tsx`](<../../src/app/(marketing)/_componente/pagina.tsx>),
[`benzi/acasa.tsx`](<../../src/app/(marketing)/_componente/benzi/acasa.tsx>) și
[`ro.ts`](../../src/content/landing/ro.ts) / [`en.ts`](../../src/content/landing/en.ts).

Surse pentru cifrele de mai jos:

- măsurători Playwright pe situl live și pe `localhost`, fără sesiune, la 1440 și 390 px;
- auditurile SEO din [2](audit-seo-2026-10-02.md), [5](audit-seo-2026-10-05.md) și [6 oct](audit-seo-2026-10-06.md);
- captura din Keyword Planner trimisă de tine;
- două cercetări din 6 oct:
  - 16 homepage-uri de concurenți și 8 pagini de preț sau resurse;
  - rezultatele căutării pentru cele 18 cuvinte cheie.

---

## 1. Ce spunea prima pagină și de ce nu vindea

| Măsură (desktop, 1440 px)                | Înainte (live, 6 oct)   | După (6 oct)                                      |
| ---------------------------------------- | ----------------------- | ------------------------------------------------- |
| Benzi                                    | 8                       | 12                                                |
| Înălțime                                 | 8.498 px                | 15.204 px                                         |
| Cuvinte în `<main>`                      | 1.857                   | 2.991                                             |
| Ecrane reale ale aplicației              | **0** (deși existau 17) | 4 (telefon, concedii, salarizare, SSM), cu mărire |
| Legături spre pagini de modul            | 19                      | 19, acum ca un catalog lizibil                    |
| Legături spre unelte gratuite, în pagină | 0 (doar în subsol)      | 7 unelte și 8 ghiduri                             |
| Răspuns la „cine e în spate?”            | nu                      | firma, orașul și telefonul la care răspunde un om |

Pe telefon, pagina a crescut de la 13.269 la 23.436 px. Banda de prețuri, care
n-a fost atinsă, ia singură 3.190 px.

Cele șapte probleme, în ordinea în care costau vânzări:

1. **Titlul era o listă de funcții.** „Pontaj, concedii și dosare de personal,
   într-un singur cont” spunea ce e produsul, nu ce se schimbă pentru cine îl
   cumpără. Dintre concurenții analizați, numai unul (Pontajj) scrie rezultatul
   în titlu: „Vezi cine a venit la lucru. Oriunde sunt.” Ceilalți scriu
   categoria: „Program resurse umane și Pontaj”, „Software HR pentru Reges
   Online”. Locul era liber.
2. **Produsul nu se vedea.** `public/capturi/` avea 17 ecrane reale, iar pagina
   de start nu folosea niciunul. Foaia din erou e frumoasă, dar e un tabel dens,
   cu date fictive, fără legătură spusă cu titlul.
3. **Încrederea vorbea despre straturi, nu despre date.** Banda întunecată
   spunea „Trei dintre straturile de mai jos sunt confort... Doar al patrulea e
   barieră”, iar straturile **nu erau pe pagină**: rămăseseră pe `/incredere`.
   Patronul vrea să afle cine vede CNP-urile, nu ce e o politică pe rând.
4. **Două benzi se contraziceau.** Butonul spunea „Creează cont · prima lună
   gratuită”, iar pasul 1 din „Cum începem” spunea „Nu-ți cerem card și nu-ți
   creăm cont”.
5. **Comentarii despre pagina însăși.** De exemplu: „E singura secvență reală
   de pe pagina asta, de aceea e singurul loc unde numerotăm.” E o notă de
   design scrisă pentru noi și ajunsă la cititor.
6. **Uneltele gratuite stăteau doar în subsol.** Tocmai ele au de o sută de ori
   mai multe căutări decât numele produsului (§3).
7. **Nimic nu răspundea la „cine sunteți?”.** O firmă fără clienți de arătat
   trebuie să arate oamenii și să-și asume promisiuni. Pagina spunea doar „Aici
   o să fie recomandările lor”, într-o bandă care nici nu mai era randată.

---

## 2. Ce s-a făcut pentru SEO în ultimele commit-uri

Pe scurt: **partea tehnică e terminată.** Ce lipsește nu se mai rezolvă din cod.

| Perioadă   | Ce s-a livrat                                                                                                                                                                                                                                               | Scor    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 17–23 sept | Trei audituri. Slug-uri românești pe module. Date structurate (Organization, ofertă, Article, firimituri). Open Graph propriu pe fiecare pagină. CSP și antete de securitate. Poarta `lastmod`. Rutele publice reparate: dădeau 404 la jumătate din cereri. | 63 → 79 |
| 2 oct      | Audit, plus `og:image` pierdut pe 47 de pagini, reparat. Cercetare de cuvinte cheie: 5.411 termeni din completarea automată Google ([`cuvinte-cheie.md`](cuvinte-cheie.md)).                                                                                | 76      |
| 3–5 oct    | Șapte unelte gratuite (calculator de salariu, foaie de pontaj PDF/Word/Excel, condică, cerere de concediu, foaie de parcurs, fișă SSM, fișă de evaluare) și patru ghiduri noi. Fiecare modul leagă spre unealta și ghidul lui. IndexNow la fiecare livrare. | 82      |
| 5–6 oct    | Optimizare pentru căutarea AI: `WebApplication` pe unelte, `Article` cu `citation`, H2-uri formulate ca întrebări. Reaudit.                                                                                                                                 | 82      |

Ce spune Google (Search Console, 28 de zile, pe 6 oct): **3 clicuri, 179 de
afișări, poziția medie 32,5**. Sunt indexate 53 de pagini din 56. Pagina de
start apare de 64 de ori, pe poziția 56.

**Diagnosticul nu s-a schimbat din septembrie.** Conținutul se potrivește cu
căutările, dar nimeni nu trimite spre sit: niciun link din afară, nicio mențiune.
Pagina de start avea în plus o problemă proprie, de conversie: cine ajungea pe ea
nu găsea motive să rămână. Pe asta o rezolvă refacerea. Autoritatea o rezolvă
doar pașii din §8.

---

## 3. Ce spune Keyword Planner

| Cuvânt cheie                    | Căutări / lună | Concurență | Pagina noastră                              |
| ------------------------------- | -------------- | ---------- | ------------------------------------------- |
| calcul salariu net              | 10K–100K       | redusă     | `/unelte/calculator-salariu`                |
| salariu minim pe economie 2026  | 10K–100K       | redusă     | **nouă:** `/ghid/salariu-minim-pe-economie` |
| calcul salariu brut             | 1K–10K         | redusă     | `/unelte/calculator-salariu`                |
| cerere concediu de odihna word  | 100–1K (+900%) | redusă     | `/unelte/cerere-concediu-de-odihna`         |
| condica de prezenta model word  | 100–1K         | ridicată   | `/unelte/condica-de-prezenta`               |
| diurna externa 2026             | 100–1K         | redusă     | `/ghid/diurna-externa`                      |
| foaie de parcurs model          | 100–1K         | ridicată   | `/unelte/foaie-de-parcurs`                  |
| foaie de pontaj lunar pdf       | 100–1K         | medie      | `/unelte/foaie-de-pontaj`                   |
| ore suplimentare codul muncii   | 100–1K         | redusă     | `/ghid/ore-suplimentare`                    |
| program salarizare              | 100–1K         | medie      | `/module/salarizare`                        |
| spor de noapte codul muncii     | 100–1K         | redusă     | `/ghid/spor-de-noapte`                      |
| aplicatie pontaj angajati       | 10–100         | ridicată   | `/pontaj-pe-telefon`                        |
| program pontaj angajati         | 10–100         | redusă     | `/module/pontaj`                            |
| registru salariati reges online | 10–100         | redusă     | `/reges-online`                             |
| zile concediu de odihna         | 10–100 (+900%) | redusă     | `/ghid/concediu-de-odihna`                  |
| fisa evaluare angajati model    | 10–100         | redusă     | `/unelte/fisa-evaluare`                     |
| fisa instruire ssm model        | —              | —          | `/unelte/fisa-instruire-ssm`                |
| foaie de pontaj lunar word      | —              | —          | `/unelte/foaie-de-pontaj`                   |

Trei concluzii:

1. **Aproape toată cererea e informațională.** Calculatoarele, modelele și
   întrebările despre lege adună între 25.000 și 230.000 de căutări pe lună.
   Numele produsului („program pontaj angajați”, „aplicație pontaj”) adună 20–200.
   De aceea uneltele au intrat în meniul principal și au bandă proprie pe pagina
   de start. Pagina de start e cea mai legată pagină a sitului, iar legăturile ei
   ridică prioritatea de crawl a uneltelor.
2. **Termenii comerciali sunt mici, dar scumpi.** Licitația pentru partea de sus
   a paginii merge până la 5,34 € pe „program salarizare” și 4,65 € pe „aplicatie
   pontaj angajati”. Cine îi caută vrea să cumpere. Acolo se poate pune Google Ads
   pe potrivire exactă, cu trimitere spre `/module/salarizare` și
   `/pontaj-pe-telefon`. Organic, pe ei se urcă abia în luni (§8).
3. **Singurul gol mare era „salariu minim pe economie”.** Are 10K–100K căutări
   pe lună, +9.900% față de anul trecut, și nu avea pagină dedicată; calculatorul
   avea doar o bandă despre el. Acum are ghidul lui (§6).

---

## 4. Ce pun pe site concurenții care vând

Am citit 16 homepage-uri:

- **HR și pontaj, din România:** HRiFlow, Papervee, Pontajj, Creasoft, qPlus,
  LeaveBoard, IMFS.
- **Același cumpărător, alt domeniu:** SmartBill, Keez, Oblio.
- **Internaționale:** Connecteam, Homebase, Deputy, Jibble, BambooHR, Factorial.

| Element                                       | Câte site-uri din 16 | La noi, înainte  | La noi, după                                                   |
| --------------------------------------------- | -------------------- | ---------------- | -------------------------------------------------------------- |
| Al doilea buton cu angajament mic (demo, tur) | 10                   | „Vezi prețurile” | „Programează o demonstrație”                                   |
| Ce NU riști, scris lângă buton („fără card”)  | 8                    | nu               | fără card · fără cost de pornire · nimic de instalat · telefon |
| Funcții prezentate cu capturi                 | 8                    | nu               | 4 rânduri cu ecran, unul cu termenele REGES                    |
| Securitate spusă pe pagină                    | 10                   | da, tehnic       | da, în cuvinte simple                                          |
| Întrebări frecvente pe pagina de start        | 9                    | nu               | 6                                                              |
| Telefon vizibil                               | 9                    | doar jos         | sub butoane și jos                                             |
| Unelte gratuite **în corpul paginii**         | 3                    | nu               | da                                                             |
| Dovadă socială sub erou                       | 9                    | —                | — (nu avem; vezi mai jos)                                      |

**Ce subliniază jucătorii români.** Categoria și lista de module, nu
rezultatul. Demo-ul cu un vânzător, pe primul loc. Prețul îl țin pe altă pagină,
pe angajat, în euro, plus TVA. Ca dovadă, volumul de clienți: „620+ companii
active”.

**Golurile pe care le-am folosit:**

1. **Contabilul extern nu e țintit de niciun site românesc de HR.** Rețeta
   există doar la SmartBill („Vreau CONTA pentru clienții mei”). La noi are rol
   propriu în banda „Pentru cine”, o întrebare frecventă și pagina lui.
2. **Prețul e greu de calculat la toți.** La 20 de angajați: HRiFlow ≈ 48 €/lună
   - TVA, Papervee 100 €. La noi, nota de lângă 149 spune acum explicit: „pentru
     toată firma până la 20 de angajați — nu pe om. Preț final, fără TVA.”
3. **Conformitatea e vagă.** Doar Pontajj citează articole de lege. Rândurile
   de produs poartă acum articolul în etichetă (art. 119, HG 295/2025,
   HG 1425/2006).
4. **Nimeni din HR nu arată produsul fără cont.** Noi avem `/vitrina/leave`, un
   ecran de concedii viu, cu comutator Administrator / Manager / Angajat. Rândul
   de concedii leagă acum spre el: „Încearcă ecranul, fără cont”.

**Atenție la Pontajj.** Ocupă deja poziționarea „mic, cinstit, preț fix, QR, Codul
muncii punct cu punct”: 29 €/lună fix până la 25 de angajați, garanție de 30 de
zile, echipa cu poze. Diferența noastră trebuie să vină din **lărgimea produsului**
(REGES prin API, concedii, dosare, SSM, salarizare) și din **contabilul extern**.
Pe asta stă refacerea.

**Fără clienți de arătat, ce se poate face cinstit.** Pontajj scrie „Pontajj e
tânăr. Nu inventăm testimoniale” și pune un bloc de promisiuni și echipa cu poze.
IMFS oferă demo fără cont și „cifre măsurate, cu dată”. Am preluat ce putem ține
azi: banda „Suntem la început” cu patru promisiuni verificabile, demo-ul fără
cont și firma cu orașul lângă telefon. **N-am pus nume și poze**: e alegerea
voastră (§8).

---

## 5. Ce arată Google pentru cuvintele noastre

Concluzia cercetării: domeniul are câteva săptămâni și poziția medie în jur de 30. Termenii de peste 10K căutări, la calculatoare, sunt la 6–12 luni distanță.
În 1–3 luni se pot câștiga căutările lungi, modelele de documente și subiectele
unde concurența greșește.

- **Calculatoarele de salariu** sunt pe domenii exact-match (calculator-salarii.ro,
  salariucalculator.ro), cu pagini pe sume și fluturaș PDF. Al nostru declară ca
  limite chiar ce oferă ei: sub 26 de ani, tichete, part-time, primul semestru.
- **„Salariu minim pe economie”**: salariile.ro e pagina de bătut. Are cifrele
  corecte, istoricul 2019–2026, part-time, construcții, 11 întrebări și data
  actualizării. Recomandarea e o adresă **fără an**, fiindcă cererea se mută pe
  „2027”.
- **Modelele de documente** sunt peste tot slabe: PDF-uri scanate, pagini din
  2017, sector public. Fișa SSM are cea mai slabă concurență din toată lista.
- **Diurna externă**: avem deja cel mai complet tabel (166 de țări). Lipsesc
  calculatorul, coloana de cazare și ancorele pe țări. E pagina cu cele mai mari
  șanse să intre prima în top 5.

Lista completă de pagini de îmbunătățit, în ordine, e în §8.

---

## 6. Refacerea: ce e acum pe pagina de start

| #   | Banda                    | Ce face                                                                                                                                                       |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Erou + foaia             | Rezultatul, pentru cine, ce NU riști, telefonul. Foaia rămâne, cu o frază care spune ce e: luna închisă din pontajul de pe telefon.                           |
| 2   | Dovada                   | Neschimbată, plus „nu pe om” lângă 149.                                                                                                                       |
| 3   | Luni dimineața           | Neschimbată: cele trei scene erau cel mai bun text de pe pagină.                                                                                              |
| 4   | **Ce face**              | Cinci rânduri: pontaj, concedii, REGES-ONLINE, salarii, termene. Patru au ecranul real, iar REGES are tabelul termenelor. Sub ele, catalogul celor 19 module. |
| 5   | **Pentru cine**          | Patronul, omul de HR, contabilul extern, angajatul — fiecare cu drumul lui.                                                                                   |
| 6   | **Unelte gratuite**      | Șapte unelte, calculatorul pe primul loc, plus opt ghiduri.                                                                                                   |
| 7   | **Suntem la început**    | Patru promisiuni în locul recomandărilor pe care nu le avem.                                                                                                  |
| 8   | Prețuri                  | Neschimbată.                                                                                                                                                  |
| 9   | **Datele oamenilor tăi** | A înlocuit „Bariera”: separare pe firmă, criptare, jurnal, UE. Varianta tehnică rămâne pe `/incredere`.                                                       |
| 10  | **Cum începi**           | Patru pași, fără contradicție, plus calea cu un om alături.                                                                                                   |
| 11  | **Întrebări**            | Șase, scurte, cu legătura spre cele lungi.                                                                                                                    |
| 12  | Contact                  | Neschimbată, plus rândul despre firmă și oraș.                                                                                                                |

**Titlul, înainte și după:**

- Înainte: „Pontaj, concedii și dosare de personal, într-un singur cont”.
- După: **„Angajații se pontează de pe telefon. Tu închizi luna fără Excel.”**

Pune față în față cele două capete ale lunii, cu cei doi oameni care le țin. Se
poate arăta într-o demonstrație de cinci minute, deci regula de scriere din
`ro.ts` rămâne. „Program de pontaj și HR” a trecut în supratitlu. `<title>` a
rămas cel de dinainte.

**Restul sitului:**

- **Meniul.** „Unelte gratuite” a luat locul „Întrebărilor”, care au acum bandă
  pe pagina de start și legătură în subsol.
- **Subsolul.** Are coloane proprii pentru unelte și ghiduri. Auditul din 6 oct
  găsise că lipseau exact paginile cel mai slab legate.
- **Engleza.** Aceeași structură, tradusă; testul de paritate s-a extins la
  benzile noi.

**Pagină nouă: [`/ghid/salariu-minim-pe-economie`](../../src/content/legal/salariu-minim.ts).**
Răspunde la cel mai mare termen din Keyword Planner care nu avea pagină. Adresa e
fără an, fiindcă cererea se mută pe „2027”. Cifrele au fost citite pe 6 oct pe
textele oficiale:

- 4.325 lei din 1 iulie 2026 (HG 146/2026) și 4.050 lei până atunci (HG 1506/2024);
- art. 164 alin. (6) și (8) din Codul muncii — contractul nu poate coborî sub
  minim, iar minimul se poate plăti cel mult 24 de luni;
- amenda de 3.000–5.000 lei pe persoană (art. 260 alin. (1) lit. a)) și minimul
  din construcții (OUG 156/2024).

Netul, contribuțiile și costul le calculează la build motorul calculatorului:

- la minim: 2.699 lei net și 4.418 lei cost pentru firmă;
- la 1 leu peste minim, suma scutită dispare și netul scade la 2.614 lei;
- netul se recuperează abia de la 4.480 lei brut. Asta e „capcana de 1 leu”, pe
  care paginile din top nu o explică.

**Ce nu s-a schimbat, intenționat:**

- titlul paginii (`<title>`);
- prețurile;
- foaia din erou;
- regula „nicio propoziție care nu se poate arăta în cinci minute”;
- pagina „Ce nu facem”.

Fiecare afirmație nouă a fost verificată pe cod sau pe o altă pagină a sitului.
Lista cu ce **nu** se poate afirma e în
[`vestventures/_surse/fapte.md`](../../vestventures/_surse/fapte.md) §10.

---

## 7. Defecte reparate pe parcurs

| Unde                                                     | Defect                                                                                                                                                                                                                                                       | Reparația                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `/evidenta-orelor-de-munca`                              | Dădea microîntreprinderilor excepția de la art. 119 alin. (2). Legea 275/2022 a respins OUG 37/2021, iar forma consolidată (recitită pe 6 oct) acoperă doar salariații mobili și pe cei de la domiciliu. Exact publicul nostru primea o scutire inexistentă. | Excepția corectă, cu motivul.               |
| `/ghid/control-itm`                                      | Cita art. 125 alin. (3) pentru informarea ITM despre munca de noapte.                                                                                                                                                                                        | alin. (6)                                   |
| `/module`, `/domenii/servicii`, `llms.txt`, ambele limbi | Promiteau un „prag de absenți simultani”. Funcția `conflictDeEchipa` există, dar n-o cheamă nimeni și nicio setare n-o configurează.                                                                                                                         | „calendarul echipei: cine lipsește și când” |
| `/module`, ambele limbi                                  | „Import din Excel pe loturi” la inventar. Există tabela, dar niciun ecran.                                                                                                                                                                                   | scos                                        |
| `/module`, ambele limbi                                  | „Notificare pe e-mail” la anunțuri. Nu există șablon de e-mail; fișa modulului spunea chiar „Nu trimite pe e-mail”.                                                                                                                                          | „în aplicație și în portal”                 |
| `/module`                                                | Actori interni afișați: `org_admin`, `sistem`.                                                                                                                                                                                                               | „administrator”, „automat”                  |
| `/preturi`                                               | Slug-uri afișate lângă numele modulelor („Parc auto flota”).                                                                                                                                                                                                 | numele duce la pagina modulului             |
| `/unelte`                                                | Titlul pomenea două unelte, deși sunt șapte; descrierea avea 195 de caractere.                                                                                                                                                                               | titlu și descriere noi, sub limită          |
| `/pentru-contabili`                                      | Pilotul numea „nucleu” un set care pe `/preturi` costă 249, nu 149.                                                                                                                                                                                          | modulele, pe nume                           |
| Calculator, formularul de demo                           | Câmpuri de 15 px: Safari pe iOS mărește pagina la atingere.                                                                                                                                                                                                  | 16 px                                       |
| Datele structurate                                       | `Organization.logo` era SVG; Google cere raster de minimum 112 px.                                                                                                                                                                                           | `/apple-icon`, PNG de 180 px                |

---

## 8. Ce rămâne, în ordinea impactului

### De hotărât de voi

1. **Numele și fotografiile fondatorilor pe pagina de start.** Concurentul cel
   mai apropiat pune echipa cu poze, iar pentru un produs fără clienți e cel mai
   puternic semn de încredere. Promisiunea „Vorbești cu oamenii care fac
   aplicația” e deja pe pagină. Cu un nume și o față ar cântări dublu. N-am pus
   nimic fără acordul vostru.
2. **Garanție.** Pontajj oferă 30 de zile cu banii înapoi. Noi oferim prima
   lună gratuită, ceea ce e echivalent pentru prima lună. O garanție pe prima
   lună plătită e decizie comercială, nu de cod.
3. **Google Ads pe potrivire exactă** pentru „program salarizare” și „aplicatie
   pontaj angajati”, cu trimitere spre paginile de modul. Organic, pe acești
   termeni se urcă în luni.

### Din afara sitului (cel mai mare efect)

4. **Primul link real**: Bing Webmaster Tools, apoi profiluri în directoare
   (Capterra, G2, GetApp) și pagina de LinkedIn activă. Detalii în
   [`vizibilitate-organica.md`](vizibilitate-organica.md) §4B.
5. **Email Obfuscation oprit în Cloudflare.** E semnalat în al patrulea audit la
   rând: blochează randarea ~0,45 s pe mobil.
6. **Acces la Search Console și Keyword Planner** pentru contul Google pe care
   lucrăm, ca să măsurăm direct, nu din capturi.

### Pagini noi și îmbunătățiri, după cercetarea din 6 oct

7. **Ghidul de salariu minim: istoricul de dinainte de 2025.** Fiecare valoare
   intră doar cu hotărârea ei, citită pe textul oficial. La fel, netul și costul
   pentru primul semestru din 2026, care cer pragurile de atunci ale sumei
   scutite.

8. **Diurna externă**: calculator, coloana de cazare, echivalentul în lei la
   cursul BNR, ancore pe țări.
9. **Calculatorul de salariu**: comutator între semestre, statusuri speciale,
   tichete, fluturaș PDF.
10. **Calculator de zile de concediu**, pro-rata pe lunile lucrate. Cererea
    pentru „zile concediu de odihna” a crescut cu +900%.
11. **„2026” în titlurile modelelor**, plus un model completat la fiecare.

---

## 9. Cum știm dacă a mers

Evenimentele Umami au nume noi, ca sursa fiecărui clic să se poată citi:

- `cta-erou`, `cta-erou-secundar`, `telefon-erou` — eroul;
- `produs-*`, `demo-leave` — rândurile de produs și demo-ul fără cont;
- `unealta-*` — cardurile de unelte;
- `cta-incepe`, `cta-incepe-demo` — banda de pornire.

| Întrebare                             | Semnalul                                                                               | Când se citește    |
| ------------------------------------- | -------------------------------------------------------------------------------------- | ------------------ |
| Pagina de start convertește mai bine? | Înscrieri și cereri de demo raportate la vizitele pe `/`, față de septembrie           | după 4 săptămâni   |
| Se folosește calea „fără cont”?       | `demo-leave` și `unealta-*` față de `cta-erou`                                         | după 2 săptămâni   |
| Telefonul din erou aduce apeluri?     | `telefon-erou`, plus apelurile primite efectiv                                         | săptămânal         |
| Uneltele câștigă din legăturile noi?  | Afișări în Search Console pe `/unelte/*`, mai ales pe calculator (azi 0 în 28 de zile) | după 3–4 săptămâni |

**Infirmarea:** dacă după patru săptămâni clicurile pe „Programează o
demonstrație” sunt sub cele pe „Vezi prețurile” de dinainte, butonul secundar
revine la preț.
