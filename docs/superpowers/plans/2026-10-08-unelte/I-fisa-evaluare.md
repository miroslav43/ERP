## I. Fișa de evaluare: calculează nota și ține de Codul muncii

**Scop:** fișa de evaluare de pe `/unelte/fisa-evaluare` devine cea mai bună fișă gratuită din România pentru o firmă privată. Calculează punctajul pe fiecare criteriu, nota finală și calificativul, pe pagină și în Excel, cu formule. Are seturi de criterii pe tipuri de post, rubricile pe care le are orice model serios și semnături cu dată. PDF-ul nu mai taie nimic. Pagina spune exact ce cere Codul muncii, inclusiv procedura de concediere pentru necorespundere profesională.

**De ce:** auditul live din 8 oct 2026 (`audit-unelte.json`, intrarea „Fișa de evaluare”, cu verificare adversarială) i-a dat utilitate **2/5**: „puțin peste un tabel Word de 4 coloane făcut în 3 minute”.

- **Excelul nu calculează nimic.** `sheet1.xml` are **0** elemente `<f>`, iar „100” de la Total e salvat ca text (`t="s"`). Pagina promite „pondere și notă pe fiecare” (`page.tsx:30`), dar nici ponderile, nici notele nu se pot introduce. Parametrii `pondere`/`nota` trimiși pe API dau un fișier cu md5 identic.
- **PDF-ul taie tăcut criteriile (MAJOR, confirmat).** Criteriul de 89 de caractere iese „…respectarea termenelor de livr…”. La 15 criterii de 120 de caractere, toate sunt tăiate la ~63. Cauza e `pdf.ts:151`, unde `taie(linie, w - 4, …)` se aplică pe fiecare celulă, deși `model.ts:37` acceptă 120. Word-ul și previzualizarea arată criteriul întreg, deci angajatul semnează „am luat la cunoștință” sub un text pe care nu-l poate citi.
- **Fișa e mai săracă decât orice model gratuit serios.** Are rânduri de 16 pt (5,6 mm) și nicio scală explicată. Nu are dată, rând de notă finală sau calificativ, nici rubrică pentru comentariile angajatului, obiective sau contrasemnare. Jumătatea de jos a paginii rămâne goală (55–60%, măsurat). Previzualizarea nu arată semnăturile.
- **Excelul ascunde criteriile lungi.** Rândurile de date n-au `wrapText`, iar celulele goale sunt șirul `""`.
- **Legea: tot ce citează e corect, dar lipsesc prevederile care contează.** Art. 17 alin. (4)–(5): criteriile intră în contract, iar schimbarea lor cere act adițional. Art. 242 lit. i): procedura stă în regulamentul intern. Art. 63 alin. (2): evaluarea prealabilă e condiția concedierii pentru necorespundere profesională, adică motivul real pentru care o firmă mică ține fișe.
- **Comercial.** **0 impresii** în Google pe 90 de zile și **0 descărcări umane** în 35 de zile. Pe toate cele 7 unelte, singurul vizitator venit din Google care a folosit o unealtă și-a făcut cont în 3 minute.
- **Concurență.** ULBS (PDF public, sector bugetar) are scala 1–5 definită, contrasemnare și dată la fiecare semnătură, dar nu e editabil și nu calculează. Rubinian vinde calculatorul Excel cu procedura pentru 129 lei. undelucram.ro are articol, nu fișier, și afirmă o „obligație de evaluare anuală” care nu există în Codul muncii. Niciunul nu dă gratuit o fișă care calculează în Excel.

Defectele transversale sunt deja acoperite de B: Word corupt la caractere de control (B2), `format=DOCX` (B8), tiparul paginii (B5/B6). Le folosim, nu le refacem. Limita URL de ~12,5 KB (Cloudflare 520) nu se repară aici, dar fișa rămâne sub ea prin construcție: avem o poartă pentru asta în I9.

**Ordinea și precondițiile.** Secțiunea I rulează DUPĂ A, B și E. Consumă, cu numele lor:

- din B: `curataText`, `curataDocument`, `normalizeazaFormat` fără majuscule (`@/lib/unelte/document-tabelar`, B2/B8), `Banda` cu `data-tipar` (B5), banda formularului ascunsă la tipar și `data-tipar-pagina` (B6);
- din E: `inaltimeRand?: number` pe `DocumentTabelar` și `deseneaza(...)` cu `rand(celule, aldin, inaltMinim)` în `pdf.ts` (E4); `sectiune(d)` în `docx.ts` și `raspunsBinar(continut, format, numeFisier)` în `raspuns.ts` (E5); ruta statică a condicii (E12).

Fiecare task care atinge un fișier comun (`document-tabelar.ts`, `pdf.ts`, `docx.ts`, `xlsx.ts`, `previzualizare-document.tsx`, `registru.ts`) începe cu un **Pasul 0**: blocul „vechi” din plan e cel lăsat de A/B/E, verificat azi prin aplicarea lor pe o copie. Secțiunile G (foaia de parcurs) și H (fișa SSM) pot atinge aceleași fișiere. Dacă un bloc vechi nu se mai găsește byte cu byte, păstrezi schimbarea lor și pui blocul nou în același loc logic, descris în pas. Nu suprascrii niciodată un fișier comun întreg.

**Verificat în pregătire (8 oct 2026).** Am aplicat B2/B5/B6/B8 și E4/E5/E12 pe o copie a repo-ului din scratchpad și am implementat acolo tot codul din această secțiune. Pe copie trec `tsc --noEmit` (exit 0), `eslint` pe toate fișierele atinse (exit 0), `prettier --check` și 77 de teste noi. Fiecare test nou l-am văzut și picând pe starea de dinainte. Perechile „vechi → nou” ale fișierelor comune reproduc, aplicate pe starea de după A/B/E, fișierele finale byte cu byte. Am randat PDF-ul (pymupdf, 80 dpi) și am citit capturile. Criteriul de 120 de caractere iese pe 3 rânduri, întreg. Fișa goală are 2 pagini, iar rubricile goale nu se rup între pagini. Pe pagina 2 se repetă antetul și apare „Pagina 2 din 2”. Word-ul și Excelul sunt XML valid (`minidom`).

**Reverificat adversarial (8 oct 2026, seara).** Ce s-a confirmat și ce s-a corectat:
- **Blocurile de cod.** Fiecare bloc „vechi” din I3–I5 și I9 apare exact o dată pe starea de după E. Pe cele din B și E le-am găsit și în textul curent al planurilor B și E. Aplicate în ordine, perechile dau byte cu byte fișierele finale.
- **Fișierele create.** Toate cele 17 sunt identice cu copia verificată.
- **Lanțul pe copie.** `tsc --noEmit` dă exit 0, iar o sondă de control cu o eroare de tip pusă intenționat a fost raportată, deci typecheck-ul nu tăcea. Mai trec `eslint` (exit 0), `prettier --check` și `client-imports-server-only.mjs` pe fișierele secțiunii, plus **80** de teste noi: cele 77 inițiale și 3 adăugate la verificare, în I7 și I8.
- **Ce lipsea din copia redactorului.** Copia nu avea A5 (`raspuns.ts` încă scria `public, max-age=3600`) și nici testele `tipar.test.tsx` (B6), `avize.test.tsx` (B4) și `adresa-analitice.test.ts` (A2). Am aplicat marcajele B5 pe `antet.tsx`/`subsol.tsx` și am rulat verificarea lui B6 pe pagina nouă, goală și cu `incarca=set`: trece. Paza lui A2 am verificat-o pe cod: grila nu are niciun nume păstrat (`utm_*`, `m`) și nu atinge `history`, `useRouter` sau `next/form`.
- **Defecte găsite și închise:** testul de cache al lui A5, mutat de E12 pe `fisa-evaluare`, ar fi picat cu 404 după I7, iar acum I7 îl mută pe fișa SSM; „Încarcă setul” înlocuia criteriile scrise fără întrebare; pragurile greșite nu se vedeau lângă praguri; mesajul de ajutor al notei avea `\n` într-un atribut XML; `grep -c "<f>"` din I10 număra rânduri, nu formule; afirmația despre semnăturile cererii era veche, fiindcă F o mută pe `Scrisoare`.

**Decizii luate**

1. **Calculul se face în sutimi întregi, fără virgulă mobilă.** Ponderea e un procent întreg de la 1 la 100, nota un întreg de la 1 la 5. Punctajul `pondere × notă` e deci un număr întreg de sutimi (20 × 4 = 80 = 0,80), iar nota finală e exactă la două zecimale, fără rotunjire. Am respins notele cu zecimale: scala are descriptori pe trepte întregi („4 — peste cerințele postului”), deci o notă de 3,456 n-ar avea înțeles.
2. **Nota finală apare doar când fiecare criteriu are pondere și notă, iar ponderile fac exact 100.** Nu reponderăm la suma reală (varianta din audit, `SUMPRODUCT/SUM`). O fișă cu ponderi de 90% e o greșeală de corectat, nu de ascuns, iar pagina, PDF-ul și Excelul spun același lucru: totalul arată 90, nota finală rămâne de completat, avizul spune de ce. O pondere lipsă lasă totalul gol, ca o sumă parțială să nu treacă drept total.
3. **Patru calificative, cu praguri modificabile.** Foarte bine ≥ 4,50, Bine ≥ 3,50, Satisfăcător ≥ 2,50, altfel Nesatisfăcător. Pragurile vin din `prag_fb`, `prag_b`, `prag_s`. Unul lipsă ia implicitul lui. Praguri care nu scad strict (sau ≤ 1,00) duc la toate implicitele, cu aviz. Pagina și fișierul spun că pragurile nu sunt din lege, ci le stabilește regulamentul intern.
4. **Patru seturi de criterii, a câte șase, cu ponderi care fac 100:** general, vânzări, producție, administrativ. Sunt „puncte de plecare”, formulate față de fișa postului, nu „criterii legale”. Un test păzește suma de 100, limita de 120 de caractere, lipsa dublurilor și lipsa sedilelor.
5. **Adresa rămâne GET** (decizia A1). Rândurile pleacă ca `criteriu`, `pondere`, `nota` repetate, în ordinea rândurilor. Un câmp text gol tot se trimite, deci pozițiile rămân aliniate. `criterii` (un criteriu pe rând, fără ponderi) se citește în continuare, pentru linkurile vechi. `incarca=set` cere setul ales, peste rândurile scrise, și merge fără JavaScript. Pagina păstrează TOATE valorile repetate, inclusiv cele goale: `unul()`, care lua prima valoare, ar fi stricat alinierea.
6. **Grila e o componentă client în formularul GET.** Calculează pe loc (total, aviz, notă finală, calificativ), adaugă și șterge rânduri (cel mult 15), împarte ponderile egal (17, 17, 17, 17, 16, 16) și schimbă setul cu confirmare, dacă era ceva scris. Confirmarea apare atât la schimbarea din listă, cât și la „Încarcă setul”: butonul rămâne de trimitere, ca să meargă fără JavaScript, dar cu JavaScript oprește trimiterea la refuz. Pragurile greșite se spun și în titlul `<details>`, nu doar sub grilă. Nu rescrie adresa (paza din A2) și nu trimite nimic singură. Funcția de actualizare a „împărțirii egale” e sigură sub StrictMode (contorul stă în ea). Fără JavaScript, serverul randează aceleași rânduri.
7. **Rubricile sunt un câmp nou, opțional, în modelul comun: `rubrici?: readonly Rubrica[]`.** Fiecare rubrică are titlu, text și rânduri goale. Le randează PDF-ul, Word-ul, Excelul comun și previzualizarea, iar `curataDocument` le curăță. Fișa are cinci: „Puncte forte”, „De îmbunătățit”, „Obiective pentru perioada următoare” și „Plan de dezvoltare (formare, îndrumare)”, toate de cel mult 500 de caractere și completabile din pagină, plus „Comentariile angajatului”, mereu goală, pentru că o completează el. Am preferat un câmp mic și numit în locul secțiunilor generice pe care le pregătește H, nefinalizate azi: altfel planul ar fi depins de un tip pe care nu l-am putut citi.
8. **Nota finală și calificativul stau ca rânduri în tabel**, nu într-un câmp nou: „Total (nota finală)”, cu suma ponderilor și nota în coloana Punctaj, și „Calificativ”, în coloana largă Observații. Ies la fel în toate formatele fără nicio atingere în plus a randărilor comune, iar pe fișa goală sunt celule de completat.
9. **PDF-ul are coloane care se rup, la cerere: `Coloana.rupe?: boolean`.** Criteriul și Observațiile se rup pe rânduri prin `imparteCelula`, care rupe și cuvintele prea lungi pe puncte de cod, deci nu se pierde nicio literă și nu rămân surogate orfane. Paginarea folosește înălțimea reală a rândului, nu doar minimul. Rândul înalt e `inaltimeRand` din E4 (26 pt ≈ 9 mm), nu un câmp al nostru. Celelalte unelte nu se schimbă: fără `rupe`, celula se taie ca înainte, iar un test păzește asta.
10. **Trei semnături, cu dată: „Evaluator”, „Contrasemnat (opțional)”, „Angajat — am luat la cunoștință”.** Câmpul `dataLaSemnaturi?: boolean` pune „Data: ____” sub fiecare. În Word, semnăturile cu dată stau într-un tabel fără chenar, ca data să cadă sub semnătura ei. Previzualizarea arată de acum semnăturile la ORICE unealtă care folosește `PrevizualizareDocument`, reparând constatarea cosmetică din audit. Efect: semnăturile apar pe ecran și la tipar la condică, la foaia de parcurs și la fișa SSM. Cererea de concediu NU e atinsă: după F11/F13 are modelul `Scrisoare`, cu `ScrisoarePrevizualizata` și semnăturile ei (`F-cerere-concediu.md`, decizia 1). Corectat la verificare: prima versiune spunea că „variantele cererii își văd semnăturile”, ceea ce era adevărat doar înaintea lui F.
11. **Excelul fișei e un generator propriu, cu formule** (`fisa-evaluare/excel.ts`), ca la foaia de pontaj și la condică:
    - punctajul: `IF(AND(ISNUMBER(B),ISNUMBER(C)),B*C/100,"")`;
    - totalul: `SUM`;
    - nota finală: `IF(AND(total=100,COUNT(B)=COUNTA(A),COUNT(C)=COUNTA(A)),SUMPRODUCT(B,C)/100,"")`. Am ales `COUNTA` pe criterii în locul unui număr fix: un rând inserat în tabel intră singur în calcul;
    - controlul: un text roșu când ponderile nu fac 100, plus formatare condiționată pe total;
    - calificativul: citește pragurile din celulele foii, deci le schimbi acolo;
    - validări pe interval: întreg 1–100 pe pondere, listă `"1,2,3,4,5"` pe notă, cu scala ca mesaj de ajutor, pe un singur rând, despărțită prin „; ” (un rând nou scris direct într-un atribut XML devine spațiu la citire).

    Fiecare formulă poartă și rezultatul, calculat cu aceleași funcții ca PDF-ul, ca previzualizările care nu recalculează (telefon, e-mail) să arate cifra corectă. Am mai pus `fullCalcOnLoad`. Validările se pun pe INTERVAL prin `dataValidations.add`: exceljs 4.4.0 sortează adresele ca text („B10” < „B9”) și, de la zece rânduri, scrie intervale suprapuse (văzut: `B10:B14` și `B9:B14`).
12. **Rută statică `/api/unelte/fisa-evaluare`**, ca foaia de pontaj (E), condica (E12) și cererea (F12). Fișa iese din `UNELTE`. PDF-ul și Word-ul trec prin `raspunsDocument`. Excelul trece prin `curataDocument`, apoi prin `raspunsBinar` (E5), deci primește aceleași antete și aceeași curățare.
13. **Conținutul juridic stă în `lege.ts`, în două benzi:**
    - „Ce spune Codul muncii despre evaluare”: 7 reguli, fiecare cu temeiul ei;
    - „Concedierea pentru necorespundere profesională”: 7 pași în ordine.

    Toate sunt verificate pe forma consolidată la 27.04.2026 (`DetaliiDocument/309240`, descărcată cu curl). Nu scriem nicăieri „obligație de evaluare anuală”. Pașii se marchează în `NOTES.md` cu ⚠ „de confirmat de jurist”. Pagina trimite la `/module/evaluari` și la `/inregistrare` (`RO.hero.ctaPrimar`). Nu e o pagină nouă, deci `harta.ts` nu primește intrare nouă: se ridică doar `actualizat` pe `/unelte/fisa-evaluare` și pe `/unelte`, unde se schimbă nota din hub.
14. **SEO:**
    - titlul: „Fișă de evaluare angajați, cu nota calculată” (44 de caractere), în forma în care se caută;
    - descrierea: 150 de caractere;
    - lead-ul, nota din hub și rândul din `llms.txt` spun ce face unealta, cu articolele.

    Paza titlului și a descrierii stă în testul paginii.
15. **Fără bază, fără sesiune, fără migrare.** Limitele: 15 criterii × 120 de caractere și 4 rubrici × 500. Un test calculează formularul plin la toate limitele (o literă din zece cu diacritică) și cere sub 12 000 de octeți în adresă.
16. **Verificarea are trei niveluri:**
    - testele unitare și de componentă;
    - sonda headless locală (HTML/CSS, 360 și 1366 px, tipar) cu `next dev`;
    - specificația e2e pe staging, pentru comportamentul de după hidratare și pentru descărcarea Excelului din pagină.

    Deploy-ul pe producție se face doar cu confirmarea utilizatorului.

**Verificări legale** (Codul muncii, Legea 53/2003, forma consolidată la **27.04.2026**, `https://legislatie.just.ro/Public/DetaliiDocument/309240`, marcată `fa_selectata` în „istoric consolidări”, descărcată cu `curl` pe 8 oct 2026 și citită cu `grep`):

- art. 17 alin. (1) informarea înainte de încheierea sau modificarea contractului; alin. (3) lit. e) „criteriile de evaluare a activității profesionale a salariatului aplicabile la nivelul angajatorului”; alin. (4) elementele se regăsesc în CIM (cu excepția lit. m), o), p)); alin. (5) modificarea cere act adițional „anterior producerii modificării”, cu excepțiile din lege sau din CCM;
- art. 40 alin. (1) lit. f) obiectivele de performanță individuală și criteriile de evaluare;
- art. 61 lit. d) necorespunderea profesională; art. 62 alin. (1) 30 de zile calendaristice, alin. (3) decizie scrisă, motivată, cu termen și instanță, sub sancțiunea nulității absolute; art. 63 alin. (2) „numai după evaluarea prealabilă … conform procedurii … din contractul colectiv … sau, în lipsa acestuia, prin regulamentul intern”;
- art. 64 alin. (1)–(4) locuri vacante, agenția teritorială, 3 zile lucrătoare;
- art. 69 alin. (3) criteriile de prioritate „după evaluarea realizării obiectivelor de performanță”;
- art. 75 alin. (1) preaviz de minimum 20 de zile lucrătoare, alin. (2) excepția perioadei de probă; art. 76 conținutul deciziei; art. 78 nulitatea absolută;
- art. 194 alin. (1) formare la 2 ani (≥ 21 de salariați) sau la 3 ani (sub 21);
- art. 242 lit. i) criteriile și procedurile de evaluare, în regulamentul intern;
- art. 268 alin. (1) lit. a) 45 de zile calendaristice pentru contestare.

**Harta fișierelor**

| Fișier | Responsabilitate | Task |
| --- | --- | --- |
| `src/app/(marketing)/unelte/fisa-evaluare/calcul.ts` (Create) | scala, citirea ponderii/notei/pragurilor, ponderi egale, nota finală, calificativ, avize; pur | I1 |
| `src/app/(marketing)/unelte/fisa-evaluare/calcul.test.ts` (Create) | calculul în sutimi, pragurile, avizele | I1 |
| `src/app/(marketing)/unelte/fisa-evaluare/seturi.ts` (+ `.test.ts`) (Create) | cele patru seturi de criterii pe post | I2 |
| `src/lib/unelte/document-tabelar.ts` (Modify) | `Coloana.rupe`, `Rubrica`, `rubrici`, `dataLaSemnaturi`, curățarea rubricilor | I3 |
| `src/lib/unelte/pdf.ts` (Modify) | `imparteCelula`, rânduri care se rup, paginarea pe înălțimea reală, rubrici, data la semnături | I3 |
| `src/lib/unelte/randari-fisa.test.ts` (Create în I3, extins în I4) | PDF, Word, Excel comun, curățare | I3, I4 |
| `src/lib/unelte/docx.ts` (Modify) | rubrici, semnături în coloane cu dată | I4 |
| `src/lib/unelte/xlsx.ts` (Modify) | rubrici și data în Excelul comun | I4 |
| `src/app/(marketing)/_componente/previzualizare-document.tsx` (Modify) | semnăturile (toate uneltele), rubricile, rândurile înalte | I5 |
| `src/app/(marketing)/_componente/previzualizare-fisa.test.tsx` (Create) | previzualizarea | I5 |
| `src/app/(marketing)/unelte/fisa-evaluare/model.ts` (Modify, rescris) | adresa → `ParametriFisaEvaluare` → `DocumentTabelar` | I6 |
| `src/app/(marketing)/unelte/fisa-evaluare/model.test.ts` (Modify, rescris) | parametrii și documentul | I6 |
| `src/app/(marketing)/unelte/fisa-evaluare/excel.ts` (+ `.test.ts`) (Create) | Excelul cu formule | I7 |
| `src/app/api/unelte/fisa-evaluare/route.ts` (+ `route.test.ts`) (Create) | ruta statică | I7 |
| `src/lib/unelte/registru.ts` (Modify) | fișa iese din `UNELTE` | I7 |
| `src/app/api/unelte/[unealta]/route.test.ts` (Modify) | testul lui B8 trece pe altă unealtă | I7 |
| `src/app/(marketing)/unelte/fisa-evaluare/grila-evaluare.tsx` (+ `.test.tsx`) (Create) | grila din browser | I8 |
| `src/app/(marketing)/unelte/fisa-evaluare/lege.ts` (Create) | regulile și pașii, cu temei | I9 |
| `src/app/(marketing)/unelte/fisa-evaluare/page.tsx` (Modify, rescris) | pagina | I9 |
| `src/app/(marketing)/unelte/fisa-evaluare/pagina.test.tsx` (Create) | pagina randată, limitele, metadatele | I9 |
| `src/content/landing/unelte.ts`, `src/app/(marketing)/unelte/page.tsx`, `src/app/llms.txt/route.ts`, `src/content/landing/harta.ts`, `NOTES.md` (Modify) | lead, hub, llms, `actualizat`, ⚠ jurist | I9 |
| `e2e/fisa-evaluare.spec.ts` (Create) | grila și Excelul descărcat, pe staging | I10 |

Ordinea: I1 → I2 → I3 → I4 → I5 → I6 → I7 → I8 → I9 → I10. I1, I2 și I3 sunt independente între ele. I6 cere I1, I2 și I3. I7 cere I6. I8 cere I1, I2 și I6. I9 cere toate. I10 cere I9 publicat pe staging.

**Convenții pentru toți pașii.** `REPO=/srv/apps/ERP`. `SCRATCH` e directorul scratchpad al sesiunii care execută. Căile cu paranteze stau mereu între ghilimele. Lanțul complet al fiecărui task:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

Pe fișierele atinse se rulează `pnpm exec prettier --write`, apoi `pnpm exec prettier --check`. După commit se rulează `node scripts/checks/lastmod.mjs`, fără `| tail`: codul de ieșire contează (memoria „pipe-ul înghite codul”). Fără `pnpm build`. Commit-ul fiecărui task urmează tiparul de mai jos. `CAI` sunt căile taskului, iar `NOI` cele create.

```bash
cd /srv/apps/ERP
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"   # dacă listează ceva: citește diff-ul înainte de commit
git add -- "${NOI[@]}"
git commit --only -F "$SCRATCH/mesaj.txt" -- "${CAI[@]}"
git merge origin/main
node scripts/checks/lastmod.mjs
git push origin main
```

---

### Task I1: Calculul fișei — punctaj, notă finală și calificativ, în sutimi

**Fișiere:**
- Create: `src/app/(marketing)/unelte/fisa-evaluare/calcul.ts`
- Test: `src/app/(marketing)/unelte/fisa-evaluare/calcul.test.ts` (Create)

**Interfețe:**
- Consumă: nimic (fișier pur, fără importuri; îl folosesc și serverul, și componenta client).
- Produce:
  ```ts
  export const NOTA_MINIMA = 1; export const NOTA_MAXIMA = 5;
  export const MAX_CRITERII = 15; export const MAX_CRITERIU = 120;
  export const SCALA_NOTE: readonly Readonly<{ nota: number; descriere: string }>[];
  export type Calificativ = "Foarte bine" | "Bine" | "Satisfăcător" | "Nesatisfăcător";
  export type Praguri = Readonly<{ foarteBine: number; bine: number; satisfacator: number }>; // sutimi
  export const PRAGURI_IMPLICITE: Praguri; // 450 / 350 / 250
  export type RandNotat = Readonly<{ pondere: number | null; nota: number | null }>;
  export type RezultatGrila = Readonly<{ sumaPonderi: number; faraPondere: number; faraNota: number;
    punctaje: readonly (number | null)[]; notaFinala: number | null; calificativ: Calificativ | null }>;
  export function citestePondere(brut: string): number | null;
  export function citesteNota(brut: string): number | null;
  export function citesteSutimi(brut: string): number | null;
  export function citestePraguri(foarteBine: string | null, bine: string | null, satisfacator: string | null): Readonly<{ praguri: Praguri; corectate: boolean }>;
  export function ponderiEgale(n: number): number[];
  export function calificativPentru(notaSutimi: number, praguri: Praguri): Calificativ;
  export function formateazaSutimi(sutimi: number): string; // 385 → "3,85"
  export function calculeazaGrila(randuri: readonly RandNotat[], praguri: Praguri): RezultatGrila;
  export function avizePonderi(r: RezultatGrila): string[];
  ```

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(marketing)/unelte/fisa-evaluare/calcul.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  avizePonderi,
  calculeazaGrila,
  calificativPentru,
  citesteNota,
  citestePondere,
  citestePraguri,
  citesteSutimi,
  formateazaSutimi,
  PRAGURI_IMPLICITE,
  ponderiEgale,
  SCALA_NOTE,
} from "./calcul";

/**
 * Auditul din 8 oct 2026: pagina promitea „pondere și notă pe fiecare”, dar
 * nimic nu se putea introduce și nimic nu se calcula, nici măcar în Excel.
 * Calculul stă aici, pur, ca să-l folosească la fel documentul și grila.
 */
