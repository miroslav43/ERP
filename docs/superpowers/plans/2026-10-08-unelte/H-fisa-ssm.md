## H. Fișa individuală de instruire SSM, completă după anexa 11

**Scop:** `/unelte/fisa-instruire-ssm` dă gratuit, fără cont, fișa individuală de instruire SSM cu TOATE rubricile anexei 11 la normele HG 1425/2006, precompletată cu tot ce se poate scrie dinainte, cu rânduri pe care se poate semna de mână și cu termenele instruirii periodice calculate, adică un document care bate carnetul tipizat de 2–5 lei.

**De ce:** auditul live din 8 oct 2026 (`audit-unelte.json`, auditorul fișei SSM plus verificarea adversarială) a dat uneltei **utilitate 2/5** și un defect **CRITIC confirmat**:

- **Lipsesc cinci părți din anexa 11:** „Rezultatele testărilor”, „Accidente de muncă sau îmbolnăviri profesionale suferite”, „Sancțiuni aplicate…”, casetele „CONTROL MEDICAL PERIODIC” și „TESTAREA PSIHOLOGICĂ PERIODICĂ”. Fișa scrie chiar ea, pe document, că „Anexa nr. 11 mai cuprinde…” (`model.ts:74`), și numește greșit doar trei părți. Art. 89 alin. (2) lit. a) cere ca rezultatul testului de la angajare să se consemneze „în fișa de instruire individuală, conform modelului prevăzut în anexa nr. 11”, deci fișa trebuie să aibă rubrica. Fișa intră în uz la fiecare angajare, așa că problema apare de fiecare dată.
- **Periodica și suplimentara stau în același tabel**, cu o coloană „Tipul”, deși anexa le are separat, iar suplimentara are „Data efectuării”.
- **Tipărirea:** rânduri de **16 pt (5,6 mm)**, semnăturile de la angajare sunt trei liniuțe de **17,6 mm** despărțite prin „/”, iar la punctul 2) nu scrie cine semnează. Pagina 2 a PDF-ului are **2 rânduri**, fără numele lucrătorului și fără număr de pagină. Totul e pe A4 peisaj.
- **Datele cunoscute nu ajung în document:** locul de muncă nu apare la punctul 2), iar funcția nu apare în coloana „Ocupația”. Formularul are doar **4 câmpuri**.
- **Pagina** omite art. 98 lit. b) și art. 81 alin. (4) (copia fișei de aptitudini, păstrarea la conducătorul locului de muncă).
- **Excelul** e accesibil prin API (`format=xlsx`), cu paragrafele ne-împachetate, deși hub-ul promite doar Word și PDF.
- **Word corupt la caractere de control**: îl repară B2 pentru toate uneltele. Aici avem grijă doar ca și secțiunile noi să treacă prin `curataDocument`.
- **Utilizare** (Umami, GSC și nginx, 3 sept–8 oct): **0 vizualizări** reale, **1 impresie pe poziția 8** în GSC. Primul rezultat pe „fișa individuală de instruire SSM model” e zarinacrm.ro, care oferă un model text neconform anexei. Concurența reală e carnetul tipizat A5: **2 lei** la formularetipizate.ro și **4,84 lei** la Sidra, cu 12–16 pagini și toate secțiunile. Niciun alt generator gratuit nu precompletează datele.

**Temeiul, verificat azi pe sursa primară.** Forma consolidată a normelor HG 1425/2006 de pe `https://legislatie.just.ro/Public/DetaliiDocument/252029`, descărcată cu `curl` și user-agent de browser (fără el, portalul dă 403), pe 8 oct 2026. Istoricul de consolidări are datele 27.09.2010, 27.12.2011, 21.10.2016 și **07.03.2022**, ultima fiind HG 259/2022, MO 223 din 07.03.2022. HG 1146/2022, numit în cerință, nu apare în istoric. Anexa 11 nu poartă nicio mențiune de modificare. Anexa 12 este fișa de instruire **colectivă** (art. 82 alin. (2)–(4)), destinată prestatorilor și vizitatorilor, nu angajaților. Am citit integral art. 77, 80, 80¹, 81 alin. (1)–(5) cu (3¹)–(3³), 81¹, 82, 83, 85–100 și am folosit textul în `INSTRUIRI_SSM`. Fișierul descărcat e în `SCRATCH/plan/lucru-fisa-ssm/lege/252029.txt`.

**Precondiții (fiecare task le verifică la Pasul 0).** H rulează DUPĂ B2, B5, B6, B8 și E4, E5. Cele două secțiuni au rescris exact fișierele pe care H le extinde:

```bash
cd /srv/apps/ERP
grep -n "export function curataDocument" src/lib/unelte/document-tabelar.ts            # B2
grep -n '"saxes"' package.json                                                          # B2
grep -n '"data-tipar"?: "ascunde"' "src/app/(marketing)/_componente/banda.tsx"            # B5
grep -n 'fisa-instruire-ssm", culcat' e2e/unelte-tipar.spec.ts                          # B6
grep -n "export function textAntetRulant\|export function textPagina\|  inaltimeRand?: number;" src/lib/unelte/document-tabelar.ts   # E4
grep -n "export async function randeazaPdfMultiplu\|^function deseneaza" src/lib/unelte/pdf.ts                                     # E4
grep -n "export async function randeazaDocxMultiplu\|^function sectiune" src/lib/unelte/docx.ts                                    # E5
```

Fiecare comandă trebuie să găsească ceva. Dacă una nu găsește nimic, taskul H nu începe: se execută întâi taskul indicat în comentariu. Blocurile „vechi” din H sunt copiate din codul lăsat de B2 și E4/E5, așa cum îl descriu planurile lor. Am reconstruit codul acela într-o copie în afara repo-ului și am rulat pe el, verde, tot codul din H: `tsc`, `eslint`, `prettier --check`, testele lui B și E, plus cele 328 de teste din `src/lib/unelte`, `src/app/api/unelte`, `src/app/(marketing)` și `src/content`. Dacă la execuție un bloc vechi nu se potrivește la caracter, se citește fișierul și se aplică schimbarea pe forma reală. Nu se scrie peste ce au adus alte secțiuni.

**Coordonarea cu G, I, J și K** (adăugată la verificarea planului, 8 oct 2026, după citirea planurilor lor). Alte patru secțiuni scriu în aceleași fișiere și nu depind de H, deci pot ajunge pe `main` înaintea lui:

| Secțiunea | Ce schimbă în fișierele lui H | Ce face H dacă e deja pe `main` |
| --- | --- | --- |
| G1 | `document-tabelar.ts`: `tabeleSuplimentare?`, `mapeazaTexte(d, f)`; `curataDocument` devine `mapeazaTexte(d, curataText)`. `pdf.ts`: lățimile, `rand`, blocul de după tabelul principal. `docx.ts`: `celula`, tabelul. `xlsx.ts:28-49` | H1: curățarea lui `sectiuni` și `antetRulant` intră în `mapeazaTexte`, cu `f` în loc de `curataText`, iar `curataSectiune(s)` rămâne exportată, ca `mapeazaSectiune(s, curataText)`. Testul H1 „curataDocument curăță titlurile…” păzește asta în ambele ordini. |
| G2 | `previzualizare-document.tsx`: componenta `Tabel`, plus blocul tabelului principal | H4 nu mai înlocuiește blocul tabelului principal. Adaugă doar `SectiuneHtml` după el, iar `TabelHtml` servește doar secțiunile. |
| G3, G4 | `pdf.ts`: subsolul, „Pagina i din n” și bucla câmpurilor din `deseneaza` | ca la I3, mai jos |
| I3 | `document-tabelar.ts`: `Coloana.rupe`, `rubrici?`, `dataLaSemnaturi?`, puse după `inaltimeRand` (exact ancora lui H1). `pdf.ts`: `imparteCelula`, linia `linii` din `rand`, paginarea pe înălțimea reală, notele și semnăturile | H1 pune `sectiuni` și `antetRulant` după ultimul câmp existent. H2 NU înlocuiește tot blocul de la `randeazaPdf` până la sfârșit, ar șterge codul lui G sau I. Pune blocul E4 (`E-pontaj-condica.md`, Task E4, blocul care începe cu `function dimensiuni`) și blocul H2 de mai jos în `$SCRATCH`, rulează `diff -u` între ele și aplică fiecare bucată cu `Edit` pe `deseneaza` așa cum e. Sunt cele patru schimbări enumerate în H2. `tabel(...)` primește calculul de înălțime al lui I3, nu `inaltMinim`. |
| I4, I5 | `docx.ts`, în `sectiune(d)`: blocul notelor și al semnăturilor. `xlsx.ts:~51`. `previzualizare-document.tsx`: `td`, coada figurii | H3 pune linia `for (const s of d.sectiuni ?? [])` imediat înaintea buclei notelor, oriunde ar fi. H4 pune harta secțiunilor înaintea notelor. |
| J3 | `route.ts`: importurile `:1-5` și `GET = cuNumarare(genereaza)`. `route.test.ts`: rescris integral | H5 pune verificarea formatului în `genereaza`, înaintea lui `try`. Importurile se unesc, iar blocul de test al lui H se adaugă la sfârșitul fișierului lui J. |
| J5 | `fisa-instruire-ssm/page.tsx`: `<ContinuaInAplicatie unealta="fisa-instruire-ssm" … />` după banda `#documentul` | H7 păstrează elementul, cu aceleași proprietăți, imediat după `</Banda>`-ul documentului. |
| K1 | metadatele paginii trec în `META_UNELTE` (`src/content/landing/seo-unelte.ts`), iar testul lui K cere `metaUnealta(` în pagină și interzice `metadatePagina({` | H7 scrie `export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/fisa-instruire-ssm"));`. Titlul și descrierea din D14 trec în intrarea `"/unelte/fisa-instruire-ssm"` din `META_UNELTE`, cu `termen` neschimbat. `seo-unelte.ts` intră în `CAI`. |

Detecția, la Pasul 0 al fiecărui task (o linie găsită = secțiunea e pe `main`):

```bash
cd /srv/apps/ERP
grep -n "tabeleSuplimentare\|export function mapeazaTexte\|rubrici?:\|dataLaSemnaturi\|rupe?: boolean" src/lib/unelte/document-tabelar.ts   # G1, I3
grep -n "export function imparteCelula\|tabeleSuplimentare" src/lib/unelte/pdf.ts                                            # G1, I3
grep -n "function Tabel(" "src/app/(marketing)/_componente/previzualizare-document.tsx"                                       # G2
grep -n "cuNumarare" "src/app/api/unelte/[unealta]/route.ts"                                                                  # J3
grep -n "ContinuaInAplicatie\|metaUnealta" "src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx"                            # J5, K1
```

⚠ **De decis de utilizator, nu de executant.** G1 (`tabeleSuplimentare`), I3 (`rubrici`) și H1 (`sectiuni`, cu `tip: "tabel"`) sunt trei mecanisme pentru același lucru: părți în plus după tabelul principal. Dacă rulează toate trei, modelul comun le are pe toate trei, iar fiecare randare le desenează în ordinea în care au fost adăugate. H nu le unifică. Rămâne datorie, de trecut în `PROGRESS.md` la final. Mai e un caz: dacă K1 rulează DUPĂ H7, intrarea SSM din `META_UNELTE` trebuie să ia titlul și descrierea din H7 (D14), nu pe cele de azi, pe care le are K1 în plan.

**Lanțul de verificare al fiecărui task** (fără `pnpm build`):

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
pnpm exec prettier --write <fișierele taskului> && pnpm exec prettier --check <fișierele taskului>
node scripts/checks/lastmod.mjs   # după commit
```

`SCRATCH` = directorul scratchpad al sesiunii care execută. Căile cu paranteze stau mereu între ghilimele.

### Decizii luate

- **D1. Modelul comun primește secțiuni, nu se face un generator separat pentru fișă.** `DocumentTabelar` primește două câmpuri opționale:
  - `sectiuni?: readonly Sectiune[]`, cu trei tipuri: `text` (paragrafe plus rubrici de semnătură etichetate), `tabel` (titlu, coloane, rânduri, `inaltimeRand` propriu) și `casete` (casete de viză, câte două pe rând);
  - `antetRulant?: string`.

  Regula din capul lui `document-tabelar.ts` („unealta construiește O DATĂ ce conține documentul; randările decid doar cum arată”) rămâne valabilă: PDF-ul, Word-ul și previzualizarea citesc același obiect. Fără câmpurile noi, fiecare unealtă iese exact ca înainte, iar testele lui E (`pdf-pagini`, `docx-sectiuni`) și `randari.test.ts` rămân verzi. Fișa de evaluare și orice formular nou cu mai multe tabele pot folosi aceleași câmpuri.
- **D2. Fișa reproduce anexa 11 integral, în ordinea ei și cu rubricile ei.** Ordinea: antetul (10 rubrici); „Instruirea la angajare” 1)–3); „Instruirea periodică” (Data instruirii · Durata (h) · Ocupația · Materialul predat · semnăturile celui instruit, celui care a instruit și celui care a verificat); „Instruirea periodică suplimentară” (prima coloană e „Data efectuării”); „Rezultatele testărilor” (Data · Materialul examinat · Calificativ · Examinator); „Accidente de muncă sau îmbolnăviri profesionale suferite” (Data producerii evenimentului · Diagnosticul medical · Nr. și data PV de cercetare a evenimentului · Nr. zile ITM); „Sancțiuni aplicate pentru nerespectarea reglementărilor de securitate și sănătate în muncă” (Abaterea săvârșită · Sancțiunea administrativă · Nr. și data deciziei); „Control medical periodic” (Observații de specialitate, semnătura și parafa medicului de medicina muncii, data vizei); „Testarea psihologică periodică” (Apt psihologic pentru:*, semnătura psihologului, data, plus nota cu asteriscul). Nota care declara lipsurile dispare. În locul ei vin două note cu temei: art. 81 alin. (2)–(3¹) și art. 81 alin. (4)–(5).
- **D3. Câte rânduri.** Rândurile periodice = periodicitatea × anii aleși:
  - periodicitatea poate fi lunară (12 pe an), trimestrială (4), semestrială (2) sau anuală (1);
  - anii pot fi 1, 2, 3, 5 sau 10;
  - implicit e semestrial pe 5 ani, adică 10 rânduri;
  - maximul e 120 de rânduri: PDF de 9 pagini în 0,5 s, măsurat.

  Celelalte tabele au numărul de rânduri din anexă: suplimentară 6, testări 5, accidente 5, sancțiuni 5. Casetele medicale și psihologice sunt câte una pe an, cel puțin 6 ca în anexă, rotunjite la un număr par. Varianta „anuală” e etichetată „doar personal tehnico-administrativ” (art. 96 alin. (3); pentru ceilalți, art. 96 alin. (2¹) cere cel mult 6 luni). Orice valoare din afara listelor cade pe implicit, deci un URL nu poate cere un număr nemărginit de rânduri.
- **D4. Înălțimi pentru scris de mână.** Rândurile tabelelor fișei au 28 pt (9,9 mm). Rubricile de semnătură de la angajare sunt trei casete etichetate de 46 pt (16 mm), cu eticheta întreagă pe două rânduri, nu tăiată cu „…”. Casetele de viză au 96 pt, cu trei linii de scris. Conținutul instruirii are două rânduri întregi de scris, ca în anexă.
- **D5. A4 portret.** Modelul oficial e un carnet portret, iar cele 7 coloane încap pe cei 515 pt utili: etichetele de semnătură stau pe trei rânduri, „Ocupația” are 86 pt (am verificat randarea: „Operator țesătorie” încape întreg). Consecință: intrarea SSM din `e2e/unelte-tipar.spec.ts` (B6) trece de pe `culcat: true` pe `culcat: false`.
- **D6. Antetul repetat și numerotarea vin din E4/E5.** E4 și E5 scriu deja, pentru toate uneltele, `textAntetRulant(d)` pe paginile 2+ și „Pagina X din Y”. H adaugă doar câmpul `antetRulant`, pe care `textAntetRulant` îl preferă când există. Fișa îl umple cu „Fișă de instruire individuală SSM — <nume> — <firmă>”, iar fără nume, cu „Numele și prenumele: ____”. Fără câmpul ăsta, antetul rulant ar fi fost titlul și firma, fără omul.
- **D7. Ce se precompletează și ce nu.** Se precompletează: numele, legitimația/marca, calificarea, funcția, locul de muncă, firma, data, orele, instructorul și funcția lui pentru fiecare dintre cele două faze de la angajare, plus cine admite la lucru. Funcția intră în coloana „Ocupația” a rândurilor periodice și suplimentare, iar locul de muncă la punctul 2). **Nu se cer**:
  - CNP-ul (nu e rubrică a anexei 11, deci nu apare deloc);
  - grupa sanguină (dată despre sănătate, art. 9 GDPR);
  - domiciliul;
  - data și locul nașterii.

  Formularul e GET (secțiunea A, D1), deci orice valoare stă în adresă. Rubricile astea rămân linii de completat de mână. Un test păzește lipsa lor din formular.
- **D8. Termenele instruirii periodice apar doar pe pagină, nu în document.** Anexa n-are rubrică pentru ele, iar o dată tipărită în coloana „Data instruirii” ar arăta ca o instruire făcută. Se socotesc de la data instruirii la locul de muncă (sau, dacă lipsește, de la introductiv-generală): start + k × interval, cel mult 6 termene. Ziua se oprește la sfârșitul lunii (31 aug + 6 luni = 28/29 feb). Lângă ele stă legătura spre modulul SSM, care le ține minte și trimite alertă. Ăsta e argumentul de conversie: unealta calculează o dată, modulul ține evidența pentru totdeauna.
- **D9. Fișa SSM nu are Excel.** `formatePentru(slug)` din `registru.ts` dă `["pdf", "docx"]` pentru ea. Ruta comună răspunde 400 cu „Unealta asta se descarcă doar în PDF sau Word.” la `format=xlsx`, iar `randeazaXlsx` aruncă pentru orice document cu secțiuni, ca o unealtă viitoare să nu piardă tăcut jumătate din document. Asta nu contrazice toleranța din B (D10): acolo un format necunoscut cade pe PDF, iar regula rămâne. Aici formatul există, dar nu e al uneltei, și nicio pagină n-a oferit vreodată Excelul fișei.
- **D10. Rândul „Generat gratuit cu administrativo.ro” rămâne.** Stă pe ultima pagină, cu 7 pt gri, sub notele fișei și în afara rubricilor anexei. E singurul canal prin care un fișier trimis mai departe aduce un om înapoi (UTM `fisier`). Nicio normă nu interzice un asemenea rând pe un formular completat de angajator. **Notă de coordonare (criticul de completitudine, 8 oct 2026):** ordinea fixată e E4–E6 → G1–G4 → H. G3 (decizia D8 din G) pune legătura în marginea de jos a FIECĂREI pagini, pentru toate uneltele. Pe fișa SSM rândul apare deci pe fiecare pagină, tot în margine, la 7 pt, în afara rubricilor anexei. Forma asta se acceptă. H2 aplică diff-ul pe `deseneaza` așa cum l-a lăsat G3 și NU readuce desenarea doar pe ultima pagină. Descrierea paginilor de la H6 Pasul 5 („pagina 4: … „Generat gratuit…””) se citește „pe fiecare pagină, în margine”.
- **D11. Anexa 12 (fișa colectivă) nu se construiește în secțiunea asta.** Are alt public (prestatori și vizitatori, art. 82 alin. (2)–(4)), alt mod de completare (în 2 exemplare, cu tabel nominal) și nicio cerere măsurată. Pagina o numește într-o frază, cu articolul. Cu D1, o unealtă pentru anexa 12 devine un model și o pagină noi, fără renderer nou.
- **D12. Fără mod „lot”** (mai mulți angajați într-un fișier). Adresa cade la Cloudflare (520) pe la 8 KB (B, D7), iar numele mai multor oameni în URL înmulțesc tocmai datele pe care secțiunea A le scoate din jurnale.
- **D13. Fără bază de date, fără sesiune, fără migrare.** Toate intrările vin din adresă, mărginite: text la 120 de caractere, ore întregi 1–40, date reale, liste închise.
- **D14. Titlul și descrierea paginii.** Titlul devine „Fișa individuală de instruire SSM: model gratuit” (48 de caractere, exact plafonul de 48). Conține „individuală” și „model”, ambele din interogarea pe care stă primul zarinacrm („fișa individuală de instruire SSM model”). Titlul de azi („Fișa de instruire SSM: model PDF și Word”) are „model”; varianta propusă inițial aici, „…: Word, PDF”, îl pierdea, iar testul lui K1 (`seo-unelte.test.ts`, „titlul conține fiecare cuvânt al termenului principal”, termenul `fisa instruire ssm model`) ar fi căzut pe ea. „Word, PDF” rămâne în descriere. Descrierea are 152 de caractere (testul `descrieri.test.ts` cere 70–160) și numește părțile noi.
- **D15. Testabilitatea PDF-ului: o sondă opțională (`SondaPdf`).** `pdf-lib` nu poate citi textul înapoi: fontul DejaVu e subsetat, iar glifele sunt CID, iar în `node_modules` nu există niciun extractor (`pdfjs`, `pdf-parse`, `unpdf`; verificat). `randeazaPdf(d, sonda?)` raportează fiecare text și fiecare casetă desenată, cu pagina lor. Rutele nu o folosesc. Fără sondă, ieșirea e identică.
- **D16. Formularul vine imediat sub antet, normele după document.** Cine vine din căutare vrea fișa. Banda „Ce spun normele” devine „Cine face fiecare instruire și când”: fiecare rând are „Cine:” (art. 85, 91, 94, 96, 99) și art. 98 lit. a)–g) complet.

### Harta fișierelor

| Fișier | Responsabilitate | Task |
| --- | --- | --- |
| `src/lib/unelte/document-tabelar.ts` | tipurile `Sectiune*`, câmpurile `sectiuni` și `antetRulant`, `textAntetRulant` care preferă `antetRulant`, `curataSectiune` | H1 |
| `src/lib/unelte/sectiuni.test.ts` (nou, crește pe taskuri) | curățarea secțiunilor; PDF, Word și Excel cu secțiuni | H1, H2, H3, H5 |
| `src/lib/unelte/pdf.ts` | secțiunile în `deseneaza`, rubrici de semnătură, casete de viză, tabele scurte nerupte, `SondaPdf`, `INALT_CASETA` | H2 |
| `src/lib/unelte/docx.ts` | `blocuriSectiune`: aceleași secțiuni în Word, cu rânduri `atLeast` și `cantSplit` | H3 |
| `src/app/(marketing)/_componente/previzualizare-document.tsx` | `TabelHtml`, `SectiuneHtml`: aceleași secțiuni pe ecran | H4 |
| `src/app/(marketing)/_componente/previzualizare-sectiuni.test.tsx` (nou) | previzualizarea cu secțiuni | H4 |
| `src/lib/unelte/xlsx.ts` | refuză documentele cu secțiuni | H5 |
| `src/lib/unelte/registru.ts`, `registru.test.ts` | `formatePentru(slug)` | H5 |
| `src/app/api/unelte/[unealta]/route.ts`, `route.test.ts` | 400 pentru un format pe care unealta nu-l are | H5 |
| `src/app/(marketing)/unelte/fisa-instruire-ssm/model.ts` | fișa completă, parametrii noi, `randuriPeriodice`, `caseteViza`, `scadentePeriodice`, `INSTRUIRI_SSM` cu „cine” | H6 |
| `src/app/(marketing)/unelte/fisa-instruire-ssm/model.test.ts` | rescris: rubricile anexei, rândurile, intrările, termenele, normele | H6 |
| `e2e/unelte-tipar.spec.ts` (din B6) | intrarea SSM: portret, câte pagini | H6, H7 |
| `src/content/landing/harta.ts` | `actualizat` pentru `/unelte/fisa-instruire-ssm` | H6, H7 |
| `src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx` | formularul extins, termenele, normele, metadatele | H7 |
| `src/app/(marketing)/unelte/fisa-instruire-ssm/pagina.test.tsx` (nou) | pagina randată | H7 |
| `src/content/landing/unelte.ts`, `src/app/llms.txt/route.ts`, `src/app/(marketing)/unelte/page.tsx`, `src/content/landing/ro.ts`, `src/content/landing/en.ts` | lead-ul, descrierea pentru LLM, nota din hub, cardurile de pe landing | H7 |
| — | deploy staging → confirmare → producție, verificarea live | H8 |

Ordinea: H1 → H2 → H3 → H4 → H5 → H6 → H7 → H8. H2, H3 și H4 depind doar de H1. H5 e independent de H2–H4. H6 cere H1–H5: fără ele, fișa nouă ar ieși în PDF și Word fără secțiuni, iar Excelul ar da 500. H7 cere H6. H8 cere H7 și o confirmare de la utilizator.

---

### Task H1: Modelul comun primește secțiuni și antet rulant

**Fișiere:**
- Modify: `src/lib/unelte/document-tabelar.ts`: sfârșitul tipului `DocumentTabelar` (câmpul `inaltimeRand` scris de E4), `textAntetRulant` (E4), coada lui `curataDocument` (B2)
- Test: `src/lib/unelte/sectiuni.test.ts` (Create)

**Interfețe:**
- Consumă: `curataText(text: string): string`, `curataDocument(d: DocumentTabelar): DocumentTabelar` (B2); `textAntetRulant(d: DocumentTabelar): string` (E4); `type Coloana`.
- Produce:
  ```ts
  // în DocumentTabelar:
  sectiuni?: readonly Sectiune[];
  antetRulant?: string;
  export type SectiuneText = Readonly<{ tip: "text"; titlu: string | null; paragrafe: readonly string[]; semnaturi: readonly string[] }>;
  export type SectiuneTabel = Readonly<{ tip: "tabel"; titlu: string; coloane: readonly Coloana[]; randuri: readonly (readonly string[])[]; inaltimeRand?: number }>;
  export type SectiuneCasete = Readonly<{ tip: "casete"; titlu: string; numar: number; rubrica: string; semnaturi: readonly string[]; nota: string | null }>;
  export type Sectiune = SectiuneText | SectiuneTabel | SectiuneCasete;
  export function curataSectiune(s: Sectiune): Sectiune;
  export function textAntetRulant(d: DocumentTabelar): string; // neschimbată ca semnătură; preferă d.antetRulant
  ```

- [ ] **Pasul 0: Precondițiile** (blocul de `grep` de la începutul secțiunii, rândurile B2 și E4).

- [ ] **Pasul 1: Scrie testul care pică**

Creează `src/lib/unelte/sectiuni.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { curataDocument, textAntetRulant, type DocumentTabelar } from "./document-tabelar";

