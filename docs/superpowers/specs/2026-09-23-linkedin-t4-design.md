# LinkedIn, trimestrul 4 2026 — design

Data: **23 septembrie 2026**. Stabilit prin brainstorming cu Miro, secțiune cu
secțiune. Planul de implementare: `docs/superpowers/plans/2026-09-23-linkedin-t4.md`.

## 0. Scopul și ce s-a decis

**Scopul:** conversații care duc la primii clienți plătitori — nu urmăritori.
Pragul din `docs/comercial/analiza-investitor.md`: 5 clienți plătitori în luna 4.

| Decizie            | Valoare                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Cine vorbește      | **Doar pagina de firmă** (`linkedin.com/company/144846087`); profilul lui Miro doar redistribuie ocazional |
| Orizont            | **29 sept – 30 dec 2026**, 28 de postări                                                                   |
| Structură          | **Hibrid**: zile fixe ca format, o temă pe lună                                                            |
| Direcție vizuală   | **Foaia + cifra**: rama foii de pontaj de pe sit, cifra mare ca vedetă                                     |
| Dovezi             | **Piloți anonimizați** (domeniu, județ, număr de angajați — fără nume)                                     |
| Îndemnul principal | **Programul pilot pentru contabili**                                                                       |
| După pilot         | **Comision recurent 20%, 6 luni**, din prima lună plătită a fiecărei firme                                 |
| Cont de cabinet    | Sub-proiect separat, livrat înainte de 1 apr 2027; în pilot atribuirea e manuală (vezi revizuirea din §1)  |

**Nu facem în T4:** reclame plătite, grupuri de schimb de like-uri, cifre legale
care nu sunt deja pe sit, promisiuni despre salariul minim 2027 înainte de
publicarea oficială.

## 1. Strategia și distribuția

**Vocea.** Pagina Administrativo, la plural („noi”), la persoana a doua cu
cititorul. Ton de coleg care a citit legea, nu de vânzător. Articolul lângă
fiecare afirmație, exact ca pe sit.

**Publicul, în ordine:** (1) contabilul care ține mai multe firme; (2) patronul
cu 5–20 de angajați — pragul ofertei; (3) omul de HR.

**Săptămâna 0 (24–28 sept):**

- pagina completă: sigla, banner 1128×191 în stilul foii, descriere, sit cu UTM;
- profilul lui Miro: experiența curentă legată de pagină;
- invitații de urmărire din creditele lunare gratuite — contabilii întâi;
- o singură postare de anunț de pe profil, care redistribuie pagina;
- pe sit: `sameAs` în `Organization` → `https://www.linkedin.com/company/144846087/`.

**Ritmul:** marți și joi la 8:30. Zilnic (zile lucrătoare) 3–5 comentarii utile
ale paginii la postări de contabili și HR — pentru o pagină nouă, principalul
canal de descoperire. Profilul lui Miro redistribuie cel mult o dată pe
săptămână, doar caruselele-ghid.

### Pilotul pentru contabili

| Element      | Valoare                                                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locuri       | 10 cabinete, câte 1–3 firme-client fiecare                                                                                                                                                                            |
| Înscrieri    | lansare **6 oct**, închidere **15 nov**                                                                                                                                                                               |
| Pentru firme | gratuit până pe **31 martie 2027**, punere în funcțiune făcută de noi                                                                                                                                                 |
| Ce cerem     | o discuție de 30 de minute pe lună + acord pentru un caz anonimizat                                                                                                                                                   |
| După pilot   | **20% din abonamentul fiecărei firme aduse, 6 luni**, din prima lună plătită (la nucleu: 29,80 lei/lună/firmă)                                                                                                        |
| Acoperire    | nucleul (pontaj, concedii, REGES, SSM, portal); salarizarea doar dacă cabinetul confirmă valorile legale ⚠ din `NOTES.md`                                                                                             |
| Atribuirea   | în pilot, **manuală**: punerea în funcțiune o facem noi, deci știm ce firmă vine de la ce cabinet. Registrul stă în afara repo-ului (date personale ale contabililor). Linkul `?cabinet=` intră în contul de cabinet. |

**De ce corect „gratuit pentru firme”, nu „cont gratuit pentru contabil”:**
contul contabilului e deja gratuit — aplicația n-are tarif de cabinet
(`src/content/landing/pentru-contabili.ts`, antetul), iar accesul la fiecare
firmă îl dă administratorul ei. Plătitorul e mereu firma.

**Mesajul:** în postări se vinde timpul câștigat. Comisionul se spune o dată,
clar, la lansare și pe `/pentru-contabili`.

**Munca de cod care decurge** (sarcini separate în plan):