describe("citirea ponderilor și a notelor", () => {
  it("ponderea: întreg de la 1 la 100, cu sau fără %", () => {
    expect(citestePondere("20")).toBe(20);
    expect(citestePondere(" 20 % ")).toBe(20);
    expect(citestePondere("100")).toBe(100);
    for (const gresit of ["", "0", "101", "150", "12,5", "2e1", "-5", "abc", "1000"]) {
      expect(citestePondere(gresit), gresit).toBeNull();
    }
  });

  it("nota: întreg de la 1 la 5", () => {
    expect(citesteNota("4")).toBe(4);
    expect(citesteNota(" 1 ")).toBe(1);
    for (const gresit of ["", "0", "6", "7", "3.5", "3,456", "x"]) {
      expect(citesteNota(gresit), gresit).toBeNull();
    }
  });

  it("sutimile: virgulă sau punct, între 1,00 și 5,00", () => {
    expect(citesteSutimi("4,5")).toBe(450);
    expect(citesteSutimi("4.50")).toBe(450);
    expect(citesteSutimi("3")).toBe(300);
    expect(citesteSutimi("2,05")).toBe(205);
    for (const gresit of ["0,99", "5,01", "6", "4,555", "", "patru"]) {
      expect(citesteSutimi(gresit), gresit).toBeNull();
    }
  });
});

describe("pragurile calificativelor", () => {
  it("fără câmpuri, implicitele, fără aviz", () => {
    expect(citestePraguri(null, null, "")).toEqual({
      praguri: PRAGURI_IMPLICITE,
      corectate: false,
    });
  });

  it("un prag schimbat păstrează implicitele celorlalte", () => {
    expect(citestePraguri("4,75", null, null)).toEqual({
      praguri: { foarteBine: 475, bine: 350, satisfacator: 250 },
      corectate: false,
    });
  });

  it("praguri care nu descresc cad pe implicite, cu aviz", () => {
    expect(citestePraguri("3", "4", "2")).toEqual({ praguri: PRAGURI_IMPLICITE, corectate: true });
    expect(citestePraguri("4,5", "3,5", "1")).toEqual({
      praguri: PRAGURI_IMPLICITE,
      corectate: true,
    });
    expect(citestePraguri("nouă", null, null).corectate).toBe(true);
  });

  it("calificativul se ia de la prag în sus, inclusiv pragul", () => {
    expect(calificativPentru(450, PRAGURI_IMPLICITE)).toBe("Foarte bine");
    expect(calificativPentru(449, PRAGURI_IMPLICITE)).toBe("Bine");
    expect(calificativPentru(350, PRAGURI_IMPLICITE)).toBe("Bine");
    expect(calificativPentru(250, PRAGURI_IMPLICITE)).toBe("Satisfăcător");
    expect(calificativPentru(249, PRAGURI_IMPLICITE)).toBe("Nesatisfăcător");
    expect(calificativPentru(100, PRAGURI_IMPLICITE)).toBe("Nesatisfăcător");
  });
});

describe("ponderile egale", () => {
  it("fac mereu 100, cu diferență de cel mult 1", () => {
    for (let n = 1; n <= 15; n += 1) {
      const p = ponderiEgale(n);
      expect(p, String(n)).toHaveLength(n);
      expect(
        p.reduce((s, x) => s + x, 0),
        String(n),
      ).toBe(100);
      expect(Math.max(...p) - Math.min(...p), String(n)).toBeLessThanOrEqual(1);
    }
    expect(ponderiEgale(6)).toEqual([17, 17, 17, 17, 16, 16]);
    expect(ponderiEgale(0)).toEqual([]);
  });
});

