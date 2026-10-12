## G. Foaia de parcurs: document justificativ complet pentru deducere

**Scop:** foaia de parcurs de pe `/unelte/foaie-de-parcurs` să conțină, literal, cele patru informații pe care normele Codului fiscal le cer pentru deducerea integrală. Pe lângă ele: antetul unui document justificativ, mai multe curse pe zi, alimentările, rezumatul lunii și un Excel care calculează singur. Pagina explică, cu temeiul, ce trebuie să conțină foaia și cum stau 50% și 100% la impozitul pe profit și la TVA. Așa devine cea mai completă foaie de parcurs gratuită și fără cont de pe piață.

**De ce:** auditul live din 8 oct 2026 (`audit-unelte.json`, agentul foii de parcurs plus verificarea adversarială) a dat unealtei scorul de utilitate **2 din 5** și a scris: „azi e mai puțin folositoare decât alternativele gratuite”. Ce a găsit, cu cifre:

1. **Lipsește categoria vehiculului**, unul dintre cele 4 elemente minime. PDF-ul, DOCX-ul și XLSX-ul descărcate din producție au doar „Nr. de înmatriculare”, „Marca și modelul”, „Conducător auto” și firma. Cuvântul „categ” nu apare nicăieri. Norma de consum e doar o linie goală în subsol (`model.ts:67-69`). Severitate confirmată: major.
2. **Un singur rând pe zi.** Pentru octombrie sunt 31 de rânduri de 16 pt (~5,6 mm), iar coloana „Traseul” ocupă 6/22,5 din lățime (`model.ts:56-65`, `pdf.ts:34`). Agentul de vânzări face 4–6 opriri pe zi și e tocmai categoria cu deducere integrală (art. 25 alin. (3) lit. l) pct. 2).
3. **Zero formule în Excel.** `grep -c '<f>'` pe foaia descărcată dă 0. Data e șir de caractere, celulele goale sunt `""`, iar „Total km parcurși: ________” se adună de mână (`xlsx.ts:35`).
4. **Lipsesc numărul foii, CUI-ul, data întocmirii și perioada** (OMFP 2634/2015, anexa 1 pct. 2–3). Lipsesc și **alimentările și stocul de combustibil**, deci norma nu se poate pune lângă bonuri.
5. **Pagina trimite la contabil** („ce elemente minime cer normele … stabilește contabilul firmei”, `page.tsx:102`), deși normele le enumeră textual. Despre TVA (art. 298) și pragul de 3.500 kg / 9 locuri nu spune nimic.
6. **PDF:** subsolul cu legătura apare doar pe ultima pagină (`pdf.ts:203-226`), weekendurile nu se deosebesc (`umbrite: []`), iar emoji-urile și ideogramele ies ca pătrățele goale.

Concurența gratuită arată unde e ștacheta. foi-parcurs.ro, fără cont, are: număr foaie, CUI, tip combustibil, consum normat, km inițiali, rute multiple, alimentări, totaluri și consum estimat, dar doar PDF. Modelele statice CargoTrack au categoria vehiculului și norma, dar fără formule și cu sedile. Generatoarele plătite (foiparcursauto.ro, de la 7,99 lei pe lună) au hartă și FAZ. Nimeni nu are gratuit un **Excel cu formule** și nici temeiul scris pe foaie. În Search Console, foaia de parcurs are **0 afișări** în 35 de zile, iar la „foaie de parcurs model” primele rezultate sunt articole, nu modele. Locul e liber.

**Verificat pe sursă primară** (curl pe legislatie.just.ro, 8 oct 2026, textul salvat în `lucru-foaie-parcurs/legi/`):

- **Codul fiscal**, `DetaliiDocument/171282`, consolidat la **08.08.2026**:
  - art. 25 alin. (3) lit. l): 50% pentru vehiculele „care nu sunt utilizate exclusiv în scopul activității economice”, cu masa ≤ 3.500 kg și ≤ 9 scaune cu tot cu al șoferului. Excepțiile pct. 1–5 sunt urgență/pază/curierat, agenți de vânzări și achiziții, transport de persoane cu plată, servicii cu plată/închiriere/școli de șoferi și vehicule-marfă. Amortizarea nu intră sub limită.
  - art. 298 alin. (1)–(3): aceeași limită de 50% pentru TVA. Alin. (2) dă pragul 3.500 kg / 9 scaune. Alin. (3) lit. a)–f) are excepțiile, iar închirierea și leasingul apar separat, la lit. e).
- **Normele HG 1/2016**, `DetaliiDocument/212504`, consolidate la **31.03.2026**:
  - titlul II pct. 16 alin. (2) și titlul VII pct. 68 alin. (2), textual: foaia de parcurs „trebuie să cuprindă [pct. 68: «să conțină»] cel puțin următoarele informații: categoria de vehicul utilizat, scopul și locul deplasării, kilometrii parcurși, norma proprie de consum carburant pe kilometru parcurs”. Aceeași listă apare la titlul IV, pentru venitul net din activități independente (normele la art. 68 alin. (7) lit. k)).
  - pct. 68 alin. (4): cine aplică deducerea de 50% „nu trebuie să facă dovada utilizării vehiculului … cu ajutorul foii de parcurs”.
  - pct. 68 alin. (8): încadrarea vehiculelor „se realizează de fiecare persoană impozabilă”.
- **OMFP 2634/2015**, `DetaliiDocument/173682`, consolidat la **01.08.2024**. Anexele `DetaliiDocumentAfis/286044` și `/286045` nu conțin niciun model de foaie de parcurs: singurele potriviri pentru „parcurs” sunt „pe parcursul”. Anexa 1 pct. 2 cere numărul și data documentului, iar pct. 3 cere CIF-ul.
- **⚠ Neconfirmat** (trecut în `NOTES.md` în G8):
  - ce înseamnă exact „categoria de vehicul”, fiindcă normele nu o definesc;
  - dacă lipsa unui singur element duce singură la pierderea deducerii;
  - actele Ministerului Transporturilor pentru transportul rutier profesional.

**Precondiții.** Secțiunea G se execută după A și B. Folosește:

| Ce folosește | De unde vine |
| --- | --- |
| `ANTET_CACHE_DESCARCARE` | A5 |
| `curataText`, `curataDocument` | B2 |
| `AvizCorectari` | B4 |
| `Banda` cu `data-tipar` | B5 |
| `data-tipar-pagina` din previzualizare și `e2e/unelte-tipar.spec.ts` | B6 |
| `avizeParametri` | B8 |

Pasul 0, o singură dată, înainte de G1. Fiecare `grep` trebuie să scoată exact o linie; altfel G nu începe:

```bash
cd /srv/apps/ERP
grep -n "export const ANTET_CACHE_DESCARCARE" src/lib/unelte/raspuns.ts
grep -n "export function curataDocument" src/lib/unelte/document-tabelar.ts
grep -n "export function AvizCorectari" "src/app/(marketing)/_componente/aviz-corectari.tsx"
grep -n "export function avizeParametri" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts"
grep -n '"data-tipar"?: "ascunde";' "src/app/(marketing)/_componente/banda.tsx"
grep -c -Pzo 'eticheta: "foaie de parcurs",\n\s+cale: "/unelte/foaie-de-parcurs\?luna=5&an=2027",\n\s+culcat: true,\n\s+pagini: \[1, 3\],' e2e/unelte-tipar.spec.ts
```

Ultimul `grep` scoate `1`. Intrarea foii de parcurs din `PAGINI` (B6) e scrisă pe cinci rânduri, cu `eticheta`, fiindcă pe un singur rând ar depăși `printWidth: 100`. De aceea `-z` (fișierul întreg ca o singură înregistrare) și `\n` în tipar; un `grep` pe un singur rând n-ar găsi-o niciodată.

**Coordonarea cu secțiunea E (adăugată la verificarea adversarială, 8 oct 2026).** Blocurile „vechi” din G1, G3, G4 și G6 sunt copiate din forma de după A5 + B, FĂRĂ E. Secțiunea E rulează și ea „după B” și rescrie exact aceleași fișiere:

| Task E | Ce face în fișierele lui G | Detecție (o linie găsită = e pe `main`) |
| --- | --- | --- |
| E4 | `pdf.ts`: rescrie `randeazaPdf` (liniile 77–230) în jurul lui `deseneaza`; „Pagina X din Y” pe fiecare pagină prin `textPagina`, dar subsolul și legătura tot doar pe ultima; creează `pdf-pagini.test.ts`. `document-tabelar.ts`: `inaltimeRand?`, `textAntetRulant`, `textPagina` | `grep -n "^function deseneaza\|export function textPagina" src/lib/unelte/pdf.ts src/lib/unelte/document-tabelar.ts` |
| E5 | `docx.ts`: `function sectiune(d)`, `randeazaDocxMultiplu`. `raspuns.ts`: `raspunsBinar(continut, format, numeFisier)`, `raspunsDocumente` | `grep -n "^function sectiune\|export function raspunsBinar" src/lib/unelte/docx.ts src/lib/unelte/raspuns.ts` |
| E6 | `xlsx.ts`: tiparul Excel comun (A4, rânduri de titlu repetate) | `git log --oneline -3 -- src/lib/unelte/xlsx.ts` |
| E12 | `registru.ts`: scoate `condica-de-prezenta` din `UNELTE` | `grep -c '"condica-de-prezenta"' src/lib/unelte/registru.ts` dă `0` |

Regula, la Pasul 0 al fiecărui task din G1–G6:

- **Niciun task E de mai sus pe `main`:** G se aplică exact cum e scris (verificat bloc cu bloc pe forma A5 + B, vezi mai jos). E4–E6 vin după G și trebuie să păstreze `tabeleSuplimentare`, `mapeazaTexte`, `campuriPeDouaColoane`, subsolul pe fiecare pagină și glifele. Atenție: Pasul 0 din E4 cere explicit doar păstrarea schimbărilor lui B (`git log e906d2c.. -- pdf.ts document-tabelar.ts`); comanda aceea va arăta și commit-urile lui G, iar executantul lui E trebuie să le păstreze la fel.
- **E4 e pe `main`:** blocurile „vechi” din `pdf.ts` (G1, G3, G4) nu se mai găsesc. Se aplică după SENS, pe forma lui E4: lățimile și `rand` din G1 în `deseneaza`; bucla câmpurilor din G4 în `deseneaza`; în G3 rămân glifele (`inlocuiesteGlifeLipsa` + `mapeazaTexte` la capul lui `randeazaPdf` ȘI al lui `randeazaPdfMultiplu`) și subsolul cu legătura pe fiecare pagină, dar **NU** se mai desenează „Pagina i din n”: îl desenează deja `textPagina` din E4, în același format, deci testul G3 trece pe el. Două numere de pagină pe aceeași foaie sunt defect.
- **E5 e pe `main`:** G1 pune tabelele suplimentare în `sectiune(d)`, nu în `randeazaDocx`. G6 NU mai adaugă `raspunsFisier`: ruta foii de parcurs cheamă `raspunsBinar(octeti, "xlsx", d.numeFisier)` (aceeași funcție, alte argumente), iar `raspuns.ts` nu se atinge.
- **E12 e pe `main`:** G6 scoate din `registru.ts` doar importul și rândul `"foaie-de-parcurs"`, iar docblock-ul numește toate rutele statice rămase.
- În oricare caz de mai sus, `tsc`, `check:server`, `eslint`, `vitest` și `prettier --check` rulează pe forma rezultată, iar testele lui E (`pdf-pagini.test.ts`, `docx-sectiuni.test.ts`) și ale lui G trebuie să fie verzi împreună. Dacă nu se poate fără să rescrii logica lui E, te oprești și spui; nu alegi tu între cele două.

**Coordonarea cu H și I (adăugată la a doua verificare, 8 oct 2026).** H știe de G (tabelul lui de ordine, `H-fisa-ssm.md:37-39`). I NU știe: `I-fisa-evaluare.md` nu pomenește nici `mapeazaTexte`, nici `tabeleSuplimentare`, iar I3 înlocuiește `curataDocument` în forma din B2 (ca să curețe `rubrici`). Dacă G1 e deja pe `main`, blocul „vechi” al lui I3 nu se mai găsește. Regula, pentru executantul lui I3: curățarea `rubrici` (și orice altă cheie de text nouă) intră în `mapeazaTexte`, cu `f` în loc de `curataText`, ca să treacă și prin glifele PDF din G3; `curataDocument` rămâne `mapeazaTexte(d, curataText)`. Testul G1 „curataDocument curăță și celulele tabelelor suplimentare” trebuie să rămână verde.

**Hotărât de criticul de completitudine (8 oct 2026): E4–E6 rulează ÎNAINTEA lui G1–G4**, deci la execuție se aplică ramura „E4 e pe `main`” / „E5 e pe `main`” de mai sus. Motivele: H2, H3, I3 și I4 sunt scrise deja pe forma lui E4/E5 (`deseneaza`, `sectiune(d)`) și au reguli de aplicare pe diff pentru G; E4 rescrie `randeazaPdf` întreg, iar a reaplica o rescriere întreagă peste trei schimbări mici e mai riscant decât a reaplica trei schimbări mici, după sens, pe o funcție nouă; E4–E6 sunt infrastructură comună (chenar, titlu repetat, „Pagina X din Y”, Word pe secțiuni, tipar Excel) de care beneficiază toate uneltele, deci intră în valul 2, iar G în valul 3. Consecințe pentru executantul lui G: G3 nu mai desenează „Pagina i din n” (îl desenează `textPagina` din E4); G1 pune tabelele în `sectiune(d)` din `docx.ts`; G6 cheamă `raspunsBinar(octeti, "xlsx", d.numeFisier)`, fără `raspunsFisier`. Subsolul cu legătura pe FIECARE pagină (D8) rămâne o schimbare globală a lui G3; H (D10) l-a descris doar pe ultima pagină și acceptă forma lui G (notă adăugată acolo).

Textul original, păstrat pentru context: ⚠ **De decis de orchestrator, nu de executant:** ordinea dintre E4–E6 și G1–G4. Planurile H și I presupun deja „G după E4” (H vorbește de „bucla câmpurilor din `deseneaza`”), iar G e scris pe forma de dinainte de E. Varianta cu cel mai puțin risc: G1–G4 înainte de E4–E6, fiindcă E4 rescrie oricum `randeazaPdf` întreg, iar Pasul 0 al lui îi arată executantului, prin `git log e906d2c..`, tot ce s-a schimbat între timp. Cealaltă ordine cere ca G1, G3 și G4 să fie reaplicate după sens pe `deseneaza`, fără blocuri verificate.

**Convenții.** `REPO=/srv/apps/ERP`. `SCRATCH` e directorul scratchpad al sesiunii care execută. Căile cu paranteze se pun între ghilimele. Codul din secțiune e deja trecut prin `prettier` (`printWidth: 100`). Lanțul complet al fiecărui task:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

Pe fișierele taskului se rulează apoi `pnpm exec prettier --check`, iar după commit `node scripts/checks/lastmod.mjs`. Fără `pnpm build`.

Am pregătit codul într-o copie a sursei, în scratchpad (`lucru-foaie-parcurs/sandbox`), cu precondițiile A5/B2/B4/B5/B6/B8 aplicate din textul secțiunilor lor. Acolo am rulat:

- **tsc:** 0 erori pe fișierele atinse;
- **eslint și prettier:** curate;
- **vitest:** 477 de teste verzi pe `src/app/(marketing)`, `src/lib/unelte`, `src/app/api/unelte`, `src/content` și `src/app/(app)/flota`;
- **proba de roșu:** fiecare test nou pică pe codul de dinaintea taskului lui;
- **formulele Excel:** evaluate cu biblioteca Python `formulas`. 180 km × 16/100 = 28,8; stocul 40 + 40 − 48 = 32; diferența față de stocul constatat (35) = 3.
- **PDF-ul:** randat cu pdf.js și privit pagină cu pagină.

**Decizii luate**

- **D1. Un singur model de document, extins, nu un al doilea.** `DocumentTabelar` primește două chei **opționale**:
  - `tabeleSuplimentare`: titlu, coloane și rânduri, randate după tabelul principal;
  - `campuriPeDouaColoane`: doar pentru PDF.

  Celelalte cinci unelte nu le poartă, deci nu se schimbă nimic la ele. PDF-ul, Word-ul, previzualizarea și curățarea (`curataDocument`) le citesc pe amândouă. Curățarea trece printr-o funcție nouă, `mapeazaTexte`, singura listă a locurilor cu text din model, pe care o folosește și înlocuirea glifelor lipsă în PDF. Am respins un tip separat de document pentru foaie: previzualizarea și fișierele s-ar fi despărțit la prima corectură, exact ce `document-tabelar.ts` spune că evită.
- **D2. Excel-ul are randare proprie (`excel.ts`) și rută statică `/api/unelte/foaie-de-parcurs`, ca foaia de pontaj.** Foaia iese din registrul `[unealta]`, iar adresa publică rămâne aceeași, fiindcă ruta statică are prioritate. Am respins formulele „declarative” în model: adresele celulelor depind de câte rânduri are antetul, câte curse și câte alimentări sunt, deci un model generic ar fi descris un layout pe care nu-l controlează. Antetele de descărcare vin din `raspunsFisier`, extras din `raspunsDocument`. Așa constanta lui A5 rămâne într-un singur loc, iar paza lui A5 („nicio rută nu declară `public`”) se aplică și rutei noi.
- **D3. Cele patru elemente, fiecare cu rubrica lui în antet:**
  - Categoria vehiculului: listă aliniată la `CATEGORII_VEHICUL` și `ETICHETE_CATEGORIE` din modulul Flotă, fără remorcă, semiremorcă și utilaj, care nu se conduc pe foaie de parcurs.
  - Scopul și locul: coloanele tabelului.
  - Km: plecare, sosire, parcurși.
  - Norma: număr, scris „6,5 l/100 km (0,065 l/km)”. Normele spun „pe kilometru parcurs”, deci scriem ambele forme.

  Unitatea e kWh la electric și kg la GNC, ca la orice altă normă. O valoare necompletată devine **linie de completat de mână**, nu o valoare ghicită. Utilizarea vehiculului (exclusiv economic, cele cinci excepții, mixt) e o rubrică separată și se scrie cu temeiul din art. 25 și art. 298. Un test ține listele aliniate cu Flota, fără ca unealta publică să importe din `(app)`.
- **D4. Curse pe zi: 1–4, implicit 1.** Linkurile vechi dau aceleași 31 de rânduri, iar verificarea adversarială a coborât defectul la „minor”. Data se repetă pe fiecare rând, ca filtrarea din Excel să meargă. Weekendul se recunoaște după o coloană „Ziua” cu două litere (Lu, Ma, Mi, Jo, Vi, Sâ, Du), vizibilă și pe o imprimantă alb-negru, în toate formatele. Excel-ul umbrește în plus rândurile de sâmbătă și duminică. Am respins umbrirea pe rânduri în modelul comun: ar fi fost o a treia cheie nouă pentru un efect pe care coloana îl dă deja.
- **D5. Alimentări: 8 rânduri goale.** Rezumatul lunii are 11 rânduri, între ele stocul calculat după normă și stocul constatat la bord, cu diferența dintre ele. Diferența arată dacă norma ține față de bonuri, adică exact justificarea pe care normele o cer prin „norma proprie”.
- **D6. Antetul de document justificativ:** Unitatea, CUI, Foaia nr., Perioada și Data întocmirii, aceasta din urmă ca rubrică de mână. Firma trece din subtitlu în câmpul „Unitatea”. Semnăturile sunt „Conducător auto” și „Verificat și aprobat (administrator)”.
- **D7. Valorile invalide devin rubrici de completat, iar pagina spune ce a lăsat deoparte.** Avizele vin din `avizeFoaieParcurs`, alături de `avizeParametri` din B8. Acoperă norma, kilometrajul, stocul și numărul de curse, adică ce se tastează. Categoria, combustibilul și utilizarea sunt selecturi: formularul nu poate trimite altă valoare, iar una scrisă de mână în adresă devine rubrică goală, fără aviz (corectat la verificare: prima formulare promitea aviz pentru orice valoare). API-ul rămâne tolerant, ca în decizia D10 din B. Norma acceptă virgulă sau punct, cel mult 3 zecimale, peste 0 și cel mult 99,9. Kilometrajul acceptă gruparea cu punct („125.000”) și cel mult 5.000.000, plafonul `kmBord` din `src/schemas/fleet.ts`.
- **D8. PDF, pentru toate uneltele:**
  - subsolul cu legătura și „Pagina i din n” apar pe fiecare pagină;
  - caracterele fără glifă în DejaVu devin „?”, nu pătrățele;
  - un tabel suplimentar de cel mult 12 rânduri nu se rupe între pagini.

  Opt-in, doar pentru foaia de parcurs: câmpurile pe două coloane. Fișa SSM are 10 câmpuri și rămâne cum e, fiindcă formularul ei e anexa unui act normativ. Word-ul păstrează câmpurile pe rânduri: se editează oricum.
- **D9. Excel:**
  - **formulele:**
    - km parcurși = sosire − plecare;
    - consumul = ROUND(km × normă ÷ 100; 2), cu norma dintr-o **singură celulă** a antetului;
    - totalurile, alimentările, stocul după normă și diferența față de stocul constatat;
  - **validări:**
    - kilometrajul se scrie în km întregi;
    - km la sosire nu pot fi sub km la plecare;
  - **aspect:**
    - celulele cu formulă sunt gri;
    - data e dată adevărată, nu text;
    - foaia se recalculează la deschidere (`fullCalcOnLoad`);
  - **tipar:** antetul tabelului se repetă pe fiecare pagină (`printTitlesRow`), dar **nu se îngheață pe ecran**, fiindcă cele 13 rânduri de antet ar fi fixat jumătate din fereastră;
  - **ce nu are:**
    - parolă: o foaie pe care contabilul n-o poate corecta e mai rea decât una pe care o poate strica;
    - `paperSize`: `PaperSize` e `const enum`, incompatibil cu `isolatedModules`.
- **D10. Conținutul juridic al paginii spune doar ce e verificat, cu articolul.** Ce legea nu definește, adică „categoria de vehicul”, se spune ca atare și trece în `NOTES.md` cu ⚠. Fără `FAQPage` JSON-LD: e decizia scrisă în `date-structurate.tsx` (rezultatele îmbogățite s-au retras la 7 mai 2026). Întrebările sunt HTML simplu, citit și de motoarele generative.
- **D11. Atragerea utilizatorilor:**
  - un exemplu completat (agent de vânzări, 2 rânduri pe zi), cu evenimentul `parcurs-exemplu`;
  - un îndemn spre înregistrare cu eveniment propriu, `cta-foaie-parcurs`, după tiparul `cta-foaie-pontaj`, ca o secțiune transversală să-l găsească;
  - o descriere în Google care spune „cele 4 elemente cerute de normele Codului fiscal”, adică ce nu are niciun concurent gratuit.

  Banda Flotă spune doar ce face aplicația. Șoferul **nu** completează foaia în aplicație: `trip_sheets:update` e doar al lui `org_admin`. Banda spune deci „kilometrajul de plecare se propune din foaia anterioară, un regres sau un salt se semnalează, consumul se compară cu cel declarat, șeful de echipă aprobă”, fiecare cu acoperire în cod (`kmDePlecareSugerat`, `odometer_anomalies`, `abatereConsum`, `trip_sheets:approve`=team).
- **D12. Titlul rămâne „Foaie de parcurs: model Word, PDF și Excel”** (42 de caractere, ≤ 48). Descrierea nouă are 159 de caractere (testul cere 70–160).
- **D13. Fără bază de date, fără sesiune, fără migrare.** Generarea e mărginită: cel mult 31 × 4 curse plus 8 alimentări.
- **D14. `lastmod`.** G7 și G8 schimbă `page.tsx` și textul vizibil, deci ridică `actualizat` în `harta.ts` în același commit. G8 schimbă și `page.tsx`-ul hub-ului `/unelte` (nota), deci ridică și intrarea `/unelte`: `lastmod.mjs` compară fiecare intrare cu ultimul commit pe `page.tsx`-ul ei. G1–G6 nu ating niciun `page.tsx`.
- **D15. Tiparul paginii din browser** (B6, `e2e/unelte-tipar.spec.ts`): foaia are acum trei tabele, deci intervalul de pagini pentru `/unelte/foaie-de-parcurs?luna=5&an=2027` se mută de la `[1, 3]` la `[2, 4]`. ⚠ `[2, 4]` e o ESTIMARE, nu o măsurătoare: la scrierea și la verificarea planului tiparul din browser al paginii noi n-a putut fi măsurat (PDF-ul din `pdf-lib`, cu o cursă pe zi, are 3 pagini, dar tiparul HTML are alte înălțimi de rând). Se măsoară în G7 Pasul 5 cu `page.pdf` și abia apoi se scrie în același commit.

**Harta fișierelor**

| Fișier | Responsabilitate | Task |
| --- | --- | --- |
| `src/lib/unelte/document-tabelar.ts` | `TabelSuplimentar`, `tabeleSuplimentare?`, `mapeazaTexte`, `curataDocument` pe `mapeazaTexte`, `campuriPeDouaColoane?` | G1, G4 |
| `src/lib/unelte/pdf.ts` | tabele suplimentare (cele scurte nu se rup), subsol + „Pagina i din n” pe fiecare pagină, „?” pentru glifele lipsă, câmpuri pe două coloane | G1, G3, G4 |
| `src/lib/unelte/docx.ts` | tabele suplimentare, cu antet repetat | G1 |
| `src/lib/unelte/xlsx.ts` | tabele suplimentare în Excel-ul generic | G1 |
| `src/lib/unelte/tabele-suplimentare.test.ts` (nou) | modelul și cele trei randări | G1 |
| `src/app/(marketing)/_componente/previzualizare-document.tsx` | componenta `Tabel`, tabelele suplimentare pe ecran | G2 |
| `src/app/(marketing)/_componente/previzualizare-tabele.test.tsx` (nou) | previzualizarea tabelelor | G2 |
| `src/lib/unelte/pdf-subsol.test.ts` (nou) | subsolul pe fiecare pagină, glifele | G3 |
| `src/lib/unelte/pdf-campuri.test.ts` (nou) | câmpurile pe două coloane | G4 |
| `src/app/(marketing)/unelte/foaie-de-parcurs/model.ts` | parametrii noi, cele 4 elemente, curse, alimentări, rezumat, avize; `EXEMPLU_COMPLETAT` | G5, G8 |
| `src/app/(marketing)/unelte/foaie-de-parcurs/model.test.ts` | rescris | G5 |
| `src/app/(marketing)/unelte/foaie-de-parcurs/excel.ts` (nou) | Excel cu formule | G6 |
| `src/app/(marketing)/unelte/foaie-de-parcurs/excel.test.ts` (nou) | formulele, rezolvate după eticheta coloanei | G6 |
| `src/app/api/unelte/foaie-de-parcurs/route.ts` (nou) | ruta statică | G6 |
| `src/app/api/unelte/foaie-de-parcurs/route.test.ts` (nou) | cele trei formate, antetele | G6 |
| `src/lib/unelte/raspuns.ts` | `raspunsFisier` | G6 |
| `src/lib/unelte/registru.ts` | foaia de parcurs iese din `[unealta]` | G6 |
| `src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx` | formularul complet (G7); conținutul juridic, întrebările, exemplul, îndemnul (G8) | G7, G8 |
| `src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx` (nou) | pagina randată | G7, G8 |
| `e2e/unelte-tipar.spec.ts` | intervalul de pagini la tipar | G7 |
| `src/content/landing/harta.ts` | `actualizat` pe `/unelte/foaie-de-parcurs` (G7, G8) și pe `/unelte` (G8) | G7, G8 |
| `src/content/landing/unelte.ts` | `ANTET_FOAIE_PARCURS.lead` | G8 |
| `src/app/(marketing)/unelte/page.tsx` | nota din hub | G8 |
| `src/app/llms.txt/route.ts` | rezumatul paginii | G8 |
| `src/content/landing/ro.ts`, `src/content/landing/en.ts` | textul din lista de unelte | G8 |
| `NOTES.md` (§3) | temeiurile verificate și ce rămâne ⚠ | G8 |
| — | staging, producție, verificarea fișierelor descărcate | G9 |