1. `sameAs` în datele structurate;
2. secțiunea „Pilot” pe `/pentru-contabili`, cu îndemn spre `/cere-demo`;
3. contul de cabinet complet, **cu atribuirea `?cabinet=`** — sub-proiect
   separat, spec în decembrie din discuțiile cu piloții, livrat înainte de
   1 aprilie 2027, când începe comisionul.

**Revizuire la scrierea planului (23 sept):** atribuirea prin link fusese
aleasă ca „minim acum”. Codul arată că nu există unde s-o stochezi fără o
migrare pe producție: `organizations` n-are coloană potrivită, iar
`inregistreaza_organizatie` are semnătură fixă (0145). În pilot fiecare firmă e
pusă în funcțiune de noi, deci atribuirea e cunoscută fără link; migrarea se
face o singură dată, în contul de cabinet, nu de două ori.

## 2. Calendarul

**C** = carusel 6–8 slide-uri, marți · **I** = imagine unică, joi ·
★ = îndemn spre pilot · ⧗ = dependență · ↺ = mutată de pe o zi nepotrivită.

### Octombrie — _Angajarea corectă_

| #   | Data      | F   | Subiect                                                    | Cifra-vedetă        | Sursa                       |
| --- | --------- | --- | ---------------------------------------------------------- | ------------------- | --------------------------- |
| 1   | Ma 29 sep | C   | Ce trebuie să țină la zi o firmă mică: 6 obligații, un loc | **6**               | `/`                         |
| 2   | J 1 oct   | I   | Diurna: plafonul nu e scris în nicio lege                  | **57,50 lei** ⚠     | `/ghid/diurna`              |
| 3   | Ma 6 oct  | C ★ | Lansarea pilotului                                         | **10 cabinete**     | `/pentru-contabili` ⧗       |
| 4   | J 8 oct   | I   | REGES: contractul pleacă în ziua dinainte                  | **20.000 lei**      | `/reges-online`             |
| 5   | Ma 13 oct | C   | Culise: ce e incomplet în documentația API-ului REGES      | **5 canale, nu 1**  | fapte verificate            |
| 6   | J 15 oct  | I   | Foaia de pontaj care își calculează sărbătorile            | **17 sărbători**    | `/unelte/foaie-de-pontaj`   |
| 7   | Ma 20 oct | C   | Control ITM: cele 8 documente și cum se compară            | **8**               | `/ghid/control-itm`         |
| 8   | J 22 oct  | I   | Primirea la muncă fără contract                            | **40.000 lei**      | `/ghid/control-itm`         |
| 9   | Ma 27 oct | C   | Evidența orelor, art. 119, și excepția cu acord scris      | **1.500–3.000 lei** | `/evidenta-orelor-de-munca` |
| 10  | J 29 oct  | I ★ | Pontaj de pe telefon, captură reală                        | **1 atingere**      | `/pontaj-pe-telefon`        |

### Noiembrie — _Concediile pe 2027_

| #   | Data      | F   | Subiect                                                                | Cifra-vedetă        | Sursa                                  |
| --- | --------- | --- | ---------------------------------------------------------------------- | ------------------- | -------------------------------------- |
| 11  | Ma 3 nov  | C   | Programarea concediilor pe 2027 până pe 31 decembrie (art. 148)        | **31.12**           | `/ghid/concediu-de-odihna`             |
| 12  | J 5 nov   | I   | 20 de zile e minimul, nu norma; sărbătorile nu intră                   | **20**              | idem                                   |
| 13  | Ma 10 nov | C   | Primul caz din pilot, anonimizat                                       | cifrele cazului     | ⧗ pilot; rezervă: o lună în firma demo |
| 14  | J 12 nov  | I ★ | Ultimul apel la pilot                                                  | **3 zile**          | `/pentru-contabili`                    |
| 15  | Ma 17 nov | C   | Concediul neefectuat: report 18 luni, bani doar la încetare (art. 146) | **18 luni**         | `/ghid/concediu-de-odihna`             |
| 16  | J 19 nov  | I   | Cererea de concediu care scade singură weekendurile și sărbătorile     | —                   | `/unelte/cerere-concediu-de-odihna`    |
| 17  | Ma 24 nov | C ★ | Pentru contabili: 5 fișiere din aceleași date                          | **5 fișiere**       | `/pentru-contabili`                    |
| 18  | J 26 nov  | I   | Concediul de îngrijitor: 5 zile lucrătoare pe an                       | **4.000–8.000 lei** | `/ghid/concediu-de-odihna`             |

### Decembrie — _Închiderea de an_