describe("grila", () => {
  const NOTATA = [
    { pondere: 20, nota: 4 },
    { pondere: 20, nota: 5 },
    { pondere: 15, nota: 3 },
    { pondere: 15, nota: 4 },
    { pondere: 15, nota: 3 },
    { pondere: 15, nota: 4 },
  ];

  it("nota finală e suma punctajelor, exactă la sutime", () => {
    const r = calculeazaGrila(NOTATA, PRAGURI_IMPLICITE);
    expect(r.punctaje).toEqual([80, 100, 45, 60, 45, 60]);
    expect(r.sumaPonderi).toBe(100);
    expect(r.notaFinala).toBe(390);
    expect(formateazaSutimi(r.notaFinala ?? 0)).toBe("3,90");
    expect(r.calificativ).toBe("Bine");
    expect(avizePonderi(r)).toEqual([]);
  });

  it("ponderi care nu fac 100: fără notă finală, cu aviz și suma", () => {
    const r = calculeazaGrila(
      NOTATA.map((x, i) => (i === 0 ? { ...x, pondere: 10 } : x)),
      PRAGURI_IMPLICITE,
    );
    expect(r.sumaPonderi).toBe(90);
    expect(r.notaFinala).toBeNull();
    expect(r.calificativ).toBeNull();
    expect(avizePonderi(r)).toEqual([
      "Ponderile însumează 90%, nu 100%: nota finală nu se poate calcula.",
    ]);
  });

  it("o pondere lipsă se spune, la singular și la plural", () => {
    const una = calculeazaGrila([{ pondere: null, nota: 3 }, ...NOTATA], PRAGURI_IMPLICITE);
    expect(avizePonderi(una)).toEqual([
      "Lipsește ponderea la un criteriu: nota finală nu se poate calcula.",
    ]);
    const doua = calculeazaGrila(
      [{ pondere: null, nota: 3 }, { pondere: null, nota: null }, ...NOTATA],
      PRAGURI_IMPLICITE,
    );
    expect(avizePonderi(doua)[0]).toMatch(/^Lipsește ponderea la 2 criterii:/u);
  });

  it("fișa pentru notat de mână: ponderi fără note, fără aviz, fără notă finală", () => {
    const r = calculeazaGrila(
      NOTATA.map((x) => ({ ...x, nota: null })),
      PRAGURI_IMPLICITE,
    );
    expect(r.faraNota).toBe(6);
    expect(r.punctaje.every((p) => p === null)).toBe(true);
    expect(r.notaFinala).toBeNull();
    expect(avizePonderi(r)).toEqual([]);
  });

  it("extremele scalei dau 1,00 și 5,00", () => {
    const toate = (nota: number) =>
      calculeazaGrila(
        ponderiEgale(7).map((pondere) => ({ pondere, nota })),
        PRAGURI_IMPLICITE,
      ).notaFinala;
    expect(toate(1)).toBe(100);
    expect(toate(5)).toBe(500);
  });

  it("scala are cinci trepte, de la 1 la 5", () => {
    expect(SCALA_NOTE.map((s) => s.nota)).toEqual([1, 2, 3, 4, 5]);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/calcul.test.ts"
```

Eșecul așteptat: `Error: Failed to resolve import "./calcul" from "src/app/(marketing)/unelte/fisa-evaluare/calcul.test.ts". Does the file exist?`, adică 0 teste rulate și fișierul roșu.

- [ ] **Pasul 3: Implementarea minimă** — `src/app/(marketing)/unelte/fisa-evaluare/calcul.ts`:

```ts
/**
 * Calculul fișei de evaluare: punctaj pe criteriu, nota finală, calificativ.
 *
 * ── DE CE ÎN SUTIMI, NU ÎN ZECIMALE ───────────────────────────────────────
 * Ponderile sunt procente întregi, notele sunt întregi de la 1 la 5. Produsul
 * pondere × notă e deci un număr întreg de sutimi de punct: 20 % × 4 = 80
 * sutimi = 0,80. Suma lor, cu ponderile făcând 100, e nota finală exactă cu
 * două zecimale, fără nicio rotunjire și fără virgulă mobilă. Pragurile
 * calificativelor se țin tot în sutimi, ca 3,50 să nu devină 3,4999999.
 *
 * ── CE NU E LEGE ──────────────────────────────────────────────────────────
 * Codul muncii nu dă nici scala, nici formula, nici calificativele (art. 40
 * alin. (1) lit. f) lasă criteriile la angajator; art. 242 lit. i) le trimite
 * în regulamentul intern). Scala 1–5, media ponderată și cele patru
 * calificative sunt convenția obișnuită din practică, puse aici ca implicit;
 * pragurile se pot schimba din formular.
 *
 * Fișier pur, fără importuri: îl folosesc și serverul (documentul), și grila
 * din browser (calculul pe loc).
 */

export const NOTA_MINIMA = 1;
export const NOTA_MAXIMA = 5;
/** Cât încape într-o fișă de o pagină și jumătate și într-o adresă sub ~12 KB. */
export const MAX_CRITERII = 15;
export const MAX_CRITERIU = 120;

/** Ce înseamnă fiecare notă, față de cerințele postului (fișa postului). */
export const SCALA_NOTE: readonly Readonly<{ nota: number; descriere: string }>[] = [
  { nota: 1, descriere: "mult sub cerințele postului" },
  { nota: 2, descriere: "sub cerințele postului" },
  { nota: 3, descriere: "la nivelul cerințelor postului" },
  { nota: 4, descriere: "peste cerințele postului" },
  { nota: 5, descriere: "mult peste cerințele postului" },
];

export type Calificativ = "Foarte bine" | "Bine" | "Satisfăcător" | "Nesatisfăcător";

/** Pragurile de jos ale calificativelor, în sutimi de punct (450 = 4,50). */
export type Praguri = Readonly<{ foarteBine: number; bine: number; satisfacator: number }>;

export const PRAGURI_IMPLICITE: Praguri = { foarteBine: 450, bine: 350, satisfacator: 250 };

/** Un criteriu citit: ponderea în procente întregi, nota întreagă; `null` = necompletat. */
export type RandNotat = Readonly<{ pondere: number | null; nota: number | null }>;

export type RezultatGrila = Readonly<{
  /** Suma ponderilor completate. */
  sumaPonderi: number;
  /** Câte criterii n-au pondere. */
  faraPondere: number;
  /** Câte criterii n-au notă. */
  faraNota: number;
  /** Pondere × notă, în sutimi, pe fiecare criteriu; `null` unde lipsește una dintre ele. */
  punctaje: readonly (number | null)[];
  /** În sutimi; `null` până când toate criteriile au pondere și notă, iar ponderile fac 100. */
  notaFinala: number | null;
  calificativ: Calificativ | null;
}>;

const PONDERE = /^(\d{1,3})\s*%?$/u;
const NOTA = /^[1-5]$/u;
const SUTIMI = /^(\d)(?:[.,](\d{1,2}))?$/u;

/** „20”, „20%”, „ 20 % ” → 20. Doar întregi de la 1 la 100; altfel `null`. */
export function citestePondere(brut: string): number | null {
  const potrivire = PONDERE.exec(brut.trim());
  if (potrivire === null) return null;
  const valoare = Number(potrivire[1]);
  return valoare >= 1 && valoare <= 100 ? valoare : null;
}

/** „4” → 4. Doar întregi de la 1 la 5; altfel `null`. */
export function citesteNota(brut: string): number | null {
  const curat = brut.trim();
  return NOTA.test(curat) ? Number(curat) : null;
}

/** „4,5”, „4.50”, „4” → 450. Între 1,00 și 5,00; altfel `null`. */
export function citesteSutimi(brut: string): number | null {
  const potrivire = SUTIMI.exec(brut.trim());
  if (potrivire === null) return null;
  const intregi = Number(potrivire[1]);
  const zecimale = Number((potrivire[2] ?? "0").padEnd(2, "0"));
  const sutimi = intregi * 100 + zecimale;
  return sutimi >= NOTA_MINIMA * 100 && sutimi <= NOTA_MAXIMA * 100 ? sutimi : null;
}

/**
 * Pragurile din formular. Un câmp lipsă ia implicitul lui; dacă rezultatul nu
 * e strict descrescător peste 1,00 (Foarte bine > Bine > Satisfăcător > 1,00),
 * se folosesc toate implicitele și `corectate` spune asta, ca pagina să avizeze.
 */
export function citestePraguri(
  foarteBine: string | null,
  bine: string | null,
  satisfacator: string | null,
): Readonly<{ praguri: Praguri; corectate: boolean }> {
  const lipsa = (v: string | null) => v === null || v.trim() === "";
  if (lipsa(foarteBine) && lipsa(bine) && lipsa(satisfacator)) {
    return { praguri: PRAGURI_IMPLICITE, corectate: false };
  }
  const unul = (v: string | null, implicit: number) =>
    lipsa(v) ? implicit : citesteSutimi(v ?? "");
  const fb = unul(foarteBine, PRAGURI_IMPLICITE.foarteBine);
  const b = unul(bine, PRAGURI_IMPLICITE.bine);
  const s = unul(satisfacator, PRAGURI_IMPLICITE.satisfacator);
  if (fb === null || b === null || s === null || !(fb > b && b > s && s > NOTA_MINIMA * 100)) {
    return { praguri: PRAGURI_IMPLICITE, corectate: true };
  }
  return { praguri: { foarteBine: fb, bine: b, satisfacator: s }, corectate: false };
}

/**
 * 100 împărțit pe `n` criterii, în întregi: diferența dintre oricare două e cel
 * mult 1, iar restul merge la primele. 6 → 17, 17, 17, 17, 16, 16.
 */
export function ponderiEgale(n: number): number[] {
  if (n <= 0) return [];
  const baza = Math.floor(100 / n);
  const rest = 100 - baza * n;
  return Array.from({ length: n }, (_, i) => (i < rest ? baza + 1 : baza));
}

export function calificativPentru(notaSutimi: number, praguri: Praguri): Calificativ {
  if (notaSutimi >= praguri.foarteBine) return "Foarte bine";
  if (notaSutimi >= praguri.bine) return "Bine";
  if (notaSutimi >= praguri.satisfacator) return "Satisfăcător";
  return "Nesatisfăcător";
}

/** 385 → „3,85”; 80 → „0,80”. */
export function formateazaSutimi(sutimi: number): string {
  return `${String(Math.floor(sutimi / 100))},${String(sutimi % 100).padStart(2, "0")}`;
}

export function calculeazaGrila(randuri: readonly RandNotat[], praguri: Praguri): RezultatGrila {
  const punctaje = randuri.map((r) =>
    r.pondere === null || r.nota === null ? null : r.pondere * r.nota,
  );
  const sumaPonderi = randuri.reduce((s, r) => s + (r.pondere ?? 0), 0);
  const faraPondere = randuri.filter((r) => r.pondere === null).length;
  const faraNota = randuri.filter((r) => r.nota === null).length;
  const complet = randuri.length > 0 && faraPondere === 0 && faraNota === 0;
  const notaFinala =
    complet && sumaPonderi === 100 ? punctaje.reduce<number>((s, p) => s + (p ?? 0), 0) : null;
  return {
    sumaPonderi,
    faraPondere,
    faraNota,
    punctaje,
    notaFinala,
    calificativ: notaFinala === null ? null : calificativPentru(notaFinala, praguri),
  };
}

const criterii = (n: number) => (n === 1 ? "un criteriu" : `${String(n)} criterii`);

/**
 * Ce împiedică nota finală, în cuvinte, pentru pagină. Gol când nu e nimic de
 * spus. Notele lipsă NU sunt un aviz: fișa se tipărește des goală, pentru
 * notat de mână.
 */
export function avizePonderi(r: RezultatGrila): string[] {
  if (r.faraPondere > 0) {
    return [`Lipsește ponderea la ${criterii(r.faraPondere)}: nota finală nu se poate calcula.`];
  }
  if (r.sumaPonderi !== 100) {
    return [
      `Ponderile însumează ${String(r.sumaPonderi)}%, nu 100%: nota finală nu se poate calcula.`,
    ];
  }
  return [];
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/calcul.test.ts"
```

Trebuie: `Tests  14 passed (14)`. Apoi lanțul complet și `prettier --check` pe cele două fișiere.

- [ ] **Commit**

```bash
CAI=("src/app/(marketing)/unelte/fisa-evaluare/calcul.ts" "src/app/(marketing)/unelte/fisa-evaluare/calcul.test.ts"); NOI=("${CAI[@]}")
cat > "$SCRATCH/mesaj.txt" <<'EOF'
feat(unelte): calculul fișei de evaluare — punctaj, notă finală și calificativ, în sutimi

Ponderi întregi 1–100, note întregi 1–5 cu descriptori, nota finală doar
când ponderile fac 100, praguri de calificativ modificabile. Pur, fără
importuri: îl folosesc documentul și grila din browser.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

apoi tiparul de commit din convenții.

---

### Task I2: Seturile de criterii pe tipuri de post

**Fișiere:**
- Create: `src/app/(marketing)/unelte/fisa-evaluare/seturi.ts`
- Test: `src/app/(marketing)/unelte/fisa-evaluare/seturi.test.ts` (Create)

**Interfețe:**
- Consumă: nimic.
- Produce:
  ```ts
  export type CheieSet = "general" | "vanzari" | "productie" | "administrativ";
  export type CriteriuPonderat = Readonly<{ criteriu: string; pondere: number }>;
  export type SetCriterii = Readonly<{ cheie: CheieSet; eticheta: string; criterii: readonly CriteriuPonderat[] }>;
  export const SETURI: readonly SetCriterii[];
  export const SET_IMPLICIT: CheieSet; // "general"
  export function setDupaCheie(cheie: string | null): SetCriterii;
  ```

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(marketing)/unelte/fisa-evaluare/seturi.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { SET_IMPLICIT, SETURI, setDupaCheie } from "./seturi";

describe("seturile de criterii", () => {
  it("fiecare set are ponderi întregi care fac 100", () => {
    for (const s of SETURI) {
      expect(
        s.criterii.reduce((suma, c) => suma + c.pondere, 0),
        s.cheie,
      ).toBe(100);
      for (const c of s.criterii) expect(Number.isInteger(c.pondere), c.criteriu).toBe(true);
    }
  });

  it("încap în fișă: cel mult 15 criterii, fiecare sub 120 de caractere, fără dubluri", () => {
    for (const s of SETURI) {
      expect(s.criterii.length, s.cheie).toBeLessThanOrEqual(15);
      for (const c of s.criterii) expect(c.criteriu.length, c.criteriu).toBeLessThanOrEqual(120);
      expect(new Set(s.criterii.map((c) => c.criteriu)).size, s.cheie).toBe(s.criterii.length);
    }
    expect(new Set(SETURI.map((s) => s.cheie)).size).toBe(SETURI.length);
  });

  it("cheia necunoscută sau a prototipului dă setul general", () => {
    for (const cheie of [null, "", "inexistent", "constructor", "__proto__", "toString"]) {
      expect(setDupaCheie(cheie).cheie, String(cheie)).toBe(SET_IMPLICIT);
    }
    expect(setDupaCheie("productie").eticheta).toBe("Producție");
  });

  it("textul e cu ș și ț cu virgulă, nu cu sedilă", () => {
    const tot = JSON.stringify(SETURI);
    expect(tot).not.toMatch(/[\u015E\u015F\u0162\u0163]/u);
  });
});
```

Sedilele din ultimul test se scriu ca escape-uri (`\u015E`, `\u015F`, `\u0162`, `\u0163`), nu ca litere. `continut.test.ts` („nicio sedilă turcească în tot stratul de marketing”) citește și fișierele de test din `src/app/(marketing)`, iar în pregătire o regex cu literele în clar l-a făcut roșu.

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/seturi.test.ts"
```

Eșecul așteptat: `Failed to resolve import "./seturi"`.

- [ ] **Pasul 3: Implementarea minimă** — `src/app/(marketing)/unelte/fisa-evaluare/seturi.ts`:

```ts
/**
 * Seturile de criterii predefinite, pe tipuri de post.
 *
 * Sunt PUNCTE DE PLECARE, nu „criteriile legale”: Codul muncii lasă criteriile
 * la angajator (art. 40 alin. (1) lit. f)) și cere doar ca ele să fie aduse la
 * cunoștința salariatului și trecute în contract (art. 17 alin. (3) lit. e) și
 * alin. (4)). De aceea fiecare set e scurt (șase criterii), formulat față de
 * fișa postului, cu ponderi rotunde care fac 100 — omul le schimbă după firmă.
 *
 * Pur, fără importuri: îl citesc și pagina, și grila din browser.
 */

export type CheieSet = "general" | "vanzari" | "productie" | "administrativ";

export type CriteriuPonderat = Readonly<{ criteriu: string; pondere: number }>;

export type SetCriterii = Readonly<{
  cheie: CheieSet;
  eticheta: string;
  criterii: readonly CriteriuPonderat[];
}>;

export const SETURI: readonly SetCriterii[] = [
  {
    cheie: "general",
    eticheta: "General (orice post)",
    criterii: [
      { criteriu: "Cunoștințe și competențe profesionale", pondere: 20 },
      { criteriu: "Calitatea muncii", pondere: 20 },
      { criteriu: "Respectarea termenelor", pondere: 15 },
      { criteriu: "Comunicare și lucru în echipă", pondere: 15 },
      { criteriu: "Inițiativă și rezolvarea problemelor", pondere: 15 },
      { criteriu: "Respectarea procedurilor (SSM, regulament intern)", pondere: 15 },
    ],
  },
  {
    cheie: "vanzari",
    eticheta: "Vânzări",
    criterii: [
      { criteriu: "Realizarea obiectivelor de vânzări stabilite pentru perioadă", pondere: 30 },
      { criteriu: "Relația cu clienții și calitatea serviciului", pondere: 20 },
      { criteriu: "Cunoașterea produselor și a ofertei firmei", pondere: 15 },
      { criteriu: "Atragerea de clienți noi", pondere: 15 },
      { criteriu: "Raportarea și evidența vânzărilor", pondere: 10 },
      { criteriu: "Respectarea procedurilor (SSM, regulament intern)", pondere: 10 },
    ],
  },
  {
    cheie: "productie",
    eticheta: "Producție",
    criterii: [
      { criteriu: "Realizarea normei sau a volumului planificat", pondere: 25 },
      { criteriu: "Calitatea execuției (rebuturi, remedieri)", pondere: 25 },
      { criteriu: "Respectarea normelor SSM și purtarea echipamentului de protecție", pondere: 20 },
      { criteriu: "Folosirea și întreținerea utilajelor", pondere: 10 },
      { criteriu: "Disciplina și respectarea programului de lucru", pondere: 10 },
      { criteriu: "Lucrul în echipă și preluarea sarcinilor noi", pondere: 10 },
    ],
  },
  {
    cheie: "administrativ",
    eticheta: "Administrativ (birou)",
    criterii: [
      { criteriu: "Corectitudinea și calitatea lucrărilor", pondere: 25 },
      { criteriu: "Respectarea termenelor", pondere: 20 },
      { criteriu: "Organizarea muncii și stabilirea priorităților", pondere: 15 },
      { criteriu: "Comunicarea cu colegii, clienții și instituțiile", pondere: 15 },
      { criteriu: "Cunoașterea procedurilor și a legislației aplicabile postului", pondere: 15 },
      { criteriu: "Inițiativă și îmbunătățirea modului de lucru", pondere: 10 },
    ],
  },
];

export const SET_IMPLICIT: CheieSet = "general";

/**
 * Setul după cheia din adresă; orice altceva (lipsă, greșit, `constructor`)
 * dă setul general. `find` pe listă, nu indexare într-un obiect: nicio cheie
 * a prototipului nu poate răspunde.
 */
export function setDupaCheie(cheie: string | null): SetCriterii {
  const gasit = SETURI.find((s) => s.cheie === cheie);
  if (gasit !== undefined) return gasit;
  const implicit = SETURI.find((s) => s.cheie === SET_IMPLICIT);
  if (implicit === undefined) throw new Error("Setul implicit lipsește din SETURI.");
  return implicit;
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/seturi.test.ts" src/content/landing/continut.test.ts
```

Trebuie: `seturi.test.ts` cu 4 teste trecute și `continut.test.ts` întreg verde, inclusiv testul sedilei. Apoi lanțul complet.

- [ ] **Commit** — `CAI=("src/app/(marketing)/unelte/fisa-evaluare/seturi.ts" "src/app/(marketing)/unelte/fisa-evaluare/seturi.test.ts"); NOI=("${CAI[@]}")`. Mesaj:

```text
feat(unelte): seturi de criterii pe post pentru fișa de evaluare

General, vânzări, producție, administrativ: câte șase criterii formulate
față de fișa postului, cu ponderi care fac 100. Puncte de plecare, nu lege.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task I3: Documentul comun — coloane care se rup, rubrici și data la semnături (PDF)

**Fișiere:**
- Modify: `src/lib/unelte/document-tabelar.ts` (tipul `Coloana`; sfârșitul tipului `DocumentTabelar`, după `inaltimeRand` din E4; `curataDocument` din B2)
- Modify: `src/lib/unelte/pdf.ts` (constantele E4; după `imparte`; în `deseneaza`: înaintea lui `rand`, linia `linii` din `rand`, bucla tabelului, blocul notelor și al semnăturilor)
- Test: `src/lib/unelte/randari-fisa.test.ts` (Create)

**Interfețe:**
- Consumă: `imparte(text, latime, masoara): string[]` și `taie` din `./pdf`. Din E4: `deseneaza(doc, fonturi, masoara, d)` cu `latimi`, `masoara(font, marime)`, `MARIME`, `INALT_RAND`, `CHENAR`, `inaltCorp`, `asiguraLoc`, `scrie`, `pagina`, `y`, `util`. Din B2: `curataText`, `curataDocument`. `PDFPage` din `pdf-lib` (pentru spion).
- Produce:
  ```ts
  // document-tabelar.ts
  // în Coloana:          rupe?: boolean;
  export type Rubrica = Readonly<{ titlu: string; text: string; randuriGoale: number }>;
  // în DocumentTabelar:  rubrici?: readonly Rubrica[];  dataLaSemnaturi?: boolean;
  // pdf.ts
  export function imparteCelula(text: string, latime: number, masoara: (t: string) => number): string[];
  ```

- [ ] **Pasul 0: Precondiția.** `grep -n "inaltimeRand?: number;\|export function curataDocument" src/lib/unelte/document-tabelar.ts` găsește amândouă, iar `grep -n "^function deseneaza(\|const inaltCorp\|const CHENAR" src/lib/unelte/pdf.ts` le găsește pe toate trei. Fără ele, rulează întâi B2 și E4. Rulează și `git log --oneline -5 -- src/lib/unelte/pdf.ts src/lib/unelte/document-tabelar.ts`: dacă G sau H au atins fișierele după E4, citește-le diff-ul și păstrează-l. **Ordinea fixată de criticul de completitudine (8 oct 2026) e E4–E6 → G1–G4 → H1–H5 → I3**, deci la I3 ambele sunt pe `main`. Concret: dacă `grep -n "export function mapeazaTexte" src/lib/unelte/document-tabelar.ts` găsește funcția (G1), blocul „vechi” al lui `curataDocument` nu mai există. Curățarea lui `rubrici` (titlu și text) intră atunci în `mapeazaTexte(d, f)`, cu `f` în loc de `curataText`, ca să treacă și prin înlocuirea glifelor lipsă din PDF (G3). `curataDocument` rămâne `mapeazaTexte(d, curataText)`. Testul lui G1 („curataDocument curăță și celulele tabelelor suplimentare”) și testul lui H1 („curataDocument curăță titlurile…”) trebuie să rămână verzi, alături de testul de curățare a rubricilor din I3. Cheile `rubrici` (I3), `tabeleSuplimentare` (G1) și `sectiuni` (H1) coexistă, fiecare opt-in. În `deseneaza`, ordinea de desenare e: tabelul principal → `tabeleSuplimentare` → `sectiuni` → `rubrici` → notele → semnăturile.

- [ ] **Pasul 1: Scrie testul care pică** — `src/lib/unelte/randari-fisa.test.ts`:

```ts
import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { curataDocument, type DocumentTabelar } from "./document-tabelar";
import { imparteCelula, randeazaPdf } from "./pdf";

/**
 * Câmpurile opționale ale documentului comun cerute de fișa de evaluare:
 * coloane care se rup pe rânduri (`rupe`), rubrici de text liber și data la
 * semnături. `inaltimeRand` vine din secțiunea E (condica) și se refolosește.
 *
 * Auditul din 8 oct 2026: criteriul de 89 de caractere „Calitatea relației cu
 * clienții și respectarea termenelor de livrare stabilite prin contract” ieșea
 * în PDF „…respectarea termenelor de livr…”, deși Word-ul și pagina îl arătau
 * întreg. Angajatul semna „am luat la cunoștință” sub un criteriu tăiat.
 */
const CRITERIU_LUNG =
  "Calitatea relației cu clienții și respectarea termenelor de livrare stabilite prin contract";

const FISA: DocumentTabelar = {
  titlu: "Fișa de evaluare a performanțelor profesionale",
  subtitlu: null,
  campuri: [{ eticheta: "Angajat", valoare: "Ștefănescu-Țiriac Ana-Maria" }],
  paragrafe: [],
  coloane: [
    { eticheta: "Criteriu", latime: 6.5, rupe: true },
    { eticheta: "Pondere\n(%)", latime: 1.5 },
    { eticheta: "Nota\n(1–5)", latime: 1.5 },
    { eticheta: "Punctaj", latime: 1.5 },
    { eticheta: "Observații", latime: 4.5, rupe: true },
  ],
  randuri: [
    [CRITERIU_LUNG, "40", "4", "1,60", ""],
    ["x".repeat(120), "60", "3", "1,80", ""],
    ["Total (nota finală)", "100", "", "3,40", ""],
  ],
  umbrite: [],
  note: ["Scala notelor: 1 — mult sub cerințele postului."],
  semnaturi: ["Evaluator", "Contrasemnat (opțional)", "Angajat — am luat la cunoștință"],
  dataLaSemnaturi: true,
  inaltimeRand: 26,
  rubrici: [
    {
      titlu: "Obiective pentru perioada următoare",
      text: "Termene\nRaport lunar",
      randuriGoale: 4,
    },
    { titlu: "Comentariile angajatului", text: "", randuriGoale: 4 },
  ],
  orientare: "portret",
  numeFisier: "fisa-evaluare-test",
};

/** Tot textul desenat în PDF, în ordinea desenării (pdf-lib nu are extragere de text). */
async function texteDesenate(d: DocumentTabelar): Promise<string[]> {
  const spion = vi.spyOn(PDFPage.prototype, "drawText");
  await randeazaPdf(d);
  return spion.mock.calls.map((apel) => String(apel[0]));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("imparteCelula", () => {
  const masoara = (t: string) => Array.from(t).length * 5;

  it("rupe pe cuvinte, iar cuvântul prea lung în bucăți care încap", () => {
    const randuri = imparteCelula(`scurt ${"a".repeat(45)} final`, 100, masoara);
    for (const r of randuri) expect(masoara(r)).toBeLessThanOrEqual(100);
    expect(randuri.join("").replace(/ /gu, "")).toBe(`scurt${"a".repeat(45)}final`);
  });

  it("nu desparte o pereche surogat", () => {
    const randuri = imparteCelula("😀".repeat(30), 50, masoara);
    for (const r of randuri) expect(r).not.toMatch(/\p{Cs}/u);
    expect(randuri.join("")).toBe("😀".repeat(30));
  });
});

describe("PDF: fișa de evaluare", () => {
  it("criteriul lung apare întreg, rupt pe rânduri, fără „…”", async () => {
    const texte = await texteDesenate(FISA);
    expect(texte.join(" ")).toContain(CRITERIU_LUNG);
    expect(texte.filter((t) => t.endsWith("…"))).toEqual([]);
  });

  it("un cuvânt mai lung decât coloana se rupe în bucăți, fără nicio literă pierdută", async () => {
    const texte = await texteDesenate({ ...FISA, randuri: [["y".repeat(400), "", "", "", ""]] });
    const bucati = texte.filter((t) => /^y+$/u.test(t));
    expect(bucati.length).toBeGreaterThan(1);
    expect(bucati.join("")).toBe("y".repeat(400));
  });

  it("fără `rupe`, celula se taie ca înainte (foaia de pontaj nu se schimbă)", async () => {
    const texte = await texteDesenate({
      ...FISA,
      coloane: FISA.coloane.map((c) => ({ eticheta: c.eticheta, latime: c.latime })),
    });
    expect(texte.some((t) => t.startsWith("Calitatea relației") && t.endsWith("…"))).toBe(true);
  });

  it("o rubrică fără spații (un link lipit) se rupe pe rânduri, nu se taie", async () => {
    const texte = await texteDesenate({
      ...FISA,
      rubrici: [{ titlu: "Obiective", text: "y".repeat(300), randuriGoale: 1 }],
    });
    const bucati = texte.filter((t) => /^y+$/u.test(t));
    expect(bucati.length).toBeGreaterThan(1);
    expect(bucati.join("")).toBe("y".repeat(300));
  });

  it("rubricile și data la fiecare semnătură", async () => {
    const texte = await texteDesenate(FISA);
    expect(texte).toContain("Obiective pentru perioada următoare");
    expect(texte).toContain("Termene");
    expect(texte).toContain("Raport lunar");
    expect(texte).toContain("Comentariile angajatului");
    expect(texte.filter((t) => t.startsWith("Data: "))).toHaveLength(3);
  });

  it("un rând rupt lung trece pe pagina următoare, nu coboară în rezerva de jos", async () => {
    // ~9 rânduri de text în coloana criteriului, adică un rând de ~96 pt, mult
    // peste minimul de 26. Rândurile scurte de dinainte mută locul în care cade
    // primul rând înalt cu câte 26 pt: patru deplasări acoperă fereastra de ~70 pt
    // în care un rând înalt ar fi încăput după minim, dar nu după înălțimea lui.
    const inalt = `${CRITERIU_LUNG} `.repeat(4);
    const chenare = vi.spyOn(PDFPage.prototype, "drawRectangle");
    let pagini = 0;
    for (let scurte = 0; scurte < 4; scurte += 1) {
      const randuri = [
        ...Array.from({ length: scurte }, () => ["scurt", "", "", "", ""]),
        ...Array.from({ length: 12 }, () => [inalt, "", "", "", ""]),
      ];
      const pdf = await PDFDocument.load(await randeazaPdf({ ...FISA, rubrici: [], randuri }));
      pagini = Math.max(pagini, pdf.getPageCount());
    }
    expect(pagini).toBeGreaterThanOrEqual(2);
    // 40 pt margine + 20 pt pentru rândul de jos al fișierului.
    const jos = chenare.mock.calls.map((a) => (a[0] as { y?: number } | undefined)?.y ?? 999);
    expect(jos.filter((y) => y < 60)).toEqual([]);
  }, 20_000);

  it("fără câmpurile noi, nicio dată și nicio rubrică (celelalte unelte rămân la fel)", async () => {
    const { rubrici: _r, dataLaSemnaturi: _d, ...vechi } = FISA;
    const texte = await texteDesenate(vechi);
    expect(texte.filter((t) => t.startsWith("Data: "))).toEqual([]);
    expect(texte).not.toContain("Comentariile angajatului");
  });
});

describe("curățarea rubricilor", () => {
  it("rubricile trec prin aceeași curățare ca restul textului", () => {
    const curat = curataDocument({
      ...FISA,
      rubrici: [{ titlu: "Obiective\u000b2027", text: "Raport\r\nlunar\u0000", randuriGoale: 2 }],
    });
    expect(curat.rubrici).toEqual([
      { titlu: "Obiective 2027", text: "Raport\nlunar", randuriGoale: 2 },
    ]);
  });

  it("un document fără rubrici nu le capătă la curățare", () => {
    const { rubrici: _r, ...fara } = FISA;
    expect("rubrici" in curataDocument(fara)).toBe(false);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/randari-fisa.test.ts
```

Eșecurile așteptate, văzute pe starea de după E4:
- `TypeError: imparteCelula is not a function` (×2);
- `expected 'Fișa de evaluare a performanțelor pro…' to contain 'Calitatea relației cu clienții și res…'` (criteriul tăiat);
- `expected 0 to be greater than 1` (cuvântul lung, tăiat cu „…”);
- `expected [ …(29) ] to include 'Obiective pentru perioada următoare'`;
- rubrica fără spații: `expected 0 to be greater than 1` (`scrie` taia cuvântul cu „…”);
- `expected 1 to be greater than or equal to 2` sau o celulă cu `y < 60` în testul paginării;
- testul de curățare: `rubrici` rămân necurățate.

Testul „fără `rupe`” și cel „fără câmpurile noi” trec deja: ele păzesc comportamentul vechi.

- [ ] **Pasul 3: Implementarea minimă**

**`document-tabelar.ts`.** Vechi:

```ts
  /** Lățime RELATIVĂ; randările o transformă în procente din lățimea utilă. */
  latime: number;
}>;
```

Nou:

```ts
  /** Lățime RELATIVĂ; randările o transformă în procente din lățimea utilă. */
  latime: number;
  /**
   * În PDF, textul lung se rupe pe rânduri și rândul crește, în loc să se taie
   * cu „…”. Fără el, tăierea rămâne (foaia de pontaj ține rânduri de aceeași
   * înălțime). Auditul din 8 oct 2026 a găsit criteriile fișei de evaluare
   * tăiate la ~60 de caractere, sub semnătura angajatului.
   */
  rupe?: boolean;
}>;

/** Text liber după note: titlu, textul completat și rânduri goale de scris de mână. */
export type Rubrica = Readonly<{
  titlu: string;
  /** Poate fi gol; `\n` desparte paragrafele. */
  text: string;
  /** Rândurile goale când `text` e gol; cu text, rămâne unul singur. */
  randuriGoale: number;
}>;
```

Vechi (sfârșitul tipului `DocumentTabelar`, adăugat de E4):

```ts
   * mână pe fiecare rând (auditul din 8 oct 2026 a măsurat 5,6 mm).
   */
  inaltimeRand?: number;
}>;
```

Nou:

```ts
   * mână pe fiecare rând (auditul din 8 oct 2026 a măsurat 5,6 mm).
   */
  inaltimeRand?: number;
  /**
   * Rubrici de text liber, după note și înaintea semnăturilor (fișa de
   * evaluare: obiective, plan de dezvoltare, comentariile angajatului).
   */
  rubrici?: readonly Rubrica[];
  /** Sub fiecare semnătură, un rând „Data: ____”. */
  dataLaSemnaturi?: boolean;
}>;
```

Vechi (`curataDocument`, din B2):

```ts
    semnaturi: d.semnaturi.map((s) => curataText(s)),
  };
}
```

Nou (cheia lipsă rămâne lipsă, ca `exactOptionalPropertyTypes` să nu vadă `rubrici: undefined`):

```ts
    semnaturi: d.semnaturi.map((s) => curataText(s)),
    ...(d.rubrici === undefined
      ? {}
      : {
          rubrici: d.rubrici.map((r) => ({
            ...r,
            titlu: curataText(r.titlu),
            text: curataText(r.text),
          })),
        }),
  };
}
```

**`pdf.ts`.** Constantele (după `MARIME_MARGINE` din E4). Vechi:

```ts
/** Mărimea textelor din margine: antetul rulant și numărul paginii. */
const MARIME_MARGINE = 7;
```

Nou:

```ts
/** Mărimea textelor din margine: antetul rulant și numărul paginii. */
const MARIME_MARGINE = 7;
/** Distanța dintre rândurile goale ale unei rubrici: cât să scrii de mână (~6,4 mm). */
const RAND_SCRIS = 18;
/** Linia de după „Data:”, scurtă: încape sub o semnătură dintr-un rând de trei. */
const LINIE_SEMNATURA = "______________";
```

După `imparte`. Vechi:

```ts
  return randuri.length > 0 ? randuri : [""];
}

function dimensiuni(
```

Nou:

```ts
  return randuri.length > 0 ? randuri : [""];
}

/**
 * Ca `imparte`, pentru celulele care nu au voie să piardă text (coloanele cu
 * `rupe`): un cuvânt mai lung decât coloana se rupe în bucăți care încap, nu
 * se taie cu „…”. Bucățile se taie pe puncte de cod, nu pe unități UTF-16, ca
 * să nu rămână jumătăți de pereche surogat.
 */
export function imparteCelula(
  text: string,
  latime: number,
  masoara: (t: string) => number,
): string[] {
  const bucati = text
    .split(/\s+/u)
    .filter((c) => c !== "")
    .flatMap((cuvant) => {
      if (masoara(cuvant) <= latime) return [cuvant];
      const caractere = Array.from(cuvant);
      const rezultat: string[] = [];
      let start = 0;
      while (start < caractere.length) {
        // Cel mai lung prefix care încape, prin căutare binară; măcar un caracter.
        let jos = start + 1;
        let sus = caractere.length;
        while (jos < sus) {
          const mijloc = Math.ceil((jos + sus) / 2);
          if (masoara(caractere.slice(start, mijloc).join("")) <= latime) jos = mijloc;
          else sus = mijloc - 1;
        }
        rezultat.push(caractere.slice(start, jos).join(""));
        start = jos;
      }
      return rezultat;
    });
  return imparte(bucati.join(" "), latime, masoara);
}

function dimensiuni(
```

În `deseneaza`, înaintea comentariului lui `rand`. Vechi:

```ts
  /**
   * Un rând de tabel. Etichetele pot avea `\n` (antetul foii de pontaj pune
```

Nou:

```ts
  /** Liniile fiecărei celule: `\n` rupe mereu; o coloană cu `rupe` rupe și pe cuvinte. */
  const liniiRand = (celule: readonly string[], font: PDFFont) =>
    latimi.map((w, i) =>
      (celule[i] ?? "")
        .split("\n")
        .flatMap((linie) =>
          d.coloane[i]?.rupe === true
            ? imparteCelula(linie, w - 4, masoara(font, MARIME))
            : [linie],
        ),
    );
  /** Înălțimea unui rând, înainte de desenare: paginarea trebuie s-o știe. */
  const inaltimeCalculata = (celule: readonly string[], aldin: boolean, inaltMinim: number) => {
    const linii = liniiRand(celule, aldin ? fonturi.aldin : fonturi.normal);
    const nrLinii = Math.max(1, ...linii.map((l) => l.length));
    return Math.max(inaltMinim, INALT_RAND + (nrLinii - 1) * (MARIME + 2));
  };

  /**
   * Un rând de tabel. Etichetele pot avea `\n` (antetul foii de pontaj pune
```

În `rand`. Vechi:

```ts
    const linii = celule.map((c) => c.split("\n"));
```

Nou:

```ts
    const linii = liniiRand(celule, font);
```

`taie(linie, …)` de la desenare rămâne. Pe liniile deja rupte nu mai taie nimic, iar pe coloanele fără `rupe` face ce făcea.

În bucla tabelului. Vechi:

```ts
      if (y - inaltCorp < MARGINE + REZERVA_SUBSOL) {
```

Nou:

```ts
      if (y - inaltimeCalculata(r, false, inaltCorp) < MARGINE + REZERVA_SUBSOL) {
```

Notele și începutul semnăturilor. Vechi:

```ts
  for (const n of d.note) scrie(n, 8, fonturi.normal, GRI);

  if (d.semnaturi.length > 0) {
    asiguraLoc(50);
```

Nou:

```ts
  for (const n of d.note) scrie(n, 8, fonturi.normal, GRI);

  for (const rubrica of d.rubrici ?? []) {
    const paragrafeRubrica = rubrica.text.split("\n").filter((p) => p.trim() !== "");
    const goale = paragrafeRubrica.length > 0 ? 1 : rubrica.randuriGoale;
    // Rubrica goală nu se rupe între pagini: spațiul de deasupra (6), titlul
    // (9 + 6) și rândurile ei (cel mult 4 × 18 pt) stau împreună. Textul
    // completat se paginează ca proza.
    asiguraLoc(21 + goale * RAND_SCRIS);
    y -= 6;
    scrie(rubrica.titlu, 9, fonturi.aldin);
    // Ca la criterii: un link lung lipit fără spații se rupe, nu se taie cu „…”.
    for (const p of paragrafeRubrica) {
      for (const linie of imparteCelula(p, util, masoara(fonturi.normal, 9))) {
        scrie(linie, 9, fonturi.normal);
      }
    }
    for (let k = 0; k < goale; k += 1) {
      asiguraLoc(RAND_SCRIS);
      y -= RAND_SCRIS;
      pagina.drawLine({
        start: { x: MARGINE, y },
        end: { x: MARGINE + util, y },
        thickness: 0.5,
        color: CHENAR,
      });
    }
  }

  if (d.semnaturi.length > 0) {
    const cuData = d.dataLaSemnaturi === true;
    asiguraLoc(cuData ? 64 : 50);
```

Sfârșitul semnăturilor. Vechi:

```ts
        font: fonturi.normal,
        color: GRI,
      });
    });
    y -= 20;
  }
```

Nou:

```ts
        font: fonturi.normal,
        color: GRI,
      });
      if (cuData) {
        pagina.drawText(`Data: ${LINIE_SEMNATURA}`, {
          x,
          y: y - 24,
          size: 8,
          font: fonturi.normal,
          color: GRI,
        });
      }
    });
    y -= cuData ? 34 : 20;
  }
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/
```

Trebuie: `randari-fisa.test.ts` cu 11 teste trecute, iar `randari.test.ts` (B2, A5), `pdf-pagini.test.ts` (E4) și `docx-sectiuni.test.ts` (E5) întregi verzi. Apoi lanțul complet.

- [ ] **Pasul 5: Proba de mutație a paginării.** În `pdf.ts`, pune temporar înapoi `if (y - inaltCorp < MARGINE + REZERVA_SUBSOL) {` și rulează doar `pnpm exec vitest run src/lib/unelte/randari-fisa.test.ts -t "rând rupt"`. Trebuie să pice: `expected [ …celule sub 60… ] to deeply equal []`. Pune la loc `inaltimeCalculata` și reverifică verdele. Proba asta a arătat în pregătire că varianta cu 15 rânduri NU prindea defectul, de aceea testul mută începutul tabelului cu 0–3 rânduri scurte.

- [ ] **Pasul 6: Verificare vizuală a PDF-ului.** Testul temporar se șterge înainte de commit:

```bash
cd /srv/apps/ERP
cat > src/lib/unelte/zz-proba-fisa.test.ts <<'EOF'
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { randeazaPdf } from "./pdf";
const C = "Calitatea relației cu clienții și respectarea termenelor de livrare stabilite prin contract";
it("probă vizuală", async () => {
  writeFileSync(process.env.IESIRE ?? "/dev/null", await randeazaPdf({
    titlu: "Fișa de evaluare a performanțelor profesionale", subtitlu: "Exemplu SRL",
    campuri: [{ eticheta: "Angajat", valoare: "" }], paragrafe: [],
    coloane: [{ eticheta: "Criteriu", latime: 6.5, rupe: true }, { eticheta: "Pondere\n(%)", latime: 1.5 }, { eticheta: "Observații", latime: 4.5, rupe: true }],
    randuri: Array.from({ length: 15 }, (_, i) => [`${C} ${String(i + 1)}`, "7", ""]),
    umbrite: [], note: ["Scala notelor: 1 — mult sub cerințele postului."],
    rubrici: [{ titlu: "Obiective pentru perioada următoare", text: "", randuriGoale: 4 }, { titlu: "Comentariile angajatului", text: "", randuriGoale: 4 }],
    semnaturi: ["Evaluator", "Contrasemnat (opțional)", "Angajat — am luat la cunoștință"], dataLaSemnaturi: true,
    inaltimeRand: 26, orientare: "portret", numeFisier: "proba",
  }));
});
EOF
IESIRE="$SCRATCH/proba-i3.pdf" pnpm exec vitest run src/lib/unelte/zz-proba-fisa.test.ts
rm src/lib/unelte/zz-proba-fisa.test.ts
"$SCRATCH/venv-pdf/bin/python" -I -c "import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); [d[i].render(scale=1.5).to_pil().save(f'{sys.argv[2]}-{i+1}.png') for i in range(len(d))]; print(len(d), 'pagini')" "$SCRATCH/proba-i3.pdf" "$SCRATCH/proba-i3"
git status --short -- src/lib/unelte/   # NU trebuie să apară zz-proba-fisa.test.ts
```

Dacă `$SCRATCH/venv-pdf` lipsește, îl creează E4, Pasul 5: `python3 -m venv "$SCRATCH/venv-pdf" && "$SCRATCH/venv-pdf/bin/pip" install -q pypdfium2`. Citește PNG-urile cu `Read`. Ce trebuie să vezi:
- fiecare criteriu întreg, pe 2–3 rânduri, fără „…”;
- rânduri de ~9 mm;
- antetul tabelului repetat pe pagina 2;
- rubricile cu rânduri de scris, fiecare întreagă pe o pagină;
- trei semnături, cu „Data: ______” sub fiecare;
- „Pagina 2 din N” (E4).

- [ ] **Commit** — `CAI=(src/lib/unelte/document-tabelar.ts src/lib/unelte/pdf.ts src/lib/unelte/randari-fisa.test.ts); NOI=(src/lib/unelte/randari-fisa.test.ts)`. Mesaj:

```text
fix(unelte): PDF-ul nu mai taie criteriile; rubrici și dată la semnături

Coloanele cu `rupe` se rup pe rânduri (imparteCelula rupe și cuvintele prea
lungi, pe puncte de cod), iar paginarea folosește înălțimea reală a rândului.
Auditul din 8 oct 2026: criteriul de 89 de caractere ieșea „…termenelor de
livr…” sub semnătura angajatului. Câmpuri opționale noi: `rubrici`,
`dataLaSemnaturi`; celelalte unelte nu se schimbă.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task I4: Word și Excelul comun — rubricile și data la semnături

**Fișiere:**
- Modify: `src/lib/unelte/docx.ts` (importurile E5; în `sectiune(d)`, blocul notelor și al semnăturilor)
- Modify: `src/lib/unelte/xlsx.ts` (blocul notelor și al semnăturilor, liniile ~51–52)
- Test: `src/lib/unelte/randari-fisa.test.ts` (Modify: importuri + două blocuri)

**Interfețe:**
- Consumă: `Rubrica`, `rubrici`, `dataLaSemnaturi` (I3). Din `docx` 9.8.1, verificate în `node_modules/docx/dist/index.d.ts`: `BorderStyle` (linia 660), `TableBorders.NONE` (11950), `ITableRowPropertiesOptionsBase.cantSplit` (7429), `IBordersOptions.bottom` (4692).
- Produce: semnăturile `randeazaDocx` și `randeazaXlsx` nu se schimbă.

- [ ] **Pasul 0:** `grep -n "^function sectiune(d: DocumentTabelar)\|HeightRule," src/lib/unelte/docx.ts` le găsește pe amândouă (E5). Dacă `git log --oneline -5 -- src/lib/unelte/docx.ts src/lib/unelte/xlsx.ts` arată schimbări de la G sau H, le păstrezi.

- [ ] **Pasul 1: Scrie testul care pică.** În `src/lib/unelte/randari-fisa.test.ts`, importurile devin:

```ts
import JSZip from "jszip";
import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { curataDocument, type DocumentTabelar } from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { imparteCelula, randeazaPdf } from "./pdf";
import { randeazaXlsx } from "./xlsx";
```

și, înaintea lui `describe("curățarea rubricilor"`, se adaugă:

```ts
describe("Word: fișa de evaluare", () => {
  it("rubricile și semnăturile în coloane, fiecare cu dată", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx(FISA));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain(CRITERIU_LUNG);
    expect(xml).toContain("Comentariile angajatului");
    expect(xml).toContain("Raport lunar");
    expect(xml.match(/Data: _+/gu)).toHaveLength(3);
    expect(xml.match(/Semnătura: _+/gu)).toHaveLength(3);
  });

  it("fără `dataLaSemnaturi`, semnăturile rămân pe un rând, ca înainte", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx({ ...FISA, dataLaSemnaturi: false }));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).not.toMatch(/Data: _+/u);
    expect(xml).toContain("Evaluator: ____________________");
  });
});

describe("Excel comun: rubrici și dată", () => {
  it("rubricile și rândul de dată apar și în foaia comună", async () => {
    const zip = await JSZip.loadAsync(await randeazaXlsx(FISA));
    const siruri = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    expect(siruri).toContain("Comentariile angajatului");
    expect(siruri).toContain("Raport lunar");
    expect(siruri).toContain("Data: ______________");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/randari-fisa.test.ts
```

Eșecurile așteptate: `expected '<?xml version="1.0" encoding="UTF-8" …' to contain 'Comentariile angajatului'`, la Word și la Excel. „Fără `dataLaSemnaturi`” trece deja.

- [ ] **Pasul 3: Implementarea minimă**

**`docx.ts`.** Vechi:

```ts
import {
  AlignmentType,
  Document,
```

Nou:

```ts
import {
  AlignmentType,
  BorderStyle,
  Document,
```

Vechi:

```ts
  Table,
  TableCell,
  TableRow,
```

Nou:

```ts
  Table,
  TableBorders,
  TableCell,
  TableRow,
```

În `sectiune(d)`. Vechi:

```ts
  for (const n of d.note) copii.push(paragraf(n, { size: 16, color: "6B7280" }));
  if (d.semnaturi.length > 0) {
```

Nou (ramura veche, „semnăturile pe un rând”, rămâne neschimbată după `else if`):

```ts
  for (const n of d.note) copii.push(paragraf(n, { size: 16, color: "6B7280" }));
  for (const rubrica of d.rubrici ?? []) {
    copii.push(
      new Paragraph({
        spacing: { before: 200, after: 60 },
        keepNext: true,
        children: [new TextRun({ text: rubrica.titlu, bold: true, size: 18 })],
      }),
    );
    const paragrafeRubrica = rubrica.text.split("\n").filter((p) => p.trim() !== "");
    for (const p of paragrafeRubrica) copii.push(paragraf(p, { size: 18 }));
    const goale = paragrafeRubrica.length > 0 ? 1 : rubrica.randuriGoale;
    for (let k = 0; k < goale; k += 1) {
      // Un rând de scris de mână: paragraf gol cu linie dedesubt, nu liniuțe care se rup.
      copii.push(
        new Paragraph({
          spacing: { before: 240 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "73787F", space: 1 } },
          children: [],
        }),
      );
    }
  }
  if (d.semnaturi.length > 0 && d.dataLaSemnaturi === true) {
    // Semnăturile cu dată stau în coloane, ca „Data” să cadă sub semnătura ei.
    const latime = Math.floor(100 / d.semnaturi.length);
    const randSemnatura = (text: (eticheta: string) => string) =>
      new TableRow({
        cantSplit: true,
        children: d.semnaturi.map(
          (s) =>
            new TableCell({
              width: { size: latime, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { before: 120 },
                  children: [new TextRun({ text: text(s), size: 18 })],
                }),
              ],
            }),
        ),
      });
    copii.push(
      paragraf(""),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TableBorders.NONE,
        rows: [
          randSemnatura((s) => s),
          randSemnatura(() => "Semnătura: ______________"),
          randSemnatura(() => "Data: ______________"),
        ],
      }),
    );
  } else if (d.semnaturi.length > 0) {
```

**`xlsx.ts`.** Vechi:

```ts
  for (const n of d.note) fila.addRow([n]);
  if (d.semnaturi.length > 0) fila.addRow(d.semnaturi.map((s) => `${s}: ______________`));
```

Nou:

```ts
  for (const n of d.note) fila.addRow([n]);
  for (const rubrica of d.rubrici ?? []) {
    fila.addRow([]);
    fila.addRow([rubrica.titlu]).font = { bold: true };
    const paragrafeRubrica = rubrica.text.split("\n").filter((p) => p.trim() !== "");
    for (const p of paragrafeRubrica) fila.addRow([p]);
    const goale = paragrafeRubrica.length > 0 ? 1 : rubrica.randuriGoale;
    for (let k = 0; k < goale; k += 1) {
      const rand = fila.addRow([]);
      rand.height = 20;
      d.coloane.forEach((_, i) => {
        rand.getCell(i + 1).border = { bottom: { style: "hair" } };
      });
    }
  }
  if (d.semnaturi.length > 0) fila.addRow(d.semnaturi.map((s) => `${s}: ______________`));
  if (d.semnaturi.length > 0 && d.dataLaSemnaturi === true) {
    fila.addRow(d.semnaturi.map(() => "Data: ______________"));
  }
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/
```

Trebuie: `randari-fisa.test.ts` cu 14 teste trecute, plus restul lui `src/lib/unelte` verde. Apoi lanțul complet.

- [ ] **Pasul 5: Word valid.** Proba lui B2 (`saxes`) acoperă și paragrafele noi, fiindcă `randari.test.ts` rulează pe toate randările. Ca a doua probă, scrie fișierul Word cu un test temporar, ca la I3 Pasul 6 (`randeazaDocx` în loc de `randeazaPdf`, același document), apoi:

```bash
python3 -I -c "import zipfile,sys,xml.dom.minidom as m; z=zipfile.ZipFile(sys.argv[1]); [m.parseString(z.read(n)) for n in z.namelist() if n.endswith(('.xml','.rels'))]; print('XML valid')" "$SCRATCH/proba-i4.docx"
```

Șterge testul temporar și verifică `git status --short -- src/lib/unelte/`.

- [ ] **Commit** — `CAI=(src/lib/unelte/docx.ts src/lib/unelte/xlsx.ts src/lib/unelte/randari-fisa.test.ts); NOI=()`. Mesaj:

```text
feat(unelte): rubricile și data la semnături în Word și în Excelul comun

În Word, semnăturile cu dată stau într-un tabel fără chenar, ca data să cadă
sub semnătura ei; rândurile de scris sunt paragrafe cu linie dedesubt.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task I5: Previzualizarea arată semnăturile, rubricile și rândurile înalte

**Fișiere:**
- Modify: `src/app/(marketing)/_componente/previzualizare-document.tsx` (după `const d = curataDocument(brut);` din B2; clasa `td`; coada figurii)
- Test: `src/app/(marketing)/_componente/previzualizare-fisa.test.tsx` (Create; `previzualizare-document.test.tsx` din B2 rămâne neatins)

**Interfețe:**
- Consumă: `rubrici`, `dataLaSemnaturi` (I3), `inaltimeRand` (E4), `curataDocument` (B2).
- Produce: `PrevizualizareDocument({ document })` neschimbată. Marcaje noi pentru teste și sonde: `[data-semnaturi]`, `[data-rubrica]`.

- [ ] **Pasul 0:** `grep -n "const d = curataDocument(brut);\|data-tipar-pagina" "src/app/(marketing)/_componente/previzualizare-document.tsx"` găsește amândouă (B2, B6).

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(marketing)/_componente/previzualizare-fisa.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { PrevizualizareDocument } from "./previzualizare-document";

/**
 * Previzualizarea promite „ce vede omul pe ecran e ce descarcă”
 * (`document-tabelar.ts`). Auditul din 8 oct 2026 a găsit-o oprită la note:
 * fără semnăturile pe care PDF-ul și Word-ul le aveau. Rubricile și data la
 * semnături ale fișei de evaluare trebuie să apară și aici.
 */
const DOC: DocumentTabelar = {
  titlu: "Fișa de evaluare a performanțelor profesionale",
  subtitlu: null,
  campuri: [],
  paragrafe: [],
  coloane: [
    { eticheta: "Criteriu", latime: 6.5, rupe: true },
    { eticheta: "Pondere\n(%)", latime: 1.5 },
  ],
  randuri: [["Calitatea muncii", "100"]],
  umbrite: [],
  note: ["Scala notelor: 1 — mult sub cerințele postului."],
  semnaturi: ["Evaluator", "Angajat — am luat la cunoștință"],
  orientare: "portret",
  numeFisier: "fisa",
};

describe("previzualizarea documentului", () => {
  it("arată semnăturile din fișier, la orice unealtă", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    const semnaturi = container.querySelector("[data-semnaturi]");
    expect(semnaturi?.textContent).toContain("Evaluator");
    expect(semnaturi?.textContent).toContain("Angajat — am luat la cunoștință");
    expect(semnaturi?.textContent).not.toContain("Data:");
  });

  it("fără semnături, nu randează rândul gol", () => {
    const { container } = render(<PrevizualizareDocument document={{ ...DOC, semnaturi: [] }} />);
    expect(container.querySelector("[data-semnaturi]")).toBeNull();
  });

  it("rubricile, data la semnături și rândurile înalte, când documentul le are", () => {
    const { container } = render(
      <PrevizualizareDocument
        document={{
          ...DOC,
          dataLaSemnaturi: true,
          inaltimeRand: 26,
          rubrici: [
            { titlu: "Obiective pentru perioada următoare", text: "Raport lunar", randuriGoale: 4 },
            { titlu: "Comentariile angajatului", text: "", randuriGoale: 4 },
          ],
        }}
      />,
    );
    const rubrici = [...container.querySelectorAll("[data-rubrica]")];
    expect(rubrici.map((r) => r.firstElementChild?.textContent)).toEqual([
      "Obiective pentru perioada următoare",
      "Comentariile angajatului",
    ]);
    expect(rubrici[0]?.textContent).toContain("Raport lunar");
    // Rubrica goală are cele patru rânduri de scris; cea completată, unul.
    expect(rubrici.map((r) => r.querySelectorAll("div[aria-hidden]").length)).toEqual([1, 4]);
    const semnaturi = container.querySelector("[data-semnaturi]")?.textContent ?? "";
    expect(semnaturi.match(/Data:/gu)).toHaveLength(2);
    expect(container.querySelector("tbody td")?.className).toContain("h-10");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/previzualizare-fisa.test.tsx"
```

Eșecurile așteptate, văzute pe starea de după B2/B6: `the given combination of arguments (undefined and string) is invalid for this assertion` (nu există `[data-semnaturi]`) și `expected [] to deeply equal [ …(2) ]` (nu există `[data-rubrica]`). „Fără semnături” trece deja: 1 trecut, 2 picați.

- [ ] **Pasul 3: Implementarea minimă.** Vechi:

```tsx
  const d = curataDocument(brut);
```

Nou:

```tsx
  const d = curataDocument(brut);
  // Rândurile înalte din PDF (scris de mână, semnătură) au și pe ecran mai mult loc.
  const inalt = (d.inaltimeRand ?? 0) > 20;
```

Vechi:

```tsx
                      className={`h-7 px-2 ${d.umbrite.includes(j) ? "bg-mk-rigla/20" : ""}`}
```

Nou:

```tsx
                      className={`${inalt ? "h-10 py-1" : "h-7"} px-2 ${d.umbrite.includes(j) ? "bg-mk-rigla/20" : ""}`}
```

Vechi (sfârșitul figurii):

```tsx
          {n}
        </p>
      ))}
    </figure>
```

Nou:

```tsx
          {n}
        </p>
      ))}
      {(d.rubrici ?? []).map((rubrica) => {
        const paragrafe = rubrica.text.split("\n").filter((p) => p.trim() !== "");
        const goale = paragrafe.length > 0 ? 1 : rubrica.randuriGoale;
        return (
          <div key={rubrica.titlu} className="mt-5" data-rubrica="">
            <p className="text-[0.875rem] font-semibold">{rubrica.titlu}</p>
            {paragrafe.map((p) => (
              <p key={p} className="mt-1 max-w-[68ch] text-[0.875rem] leading-[1.6]">
                {p}
              </p>
            ))}
            {Array.from({ length: goale }, (_, k) => (
              <div key={k} aria-hidden="true" className="border-mk-rigla h-7 border-b" />
            ))}
          </div>
        );
      })}
      {/* Semnăturile din fișier, și pe ecran: auditul din 8 oct 2026 a găsit
          previzualizarea oprită la note, deși PDF-ul și Word-ul le aveau. */}
      {d.semnaturi.length > 0 && (
        <div
          className="mt-8 grid gap-6 text-[0.8125rem] sm:auto-cols-fr sm:grid-flow-col"
          data-semnaturi=""
        >
          {d.semnaturi.map((s) => (
            <div key={s}>
              <div aria-hidden="true" className="border-mk-text-slab h-8 border-b" />
              <p className="text-mk-text-slab mt-1">{s}</p>
              {d.dataLaSemnaturi === true && (
                <p className="text-mk-text-slab mt-1">
                  Data:{" "}
                  <span
                    aria-hidden="true"
                    className="border-mk-text-slab inline-block w-24 border-b"
                  />
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </figure>
```

„Data:” se scrie cu o linie din CSS (`w-24 border-b`), nu cu `LINIE_GOALA`. Cele 30 de liniuțe nu se pot rupe și, pe trei coloane de ~190 px (`sm`), ar fi ieșit din pagină.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/" "src/app/(marketing)/unelte/"
```

Trebuie: `previzualizare-fisa.test.tsx` cu 3 teste trecute. Mai trebuie să treacă `previzualizare-document.test.tsx` (B2), `tipar.test.tsx` (B5, B6) și `avize.test.tsx` (B4). Semnăturile apar acum în `#documentul` la condică, la foaia de parcurs și la fișa SSM (cererea are, după F, propria previzualizare, `ScrisoarePrevizualizata`), iar testul lui B6 numără doar ce e în afara lui `#documentul`. Câte pagini iau acestea la tipar se verifică pe staging, în I10, Pasul 4. Apoi lanțul complet.

- [ ] **Commit** — `CAI=("src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/previzualizare-fisa.test.tsx"); NOI=("src/app/(marketing)/_componente/previzualizare-fisa.test.tsx")`. Mesaj:

```text
fix(unelte): previzualizarea arată semnăturile din fișier, rubricile și rândurile înalte

„Ce vede omul pe ecran e ce descarcă” (document-tabelar.ts): auditul din
8 oct 2026 a găsit previzualizarea oprită la note, fără semnături.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task I6: Modelul fișei — grila, setul, data, rubricile și pragurile

**Fișiere:**
- Modify (rescris): `src/app/(marketing)/unelte/fisa-evaluare/model.ts`. Cel vechi are 81 de linii, toate citite. Rămân exporturile `CRITERII_IMPLICITE`, `ParametriFisaEvaluare` (extins), `parametriFisaEvaluare`, `construiesteFisaEvaluare` și `fisaEvaluareDinParametri`, pe care le folosesc pagina veche și registrul până la I7/I9.
- Test: `src/app/(marketing)/unelte/fisa-evaluare/model.test.ts` (rescris; cele două teste vechi devin „fără nimic, setul general” și „cel mult 15 criterii, fiecare cel mult 120 de caractere”)

**Interfețe:**
- Consumă: din `./calcul` (I1): `calculeazaGrila`, `citesteNota`, `citestePondere`, `citestePraguri`, `formateazaSutimi`, `MAX_CRITERII`, `MAX_CRITERIU`, `SCALA_NOTE`, `type Praguri`, `type RezultatGrila`. Din `./seturi` (I2): `setDupaCheie`, `type CheieSet`. Din `@/lib/format/date`: `formatDate(value: string): string`, care aruncă pentru o zi inexistentă (linia 85), și `parseDateRo(input: string): string | null` (linia 264). `type DocumentTabelar` cu `rupe`, `rubrici`, `dataLaSemnaturi` (I3) și `inaltimeRand` (E4).
- Produce:
  ```ts
  export const MAX_RUBRICA = 500;
  export type RandGrila = Readonly<{ criteriu: string; pondere: number | null; nota: number | null }>;
  export type ParametriFisaEvaluare = Readonly<{ nume: string; functie: string; perioada: string; evaluator: string;
    firma: string; data: string; set: CheieSet; grila: readonly RandGrila[]; praguri: Praguri; praguriCorectate: boolean;
    puncteForte: string; deImbunatatit: string; obiective: string; dezvoltare: string }>;
  export const CRITERII_IMPLICITE: readonly string[];
  export function parametriFisaEvaluare(q: URLSearchParams): ParametriFisaEvaluare;
  export function rezultatFisa(o: ParametriFisaEvaluare): RezultatGrila;
  export const TEXT_SCALA: string; export const TEXT_FORMULA: string; export const NOTA_LEGALA: string;
  export function textPraguri(p: Praguri): string;
  export const SEMNATURI_FISA: readonly string[];
  export function construiesteFisaEvaluare(o: ParametriFisaEvaluare): DocumentTabelar;
  export function fisaEvaluareDinParametri(q: URLSearchParams): DocumentTabelar;
  ```

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(marketing)/unelte/fisa-evaluare/model.test.ts`, întreg:

```ts
import { describe, expect, it } from "vitest";

import { MAX_CRITERII } from "./calcul";
import {
  CRITERII_IMPLICITE,
  fisaEvaluareDinParametri,
  parametriFisaEvaluare,
  rezultatFisa,
} from "./model";
import { setDupaCheie } from "./seturi";

/** Adresa exact cum o trimite formularul: câte un criteriu, o pondere și o notă pe rând. */
function adresa(randuri: readonly (readonly [string, string, string])[], extra = {}) {
  const q = new URLSearchParams(extra);
  for (const [criteriu, pondere, nota] of randuri) {
    q.append("criteriu", criteriu);
    q.append("pondere", pondere);
    q.append("nota", nota);
  }
  return q;
}

const NOTATA = [
  ["Cunoștințe profesionale", "20", "4"],
  ["Calitatea muncii", "20", "5"],
  ["Respectarea termenelor", "15", "3"],
  ["Comunicare", "15", "4"],
  ["Inițiativă", "15", "3"],
  ["Respectarea procedurilor", "15", "4"],
] as const;

describe("fișa de evaluare: parametrii", () => {
  it("fără nimic, setul general cu ponderile lui și fără note", () => {
    const p = parametriFisaEvaluare(new URLSearchParams());
    expect(p.set).toBe("general");
    expect(p.grila.map((r) => r.criteriu)).toEqual(CRITERII_IMPLICITE);
    expect(p.grila.map((r) => r.pondere)).toEqual([20, 20, 15, 15, 15, 15]);
    expect(p.grila.every((r) => r.nota === null)).toBe(true);
  });

  it("rândurile din formular, aliniate pe poziție, chiar cu ponderi goale la mijloc", () => {
    const p = parametriFisaEvaluare(
      adresa([
        ["A", "50", "4"],
        ["B", "", "3"],
        ["C", "50", ""],
      ]),
    );
    expect(p.grila).toEqual([
      { criteriu: "A", pondere: 50, nota: 4 },
      { criteriu: "B", pondere: null, nota: 3 },
      { criteriu: "C", pondere: 50, nota: null },
    ]);
  });

  it("rândurile fără criteriu se sar, iar valorile de neînțeles devin necompletate", () => {
    const p = parametriFisaEvaluare(
      adresa([
        ["   ", "30", "4"],
        ["A", "150", "7"],
        ["B", "2e1", "3.456"],
      ]),
    );
    expect(p.grila).toEqual([
      { criteriu: "A", pondere: null, nota: null },
      { criteriu: "B", pondere: null, nota: null },
    ]);
  });

  it("cel mult 15 criterii, fiecare cel mult 120 de caractere", () => {
    const randuri = Array.from(
      { length: 40 },
      (_, i) => [`${"x".repeat(200)}${String(i)}`, "", ""] as const,
    );
    const p = parametriFisaEvaluare(adresa(randuri));
    expect(p.grila).toHaveLength(MAX_CRITERII);
    expect(p.grila[0]?.criteriu).toHaveLength(120);
  });

  it("linkurile vechi cu `criterii` pe rânduri merg, fără ponderi", () => {
    const p = parametriFisaEvaluare(new URLSearchParams({ criterii: "Unu\n\nDoi\r\nTrei" }));
    expect(p.grila).toEqual([
      { criteriu: "Unu", pondere: null, nota: null },
      { criteriu: "Doi", pondere: null, nota: null },
      { criteriu: "Trei", pondere: null, nota: null },
    ]);
  });

  it("`incarca=set` înlocuiește rândurile scrise cu setul ales", () => {
    const p = parametriFisaEvaluare(
      adresa([["A", "100", "4"]], { set: "productie", incarca: "set" }),
    );
    expect(p.set).toBe("productie");
    expect(p.grila.map((r) => r.criteriu)).toEqual(
      setDupaCheie("productie").criterii.map((c) => c.criteriu),
    );
  });

  it("data: ISO sau românească, validată; altfel goală", () => {
    expect(parametriFisaEvaluare(new URLSearchParams({ data: "2026-12-15" })).data).toBe(
      "2026-12-15",
    );
    expect(parametriFisaEvaluare(new URLSearchParams({ data: "15.12.2026" })).data).toBe(
      "2026-12-15",
    );
    for (const gresit of ["2026-02-31", "1899-01-01", "mâine", "2026-13-01"]) {
      expect(parametriFisaEvaluare(new URLSearchParams({ data: gresit })).data, gresit).toBe("");
    }
  });

  it("rubricile păstrează rândurile, strâng spațiile și se opresc la 500 de caractere", () => {
    const p = parametriFisaEvaluare(
      new URLSearchParams({
        obiective: "  Raport   lunar \r\n\r\n Curs Excel ",
        dezvoltare: "y".repeat(900),
      }),
    );
    expect(p.obiective).toBe("Raport lunar\nCurs Excel");
    expect(p.dezvoltare).toHaveLength(500);
  });

  it("pragurile din adresă, sau implicitele cu semn că s-au corectat", () => {
    expect(parametriFisaEvaluare(new URLSearchParams({ prag_fb: "4,75" })).praguri.foarteBine).toBe(
      475,
    );
    const gresite = parametriFisaEvaluare(new URLSearchParams({ prag_fb: "2", prag_b: "4" }));
    expect(gresite.praguriCorectate).toBe(true);
    expect(gresite.praguri.foarteBine).toBe(450);
  });
});

describe("fișa de evaluare: documentul", () => {
  it("calculează punctajul, totalul, nota finală și calificativul", () => {
    const d = fisaEvaluareDinParametri(adresa(NOTATA));
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Criteriu",
      "Pondere\n(%)",
      "Nota\n(1–5)",
      "Punctaj",
      "Observații",
    ]);
    expect(d.randuri[0]).toEqual(["Cunoștințe profesionale", "20", "4", "0,80", ""]);
    expect(d.randuri.slice(-2)).toEqual([
      ["Total (nota finală)", "100", "", "3,90", ""],
      ["Calificativ", "", "", "", "Bine"],
    ]);
  });

  it("ponderi care nu fac 100: totalul arată suma, nota finală rămâne de completat", () => {
    const d = fisaEvaluareDinParametri(
      adresa(NOTATA.map((r, i) => (i === 0 ? [r[0], "10", r[2]] : r))),
    );
    expect(d.randuri.slice(-2)).toEqual([
      ["Total (nota finală)", "90", "", "", ""],
      ["Calificativ", "", "", "", ""],
    ]);
  });

  it("o pondere lipsă: totalul rămâne gol, nu o sumă parțială", () => {
    const d = fisaEvaluareDinParametri(new URLSearchParams({ criterii: "Unu\nDoi" }));
    expect(d.randuri.at(-2)).toEqual(["Total (nota finală)", "", "", "", ""]);
  });

  it("fișa completă: scala, formula, pragurile, temeiul, rubricile, trei semnături cu dată", () => {
    const d = fisaEvaluareDinParametri(new URLSearchParams({ data: "2026-12-15" }));
    expect(d.campuri).toContainEqual({ eticheta: "Data evaluării", valoare: "15.12.2026" });
    expect(d.note.join(" ")).toMatch(/1 — mult sub cerințele postului/u);
    expect(d.note.join(" ")).toMatch(/Foarte bine de la 4,50/u);
    expect(d.note.join(" ")).toMatch(/art\. 17 alin\. \(3\) lit\. e\), \(4\) și \(5\)/u);
    expect(d.rubrici?.map((r) => r.titlu)).toEqual([
      "Puncte forte",
      "De îmbunătățit",
      "Obiective pentru perioada următoare",
      "Plan de dezvoltare (formare, îndrumare)",
      "Comentariile angajatului",
    ]);
    expect(d.semnaturi).toHaveLength(3);
    expect(d.dataLaSemnaturi).toBe(true);
    expect(d.coloane[0]?.rupe).toBe(true);
    expect(d.inaltimeRand).toBeGreaterThanOrEqual(24);
  });

  it("rezultatul pentru grilă e cel din calcul", () => {
    const r = rezultatFisa(parametriFisaEvaluare(adresa(NOTATA)));
    expect(r.notaFinala).toBe(390);
    expect(r.calificativ).toBe("Bine");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/model.test.ts"
```

Eșecul așteptat, văzut pe modelul vechi: `Tests 14 failed (14)`, între care `expected undefined to be 'general'` (nu există `set`), `expected undefined to be '2026-12-15'` (nu există `data`), `expected [ 'Criteriu', 'Pondere\n(%)', …(2) ] to deeply equal [ 'Criteriu', 'Pondere\n(%)', …(3) ]` (lipsește Punctaj) și `Target cannot be null or undefined` (rubricile).

- [ ] **Pasul 3: Implementarea minimă** — `src/app/(marketing)/unelte/fisa-evaluare/model.ts`, întreg:

```ts
import { formatDate, parseDateRo } from "@/lib/format/date";
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import {
  calculeazaGrila,
  citesteNota,
  citestePondere,
  citestePraguri,
  formateazaSutimi,
  MAX_CRITERII,
  MAX_CRITERIU,
  SCALA_NOTE,
  type Praguri,
  type RezultatGrila,
} from "./calcul";
import { setDupaCheie, type CheieSet } from "./seturi";

/**
 * Fișa de evaluare a performanțelor profesionale.
 *
 * Codul muncii nu dă un model; dă doar dreptul angajatorului de a stabili
 * obiectivele și criteriile de evaluare (art. 40 alin. (1) lit. f)), obligația
 * de a le comunica salariatului și de a le trece în contract (art. 17 alin.
 * (3) lit. e) și alin. (4)) și locul procedurii: regulamentul intern (art. 242
 * lit. i)). Verificate pe forma consolidată la 27.04.2026 (legislatie.just.ro,
 * DetaliiDocument/309240), descărcată pe 8 oct 2026.
 *
 * ── ADRESA ────────────────────────────────────────────────────────────────
 * `criteriu`, `pondere`, `nota` se repetă, câte unul pe rând, în ordinea
 * rândurilor: un formular GET le trimite exact așa, și un câmp text gol tot
 * pleacă, deci pozițiile rămân aliniate. `criterii` (un criteriu pe rând, fără
 * ponderi) e forma veche, din linkurile de dinainte de 8 oct 2026; se citește
 * doar când lipsesc rândurile noi. `incarca=set` cere setul ales, peste ce era
 * scris (butonul „Încarcă setul”, care merge și fără JavaScript).
 */

export const MAX_RUBRICA = 500;

/** Un rând al grilei, citit și mărginit. `null` = necompletat (sau de neînțeles). */
export type RandGrila = Readonly<{ criteriu: string; pondere: number | null; nota: number | null }>;

export type ParametriFisaEvaluare = Readonly<{
  nume: string;
  functie: string;
  perioada: string;
  evaluator: string;
  firma: string;
  /** Ziua evaluării, ISO (`2026-12-15`), sau gol. */
  data: string;
  set: CheieSet;
  grila: readonly RandGrila[];
  praguri: Praguri;
  /** Pragurile din adresă nu erau valide și s-au folosit implicitele. */
  praguriCorectate: boolean;
  puncteForte: string;
  deImbunatatit: string;
  obiective: string;
  dezvoltare: string;
}>;

/** Lista implicită, păstrată pentru textul de exemplu și linkurile vechi. */
export const CRITERII_IMPLICITE: readonly string[] = setDupaCheie(null).criterii.map(
  (c) => c.criteriu,
);

/** Un câmp de o linie: fără rânduri noi, fără spații la capete, plafonat. */
const text = (v: string | null) => (v ?? "").replace(/\s+/gu, " ").trim().slice(0, MAX_CRITERIU);

/** O rubrică de text liber: rândurile se păstrează, cele goale se strâng. */
const rubrica = (v: string | null) =>
  (v ?? "")
    .split(/\r\n?|\n/u)
    .map((r) => r.replace(/\s+/gu, " ").trim())
    .filter((r) => r !== "")
    .join("\n")
    .slice(0, MAX_RUBRICA);

/** ISO sau „15.12.2026”, an între 2000 și 2100; altfel gol. */
function dataEvaluarii(brut: string | null): string {
  const v = (brut ?? "").trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/u.test(v) ? v : (parseDateRo(v) ?? "");
  if (iso === "") return "";
  try {
    formatDate(iso); // aruncă pentru 2026-02-31
  } catch {
    return "";
  }
  const an = Number(iso.slice(0, 4));
  return an >= 2000 && an <= 2100 ? iso : "";
}

function grilaDinAdresa(q: URLSearchParams, set: CheieSet): readonly RandGrila[] {
  const dinSet = () =>
    setDupaCheie(set).criterii.map((c) => ({
      criteriu: c.criteriu,
      pondere: c.pondere,
      nota: null,
    }));
  if (q.get("incarca") === "set") return dinSet();

  const ponderi = q.getAll("pondere");
  const note = q.getAll("nota");
  const randuri = q
    .getAll("criteriu")
    .map((c, i) => ({
      criteriu: text(c),
      pondere: citestePondere(ponderi[i] ?? ""),
      nota: citesteNota(note[i] ?? ""),
    }))
    .filter((r) => r.criteriu !== "")
    .slice(0, MAX_CRITERII);
  if (randuri.length > 0) return randuri;

  const vechi = (q.get("criterii") ?? "")
    .split(/\n/u)
    .map((c) => text(c))
    .filter((c) => c !== "")
    .slice(0, MAX_CRITERII)
    .map((criteriu) => ({ criteriu, pondere: null, nota: null }));
  return vechi.length > 0 ? vechi : dinSet();
}

export function parametriFisaEvaluare(q: URLSearchParams): ParametriFisaEvaluare {
  const set = setDupaCheie(q.get("set")).cheie;
  const { praguri, corectate } = citestePraguri(q.get("prag_fb"), q.get("prag_b"), q.get("prag_s"));
  return {
    nume: text(q.get("nume")),
    functie: text(q.get("functie")),
    perioada: text(q.get("perioada")),
    evaluator: text(q.get("evaluator")),
    firma: text(q.get("firma")),
    data: dataEvaluarii(q.get("data")),
    set,
    grila: grilaDinAdresa(q, set),
    praguri,
    praguriCorectate: corectate,
    puncteForte: rubrica(q.get("puncte_forte")),
    deImbunatatit: rubrica(q.get("de_imbunatatit")),
    obiective: rubrica(q.get("obiective")),
    dezvoltare: rubrica(q.get("dezvoltare")),
  };
}

export function rezultatFisa(o: ParametriFisaEvaluare): RezultatGrila {
  return calculeazaGrila(o.grila, o.praguri);
}

/** Textul scalei, același în PDF, Word, Excel și pe pagină. */
export const TEXT_SCALA = `Scala notelor: ${SCALA_NOTE.map((s) => `${String(s.nota)} — ${s.descriere}`).join("; ")}.`;

export const TEXT_FORMULA =
  "Punctaj = pondere × notă / 100. Nota finală = totalul punctajelor, când ponderile însumează 100%.";

export function textPraguri(p: Praguri): string {
  return `Calificativ: Foarte bine de la ${formateazaSutimi(p.foarteBine)}; Bine de la ${formateazaSutimi(p.bine)}; Satisfăcător de la ${formateazaSutimi(p.satisfacator)}; Nesatisfăcător sub ${formateazaSutimi(p.satisfacator)}.`;
}

export const NOTA_LEGALA =
  "Criteriile de evaluare se comunică salariatului și se trec în contractul individual de muncă; schimbarea lor cere act adițional, încheiat înainte — art. 17 alin. (3) lit. e), (4) și (5) din Codul muncii.";

export const SEMNATURI_FISA: readonly string[] = [
  "Evaluator",
  "Contrasemnat (opțional)",
  "Angajat — am luat la cunoștință",
];

export function construiesteFisaEvaluare(o: ParametriFisaEvaluare): DocumentTabelar {
  const r = rezultatFisa(o);
  const completa = r.faraPondere === 0;
  return {
    titlu: "Fișa de evaluare a performanțelor profesionale",
    subtitlu: o.firma === "" ? null : o.firma,
    campuri: [
      { eticheta: "Angajat", valoare: o.nume },
      { eticheta: "Funcția", valoare: o.functie },
      { eticheta: "Perioada evaluată", valoare: o.perioada },
      { eticheta: "Evaluator", valoare: o.evaluator },
      { eticheta: "Data evaluării", valoare: o.data === "" ? "" : formatDate(o.data) },
    ],
    paragrafe: [],
    coloane: [
      { eticheta: "Criteriu", latime: 6.5, rupe: true },
      { eticheta: "Pondere\n(%)", latime: 1.5 },
      { eticheta: "Nota\n(1–5)", latime: 1.5 },
      { eticheta: "Punctaj", latime: 1.5 },
      { eticheta: "Observații", latime: 4.5, rupe: true },
    ],
    randuri: [
      ...o.grila.map((rand, i) => {
        const punctaj = r.punctaje[i] ?? null;
        return [
          rand.criteriu,
          rand.pondere === null ? "" : String(rand.pondere),
          rand.nota === null ? "" : String(rand.nota),
          punctaj === null ? "" : formateazaSutimi(punctaj),
          "",
        ];
      }),
      // Suma doar când toate ponderile sunt scrise: o sumă parțială ar arăta ca un total.
      // Totalul coloanei Punctaj ESTE nota finală; calificativul are rândul lui, cu
      // celula largă (Observații) liberă pentru scris de mână.
      [
        "Total (nota finală)",
        completa ? String(r.sumaPonderi) : "",
        "",
        r.notaFinala === null ? "" : formateazaSutimi(r.notaFinala),
        "",
      ],
      ["Calificativ", "", "", "", r.calificativ ?? ""],
    ],
    umbrite: [],
    note: [TEXT_SCALA, TEXT_FORMULA, textPraguri(o.praguri), NOTA_LEGALA],
    rubrici: [
      { titlu: "Puncte forte", text: o.puncteForte, randuriGoale: 3 },
      { titlu: "De îmbunătățit", text: o.deImbunatatit, randuriGoale: 3 },
      { titlu: "Obiective pentru perioada următoare", text: o.obiective, randuriGoale: 4 },
      { titlu: "Plan de dezvoltare (formare, îndrumare)", text: o.dezvoltare, randuriGoale: 3 },
      { titlu: "Comentariile angajatului", text: "", randuriGoale: 4 },
    ],
    semnaturi: SEMNATURI_FISA,
    dataLaSemnaturi: true,
    inaltimeRand: 26,
    orientare: "portret",
    numeFisier: `fisa-evaluare-${o.nume === "" ? "necompletata" : o.nume}`,
  };
}

export function fisaEvaluareDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteFisaEvaluare(parametriFisaEvaluare(q));
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/" src/app/api/unelte/ src/lib/unelte/
```

Trebuie: `model.test.ts` cu 14 teste trecute, iar ruta comună (`[unealta]`), care încă servește fișa, rămâne verde. Apoi lanțul complet. Pagina veche compilează: folosește doar exporturile păstrate.

- [ ] **Commit** — `CAI=("src/app/(marketing)/unelte/fisa-evaluare/model.ts" "src/app/(marketing)/unelte/fisa-evaluare/model.test.ts"); NOI=()`. Mesaj:

```text
feat(unelte): fișa de evaluare citește ponderea și nota pe fiecare criteriu și calculează

Rânduri `criteriu`/`pondere`/`nota` aliniate pe poziție, seturi pe post,
data evaluării, rubrici (puncte forte, de îmbunătățit, obiective, plan de
dezvoltare, comentariile angajatului), trei semnături cu dată, praguri.
Linkurile vechi cu `criterii` merg în continuare.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task I7: Excelul cu formule și ruta statică

**Fișiere:**
- Create: `src/app/(marketing)/unelte/fisa-evaluare/excel.ts`, `src/app/api/unelte/fisa-evaluare/route.ts`
- Modify: `src/lib/unelte/registru.ts` (două linii), `src/app/api/unelte/[unealta]/route.test.ts` (testul lui B8 și testul de cache al lui A5, mutat de E12 pe fișa de evaluare)
- Test: `src/app/(marketing)/unelte/fisa-evaluare/excel.test.ts` și `src/app/api/unelte/fisa-evaluare/route.test.ts` (Create)

**Cine mai citește `"fisa-evaluare"` din `UNELTE`** (verificat la 8 oct 2026, în planurile celorlalte secțiuni). Scoaterea intrării rupe două teste deja comise înaintea lui I, iar pe amândouă le repară taskul de față:
- testul lui B8 („formatul cu majuscule…”);
- testul de cache al lui A5, pe care E12 (`E-pontaj-condica.md`, „testul pus de A5 cere condica PRIN ruta comună”) l-a mutat de pe condică pe `/api/unelte/fisa-evaluare?format=pdf`. După I7, cererea primește 404, iar `expect(r.status).toBe(200)` pică.

Două secțiuni planificate DUPĂ I se sprijină tot pe intrare. Nu le repari aici, dar le semnalezi în raportul taskului:
- J3 (`J-masurare-conversie.md`) învelește și ruta statică a fișei și alege unealta de test din registru, deci e acoperit;
- K11 (`K-seo-unelte-noi.md`, `exemple-unelte.test.ts`) construiește exemplul fișei prin `constructorPentru(e.api)`, iar K-ul care adaugă cererea de demisie în `registru.ts` folosește ca ancoră linia `import { fisaEvaluareDinParametri } …`. După I7, amândouă trebuie să ia fișa din `fisaEvaluareDinParametri` (`./model`), nu din registru.

**Interfețe:**
- Consumă:
  - din `exceljs` 4.4.0, verificate în `node_modules/exceljs/index.d.ts`: `Workbook.calcProperties.fullCalcOnLoad` (1389, 1725); `CellFormulaValue { formula; result? }` (351); `DataValidation` (308); `addConditionalFormatting({ ref, rules })` (1377, 1089) cu regula `type: "expression"` (1020). `Worksheet.dataValidations.add(adresa, validare)` există la rulare (`lib/doc/worksheet.js:111`, `lib/doc/data-validations.js`), dar lipsește din tipuri, de aceea folosim `FilaCuValidari`;
  - `ADRESA_SITE` din `@/content/landing/contact`;
  - din `@/lib/unelte/document-tabelar`: `adresaDinFisier`, `SEMNATURA_FISIER`, `curataDocument` (B2) și `normalizeazaFormat` (B8);
  - din `@/lib/unelte/raspuns`: `raspunsDocument` și `raspunsBinar(continut, format, numeFisier)` (E5);
  - din `./model`: `NOTA_LEGALA`, `rezultatFisa`, `TEXT_FORMULA`, `TEXT_SCALA`, `type ParametriFisaEvaluare`, `construiesteFisaEvaluare` și `parametriFisaEvaluare`;
  - din `./calcul`: `SCALA_NOTE`.
- Produce:
  ```ts
  // excel.ts
  export async function randeazaXlsxEvaluare(d: DocumentTabelar, p: ParametriFisaEvaluare): Promise<Uint8Array>;
  // api/unelte/fisa-evaluare/route.ts
  export const dynamic = "force-dynamic";
  export async function GET(cerere: NextRequest): Promise<Response>;
  ```

- [ ] **Pasul 0:** `grep -n "export function raspunsBinar" src/lib/unelte/raspuns.ts` îl găsește (E5). `grep -n '"fisa-evaluare"' src/lib/unelte/registru.ts` găsește intrarea, iar `grep -n "fisa-evaluare" "src/app/api/unelte/[unealta]/route.test.ts"` găsește două rânduri: testul lui B8 (`format=DOCX`) și testul de cache al lui A5, mutat de E12 (`format=pdf`). Dacă J3 a rulat deja, apare și blocul lui. Acela alege unealta din registru, deci nu se atinge. Uită-te și ce chei mai are `UNELTE`: G și H își pot muta uneltele pe rute statice.

- [ ] **Pasul 1: Scrie testele care pică** — `src/app/(marketing)/unelte/fisa-evaluare/excel.test.ts`:

```ts
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { curataDocument } from "@/lib/unelte/document-tabelar";

import { randeazaXlsxEvaluare } from "./excel";
import { construiesteFisaEvaluare, parametriFisaEvaluare } from "./model";

/**
 * Auditul din 8 oct 2026: Excelul fișei avea ZERO formule, „100” ca text și
 * nimic care să spună că ponderile nu fac 100. Aici se verifică foaia citită
 * înapoi cu exceljs, celulă cu celulă, plus XML-ul pentru validări și
 * formatarea condiționată.
 */
function adresa(randuri: readonly (readonly [string, string, string])[]): URLSearchParams {
  const q = new URLSearchParams({ nume: "Ilie Maria", format: "xlsx" });
  for (const [criteriu, pondere, nota] of randuri) {
    q.append("criteriu", criteriu);
    q.append("pondere", pondere);
    q.append("nota", nota);
  }
  return q;
}

const NOTATA = [
  ["Cunoștințe profesionale", "20", "4"],
  ["Calitatea muncii", "20", "5"],
  ["Respectarea termenelor", "15", "3"],
  ["Comunicare", "15", "4"],
  ["Inițiativă", "15", "3"],
  ["Respectarea procedurilor", "15", "4"],
] as const;

async function foaie(q: URLSearchParams) {
  const p = parametriFisaEvaluare(q);
  const octeti = await randeazaXlsxEvaluare(curataDocument(construiesteFisaEvaluare(p)), p);
  const registru = new ExcelJS.Workbook();
  await registru.xlsx.load(new Uint8Array(octeti).buffer);
  const fila = registru.getWorksheet("Evaluare");
  if (fila === undefined) throw new Error("Fila „Evaluare” lipsește.");
  const zip = await JSZip.loadAsync(octeti);
  const xml = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
  return { fila, xml };
}

/** Rândul a cărui primă celulă e exact textul dat. */
function rand(fila: ExcelJS.Worksheet, text: string): ExcelJS.Row {
  let gasit: ExcelJS.Row | undefined;
  fila.eachRow((r) => {
    if (gasit === undefined && r.getCell(1).value === text) gasit = r;
  });
  if (gasit === undefined) throw new Error(`Rândul „${text}” lipsește.`);
  return gasit;
}

const formula = (celula: ExcelJS.Cell) => (celula.value as ExcelJS.CellFormulaValue).formula;
/** Rezultatul păstrat al formulei; un șir gol se citește înapoi ca lipsă. */
const rezultat = (celula: ExcelJS.Cell) => (celula.value as ExcelJS.CellFormulaValue).result ?? "";

describe("Excelul fișei de evaluare", () => {
  it("ponderile și notele sunt numere, punctajul e formulă cu rezultatul calculat", async () => {
    const { fila } = await foaie(adresa(NOTATA));
    const primul = rand(fila, "Cunoștințe profesionale");
    expect(primul.getCell(2).value).toBe(20);
    expect(primul.getCell(3).value).toBe(4);
    expect(formula(primul.getCell(4))).toMatch(/^IF\(AND\(ISNUMBER\(B\d+\),ISNUMBER\(C\d+\)\)/u);
    expect(rezultat(primul.getCell(4))).toBe(0.8);
  });

  it("totalul e SUM, nota finală SUMPRODUCT, calificativul citește pragurile din celule", async () => {
    const { fila } = await foaie(adresa(NOTATA));
    const total = rand(fila, "Total");
    expect(formula(total.getCell(2))).toMatch(/^SUM\(B\d+:B\d+\)$/u);
    expect(rezultat(total.getCell(2))).toBe(100);
    expect(formula(total.getCell(4))).toContain("SUMPRODUCT(");
    expect(formula(total.getCell(4))).toContain("COUNTA(");
    expect(rezultat(total.getCell(4))).toBe(3.9);
    expect(rezultat(rand(fila, "Nota finală").getCell(2))).toBe(3.9);
    const calificativ = rand(fila, "Calificativ").getCell(2);
    expect(rezultat(calificativ)).toBe("Bine");
    const prag = rand(fila, "Foarte bine, de la");
    expect(prag.getCell(2).value).toBe(4.5);
    expect(formula(calificativ)).toContain(`>=B${String(prag.number)},"Foarte bine"`);
  });

  it("ponderi care nu fac 100: total 90, fără notă finală, controlul spune ce e greșit", async () => {
    const { fila, xml } = await foaie(
      adresa(NOTATA.map((r, i) => (i === 0 ? [r[0], "10", r[2]] : r))),
    );
    const total = rand(fila, "Total");
    expect(rezultat(total.getCell(2))).toBe(90);
    expect(rezultat(total.getCell(4))).toBe("");
    expect(rezultat(total.getCell(5))).toBe("Ponderile trebuie să însumeze 100%.");
    expect(xml).toMatch(
      new RegExp(`<conditionalFormatting sqref="B${String(total.number)}">`, "u"),
    );
    expect(xml).toContain(`$B$${String(total.number)}&lt;&gt;100`);
  });

  it("validări pe tot intervalul: ponderea întreagă 1–100, nota din lista 1–5", async () => {
    const { fila, xml } = await foaie(adresa([...NOTATA, ...NOTATA]));
    const prim = rand(fila, "Cunoștințe profesionale").number;
    const ultim = rand(fila, "Total").number - 1;
    // Câte un interval pe coloană, nesuprapuse: exceljs le-ar fi spart în
    // B10:B20 și B9:B20 dacă validarea s-ar fi pus pe fiecare celulă.
    const intervale = [...xml.matchAll(/<dataValidation type="(\w+)"[^>]*sqref="([^"]+)"/gu)].map(
      (m) => `${m[1] ?? ""} ${m[2] ?? ""}`,
    );
    expect(intervale).toEqual([
      `whole B${String(prim)}:B${String(ultim)}`,
      `list C${String(prim)}:C${String(ultim)}`,
    ]);
    expect(xml).toMatch(/<formula1>1<\/formula1><formula2>100<\/formula2>/u);
    expect(xml).toContain("<formula1>&quot;1,2,3,4,5&quot;</formula1>");
    // Un rând nou scris direct într-un atribut XML devine spațiu la citire (XML
    // 1.0, normalizarea atributelor), deci scala din mesajul de ajutor stă pe un rând.
    expect(xml).toContain('prompt="1 — mult sub cerințele postului; 2 — sub cerințele postului;');
  });

  it("fișa goală, de completat: formulele există, rezultatele sunt goale", async () => {
    const { fila, xml } = await foaie(new URLSearchParams({ format: "xlsx" }));
    expect((xml.match(/<f>/gu) ?? []).length).toBeGreaterThanOrEqual(6 + 4);
    expect(rezultat(rand(fila, "Total").getCell(2))).toBe(100);
    expect(rezultat(rand(fila, "Nota finală").getCell(2))).toBe("");
    expect(rand(fila, "Comentariile angajatului")).toBeDefined();
  });

  it("Excel recalculează la deschidere: `fullCalcOnLoad` rămâne în registru", async () => {
    // Rezultatele păstrate sunt cele de la generare; fără recalculare, o notă
    // schimbată în Excel ar lăsa nota finală veche pe ecran.
    const p = parametriFisaEvaluare(adresa(NOTATA));
    const octeti = await randeazaXlsxEvaluare(curataDocument(construiesteFisaEvaluare(p)), p);
    const zip = await JSZip.loadAsync(octeti);
    const xml = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
    expect(xml).toMatch(/<calcPr[^>]*fullCalcOnLoad="1"/u);
  });

  it("criteriul lung se rupe pe rânduri și rândul e destul de înalt", async () => {
    const lung = `Calitatea relației cu clienții și respectarea termenelor de livrare stabilite prin contract ${"x".repeat(25)}`;
    const { fila } = await foaie(adresa([[lung, "100", "5"]]));
    const r = rand(fila, lung);
    expect(r.getCell(1).alignment.wrapText).toBe(true);
    expect(r.height).toBeGreaterThanOrEqual(45);
  });
});
```

și `src/app/api/unelte/fisa-evaluare/route.test.ts`:

```ts
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { constructorPentru } from "@/lib/unelte/registru";

import { GET } from "./route";

const cere = (q: URLSearchParams) =>
  GET(new NextRequest(`http://localhost/api/unelte/fisa-evaluare?${q.toString()}`));

function adresa(format: string, randuri: readonly (readonly [string, string, string])[]) {
  const q = new URLSearchParams({ nume: "Ilie Maria", format });
  for (const [criteriu, pondere, nota] of randuri) {
    q.append("criteriu", criteriu);
    q.append("pondere", pondere);
    q.append("nota", nota);
  }
  return q;
}

const NOTATA = [
  ["Calitatea muncii", "60", "4"],
  ["Respectarea termenelor", "40", "5"],
] as const;

describe("ruta fișei de evaluare", () => {
  it("Excelul e registrul cu formule, cu numele angajatului în fișier", async () => {
    const r = await cere(adresa("xlsx", NOTATA));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="fisa-evaluare-ilie-maria.xlsx"',
    );
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const xml = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
    expect(xml).toContain("SUMPRODUCT(");
  });

  it("textul din Excel e curățat ca în celelalte formate", async () => {
    const r = await cere(adresa("xlsx", [["Calitatea muncii\u000bși a documentelor", "100", "4"]]));
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const siruri = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    expect(siruri).toContain("Calitatea muncii și a documentelor");
  });

  it("PDF și Word trec prin randarea comună, cu nota finală în tabel", async () => {
    const pdf = await cere(adresa("pdf", NOTATA));
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    const docx = await cere(adresa("docx", NOTATA));
    const zip = await JSZip.loadAsync(await docx.arrayBuffer());
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Total (nota finală)");
    expect(xml).toContain("4,40");
  });

  it("formatul cu majuscule dă formatul cerut (B8), iar Excelul are același cache ca restul", async () => {
    const docx = await cere(adresa("DOCX", NOTATA));
    expect(docx.headers.get("content-type")).toContain("wordprocessingml");
    const xlsx = await cere(adresa("xlsx", NOTATA));
    expect(xlsx.headers.get("cache-control")).toBe(docx.headers.get("cache-control"));
  });

  it("fără format dă PDF, ca înainte", async () => {
    const r = await cere(new URLSearchParams({ nume: "Ilie Maria" }));
    expect(r.headers.get("content-type")).toBe("application/pdf");
  });

  it("fișa nu mai e în registrul rutei comune: ruta statică o servește", () => {
    expect(constructorPentru("fisa-evaluare")).toBeUndefined();
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/excel.test.ts" src/app/api/unelte/fisa-evaluare/route.test.ts
```

Eșecul așteptat: `Failed to resolve import "./excel"` și `Failed to resolve import "./route"`.

- [ ] **Pasul 3: Implementarea minimă** — `src/app/(marketing)/unelte/fisa-evaluare/excel.ts`:

```ts
import ExcelJS from "exceljs";

import { ADRESA_SITE } from "@/content/landing/contact";
import {
  adresaDinFisier,
  SEMNATURA_FISIER,
  type DocumentTabelar,
} from "@/lib/unelte/document-tabelar";

import { SCALA_NOTE } from "./calcul";
import {
  NOTA_LEGALA,
  rezultatFisa,
  TEXT_FORMULA,
  TEXT_SCALA,
  type ParametriFisaEvaluare,
} from "./model";

/**
 * Excelul fișei de evaluare, cu FORMULE.
 *
 * ── DE CE NU REFOLOSEȘTE `randeazaXlsx` ───────────────────────────────────
 * Randarea comună scrie celule de text: pentru o foaie de completat de mână e
 * destul. Auditul din 8 oct 2026 a găsit însă la fișa de evaluare un Excel cu
 * ZERO formule (`grep '<f>'` = 0), „100” salvat ca text și nimic care să
 * spună că ponderile nu fac 100 — adică un tabel Word în alt format. Excelul e
 * locul unde fișa poate face ce nu face hârtia: punctajul pe criteriu, nota
 * finală și calificativul se calculează pe loc, iar o pondere greșită se vede
 * cu roșu. Același lucru face deja foaia de pontaj (`api/unelte/foaie-de-pontaj`).
 *
 * ── TEXTUL DIN DOCUMENT, CIFRELE DIN PARAMETRI ────────────────────────────
 * Textele scrise de om (antetul, criteriile, rubricile) vin din documentul
 * `d`, care a trecut deja prin `curataDocument` în `raspunsDocument`. Cifrele
 * (ponderi, note, praguri) vin din `p`, unde sunt deja numere validate.
 *
 * ── FORMULELE ȘI VALORILE LOR ─────────────────────────────────────────────
 * Fiecare formulă poartă și rezultatul calculat aici, cu aceeași funcție ca
 * PDF-ul: o previzualizare care nu recalculează (telefonul, e-mailul) arată
 * cifra corectă, iar Excel recalculează oricum la deschidere (`fullCalcOnLoad`).
 * `COUNTA` pe coloana criteriilor, nu numărul de rânduri scris în formulă: un
 * rând inserat în interiorul tabelului intră singur în calcul.
 */

const COLOANE = [
  { latime: 46 },
  { latime: 11 },
  { latime: 11 },
  { latime: 11 },
  { latime: 34 },
] as const;

const ROSU_FUNDAL = "FFF6D5D5";
const ROSU_TEXT = "FF9B1C1C";
const GRI_TEXT = "FF6B7280";
const ANTET_FUNDAL = "FFEFF1EE";

const chenar: Partial<ExcelJS.Borders> = {
  top: { style: "hair" },
  left: { style: "hair" },
  bottom: { style: "hair" },
  right: { style: "hair" },
};

/**
 * `Worksheet.dataValidations` există la rulare (`lib/doc/worksheet.js`), dar
 * lipsește din tipurile exceljs 4.4.0.
 */
type FilaCuValidari = ExcelJS.Worksheet & {
  dataValidations: { add(adresa: string, validare: ExcelJS.DataValidation): void };
};

/** Câte rânduri de ~44 de caractere ocupă textul în coloana criteriului. */
const randuriText = (text: string) => Math.max(1, Math.ceil(text.length / 44));

export async function randeazaXlsxEvaluare(
  d: DocumentTabelar,
  p: ParametriFisaEvaluare,
): Promise<Uint8Array> {
  const r = rezultatFisa(p);
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  registru.title = d.titlu;
  registru.calcProperties.fullCalcOnLoad = true;
  const fila = registru.addWorksheet("Evaluare", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  fila.columns = COLOANE.map((c) => ({ width: c.latime }));

  /** Un rând de text pe toată lățimea, rupt pe rânduri. */
  const randLat = (text: string, optiuni: Partial<ExcelJS.Font> = {}) => {
    const rand = fila.addRow([text]);
    fila.mergeCells(rand.number, 1, rand.number, COLOANE.length);
    rand.getCell(1).alignment = { wrapText: true, vertical: "top" };
    rand.getCell(1).font = optiuni;
    rand.height = Math.max(15, Math.ceil(text.length / 110) * 15);
    return rand;
  };

  fila.addRow([d.titlu]).font = { bold: true, size: 13 };
  if (d.subtitlu !== null) fila.addRow([d.subtitlu]);
  for (const c of d.campuri) {
    const rand = fila.addRow([`${c.eticheta}:`, c.valoare === "" ? null : c.valoare]);
    fila.mergeCells(rand.number, 2, rand.number, COLOANE.length);
  }
  fila.addRow([]);

  const antet = fila.addRow(d.coloane.map((c) => c.eticheta));
  antet.font = { bold: true };
  antet.alignment = { wrapText: true, vertical: "middle" };
  antet.eachCell((celula) => {
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ANTET_FUNDAL } };
    celula.border = chenar;
  });
  fila.views = [{ state: "frozen", ySplit: antet.number }];

  const prim = antet.number + 1;
  const ultim = prim + p.grila.length - 1;
  p.grila.forEach((rand, i) => {
    const nr = prim + i;
    // Textul criteriului din document (curățat), cifrele din parametri (validate).
    const criteriu = d.randuri[i]?.[0] ?? rand.criteriu;
    const punctaj = r.punctaje[i] ?? null;
    const randFila = fila.addRow([
      criteriu,
      rand.pondere,
      rand.nota,
      {
        formula: `IF(AND(ISNUMBER(B${String(nr)}),ISNUMBER(C${String(nr)})),B${String(nr)}*C${String(nr)}/100,"")`,
        result: punctaj === null ? "" : punctaj / 100,
      },
      null,
    ]);
    randFila.height = Math.max(26, randuriText(criteriu) * 15);
    randFila.eachCell({ includeEmpty: true }, (celula, coloana) => {
      if (coloana > COLOANE.length) return;
      celula.border = chenar;
      celula.alignment = { wrapText: true, vertical: "top" };
    });
    randFila.getCell(4).numFmt = "0.00";
  });

  // Validările se pun pe INTERVAL, nu pe fiecare celulă: exceljs 4.4.0 sortează
  // adresele ca text („B10” < „B9”) când le strânge în intervale și scrie, de la
  // zece rânduri în sus, două intervale suprapuse (B10:B14 și B9:B14) — o
  // validare pe care Excel n-o poate crea din interfață. Cheia de interval
  // trece neschimbată (`optimiseDataValidations`, ramura `addr.dimensions`).
  const validari = (fila as FilaCuValidari).dataValidations;
  validari.add(`B${String(prim)}:B${String(ultim)}`, {
    type: "whole",
    operator: "between",
    allowBlank: true,
    formulae: [1, 100],
    showErrorMessage: true,
    errorTitle: "Pondere în afara intervalului",
    error: "Ponderea este un număr întreg de la 1 la 100.",
  });
  validari.add(`C${String(prim)}:C${String(ultim)}`, {
    type: "list",
    allowBlank: true,
    formulae: ['"1,2,3,4,5"'],
    showErrorMessage: true,
    errorTitle: "Notă în afara scalei",
    error: "Nota este un număr întreg de la 1 la 5.",
    showInputMessage: true,
    promptTitle: "Nota",
    prompt: SCALA_NOTE.map((x) => `${String(x.nota)} — ${x.descriere}`).join("; "),
  });

  const B = `B${String(prim)}:B${String(ultim)}`;
  const C = `C${String(prim)}:C${String(ultim)}`;
  const A = `A${String(prim)}:A${String(ultim)}`;
  const totalRand = fila.addRow([
    "Total",
    { formula: `SUM(${B})`, result: r.sumaPonderi },
    null,
    {
      formula: `IF(AND(B${String(ultim + 1)}=100,COUNT(${B})=COUNTA(${A}),COUNT(${C})=COUNTA(${A})),SUMPRODUCT(${B},${C})/100,"")`,
      result: r.notaFinala === null ? "" : r.notaFinala / 100,
    },
    {
      formula: `IF(B${String(ultim + 1)}=100,"","Ponderile trebuie să însumeze 100%.")`,
      result: r.sumaPonderi === 100 ? "" : "Ponderile trebuie să însumeze 100%.",
    },
  ]);
  const t = totalRand.number;
  totalRand.font = { bold: true };
  totalRand.eachCell({ includeEmpty: true }, (celula, coloana) => {
    if (coloana <= COLOANE.length) celula.border = chenar;
  });
  totalRand.getCell(4).numFmt = "0.00";
  totalRand.getCell(5).font = { bold: true, color: { argb: ROSU_TEXT } };
  // Roșu cât timp ponderile nu fac 100: se vede fără să citești formula.
  fila.addConditionalFormatting({
    ref: `B${String(t)}`,
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: [`$B$${String(t)}<>100`],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: ROSU_FUNDAL } },
          font: { color: { argb: ROSU_TEXT }, bold: true },
        },
      },
    ],
  });

  fila.addRow([]);
  const notaRand = fila.addRow([
    "Nota finală",
    { formula: `D${String(t)}`, result: r.notaFinala === null ? "" : r.notaFinala / 100 },
  ]);
  notaRand.font = { bold: true };
  notaRand.getCell(2).numFmt = "0.00";
  const califRand = fila.addRow(["Calificativ"]);
  califRand.font = { bold: true };
  fila.addRow([]);
  // Pragurile stau în foaie, în celule: le schimbi, calificativul se schimbă.
  fila.addRow(["Pragurile calificativelor (se pot schimba)"]).font = { bold: true };
  const randPrag = (eticheta: string, sutimi: number) => {
    const rand = fila.addRow([eticheta, sutimi / 100]);
    rand.getCell(2).numFmt = "0.00";
    rand.getCell(2).border = chenar;
    return `B${String(rand.number)}`;
  };
  const fb = randPrag("Foarte bine, de la", p.praguri.foarteBine);
  const b = randPrag("Bine, de la", p.praguri.bine);
  const s = randPrag("Satisfăcător, de la", p.praguri.satisfacator);
  fila.addRow(["Sub pragul pentru Satisfăcător: Nesatisfăcător."]);
  const nf = `B${String(notaRand.number)}`;
  califRand.getCell(2).value = {
    formula: `IF(${nf}="","",IF(${nf}>=${fb},"Foarte bine",IF(${nf}>=${b},"Bine",IF(${nf}>=${s},"Satisfăcător","Nesatisfăcător"))))`,
    result: r.calificativ ?? "",
  };

  fila.addRow([]);
  randLat(TEXT_SCALA, { color: { argb: GRI_TEXT } });
  randLat(TEXT_FORMULA, { color: { argb: GRI_TEXT } });
  randLat(NOTA_LEGALA, { color: { argb: GRI_TEXT } });
  randLat(
    "Un criteriu nou: inserează un rând în interiorul tabelului, iar formulele de total îl cuprind singure.",
    { color: { argb: GRI_TEXT }, italic: true },
  );

  for (const rubrica of d.rubrici ?? []) {
    fila.addRow([]);
    fila.addRow([rubrica.titlu]).font = { bold: true };
    const paragrafe = rubrica.text.split("\n").filter((x) => x.trim() !== "");
    for (const x of paragrafe) randLat(x);
    const goale = paragrafe.length > 0 ? 1 : rubrica.randuriGoale;
    for (let k = 0; k < goale; k += 1) {
      const rand = fila.addRow([]);
      rand.height = 20;
      for (let c = 1; c <= COLOANE.length; c += 1)
        rand.getCell(c).border = { bottom: { style: "hair" } };
    }
  }

  fila.addRow([]);
  // Trei semnături pe coloanele A, B–D și E, cu numele, semnătura și data.
  const pozitii = [1, 2, 5] as const;
  const randuriSemnatura = [
    d.semnaturi,
    d.semnaturi.map(() => "Semnătura: ______________"),
    d.semnaturi.map(() => "Data: ______________"),
  ];
  for (const valori of randuriSemnatura) {
    const rand = fila.addRow([]);
    valori.forEach((v, i) => {
      const coloana = pozitii[i];
      if (coloana !== undefined) rand.getCell(coloana).value = v;
    });
    fila.mergeCells(rand.number, 2, rand.number, 4);
    rand.height = 22;
  }

  fila.addRow([]);
  const semnatura = fila.addRow([
    { text: SEMNATURA_FISIER, hyperlink: adresaDinFisier(d, "xlsx", ADRESA_SITE) },
  ]);
  semnatura.getCell(1).font = { color: { argb: GRI_TEXT }, underline: true };

  return new Uint8Array(await registru.xlsx.writeBuffer());
}
```

`src/app/api/unelte/fisa-evaluare/route.ts`:

```ts
import type { NextRequest } from "next/server";

import { randeazaXlsxEvaluare } from "@/app/(marketing)/unelte/fisa-evaluare/excel";
import {
  construiesteFisaEvaluare,
  parametriFisaEvaluare,
} from "@/app/(marketing)/unelte/fisa-evaluare/model";
import { curataDocument, normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { raspunsBinar, raspunsDocument } from "@/lib/unelte/raspuns";

/**
 * Descărcarea fișei de evaluare: `/api/unelte/fisa-evaluare?format=pdf|docx|xlsx&…`.
 *
 * Rută statică, ca foaia de pontaj și condica: are prioritate față de
 * `[unealta]`, iar Excelul ei e un registru cu FORMULE (`excel.ts`), nu foaia
 * de text a randării comune. PDF-ul și Word-ul trec în continuare prin
 * `raspunsDocument`, deci prin aceeași curățare a textului ca restul uneltelor.
 *
 * Fără sesiune și fără bază: intrările sunt parametri normalizați cu limite
 * (`model.ts`: 15 criterii, 120 de caractere, rubrici de 500), iar generarea e
 * mărginită prin construcție. `src/proxy.ts` lasă `/api/` să treacă neatins.
 */
export const dynamic = "force-dynamic";

export async function GET(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  const parametri = parametriFisaEvaluare(q);
  const document = { ...construiesteFisaEvaluare(parametri), sursa: "/unelte/fisa-evaluare" };
  const format = normalizeazaFormat(q.get("format"));
  if (format !== "xlsx") return raspunsDocument(document, format);
  // Textul din document trece prin aceeași curățare ca în `raspunsDocument`;
  // cifrele vin din parametri, deja validate.
  const curat = curataDocument(document);
  return raspunsBinar(await randeazaXlsxEvaluare(curat, parametri), "xlsx", curat.numeFisier);
}
```

`src/lib/unelte/registru.ts`: șterge linia

```ts
import { fisaEvaluareDinParametri } from "@/app/(marketing)/unelte/fisa-evaluare/model";
```

și intrarea

```ts
  "fisa-evaluare": fisaEvaluareDinParametri,
```

În comentariul de deasupra lui `UNELTE` (îl schimbă E12 și F12), adaugă fișa de evaluare la uneltele cu rută statică: „… și fișa de evaluare (Excel pe formule, `src/app/api/unelte/fisa-evaluare/route.ts`)”.

`src/app/api/unelte/[unealta]/route.test.ts`, testul adăugat de B8. Vechi:

```ts
  it("formatul cu majuscule dă formatul cerut, nu PDF", async () => {
    const r = await cere("/api/unelte/fisa-evaluare?format=DOCX", "fisa-evaluare");
    expect(r.headers.get("content-type")).toContain("wordprocessingml");
  });
```

Nou:

```ts
  it("formatul cu majuscule dă formatul cerut, nu PDF", async () => {
    // Fișa de evaluare are rută statică (secțiunea I) și propriul test de format;
    // aici proba rămâne pe o unealtă servită de ruta comună.
    const r = await cere("/api/unelte/fisa-instruire-ssm?format=DOCX", "fisa-instruire-ssm");
    expect(r.headers.get("content-type")).toContain("wordprocessingml");
  });
```

În același fișier, testul de cache al lui A5, în forma lăsată de E12. Vechi:

```ts
    // Condica are rută statică din E12; ruta comună se verifică pe o unealtă din `UNELTE`.
    const r = await cere("/api/unelte/fisa-evaluare?format=pdf", "fisa-evaluare");
```

Nou:

```ts
    // Condica (E12) și fișa de evaluare (I7) au rute statice; ruta comună se
    // verifică pe o unealtă rămasă în `UNELTE`.
    const r = await cere("/api/unelte/fisa-instruire-ssm?format=pdf", "fisa-instruire-ssm");
```

Restul testului (`expect(r.status).toBe(200)` și antetul `private, no-store`) rămâne. La verificarea planului, pe o copie cu fișa scoasă din registru, `fisa-instruire-ssm?format=pdf` a dat 200 pe ruta comună, `?format=DOCX` a dat Word, iar `fisa-evaluare?format=pdf` a dat 404.

Pentru ambele teste: dacă H a scos și fișa SSM din `UNELTE`, folosește prima cheie rămasă în `UNELTE` (`grep -n '^  "' src/lib/unelte/registru.ts`). Dacă nu mai rămâne niciuna, șterge testul B8: formatul fără majuscule e păzit pe ruta fișei („formatul cu majuscule dă formatul cerut (B8)…”) și în `randari.test.ts` (B8). Testul de cache îl ștergi atunci doar dacă `randari.test.ts` (A5) mai verifică antetul `private, no-store` pe `raspunsDocument`. Altfel îl muți pe `src/app/api/unelte/fisa-evaluare/route.test.ts`.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/" src/app/api/unelte/ src/lib/unelte/
```

Trebuie: `excel.test.ts` cu 7 teste trecute, `route.test.ts` (fișa) cu 6, `registru.test.ts` și `[unealta]/route.test.ts` verzi. Apoi lanțul complet. `randari.test.ts` are paza lui A5, „nicio rută de unealtă nu mai declară cache public”, care citește și ruta nouă: ruta nu scrie niciun antet, le pune `raspunsBinar`/`raspunsDocument`.

- [ ] **Pasul 5: Fișierul descărcat, cap-coadă.** Pornește serverul local ca la I9, Pasul 5, apoi:

```bash
cd "$SCRATCH"
curl -sf "http://127.0.0.1:3917/api/unelte/fisa-evaluare?format=xlsx&nume=Ilie%20Maria&criteriu=Calitatea%20muncii&pondere=60&nota=4&criteriu=Termene&pondere=40&nota=5" -o i7.xlsx
unzip -p i7.xlsx xl/worksheets/sheet1.xml | grep -o "<f>[^<]*" | head -8
unzip -p i7.xlsx xl/worksheets/sheet1.xml | grep -o '<dataValidation type="[a-z]*"[^>]*sqref="[^"]*"'
python3 -I -c "import zipfile,sys,xml.dom.minidom as m; z=zipfile.ZipFile(sys.argv[1]); [m.parseString(z.read(n)) for n in z.namelist() if n.endswith(('.xml','.rels'))]; print('XML valid')" i7.xlsx
```

Trebuie să vezi:
- `IF(AND(ISNUMBER(B9)…`, `SUM(B9:B10)`, `…SUMPRODUCT(B9:B10,C9:C10)/100…`, controlul `IF(B11=100,&quot;&quot;,&quot;Ponderile trebuie să însumeze 100%.&quot;)`, `D11`, apoi formula calificativului cu `&gt;=B17`, `&gt;=B18`, `&gt;=B19`. XML-ul brut are `&gt;` și `&quot;`, nu `>` și `"`. Cu 2 criterii și fără firmă: antetul pe rândul 8, criteriile pe 9–10, totalul pe 11, nota finală pe 13, pragurile pe 17–19. Ieșirea a fost reprodusă la verificarea planului, cu aceeași adresă trimisă direct lui `GET`;
- exact două validări nesuprapuse: `whole … sqref="B9:B10"` și `list … prompt="1 — mult sub cerințele postului; 2 — …" … sqref="C9:C10"`. Scala stă pe un singur rând, despărțită prin „; ”. Un `\n` scris direct în atribut rupea linia la `grep` și devenea oricum spațiu la citirea XML-ului (normalizarea atributelor din XML 1.0);
- `<calcPr … fullCalcOnLoad="1"/>` în `xl/workbook.xml` (`unzip -p i7.xlsx xl/workbook.xml | grep -o '<calcPr[^>]*>'`);
- `XML valid`.

- [ ] **Commit** — `CAI=("src/app/(marketing)/unelte/fisa-evaluare/excel.ts" "src/app/(marketing)/unelte/fisa-evaluare/excel.test.ts" src/app/api/unelte/fisa-evaluare/route.ts src/app/api/unelte/fisa-evaluare/route.test.ts src/lib/unelte/registru.ts "src/app/api/unelte/[unealta]/route.test.ts"); NOI=("src/app/(marketing)/unelte/fisa-evaluare/excel.ts" "src/app/(marketing)/unelte/fisa-evaluare/excel.test.ts" src/app/api/unelte/fisa-evaluare/route.ts src/app/api/unelte/fisa-evaluare/route.test.ts)`. Mesaj:

```text
feat(unelte): fișa de evaluare în Excel cu formule — notă finală, calificativ, control 100%

Punctaj pe criteriu, SUM pe ponderi, SUMPRODUCT/100 pentru nota finală,
calificativul din pragurile foii, roșu când ponderile nu fac 100, validări
1–100 și 1–5 pe interval (exceljs 4.4.0 suprapunea intervalele de la zece
rânduri). Rută statică, ca foaia de pontaj și condica; fișa iese din UNELTE.
Auditul din 8 oct 2026: Excelul avea 0 formule și „100” ca text.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task I8: Grila din browser — pondere, notă și calcul pe loc

**Fișiere:**
- Create: `src/app/(marketing)/unelte/fisa-evaluare/grila-evaluare.tsx`
- Test: `src/app/(marketing)/unelte/fisa-evaluare/grila-evaluare.test.tsx` (Create; proiectul `ui`, happy-dom)

**Interfețe:**
- Consumă:
  - din `./calcul`: `avizePonderi`, `calculeazaGrila`, `citesteNota`, `citestePondere`, `citestePraguri`, `formateazaSutimi`, `MAX_CRITERII`, `MAX_CRITERIU`, `ponderiEgale`, `SCALA_NOTE` și `type Praguri`;
  - din `./model`: `type RandGrila`, ca import de tip, deci nu trage `@/lib/format/date` în pachetul clientului;
  - din `./seturi`: `SETURI`, `setDupaCheie` și `type CheieSet`;
  - din `react`: `useId`, `useRef` și `useState`;
  - în test: `@testing-library/react` (`render`, `screen`), `@testing-library/user-event` (`userEvent`), ca în `src/app/(app)/pontaj/setari/coduri-qr/buton-cod.test.tsx`;
  - clasa de culoare `text-mk-refuz` (`globals.css:576`, folosită la `cere-demo/formular-demo.tsx:62`).
- Produce:
  ```tsx
  export function GrilaEvaluare(props: Readonly<{ grila: readonly RandGrila[]; set: CheieSet; praguri: Praguri }>): JSX.Element;
  // câmpuri în formular: set, incarca (buton), criteriu/pondere/nota (repetate), prag_fb, prag_b, prag_s
  // marcaj: [data-rezultat-grila] cu role="status"
  ```

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(marketing)/unelte/fisa-evaluare/grila-evaluare.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRAGURI_IMPLICITE } from "./calcul";
import { GrilaEvaluare } from "./grila-evaluare";
import { setDupaCheie } from "./seturi";

/**
 * Grila e partea fișei care calculează pe loc. Ce trimite ea în formular e ce
 * citește `parametriFisaEvaluare`: aceleași nume, în aceeași ordine, deci
 * fișierul descărcat are exact cifrele de pe ecran.
 */
const GRILA = [
  { criteriu: "Cunoștințe profesionale", pondere: 20, nota: null },
  { criteriu: "Calitatea muncii", pondere: 20, nota: null },
  { criteriu: "Respectarea termenelor", pondere: 15, nota: null },
  { criteriu: "Comunicare", pondere: 15, nota: null },
  { criteriu: "Inițiativă", pondere: 15, nota: null },
  { criteriu: "Respectarea procedurilor", pondere: 15, nota: null },
] as const;

function randeaza(
  grila: readonly { criteriu: string; pondere: number | null; nota: number | null }[] = GRILA,
) {
  const { container } = render(
    <form>
      <GrilaEvaluare grila={grila} set="general" praguri={PRAGURI_IMPLICITE} />
    </form>,
  );
  const form = container.querySelector("form");
  if (form === null) throw new Error("Formularul lipsește.");
  return { form, stare: () => screen.getByRole("status").textContent ?? "" };
}

const campuri = (nume: string) => [
  ...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[name="${nume}"]`),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("grila fișei de evaluare", () => {
  it("trimite criteriul, ponderea și nota pe fiecare rând, aliniate", () => {
    const { form } = randeaza();
    const date = new FormData(form);
    expect(date.getAll("criteriu")).toEqual(GRILA.map((r) => r.criteriu));
    expect(date.getAll("pondere")).toEqual(["20", "20", "15", "15", "15", "15"]);
    expect(date.getAll("nota")).toEqual(["", "", "", "", "", ""]);
    expect(date.get("set")).toBe("general");
    expect(date.get("prag_fb")).toBe("4,50");
  });

  it("notele completate dau nota finală și calificativul pe loc", async () => {
    const { stare } = randeaza();
    expect(stare()).toContain("Total ponderi: 100%");
    expect(stare()).toContain(
      "Nota finală se calculează când fiecare criteriu are pondere și notă.",
    );
    const note = ["4", "5", "3", "4", "3", "4"];
    for (const [i, select] of campuri("nota").entries()) {
      await userEvent.selectOptions(select as HTMLSelectElement, note[i] ?? "");
    }
    expect(stare()).toContain("Nota finală: 3,90 — Bine");
  });

  it("ponderile care nu fac 100 se spun imediat", async () => {
    const { stare } = randeaza();
    const prima = campuri("pondere")[0] as HTMLInputElement;
    await userEvent.clear(prima);
    await userEvent.type(prima, "10");
    expect(stare()).toContain("Total ponderi: 90%");
    expect(stare()).toContain("Ponderile însumează 90%, nu 100%: nota finală nu se poate calcula.");
  });

  it("„Împarte ponderile egal” dă 100 pe criteriile scrise", async () => {
    randeaza(GRILA.map((r) => ({ ...r, pondere: null })));
    await userEvent.click(screen.getByRole("button", { name: "Împarte ponderile egal" }));
    expect(campuri("pondere").map((c) => c.value)).toEqual(["17", "17", "17", "17", "16", "16"]);
  });

  it("adaugă și șterge rânduri, cel mult 15", async () => {
    randeaza([{ criteriu: "Unu", pondere: 100, nota: null }]);
    const sterge = screen.getByRole("button", { name: "Șterge criteriul 1" });
    expect(sterge).toHaveProperty("disabled", true);
    const adauga = screen.getByRole("button", { name: "Adaugă un criteriu" });
    for (let i = 0; i < 20; i += 1) await userEvent.click(adauga);
    expect(campuri("criteriu")).toHaveLength(15);
    expect(adauga).toHaveProperty("disabled", true);
    await userEvent.click(screen.getByRole("button", { name: "Șterge criteriul 2" }));
    expect(campuri("criteriu")).toHaveLength(14);
  });

  it("un rând fără criteriu nu intră în calcul", async () => {
    const { stare } = randeaza([{ criteriu: "Unu", pondere: 100, nota: 4 }]);
    await userEvent.click(screen.getByRole("button", { name: "Adaugă un criteriu" }));
    expect(stare()).toContain("Nota finală: 4,00 — Bine");
  });

  it("alt set înlocuiește rândurile, după confirmare dacă era ceva scris", async () => {
    // happy-dom nu are `window.confirm`; îl punem noi, ca browserul.
    const confirmare = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmare);
    randeaza(GRILA.map((r) => ({ ...r, nota: 3 })));
    await userEvent.selectOptions(screen.getByLabelText("Set de criterii, după post"), "productie");
    expect(confirmare).toHaveBeenCalledOnce();
    expect(campuri("criteriu")[0]?.value).toBe("Cunoștințe profesionale");

    confirmare.mockReturnValue(true);
    await userEvent.selectOptions(screen.getByLabelText("Set de criterii, după post"), "productie");
    expect(campuri("criteriu").map((c) => c.value)).toEqual(
      setDupaCheie("productie").criterii.map((c) => c.criteriu),
    );
    expect(campuri("nota").every((c) => c.value === "")).toBe(true);
  });

  it("setul neatins se schimbă fără întrebare", async () => {
    const confirmare = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmare);
    randeaza(setDupaCheie("general").criterii.map((c) => ({ ...c, nota: null })));
    await userEvent.selectOptions(screen.getByLabelText("Set de criterii, după post"), "vanzari");
    expect(confirmare).not.toHaveBeenCalled();
    expect(campuri("criteriu")[0]?.value).toBe(setDupaCheie("vanzari").criterii[0]?.criteriu);
  });

  it("„Încarcă setul” cere confirmare când s-ar pierde ceva scris", async () => {
    const confirmare = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmare);
    const { form } = randeaza(GRILA.map((r) => ({ ...r, nota: 3 })));
    const trimiteri = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", trimiteri);
    const incarca = screen.getByRole("button", { name: "Încarcă setul" });
    await userEvent.click(incarca);
    expect(confirmare).toHaveBeenCalledOnce();
    expect(trimiteri).not.toHaveBeenCalled();

    confirmare.mockReturnValue(true);
    await userEvent.click(incarca);
    expect(trimiteri).toHaveBeenCalledOnce();
  });

  it("„Încarcă setul” pe setul neatins trimite fără întrebare", async () => {
    const confirmare = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmare);
    const { form } = randeaza(setDupaCheie("general").criterii.map((c) => ({ ...c, nota: null })));
    const trimiteri = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", trimiteri);
    await userEvent.click(screen.getByRole("button", { name: "Încarcă setul" }));
    expect(confirmare).not.toHaveBeenCalled();
    expect(trimiteri).toHaveBeenCalledOnce();
  });

  it("pragurile greșite se spun, iar calculul folosește implicitele", async () => {
    const { stare } = randeaza(GRILA.map((r) => ({ ...r, nota: 4 })));
    const fb = campuri("prag_fb")[0] as HTMLInputElement;
    await userEvent.clear(fb);
    await userEvent.type(fb, "2");
    expect(stare()).toContain("Pragurile trebuie să scadă");
    expect(stare()).toContain("Nota finală: 4,00 — Bine");
    // Avizul se vede și lângă praguri, chiar cu `<details>` închis.
    expect(document.querySelector("details > summary")?.textContent).toContain(
      "greșite, se folosesc cele implicite",
    );
  });
});
```

happy-dom nu are `window.confirm`, iar `vi.spyOn(window, "confirm")` aruncă „can only spy on a function”, de aceea testul folosește `vi.stubGlobal`.

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/grila-evaluare.test.tsx"
```