/**
 * Documentele cu secțiuni (fișa SSM, anexa 11 la HG 1425/2006): mai multe
 * tabele, rubrici de semnătură etichetate, casete de viză, antet pe fiecare
 * pagină și „Pagina x din y”. Auditul din 8 oct 2026 a găsit fișa fără cinci
 * părți ale anexei, cu rânduri de 5,6 mm și o a doua pagină fără nume.
 */

const SEMNATURI = [
  "Semnătura celui instruit",
  "Semnătura celui care a efectuat instruirea",
  "Semnătura celui care a verificat însușirea cunoștințelor",
];

const CU_SECTIUNI: DocumentTabelar = {
  titlu: "Fișă de instruire individuală privind securitatea și sănătatea în muncă",
  subtitlu: "Întreprinderea/unitatea: Țesătoria Ardeleana SRL",
  campuri: [{ eticheta: "Numele și prenumele", valoare: "Popescu Ștefanța" }],
  paragrafe: [],
  coloane: [],
  randuri: [],
  umbrite: [],
  note: ["Se păstrează la conducătorul locului de muncă."],
  semnaturi: [],
  orientare: "portret",
  numeFisier: "fisa-ssm-test",
  antetRulant: "Fișă de instruire individuală SSM — Popescu Ștefanța — Țesătoria Ardeleana SRL",
  sectiuni: [
    {
      tip: "text",
      titlu: "Instruirea la angajare",
      paragrafe: ["1) Instruirea introductiv-generală a fost efectuată la data __________."],
      semnaturi: SEMNATURI,
    },
    {
      tip: "tabel",
      titlu: "Instruirea periodică",
      coloane: [
        { eticheta: "Data\ninstruirii", latime: 2 },
        { eticheta: "Materialul predat", latime: 5 },
        { eticheta: "Semnătura\ncelui\ninstruit", latime: 2 },
      ],
      randuri: Array.from({ length: 40 }, () => ["", "", ""]),
      inaltimeRand: 28,
    },
    {
      tip: "tabel",
      titlu: "Rezultatele testărilor",
      coloane: [
        { eticheta: "Data", latime: 2 },
        { eticheta: "Calificativ", latime: 3 },
      ],
      randuri: Array.from({ length: 5 }, () => ["", ""]),
    },
    {
      tip: "casete",
      titlu: "Control medical periodic",
      numar: 7,
      rubrica: "Observații de specialitate",
      semnaturi: ["Semnătura și parafa medicului de medicina muncii", "Data vizei"],
      nota: "* notă de test",
    },
  ],
};

/** Același document, fără secțiuni și fără antet: cum arată celelalte unelte. */
const { sectiuni: _sectiuni, antetRulant: _antet, ...BAZA } = CU_SECTIUNI;
const SIMPLU: DocumentTabelar = {
  ...BAZA,
  coloane: [{ eticheta: "Nume", latime: 1 }],
  randuri: [["Ana"]],
};

describe("curățarea textului ajunge și în secțiuni", () => {
  it("curataDocument curăță titlurile, celulele, rubricile și antetul rulant", () => {
    const murdar: DocumentTabelar = {
      ...CU_SECTIUNI,
      antetRulant: "Popa\u000BIon",
      sectiuni: [
        { tip: "text", titlu: "A\u0001", paragrafe: ["b\u0000c"], semnaturi: ["d\u001F"] },
        {
          tip: "tabel",
          titlu: "T\u000C",
          coloane: [{ eticheta: "E\u0002", latime: 1 }],
          randuri: [["x\u0007"]],
        },
        {
          tip: "casete",
          titlu: "C",
          numar: 2,
          rubrica: "R\u0003",
          semnaturi: ["S"],
          nota: "N\u0004",
        },
      ],
    };
    const d = curataDocument(murdar);
    expect(d.antetRulant).toBe("Popa Ion");
    expect(JSON.stringify(d.sectiuni)).not.toMatch(/\\u000[0-9a-f]|\\u001[0-9a-f]/u);
    expect(d.sectiuni?.[2]).toMatchObject({ numar: 2, rubrica: "R", nota: "N" });
  });

  it("antetul rulant e numele lucrătorului când documentul îl dă", () => {
    expect(textAntetRulant(CU_SECTIUNI)).toBe(CU_SECTIUNI.antetRulant);
    expect(textAntetRulant(SIMPLU)).toBe(`${SIMPLU.titlu} · ${SIMPLU.subtitlu ?? ""}`);
  });

  it("un document fără secțiuni nu primește chei noi", () => {
    const d = curataDocument(SIMPLU);
    expect("sectiuni" in d).toBe(false);
    expect("antetRulant" in d).toBe(false);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/sectiuni.test.ts
```

Ce trebuie să cadă (am verificat pe codul de după B2 și E4):
- `curataDocument curăță titlurile, celulele, rubricile și antetul rulant`: `expected 'Popa\u000bIon' to be 'Popa Ion'` (B2 copiază câmpurile necunoscute fără să le curețe);
- `antetul rulant e numele lucrătorului când documentul îl dă`: `expected 'Fișă de instruire individuală privind…' to be 'Fișă de instruire individuală SSM — P…'`.

Testul „un document fără secțiuni nu primește chei noi” trece și înainte. E o pază pentru pasul 3: spread-ul condiționat nu are voie să adauge `sectiuni: undefined` (`exactOptionalPropertyTypes`).

- [ ] **Pasul 3: Implementarea minimă**

În `src/lib/unelte/document-tabelar.ts`, blocul scris de E4 la sfârșitul tipului:

```ts
  /**
   * Înălțimea minimă a unui rând din corpul tabelului, în puncte. Absentă = 16,
   * cât încape un rând de text. Condica o ridică la 22: acolo se semnează de
   * mână pe fiecare rând (auditul din 8 oct 2026 a măsurat 5,6 mm).
   */
  inaltimeRand?: number;
}>;
```

devine:

```ts
  /**
   * Înălțimea minimă a unui rând din corpul tabelului, în puncte. Absentă = 16,
   * cât încape un rând de text. Condica o ridică la 22: acolo se semnează de
   * mână pe fiecare rând (auditul din 8 oct 2026 a măsurat 5,6 mm).
   */
  inaltimeRand?: number;
  /**
   * Părțile de după tabelul principal, în ordine. Lipsă = niciuna, deci uneltele
   * care nu le cer ies neschimbate. Le folosește fișa SSM: anexa 11 la HG
   * 1425/2006 are trei puncte de text cu semnături, cinci tabele și două grupuri
   * de casete de viză.
   */
  sectiuni?: readonly Sectiune[];
  /**
   * Rândul de sus de pe paginile 2+ și din antetul Word, când titlul și
   * subtitlul nu spun destul. Fișa SSM pune aici numele lucrătorului: o foaie
   * desprinsă dintr-o fișă de 4 pagini trebuie să poată fi atribuită omului ei
   * (auditul din 8 oct 2026). Lipsă = `titlu · subtitlu`.
   */
  antetRulant?: string;
}>;

/** Text cu titlu, urmat de rubrici de semnătură etichetate, pe un rând. */
export type SectiuneText = Readonly<{
  tip: "text";
  titlu: string | null;
  paragrafe: readonly string[];
  /** Fiecare etichetă primește o casetă cu loc de semnat sub ea. */
  semnaturi: readonly string[];
}>;

/** Un tabel cu titlul lui; rândurile goale sunt locul de completat de mână. */
export type SectiuneTabel = Readonly<{
  tip: "tabel";
  titlu: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
  /** Ca `inaltimeRand` al documentului, dar doar pentru tabelul ăsta. Lipsă = 16 pt. */
  inaltimeRand?: number;
}>;

/** Casete de viză (medicina muncii, psiholog), câte două pe rând. */
export type SectiuneCasete = Readonly<{
  tip: "casete";
  titlu: string;
  numar: number;
  /** Capul fiecărei casete („Observații de specialitate”). */
  rubrica: string;
  /** Etichetele din josul casetei, de la stânga la dreapta. */
  semnaturi: readonly string[];
  /** Nota de sub casete (asteriscul din anexă), sau `null`. */
  nota: string | null;
}>;

export type Sectiune = SectiuneText | SectiuneTabel | SectiuneCasete;
```

Funcția scrisă de E4:

```ts
export function textAntetRulant(d: DocumentTabelar): string {
  return d.subtitlu === null ? d.titlu : `${d.titlu} · ${d.subtitlu}`;
}
```

devine:

```ts
export function textAntetRulant(d: DocumentTabelar): string {
  if (d.antetRulant !== undefined) return d.antetRulant;
  return d.subtitlu === null ? d.titlu : `${d.titlu} · ${d.subtitlu}`;
}
```

Coada lui `curataDocument` (B2):

```ts
    note: d.note.map((n) => curataText(n)),
    semnaturi: d.semnaturi.map((s) => curataText(s)),
  };
}
```

devine:

```ts
    note: d.note.map((n) => curataText(n)),
    semnaturi: d.semnaturi.map((s) => curataText(s)),
    // `exactOptionalPropertyTypes`: cheia lipsă rămâne lipsă, nu devine `undefined`.
    ...(d.sectiuni === undefined ? {} : { sectiuni: d.sectiuni.map((s) => curataSectiune(s)) }),
    ...(d.antetRulant === undefined ? {} : { antetRulant: curataText(d.antetRulant) }),
  };
}