| #   | Data            | F   | Subiect                                                    | Cifra-vedetă          | Sursa                     |
| --- | --------------- | --- | ---------------------------------------------------------- | --------------------- | ------------------------- |
| 19  | **Mi 2 dec** ↺  | C   | 2027 în zile lucrătoare; 8 din 17 sărbători cad în weekend | **252**               | calendarul aplicației     |
| 20  | J 3 dec         | I   | Decembrie are 21 de zile lucrătoare                        | **21**                | foaia de pontaj           |
| 21  | Ma 8 dec        | C   | Lista de final de an a angajatorului                       | **5 până pe 31**      | mai multe ghiduri         |
| 22  | J 10 dec        | I   | SSM: ce expiră și cine uită                                | ⚠ sursa se verifică   | pagina modulului SSM      |
| 23  | Ma 15 dec       | C   | Culise: de ce datele unei firme nu pot apărea la alta      | **0 rânduri**         | `/pentru-contabili`       |
| 24  | J 17 dec        | I ★ | Pilotul la jumătate: ce am învățat                         | cifre reale           | ⧗ pilot                   |
| 25  | Ma 22 dec       | C   | Ce am învățat în 2026 construind un program de HR          | —                     | culise                    |
| 26  | **Mi 23 dec** ↺ | I   | Programul sărbătorilor + o urare scurtă                    | **25–26 · 1–2 · 6–7** | calendar                  |
| 27  | Ma 29 dec       | C   | Un an de REGES-Online ca registru unic                     | **1 an**              | `/reges-online`           |
| 28  | **Mi 30 dec** ↺ | I   | Foaia de pontaj pe ianuarie 2027 e gata                    | **18 zile**           | `/unelte/foaie-de-pontaj` |

↺ 1 decembrie e sărbătoare legală; 24 și 31 decembrie sunt ajun de sărbătoare.

**Cifrele de calendar** (252, 8 din 17, 21, 18) sunt calculate pe 23 sept cu
`sarbatoriAnului()` din `src/domain/calendar/sarbatori.ts` — același cod ca
aplicația. Se recalculează la producția lotului, nu se copiază de aici.

**Lotul 1 deja scris** (`docs/comercial/linkedin/postari-s01-s02.md`) se
redistribuie: povestea → #1, rescrisă cu vocea firmei și ca carusel; diurna → #2;
REGES API → #5; foaia de pontaj → #6. #4 e nouă.

### Dependențe

| Ce                                                   | Termen              | Dacă întârzie                                    |
| ---------------------------------------------------- | ------------------- | ------------------------------------------------ |
| Secțiunea pilot pe `/pentru-contabili`, în producție | **5 oct**           | #3 ↔ #5 (lansarea pe 13 oct)                     |
| Un pilot activ, cu acord de caz                      | **9 nov**           | #13 pe firma demo                                |
| 23 lei/zi reverificat pe Portalul Legislativ         | ziua dinainte de #2 | se actualizează și `src/content/legal/diurna.ts` |
| Salariul minim 2027                                  | —                   | nu intră; apare doar după publicarea oficială    |

## 3. Sistemul vizual

### Fundația, luată de pe sit (`src/app/globals.css`, `--color-mk-*`)

| Rol               | Valoare                                 | Folosire                                    |
| ----------------- | --------------------------------------- | ------------------------------------------- |
| Hârtie            | `#ecefec`                               | fondul slide-urilor                         |
| Cerneală          | `#0e1c21`                               | text, cifra-vedetă, fondul slide-ului final |
| Text slab         | `#4a5a5e`                               | secundar, temeiul legal                     |
| Riglă / liniatură | `#7b8982` / `#c7cfc9`                   | grila foii                                  |
| Verde CO          | `#2f6b52`                               | marcaj pilon _Unelte_                       |
| Ocru SL           | `#b4802a`                               | marcaj pilon _Culise_                       |
| Roșu AN           | `#a8443a`                               | marcaj **doar** pentru amenzi               |
| Ușa               | `#0f1e3d` pe `#faf7f0`                  | pilotul și îndemnurile                      |
| Hașura            | 45°, `#93a5a6` 1px / 7px                | weekendurile din bandă, colțul ramei        |
| Fonturi           | Fira Sans Condensed · Fira Mono · Inter | cifre și titluri · articole și date · text  |

Regula sitului rămâne: **culorile legendei sunt marcaje, niciodată text.**

**Formate:** 1080×1350 (4:5) pentru tot; banner 1128×191; sigla 400×400 din
`docs/comercial/sigla/sigla-administrativo-transparent.png`.

### Șabloanele

1. **Copertă** — banda de zile L M M J V S D (weekend hașurat), cifra-vedetă
   180–240 px, fraza, eticheta pilonului cu pătratul colorat, „1/N →”.