Eșecul așteptat: `Failed to resolve import "./grila-evaluare"`.

- [ ] **Pasul 3: Implementarea minimă** — `src/app/(marketing)/unelte/fisa-evaluare/grila-evaluare.tsx`:

```tsx
"use client";

import { useId, useRef, useState } from "react";

import {
  avizePonderi,
  calculeazaGrila,
  citesteNota,
  citestePondere,
  citestePraguri,
  formateazaSutimi,
  MAX_CRITERII,
  MAX_CRITERIU,
  ponderiEgale,
  SCALA_NOTE,
  type Praguri,
} from "./calcul";
import type { RandGrila } from "./model";
import { SETURI, setDupaCheie, type CheieSet } from "./seturi";

/**
 * Grila fișei de evaluare: criteriu, pondere și notă pe fiecare rând, cu nota
 * finală și calificativul calculate pe loc.
 *
 * ── ÎN FORMULAR, NU ÎN LOCUL LUI ──────────────────────────────────────────
 * Câmpurile poartă numele pe care le citește `parametriFisaEvaluare`
 * (`criteriu`, `pondere`, `nota`, câte unul pe rând; `set`; `prag_*`), deci
 * „Completează fișa” și butoanele de descărcare trimit exact ce se vede aici.
 * Componenta nu rescrie adresa (poarta GA din `pornire-ga.tsx` se decide la
 * încărcare) și nu trimite nimic singură.
 *
 * Fără JavaScript, serverul randează aceleași rânduri; adăugarea, ștergerea și
 * împărțirea egală cer JavaScript, iar setul se încarcă prin „Încarcă setul”,
 * un buton de trimitere obișnuit.
 */

type RandEditabil = Readonly<{ cheie: number; criteriu: string; pondere: string; nota: string }>;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_BUTON =
  "border-mk-rigla hover:border-mk-text inline-flex h-11 items-center justify-center rounded border px-4 text-[0.9375rem] disabled:opacity-40";

const INTREBARE_SET = "Înlocuiești criteriile scrise cu setul ales? Ponderile și notele se pierd.";

const editabile = (grila: readonly RandGrila[]): RandEditabil[] =>
  grila.map((r, i) => ({
    cheie: i,
    criteriu: r.criteriu,
    pondere: r.pondere === null ? "" : String(r.pondere),
    nota: r.nota === null ? "" : String(r.nota),
  }));

const dinSet = (cheie: CheieSet): RandEditabil[] =>
  setDupaCheie(cheie).criterii.map((c, i) => ({
    cheie: i,
    criteriu: c.criteriu,
    pondere: String(c.pondere),
    nota: "",
  }));

export function GrilaEvaluare({
  grila,
  set: setInitial,
  praguri,
}: Readonly<{ grila: readonly RandGrila[]; set: CheieSet; praguri: Praguri }>) {
  const id = useId();
  const [set, setSet] = useState<CheieSet>(setInitial);
  const [randuri, setRanduri] = useState<RandEditabil[]>(() => editabile(grila));
  const [prag, setPrag] = useState({
    fb: formateazaSutimi(praguri.foarteBine),
    b: formateazaSutimi(praguri.bine),
    s: formateazaSutimi(praguri.satisfacator),
  });
  // Cheile rândurilor noi continuă după cele de pe server: aceleași la hidratare.
  const urmatoarea = useRef(grila.length);

  const completate = randuri.filter((r) => r.criteriu.trim() !== "");
  const praguriCitite = citestePraguri(prag.fb, prag.b, prag.s);
  const rezultat = calculeazaGrila(
    completate.map((r) => ({ pondere: citestePondere(r.pondere), nota: citesteNota(r.nota) })),
    praguriCitite.praguri,
  );
  const avize = [
    ...avizePonderi(rezultat),
    ...(praguriCitite.corectate
      ? [
          "Pragurile trebuie să scadă de la Foarte bine la Satisfăcător; se folosesc cele implicite.",
        ]
      : []),
  ];

  const schimba = (cheie: number, camp: "criteriu" | "pondere" | "nota", valoare: string) => {
    setRanduri((vechi) => vechi.map((r) => (r.cheie === cheie ? { ...r, [camp]: valoare } : r)));
  };

  /** Rândurile nu mai sunt setul curent, neatins: încărcarea altuia ar pierde ce a scris omul. */
  const eScris = () =>
    JSON.stringify(randuri.map((r) => [r.criteriu, r.pondere, r.nota])) !==
    JSON.stringify(dinSet(set).map((r) => [r.criteriu, r.pondere, r.nota]));

  const alegeSet = (cheie: CheieSet) => {
    if (eScris() && !window.confirm(INTREBARE_SET)) return;
    setSet(cheie);
    setRanduri(dinSet(cheie).map((r) => ({ ...r, cheie: urmatoarea.current + r.cheie })));
    urmatoarea.current += MAX_CRITERII;
  };

  const adauga = () => {
    const cheie = urmatoarea.current;
    urmatoarea.current += 1;
    setRanduri((vechi) => [...vechi, { cheie, criteriu: "", pondere: "", nota: "" }]);
  };

  const imparteEgal = () => {
    // Totul în funcția de actualizare: React o poate chema de două ori (StrictMode),
    // iar un contor ținut în afara ei ar continua de unde a rămas.
    setRanduri((vechi) => {
      const ponderi = ponderiEgale(vechi.filter((r) => r.criteriu.trim() !== "").length);
      let k = 0;
      return vechi.map((r) => {
        if (r.criteriu.trim() === "") return r;
        const pondere = ponderi[k] ?? 0;
        k += 1;
        return { ...r, pondere: String(pondere) };
      });
    });
  };

  return (
    <fieldset className="flex flex-col gap-4 sm:col-span-2 lg:col-span-3">
      <legend className="text-[0.875rem] font-medium">Criteriile, ponderea și nota</legend>

      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={`${id}-set`} className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
          <span className="text-mk-text-slab text-[0.8125rem]">Set de criterii, după post</span>
          <select
            id={`${id}-set`}
            name="set"
            value={set}
            onChange={(e) => alegeSet(setDupaCheie(e.target.value).cheie)}
            className={CLASA_CAMP}
          >
            {SETURI.map((s) => (
              <option key={s.cheie} value={s.cheie}>
                {s.eticheta}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          name="incarca"
          value="set"
          onClick={(e) => {
            // Fără JavaScript, serverul încarcă setul direct. Cu JavaScript întrebăm
            // întâi, ca la schimbarea din listă, dacă s-ar pierde ceva scris.
            if (eScris() && !window.confirm(INTREBARE_SET)) e.preventDefault();
          }}
          className={CLASA_BUTON}
        >
          Încarcă setul
        </button>
      </div>

      <ol className="flex flex-col gap-3">
        {randuri.map((r, i) => (
          <li
            key={r.cheie}
            className="border-mk-rigla/40 flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-end"
          >
            <label className="flex min-w-0 flex-col gap-1 sm:flex-1">
              <span className="text-mk-text-slab text-[0.8125rem]">Criteriul {String(i + 1)}</span>
              <input
                type="text"
                name="criteriu"
                maxLength={MAX_CRITERIU}
                value={r.criteriu}
                onChange={(e) => schimba(r.cheie, "criteriu", e.target.value)}
                className={CLASA_CAMP}
              />
            </label>
            <div className="flex items-end gap-2">
              <label className="flex w-24 flex-col gap-1">
                <span className="text-mk-text-slab text-[0.8125rem]">Pondere (%)</span>
                <input
                  type="text"
                  name="pondere"
                  inputMode="numeric"
                  maxLength={4}
                  value={r.pondere}
                  onChange={(e) => schimba(r.cheie, "pondere", e.target.value)}
                  className={CLASA_CAMP}
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:w-56 sm:flex-none">
                <span className="text-mk-text-slab text-[0.8125rem]">Nota</span>
                <select
                  name="nota"
                  value={r.nota}
                  onChange={(e) => schimba(r.cheie, "nota", e.target.value)}
                  className={CLASA_CAMP}
                >
                  <option value="">— de completat</option>
                  {SCALA_NOTE.map((s) => (
                    <option key={s.nota} value={String(s.nota)}>
                      {`${String(s.nota)} — ${s.descriere}`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setRanduri((vechi) => vechi.filter((x) => x.cheie !== r.cheie))}
                disabled={randuri.length <= 1}
                aria-label={`Șterge criteriul ${String(i + 1)}`}
                className={CLASA_BUTON}
              >
                Șterge
              </button>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={adauga}
          disabled={randuri.length >= MAX_CRITERII}
          className={CLASA_BUTON}
        >
          Adaugă un criteriu
        </button>
        <button
          type="button"
          onClick={imparteEgal}
          disabled={completate.length === 0}
          className={CLASA_BUTON}
        >
          Împarte ponderile egal
        </button>
      </div>

      <div role="status" aria-live="polite" className="text-[0.9375rem]" data-rezultat-grila="">
        <p>
          Total ponderi: <strong>{String(rezultat.sumaPonderi)}%</strong>
          {rezultat.notaFinala !== null && rezultat.calificativ !== null ? (
            <>
              {" · "}Nota finală: <strong>{formateazaSutimi(rezultat.notaFinala)}</strong> —{" "}
              <strong>{rezultat.calificativ}</strong>
            </>
          ) : (
            " · Nota finală se calculează când fiecare criteriu are pondere și notă."
          )}
        </p>
        {avize.map((a) => (
          <p key={a} className="text-mk-refuz mt-1 font-medium">
            {a}
          </p>
        ))}
      </div>

      <details className="text-[0.9375rem]">
        <summary className="cursor-pointer">
          Pragurile calificativelor
          {praguriCitite.corectate ? (
            <span className="text-mk-refuz font-medium">
              {" "}
              — greșite, se folosesc cele implicite
            </span>
          ) : null}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["fb", "prag_fb", "Foarte bine, de la"],
              ["b", "prag_b", "Bine, de la"],
              ["s", "prag_s", "Satisfăcător, de la"],
            ] as const
          ).map(([cheie, nume, eticheta]) => (
            <label key={nume} className="flex flex-col gap-1">
              <span className="text-mk-text-slab text-[0.8125rem]">{eticheta}</span>
              <input
                type="text"
                name={nume}
                inputMode="decimal"
                maxLength={4}
                value={prag[cheie]}
                onChange={(e) => setPrag((v) => ({ ...v, [cheie]: e.target.value }))}
                className={CLASA_CAMP}
              />
            </label>
          ))}
        </div>
        <p className="text-mk-text-slab mt-2 text-[0.8125rem]">
          Sub pragul pentru Satisfăcător, calificativul e Nesatisfăcător. Pragurile nu sunt din
          lege: le stabilește regulamentul intern.
        </p>
      </details>
    </fieldset>
  );
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/" "src/app/(marketing)/_componente/adresa-analitice.test.ts"
```