/** O secțiune, cu fiecare text trecut prin `curataText`; numerele rămân. */
export function curataSectiune(s: Sectiune): Sectiune {
  switch (s.tip) {
    case "text":
      return {
        ...s,
        titlu: s.titlu === null ? null : curataText(s.titlu),
        paragrafe: s.paragrafe.map((p) => curataText(p)),
        semnaturi: s.semnaturi.map((e) => curataText(e)),
      };
    case "tabel":
      return {
        ...s,
        titlu: curataText(s.titlu),
        coloane: s.coloane.map((c) => ({ ...c, eticheta: curataText(c.eticheta) })),
        randuri: s.randuri.map((rand) => rand.map((celula) => curataText(celula))),
      };
    case "casete":
      return {
        ...s,
        titlu: curataText(s.titlu),
        rubrica: curataText(s.rubrica),
        semnaturi: s.semnaturi.map((e) => curataText(e)),
        nota: s.nota === null ? null : curataText(s.nota),
      };
  }
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte
pnpm exec prettier --write src/lib/unelte/document-tabelar.ts src/lib/unelte/sectiuni.test.ts && pnpm exec prettier --check src/lib/unelte/document-tabelar.ts src/lib/unelte/sectiuni.test.ts
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

`sectiuni.test.ts`: 3 teste verzi. `randari.test.ts`, `pdf-pagini.test.ts` (E4), `docx-sectiuni.test.ts` (E5): neschimbate, verzi. Testul lui E „antetul rulant are titlul și, când există, subtitlul” rămâne verde, fiindcă documentele lui n-au `antetRulant`.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(src/lib/unelte/document-tabelar.ts src/lib/unelte/sectiuni.test.ts)
git add -- src/lib/unelte/sectiuni.test.ts
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
feat(unelte): modelul comun primește secțiuni și antet rulant

Fișa SSM (anexa 11 la HG 1425/2006) are trei puncte de text cu semnături,
cinci tabele și două grupuri de casete de viză; modelul comun avea un singur
tabel. `sectiuni` și `antetRulant` sunt opționale: celelalte unelte ies
neschimbate. `curataDocument` curăță și secțiunile, deci Word-ul rămâne
valid cu orice text lipit.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
git push origin main
node scripts/checks/lastmod.mjs
```

---

### Task H2: PDF-ul randează secțiunile, rubricile de semnătură și casetele de viză

**Fișiere:**
- Modify: `src/lib/unelte/pdf.ts`: importul din `./document-tabelar`, linia `type Masurare` (E4) și tot blocul de la `export async function randeazaPdf(d: DocumentTabelar): Promise<Uint8Array> {` până la sfârșitul fișierului (blocul scris de E4)
- Test: `src/lib/unelte/sectiuni.test.ts`

**Interfețe:**
- Consumă: `type Sectiune`, `type SectiuneCasete`, `type Coloana`, `textAntetRulant`, `textPagina` (H1, E4); `pornesteDocument`, `type Fonturi` din `@/lib/pdf/document`.
- Produce:
  ```ts
  export type SondaPdf = Readonly<{ text: (pagina: number, text: string) => void; cutie: (pagina: number, inaltime: number) => void }>;
  export const INALT_CASETA = 96;
  export async function randeazaPdf(d: DocumentTabelar, sonda?: SondaPdf): Promise<Uint8Array>;
  export async function randeazaPdfMultiplu(documente: readonly DocumentTabelar[], sonda?: SondaPdf): Promise<Uint8Array>;
  ```
  `RANDARI` din `raspuns.ts` primește în continuare `(d) => Promise<Uint8Array>`: al doilea parametru e opțional.

- [ ] **Pasul 0: Precondițiile** (rândurile E4) și `git log --oneline -3 -- src/lib/unelte/pdf.ts`: ultimul commit e al lui E4 sau al lui H1, nu al altei secțiuni. Dacă e al alteia, citește fișierul și aplică blocul nou peste forma lui reală.

- [ ] **Pasul 1: Scrie testul care pică**

În `src/lib/unelte/sectiuni.test.ts`, înlocuiește importurile (liniile 1–3):

```ts
import { describe, expect, it } from "vitest";

import { curataDocument, textAntetRulant, type DocumentTabelar } from "./document-tabelar";
```

cu:

```ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  curataDocument,
  textAntetRulant,
  textPagina,
  type DocumentTabelar,
} from "./document-tabelar";
import { INALT_CASETA, randeazaPdf, type SondaPdf } from "./pdf";
```

și adaugă la sfârșitul fișierului:

```ts
function sonda() {
  const texte: { pagina: number; text: string }[] = [];
  const cutii: { pagina: number; inaltime: number }[] = [];
  const s: SondaPdf = {
    text: (pagina, text) => texte.push({ pagina, text }),
    cutie: (pagina, inaltime) => cutii.push({ pagina, inaltime }),
  };
  return { s, texte, cutii };
}

describe("PDF cu secțiuni", () => {
  it("scrie fiecare titlu de secțiune și fiecare rubrică de semnătură, întreagă", async () => {
    const { s, texte } = sonda();
    await randeazaPdf(CU_SECTIUNI, s);
    const tot = texte.map((t) => t.text).join("\n");
    for (const titlu of [
      "Instruirea la angajare",
      "Instruirea periodică",
      "Rezultatele testărilor",
      "Control medical periodic",
    ]) {
      expect(tot).toContain(titlu);
    }
    // Eticheta lungă se rupe pe rânduri, nu se taie cu „…”.
    expect(tot.replace(/\n/gu, " ")).toContain("însușirea cunoștințelor");
    expect(texte.filter((t) => t.text.includes("…"))).toEqual([]);
  });

  it("rândurile de completat de mână au înălțimea cerută (28 pt ≈ 9,9 mm)", async () => {
    const { s, cutii } = sonda();
    await randeazaPdf(CU_SECTIUNI, s);
    // 40 de rânduri cu 28 pt; antetele și tabelul fără `inaltimeRand` rămân mai joase.
    expect(cutii.filter((c) => c.inaltime === 28)).toHaveLength(40);
    expect(cutii.filter((c) => c.inaltime === 16).length).toBeGreaterThanOrEqual(5);
  });

  it("desenează câte o casetă de viză pentru fiecare, inclusiv ultima, fără pereche", async () => {
    const { s, cutii } = sonda();
    await randeazaPdf(CU_SECTIUNI, s);
    expect(cutii.filter((c) => c.inaltime === INALT_CASETA)).toHaveLength(7);
  });

  it("pune numele pe fiecare pagină de la a doua și „Pagina x din y” pe toate", async () => {
    const { s, texte } = sonda();
    const pdf = await PDFDocument.load(await randeazaPdf(CU_SECTIUNI, s));
    const n = pdf.getPageCount();
    expect(n).toBeGreaterThan(1);
    for (let p = 1; p <= n; p += 1) {
      const pePagina = texte.filter((t) => t.pagina === p).map((t) => t.text);
      expect(pePagina, `pagina ${String(p)}`).toContain(textPagina(p - 1, n));
      if (p > 1) expect(pePagina, `pagina ${String(p)}`).toContain(CU_SECTIUNI.antetRulant);
    }
    expect(pdf.getPage(0).getHeight()).toBeGreaterThan(pdf.getPage(0).getWidth()); // portret
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/sectiuni.test.ts
```

Ce trebuie să cadă (verificat pe codul E4):
- `scrie fiecare titlu de secțiune…`: `expected '' to contain 'Instruirea la angajare'` (randarea veche ignoră sonda și secțiunile);
- `rândurile de completat de mână…`: `expected [] to have a length of 40 but got +0`;
- `desenează câte o casetă de viză…`: `expected [] to have a length of 7 but got +0`;
- `pune numele pe fiecare pagină…`: `expected 1 to be greater than 1` (fără secțiuni, documentul încape pe o pagină).

- [ ] **Pasul 3: Implementarea minimă**

În `src/lib/unelte/pdf.ts`, importul:

```ts
  textAntetRulant,
  textPagina,
  type DocumentTabelar,
} from "./document-tabelar";
```

devine:

```ts
  textAntetRulant,
  textPagina,
  type Coloana,
  type DocumentTabelar,
  type SectiuneCasete,
} from "./document-tabelar";
```

Linia scrisă de E4:

```ts
type Masurare = (font: PDFFont, marime: number) => (t: string) => number;
```

devine:

```ts
type Masurare = (font: PDFFont, marime: number) => (t: string) => number;

/** Rubrica de semnătură dintr-o secțiune de text: eticheta sus, loc de semnat dedesubt. */
const INALT_SEMNATURA = 46;
/** Caseta de viză (medicina muncii, psiholog): rubrica, trei linii, etichetele de jos. */
export const INALT_CASETA = 96;
const SPATIU_CASETE = 12;
/** Antetul de tabel cel mai înalt al fișei SSM: trei rânduri de etichetă. */
const INALT_ANTET_MAX = INALT_RAND + 2 * (MARIME + 2);
/** Tabelele de secțiune cu atâtea rânduri sau mai puține nu se rup între pagini. */
const RANDURI_NERUPTE = 6;

/**
 * Ce desenează randarea, pentru teste. `pdf-lib` nu poate citi textul înapoi:
 * fontul e subsetat, iar în fișier glifele sunt identificatori CID, nu litere.
 * `pagina` se numără în documentul curent, de la 1; `inaltime` e în puncte.
 */
export type SondaPdf = Readonly<{
  text: (pagina: number, text: string) => void;
  cutie: (pagina: number, inaltime: number) => void;
}>;
```

Tot blocul de la `export async function randeazaPdf(d: DocumentTabelar): Promise<Uint8Array> {` până la sfârșitul fișierului se înlocuiește cu blocul de mai jos. Față de E4 se schimbă patru lucruri:
- `deseneaza` primește `sonda`, iar textul din corpul paginii trece prin `text(…)`;
- `rand` și `tabel` primesc lățimi și coloane umbrite proprii (implicit, ale tabelului principal);
- după tabelul principal se desenează secțiunile;
- antetul rulant și numărul paginii se raportează sondei.

Restul codului lui E4 (chenarul, centrarea pe verticală, adnotarea URI, marginile) rămâne la caracter.

```ts
export async function randeazaPdf(d: DocumentTabelar, sonda?: SondaPdf): Promise<Uint8Array> {
  return randeazaPdfMultiplu([d], sonda);
}

/**
 * Mai multe documente într-un singur PDF, fiecare de la pagină nouă și cu
 * numerotarea lui („Pagina 1 din 1” nu se scrie). Fontul se încorporează O
 * DATĂ: lipite din PDF-uri separate, 60 de fișe ar fi purtat 60 de subseturi.
 */
export async function randeazaPdfMultiplu(
  documente: readonly DocumentTabelar[],
  sonda?: SondaPdf,
): Promise<Uint8Array> {
  const primul = documente[0];
  if (primul === undefined) throw new Error("Niciun document de randat.");
  const { doc, fonturi } = await pornesteDocument(primul.titlu, "Administrativo");

  // Memorizat pe randare: la condică același nume apare pe fiecare zi lucrătoare,
  // iar fiecare măsurătoare e o așezare OpenType completă. Fără cache, 60 de nume
  // × 21 de zile costau ~2,4 s; cheile sunt mărginite de document.
  const masurate = new Map<string, number>();
  const masoara: Masurare = (font, marime) => (t) => {
    const cheie = `${font === fonturi.aldin ? "a" : "n"}${String(marime)}|${t}`;
    let latimeText = masurate.get(cheie);
    if (latimeText === undefined) {
      latimeText = font.widthOfTextAtSize(t, marime);
      masurate.set(cheie, latimeText);
    }
    return latimeText;
  };

  for (const d of documente) deseneaza(doc, fonturi, masoara, d, sonda);
  return doc.save();
}

function deseneaza(
  doc: PDFDocument,
  fonturi: Fonturi,
  masoara: Masurare,
  d: DocumentTabelar,
  sonda: SondaPdf | undefined,
): void {
  const [latime, inaltime] = dimensiuni(d);
  const util = latime - 2 * MARGINE;
  /** Cât încape pe o pagină goală, între marginea de sus și rezerva subsolului. */
  const inaltimeUtila = inaltime - 2 * MARGINE - REZERVA_SUBSOL;
  const latimi = latimiColoane(d);
  const inaltCorp = Math.max(INALT_RAND, d.inaltimeRand ?? INALT_RAND);

  const pagini: PDFPage[] = [];
  let pagina = doc.addPage([latime, inaltime]);
  pagini.push(pagina);
  let y = inaltime - MARGINE;

  /**
   * Singurul loc care scrie text în corpul paginii: sonda testelor vede tot ce
   * apare și pe ce pagină (numărată în documentul curent, de la 1).
   */
  const text = (
    continut: string,
    x: number,
    yText: number,
    marime: number,
    font: PDFFont,
    culoare = NEGRU,
  ) => {
    pagina.drawText(continut, { x, y: yText, size: marime, font, color: culoare });
    if (continut !== "") sonda?.text(pagini.length, continut);
  };
  const paginaNoua = () => {
    pagina = doc.addPage([latime, inaltime]);
    pagini.push(pagina);
    y = inaltime - MARGINE;
  };
  const asiguraLoc = (necesar: number) => {
    if (y - necesar < MARGINE + REZERVA_SUBSOL) paginaNoua();
  };
  /** Proză pe mai multe rânduri; doar celulele de tabel se taie cu „…”. */
  const scrie = (continut: string, marime: number, font: PDFFont, culoare = NEGRU) => {
    const randuri = imparte(continut, util, masoara(font, marime));
    randuri.forEach((rand, k) => {
      asiguraLoc(marime + 6);
      text(rand, MARGINE, y - marime, marime, font, culoare);
      y -= k === randuri.length - 1 ? marime + 6 : marime + 3;
    });
  };

  scrie(d.titlu, 14, fonturi.aldin);
  if (d.subtitlu !== null) scrie(d.subtitlu, 9, fonturi.normal, GRI);
  y -= 4;
  for (const c of d.campuri) {
    scrie(`${c.eticheta}: ${c.valoare === "" ? LINIE_GOALA : c.valoare}`, 9, fonturi.normal);
  }
  y -= 4;
  for (const p of d.paragrafe) scrie(p, 10, fonturi.normal);

  /**
   * Un rând de tabel. Etichetele pot avea `\n` (antetul foii de pontaj pune
   * ziua deasupra literei): rândul crește cu numărul de linii, iar fiecare linie
   * se taie separat la lățimea coloanei. Un rând mai înalt decât textul lui
   * (condica, 22 pt) își centrează textul pe verticală. Tabelele secțiunilor
   * (fișa SSM) își dau propriile lățimi; tabelul principal le ia pe ale lui.
   */
  const rand = (
    celule: readonly string[],
    aldin: boolean,
    inaltMinim: number,
    latimiRand: readonly number[] = latimi,
    umbrite: readonly number[] = d.umbrite,
  ) => {
    const font = aldin ? fonturi.aldin : fonturi.normal;
    const linii = celule.map((c) => c.split("\n"));
    const nrLinii = Math.max(1, ...linii.map((l) => l.length));
    const inaltText = INALT_RAND + (nrLinii - 1) * (MARIME + 2);
    const inalt = Math.max(inaltMinim, inaltText);
    const sus = 11 + (inalt - inaltText) / 2;
    let x = MARGINE;
    latimiRand.forEach((w, i) => {
      if (umbrite.includes(i)) {
        pagina.drawRectangle({ x, y: y - inalt, width: w, height: inalt, color: UMBRA });
      }
      pagina.drawRectangle({
        x,
        y: y - inalt,
        width: w,
        height: inalt,
        borderColor: CHENAR,
        borderWidth: 0.5,
      });
      (linii[i] ?? [""]).forEach((linie, k) => {
        text(
          taie(linie, w - 4, masoara(font, MARIME)),
          x + 2,
          y - sus - k * (MARIME + 2),
          MARIME,
          font,
        );
      });
      x += w;
    });
    sonda?.cutie(pagini.length, inalt);
    y -= inalt;
  };

  /** Un tabel cu antetul repetat pe fiecare pagină nouă. */
  const tabel = (
    coloane: readonly Coloana[],
    randuri: readonly (readonly string[])[],
    inaltMinim: number,
    latimiRand: readonly number[] = latimi,
    umbrite: readonly number[] = d.umbrite,
  ) => {
    const antet = coloane.map((c) => c.eticheta);
    asiguraLoc(INALT_RAND * 3);
    rand(antet, true, INALT_RAND, latimiRand, umbrite);
    for (const r of randuri) {
      if (y - inaltMinim < MARGINE + REZERVA_SUBSOL) {
        paginaNoua();
        rand(antet, true, INALT_RAND, latimiRand, umbrite); // antetul se repetă pe fiecare pagină
      }
      rand(r, false, inaltMinim, latimiRand, umbrite);
    }
  };

  /** Lățimile unui tabel de secțiune, întinse pe lățimea utilă, ca la `latimiColoane`. */
  const latimiDin = (coloane: readonly Coloana[]) => {
    const total = coloane.reduce((s, c) => s + c.latime, 0);
    return coloane.map((c) => (total === 0 ? 0 : (c.latime / total) * util));
  };

  /** Rubrici de semnătură etichetate, pe un rând: eticheta sus, loc de semnat dedesubt. */
  const caseteSemnatura = (etichete: readonly string[]) => {
    const pas = util / etichete.length;
    asiguraLoc(INALT_SEMNATURA + 6);
    y -= 4;
    etichete.forEach((eticheta, i) => {
      const x = MARGINE + i * pas;
      pagina.drawRectangle({
        x,
        y: y - INALT_SEMNATURA,
        width: pas - 6,
        height: INALT_SEMNATURA,
        borderColor: CHENAR,
        borderWidth: 0.5,
      });
      imparte(eticheta, pas - 14, masoara(fonturi.normal, 7))
        .slice(0, 2)
        .forEach((r, k) => {
          text(r, x + 4, y - 10 - k * 9, 7, fonturi.normal, GRI);
        });
      sonda?.cutie(pagini.length, INALT_SEMNATURA);
    });
    y -= INALT_SEMNATURA + 6;
  };

  /** O casetă de viză, cu colțul din stânga sus la (x, y). */
  const caseta = (x: number, w: number, s: SectiuneCasete) => {
    pagina.drawRectangle({
      x,
      y: y - INALT_CASETA,
      width: w,
      height: INALT_CASETA,
      borderColor: CHENAR,
      borderWidth: 0.5,
    });
    text(taie(s.rubrica, w - 12, masoara(fonturi.normal, 8)), x + 6, y - 14, 8, fonturi.normal);
    for (const jos of [30, 44, 58]) {
      pagina.drawLine({
        start: { x: x + 6, y: y - jos },
        end: { x: x + w - 6, y: y - jos },
        thickness: 0.5,
        color: CHENAR,
      });
    }
    const pas = (w - 12) / Math.max(1, s.semnaturi.length);
    s.semnaturi.forEach((eticheta, i) => {
      imparte(eticheta, pas - 6, masoara(fonturi.normal, 7))
        .slice(0, 2)
        .forEach((r, k) => {
          text(r, x + 6 + i * pas, y - 74 - k * 9, 7, fonturi.normal, GRI);
        });
    });
    sonda?.cutie(pagini.length, INALT_CASETA);
  };

  if (d.coloane.length > 0) tabel(d.coloane, d.randuri, inaltCorp);

  for (const s of d.sectiuni ?? []) {
    switch (s.tip) {
      case "text": {
        y -= 6;
        if (s.titlu !== null) {
          asiguraLoc(60);
          scrie(s.titlu, 10, fonturi.aldin);
        }
        for (const p of s.paragrafe) scrie(p, 9, fonturi.normal);
        if (s.semnaturi.length > 0) caseteSemnatura(s.semnaturi);
        break;
      }
      case "tabel": {
        const inaltMinim = Math.max(INALT_RAND, s.inaltimeRand ?? INALT_RAND);
        y -= 6;
        // Titlul nu rămâne singur jos pe pagină: încape cu antetul și două rânduri.
        // Un tabel scurt (testări, accidente, sancțiuni: 5 rânduri) nu se rupe deloc.
        const intreg = 16 + INALT_ANTET_MAX + s.randuri.length * inaltMinim;
        asiguraLoc(
          s.randuri.length <= RANDURI_NERUPTE && intreg <= inaltimeUtila
            ? intreg
            : 16 + INALT_RAND + 2 * inaltMinim,
        );
        scrie(s.titlu, 10, fonturi.aldin);
        tabel(s.coloane, s.randuri, inaltMinim, latimiDin(s.coloane), []);
        break;
      }
      case "casete": {
        y -= 6;
        // Grupul de casete stă pe o singură pagină când încape; altfel măcar un rând.
        const intreg = 16 + Math.ceil(s.numar / 2) * (INALT_CASETA + SPATIU_CASETE);
        asiguraLoc(intreg <= inaltimeUtila ? intreg : 16 + INALT_CASETA + SPATIU_CASETE);
        scrie(s.titlu, 10, fonturi.aldin);
        const w = (util - SPATIU_CASETE) / 2;
        for (let k = 0; k < s.numar; k += 2) {
          asiguraLoc(INALT_CASETA + SPATIU_CASETE);
          caseta(MARGINE, w, s);
          if (k + 1 < s.numar) caseta(MARGINE + w + SPATIU_CASETE, w, s);
          y -= INALT_CASETA + SPATIU_CASETE;
        }
        if (s.nota !== null) scrie(s.nota, 8, fonturi.normal, GRI);
        break;
      }
    }
  }

  y -= 10;
  for (const n of d.note) scrie(n, 8, fonturi.normal, GRI);

  if (d.semnaturi.length > 0) {
    asiguraLoc(50);
    y -= 30;
    const pas = util / d.semnaturi.length;
    d.semnaturi.forEach((eticheta, i) => {
      const x = MARGINE + i * pas;
      pagina.drawLine({
        start: { x, y },
        end: { x: x + pas - 24, y },
        thickness: 0.5,
        color: GRI,
      });
      text(taie(eticheta, pas - 24, masoara(fonturi.normal, 8)), x, y - 11, 8, fonturi.normal, GRI);
    });
    y -= 20;
  }

  text(SEMNATURA_FISIER, MARGINE, MARGINE / 2, MARIME_MARGINE, fonturi.normal, GRI);
  // Textul devine clicabil printr-o adnotare `Link` cu acțiune `URI`, întinsă
  // exact peste el. `pdf-lib` n-are un API pentru legături; dicționarul e cel
  // din specificația PDF (ISO 32000, 12.5.6.5).
  const latimeText = fonturi.normal.widthOfTextAtSize(SEMNATURA_FISIER, MARIME_MARGINE);
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

  // Marginile se scriu la sfârșit: abia acum se știe câte pagini are documentul.
  const masoaraMic = masoara(fonturi.normal, MARIME_MARGINE);
  const antetRulant = taie(textAntetRulant(d), util, masoaraMic);
  pagini.forEach((p, i) => {
    if (i > 0) {
      p.drawText(antetRulant, {
        x: MARGINE,
        y: inaltime - MARGINE / 2 - 4,
        size: MARIME_MARGINE,
        font: fonturi.normal,
        color: GRI,
      });
      sonda?.text(i + 1, antetRulant);
    }
    const numar = textPagina(i, pagini.length);
    if (numar !== null) {
      p.drawText(numar, {
        x: latime - MARGINE - masoaraMic(numar),
        y: MARGINE / 2,
        size: MARIME_MARGINE,
        font: fonturi.normal,
        color: GRI,
      });
      sonda?.text(i + 1, numar);
    }
  });
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte
pnpm exec prettier --write src/lib/unelte/pdf.ts src/lib/unelte/sectiuni.test.ts && pnpm exec prettier --check src/lib/unelte/pdf.ts src/lib/unelte/sectiuni.test.ts
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

`sectiuni.test.ts`: 7 teste verzi. `pdf-pagini.test.ts` (E4) și `randari.test.ts` trebuie să rămână verzi: tabelul principal folosește aceleași valori implicite ca înainte.

- [ ] **Pasul 5: Verificarea vizuală a PDF-ului** (test temporar, șters înainte de commit, ca la E4):

```bash
cd /srv/apps/ERP
cat > src/lib/unelte/zz-proba-ssm.test.ts <<'EOF'
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { randeazaPdf } from "./pdf";
it("probă vizuală", async () => {
  writeFileSync(process.env.IESIRE ?? "/dev/null", await randeazaPdf({
    titlu: "Fișă de instruire individuală privind securitatea și sănătatea în muncă",
    subtitlu: "Întreprinderea/unitatea: Țesătoria Ardeleana SRL",
    campuri: [{ eticheta: "Numele și prenumele", valoare: "Popescu Ștefanța" }],
    paragrafe: [], coloane: [], randuri: [], umbrite: [], note: [], semnaturi: [],
    orientare: "portret", numeFisier: "proba",
    antetRulant: "Fișă de instruire individuală SSM — Popescu Ștefanța — Țesătoria Ardeleana SRL",
    sectiuni: [
      { tip: "text", titlu: "Instruirea la angajare", paragrafe: ["1) Instruirea introductiv-generală…"],
        semnaturi: ["Semnătura celui instruit", "Semnătura celui care a efectuat instruirea", "Semnătura celui care a verificat însușirea cunoștințelor"] },
      { tip: "tabel", titlu: "Instruirea periodică", coloane: [{ eticheta: "Data\ninstruirii", latime: 2 }, { eticheta: "Materialul predat", latime: 5 }],
        randuri: Array.from({ length: 30 }, () => ["", ""]), inaltimeRand: 28 },
      { tip: "casete", titlu: "Control medical periodic", numar: 6, rubrica: "Observații de specialitate",
        semnaturi: ["Semnătura și parafa medicului de medicina muncii", "Data vizei"], nota: null },
    ],
  }));
});
EOF
IESIRE="$SCRATCH/proba-h2.pdf" pnpm exec vitest run src/lib/unelte/zz-proba-ssm.test.ts
rm src/lib/unelte/zz-proba-ssm.test.ts
test -x "$SCRATCH/venv-pdf/bin/python" || { python3 -m venv "$SCRATCH/venv-pdf" && "$SCRATCH/venv-pdf/bin/pip" install -q pypdfium2; }
"$SCRATCH/venv-pdf/bin/python" -I -c "import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); [d[i].render(scale=1.2).to_pil().save(f'{sys.argv[2]}-{i+1}.png') for i in range(len(d))]; print(len(d), 'pagini')" "$SCRATCH/proba-h2.pdf" "$SCRATCH/proba-h2"
git status --short -- src/lib/unelte/   # NU trebuie să apară zz-proba-ssm.test.ts
```

Deschide PNG-urile cu `Read`. Ce trebuie să se vadă:
- trei casete de semnătură etichetate sub punctul 1), cu „Semnătura celui care a verificat însușirea cunoștințelor” întreagă, pe două rânduri;
- rânduri de tabel de ~1 cm;
- casetele de viză câte două pe rând, fiecare cu trei linii și cu etichetele jos;
- pe pagina 2, sus, „Fișă de instruire individuală SSM — Popescu Ștefanța — …”;
- jos-dreapta, „Pagina 1 din N” și „Pagina 2 din N”.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(src/lib/unelte/pdf.ts src/lib/unelte/sectiuni.test.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
feat(unelte): PDF cu secțiuni, rubrici de semnătură și casete de viză

Secțiunile documentului se desenează după tabelul principal: text cu trei
rubrici de semnătură etichetate (16 mm), tabele cu rândul lor minim (fișa
SSM: 28 pt ≈ 9,9 mm), casete de viză câte două pe rând. Un tabel de până la
6 rânduri nu se rupe între pagini. Sonda opțională vede textul și cutiile,
fiindcă pdf-lib nu poate citi înapoi un font subsetat.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
git push origin main
node scripts/checks/lastmod.mjs
```

---

### Task H3: Word-ul randează aceleași secțiuni

**Fișiere:**
- Modify: `src/lib/unelte/docx.ts`: importul din `./document-tabelar`, constanta `TWIPI_PE_PUNCT` (E5) și linia notelor din `sectiune(d)` (E5)
- Test: `src/lib/unelte/sectiuni.test.ts`

**Interfețe:**
- Consumă: `type Sectiune` (H1); `TWIPI_PE_PUNCT`, `HeightRule`, `sectiune(d)` (E5); `curataDocument` din `raspunsDocument` (B2); `saxes@5.0.1` (devDependency adăugată de B2).
- Produce (interne lui `docx.ts`): `celulaSectiune`, `paragrafSectiune`, `randCasete`, `blocuriSectiune(s: Sectiune): (Paragraph | Table)[]`. `randeazaDocx` și `randeazaDocxMultiplu` își păstrează semnătura.

- [ ] **Pasul 0: Precondițiile** (rândurile E5 și `"saxes"` din `package.json`).

- [ ] **Pasul 1: Scrie testul care pică**

În `src/lib/unelte/sectiuni.test.ts`, înlocuiește importurile scrise în H2:

```ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  curataDocument,
  textAntetRulant,
  textPagina,
  type DocumentTabelar,
} from "./document-tabelar";
import { INALT_CASETA, randeazaPdf, type SondaPdf } from "./pdf";
```

cu:

```ts
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { SaxesParser } from "saxes";
import { describe, expect, it } from "vitest";

import {
  curataDocument,
  textAntetRulant,
  textPagina,
  type DocumentTabelar,
} from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { INALT_CASETA, randeazaPdf, type SondaPdf } from "./pdf";
import { raspunsDocument } from "./raspuns";
```

și adaugă la sfârșitul fișierului:

```ts
function eroriXml(xml: string): readonly string[] {
  const erori: string[] = [];
  const parser = new SaxesParser({ xmlns: true });
  parser.on("error", (eroare) => {
    erori.push(eroare.message);
  });
  parser.write(xml).close();
  return erori;
}

describe("Word cu secțiuni", () => {
  it("are antetul cu numele, subsolul numerotat pe secțiune și rânduri de cel puțin 28 pt", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx(CU_SECTIUNI));
    const fisiere = Object.keys(zip.files);
    const antet = fisiere.find((f) => /^word\/header\d+\.xml$/u.test(f));
    const subsol = fisiere.find((f) => /^word\/footer\d+\.xml$/u.test(f));
    expect(antet).toBeDefined();
    expect(subsol).toBeDefined();
    expect(await zip.file(antet ?? "")?.async("string")).toContain("Popescu Ștefanța");
    const xmlSubsol = (await zip.file(subsol ?? "")?.async("string")) ?? "";
    expect(xmlSubsol).toContain("Pagina ");
    expect(xmlSubsol).toContain("SECTIONPAGES");
    const document = (await zip.file("word/document.xml")?.async("string")) ?? "";
    // 28 pt = 560 twips; 40 de rânduri periodice. Casetele au 96 pt = 1920.
    expect(document.match(/<w:trHeight w:val="560" w:hRule="atLeast"\/>/gu)).toHaveLength(40);
    expect(document.match(/<w:trHeight w:val="1920" w:hRule="atLeast"\/>/gu)).toHaveLength(4);
    for (const titlu of [
      "Instruirea la angajare",
      "Rezultatele testărilor",
      "Control medical periodic",
    ]) {
      expect(document).toContain(titlu);
    }
    expect(document).toContain("Semnătura celui care a verificat însușirea cunoștințelor");
    expect(document).toContain('w:orient="portrait"');
  });

  it("rămâne XML valid cu caractere de control în secțiuni", async () => {
    const murdar: DocumentTabelar = {
      ...CU_SECTIUNI,
      antetRulant: "Popa\u000BIon\u0001",
      sectiuni: [
        { tip: "text", titlu: "A\u0001", paragrafe: ["b\u0000c"], semnaturi: ["d\u001F"] },
        {
          tip: "casete",
          titlu: "C\u000B",
          numar: 1,
          rubrica: "R\u0003",
          semnaturi: ["S"],
          nota: null,
        },
      ],
    };
    const r = await raspunsDocument(murdar, "docx");
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    for (const parte of Object.keys(zip.files).filter((f) => /^word\/.*\.xml$/u.test(f))) {
      expect(eroriXml((await zip.file(parte)?.async("string")) ?? ""), parte).toEqual([]);
    }
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/sectiuni.test.ts
```

Ce trebuie să cadă: `are antetul cu numele, subsolul numerotat pe secțiune și rânduri de cel puțin 28 pt`, cu `Target cannot be null or undefined.` (zero rânduri `w:trHeight` de 560, deci `match` dă `null`). Antetul cu numele trece deja, prin H1 și E5. Testul „rămâne XML valid…” trece și înainte, fiindcă Word-ul vechi ignoră secțiunile. După pasul 3 el dovedește că `curataSectiune` (H1) acoperă tot ce desenează Word-ul.

- [ ] **Pasul 3: Implementarea minimă**

În `src/lib/unelte/docx.ts`, importul:

```ts
  textAntetRulant,
  type DocumentTabelar,
} from "./document-tabelar";
```

devine:

```ts
  textAntetRulant,
  type DocumentTabelar,
  type Sectiune,
} from "./document-tabelar";
```

Blocul scris de E5:

```ts
/** Înălțimile de rând din `docx` sunt în twipi: 20 pe punct. */
const TWIPI_PE_PUNCT = 20;
```

devine:

```ts
/** Înălțimile de rând din `docx` sunt în twipi: 20 pe punct. */
const TWIPI_PE_PUNCT = 20;

/**
 * Aceleași înălțimi ca în PDF (`INALT_SEMNATURA` și `INALT_CASETA` din
 * `pdf.ts`), în puncte. Nu se importă de acolo: `pdf.ts` e `server-only` și
 * trage fontul, iar Word-ul n-are nevoie de el.
 */
const INALT_SEMNATURA = 46;
const INALT_CASETA = 96;

/** Celula unui tabel de secțiune: lățimea în procente, `\n` devine rând nou. */
function celulaSectiune(text: string, procent: number, aldin: boolean): TableCell {
  return new TableCell({
    width: { size: procent, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: text
          .split("\n")
          .map(
            (linie, k) =>
              new TextRun({ text: linie, bold: aldin, size: 16, ...(k > 0 ? { break: 1 } : {}) }),
          ),
      }),
    ],
  });
}

function paragrafSectiune(
  text: string,
  optiuni: Readonly<{ bold?: boolean; size?: number; color?: string }> = {},
): Paragraph {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, ...optiuni })] });
}