Ordinea: G1 → G2 → G3 → G4 → G5 → G6 → G7 → G8 → G9. G2–G4 cer G1. G5 cere G1 și G4, fiindcă modelul pune `tabeleSuplimentare` și `campuriPeDouaColoane`. G6 cere G5, G7 cere G2 și G6, G8 cere G7.

---

### Task G1: Tabele suplimentare în modelul comun, în PDF, Word și Excel

**Fișiere:**
- Modify: `src/lib/unelte/document-tabelar.ts`:
  - tipul `Coloana` (liniile 20–25) și cheile lui `DocumentTabelar`;
  - `curataDocument`, scris în B2 după `curataText`.
- Modify: `src/lib/unelte/pdf.ts:17-23` (importul), `:34-36` (constantele), `:81-83` (lățimile), `:131-138` (`rand`) și blocul de după tabelul principal (`:164-175`).
- Modify: `src/lib/unelte/docx.ts:17-22` (importul), `:25-36` (`celula`) și `:63-79` (tabelul).
- Modify: `src/lib/unelte/xlsx.ts:28-49`.
- Create (test): `src/lib/unelte/tabele-suplimentare.test.ts`.

**Interfețe:**
- Consumă: `curataText(text: string): string` (B2), `randeazaPdf`, `randeazaDocx`, `randeazaXlsx` (neschimbate ca semnătură).
- Produce:

```ts
export type TabelSuplimentar = Readonly<{
  titlu: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
}>;
// DocumentTabelar primește: tabeleSuplimentare?: readonly TabelSuplimentar[];
export function mapeazaTexte(d: DocumentTabelar, f: (text: string) => string): DocumentTabelar;
export function curataDocument(d: DocumentTabelar): DocumentTabelar; // neschimbată, acum pe mapeazaTexte
```

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/lib/unelte/tabele-suplimentare.test.ts`:

```ts
import JSZip from "jszip";
import { PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { curataDocument, mapeazaTexte, type DocumentTabelar } from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { randeazaPdf } from "./pdf";
import { randeazaXlsx } from "./xlsx";

/**
 * Tabelele de după tabelul principal (8 oct 2026): foaia de parcurs are nevoie
 * de alimentări și de un rezumat al lunii, cu coloanele lor, în toate cele trei
 * formate și în previzualizare.
 */
const BAZA: DocumentTabelar = {
  titlu: "Foaie de parcurs — octombrie 2026",
  subtitlu: null,
  campuri: [{ eticheta: "Nr. de înmatriculare", valoare: "B-123-ABC" }],
  paragrafe: [],
  coloane: [
    { eticheta: "Data", latime: 2 },
    { eticheta: "Traseul", latime: 6 },
  ],
  randuri: [["01.10.2026", "Sediu – Client"]],
  umbrite: [],
  tabeleSuplimentare: [
    {
      titlu: "Alimentări cu combustibil",
      coloane: [
        { eticheta: "Nr. bon", latime: 2 },
        { eticheta: "Stația (furnizorul)", latime: 4 },
      ],
      randuri: [["BF-7781", "Stația Ștefănești"]],
    },
    {
      titlu: "Rezumatul lunii",
      coloane: [
        { eticheta: "Indicator", latime: 6 },
        { eticheta: "Valoare", latime: 2 },
      ],
      randuri: [["Total km parcurși în lună", "1.234"]],
    },
  ],
  note: [],
  semnaturi: [],
  orientare: "peisaj",
  numeFisier: "foaie",
};

const { tabeleSuplimentare: TABELE, ...FARA_TABELE } = BAZA;

/** Textele desenate în PDF, în ordine; `drawText` e singurul drum spre pagină. */
function textePdf(): { texte: string[]; opreste: () => void } {
  const texte: string[] = [];
  const spion = vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (
    this: PDFPage,
    text: string,
  ) {
    texte.push(text);
  });
  return { texte, opreste: () => spion.mockRestore() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tabelele suplimentare în model", () => {
  it("mapeazaTexte atinge titlul, etichetele și celulele lor, nu și lățimile", () => {
    const d = mapeazaTexte(BAZA, (t) => t.toUpperCase());
    expect(d.tabeleSuplimentare?.[0]?.titlu).toBe("ALIMENTĂRI CU COMBUSTIBIL");
    expect(d.tabeleSuplimentare?.[0]?.coloane[1]).toEqual({
      eticheta: "STAȚIA (FURNIZORUL)",
      latime: 4,
    });
    expect(d.tabeleSuplimentare?.[1]?.randuri[0]).toEqual(["TOTAL KM PARCURȘI ÎN LUNĂ", "1.234"]);
  });

  it("un document fără tabele suplimentare rămâne fără cheie", () => {
    expect(TABELE).toHaveLength(2);
    expect("tabeleSuplimentare" in mapeazaTexte(FARA_TABELE, (t) => t)).toBe(false);
  });

  it("curataDocument curăță și celulele tabelelor suplimentare", () => {
    const murdar = mapeazaTexte(BAZA, (t) => `${t}\u000B\u0000`);
    expect(curataDocument(murdar).tabeleSuplimentare?.[0]?.randuri[0]).toEqual([
      "BF-7781 ",
      "Stația Ștefănești ",
    ]);
  });
});

describe("tabelele suplimentare în fișiere", { timeout: 60_000 }, () => {
  it("PDF: titlul, antetul și celulele fiecărui tabel ajung pe pagină, după tabelul principal", async () => {
    const { texte, opreste } = textePdf();
    await randeazaPdf(BAZA);
    opreste();
    const ordine = [
      "Sediu – Client",
      "Alimentări cu combustibil",
      "Stația (furnizorul)",
      "Stația Ștefănești",
      "Rezumatul lunii",
      "1.234",
    ].map((t) => texte.indexOf(t));
    expect(ordine.every((i) => i >= 0)).toBe(true);
    expect([...ordine].sort((a, b) => a - b)).toEqual(ordine);
  });

  it("PDF: un tabel scurt nu se rupe între pagini, oricât de jos ar începe", async () => {
    const pagini: PDFPage[] = [];
    const texte: string[] = [];
    vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (
      this: PDFPage,
      text: string,
    ) {
      texte.push(text);
      pagini.push(this);
    });
    const rezumat = BAZA.tabeleSuplimentare?.[1];
    if (rezumat === undefined) throw new Error("Lipsește rezumatul din BAZA.");
    const lung = {
      ...rezumat,
      randuri: Array.from({ length: 11 }, (_, i) => [`R${String(i)}`, ""]),
    };
    for (let n = 14; n <= 34; n += 2) {
      texte.length = 0;
      pagini.length = 0;
      await randeazaPdf({
        ...BAZA,
        randuri: Array.from({ length: n }, () => ["01.10.2026", "Sediu – Client"]),
        tabeleSuplimentare: [lung],
      });
      const pagina = (t: string) => pagini[texte.indexOf(t)];
      expect(texte, `${String(n)} rânduri`).toContain("R10");
      expect(pagina("Rezumatul lunii"), `${String(n)} rânduri`).toBe(pagina("R10"));
    }
  });

  it("PDF: fără tabele suplimentare nu apare niciun titlu în plus", async () => {
    const { texte, opreste } = textePdf();
    await randeazaPdf(FARA_TABELE);
    opreste();
    expect(texte).not.toContain("Alimentări cu combustibil");
  });

  it("Word: un tabel pe fiecare, cu antetul repetat pe pagină nouă", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx(BAZA));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml.match(/<w:tbl>/gu)).toHaveLength(3);
    expect(xml.match(/<w:tblHeader\/>/gu)).toHaveLength(3);
    expect(xml.indexOf("Alimentări cu combustibil")).toBeGreaterThan(xml.indexOf("Sediu – Client"));
    expect(xml).toContain("Stația Ștefănești");
  });

  it("Excel: titlul și rândurile tabelelor, după cel principal", async () => {
    const zip = await JSZip.loadAsync(await randeazaXlsx(BAZA));
    const siruri = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    for (const t of [
      "Alimentări cu combustibil",
      "Stația (furnizorul)",
      "Rezumatul lunii",
      "1.234",
    ]) {
      expect(siruri).toContain(t);
    }
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte/tabele-suplimentare.test.ts
```

Așteptat: 7 din 8 cad.
- `TypeError: mapeazaTexte is not a function`, de trei ori;
- PDF, ordinea: `expected false to be true`;
- PDF, tabelul scurt: `14 rânduri: expected [ …(33) ] to include 'R10'`;
- Word: `expected [ '<w:tbl>' ] to have a length of 3 but got 1`;
- Excel: `expected '<?xml …' to contain 'Alimentări cu combustibil'`.

„Fără tabele suplimentare nu apare niciun titlu în plus” trece și înainte: e martorul că spionul vede textele.

- [ ] **Pasul 3: Implementarea minimă**

**`document-tabelar.ts`.** Înlocuiește:

```ts
export type DocumentTabelar = Readonly<{
  titlu: string;
```

cu:

```ts
/** Un tabel după cel principal, cu coloanele lui. */
export type TabelSuplimentar = Readonly<{
  titlu: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
}>;

export type DocumentTabelar = Readonly<{
  titlu: string;
```

Înlocuiește:

```ts
  /** Indicii coloanelor umbrite (weekend, sărbători). */
  umbrite: readonly number[];
```

cu:

```ts
  /** Indicii coloanelor umbrite (weekend, sărbători). */
  umbrite: readonly number[];
  /**
   * Tabele mai mici, randate după cel principal și înaintea notelor, fiecare cu
   * titlul și coloanele lui (alimentările și rezumatul foii de parcurs). Fără
   * umbrire. Cheia lipsă = niciun tabel, deci celelalte unelte rămân neatinse.
   */
  tabeleSuplimentare?: readonly TabelSuplimentar[];
```

Înlocuiește funcția scrisă în B2:

```ts
/** Același document, cu fiecare text trecut prin `curataText`. Funcție pură. */
export function curataDocument(d: DocumentTabelar): DocumentTabelar {
  return {
    ...d,
    titlu: curataText(d.titlu),
    subtitlu: d.subtitlu === null ? null : curataText(d.subtitlu),
    campuri: d.campuri.map((c) => ({
      eticheta: curataText(c.eticheta),
      valoare: curataText(c.valoare),
    })),
    paragrafe: d.paragrafe.map((p) => curataText(p)),
    coloane: d.coloane.map((c) => ({ ...c, eticheta: curataText(c.eticheta) })),
    randuri: d.randuri.map((rand) => rand.map((celula) => curataText(celula))),
    note: d.note.map((n) => curataText(n)),
    semnaturi: d.semnaturi.map((s) => curataText(s)),
  };
}
```

cu:

```ts
/**
 * Același document, cu `f` aplicată pe FIECARE text al lui: titlul, câmpurile,
 * proza, etichetele de coloană, celulele, tabelele suplimentare, notele și
 * semnăturile. Funcție pură.
 *
 * O singură listă a locurilor cu text, folosită de curățare și de glifele PDF:
 * o cheie nouă a modelului (`tabeleSuplimentare`, 8 oct 2026) se adaugă aici o
 * dată, nu în fiecare transformare, unde a doua ar fi uitat-o.
 */
export function mapeazaTexte(d: DocumentTabelar, f: (text: string) => string): DocumentTabelar {
  const coloane = (lista: readonly Coloana[]) =>
    lista.map((c) => ({ ...c, eticheta: f(c.eticheta) }));
  const randuri = (lista: readonly (readonly string[])[]) =>
    lista.map((rand) => rand.map((celula) => f(celula)));
  return {
    ...d,
    titlu: f(d.titlu),
    subtitlu: d.subtitlu === null ? null : f(d.subtitlu),
    campuri: d.campuri.map((c) => ({ eticheta: f(c.eticheta), valoare: f(c.valoare) })),
    paragrafe: d.paragrafe.map((p) => f(p)),
    coloane: coloane(d.coloane),
    randuri: randuri(d.randuri),
    note: d.note.map((n) => f(n)),
    semnaturi: d.semnaturi.map((s) => f(s)),
    // `exactOptionalPropertyTypes`: cheia lipsește, nu e `undefined`.
    ...(d.tabeleSuplimentare === undefined
      ? {}
      : {
          tabeleSuplimentare: d.tabeleSuplimentare.map((t) => ({
            titlu: f(t.titlu),
            coloane: coloane(t.coloane),
            randuri: randuri(t.randuri),
          })),
        }),
  };
}

/** Același document, cu fiecare text trecut prin `curataText`. Funcție pură. */
export function curataDocument(d: DocumentTabelar): DocumentTabelar {
  return mapeazaTexte(d, curataText);
}
```

**`pdf.ts`.** Înlocuiește:

```ts
import {
  adresaDinFisier,
  LINIE_GOALA,
  SEMNATURA_FISIER,
  type DocumentTabelar,
} from "./document-tabelar";
```

cu:

```ts
import {
  adresaDinFisier,
  LINIE_GOALA,
  SEMNATURA_FISIER,
  type Coloana,
  type DocumentTabelar,
} from "./document-tabelar";
```

Înlocuiește:

```ts
/** Spațiul păstrat sub ultimul rând pentru mențiunea din subsol. */
const REZERVA_SUBSOL = 20;
```

cu:

```ts
/** Spațiul păstrat sub ultimul rând pentru mențiunea din subsol. */
const REZERVA_SUBSOL = 20;
/** Un tabel suplimentar cu atâtea rânduri sau mai puține nu se rupe între pagini. */
const RANDURI_TABEL_SCURT = 12;
```

Înlocuiește:

```ts
  const util = latime - 2 * MARGINE;
  const totalRelativ = d.coloane.reduce((s, c) => s + c.latime, 0);
  const latimi = d.coloane.map((c) => (totalRelativ === 0 ? 0 : (c.latime / totalRelativ) * util));
```

cu:

```ts
  const util = latime - 2 * MARGINE;
  /** Lățimile relative ale unui tabel, în puncte, pe toată lățimea utilă. */
  const latimiDin = (coloane: readonly Coloana[]) => {
    const totalRelativ = coloane.reduce((s, c) => s + c.latime, 0);
    return coloane.map((c) => (totalRelativ === 0 ? 0 : (c.latime / totalRelativ) * util));
  };
  const latimi = latimiDin(d.coloane);
```

Înlocuiește:

```ts
  const rand = (celule: readonly string[], aldin: boolean) => {
    const font = aldin ? fonturi.aldin : fonturi.normal;
    const linii = celule.map((c) => c.split("\n"));
    const nrLinii = Math.max(1, ...linii.map((l) => l.length));
    const inalt = INALT_RAND + (nrLinii - 1) * (MARIME + 2);
    let x = MARGINE;
    latimi.forEach((w, i) => {
      if (d.umbrite.includes(i)) {
```

cu:

```ts
  const rand = (
    celule: readonly string[],
    aldin: boolean,
    latimiTabel: readonly number[] = latimi,
    umbrite: readonly number[] = d.umbrite,
  ) => {
    const font = aldin ? fonturi.aldin : fonturi.normal;
    const linii = celule.map((c) => c.split("\n"));
    const nrLinii = Math.max(1, ...linii.map((l) => l.length));
    const inalt = INALT_RAND + (nrLinii - 1) * (MARIME + 2);
    let x = MARGINE;
    latimiTabel.forEach((w, i) => {
      if (umbrite.includes(i)) {
```

Înlocuiește:

```ts
      rand(r, false);
    }
  }

  y -= 10;
  for (const n of d.note) scrie(n, 8, fonturi.normal, GRI);
```

cu:

```ts
      rand(r, false);
    }
  }

  // Tabelele suplimentare: titlu, antet, rânduri. Unul scurt (cel mult
  // `RANDURI_TABEL_SCURT`) nu se rupe între pagini: trece întreg pe pagina
  // următoare. Unul lung cere măcar titlul, antetul și două rânduri deodată,
  // ca titlul să nu rămână singur la capăt de pagină.
  for (const t of d.tabeleSuplimentare ?? []) {
    if (t.coloane.length === 0) continue;
    const latimiT = latimiDin(t.coloane);
    const antetT = t.coloane.map((c) => c.eticheta);
    const randuriCerute = t.randuri.length <= RANDURI_TABEL_SCURT ? t.randuri.length : 2;
    y -= 10;
    asiguraLoc(16 + INALT_RAND * (randuriCerute + 2));
    scrie(t.titlu, 10, fonturi.aldin);
    rand(antetT, true, latimiT, []);
    for (const r of t.randuri) {
      if (y - INALT_RAND < MARGINE + REZERVA_SUBSOL) {
        paginaNoua();
        rand(antetT, true, latimiT, []);
      }
      rand(r, false, latimiT, []);
    }
  }

  y -= 10;
  for (const n of d.note) scrie(n, 8, fonturi.normal, GRI);
```

**`docx.ts`.** Înlocuiește:

```ts
import {
  adresaDinFisier,
  LINIE_GOALA,
  SEMNATURA_FISIER,
  type DocumentTabelar,
} from "./document-tabelar";
```

cu:

```ts
import {
  adresaDinFisier,
  LINIE_GOALA,
  SEMNATURA_FISIER,
  type Coloana,
  type DocumentTabelar,
} from "./document-tabelar";
```

Înlocuiește:

```ts
export async function randeazaDocx(d: DocumentTabelar): Promise<Uint8Array> {
  const totalRelativ = d.coloane.reduce((s, c) => s + c.latime, 0) || 1;
  const celula = (text: string, i: number, aldin: boolean) =>
    new TableCell({
      width: {
        size: Math.round(((d.coloane[i]?.latime ?? 0) / totalRelativ) * 100),
        type: WidthType.PERCENTAGE,
      },
      // `exactOptionalPropertyTypes`: cheia lipsește, nu e `undefined`.
      ...(d.umbrite.includes(i)
        ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: "E6E9E6" } }
        : {}),
```

cu:

```ts
export async function randeazaDocx(d: DocumentTabelar): Promise<Uint8Array> {
  /** `procent` = lățimea coloanei din tabelul ei; `umbrita` = weekend, sărbătoare. */
  const celula = (text: string, procent: number, umbrita: boolean, aldin: boolean) =>
    new TableCell({
      width: { size: procent, type: WidthType.PERCENTAGE },
      // `exactOptionalPropertyTypes`: cheia lipsește, nu e `undefined`.
      ...(umbrita ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: "E6E9E6" } } : {}),
```

Înlocuiește:

```ts
  const copii: (Paragraph | Table)[] = [paragraf(d.titlu, { bold: true, size: 28 })];
```

cu:

```ts
  /** Un tabel pe toată lățimea, cu antetul repetat pe fiecare pagină. */
  const tabel = (
    coloane: readonly Coloana[],
    randuri: readonly (readonly string[])[],
    umbrite: readonly number[],
  ) => {
    const totalRelativ = coloane.reduce((s, c) => s + c.latime, 0) || 1;
    const procente = coloane.map((c) => Math.round((c.latime / totalRelativ) * 100));
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: coloane.map((c, i) =>
            celula(c.eticheta, procente[i] ?? 0, umbrite.includes(i), true),
          ),
        }),
        ...randuri.map(
          (r) =>
            new TableRow({
              children: coloane.map((_, i) =>
                celula(r[i] ?? "", procente[i] ?? 0, umbrite.includes(i), false),
              ),
            }),
        ),
      ],
    });
  };

  const copii: (Paragraph | Table)[] = [paragraf(d.titlu, { bold: true, size: 28 })];
```

Înlocuiește:

```ts
  if (d.coloane.length > 0) {
    copii.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: d.coloane.map((c, i) => celula(c.eticheta, i, true)),
          }),
          ...d.randuri.map(
            (r) =>
              new TableRow({ children: d.coloane.map((_, i) => celula(r[i] ?? "", i, false)) }),
          ),
        ],
      }),
    );
  }
```

cu:

```ts
  if (d.coloane.length > 0) copii.push(tabel(d.coloane, d.randuri, d.umbrite));
  for (const t of d.tabeleSuplimentare ?? []) {
    if (t.coloane.length === 0) continue;
    copii.push(paragraf(""), paragraf(t.titlu, { bold: true, size: 20 }));
    copii.push(tabel(t.coloane, t.randuri, []));
  }
```

**`xlsx.ts`.** Înlocuiește:

```ts
  if (d.coloane.length > 0) {
    const antet = fila.addRow(d.coloane.map((c) => c.eticheta));
    antet.font = { bold: true };
    // Etichetele cu `\n` (ziua deasupra literei) se afișează pe două rânduri.
    antet.alignment = { wrapText: true, vertical: "top" };
    fila.views = [{ state: "frozen", ySplit: antet.number }];
    for (const r of d.randuri) {
      const rand = fila.addRow([...r]);
      d.coloane.forEach((_, i) => {
        const celula = rand.getCell(i + 1);
        celula.border = {
          top: { style: "hair" },
          left: { style: "hair" },
          bottom: { style: "hair" },
          right: { style: "hair" },
        };
        if (d.umbrite.includes(i)) {
          celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E9E6" } };
        }
      });
    }
  }
```

cu:

```ts
  /** Antet aldin, cu rând nou la `\n`, apoi rândurile cu chenar subțire. */
  const tabel = (
    etichete: readonly string[],
    randuri: readonly (readonly string[])[],
    umbrite: readonly number[],
  ) => {
    const antet = fila.addRow([...etichete]);
    antet.font = { bold: true };
    // Etichetele cu `\n` (ziua deasupra literei) se afișează pe două rânduri.
    antet.alignment = { wrapText: true, vertical: "top" };
    for (const r of randuri) {
      const rand = fila.addRow([...r]);
      etichete.forEach((_, i) => {
        const celula = rand.getCell(i + 1);
        celula.border = {
          top: { style: "hair" },
          left: { style: "hair" },
          bottom: { style: "hair" },
          right: { style: "hair" },
        };
        if (umbrite.includes(i)) {
          celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E9E6" } };
        }
      });
    }
    return antet;
  };

  if (d.coloane.length > 0) {
    const antet = tabel(
      d.coloane.map((c) => c.eticheta),
      d.randuri,
      d.umbrite,
    );
    fila.views = [{ state: "frozen", ySplit: antet.number }];
  }
  for (const t of d.tabeleSuplimentare ?? []) {
    if (t.coloane.length === 0) continue;
    fila.addRow([]);
    fila.addRow([t.titlu]).font = { bold: true };
    tabel(
      t.coloane.map((c) => c.eticheta),
      t.randuri,
      [],
    );
  }
```

- [ ] **Pasul 4: Rulează testele, trec.** Testul nou, apoi tot directorul, ca să se vadă că `randari.test.ts` (A5, B2, B8) rămâne verde și cu `curataDocument` rescris:

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte src/app/api/unelte
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
pnpm exec prettier --check src/lib/unelte/document-tabelar.ts src/lib/unelte/pdf.ts src/lib/unelte/docx.ts src/lib/unelte/xlsx.ts src/lib/unelte/tabele-suplimentare.test.ts
```