Trebuie: `grila-evaluare.test.tsx` cu 11 teste trecute. Două sunt adăugate la verificarea planului: „Încarcă setul” cere confirmare când s-ar pierde ceva scris, iar pe setul neatins trimite fără întrebare. Testul pragurilor greșite cere în plus avizul în `<summary>`, vizibil și cu `<details>` închis. Primul și al treilea au fost văzuți întâi picând pe grila fără `onClick` și fără avizul din `<summary>`. Paza lui A2 din `adresa-analitice.test.ts` rămâne verde:
- `name="criteriu|pondere|nota|set|incarca"` nu sunt parametri păstrați;
- componenta nu folosește `next/form`, `useRouter(` sau `history.*State`.

Apoi lanțul complet.

- [ ] **Commit** — `CAI=("src/app/(marketing)/unelte/fisa-evaluare/grila-evaluare.tsx" "src/app/(marketing)/unelte/fisa-evaluare/grila-evaluare.test.tsx"); NOI=("${CAI[@]}")`. Mesaj:

```text
feat(unelte): grila fișei de evaluare — pondere și notă pe fiecare rând, calcul pe loc

Total ponderi, aviz când nu fac 100, notă finală și calificativ calculate în
browser, rânduri adăugate și șterse (cel mult 15), ponderi împărțite egal,
set schimbat cu confirmare. Câmpurile sunt cele pe care le citește modelul,
deci descărcarea are exact cifrele de pe ecran.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task I9: Pagina — formularul nou, legea cu temei, SEO

**Fișiere:**
- Create: `src/app/(marketing)/unelte/fisa-evaluare/lege.ts`
- Modify (rescris): `src/app/(marketing)/unelte/fisa-evaluare/page.tsx`. Pornește de la forma lăsată de B6: banda formularului cu `data-tipar="ascunde"` pe `Banda`, păstrată mai jos. Noul conținut e întreg.
- Modify: `src/content/landing/unelte.ts` (`ANTET_FISA_EVALUARE.lead`), `src/app/(marketing)/unelte/page.tsx` (nota din hub), `src/app/llms.txt/route.ts` (rândul fișei), `src/content/landing/harta.ts` (`actualizat` pe `/unelte/fisa-evaluare` și `/unelte`), `NOTES.md` (§3, ⚠ jurist)
- Test: `src/app/(marketing)/unelte/fisa-evaluare/pagina.test.tsx` (Create)

**Interfețe:**
- Consumă:
  - `GrilaEvaluare` (I8);
  - `construiesteFisaEvaluare`, `parametriFisaEvaluare` și `MAX_RUBRICA` (I6);
  - `Banda` cu `data-tipar` și `lead` (B5; `lead` există la `banda.tsx:33`);
  - `AntetSecundar`, `Cadru`, `Descarcari`, `JsonLd`, `metadatePagina`, `nodUnealta`, `PeAcelasiSubiect` și `PrevizualizareDocument`, toate deja importate de pagina actuală;
  - `LEGATURI_CONEXE["/unelte/fisa-evaluare"]` (`legaturi.ts:42`);
  - `RO.hero.ctaPrimar` (`ro.ts:73`, `{ eticheta, href: "/inregistrare" }`).
- Produce: `export const metadata: Metadata`, `export default async function PaginaFisaEvaluare({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> })` (semnătura din `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`). Din `lege.ts`: `export type RegulaLege = Readonly<{ tip: string; regula: string; temei: string }>; export const REGULI_EVALUARE: readonly RegulaLege[]; export const PASI_CONCEDIERE: readonly RegulaLege[];`

- [ ] **Pasul 0:** `grep -n 'data-tipar="ascunde"' "src/app/(marketing)/unelte/fisa-evaluare/page.tsx"` arată banda formularului marcată (B6). Citește fișierul întreg. Dacă altă secțiune a adăugat ceva în afara benzilor de mai jos (un aviz B4, o bandă), păstrează-l în fișierul nou.

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(marketing)/unelte/fisa-evaluare/pagina.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { metadata } from "./page";
import PaginaFisaEvaluare from "./page";

/**
 * Pagina fișei de evaluare, randată cu adresa pe care o trimite formularul.
 * Paginile n-au alte teste unitare (CLAUDE.md, „Datorie cunoscută”); aici se
 * verifică ce promite pagina: rândurile ajung în document, legea are temeiul
 * scris, iar formularul încape într-o adresă pe care Cloudflare o acceptă.
 */
async function pagina(parametri: Record<string, string | string[]>) {
  return render(await PaginaFisaEvaluare({ searchParams: Promise.resolve(parametri) }));
}

describe("pagina fișei de evaluare", () => {
  it("rândurile din adresă ajung în previzualizare, cu nota finală și calificativul", async () => {
    const { container } = await pagina({
      nume: "Ilie Maria",
      criteriu: ["Calitatea muncii", "Termene"],
      pondere: ["60", "40"],
      nota: ["4", "5"],
      utm_source: "fisier",
    });
    const document = container.querySelector("#documentul");
    const randuri = [...(document?.querySelectorAll("tbody tr") ?? [])].map((r) =>
      [...r.querySelectorAll("td")].map((c) => c.textContent),
    );
    expect(randuri.slice(-2)).toEqual([
      ["Total (nota finală)", "100", "", "4,40", ""],
      ["Calificativ", "", "", "", "Bine"],
    ]);
    expect(document?.textContent).toContain("Ilie Maria");
  });

  it("o pondere goală la mijloc nu mută notele pe alt rând", async () => {
    const { container } = await pagina({
      criteriu: ["A", "B", "C"],
      pondere: ["50", "", "50"],
      nota: ["4", "3", "5"],
    });
    const randuri = [...container.querySelectorAll("#documentul tbody tr")].map((r) =>
      [...r.querySelectorAll("td")].slice(0, 3).map((c) => c.textContent),
    );
    expect(randuri.slice(0, 3)).toEqual([
      ["A", "50", "4"],
      ["B", "", "3"],
      ["C", "50", "5"],
    ]);
  });

  it("legea: fiecare articol verificat apare cu temeiul lui", async () => {
    const { container } = await pagina({});
    const text = container.textContent ?? "";
    for (const temei of [
      "art. 40 alin. (1) lit. f)",
      "art. 17 alin. (1) și (3) lit. e)",
      "art. 17 alin. (4)",
      "art. 17 alin. (5)",
      "art. 242 lit. i)",
      "art. 194 alin. (1)",
      "art. 69 alin. (3)",
      "art. 61 lit. d), art. 63 alin. (2)",
      "art. 64 alin. (1) și (2)",
      "art. 62 alin. (1)",
      "art. 75 alin. (1) și (2)",
      "art. 268 alin. (1) lit. a), art. 78",
    ]) {
      expect(text, temei).toContain(temei);
    }
    expect(
      screen.getByRole("heading", { name: "Concedierea pentru necorespundere profesională" }),
    ).toBeDefined();
  });

  it("banda modulului duce la evaluări și la crearea contului", async () => {
    await pagina({});
    const banda = screen
      .getByRole("heading", { name: "Evaluările, cu istoric pe fiecare om" })
      .closest("section");
    const legaturi = [...(banda?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href"));
    expect(legaturi).toContain("/module/evaluari");
    expect(legaturi).toContain("/inregistrare");
  });

  it("formularul are data, grila și rubricile, toate cu limită", async () => {
    const { container } = await pagina({});
    expect(container.querySelector('input[type="date"][name="data"]')).not.toBeNull();
    expect(container.querySelectorAll('input[name="criteriu"]')).toHaveLength(6);
    for (const nume of ["puncte_forte", "de_imbunatatit", "obiective", "dezvoltare"]) {
      expect(
        container.querySelector(`textarea[name="${nume}"]`)?.getAttribute("maxlength"),
        nume,
      ).toBe("500");
    }
    for (const camp of container.querySelectorAll("form input[type=text], form textarea")) {
      expect(camp.getAttribute("maxlength"), camp.getAttribute("name") ?? "").not.toBeNull();
    }
  });

  /*
   * Auditul din 8 oct 2026: peste ~12,5 KB, Cloudflare răspunde „error code:
   * 520”, fără mesaj. Formularul plin, cu 15 criterii de 120 de caractere și
   * toate rubricile la 500, cu o literă din zece cu diacritică (6 octeți în
   * adresă), trebuie să rămână sub prag.
   */
  it("formularul plin la toate limitele încape într-o adresă sub 12 KB", () => {
    const text = (n: number) =>
      Array.from({ length: n }, (_, i) => (i % 10 === 0 ? "ș" : "a")).join("");
    const q = new URLSearchParams();
    for (const nume of ["nume", "functie", "perioada", "evaluator", "firma"])
      q.set(nume, text(120));
    q.set("data", "2026-12-15");
    q.set("set", "administrativ");
    for (let i = 0; i < 15; i += 1) {
      q.append("criteriu", text(120));
      q.append("pondere", "100%");
      q.append("nota", "5");
    }
    for (const nume of ["prag_fb", "prag_b", "prag_s"]) q.set(nume, "4,50");
    for (const nume of ["puncte_forte", "de_imbunatatit", "obiective", "dezvoltare"]) {
      q.set(nume, text(500));
    }
    q.set("format", "xlsx");
    const adresa = `https://administrativo.ro/api/unelte/fisa-evaluare?${q.toString()}`;
    expect(new TextEncoder().encode(adresa).length).toBeLessThan(12_000);
  });

  it("titlul încape în 48 de caractere, descrierea în 160", () => {
    expect(String(metadata.title).length).toBeLessThanOrEqual(48);
    expect(String(metadata.description).length).toBeLessThanOrEqual(160);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/fisa-evaluare/pagina.test.tsx"
```

Rezultatul așteptat pe pagina lăsată de B6: `Tests 5 failed | 2 passed (7)`. Pică:
- rândurile: `expected [ …(2) ] to deeply equal [ …(2) ]`, pentru că pagina veche citește doar `criterii`;
- alinierea: `expected [ [ …(3) ], …(2) ] to deeply equal [ [ 'A', '50', '4' ], …(2) ]`;
- legea: `art. 17 alin. (1) și (3) lit. e): expected '…' to contain 'art. 17 alin. (1) și (3) lit. e)'`;
- banda modulului: lipsește `/inregistrare` (antetul paginii are deja „Creează cont”, de aceea testul caută în banda modulului, nu în toată pagina);
- formularul: `expected null not to be null`, adică lipsește `input[type="date"]`.

Trec deja două teste, care sunt paze, nu defecte:
- metadatele (titlul vechi are 47 de caractere, descrierea 157);
- adresa de 12 KB.

- [ ] **Pasul 3: Implementarea minimă** — `src/app/(marketing)/unelte/fisa-evaluare/lege.ts`:

```ts
/**
 * Ce spune Codul muncii despre evaluare și despre concedierea pentru
 * necorespundere profesională, pe paragrafe scurte, fiecare cu temeiul lui.
 *
 * Verificat pe forma consolidată la 27.04.2026 a Legii 53/2003
 * (https://legislatie.just.ro/Public/DetaliiDocument/309240, cea mai nouă din
 * „istoric consolidări”), descărcată cu curl pe 8 oct 2026. Textul de aici
 * rezumă, nu citează; la o modificare a codului se reverifică fiecare rând.
 *
 * Ce NU spune codul și deci nici pagina: nu există un model oficial de fișă
 * pentru sectorul privat și nici o obligație de evaluare anuală (afirmația
 * frecventă de pe alte site-uri nu apare în text). Periodicitatea, scala și
 * calificativele le stabilește regulamentul intern sau contractul colectiv.
 */

export type RegulaLege = Readonly<{ tip: string; regula: string; temei: string }>;

export const REGULI_EVALUARE: readonly RegulaLege[] = [
  {
    tip: "Cine stabilește criteriile",
    regula:
      "Angajatorul. Are dreptul să stabilească obiectivele de performanță individuală și criteriile după care se evaluează realizarea lor.",
    temei: "art. 40 alin. (1) lit. f)",
  },
  {
    tip: "Salariatul le află dinainte",
    regula:
      "Criteriile de evaluare aplicabile în firmă sunt printre elementele despre care omul e informat înainte de angajare sau de modificarea contractului.",
    temei: "art. 17 alin. (1) și (3) lit. e)",
  },
  {
    tip: "Intră în contract",
    regula:
      "Elementele din informare, deci și criteriile de evaluare, trebuie să se regăsească în contractul individual de muncă.",
    temei: "art. 17 alin. (4)",
  },
  {
    tip: "Schimbarea lor",
    regula:
      "Orice modificare a criteriilor în timpul contractului cere un act adițional, încheiat înainte de modificare, cu excepțiile prevăzute expres de lege sau de contractul colectiv. O fișă semnată „am luat la cunoștință” nu e un act adițional.",
    temei: "art. 17 alin. (5)",
  },
  {
    tip: "Procedura",
    regula:
      "Criteriile și procedura de evaluare se scriu în regulamentul intern. Codul nu dă un model de fișă și nu cere o anumită periodicitate: le stabilește firma.",
    temei: "art. 242 lit. i)",
  },
  {
    tip: "Formarea profesională",
    regula:
      "Angajatorul asigură participarea la formare cel puțin o dată la 2 ani dacă are cel puțin 21 de salariați și cel puțin o dată la 3 ani dacă are sub 21. Rubrica „Plan de dezvoltare” din fișă e locul ei.",
    temei: "art. 194 alin. (1)",
  },
  {
    tip: "Concedierea colectivă",
    regula:
      "Criteriile de prioritate la concediere se aplică pentru departajarea salariaților după evaluarea realizării obiectivelor de performanță.",
    temei: "art. 69 alin. (3)",
  },
];

/** Pașii concedierii pentru necorespundere profesională (art. 61 lit. d)), în ordine. */
export const PASI_CONCEDIERE: readonly RegulaLege[] = [
  {
    tip: "Evaluarea prealabilă",
    regula:
      "Concedierea pentru necorespundere profesională se poate dispune numai după evaluarea prealabilă a salariatului, după procedura din contractul colectiv aplicabil sau, dacă nu există, din regulamentul intern. Fișa e instrumentul; procedura trebuie să fie scrisă înainte.",
    temei: "art. 61 lit. d), art. 63 alin. (2)",
  },
  {
    tip: "Alt loc de muncă",
    regula:
      "Angajatorul îi propune locurile vacante din firmă compatibile cu pregătirea lui. Dacă nu are, cere sprijinul agenției teritoriale de ocupare a forței de muncă.",
    temei: "art. 64 alin. (1) și (2)",
  },
  {
    tip: "Răspunsul salariatului",
    regula:
      "Salariatul are 3 zile lucrătoare de la comunicare ca să accepte în scris. Dacă nu acceptă, și după notificarea agenției, concedierea se poate dispune.",
    temei: "art. 64 alin. (3) și (4)",
  },
  {
    tip: "Termenul deciziei",
    regula:
      "Decizia de concediere se emite în cel mult 30 de zile calendaristice de la data constatării cauzei.",
    temei: "art. 62 alin. (1)",
  },
  {
    tip: "Conținutul deciziei",
    regula:
      "Scrisă, motivată în fapt și în drept, cu termenul și instanța la care se contestă, sub sancțiunea nulității absolute. Cuprinde și durata preavizului și lista locurilor vacante, cu termenul de opțiune.",
    temei: "art. 62 alin. (3), art. 76",
  },
  {
    tip: "Preavizul",
    regula:
      "Cel puțin 20 de zile lucrătoare. Excepție: salariatul concediat pentru necorespundere profesională în perioada de probă.",
    temei: "art. 75 alin. (1) și (2)",
  },
  {
    tip: "Contestarea",
    regula:
      "Salariatul poate contesta decizia în 45 de zile calendaristice de la data la care a luat cunoștință de ea. Concedierea făcută fără procedura din lege e nulă absolut.",
    temei: "art. 268 alin. (1) lit. a), art. 78",
  },
];
```

`src/app/(marketing)/unelte/fisa-evaluare/page.tsx`, întreg:

```tsx
// src/app/(marketing)/unelte/fisa-evaluare/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_FISA_EVALUARE } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { Descarcari } from "../../_componente/descarcari";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { GrilaEvaluare } from "./grila-evaluare";
import { PASI_CONCEDIERE, REGULI_EVALUARE, type RegulaLege } from "./lege";
import { construiesteFisaEvaluare, MAX_RUBRICA, parametriFisaEvaluare } from "./model";

/**
 * Fișa de evaluare a angajaților, gratuită, care calculează.
 *
 * Auditul din 8 oct 2026 a dat-o „puțin peste un tabel Word”: promitea
 * „pondere și notă”, dar nu se putea scrie niciuna, Excelul n-avea nicio
 * formulă, PDF-ul tăia criteriile, iar pagina tăcea despre ce contează juridic.
 * Acum: seturi de criterii pe post, ponderea și nota pe fiecare, nota finală și
 * calificativul calculate pe loc și în Excel, rubricile pe care le are orice
 * model serios și cele două benzi de lege, verificate pe forma consolidată la
 * 27.04.2026 (`lege.ts`).
 *
 * `searchParams` e `Promise` în Next 16 (`node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/page.md`). Valorile repetate
 * (`criteriu`, `pondere`, `nota`) vin ca tablou și se păstrează TOATE, inclusiv
 * cele goale: pozițiile lor aliniază rândurile.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Fișă de evaluare angajați, cu nota calculată",
  descriere:
    "Fișa de evaluare a angajaților: criterii pe tipuri de post, pondere, notă 1–5, nota finală și calificativul calculate. Excel cu formule, Word sau PDF.",
  cale: "/unelte/fisa-evaluare",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

/** Cheile pe care le citește `parametriFisaEvaluare`; restul adresei (UTM, `m`) nu intră. */
const CHEI: ReadonlySet<string> = new Set([
  "nume",
  "functie",
  "perioada",
  "evaluator",
  "firma",
  "data",
  "set",
  "incarca",
  "criteriu",
  "pondere",
  "nota",
  "criterii",
  "prag_fb",
  "prag_b",
  "prag_s",
  "puncte_forte",
  "de_imbunatatit",
  "obiective",
  "dezvoltare",
]);

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const CAMPURI = [
  { nume: "nume", eticheta: "Angajat", exemplu: "Ilie Maria" },
  { nume: "functie", eticheta: "Funcția", exemplu: "Contabil" },
  { nume: "perioada", eticheta: "Perioada evaluată", exemplu: "ianuarie – decembrie 2026" },
  { nume: "evaluator", eticheta: "Evaluator", exemplu: "Popa Ion, director" },
  { nume: "firma", eticheta: "Firma (opțional)", exemplu: "" },
] as const;

const RUBRICI = [
  { nume: "puncte_forte", eticheta: "Puncte forte" },
  { nume: "de_imbunatatit", eticheta: "De îmbunătățit" },
  { nume: "obiective", eticheta: "Obiective pentru perioada următoare" },
  { nume: "dezvoltare", eticheta: "Plan de dezvoltare (formare, îndrumare)" },
] as const;

function ListaLege({ reguli }: Readonly<{ reguli: readonly RegulaLege[] }>) {
  return (
    <dl className="border-mk-rigla/40 mt-6 border-t">
      {reguli.map((r) => (
        <div
          key={r.tip}
          className="border-mk-rigla/40 grid gap-1 border-b py-4 md:grid-cols-12 md:gap-8"
        >
          <dt className="font-mk-display text-[1rem] font-semibold md:col-span-3">{r.tip}</dt>
          <dd className="text-mk-text-slab text-[0.9375rem] leading-[1.65] md:col-span-6">
            {r.regula}
          </dd>
          <dd className="font-mk-date text-mk-text-slab text-[0.75rem] tracking-[0.04em] md:col-span-3">
            {r.temei}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function PaginaFisaEvaluare({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(p)) {
    if (!CHEI.has(cheie)) continue;
    for (const v of Array.isArray(valoare) ? valoare : [valoare]) {
      if (v !== undefined) q.append(cheie, v);
    }
  }
  const ales = parametriFisaEvaluare(q);
  const document = construiesteFisaEvaluare(ales);
  const valori: Readonly<Record<(typeof CAMPURI)[number]["nume"], string>> = {
    nume: ales.nume,
    functie: ales.functie,
    perioada: ales.perioada,
    evaluator: ales.evaluator,
    firma: ales.firma,
  };
  const valoriRubrici: Readonly<Record<(typeof RUBRICI)[number]["nume"], string>> = {
    puncte_forte: ales.puncteForte,
    de_imbunatatit: ales.deImbunatatit,
    obiective: ales.obiective,
    dezvoltare: ales.dezvoltare,
  };
  const rubriciCompletate = Object.values(valoriRubrici).some((v) => v !== "");

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/fisa-evaluare",
          nume: ANTET_FISA_EVALUARE.titlu,
          descriere: ANTET_FISA_EVALUARE.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_FISA_EVALUARE}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Fișa de evaluare", href: "/unelte/fisa-evaluare" },
          ]}
        />
      </div>

      <Banda
        inaltime="scurta"
        supratitlu="Pe scurt"
        titlu="Ce spune Codul muncii despre evaluare"
        lead="Codul muncii nu dă un model de fișă pentru firmele private. Spune cine stabilește criteriile, unde se scriu și cum se schimbă. Rezumat după forma consolidată la 27 aprilie 2026."
        data-tipar="ascunde"
      >
        <ListaLege reguli={REGULI_EVALUARE} />
      </Banda>

      {/* Toată banda formularului rămâne pe ecran: altfel umplutura și rigla ei
          se tipăreau goale deasupra documentului. */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-tipar="ascunde"
        >
          {CAMPURI.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                name={c.nume}
                maxLength={120}
                defaultValue={valori[c.nume]}
                placeholder={c.exemplu}
                className={CLASA_CAMP}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data evaluării (opțional)</span>
            <input type="date" name="data" defaultValue={ales.data} className={CLASA_CAMP} />
          </label>

          <GrilaEvaluare grila={ales.grila} set={ales.set} praguri={ales.praguri} />

          <details className="sm:col-span-2 lg:col-span-3" open={rubriciCompletate}>
            <summary className="cursor-pointer text-[0.875rem] font-medium">
              Puncte forte, obiective și plan de dezvoltare (opțional)
            </summary>
            <p className="text-mk-text-slab mt-2 text-[0.8125rem]">
              Goale, rămân rânduri de scris de mână. Rubrica „Comentariile angajatului” e mereu
              goală: o completează el.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {RUBRICI.map((r) => (
                <label key={r.nume} className="flex flex-col gap-1.5">
                  <span className="text-[0.875rem] font-medium">{r.eticheta}</span>
                  <textarea
                    name={r.nume}
                    rows={3}
                    maxLength={MAX_RUBRICA}
                    defaultValue={valoriRubrici[r.nume]}
                    className={CLASA_CAMP}
                  />
                </label>
              ))}
            </div>
          </details>

          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="evaluare-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează fișa
            </button>
          </div>
          <Descarcari
            actiune="/api/unelte/fisa-evaluare"
            eveniment="evaluare"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <Banda
        inaltime="scurta"
        supratitlu="Când evaluarea devine dovadă"
        titlu="Concedierea pentru necorespundere profesională"
        lead="E singurul motiv de concediere pentru care codul cere o evaluare înainte. Pașii, în ordine. Pentru un caz concret, vorbește cu juristul firmei."
        data-tipar="ascunde"
      >
        <ListaLege reguli={PASI_CONCEDIERE} />
      </Banda>

      <Banda
        inaltime="scurta"
        supratitlu="Fără hârtie"
        titlu="Evaluările, cu istoric pe fiecare om"
        data-tipar="ascunde"
      >
        <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
          În aplicație, criteriile, ponderile și scala devin un șablon pe care îl copiezi de la an
          la an. Evaluarea finalizată se închide și rămâne în dosarul omului, iar angajatul și-o
          citește în portal.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[0.9375rem]">
          <Link href="/module/evaluari" className="underline underline-offset-4">
            Cum arată modulul de evaluări
          </Link>
          <Link href={RO.hero.ctaPrimar.href} className="underline underline-offset-4">
            {RO.hero.ctaPrimar.eticheta}
          </Link>
        </p>
        <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/fisa-evaluare"]} />
      </Banda>
    </Cadru>
  );
}
```

`src/content/landing/unelte.ts`. Vechi:

```ts
  lead: "Fișa de evaluare a performanțelor profesionale, cu criteriile firmei, pondere și notă pe fiecare, plus semnăturile evaluatorului și ale angajatului. Descarci în Word, PDF sau Excel, fără cont.",
```

Nou:

```ts
  lead: "Alegi criteriile după post sau le scrii pe ale firmei, pui ponderea și nota, iar nota finală și calificativul se calculează singure. Cu obiective, plan de dezvoltare și semnături cu dată. Word, PDF sau Excel cu formule, fără cont.",
```

`src/app/(marketing)/unelte/page.tsx` (hub). Vechi:

```ts
    nota: "criteriile firmei, pondere și notă · Word, PDF, Excel",
```

Nou:

```ts
    nota: "nota finală calculată · Excel cu formule, Word, PDF",
```

`src/app/llms.txt/route.ts`. Vechi:

```ts
    "Unealtă gratuită: fișa de evaluare a performanțelor profesionale, cu criteriile firmei (cel mult 15), pondere și notă pe fiecare. Plus ce spune Codul muncii: angajatorul stabilește obiectivele și criteriile (art. 40 alin. (1) lit. f)) și le comunică salariatului (art. 17 alin. (3) lit. e)). Word, PDF sau Excel.",
```

Nou:

```ts
    "Unealtă gratuită: fișa de evaluare a performanțelor profesionale — seturi de criterii pe tipuri de post (general, vânzări, producție, administrativ) sau criteriile firmei (cel mult 15), pondere în procente și notă de la 1 la 5 pe fiecare, nota finală ponderată și calificativul calculate (praguri implicite 4,50 / 3,50 / 2,50, modificabile), obiective, plan de dezvoltare, comentariile angajatului, semnături cu dată. Excel cu formule (SUMPRODUCT, validarea notelor, control că ponderile fac 100), Word sau PDF. Plus ce spune Codul muncii: angajatorul stabilește criteriile (art. 40 alin. (1) lit. f)), ele se comunică salariatului și se trec în contract (art. 17 alin. (3) lit. e) și (4)), schimbarea lor cere act adițional (art. 17 alin. (5)), procedura stă în regulamentul intern (art. 242 lit. i)), iar concedierea pentru necorespundere profesională cere evaluarea prealabilă (art. 63 alin. (2)).",
```

`src/content/landing/harta.ts`: în blocul cu `cale: "/unelte/fisa-evaluare",` și în cel cu `cale: "/unelte",`, valoarea lui `actualizat` (azi `"2026-10-07"`; A7 poate s-o fi ridicat deja pe `/unelte`) devine data zilei commitului, `TZ=Europe/Bucharest date +%F`. Comentariul de deasupra lui `actualizat` de la `/unelte` primește rândul `// Secțiunea I: nota fișei de evaluare — nota finală calculată, Excel cu formule.`

`NOTES.md`, înaintea titlului `### REVISAL · \`revisal_config\``:

```markdown
### Unelte publice — fișa de evaluare · `src/app/(marketing)/unelte/fisa-evaluare/lege.ts`

⚠️ **De confirmat de jurist:** rezumatul pașilor concedierii pentru necorespundere
profesională de pe `/unelte/fisa-evaluare` — art. 61 lit. d), 62 alin. (1) și (3),
63 alin. (2), 64, 75, 76, 78 și 268 alin. (1) lit. a) din Codul muncii, forma
consolidată la 27.04.2026. Scala 1–5, media ponderată și pragurile calificativelor
(4,50 / 3,50 / 2,50) sunt convenția din practică, nu lege; pagina și fișierul o spun.

```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)" src/content src/app/llms.txt src/app/api/unelte src/lib/unelte
```

Trebuie: `pagina.test.tsx` cu 7 teste trecute. Rămân verzi:
- `descarcari.test.tsx` („fiecare pagină de unealtă pune descărcările ÎN formular”);
- `descrieri.test.ts` (≤ 160 de caractere) și `continut.test.ts`;
- `tipar.test.tsx` (B6): toate benzile noi au `data-tipar="ascunde"`;
- `adresa-analitice.test.ts` (A2): câmpurile noi `data`, `puncte_forte`, `de_imbunatatit`, `obiective`, `dezvoltare` nu sunt parametri păstrați.

Apoi lanțul complet și `prettier --check` pe toate căile taskului.

- [ ] **Pasul 5: Verificare headless locală (HTML și CSS; grila nu calculează local, fiindcă nu se hidratează)**

```bash
pgrep -af "next dev"   # dacă rulează deja unul pe acest director, folosește-i portul, nu porni altul
```

Pornește serverul în fundal (`run_in_background`):

```bash
cd /srv/apps/ERP && pnpm exec next dev -H 127.0.0.1 -p 3917
```

Așteaptă cu Monitor până când `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3917/unelte/fisa-evaluare` întoarce `200`. Scrie `$SCRATCH/sonda-evaluare.mjs`:

```js
// Sonda locală a paginii fișei de evaluare: lățimea la 360 și 1366 px, ce ajunge
// în previzualizare, temeiurile din pagină și tiparul din browser. Doar HTML și
// CSS: local, `next dev` nu termină hidratarea, deci grila nu calculează aici.
import { createRequire } from "node:module";

import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";

const require = createRequire("/srv/apps/ERP/package.json");
const { PDFDocument } = require("pdf-lib");

const baza = process.argv[2] ?? "http://127.0.0.1:3917";
const iesire = process.argv[3] ?? ".";

const q = new URLSearchParams({
  nume: "Ștefănescu-Țiriac Ana-Maria",
  functie: "Agent vânzări",
  data: "2026-12-15",
  obiective: "Creșterea vânzărilor cu 10%",
});
for (const [criteriu, pondere, nota] of [
  ["Calitatea relației cu clienții și respectarea termenelor de livrare stabilite prin contract", "60", "4"],
  ["Raportarea vânzărilor", "40", "5"],
]) {
  q.append("criteriu", criteriu);
  q.append("pondere", pondere);
  q.append("nota", nota);
}

const browser = await chromium.launch({
  executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
  args: ["--no-sandbox"],
});
for (const latime of [360, 1366]) {
  const page = await browser.newPage({ viewport: { width: latime, height: 900 } });
  const raspuns = await page.goto(`${baza}/unelte/fisa-evaluare?${q.toString()}`);
  const masuri = await page.evaluate(() => ({
    derulare: document.documentElement.scrollWidth,
    vizibil: document.documentElement.clientWidth,
    criterii: document.querySelectorAll('input[name="criteriu"]').length,
    ultimele: [...document.querySelectorAll("#documentul tbody tr")]
      .slice(-2)
      .map((tr) => tr.textContent),
    temeiuri: (document.body.textContent ?? "").match(/art\. \d+/gu)?.length ?? 0,
    semnaturi: document.querySelector("#documentul [data-semnaturi]")?.textContent ?? null,
  }));
  console.log(latime, raspuns?.status(), JSON.stringify(masuri));
  await page.screenshot({ path: `${iesire}/evaluare-${String(latime)}.png`, fullPage: true });
  if (latime === 1366) {
    await page.emulateMedia({ media: "print" });
    const pdf = await PDFDocument.load(await page.pdf({ format: "A4", preferCSSPageSize: true }));
    console.log(
      "tipar: pagini",
      pdf.getPageCount(),
      "portret",
      pdf.getPages().every((p) => p.getWidth() < p.getHeight()),
    );
  }
  await page.close();
}
await browser.close();
```

```bash
timeout 300 node "$SCRATCH/sonda-evaluare.mjs" http://127.0.0.1:3917 "$SCRATCH"
```

Trebuie să iasă:
- `360 200 {"derulare":360,"vizibil":360,"criterii":2,…}` și `1366 200 {"derulare":1366,"vizibil":1366,…}`, fără derulare laterală;
- `ultimele`: `["Total (nota finală)1004,40","CalificativBine"]`;
- `temeiuri` ≥ 18 (randarea din pregătire a numărat 19);
- `semnaturi` conține „Evaluator”, „Contrasemnat (opțional)” și „Angajat — am luat la cunoștință”;
- `tipar: pagini 1` sau `2`, `portret true`, în intervalul pe care îl cere `e2e/unelte-tipar.spec.ts` (B6) pentru fișa de evaluare. La 3 pagini, scade în previzualizare înălțimea rândurilor de rubrică (`h-7` → `h-6`) și reverifică.

Citește cu `Read` `evaluare-360.png` și `evaluare-1366.png`:
- grila e lizibilă la 360 px: criteriul pe tot rândul, iar dedesubt pondere, notă și „Șterge”, nimic tăiat;
- cele două benzi de lege au temeiul la dreapta pe desktop și dedesubt pe mobil;
- previzualizarea are rubricile și semnăturile.

Oprește serverul într-un apel Bash SEPARAT:

```bash
pkill -f "next dev -H 127.0.0.1 -p 391[7]"
```

```bash
cd /srv/apps/ERP && rm -f .next/dev/types/validator.ts .next/dev/types/routes.d.ts && pnpm typecheck
```

- [ ] **Commit** — `CAI=("src/app/(marketing)/unelte/fisa-evaluare/lege.ts" "src/app/(marketing)/unelte/fisa-evaluare/page.tsx" "src/app/(marketing)/unelte/fisa-evaluare/pagina.test.tsx" src/content/landing/unelte.ts "src/app/(marketing)/unelte/page.tsx" src/app/llms.txt/route.ts src/content/landing/harta.ts NOTES.md); NOI=("src/app/(marketing)/unelte/fisa-evaluare/lege.ts" "src/app/(marketing)/unelte/fisa-evaluare/pagina.test.tsx")`. `lastmod` trebuie să treacă: pagina și hub-ul s-au schimbat azi, iar `actualizat` e data de azi pe amândouă. Mesaj:

```text
feat(unelte): fișa de evaluare care calculează, cu ce spune Codul muncii

Formular cu seturi pe post, pondere și notă pe fiecare criteriu, data
evaluării, rubrici; benzile „Ce spune Codul muncii” (art. 17 alin. 3–5,
40, 69, 194, 242) și „Concedierea pentru necorespundere profesională”
(art. 61–64, 75, 76, 78, 268), verificate pe forma consolidată la
27.04.2026. Titlu „Fișă de evaluare angajați, cu nota calculată”.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task I10: Proba pe staging, după hidratare, și publicarea

**Fișiere:**
- Create: `e2e/fisa-evaluare.spec.ts`

**Interfețe:**
- Consumă: `playwright.config.ts` (staging, basic auth din `E2E_AUTENTIFICARE_BASIC` sau `~/.secrete/administrativo/parola-staging.txt`; refuză producția); `@playwright/test` (`expect`, `test`, `type Page`); `jszip`. Marcajele `[data-rezultat-grila]` (I8) și butonul „Descarcă Excel” (`descarcari.tsx`).
- Produce: două teste e2e. Nu scriu nimic: pagina e publică și nu atinge baza.

- [ ] **Pasul 1: Scrie testul** — `e2e/fisa-evaluare.spec.ts`:

```ts
/**
 * Fișa de evaluare pe STAGING, cu hidratare: grila calculează pe loc, iar
 * Excelul descărcat din pagină are formulele.
 *
 * Local, `next dev` nu termină hidratarea (memoria `erp-next-dev-nu-hidrateaza`),
 * deci comportamentul grilei se dovedește aici, pe build-ul de producție din
 * staging. Testul nu scrie nimic: pagina e publică și nu atinge baza.
 */
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";

/** Bara de cookie-uri stă jos, peste butoane; „Refuz” o închide fără analitice. */
async function inchideBara(page: Page) {
  const bara = page.getByRole("region", { name: "Cookie-uri de analiză" });
  if (await bara.isVisible()) await bara.getByRole("button", { name: "Refuz" }).click();
}

test.describe("fișa de evaluare", () => {
  test("grila calculează pe loc, iar Excelul descărcat are formule", async ({ page }) => {
    await page.goto("/unelte/fisa-evaluare");
    await inchideBara(page);
    const stare = page.locator("[data-rezultat-grila]");
    await expect(stare).toContainText("Total ponderi: 100%");

    const note = page.locator('select[name="nota"]');
    for (const [i, nota] of ["4", "5", "3", "4", "3", "4"].entries()) {
      await note.nth(i).selectOption(nota);
    }
    await expect(stare).toContainText("Nota finală: 3,90 — Bine");

    await page.locator('input[name="pondere"]').first().fill("10");
    await expect(stare).toContainText("Ponderile însumează 90%, nu 100%");
    await page.getByRole("button", { name: "Împarte ponderile egal" }).click();
    await expect(stare).toContainText("Total ponderi: 100%");

    const [descarcare] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Descarcă Excel" }).click(),
    ]);
    expect(descarcare.suggestedFilename()).toBe("fisa-evaluare-necompletata.xlsx");
    const zip = await JSZip.loadAsync(readFileSync(await descarcare.path()));
    const foaie = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
    expect(foaie).toContain("SUMPRODUCT(");
    expect(foaie).toContain("<v>17</v>");
  });

  test("la 360 px pagina nu se derulează lateral", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/unelte/fisa-evaluare");
    const [derulare, vizibil] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(derulare).toBe(vizibil);
  });
});
```

- [ ] **Pasul 2: Vezi-l picând pe staging-ul de dinainte.** Înainte de push-ul lui I9 (sau cu staging încă pe versiunea veche):

```bash
cd /srv/apps/ERP && pnpm exec playwright test e2e/fisa-evaluare.spec.ts
```

Eșecul așteptat: `locator('[data-rezultat-grila]')`, `Expected substring: "Total ponderi: 100%"`, element negăsit. Testul de 360 px trece deja; el păzește regresia.

- [ ] **Pasul 3: Implementarea** e în I1–I9. Aici doar se așteaptă deploy-ul automat pe staging (`staging.yml`, declanșat de push). Verifică că a rulat: `gh run list --workflow=staging.yml --limit 3` arată rularea commitului din I9 încheiată cu succes. Verifică și DURATA: sub 30 s înseamnă că a sărit (memoria „workflow verde prin sărire”). Staging poate cădea tăcut (memoria `erp-staging-cade-tacut`).

- [ ] **Pasul 4: Rulează pe staging, trece**

```bash
cd /srv/apps/ERP && pnpm exec playwright test e2e/fisa-evaluare.spec.ts e2e/unelte-tipar.spec.ts
```

Trebuie:
- 2 teste trecute în `fisa-evaluare.spec.ts`;
- `unelte-tipar.spec.ts` (B6) verde pentru toate cele 7 pagini: fișa de evaluare are 1–2 pagini portret. Semnăturile adăugate în I5 apar acum și la condică, la foaia de parcurs și la fișa SSM. Intervalele lor din spec (condica `[1, 2]`, foaia de parcurs `[1, 3]`, fișa SSM cum a lăsat-o H) trebuie să rămână verzi. Dacă una iese peste interval, OPREȘTE-TE și raportează pagina și numărul măsurat. Nu lărgi intervalul fără să te uiți la tipar: un interval lărgit ascunde exact regresia pe care o păzește. Cererea nu folosește `PrevizualizareDocument` după F, deci I5 n-o atinge.

- [ ] **Pasul 5: Captura de pe staging.** Cu sonda din I9 și basic auth (`E2E_AUTENTIFICARE_BASIC`), sau cu o rulare `--headed=false --trace on` a specificației: deschide trace-ul și verifică vizual grila calculând după selectarea notelor.

- [ ] **Commit** — `CAI=(e2e/fisa-evaluare.spec.ts); NOI=(e2e/fisa-evaluare.spec.ts)`. Mesaj:

```text
test(unelte): fișa de evaluare pe staging — grila calculează, Excelul are formule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

- [ ] **Pasul 6: Producția — STOP pentru confirmare.** Deploy-ul pe `administrativo.ro` se face prin `./administrativo.sh` (memoria `erp-deploy-productie`), doar după ce utilizatorul confirmă explicit. După deploy:

```bash
curl -s -o "$SCRATCH/i10.xlsx" -w '%{http_code} %{content_type}\n' "https://administrativo.ro/api/unelte/fisa-evaluare?format=xlsx&criteriu=A&pondere=100&nota=4"
unzip -p "$SCRATCH/i10.xlsx" xl/worksheets/sheet1.xml | grep -o "<f>" | wc -l     # ≥ 5 (grep -c numără RÂNDURI, iar foaia e pe un singur rând)
curl -s "https://administrativo.ro/unelte/fisa-evaluare" | grep -o "<title>[^<]*"   # Fișă de evaluare angajați, cu nota calculată · Administrativo
```

---

**Review Focus** — situații care ar mușca un om real. La verificarea planului (8 oct 2026), prima versiune le lăsa ca „teste de adăugat”, fără cod. Acum fiecare e închisă în taskul care deține codul, sau spune de ce nu mai e nevoie.

1. **Un rând șters la mijloc, apoi „Completează fișa”.** Grila trimite rândurile în ordinea de pe ecran, iar `grilaDinAdresa` le aliniază pe poziție ÎNAINTE să sară rândurile fără criteriu (`map` pe index, apoi `filter`). E deja păzit, deci nu se adaugă nimic: în **I6**, `model.test.ts`, „rândurile fără criteriu se sar…” pune rândul gol primul, cu pondere și notă valide (`30`, `4`). La o decalare, criteriul A le-ar lua, iar testul cere `null`. În **I9**, `pagina.test.tsx` are „o pondere goală la mijloc nu mută notele pe alt rând”.
2. **Semnăturile noi din previzualizare (I5) la tipar.** Cererea de concediu nu e atinsă: după F are `ScrisoarePrevizualizata`. Atinse sunt condica, foaia de parcurs și fișa SSM. Intervalele lor de pagini din `e2e/unelte-tipar.spec.ts` se verifică pe staging în **I10, Pasul 4**, cu oprire la depășire.
3. **„Încarcă setul” apăsat după ce omul și-a scris criteriile.** ÎNCHIS în **I8**: butonul rămâne de trimitere, dar are un `onClick` care, dacă rândurile nu mai sunt setul neatins, cere `confirm` și la refuz face `preventDefault`. Două teste noi: „cere confirmare când s-ar pierde ceva scris” și „pe setul neatins trimite fără întrebare”.
4. **Un Excel editat pe un vizualizator care nu recalculează.** ÎNCHIS în **I7**: testul „Excel recalculează la deschidere: `fullCalcOnLoad` rămâne în registru” cere `<calcPr … fullCalcOnLoad="1">` în `xl/workbook.xml`. Verificat prin mutație: fără linia `registru.calcProperties.fullCalcOnLoad = true`, testul pică.
5. **Pragurile scrise greșit („ 4, 5”, „4.5.”).** ÎNCHIS în **I8**: `<summary>` primește „— greșite, se folosesc cele implicite”, în culoarea de refuz, deci avizul se vede lângă praguri chiar cu `<details>` închis. Nu am folosit `open={praguriCitite.corectate}`: la corectarea pragului, React ar fi închis `<details>` sub degetele omului.