/** Un rând de casete egale; o casetă fără conținut rămâne goală (perechea lipsă). */
function randCasete(continut: readonly (readonly Paragraph[])[], inaltime: number): TableRow {
  return new TableRow({
    cantSplit: true,
    height: { value: inaltime * TWIPI_PE_PUNCT, rule: HeightRule.ATLEAST },
    children: continut.map(
      (copii) =>
        new TableCell({
          width: { size: Math.round(100 / continut.length), type: WidthType.PERCENTAGE },
          children: copii.length > 0 ? [...copii] : [new Paragraph("")],
        }),
    ),
  });
}

/** O secțiune a documentului (fișa SSM) ca paragrafe și tabele Word. */
function blocuriSectiune(s: Sectiune): (Paragraph | Table)[] {
  switch (s.tip) {
    case "text": {
      const blocuri: (Paragraph | Table)[] = [];
      if (s.titlu !== null) blocuri.push(paragrafSectiune(s.titlu, { bold: true, size: 22 }));
      for (const p of s.paragrafe) blocuri.push(paragrafSectiune(p, { size: 20 }));
      if (s.semnaturi.length > 0) {
        blocuri.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              randCasete(
                s.semnaturi.map((e) => [
                  new Paragraph({
                    children: [new TextRun({ text: e, size: 14, color: "6B7280" })],
                  }),
                ]),
                INALT_SEMNATURA,
              ),
            ],
          }),
          paragrafSectiune(""),
        );
      }
      return blocuri;
    }
    case "tabel": {
      const total = s.coloane.reduce((suma, c) => suma + c.latime, 0) || 1;
      const procent = (i: number) => Math.round(((s.coloane[i]?.latime ?? 0) / total) * 100);
      const inaltime = Math.max(16, s.inaltimeRand ?? 16);
      return [
        paragrafSectiune(s.titlu, { bold: true, size: 22 }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              cantSplit: true,
              children: s.coloane.map((c, i) => celulaSectiune(c.eticheta, procent(i), true)),
            }),
            ...s.randuri.map(
              (r) =>
                new TableRow({
                  cantSplit: true,
                  height: { value: inaltime * TWIPI_PE_PUNCT, rule: HeightRule.ATLEAST },
                  children: s.coloane.map((_, i) => celulaSectiune(r[i] ?? "", procent(i), false)),
                }),
            ),
          ],
        }),
        paragrafSectiune(""),
      ];
    }
    case "casete": {
      const caseta = () => [
        new Paragraph({ children: [new TextRun({ text: s.rubrica, size: 16 })] }),
        ...[1, 2, 3].map(
          () => new Paragraph({ children: [new TextRun({ text: LINIE_GOALA, size: 16 })] }),
        ),
        new Paragraph({
          children: [new TextRun({ text: s.semnaturi.join("    "), size: 14, color: "6B7280" })],
        }),
      ];
      const randuri: TableRow[] = [];
      for (let k = 0; k < s.numar; k += 2) {
        randuri.push(randCasete([caseta(), k + 1 < s.numar ? caseta() : []], INALT_CASETA));
      }
      const blocuri: (Paragraph | Table)[] = [
        paragrafSectiune(s.titlu, { bold: true, size: 22 }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: randuri }),
      ];
      if (s.nota !== null) blocuri.push(paragrafSectiune(s.nota, { size: 14, color: "6B7280" }));
      blocuri.push(paragrafSectiune(""));
      return blocuri;
    }
  }
}
```

În `sectiune(d)` (E5), linia:

```ts
  for (const n of d.note) copii.push(paragraf(n, { size: 16, color: "6B7280" }));
```

devine:

```ts
  for (const s of d.sectiuni ?? []) copii.push(...blocuriSectiune(s));
  for (const n of d.note) copii.push(paragraf(n, { size: 16, color: "6B7280" }));
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte
pnpm exec prettier --write src/lib/unelte/docx.ts src/lib/unelte/sectiuni.test.ts && pnpm exec prettier --check src/lib/unelte/docx.ts src/lib/unelte/sectiuni.test.ts
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