2. **Regulă** — număr de ordine, regula în 2–4 rânduri, temeiul legal într-o
   celulă de tabel jos, în Fira Mono.
3. **Grilă** — comparație în celulele foii (de ex. public vs. privat).
4. **Final** — fond cerneală, adresa ghidului, „urmărește pagina”. Varianta
   pilot: fond ușă, „10 cabinete · 20% timp de 6 luni”, `/pentru-contabili`.
5. **Imagine (joi)** — copertă comprimată: cifra, fraza, temeiul, adresa.
6. **Captură** — rama foii în jurul unei capturi din **firma demo**, niciodată
   dintr-o firmă reală.

**Pătratul din colț = pilonul:** cerneală _Legislație_ · verde _Unelte_ ·
ocru _Culise_ · ușă _Produs și pilot_.

**Lizibilitate:** max 40 de cuvinte pe slide, text ≥ 36 px, doar perechi de
contrast deja măsurate pe sit. Fiecare imagine are text alternativ scris.
Imaginea nu repetă textul postării: imaginea duce cifra și regula, postarea
contextul și întrebarea.

### Unde se lucrează

O pânză Claude Design, _„LinkedIn T4 — Administrativo”_: întâi sistemul
(culorile și cele șase șabloane), apoi planșele fiecărui lot. Exportul: LinkedIn
cere **PDF** pentru carusel, **PNG** pentru imagine. Dacă pânza nu exportă direct
la 1080×1350, planșele se randează local cu Playwright (verificat că merge pe
mașină). Fișierele exportate nu intră în git; sursa e pânza.

## 4. Producția și măsurarea

### Loturile

| Lot | Postări | Rulează        | Livrat până pe             |
| --- | ------- | -------------- | -------------------------- |
| L1  | #1–4    | 29 sep – 8 oct | **Vi 25 sep** (+ bannerul) |
| L2  | #5–8    | 13 – 22 oct    | Vi 9 oct                   |
| L3  | #9–12   | 27 oct – 5 nov | Vi 23 oct                  |
| L4  | #13–16  | 10 – 19 nov    | Vi 6 nov                   |
| L5  | #17–20  | 24 nov – 3 dec | Vi 20 nov                  |
| L6  | #21–24  | 8 – 17 dec     | Vi 4 dec                   |
| L7  | #25–28  | 22 – 30 dec    | Vi 18 dec                  |

**Un lot conține, pe postare:** textul, primul comentariu cu link UTM
(`?utm_source=linkedin&utm_medium=social&utm_campaign=t4-NN-<subiect>`),
hashtag-urile (max 3), textul alternativ, data și ora, verificările ⚠, fișierul
de urcat. Textele: `docs/comercial/linkedin/lot-NN.md`, comise și împinse.

**Săptămâna lui Miro (~1 oră):** luni 20 min citire + programare; zilnic 10 min
comentarii; în ziua postării 5 min link în comentariu + răspunsuri în primele
2 ore; vineri 5 min tabelul de rezultate.

**La fiecare lot, Claude:** citește tabelul, ajustează, scrie cele 4 postări,
verifică fiecare cifră în `src/content/legal/*.ts`, face planșele, exportă,
comite și împinge.

### Măsurarea

**Indicatorul principal:** înscrierile la pilot (țintă 10 până pe 15 nov).
Apoi conversațiile: mesaje private + cereri pe `/cere-demo`.

Pe postare, la 7 zile: afișări, reacții, comentarii, redistribuiri, clicuri,
vizite UTM (Umami), mesaje. Pe pagină: urmăritori, săptămânal. Tabelul stă în
`docs/comercial/linkedin/README.md`. Postările se compară între ele, nu cu
medii din industrie.

### Reguli de ajustare

| Punct               | Dacă…                                  | Atunci…                                                                               |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| Săpt. 4 (Vi 23 oct) | < 200 afișări/postare în medie         | distribuție: mai multe invitații și comentarii; profilul redistribuie fiecare carusel |
|                     | < 3 înscrieri la pilot                 | mesaj: alt unghi + mesaje directe către contabilii din rețeaua lui Miro               |
| Săpt. 8 (Vi 20 nov) | < 5 cabinete                           | înscrieri prelungite până pe 15 dec; +2 îndemnuri în decembrie                        |
|                     | un format aduce clar mai multe clicuri | decembrie se reechilibrează spre el                                                   |
| Oricând             | greșeală legală semnalată              | corectată în aceeași zi: postare, comentariu fixat, pagina de pe sit                  |

Pragurile se recalibrează la săptămâna 4, pe cifrele reale.