Așteptat: toate verzi. Testul cu tabelul scurt rulează 11 randări PDF (~5 s). Plafonul de 60 s al blocului e pentru `pnpm test`, unde fișierele rulează în paralel.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(src/lib/unelte/document-tabelar.ts src/lib/unelte/pdf.ts src/lib/unelte/docx.ts src/lib/unelte/xlsx.ts src/lib/unelte/tabele-suplimentare.test.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- src/lib/unelte/tabele-suplimentare.test.ts
git commit --only -m "feat(unelte): tabele suplimentare în modelul comun, în PDF, Word și Excel

DocumentTabelar.tabeleSuplimentare (titlu, coloane, rânduri), după tabelul
principal. mapeazaTexte e singura listă a locurilor cu text; curataDocument
trece prin ea. În PDF, un tabel de cel mult 12 rânduri nu se rupe între pagini.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
# lastmod roșu = nu se împinge: se ridică data din harta.ts și se reface commitul (`git commit --amend --only -- src/content/landing/harta.ts`), apoi se reia linia.
node scripts/checks/lastmod.mjs && git merge origin/main && git push origin main
```

---

### Task G2: Previzualizarea arată tabelele suplimentare

**Fișiere:**
- Modify: `src/app/(marketing)/_componente/previzualizare-document.tsx`: importul (forma din B2), o componentă `Tabel` înaintea docblock-ului lui `PrevizualizareDocument`, blocul tabelului principal.
- Create (test): `src/app/(marketing)/_componente/previzualizare-tabele.test.tsx`.

**Interfețe:**
- Consumă: `TabelSuplimentar`, `tabeleSuplimentare?`, `curataDocument` (G1).
- Produce: aceeași semnătură, `PrevizualizareDocument({ document }: { document: DocumentTabelar })`. `Tabel` e intern, neexportat.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/app/(marketing)/_componente/previzualizare-tabele.test.tsx`:

```tsx
import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { PrevizualizareDocument } from "./previzualizare-document";

/**
 * Previzualizarea arată ce se descarcă: și tabelele de după cel principal
 * (alimentările și rezumatul foii de parcurs, din 8 oct 2026), fiecare cu
 * titlul și legenda lui, curățate ca în fișiere.
 */
const DOC: DocumentTabelar = {
  titlu: "Foaie de parcurs — octombrie 2026",
  subtitlu: null,
  campuri: [],
  paragrafe: [],
  coloane: [
    { eticheta: "Data", latime: 2 },
    { eticheta: "Traseul", latime: 6 },
  ],
  randuri: [["01.10.2026", "Sediu – Client"]],
  umbrite: [],
  tabeleSuplimentare: [
    {
      titlu: "Alimentări cu combustibil",
      coloane: [
        { eticheta: "Nr. bon", latime: 2 },
        { eticheta: "Cantitate\n(l)", latime: 2 },
      ],
      randuri: [["BF\u000B7781", ""]],
    },
    {
      titlu: "Rezumatul lunii",
      coloane: [
        { eticheta: "Indicator", latime: 6 },
        { eticheta: "Valoare", latime: 2 },
      ],
      randuri: [["Total km parcurși în lună", "1.234"]],
    },
  ],
  note: [],
  semnaturi: [],
  orientare: "peisaj",
  numeFisier: "foaie",
};

describe("previzualizarea tabelelor suplimentare", () => {
  it("fiecare tabel are legenda lui, în ordine, după tabelul principal", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    const legende = [...container.querySelectorAll("table caption")].map((c) => c.textContent);
    expect(legende).toEqual([
      "Foaie de parcurs — octombrie 2026",
      "Alimentări cu combustibil",
      "Rezumatul lunii",
    ]);
  });

  it("antetul și celulele tabelului suplimentar sunt cele din model, curățate", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    const alimentari = container.querySelectorAll("table")[1];
    expect(alimentari).toBeDefined();
    const t = within(alimentari as HTMLElement);
    expect(t.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Nr. bon",
      "Cantitate\n(l)",
    ]);
    expect(t.getAllByRole("cell")[0]?.textContent).toBe("BF 7781");
  });

  it("fără tabele suplimentare rămâne un singur tabel", () => {
    const { tabeleSuplimentare: _ignorat, ...fara } = DOC;
    const { container } = render(<PrevizualizareDocument document={fara} />);
    expect(container.querySelectorAll("table")).toHaveLength(1);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project ui "src/app/(marketing)/_componente/previzualizare-tabele.test.tsx"
```

Așteptat: 2 din 3 cad:
- `expected [ 'Foaie de parcurs — octombrie 2026' ] to deeply equal [ …3 legende… ]`;
- `expected undefined to be defined`.

Al treilea test („un singur tabel”) trece și înainte.

- [ ] **Pasul 3: Implementarea minimă.** În `previzualizare-document.tsx` înlocuiește:

```tsx
import { curataDocument, LINIE_GOALA, type DocumentTabelar } from "@/lib/unelte/document-tabelar";
```

cu:

```tsx
import {
  curataDocument,
  LINIE_GOALA,
  type Coloana,
  type DocumentTabelar,
} from "@/lib/unelte/document-tabelar";

/**
 * Un tabel derulabil pe orizontală, cu legenda pentru cititorul de ecran. Același
 * marcaj pentru tabelul principal și pentru cele suplimentare (8 oct 2026).
 */
function Tabel({
  legenda,
  coloane,
  randuri,
  umbrite,
}: Readonly<{
  legenda: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
  umbrite: readonly number[];
}>) {
  return (
    <div className="border-mk-rigla relative mt-4 overflow-x-auto border">
      <table className="w-full border-collapse text-left text-[0.8125rem]">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr className="border-mk-rigla border-b">
            {coloane.map((c, j) => (
              <th
                key={`${String(j)}-${c.eticheta}`}
                scope="col"
                className="px-2 py-1.5 font-medium whitespace-pre-line"
              >
                {c.eticheta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {randuri.map((r, i) => (
            <tr key={`${String(i)}-${r.join("|")}`} className="border-mk-rigla/40 border-b">
              {coloane.map((c, j) => (
                <td
                  key={`${String(j)}-${c.eticheta}`}
                  className={`h-7 px-2 ${umbrite.includes(j) ? "bg-mk-rigla/20" : ""}`}
                >
                  {r[j] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

și înlocuiește blocul tabelului principal:

```tsx
      {d.coloane.length > 0 && (
        <div className="border-mk-rigla relative mt-4 overflow-x-auto border">
          <table className="w-full border-collapse text-left text-[0.8125rem]">
            <caption className="sr-only">{d.titlu}</caption>
            <thead>
              <tr className="border-mk-rigla border-b">
                {d.coloane.map((c, j) => (
                  <th
                    key={`${String(j)}-${c.eticheta}`}
                    scope="col"
                    className="px-2 py-1.5 font-medium whitespace-pre-line"
                  >
                    {c.eticheta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.randuri.map((r, i) => (
                <tr key={`${String(i)}-${r.join("|")}`} className="border-mk-rigla/40 border-b">
                  {d.coloane.map((c, j) => (
                    <td
                      key={`${String(j)}-${c.eticheta}`}
                      className={`h-7 px-2 ${d.umbrite.includes(j) ? "bg-mk-rigla/20" : ""}`}
                    >
                      {r[j] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
```

cu:

```tsx
      {d.coloane.length > 0 && (
        <Tabel legenda={d.titlu} coloane={d.coloane} randuri={d.randuri} umbrite={d.umbrite} />
      )}
      {(d.tabeleSuplimentare ?? [])
        .filter((t) => t.coloane.length > 0)
        .map((t) => (
          <div key={t.titlu} className="mt-6">
            <p className="text-[0.9375rem] font-semibold">{t.titlu}</p>
            <Tabel legenda={t.titlu} coloane={t.coloane} randuri={t.randuri} umbrite={[]} />
          </div>
        ))}
```

Titlul tabelului suplimentar e un `<p>`, nu un `<section>` sau un `<header>`. Testul de tipar din B6 numără `section, header, footer` din afara lui `#documentul`, iar tabelele stau înăuntru.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project ui "src/app/(marketing)/_componente" "src/app/(marketing)/unelte"
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
pnpm exec prettier --check "src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/previzualizare-tabele.test.tsx"
```

Așteptat: verzi, inclusiv `previzualizare-document.test.tsx` (B2), `tipar.test.tsx` (B6) și `avize.test.tsx` (B4, B8).

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=("src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/previzualizare-tabele.test.tsx")
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "src/app/(marketing)/_componente/previzualizare-tabele.test.tsx"
git commit --only -m "feat(unelte): previzualizarea arată și tabelele suplimentare

Componenta Tabel servește tabelul principal și pe cele de după el, fiecare cu
legenda lui pentru cititorul de ecran.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
# lastmod roșu = nu se împinge: se ridică data din harta.ts și se reface commitul (`git commit --amend --only -- src/content/landing/harta.ts`), apoi se reia linia.
node scripts/checks/lastmod.mjs && git merge origin/main && git push origin main
```

---

### Task G3: PDF: subsolul cu legătura pe fiecare pagină, „Pagina i din n”, „?” în locul glifelor lipsă

**Fișiere:**
- Modify: `src/lib/unelte/pdf.ts`:
  - importul din `./document-tabelar`;
  - capul lui `randeazaPdf`;
  - subsolul de la sfârșitul funcției (`:203-227` în forma de azi).
- Create (test): `src/lib/unelte/pdf-subsol.test.ts`. Nu `pdf-pagini.test.ts`: numele acela îl creează E4 (`E-pontaj-condica.md`, Task E4), iar un „Creează” peste el i-ar șterge testele.

**Interfețe:**
- Consumă: `mapeazaTexte` (G1).
- Produce: `export function inlocuiesteGlifeLipsa(text: string, are: (cod: number) => boolean): string;` și `randeazaPdf(brut: DocumentTabelar): Promise<Uint8Array>`, cu aceeași semnătură.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/lib/unelte/pdf-subsol.test.ts`:

```ts
import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SEMNATURA_FISIER, type DocumentTabelar } from "./document-tabelar";
import { inlocuiesteGlifeLipsa, randeazaPdf } from "./pdf";

/**
 * Auditul din 8 oct 2026, pe PDF-ul foii de parcurs: rândul „Generat gratuit
 * cu administrativo.ro” și legătura lui apăreau doar pe ULTIMA pagină, iar un
 * emoji sau o ideogramă ieșeau pătrățele goale.
 */
const LUNG: DocumentTabelar = {
  titlu: "Foaie de parcurs — octombrie 2026",
  subtitlu: null,
  campuri: [{ eticheta: "Conducător auto", valoare: "Popa 🚗 Ion 中" }],
  paragrafe: [],
  coloane: [
    { eticheta: "Data", latime: 2 },
    { eticheta: "Traseul", latime: 6 },
  ],
  randuri: Array.from({ length: 90 }, (_, i) => [`${String(i + 1)}.10.2026`, "Sediu – Client"]),
  umbrite: [],
  note: [],
  semnaturi: ["Conducător auto", "Verificat"],
  orientare: "peisaj",
  numeFisier: "foaie",
  sursa: "/unelte/foaie-de-parcurs",
};

type Desen = Readonly<{ pagina: PDFPage; text: string }>;

/** Ce se desenează și pe ce pagină; `drawText` e singurul drum spre pagină. */
function spioneaza(): Desen[] {
  const desene: Desen[] = [];
  vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (
    this: PDFPage,
    text: string,
  ) {
    desene.push({ pagina: this, text });
  });
  return desene;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PDF pe mai multe pagini", { timeout: 30_000 }, () => {
  it("rândul de jos apare o dată pe fiecare pagină, cu numărul paginii", async () => {
    const desene = spioneaza();
    const citit = await PDFDocument.load(await randeazaPdf(LUNG));
    const total = citit.getPageCount();
    expect(total).toBeGreaterThan(2);
    const cuSemnatura = desene.filter((d) => d.text === SEMNATURA_FISIER).map((d) => d.pagina);
    expect(new Set(cuSemnatura).size).toBe(total);
    expect(cuSemnatura).toHaveLength(total);
    expect(desene.map((d) => d.text)).toContain(`Pagina ${String(total)} din ${String(total)}`);
  });

  it("fiecare pagină are adnotarea Link spre unealtă", async () => {
    const citit = await PDFDocument.load(await randeazaPdf(LUNG));
    for (const pagina of citit.getPages()) {
      expect(pagina.node.Annots()?.size()).toBe(1);
    }
  });

  it("pe o singură pagină nu apare „Pagina 1 din 1”", async () => {
    const desene = spioneaza();
    await randeazaPdf({ ...LUNG, randuri: LUNG.randuri.slice(0, 3) });
    expect(desene.map((d) => d.text).filter((t) => t.startsWith("Pagina "))).toEqual([]);
  });
});

describe("glifele lipsă", { timeout: 30_000 }, () => {
  it("emoji și ideograme devin „?”, diacriticele rămân", async () => {
    const desene = spioneaza();
    await randeazaPdf(LUNG);
    expect(desene.map((d) => d.text)).toContain("Conducător auto: Popa ? Ion ?");
  });

  it("inlocuiesteGlifeLipsa păstrează rândul nou și scoate selectorii de variantă", () => {
    const are = (cod: number) => cod < 0x2000;
    expect(inlocuiesteGlifeLipsa("a\nb", are)).toBe("a\nb");
    expect(inlocuiesteGlifeLipsa("Ș❤️x", are)).toBe("Ș?x");
    expect(inlocuiesteGlifeLipsa("🚗🚗", are)).toBe("??");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte/pdf-subsol.test.ts
```

Așteptat: 4 din 5 cad:
- `expected 1 to be 4` (semnătura doar pe ultima pagină);
- `expected +0 to be 1` (Annots lipsă pe primele pagini);
- `expected [ …(193) ] to include 'Conducător auto: Popa ? Ion ?'`;
- `TypeError: inlocuiesteGlifeLipsa is not a function`.

„Pe o singură pagină nu apare «Pagina 1 din 1»” trece și înainte.

- [ ] **Pasul 3: Implementarea minimă.** În `pdf.ts` înlocuiește:

```ts
  LINIE_GOALA,
  SEMNATURA_FISIER,
  type Coloana,
```

cu:

```ts
  LINIE_GOALA,
  mapeazaTexte,
  SEMNATURA_FISIER,
  type Coloana,
```

Înlocuiește:

```ts
export async function randeazaPdf(d: DocumentTabelar): Promise<Uint8Array> {
  const { doc, fonturi } = await pornesteDocument(d.titlu, "Administrativo");
```

cu:

```ts
/**
 * Caracterele pe care fontul nu le are devin „?”.
 *
 * DejaVu nu are emoji și nici ideograme: `pdf-lib` le desena ca glifa 0, adică
 * un pătrățel gol, fără niciun semn că s-a pierdut ceva (auditul din 8 oct 2026,
 * „Conducător auto: □□□X□”). Un „?” se vede și se poate corecta de mână.
 * Selectorii de variantă (U+FE00–U+FE0F) care însoțesc emoji-urile se scot, ca
 * „❤️” să dea un singur „?”, nu două. `are` e injectat ca să fie testabil.
 */
export function inlocuiesteGlifeLipsa(text: string, are: (cod: number) => boolean): string {
  let rezultat = "";
  for (const caracter of text) {
    const cod = caracter.codePointAt(0) ?? 0;
    if (cod >= 0xfe00 && cod <= 0xfe0f) continue;
    rezultat += caracter === "\n" || are(cod) ? caracter : "?";
  }
  return rezultat;
}

/**
 * Codurile pe care DejaVu le are în AMBELE grosimi, calculate o dată pe proces:
 * `getCharacterSet()` întoarce ~5.900 de coduri și costă ~20 ms pe apel.
 */
let glifeComune: ReadonlySet<number> | null = null;

export async function randeazaPdf(brut: DocumentTabelar): Promise<Uint8Array> {
  const { doc, fonturi } = await pornesteDocument(brut.titlu, "Administrativo");
  if (glifeComune === null) {
    const aldin = new Set(fonturi.aldin.getCharacterSet());
    glifeComune = new Set(fonturi.normal.getCharacterSet().filter((c) => aldin.has(c)));
  }
  const glife = glifeComune;
  const d = mapeazaTexte(brut, (t) => inlocuiesteGlifeLipsa(t, (c) => glife.has(c)));
```

`getCharacterSet()` există în `pdf-lib` (`node_modules/pdf-lib/cjs/api/PDFFont.d.ts:83`). Pentru un font încorporat întoarce `embedder.font.characterSet` din fontkit, adică setul complet al fontului, nu cel subsetat. Am măsurat: 5.918 coduri, 19,7 ms; `ș ț Ș Ț ă â î € „ ” – → … ·` sunt în set, `🚗 中` nu.

Înlocuiește subsolul:

```ts
  pagina.drawText(SEMNATURA_FISIER, {
    x: MARGINE,
    y: MARGINE / 2,
    size: 7,
    font: fonturi.normal,
    color: GRI,
  });
  // Textul devine clicabil printr-o adnotare `Link` cu acțiune `URI`, întinsă
  // exact peste el. `pdf-lib` n-are un API pentru legături; dicționarul e cel
  // din specificația PDF (ISO 32000, 12.5.6.5).
  const latimeText = fonturi.normal.widthOfTextAtSize(SEMNATURA_FISIER, 7);
  const legatura = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [MARGINE, MARGINE / 2 - 2, MARGINE + latimeText, MARGINE / 2 + 8],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(adresaDinFisier(d, "pdf", ADRESA_SITE)),
      },
    }),
  );
  pagina.node.set(PDFName.of("Annots"), doc.context.obj([legatura]));
```

cu:

```ts
  // Rândul de jos, cu legătura lui, pe FIECARE pagină, plus „Pagina i din n”
  // când sunt mai multe. Până pe 8 oct 2026 apărea doar pe ultima: o foaie de
  // parcurs de patru pagini se capsează, se scanează și circulă pe bucăți.
  // Textul devine clicabil printr-o adnotare `Link` cu acțiune `URI`, întinsă
  // exact peste el. `pdf-lib` n-are un API pentru legături; dicționarul e cel
  // din specificația PDF (ISO 32000, 12.5.6.5).
  const latimeText = fonturi.normal.widthOfTextAtSize(SEMNATURA_FISIER, 7);
  const adresa = adresaDinFisier(d, "pdf", ADRESA_SITE);
  const pagini = doc.getPages();
  pagini.forEach((p, i) => {
    p.drawText(SEMNATURA_FISIER, {
      x: MARGINE,
      y: MARGINE / 2,
      size: 7,
      font: fonturi.normal,
      color: GRI,
    });
    if (pagini.length > 1) {
      const numar = `Pagina ${String(i + 1)} din ${String(pagini.length)}`;
      p.drawText(numar, {
        x: latime - MARGINE - fonturi.normal.widthOfTextAtSize(numar, 7),
        y: MARGINE / 2,
        size: 7,
        font: fonturi.normal,
        color: GRI,
      });
    }
    const legatura = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [MARGINE, MARGINE / 2 - 2, MARGINE + latimeText, MARGINE / 2 + 8],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(adresa) },
      }),
    );
    p.node.set(PDFName.of("Annots"), doc.context.obj([legatura]));
  });
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte src/app/api/unelte
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
pnpm exec prettier --check src/lib/unelte/pdf.ts src/lib/unelte/pdf-subsol.test.ts
```

Așteptat: verzi, inclusiv „legătura din subsolul fișierului”, „PDF: adnotare URI peste text” din `randari.test.ts`.

- [ ] **Verificare vizuală a PDF-ului** (pdf.js în headless_shell; mașina n-are `pdftoppm`). O dată pe sesiune, în `$SCRATCH/vizual/`:

```bash
mkdir -p "$SCRATCH/vizual" && cd "$SCRATCH/vizual"
curl -s -o pdf.min.mjs https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs
curl -s -o pdf.worker.min.mjs https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs
```

Scriptul `$SCRATCH/randeaza-pdf.mjs`, folosit și în G6 și G9:

```js
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const [,, dir, fisier, prefix] = process.argv;
const b64 = readFileSync(fisier).toString("base64");
const html = `<!doctype html><html><body style="margin:0;background:#fff"><div id="o"></div><script type="module">
import * as pdfjs from "./pdf.min.mjs"; pdfjs.GlobalWorkerOptions.workerSrc = "./pdf.worker.min.mjs";
const date = Uint8Array.from(atob("${b64}"), c => c.charCodeAt(0));
const doc = await pdfjs.getDocument({ data: date }).promise;
for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const v = p.getViewport({ scale: 1.6 });
 const c = document.createElement("canvas"); c.width = v.width; c.height = v.height; c.style.display="block"; c.style.borderBottom="4px solid red"; document.getElementById("o").appendChild(c);
 await p.render({ canvasContext: c.getContext("2d"), viewport: v }).promise; }
document.title = "gata:" + doc.numPages;
</script></body></html>`;
writeFileSync(`${dir}/pagina.html`, html);
const browser = await chromium.launch({ executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell", args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(`file://${dir}/pagina.html`);
await page.waitForFunction(() => document.title.startsWith("gata"), null, { timeout: 60000 });
const n = Number((await page.title()).split(":")[1]);
const canv = await page.$$("canvas");
for (let i = 0; i < canv.length; i++) await canv[i].screenshot({ path: `${dir}/${prefix}-${i+1}.png` });
console.log("pagini", n);
await browser.close();
```

Un PDF de probă cu condica (60 de nume, mai multe pagini), din ruta locală. Fără server: un test temporar scrie fișierul.

```bash
cd /srv/apps/ERP && cat > src/lib/unelte/sonda-g3.test.ts <<'EOF'
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { condicaDinParametri } from "@/app/(marketing)/unelte/condica-de-prezenta/model";
import { raspunsDocument } from "./raspuns";
it("sonda", { timeout: 60_000 }, async () => {
  const nume = Array.from({ length: 30 }, (_, i) => `Angajat 🚗 Nr ${String(i + 1)}`).join("\n");
  const d = condicaDinParametri(new URLSearchParams({ an: "2026", luna: "10", angajati: nume }));
  const r = await raspunsDocument({ ...d, sursa: "/unelte/condica-de-prezenta" }, "pdf");
  writeFileSync(`${process.env.SCRATCH}/condica.pdf`, new Uint8Array(await r.arrayBuffer()));
});
EOF
SCRATCH="$SCRATCH" pnpm exec vitest run --project unit src/lib/unelte/sonda-g3.test.ts; rm src/lib/unelte/sonda-g3.test.ts
node "$SCRATCH/randeaza-pdf.mjs" "$SCRATCH/vizual" "$SCRATCH/condica.pdf" condica
```

Se deschid cu `Read` `condica-1.png` și ultima pagină. Pe fiecare trebuie să apară, jos, „Generat gratuit cu administrativo.ro” în stânga și „Pagina i din n” în dreapta; în nume, „Angajat ? Nr 1”, nu un pătrățel. Testul temporar se șterge înainte de commit: `git status --short -- src/lib/unelte` nu trebuie să-l mai arate.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(src/lib/unelte/pdf.ts src/lib/unelte/pdf-subsol.test.ts)
git status --short -- "${CAI[@]}" src/lib/unelte
git fetch origin main
git diff --name-only HEAD origin/main
git add -- src/lib/unelte/pdf-subsol.test.ts
git commit --only -m "fix(unelte): subsolul PDF pe fiecare pagină, cu numărul paginii; „?” în loc de pătrățele

Legătura spre unealtă apărea doar pe ultima pagină. Emoji și ideogramele, pe
care DejaVu nu le are, ieșeau ca glifa 0.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
# lastmod roșu = nu se împinge: se ridică data din harta.ts și se reface commitul (`git commit --amend --only -- src/content/landing/harta.ts`), apoi se reia linia.
node scripts/checks/lastmod.mjs && git merge origin/main && git push origin main
```

---

### Task G4: PDF: câmpurile antetului pe două coloane, la cerere

**Fișiere:**
- Modify: `src/lib/unelte/document-tabelar.ts`: cheia nouă, după `campuri`.
- Modify: `src/lib/unelte/pdf.ts`: bucla câmpurilor (`:120-124` în forma de azi).
- Create (test): `src/lib/unelte/pdf-campuri.test.ts`.

**Interfețe:**
- Consumă: `imparte`, `masoara`, `asiguraLoc` (interne în `pdf.ts`).
- Produce: `DocumentTabelar.campuriPeDouaColoane?: boolean`.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/lib/unelte/pdf-campuri.test.ts`:

```ts
import { PDFPage, type PDFPageDrawTextOptions } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentTabelar } from "./document-tabelar";
import { randeazaPdf } from "./pdf";

/**
 * Antetul foii de parcurs are 12 câmpuri (8 oct 2026). Pe o coloană, ocupau o
 * treime din prima pagină culcată; pe două, jumătate din înălțime.
 */
const CAMPURI = Array.from({ length: 8 }, (_, i) => ({
  eticheta: `Câmpul ${String(i + 1)}`,
  valoare: i === 7 ? "" : `valoarea ${String(i + 1)}`,
}));

const DOC: DocumentTabelar = {
  titlu: "Foaie de parcurs — octombrie 2026",
  subtitlu: null,
  campuri: CAMPURI,
  paragrafe: [],
  coloane: [],
  randuri: [],
  umbrite: [],
  note: [],
  semnaturi: [],
  orientare: "peisaj",
  numeFisier: "foaie",
};

type Desen = Readonly<{ text: string; x: number; y: number }>;

function spioneaza(): Desen[] {
  const desene: Desen[] = [];
  vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (
    this: PDFPage,
    text: string,
    optiuni?: PDFPageDrawTextOptions,
  ) {
    desene.push({ text, x: optiuni?.x ?? 0, y: optiuni?.y ?? 0 });
  });
  return desene;
}

const alCampului = (desene: readonly Desen[], n: number) =>
  desene.find((d) => d.text.startsWith(`Câmpul ${String(n)}:`));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("câmpurile antetului în PDF", { timeout: 30_000 }, () => {
  it("pe două coloane: perechile stau pe același rând, a doua la jumătatea paginii", async () => {
    const desene = spioneaza();
    await randeazaPdf({ ...DOC, campuriPeDouaColoane: true });
    const [unu, doi, trei] = [1, 2, 3].map((n) => alCampului(desene, n));
    expect(unu?.y).toBe(doi?.y);
    expect(doi?.x).toBeGreaterThan(300);
    expect(trei?.x).toBe(unu?.x);
    expect(trei?.y).toBeLessThan(unu?.y ?? 0);
    expect(alCampului(desene, 8)?.text).toBe("Câmpul 8: ______________________________");
  });

  it("fără opțiune rămân pe o coloană, ca la celelalte unelte", async () => {
    const desene = spioneaza();
    await randeazaPdf(DOC);
    const x = new Set(CAMPURI.map((_, i) => alCampului(desene, i + 1)?.x));
    expect(x.size).toBe(1);
  });

  it("un câmp lung se rupe pe rânduri în coloana lui, fără să calce perechea următoare", async () => {
    const desene = spioneaza();
    const lung = { eticheta: "Câmpul 1", valoare: "cuvânt ".repeat(40).trim() };
    await randeazaPdf({ ...DOC, campuri: [lung, ...CAMPURI.slice(1)], campuriPeDouaColoane: true });
    const coloanaStanga = desene.filter(
      (d) => d.x === alCampului(desene, 1)?.x && d.text.includes("cuvânt"),
    );
    expect(coloanaStanga.length).toBeGreaterThan(1);
    const ultimaLinie = Math.min(...coloanaStanga.map((d) => d.y));
    expect(alCampului(desene, 3)?.y ?? Infinity).toBeLessThan(ultimaLinie);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte/pdf-campuri.test.ts
```

Așteptat:
- `pnpm exec vitest` cade la primul test: `expected 522.28 to be 507.28` (câmpul 2 e sub câmpul 1, nu alături);
- `pnpm typecheck` ar spune `Object literal may only specify known properties, and 'campuriPeDouaColoane' does not exist`.

Celelalte două teste trec și înainte. Sunt paza: fără opțiune nu se schimbă nimic, iar un câmp lung nu calcă perechea următoare.

- [ ] **Pasul 3: Implementarea minimă.** În `document-tabelar.ts` înlocuiește:

```ts
  /** Perechi „Angajat: Popa Ion”. Valoare goală = linie de completat de mână. */
  campuri: readonly Readonly<{ eticheta: string; valoare: string }>[];
```

cu:

```ts
  /** Perechi „Angajat: Popa Ion”. Valoare goală = linie de completat de mână. */
  campuri: readonly Readonly<{ eticheta: string; valoare: string }>[];
  /**
   * PDF: câmpurile se așază pe două coloane, de la stânga la dreapta. Pentru
   * antetele lungi (foaia de parcurs are 12), care altfel mănâncă o treime din
   * prima pagină. Lipsă = o coloană, ca până acum.
   */
  campuriPeDouaColoane?: boolean;
```

În `pdf.ts` înlocuiește:

```ts
  y -= 4;
  for (const c of d.campuri) {
    scrie(`${c.eticheta}: ${c.valoare === "" ? LINIE_GOALA : c.valoare}`, 9, fonturi.normal);
  }
  y -= 4;
```

cu:

```ts
  y -= 4;
  const textCamp = (c: DocumentTabelar["campuri"][number]) =>
    `${c.eticheta}: ${c.valoare === "" ? LINIE_GOALA : c.valoare}`;
  if (d.campuriPeDouaColoane === true) {
    // Câte două câmpuri pe rând; fiecare se rupe pe cuvinte în coloana lui, iar
    // rândul ia înălțimea celui mai lung, ca perechea următoare să nu-l calce.
    const spatiu = 16;
    const latimeColoana = (util - spatiu) / 2;
    for (let i = 0; i < d.campuri.length; i += 2) {
      const pereche = d.campuri
        .slice(i, i + 2)
        .map((c) => imparte(textCamp(c), latimeColoana, masoara(fonturi.normal, 9)));
      const linii = Math.max(...pereche.map((p) => p.length));
      asiguraLoc(linii * 12 + 3);
      pereche.forEach((randuri, k) => {
        randuri.forEach((rand, j) => {
          pagina.drawText(rand, {
            x: MARGINE + k * (latimeColoana + spatiu),
            y: y - 9 - j * 12,
            size: 9,
            font: fonturi.normal,
            color: NEGRU,
          });
        });
      });
      y -= linii * 12 + 3;
    }
  } else {
    for (const c of d.campuri) scrie(textCamp(c), 9, fonturi.normal);
  }
  y -= 4;
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte src/app/api/unelte
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
pnpm exec prettier --check src/lib/unelte/document-tabelar.ts src/lib/unelte/pdf.ts src/lib/unelte/pdf-campuri.test.ts
```

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(src/lib/unelte/document-tabelar.ts src/lib/unelte/pdf.ts src/lib/unelte/pdf-campuri.test.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- src/lib/unelte/pdf-campuri.test.ts
git commit --only -m "feat(unelte): câmpurile antetului PDF pe două coloane, la cerere

campuriPeDouaColoane, opțional; celelalte unelte rămân pe o coloană.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
# lastmod roșu = nu se împinge: se ridică data din harta.ts și se reface commitul (`git commit --amend --only -- src/content/landing/harta.ts`), apoi se reia linia.
node scripts/checks/lastmod.mjs && git merge origin/main && git push origin main
```

---

### Task G5: Modelul foii de parcurs: cele patru elemente, antetul justificativ, curse, alimentări, rezumat

**Fișiere:**
- Modify (rescris întreg): `src/app/(marketing)/unelte/foaie-de-parcurs/model.ts`.
- Modify (rescris întreg): `src/app/(marketing)/unelte/foaie-de-parcurs/model.test.ts`.

**Interfețe:**
- Consumă:
  - `construiesteFoaie`, `normalizeazaAn`, `normalizeazaLuna` din `../foaie-de-pontaj/foaie`, cu semnăturile verificate în `foaie.ts:63-71,97-102`;
  - `Coloana`, `DocumentTabelar`, `TabelSuplimentar` (G1), `campuriPeDouaColoane` (G4);
  - în test: `ETICHETE_CATEGORIE`, `ETICHETE_COMBUSTIBIL` din `@/app/(app)/flota/etichete`, `CATEGORII_VEHICUL`, `COMBUSTIBILI` din `@/schemas/fleet` (verificate: `src/schemas/fleet.ts:30,44`, `src/app/(app)/flota/etichete.ts:24,37`) și `randeazaPdf` din `@/lib/unelte/pdf`.
- Produce:

```ts
export type ParametriFoaieParcurs = Readonly<{
  an: number; luna: number; nrAuto: string; marca: string; sofer: string; firma: string;
  cui: string; nrFoaie: string;
  categorie: CategorieVehicul | null; combustibil: Combustibil | null; utilizare: Utilizare | null;
  norma: number | null; kmInitial: number | null; stocInitial: number | null; cursePeZi: number;
}>;
export function parametriFoaieParcurs(q: URLSearchParams): ParametriFoaieParcurs;
export function avizeFoaieParcurs(q: URLSearchParams, ales: ParametriFoaieParcurs): readonly string[];
export function construiesteFoaieParcurs(p: ParametriFoaieParcurs): DocumentTabelar;
export function foaieParcursDinParametri(q: URLSearchParams): DocumentTabelar;
export function randuriCurse(p: ParametriFoaieParcurs): readonly RandCursa[];
export function coloaneCurse(u: Unitate): readonly Coloana[];
export function coloaneAlimentari(u: Unitate): readonly Coloana[];
export function eticheteRezumat(u: Unitate): Readonly<Record<CheieRezumat, string>>;
export function unitatePentru(c: Combustibil | null): Unitate; // "l" | "kWh" | "kg"
export function normalizeazaZecimal(brut: string | null, max: number): number | null;
export function normalizeazaKm(brut: string | null): number | null;
export function normalizeazaCurse(brut: string | null): number;
export const CATEGORII, ETICHETE_CATEGORIE, COMBUSTIBILI, ETICHETE_COMBUSTIBIL,
  UTILIZARI, ETICHETE_UTILIZARE, TEMEI_UTILIZARE, COLOANA, CHEI_REZUMAT,
  ETICHETA_NORMA, TITLU_ALIMENTARI, TITLU_REZUMAT, MAX_CURSE_PE_ZI, RANDURI_ALIMENTARI,
  MAX_KM, MAX_NORMA, MAX_STOC;
```

Pagina din B8 (`ales.nrAuto`, `ales.marca`, `ales.sofer`, `ales.firma`, `construiesteFoaieParcurs(ales)`) și registrul (`foaieParcursDinParametri`) compilează neschimbate cu modelul nou. Pagina se rescrie abia în G7.

- [ ] **Pasul 1: Scrie testul care pică.** Înlocuiește tot conținutul lui `src/app/(marketing)/unelte/foaie-de-parcurs/model.test.ts` cu:

```ts
import { PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ETICHETE_CATEGORIE as ETICHETE_FLOTA,
  ETICHETE_COMBUSTIBIL as COMBUSTIBIL_FLOTA,
} from "@/app/(app)/flota/etichete";
import { randeazaPdf } from "@/lib/unelte/pdf";
import { CATEGORII_VEHICUL, COMBUSTIBILI as COMBUSTIBILI_FLOTA } from "@/schemas/fleet";

import {
  avizeFoaieParcurs,
  CATEGORII,
  COLOANA,
  COMBUSTIBILI,
  construiesteFoaieParcurs,
  ETICHETA_NORMA,
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  foaieParcursDinParametri,
  normalizeazaKm,
  normalizeazaZecimal,
  parametriFoaieParcurs,
  RANDURI_ALIMENTARI,
  TITLU_ALIMENTARI,
  TITLU_REZUMAT,
  type ParametriFoaieParcurs,
} from "./model";

const GOL: ParametriFoaieParcurs = {
  an: 2026,
  luna: 2,
  nrAuto: "",
  marca: "",
  sofer: "",
  firma: "",
  cui: "",
  nrFoaie: "",
  categorie: null,
  combustibil: null,
  utilizare: null,
  norma: null,
  kmInitial: null,
  stocInitial: null,
  cursePeZi: 1,
};

const PLIN: ParametriFoaieParcurs = {
  ...GOL,
  an: 2026,
  luna: 10,
  nrAuto: "B-123-ABC",
  marca: "Dacia Logan",
  sofer: "Radu Andrei",
  firma: "Construct SRL",
  cui: "RO12345678",
  nrFoaie: "17",
  categorie: "autoturism",
  combustibil: "motorina",
  utilizare: "agent",
  norma: 6.5,
  kmInitial: 125_000,
  stocInitial: 20,
};

const camp = (d: ReturnType<typeof construiesteFoaieParcurs>, eticheta: string) =>
  d.campuri.find((c) => c.eticheta === eticheta)?.valoare;

describe("foaia de parcurs: elementele minime din norme", () => {
  /**
   * HG 1/2016, titlul II pct. 16 alin. (2) și titlul VII pct. 68 alin. (2):
   * „categoria de vehicul utilizat, scopul și locul deplasării, kilometrii
   * parcurși, norma proprie de consum carburant pe kilometru parcurs”.
   */
  it("are cele patru elemente, și necompletată", () => {
    const d = construiesteFoaieParcurs(GOL);
    const etichete = d.campuri.map((c) => c.eticheta);
    expect(etichete).toContain("Categoria vehiculului");
    expect(etichete).toContain(ETICHETA_NORMA);
    const coloane = d.coloane.map((c) => c.eticheta);
    expect(coloane[COLOANA.loc]).toBe("Locul deplasării\n(traseul: de la – la)");
    expect(coloane[COLOANA.scop]).toBe("Scopul deplasării");
    expect(coloane[COLOANA.km]).toBe("Km\nparcurși");
  });

  it("completată, scrie categoria, norma pe 100 km și pe km, utilizarea cu temeiul", () => {
    const d = construiesteFoaieParcurs(PLIN);
    expect(camp(d, "Categoria vehiculului")).toBe("Autoturism");
    expect(camp(d, ETICHETA_NORMA)).toBe("6,5 l/100 km (0,065 l/km)");
    // Pe km, norma nu se rotunjește: 6,25 l/100 km = 0,0625 l/km, nu 0,063.
    expect(camp(construiesteFoaieParcurs({ ...PLIN, norma: 6.25 }), ETICHETA_NORMA)).toBe(
      "6,25 l/100 km (0,0625 l/km)",
    );
    expect(camp(d, "Utilizarea vehiculului")).toBe(
      "Agent de vânzări sau de achiziții — art. 25 alin. (3) lit. l) pct. 2 și art. 298 alin. (3) lit. b) Cod fiscal",
    );
    expect(camp(d, "Combustibil")).toBe("Motorină");
  });

  it("antetul de document justificativ: unitatea, CUI, numărul, perioada, data întocmirii", () => {
    const d = construiesteFoaieParcurs(PLIN);
    expect(camp(d, "Unitatea")).toBe("Construct SRL");
    expect(camp(d, "CUI")).toBe("RO12345678");
    expect(camp(d, "Foaia nr.")).toBe("17");
    expect(camp(d, "Perioada")).toBe("01.10.2026 – 31.10.2026");
    expect(camp(d, "Data întocmirii")).toBe("");
    expect(d.campuriPeDouaColoane).toBe(true);
  });
});

describe("foaia de parcurs: curse, alimentări, rezumat", () => {
  it("un rând pe zi în mod implicit; februarie 2028 (bisect) are 29", () => {
    const d = construiesteFoaieParcurs({ ...GOL, an: 2028 });
    expect(d.randuri).toHaveLength(29);
    expect(d.randuri[0]?.[COLOANA.data]).toBe("01.02.2028");
    expect(d.randuri[28]?.[COLOANA.data]).toBe("29.02.2028");
  });

  it("mai multe curse pe zi: fiecare zi apare de atâtea ori, la rând", () => {
    const d = construiesteFoaieParcurs({ ...PLIN, cursePeZi: 3 });
    expect(d.randuri).toHaveLength(31 * 3);
    expect(d.randuri.slice(0, 4).map((r) => r[COLOANA.data])).toEqual([
      "01.10.2026",
      "01.10.2026",
      "01.10.2026",
      "02.10.2026",
    ]);
  });

  it("coloana Ziua deosebește weekendul: 3 și 4 octombrie 2026 sunt Sâ și Du", () => {
    const d = construiesteFoaieParcurs(PLIN);
    expect(d.randuri.slice(0, 5).map((r) => r[COLOANA.ziua])).toEqual([
      "Jo",
      "Vi",
      "Sâ",
      "Du",
      "Lu",
    ]);
  });

  it("kilometrajul inițial intră doar pe primul rând, la plecare", () => {
    const d = construiesteFoaieParcurs(PLIN);
    expect(d.randuri[0]?.[COLOANA.kmPlecare]).toBe("125.000");
    expect(d.randuri.slice(1).every((r) => r[COLOANA.kmPlecare] === "")).toBe(true);
  });

  it("are tabelul de alimentări și rezumatul lunii, cu valorile cunoscute", () => {
    const d = construiesteFoaieParcurs(PLIN);
    const [alimentari, rezumat] = d.tabeleSuplimentare ?? [];
    expect(alimentari?.titlu).toBe(TITLU_ALIMENTARI);
    expect(alimentari?.randuri).toHaveLength(RANDURI_ALIMENTARI);
    expect(alimentari?.coloane.map((c) => c.eticheta)).toContain("Nr. bon fiscal / factură");
    expect(rezumat?.titlu).toBe(TITLU_REZUMAT);
    const valoare = (e: string) => rezumat?.randuri.find((r) => r[0] === e)?.[1];
    expect(valoare("Km la bord la începutul lunii")).toBe("125.000");
    expect(valoare("Norma proprie de consum (l/100 km)")).toBe("6,5");
    expect(valoare("Stoc la începutul lunii (l)")).toBe("20");
    expect(valoare("Total km parcurși în lună")).toBe("");
  });

  it("la electric unitatea e kWh, la GNC kg, în antet, coloane și rezumat", () => {
    const electric = construiesteFoaieParcurs({
      ...PLIN,
      combustibil: "electric",
      norma: 16,
    });
    expect(camp(electric, ETICHETA_NORMA)).toBe("16 kWh/100 km (0,16 kWh/km)");
    expect(electric.coloane[COLOANA.consum]?.eticheta).toBe("Consum\nnormat (kWh)");
    expect(electric.tabeleSuplimentare?.[1]?.randuri[3]?.[0]).toBe(
      "Norma proprie de consum (kWh/100 km)",
    );
    const gnc = construiesteFoaieParcurs({ ...PLIN, combustibil: "gnc" });
    expect(gnc.coloane[COLOANA.consum]?.eticheta).toBe("Consum\nnormat (kg)");
  });

  it("numele fișierului poartă numărul mașinii, ca două foi ale aceleiași luni să nu se calce", () => {
    expect(construiesteFoaieParcurs(PLIN).numeFisier).toBe("foaie-de-parcurs-B-123-ABC-2026-10");
    expect(construiesteFoaieParcurs(GOL).numeFisier).toBe("foaie-de-parcurs-2026-02");
  });
});

describe("parametrii din adresă", () => {
  it("citește toate câmpurile noi", () => {
    const p = parametriFoaieParcurs(
      new URLSearchParams({
        an: "2026",
        luna: "10",
        cui: "RO12345678",
        nr: "17",
        categorie: "autoutilitara",
        combustibil: "electric",
        utilizare: "urgenta",
        norma: "16,5",
        km: "125.000",
        stoc: "40",
        curse: "2",
      }),
    );
    expect(p).toMatchObject({
      cui: "RO12345678",
      nrFoaie: "17",
      categorie: "autoutilitara",
      combustibil: "electric",
      utilizare: "urgenta",
      norma: 16.5,
      kmInitial: 125_000,
      stocInitial: 40,
      cursePeZi: 2,
    });
  });

  it("valorile necunoscute devin rubrici de completat, nu ghicite", () => {
    const p = parametriFoaieParcurs(
      new URLSearchParams({
        categorie: "tanc",
        combustibil: "abur",
        utilizare: "x",
        curse: "9",
      }),
    );
    expect([p.categorie, p.combustibil, p.utilizare, p.cursePeZi]).toEqual([null, null, null, 1]);
  });

  it("norma: virgulă sau punct, cel mult trei zecimale, peste 0 și cel mult 99,9", () => {
    expect(normalizeazaZecimal("6,5", 99.9)).toBe(6.5);
    expect(normalizeazaZecimal("6.25", 99.9)).toBe(6.25);
    expect(normalizeazaZecimal("0", 99.9)).toBeNull();
    expect(normalizeazaZecimal("100", 99.9)).toBeNull();
    expect(normalizeazaZecimal("6,5 l", 99.9)).toBeNull();
    expect(normalizeazaZecimal("1e1", 99.9)).toBeNull();
  });

  it("kilometrajul: grupare cu punct sau spațiu, fără zecimale, cel mult 5.000.000", () => {
    expect(normalizeazaKm("125.000")).toBe(125_000);
    expect(normalizeazaKm("125 000")).toBe(125_000);
    expect(normalizeazaKm("0")).toBe(0);
    expect(normalizeazaKm("125,5")).toBeNull();
    expect(normalizeazaKm("6000000")).toBeNull();
    expect(normalizeazaKm("-5")).toBeNull();
  });

  it("taie câmpurile de text la 120 de caractere, CUI și numărul la 20", () => {
    const p = parametriFoaieParcurs(
      new URLSearchParams({
        sofer: "x".repeat(500),
        cui: "1".repeat(50),
        nr: "2".repeat(50),
      }),
    );
    expect(p.sofer).toHaveLength(120);
    expect(p.cui).toHaveLength(20);
    expect(p.nrFoaie).toHaveLength(20);
    const d = foaieParcursDinParametri(new URLSearchParams({ sofer: "x".repeat(500) }));
    expect(d.campuri.find((c) => c.eticheta === "Conducător auto")?.valoare).toHaveLength(120);
  });

  it("avizele spun ce valori au fost lăsate deoparte", () => {
    const q = new URLSearchParams({
      norma: "6,5 l",
      km: "125,5",
      stoc: "-3",
      curse: "7",
    });
    expect(avizeFoaieParcurs(q, parametriFoaieParcurs(q))).toEqual([
      "Norma de consum „6,5 l” nu e un număr între 0 și 99,9 l/100 km; am lăsat rubrica de completat.",
      "Kilometrajul „125,5” nu e un număr întreg de km între 0 și 5.000.000; am lăsat rubrica de completat.",
      "Stocul de la începutul lunii „-3” nu e un număr între 0 și 999 l; am lăsat rubrica de completat.",
      "Numărul de curse pe zi „7” nu e între 1 și 4; am folosit 1.",
    ]);
    const bun = new URLSearchParams({
      norma: "6,5",
      km: "125.000",
      stoc: "20",
      curse: "2",
    });
    expect(avizeFoaieParcurs(bun, parametriFoaieParcurs(bun))).toEqual([]);
  });
});

/**
 * Termenii uneltei sunt ai modulului Flotă: cine trece din foaia gratuită în
 * aplicație găsește aceleași categorii și aceiași combustibili, cu aceleași
 * etichete. Unealta nu importă din aplicație (paginile publice nu depind de
 * `(app)`), deci testul e cel care ține cele două liste împreună.
 */
describe("alinierea cu modulul Flotă", () => {
  it("categoriile sunt o submulțime a `CATEGORII_VEHICUL`, cu aceleași etichete", () => {
    for (const c of CATEGORII) {
      expect(CATEGORII_VEHICUL).toContain(c);
      expect(ETICHETE_CATEGORIE[c]).toBe(ETICHETE_FLOTA[c]);
    }
  });

  it("combustibilii sunt exact cei din Flotă, cu aceleași etichete", () => {
    expect([...COMBUSTIBILI]).toEqual([...COMBUSTIBILI_FLOTA]);
    for (const c of COMBUSTIBILI) expect(ETICHETE_COMBUSTIBIL[c]).toBe(COMBUSTIBIL_FLOTA[c]);
  });
});

/**
 * Prima randare a foii noi (8 oct 2026) tăia „Consum normat (l)” și „Semnătura
 * conducătorului” cu „…”: coloanele erau mai înguste decât etichetele lor.
 */
describe("foaia de parcurs în PDF", { timeout: 30_000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["motorina", "electric"] as const)(
    "%s: nicio etichetă de coloană nu se taie cu „…”",
    async (combustibil) => {
      const texte: string[] = [];
      vi.spyOn(PDFPage.prototype, "drawText").mockImplementation((text: string) => {
        texte.push(text);
      });
      const d = construiesteFoaieParcurs({ ...PLIN, combustibil });
      await randeazaPdf(d);
      const etichete = [d.coloane, ...(d.tabeleSuplimentare ?? []).map((t) => t.coloane)]
        .flat()
        .flatMap((c) => c.eticheta.split("\n"));
      for (const e of etichete) expect(texte, e).toContain(e);
    },
  );
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(marketing)/unelte/foaie-de-parcurs/model.test.ts"
```

Așteptat: 18 din 20 cad. Exporturile noi (`COLOANA`, `CATEGORII`, `avizeFoaieParcurs`…) vin `undefined`. Primele eșecuri:
- `expected [ 'Nr. de înmatriculare', …(2) ] to include 'Categoria vehiculului'`: e defectul critic din audit;
- `expected undefined to be 'Autoturism'`;
- `expected [ …(31) ] to have a length of 93 but got 31`.

Cele două teste „nicio etichetă de coloană nu se taie” trec și pe modelul vechi, care are coloane late și etichete scurte. Ele sunt paza pentru lățimile noi.

- [ ] **Pasul 3: Implementarea minimă.** Înlocuiește tot conținutul lui `src/app/(marketing)/unelte/foaie-de-parcurs/model.ts` cu:

```ts
import type { Coloana, DocumentTabelar, TabelSuplimentar } from "@/lib/unelte/document-tabelar";

import { construiesteFoaie, normalizeazaAn, normalizeazaLuna } from "../foaie-de-pontaj/foaie";

/**
 * Foaia de parcurs lunară, ca document justificativ pentru deducerea
 * cheltuielilor cu vehiculul.
 *
 * ── CE CER NORMELE, LITERAL ───────────────────────────────────────────────
 * HG 1/2016 (normele Codului fiscal), titlul II pct. 16 alin. (2) și titlul VII
 * pct. 68 alin. (2), forma consolidată la 31.03.2026 descărcată de pe
 * legislatie.just.ro/Public/DetaliiDocument/212504 pe 8 oct 2026: foaia de
 * parcurs „trebuie să cuprindă [la pct. 68: «să conțină»] cel puțin următoarele
 * informații: categoria de vehicul utilizat, scopul și locul deplasării,
 * kilometrii parcurși, norma proprie de consum carburant pe kilometru
 * parcurs”. Până pe 8 oct 2026 foaia
 * nu avea categoria, iar norma era o linie goală în subsol (auditul live).
 *
 * Restul antetului vine din OMFP 2634/2015, anexa 1 pct. 2–3 (orice document
 * justificativ): denumirea entității, numărul și data întocmirii, codul de
 * identificare fiscală.
 *
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu decide încadrarea vehiculului (pct. 68 alin. (8): „se realizează de
 * fiecare persoană impozabilă”). Utilizarea se ALEGE de om și se scrie cu
 * temeiul ei; lipsă = rubrică de completat.
 *
 * Zilele vin din `construiesteFoaie`; weekendurile NU se scot, fiindcă o mașină
 * de serviciu poate circula și sâmbăta — se recunosc după coloana „Ziua”.
 */

/** Valorile și etichetele, aliniate la `CATEGORII_VEHICUL` din modulul Flotă. */
export const CATEGORII = [
  "autoturism",
  "autoutilitara",
  "microbuz",
  "camion",
  "autobuz",
  "motocicleta",
  "altele",
] as const;
export type CategorieVehicul = (typeof CATEGORII)[number];

export const ETICHETE_CATEGORIE: Readonly<Record<CategorieVehicul, string>> = {
  autoturism: "Autoturism",
  autoutilitara: "Autoutilitară",
  microbuz: "Microbuz",
  camion: "Camion",
  autobuz: "Autobuz",
  motocicleta: "Motocicletă",
  altele: "Altele",
};

/** Aceleași valori și etichete ca `COMBUSTIBILI` din modulul Flotă. */
export const COMBUSTIBILI = [
  "benzina",
  "motorina",
  "gpl",
  "gnc",
  "electric",
  "hibrid",
  "hibrid_plugin",
  "altul",
] as const;
export type Combustibil = (typeof COMBUSTIBILI)[number];

export const ETICHETE_COMBUSTIBIL: Readonly<Record<Combustibil, string>> = {
  benzina: "Benzină",
  motorina: "Motorină",
  gpl: "GPL",
  gnc: "GNC",
  electric: "Electric",
  hibrid: "Hibrid",
  hibrid_plugin: "Hibrid plug-in",
  altul: "Altul",
};

/**
 * Cum e folosit vehiculul, cu temeiul din Codul fiscal (forma consolidată la
 * 08.08.2026, legislatie.just.ro/Public/DetaliiDocument/171282): art. 25
 * alin. (3) lit. l) pct. 1–5 pentru impozitul pe profit, art. 298 alin. (1) și
 * (3) lit. a)–f) pentru TVA. „mixt” = folosit și personal: deducere 50%, dar
 * doar până la 3.500 kg și 9 locuri cu tot cu al șoferului (art. 298 alin. (2));
 * peste prag limita nu se aplică, de aceea eticheta spune pragul.
 */
export const UTILIZARI = [
  "exclusiv",
  "urgenta",
  "agent",
  "persoane",
  "servicii",
  "marfa",
  "mixt",
] as const;
export type Utilizare = (typeof UTILIZARI)[number];

export const ETICHETE_UTILIZARE: Readonly<Record<Utilizare, string>> = {
  exclusiv: "Exclusiv în scopul activității economice",
  urgenta: "Servicii de urgență, pază și protecție sau curierat",
  agent: "Agent de vânzări sau de achiziții",
  persoane: "Transport de persoane cu plată, inclusiv taxi",
  servicii: "Servicii cu plată, închiriere sau școală de șoferi",
  marfa: "Vehicul folosit ca marfă în scop comercial",
  mixt: "Folosit și în scop personal (50%, dacă are cel mult 3.500 kg și 9 locuri)",
};

export const TEMEI_UTILIZARE: Readonly<Record<Utilizare, string>> = {
  exclusiv: "art. 25 alin. (3) lit. l) și art. 298 alin. (1) Cod fiscal",
  urgenta: "art. 25 alin. (3) lit. l) pct. 1 și art. 298 alin. (3) lit. a) Cod fiscal",
  agent: "art. 25 alin. (3) lit. l) pct. 2 și art. 298 alin. (3) lit. b) Cod fiscal",
  persoane: "art. 25 alin. (3) lit. l) pct. 3 și art. 298 alin. (3) lit. c) Cod fiscal",
  servicii: "art. 25 alin. (3) lit. l) pct. 4 și art. 298 alin. (3) lit. d)–e) Cod fiscal",
  marfa: "art. 25 alin. (3) lit. l) pct. 5 și art. 298 alin. (3) lit. f) Cod fiscal",
  mixt: "art. 25 alin. (3) lit. l) și art. 298 alin. (1) Cod fiscal",
};

/** Unitatea în care se măsoară combustibilul: litri, kWh la electrice, kg la GNC. */
export type Unitate = "l" | "kWh" | "kg";

export function unitatePentru(c: Combustibil | null): Unitate {
  if (c === "electric") return "kWh";
  if (c === "gnc") return "kg";
  return "l";
}

export const MAX_CURSE_PE_ZI = 4;
export const RANDURI_ALIMENTARI = 8;
/** Plafoane de bun-simț, aceleași ca la kilometrajul de bord din modulul Flotă. */
export const MAX_KM = 5_000_000;
export const MAX_NORMA = 99.9;
export const MAX_STOC = 999;

export type ParametriFoaieParcurs = Readonly<{
  an: number;
  luna: number;
  nrAuto: string;
  marca: string;
  sofer: string;
  firma: string;
  cui: string;
  nrFoaie: string;
  categorie: CategorieVehicul | null;
  combustibil: Combustibil | null;
  utilizare: Utilizare | null;
  /** Unități (l, kWh sau kg) la 100 km. */
  norma: number | null;
  /** Kilometrajul de bord la începutul lunii, în km întregi. */
  kmInitial: number | null;
  /** Combustibilul din rezervor la începutul lunii, în aceeași unitate. */
  stocInitial: number | null;
  cursePeZi: number;
}>;

const text = (v: string | null, max = 120) => (v ?? "").trim().slice(0, max);

function alegere<T extends string>(brut: string | null, valori: readonly T[]): T | null {
  const v = (brut ?? "").trim();
  return (valori as readonly string[]).includes(v) ? (v as T) : null;
}

/**
 * Un număr pozitiv cu cel mult trei zecimale, cu virgulă sau cu punct („6,5”,
 * „6.5”), cel mult `max`. Orice altceva = `null`, adică rubrică de completat.
 */
export function normalizeazaZecimal(brut: string | null, max: number): number | null {
  const v = (brut ?? "").trim();
  if (!/^\d{1,6}(?:[.,]\d{1,3})?$/u.test(v)) return null;
  const n = Number(v.replace(",", "."));
  return n > 0 && n <= max ? n : null;
}

/**
 * Kilometri întregi, între 0 și 5.000.000. Punctul și spațiul de grupare se
 * acceptă („125.000”, „125 000”), fiindcă așa se scrie kilometrajul în română;
 * o virgulă zecimală nu.
 */
export function normalizeazaKm(brut: string | null): number | null {
  const v = (brut ?? "").trim().replace(/[\s.]/gu, "");
  if (!/^\d{1,7}$/u.test(v)) return null;
  const n = Number(v);
  return n <= MAX_KM ? n : null;
}

export function normalizeazaCurse(brut: string | null): number {
  const v = (brut ?? "").trim();
  if (!/^\d$/u.test(v)) return 1;
  const n = Number(v);
  return n >= 1 && n <= MAX_CURSE_PE_ZI ? n : 1;
}

export function parametriFoaieParcurs(q: URLSearchParams): ParametriFoaieParcurs {
  const acum = new Date();
  return {
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    nrAuto: text(q.get("auto")),
    marca: text(q.get("marca")),
    sofer: text(q.get("sofer")),
    firma: text(q.get("firma")),
    cui: text(q.get("cui"), 20),
    nrFoaie: text(q.get("nr"), 20),
    categorie: alegere(q.get("categorie"), CATEGORII),
    combustibil: alegere(q.get("combustibil"), COMBUSTIBILI),
    utilizare: alegere(q.get("utilizare"), UTILIZARI),
    norma: normalizeazaZecimal(q.get("norma"), MAX_NORMA),
    kmInitial: normalizeazaKm(q.get("km")),
    stocInitial: normalizeazaZecimal(q.get("stoc"), MAX_STOC),
    cursePeZi: normalizeazaCurse(q.get("curse")),
  };
}

/** Scurtat la 24 de caractere: o adresă lungă nu se reproduce întreagă pe pagină. */
function citat(brut: string): string {
  const t = brut.trim();
  return t.length > 24 ? `${t.slice(0, 24)}…` : t;
}

/**
 * Ce a lăsat foaia deoparte din adresă, spus în cuvinte: o normă scrisă „6,5 l”
 * nu mai dispare tăcut din document. Anul și luna le spune `avizeParametri`
 * din foaia de pontaj (aceeași normalizare).
 */
export function avizeFoaieParcurs(
  q: URLSearchParams,
  ales: ParametriFoaieParcurs,
): readonly string[] {
  const avize: string[] = [];
  const brut = (cheie: string) => (q.get(cheie) ?? "").trim();
  const u = unitatePentru(ales.combustibil);
  if (brut("norma") !== "" && ales.norma === null) {
    avize.push(
      `Norma de consum „${citat(brut("norma"))}” nu e un număr între 0 și 99,9 ${u}/100 km; am lăsat rubrica de completat.`,
    );
  }
  if (brut("km") !== "" && ales.kmInitial === null) {
    avize.push(
      `Kilometrajul „${citat(brut("km"))}” nu e un număr întreg de km între 0 și 5.000.000; am lăsat rubrica de completat.`,
    );
  }
  if (brut("stoc") !== "" && ales.stocInitial === null) {
    avize.push(
      `Stocul de la începutul lunii „${citat(brut("stoc"))}” nu e un număr între 0 și 999 ${u}; am lăsat rubrica de completat.`,
    );
  }
  if (brut("curse") !== "" && String(ales.cursePeZi) !== brut("curse")) {
    avize.push(
      `Numărul de curse pe zi „${citat(brut("curse"))}” nu e între 1 și ${String(MAX_CURSE_PE_ZI)}; am folosit 1.`,
    );
  }
  return avize;
}

const FORMAT_RO = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 3 });
const numar = (n: number) => FORMAT_RO.format(n);
/**
 * Norma pe kilometru: norma pe 100 km are cel mult 3 zecimale, deci împărțită
 * la 100 are cel mult 5. Cu 3, „6,25 l/100 km” ar fi devenit „0,063 l/km”,
 * adică exact forma pe care o cer normele, rotunjită greșit.
 */
const FORMAT_PE_KM = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 5 });

/** Duminica e prima, ca la `Date.getUTCDay()`. Două litere: „Ma” și „Mi” nu se confundă. */
const ZILE = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sâ"] as const;

export type RandCursa = Readonly<{
  zi: number;
  /** „01.10.2026” */
  data: string;
  /** „Jo” */
  ziua: string;
  weekend: boolean;
  /** Primul rând al zilei; celelalte sunt curse în plus pe aceeași zi. */
  primaCursa: boolean;
}>;

/** Câte un rând pe cursă: fiecare zi a lunii × `cursePeZi`. */
export function randuriCurse(p: ParametriFoaieParcurs): readonly RandCursa[] {
  const ll = String(p.luna).padStart(2, "0");
  return construiesteFoaie(p.an, p.luna, [""], 8).zile.flatMap((z) => {
    const dow = new Date(Date.UTC(p.an, p.luna - 1, z.zi)).getUTCDay();
    const rand = {
      zi: z.zi,
      data: `${String(z.zi).padStart(2, "0")}.${ll}.${String(p.an)}`,
      ziua: ZILE[dow] ?? "",
      weekend: z.weekend,
    };
    return Array.from({ length: p.cursePeZi }, (_, k) => ({
      ...rand,
      primaCursa: k === 0,
    }));
  });
}

/** Indicii coloanelor tabelului de curse; Excel-ul își pune formulele pe ei. */
export const COLOANA = {
  data: 0,
  ziua: 1,
  oraPlecare: 2,
  oraSosire: 3,
  loc: 4,
  scop: 5,
  kmPlecare: 6,
  kmSosire: 7,
  km: 8,
  consum: 9,
  semnatura: 10,
} as const;

export function coloaneCurse(u: Unitate): readonly Coloana[] {
  // Lățimi măsurate pe DejaVu aldin, 8 pt, pe A4 culcat: „normat (kWh)” cere
  // 63 pt, „conducătorului” 68 pt. Mai înguste, PDF-ul le tăia cu „…”.
  return [
    { eticheta: "Data", latime: 1.6 },
    { eticheta: "Ziua", latime: 0.7 },
    { eticheta: "Ora\nplecării", latime: 1.1 },
    { eticheta: "Ora\nsosirii", latime: 1.1 },
    { eticheta: "Locul deplasării\n(traseul: de la – la)", latime: 4.6 },
    { eticheta: "Scopul deplasării", latime: 3.9 },
    { eticheta: "Km bord\nla plecare", latime: 1.45 },
    { eticheta: "Km bord\nla sosire", latime: 1.45 },
    { eticheta: "Km\nparcurși", latime: 1.2 },
    { eticheta: `Consum\nnormat (${u})`, latime: 1.9 },
    { eticheta: "Semnătura\nconducătorului", latime: 2.1 },
  ];
}

export function coloaneAlimentari(u: Unitate): readonly Coloana[] {
  return [
    { eticheta: "Data", latime: 1.8 },
    { eticheta: "Nr. bon fiscal / factură", latime: 2.6 },
    { eticheta: "Stația (furnizorul)", latime: 4 },
    { eticheta: `Cantitate\n(${u})`, latime: 1.4 },
    { eticheta: "Valoare\n(lei)", latime: 1.4 },
    { eticheta: "Semnătura", latime: 2 },
  ];
}

export const TITLU_ALIMENTARI = "Alimentări cu combustibil";
export const TITLU_REZUMAT = "Rezumatul lunii";

/** Rândurile rezumatului, în ordine; Excel-ul pune pe fiecare formula lui. */
export const CHEI_REZUMAT = [
  "kmInceput",
  "kmSfarsit",
  "kmTotal",
  "norma",
  "consumNormat",
  "stocInceput",
  "alimentat",
  "stocCalculat",
  "stocConstatat",
  "diferenta",
  "valoare",
] as const;
export type CheieRezumat = (typeof CHEI_REZUMAT)[number];

export function eticheteRezumat(u: Unitate): Readonly<Record<CheieRezumat, string>> {
  return {
    kmInceput: "Km la bord la începutul lunii",
    kmSfarsit: "Km la bord la sfârșitul lunii",
    kmTotal: "Total km parcurși în lună",
    norma: `Norma proprie de consum (${u}/100 km)`,
    consumNormat: `Consum după normă (${u})`,
    stocInceput: `Stoc la începutul lunii (${u})`,
    alimentat: `Alimentat în lună (${u})`,
    stocCalculat: `Stoc la sfârșitul lunii, după normă (${u})`,
    stocConstatat: `Stoc la sfârșitul lunii, constatat (${u})`,
    diferenta: `Diferența: constatat − după normă (${u})`,
    valoare: "Valoarea alimentărilor (lei)",
  };
}

export const ETICHETA_NORMA = "Norma proprie de consum";

export function construiesteFoaieParcurs(p: ParametriFoaieParcurs): DocumentTabelar {
  const foaie = construiesteFoaie(p.an, p.luna, [""], 8);
  const ll = String(p.luna).padStart(2, "0");
  const ultima = foaie.zile.length;
  const u = unitatePentru(p.combustibil);
  const randuri = randuriCurse(p);
  const coloane = coloaneCurse(u);
  const etichete = eticheteRezumat(u);
  const valoriRezumat: Readonly<Record<CheieRezumat, string>> = {
    kmInceput: p.kmInitial === null ? "" : numar(p.kmInitial),
    kmSfarsit: "",
    kmTotal: "",
    norma: p.norma === null ? "" : numar(p.norma),
    consumNormat: "",
    stocInceput: p.stocInitial === null ? "" : numar(p.stocInitial),
    alimentat: "",
    stocCalculat: "",
    stocConstatat: "",
    diferenta: "",
    valoare: "",
  };
  const alimentari: TabelSuplimentar = {
    titlu: TITLU_ALIMENTARI,
    coloane: coloaneAlimentari(u),
    randuri: Array.from({ length: RANDURI_ALIMENTARI }, () => ["", "", "", "", "", ""]),
  };
  const rezumat: TabelSuplimentar = {
    titlu: TITLU_REZUMAT,
    coloane: [
      { eticheta: "Indicator", latime: 6 },
      { eticheta: "Valoare", latime: 2 },
    ],
    randuri: CHEI_REZUMAT.map((k) => [etichete[k], valoriRezumat[k]]),
  };

  return {
    titlu: `Foaie de parcurs — ${foaie.eticheta}`,
    subtitlu: null,
    campuri: [
      { eticheta: "Unitatea", valoare: p.firma },
      { eticheta: "CUI", valoare: p.cui },
      { eticheta: "Foaia nr.", valoare: p.nrFoaie },
      {
        eticheta: "Perioada",
        valoare: `01.${ll}.${String(p.an)} – ${String(ultima)}.${ll}.${String(p.an)}`,
      },
      { eticheta: "Nr. de înmatriculare", valoare: p.nrAuto },
      { eticheta: "Marca și modelul", valoare: p.marca },
      {
        eticheta: "Categoria vehiculului",
        valoare: p.categorie === null ? "" : ETICHETE_CATEGORIE[p.categorie],
      },
      {
        eticheta: "Combustibil",
        valoare: p.combustibil === null ? "" : ETICHETE_COMBUSTIBIL[p.combustibil],
      },
      {
        eticheta: ETICHETA_NORMA,
        valoare:
          p.norma === null
            ? ""
            : `${numar(p.norma)} ${u}/100 km (${FORMAT_PE_KM.format(p.norma / 100)} ${u}/km)`,
      },
      {
        eticheta: "Utilizarea vehiculului",
        valoare:
          p.utilizare === null
            ? ""
            : `${ETICHETE_UTILIZARE[p.utilizare]} — ${TEMEI_UTILIZARE[p.utilizare]}`,
      },
      { eticheta: "Conducător auto", valoare: p.sofer },
      { eticheta: "Data întocmirii", valoare: "" },
    ],
    campuriPeDouaColoane: true,
    paragrafe: [],
    coloane,
    randuri: randuri.map((r, i) => {
      const celule = coloane.map(() => "");
      celule[COLOANA.data] = r.data;
      celule[COLOANA.ziua] = r.ziua;
      if (i === 0 && p.kmInitial !== null) celule[COLOANA.kmPlecare] = numar(p.kmInitial);
      return celule;
    }),
    umbrite: [],
    tabeleSuplimentare: [alimentari, rezumat],
    note: [
      `Km parcurși = km la sosire − km la plecare. Consum după normă = km parcurși × norma proprie de consum ÷ 100.`,
      "Foaia cuprinde elementele minime din normele Codului fiscal (HG 1/2016, titlul II pct. 16 alin. (2) și titlul VII pct. 68 alin. (2)): categoria vehiculului, scopul și locul deplasării, kilometrii parcurși și norma proprie de consum.",
    ],
    semnaturi: ["Conducător auto", "Verificat și aprobat (administrator)"],
    orientare: "peisaj",
    numeFisier:
      p.nrAuto === ""
        ? `foaie-de-parcurs-${String(p.an)}-${ll}`
        : `foaie-de-parcurs-${p.nrAuto}-${String(p.an)}-${ll}`,
  };
}

export function foaieParcursDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteFoaieParcurs(parametriFoaieParcurs(q));
}
```

Lățimile coloanelor sunt măsurate pe DejaVu aldin 8 pt, pe A4 culcat (762 pt utili):

| Etichetă | Lățime măsurată |
| --- | --- |
| „normat (kWh)” | 62,6 pt |
| „conducătorului” | 67,6 pt |
| „la plecare” | 44,3 pt |
| „(traseul: de la – la)” | 84,9 pt |
| „Scopul deplasării” | 77,6 pt |

Cu lățimile relative de mai sus, cea mai strânsă coloană lasă 2 pt liberi. Testul „nicio etichetă de coloană nu se taie cu «…»” e paza, iar prima variantă, cu 1,3 și 2, a căzut pe el.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(marketing)/unelte/foaie-de-parcurs" src/lib/unelte src/app/api/unelte
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
pnpm exec prettier --check "src/app/(marketing)/unelte/foaie-de-parcurs/model.ts" "src/app/(marketing)/unelte/foaie-de-parcurs/model.test.ts"
```

Așteptat: 20 de teste în `model.test.ts`, toate verzi. `src/app/(marketing)/unelte/tipar.test.tsx` (B6) și `avize.test.tsx` (B4, B8) rămân verzi, fiindcă pagina din B8 compilează și randează cu modelul nou.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=("src/app/(marketing)/unelte/foaie-de-parcurs/model.ts" "src/app/(marketing)/unelte/foaie-de-parcurs/model.test.ts")
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git commit --only -m "feat(unelte): foaia de parcurs cu cele 4 elemente din normele Codului fiscal

Categoria vehiculului, scopul și locul, km, norma proprie de consum (pe 100 km
și pe km), cu temeiul utilizării (art. 25 alin. (3) lit. l), art. 298).
Antet de document justificativ (unitate, CUI, nr., perioadă, data întocmirii),
1–4 curse pe zi, coloana Ziua, alimentări, rezumatul lunii, avize pentru
valorile lăsate deoparte. Termenii sunt cei din modulul Flotă.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
# lastmod roșu = nu se împinge: se ridică data din harta.ts și se reface commitul (`git commit --amend --only -- src/content/landing/harta.ts`), apoi se reia linia.
node scripts/checks/lastmod.mjs && git merge origin/main && git push origin main
```

---

### Task G6: Excel cu formule, pe ruta statică `/api/unelte/foaie-de-parcurs`

**Fișiere:**
- Create: `src/app/(marketing)/unelte/foaie-de-parcurs/excel.ts`.
- Create (test): `src/app/(marketing)/unelte/foaie-de-parcurs/excel.test.ts`.
- Create: `src/app/api/unelte/foaie-de-parcurs/route.ts`.
- Create (test): `src/app/api/unelte/foaie-de-parcurs/route.test.ts`.
- Modify: `src/lib/unelte/raspuns.ts`, adică `raspunsDocument` în forma din A5 + B2.
- Modify: `src/lib/unelte/registru.ts:3,11-21`.

**Interfețe:**
- Consumă:
  - din `model.ts` (G5): `ParametriFoaieParcurs`, `randuriCurse`, `coloaneAlimentari`, `eticheteRezumat`, `CHEI_REZUMAT`, `COLOANA`, `ETICHETA_NORMA`, `MAX_KM`, `RANDURI_ALIMENTARI`, `TITLU_ALIMENTARI`, `TITLU_REZUMAT`, `unitatePentru`, `construiesteFoaieParcurs`, `parametriFoaieParcurs`;
  - din `document-tabelar.ts`: `adresaDinFisier`, `curataText` (B2), `SEMNATURA_FISIER`, `normalizeazaFormat` (B8: fără majuscule);
  - `ADRESA_SITE` din `@/content/landing/contact` (folosit deja de `xlsx.ts:3`);
  - `ANTET_CACHE_DESCARCARE` (A5);
  - `exceljs`: `calcProperties.fullCalcOnLoad` (`index.d.ts:1389,1725`), `mergeCells(top, left, bottom, right)` (`:1296`), `pageSetup.printTitlesRow` (`:821`), `DataValidation` (`:308`).
- Produce:

```ts
export async function randeazaFoaieParcursXlsx(p: ParametriFoaieParcurs, d: DocumentTabelar): Promise<Uint8Array>;
export function raspunsFisier(continut: Uint8Array, numeFisier: string, format: Format): Response;
export async function GET(cerere: NextRequest): Promise<Response>; // ruta statică
```

- [ ] **Pasul 1: Scrie testele care pică.** Creează `src/app/(marketing)/unelte/foaie-de-parcurs/excel.test.ts`:

```ts
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { randeazaFoaieParcursXlsx } from "./excel";
import {
  CHEI_REZUMAT,
  coloaneAlimentari,
  coloaneCurse,
  construiesteFoaieParcurs,
  eticheteRezumat,
  RANDURI_ALIMENTARI,
  TITLU_ALIMENTARI,
  TITLU_REZUMAT,
  type ParametriFoaieParcurs,
} from "./model";

/**
 * Auditul din 8 oct 2026: Excel-ul foii de parcurs avea ZERO formule. Testele
 * citesc fișierul înapoi și rezolvă fiecare referință după ETICHETA coloanei,
 * nu după literă: o coloană mutată în model nu poate lăsa o formulă să adune
 * altceva decât spune antetul.
 */
const P: ParametriFoaieParcurs = {
  an: 2026,
  luna: 10,
  nrAuto: "B-123-ABC",
  marca: "Dacia Logan",
  sofer: "Radu Andrei",
  firma: "Construct SRL",
  cui: "RO12345678",
  nrFoaie: "17",
  categorie: "autoturism",
  combustibil: "motorina",
  utilizare: "agent",
  norma: 6.5,
  kmInitial: 125_000,
  stocInitial: 20,
  cursePeZi: 2,
};

async function deschide(p: ParametriFoaieParcurs) {
  const octeti = await randeazaFoaieParcursXlsx(p, construiesteFoaieParcurs(p));
  const registru = new ExcelJS.Workbook();
  // O copie cu `ArrayBuffer` propriu: tipul cerut de `xlsx.load`.
  await registru.xlsx.load(new Uint8Array(octeti).buffer);
  const fila = registru.getWorksheet("Foaie de parcurs");
  if (fila === undefined) throw new Error("Lipsește fila „Foaie de parcurs”.");
  return { fila, octeti };
}

const text = (c: ExcelJS.Cell) => (typeof c.value === "string" ? c.value : "");

/** Primul rând a cărui primă celulă are exact textul dat. */
function randul(fila: ExcelJS.Worksheet, prima: string): ExcelJS.Row {
  for (let r = 1; r <= fila.rowCount; r += 1) {
    if (text(fila.getRow(r).getCell(1)) === prima) return fila.getRow(r);
  }
  throw new Error(`Niciun rând nu începe cu „${prima}”.`);
}

/** Litera coloanei cu eticheta dată, pe rândul de antet. */
function litera(antet: ExcelJS.Row, eticheta: string): string {
  for (let c = 1; c <= 11; c += 1) {
    if (text(antet.getCell(c)) === eticheta) return antet.getCell(c).address.replace(/\d+/u, "");
  }
  throw new Error(`Lipsește coloana „${eticheta}”.`);
}

const formula = (c: ExcelJS.Cell) => c.formula ?? "";

describe("Excel-ul foii de parcurs", { timeout: 30_000 }, () => {
  it("antetul tabelului e cel din model, în aceeași ordine", async () => {
    const { fila } = await deschide(P);
    const antet = randul(fila, "Data");
    const etichete = Array.from({ length: 11 }, (_, i) => text(antet.getCell(i + 1)));
    expect(etichete).toEqual(coloaneCurse("l").map((c) => c.eticheta));
  });

  it("norma e număr în antet, iar fiecare cursă are km = sosire − plecare și consum = km × normă ÷ 100", async () => {
    const { fila } = await deschide(P);
    const randNorma = randul(fila, "Norma proprie de consum (l/100 km):");
    expect(randNorma.getCell(5).value).toBe(6.5);
    const N = `$E$${String(randNorma.number)}`;
    const antet = randul(fila, "Data");
    const G = litera(antet, "Km bord\nla plecare");
    const H = litera(antet, "Km bord\nla sosire");
    const I = litera(antet, "Km\nparcurși");
    const J = litera(antet, "Consum\nnormat (l)");
    const curse = 31 * 2;
    for (let k = 1; k <= curse; k += 1) {
      const r = antet.number + k;
      const rand = fila.getRow(r);
      expect(formula(fila.getCell(`${I}${String(r)}`))).toBe(
        `IF(AND(ISNUMBER(${G}${String(r)}),ISNUMBER(${H}${String(r)})),${H}${String(r)}-${G}${String(r)},"")`,
      );
      expect(formula(fila.getCell(`${J}${String(r)}`))).toBe(
        `IF(AND(ISNUMBER(${I}${String(r)}),ISNUMBER(${N})),ROUND(${I}${String(r)}*${N}/100,2),"")`,
      );
      expect(rand.getCell(1).value).toBeInstanceOf(Date);
    }
    expect(text(fila.getRow(antet.number + curse + 1).getCell(1))).toBe("Total lună");
  });

  it("data e dată adevărată, kilometrajul inițial e pe prima cursă, weekendul e umbrit", async () => {
    const { fila } = await deschide(P);
    const antet = randul(fila, "Data");
    const prima = fila.getRow(antet.number + 1);
    expect((prima.getCell(1).value as Date).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(prima.getCell(1).numFmt).toBe("dd.mm.yyyy");
    expect(prima.getCell(7).value).toBe(125_000);
    expect(fila.getRow(antet.number + 3).getCell(7).value).toBeNull();
    // 3 octombrie 2026 e sâmbătă: rândurile 5 și 6 (două curse pe zi).
    const sambata = fila.getRow(antet.number + 5);
    expect(text(sambata.getCell(2))).toBe("Sâ");
    expect(sambata.getCell(5).fill).toMatchObject({
      fgColor: { argb: "FFE6E9E6" },
    });
  });

  it("km la sosire nu se pot scrie mai puțini decât km la plecare", async () => {
    // Citit din XML, nu prin ExcelJS: la citire, ExcelJS transformă formula
    // validării „whole” în număr (NaN). Scrisă, e corectă.
    const { fila, octeti } = await deschide(P);
    const antet = randul(fila, "Data");
    const r = String(antet.number + 1);
    const G = litera(antet, "Km bord\nla plecare");
    const H = litera(antet, "Km bord\nla sosire");
    const zip = await JSZip.loadAsync(octeti);
    const foaie = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
    expect(foaie).toMatch(
      new RegExp(
        `<dataValidation type="whole" operator="greaterThanOrEqual" [^>]*showErrorMessage="1"[^>]*sqref="${H}${r}"><formula1>${G}${r}</formula1>`,
        "u",
      ),
    );
  });

  it("totalul lunii adună exact cursele, nici mai mult, nici mai puțin", async () => {
    const { fila } = await deschide(P);
    const antet = randul(fila, "Data");
    const I = litera(antet, "Km\nparcurși");
    const total = randul(fila, "Total lună");
    const prima = antet.number + 1;
    const ultima = total.number - 1;
    expect(ultima - prima + 1).toBe(62);
    expect(formula(fila.getCell(`${I}${String(total.number)}`))).toBe(
      `SUM(${I}${String(prima)}:${I}${String(ultima)})`,
    );
  });

  it("alimentările: antetul din model, 8 rânduri și totalurile pe cantitate și valoare", async () => {
    const { fila } = await deschide(P);
    const titlu = randul(fila, TITLU_ALIMENTARI);
    const antet = fila.getRow(titlu.number + 1);
    expect([1, 2, 5, 6, 7, 9].map((c) => text(antet.getCell(c)))).toEqual(
      coloaneAlimentari("l").map((c) => c.eticheta),
    );
    const total = fila.getRow(antet.number + RANDURI_ALIMENTARI + 1);
    expect(text(total.getCell(1))).toBe("Total");
    const prima = String(antet.number + 1);
    const ultima = String(antet.number + RANDURI_ALIMENTARI);
    expect(formula(total.getCell(6))).toBe(`SUM(F${prima}:F${ultima})`);
    expect(formula(total.getCell(7))).toBe(`SUM(G${prima}:G${ultima})`);
  });

  it("rezumatul: etichetele din model și stocul după normă = început + alimentat − consum", async () => {
    const { fila } = await deschide(P);
    const titlu = randul(fila, TITLU_REZUMAT);
    const etichete = eticheteRezumat("l");
    const adresa = (k: (typeof CHEI_REZUMAT)[number]) =>
      `E${String(titlu.number + 1 + CHEI_REZUMAT.indexOf(k))}`;
    CHEI_REZUMAT.forEach((k, i) => {
      expect(text(fila.getRow(titlu.number + 1 + i).getCell(1))).toBe(etichete[k]);
    });
    expect(fila.getCell(adresa("kmInceput")).value).toBe(125_000);
    expect(fila.getCell(adresa("stocInceput")).value).toBe(20);
    expect(formula(fila.getCell(adresa("stocCalculat")))).toBe(
      `IF(AND(ISNUMBER(${adresa("stocInceput")}),ISNUMBER(${adresa("consumNormat")})),ROUND(${adresa("stocInceput")}+${adresa("alimentat")}-${adresa("consumNormat")},2),"")`,
    );
    expect(formula(fila.getCell(adresa("diferenta")))).toBe(
      `IF(AND(ISNUMBER(${adresa("stocConstatat")}),ISNUMBER(${adresa("stocCalculat")})),ROUND(${adresa("stocConstatat")}-${adresa("stocCalculat")},2),"")`,
    );
    const totalLuna = randul(fila, "Total lună").number;
    expect(formula(fila.getCell(adresa("kmTotal")))).toMatch(
      new RegExp(`^I${String(totalLuna)}$`, "u"),
    );
  });

  it("fără normă: celula rămâne goală de completat, formulele rămân", async () => {
    const { fila } = await deschide({
      ...P,
      norma: null,
      kmInitial: null,
      stocInitial: null,
    });
    const randNorma = randul(fila, "Norma proprie de consum (l/100 km):");
    expect(randNorma.getCell(5).value).toBeNull();
    const antet = randul(fila, "Data");
    expect(formula(fila.getRow(antet.number + 1).getCell(10))).toContain(
      `$E$${String(randNorma.number)}`,
    );
  });

  it("se recalculează la deschidere și are destule formule", async () => {
    const { octeti } = await deschide(P);
    const zip = await JSZip.loadAsync(octeti);
    const registru = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
    expect(registru).toMatch(/fullCalcOnLoad="1"/u);
    // Antetul tabelului se repetă la tipar; pe ecran nu se îngheață nimic.
    expect(registru).toMatch(/_xlnm\.Print_Titles/u);
    const foaie = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
    // 62 de curse × 2 + 2 totaluri de curse + 2 de alimentări + 8 în rezumat.
    expect(foaie.match(/<f>/gu)?.length).toBe(62 * 2 + 2 + 2 + 8);
    expect(foaie).not.toMatch(/<pane /u);
  });

  it("la electric, coloana de consum și norma sunt în kWh", async () => {
    const { fila } = await deschide({
      ...P,
      combustibil: "electric",
      norma: 16,
    });
    expect(randul(fila, "Norma proprie de consum (kWh/100 km):").getCell(5).value).toBe(16);
    litera(randul(fila, "Data"), "Consum\nnormat (kWh)");
  });
});
```

Creează `src/app/api/unelte/foaie-de-parcurs/route.test.ts`:

```ts
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { constructorPentru } from "@/lib/unelte/registru";

import { GET } from "./route";

const cere = (interogare: string) =>
  GET(new NextRequest(`http://localhost/api/unelte/foaie-de-parcurs?${interogare}`));

const COMPLET =
  "an=2026&luna=10&auto=B-123-ABC&marca=Dacia&sofer=Radu+Andrei&firma=Construct+SRL&cui=RO123&nr=17&categorie=autoturism&combustibil=motorina&utilizare=agent&norma=6,5&km=125000&stoc=20&curse=2";

// Generarea PDF-ului cu 62 de curse durează ~1 s singură și peste 5 s sub `pnpm test`
// (toate fișierele în paralel): plafonul implicit de 5 s o făcea instabilă.
describe("ruta foii de parcurs", { timeout: 30_000 }, () => {
  it("Excel-ul are formule, numele mașinii în fișier și cache privat", async () => {
    const r = await cere(`${COMPLET}&format=xlsx`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="foaie-de-parcurs-b-123-abc-2026-10.xlsx"',
    );
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const foaie = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
    expect(foaie.match(/<f>/gu)?.length ?? 0).toBeGreaterThan(100);
  });

  it("PDF-ul și Word-ul trec prin modelul comun, cu categoria vehiculului", async () => {
    const pdf = await cere(`${COMPLET}&format=pdf`);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("cache-control")).toBe("private, no-store");
    const docx = await cere(`${COMPLET}&format=docx`);
    const zip = await JSZip.loadAsync(await docx.arrayBuffer());
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Categoria vehiculului: Autoturism");
    expect(xml).toContain("Alimentări cu combustibil");
  });

  it("fără format dă PDF, ca linkurile vechi", async () => {
    expect((await cere("an=2026&luna=10")).headers.get("content-type")).toBe("application/pdf");
  });

  it("caracterele de control nu ajung în Excel", async () => {
    const r = await cere("an=2026&luna=10&sofer=Popa%00%01%0BIon&format=xlsx");
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const siruri = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    expect(siruri).toContain("Popa Ion");
    expect(siruri).not.toMatch(/[\u0000-\u0008\u000B\u000C]/u);
  });

  it("ruta comună nu mai servește foaia de parcurs: o servește ruta statică", () => {
    expect(constructorPentru("foaie-de-parcurs")).toBeUndefined();
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(marketing)/unelte/foaie-de-parcurs/excel.test.ts" src/app/api/unelte/foaie-de-parcurs/route.test.ts
```

Așteptat: amândouă fișierele cad la import:
- `Error: Cannot find module './excel' imported from …/excel.test.ts`;
- `Error: Cannot find module './route' imported from …/route.test.ts`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `src/app/(marketing)/unelte/foaie-de-parcurs/excel.ts`:

```ts
import ExcelJS from "exceljs";

import { ADRESA_SITE } from "@/content/landing/contact";
import {
  adresaDinFisier,
  curataText,
  SEMNATURA_FISIER,
  type DocumentTabelar,
} from "@/lib/unelte/document-tabelar";

import {
  CHEI_REZUMAT,
  COLOANA,
  coloaneAlimentari,
  ETICHETA_NORMA,
  eticheteRezumat,
  MAX_KM,
  RANDURI_ALIMENTARI,
  randuriCurse,
  TITLU_ALIMENTARI,
  TITLU_REZUMAT,
  unitatePentru,
  type CheieRezumat,
  type ParametriFoaieParcurs,
} from "./model";

/**
 * Foaia de parcurs în Excel, cu FORMULE.
 *
 * ── DE CE NU RANDAREA COMUNĂ ──────────────────────────────────────────────
 * `randeazaXlsx` scrie text: auditul din 8 oct 2026 a numărat zero formule în
 * fișier, iar „Total km parcurși: ________” se aduna de mână. Cine alege Excel
 * îl alege tocmai pentru calcul. Aici:
 * - km parcurși = km la sosire − km la plecare, pe fiecare cursă;
 * - consumul după normă = km parcurși × normă ÷ 100, cu norma dintr-o SINGURĂ
 *   celulă a antetului (schimbată acolo, se recalculează toată foaia);
 * - totalurile lunii, alimentările, stocul după normă și diferența față de
 *   stocul constatat la bord — cifra care arată dacă norma ține.
 *
 * Etichetele, coloanele și ordinea vin din `model.ts`, aceleași ca în PDF, Word
 * și previzualizare; aici se adaugă doar formulele, formatele și validările.
 *
 * Celulele cu formulă sunt gri: „nu scrie aici”. Fișierul nu e protejat cu
 * parolă — o foaie pe care contabilul n-o poate corecta e mai rea decât una
 * pe care o poate strica.
 */

const GRI_FORMULA = "FFF2F4F2";
const GRI_WEEKEND = "FFE6E9E6";
const CHENAR: Partial<ExcelJS.Borders> = {
  top: { style: "hair" },
  left: { style: "hair" },
  bottom: { style: "hair" },
  right: { style: "hair" },
};

/** Lățimile în „caractere” ale ExcelJS, alese ca foaia să încapă pe A4 lat. */
const LATIMI = [11, 5, 7, 7, 30, 24, 10, 10, 9, 9, 13] as const;

export async function randeazaFoaieParcursXlsx(
  p: ParametriFoaieParcurs,
  d: DocumentTabelar,
): Promise<Uint8Array> {
  const t = curataText;
  const u = unitatePentru(p.combustibil);
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  registru.title = t(d.titlu);
  // Formulele se recalculează la deschidere: ExcelJS nu le evaluează, deci
  // fișierul nu poartă valori calculate în cache.
  registru.calcProperties.fullCalcOnLoad = true;
  const fila = registru.addWorksheet("Foaie de parcurs", {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  fila.columns = LATIMI.map((width) => ({ width }));
  const litera = (indice: number) => fila.getColumn(indice + 1).letter;
  const gri = (celula: ExcelJS.Cell) => {
    celula.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: GRI_FORMULA },
    };
  };

  const titlu = fila.addRow([t(d.titlu)]);
  titlu.font = { bold: true, size: 13 };

  // Antetul: eticheta pe A:D, valoarea pe E:K. Norma e NUMĂR, nu text: toate
  // formulele de consum citesc celula ei.
  let celulaNorma = "";
  for (const c of d.campuri) {
    const rand = fila.addRow([`${t(c.eticheta)}:`]);
    fila.mergeCells(rand.number, 1, rand.number, 4);
    fila.mergeCells(rand.number, 5, rand.number, 11);
    const valoare = rand.getCell(5);
    if (c.eticheta === ETICHETA_NORMA) {
      rand.getCell(1).value = `${ETICHETA_NORMA} (${u}/100 km):`;
      valoare.value = p.norma;
      valoare.numFmt = "0.0##";
      valoare.alignment = { horizontal: "left" };
      celulaNorma = `$E$${String(rand.number)}`;
    } else {
      valoare.value = t(c.valoare);
    }
    valoare.border = { bottom: { style: "hair" } };
  }
  if (celulaNorma === "") {
    // Fără celula normei, fiecare formulă de consum ar trimite la nimic.
    throw new Error("Foaia de parcurs n-are rubrica normei de consum.");
  }
  fila.addRow([]);

  // ── Cursele ──────────────────────────────────────────────────────────────
  const antet = fila.addRow(d.coloane.map((c) => t(c.eticheta)));
  antet.font = { bold: true };
  antet.alignment = { wrapText: true, vertical: "top" };
  antet.eachCell((celula) => {
    celula.border = CHENAR;
  });
  // Antetul tabelului se repetă pe fiecare pagină TIPĂRITĂ. Nu se îngheață pe
  // ecran: cu cele 13 rânduri ale antetului de document deasupra, ar fi rămas
  // fixă jumătate din fereastră.
  fila.pageSetup.printTitlesRow = `${String(antet.number)}:${String(antet.number)}`;

  const L = {
    kmPlecare: litera(COLOANA.kmPlecare),
    kmSosire: litera(COLOANA.kmSosire),
    km: litera(COLOANA.km),
    consum: litera(COLOANA.consum),
  };
  const curse = randuriCurse(p);
  const primaCursa = antet.number + 1;
  curse.forEach((c, i) => {
    const rand = fila.addRow([]);
    const r = String(rand.number);
    rand.getCell(COLOANA.data + 1).value = new Date(Date.UTC(p.an, p.luna - 1, c.zi));
    rand.getCell(COLOANA.data + 1).numFmt = "dd.mm.yyyy";
    rand.getCell(COLOANA.ziua + 1).value = c.ziua;
    const plecare = rand.getCell(COLOANA.kmPlecare + 1);
    const sosire = rand.getCell(COLOANA.kmSosire + 1);
    if (i === 0 && p.kmInitial !== null) plecare.value = p.kmInitial;
    for (const celula of [plecare, sosire]) celula.numFmt = "#,##0";
    // Kilometrajul de bord crește: un „125.000” scris „12.500” la sosire e
    // refuzat pe loc, nu descoperit la sfârșitul lunii.
    plecare.dataValidation = {
      type: "whole",
      operator: "between",
      formulae: [0, MAX_KM],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Kilometraj",
      error: "Kilometrajul de bord se scrie în km întregi.",
    };
    sosire.dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: [`${L.kmPlecare}${r}`],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Kilometraj",
      error: "Km la sosire nu pot fi mai puțini decât km la plecare.",
    };
    const km = rand.getCell(COLOANA.km + 1);
    km.value = {
      formula: `IF(AND(ISNUMBER(${L.kmPlecare}${r}),ISNUMBER(${L.kmSosire}${r})),${L.kmSosire}${r}-${L.kmPlecare}${r},"")`,
    };
    km.numFmt = "#,##0";
    const consum = rand.getCell(COLOANA.consum + 1);
    consum.value = {
      formula: `IF(AND(ISNUMBER(${L.km}${r}),ISNUMBER(${celulaNorma})),ROUND(${L.km}${r}*${celulaNorma}/100,2),"")`,
    };
    consum.numFmt = "0.00";
    d.coloane.forEach((_, j) => {
      const celula = rand.getCell(j + 1);
      celula.border = CHENAR;
      if (c.weekend) {
        celula.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: GRI_WEEKEND },
        };
      }
    });
    gri(km);
    gri(consum);
  });
  const ultimaCursa = fila.rowCount;

  const total = fila.addRow(["Total lună"]);
  total.font = { bold: true };
  const intervalKm = `${L.km}${String(primaCursa)}:${L.km}${String(ultimaCursa)}`;
  const intervalConsum = `${L.consum}${String(primaCursa)}:${L.consum}${String(ultimaCursa)}`;
  const intervalSosire = `${L.kmSosire}${String(primaCursa)}:${L.kmSosire}${String(ultimaCursa)}`;
  total.getCell(COLOANA.km + 1).value = { formula: `SUM(${intervalKm})` };
  total.getCell(COLOANA.km + 1).numFmt = "#,##0";
  total.getCell(COLOANA.consum + 1).value = {
    formula: `IF(ISNUMBER(${celulaNorma}),SUM(${intervalConsum}),"")`,
  };
  total.getCell(COLOANA.consum + 1).numFmt = "0.00";
  gri(total.getCell(COLOANA.km + 1));
  gri(total.getCell(COLOANA.consum + 1));
  const totalKm = `${L.km}${String(total.number)}`;
  const totalConsum = `${L.consum}${String(total.number)}`;

  // ── Alimentările: Data | Nr. bon (B:D) | Stația (E) | Cantitate (F) | Valoare (G:H) | Semnătura (I:K)
  fila.addRow([]);
  fila.addRow([TITLU_ALIMENTARI]).font = { bold: true };
  const ca = coloaneAlimentari(u).map((c) => t(c.eticheta));
  const pozitii: readonly (readonly [number, number])[] = [
    [1, 1],
    [2, 4],
    [5, 5],
    [6, 6],
    [7, 8],
    [9, 11],
  ];
  const randAlimentare = (valori: readonly string[]) => {
    const rand = fila.addRow([]);
    pozitii.forEach(([de, pana], k) => {
      if (pana > de) fila.mergeCells(rand.number, de, rand.number, pana);
      rand.getCell(de).value = valori[k] ?? null;
      for (let j = de; j <= pana; j += 1) rand.getCell(j).border = CHENAR;
    });
    return rand;
  };
  const antetAlimentari = randAlimentare(ca);
  antetAlimentari.font = { bold: true };
  antetAlimentari.alignment = { wrapText: true, vertical: "top" };
  const primaAlimentare = antetAlimentari.number + 1;
  for (let i = 0; i < RANDURI_ALIMENTARI; i += 1) {
    const rand = randAlimentare([]);
    rand.getCell(1).numFmt = "dd.mm.yyyy";
    rand.getCell(6).numFmt = "0.00";
    rand.getCell(7).numFmt = "#,##0.00";
  }
  const ultimaAlimentare = fila.rowCount;
  const totalAlimentari = randAlimentare(["Total"]);
  totalAlimentari.font = { bold: true };
  totalAlimentari.getCell(6).value = {
    formula: `SUM(F${String(primaAlimentare)}:F${String(ultimaAlimentare)})`,
  };
  totalAlimentari.getCell(6).numFmt = "0.00";
  totalAlimentari.getCell(7).value = {
    formula: `SUM(G${String(primaAlimentare)}:G${String(ultimaAlimentare)})`,
  };
  totalAlimentari.getCell(7).numFmt = "#,##0.00";
  gri(totalAlimentari.getCell(6));
  gri(totalAlimentari.getCell(7));
  const alimentat = `F${String(totalAlimentari.number)}`;
  const valoareAlimentari = `G${String(totalAlimentari.number)}`;

  // ── Rezumatul: eticheta pe A:D, valoarea în E ────────────────────────────
  fila.addRow([]);
  fila.addRow([TITLU_REZUMAT]).font = { bold: true };
  const etichete = eticheteRezumat(u);
  const primulRezumat = fila.rowCount + 1;
  const adresa = (k: CheieRezumat) => `E${String(primulRezumat + CHEI_REZUMAT.indexOf(k))}`;
  const formule: Readonly<Record<CheieRezumat, ExcelJS.CellValue>> = {
    kmInceput: p.kmInitial,
    kmSfarsit: {
      formula: `IF(COUNT(${intervalSosire})=0,"",MAX(${intervalSosire}))`,
    },
    kmTotal: { formula: totalKm },
    norma: { formula: `IF(ISNUMBER(${celulaNorma}),${celulaNorma},"")` },
    consumNormat: { formula: totalConsum },
    stocInceput: p.stocInitial,
    alimentat: { formula: alimentat },
    stocCalculat: {
      formula: `IF(AND(ISNUMBER(${adresa("stocInceput")}),ISNUMBER(${adresa("consumNormat")})),ROUND(${adresa("stocInceput")}+${adresa("alimentat")}-${adresa("consumNormat")},2),"")`,
    },
    stocConstatat: null,
    diferenta: {
      formula: `IF(AND(ISNUMBER(${adresa("stocConstatat")}),ISNUMBER(${adresa("stocCalculat")})),ROUND(${adresa("stocConstatat")}-${adresa("stocCalculat")},2),"")`,
    },
    valoare: { formula: valoareAlimentari },
  };
  const deCompletat: ReadonlySet<CheieRezumat> = new Set([
    "kmInceput",
    "stocInceput",
    "stocConstatat",
  ]);
  for (const k of CHEI_REZUMAT) {
    const rand = fila.addRow([t(etichete[k])]);
    fila.mergeCells(rand.number, 1, rand.number, 4);
    const celula = rand.getCell(5);
    celula.value = formule[k];
    celula.numFmt = k === "kmInceput" || k === "kmSfarsit" || k === "kmTotal" ? "#,##0" : "0.00";
    for (let j = 1; j <= 5; j += 1) rand.getCell(j).border = CHENAR;
    if (!deCompletat.has(k)) gri(celula);
  }

  fila.addRow([]);
  for (const n of d.note) {
    const rand = fila.addRow([t(n)]);
    fila.mergeCells(rand.number, 1, rand.number, 11);
    rand.getCell(1).alignment = { wrapText: true, vertical: "top" };
    rand.height = 28;
  }
  fila.addRow([]);
  const semnaturi = fila.addRow([]);
  d.semnaturi.forEach((s, i) => {
    semnaturi.getCell(i === 0 ? 1 : 7).value = `${t(s)}: ______________`;
  });
  const legatura = fila.addRow([
    {
      text: SEMNATURA_FISIER,
      hyperlink: adresaDinFisier(d, "xlsx", ADRESA_SITE),
    },
  ]);
  legatura.getCell(1).font = { color: { argb: "FF6B7280" }, underline: true };

  return new Uint8Array(await registru.xlsx.writeBuffer());
}
```

Creează `src/app/api/unelte/foaie-de-parcurs/route.ts`:

```ts
import type { NextRequest } from "next/server";

import { randeazaFoaieParcursXlsx } from "@/app/(marketing)/unelte/foaie-de-parcurs/excel";
import {
  construiesteFoaieParcurs,
  parametriFoaieParcurs,
} from "@/app/(marketing)/unelte/foaie-de-parcurs/model";
import { normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { raspunsDocument, raspunsFisier } from "@/lib/unelte/raspuns";

/**
 * Descărcarea foii de parcurs: `/api/unelte/foaie-de-parcurs?format=pdf|docx|xlsx&…`.
 *
 * Rută statică, ca foaia de pontaj, fiindcă Excel-ul are randarea lui, cu
 * formule (`excel.ts`); PDF-ul și Word-ul trec prin modelul comun. Ruta statică
 * are prioritate față de `[unealta]`, deci adresa rămâne aceeași ca până acum.
 *
 * Fără sesiune și fără bază: intrările sunt parametri normalizați cu limite în
 * `model.ts`, iar generarea e mărginită prin construcție (cel mult 31 × 4 curse).
 * Implicitul rămâne PDF, ca înainte: linkurile vechi fără `format` dau același
 * tip de fișier.
 */
export const dynamic = "force-dynamic";

export async function GET(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  const p = parametriFoaieParcurs(q);
  const d = { ...construiesteFoaieParcurs(p), sursa: "/unelte/foaie-de-parcurs" };
  const format = normalizeazaFormat(q.get("format"));
  if (format !== "xlsx") return raspunsDocument(d, format);
  return raspunsFisier(await randeazaFoaieParcursXlsx(p, d), d.numeFisier, "xlsx");
}
```

În `src/lib/unelte/raspuns.ts` (forma din A5 + B2) înlocuiește:

```ts
/**
 * Fișierul ca răspuns de descărcare. `new Uint8Array(...)` copiază într-un
 * `ArrayBuffer` propriu: tipurile din `lib.dom` nu acceptă ca `BodyInit` un
 * `Uint8Array<ArrayBufferLike>`, iar `Buffer`-ul din `docx` e exact asta.
 */
export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response> {
  // Punctul unic de curățare pentru toate uneltele și toate formatele: vezi `curataText`.
  const continut = await RANDARI[format](curataDocument(d));
  return new Response(new Uint8Array(continut), {
    headers: {
      "content-type": TIP[format],
      "content-disposition": `attachment; filename="${numeFisierSigur(d.numeFisier)}.${format}"`,
      "cache-control": ANTET_CACHE_DESCARCARE,
    },
  });
}
```

cu:

```ts
/**
 * Octeții unui fișier deja randat, ca răspuns de descărcare: tipul, numele ASCII,
 * atașamentul și cache-ul, aceleași pentru orice unealtă. Îl folosesc și rutele
 * cu randare proprie (Excel-ul pe formule al foii de parcurs), ca antetele să nu
 * aibă o a doua copie.
 *
 * `new Uint8Array(...)` copiază într-un `ArrayBuffer` propriu: tipurile din
 * `lib.dom` nu acceptă ca `BodyInit` un `Uint8Array<ArrayBufferLike>`, iar
 * `Buffer`-ul din `docx` e exact asta.
 */
export function raspunsFisier(continut: Uint8Array, numeFisier: string, format: Format): Response {
  return new Response(new Uint8Array(continut), {
    headers: {
      "content-type": TIP[format],
      "content-disposition": `attachment; filename="${numeFisierSigur(numeFisier)}.${format}"`,
      "cache-control": ANTET_CACHE_DESCARCARE,
    },
  });
}

/** Documentul comun, randat în formatul cerut, ca răspuns de descărcare. */
export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response> {
  // Punctul unic de curățare pentru toate uneltele și toate formatele: vezi `curataText`.
  return raspunsFisier(await RANDARI[format](curataDocument(d)), d.numeFisier, format);
}
```

Dacă docblock-ul lui `raspunsDocument` a fost reformulat între timp de A5 sau B2, se înlocuiește funcția întreagă, de la docblock la acolada de închidere. Semnătura și cele trei antete trebuie să rămână identice; `randari.test.ts` le verifică.

În `src/lib/unelte/registru.ts` șterge linia:

```ts
import { foaieParcursDinParametri } from "@/app/(marketing)/unelte/foaie-de-parcurs/model";
```

și înlocuiește:

```ts
/**
 * Uneltele servite de `/api/unelte/[unealta]`. Foaia de pontaj NU e aici: are
 * ruta ei statică, cu Excel pe formule, iar ruta statică are prioritate.
 */
export const UNELTE: Readonly<Record<string, Constructor>> = {
  "fisa-evaluare": fisaEvaluareDinParametri,
  "fisa-instruire-ssm": fisaSsmDinParametri,
  "foaie-de-parcurs": foaieParcursDinParametri,
  "cerere-concediu": cerereDinParametri,
  "condica-de-prezenta": condicaDinParametri,
};
```

cu:

```ts
/**
 * Uneltele servite de `/api/unelte/[unealta]`. Foaia de pontaj și foaia de
 * parcurs NU sunt aici: au rutele lor statice, cu Excel pe formule, iar ruta
 * statică are prioritate.
 */
export const UNELTE: Readonly<Record<string, Constructor>> = {
  "fisa-evaluare": fisaEvaluareDinParametri,
  "fisa-instruire-ssm": fisaSsmDinParametri,
  "cerere-concediu": cerereDinParametri,
  "condica-de-prezenta": condicaDinParametri,
};
```

Dacă B a adăugat între timp și aliasul `cerere-concediu-de-odihna` în registru (auditul transversal îl propune), acesta rămâne; se scoate doar rândul `"foaie-de-parcurs"`.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(marketing)/unelte/foaie-de-parcurs" src/app/api/unelte src/lib/unelte
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
pnpm exec prettier --check "src/app/(marketing)/unelte/foaie-de-parcurs/excel.ts" "src/app/(marketing)/unelte/foaie-de-parcurs/excel.test.ts" src/app/api/unelte/foaie-de-parcurs/route.ts src/app/api/unelte/foaie-de-parcurs/route.test.ts src/lib/unelte/raspuns.ts src/lib/unelte/registru.ts
```

Așteptat:
- `excel.test.ts`: 10 teste; `route.test.ts`: 5;
- `randari.test.ts`, `[unealta]/route.test.ts`, `foaie-de-pontaj/route.test.ts` rămân verzi;
- paza A5 („nicio rută de unealtă nu mai declară cache public”) găsește acum 3 rute și niciuna `public`.

- [ ] **Pasul 5: Formulele chiar calculează.** Testele verifică referințele, nu valorile, fiindcă ExcelJS nu evaluează. Se evaluează cu biblioteca Python `formulas`, într-un mediu din scratchpad:

```bash
python3 -m venv "$SCRATCH/venv" && "$SCRATCH/venv/bin/pip" install -q formulas==1.3.4 openpyxl==3.1.5
cd /srv/apps/ERP && cat > "src/app/(marketing)/unelte/foaie-de-parcurs/sonda-g6.test.ts" <<'EOF'
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { randeazaFoaieParcursXlsx } from "./excel";
import { construiesteFoaieParcurs, parametriFoaieParcurs } from "./model";
it("sonda", { timeout: 60_000 }, async () => {
  const p = parametriFoaieParcurs(
    new URLSearchParams({ an: "2026", luna: "10", combustibil: "electric", norma: "16", km: "125000", stoc: "40", curse: "2" }),
  );
  writeFileSync(`${process.env.SCRATCH}/agent.xlsx`, await randeazaFoaieParcursXlsx(p, construiesteFoaieParcurs(p)));
});
EOF
SCRATCH="$SCRATCH" pnpm exec vitest run --project unit "src/app/(marketing)/unelte/foaie-de-parcurs/sonda-g6.test.ts"; rm "src/app/(marketing)/unelte/foaie-de-parcurs/sonda-g6.test.ts"
```

Scriptul `$SCRATCH/eval.py`:

```python
import sys, openpyxl, formulas
src, dst = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src)
ws = wb["Foaie de parcurs"]
# găsește antetul și rândurile
hdr = next(r for r in range(1, ws.max_row+1) if ws.cell(r,1).value == "Data")
r1 = hdr + 1
# cursa 1: 125000 -> 125180 ; cursa 2: 125180 -> 125260 ; cursa 4 (ziua 2): 125260 -> 125300
ws.cell(r1,8).value = 125180
ws.cell(r1+1,7).value = 125180; ws.cell(r1+1,8).value = 125260
ws.cell(r1+3,7).value = 125260; ws.cell(r1+3,8).value = 125300
al = next(r for r in range(1, ws.max_row+1) if ws.cell(r,1).value == "Alimentări cu combustibil") + 2
ws.cell(al,6).value = 30; ws.cell(al,7).value = 210.5
ws.cell(al+1,6).value = 10; ws.cell(al+1,7).value = 70
rz = next(r for r in range(1, ws.max_row+1) if ws.cell(r,1).value == "Rezumatul lunii") + 1
ws.cell(rz+8,5).value = 35  # stoc constatat
wb.save(dst)
xl = formulas.ExcelModel().loads(dst).finish()
sol = xl.calculate()
def v(addr):
    for k, val in sol.items():
        if k.upper().endswith("!" + addr):
            x = val.value[0][0] if hasattr(val, "value") else val
            return x
    return None
print("km cursa1", v(f"I{r1}"), "consum", v(f"J{r1}"))
print("km cursa2", v(f"I{r1+1}"), "cursa3 (goală)", v(f"I{r1+2}"))
tot = next(r for r in range(1, ws.max_row+1) if ws.cell(r,1).value == "Total lună")
print("total km", v(f"I{tot}"), "total consum", v(f"J{tot}"))
for i,k in enumerate(["kmInceput","kmSfarsit","kmTotal","norma","consumNormat","stocInceput","alimentat","stocCalculat","stocConstatat","diferenta","valoare"]):
    print(k, v(f"E{rz+i}"))
```

```bash
mkdir -p "$SCRATCH/evaluare" && "$SCRATCH/venv/bin/python" -I "$SCRATCH/eval.py" "$SCRATCH/agent.xlsx" "$SCRATCH/evaluare/agent-completat.xlsx"
```

Așteptat, exact cum a ieșit la pregătirea planului:

```
km cursa1 180.0 consum 28.8
km cursa2 80.0 cursa3 (goală)
total km 300.0 total consum 48.0
kmInceput 125000
kmSfarsit 125300
kmTotal 300.0
norma 16
consumNormat 48.0
stocInceput 40
alimentat 40.0
stocCalculat 32.0
stocConstatat 35
diferenta 3.0
valoare 280.5
```

O cursă necompletată dă `""`, nu `0`, iar totalul o ignoră. `git status --short -- "src/app/(marketing)/unelte/foaie-de-parcurs"` nu mai arată sonda.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=("src/app/(marketing)/unelte/foaie-de-parcurs/excel.ts" "src/app/(marketing)/unelte/foaie-de-parcurs/excel.test.ts" src/app/api/unelte/foaie-de-parcurs/route.ts src/app/api/unelte/foaie-de-parcurs/route.test.ts src/lib/unelte/raspuns.ts src/lib/unelte/registru.ts)
git status --short -- "${CAI[@]}" "src/app/(marketing)/unelte/foaie-de-parcurs"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "src/app/(marketing)/unelte/foaie-de-parcurs/excel.ts" "src/app/(marketing)/unelte/foaie-de-parcurs/excel.test.ts" src/app/api/unelte/foaie-de-parcurs/route.ts src/app/api/unelte/foaie-de-parcurs/route.test.ts
git commit --only -m "feat(unelte): foaia de parcurs în Excel cu formule

Km parcurși = sosire − plecare, consum = km × normă ÷ 100 dintr-o singură
celulă, totalurile lunii, alimentările, stocul după normă și diferența față de
cel constatat. Validare km sosire ≥ plecare, recalculare la deschidere.
Rută statică, ca foaia de pontaj; antetele vin din raspunsFisier.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
# lastmod roșu = nu se împinge: se ridică data din harta.ts și se reface commitul (`git commit --amend --only -- src/content/landing/harta.ts`), apoi se reia linia.
node scripts/checks/lastmod.mjs && git merge origin/main && git push origin main
```

---

### Task G7: Pagina: formularul complet, avizele, previzualizarea cu toate tabelele

**Fișiere:**
- Modify (rescris întreg): `src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx`, pornind de la forma din B6 + B8.
- Create (test): `src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx`.
- Modify: `src/content/landing/harta.ts`, intrarea `/unelte/foaie-de-parcurs` (azi `:350-357`).
- Modify: `e2e/unelte-tipar.spec.ts`, rândul foii de parcurs din `PAGINI` (scris în B6).

**Interfețe:**
- Consumă:
  - din `./model` (G5): `avizeFoaieParcurs`, `CATEGORII`, `COMBUSTIBILI`, `UTILIZARI`, `ETICHETE_CATEGORIE`, `ETICHETE_COMBUSTIBIL`, `ETICHETE_UTILIZARE`, `MAX_CURSE_PE_ZI`, `construiesteFoaieParcurs`, `parametriFoaieParcurs`;
  - din `../foaie-de-pontaj/foaie`: `AN_MAX`, `AN_MIN`, `LUNI`, `avizeParametri` (B8);
  - `AvizCorectari` (B4), `Banda` cu `data-tipar` (B5), `Descarcari`, `PrevizualizareDocument` (G2) și restul componentelor pe care pagina le importă deja.
- Produce: `export default async function PaginaFoaieParcurs({ searchParams }: Proprietati)`, cu aceeași semnătură. În afară de `metadata` și componenta implicită, `page.tsx` nu exportă nimic: Next nu acceptă alte exporturi într-o pagină.

Câmpurile formularului (`name`), toate fără `m` și fără `utm_*`, deci în regulă cu paza A2:

| Grup | Nume |
| --- | --- |
| existente | `luna`, `an`, `auto`, `marca`, `sofer`, `firma` |
| noi | `categorie`, `combustibil`, `cui`, `nr`, `norma`, `km`, `stoc`, `utilizare`, `curse` |

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PaginaFoaieParcurs from "./page";

const deschide = async (parametri: Record<string, string>) =>
  render(await PaginaFoaieParcurs({ searchParams: Promise.resolve(parametri) }));

const PLIN = {
  an: "2026",
  luna: "10",
  auto: "B-123-ABC",
  marca: "Dacia Logan",
  sofer: "Radu Andrei",
  firma: "Construct SRL",
  cui: "RO12345678",
  nr: "17",
  categorie: "autoutilitara",
  combustibil: "motorina",
  utilizare: "agent",
  norma: "6,5",
  km: "125000",
  stoc: "20",
  curse: "3",
};

describe("pagina foii de parcurs", { timeout: 30_000 }, () => {
  it("formularul păstrează fiecare valoare din adresă", async () => {
    const { container } = await deschide(PLIN);
    const valoare = (nume: string) =>
      (container.querySelector(`[name="${nume}"]`) as HTMLInputElement | HTMLSelectElement | null)
        ?.value;
    expect(
      ["auto", "marca", "sofer", "firma", "cui", "nr", "categorie", "combustibil", "utilizare"].map(
        valoare,
      ),
    ).toEqual([
      "B-123-ABC",
      "Dacia Logan",
      "Radu Andrei",
      "Construct SRL",
      "RO12345678",
      "17",
      "autoutilitara",
      "motorina",
      "agent",
    ]);
    expect([valoare("norma"), valoare("km"), valoare("stoc"), valoare("curse")]).toEqual([
      "6,5",
      "125000",
      "20",
      "3",
    ]);
  });

  it("previzualizarea are categoria, norma, cele trei curse pe zi și tabelele de la final", async () => {
    const { container } = await deschide(PLIN);
    const documentul = container.querySelector("#documentul") as HTMLElement;
    const d = within(documentul);
    expect(d.getByText("Categoria vehiculului:").nextElementSibling?.textContent).toBe(
      "Autoutilitară",
    );
    expect(d.getByText("Norma proprie de consum:").nextElementSibling?.textContent).toBe(
      "6,5 l/100 km (0,065 l/km)",
    );
    const [curse, alimentari, rezumat] = [...documentul.querySelectorAll("table")];
    expect(curse?.querySelectorAll("tbody tr")).toHaveLength(31 * 3);
    expect(alimentari?.querySelector("caption")?.textContent).toBe("Alimentări cu combustibil");
    expect(rezumat?.querySelector("caption")?.textContent).toBe("Rezumatul lunii");
  });

  it("o normă scrisă greșit se spune pe pagină, nu dispare tăcut", async () => {
    await deschide({ ...PLIN, norma: "6,5 litri" });
    expect(screen.getByRole("status").textContent).toContain("Norma de consum „6,5 litri”");
  });

  it("fără parametri: selecturile rămân pe „de completat de mână”, un rând pe zi", async () => {
    const { container } = await deschide({});
    for (const nume of ["categorie", "combustibil", "utilizare"]) {
      expect((container.querySelector(`[name="${nume}"]`) as HTMLSelectElement).value).toBe("");
    }
    expect((container.querySelector('[name="curse"]') as HTMLSelectElement).value).toBe("1");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project ui "src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx"
```

Așteptat: toate 4 cad.
- `expected [ 'B-123-ABC', 'Dacia Logan', …(7) ] to deeply equal [ … ]`, fiindcă `cui`, `nr`, `categorie`… nu există în formular;
- `expected '______________________________' to be 'Autoutilitară'`: modelul din G5 are rubrica, dar pagina nu-i trece `categorie` din adresă;
- `Unable to find an accessible element with the role "status"`, fiindcă norma greșită nu ajunge la model;
- `TypeError: Cannot read properties of null (reading 'value')`, fiindcă selectul `categorie` lipsește.

- [ ] **Pasul 3: Implementarea minimă.** Înlocuiește tot conținutul lui `page.tsx` cu:

```tsx
// src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_FOAIE_PARCURS } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { AvizCorectari } from "../../_componente/aviz-corectari";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { Descarcari } from "../../_componente/descarcari";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { AN_MAX, AN_MIN, avizeParametri, LUNI } from "../foaie-de-pontaj/foaie";
import {
  avizeFoaieParcurs,
  CATEGORII,
  COMBUSTIBILI,
  construiesteFoaieParcurs,
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  ETICHETE_UTILIZARE,
  MAX_CURSE_PE_ZI,
  parametriFoaieParcurs,
  UTILIZARI,
} from "./model";

/**
 * Foaia de parcurs, gratuită.
 *
 * Keyword Planner, 2 oct 2026: „foaie de parcurs model” are 100–1.000 de
 * căutări pe lună, cu „word free download”, „pdf” și „excel” printre sugestii.
 * Formular GET, ca restul uneltelor: starea stă în adresă.
 *
 * Din 8 oct 2026 foaia are cele patru elemente minime din normele Codului
 * fiscal (vezi `model.ts`), mai multe curse pe zi, alimentările, rezumatul
 * lunii și un Excel cu formule.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Foaie de parcurs: model Word, PDF și Excel",
  descriere:
    "Foaie de parcurs lunară gata de completat: fiecare zi, traseul, scopul deplasării, kilometrii la plecare și la sosire. Model gratuit în Word, PDF sau Excel.",
  cale: "/unelte/foaie-de-parcurs",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

/** Parametrii pe care îi citește foaia; restul adresei se ignoră. */
const CHEI = [
  "an",
  "luna",
  "auto",
  "marca",
  "sofer",
  "firma",
  "cui",
  "nr",
  "categorie",
  "combustibil",
  "utilizare",
  "norma",
  "km",
  "stoc",
  "curse",
] as const;

const CAMPURI_TEXT = [
  { nume: "auto", eticheta: "Nr. de înmatriculare", exemplu: "B-123-ABC", max: 120 },
  { nume: "marca", eticheta: "Marca și modelul", exemplu: "Dacia Logan", max: 120 },
  { nume: "sofer", eticheta: "Conducător auto", exemplu: "Radu Andrei", max: 120 },
  { nume: "firma", eticheta: "Firma", exemplu: "Construct SRL", max: 120 },
  { nume: "cui", eticheta: "CUI", exemplu: "RO12345678", max: 20 },
  { nume: "nr", eticheta: "Foaia nr.", exemplu: "17", max: 20 },
] as const;

const CAMPURI_NUMERICE = [
  {
    nume: "norma",
    eticheta: "Norma proprie de consum (l/100 km)",
    exemplu: "6,5",
    ajutor: "Norma firmei pentru mașina asta. La electrice, în kWh/100 km.",
  },
  {
    nume: "km",
    eticheta: "Km la bord la începutul lunii",
    exemplu: "125.000",
    ajutor: "Intră pe prima cursă, la plecare.",
  },
  {
    nume: "stoc",
    eticheta: "Combustibil în rezervor la început",
    exemplu: "20",
    ajutor: "În litri (kWh la electrice), pentru stocul de la sfârșitul lunii.",
  },
] as const;

export default async function PaginaFoaieParcurs({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const ales = parametriFoaieParcurs(q);
  const document = construiesteFoaieParcurs(ales);
  const avize = [
    ...avizeParametri({ an: q.get("an") ?? undefined, luna: q.get("luna") ?? undefined }, ales),
    ...avizeFoaieParcurs(q, ales),
  ];
  const valoriText: Readonly<Record<(typeof CAMPURI_TEXT)[number]["nume"], string>> = {
    auto: ales.nrAuto,
    marca: ales.marca,
    sofer: ales.sofer,
    firma: ales.firma,
    cui: ales.cui,
    nr: ales.nrFoaie,
  };
  const numar = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
  const valoriNumerice: Readonly<Record<(typeof CAMPURI_NUMERICE)[number]["nume"], string>> = {
    norma: numar(ales.norma),
    km: ales.kmInitial === null ? "" : String(ales.kmInitial),
    stoc: numar(ales.stocInitial),
  };

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/foaie-de-parcurs",
          nume: ANTET_FOAIE_PARCURS.titlu,
          descriere: ANTET_FOAIE_PARCURS.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_FOAIE_PARCURS}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Foaie de parcurs", href: "/unelte/foaie-de-parcurs" },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Pe scurt" titlu="La ce folosește foaia de parcurs">
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Codul fiscal limitează la 50% deducerea cheltuielilor cu mașinile care nu sunt
              folosite exclusiv în activitatea firmei — art. 25 alin. (3) lit. l). Foaia de parcurs
              e documentul prin care firma arată, deplasare cu deplasare, unde a mers mașina și de
              ce.
            </p>
          </div>
        </Banda>
      </div>

      {/* Toată banda formularului rămâne pe ecran: altfel umplutura și rigla ei
          se tipăreau goale deasupra documentului. */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Luna</span>
            <select name="luna" defaultValue={String(ales.luna)} className={CLASA_CAMP}>
              {LUNI.map((nume, i) => (
                <option key={nume} value={String(i + 1)}>
                  {nume}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Anul</span>
            <input
              type="number"
              name="an"
              min={AN_MIN}
              max={AN_MAX}
              defaultValue={String(ales.an)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Categoria vehiculului</span>
            <select name="categorie" defaultValue={ales.categorie ?? ""} className={CLASA_CAMP}>
              <option value="">de completat de mână</option>
              {CATEGORII.map((c) => (
                <option key={c} value={c}>
                  {ETICHETE_CATEGORIE[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Combustibil</span>
            <select name="combustibil" defaultValue={ales.combustibil ?? ""} className={CLASA_CAMP}>
              <option value="">de completat de mână</option>
              {COMBUSTIBILI.map((c) => (
                <option key={c} value={c}>
                  {ETICHETE_COMBUSTIBIL[c]}
                </option>
              ))}
            </select>
          </label>
          {CAMPURI_TEXT.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                name={c.nume}
                maxLength={c.max}
                defaultValue={valoriText[c.nume]}
                placeholder={c.exemplu}
                className={CLASA_CAMP}
              />
            </label>
          ))}
          {CAMPURI_NUMERICE.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                inputMode="decimal"
                name={c.nume}
                maxLength={12}
                defaultValue={valoriNumerice[c.nume]}
                placeholder={c.exemplu}
                className={CLASA_CAMP}
              />
              <span className="text-mk-text-slab text-[0.8125rem]">{c.ajutor}</span>
            </label>
          ))}
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[0.875rem] font-medium">Utilizarea vehiculului</span>
            <select name="utilizare" defaultValue={ales.utilizare ?? ""} className={CLASA_CAMP}>
              <option value="">de completat de mână</option>
              {UTILIZARI.map((u) => (
                <option key={u} value={u}>
                  {ETICHETE_UTILIZARE[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Curse pe zi</span>
            <select name="curse" defaultValue={String(ales.cursePeZi)} className={CLASA_CAMP}>
              {Array.from({ length: MAX_CURSE_PE_ZI }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n === 1 ? "1 rând pe zi" : `${String(n)} rânduri pe zi`}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="parcurs-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Generează
            </button>
          </div>
          <Descarcari
            actiune="/api/unelte/foaie-de-parcurs"
            eveniment="parcurs"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
        <AvizCorectari avize={avize} />
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Fără hârtie"
          titlu="Mașinile firmei, într-un singur loc"
        >
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            ITP-ul, RCA-ul, rovinieta și foile de parcurs ale fiecărei mașini, cu alertă înainte de
            expirare.{" "}
            <Link href="/module/flota" className="underline underline-offset-4">
              Cum arată modulul de parc auto
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/foaie-de-parcurs"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
```

Față de forma din B8:
- s-a scos al doilea paragraf din „Pe scurt” („… stabilește contabilul firmei”). Primul rămâne până în G8, unde banda e rescrisă cu temeiul;
- `CHEI` adaugă parametrii noi;
- avizele lui B8 primesc și `avizeFoaieParcurs`;
- banda formularului păstrează marcajul de tipar din B6.

În `src/content/landing/harta.ts`, în intrarea:

```ts
  {
    cale: "/unelte/foaie-de-parcurs",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-07",
    sectiune: "Unelte și comparații",
  },
```

`actualizat` devine data commitului, în formatul `date +%F`. De exemplu, pentru un commit din 9 oct 2026:

```ts
    actualizat: "2026-10-09",
```

Dacă între timp altă secțiune a schimbat valoarea, se înlocuiește oricare ar fi; ce contează e să fie data commitului lui G7.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project ui "src/app/(marketing)/unelte" "src/app/(marketing)/_componente"
pnpm exec vitest run --project unit "src/app/(marketing)" src/content
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
pnpm exec prettier --check "src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx" "src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx" src/content/landing/harta.ts e2e/unelte-tipar.spec.ts
```

Așteptat, verzi:
- `pagina.test.tsx`: 4 teste;
- `tipar.test.tsx` (B6): pe parcurs rămâne doar `documentul`, cu `data-tipar-pagina="peisaj"`;
- `avize.test.tsx` (B4, B8): „Luna „0” nu e între 1 și 12”;
- `descarcari.test.tsx`: `<Descarcari` în `<form`;
- `descrieri.test.ts` și `continut.test.ts`.

- [ ] **Pasul 5: Verificare headless, local** (memoriile `erp-verificare-vizuala-headless`, `erp-next-dev-nu-hidrateaza`, `erp-next-dev-corupe-validator`, `erp-pkill-se-omoara-singur`). Scriptul `$SCRATCH/verifica-pagina.mjs`, folosit și în G9:

```js
// Pagina foii de parcurs în headless_shell: lățimea la 360 și 1366 px, câmpurile
// formularului, tabelele din previzualizare și numărul de pagini la tipar.
// Folosire: node verifica-pagina.mjs <baza> <director-capturi>
// Pe staging: ADM_AUTENTIFICARE_BASIC="coleg:<parola>" node verifica-pagina.mjs https://staging.administrativo.ro <dir>
import { createRequire } from "node:module";
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";

const require = createRequire("/srv/apps/ERP/package.json");
const { PDFDocument } = require("pdf-lib");

const [, , baza = "http://127.0.0.1:3917", dir = "."] = process.argv;
const [utilizator, parola] = (process.env.ADM_AUTENTIFICARE_BASIC ?? "").split(":");
const CALE =
  "/unelte/foaie-de-parcurs?an=2026&luna=10&auto=B-123-ABC&marca=Dacia%20Logan&sofer=%C8%98tefan%20%C8%9Aurcanu&firma=Construct%20SRL&cui=RO12345678&nr=17&categorie=autoturism&combustibil=motorina&utilizare=agent&norma=6%2C5&km=125000&stoc=20&curse=3";
const TIPAR = "/unelte/foaie-de-parcurs?luna=5&an=2027";

const browser = await chromium.launch({
  executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
});
const context = (latime) =>
  browser.newContext({
    viewport: { width: latime, height: 900 },
    ...(utilizator ? { httpCredentials: { username: utilizator, password: parola ?? "" } } : {}),
  });
for (const latime of [360, 1366]) {
  const ctx = await context(latime);
  const page = await ctx.newPage();
  const r = await page.goto(baza + CALE, { waitUntil: "networkidle" });
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    curse: document.querySelectorAll("#documentul table")[0]?.querySelectorAll("tbody tr").length ?? 0,
    tabele: [...document.querySelectorAll("#documentul table caption")].map((c) => c.textContent),
    campuri: [...document.querySelectorAll("form [name]")].map((e) => e.getAttribute("name")).join(","),
    categorie: [...document.querySelectorAll("#documentul dt")].find((e) => e.textContent === "Categoria vehiculului:")?.nextElementSibling?.textContent ?? null,
    aviz: document.querySelector('form + [role="status"]')?.textContent ?? null,
  }));
  console.log(`${latime}px | HTTP ${r?.status()} | scrollWidth ${m.sw} / clientWidth ${m.cw} | curse ${m.curse} | tabele ${JSON.stringify(m.tabele)} | categorie ${m.categorie} | aviz ${m.aviz}`);
  console.log(`  câmpuri: ${m.campuri}`);
  await page.screenshot({ path: `${dir}/parcurs-${latime}.png`, fullPage: true });
  await ctx.close();
}
const ctx = await context(1366);
const page = await ctx.newPage();
await page.goto(baza + TIPAR, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
const pdf = await PDFDocument.load(await page.pdf({ format: "A4", preferCSSPageSize: true }));
const foi = pdf.getPages().map((p) => (p.getWidth() > p.getHeight() ? "culcat" : "portret"));
console.log(`tipar ${TIPAR}: ${pdf.getPageCount()} pagini, ${foi.join(" ")}`);
await browser.close();
```

Serverul se pornește în fundal, într-un apel separat:

```bash
cd /srv/apps/ERP && pnpm exec next dev -H 127.0.0.1 -p 3917
```

Se așteaptă cu Monitor până când `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3917/unelte/foaie-de-parcurs` dă `200`. Apoi:

```bash
mkdir -p "$SCRATCH/capturi-local" && node "$SCRATCH/verifica-pagina.mjs" http://127.0.0.1:3917 "$SCRATCH/capturi-local"
```

Așteptat:
- la 360 și la 1366 px: `HTTP 200`, `scrollWidth` = `clientWidth` (360, respectiv 1366), `curse 93`, `tabele ["Foaie de parcurs — octombrie 2026","Alimentări cu combustibil","Rezumatul lunii"]`, `categorie Autoturism`, `aviz null`;
- câmpurile: `luna,an,categorie,combustibil,auto,marca,sofer,firma,cui,nr,norma,km,stoc,utilizare,curse,format,format,format`;
- tipar: între 2 și 4 pagini, toate `culcat`.

Se deschid cu `Read` `parcurs-360.png` și `parcurs-1366.png`. La 360 px formularul e pe o coloană, iar selecturile nu ies din ecran. Tabelul se derulează în chenarul lui, nu pagina.

Numărul de pagini la tipar se trece în `e2e/unelte-tipar.spec.ts`. Înlocuiește intrarea scrisă în B6 (forma din textul lui B6, pe cinci rânduri, cu `eticheta`):

```ts
  {
    eticheta: "foaie de parcurs",
    cale: "/unelte/foaie-de-parcurs?luna=5&an=2027",
    culcat: true,
    pagini: [1, 3],
  },
```

cu:

```ts
  {
    // Din G7 (8 oct 2026), foaia are și alimentările și rezumatul lunii: trei tabele.
    eticheta: "foaie de parcurs",
    cale: "/unelte/foaie-de-parcurs?luna=5&an=2027",
    culcat: true,
    pagini: [2, 4],
  },
```

Verificare înainte de commit: `grep -c 'pagini: \[1, 3\]' e2e/unelte-tipar.spec.ts` scade cu unu față de dinainte (celelalte intrări cu `[1, 3]`, de exemplu fișa SSM, rămân), iar `pnpm exec prettier --check e2e/unelte-tipar.spec.ts` e curat.

Dacă măsurătoarea iese în afara intervalului [2, 4], **nu** se lărgește intervalul. E un defect de tipar, care se caută în `globals.css` (`@page peisaj`, B6) înainte de commit.

Serverul se oprește într-un apel SEPARAT, apoi se repară tipurile generate:

```bash
pkill -f "next dev -H 127.0.0.1 -p 391[7]"
```

```bash
cd /srv/apps/ERP && rm -rf .next/dev/types && pnpm typecheck
```

- [ ] **Commit.** `harta.ts` intră în același commit cu `page.tsx` (lastmod).

```bash
cd /srv/apps/ERP
CAI=("src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx" "src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx" src/content/landing/harta.ts e2e/unelte-tipar.spec.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx"
git commit --only -m "feat(unelte): formularul foii de parcurs cu categoria, norma, CUI, nr. foii și curse pe zi

Câmpuri noi: categorie, combustibil, utilizare (cu temeiul), normă, km și stoc
la început de lună, CUI, nr. foii, 1–4 rânduri pe zi. Valorile lăsate
deoparte se spun pe pagină. Previzualizarea arată alimentările și rezumatul.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
# lastmod roșu = nu se împinge: se ridică data din harta.ts și se reface commitul (`git commit --amend --only -- src/content/landing/harta.ts`), apoi se reia linia.
node scripts/checks/lastmod.mjs && git merge origin/main && git push origin main
```

---

### Task G8: Conținutul: ce cer normele, 50% sau 100%, întrebări, exemplul completat, îndemnul; descrierile și harta

**Fișiere:**
- Modify (rescris întreg): `src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx`, pornind de la forma din G7.
- Modify: `src/app/(marketing)/unelte/foaie-de-parcurs/model.ts`: `EXEMPLU_COMPLETAT`, înaintea lui `foaieParcursDinParametri`.
- Modify: `src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx`: importul și un bloc `describe` la sfârșit.
- Modify: `src/content/landing/unelte.ts:45`, `src/app/(marketing)/unelte/page.tsx:64`, `src/app/llms.txt/route.ts:140`, `src/content/landing/ro.ts:971`, `src/content/landing/en.ts:931`.
- Modify: `src/content/landing/harta.ts` (`actualizat` pe `/unelte/foaie-de-parcurs` și pe `/unelte`, fiindcă se schimbă și `unelte/page.tsx`) și `NOTES.md` (§3, înaintea lui „Retenție și arhivare”).

**Interfețe:**
- Consumă: `RO.hero.ctaPrimar` (`ro.ts:73`: `{ eticheta: "Creează cont · prima lună gratuită", href: "/inregistrare" }`), `Link` din `next/link` (importat deja în pagină).
- Produce: `export const EXEMPLU_COMPLETAT: string` în `model.ts`. Pe pagină apar evenimentele Umami `parcurs-exemplu` și `cta-foaie-parcurs`.

- [ ] **Pasul 1: Scrie testul care pică.** În `pagina.test.tsx` înlocuiește:

```tsx
import PaginaFoaieParcurs from "./page";
```

cu:

```tsx
import { EXEMPLU_COMPLETAT } from "./model";
import PaginaFoaieParcurs from "./page";
```

și adaugă la sfârșitul fișierului:

```tsx

describe("pagina foii de parcurs: ce spune legea", { timeout: 30_000 }, () => {
  it("enumeră cele patru elemente din norme, cu temeiul pentru profit și pentru TVA", async () => {
    const { container } = await deschide({});
    // `ol.list-decimal`: firimiturile din antet sunt și ele un `<ol>`.
    const lista = [...container.querySelectorAll("ol.list-decimal li")].map((li) => li.textContent);
    expect(lista).toEqual([
      "categoria de vehicul utilizat;",
      "scopul și locul deplasării;",
      "kilometrii parcurși;",
      "norma proprie de consum carburant pe kilometru parcurs.",
    ]);
    const text = container.textContent ?? "";
    expect(text).toContain("titlul II pct. 16 alin. (2)");
    expect(text).toContain("titlul VII pct. 68 alin. (2)");
    expect(text).not.toContain("stabilește contabilul firmei");
  });

  it("spune limita de 50% la impozit și la TVA, cu pragul de 3.500 kg și excepțiile", async () => {
    const text = (await deschide({})).container.textContent ?? "";
    expect(text).toContain("art. 25 alin. (3) lit. l)");
    expect(text).toContain("art. 298 alin. (1)");
    expect(text).toContain("3.500 kg");
    expect(text).toContain("pct. 68 alin. (4)");
  });

  it("exemplul completat se deschide fără niciun aviz, cu categoria și norma trecute", async () => {
    const { container } = await deschide({});
    const legatura = container.querySelector('a[data-umami-event="parcurs-exemplu"]');
    const href = legatura?.getAttribute("href") ?? "";
    expect(href).toBe(EXEMPLU_COMPLETAT);
    const parametri = Object.fromEntries(new URLSearchParams(href.slice(1).split("#")[0]));
    const exemplu = await deschide(parametri);
    expect(exemplu.queryByRole("status")).toBeNull();
    const documentul = within(exemplu.container.querySelector("#documentul") as HTMLElement);
    expect(documentul.getByText("Categoria vehiculului:").nextElementSibling?.textContent).toBe(
      "Autoturism",
    );
  });

  it("îndemnul spre aplicație are evenimentul lui și duce la înregistrare", async () => {
    const { container } = await deschide({});
    const cta = container.querySelector('a[data-umami-event="cta-foaie-parcurs"]');
    expect(cta?.getAttribute("href")).toBe("/inregistrare");
    expect(container.querySelector('a[href="/module/flota"]')).not.toBeNull();
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project ui "src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx"
```

Așteptat: 4 teste noi cad, cele 4 din G7 trec.
- `expected [] to deeply equal [ …(4) ]`: lista celor 4 elemente lipsește;
- `expected 'Sari la conținutul principal…' to contain 'art. 298 alin. (1)'`;
- `expected '' to be undefined`, fiindcă legătura spre exemplu lipsește, iar `EXEMPLU_COMPLETAT` e `undefined`;
- `expected undefined to be '/inregistrare'`.

- [ ] **Pasul 3: Implementarea minimă.** În `model.ts` înlocuiește:

```ts
export function foaieParcursDinParametri(q: URLSearchParams): DocumentTabelar {
```

cu:

```ts
/**
 * Exemplul completat de pe pagină: o mașină de agent de vânzări, două rânduri
 * pe zi. Stă aici, nu în `page.tsx`: o pagină Next nu exportă altceva decât
 * componenta și metadatele. Testul paginii verifică că exemplul nu dă niciun aviz.
 */
export const EXEMPLU_COMPLETAT =
  "?an=2026&luna=10&auto=B-123-ABC&marca=Dacia%20Logan&sofer=Radu%20Andrei&firma=Construct%20SRL&cui=RO12345678&nr=17&categorie=autoturism&combustibil=motorina&utilizare=agent&norma=6%2C5&km=125000&stoc=20&curse=2#documentul";

export function foaieParcursDinParametri(q: URLSearchParams): DocumentTabelar {
```

Înlocuiește tot conținutul lui `page.tsx` cu:

```tsx
// src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_FOAIE_PARCURS } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { AvizCorectari } from "../../_componente/aviz-corectari";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { Descarcari } from "../../_componente/descarcari";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { AN_MAX, AN_MIN, avizeParametri, LUNI } from "../foaie-de-pontaj/foaie";
import {
  avizeFoaieParcurs,
  CATEGORII,
  COMBUSTIBILI,
  construiesteFoaieParcurs,
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  ETICHETE_UTILIZARE,
  EXEMPLU_COMPLETAT,
  MAX_CURSE_PE_ZI,
  parametriFoaieParcurs,
  UTILIZARI,
} from "./model";

/**
 * Foaia de parcurs, gratuită.
 *
 * Keyword Planner, 2 oct 2026: „foaie de parcurs model” are 100–1.000 de
 * căutări pe lună, cu „word free download”, „pdf” și „excel” printre sugestii.
 * Formular GET, ca restul uneltelor: starea stă în adresă.
 *
 * Din 8 oct 2026 foaia are cele patru elemente minime din normele Codului
 * fiscal (vezi `model.ts`), mai multe curse pe zi, alimentările, rezumatul
 * lunii și un Excel cu formule.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Foaie de parcurs: model Word, PDF și Excel",
  descriere:
    "Foaie de parcurs cu cele 4 elemente cerute de normele Codului fiscal: mai multe curse pe zi, alimentări, Excel cu formule. Gratuită, în Word și PDF, fără cont.",
  cale: "/unelte/foaie-de-parcurs",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

/** Parametrii pe care îi citește foaia; restul adresei se ignoră. */
const CHEI = [
  "an",
  "luna",
  "auto",
  "marca",
  "sofer",
  "firma",
  "cui",
  "nr",
  "categorie",
  "combustibil",
  "utilizare",
  "norma",
  "km",
  "stoc",
  "curse",
] as const;

/**
 * Răspunsurile stau pe textul legii, verificat pe 8 oct 2026 pe formele
 * consolidate de pe legislatie.just.ro: Codul fiscal (08.08.2026), normele HG
 * 1/2016 (31.03.2026), OMFP 2634/2015 (01.08.2024). Ce nu spune legea textual
 * (ce e „categoria de vehicul”) e spus ca atare și trecut în NOTES.md ⚠.
 */
const INTREBARI: readonly Readonly<{ q: string; a: string; href?: string }>[] = [
  {
    q: "Există un formular tipizat obligatoriu?",
    a: "Nu. OMFP 2634/2015, ordinul cu modelele documentelor financiar-contabile, nu are un model de foaie de parcurs. Normele Codului fiscal cer conținutul, adică cele patru informații de mai sus, nu un anumit formular. Modelul de aici e pentru mașinile firmei: nu ține locul documentelor cerute în transportul rutier profesional de mărfuri sau de persoane, cum sunt înregistrările tahografului.",
  },
  {
    q: "Ce înseamnă „categoria de vehicul”?",
    a: "Normele cer categoria, dar n-o definesc. Foaia scrie de aceea două lucruri: tipul vehiculului (autoturism, autoutilitară și celelalte) și felul în care e folosit, cu temeiul din Codul fiscal, de exemplu „agent de vânzări — art. 298 alin. (3) lit. b)”. Încadrarea o face firma (pct. 68 alin. (8) din norme); dacă ai dubii, întreabă contabilul.",
  },
  {
    q: "Cum trec norma de consum?",
    a: "Normele cer „norma proprie de consum carburant pe kilometru parcurs”, deci norma firmei pentru mașina respectivă. Foaia o scrie în litri la 100 km și, alături, pe kilometru: 6,5 l/100 km înseamnă 0,065 l/km. Excel-ul înmulțește singur kilometrii fiecărei curse cu norma și, la sfârșitul lunii, pune stocul după normă lângă cel constatat la bord.",
  },
  {
    q: "O foaie pe zi sau una pe lună?",
    a: "Normele nu cer o anumită perioadă. Modelul e lunar, cu fiecare zi a lunii trecută deja. Dacă mașina face mai multe drumuri pe zi, cum face un agent de vânzări, alegi 2, 3 sau 4 rânduri pe zi, câte unul pe deplasare.",
  },
  {
    q: "Cum arată o foaie completată?",
    a: "Ca mai sus, cu mașina, norma și kilometrajul de început trecute. Poți deschide un exemplu completat pentru un agent de vânzări, cu două rânduri pe zi, apoi îl schimbi cu datele tale.",
    href: EXEMPLU_COMPLETAT,
  },
];

const CAMPURI_TEXT = [
  { nume: "auto", eticheta: "Nr. de înmatriculare", exemplu: "B-123-ABC", max: 120 },
  { nume: "marca", eticheta: "Marca și modelul", exemplu: "Dacia Logan", max: 120 },
  { nume: "sofer", eticheta: "Conducător auto", exemplu: "Radu Andrei", max: 120 },
  { nume: "firma", eticheta: "Firma", exemplu: "Construct SRL", max: 120 },
  { nume: "cui", eticheta: "CUI", exemplu: "RO12345678", max: 20 },
  { nume: "nr", eticheta: "Foaia nr.", exemplu: "17", max: 20 },
] as const;

const CAMPURI_NUMERICE = [
  {
    nume: "norma",
    eticheta: "Norma proprie de consum (l/100 km)",
    exemplu: "6,5",
    ajutor: "Norma firmei pentru mașina asta. La electrice, în kWh/100 km.",
  },
  {
    nume: "km",
    eticheta: "Km la bord la începutul lunii",
    exemplu: "125.000",
    ajutor: "Intră pe prima cursă, la plecare.",
  },
  {
    nume: "stoc",
    eticheta: "Combustibil în rezervor la început",
    exemplu: "20",
    ajutor: "În litri (kWh la electrice), pentru stocul de la sfârșitul lunii.",
  },
] as const;

export default async function PaginaFoaieParcurs({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const ales = parametriFoaieParcurs(q);
  const document = construiesteFoaieParcurs(ales);
  const avize = [
    ...avizeParametri({ an: q.get("an") ?? undefined, luna: q.get("luna") ?? undefined }, ales),
    ...avizeFoaieParcurs(q, ales),
  ];
  const valoriText: Readonly<Record<(typeof CAMPURI_TEXT)[number]["nume"], string>> = {
    auto: ales.nrAuto,
    marca: ales.marca,
    sofer: ales.sofer,
    firma: ales.firma,
    cui: ales.cui,
    nr: ales.nrFoaie,
  };
  const numar = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
  const valoriNumerice: Readonly<Record<(typeof CAMPURI_NUMERICE)[number]["nume"], string>> = {
    norma: numar(ales.norma),
    km: ales.kmInitial === null ? "" : String(ales.kmInitial),
    stoc: numar(ales.stocInitial),
  };

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/foaie-de-parcurs",
          nume: ANTET_FOAIE_PARCURS.titlu,
          descriere: ANTET_FOAIE_PARCURS.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_FOAIE_PARCURS}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Foaie de parcurs", href: "/unelte/foaie-de-parcurs" },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Pe scurt"
          titlu="Ce trebuie să conțină foaia ca să deduci cheltuiala"
        >
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Normele Codului fiscal cer ca foaia de parcurs să cuprindă cel puțin patru informații:
              HG 1/2016, titlul II pct. 16 alin. (2) pentru impozitul pe profit și titlul VII pct.
              68 alin. (2) pentru TVA.
            </p>
            <ol className="list-decimal space-y-1 pl-6">
              <li>categoria de vehicul utilizat;</li>
              <li>scopul și locul deplasării;</li>
              <li>kilometrii parcurși;</li>
              <li>norma proprie de consum carburant pe kilometru parcurs.</li>
            </ol>
            <p>
              Modelul de aici le are pe toate patru. Are și ce cere orice document justificativ
              (OMFP 2634/2015, anexa 1 pct. 2–3): denumirea firmei, CUI-ul, numărul și data
              întocmirii, semnăturile.
            </p>
          </div>
        </Banda>
      </div>

      {/* Toată banda formularului rămâne pe ecran: altfel umplutura și rigla ei
          se tipăreau goale deasupra documentului. */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Luna</span>
            <select name="luna" defaultValue={String(ales.luna)} className={CLASA_CAMP}>
              {LUNI.map((nume, i) => (
                <option key={nume} value={String(i + 1)}>
                  {nume}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Anul</span>
            <input
              type="number"
              name="an"
              min={AN_MIN}
              max={AN_MAX}
              defaultValue={String(ales.an)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Categoria vehiculului</span>
            <select name="categorie" defaultValue={ales.categorie ?? ""} className={CLASA_CAMP}>
              <option value="">de completat de mână</option>
              {CATEGORII.map((c) => (
                <option key={c} value={c}>
                  {ETICHETE_CATEGORIE[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Combustibil</span>
            <select name="combustibil" defaultValue={ales.combustibil ?? ""} className={CLASA_CAMP}>
              <option value="">de completat de mână</option>
              {COMBUSTIBILI.map((c) => (
                <option key={c} value={c}>
                  {ETICHETE_COMBUSTIBIL[c]}
                </option>
              ))}
            </select>
          </label>
          {CAMPURI_TEXT.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                name={c.nume}
                maxLength={c.max}
                defaultValue={valoriText[c.nume]}
                placeholder={c.exemplu}
                className={CLASA_CAMP}
              />
            </label>
          ))}
          {CAMPURI_NUMERICE.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                inputMode="decimal"
                name={c.nume}
                maxLength={12}
                defaultValue={valoriNumerice[c.nume]}
                placeholder={c.exemplu}
                className={CLASA_CAMP}
              />
              <span className="text-mk-text-slab text-[0.8125rem]">{c.ajutor}</span>
            </label>
          ))}
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[0.875rem] font-medium">Utilizarea vehiculului</span>
            <select name="utilizare" defaultValue={ales.utilizare ?? ""} className={CLASA_CAMP}>
              <option value="">de completat de mână</option>
              {UTILIZARI.map((u) => (
                <option key={u} value={u}>
                  {ETICHETE_UTILIZARE[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Curse pe zi</span>
            <select name="curse" defaultValue={String(ales.cursePeZi)} className={CLASA_CAMP}>
              {Array.from({ length: MAX_CURSE_PE_ZI }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n === 1 ? "1 rând pe zi" : `${String(n)} rânduri pe zi`}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="parcurs-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Generează
            </button>
          </div>
          <Descarcari
            actiune="/api/unelte/foaie-de-parcurs"
            eveniment="parcurs"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
        <AvizCorectari avize={avize} />
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Deducerea"
          titlu="50% sau 100%: impozit pe profit și TVA"
        >
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Pentru o mașină de cel mult 3.500 kg și cel mult 9 scaune cu tot cu al șoferului,
              folosită și în scop personal, firma deduce 50% din cheltuieli la impozitul pe profit
              (art. 25 alin. (3) lit. l) din Codul fiscal) și 50% din TVA (art. 298 alin. (1)).
              Amortizarea nu intră sub limita de la impozitul pe profit.
            </p>
            <p>
              Deducerea e integrală când mașina e folosită exclusiv în activitatea firmei sau intră
              într-una dintre categoriile din lege: servicii de urgență, pază și protecție,
              curierat; agenți de vânzări și de achiziții; transport de persoane cu plată, inclusiv
              taxi; servicii cu plată, închiriere, școli de șoferi; vehicule vândute ca marfă (art.
              25 alin. (3) lit. l) pct. 1–5 și art. 298 alin. (3)).
            </p>
            <p>
              Foaia de parcurs e dovada pentru deducerea integrală. Cine aplică deducerea de 50% nu
              trebuie să dovedească folosirea mașinii cu foaia de parcurs, spun normele la TVA (pct.
              68 alin. (4)). Peste 3.500 kg sau peste 9 scaune, limita de 50% nu se aplică (art. 298
              alin. (2)).
            </p>
          </div>
        </Banda>
      </div>

      <div data-tipar="ascunde">
        <Banda
          inaltime="medie"
          supratitlu="Întrebări"
          titlu="Ce se mai întreabă despre foaia de parcurs"
        >
          <div className="border-mk-rigla/40 mt-8 border-t">
            {INTREBARI.map((r) => (
              <div
                key={r.q}
                className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
              >
                <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                  {r.q}
                </h3>
                <div className="md:col-span-8">
                  <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">{r.a}</p>
                  {r.href !== undefined && (
                    <a
                      href={r.href}
                      data-umami-event="parcurs-exemplu"
                      className="mt-2 inline-block text-[0.9375rem] underline underline-offset-4"
                    >
                      Deschide exemplul completat
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Banda>
      </div>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Fără hârtie"
          titlu="Mașinile firmei, într-un singur loc"
        >
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            ITP-ul, RCA-ul, rovinieta și foile de parcurs ale fiecărei mașini, cu alertă înainte de
            expirare. Kilometrajul de plecare se propune din foaia anterioară, un regres sau un salt
            de kilometri se semnalează, iar consumul din alimentări se compară cu cel declarat al
            mașinii. Șeful de echipă aprobă foile oamenilor lui.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={RO.hero.ctaPrimar.href}
              data-umami-event="cta-foaie-parcurs"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              {RO.hero.ctaPrimar.eticheta}
            </Link>
            <Link
              href="/module/flota"
              className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
            >
              Cum arată modulul Flotă
            </Link>
          </div>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/foaie-de-parcurs"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
```

Fiecare frază juridică are acoperire în textul consolidat descărcat pe 8 oct 2026:

| Ce spune pagina | Unde scrie, textual |
| --- | --- |
| Cele 4 elemente | HG 1/2016, titlul II pct. 16 alin. (2); titlul VII pct. 68 alin. (2) |
| 50% profit, ≤ 3.500 kg, ≤ 9 scaune, fără amortizare | Cod fiscal art. 25 alin. (3) lit. l), ultimul paragraf: „nu includ cheltuielile privind amortizarea” |
| 50% TVA | art. 298 alin. (1) |
| Fără limită peste 3.500 kg / 9 scaune | art. 298 alin. (2) |
| Excepțiile | art. 25 alin. (3) lit. l) pct. 1–5; art. 298 alin. (3) lit. a)–f) |
| La 50% nu trebuie foaie | HG 1/2016, pct. 68 alin. (4) |
| Încadrarea o face firma | pct. 68 alin. (8) |
| OMFP fără model de foaie | anexele 286044/286045: zero potriviri pentru „foaie de parcurs” |

`src/content/landing/unelte.ts`. Înlocuiește:

```ts
  lead: "Scrie mașina, șoferul și luna: primești foaia de parcurs cu fiecare zi, traseul, scopul deplasării și kilometrii la plecare și la sosire. Descarci în Word, PDF sau Excel, fără cont.",
```

cu:

```ts
  lead: "Scrie mașina, șoferul și luna: primești foaia de parcurs cu cele patru elemente cerute de normele Codului fiscal, mai multe curse pe zi, alimentările și rezumatul lunii. Descarci în Word, PDF sau Excel cu formule, fără cont.",
```

`src/app/(marketing)/unelte/page.tsx`. Înlocuiește:

```tsx
    nota: "fiecare zi a lunii, traseu și kilometri · Word, PDF, Excel",
```

cu:

```tsx
    nota: "cele 4 elemente din normele fiscale · până la 4 curse pe zi · Excel cu formule",
```

`src/app/llms.txt/route.ts`. Înlocuiește:

```ts
    "Unealtă gratuită: foaie de parcurs lunară pentru o mașină de serviciu — fiecare zi, traseul, scopul deplasării, kilometrii la plecare și la sosire. Word, PDF sau Excel, fără cont. Cu limita de 50% din art. 25 alin. (3) lit. l) Cod fiscal pentru mașinile folosite și personal.",
```

cu:

```ts
    "Unealtă gratuită: foaie de parcurs lunară cu cele patru elemente minime din normele Codului fiscal (HG 1/2016, titlul II pct. 16 alin. (2) și titlul VII pct. 68 alin. (2)): categoria vehiculului, scopul și locul deplasării, kilometrii parcurși, norma proprie de consum. Până la 4 curse pe zi, alimentări, rezumatul lunii și Excel cu formule (km parcurși, consum după normă, stoc de combustibil). Plus limita de 50% pentru mașinile folosite și personal, la impozitul pe profit (art. 25 alin. (3) lit. l) Cod fiscal) și la TVA (art. 298), și excepțiile cu deducere integrală. Word, PDF sau Excel, fără cont.",
```

`src/content/landing/ro.ts`. Înlocuiește:

```ts
        text: "Mașina, șoferul și luna: traseul, scopul deplasării și kilometrii.",
```

cu:

```ts
        text: "Cele 4 elemente cerute de normele fiscale, mai multe curse pe zi, alimentări.",
```

`src/content/landing/en.ts`. Înlocuiește:

```ts
        text: "Vehicle, driver and month: the route, the purpose of each trip and the kilometres.",
```

cu:

```ts
        text: "The four items the tax rules require, several trips a day, refuelling.",
```

`src/content/landing/harta.ts`: `actualizat` devine data commitului lui G8 (`date +%F`) în **două** intrări:

- `/unelte/foaie-de-parcurs`, ca la G7;
- `/unelte` (azi `:315-322`, `actualizat: "2026-10-07"`), fiindcă G8 schimbă și `src/app/(marketing)/unelte/page.tsx` (nota din hub). `scripts/checks/lastmod.mjs` compară data din hartă cu ultimul commit care a atins `page.tsx`-ul paginii; fără ridicarea asta, poarta pică după commit, iar în CI pică la primul push (memoria `erp-lastmod-acelasi-commit`).

Comentariul de deasupra datei de la `/unelte` („6 oct: titlul și descrierea numesc toate cele șapte unelte.”) rămâne; dedesubt se adaugă un rând cu ziua commitului, de exemplu `// 9 oct: nota foii de parcurs numește cele 4 elemente din norme.`

`NOTES.md`. Înaintea rândului:

```md
### Retenție și arhivare · `retention_policies`
```

inserează:

```md
### Foaia de parcurs · unealta publică `/unelte/foaie-de-parcurs`

Fără tabelă: unealta nu citește și nu scrie în bază. Verificat pe 8 oct 2026 pe
formele consolidate de pe legislatie.just.ro, descărcate cu `curl`:

- Codul fiscal (`DetaliiDocument/171282`, consolidat la 08.08.2026): art. 25
  alin. (3) lit. l) pct. 1–5 (50% la impozitul pe profit, ≤ 3.500 kg, ≤ 9 scaune,
  fără amortizare) și art. 298 alin. (1)–(3) (50% la TVA, aceleași excepții, plus
  închirierea și leasingul la lit. e)).
- Normele HG 1/2016 (`DetaliiDocument/212504`, consolidat la 31.03.2026): titlul
  II pct. 16 alin. (2) și titlul VII pct. 68 alin. (2) cer în foaia de parcurs
  „cel puțin … categoria de vehicul utilizat, scopul și locul deplasării,
  kilometrii parcurși, norma proprie de consum carburant pe kilometru parcurs”;
  pct. 68 alin. (4): la deducerea de 50% nu se cere foaia; alin. (8): încadrarea
  o face firma.
- OMFP 2634/2015 (`DetaliiDocument/173682`, consolidat la 01.08.2024): fără model
  de foaie de parcurs; anexa 1 pct. 2–3 cere numărul, data și CIF-ul pe orice
  document justificativ.

⚠️ **„Categoria de vehicul”** nu e definită în norme. Unealta scrie tipul
vehiculului (lista din modulul Flotă) și, separat, utilizarea cu temeiul din
art. 25/298. De confirmat cu contabilul dacă ANAF se așteaptă la categoria
omologată (M1, N1) sau la categoria de utilizare.

⚠️ Dacă lipsa unui singur element duce, singură, la pierderea deducerii: nicio
soluție ANAF sau jurisprudență verificată.

⚠️ Transportul rutier profesional (tahograf, FAZ, actele Ministerului
Transporturilor): neverificat pe sursă primară; pagina spune doar că modelul nu
le acoperă. Anexele OMFP au fost citite prin `DetaliiDocumentAfis`, care poate
servi o formă veche (memoria `portal-legislativ-consolidari`).
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project ui "src/app/(marketing)/unelte"
pnpm exec vitest run --project unit "src/app/(marketing)" src/content "src/app/(marketing)/unelte/foaie-de-parcurs"
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
pnpm exec prettier --check "src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx" "src/app/(marketing)/unelte/foaie-de-parcurs/model.ts" "src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx" src/content/landing/unelte.ts "src/app/(marketing)/unelte/page.tsx" src/app/llms.txt/route.ts src/content/landing/ro.ts src/content/landing/en.ts src/content/landing/harta.ts NOTES.md
```

Așteptat, verzi:
- `pagina.test.tsx`: 8 teste;
- `descrieri.test.ts`: descrierea nouă are 159 de caractere și e unică;
- `continut.test.ts`: llms.txt și sitemap-ul au aceleași pagini, prețul nu e negat, iar unelteGratuite are același număr de intrări în RO și EN;
- `tipar.test.tsx` (B6): benzile noi sunt înfășurate în `data-tipar="ascunde"`.

- [ ] **Pasul 5: Verificare headless locală.** Ca în G7 Pasul 5: server separat, scriptul, oprire separată, `rm -rf .next/dev/types`. În plus, pe captura de 1366 px se citesc, în ordine:
  - „Ce trebuie să conțină foaia ca să deduci cheltuiala”, cu lista de 4;
  - formularul;
  - documentul;
  - „50% sau 100%: impozit pe profit și TVA”;
  - întrebările;
  - banda Flotă cu cele două butoane.

  La 360 px, `scrollWidth` = 360. Tiparul rămâne în intervalul [2, 4] fixat în G7.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=("src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx" "src/app/(marketing)/unelte/foaie-de-parcurs/model.ts" "src/app/(marketing)/unelte/foaie-de-parcurs/pagina.test.tsx" src/content/landing/unelte.ts "src/app/(marketing)/unelte/page.tsx" src/app/llms.txt/route.ts src/content/landing/ro.ts src/content/landing/en.ts src/content/landing/harta.ts NOTES.md)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git commit --only -m "feat(unelte): foaia de parcurs spune ce cer normele, cu temei, și cum stau 50% și 100%

Cele 4 elemente din HG 1/2016 (pct. 16 alin. (2), pct. 68 alin. (2)), limita
de 50% la impozit (art. 25 alin. (3) lit. l)) și la TVA (art. 298), excepțiile,
pct. 68 alin. (4). Întrebări, exemplu completat, îndemn spre aplicație cu
eveniment propriu. Descrierea, lead-ul, hub-ul, llms.txt, NOTES.md (⚠ categoria
de vehicul).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
# lastmod roșu = nu se împinge: se ridică data din harta.ts și se reface commitul (`git commit --amend --only -- src/content/landing/harta.ts`), apoi se reia linia.
node scripts/checks/lastmod.mjs && git merge origin/main && git push origin main
```

---

### Task G9: Staging, apoi producție, cu fișierele descărcate verificate

**Fișiere:** niciunul (deploy și verificări).

**Interfețe:**
- Consumă: rularea automată `.github/workflows/staging.yml` (prin `gh run list`), `./administrativo.sh prod`, `./administrativo.sh stack:status` (`ops/05-docker.sh:176`, `ops/01-main.sh:68`), `~/.secrete/administrativo/parola-staging.txt`.
- Consumă și scripturile din scratchpad: `$SCRATCH/verifica-pagina.mjs` (G7), `$SCRATCH/randeaza-pdf.mjs` (G3), `$SCRATCH/eval.py` și `$SCRATCH/venv` (G6).
- Produce: foaia de parcurs nouă pe producție.

Scriptul `$SCRATCH/verifica-descarcari.sh`:

```bash
#!/usr/bin/env bash
# Descarcă foaia de parcurs în cele trei formate și verifică antetele, formulele,
# XML-ul Word-ului și cele 4 elemente. Folosire:
#   verifica-descarcari.sh <baza> <director> [utilizator:parola]
set -euo pipefail
baza=$1
dir=$2
auth=${3:-}
q='an=2026&luna=10&auto=B-123-ABC&marca=Dacia%20Logan&sofer=%C8%98tefan%20%C8%9Aurcanu&firma=Construct%20SRL&cui=RO12345678&nr=17&categorie=autoturism&combustibil=electric&utilizare=agent&norma=16&km=125000&stoc=40&curse=2'
mkdir -p "$dir"
for f in pdf docx xlsx; do
  curl -s ${auth:+-u "$auth"} -D "$dir/antet-$f.txt" -o "$dir/foaie.$f" \
    "$baza/api/unelte/foaie-de-parcurs?$q&format=$f"
  grep -i -E '^(HTTP|content-type|content-disposition|cache-control)' "$dir/antet-$f.txt"
done
echo "formule în Excel: $(unzip -p "$dir/foaie.xlsx" xl/worksheets/sheet1.xml | grep -o '<f>' | wc -l)"
python3 -I -c 'import sys,zipfile,xml.dom.minidom as m; m.parseString(zipfile.ZipFile(sys.argv[1]).read("word/document.xml")); print("Word: XML valid")' "$dir/foaie.docx"
unzip -p "$dir/foaie.docx" word/document.xml | grep -o -E 'Categoria vehiculului: Autoturism|Norma proprie de consum: 16 kWh/100 km|Alimentări cu combustibil|Rezumatul lunii' | sort -u
```

- [ ] **Pasul 1: Staging** (memoriile `erp-staging-cade-tacut`, `erp-workflow-verde-prin-sarire`). Push-ul din G8 declanșează singur `staging.yml` (`on: push: branches: [main]`; G8 atinge și fișiere care nu sunt `.md`, deci `paths-ignore` nu-l sare). **Nu** se rulează de mână `ADM_MEDIU=staging ./administrativo.sh stack:deploy`: ar porni un al doilea deploy pe același stack, în paralel cu cel din CI, iar `concurrency` din workflow anulează doar rulările lui, nu pe cea manuală (corectat la verificare). Se așteaptă rularea commitului G8:

```bash
cd /srv/apps/ERP && SHA=$(git rev-parse HEAD)
gh run list --workflow staging.yml --limit 5 --json headSha,status,conclusion,createdAt,updatedAt,databaseId \
  --jq ".[] | select(.headSha==\"$SHA\")"
```

Așteptat: `status` `completed`, `conclusion` `success`, iar între `createdAt` și `updatedAt` peste 30 s (sub 30 s a sărit). Dacă rularea lipsește (un push al altei sesiuni a anulat-o prin `cancel-in-progress`), rularea commitului mai nou îl conține și pe G8: se verifică aceeași regulă pe ea, plus `git merge-base --is-ancestor "$SHA" <headSha-ul ei>`. Dacă e roșie, te oprești și citești jurnalul (`gh run view <id> --log-failed`); nu treci la descărcări pe un staging vechi.

```bash
A="coleg:$(cat ~/.secrete/administrativo/parola-staging.txt)"
bash "$SCRATCH/verifica-descarcari.sh" https://staging.administrativo.ro "$SCRATCH/staging" "$A"
```

Așteptat:
- de trei ori `HTTP/2 200`;
- `content-disposition: attachment; filename="foaie-de-parcurs-b-123-abc-2026-10.<ext>"`;
- `cache-control: private, no-store`;
- `formule în Excel: 136` (62 × 2 + 2 + 2 + 8);
- `Word: XML valid`;
- patru linii: `Alimentări cu combustibil`, `Categoria vehiculului: Autoturism`, `Norma proprie de consum: 16 kWh/100 km`, `Rezumatul lunii`.

```bash
"$SCRATCH/venv/bin/python" -I "$SCRATCH/eval.py" "$SCRATCH/staging/foaie.xlsx" "$SCRATCH/staging/completat.xlsx"
node "$SCRATCH/randeaza-pdf.mjs" "$SCRATCH/vizual" "$SCRATCH/staging/foaie.pdf" staging
ADM_AUTENTIFICARE_BASIC="$A" node "$SCRATCH/verifica-pagina.mjs" https://staging.administrativo.ro "$SCRATCH/capturi-staging"
cd /srv/apps/ERP && ADM_AUTENTIFICARE_BASIC="$A" pnpm exec playwright test e2e/unelte-tipar.spec.ts --grep "tipar: foaie de parcurs"
```

`--grep` se potrivește pe TITLUL testului, nu pe adresă. În B6 titlul e `` `tipar: ${p.eticheta}` ``, adică „tipar: foaie de parcurs”, cu spații; un `--grep "foaie-de-parcurs"` nu găsește niciun test și Playwright iese cu „No tests found”. Ieșirea trebuie să spună `1 passed`, nu mai puțin.

Așteptat:
- `eval.py` scrie exact cifrele din G6 Pasul 5;
- `staging-1.png` … `staging-4.png`, deschise cu `Read`, arată:
  - antetul pe două coloane;
  - coloanele „Consum normat (kWh)” și „Semnătura conducătorului” întregi;
  - „Pagina i din 4” pe fiecare pagină;
  - rezumatul neîntrerupt;
- `verifica-pagina.mjs` dă aceleași cifre ca în G7, iar pe staging bara de cookie-uri există, deci tiparul e cel real;
- testul e2e trece.

`playwright.config.ts:46` citește `E2E_AUTENTIFICARE_BASIC` sau `ADM_AUTENTIFICARE_BASIC`, iar ținta implicită e staging (`:34`).

- [ ] **Pasul 2: OPREȘTE-TE și cere confirmarea utilizatorului pentru producție:** „Fac deploy pe producție cu foaia de parcurs nouă (G1–G8)?”. Doar după „da”:

```bash
cd /srv/apps/ERP && ./administrativo.sh prod && ./administrativo.sh stack:status
```

- [ ] **Pasul 3: Producția, de trei ori** (2 replici în spatele balansorului):

```bash
for i in 1 2 3; do bash "$SCRATCH/verifica-descarcari.sh" https://administrativo.ro "$SCRATCH/productie-$i"; done
"$SCRATCH/venv/bin/python" -I "$SCRATCH/eval.py" "$SCRATCH/productie-1/foaie.xlsx" "$SCRATCH/productie-1/completat.xlsx"
node "$SCRATCH/verifica-pagina.mjs" https://administrativo.ro "$SCRATCH/capturi-productie"
curl -s https://administrativo.ro/llms.txt | grep -c "cele patru elemente minime din normele Codului fiscal"
curl -s https://administrativo.ro/unelte/foaie-de-parcurs | grep -o '<meta name="description" content="[^"]*"'
```

Așteptat:
- de trei ori aceleași antete, 136 de formule, `Word: XML valid` și cele 4 linii;
- `eval.py` cu cifrele din G6;
- `verifica-pagina.mjs` cu `scrollWidth` = `clientWidth` la 360 și 1366;
- `1` pe llms.txt;
- descrierea nouă, cea de 159 de caractere.

---

**Review Focus**

Ce nu prinde niciun test unitar din secțiune și ar mușca un om real. Fiecare punct are paza lui în taskul care deține codul:

1. **Excel-ul deschis în Excel sau LibreOffice, nu în ExcelJS.** Testele verifică formulele ca text, rezolvate după eticheta coloanei. Că dau cifrele corecte o arată doar evaluarea cu `formulas`, din **G6 Pasul 5** și G9. Paza din cod e testul G6 „se recalculează la deschidere și are destule formule”: `fullCalcOnLoad="1"`, 136 de `<f>`, niciun `<pane>`. Fără `fullCalcOnLoad`, LibreOffice poate arăta celule goale la deschidere: fișierul nu are valori în cache, iar ExcelJS nu evaluează.
2. **Etichete tăiate cu „…” în PDF la altă unitate sau altă etichetă.** Lățimile coloanelor sunt calculate pentru „normat (kWh)” și „conducătorului”. Orice etichetă nouă sau unitate nouă (de exemplu „kg”) trece prin testul G5 „nicio etichetă de coloană nu se taie cu «…»”, rulat pe motorină și pe electric.
3. **Tabelul rupt între pagini.** Rezumatul are 11 rânduri. Fără regula `RANDURI_TABEL_SCURT` începea pe pagina 2 și se termina pe 3, iar foaia tipărită și capsată se citea greșit. Paza e testul G1 „un tabel scurt nu se rupe între pagini, oricât de jos ar începe”, pe 11 înălțimi de pornire.
4. **Exemplul de pe pagină rămâne în urma modelului.** O valoare redenumită în model (de exemplu `utilizare=agent`) ar face exemplul să deschidă o foaie cu aviz și rubrici goale, exact pe drumul de conversie. Paza e testul G8 „exemplul completat se deschide fără niciun aviz, cu categoria și norma trecute”.
5. **Termenii uneltei se despart de modulul Flotă.** Cine trece din foaia gratuită în aplicație trebuie să găsească aceleași categorii și aceiași combustibili. O categorie adăugată în `0012_fleet.sql` și în `src/schemas/fleet.ts`, dar nu și în unealtă, ori o etichetă schimbată într-o singură parte, e prinsă de testele G5 din „alinierea cu modulul Flotă”.