`sectiuni.test.ts`: 9 teste verzi. `docx-sectiuni.test.ts` (E5) și `randari.test.ts` rămân verzi.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(src/lib/unelte/docx.ts src/lib/unelte/sectiuni.test.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
feat(unelte): Word cu secțiuni, rubrici de semnătură și casete de viză

Aceleași secțiuni ca în PDF: rubricile de semnătură ca tabel de casete,
tabelele cu rând minim „atLeast” și fără rupere între pagini, casetele de
viză câte două pe rând. Antetul cu numele lucrătorului vine din
`antetRulant`, prin `textAntetRulant`.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
git push origin main
node scripts/checks/lastmod.mjs
```

---

### Task H4: Previzualizarea arată aceleași secțiuni

**Fișiere:**
- Modify: `src/app/(marketing)/_componente/previzualizare-document.tsx`: importul (linia 1, după B2), blocul tabelului principal (`{d.coloane.length > 0 && (` … `)}`), plus două componente noi la sfârșit
- Test: `src/app/(marketing)/_componente/previzualizare-sectiuni.test.tsx` (Create)

**Interfețe:**
- Consumă: `curataDocument`, `LINIE_GOALA`, `type Coloana`, `type DocumentTabelar`, `type Sectiune` din `@/lib/unelte/document-tabelar`.
- Produce: `PrevizualizareDocument({ document })` are aceeași semnătură. Componentele interne: `TabelHtml({ titlu, coloane, randuri, umbrite, inaltimeRand })` și `SectiuneHtml({ sectiune })`. Celulele unui tabel cu `inaltimeRand` primesc `style.height = "<n>pt"`, ca pe hârtie.

- [ ] **Pasul 1: Scrie testul care pică**

Creează `src/app/(marketing)/_componente/previzualizare-sectiuni.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { PrevizualizareDocument } from "./previzualizare-document";

const DOC: DocumentTabelar = {
  titlu: "Fișă de instruire individuală",
  subtitlu: null,
  campuri: [],
  paragrafe: [],
  coloane: [],
  randuri: [],
  umbrite: [],
  note: ["Notă finală."],
  semnaturi: [],
  orientare: "portret",
  numeFisier: "fisa",
  sectiuni: [
    {
      tip: "text",
      titlu: "Instruirea la angajare",
      paragrafe: ["1) Instruirea introductiv-generală\u000Ba fost efectuată."],
      semnaturi: ["Semnătura celui instruit", "Semnătura celui care a efectuat instruirea"],
    },
    {
      tip: "tabel",
      titlu: "Instruirea periodică",
      coloane: [
        { eticheta: "Data\ninstruirii", latime: 2 },
        { eticheta: "Ocupația", latime: 2 },
      ],
      randuri: [
        ["", "Electrician"],
        ["", "Electrician"],
      ],
      inaltimeRand: 28,
    },
    {
      tip: "casete",
      titlu: "Control medical periodic",
      numar: 3,
      rubrica: "Observații de specialitate",
      semnaturi: ["Semnătura și parafa medicului", "Data vizei"],
      nota: "* notă",
    },
  ],
};

/** Ce vede omul pe ecran e ce descarcă: aceleași secțiuni, în aceeași ordine. */
describe("previzualizarea unui document cu secțiuni", () => {
  it("arată titlurile secțiunilor, în ordine, înaintea notelor", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    const titluri = [...container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(titluri).toEqual([
      "Instruirea la angajare",
      "Instruirea periodică",
      "Control medical periodic",
    ]);
    const text = container.textContent ?? "";
    expect(text.indexOf("Control medical periodic")).toBeLessThan(text.indexOf("Notă finală."));
    expect(text).toContain("introductiv-generală a fost efectuată");
  });

  it("are rubricile de semnătură, rândurile înalte și câte o casetă pe viză", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Semnătura celui care a efectuat instruirea");
    const celule = [...container.querySelectorAll("tbody td")] as HTMLElement[];
    expect(celule).toHaveLength(4);
    for (const td of celule) expect(td.style.height).toBe("28pt");
    expect(text.match(/Observații de specialitate/gu)).toHaveLength(3);
    expect(text).toContain("* notă");
  });

  it("un document fără secțiuni arată ca înainte", () => {
    const { container } = render(
      <PrevizualizareDocument
        document={{
          ...DOC,
          sectiuni: [],
          coloane: [{ eticheta: "Nume", latime: 1 }],
          randuri: [["Ana"]],
        }}
      />,
    );
    expect(container.querySelectorAll("h3")).toHaveLength(0);
    const td = container.querySelector("tbody td") as HTMLElement | null;
    expect(td?.style.height).toBe("");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/previzualizare-sectiuni.test.tsx"
```

Ce trebuie să cadă:
- `arată titlurile secțiunilor…`: `expected [] to deeply equal [ 'Instruirea la angajare', … ]`;
- `are rubricile de semnătură…`: `expected [] to have a length of 4` (nu există niciun `tbody td`).

Testul „un document fără secțiuni arată ca înainte” trece și înainte.

- [ ] **Pasul 3: Implementarea minimă**

În `src/app/(marketing)/_componente/previzualizare-document.tsx`, importul scris de B2:

```tsx
import { curataDocument, LINIE_GOALA, type DocumentTabelar } from "@/lib/unelte/document-tabelar";
```

devine:

```tsx
import {
  curataDocument,
  LINIE_GOALA,
  type Coloana,
  type DocumentTabelar,
  type Sectiune,
} from "@/lib/unelte/document-tabelar";
```

Blocul tabelului principal:

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

devine:

```tsx
      {d.coloane.length > 0 && (
        <TabelHtml
          titlu={d.titlu}
          coloane={d.coloane}
          randuri={d.randuri}
          umbrite={d.umbrite}
          inaltimeRand={undefined}
        />
      )}
      {(d.sectiuni ?? []).map((s, i) => (
        <SectiuneHtml key={`${String(i)}-${s.tip}`} sectiune={s} />
      ))}
```

La sfârșitul fișierului se adaugă:

```tsx
/**
 * Un tabel al documentului. `relative` pe containerul derulabil: fără el,
 * `sr-only` din `<caption>` scapă și târăște pagina lateral.
 */
function TabelHtml({
  titlu,
  coloane,
  randuri,
  umbrite,
  inaltimeRand,
}: Readonly<{
  titlu: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
  umbrite: readonly number[];
  /** Puncte tipografice, ca în PDF; lipsă = înălțimea implicită a rândului. */
  inaltimeRand: number | undefined;
}>) {
  return (
    <div className="border-mk-rigla relative mt-4 overflow-x-auto border">
      <table className="w-full border-collapse text-left text-[0.8125rem]">
        <caption className="sr-only">{titlu}</caption>
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
                  style={
                    inaltimeRand === undefined ? undefined : { height: `${String(inaltimeRand)}pt` }
                  }
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

/** O secțiune a documentului (fișa SSM), cu aceleași rubrici ca fișierele. */
function SectiuneHtml({ sectiune: s }: Readonly<{ sectiune: Sectiune }>) {
  switch (s.tip) {
    case "text":
      return (
        <div className="mt-5">
          {s.titlu !== null && <h3 className="text-[0.9375rem] font-semibold">{s.titlu}</h3>}
          {s.paragrafe.map((p, i) => (
            <p
              key={`${String(i)}-${p}`}
              className="mt-2 max-w-[68ch] text-[0.875rem] leading-[1.65]"
            >
              {p}
            </p>
          ))}
          {s.semnaturi.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {s.semnaturi.map((e) => (
                <div
                  key={e}
                  className="border-mk-rigla text-mk-text-slab min-h-16 border p-2 text-[0.75rem] sm:flex-1"
                >
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case "tabel":
      return (
        <div className="mt-5">
          <h3 className="text-[0.9375rem] font-semibold">{s.titlu}</h3>
          <TabelHtml
            titlu={s.titlu}
            coloane={s.coloane}
            randuri={s.randuri}
            umbrite={[]}
            inaltimeRand={s.inaltimeRand}
          />
        </div>
      );
    case "casete":
      return (
        <div className="mt-5">
          <h3 className="text-[0.9375rem] font-semibold">{s.titlu}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: s.numar }, (_, i) => (
              <div key={i} className="border-mk-rigla border p-3 text-[0.8125rem]">
                <p>{s.rubrica}</p>
                <div className="border-mk-rigla/60 mt-5 border-b" />
                <div className="border-mk-rigla/60 mt-5 border-b" />
                <div className="border-mk-rigla/60 mt-5 border-b" />
                <p className="text-mk-text-slab mt-3 flex justify-between gap-4 text-[0.75rem]">
                  {s.semnaturi.map((e) => (
                    <span key={e}>{e}</span>
                  ))}
                </p>
              </div>
            ))}
          </div>
          {s.nota !== null && <p className="text-mk-text-slab mt-2 text-[0.75rem]">{s.nota}</p>}
        </div>
      );
  }
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente" "src/app/(marketing)/unelte"
pnpm exec prettier --write "src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/previzualizare-sectiuni.test.tsx" && pnpm exec prettier --check "src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/previzualizare-sectiuni.test.tsx"
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

Trebuie să rămână verzi și `previzualizare-document.test.tsx` (B2) și `unelte/tipar.test.tsx` (B6). Secțiunile sunt `div`-uri, nu `section`: un `<section>` în plus în `#documentul` nu strică filtrul lui B6, dar nici n-are ce căuta acolo ca reper.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=("src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/previzualizare-sectiuni.test.tsx")
git add -- "src/app/(marketing)/_componente/previzualizare-sectiuni.test.tsx"
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
feat(unelte): previzualizarea arată secțiunile documentului

Ce vede omul pe ecran e ce descarcă: titlurile secțiunilor, rubricile de
semnătură, tabelele cu rândul lor minim și casetele de viză, înaintea
notelor. Tabelul principal trece prin aceeași componentă, neschimbat.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
git push origin main
node scripts/checks/lastmod.mjs
```

---

### Task H5: Fișa SSM se descarcă doar în Word și PDF; Excelul refuză secțiunile

**Fișiere:**
- Modify: `src/lib/unelte/xlsx.ts:7-8` (comentariul și începutul lui `randeazaXlsx`)
- Modify: `src/lib/unelte/registru.ts:7` (importul) și sfârșitul fișierului
- Modify: `src/app/api/unelte/[unealta]/route.ts:3-4, 15, 24-29`
- Test: `src/lib/unelte/registru.test.ts`, `src/app/api/unelte/[unealta]/route.test.ts`, `src/lib/unelte/sectiuni.test.ts`

**Interfețe:**
- Consumă: `FORMATE`, `type Format`, `normalizeazaFormat` (B8: fără majuscule și spații) din `@/lib/unelte/document-tabelar`; `UNELTE`, `constructorPentru` din `@/lib/unelte/registru`.
- Produce: `export function formatePentru(slug: string): readonly Format[]`. Ruta comună răspunde 400 cu `Unealta asta se descarcă doar în PDF sau Word.` când formatul cerut nu e al uneltei.

- [ ] **Pasul 0:** `git log --oneline -3 -- src/lib/unelte/registru.ts "src/app/api/unelte/[unealta]/route.ts"`. E12 scoate condica din `UNELTE`, iar alte secțiuni pot adăuga unelte. Blocurile de mai jos ating doar importul de tip din `registru.ts` și sfârșitul fișierului, nu lista.

- [ ] **Pasul 1: Scrie testele care pică**

În `src/lib/unelte/registru.test.ts`, importul:

```ts
import { constructorPentru } from "./registru";
```

devine:

```ts
import { FORMATE } from "./document-tabelar";
import { constructorPentru, formatePentru, UNELTE } from "./registru";
```

și la sfârșitul fișierului se adaugă:

```ts
describe("formatele fiecărei unelte", () => {
  it("fișa SSM n-are Excel; restul au toate trei formatele", () => {
    expect(formatePentru("fisa-instruire-ssm")).toEqual(["pdf", "docx"]);
    for (const slug of Object.keys(UNELTE).filter((s) => s !== "fisa-instruire-ssm")) {
      expect(formatePentru(slug), slug).toEqual(FORMATE);
    }
    expect(formatePentru("constructor")).toEqual(FORMATE);
  });
});
```

În `src/app/api/unelte/[unealta]/route.test.ts`, importul:

```ts
import { GET } from "./route";
```

devine:

```ts
import { UNELTE } from "@/lib/unelte/registru";

import { GET } from "./route";
```

și la sfârșitul fișierului se adaugă:

```ts
describe("fișa de instruire SSM se descarcă doar în Word și PDF", () => {
  it("Excel primește 400 cu formatele disponibile, nu un fișier fără jumătate din anexă", async () => {
    const r = await cere(
      "/api/unelte/fisa-instruire-ssm?format=xlsx&nume=Popa",
      "fisa-instruire-ssm",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toBe("Unealta asta se descarcă doar în PDF sau Word.");
  });

  it("PDF și Word răspund cu fișierul", async () => {
    const pdf = await cere("/api/unelte/fisa-instruire-ssm?format=pdf", "fisa-instruire-ssm");
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    const docx = await cere("/api/unelte/fisa-instruire-ssm?format=docx", "fisa-instruire-ssm");
    expect(docx.status).toBe(200);
    expect(docx.headers.get("content-type")).toContain("wordprocessingml");
  });

  it("celelalte unelte din registru își păstrează Excelul", async () => {
    // E12, F12, G6 și I7 mută condica, cererea, foaia de parcurs și fișa de
    // evaluare pe rute statice, iar K8–K10 adaugă unelte noi. Fișa SSM poate
    // rămâne singura din `UNELTE`; atunci nu e nimic de verificat aici, iar
    // `formatePentru` e păzit de `registru.test.ts`.
    const alta = Object.keys(UNELTE).find((s) => s !== "fisa-instruire-ssm");
    const r = alta === undefined ? null : await cere(`/api/unelte/${alta}?format=xlsx`, alta);
    expect(r === null || r.status === 200, alta).toBe(true);
  });
});
```

În `src/lib/unelte/sectiuni.test.ts`, linia de import scrisă în H3:

```ts
import { raspunsDocument } from "./raspuns";
```

devine:

```ts
import { raspunsDocument } from "./raspuns";
import { randeazaXlsx } from "./xlsx";
```

și la sfârșitul fișierului se adaugă:

```ts
describe("Excel", () => {
  it("refuză un document cu secțiuni, în loc să le piardă tăcut", async () => {
    await expect(randeazaXlsx(CU_SECTIUNI)).rejects.toThrow(/secțiuni/u);
    await expect(randeazaXlsx(SIMPLU)).resolves.toBeInstanceOf(Uint8Array);
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/registru.test.ts "src/app/api/unelte/[unealta]/route.test.ts" src/lib/unelte/sectiuni.test.ts
```

Ce trebuie să cadă:
- `registru.test.ts`: `formatePentru is not a function` (sau „does not provide an export named 'formatePentru'”);
- `route.test.ts`, „Excel primește 400…”: `expected 200 to be 400`;
- `sectiuni.test.ts`, „refuză un document cu secțiuni…”: `promise resolved "Uint8Array[…]" instead of rejecting`.

- [ ] **Pasul 3: Implementarea minimă**

`src/lib/unelte/xlsx.ts`:

```ts
/** `DocumentTabelar` → .xlsx, pe o singură filă, cu antetul tabelului înghețat. */
export async function randeazaXlsx(d: DocumentTabelar): Promise<Uint8Array> {
```

devine:

```ts
/**
 * `DocumentTabelar` → .xlsx, pe o singură filă, cu antetul tabelului înghețat.
 *
 * Secțiunile (`sectiuni`, fișa SSM) NU au formă de foaie de calcul: casetele de
 * viză și cele șapte tabele cu lățimi diferite nu încap pe o grilă de coloane.
 * Unealta care le are se descarcă doar în PDF și Word (`formatePentru` din
 * `registru.ts`); aici se aruncă, ca o unealtă nouă să nu piardă tăcut jumătate
 * din document într-un Excel.
 */
export async function randeazaXlsx(d: DocumentTabelar): Promise<Uint8Array> {
  if ((d.sectiuni?.length ?? 0) > 0) {
    throw new Error("Documentul are secțiuni, iar Excelul nu le randează.");
  }
```

`src/lib/unelte/registru.ts`, importul:

```ts
import type { DocumentTabelar } from "./document-tabelar";
```

devine:

```ts
import { FORMATE, type DocumentTabelar, type Format } from "./document-tabelar";
```

și la sfârșitul fișierului se adaugă:

```ts
/**
 * Formatele unei unelte, când nu sunt toate trei. Fișa SSM n-are Excel: are
 * secțiuni (casete de viză, șapte tabele), pe care `randeazaXlsx` nu le poate
 * așeza, iar pagina și lista uneltelor promit doar Word și PDF.
 */
const FORMATE_RESTRANSE: Readonly<Record<string, readonly Format[]>> = {
  "fisa-instruire-ssm": ["pdf", "docx"],
};

export function formatePentru(slug: string): readonly Format[] {
  return Object.hasOwn(FORMATE_RESTRANSE, slug) ? (FORMATE_RESTRANSE[slug] ?? FORMATE) : FORMATE;
}
```

`src/app/api/unelte/[unealta]/route.ts`, importurile:

```ts
import { EroareIntrare, normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { constructorPentru } from "@/lib/unelte/registru";
```

devin:

```ts
import { EroareIntrare, normalizeazaFormat, type Format } from "@/lib/unelte/document-tabelar";
import { constructorPentru, formatePentru } from "@/lib/unelte/registru";
```

după `export const dynamic = "force-dynamic";` se adaugă:

```ts

const NUME_FORMAT: Readonly<Record<Format, string>> = { pdf: "PDF", docx: "Word", xlsx: "Excel" };
```

iar blocul:

```ts
  const q = cerere.nextUrl.searchParams;
  try {
    return await raspunsDocument(
      { ...construieste(q), sursa: `/unelte/${unealta}` },
      normalizeazaFormat(q.get("format")),
    );
```

devine:

```ts
  const q = cerere.nextUrl.searchParams;
  const format = normalizeazaFormat(q.get("format"));
  const permise = formatePentru(unealta);
  if (!permise.includes(format)) {
    return new Response(
      `Unealta asta se descarcă doar în ${permise.map((f) => NUME_FORMAT[f]).join(" sau ")}.`,
      { status: 400 },
    );
  }
  try {
    return await raspunsDocument({ ...construieste(q), sursa: `/unelte/${unealta}` }, format);
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte "src/app/api/unelte"
CAI=(src/lib/unelte/xlsx.ts src/lib/unelte/registru.ts src/lib/unelte/registru.test.ts "src/app/api/unelte/[unealta]/route.ts" "src/app/api/unelte/[unealta]/route.test.ts" src/lib/unelte/sectiuni.test.ts)
pnpm exec prettier --write "${CAI[@]}" && pnpm exec prettier --check "${CAI[@]}"
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

- [ ] **Pasul 5: Proba pe ruta reală, local** (după `pnpm exec next dev -H 127.0.0.1 -p 3917` pornit în fundal, ca în B6 pasul 5):

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "http://127.0.0.1:3917/api/unelte/fisa-instruire-ssm?format=xlsx"
curl -s "http://127.0.0.1:3917/api/unelte/fisa-instruire-ssm?format=xlsx"; echo
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "http://127.0.0.1:3917/api/unelte/fisa-instruire-ssm?format=docx"
```

Așteptat:
- `400 text/plain;charset=UTF-8`;
- `Unealta asta se descarcă doar în PDF sau Word.`;
- `200 application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

Oprește serverul într-un apel Bash separat: `pkill -f "next dev -H 127.0.0.1 -p 391[7]"`, apoi `rm -f .next/dev/types/validator.ts .next/dev/types/routes.d.ts`.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(src/lib/unelte/xlsx.ts src/lib/unelte/registru.ts src/lib/unelte/registru.test.ts "src/app/api/unelte/[unealta]/route.ts" "src/app/api/unelte/[unealta]/route.test.ts" src/lib/unelte/sectiuni.test.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
fix(unelte): fișa SSM se descarcă doar în Word și PDF

`/api/unelte/fisa-instruire-ssm?format=xlsx` dădea un Excel cu paragrafele
pe un singur rând, deși pagina și hub-ul promit Word și PDF (auditul din 8
oct 2026). Ruta răspunde acum 400 cu formatele uneltei, iar `randeazaXlsx`
refuză orice document cu secțiuni, în loc să le piardă tăcut.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
git push origin main
node scripts/checks/lastmod.mjs
```

---

### Task H6: Fișa completă după anexa 11

**Fișiere:**
- Modify (rescris integral): `src/app/(marketing)/unelte/fisa-instruire-ssm/model.ts` (137 de linii azi, toate citite; noul fișier păstrează exporturile `ParametriFisaSsm`, `construiesteFisaSsm`, `parametriFisaSsm`, `fisaSsmDinParametri` și `INSTRUIRI_SSM`, folosite de `page.tsx` și de `registru.ts`)
- Test (rescris integral): `src/app/(marketing)/unelte/fisa-instruire-ssm/model.test.ts`
- Modify: `e2e/unelte-tipar.spec.ts` (intrarea SSM scrisă de B6)
- Modify: `src/content/landing/harta.ts:363` (`actualizat` pe `/unelte/fisa-instruire-ssm`)

**Interfețe:**
- Consumă:
  - `deplaseazaLuna(an, luna, luni): { an; luna }`, `numarZileLuna(an, luna): number` și `ziIso(an, luna, zi): string` din `@/domain/calendar/grila-lunara`;
  - `formatDate(iso): string` și `parseDateRo(text): string | null` din `@/lib/format/date`;
  - `LINIE_GOALA`, `type Coloana` și `type DocumentTabelar` din `@/lib/unelte/document-tabelar` (toate verificate cu `grep -n "^export"`).
- Produce:
  ```ts
  export const PERIODICITATI: { lunara: { eticheta; luni: 1 }; trimestriala: …3; semestriala: …6; anuala: …12 };
  export type Periodicitate = keyof typeof PERIODICITATI;
  export const ANI_ACOPERITI: readonly [1, 2, 3, 5, 10];
  export const PERIODICITATE_IMPLICITA: Periodicitate; export const ANI_IMPLICITI = 5;
  export const RANDURI_ANEXA: { suplimentara: 6; testari: 5; accidente: 5; sanctiuni: 5 };
  export const CASETE_ANEXA = 6; export const INALT_RAND_FISA = 28;
  export type ParametriFisaSsm = Readonly<{ nume; marca; calificare; functie; locMunca; firma: string; dataIg: string | null; oreIg: number | null; instructorIg; functieIg: string; dataLm: string | null; oreLm: number | null; instructorLm; functieLm; admisNume; admisFunctie: string; periodicitate: Periodicitate; ani: number }>;
  export function parametriFisaSsm(q: URLSearchParams): ParametriFisaSsm;
  export function randuriPeriodice(p: Periodicitate, numarAni: number): number;
  export function caseteViza(numarAni: number): number;
  export function scadentePeriodice(start: string, luni: number, numar: number): readonly string[];
  export function construiesteFisaSsm(o: ParametriFisaSsm): DocumentTabelar;
  export function fisaSsmDinParametri(q: URLSearchParams): DocumentTabelar;
  export const INSTRUIRI_SSM: readonly { tip: string; regula: string; cine: string; temei: string }[];
  ```
  Parametrii din adresă: `nume`, `marca`, `calificare`, `functie`, `loc`, `firma`, `data_ig`, `ore_ig`, `instructor_ig`, `functie_ig`, `data_lm`, `ore_lm`, `instructor_lm`, `functie_lm`, `admis_nume`, `admis_functie`, `periodicitate`, `ani`. Niciunul nu e pe lista albă a lui A2 (`utm_*`, `m`).

- [ ] **Pasul 0:** H1–H5 sunt pe `main`: `git log --oneline -8 -- src/lib/unelte` le arată.

- [ ] **Pasul 1: Scrie testul care pică**

Înlocuiește tot `src/app/(marketing)/unelte/fisa-instruire-ssm/model.test.ts` cu:

```ts
import { describe, expect, it } from "vitest";

import type { Sectiune, SectiuneTabel } from "@/lib/unelte/document-tabelar";

import {
  CASETE_ANEXA,
  caseteViza,
  construiesteFisaSsm,
  fisaSsmDinParametri,
  INALT_RAND_FISA,
  INSTRUIRI_SSM,
  parametriFisaSsm,
  RANDURI_ANEXA,
  randuriPeriodice,
  scadentePeriodice,
  type ParametriFisaSsm,
} from "./model";

const GOL: ParametriFisaSsm = parametriFisaSsm(new URLSearchParams());

const COMPLET = parametriFisaSsm(
  new URLSearchParams({
    nume: "Popa Ion",
    marca: "M-117",
    calificare: "Electrician",
    functie: "Electrician întreținere",
    loc: "Atelier întreținere",
    firma: "Exemplu SRL",
    data_ig: "2026-10-05",
    ore_ig: "2",
    instructor_ig: "Ionescu Maria",
    functie_ig: "Lucrător desemnat",
    data_lm: "06.10.2026",
    ore_lm: "4",
    instructor_lm: "Vasile Dan",
    functie_lm: "Șef atelier",
    admis_nume: "Georgescu Ana",
    admis_functie: "Director tehnic",
    periodicitate: "trimestriala",
    ani: "2",
  }),
);

const tabele = (s: readonly Sectiune[] | undefined) =>
  (s ?? []).filter((x): x is SectiuneTabel => x.tip === "tabel");
const tabelul = (titlu: string, p: ParametriFisaSsm = GOL) => {
  const t = tabele(construiesteFisaSsm(p).sectiuni).find((x) => x.titlu === titlu);
  if (t === undefined) throw new Error(`Lipsește tabelul „${titlu}”.`);
  return t;
};
const toataProza = (p: ParametriFisaSsm) =>
  (construiesteFisaSsm(p).sectiuni ?? [])
    .flatMap((s) => (s.tip === "text" ? s.paragrafe : []))
    .join("\n");

describe("fișa individuală de instruire SSM — rubricile anexei 11 (HG 1425/2006)", () => {
  it("are antetul din anexă, cu datele lucrătorului completate", () => {
    const d = construiesteFisaSsm(COMPLET);
    const etichete = d.campuri.map((c) => c.eticheta);
    expect(etichete).toEqual([
      "Numele și prenumele",
      "Legitimația, marca",
      "Grupa sanguină",
      "Domiciliul",
      "Data și locul nașterii",
      "Calificarea",
      "Funcția",
      "Locul de muncă",
      "Autorizații (ISCIR ș.a.)",
      "Traseul de deplasare la/de la serviciu",
    ]);
    expect(d.campuri).toContainEqual({ eticheta: "Legitimația, marca", valoare: "M-117" });
    expect(d.campuri).toContainEqual({ eticheta: "Calificarea", valoare: "Electrician" });
    expect(d.subtitlu).toBe("Întreprinderea/unitatea: Exemplu SRL");
  });

  it("nu cere și nu scrie date despre sănătate, domiciliu sau CNP", () => {
    const d = construiesteFisaSsm(COMPLET);
    for (const e of ["Grupa sanguină", "Domiciliul", "Data și locul nașterii"]) {
      expect(d.campuri.find((c) => c.eticheta === e)?.valoare, e).toBe("");
    }
    expect(JSON.stringify(d)).not.toMatch(/CNP/u);
  });

  it("are toate cele zece părți ale anexei, în ordinea ei", () => {
    // Auditul din 8 oct 2026: lipseau testările, accidentele, sancțiunile și cele
    // două grupuri de casete, iar fișa scria singură că anexa „mai cuprinde” ceva.
    const d = construiesteFisaSsm(GOL);
    const titluri = (d.sectiuni ?? []).map((s) => s.titlu);
    expect(titluri).toEqual([
      "Instruirea la angajare",
      null,
      null,
      "Instruirea periodică",
      "Instruirea periodică suplimentară",
      "Rezultatele testărilor",
      "Accidente de muncă sau îmbolnăviri profesionale suferite",
      "Sancțiuni aplicate pentru nerespectarea reglementărilor de securitate și sănătate în muncă",
      "Control medical periodic",
      "Testarea psihologică periodică",
    ]);
    expect(d.note.join(" ")).not.toMatch(/mai cuprinde/u);
    expect(d.coloane).toEqual([]);
  });

  it("instruirea la angajare: punctele 1)–3), cu trei rubrici de semnătură etichetate", () => {
    const [ig, lm, admis] = construiesteFisaSsm(GOL).sectiuni ?? [];
    const etichete = [
      "Semnătura celui instruit",
      "Semnătura celui care a efectuat instruirea",
      "Semnătura celui care a verificat însușirea cunoștințelor",
    ];
    expect(ig?.tip === "text" && ig.semnaturi).toEqual(etichete);
    expect(lm?.tip === "text" && lm.semnaturi).toEqual(etichete);
    expect(ig?.tip === "text" && ig.paragrafe[0]).toMatch(/^1\) Instruirea introductiv-generală/u);
    expect(lm?.tip === "text" && lm.paragrafe[0]).toMatch(/^2\) Instruirea la locul de muncă/u);
    expect(admis?.tip === "text" && admis.paragrafe[0]).toMatch(/^3\) Admis la lucru/u);
    // Două rânduri întregi pentru conținutul instruirii, ca în anexă.
    expect(ig?.tip === "text" && ig.paragrafe.filter((p) => /^_+ _+ _+$/u.test(p))).toHaveLength(2);
  });

  it("propagă datele cunoscute în punctele 1)–3)", () => {
    const proza = toataProza(COMPLET);
    expect(proza).toContain(
      "la data 05.10.2026, timp de 2 ore, de către Ionescu Maria, având funcția de Lucrător desemnat.",
    );
    expect(proza).toContain(
      "la data 06.10.2026, loc de muncă/post de lucru Atelier întreținere, timp de 4 ore, de către Vasile Dan, având funcția de Șef atelier.",
    );
    expect(proza).toContain(
      "Numele și prenumele Georgescu Ana, funcția (șef secție, atelier, șantier etc.) Director tehnic",
    );
  });

  it("tabelele periodică și suplimentară au coloanele anexei și ocupația precompletată", () => {
    const periodica = tabelul("Instruirea periodică", COMPLET);
    const suplimentara = tabelul("Instruirea periodică suplimentară", COMPLET);
    const fara = (t: SectiuneTabel) => t.coloane.map((c) => c.eticheta.replace(/\n/gu, " "));
    expect(fara(periodica)).toEqual([
      "Data instruirii",
      "Durata (h)",
      "Ocupația",
      "Materialul predat",
      "Semnătura celui instruit",
      "Semnătura celui care a instruit",
      "Semnătura celui care a verificat",
    ]);
    expect(fara(suplimentara)[0]).toBe("Data efectuării");
    expect(periodica.randuri.every((r) => r[2] === "Electrician întreținere")).toBe(true);
    expect(suplimentara.randuri).toHaveLength(RANDURI_ANEXA.suplimentara);
    expect(periodica.inaltimeRand).toBe(INALT_RAND_FISA);
  });

  it("testări, accidente și sancțiuni au coloanele și rândurile anexei", () => {
    const capete = (titlu: string) =>
      tabelul(titlu).coloane.map((c) => c.eticheta.replace(/\n/gu, " "));
    expect(capete("Rezultatele testărilor")).toEqual([
      "Data",
      "Materialul examinat",
      "Calificativ",
      "Examinator",
    ]);
    expect(capete("Accidente de muncă sau îmbolnăviri profesionale suferite")).toEqual([
      "Data producerii evenimentului",
      "Diagnosticul medical",
      "Nr. și data PV de cercetare a evenimentului",
      "Nr. zile ITM",
    ]);
    expect(
      capete(
        "Sancțiuni aplicate pentru nerespectarea reglementărilor de securitate și sănătate în muncă",
      ),
    ).toEqual(["Abaterea săvârșită", "Sancțiunea administrativă", "Nr. și data deciziei"]);
    expect(tabelul("Rezultatele testărilor").randuri).toHaveLength(RANDURI_ANEXA.testari);
  });

  it("casetele de control medical și de testare psihologică au rubricile anexei", () => {
    const casete = (construiesteFisaSsm(GOL).sectiuni ?? []).filter((s) => s.tip === "casete");
    expect(casete).toEqual([
      {
        tip: "casete",
        titlu: "Control medical periodic",
        numar: CASETE_ANEXA,
        rubrica: "Observații de specialitate",
        semnaturi: ["Semnătura și parafa medicului de medicina muncii", "Data vizei"],
        nota: null,
      },
      {
        tip: "casete",
        titlu: "Testarea psihologică periodică",
        numar: CASETE_ANEXA,
        rubrica: "Apt psihologic pentru:*",
        semnaturi: ["Semnătura psihologului", "Data"],
        nota: "* lucru la înălțime, lucru în condiții de izolare, conducători auto etc.",
      },
    ]);
  });

  it("antetul de pagină poartă numele lucrătorului și firma", () => {
    expect(construiesteFisaSsm(COMPLET).antetRulant).toBe(
      "Fișă de instruire individuală SSM — Popa Ion — Exemplu SRL",
    );
    expect(construiesteFisaSsm(GOL).antetRulant).toMatch(/Numele și prenumele: _+$/u);
  });

  it("se tipărește pe A4 portret, ca modelul din anexă", () => {
    expect(construiesteFisaSsm(GOL).orientare).toBe("portret");
  });
});

describe("câte rânduri de instruire periodică", () => {
  it("periodicitatea × anii: implicit semestrial pe 5 ani, adică 10", () => {
    expect(GOL.periodicitate).toBe("semestriala");
    expect(GOL.ani).toBe(5);
    expect(tabelul("Instruirea periodică").randuri).toHaveLength(10);
    expect(randuriPeriodice("lunara", 10)).toBe(120);
    expect(randuriPeriodice("trimestriala", 2)).toBe(8);
    expect(randuriPeriodice("anuala", 3)).toBe(3);
    expect(tabelul("Instruirea periodică", COMPLET).randuri).toHaveLength(8);
  });

  it("valorile din afara listei cad pe implicit, nu pe un număr nemărginit de rânduri", () => {
    const p = parametriFisaSsm(new URLSearchParams({ periodicitate: "zilnica", ani: "1000" }));
    expect(p.periodicitate).toBe("semestriala");
    expect(p.ani).toBe(5);
    const proto = parametriFisaSsm(new URLSearchParams({ periodicitate: "constructor" }));
    expect(proto.periodicitate).toBe("semestriala");
  });

  it("casetele de viză: una pe an, cel puțin șase, număr par", () => {
    expect(caseteViza(1)).toBe(6);
    expect(caseteViza(5)).toBe(6);
    expect(caseteViza(10)).toBe(10);
    expect(caseteViza(7)).toBe(8);
  });
});

describe("intrările formularului", () => {
  it("taie câmpurile de text la 120 de caractere", () => {
    const d = fisaSsmDinParametri(new URLSearchParams({ nume: "x".repeat(300) }));
    expect(d.campuri.find((c) => c.eticheta === "Numele și prenumele")?.valoare).toHaveLength(120);
  });

  it("citește data din calendar sau scrisă românește și respinge zilele inexistente", () => {
    const zi = (v: string) => parametriFisaSsm(new URLSearchParams({ data_ig: v })).dataIg;
    expect(zi("2026-10-05")).toBe("2026-10-05");
    expect(zi("05.10.2026")).toBe("2026-10-05");
    expect(zi("2027-02-29")).toBeNull();
    expect(zi("31.04.2026")).toBeNull();
    expect(zi("ieri")).toBeNull();
    expect(toataProza(parametriFisaSsm(new URLSearchParams({ data_ig: "2027-02-29" })))).toContain(
      "efectuată la data __________,",
    );
  });

  it("orele: întregi între 1 și 40, altfel rămâne linia de completat", () => {
    const h = (v: string) => parametriFisaSsm(new URLSearchParams({ ore_ig: v })).oreIg;
    expect(h("1")).toBe(1);
    expect(h("40")).toBe(40);
    expect(h("0")).toBeNull();
    expect(h("41")).toBeNull();
    expect(h("1,5")).toBeNull();
    expect(h("-2")).toBeNull();
  });
});

describe("scadențele instruirii periodice (doar pe pagină)", () => {
  it("adună intervalul de la ultima instruire și rămâne pe ultima zi a lunii", () => {
    expect(scadentePeriodice("2026-10-06", 6, 3)).toEqual([
      "2027-04-06",
      "2027-10-06",
      "2028-04-06",
    ]);
    expect(scadentePeriodice("2026-08-31", 6, 2)).toEqual(["2027-02-28", "2027-08-31"]);
    expect(scadentePeriodice("2027-08-31", 6, 1)).toEqual(["2028-02-29"]);
    expect(scadentePeriodice("2026-11-30", 3, 2)).toEqual(["2027-02-28", "2027-05-30"]);
  });
});

describe("regulile afișate pe pagină", () => {
  const dupa = (tip: string) => INSTRUIRI_SSM.find((r) => r.tip === tip);

  it("dau minimul de o oră din art. 80¹, nu cele 8 ore abrogate în 2016", () => {
    // Auditul SEO din 7 oct 2026: pagina citea consolidarea din 2011 și dădea
    // „cel puțin 8 ore” pe fază. Art. 87 alin. (2) e abrogat prin HG 767/2016,
    // care a introdus art. 80¹: cel puțin o oră, stabilită prin programul firmei.
    for (const tip of ["Introductiv-generală", "La locul de muncă", "Suplimentară"]) {
      expect(dupa(tip)?.regula, tip).toMatch(/o oră/u);
      expect(dupa(tip)?.temei, tip).toMatch(/80¹/u);
    }
    expect(INSTRUIRI_SSM.some((r) => /8 ore/u.test(r.regula))).toBe(false);
  });

  it("spun că fișa se poate ține și în format electronic (HG 259/2022)", () => {
    expect(dupa("Consemnarea")?.regula).toMatch(/format electronic/u);
    expect(dupa("Formatul electronic")?.regula).toMatch(
      /semnătură electronică, avansată ori calificată/u,
    );
    expect(dupa("Formatul electronic")?.temei).toMatch(/81¹/u);
    expect(INSTRUIRI_SSM.some((r) => /pix|stilou/u.test(r.regula))).toBe(false);
  });

  it("suplimentara acoperă toate cele șapte cazuri din art. 98, inclusiv lit. b)", () => {
    // Auditul din 8 oct 2026: lipsea lit. b), schimbarea prevederilor SSM sau a
    // instrucțiunilor proprii, inclusiv din cauza riscurilor noi.
    const regula = dupa("Suplimentară")?.regula ?? "";
    for (const caz of [
      /30 de zile lucrătoare/u,
      /instrucțiunile proprii/u,
      /riscuri noi/u,
      /accident de muncă/u,
      /lucrări speciale/u,
      /echipament de muncă nou sau modificat/u,
      /tehnologii sau proceduri de lucru modificate ori noi/u,
    ]) {
      expect(regula).toMatch(caz);
    }
    expect(dupa("Suplimentară")?.temei).toMatch(/98 lit\. a\)–g\)/u);
  });

  it("spun cine face fiecare instruire și unde se păstrează fișa", () => {
    expect(dupa("La locul de muncă")?.cine).toMatch(/Conducătorul direct/u);
    expect(dupa("Periodică")?.cine).toMatch(/Conducătorul locului de muncă/u);
    expect(dupa("Consemnarea")?.cine).toMatch(/fișe de aptitudini/u);
    expect(dupa("Consemnarea")?.temei).toMatch(/81 alin\. \(1\)–\(5\)/u);
    for (const r of INSTRUIRI_SSM) expect(r.cine, r.tip).toMatch(/\.$/u);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-instruire-ssm/model.test.ts"
```

Ce trebuie să cadă (am rulat testul nou pe modelul de azi): **18 din 21**. Câteva mesaje:
- „are toate cele zece părți ale anexei”: fișa veche n-are `sectiuni`;
- „tabelele periodică și suplimentară…”: `Lipsește tabelul „Instruirea periodică”.`;
- „periodicitatea × anii…”, „casetele de viză…”, „adună intervalul…”: `… is not a function`;
- „suplimentara acoperă toate cele șapte cazuri…”: lipsește lit. b);
- „spun cine face fiecare instruire…”: `INSTRUIRI_SSM` n-are `cine`.

Trec și înainte doar „nu cere și nu scrie date despre sănătate…” (pază, nu țintă), „taie câmpurile…” și „dau minimul de o oră…”.

- [ ] **Pasul 3: Implementarea minimă**

Înlocuiește tot `src/app/(marketing)/unelte/fisa-instruire-ssm/model.ts` cu:

```ts
import { deplaseazaLuna, numarZileLuna, ziIso } from "@/domain/calendar/grila-lunara";
import { formatDate, parseDateRo } from "@/lib/format/date";
import { LINIE_GOALA, type Coloana, type DocumentTabelar } from "@/lib/unelte/document-tabelar";

/**
 * Fișa individuală de instruire SSM, după anexa nr. 11 la normele metodologice
 * aprobate prin HG 1425/2006, în forma consolidată din 7 martie 2022 (Portalul
 * Legislativ, doc. 252029, descărcată cu curl și recitită pe 8 oct 2026; istoricul
 * de consolidări: 27.09.2010, 27.12.2011, 21.10.2016, 07.03.2022 — anexa 11 n-a
 * fost modificată de niciunul dintre actele care au schimbat normele).
 *
 * ── CE E LUAT DIN ANEXĂ ───────────────────────────────────────────────────
 * Toate rubricile, în ordinea anexei: antetul cu datele lucrătorului; instruirea
 * la angajare 1) introductiv-generală, 2) la locul de muncă, 3) admis la lucru;
 * „Instruirea periodică”; „Instruirea periodică suplimentară” (cu „Data
 * efectuării”); „Rezultatele testărilor”; „Accidente de muncă sau îmbolnăviri
 * profesionale suferite”; „Sancțiuni aplicate…”; „CONTROL MEDICAL PERIODIC” și
 * „TESTAREA PSIHOLOGICĂ PERIODICĂ”, câte șase casete.
 *
 * Până pe 8 oct 2026 fișa avea doar primele trei, iar periodica și suplimentara
 * stăteau în același tabel. Art. 89 alin. (2) lit. a) cere ca rezultatul
 * testului de la angajare să se consemneze „în fișa de instruire individuală,
 * conform modelului prevăzut în anexa nr. 11”, deci fișa trebuie să aibă rubrica.
 *
 * ── CE NU SE CERE ÎN FORMULAR ─────────────────────────────────────────────
 * Grupa sanguină (dată despre sănătate, art. 9 GDPR), domiciliul, data și locul
 * nașterii rămân linii de completat de mână: formularul e GET, deci valorile ar
 * sta în adresă. CNP-ul nu e o rubrică a anexei și nu apare deloc.
 *
 * ── CE DECIDE OMUL ────────────────────────────────────────────────────────
 * Câte rânduri de instruire periodică: periodicitatea × anii acoperiți. Restul
 * tabelelor au numărul de rânduri din anexă; casetele medicale și psihologice
 * cresc cu anii (una pe an, cel puțin șase).
 */

export const PERIODICITATI = {
  lunara: { eticheta: "lunară", luni: 1 },
  trimestriala: { eticheta: "trimestrială", luni: 3 },
  semestriala: { eticheta: "semestrială (cel mult 6 luni)", luni: 6 },
  anuala: { eticheta: "anuală (doar personal tehnico-administrativ)", luni: 12 },
} as const;

export type Periodicitate = keyof typeof PERIODICITATI;

export const ANI_ACOPERITI = [1, 2, 3, 5, 10] as const;

export const PERIODICITATE_IMPLICITA: Periodicitate = "semestriala";
export const ANI_IMPLICITI = 5;

/** Câte rânduri are fiecare tabel în anexa 11 (în afară de periodică, care crește cu anii). */
export const RANDURI_ANEXA = { suplimentara: 6, testari: 5, accidente: 5, sanctiuni: 5 } as const;
/** Casetele de control medical și de testare psihologică: șase în anexă. */
export const CASETE_ANEXA = 6;
/** Rând de tabel cât să încapă o semnătură de mână: 28 pt ≈ 9,9 mm. */
export const INALT_RAND_FISA = 28;

export type ParametriFisaSsm = Readonly<{
  nume: string;
  marca: string;
  calificare: string;
  functie: string;
  locMunca: string;
  firma: string;
  /** Instruirea introductiv-generală: ziua ISO, orele, cine a făcut-o. */
  dataIg: string | null;
  oreIg: number | null;
  instructorIg: string;
  functieIg: string;
  /** Instruirea la locul de muncă. */
  dataLm: string | null;
  oreLm: number | null;
  instructorLm: string;
  functieLm: string;
  /** Cine admite la lucru (art. 94: șeful ierarhic al celui care a instruit). */
  admisNume: string;
  admisFunctie: string;
  periodicitate: Periodicitate;
  ani: number;
}>;

const text = (v: string | null) => (v ?? "").trim().slice(0, 120);
const LINIE = "__________";
/** Un rând întreg de scris de mână, cât lățimea utilă a unui A4 portret la 9–10 pt. */
const RAND_DE_SCRIS = `${LINIE_GOALA} ${LINIE_GOALA} ${LINIE_GOALA}`;
const sauLinie = (v: string, linie = LINIE) => (v === "" ? linie : v);

/** Ziua din `<input type="date">` (2026-10-08) sau scrisă de mână (08.10.2026); altfel `null`. */
function ziua(v: string | null): string | null {
  const brut = (v ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(brut);
  return iso === null ? parseDateRo(brut) : parseDateRo(`${iso[3]}.${iso[2]}.${iso[1]}`);
}

/** Ore întregi între 1 și 40: art. 80¹ cere cel puțin o oră pe fiecare fază. */
function ore(v: string | null): number | null {
  const brut = (v ?? "").trim();
  if (!/^\d{1,2}$/u.test(brut)) return null;
  const n = Number(brut);
  return n >= 1 && n <= 40 ? n : null;
}

function periodicitate(v: string | null): Periodicitate {
  return v !== null && Object.hasOwn(PERIODICITATI, v)
    ? (v as Periodicitate)
    : PERIODICITATE_IMPLICITA;
}

function ani(v: string | null): number {
  const n = Number(v);
  return (ANI_ACOPERITI as readonly number[]).includes(n) ? n : ANI_IMPLICITI;
}

export function parametriFisaSsm(q: URLSearchParams): ParametriFisaSsm {
  return {
    nume: text(q.get("nume")),
    marca: text(q.get("marca")),
    calificare: text(q.get("calificare")),
    functie: text(q.get("functie")),
    locMunca: text(q.get("loc")),
    firma: text(q.get("firma")),
    dataIg: ziua(q.get("data_ig")),
    oreIg: ore(q.get("ore_ig")),
    instructorIg: text(q.get("instructor_ig")),
    functieIg: text(q.get("functie_ig")),
    dataLm: ziua(q.get("data_lm")),
    oreLm: ore(q.get("ore_lm")),
    instructorLm: text(q.get("instructor_lm")),
    functieLm: text(q.get("functie_lm")),
    admisNume: text(q.get("admis_nume")),
    admisFunctie: text(q.get("admis_functie")),
    periodicitate: periodicitate(q.get("periodicitate")),
    ani: ani(q.get("ani")),
  };
}

/** Rândurile de instruire periodică: câte instruiri încap în anii aleși. */
export function randuriPeriodice(p: Periodicitate, numarAni: number): number {
  return (12 / PERIODICITATI[p].luni) * numarAni;
}

/** O casetă pe an, cel puțin cele șase din anexă, număr par (două pe rând). */
export function caseteViza(numarAni: number): number {
  const n = Math.max(CASETE_ANEXA, numarAni);
  return n % 2 === 0 ? n : n + 1;
}

/**
 * Termenele-limită ale instruirilor periodice, socotite de la ziua `start`
 * (ISO): fiecare e cu `luni` mai târziu decât precedentul. 31 august + 6 luni
 * cade pe ultima zi a lui februarie, nu pe 3 martie: intervalul e un maxim.
 */
export function scadentePeriodice(start: string, luni: number, numar: number): readonly string[] {
  const [an, luna, zi] = start.split("-").map(Number);
  if (an === undefined || luna === undefined || zi === undefined) return [];
  return Array.from({ length: numar }, (_, k) => {
    const tinta = deplaseazaLuna(an, luna, (k + 1) * luni);
    return ziIso(tinta.an, tinta.luna, Math.min(zi, numarZileLuna(tinta.an, tinta.luna)));
  });
}

const COLOANE_INSTRUIRE = (primaColoana: string): readonly Coloana[] => [
  { eticheta: primaColoana, latime: 2.2 },
  { eticheta: "Durata\n(h)", latime: 1.4 },
  { eticheta: "Ocupația", latime: 3 },
  { eticheta: "Materialul predat", latime: 4.2 },
  { eticheta: "Semnătura\ncelui\ninstruit", latime: 2.4 },
  { eticheta: "Semnătura\ncelui care\na instruit", latime: 2.4 },
  { eticheta: "Semnătura\ncelui care\na verificat", latime: 2.4 },
];

const SEMNATURI_ANGAJARE = [
  "Semnătura celui instruit",
  "Semnătura celui care a efectuat instruirea",
  "Semnătura celui care a verificat însușirea cunoștințelor",
] as const;

const goale = (n: number, coloane: number, prima: readonly string[] = []) =>
  Array.from({ length: n }, () => [
    ...prima,
    ...Array.from({ length: coloane - prima.length }, () => ""),
  ]);

export function construiesteFisaSsm(o: ParametriFisaSsm): DocumentTabelar {
  const data = (v: string | null) => (v === null ? LINIE : formatDate(v));
  const nrOre = (v: number | null) => (v === null ? LINIE : String(v));
  // Ocupația se scrie în a treia coloană a fiecărui rând; restul rămâne de completat.
  const randInstruire = (n: number) => goale(n, 7, o.functie === "" ? [] : ["", "", o.functie]);
  const casete = caseteViza(o.ani);
  return {
    titlu: "Fișă de instruire individuală privind securitatea și sănătatea în muncă",
    subtitlu: `Întreprinderea/unitatea: ${o.firma === "" ? LINIE.repeat(2) : o.firma}`,
    campuri: [
      { eticheta: "Numele și prenumele", valoare: o.nume },
      { eticheta: "Legitimația, marca", valoare: o.marca },
      { eticheta: "Grupa sanguină", valoare: "" },
      { eticheta: "Domiciliul", valoare: "" },
      { eticheta: "Data și locul nașterii", valoare: "" },
      { eticheta: "Calificarea", valoare: o.calificare },
      { eticheta: "Funcția", valoare: o.functie },
      { eticheta: "Locul de muncă", valoare: o.locMunca },
      { eticheta: "Autorizații (ISCIR ș.a.)", valoare: "" },
      { eticheta: "Traseul de deplasare la/de la serviciu", valoare: "" },
    ],
    paragrafe: [],
    coloane: [],
    randuri: [],
    umbrite: [],
    sectiuni: [
      {
        tip: "text",
        titlu: "Instruirea la angajare",
        paragrafe: [
          `1) Instruirea introductiv-generală a fost efectuată la data ${data(o.dataIg)}, timp de ${nrOre(o.oreIg)} ore, de către ${sauLinie(o.instructorIg, LINIE.repeat(2))}, având funcția de ${sauLinie(o.functieIg, LINIE.repeat(2))}.`,
          "Conținutul instruirii:",
          RAND_DE_SCRIS,
          RAND_DE_SCRIS,
        ],
        semnaturi: SEMNATURI_ANGAJARE,
      },
      {
        tip: "text",
        titlu: null,
        paragrafe: [
          `2) Instruirea la locul de muncă a fost efectuată la data ${data(o.dataLm)}, loc de muncă/post de lucru ${sauLinie(o.locMunca, LINIE.repeat(2))}, timp de ${nrOre(o.oreLm)} ore, de către ${sauLinie(o.instructorLm, LINIE.repeat(2))}, având funcția de ${sauLinie(o.functieLm, LINIE.repeat(2))}.`,
          "Conținutul instruirii:",
          RAND_DE_SCRIS,
          RAND_DE_SCRIS,
        ],
        semnaturi: SEMNATURI_ANGAJARE,
      },
      {
        tip: "text",
        titlu: null,
        paragrafe: [
          `3) Admis la lucru. Numele și prenumele ${sauLinie(o.admisNume, LINIE.repeat(2))}, funcția (șef secție, atelier, șantier etc.) ${sauLinie(o.admisFunctie, LINIE.repeat(2))}, data și semnătura ${LINIE.repeat(2)}.`,
        ],
        semnaturi: [],
      },
      {
        tip: "tabel",
        titlu: "Instruirea periodică",
        coloane: COLOANE_INSTRUIRE("Data\ninstruirii"),
        randuri: randInstruire(randuriPeriodice(o.periodicitate, o.ani)),
        inaltimeRand: INALT_RAND_FISA,
      },
      {
        tip: "tabel",
        titlu: "Instruirea periodică suplimentară",
        coloane: COLOANE_INSTRUIRE("Data\nefectuării"),
        randuri: randInstruire(RANDURI_ANEXA.suplimentara),
        inaltimeRand: INALT_RAND_FISA,
      },
      {
        tip: "tabel",
        titlu: "Rezultatele testărilor",
        coloane: [
          { eticheta: "Data", latime: 2.2 },
          { eticheta: "Materialul examinat", latime: 8 },
          { eticheta: "Calificativ", latime: 3 },
          { eticheta: "Examinator", latime: 4.8 },
        ],
        randuri: goale(RANDURI_ANEXA.testari, 4),
        inaltimeRand: INALT_RAND_FISA,
      },
      {
        tip: "tabel",
        titlu: "Accidente de muncă sau îmbolnăviri profesionale suferite",
        coloane: [
          { eticheta: "Data producerii\nevenimentului", latime: 3.4 },
          { eticheta: "Diagnosticul medical", latime: 6.4 },
          { eticheta: "Nr. și data PV de\ncercetare a evenimentului", latime: 4.6 },
          { eticheta: "Nr. zile\nITM", latime: 1.6 },
        ],
        randuri: goale(RANDURI_ANEXA.accidente, 4),
        inaltimeRand: INALT_RAND_FISA,
      },
      {
        tip: "tabel",
        titlu:
          "Sancțiuni aplicate pentru nerespectarea reglementărilor de securitate și sănătate în muncă",
        coloane: [
          { eticheta: "Abaterea săvârșită", latime: 7 },
          { eticheta: "Sancțiunea administrativă", latime: 5 },
          { eticheta: "Nr. și data deciziei", latime: 4 },
        ],
        randuri: goale(RANDURI_ANEXA.sanctiuni, 3),
        inaltimeRand: INALT_RAND_FISA,
      },
      {
        tip: "casete",
        titlu: "Control medical periodic",
        numar: casete,
        rubrica: "Observații de specialitate",
        semnaturi: ["Semnătura și parafa medicului de medicina muncii", "Data vizei"],
        nota: null,
      },
      {
        tip: "casete",
        titlu: "Testarea psihologică periodică",
        numar: casete,
        rubrica: "Apt psihologic pentru:*",
        semnaturi: ["Semnătura psihologului", "Data"],
        nota: "* lucru la înălțime, lucru în condiții de izolare, conducători auto etc.",
      },
    ],
    note: [
      "Fișa se completează olograf sau electronic, imediat după verificarea instruirii, și se semnează de lucrătorul instruit și de persoanele care au efectuat și au verificat instruirea — art. 81 alin. (2)–(3¹) din normele aprobate prin HG 1425/2006.",
      "Se păstrează la conducătorul locului de muncă, însoțită de o copie a ultimei fișe de aptitudini de la medicina muncii, de la angajare până la încetarea raporturilor de muncă — art. 81 alin. (4)–(5).",
    ],
    semnaturi: [],
    orientare: "portret",
    numeFisier: `fisa-instruire-ssm-${o.nume === "" ? "necompletata" : o.nume}`,
    antetRulant: `Fișă de instruire individuală SSM — ${o.nume === "" ? `Numele și prenumele: ${LINIE_GOALA}` : o.nume}${o.firma === "" ? "" : ` — ${o.firma}`}`,
  };
}

export function fisaSsmDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteFisaSsm(parametriFisaSsm(q));
}

/**
 * Regulile din banda „Ce spun normele”, cu articolul din normele aprobate prin
 * HG 1425/2006 (forma consolidată din 07.03.2022, doc. 252029, recitită pe 8 oct
 * 2026). Durata minimă e o oră pe fiecare fază și pe instruirea suplimentară
 * (art. 80¹, din HG 767/2016); restul o stabilește angajatorul, prin programul
 * de instruire-testare.
 */
export const INSTRUIRI_SSM = [
  {
    tip: "Cele trei faze",
    regula: "Instruirea SSM are trei faze: introductiv-generală, la locul de muncă și periodică.",
    cine: "Angajatorul răspunde de toate trei și are programe de instruire-testare pe meserii și activități.",
    temei: "art. 77 și 80",
  },
  {
    tip: "Introductiv-generală",
    regula:
      "La angajare, la detașare, la delegare și la lucrătorul temporar. Durata o stabilește angajatorul prin programul de instruire-testare, după riscurile firmei, dar nu poate fi mai mică de o oră. Se încheie cu un test, iar cine nu și-a însușit cunoștințele nu poate fi angajat.",
    cine: "Angajatorul care și-a asumat atribuțiile SSM, lucrătorul desemnat sau serviciul intern ori extern de prevenire și protecție; individual sau în grupe de cel mult 20 de persoane.",
    temei: "art. 80¹, 83, 85–87 și 89",
  },
  {
    tip: "La locul de muncă",
    regula:
      "După cea introductiv-generală, la postul de lucru, și din nou la schimbarea locului de muncă în firmă. Durata o stabilește angajatorul împreună cu conducătorul locului de muncă, cu lucrătorul desemnat sau cu serviciul de prevenire și protecție, dar nu mai puțin de o oră. Cuprinde obligatoriu demonstrații practice.",
    cine: "Conducătorul direct al locului de muncă, în grupe de cel mult 20 de persoane.",
    temei: "art. 80¹, 90–93",
  },
  {
    tip: "Admiterea la lucru",
    regula:
      "Lucrătorul începe efectiv lucrul abia după ce i se verifică însușirea cunoștințelor, iar verificarea se consemnează în fișă.",
    cine: "Șeful ierarhic superior celui care a făcut instruirea la locul de muncă.",
    temei: "art. 94",
  },
  {
    tip: "Periodică",
    regula:
      "Intervalul dintre două instruiri periodice nu va fi mai mare de 6 luni; pentru personalul tehnico-administrativ, de cel mult 12 luni. Intervalul exact și periodicitatea verificării le stabilește programul de instruire-testare. Se completează obligatoriu cu demonstrații practice.",
    cine: "Conducătorul locului de muncă. O verifică șeful lui ierarhic și, prin sondaj, angajatorul sau serviciul de prevenire, care semnează fișa.",
    temei: "art. 96",
  },
  {
    tip: "Suplimentară",
    regula:
      "În plus față de cea programată, de cel puțin o oră: când lucrătorul a lipsit peste 30 de zile lucrătoare; când s-au schimbat prevederile SSM sau instrucțiunile proprii, inclusiv din cauza evoluției riscurilor ori a unor riscuri noi; la reluarea lucrului după un accident de muncă; la lucrări speciale; la un echipament de muncă nou sau modificat; la tehnologii sau proceduri de lucru modificate ori noi.",
    cine: "Conducătorul locului de muncă, fiindcă e tot o instruire periodică. Durata o stabilește angajatorul, cu conducătorul locului de muncă, lucrătorul desemnat sau serviciul de prevenire și protecție.",
    temei: "art. 80¹, 96 alin. (1), 98 lit. a)–g) și 99",
  },
  {
    tip: "Consemnarea",
    regula:
      "Obligatoriu în fișa individuală, pe hârtie sau în format electronic, cu materialul predat, durata și data. Se completează imediat după verificarea instruirii și o semnează lucrătorul instruit și cei care au efectuat și au verificat instruirea.",
    cine: "Fișa o păstrează conducătorul locului de muncă, însoțită de o copie a ultimei fișe de aptitudini de la medicina muncii, de la angajare până la încetarea raporturilor de muncă.",
    temei: "art. 81 alin. (1)–(5)",
  },
  {
    tip: "Formatul electronic",
    regula:
      "Din martie 2022, fișa se poate ține electronic, semnată olograf sau cu semnătură electronică, avansată ori calificată, cum stabilește regulamentul intern. Procedura semnăturii electronice se trece în contractul individual de muncă, iar angajatorul asigură trasabilitatea și integritatea materialelor fiecărei instruiri electronice. Când instruirea se face electronic, fișa o semnează electronic toți cei implicați.",
    cine: "Angajatorul alege varianta prin regulamentul intern.",
    temei: "art. 81 alin. (3¹)–(3³) și 81¹ (HG 259/2022)",
  },
] as const;
```

În `e2e/unelte-tipar.spec.ts`, rândul scris de B6:

```ts
  { eticheta: "fișa SSM", cale: "/unelte/fisa-instruire-ssm", culcat: true, pagini: [1, 3] },
```

devine (H7 strânge intervalul pe numărul măsurat):

```ts
  { eticheta: "fișa SSM", cale: "/unelte/fisa-instruire-ssm", culcat: false, pagini: [3, 7] },
```

(Verificat pe 8 oct 2026 în `B-robustete-comuna.md`, B6: după verificarea planului B, fiecare intrare din `PAGINI` are și `eticheta`, folosită în numele testului `tipar: ${p.eticheta}`. Forma fără `eticheta`, scrisă inițial aici, nu se mai găsea la caracter. Dacă la execuție rândul diferă iar, se schimbă doar `culcat` și `pagini`, restul rândului rămâne cum l-a lăsat B6.)

În `src/content/landing/harta.ts`, în blocul `cale: "/unelte/fisa-instruire-ssm"`, `actualizat: "2026-10-07",` devine `actualizat: "<data de azi, `date +%F`>",`. Documentul descărcabil al paginii se schimbă, deci data se schimbă și ea, chiar dacă `page.tsx` rămâne neatins.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte" src/lib/unelte "src/app/api/unelte" "src/app/(marketing)/_componente"
CAI=("src/app/(marketing)/unelte/fisa-instruire-ssm/model.ts" "src/app/(marketing)/unelte/fisa-instruire-ssm/model.test.ts" e2e/unelte-tipar.spec.ts src/content/landing/harta.ts)
pnpm exec prettier --write "${CAI[@]}" && pnpm exec prettier --check "${CAI[@]}"
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

`model.test.ts`: 21 de teste verzi. Pagina veche (`page.tsx`, cu cele 4 câmpuri) compilează și randează mai departe: folosește doar `construiesteFisaSsm`, `parametriFisaSsm`, `INSTRUIRI_SSM.tip/regula/temei`, toate păstrate. `descarcari.test.tsx` și `unelte/tipar.test.tsx` (B6) rămân verzi.

- [ ] **Pasul 5: Documentele reale, randate**

Scrie întâi `$SCRATCH/sonda-xml-ssm.mjs`, validatorul cu saxes (parserul strict pe care B2 l-a adus ca devDependency):

```js
// Validează cu saxes (parserul strict din exceljs) toate părțile XML ale unui .docx.
// Folosire: node sonda-xml-ssm.mjs <fisier.docx>
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire("/srv/apps/ERP/package.json");
const JSZip = require("jszip");
const { SaxesParser } = require("saxes");

const zip = await JSZip.loadAsync(readFileSync(process.argv[2]));
let rele = 0;
for (const nume of Object.keys(zip.files).filter((f) => /^word\/.*\.xml$/u.test(f))) {
  const erori = [];
  const parser = new SaxesParser({ xmlns: true });
  parser.on("error", (e) => erori.push(e.message));
  parser.write(await zip.file(nume).async("string")).close();
  if (erori.length > 0) {
    rele += 1;
    console.log(nume, erori.slice(0, 2));
  }
}
console.log(rele === 0 ? "Word valid" : `Word INVALID în ${String(rele)} părți`);
```

```bash
cd /srv/apps/ERP
cat > src/lib/unelte/zz-proba-fisa.test.ts <<'EOF'
import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { it } from "vitest";
import { fisaSsmDinParametri } from "@/app/(marketing)/unelte/fisa-instruire-ssm/model";
import { raspunsDocument } from "./raspuns";
const D = process.env.IESIRE ?? "/tmp";
const CAZURI: Record<string, Record<string, string>> = {
  gol: {},
  complet: { nume: "Popescu Ștefanța", marca: "M-117", calificare: "Țesătoare", functie: "Operator țesătorie", loc: "Atelier Țesătorie", firma: "Țesătoria „Ardeleana” SRL", data_ig: "2026-10-05", ore_ig: "2", instructor_ig: "Ionescu Maria", functie_ig: "Lucrător desemnat", data_lm: "2026-10-06", ore_lm: "4", instructor_lm: "Vasile Dan", functie_lm: "Șef atelier", admis_nume: "Georgescu Ana", admis_functie: "Director tehnic" },
  lunar10: { nume: "Popa Ion", periodicitate: "lunara", ani: "10" },
  control: { nume: "a\u0001\u000Bb", firma: "F\u000CSRL" },
};
it("probă", async () => {
  for (const [n, p] of Object.entries(CAZURI)) {
    const d = { ...fisaSsmDinParametri(new URLSearchParams(p)), sursa: "/unelte/fisa-instruire-ssm" };
    for (const f of ["pdf", "docx"] as const) {
      const t0 = performance.now();
      const b = new Uint8Array(await (await raspunsDocument(d, f)).arrayBuffer());
      writeFileSync(`${D}/${n}.${f}`, b);
      const extra = f === "pdf" ? ` pagini=${String((await PDFDocument.load(b)).getPageCount())}` : "";
      console.log(n, f, b.length, `${String(Math.round(performance.now() - t0))}ms${extra}`);
    }
  }
}, 60000);
EOF
mkdir -p "$SCRATCH/fisa-h6"
IESIRE="$SCRATCH/fisa-h6" pnpm exec vitest run src/lib/unelte/zz-proba-fisa.test.ts --reporter=verbose 2>&1 | grep -E "pdf|docx"
rm src/lib/unelte/zz-proba-fisa.test.ts
"$SCRATCH/venv-pdf/bin/python" -I -c "import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); [d[i].render(scale=1.2).to_pil().save(f'{sys.argv[2]}-{i+1}.png') for i in range(len(d))]" "$SCRATCH/fisa-h6/complet.pdf" "$SCRATCH/fisa-h6/complet"
node "$SCRATCH/sonda-xml-ssm.mjs" "$SCRATCH/fisa-h6/control.docx"
node "$SCRATCH/sonda-xml-ssm.mjs" "$SCRATCH/fisa-h6/complet.docx"
git status --short -- src/lib/unelte/   # NU trebuie să apară zz-proba-fisa.test.ts
```

Valorile pe care le-am măsurat eu pe codul H (în ordinea `gol`, `complet`, `lunar10`, `control`):
- PDF: 4, 4, 9 și 4 pagini, sub 0,7 s fiecare (prima generare încarcă fontul);
- DOCX: ~16 KB.

Cele două rulări ale sondei XML scriu `Word valid`.

Pe PNG-urile lui `complet`:
- pagina 1 are antetul cu 10 rubrici, „Instruirea la angajare” cu trei casete de semnătură etichetate la 1) și la 2), punctul 3) și primele 5 rânduri periodice, cu „Operator țesătorie” întreg în „Ocupația”;
- pagina 2: restul periodicei, suplimentara (6) și testările (5), sus cu „Fișă de instruire individuală SSM — Popescu Ștefanța — Țesătoria „Ardeleana” SRL”;
- pagina 3: accidentele și sancțiunile, întregi, apoi 6 casete medicale;
- pagina 4: 6 casete psihologice, nota cu asteriscul, cele două note art. 81 și „Generat gratuit cu administrativo.ro” | „Pagina 4 din 4”.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=("src/app/(marketing)/unelte/fisa-instruire-ssm/model.ts" "src/app/(marketing)/unelte/fisa-instruire-ssm/model.test.ts" e2e/unelte-tipar.spec.ts src/content/landing/harta.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
fix(unelte): fișa de instruire SSM are toate rubricile anexei 11

Fișa nu avea rezultatele testărilor, accidentele, sancțiunile, controlul
medical periodic și testarea psihologică, și scria singură pe document că
anexa „mai cuprinde” ceva (auditul din 8 oct 2026, critic confirmat). Acum
reproduce anexa 11 la HG 1425/2006 (consolidarea din 07.03.2022) în ordinea
ei, pe A4 portret, cu rânduri de 1 cm, rubrici de semnătură etichetate și
numele pe fiecare pagină. Rândurile periodice urmează periodicitatea și anii
aleși; datele cunoscute ajung în punctele 1)–3) și în „Ocupația”. Normele de
pe pagină au art. 98 complet, cine face fiecare instruire și art. 81 alin. (4).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
git push origin main
node scripts/checks/lastmod.mjs
```

---

### Task H7: Pagina: formular complet, termene, cine face fiecare instruire

**Fișiere:**
- Modify (rescris integral): `src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx` (170 de linii azi, citite; după B6 are `data-tipar="ascunde"` pe `Banda` formularului, iar noul fișier îl păstrează)
- Test: `src/app/(marketing)/unelte/fisa-instruire-ssm/pagina.test.tsx` (Create)
- Modify: `src/content/landing/unelte.ts:52` (lead-ul `ANTET_FISA_SSM`), `src/app/llms.txt/route.ts:144`, `src/app/(marketing)/unelte/page.tsx:70` (nota din hub), `src/content/landing/ro.ts:977`, `src/content/landing/en.ts:937`, `src/content/landing/harta.ts` (`actualizat`), `e2e/unelte-tipar.spec.ts` (intervalul măsurat)

**Interfețe:**
- Consumă: tot ce produce H6; `cuDe(n, substantiv)` din `@/content/legal/zile-libere`; `formatDate` din `@/lib/format/date`; componentele `AntetSecundar`, `Banda` (cu `data-tipar`, B5), `Cadru`, `Descarcari`, `JsonLd`, `metadatePagina`, `nodUnealta`, `PeAcelasiSubiect` și `PrevizualizareDocument` din `../../_componente/`; `LEGATURI_CONEXE`, `RO`, `ANTET_FISA_SSM`. Semnătura paginii rămâne `searchParams: Promise<…>` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:75`).
- Produce: pagina cu atributele `data-scadente` (lista termenelor) și `data-rinduri` (câte rânduri periodice), pe care se sprijină testul și sonda headless.

- [ ] **Pasul 1: Scrie testul care pică**

Creează `src/app/(marketing)/unelte/fisa-instruire-ssm/pagina.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PaginaFisaSsm, { metadata } from "./page";

const cu = async (parametri: Record<string, string>) =>
  render(await PaginaFisaSsm({ searchParams: Promise.resolve(parametri) }));

/**
 * Pagina uneltei: formularul are câmpurile pe care le citește `parametriFisaSsm`,
 * descărcările sunt doar Word și PDF, termenele apar doar când există o dată de
 * pornire, iar normele spun cine face fiecare instruire.
 */
describe("pagina fișei de instruire SSM", () => {
  it("formularul trimite toate câmpurile pe care le citește modelul", async () => {
    const { container } = await cu({});
    const nume = [...container.querySelectorAll("form [name]")].map((e) => e.getAttribute("name"));
    for (const n of [
      "nume",
      "marca",
      "calificare",
      "functie",
      "loc",
      "firma",
      "data_ig",
      "ore_ig",
      "instructor_ig",
      "functie_ig",
      "data_lm",
      "ore_lm",
      "instructor_lm",
      "functie_lm",
      "admis_nume",
      "admis_functie",
      "periodicitate",
      "ani",
    ]) {
      expect(nume, n).toContain(n);
    }
    const formate = [...container.querySelectorAll('button[name="format"]')].map((b) =>
      b.getAttribute("value"),
    );
    expect(formate).toEqual(["docx", "pdf"]);
  });

  it("nu are câmpuri pentru grupa sanguină, domiciliu, data nașterii sau CNP", async () => {
    const { container } = await cu({});
    const etichete = [...container.querySelectorAll("form label")].map((l) => l.textContent ?? "");
    for (const interzis of [/sanguin/iu, /domicil/iu, /nașter/iu, /CNP/u]) {
      expect(
        etichete.some((e) => interzis.test(e)),
        String(interzis),
      ).toBe(false);
    }
  });

  it("previzualizarea are toate părțile anexei 11, cu datele completate", async () => {
    const { container } = await cu({ nume: "Popa Ion", functie: "Sudor", data_ig: "2026-10-05" });
    const doc = container.querySelector("#documentul")?.textContent ?? "";
    for (const parte of [
      "Instruirea la angajare",
      "Instruirea periodică suplimentară",
      "Rezultatele testărilor",
      "Accidente de muncă sau îmbolnăviri profesionale suferite",
      "Control medical periodic",
      "Testarea psihologică periodică",
    ]) {
      expect(doc, parte).toContain(parte);
    }
    expect(doc).toContain("la data 05.10.2026");
    expect(doc).not.toContain("mai cuprinde");
  });

  it("deschide secțiunea de angajare doar când are date", async () => {
    const gol = await cu({});
    expect(gol.container.querySelector<HTMLDetailsElement>("form details")?.open).toBe(false);
    const plin = await cu({ instructor_ig: "Ionescu Maria" });
    expect(plin.container.querySelector<HTMLDetailsElement>("form details")?.open).toBe(true);
  });

  it("arată termenele periodice de la instruirea la locul de muncă, nu din document", async () => {
    const { container } = await cu({
      nume: "Popa Ion",
      data_ig: "2026-10-05",
      data_lm: "2026-10-06",
      periodicitate: "semestriala",
      ani: "1",
    });
    const termene = [...container.querySelectorAll("[data-scadente] li")].map(
      (li) => li.textContent,
    );
    expect(termene).toEqual(["06.04.2027", "06.10.2027"]);
    expect(container.querySelector("#documentul")?.textContent ?? "").not.toContain("06.04.2027");
    expect((await cu({})).container.querySelectorAll("[data-scadente] li")).toHaveLength(0);
  });

  it("spune câte rânduri periodice va avea fișa", async () => {
    const { container } = await cu({ periodicitate: "lunara", ani: "2" });
    expect(container.querySelector("[data-rinduri]")?.getAttribute("data-rinduri")).toBe("24");
    expect(container.textContent).toContain("24 de rânduri");
  });

  it("normele: art. 98 complet, anexa 12 și legătura spre modulul SSM", async () => {
    const { container } = await cu({});
    const text = container.textContent ?? "";
    expect(text).toContain("98 lit. a)–g)");
    expect(text).toContain("anexa 12");
    expect(text).toContain("fișe de aptitudini");
    expect(container.querySelector('a[href="/module/ssm"]')).not.toBeNull();
  });

  it("titlul paginii are cel mult 48 de caractere", () => {
    const titlu = typeof metadata.title === "string" ? metadata.title : "";
    expect(titlu.length).toBeGreaterThan(0);
    expect(titlu.length).toBeLessThanOrEqual(48);
  });
});
```

(Am verificat că pagina se randează în `happy-dom` cu `render(await Pagina({ searchParams }))`, ca în `tipar.test.tsx` din B6. Meniul din `Antet` are și el un `<details>`, de aceea testul caută `form details`.)

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-instruire-ssm/pagina.test.tsx"
```

Ce trebuie să cadă (am rulat testul pe pagina de după B6, cu modelul din H6):
- „formularul trimite toate câmpurile…”: `marca: expected [ 'nume', 'functie', 'loc', …(3) ] to include 'marca'`;
- „previzualizarea are toate părțile…”: `expected 'Fișă de instruire individuală privind…' to contain 'la data 05.10.2026'` (pagina veche trimite modelului doar cele 4 câmpuri ale ei);
- „deschide secțiunea de angajare…”: `expected undefined to be false` (nu există `form details`);
- „arată termenele periodice…”: `expected [] to deeply equal [ '06.04.2027', '06.10.2027' ]`;
- „spune câte rânduri…”: `expected undefined to be '24'`;
- „normele: art. 98 complet…”: `… to contain 'anexa 12'`.

Trec și înainte: „nu are câmpuri pentru grupa sanguină…” și „titlul paginii are cel mult 48 de caractere”.

- [ ] **Pasul 3: Implementarea minimă**

Înlocuiește tot `src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx` cu:

```tsx
// src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_FISA_SSM } from "@/content/landing/unelte";
import { cuDe } from "@/content/legal/zile-libere";
import { formatDate } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { Descarcari } from "../../_componente/descarcari";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import {
  ANI_ACOPERITI,
  construiesteFisaSsm,
  INSTRUIRI_SSM,
  parametriFisaSsm,
  PERIODICITATI,
  randuriPeriodice,
  scadentePeriodice,
  type Periodicitate,
} from "./model";

/**
 * Fișa individuală de instruire SSM, gratuită, completă după anexa 11.
 *
 * Fiecare rând din banda „Ce spun normele” are articolul lui din normele
 * aprobate prin HG 1425/2006, în forma consolidată din 07.03.2022 (Portalul
 * Legislativ, doc. 252029, recitită pe 8 oct 2026). Lista stă în `model.ts`,
 * unde o păzește un test.
 *
 * Termenele instruirii periodice se arată DOAR pe pagină: anexa n-are o
 * rubrică pentru ele, iar o dată tipărită în coloana „Data instruirii” ar
 * arăta ca o instruire făcută.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Fișa individuală de instruire SSM: model gratuit",
  descriere:
    "Fișa individuală de instruire SSM completă, după anexa 11 la HG 1425/2006: la angajare, periodică, suplimentară, testări, control medical. Word sau PDF.",
  cale: "/unelte/fisa-instruire-ssm",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_GRUP = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
const CLASA_LEGENDA = "font-mk-display col-span-full text-[1rem] font-semibold";

const CAMPURI_LUCRATOR = [
  { nume: "nume", eticheta: "Numele și prenumele", exemplu: "Popa Ion" },
  { nume: "marca", eticheta: "Legitimația, marca", exemplu: "" },
  { nume: "calificare", eticheta: "Calificarea", exemplu: "Electrician" },
  { nume: "functie", eticheta: "Funcția", exemplu: "Electrician întreținere" },
  { nume: "loc", eticheta: "Locul de muncă", exemplu: "Atelier întreținere" },
  { nume: "firma", eticheta: "Întreprinderea/unitatea", exemplu: "" },
] as const;

const FAZE = [
  {
    titlu: "1) Introductiv-generală",
    data: "data_ig",
    ore: "ore_ig",
    instructor: "instructor_ig",
    functie: "functie_ig",
    exemplu: "Lucrător desemnat",
  },
  {
    titlu: "2) La locul de muncă",
    data: "data_lm",
    ore: "ore_lm",
    instructor: "instructor_lm",
    functie: "functie_lm",
    exemplu: "Șef atelier",
  },
] as const;

/** Câte termene se arată pe pagină; restul le ține minte modulul SSM. */
const SCADENTE_PE_PAGINA = 6;

function Camp({
  nume,
  eticheta,
  valoare,
  exemplu = "",
  tip = "text",
}: Readonly<{
  nume: string;
  eticheta: string;
  valoare: string;
  exemplu?: string;
  tip?: "text" | "date" | "number";
}>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.875rem] font-medium">{eticheta}</span>
      <input
        type={tip}
        name={nume}
        defaultValue={valoare}
        placeholder={exemplu}
        className={CLASA_CAMP}
        {...(tip === "text" ? { maxLength: 120 } : {})}
        {...(tip === "number" ? { min: 1, max: 40, step: 1, inputMode: "numeric" as const } : {})}
      />
    </label>
  );
}

export default async function PaginaFisaSsm({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const [cheie, v] of Object.entries(p)) {
    const valoare = unul(v);
    if (valoare !== undefined && valoare !== "") q.set(cheie, valoare);
  }
  const ales = parametriFisaSsm(q);
  const document = construiesteFisaSsm(ales);
  const lucrator: Readonly<Record<(typeof CAMPURI_LUCRATOR)[number]["nume"], string>> = {
    nume: ales.nume,
    marca: ales.marca,
    calificare: ales.calificare,
    functie: ales.functie,
    loc: ales.locMunca,
    firma: ales.firma,
  };
  const ore = (v: number | null) => (v === null ? "" : String(v));
  const faze: Readonly<Record<string, string>> = {
    data_ig: ales.dataIg ?? "",
    ore_ig: ore(ales.oreIg),
    instructor_ig: ales.instructorIg,
    functie_ig: ales.functieIg,
    data_lm: ales.dataLm ?? "",
    ore_lm: ore(ales.oreLm),
    instructor_lm: ales.instructorLm,
    functie_lm: ales.functieLm,
  };
  const angajareCompletata =
    Object.values(faze).some((v) => v !== "") || ales.admisNume !== "" || ales.admisFunctie !== "";
  const nrRanduri = randuriPeriodice(ales.periodicitate, ales.ani);
  // Prima instruire periodică se socotește de la ultima instruire la angajare.
  const start = ales.dataLm ?? ales.dataIg;
  const scadente =
    start === null
      ? []
      : scadentePeriodice(
          start,
          PERIODICITATI[ales.periodicitate].luni,
          Math.min(nrRanduri, SCADENTE_PE_PAGINA),
        );

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/fisa-instruire-ssm",
          nume: ANTET_FISA_SSM.titlu,
          descriere: ANTET_FISA_SSM.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_FISA_SSM}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Fișa de instruire SSM", href: "/unelte/fisa-instruire-ssm" },
          ]}
        />
      </div>

      {/* Toată banda formularului rămâne pe ecran: altfel umplutura și rigla ei
          se tipăreau goale deasupra documentului. */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <form action="#documentul" method="get" className="grid gap-8" data-tipar="ascunde">
          <fieldset className={CLASA_GRUP}>
            <legend className={CLASA_LEGENDA}>Lucrătorul</legend>
            {CAMPURI_LUCRATOR.map((c) => (
              <Camp
                key={c.nume}
                nume={c.nume}
                eticheta={c.eticheta}
                valoare={lucrator[c.nume]}
                exemplu={c.exemplu}
              />
            ))}
          </fieldset>

          <details open={angajareCompletata} className="border-mk-rigla/40 border-t pt-4">
            <summary className="cursor-pointer text-[0.9375rem] font-medium">
              Instruirea la angajare: data, orele, cine a instruit (opțional)
            </summary>
            <div className="mt-4 grid gap-6">
              {FAZE.map((f) => (
                <fieldset key={f.data} className={CLASA_GRUP}>
                  <legend className={CLASA_LEGENDA}>{f.titlu}</legend>
                  <Camp nume={f.data} eticheta="Data" valoare={faze[f.data] ?? ""} tip="date" />
                  <Camp
                    nume={f.ore}
                    eticheta="Durata (ore, cel puțin 1)"
                    valoare={faze[f.ore] ?? ""}
                    tip="number"
                  />
                  <Camp
                    nume={f.instructor}
                    eticheta="Cine a făcut instruirea"
                    valoare={faze[f.instructor] ?? ""}
                  />
                  <Camp
                    nume={f.functie}
                    eticheta="Funcția lui"
                    valoare={faze[f.functie] ?? ""}
                    exemplu={f.exemplu}
                  />
                </fieldset>
              ))}
              <fieldset className={CLASA_GRUP}>
                <legend className={CLASA_LEGENDA}>3) Admis la lucru de</legend>
                <Camp nume="admis_nume" eticheta="Numele și prenumele" valoare={ales.admisNume} />
                <Camp
                  nume="admis_functie"
                  eticheta="Funcția (șef secție, atelier, șantier)"
                  valoare={ales.admisFunctie}
                />
              </fieldset>
            </div>
          </details>

          <fieldset className={CLASA_GRUP}>
            <legend className={CLASA_LEGENDA}>Rândurile de instruire periodică</legend>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">Periodicitatea</span>
              <select name="periodicitate" defaultValue={ales.periodicitate} className={CLASA_CAMP}>
                {(Object.keys(PERIODICITATI) as Periodicitate[]).map((k) => (
                  <option key={k} value={k}>
                    {PERIODICITATI[k].eticheta}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">Pentru câți ani</span>
              <select name="ani" defaultValue={String(ales.ani)} className={CLASA_CAMP}>
                {ANI_ACOPERITI.map((n) => (
                  <option key={n} value={String(n)}>
                    {n === 1 ? "un an" : `${String(n)} ani`}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-mk-text-slab self-end text-[0.875rem]" data-rinduri={nrRanduri}>
              Fișa va avea {nrRanduri === 1 ? "un rând" : cuDe(nrRanduri, "rânduri")} de instruire
              periodică și 6 pentru instruirea suplimentară, fiecare înalt de 1 cm.
            </p>
          </fieldset>

          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <button
              type="submit"
              data-umami-event="ssm-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 items-center justify-center rounded px-8 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează fișa
            </button>
            <Descarcari
              actiune="/api/unelte/fisa-instruire-ssm"
              eveniment="ssm"
              formate={["docx", "pdf"]}
            />
          </div>
        </form>
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <Banda
          inaltime="scurta"
          supratitlu="Ce spun normele"
          titlu="Cine face fiecare instruire și când"
          lead="Articolele sunt din normele metodologice aprobate prin HG 1425/2006, în forma consolidată din 7 martie 2022. Fișa de mai sus are toate rubricile anexei 11, în ordinea ei."
        >
          <dl className="border-mk-rigla/40 mt-6 border-t">
            {INSTRUIRI_SSM.map((r) => (
              <div
                key={r.tip}
                className="border-mk-rigla/40 grid gap-1 border-b py-4 md:grid-cols-12 md:gap-8"
              >
                <dt className="font-mk-display text-[1rem] font-semibold md:col-span-3">{r.tip}</dt>
                <dd className="text-mk-text-slab text-[0.9375rem] leading-[1.65] md:col-span-7">
                  {r.regula} <span className="text-mk-text">Cine: {r.cine}</span>
                </dd>
                <dd className="font-mk-date text-mk-text-slab text-[0.75rem] tracking-[0.04em] md:col-span-2">
                  {r.temei}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-mk-text-slab mt-6 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            Lucrătorii unei firme care îți prestează servicii și vizitatorii nu primesc fișă
            individuală: pentru ei se întocmește fișa de instruire colectivă din anexa 12, în două
            exemplare sau electronic (art. 82 alin. (2)–(4)).
          </p>
        </Banda>
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Fără hârtie" titlu="Scadențele, înainte să treacă">
          {scadente.length > 0 && (
            <div className="mt-4">
              <p className="max-w-[68ch] text-[0.9375rem] leading-[1.7]">
                Instruirea periodică{ales.nume === "" ? "" : ` pentru ${ales.nume}`}, la
                periodicitatea aleasă, socotită de la {formatDate(start ?? "")}, cel târziu la:
              </p>
              <ol data-scadente className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
                {scadente.map((zi) => (
                  <li key={zi} className="font-mk-date">
                    {formatDate(zi)}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            Instruirile periodice, fișele de aptitudini și echipamentul de protecție, cu alertă
            înainte de termen, pentru fiecare om.{" "}
            <Link href="/module/ssm" className="underline underline-offset-4">
              Cum arată modulul SSM
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/fisa-instruire-ssm"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
```

`src/content/landing/unelte.ts`, în `ANTET_FISA_SSM`:

```ts
  lead: "Fișa individuală de instruire după anexa 11 la HG 1425/2006, cu datele lucrătorului completate: instruirea la angajare, periodică și suplimentară, cu cele trei semnături. Descarci în Word sau PDF, fără cont.",
```

devine:

```ts
  lead: "Fișa individuală de instruire completă, după anexa 11 la HG 1425/2006: instruirea la angajare, periodică și suplimentară, testările, accidentele, sancțiunile, controlul medical și testarea psihologică. Cu datele lucrătorului completate și câte rânduri îți trebuie pentru anii aleși. Descarci în Word sau PDF, fără cont.",
```

`src/app/llms.txt/route.ts`, al doilea element al perechii `"/unelte/fisa-instruire-ssm"`:

```ts
    "Unealtă gratuită: fișa individuală de instruire SSM după anexa 11 la normele HG 1425/2006 — instruirea introductiv-generală, la locul de muncă, periodică și suplimentară, cu cele trei semnături. Plus regulile: minimum o oră pe fiecare fază, stabilită prin programul firmei (art. 80¹), fișa pe hârtie sau în format electronic (art. 81), periodica la cel mult 6 luni sau 12 pentru TESA (art. 96), suplimentara după 30 de zile lucrătoare de absență (art. 98). Word sau PDF.",
```

devine:

```ts
    "Unealtă gratuită: fișa individuală de instruire SSM completă, după anexa 11 la normele HG 1425/2006 — instruirea introductiv-generală, la locul de muncă și admiterea la lucru, cu rubrici de semnătură etichetate; instruirea periodică (rânduri pentru periodicitatea și anii aleși) și suplimentară; rezultatele testărilor; accidentele de muncă; sancțiunile; casetele de control medical și de testare psihologică. Antet cu numele pe fiecare pagină și „Pagina x din y”. Plus regulile: minimum o oră pe fiecare fază (art. 80¹), cine face fiecare instruire (art. 85, 91, 96), periodica la cel mult 6 luni sau 12 pentru TESA (art. 96), cele șapte cazuri de suplimentară (art. 98), fișa pe hârtie sau electronic, cu semnătură electronică (art. 81, 81¹), păstrată cu copia fișei de aptitudini (art. 81 alin. (4)). Word sau PDF.",
```

`src/app/(marketing)/unelte/page.tsx`: `nota: "după anexa 11 la HG 1425/2006 · Word, PDF",` devine `nota: "toate rubricile anexei 11 la HG 1425/2006 · Word, PDF",`.

`src/content/landing/ro.ts`: `text: "Fișa individuală după anexa 11 la HG 1425/2006, cu datele lucrătorului completate.",` devine `text: "Fișa individuală completă după anexa 11 la HG 1425/2006, cu datele lucrătorului completate.",`.

`src/content/landing/en.ts`: `text: "The individual record per Annex 11 to Government Decision 1425/2006, with the worker's details filled in.",` devine `text: "The complete individual record per Annex 11 to Government Decision 1425/2006, with the worker's details filled in.",`.

`src/content/landing/harta.ts`, blocul `/unelte/fisa-instruire-ssm`: `actualizat` = data de azi (`date +%F`). Commitul atinge `page.tsx`, deci `lastmod.mjs` cere data în ACELAȘI commit.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)" src/content "src/app/api/unelte" src/lib/unelte
```

Pe lângă `pagina.test.tsx` (8 teste), trebuie să rămână verzi:
- `descrieri.test.ts`: descrierea are 152 de caractere și e unică;
- `metadate.test.ts`;
- `descarcari.test.tsx`: `<Descarcari` stă tot în `<form>`;
- `continut.test.ts`: llms și sitemap au aceleași pagini;
- `tipar.test.tsx` (B6): la tipar rămâne doar `#documentul`. Toate benzile din afara documentului poartă `data-tipar="ascunde"`;
- `adresa-analitice.test.ts` (A2), dacă A a fost executată: niciun câmp nou nu e pe lista albă.

- [ ] **Pasul 5: Verificare headless locală (360 px și 1366 px, tipar)**

```bash
pgrep -af "next dev"   # dacă rulează deja unul pe acest director, folosește-i portul
```

Pornește serverul în fundal (`run_in_background`): `cd /srv/apps/ERP && pnpm exec next dev -H 127.0.0.1 -p 3917`. Așteaptă cu Monitor până când `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3917/unelte/fisa-instruire-ssm` întoarce `200`. Scrie `$SCRATCH/sonda-ssm.mjs`:

```js
// Sonda paginii fișei SSM: lățime, termene, secțiuni, captură, tipar din browser.
// Folosire: node sonda-ssm.mjs <baza> <director-iesire>
// Pe staging: ADM_AUTENTIFICARE_BASIC="coleg:<parola>" node sonda-ssm.mjs https://staging.administrativo.ro <dir>
import { createRequire } from "node:module";
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";

const require = createRequire("/srv/apps/ERP/package.json");
const { PDFDocument } = require("pdf-lib");

const baza = process.argv[2] ?? "http://127.0.0.1:3917";
const iesire = process.argv[3] ?? ".";
const [utilizator, parola] = (process.env.ADM_AUTENTIFICARE_BASIC ?? "").split(":");
const cale =
  "/unelte/fisa-instruire-ssm?nume=Popescu%20%C8%98tefan%C8%9Ba&functie=Operator%20%C8%9Bes%C4%83torie" +
  "&data_ig=2026-10-05&data_lm=2026-10-06&periodicitate=semestriala&ani=5";

const browser = await chromium.launch({
  executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
});
for (const latime of [360, 1366]) {
  const context = await browser.newContext({
    viewport: { width: latime, height: 900 },
    ...(utilizator ? { httpCredentials: { username: utilizator, password: parola ?? "" } } : {}),
  });
  const page = await context.newPage();
  const erori = [];
  page.on("pageerror", (e) => erori.push(e.message));
  const raspuns = await page.goto(baza + cale, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    termene: [...document.querySelectorAll("[data-scadente] li")].map((l) => l.textContent),
    rinduri: document.querySelector("[data-rinduri]")?.getAttribute("data-rinduri"),
    sectiuni: [...document.querySelectorAll("#documentul h3")].map((h) => h.textContent),
  }));
  await page.screenshot({ path: `${iesire}/ssm-${latime}.png`, fullPage: true });
  console.log(latime, raspuns?.status(), JSON.stringify(m), "erori:", erori.length);
  if (latime === 1366) {
    await page.emulateMedia({ media: "print" });
    const pdf = await PDFDocument.load(await page.pdf({ format: "A4", preferCSSPageSize: true }));
    const foi = new Set(pdf.getPages().map((p) => (p.getWidth() > p.getHeight() ? "culcat" : "portret")));
    console.log("tipar:", pdf.getPageCount(), "pagini", [...foi].join(","));
  }
  await context.close();
}
await browser.close();
```

```bash
timeout 300 node "$SCRATCH/sonda-ssm.mjs" http://127.0.0.1:3917 "$SCRATCH" | tee "$SCRATCH/ssm-local.txt"
curl -s -o "$SCRATCH/ssm-local.pdf" "http://127.0.0.1:3917/api/unelte/fisa-instruire-ssm?format=pdf&nume=Popescu%20%C8%98tefan%C8%9Ba&functie=Operator%20%C8%9Bes%C4%83torie&data_lm=2026-10-06"
"$SCRATCH/venv-pdf/bin/python" -I -c "import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); print(len(d), 'pagini'); d[1].render(scale=1.2).to_pil().save(sys.argv[2])" "$SCRATCH/ssm-local.pdf" "$SCRATCH/ssm-local-p2.png"
```

Așteptat în `ssm-local.txt`:
- `360 200` cu `"sw":360,"cw":360`, adică fără derulare laterală a paginii;
- `"termene":["06.04.2027","06.10.2027","06.04.2028","06.10.2028","06.04.2029","06.10.2029"]`;
- `"sectiuni"` cu 8 titluri: Instruirea la angajare, Instruirea periodică, Instruirea periodică suplimentară, Rezultatele testărilor, Accidente…, Sancțiuni…, Control medical periodic, Testarea psihologică periodică;
- `1366 200` cu aceleași valori;
- `tipar: N pagini portret`.

Notează N și scrie-l în `e2e/unelte-tipar.spec.ts`: `pagini: [N - 1, N + 1]`, `culcat: false`.

Deschide cu `Read` `$SCRATCH/ssm-360.png`, `$SCRATCH/ssm-1366.png` și `ssm-local-p2.png`. Ce trebuie să se vadă:
- la 360 px, câmpurile unul sub altul, „Instruirea la angajare…” închis (`details`), tabelele previzualizării derulabile în containerul lor, casetele de viză una sub alta;
- la 1366 px, câmpurile pe trei coloane;
- pe pagina 2 a PDF-ului, numele sus.

`erori` poate fi nenul local (memoria `erp-next-dev-nu-hidrateaza`). Comportamentul de client se verifică pe staging, în H8.

Oprește serverul într-un apel Bash SEPARAT: `pkill -f "next dev -H 127.0.0.1 -p 391[7]"`, apoi:

```bash
cd /srv/apps/ERP && rm -f .next/dev/types/validator.ts .next/dev/types/routes.d.ts && pnpm typecheck
```

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=("src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx" "src/app/(marketing)/unelte/fisa-instruire-ssm/pagina.test.tsx" src/content/landing/unelte.ts src/app/llms.txt/route.ts "src/app/(marketing)/unelte/page.tsx" src/content/landing/ro.ts src/content/landing/en.ts src/content/landing/harta.ts e2e/unelte-tipar.spec.ts)
pnpm exec prettier --write "${CAI[@]}" && pnpm exec prettier --check "${CAI[@]}"
git add -- "src/app/(marketing)/unelte/fisa-instruire-ssm/pagina.test.tsx"
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
feat(unelte): fișa SSM — formular complet, termenele periodice, cine instruiește

Formularul precompletează marca, calificarea, datele, orele și instructorii
celor două faze de la angajare și pe cine admite la lucru; alegi
periodicitatea și anii, iar fișa are exact atâtea rânduri. Termenele
instruirii periodice apar pe pagină (nu în document), cu legătura spre
modulul SSM. Normele spun cine face fiecare instruire (art. 85, 91, 94,
96, 99), cele șapte cazuri de suplimentară (art. 98) și când se folosește
anexa 12. Fără câmpuri pentru CNP, grupa sanguină sau domiciliu.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
git push origin main
node scripts/checks/lastmod.mjs
```

---

### Task H8: Deploy și verificarea live

**Fișiere:** niciunul (deploy și verificări).

**Interfețe:**
- Consumă: `ADM_MEDIU=staging ./administrativo.sh stack:deploy`, `./administrativo.sh prod`, `./administrativo.sh stack:status`, `$SCRATCH/sonda-ssm.mjs` (H7), `$SCRATCH/venv-pdf` (H2), `~/.secrete/administrativo/parola-staging.txt`.
- Produce: fișa nouă pe producție, verificată.

- [ ] **Pasul 1: Staging întâi** (memoria `erp-staging-cade-tacut`)

```bash
cd /srv/apps/ERP && gh run list --workflow=staging.yml --limit 3
ADM_MEDIU=staging ./administrativo.sh stack:deploy
P="coleg:$(cat ~/.secrete/administrativo/parola-staging.txt)"
for f in pdf docx xlsx; do
  curl -s -u "$P" -o "$SCRATCH/st.$f" -w "$f %{http_code} %{content_type}\n" "https://staging.administrativo.ro/api/unelte/fisa-instruire-ssm?format=$f&nume=Popescu%20%C8%98tefan%C8%9Ba&firma=Exemplu%20SRL&functie=Sudor"
done
"$SCRATCH/venv-pdf/bin/python" -I -c "import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); print(len(d),'pagini')" "$SCRATCH/st.pdf"
```

Așteptat:
- `pdf 200 application/pdf`, cu 4 pagini;
- `docx 200 …wordprocessingml.document`;
- `xlsx 400 text/plain…`.

Sonda de pagină pe staging, unde hidratarea se termină (sonda citește autentificarea din variabila de mediu):

```bash
ADM_AUTENTIFICARE_BASIC="$P" timeout 300 node "$SCRATCH/sonda-ssm.mjs" https://staging.administrativo.ro "$SCRATCH" | tee "$SCRATCH/ssm-staging.txt"
```

Așteptat: aceleași valori ca local (H7, pasul 5), plus `erori: 0`. Apoi rulează `e2e/unelte-tipar.spec.ts` pe staging, după configul lui B6. Intrarea SSM trebuie să fie verde, cu portret și N±1 pagini.

- [ ] **Pasul 2: OPREȘTE-TE și cere confirmarea utilizatorului pentru producție** („Fac deploy pe producție cu fișa SSM completă după anexa 11?”). Un „da” anterior nu acoperă acest deploy. Doar după „da”:

```bash
cd /srv/apps/ERP && ./administrativo.sh prod && ./administrativo.sh stack:status
```

- [ ] **Pasul 3: Verificarea pe producție** (de 3 ori la rând: sunt 2 replici)

```bash
for i in 1 2 3; do
  curl -s -o "$SCRATCH/prod.pdf" -w "pdf %{http_code} %{size_download}\n" "https://administrativo.ro/api/unelte/fisa-instruire-ssm?format=pdf"
  curl -s -o /dev/null -w "xlsx %{http_code}\n" "https://administrativo.ro/api/unelte/fisa-instruire-ssm?format=xlsx"
done
"$SCRATCH/venv-pdf/bin/python" -I -c "import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); print(len(d),'pagini'); [d[i].render(scale=1.2).to_pil().save(f'{sys.argv[2]}-{i+1}.png') for i in range(len(d))]" "$SCRATCH/prod.pdf" "$SCRATCH/prod"
timeout 300 node "$SCRATCH/sonda-ssm.mjs" https://administrativo.ro "$SCRATCH" | tee "$SCRATCH/ssm-prod.txt"
```

Așteptat:
- de trei ori `pdf 200` (~32 KB) și `xlsx 400`;
- `4 pagini`;
- în `ssm-prod.txt`, `360 200` cu `sw == cw == 360`, cele 6 termene, 8 secțiuni și `erori: 0` (pe producție hidratarea se termină).

Deschide `prod-1.png` și `prod-4.png` cu `Read`: rubricile anexei și „Pagina 4 din 4”.

---

**Review Focus**

Testele „de adăugat” de mai jos NU fac parte din criteriile de acceptare ale taskurilor H1–H8: nu au cod scris în plan și nu blochează commitul. Sunt riscurile pe care testele din plan nu le prind. Cine revizuiește le transformă în teste cu cod, în taskul numit, sau le trece în `PROGRESS.md`.

1. **Word deschis în Word real.** Testele din H3 verifică XML-ul (`trHeight`, `cantSplit`, antet, subsol), nu așezarea. Mașina n-are LibreOffice. Riscul concret: antetul unui tabel de secțiune care NU se repetă pe pagina următoare când tabelul periodic de 120 de rânduri trece de pagină. **Test de adăugat în H3**, în „Word cu secțiuni”: numără `<w:tblHeader/>` în `word/document.xml` și cere cel puțin 2, câte unul pentru fiecare dintre cele două tabele din `CU_SECTIUNI` (`blocuriSectiune` pune `tableHeader: true` pe rândul de antet).
2. **Nume și firmă la plafon în antetul rulant.** Cu `nume` și `firma` de câte 120 de caractere, antetul rulant are ~280 de caractere. În PDF, `taie` îl scurtează cu „…” la lățimea utilă, iar în Word se rupe pe două rânduri și împinge corpul paginii. **Test de adăugat în H2**: un document cu `antetRulant` de 300 de caractere. Textul raportat de sondă pe pagina 2 ca antet se termină cu „…” și are cel mult 160 de caractere (la 7 pt, 515 pt utili încap ~140).
3. **Datele de la angajare inversate.** Dacă omul trece `data_lm` înaintea lui `data_ig`, instruirea la locul de muncă apare înaintea celei introductiv-generale, ceea ce contrazice art. 90 alin. (1). Termenele se socotesc oricum de la `data_lm`. Nicio regulă din H nu semnalează asta. **Test de adăugat în H7**, cu un aviz `role="status"` (componenta `AvizCorectari` din B4) pe pagină: pentru `data_ig=2026-10-06&data_lm=2026-10-05`, pagina conține „Instruirea la locul de muncă se face după cea introductiv-generală (art. 90 alin. (1)).”, iar fișa rămâne descărcabilă.
4. **Periodicitatea „anuală” la un post care nu e tehnico-administrativ.** Eticheta opțiunii spune limita, dar fișa iese cu un rând pe an, adică un interval pe care art. 96 alin. (2¹) îl interzice pentru restul personalului. **Test de adăugat în H7**: la `periodicitate=anuala`, sub câmpurile de periodicitate apare textul „Intervalul de 12 luni e permis doar personalului tehnico-administrativ (art. 96 alin. (3)); pentru ceilalți, cel mult 6 luni (art. 96 alin. (2¹)).”. La `semestriala`, textul lipsește.
5. **Tipărirea din browser a previzualizării.** `e2e/unelte-tipar.spec.ts` numără doar paginile. O casetă de viză sau o rubrică de semnătură tăiată între două foi nu se vede în test, ci doar pe hârtie. **Test de adăugat în H4**: fiecare casetă din `SectiuneHtml` (tipurile `casete` și `text` cu semnături) poartă clasa `break-inside-avoid`, iar testul de previzualizare verifică clasa pe toate cele 3 casete și pe cele 2 rubrici din `DOC`.
