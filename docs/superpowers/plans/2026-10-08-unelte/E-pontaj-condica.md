## E. Foaia de pontaj și condica de prezență: cele mai bune gratuite din România

**Scop:** foaia de pontaj și condica de prezență devin documentele gratuite pe care un patron sau un contabil român le poate pune pe masa inspectorului ITM și le poate folosi direct la salarii: toate zilele lunii (inclusiv sâmbete, ture și sărbători), ora de început și de sfârșit (art. 119), norma fiecărui angajat, codurile modulului de pontaj, antetul firmei și Excel cu formule reale, gata de tipărit pe A4.

**De ce:** auditul live din 8 oct 2026 (2 auditori și 2 verificări adversariale pe aceste două unelte) a dat amândurora utilitate **3/5**:

- **Condica:** defect **MAJOR confirmat**. `construiesteCondica` păstrează doar zilele cu `!z.weekend && z.sarbatoare === null` (`condica-de-prezenta/model.ts:47`). Aprilie 2026 iese cu 20 de date, fără nicio sâmbătă sau duminică („Zile scoase: 10”), deci condica e inutilizabilă în comerț, HoReCa și la ture. XLSX-ul are **0 formule `<f>`**, datele sunt text și lipsește `_xlnm.Print_Titles`. PDF-ul are rânduri de **16 pt (5,6 mm)** și chenare **#D9DBE0 de 0,5 pt**, iar titlul și firma apar doar pe pagina 1, fără „Pagina X din Y”. Lipsesc pauza, orele lucrate, totalul și observațiile (CO/CM/delegație). easyhours.ro dă gratuit un Excel cu formulă `ROUND(MOD(E-C,1)*24-pauză/60)`, total și observații.
- **Foaia de pontaj:** are o singură căsuță pe zi, fără ora de început și de sfârșit, deși art. 119 alin. (1) le cere (Zarina CRM le are în fișa individuală). Nu are legendă de coduri, totaluri pe tipuri de absență, antet de firmă (unitate, CUI, compartiment) sau normă per angajat (part-time). Excelul are `print_title_rows=None` și `paperSize=None`, iar coloana Total nu are lățime. Pe web, coloanele de zi au lățimi inegale: zilele 1–9 au cam 22 px, zilele 10–31 cam 35 px.
- **Concurenți:** Zarina CRM (fișă individuală sau colectivă, program și normă per angajat, absențe cu motiv, dar numai PDF); easyhours.ro (Excel cu formule pentru ore, pauză și total, dar fără sărbători și fără nume precompletate); modelpontaj.ro (un XLSX static pe lună); papervee (cere e-mail, sărbătorile se marchează de mână). Avantajul nostru, confirmat de audit: sărbătorile calculate corect pentru 2024–2035 și trei formate fără cont. Țintim combinația pe care n-o are niciunul dintre ei.

**Ordinea față de secțiunea B (robustețe comună): E rulează DUPĂ B1–B8.** B atinge aceleași fișiere (`foaie.ts`, `foaie-document.ts`, ruta foii, `model.ts` al condicii, ambele `page.tsx`, `raspuns.ts`, `document-tabelar.ts`, `Banda`, `PrevizualizareDocument`), iar E îi consumă funcțiile, nu le rescrie. Ce folosește E din B, cu numele din `B-robustete-comuna.md`:

- `curataText(text)` și `curataDocument(d)` din `@/lib/unelte/document-tabelar` (B2). Prima curăță antetul de firmă (E1), a doua rămâne în `raspunsDocument` și intră și în `raspunsDocumente` (E5).
- `citesteAngajati(brut): ListaAngajati` (`{ nume, total, omisi, scurtate }`), `avizAngajati(lista)` și `notaOmisi(lista)` din `foaie.ts` (B3, B4). E citește norma de pe fiecare rând, apoi dă restul rândului lui `citesteAngajati`, ca regulile de nume să rămână ale lui B: despărțire doar la rând nou, TAB devenit spațiu, plafonul de 60 și de 80 de caractere, avizul și nota de listă tăiată.
- `oreFoaie(ore)` („8 h”, „7:30 h”, „153:18 h”) din `foaie.ts` (B7), pentru toate textele cu ore.
- `avizeParametri(brut, ales)` din `foaie.ts` (B8) și componenta `AvizCorectari` din `_componente/aviz-corectari.tsx` (B4). Pe fiecare pagină există UN SINGUR `role="status"`, în care intră și avizele lui E (norma care nu se citește, CUI-ul).
- prop-ul `data-tipar="ascunde"` al lui `Banda` (B5) pe banda formularului, plus atributul `data-tipar-pagina="peisaj"` pe figura foii colective (B6, contract cu `@page peisaj`).

**Testele lui B care trebuie să rămână verzi** după fiecare task din E: `foaie-de-pontaj/foaie.test.ts`, `api/unelte/foaie-de-pontaj/route.test.ts` (creat de B4; E10 îi ADAUGĂ teste), `unelte/avize.test.tsx`, `unelte/tipar.test.tsx`, `_componente/tipar.test.tsx`, `_componente/aviz-corectari.test.tsx`, `_componente/previzualizare-document.test.tsx`, `randari.test.ts` (cu testele de cache ale lui A5). Pe lângă ele, testul de cache al lui A5 din `[unealta]/route.test.ts`, mutat de E12 de pe condică pe `fisa-evaluare`. Singura excepție, spusă în task: `condica-de-prezenta/model.test.ts` e rescris de E11. Testul lui B4 „fără tăiere, notele rămân cele două” devine „fără tăiere, nicio notă de listă”, fiindcă notele condicii devin trei (art. 119, program, legendă). Intenția lui B, adică nota doar când lista e tăiată, rămâne testată.

**Ordinea față de secțiunea A (confidențialitate): E rulează și DUPĂ A5.** A5 pune `export const ANTET_CACHE_DESCARCARE = "private, no-store";` în `src/lib/unelte/raspuns.ts`, îl folosește în ruta foii și adaugă trei teste: în `randari.test.ts` („descărcarea nu intră în niciun cache comun” și paza pe surse „nicio rută de unealtă nu mai declară cache public”), în `foaie-de-pontaj/route.test.ts` și în `[unealta]/route.test.ts` (acesta cere condica PRIN ruta comună). E5 păstrează constanta în `raspunsBinar`, iar E12 mută testul din `[unealta]` pe o unealtă care rămâne în registru. Rutele noi ale lui E nu-și scriu singure `cache-control`: trec prin `raspunsBinar`/`raspunsDocument(e)`.

**Precondiția fiecărui task:** `git log --oneline -- src/lib/unelte/document-tabelar.ts "src/app/(marketing)/_componente/aviz-corectari.tsx" | head -3` arată commit-urile lui B2 și B4, `grep -n "export function oreFoaie\|export function avizeParametri" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts"` le găsește pe amândouă, iar `grep -n "ANTET_CACHE_DESCARCARE" src/lib/unelte/raspuns.ts` găsește constanta lui A5. Fără ele, taskul nu începe: se execută întâi A5 și B.

### Decizii luate

1. **Norma per angajat se scrie pe același rând cu numele, după o bară verticală: `Ilie Maria | 4`.** Formatul merge fără JavaScript și încape în URL, deci linkul se poate pune la favorite. Un TAB contează ca separator de normă DOAR dacă ultima celulă de după el e un număr de ore. Așa, „Popa Ion⇥4” (două coloane lipite din Excel) dă norma 4, iar „Popa⇥Ion” rămâne „Popa Ion”, cum cere regula lui B (D6: tabul devine spațiu). Sunt acceptate formele `4`, `4h`, `7,5`, `7.5` și `6:30`. O valoare care nu se poate citi nu blochează foaia: angajatul primește norma comună și pagina afișează un avertisment care numește omul. Am respins o coloană separată (un al doilea `<textarea>`), fiindcă rândurile din cele două liste se decalează la prima linie goală.
2. **Programul are trei valori: `lv` (luni–vineri, implicit), `ls` (luni–sâmbătă) și `ture` (toate zilele).** „Zile alese individual” ar cere 31 de casete și o adresă de 31 de parametri, iar `ture` acoperă cazul: o zi lucrată se completează, iar una nelucrată primește `L`. Norma lunară rămâne, pentru toate cele trei programe, **zilele lucrătoare de luni până vineri fără sărbători × ore/zi**. Așa o socotește și salarizarea, oricum ar fi repartizat programul.
3. **Codurile sunt cele ale modulului de pontaj (`CODURI_TIP_ZI` din `src/domain/attendance/coduri-zi.ts`): CO, CM, AN, D, L, SL, plus CFS.** Nu folosim „N” pentru nemotivat, fiindcă aplicația scrie „AN”, iar foaia gratuită e ușa spre aplicație. Adăugăm doar CFS (concediu fără salariu): aplicația îl ține ca tip de concediu (`fara_plata`), nu ca tip de zi. Orele suplimentare și cele de noapte au coloane proprii, ca în arhiva lunară a aplicației (`src/lib/excel/foaie-colectiva.ts`: „Ore / Supl. / Noapte”), nu coduri.
4. **Zilele din afara programului primesc dinainte codul `L` (repaus) sau `SL` (sărbătoare), în toate cele trei formate.** Pe lângă umbrire, o literă rezistă la tipărirea alb-negru (auditul: „weekendul și sărbătoarea au aceeași nuanță în PDF și DOCX”) și e numărată de `COUNTIF`. La programul `ture` nu se pune nimic dinainte, iar sărbătoarea rămâne marcată în cap și în nota lunii.
5. **Varianta individuală e un parametru al foii de pontaj (`varianta=individuala`), nu o pagină nouă.** Fișa are o pagină A4 portret pe angajat, cu Data, Ziua, Ora început, Ora sfârșit, Pauză (min), Ore lucrate, Ore supl., Ore noapte, Cod, Semnătura și Observații. Ea acoperă art. 119 alin. (1). O singură adresă canonică păstrează autoritatea paginii care rankează deja, iar întrebarea „e suficientă colectiva la ITM?” trimite cu un link în aceeași pagină. Fără pagină nouă nu se schimbă nici `harta.ts`/`llms.txt`, în afara datei.
6. **Condica primește aceleași trei programe.** La `lv`/`ls`, o zi din afara programului apare ca un **singur rând-marcaj** („Sâmbătă — zi de repaus”, Observații = `L`; „Crăciunul”, Observații = `SL`), ca în condică să nu lipsească nicio dată. La `ture`, fiecare zi are rânduri pentru toți oamenii, iar sărbătoarea mai are deasupra și un rând-marcaj `SL`. Am respins varianta cu rânduri pentru toți în toate zilele, chiar și la program luni–vineri: aprilie ar fi crescut cu 50% pentru zile în care nu lucrează nimeni.
7. **Orele calculate în Excel se afișează ca ceas (`[h]:mm`), cele introduse manual pe foaia colectivă rămân în zecimale.** Regula produsului (`src/lib/format/ore.ts`) cere „8:30”, nu „8,5”. În fișa individuală și în condică, orele se calculează din ore de ceas, deci rezultatul e o durată: `MAX(0,MOD(sfârșit−început,1)−N(pauză)/1440)`. Formula tratează corect tura care trece de miezul nopții și pauza mai lungă decât intervalul. Pe foaia colectivă omul tastează „8” într-o celulă, așa că totalul e o sumă zecimală, ca până acum. Diferența față de normă se dă în ore zecimale, fiindcă o durată negativă se afișează ca `#####` în Excel.
8. **Validarea codurilor în Excel diferă după coloană.** În celulele de zi ale foii colective, lista CO…SL are `showErrorMessage: false`: săgeata cu codurile apare, iar cifrele se pot tasta în continuare. În coloana Cod a fișei individuale, validarea e strictă. Orele de început și de sfârșit au validare `decimal` între 0 și 0,99999: „8:00” trece, iar „8” este oprit cu mesajul „Scrie ora cu două puncte”. Fără validarea asta, „8” ar însemna 8 zile și ar da ore aberante.
9. **Excelul semnalează depășirea normei la timp parțial, dar nu o declară ilegală.** Celula „Ore lucrate” devine roșie când `h/zi < 8` și orele trec de norma lunii, iar nota de sub tabel citează art. 15¹ lit. d) și amenda din `EVIDENTA_ORELOR` (sursa unică, verificată pe 6 oct 2026, recitită de mine pe 8 oct). Fapta din lege privește programul din contract, nu suma lunară, de aceea semnalul se formulează „verifică”.
10. **Sumele amenzilor nu se scriu a doua oară.** Banda „Ce cere inspectorul de muncă” și întrebările citesc amenzile din `src/content/legal/evidenta-orelor.ts`, căutându-le după temei (`lit. m)`, `lit. e³)`). Un test pică dacă pagina-lege își schimbă temeiul.
11. **Nu marcăm cu `FAQPage`** (decizia existentă din `intrebari/page.tsx`: rezultatele îmbogățite s-au retras la 7 mai 2026). Structura „întrebare, apoi răspuns” rămâne, cu temeiul afișat sub fiecare răspuns.
12. **Renderer-ele comune se îmbunătățesc pentru toate uneltele**, fiindcă toate se tipăresc și se completează de mână. Schimbările: chenar gri închis (`rgb(0,45; 0,47; 0,5)`) în loc de `LINIE` (#D9DBE0), „Pagina X din Y” când documentul are mai mult de o pagină, titlul repetat sus pe paginile 2+, subsol numerotat în Word. Rândul mai înalt (`inaltimeRand`) e opțional, cerut de fiecare document în parte, iar condica cere 22 pt. Randarea mai multor documente într-un singur fișier (o fișă pe angajat) se face o singură dată, în `pdf.ts`/`docx.ts`, cu fontul încorporat o singură dată, nu prin lipirea PDF-urilor.
13. **Excelul foii și al condicii au generatoare proprii, nu trec prin `randeazaXlsx`.** Modelul comun nu știe de formule, iar altă secțiune îl poate extinde în paralel. Condica primește de aceea ruta statică `/api/unelte/condica-de-prezenta`, la fel ca foaia (o rută statică are prioritate față de `[unealta]`), și iese din `UNELTE`. Tiparul Excel comun (A4, rânduri de titlu repetate, subsol numerotat, validări, nume de filă sigure) stă într-un fișier nou, `src/lib/unelte/tipar-xlsx.ts`, ca să-l poată adopta și celelalte unelte fără să atingă `xlsx.ts`.
14. **Lățimile coloanelor PDF sunt alese pe fontul real** (DejaVu 8 pt, măsurat pe 8 oct). Exemple: „31” aldin = 11,1 pt, „noapte” aldin = 31,6 pt, „Țăranu Ioana-Maria” = 77,9 pt. Un test încarcă fontul și verifică faptul că nicio etichetă de coloană nu ajunge la „…” (`taie` taie la `w − 4`). Pe foaia colectivă, coloana „Normă” rămâne **doar în Excel**: pe A4 peisaj, cu 31 de zile și 8 coloane de total, numele ar fi rămas cu 64 pt. Norma fiecărui om se vede în PDF prin „h/zi”, iar norma lunii, în subtitlu.
15. **Fără bază de date, fără sesiune, fără migrare.** Toate intrările vin din adresă și sunt mărginite (60 de nume, 80 de caractere, antetul la 120/14/60 de caractere).
16. **Fără valori legale noi de confirmat de contabil.** Procentele din întrebări (spor de minimum 100% la art. 142, 25% la art. 126) sunt minime legale citate ca text și nu intră în niciun calcul, iar amenzile vin din `EVIDENTA_ORELOR`. `NOTES.md` nu se schimbă.

**Verificarea legală (pe sursa primară, 8 oct 2026).** Codul muncii, forma consolidată, descărcat cu `curl` de pe `https://legislatie.just.ro/Public/DetaliiDocument/128647` (ultima consolidare listată: **27.04.2026**). Am citit textul pentru:

- art. 112 alin. (1): 8 h/zi și 40 h/săptămână;
- art. 119 alin. (1): ora de începere și cea de sfârșit, zilnic, la locul de muncă; alin. (2): salariații mobili și cei cu muncă la domiciliu;
- art. 120 alin. (1): munca peste durata normală săptămânală;
- art. 122 alin. (1): ore libere plătite în 90 de zile;
- art. 125 alin. (1): orele 22–6;
- art. 126: program redus cu o oră sau spor de 25% la cel puțin 3 ore de noapte;
- art. 134 alin. (1): pauză de masă peste 6 ore; alin. (3): pauzele nu intră în program, dacă CCM sau RI nu spun altfel;
- art. 137 alin. (1)–(3): repaus de 48 de ore, de regulă sâmbătă și duminică; în alte zile, cu spor;
- art. 142 alin. (1)–(2): timp liber în 30 de zile sau spor de cel puțin 100%;
- art. 15¹ lit. d): depășirea timpului de muncă la timp parțial, cu excepția art. 105 alin. (1) lit. c);
- art. 260 alin. (1) lit. m): 1.500–3.000 lei pentru art. 27 și 119; lit. e³): 10.000–15.000 lei pe persoană, plafon 200.000 lei.

Textul se pune în comentariul de antet al lui `src/content/landing/intrebari-pontaj.ts` (taskul E7).

**Reverificat de verificatorul adversarial (8 oct 2026, același URL, `curl` + text):** art. 119 alin. (1)–(2), art. 122 alin. (1) (90 de zile, modificat prin OUG 117/2021), art. 126 lit. a)–b) (25%, „cel puțin 3 ore de noapte din timpul normal de lucru”), art. 134 alin. (1), art. 137 alin. (1) (48 de ore consecutive), art. 142 alin. (1)–(2). Toate corespund textelor din E7.

⚠ **Neconfirmat pe sursă primară: un model obligatoriu de condică sau de foaie colectivă** în alt act decât Codul muncii (de exemplu, formularele din OMFP 2634/2015). De aceea textele din E7 spun „Codul muncii nu impune un model”, nu „legea”: e afirmația verificată pe text. Pasul de confirmare, înainte de a lărgi formularea: căutare pe legislatie.just.ro după „foaie colectivă de prezență” și citirea anexei OMFP 2634/2015 (lista formularelor financiar-contabile); dacă foaia colectivă apare acolo, se notează dacă modelul e obligatoriu sau orientativ, iar formularea din E7 se ajustează doar dacă e obligatoriu.

### Harta fișierelor

| Fișier                                                                                     | Responsabilitate                                                                                                                                                        | Task                                            |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `src/lib/unelte/antet-firma.ts` (+ `.test.ts`) — nou                                       | `AntetFirma`, citirea `firma`/`cui`/`compartiment` din adresă, rândul de antet, avertismentul de CUI                                                                    | E1                                              |
| `src/lib/unelte/coduri-pontaj.ts` (+ `.test.ts`) — nou                                     | codurile foii (aliniate cu `CODURI_TIP_ZI` + CFS), legenda, lista de validare                                                                                           | E2                                              |
| `src/app/(marketing)/unelte/foaie-de-pontaj/pontaj.ts` (+ `.test.ts`) — nou                | programul, varianta, zilele lunii cu codul implicit, liniile `Nume \| normă`, parametrii din adresă, `Pontaj`                                                           | E3                                              |
| `src/lib/unelte/document-tabelar.ts`                                                       | câmpul opțional `inaltimeRand`, `textAntetRulant`, `textPagina`                                                                                                         | E4                                              |
| `src/lib/unelte/pdf.ts` (+ `pdf-pagini.test.ts` nou)                                       | chenar vizibil, rând înalt, antet repetat, „Pagina X din Y”, `latimiColoane`, `randeazaPdfMultiplu`                                                                     | E4                                              |
| `src/lib/unelte/docx.ts`, `raspuns.ts` (+ `docx-sectiuni.test.ts` nou)                     | secțiuni multiple, rând înalt, antet și subsol numerotat; `raspunsBinar`, `raspunsDocumente`                                                                            | E5                                              |
| `src/lib/unelte/tipar-xlsx.ts` (+ `.test.ts`) — nou                                        | A4, `printTitlesRow`, subsol numerotat, validări (coduri/oră/durată/pauză), `numeFilaSigur`                                                                             | E6                                              |
| `src/content/landing/intrebari-pontaj.ts` (+ `.test.ts`) — nou                             | întrebările celor două pagini, textele de acoperire art. 119, `amendaEvidenta`, `textAmenda`                                                                            | E7                                              |
| `src/app/(marketing)/_componente/ce-cere-itm.tsx`, `intrebari-unealta.tsx` (+ teste) — noi | banda ITM și lista de întrebări, comune celor două pagini                                                                                                               | E7                                              |
| `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts` (+ `.test.ts`)              | foaia colectivă și fișa individuală ca `DocumentTabelar`; `documenteleFoii`                                                                                             | E8 (scoaterea lui `foaieCaDocument` în E10)     |
| `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-xlsx.ts` (+ `.test.ts`) — nou            | Excelul foii cu formule (colectiv / o filă pe angajat)                                                                                                                  | E9                                              |
| `src/app/api/unelte/foaie-de-pontaj/route.ts` (+ `route.test.ts`, creat de B4)            | ruta: parametri → `Pontaj` → PDF/Word/Excel                                                                                                                             | E10                                             |
| `src/app/(marketing)/unelte/condica-de-prezenta/model.ts` (+ `model.test.ts`)              | rândurile condicii pe program, rânduri-marcaj, coloanele noi, antetul                                                                                                   | E11 (compatibilitatea se scoate în E14)         |
| `src/app/(marketing)/unelte/condica-de-prezenta/condica-xlsx.ts` (+ `.test.ts`) — nou      | Excelul condicii cu ore calculate și fila „Total pe angajat”                                                                                                            | E12                                             |
| `src/app/api/unelte/condica-de-prezenta/route.ts` (+ `route.test.ts`) — nou                | ruta statică a condicii                                                                                                                                                 | E12                                             |
| `src/lib/unelte/registru.ts`, `registru.test.ts`                                           | condica iese din `UNELTE`                                                                                                                                               | E12                                             |
| `src/app/(marketing)/unelte/foaie-de-pontaj/tabel-colectiv.tsx` (+ `.test.tsx`) — nou      | tabelul colectiv pe ecran, cu `table-fixed` și coloane egale, din același `DocumentTabelar`                                                                             | E13                                             |
| `src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx` (+ `pagina.test.ts` nou)             | formularul nou, previzualizarea, ITM, întrebări                                                                                                                         | E13                                             |
| `src/app/(marketing)/unelte/condica-de-prezenta/page.tsx` (+ `pagina.test.ts` nou)         | formularul nou, ITM, întrebări                                                                                                                                          | E14                                             |
| `src/content/landing/unelte.ts`, `src/app/(marketing)/unelte/page.tsx`, `src/app/llms.txt/route.ts`, `src/content/landing/harta.ts` | lead-urile, notele din hub, descrierile pentru LLM și `actualizat` (data commitului) | E11 (doar harta), E13, E14 |

**Precondiții comune tuturor taskurilor.** Pornești din `/srv/apps/ERP`, pe `main`. Rulezi `git status --short` și **nu** atingi fișierele altor sesiuni (în instantaneul de la început: `registru/*`, `components/data/*`, `components/ui/tabel*`, `lib/queries/*`, `0185_*.sql`). Fișierele temporare (scripturi de verificare, capturi) stau în scratchpad-ul sesiunii, nu în repo. Liniile din fișierele existente citate mai jos sunt cele din e906d2c. După B, ele s-au mutat, așa că blocurile „vechi” se caută după text, nu după număr. Comanda de scratchpad din pașii de mai jos e `$S` = directorul de scratchpad al sesiunii care execută. Exemplu: `S=/tmp/claude-1000/-srv-apps-ERP/<sesiune>/scratchpad`.

**Lanțul de verificare** („lanțul complet” în pași; FĂRĂ `pnpm build`):

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs
pnpm exec prettier --write <fișierele atinse de task> && pnpm exec prettier --check <fișierele atinse de task>
```

`prettier-plugin-tailwindcss` reordonează clasele, deci `--write` vine înaintea lui `--check`. Codul din taskuri e scris în forma lui prettier, dar ordinea claselor o hotărăște plugin-ul.

Dacă `pnpm typecheck` cade în `.next/dev/types/*` după un `next dev` oprit, rulează `rm -f .next/dev/types/validator.ts .next/dev/types/routes.d.ts`, apoi reia lanțul.

**Ritualul de commit** (același în fiecare task; `<căi>` = lista din pasul de commit al taskului):

```bash
cd /srv/apps/ERP
git status --short -- <căi>
git fetch origin main
git diff --name-only HEAD origin/main -- <căi>   # dacă iese ceva: citește diff-ul și integrează-l înainte de commit
git add -- <căi>                                   # necesar pentru fișierele noi; indexul e partajat, deci DOAR căile tale
git commit --only -m "$(cat <<'EOF'
<mesajul din task>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)" -- <căi>
git merge origin/main
node scripts/checks/lastmod.mjs                    # după commit; dacă pică, amendezi data în harta.ts în același commit
git push origin main
```

---
### Task E1: Antetul de firmă comun (firmă, CUI, compartiment)

**Fișiere:**
- Create: `src/lib/unelte/antet-firma.ts`
- Test: `src/lib/unelte/antet-firma.test.ts`

**Interfețe:**
- Consumă: `validateazaCui(brut: string): RezultatCui` din `@/domain/organization/cui` (există, linia 41); `curataText(text: string): string` din `@/lib/unelte/document-tabelar` (B2)
- Produce:
  ```ts
  export type AntetFirma = Readonly<{ firma: string; cui: string; compartiment: string }>;
  export const MAX_FIRMA = 120; export const MAX_CUI = 14; export const MAX_COMPARTIMENT = 60;
  export function antetFirmaDinParametri(q: URLSearchParams): AntetFirma;
  export function randAntetFirma(a: AntetFirma): string | null;
  export function avertismentCui(a: AntetFirma): string | null;
  ```

- [ ] **Pasul 1: Scrie testul care pică**

```ts
// src/lib/unelte/antet-firma.test.ts
import { describe, expect, it } from "vitest";

import {
  antetFirmaDinParametri,
  avertismentCui,
  MAX_COMPARTIMENT,
  MAX_CUI,
  MAX_FIRMA,
  randAntetFirma,
} from "./antet-firma";

/**
 * Auditul din 8 oct 2026: foaia de pontaj n-avea niciun câmp de antet, iar
 * condica doar „firma”. Inspectorul primește o foaie care nu spune al cui e.
 */
describe("antetul de firmă al documentelor de pontaj", () => {
  it("citește firma, CUI-ul și compartimentul, cu spațiile strânse", () => {
    const a = antetFirmaDinParametri(
      new URLSearchParams({ firma: "  Construct   SRL ", cui: " RO 14399840 ", compartiment: "Producție" }),
    );
    expect(a).toEqual({ firma: "Construct SRL", cui: "RO 14399840", compartiment: "Producție" });
  });

  it("lipsa câmpurilor dă șiruri goale, nu `null`", () => {
    expect(antetFirmaDinParametri(new URLSearchParams())).toEqual({
      firma: "",
      cui: "",
      compartiment: "",
    });
  });

  it("taie la plafoane și scoate caracterele de control și pe cele de lățime zero", () => {
    const a = antetFirmaDinParametri(
      new URLSearchParams({
        firma: `Firma\u000CSRL\u200B${"F".repeat(500)}`,
        cui: "1".repeat(50),
        compartiment: `Depozit\u001F${"x".repeat(500)}`,
      }),
    );
    expect(a.firma.startsWith("Firma SRL")).toBe(true);
    expect(a.firma.length).toBeLessThanOrEqual(MAX_FIRMA);
    expect(a.cui.length).toBeLessThanOrEqual(MAX_CUI);
    expect(a.compartiment.length).toBeLessThanOrEqual(MAX_COMPARTIMENT);
    for (const v of Object.values(a)) {
      expect(v).not.toMatch(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/u);
    }
  });

  it("rândul de antet unește doar câmpurile completate", () => {
    expect(randAntetFirma({ firma: "Construct SRL", cui: "14399840", compartiment: "" })).toBe(
      "Construct SRL · CUI 14399840",
    );
    expect(randAntetFirma({ firma: "", cui: "", compartiment: "Bucătărie" })).toBe(
      "Compartiment: Bucătărie",
    );
    expect(randAntetFirma({ firma: "", cui: "", compartiment: "" })).toBeNull();
  });

  it("un CUI cu cifra de control greșită dă avertisment, dar nu e șters", () => {
    const a = { firma: "X", cui: "14399841", compartiment: "" };
    const mesaj = avertismentCui(a);
    expect(mesaj).toMatch(/cifra de control/u);
    expect(mesaj?.endsWith(".")).toBe(true);
    expect(randAntetFirma(a)).toBe("X · CUI 14399841");
  });

  it("un CUI valid, cu sau fără RO și spații, nu dă avertisment", () => {
    for (const cui of ["14399840", "RO 14399840", "ro14399840", ""]) {
      expect(avertismentCui({ firma: "", cui, compartiment: "" })).toBeNull();
    }
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/antet-firma.test.ts`. Rezultatul așteptat: `FAIL … Failed to resolve import "./antet-firma"`.

- [ ] **Pasul 3: Implementarea minimă**

```ts
// src/lib/unelte/antet-firma.ts
import { validateazaCui } from "@/domain/organization/cui";

import { curataText } from "./document-tabelar";

/**
 * Antetul de firmă al documentelor de pontaj: unitatea, CUI-ul, compartimentul.
 *
 * ── DE CE ─────────────────────────────────────────────────────────────────
 * Auditul din 8 oct 2026: foaia de pontaj n-avea niciun câmp de antet, iar
 * condica doar „firma”. O foaie pusă pe masa inspectorului trebuie să spună
 * singură al cui e — papervee și modelele Word gratuite au rubrica.
 *
 * CUI-ul se VERIFICĂ (cifra de control, `validateazaCui`), dar nu BLOCHEAZĂ
 * documentul: o greșeală de tastare în antet nu e un motiv să refuzi foaia.
 * Se trece cum a fost scris, iar pagina spune că nu trece verificarea.
 *
 * Curățarea e cea comună (`curataText`, secțiunea B): un U+000C lipit dintr-un
 * editor devine spațiu, un spațiu de lățime zero dispare.
 */

export type AntetFirma = Readonly<{
  firma: string;
  cui: string;
  compartiment: string;
}>;

export const MAX_FIRMA = 120;
/** „RO 1234567890”: prefixul, un spațiu și cele zece cifre maxime ale unui CUI. */
export const MAX_CUI = 14;
export const MAX_COMPARTIMENT = 60;

function camp(q: URLSearchParams, cheie: string, maxim: number): string {
  return curataText(q.get(cheie) ?? "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxim)
    .trim();
}

export function antetFirmaDinParametri(q: URLSearchParams): AntetFirma {
  return {
    firma: camp(q, "firma", MAX_FIRMA),
    cui: camp(q, "cui", MAX_CUI),
    compartiment: camp(q, "compartiment", MAX_COMPARTIMENT),
  };
}

/** „Construct SRL · CUI 14399840 · Compartiment: Producție”, sau `null` când nu e nimic. */
export function randAntetFirma(a: AntetFirma): string | null {
  const parti = [
    a.firma,
    a.cui === "" ? "" : `CUI ${a.cui}`,
    a.compartiment === "" ? "" : `Compartiment: ${a.compartiment}`,
  ].filter((p) => p !== "");
  return parti.length === 0 ? null : parti.join(" · ");
}

/** Mesajul de sub formular când CUI-ul nu trece verificarea. Nu oprește documentul. */
export function avertismentCui(a: AntetFirma): string | null {
  if (a.cui === "") return null;
  const rezultat = validateazaCui(a.cui);
  return rezultat.valid ? null : `${rezultat.mesaj} L-am trecut în document așa cum l-ai scris.`;
}
```

Notă: în `curataText`, `\u000C` devine spațiu, iar `\u200B` și `\u001F` se șterg. Așa „Firma\u000CSRL\u200BFFF…” iese „Firma SRLFFF…”, iar prefixul verificat de test („Firma SRL”) se păstrează.

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/antet-firma.test.ts`. Rezultatul așteptat: `6 passed`.

- [ ] **Pasul 5: Lanțul complet** (vezi secțiunea „Lanțul de verificare”), cu `pnpm exec prettier --check src/lib/unelte/antet-firma.ts src/lib/unelte/antet-firma.test.ts`.

- [ ] **Commit** — căi: `src/lib/unelte/antet-firma.ts src/lib/unelte/antet-firma.test.ts`. Mesaj: `feat(unelte): antetul de firmă comun foii de pontaj și condicii (firmă, CUI, compartiment)`.

---

### Task E2: Codurile foii de pontaj, aliniate cu modulul de pontaj

**Fișiere:**
- Create: `src/lib/unelte/coduri-pontaj.ts`
- Test: `src/lib/unelte/coduri-pontaj.test.ts`

**Interfețe:**
- Consumă: `CODURI_TIP_ZI: Readonly<Record<TipZi, string>>` din `@/domain/attendance/coduri-zi` (există; `weekend: "L"`, `sarbatoare: "SL"`, `concediu: "CO"`, `medical: "CM"`, `absenta_nemotivata: "AN"`, `delegatie: "D"`)
- Produce:
  ```ts
  export type CodFoaie = Readonly<{ cod: string; denumire: string }>;
  export const CODURI_ABSENTA: readonly CodFoaie[];   // CO, CM, CFS, AN, D — ordinea coloanelor de total
  export const COD_REPAUS: string;                     // "L"
  export const COD_SARBATOARE: string;                 // "SL"
  export const CODURI_LEGENDA: readonly CodFoaie[];    // CODURI_ABSENTA + L + SL
  export const LISTA_CODURI: readonly string[];        // pentru validarea Excel
  export const TEXT_LEGENDA: string;
  ```

- [ ] **Pasul 1: Scrie testul care pică**

```ts
// src/lib/unelte/coduri-pontaj.test.ts
import { describe, expect, it } from "vitest";

import { CODURI_TIP_ZI } from "@/domain/attendance/coduri-zi";

import {
  CODURI_ABSENTA,
  CODURI_LEGENDA,
  COD_REPAUS,
  COD_SARBATOARE,
  LISTA_CODURI,
  TEXT_LEGENDA,
} from "./coduri-pontaj";

/**
 * Foaia gratuită e ușa spre aplicație: dacă ar scrie „N” pentru nemotivat și
 * aplicația „AN”, aceeași hârtie ar avea două legende.
 */
describe("codurile foii de pontaj", () => {
  it("sunt codurile modulului de pontaj, plus CFS", () => {
    expect(CODURI_ABSENTA.map((c) => c.cod)).toEqual(["CO", "CM", "CFS", "AN", "D"]);
    expect(COD_REPAUS).toBe(CODURI_TIP_ZI.weekend);
    expect(COD_SARBATOARE).toBe(CODURI_TIP_ZI.sarbatoare);
    for (const tip of ["concediu", "medical", "absenta_nemotivata", "delegatie"] as const) {
      expect(LISTA_CODURI).toContain(CODURI_TIP_ZI[tip]);
    }
  });

  it("lista de validare are coduri unice, scurte, fără virgulă, sub limita Excel", () => {
    expect(new Set(LISTA_CODURI).size).toBe(LISTA_CODURI.length);
    for (const cod of LISTA_CODURI) expect(cod).toMatch(/^[A-Z]{1,3}$/u);
    // O listă scrisă direct în validare nu poate trece de 255 de caractere.
    expect(LISTA_CODURI.join(",").length).toBeLessThan(255);
    expect(LISTA_CODURI).toEqual(CODURI_LEGENDA.map((c) => c.cod));
  });

  it("legenda numește fiecare cod și se termină cu punct", () => {
    for (const cod of LISTA_CODURI) expect(TEXT_LEGENDA).toContain(`${cod} = `);
    expect(TEXT_LEGENDA.startsWith("Legendă: cifra = ore lucrate;")).toBe(true);
    expect(TEXT_LEGENDA.endsWith(".")).toBe(true);
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `pnpm exec vitest run src/lib/unelte/coduri-pontaj.test.ts`. Rezultatul așteptat: `Failed to resolve import "./coduri-pontaj"`.

- [ ] **Pasul 3: Implementarea minimă**

```ts
// src/lib/unelte/coduri-pontaj.ts
import { CODURI_TIP_ZI } from "@/domain/attendance/coduri-zi";

/**
 * Codurile foii de pontaj și ale condicii gratuite.
 *
 * ── DE CE DIN `CODURI_TIP_ZI` ─────────────────────────────────────────────
 * Aplicația scrie în foaia colectivă din arhiva lunară CO, CM, AN, D, L și SL
 * (`src/domain/attendance/coduri-zi.ts`). Unealta gratuită folosește exact
 * aceleași litere: cine trece de pe hârtie în aplicație nu învață altă legendă.
 *
 * CFS e singurul cod în plus. Aplicația ține concediul fără salariu ca TIP DE
 * CONCEDIU (`fara_plata`), nu ca tip de zi, deci n-are cod de celulă; pe o
 * foaie de hârtie, fără el, contabilul l-ar scrie de mână, fiecare altfel.
 *
 * Orele suplimentare și cele de noapte NU sunt coduri: au coloane proprii, ca
 * „Supl.” și „Noapte” din arhiva aplicației.
 */

export type CodFoaie = Readonly<{ cod: string; denumire: string }>;

/** Absențele numărate în coloanele de total, în ordinea coloanelor. */
export const CODURI_ABSENTA: readonly CodFoaie[] = [
  { cod: CODURI_TIP_ZI.concediu, denumire: "concediu de odihnă" },
  { cod: CODURI_TIP_ZI.medical, denumire: "concediu medical" },
  { cod: "CFS", denumire: "concediu fără salariu" },
  { cod: CODURI_TIP_ZI.absenta_nemotivata, denumire: "absență nemotivată" },
  { cod: CODURI_TIP_ZI.delegatie, denumire: "delegație" },
];

/** Ziua din afara programului: repaus săptămânal. */
export const COD_REPAUS = CODURI_TIP_ZI.weekend;

/** Sărbătoare legală în care nu se lucrează. */
export const COD_SARBATOARE = CODURI_TIP_ZI.sarbatoare;

export const CODURI_LEGENDA: readonly CodFoaie[] = [
  ...CODURI_ABSENTA,
  { cod: COD_REPAUS, denumire: "zi de repaus" },
  { cod: COD_SARBATOARE, denumire: "sărbătoare legală" },
];

/** Lista din validarea Excel: aceleași coduri, în ordinea legendei. */
export const LISTA_CODURI: readonly string[] = CODURI_LEGENDA.map((c) => c.cod);

export const TEXT_LEGENDA = `Legendă: cifra = ore lucrate; ${CODURI_LEGENDA.map(
  (c) => `${c.cod} = ${c.denumire}`,
).join("; ")}.`;
```

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run src/lib/unelte/coduri-pontaj.test.ts`. Rezultatul așteptat: `3 passed`.

- [ ] **Pasul 5: Lanțul complet**, plus `prettier --check` pe cele două fișiere.

- [ ] **Commit** — căi: `src/lib/unelte/coduri-pontaj.ts src/lib/unelte/coduri-pontaj.test.ts`. Mesaj: `feat(unelte): codurile foii de pontaj, aliniate cu modulul de pontaj (CO, CM, CFS, AN, D, L, SL)`.

---

### Task E3: Modelul pontajului — program, normă pe angajat, variantă

**Fișiere:**
- Create: `src/app/(marketing)/unelte/foaie-de-pontaj/pontaj.ts`
- Test: `src/app/(marketing)/unelte/foaie-de-pontaj/pontaj.test.ts`

**Interfețe:**
- Consumă (toate verificate cu grep pe e906d2c):
  - `construiesteFoaie(an, luna, angajati: readonly string[], oreZi): Foaie`, `LUNI`, `MAX_ANGAJATI`, `normalizeazaAn`, `normalizeazaLuna`, `normalizeazaOre` din `./foaie` (existente); din B, tot din `./foaie`: `citesteAngajati(brut): ListaAngajati` și `type ListaAngajati` (B3), `notaOmisi(lista): string | null` (B4), `oreFoaie(ore): string` (B7)
  - `ziIso(an, luna, zi): string` din `@/domain/calendar/grila-lunara`
  - `parseOre(input: string): number | null` din `@/lib/format/ore`
  - `cuDe(n: number, substantiv: string): string` din `@/content/legal/zile-libere`
  - `antetFirmaDinParametri`, `type AntetFirma` din `@/lib/unelte/antet-firma` (E1)
  - `COD_REPAUS`, `COD_SARBATOARE` din `@/lib/unelte/coduri-pontaj` (E2)
- Produce:
  ```ts
  export type Program = "lv" | "ls" | "ture";
  export type Varianta = "colectiva" | "individuala";
  export const PROGRAME: readonly Readonly<{ valoare: Program; eticheta: string }>[];
  export const VARIANTE: readonly Readonly<{ valoare: Varianta; eticheta: string }>[];
  export const CHEI_PONTAJ: readonly ["an","luna","ore","program","varianta","firma","cui","compartiment","angajati"];
  export function normalizeazaProgram(brut: string | null): Program;
  export function normalizeazaVarianta(brut: string | null): Varianta;
  export function etichetaProgram(program: Program): string;          // „luni–vineri”
  export type ZiPontaj = Readonly<{ zi: number; iso: string; data: string; dataScurta: string; dow: number;
    numeZi: string; ziScurta: string; litera: string; sarbatoare: string | null; inProgram: boolean; codImplicit: string }>;
  export function ziInProgram(dow: number, sarbatoare: string | null, program: Program): boolean;
  export function zileDinLuna(an: number, luna: number, program: Program): readonly ZiPontaj[];
  export function oreDinText(brut: string): number | null;
  export function oreScurt(ore: number): string;                      // „8”, „7:30”
  export type AngajatPontaj = Readonly<{ nume: string; oreZi: number }>;
  export type LiniiAngajati = Readonly<{ angajati: readonly AngajatPontaj[]; lista: ListaAngajati; avertismente: readonly string[] }>;
  export function liniiAngajati(brut: string | undefined, oreImplicite: number): LiniiAngajati;
  export type ParametriPontaj = Readonly<{ an: number; luna: number; oreZi: number; program: Program;
    varianta: Varianta; antet: AntetFirma; linii: LiniiAngajati }>;
  export function parametriPontaj(q: URLSearchParams, acum?: Date): ParametriPontaj;
  export type Pontaj = Readonly<{ an: number; luna: number; eticheta: string; oreZi: number; program: Program;
    varianta: Varianta; antet: AntetFirma; zile: readonly ZiPontaj[]; zileLucratoare: number; angajati: readonly AngajatPontaj[];
    notaAngajati: string | null }>;
  export function construiestePontaj(p: ParametriPontaj): Pontaj;
  export function normaLunara(zileLucratoare: number, oreZi: number): number;
  export function rezumatNorma(p: Pontaj): string;
  export function angajatiPentruFise(p: Pontaj): readonly [AngajatPontaj, ...AngajatPontaj[]];
  export function numeFisierPontaj(p: Pontaj): string;
  ```

- [ ] **Pasul 1: Scrie testul care pică**

```ts
// src/app/(marketing)/unelte/foaie-de-pontaj/pontaj.test.ts
import { describe, expect, it } from "vitest";

import { MAX_ANGAJATI, notaOmisi } from "./foaie";
import {
  angajatiPentruFise,
  construiestePontaj,
  liniiAngajati,
  numeFisierPontaj,
  oreDinText,
  oreScurt,
  parametriPontaj,
  rezumatNorma,
  zileDinLuna,
} from "./pontaj";

/*
 * Decembrie 2026: 1 dec (marți) și 25 dec (vineri) sunt sărbători în timpul
 * săptămânii, 26 dec e sărbătoare într-o sâmbătă. 21 de zile lucrătoare.
 */

describe("zilele lunii, după program", () => {
  it("luni–vineri: weekendul primește L, sărbătoarea SL, restul rămân libere", () => {
    const zile = zileDinLuna(2026, 12, "lv");
    const zi = (n: number) => zile[n - 1];
    expect(zi(1)?.codImplicit).toBe("SL");
    expect(zi(2)?.codImplicit).toBe("");
    expect(zi(5)?.codImplicit).toBe("L");
    expect(zi(6)?.codImplicit).toBe("L");
    expect(zi(26)?.codImplicit).toBe("SL");
    expect(zile.filter((z) => z.inProgram)).toHaveLength(21);
    expect(zi(1)).toMatchObject({ data: "01.12.2026", dataScurta: "01.12", numeZi: "marți", ziScurta: "Ma" });
  });

  it("luni–sâmbătă: sâmbetele intră în program, sâmbăta de Crăciun nu", () => {
    const zile = zileDinLuna(2026, 12, "ls");
    expect(zile[4]?.inProgram).toBe(true); // 5 dec, sâmbătă
    expect(zile[25]?.codImplicit).toBe("SL"); // 26 dec, sâmbătă și sărbătoare
    expect(zile[5]?.codImplicit).toBe("L"); // 6 dec, duminică
    expect(zile.filter((z) => z.inProgram)).toHaveLength(24);
  });

  it("ture: toate zilele sunt deschise, fără cod pus dinainte", () => {
    const zile = zileDinLuna(2026, 12, "ture");
    expect(zile.every((z) => z.inProgram && z.codImplicit === "")).toBe(true);
    expect(zile[24]?.sarbatoare).toBe("Crăciunul"); // marcajul rămâne în date
  });
});

describe("liniile cu angajați", () => {
  it("citesc norma după bară sau după TAB, în ore, zecimale sau ceas", () => {
    const l = liniiAngajati(
      "Popa Ion\nIlie Maria | 4\nRadu Andrei\t6:30\n\nVasile Ana | 7,5\nDinu Ioan | 4h",
      8,
    );
    expect(l.angajati).toEqual([
      { nume: "Popa Ion", oreZi: 8 },
      { nume: "Ilie Maria", oreZi: 4 },
      { nume: "Radu Andrei", oreZi: 6.5 },
      { nume: "Vasile Ana", oreZi: 7.5 },
      { nume: "Dinu Ioan", oreZi: 4 },
    ]);
    expect(l.avertismente).toEqual([]);
    expect(l.lista).toMatchObject({ total: 5, omisi: 0 });
  });

  it("„Popa⇥Ion”, fără număr după TAB, rămâne un singur om (regula lui B: tabul e spațiu)", () => {
    const l = liniiAngajati("Popa\tIon", 8);
    expect(l.angajati).toEqual([{ nume: "Popa Ion", oreZi: 8 }]);
    expect(l.avertismente).toEqual([]);
  });

  it("acceptă două coloane lipite din Excel, cu CRLF și TAB final", () => {
    const l = liniiAngajati("Popa Ion\t4\r\nIlie Maria\t\r\nRadu\tAndrei\t6\r\n", 8);
    expect(l.angajati).toEqual([
      { nume: "Popa Ion", oreZi: 4 },
      { nume: "Ilie Maria", oreZi: 8 },
      { nume: "Radu Andrei", oreZi: 6 },
    ]);
  });

  it("o normă care nu se citește păstrează omul, cu norma comună și un avertisment", () => {
    const l = liniiAngajati("Ilie Maria | patru\nPopa Ion | 30", 8);
    expect(l.angajati).toEqual([
      { nume: "Ilie Maria", oreZi: 8 },
      { nume: "Popa Ion", oreZi: 8 },
    ]);
    expect(l.avertismente).toHaveLength(2);
    expect(l.avertismente[0]).toMatch(/Ilie Maria/u);
    for (const a of l.avertismente) expect(a.endsWith(".")).toBe(true);
  });

  it("lista goală dă zece rânduri necompletate, cu norma comună", () => {
    const l = liniiAngajati("  \n\n", 6);
    expect(l.angajati).toHaveLength(10);
    expect(l.angajati.every((a) => a.nume === "" && a.oreZi === 6)).toBe(true);
    expect(l.lista).toMatchObject({ total: 0, omisi: 0 });
  });

  it(`peste ${String(MAX_ANGAJATI)} de nume, lista spune câți au rămas pe dinafară (pentru avizul și nota lui B)`, () => {
    const brut = Array.from({ length: MAX_ANGAJATI + 5 }, (_, i) => `Om ${String(i)} | 4`).join("\n");
    const l = liniiAngajati(brut, 8);
    expect(l.angajati).toHaveLength(MAX_ANGAJATI);
    expect(l.angajati.every((a) => a.oreZi === 4)).toBe(true);
    expect(l.lista).toMatchObject({ total: MAX_ANGAJATI + 5, omisi: 5, scurtate: 0 });
    expect(l.lista.nume).toEqual(l.angajati.map((a) => a.nume));
    expect(notaOmisi(l.lista)).toContain("ceilalți 5 nu apar aici");
  });
});

describe("orele scrise de om", () => {
  it("oreDinText acceptă 4, 4h, 7,5, 7.25 și 6:30, refuză restul", () => {
    expect(oreDinText("4")).toBe(4);
    expect(oreDinText("4h")).toBe(4);
    expect(oreDinText("7,5")).toBe(7.5);
    expect(oreDinText("7.25")).toBe(7.25);
    expect(oreDinText("6:30")).toBe(6.5);
    for (const rau of ["0", "25", "8:75", "patru", "", "4 ore"]) expect(oreDinText(rau)).toBeNull();
  });

  it("oreScurt scrie orele întregi ca număr și restul ca ceas (oreFoaie fără „ h”)", () => {
    expect(oreScurt(8)).toBe("8");
    expect(oreScurt(7.5)).toBe("7:30");
    expect(oreScurt(10.5)).toBe("10:30");
  });
});

describe("pontajul din adresă", () => {
  it("citește programul, varianta, orele și antetul", () => {
    const p = parametriPontaj(
      new URLSearchParams({
        an: "2026",
        luna: "12",
        ore: "6",
        program: "ture",
        varianta: "individuala",
        firma: " Construct  SRL ",
        cui: "RO 14399840",
        angajati: "Popa Ion",
      }),
    );
    expect(p).toMatchObject({ an: 2026, luna: 12, oreZi: 6, program: "ture", varianta: "individuala" });
    expect(p.antet.firma).toBe("Construct SRL");
    expect(p.linii.angajati).toEqual([{ nume: "Popa Ion", oreZi: 6 }]);
  });

  it("fără parametri: luna curentă, luni–vineri, colectivă", () => {
    const p = parametriPontaj(new URLSearchParams(), new Date(Date.UTC(2026, 9, 8)));
    expect(p).toMatchObject({ an: 2026, luna: 10, oreZi: 8, program: "lv", varianta: "colectiva" });
  });

  it("norma rămâne pe zilele de luni–vineri, oricare ar fi programul, rotunjită și scrisă în ceas", () => {
    for (const program of ["lv", "ls", "ture"]) {
      const pontaj = construiestePontaj(
        parametriPontaj(new URLSearchParams({ an: "2026", luna: "12", ore: "7.3", program })),
      );
      expect(pontaj.zileLucratoare).toBe(21);
    }
    const pontaj = construiestePontaj(
      parametriPontaj(new URLSearchParams({ an: "2026", luna: "12", ore: "7.3" })),
    );
    // Auditul: „153.29999999999998 h normă”. 7,3 h = 7:18; 21 × 7,3 = 153,3 h = 153:18.
    expect(rezumatNorma(pontaj)).toBe(
      "21 de zile lucrătoare × 7:18 h = 153:18 h normă · program luni–vineri",
    );
  });

  it("pontajul poartă nota de listă tăiată a lui B, doar când lista a fost tăiată", () => {
    const multi = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");
    const taiat = construiestePontaj(parametriPontaj(new URLSearchParams({ angajati: multi })));
    expect(taiat.notaAngajati).toBe(
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.",
    );
    const intreg = construiestePontaj(parametriPontaj(new URLSearchParams({ angajati: "Popa Ion" })));
    expect(intreg.notaAngajati).toBeNull();
  });

  it("fișele individuale: fără nume, o singură fișă necompletată", () => {
    const pontaj = construiestePontaj(
      parametriPontaj(new URLSearchParams({ an: "2026", luna: "12", varianta: "individuala" })),
    );
    expect(angajatiPentruFise(pontaj)).toEqual([{ nume: "", oreZi: 8 }]);
    expect(numeFisierPontaj(pontaj)).toBe("fise-pontaj-2026-12");
  });

  it("numele fișierului colectiv rămâne cel de până acum", () => {
    const pontaj = construiestePontaj(
      parametriPontaj(new URLSearchParams({ an: "2026", luna: "3" })),
    );
    expect(numeFisierPontaj(pontaj)).toBe("pontaj-2026-03");
    expect(pontaj.eticheta).toBe("martie 2026");
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/foaie-de-pontaj/pontaj.test.ts"`. Rezultatul așteptat: `Failed to resolve import "./pontaj"`.

- [ ] **Pasul 3: Implementarea minimă**

```ts
// src/app/(marketing)/unelte/foaie-de-pontaj/pontaj.ts
import { cuDe } from "@/content/legal/zile-libere";
import { ziIso } from "@/domain/calendar/grila-lunara";
import { parseOre } from "@/lib/format/ore";
import { antetFirmaDinParametri, type AntetFirma } from "@/lib/unelte/antet-firma";
import { COD_REPAUS, COD_SARBATOARE } from "@/lib/unelte/coduri-pontaj";

import {
  citesteAngajati,
  construiesteFoaie,
  LUNI,
  MAX_ANGAJATI,
  normalizeazaAn,
  normalizeazaLuna,
  normalizeazaOre,
  notaOmisi,
  oreFoaie,
  type ListaAngajati,
} from "./foaie";

/**
 * Pontajul lunar ales în formular: luna, programul, varianta, antetul și
 * oamenii, fiecare cu norma lui.
 *
 * ── DE CE UN FIȘIER NOU, NU `foaie.ts` ────────────────────────────────────
 * `construiesteFoaie` o mai folosesc foaia de parcurs, cererea de concediu și
 * condica, cu semnătura de azi. Ce e nou după auditul din 8 oct 2026 —
 * programul pe ture, norma pe angajat, fișa individuală — stă aici, fără să
 * mute nimic sub picioarele celorlalte unelte.
 *
 * ── NORMA ─────────────────────────────────────────────────────────────────
 * Zilele lucrătoare de luni până vineri, fără sărbători, × orele pe zi — ORICARE
 * ar fi programul. Așa o socotește salarizarea: cine lucrează în ture are
 * aceeași normă lunară, doar repartizată altfel.
 */

export type Program = "lv" | "ls" | "ture";
export type Varianta = "colectiva" | "individuala";

export const PROGRAME: readonly Readonly<{ valoare: Program; eticheta: string }>[] = [
  { valoare: "lv", eticheta: "Luni–vineri" },
  { valoare: "ls", eticheta: "Luni–sâmbătă" },
  { valoare: "ture", eticheta: "Toate zilele (ture)" },
];

export const VARIANTE: readonly Readonly<{ valoare: Varianta; eticheta: string }>[] = [
  { valoare: "colectiva", eticheta: "Colectivă — un rând pe angajat, orele pe zi" },
  {
    valoare: "individuala",
    eticheta: "Individuală — o fișă pe angajat, cu ora de început și de sfârșit",
  },
];

/** Parametrii din adresă pe care îi citește unealta. Pagina îi copiază din `searchParams`. */
export const CHEI_PONTAJ = [
  "an",
  "luna",
  "ore",
  "program",
  "varianta",
  "firma",
  "cui",
  "compartiment",
  "angajati",
] as const;

export function normalizeazaProgram(brut: string | null): Program {
  return brut === "ls" || brut === "ture" ? brut : "lv";
}

export function normalizeazaVarianta(brut: string | null): Varianta {
  return brut === "individuala" ? "individuala" : "colectiva";
}

/** „luni–vineri”, „luni–sâmbătă”, „toate zilele (ture)” — pentru mijlocul unei fraze. */
export function etichetaProgram(program: Program): string {
  return (PROGRAME.find((p) => p.valoare === program)?.eticheta ?? "Luni–vineri").toLowerCase();
}

/** Indexate după `getUTCDay()`: duminica e prima. */
const NUME_ZI = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"] as const;
const ZI_SCURTA = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sâ"] as const;

export type ZiPontaj = Readonly<{
  zi: number;
  /** „2026-12-01” */
  iso: string;
  /** „01.12.2026” */
  data: string;
  /** „01.12” */
  dataScurta: string;
  /** 0 = duminică … 6 = sâmbătă */
  dow: number;
  numeZi: string;
  ziScurta: string;
  /** Inițiala din capul foii colective, aceeași ca până acum. */
  litera: string;
  sarbatoare: string | null;
  inProgram: boolean;
  /** Ce se scrie dinainte în celula zilei: "" în program, altfel L sau SL. */
  codImplicit: string;
}>;

export function ziInProgram(dow: number, sarbatoare: string | null, program: Program): boolean {
  if (program === "ture") return true;
  if (sarbatoare !== null || dow === 0) return false;
  return dow !== 6 || program === "ls";
}

export function zileDinLuna(an: number, luna: number, program: Program): readonly ZiPontaj[] {
  const ll = String(luna).padStart(2, "0");
  return construiesteFoaie(an, luna, [], 8).zile.map((z) => {
    const dow = new Date(Date.UTC(an, luna - 1, z.zi)).getUTCDay();
    const inProgram = ziInProgram(dow, z.sarbatoare, program);
    const dd = String(z.zi).padStart(2, "0");
    return {
      zi: z.zi,
      iso: ziIso(an, luna, z.zi),
      data: `${dd}.${ll}.${String(an)}`,
      dataScurta: `${dd}.${ll}`,
      dow,
      numeZi: NUME_ZI[dow] ?? "",
      ziScurta: ZI_SCURTA[dow] ?? "",
      litera: z.litera,
      sarbatoare: z.sarbatoare,
      inProgram,
      codImplicit: inProgram ? "" : z.sarbatoare !== null ? COD_SARBATOARE : COD_REPAUS,
    };
  });
}

/**
 * Orele pe zi scrise de om după nume: „4”, „4h”, „7,5”, „7.25”, „6:30”.
 * `null` pentru orice altceva sau în afara intervalului (0, 24].
 */
export function oreDinText(brut: string): number | null {
  const t = brut.trim().toLowerCase();
  let ore: number | null = null;
  if (/^\d{1,2}:\d{2}$/u.test(t)) ore = parseOre(t);
  else if (/^\d{1,2}(?:[.,]\d{1,2})?\s*h?$/u.test(t)) {
    ore = Number(t.replace(/\s*h$/u, "").replace(",", "."));
  }
  if (ore === null || !Number.isFinite(ore) || ore <= 0 || ore > 24) return null;
  return Math.round(ore * 100) / 100;
}

/**
 * „8”, „7:30”, „10:30”: `oreFoaie` (secțiunea B, regula ceasului) fără unitate,
 * pentru celulele înguste („h/zi”), unde „ h” nu încape.
 */
export function oreScurt(ore: number): string {
  return oreFoaie(ore).replace(/ h$/u, "");
}

export type AngajatPontaj = Readonly<{ nume: string; oreZi: number }>;

export type LiniiAngajati = Readonly<{
  angajati: readonly AngajatPontaj[];
  /**
   * Lista în forma lui B (`ListaAngajati`): numele, câte au venit, câte au rămas
   * pe dinafară, câte s-au scurtat. Din ea ies avizul de pe pagină
   * (`avizAngajati`) și nota din fișier (`notaOmisi`) — nu se scriu a doua oară.
   */
  lista: ListaAngajati;
  avertismente: readonly string[];
}>;

/** Rândul nou „tare”. Celelalte despărțitoare (U+000B, NEL, U+2028…) le tratează `citesteAngajati`. */
const RAND_NOU = /\r\n|[\n\r]/u;

/**
 * Norma de pe un rând: după ultima bară verticală, oricare ar fi; după ultimul
 * TAB, doar dacă ce urmează e un număr de ore. Altfel TAB-ul rămâne al numelui,
 * iar `citesteAngajati` îl face spațiu: „Popa⇥Ion” e un singur om (regula lui B),
 * „Popa Ion⇥4” e un om cu 4 h pe zi (două coloane lipite din Excel).
 */
function desparteNorma(linie: string): Readonly<{ text: string; norma: string | null }> {
  const bara = linie.lastIndexOf("|");
  if (bara >= 0) {
    return { text: linie.slice(0, bara).replace(/\|/gu, " "), norma: linie.slice(bara + 1).trim() };
  }
  const tab = linie.lastIndexOf("\t");
  if (tab >= 0 && oreDinText(linie.slice(tab + 1)) !== null) {
    return { text: linie.slice(0, tab), norma: linie.slice(tab + 1).trim() };
  }
  return { text: linie, norma: null };
}

/**
 * Câte un om pe rând, opțional cu norma lui: „Ilie Maria | 4”.
 *
 * Norma se scoate ÎNAINTE, apoi restul rândului trece prin `citesteAngajati`:
 * aceleași reguli de nume ca în toată secțiunea B (curățare, doar rândul nou
 * desparte, plafonul de 60 de oameni și de 80 de caractere). O normă care nu se
 * citește NU oprește foaia: omul primește norma comună, iar pagina spune de ce.
 */
export function liniiAngajati(brut: string | undefined, oreImplicite: number): LiniiAngajati {
  const angajati: AngajatPontaj[] = [];
  const avertismente: string[] = [];
  let total = 0;
  let scurtate = 0;
  for (const linie of (brut ?? "").split(RAND_NOU)) {
    const { text, norma } = desparteNorma(linie);
    const citite = citesteAngajati(text);
    if (citite.total === 0) continue;
    total += citite.total;
    const loc = MAX_ANGAJATI - angajati.length;
    if (loc <= 0) continue;
    scurtate += citite.scurtate;
    const oreLinie = norma === null || norma === "" ? null : oreDinText(norma);
    for (const nume of citite.nume.slice(0, loc)) {
      if (norma !== null && norma !== "" && oreLinie === null) {
        avertismente.push(
          `„${norma.slice(0, 12)}” de lângă ${nume} nu e un număr de ore între 0 și 24; am pus norma comună, ${oreFoaie(oreImplicite)}.`,
        );
      }
      angajati.push({ nume, oreZi: oreLinie ?? oreImplicite });
    }
  }
  const lista: ListaAngajati = {
    // Foaia are rost și necompletată: se tipărește și se scrie cu pixul.
    nume: angajati.length > 0 ? angajati.map((x) => x.nume) : Array.from({ length: 10 }, () => ""),
    total,
    omisi: total - angajati.length,
    scurtate,
  };
  return {
    angajati:
      angajati.length > 0
        ? angajati
        : Array.from({ length: 10 }, () => ({ nume: "", oreZi: oreImplicite })),
    lista,
    avertismente,
  };
}

export type ParametriPontaj = Readonly<{
  an: number;
  luna: number;
  oreZi: number;
  program: Program;
  varianta: Varianta;
  antet: AntetFirma;
  linii: LiniiAngajati;
}>;

export function parametriPontaj(q: URLSearchParams, acum: Date = new Date()): ParametriPontaj {
  const oreZi = normalizeazaOre(q.get("ore") ?? undefined);
  return {
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    oreZi,
    program: normalizeazaProgram(q.get("program")),
    varianta: normalizeazaVarianta(q.get("varianta")),
    antet: antetFirmaDinParametri(q),
    linii: liniiAngajati(q.get("angajati") ?? undefined, oreZi),
  };
}

export type Pontaj = Readonly<{
  an: number;
  luna: number;
  /** „decembrie 2026” */
  eticheta: string;
  oreZi: number;
  program: Program;
  varianta: Varianta;
  antet: AntetFirma;
  zile: readonly ZiPontaj[];
  /** Luni–vineri, fără sărbători — baza normei, oricare ar fi programul. */
  zileLucratoare: number;
  angajati: readonly AngajatPontaj[];
  /** Nota lui B pentru fișier când lista a trecut de 60 de nume; `null` altfel. */
  notaAngajati: string | null;
}>;

export function construiestePontaj(p: ParametriPontaj): Pontaj {
  const zile = zileDinLuna(p.an, p.luna, p.program);
  return {
    an: p.an,
    luna: p.luna,
    eticheta: `${LUNI[p.luna - 1] ?? ""} ${String(p.an)}`,
    oreZi: p.oreZi,
    program: p.program,
    varianta: p.varianta,
    antet: p.antet,
    zile,
    zileLucratoare: zile.filter((z) => z.dow !== 0 && z.dow !== 6 && z.sarbatoare === null).length,
    angajati: p.linii.angajati,
    notaAngajati: notaOmisi(p.linii.lista),
  };
}

/** Rotunjită la sutimi: 21 × 7,3 dădea 153,29999999999998 (auditul din 8 oct 2026). */
export function normaLunara(zileLucratoare: number, oreZi: number): number {
  return Math.round(zileLucratoare * oreZi * 100) / 100;
}

/**
 * „21 de zile lucrătoare × 8 h = 168 h normă · program luni–vineri”: textul
 * normei din secțiunea B (`textNorma`: aceleași `oreFoaie` și `cuDe`), plus
 * programul ales.
 */
export function rezumatNorma(p: Pontaj): string {
  const norma = oreFoaie(normaLunara(p.zileLucratoare, p.oreZi));
  return `${cuDe(p.zileLucratoare, "zile lucrătoare")} × ${oreFoaie(p.oreZi)} = ${norma} normă · program ${etichetaProgram(p.program)}`;
}

/** Angajații cu nume. Fără niciunul, o singură fișă necompletată — nu zece. */
export function angajatiPentruFise(p: Pontaj): readonly [AngajatPontaj, ...AngajatPontaj[]] {
  const [primul, ...restul] = p.angajati.filter((a) => a.nume !== "");
  return primul === undefined ? [{ nume: "", oreZi: p.oreZi }] : [primul, ...restul];
}

export function numeFisierPontaj(p: Pontaj): string {
  const prefix = p.varianta === "individuala" ? "fise-pontaj" : "pontaj";
  return `${prefix}-${String(p.an)}-${String(p.luna).padStart(2, "0")}`;
}
```

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/foaie-de-pontaj/"`. Rezultatul așteptat: noul `pontaj.test.ts` are 17 teste trecute; `foaie.test.ts` și `foaie-document.test.ts` (ale lui B) trec neschimbate.

- [ ] **Pasul 5: Lanțul complet**, plus `prettier --check` pe cele două fișiere.

- [ ] **Commit** — căi: `"src/app/(marketing)/unelte/foaie-de-pontaj/pontaj.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/pontaj.test.ts"`. Mesaj: `feat(unelte): modelul pontajului — program pe ture, normă pe angajat, variantă individuală`.

---
### Task E4: PDF-ul uneltelor — chenar vizibil, rând de semnătură, antet repetat, „Pagina X din Y”, mai multe documente

**Fișiere:**
- Modify: `src/lib/unelte/document-tabelar.ts` (tipul `DocumentTabelar`, liniile 27–50; plus două funcții noi după `SEMNATURA_FISIER`, linia 53)
- Modify: `src/lib/unelte/pdf.ts` (importurile de la liniile 3–22, constantele de la liniile 32–36 și `randeazaPdf` de la liniile 77–230)
- Test: `src/lib/unelte/pdf-pagini.test.ts` (nou; `randari.test.ts` rămâne neatins și trebuie să treacă)

**Interfețe:**
- Consumă: `pornesteDocument`, `GRI`, `INALTIME_A4`, `LATIME_A4`, `MARGINE`, `NEGRU`, `type Fonturi` din `@/lib/pdf/document` (toate exportate; `Fonturi` e `export interface`, linia ~62)
- Produce:
  ```ts
  // document-tabelar.ts
  // în DocumentTabelar:  inaltimeRand?: number;
  export function textAntetRulant(d: DocumentTabelar): string;
  export function textPagina(index: number, total: number): string | null;
  // pdf.ts
  export function latimiColoane(d: DocumentTabelar): readonly number[];
  export async function randeazaPdf(d: DocumentTabelar): Promise<Uint8Array>;            // semnătura nu se schimbă
  export async function randeazaPdfMultiplu(documente: readonly DocumentTabelar[]): Promise<Uint8Array>;
  ```

- [ ] **Pasul 0:** Rulează `git log --oneline e906d2c.. -- src/lib/unelte/pdf.ts src/lib/unelte/document-tabelar.ts`. Dacă B a schimbat fișierele, păstrează-i schimbarea în blocurile de mai jos.

- [ ] **Pasul 1: Scrie testul care pică**

```ts
// src/lib/unelte/pdf-pagini.test.ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { textAntetRulant, textPagina, type DocumentTabelar } from "./document-tabelar";
import { latimiColoane, randeazaPdf, randeazaPdfMultiplu } from "./pdf";

/**
 * Auditul din 8 oct 2026, pe condică: chenar #D9DBE0 de 0,5 pt, rânduri de
 * 16 pt (5,6 mm) pentru semnătură, iar pagina 2+ fără lună, fără firmă și fără
 * număr de pagină. Fișa individuală de pontaj cere, în plus, mai multe
 * documente într-un singur PDF: câte o fișă pe angajat.
 */
function baza(randuri: number, extra: Partial<DocumentTabelar> = {}): DocumentTabelar {
  return {
    titlu: "Condica de prezență — decembrie 2026",
    subtitlu: "Construct SRL",
    campuri: [],
    paragrafe: [],
    coloane: [
      { eticheta: "Data", latime: 2 },
      { eticheta: "Nume", latime: 6 },
      { eticheta: "Semnătura", latime: 3 },
    ],
    randuri: Array.from({ length: randuri }, (_, i) => [String(i + 1), "Popa Ion", ""]),
    umbrite: [],
    note: [],
    semnaturi: [],
    orientare: "portret",
    numeFisier: "proba",
    ...extra,
  };
}

const pagini = async (octeti: Uint8Array) => (await PDFDocument.load(octeti)).getPageCount();

describe("textele de pe marginea paginii", () => {
  it("„Pagina X din Y” doar când documentul are mai multe pagini", () => {
    expect(textPagina(0, 1)).toBeNull();
    expect(textPagina(1, 3)).toBe("Pagina 2 din 3");
  });

  it("antetul rulant are titlul și, când există, subtitlul", () => {
    expect(textAntetRulant(baza(1))).toBe("Condica de prezență — decembrie 2026 · Construct SRL");
    expect(textAntetRulant(baza(1, { subtitlu: null }))).toBe("Condica de prezență — decembrie 2026");
  });
});

describe("randarea PDF", () => {
  it("rândurile de semnătură, de 22 pt, cer mai multe pagini decât cele de 16 pt", async () => {
    const joase = await pagini(await randeazaPdf(baza(80)));
    const inalte = await pagini(await randeazaPdf(baza(80, { inaltimeRand: 22 })));
    expect(inalte).toBeGreaterThan(joase);
  });

  it("mai multe documente intră în același fișier, fiecare de la pagină nouă", async () => {
    expect(await pagini(await randeazaPdfMultiplu([baza(5), baza(5)]))).toBe(2);
    const lung = await pagini(await randeazaPdf(baza(80)));
    expect(await pagini(await randeazaPdfMultiplu([baza(80), baza(5)]))).toBe(lung + 1);
  });

  it("fără documente refuză, nu produce un PDF gol", async () => {
    await expect(randeazaPdfMultiplu([])).rejects.toThrow(/Niciun document/u);
  });

  it("lățimile coloanelor umplu exact lățimea utilă a paginii", () => {
    const portret = latimiColoane(baza(1)).reduce((s, w) => s + w, 0);
    expect(portret).toBeCloseTo(595.28 - 2 * 40, 6);
    const peisaj = latimiColoane(baza(1, { orientare: "peisaj" })).reduce((s, w) => s + w, 0);
    expect(peisaj).toBeCloseTo(841.89 - 2 * 40, 6);
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `pnpm exec vitest run src/lib/unelte/pdf-pagini.test.ts`. Rezultatul așteptat: eroare de import, `textAntetRulant`/`textPagina`/`latimiColoane`/`randeazaPdfMultiplu` „is not a function” sau „does not provide an export named”. Sub typecheck se vede și „Object literal may only specify known properties, and 'inaltimeRand'…”.

- [ ] **Pasul 3: Implementarea minimă**

În `src/lib/unelte/document-tabelar.ts`, blocul vechi (sfârșitul tipului):

```ts
  /**
   * Pagina uneltei, fără domeniu (`/unelte/foaie-de-parcurs`). O pune ruta de
   * descărcare; rândul de jos al fișierului devine legătură spre ea.
   */
  sursa?: string;
}>;

/** Textul rândului de jos, același în toate formatele. */
export const SEMNATURA_FISIER = "Generat gratuit cu administrativo.ro";
```

devine:

```ts
  /**
   * Pagina uneltei, fără domeniu (`/unelte/foaie-de-parcurs`). O pune ruta de
   * descărcare; rândul de jos al fișierului devine legătură spre ea.
   */
  sursa?: string;
  /**
   * Înălțimea minimă a unui rând din corpul tabelului, în puncte. Absentă = 16,
   * cât încape un rând de text. Condica o ridică la 22: acolo se semnează de
   * mână pe fiecare rând (auditul din 8 oct 2026 a măsurat 5,6 mm).
   */
  inaltimeRand?: number;
}>;

/** Textul rândului de jos, același în toate formatele. */
export const SEMNATURA_FISIER = "Generat gratuit cu administrativo.ro";

/**
 * Rândul de sus de pe paginile 2+ (PDF) și din antetul Word: o foaie ruptă din
 * teanc spune singură ce lună și ce firmă are.
 */
export function textAntetRulant(d: DocumentTabelar): string {
  return d.subtitlu === null ? d.titlu : `${d.titlu} · ${d.subtitlu}`;
}

/** „Pagina 2 din 5”. Un document de o singură pagină nu primește număr. */
export function textPagina(index: number, total: number): string | null {
  return total <= 1 ? null : `Pagina ${String(index + 1)} din ${String(total)}`;
}
```

În `src/lib/unelte/pdf.ts`, importurile vechi (liniile 3–22):

```ts
import { PDFName, PDFString, rgb, type PDFFont } from "pdf-lib";

import { ADRESA_SITE } from "@/content/landing/contact";

import {
  GRI,
  INALTIME_A4,
  LATIME_A4,
  LINIE,
  MARGINE,
  NEGRU,
  pornesteDocument,
} from "@/lib/pdf/document";

import {
  adresaDinFisier,
  LINIE_GOALA,
  SEMNATURA_FISIER,
  type DocumentTabelar,
} from "./document-tabelar";
```

devin:

```ts
import { PDFName, PDFString, rgb, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";

import { ADRESA_SITE } from "@/content/landing/contact";

import {
  GRI,
  INALTIME_A4,
  LATIME_A4,
  MARGINE,
  NEGRU,
  pornesteDocument,
  type Fonturi,
} from "@/lib/pdf/document";

import {
  adresaDinFisier,
  LINIE_GOALA,
  SEMNATURA_FISIER,
  textAntetRulant,
  textPagina,
  type DocumentTabelar,
} from "./document-tabelar";
```

Constantele vechi (liniile 32–36):

```ts
const UMBRA = rgb(0.92, 0.93, 0.92);
const MARIME = 8;
const INALT_RAND = 16;
/** Spațiul păstrat sub ultimul rând pentru mențiunea din subsol. */
const REZERVA_SUBSOL = 20;
```

devin:

```ts
const UMBRA = rgb(0.92, 0.93, 0.92);
/**
 * Chenarul tabelului. A fost `LINIE` (#D9DBE0, 0,5 pt): curat pe ecran, abia
 * vizibil pe hârtie — iar condica și fișele se completează și se semnează pe
 * liniile astea (auditul din 8 oct 2026).
 */
const CHENAR = rgb(0.45, 0.47, 0.5);
const MARIME = 8;
const INALT_RAND = 16;
/** Spațiul păstrat sub ultimul rând pentru mențiunea din subsol. */
const REZERVA_SUBSOL = 20;
/** Mărimea textelor din margine: antetul rulant și numărul paginii. */
const MARIME_MARGINE = 7;

type Masurare = (font: PDFFont, marime: number) => (t: string) => number;
```

`taie` și `imparte` rămân neschimbate. Tot blocul de la `export async function randeazaPdf(d: DocumentTabelar): Promise<Uint8Array> {` (linia 77) până la sfârșitul fișierului (linia 230) se înlocuiește cu:

```ts
function dimensiuni(d: DocumentTabelar): readonly [number, number] {
  return d.orientare === "peisaj" ? [INALTIME_A4, LATIME_A4] : [LATIME_A4, INALTIME_A4];
}

/**
 * Lățimea fiecărei coloane în puncte: lățimile relative, întinse pe lățimea
 * utilă. Exportată ca testele uneltelor să verifice, pe fontul real, că nicio
 * etichetă nu ajunge la „…”.
 */
export function latimiColoane(d: DocumentTabelar): readonly number[] {
  const [latime] = dimensiuni(d);
  const util = latime - 2 * MARGINE;
  const total = d.coloane.reduce((s, c) => s + c.latime, 0);
  return d.coloane.map((c) => (total === 0 ? 0 : (c.latime / total) * util));
}

export async function randeazaPdf(d: DocumentTabelar): Promise<Uint8Array> {
  return randeazaPdfMultiplu([d]);
}

/**
 * Mai multe documente într-un singur PDF, fiecare de la pagină nouă și cu
 * numerotarea lui („Pagina 1 din 1” nu se scrie). Fontul se încorporează O
 * DATĂ: lipite din PDF-uri separate, 60 de fișe ar fi purtat 60 de subseturi.
 */
export async function randeazaPdfMultiplu(
  documente: readonly DocumentTabelar[],
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

  for (const d of documente) deseneaza(doc, fonturi, masoara, d);
  return doc.save();
}

function deseneaza(
  doc: PDFDocument,
  fonturi: Fonturi,
  masoara: Masurare,
  d: DocumentTabelar,
): void {
  const [latime, inaltime] = dimensiuni(d);
  const util = latime - 2 * MARGINE;
  const latimi = latimiColoane(d);
  const inaltCorp = Math.max(INALT_RAND, d.inaltimeRand ?? INALT_RAND);

  const pagini: PDFPage[] = [];
  let pagina = doc.addPage([latime, inaltime]);
  pagini.push(pagina);
  let y = inaltime - MARGINE;

  const paginaNoua = () => {
    pagina = doc.addPage([latime, inaltime]);
    pagini.push(pagina);
    y = inaltime - MARGINE;
  };
  const asiguraLoc = (necesar: number) => {
    if (y - necesar < MARGINE + REZERVA_SUBSOL) paginaNoua();
  };
  /** Proză pe mai multe rânduri; doar celulele de tabel se taie cu „…”. */
  const scrie = (text: string, marime: number, font: PDFFont, culoare = NEGRU) => {
    const randuri = imparte(text, util, masoara(font, marime));
    randuri.forEach((rand, k) => {
      asiguraLoc(marime + 6);
      pagina.drawText(rand, { x: MARGINE, y: y - marime, size: marime, font, color: culoare });
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
   * (condica, 22 pt) își centrează textul pe verticală.
   */
  const rand = (celule: readonly string[], aldin: boolean, inaltMinim: number) => {
    const font = aldin ? fonturi.aldin : fonturi.normal;
    const linii = celule.map((c) => c.split("\n"));
    const nrLinii = Math.max(1, ...linii.map((l) => l.length));
    const inaltText = INALT_RAND + (nrLinii - 1) * (MARIME + 2);
    const inalt = Math.max(inaltMinim, inaltText);
    const sus = 11 + (inalt - inaltText) / 2;
    let x = MARGINE;
    latimi.forEach((w, i) => {
      if (d.umbrite.includes(i)) {
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
        pagina.drawText(taie(linie, w - 4, masoara(font, MARIME)), {
          x: x + 2,
          y: y - sus - k * (MARIME + 2),
          size: MARIME,
          font,
          color: NEGRU,
        });
      });
      x += w;
    });
    y -= inalt;
  };

  if (d.coloane.length > 0) {
    const antet = d.coloane.map((c) => c.eticheta);
    asiguraLoc(INALT_RAND * 3);
    rand(antet, true, INALT_RAND);
    for (const r of d.randuri) {
      if (y - inaltCorp < MARGINE + REZERVA_SUBSOL) {
        paginaNoua();
        rand(antet, true, INALT_RAND); // antetul se repetă pe fiecare pagină
      }
      rand(r, false, inaltCorp);
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
      pagina.drawText(taie(eticheta, pas - 24, masoara(fonturi.normal, 8)), {
        x,
        y: y - 11,
        size: 8,
        font: fonturi.normal,
        color: GRI,
      });
    });
    y -= 20;
  }

  pagina.drawText(SEMNATURA_FISIER, {
    x: MARGINE,
    y: MARGINE / 2,
    size: MARIME_MARGINE,
    font: fonturi.normal,
    color: GRI,
  });
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
    }
  });
}
```

`LINIE` nu mai e importat (rămâne exportat din `@/lib/pdf/document` pentru documentele aplicației). Comentariul existent din antetul fișierului (liniile 24–30) rămâne.

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run src/lib/unelte/`. Rezultatul așteptat: `pdf-pagini.test.ts` are 6 teste trecute, iar `randari.test.ts` trece întreg, inclusiv „paginează rândurile”, „adnotare URI” și „taie e logaritmică”.

- [ ] **Pasul 5: Verificarea vizuală a PDF-ului.** O îmbunătățire de tipar nu se dovedește printr-un `expect`. Proba e un test TEMPORAR, din același proiect `unit` (alias-ul `server-only`, căile `@/`), și se șterge înainte de commit:

```bash
cd /srv/apps/ERP
cat > src/lib/unelte/zz-proba-vizuala.test.ts <<'EOF'
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { randeazaPdf } from "./pdf";
it("probă vizuală", async () => {
  writeFileSync(process.env.IESIRE ?? "/dev/null", await randeazaPdf({
    titlu: "Condica de prezență — decembrie 2026", subtitlu: "Construct SRL · CUI 14399840",
    campuri: [], paragrafe: [],
    coloane: [{ eticheta: "Data", latime: 2 }, { eticheta: "Nume", latime: 6 }, { eticheta: "Semnătura", latime: 3 }],
    randuri: Array.from({ length: 80 }, (_, i) => [String(i + 1), "Popa Ion", ""]),
    umbrite: [], note: [], semnaturi: ["Verificat"], orientare: "portret", numeFisier: "proba", inaltimeRand: 22,
  }));
});
EOF
IESIRE="$S/proba-e4.pdf" pnpm exec vitest run src/lib/unelte/zz-proba-vizuala.test.ts
rm src/lib/unelte/zz-proba-vizuala.test.ts
python3 -m venv "$S/venv-pdf" && "$S/venv-pdf/bin/pip" install -q pypdfium2
"$S/venv-pdf/bin/python" -I -c "import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); [d[i].render(scale=1.5).to_pil().save(f'{sys.argv[2]}-{i+1}.png') for i in range(len(d))]; print(len(d), 'pagini')" "$S/proba-e4.pdf" "$S/proba-e4"
git status --short -- src/lib/unelte/   # NU trebuie să apară zz-proba-vizuala.test.ts
```

Citește `proba-e4-1.png` și `proba-e4-2.png` cu `Read`. Ce trebuie să vezi: chenarul gri închis, clar vizibil; rânduri vizibil mai înalte decât un rând de text; pe pagina 2, sus, „Condica de prezență — decembrie 2026 · Construct SRL”; jos-dreapta, „Pagina 1 din N”, „Pagina 2 din N”; capul de tabel repetat pe pagina 2.

- [ ] **Pasul 6: Lanțul complet**, plus `prettier --check src/lib/unelte/pdf.ts src/lib/unelte/document-tabelar.ts src/lib/unelte/pdf-pagini.test.ts`.

- [ ] **Commit** — căi: `src/lib/unelte/pdf.ts src/lib/unelte/document-tabelar.ts src/lib/unelte/pdf-pagini.test.ts`. Mesaj: `fix(unelte): PDF-ul uneltelor — chenar vizibil la tipar, rând de semnătură, antet repetat și „Pagina X din Y”`.

---

### Task E5: Word cu secțiuni multiple, antet și subsol numerotat; răspuns pentru mai multe documente

**Fișiere:**
- Modify: `src/lib/unelte/docx.ts` (importurile de la liniile 1–23, `randeazaDocx` de la liniile 26–120)
- Modify: `src/lib/unelte/raspuns.ts` (liniile 1–34)
- Test: `src/lib/unelte/docx-sectiuni.test.ts` (nou)

**Interfețe:**
- Consumă: `textAntetRulant` (E4); `curataDocument(d): DocumentTabelar` din `./document-tabelar` (B2, deja folosită de `raspunsDocument`); din `docx` 9.8.1: `AlignmentType`, `Footer`, `Header`, `HeightRule`, `PageNumber` (`CURRENT`, `TOTAL_PAGES_IN_SECTION`), `type ISectionOptions`, toate verificate în `node_modules/docx/dist/index.d.ts`; `ISectionPropertiesOptions.titlePage` (linia 6780). `randeazaPdfMultiplu` (E4).
- Produce:
  ```ts
  // docx.ts
  export async function randeazaDocx(d: DocumentTabelar): Promise<Uint8Array>;            // neschimbată
  export async function randeazaDocxMultiplu(documente: readonly DocumentTabelar[]): Promise<Uint8Array>;
  // raspuns.ts
  export function raspunsBinar(continut: Uint8Array, format: Format, numeFisier: string): Response;
  export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response>; // neschimbată
  export async function raspunsDocumente(documente: readonly DocumentTabelar[], format: "pdf" | "docx", numeFisier: string): Promise<Response>;
  ```

- [ ] **Pasul 0:** Citește `src/lib/unelte/raspuns.ts` așa cum l-au lăsat A5 și B2: A5 a adăugat `export const ANTET_CACHE_DESCARCARE = "private, no-store";` și îl pune în `cache-control` (descărcările poartă nume de angajați), iar B2 face ca `raspunsDocument` să cheme `RANDARI[format](curataDocument(d))`. Fișierul nou de mai jos păstrează AMÂNDOUĂ schimbările și le aplică și în `raspunsBinar`/`raspunsDocumente`. Testele lui A5 (`randari.test.ts` „descărcarea nu intră în niciun cache comun”, paza pe surse „nicio rută de unealtă nu mai declară cache public”, `foaie-de-pontaj/route.test.ts`) trebuie să rămână verzi. Precondiție: `grep -n "ANTET_CACHE_DESCARCARE" src/lib/unelte/raspuns.ts` îl găsește; fără el, se execută întâi A5. Dacă `git log --oneline e906d2c.. -- src/lib/unelte/raspuns.ts src/lib/unelte/docx.ts` arată și alte schimbări, le păstrezi.

- [ ] **Pasul 1: Scrie testul care pică**

```ts
// src/lib/unelte/docx-sectiuni.test.ts
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { DocumentTabelar } from "./document-tabelar";
import { randeazaDocx, randeazaDocxMultiplu } from "./docx";
import { raspunsBinar, raspunsDocumente } from "./raspuns";

function fisa(nume: string, extra: Partial<DocumentTabelar> = {}): DocumentTabelar {
  return {
    titlu: `Fișă individuală de pontaj — decembrie 2026`,
    subtitlu: "Construct SRL",
    campuri: [{ eticheta: "Angajat", valoare: nume }],
    paragrafe: [],
    coloane: [
      { eticheta: "Data", latime: 2 },
      { eticheta: "Semnătura", latime: 3 },
    ],
    randuri: [["01.12", ""]],
    umbrite: [],
    note: [],
    semnaturi: [],
    orientare: "portret",
    numeFisier: "fisa",
    ...extra,
  };
}

async function fisiere(octeti: Uint8Array, prefix: string): Promise<string> {
  const zip = await JSZip.loadAsync(octeti);
  const nume = Object.keys(zip.files).filter((f) => f.startsWith(prefix));
  const continut = await Promise.all(nume.map((f) => zip.file(f)?.async("string")));
  return continut.join("\n");
}

describe("Word cu mai multe documente", () => {
  it("fiecare fișă e o secțiune proprie, cu numele ei", async () => {
    const xml = await fisiere(
      await randeazaDocxMultiplu([fisa("Popa Ion"), fisa("Ilie Maria")]),
      "word/document.xml",
    );
    expect(xml.match(/<w:sectPr/gu)).toHaveLength(2);
    expect(xml).toContain("Popa Ion");
    expect(xml).toContain("Ilie Maria");
  });

  it("rândurile cer înălțimea minimă și nu se rup între pagini", async () => {
    const xml = await fisiere(
      await randeazaDocx(fisa("Popa Ion", { inaltimeRand: 22 })),
      "word/document.xml",
    );
    expect(xml).toMatch(/<w:trHeight[^>]*w:val="440"/u);
    expect(xml).toMatch(/<w:trHeight[^>]*w:hRule="atLeast"/u);
    expect(xml).toMatch(/<w:cantSplit/u);
  });

  it("subsolul numără paginile secțiunii, antetul repetă titlul și firma", async () => {
    const octeti = await randeazaDocx(fisa("Popa Ion"));
    const subsol = await fisiere(octeti, "word/footer");
    expect(subsol).toContain("Pagina");
    expect(subsol).toMatch(/SECTIONPAGES/u);
    expect(subsol).toMatch(/PAGE/u);
    expect(await fisiere(octeti, "word/header")).toContain(
      "Fișă individuală de pontaj — decembrie 2026 · Construct SRL",
    );
  });

  it("fără documente refuză", async () => {
    await expect(randeazaDocxMultiplu([])).rejects.toThrow(/Niciun document/u);
  });
});

describe("răspunsul cu mai multe documente", () => {
  it("PDF-urile fișelor stau unul după altul, sub un singur nume", async () => {
    const r = await raspunsDocumente([fisa("A"), fisa("B")], "pdf", "fise-pontaj-2026-12");
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="fise-pontaj-2026-12.pdf"',
    );
    const pdf = await PDFDocument.load(new Uint8Array(await r.arrayBuffer()));
    expect(pdf.getPageCount()).toBe(2);
  });

  it("curăță fiecare document, ca răspunsul cu unul singur", async () => {
    const vt = String.fromCharCode(11); // rândul manual din Word, care strica XML-ul
    const r = await raspunsDocumente(
      [fisa(`Popa${vt}Ion`), fisa("Ilie Maria")],
      "docx",
      "fise-pontaj-2026-12",
    );
    const xml = await fisiere(new Uint8Array(await r.arrayBuffer()), "word/document.xml");
    expect(xml).not.toContain(vt);
    expect(xml).toContain("Popa Ion");
  });

  it("raspunsBinar pune tipul, atașamentul, numele ASCII și cache-ul privat al lui A5", () => {
    const r = raspunsBinar(new Uint8Array([1, 2, 3]), "xlsx", "pontaj ș-2026");
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="pontaj-s-2026.xlsx"');
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `pnpm exec vitest run src/lib/unelte/docx-sectiuni.test.ts`. Rezultatul așteptat: `randeazaDocxMultiplu`/`raspunsBinar`/`raspunsDocumente` „is not exported” și eșec la import.

- [ ] **Pasul 3: Implementarea minimă**

În `src/lib/unelte/docx.ts`, importurile vechi (liniile 1–23):

```ts
import {
  Document,
  ExternalHyperlink,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { ADRESA_SITE } from "@/content/landing/contact";

import {
  adresaDinFisier,
  LINIE_GOALA,
  SEMNATURA_FISIER,
  type DocumentTabelar,
} from "./document-tabelar";
```

devin:

```ts
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeightRule,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx";

import { ADRESA_SITE } from "@/content/landing/contact";

import {
  adresaDinFisier,
  LINIE_GOALA,
  SEMNATURA_FISIER,
  textAntetRulant,
  type DocumentTabelar,
} from "./document-tabelar";

/** Înălțimile de rând din `docx` sunt în twipi: 20 pe punct. */
const TWIPI_PE_PUNCT = 20;

/** „Pagina X din Y”, pe secțiune: fiecare fișă din documentul cu mai multe se numără singură. */
function subsol(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            children: ["Pagina ", PageNumber.CURRENT, " din ", PageNumber.TOTAL_PAGES_IN_SECTION],
            size: 14,
            color: "6B7280",
          }),
        ],
      }),
    ],
  });
}
```

Linia veche:

```ts
/** `DocumentTabelar` → .docx. Mărimile în `docx` sunt în jumătăți de punct: 16 = 8 pt. */
export async function randeazaDocx(d: DocumentTabelar): Promise<Uint8Array> {
```

devine:

```ts
/** Un `DocumentTabelar` ca secțiune Word. Mărimile în `docx` sunt în jumătăți de punct: 16 = 8 pt. */
function sectiune(d: DocumentTabelar): ISectionOptions {
```

Blocul vechi al rândurilor de corp:

```ts
          ...d.randuri.map(
            (r) =>
              new TableRow({ children: d.coloane.map((_, i) => celula(r[i] ?? "", i, false)) }),
          ),
```

devine:

```ts
          ...d.randuri.map(
            (r) =>
              new TableRow({
                // Un rând de semnătură rupt între două pagini nu mai e semnabil.
                cantSplit: true,
                ...(d.inaltimeRand === undefined
                  ? {}
                  : {
                      height: {
                        value: Math.round(d.inaltimeRand * TWIPI_PE_PUNCT),
                        rule: HeightRule.ATLEAST,
                      },
                    }),
                children: d.coloane.map((_, i) => celula(r[i] ?? "", i, false)),
              }),
          ),
```

Coada veche:

```ts
  const document = new Document({
    creator: "Administrativo",
    title: d.titlu,
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation:
                d.orientare === "peisaj" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
          },
        },
        children: copii,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}
```

devine:

```ts
  return {
    properties: {
      // Prima pagină fără antet rulant: are deja titlul mare.
      titlePage: true,
      page: {
        size: {
          orientation:
            d.orientare === "peisaj" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
        },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [new TextRun({ text: textAntetRulant(d), size: 14, color: "6B7280" })],
          }),
        ],
      }),
      first: new Header({ children: [new Paragraph({ children: [] })] }),
    },
    footers: { default: subsol(), first: subsol() },
    children: copii,
  };
}

/** Mai multe documente într-un singur .docx, câte o secțiune (deci pagină nouă) fiecare. */
export async function randeazaDocxMultiplu(
  documente: readonly DocumentTabelar[],
): Promise<Uint8Array> {
  const primul = documente[0];
  if (primul === undefined) throw new Error("Niciun document de randat.");
  const document = new Document({
    creator: "Administrativo",
    title: primul.titlu,
    sections: documente.map((d) => sectiune(d)),
  });
  return new Uint8Array(await Packer.toBuffer(document));
}

/** `DocumentTabelar` → .docx. */
export async function randeazaDocx(d: DocumentTabelar): Promise<Uint8Array> {
  return randeazaDocxMultiplu([d]);
}
```

`src/lib/unelte/raspuns.ts`, fișierul nou întreg. Pornește de la cel vechi, de 34 de linii, toate citite, plus schimbarea lui A5 (`ANTET_CACHE_DESCARCARE`) și a lui B2 (`curataDocument` în `raspunsDocument`):

```ts
import "server-only";

import {
  curataDocument,
  numeFisierSigur,
  type DocumentTabelar,
  type Format,
} from "./document-tabelar";
import { randeazaDocx, randeazaDocxMultiplu } from "./docx";
import { randeazaPdf, randeazaPdfMultiplu } from "./pdf";
import { randeazaXlsx } from "./xlsx";

const TIP: Readonly<Record<Format, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const RANDARI: Readonly<Record<Format, (d: DocumentTabelar) => Promise<Uint8Array>>> = {
  pdf: randeazaPdf,
  docx: randeazaDocx,
  xlsx: randeazaXlsx,
};

/**
 * Antetul de cache al oricărei descărcări de unealtă (A5, păstrat neschimbat).
 *
 * A fost `public, max-age=3600` până la 8 oct 2026, pe fișiere care poartă
 * numele angajaților, firma și salariul. `public` dă voie oricărui cache
 * intermediar să păstreze o oră documentul unui alt om. Acum e aceeași
 * politică pe care Next o pune deja paginilor uneltelor.
 */
export const ANTET_CACHE_DESCARCARE = "private, no-store";

/**
 * Octeții unui fișier ca răspuns de descărcare. `new Uint8Array(...)` copiază
 * într-un `ArrayBuffer` propriu: tipurile din `lib.dom` nu acceptă ca
 * `BodyInit` un `Uint8Array<ArrayBufferLike>`, iar `Buffer`-ul din `docx` e
 * exact asta.
 *
 * Exportată pentru rutele cu Excel propriu (foaia de pontaj, condica): ele își
 * construiesc registrul cu formule, dar antetele trebuie să fie aceleași —
 * inclusiv `private, no-store`, ca nicio rută să nu-și scrie singură antetul.
 */
export function raspunsBinar(continut: Uint8Array, format: Format, numeFisier: string): Response {
  return new Response(new Uint8Array(continut), {
    headers: {
      "content-type": TIP[format],
      "content-disposition": `attachment; filename="${numeFisierSigur(numeFisier)}.${format}"`,
      "cache-control": ANTET_CACHE_DESCARCARE,
    },
  });
}

export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response> {
  // Punctul unic de curățare pentru toate uneltele și toate formatele (secțiunea B): vezi `curataText`.
  return raspunsBinar(await RANDARI[format](curataDocument(d)), format, d.numeFisier);
}

/** Mai multe documente (fișele individuale de pontaj) într-un singur PDF sau Word. */
export async function raspunsDocumente(
  documente: readonly DocumentTabelar[],
  format: "pdf" | "docx",
  numeFisier: string,
): Promise<Response> {
  // Aceeași curățare ca la un singur document: o fișă cu un nume lipit din Word
  // (U+000B) nu are voie să strice tot fișierul cu 60 de fișe.
  const curate = documente.map((d) => curataDocument(d));
  const continut =
    format === "pdf" ? await randeazaPdfMultiplu(curate) : await randeazaDocxMultiplu(curate);
  return raspunsBinar(continut, format, numeFisier);
}
```

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run src/lib/unelte/ src/app/api/unelte/`. Rezultatul așteptat: `docx-sectiuni.test.ts` are 7 teste trecute; `randari.test.ts` trece întreg, inclusiv `w:orient="landscape"`, hyperlinkul și `attachment; filename="condica-octombrie-2026.docx"`; ruta comună trece cu 400 și 404.

- [ ] **Pasul 5: Lanțul complet**, plus `prettier --check` pe cele trei fișiere.

- [ ] **Commit** — căi: `src/lib/unelte/docx.ts src/lib/unelte/raspuns.ts src/lib/unelte/docx-sectiuni.test.ts`. Mesaj: `feat(unelte): Word cu secțiuni multiple, antet și subsol numerotat; răspuns pentru mai multe documente`.

---

### Task E6: Tiparul Excel comun — A4, rânduri de titlu repetate, liste de coduri, nume de filă sigure

**Fișiere:**
- Create: `src/lib/unelte/tipar-xlsx.ts`
- Test: `src/lib/unelte/tipar-xlsx.test.ts`

**Interfețe:**
- Consumă: tipurile `DataValidation`, `PaperSize`, `Worksheet` din `exceljs` 4.4.0 (`export interface` / `export const enum` în `index.d.ts`; `PaperSize` e `const enum` ambiental, deci se folosește doar ca TIP — `isolatedModules: true` nu permite accesul la valoare); `SEMNATURA_FISIER` din `./document-tabelar`; `LISTA_CODURI` (E2) doar în test.
- Produce:
  ```ts
  export type OptiuniTipar = Readonly<{ orientare: "portret" | "peisaj"; randuriTitlu: Readonly<{ de: number; pana: number }> }>;
  export function pregatesteTiparXlsx(fila: Worksheet, o: OptiuniTipar): void;
  export function numeFilaSigur(dorit: string, folosite: Set<string>): string;
  export function validareCoduri(coduri: readonly string[], strict: boolean): DataValidation;
  export const VALIDARE_ORA: DataValidation;
  export const VALIDARE_DURATA: DataValidation;
  export const VALIDARE_PAUZA: DataValidation;
  ```

- [ ] **Pasul 1: Scrie testul care pică**

```ts
// src/lib/unelte/tipar-xlsx.test.ts
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { LISTA_CODURI } from "./coduri-pontaj";
import {
  numeFilaSigur,
  pregatesteTiparXlsx,
  validareCoduri,
  VALIDARE_ORA,
} from "./tipar-xlsx";

async function xml(registru: ExcelJS.Workbook, cale: string): Promise<string> {
  const zip = await JSZip.loadAsync(await registru.xlsx.writeBuffer());
  return (await zip.file(cale)?.async("string")) ?? "";
}

/**
 * Auditul din 8 oct 2026: `print_title_rows=None`, `paperSize=None` pe foaia de
 * pontaj; condica fără `_xlnm.Print_Titles`. Cu 60 de angajați, pagina a doua
 * tipărită din Excel n-avea capul de tabel.
 */
describe("tiparul Excel", () => {
  it("A4, orientarea cerută, rândurile de titlu repetate și pagina în subsol", async () => {
    const registru = new ExcelJS.Workbook();
    const fila = registru.addWorksheet("decembrie 2026");
    fila.addRow(["Titlu"]);
    pregatesteTiparXlsx(fila, { orientare: "peisaj", randuriTitlu: { de: 5, pana: 6 } });
    const carte = await xml(registru, "xl/workbook.xml");
    expect(carte).toContain("_xlnm.Print_Titles");
    // ExcelJS scapă apostroful din XML: `&apos;decembrie 2026&apos;!$5:$6` (verificat pe 4.4.0).
    expect(carte).toMatch(/(&apos;|')decembrie 2026(&apos;|')!\$5:\$6/u);
    const foaie = await xml(registru, "xl/worksheets/sheet1.xml");
    expect(foaie).toMatch(/paperSize="9"/u);
    expect(foaie).toMatch(/orientation="landscape"/u);
    expect(foaie).toMatch(/fitToWidth="1"/u);
    expect(foaie).toMatch(/<oddFooter>[^<]*&amp;P din &amp;N/u);
  });

  it("lista de coduri: săgeată fără alertă pe celulele de ore, strictă pe coloana de cod", async () => {
    const registru = new ExcelJS.Workbook();
    const fila = registru.addWorksheet("Proba");
    fila.getCell("C7").dataValidation = validareCoduri(LISTA_CODURI, false);
    fila.getCell("I7").dataValidation = validareCoduri(LISTA_CODURI, true);
    fila.getCell("D7").dataValidation = VALIDARE_ORA;
    const foaie = await xml(registru, "xl/worksheets/sheet1.xml");
    expect(foaie).toMatch(/<formula1>(&quot;|")CO,CM,CFS,AN,D,L,SL(&quot;|")<\/formula1>/u);
    expect(foaie.match(/<dataValidation /gu)).toHaveLength(3);
    expect(foaie.match(/showErrorMessage="1"/gu)).toHaveLength(2); // I7 și D7, nu C7
    expect(foaie).toMatch(/type="decimal"/u);
  });
});

describe("numele filelor", () => {
  it("scoate caracterele interzise, taie la 31, deosebește dublurile fără să țină cont de majuscule", () => {
    const folosite = new Set<string>();
    expect(numeFilaSigur("Popa Ion", folosite)).toBe("Popa Ion");
    expect(numeFilaSigur("Popa Ion", folosite)).toBe("Popa Ion (2)");
    expect(numeFilaSigur("popa ion", folosite)).toBe("popa ion (3)");
    expect(numeFilaSigur("Ana/Maria: [test]*?", folosite)).toBe("Ana Maria test");
    expect(numeFilaSigur("'Ion'", folosite)).toBe("Ion");
    expect(numeFilaSigur("", folosite)).toBe("Fișă");
    expect(numeFilaSigur("History", folosite)).toBe("Fișă History");
    expect(numeFilaSigur("x".repeat(40), folosite)).toHaveLength(31);
  });

  it("orice nume produs e acceptat de ExcelJS, inclusiv dublurile lungi", () => {
    const registru = new ExcelJS.Workbook();
    const folosite = new Set<string>();
    const dorite = [
      "Popescu-Vasilescu Ana-Maria Ștefania",
      "Popescu-Vasilescu Ana-Maria Ștefania",
      "O'Neil Ion'",
      "a/b\\c",
      "",
      "History",
    ];
    for (const dorit of dorite) {
      expect(() => registru.addWorksheet(numeFilaSigur(dorit, folosite))).not.toThrow();
    }
    expect(registru.worksheets).toHaveLength(dorite.length);
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `pnpm exec vitest run src/lib/unelte/tipar-xlsx.test.ts`. Rezultatul așteptat: `Failed to resolve import "./tipar-xlsx"`.

- [ ] **Pasul 3: Implementarea minimă**

```ts
// src/lib/unelte/tipar-xlsx.ts
import type { DataValidation, PaperSize, Worksheet } from "exceljs";

import { SEMNATURA_FISIER } from "./document-tabelar";

/**
 * Tiparul comun al fișierelor Excel ale uneltelor: hârtie, rânduri de titlu
 * repetate, subsol numerotat, validări și nume de filă.
 *
 * ── DE CE UN FIȘIER SEPARAT DE `xlsx.ts` ──────────────────────────────────
 * `randeazaXlsx` e randarea generică, fără formule. Foaia de pontaj și condica
 * au generatoare proprii, cu formule; tiparul trebuie să fie același la toate,
 * iar celelalte unelte îl pot adopta fără să atingă randarea generică.
 */

/** A4 în codificarea OOXML. `PaperSize` e un `const enum` ambiental: doar tipul se poate folosi. */
const A4 = 9 as PaperSize;

export type OptiuniTipar = Readonly<{
  orientare: "portret" | "peisaj";
  /** Rândurile repetate sus pe fiecare pagină tipărită (capul de tabel). */
  randuriTitlu: Readonly<{ de: number; pana: number }>;
}>;

export function pregatesteTiparXlsx(fila: Worksheet, o: OptiuniTipar): void {
  fila.pageSetup.paperSize = A4;
  fila.pageSetup.orientation = o.orientare === "peisaj" ? "landscape" : "portrait";
  fila.pageSetup.fitToPage = true;
  fila.pageSetup.fitToWidth = 1;
  fila.pageSetup.fitToHeight = 0;
  fila.pageSetup.printTitlesRow = `${String(o.randuriTitlu.de)}:${String(o.randuriTitlu.pana)}`;
  // &L / &R = stânga / dreapta, &8 = 8 pt, &P / &N = pagina / numărul de pagini.
  fila.headerFooter.oddFooter = `&L&8${SEMNATURA_FISIER}&R&8Pagina &P din &N`;
}

/**
 * Numele unei file: Excel refuză `* ? : \ / [ ]`, un apostrof la capete, peste
 * 31 de caractere, „History” și un nume repetat (fără să țină cont de
 * majuscule). Toate apar în practică într-o listă de angajați lipită din altă
 * parte — „O'Neil”, „Ana/Maria”, doi „Popa Ion”.
 */
export function numeFilaSigur(dorit: string, folosite: Set<string>): string {
  const curat = dorit
    .replace(/[*?:/\\[\]]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 31)
    .replace(/^'+|'+$/gu, "")
    .trim();
  const baza = curat === "" ? "Fișă" : curat.toLowerCase() === "history" ? "Fișă History" : curat;
  let nume = baza;
  for (let k = 2; folosite.has(nume.toLowerCase()); k += 1) {
    const sufix = ` (${String(k)})`;
    nume = `${baza.slice(0, 31 - sufix.length).trimEnd()}${sufix}`;
  }
  folosite.add(nume.toLowerCase());
  return nume;
}

/**
 * Lista de coduri ca validare. `strict: false` lasă săgeata cu coduri, dar
 * primește și cifre — celula de zi a foii colective ține ori ore, ori un cod.
 * `strict: true` e pentru coloana „Cod” a fișei individuale, unde cifrele n-au
 * ce căuta.
 */
export function validareCoduri(coduri: readonly string[], strict: boolean): DataValidation {
  const formulae = [`"${coduri.join(",")}"`];
  return strict
    ? {
        type: "list",
        allowBlank: true,
        formulae,
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Cod necunoscut",
        error: `Folosește un cod din legendă: ${coduri.join(", ")}.`,
      }
    : { type: "list", allowBlank: true, formulae, showErrorMessage: false };
}

/**
 * O oră din zi e, pentru Excel, o fracție de zi. „8:00” trece (0,333); „8”
 * scris fără două puncte înseamnă opt ZILE și ar da ore lucrate aberante.
 */
export const VALIDARE_ORA: DataValidation = {
  type: "decimal",
  operator: "between",
  allowBlank: true,
  formulae: [0, 0.99999],
  showErrorMessage: true,
  errorStyle: "stop",
  errorTitle: "Oră invalidă",
  error: "Scrie ora cu două puncte, de exemplu 8:00 sau 17:30.",
};

/** Orele suplimentare sau de noapte ale unei zile, ca durată: „2:00”, nu „2”. */
export const VALIDARE_DURATA: DataValidation = {
  ...VALIDARE_ORA,
  errorTitle: "Durată invalidă",
  error: "Scrie durata cu două puncte, de exemplu 2:00 sau 0:30.",
};

export const VALIDARE_PAUZA: DataValidation = {
  type: "whole",
  operator: "between",
  allowBlank: true,
  formulae: [0, 600],
  showErrorMessage: true,
  errorStyle: "stop",
  errorTitle: "Pauză invalidă",
  error: "Scrie pauza în minute, un număr între 0 și 600.",
};
```

Verificarea testului „O'Neil Ion'”: slice → „O'Neil Ion'”, scoaterea apostrofilor de la capete → „O'Neil Ion”. Apostroful din interior e permis de ExcelJS (regula interzice doar primul sau ultimul caracter).

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run src/lib/unelte/tipar-xlsx.test.ts`. Rezultatul așteptat: `4 passed`. Dacă `showErrorMessage="1"` apare de 3 ori, ExcelJS serializează `false` ca atribut. În cazul ăsta scoate cheia din obiectul nestrict (`{ type, allowBlank, formulae }`) și reia testul.

- [ ] **Pasul 5: Lanțul complet**, plus `prettier --check` pe cele două fișiere.

- [ ] **Commit** — căi: `src/lib/unelte/tipar-xlsx.ts src/lib/unelte/tipar-xlsx.test.ts`. Mesaj: `feat(unelte): tiparul Excel comun — A4, rânduri de titlu repetate, liste de coduri, nume de filă sigure`.

---
### Task E7: Ce cere ITM și întrebările, comune celor două pagini

**Fișiere:**
- Create: `src/content/landing/intrebari-pontaj.ts`, test `src/content/landing/intrebari-pontaj.test.ts`
- Create: `src/app/(marketing)/_componente/ce-cere-itm.tsx`, test `src/app/(marketing)/_componente/ce-cere-itm.test.tsx`
- Create: `src/app/(marketing)/_componente/intrebari-unealta.tsx`, test `src/app/(marketing)/_componente/intrebari-unealta.test.tsx`

**Interfețe:**
- Consumă: `EVIDENTA_ORELOR: PaginaLege` din `@/content/legal/evidenta-orelor` (are `raspunsScurt: string[]` și `amenzi: Amenda[]`, cu temeiurile `"art. 260 alin. (1) lit. m) Codul muncii"` și `"art. 15¹ lit. d) și art. 260 alin. (1) lit. e³) Codul muncii"`); `type Amenda` din `@/content/legal/tipuri`; `CODURI_LEGENDA`, `LISTA_CODURI` (E2); `Banda` din `./banda`; `Link` din `next/link`.
- Produce:
  ```ts
  // intrebari-pontaj.ts
  export type IntrebareUnealta = Readonly<{ q: string; a: string; temei?: string; legatura?: Readonly<{ href: string; eticheta: string }> }>;
  export function amendaEvidenta(cheie: "m" | "e3"): Amenda;
  export function textAmenda(a: Amenda): string;
  export const INTREBARI_FOAIE_PONTAJ: readonly IntrebareUnealta[];
  export const INTREBARI_CONDICA: readonly IntrebareUnealta[];
  export const ACOPERIRE_FOAIE: string;
  export const ACOPERIRE_CONDICA: string;
  // componente
  export function CeCereItm(p: Readonly<{ acoperire: string }>): JSX.Element;
  export function IntrebariUnealta(p: Readonly<{ titlu: string; intrebari: readonly IntrebareUnealta[] }>): JSX.Element;
  ```

- [ ] **Pasul 1: Scrie testele care pică**

```ts
// src/content/landing/intrebari-pontaj.test.ts
import { describe, expect, it } from "vitest";

import { LISTA_CODURI } from "@/lib/unelte/coduri-pontaj";

import {
  ACOPERIRE_CONDICA,
  ACOPERIRE_FOAIE,
  amendaEvidenta,
  INTREBARI_CONDICA,
  INTREBARI_FOAIE_PONTAJ,
  textAmenda,
} from "./intrebari-pontaj";

const TOATE = [...INTREBARI_FOAIE_PONTAJ, ...INTREBARI_CONDICA];
const SEDILA = /[\u015E\u015F\u0162\u0163]/u;

describe("întrebările foii de pontaj și ale condicii", () => {
  it("întrebarea se termină cu „?”, răspunsul cu punct, fără ș/ț cu sedilă", () => {
    for (const r of TOATE) {
      expect(r.q.endsWith("?"), r.q).toBe(true);
      expect(r.a.endsWith("."), r.q).toBe(true);
      expect(`${r.q}${r.a}${r.temei ?? ""}`, r.q).not.toMatch(SEDILA);
    }
    for (const t of [ACOPERIRE_FOAIE, ACOPERIRE_CONDICA]) {
      expect(t).not.toMatch(SEDILA);
      expect(t.endsWith(".")).toBe(true);
    }
  });

  it("întrebările nu se repetă pe aceeași pagină", () => {
    for (const lista of [INTREBARI_FOAIE_PONTAJ, INTREBARI_CONDICA]) {
      expect(new Set(lista.map((r) => r.q)).size).toBe(lista.length);
    }
  });

  it("temeiul numește Codul muncii, iar legăturile rămân pe site", () => {
    for (const r of TOATE) {
      if (r.temei !== undefined) expect(r.temei, r.q).toMatch(/Codul muncii$/u);
      if (r.legatura !== undefined) expect(r.legatura.href, r.q).toMatch(/^[?/]/u);
    }
  });

  it("răspunsul despre coduri le numește pe toate, ca legenda din fișiere", () => {
    const coduri = INTREBARI_FOAIE_PONTAJ.find((r) => r.q.includes("coduri"));
    for (const cod of LISTA_CODURI) expect(coduri?.a).toMatch(new RegExp(`\\b${cod} pentru `, "u"));
  });
});

describe("amenzile citite din pagina evidenței orelor", () => {
  it("găsește amenda pentru lipsa evidenței și pe cea de la timp parțial", () => {
    expect(amendaEvidenta("m").suma).toMatch(/1\.500.*3\.000/u);
    const partial = amendaEvidenta("e3");
    expect(partial.suma).toMatch(/10\.000.*15\.000/u);
    expect(partial.aplicare).toBeDefined();
    expect(textAmenda(partial)).toBe(`${partial.suma}, ${partial.aplicare ?? ""}`);
  });

  it("sumele din răspunsuri sunt chiar cele din pagina-lege, nu copii", () => {
    const text = TOATE.map((r) => r.a).join(" ");
    expect(text).toContain(amendaEvidenta("m").suma);
    expect(text).toContain(textAmenda(amendaEvidenta("e3")));
  });
});
```

```tsx
// src/app/(marketing)/_componente/ce-cere-itm.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { amendaEvidenta } from "@/content/landing/intrebari-pontaj";

import { CeCereItm } from "./ce-cere-itm";

describe("banda „Ce cere inspectorul de muncă”", () => {
  it("arată cerința art. 119, cele două amenzi cu temeiul și ce acoperă documentul", () => {
    const { container } = render(<CeCereItm acoperire="Acest document acoperă art. 119." />);
    expect(screen.getByText("Acest document acoperă art. 119.")).toBeTruthy();
    expect(screen.getByText(amendaEvidenta("m").suma)).toBeTruthy();
    expect(screen.getByText(amendaEvidenta("e3").suma)).toBeTruthy();
    expect(container.textContent).toContain("art. 260 alin. (1) lit. m)");
    expect(container.textContent).toContain("de începere și de sfârșit");
    expect(container.textContent).not.toContain("undefined");
    expect(
      screen.getByRole("link", { name: /Tot ce cere art\. 119/u }).getAttribute("href"),
    ).toBe("/evidenta-orelor-de-munca");
  });
});
```

```tsx
// src/app/(marketing)/_componente/intrebari-unealta.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IntrebariUnealta } from "./intrebari-unealta";

describe("lista de întrebări a unei unelte", () => {
  it("pune fiecare întrebare ca titlu, cu temeiul și legătura când există", () => {
    render(
      <IntrebariUnealta
        titlu="Ce se mai întreabă"
        intrebari={[
          { q: "Prima?", a: "Răspuns unu." },
          {
            q: "A doua?",
            a: "Răspuns doi.",
            temei: "art. 119 alin. (1) Codul muncii",
            legatura: { href: "?varianta=individuala#documentul", eticheta: "Fă fișele" },
          },
        ]}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Prima?",
      "A doua?",
    ]);
    expect(screen.getByText("art. 119 alin. (1) Codul muncii")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Fă fișele" }).getAttribute("href")).toBe(
      "?varianta=individuala#documentul",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
```

- [ ] **Pasul 2: Rulează testele și vezi-le picând**

Rulează `pnpm exec vitest run src/content/landing/intrebari-pontaj.test.ts "src/app/(marketing)/_componente/ce-cere-itm.test.tsx" "src/app/(marketing)/_componente/intrebari-unealta.test.tsx"`. Rezultatul așteptat: trei fișiere eșuate, cu `Failed to resolve import`.

- [ ] **Pasul 3: Implementarea minimă**

```ts
// src/content/landing/intrebari-pontaj.ts
import { EVIDENTA_ORELOR } from "@/content/legal/evidenta-orelor";
import type { Amenda } from "@/content/legal/tipuri";
import { CODURI_LEGENDA } from "@/lib/unelte/coduri-pontaj";

/**
 * Întrebările și textele de lege de pe paginile foii de pontaj și ale condicii.
 *
 * ── DE UNDE VIN ───────────────────────────────────────────────────────────
 * Codul muncii, forma consolidată de pe legislatie.just.ro
 * (DetaliiDocument/128647, ultima consolidare listată: 27.04.2026), descărcat
 * cu curl și citit ca text pe 8 oct 2026: art. 112 alin. (1); art. 119 alin. (1)
 * și (2); art. 120 alin. (1); art. 122 alin. (1); art. 125 alin. (1); art. 126;
 * art. 134 alin. (1) și (3); art. 137 alin. (1)–(3); art. 142; art. 15¹ lit. d)
 * (cu excepția din art. 105 alin. (1) lit. c)); art. 260 alin. (1) lit. m) și e³).
 *
 * ── DE CE SUMELE NU SE SCRIU AICI ─────────────────────────────────────────
 * Amenzile se citesc din pagina evidenței orelor (`EVIDENTA_ORELOR`), după
 * temei. O corectură se face într-un singur loc; dacă pagina-lege își schimbă
 * temeiul, `amendaEvidenta` aruncă și testul pică — nu se afișează o sumă veche.
 */

export type IntrebareUnealta = Readonly<{
  q: string;
  a: string;
  /** Articolul pe care stă răspunsul, afișat mărunt sub el. */
  temei?: string;
  /** Un drum din răspuns spre unealtă, cu parametrii gata puși. */
  legatura?: Readonly<{ href: string; eticheta: string }>;
}>;

const TEMEI_AMENDA = { m: "lit. m)", e3: "lit. e³)" } as const;

export function amendaEvidenta(cheie: keyof typeof TEMEI_AMENDA): Amenda {
  const temei = TEMEI_AMENDA[cheie];
  const amenda = EVIDENTA_ORELOR.amenzi.find((a) => a.temei.includes(temei));
  if (amenda === undefined) {
    throw new Error(`Amenda cu temeiul „${temei}” lipsește din pagina evidenței orelor.`);
  }
  return amenda;
}

/** „10.000 – 15.000 lei, pentru fiecare persoană, plafon 200.000 lei” */
export function textAmenda(a: Amenda): string {
  return a.aplicare === undefined ? a.suma : `${a.suma}, ${a.aplicare}`;
}

const LIPSA = amendaEvidenta("m");
const PARTIAL = amendaEvidenta("e3");

export const ACOPERIRE_FOAIE =
  "Fișa individuală are ora de început și ora de sfârșit pe fiecare zi, deci acoperă art. 119 alin. (1). Foaia colectivă ține orele pe zi: e documentul pentru salarii și nu înlocuiește, singură, evidența cerută de art. 119.";

export const ACOPERIRE_CONDICA =
  "Condica are, pe fiecare zi și pentru fiecare om, ora sosirii și ora plecării — exact conținutul cerut de art. 119 alin. (1). Codul muncii nu impune un model anume, deci o condică ținută pe hârtie sau în Excel e la fel de valabilă.";

export const INTREBARI_FOAIE_PONTAJ: readonly IntrebareUnealta[] = [
  {
    q: "Ce coduri se trec în foaia de pontaj?",
    a: `În celula zilei se scrie numărul de ore lucrate. Când omul n-a lucrat, se scrie un cod: ${CODURI_LEGENDA.map(
      (c) => `${c.cod} pentru ${c.denumire}`,
    ).join(
      ", ",
    )}. Sunt codurile modulului de pontaj din aplicație, iar fișierul Excel le numără singur, pe fiecare om.`,
  },
  {
    q: "Cum se calculează norma lunară?",
    a: "Zilele lucrătoare ale lunii — de luni până vineri, fără sărbătorile legale — înmulțite cu orele pe zi. La normă întreagă sunt 8 ore pe zi și 40 pe săptămână. Pentru cine lucrează cu timp parțial, scrie norma după nume, cu o bară: „Ilie Maria | 4”; merge și lipit direct din Excel, cu numele și orele pe două coloane. Norma lunii se socotește pe zilele de luni până vineri oricum ar fi împărțit programul, inclusiv în ture.",
    temei: "art. 112 alin. (1) Codul muncii",
  },
  {
    q: "Foaia colectivă ajunge la un control ITM?",
    a: `Nu, singură. Legea cere, pentru fiecare salariat și fiecare zi, ora de începere și ora de sfârșit a programului, iar foaia colectivă are doar orele pe zi. Alege varianta individuală — o fișă pe angajat, cu ora de început, de sfârșit și pauza — sau condica de prezență. Lipsa evidenței se amendează cu ${LIPSA.suma}.`,
    temei: `art. 119 alin. (1); ${LIPSA.temei}`,
    legatura: { href: "?varianta=individuala#documentul", eticheta: "Fă fișele individuale" },
  },
  {
    q: "Ce trec pentru munca de sâmbătă, duminică sau de sărbători?",
    a: "Orele lucrate, ca în orice zi. Alege programul „Luni–sâmbătă” sau „Toate zilele (ture)”, ca zilele acelea să rămână deschise, fără cod de repaus. Repausul săptămânal e de 48 de ore consecutive, de regulă sâmbăta și duminica; când se dă în alte zile, salariații primesc un spor stabilit prin contractul colectiv sau individual. Pentru munca din zilele de sărbătoare legală se dă timp liber în următoarele 30 de zile, iar dacă nu se poate, un spor de cel puțin 100% din salariul de bază.",
    temei: "art. 137 și art. 142 Codul muncii",
    legatura: { href: "?program=ture#documentul", eticheta: "Vezi foaia pe ture" },
  },
  {
    q: "Cum se trec orele suplimentare și cele de noapte?",
    a: "În coloanele lor, separat de orele din program. Munca suplimentară e cea făcută peste durata normală a săptămânii și se compensează cu ore libere plătite în următoarele 90 de zile. Munca de noapte e cea dintre 22:00 și 6:00; pentru zilele cu cel puțin 3 ore de noapte, salariatul primește fie program redus cu o oră, fie un spor de 25% din salariul de bază.",
    temei: "art. 120 alin. (1), art. 122 alin. (1), art. 125 alin. (1) și art. 126 Codul muncii",
  },
  {
    q: "Ce face singur fișierul Excel?",
    a: "Adună orele pe om și pe zi, numără zilele de CO, CM, CFS, AN și D și calculează norma fiecăruia. Codurile se aleg dintr-o listă, iar la tipărire capul de tabel se repetă pe fiecare pagină A4. În fișa individuală, orele lucrate ies din ora de început, cea de sfârșit și pauză, inclusiv pentru tura care trece de miezul nopții. Orele care trec de norma unui angajat cu timp parțial se colorează cu roșu.",
  },
  {
    q: "Ce risc dacă un angajat cu timp parțial lucrează peste normă?",
    a: `Depășirea timpului de muncă din contractul cu timp parțial e muncă nedeclarată, chiar dacă omul are contract, în afara cazurilor de forță majoră sau de lucrări urgente. Amenda e de ${textAmenda(PARTIAL)}. Evidența orelor e chiar proba, de aceea fișierul Excel semnalează depășirea.`,
    temei: PARTIAL.temei,
  },
];

export const INTREBARI_CONDICA: readonly IntrebareUnealta[] = [
  {
    q: "Condica electronică e valabilă la control?",
    a: "Codul muncii nu cere hârtie și nu impune un model. Art. 119 cere conținutul — pentru fiecare salariat, zilnic, ora de începere și ora de sfârșit a programului — și ca evidența să fie la locul de muncă, gata de arătat inspectorului. O evidență ținută pe calculator sau într-o aplicație îndeplinește asta, dacă poate fi deschisă acolo, la control.",
  },
  {
    q: "Trebuie semnată de salariat?",
    a: "Codul muncii nu cere semnătura zilnică a salariatului: art. 119 cere orele, nu o semnătură. Multe firme o cer totuși prin regulamentul intern, ca omul să-și confirme orele; de aceea modelul de aici are coloana de semnătură, pentru cine o folosește.",
  },
  {
    q: "Ce fac dacă lucrăm și sâmbăta sau în ture?",
    a: "Alege programul „Luni–sâmbătă” sau „Toate zilele (ture)”: zilele acelea primesc câte un rând pe fiecare om. În programul de luni până vineri, sâmbetele, duminicile și sărbătorile apar câte un singur rând, marcat cu L sau SL, ca în condică să nu lipsească nicio zi. Legea cere evidența orelor prestate zilnic, deci și în zilele în care se lucrează excepțional.",
    temei: "art. 119 alin. (1) Codul muncii",
    legatura: { href: "?program=ture#documentul", eticheta: "Vezi condica pe ture" },
  },
  {
    q: "Cum se calculează orele lucrate?",
    a: "În Excel, singure: ora plecării minus ora sosirii, minus pauza în minute, inclusiv pentru tura care trece de miezul nopții. A doua filă adună, pe fiecare om, orele și zilele de CO, CM, CFS, AN și D. Pauzele nu intră în programul de lucru dacă regulamentul intern sau contractul colectiv nu prevăd altfel; la peste 6 ore pe zi, salariatul are dreptul la pauză de masă.",
    temei: "art. 134 alin. (1) și (3) Codul muncii",
  },
  {
    q: "Cum arată o condică completată?",
    a: "Ca mai sus, cu numele oamenilor trecute și câte un rând pe fiecare zi, cu ora sosirii, ora plecării, pauza și semnătura. Poți vedea un exemplu gata completat cu trei angajați, apoi îl schimbi cu oamenii tăi.",
    legatura: {
      href: "?an=2026&luna=10&firma=Construct%20SRL&angajati=Popa%20Ion%0AIlie%20Maria%0ARadu%20Andrei#documentul",
      eticheta: "Vezi condica completată",
    },
  },
];
```

```tsx
// src/app/(marketing)/_componente/intrebari-unealta.tsx
import type { IntrebareUnealta } from "@/content/landing/intrebari-pontaj";

import { Banda } from "./banda";

/**
 * Lista „întrebare, apoi răspuns” a unei unelte. FĂRĂ marcaj `FAQPage`: vezi
 * `intrebari/page.tsx` — rezultatele îmbogățite s-au retras la 7 mai 2026, iar
 * valoarea rămâne în structură: o întrebare urmată imediat de răspunsul ei.
 *
 * Legăturile sunt `<a>`, nu `Link`: cele mai multe sunt doar parametri pe
 * aceeași pagină („?varianta=individuala#documentul”), adică o nouă randare de
 * server, la fel ca formularul GET.
 */
export function IntrebariUnealta({
  titlu,
  intrebari,
}: Readonly<{ titlu: string; intrebari: readonly IntrebareUnealta[] }>) {
  return (
    <Banda inaltime="medie" supratitlu="Întrebări" titlu={titlu}>
      <div className="border-mk-rigla/40 mt-8 border-t">
        {intrebari.map((r) => (
          <div
            key={r.q}
            className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
          >
            <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
              {r.q}
            </h3>
            <div className="md:col-span-8">
              <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">{r.a}</p>
              {r.temei !== undefined && (
                <p className="font-mk-date text-mk-text-slab mt-2 text-[0.75rem] tracking-[0.04em]">
                  {r.temei}
                </p>
              )}
              {r.legatura !== undefined && (
                <a
                  href={r.legatura.href}
                  className="mt-2 inline-block text-[0.9375rem] underline underline-offset-4"
                >
                  {r.legatura.eticheta}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </Banda>
  );
}
```

```tsx
// src/app/(marketing)/_componente/ce-cere-itm.tsx
import Link from "next/link";

import { amendaEvidenta } from "@/content/landing/intrebari-pontaj";
import { EVIDENTA_ORELOR } from "@/content/legal/evidenta-orelor";

import { Banda } from "./banda";

/**
 * „Ce cere inspectorul de muncă” pe paginile foii de pontaj și ale condicii.
 *
 * Cerința și amenzile vin din pagina evidenței orelor, nu sunt rescrise:
 * aceeași frază, aceeași sumă, același temei — iar `acoperire` spune cinstit
 * cât din cerință acoperă documentul de pe pagina asta (auditul din 8 oct 2026:
 * foaia colectivă singură NU acoperă art. 119).
 */
export function CeCereItm({ acoperire }: Readonly<{ acoperire: string }>) {
  const [cerinta] = EVIDENTA_ORELOR.raspunsScurt;
  const amenzi = [amendaEvidenta("m"), amendaEvidenta("e3")];
  return (
    <Banda inaltime="medie" supratitlu="Control ITM" titlu="Ce cere inspectorul de muncă">
      <div className="mt-6 max-w-[68ch] space-y-4 text-[0.9375rem] leading-[1.7]">
        {cerinta !== undefined && <p>{cerinta}</p>}
        <p className="font-medium">{acoperire}</p>
      </div>
      <dl className="border-mk-rigla/40 mt-8 max-w-[68ch] border-t">
        {amenzi.map((a) => (
          <div
            key={a.temei}
            className="border-mk-rigla/40 grid gap-1 border-b py-4 sm:grid-cols-[1fr_auto] sm:gap-x-6"
          >
            <dt className="text-[0.9375rem] leading-[1.5]">{a.fapta}</dt>
            <dd className="font-mk-date text-[0.9375rem] tabular-nums sm:text-right">{a.suma}</dd>
            <dd className="text-mk-text-slab text-[0.8125rem] sm:col-span-2">
              {a.aplicare === undefined ? a.temei : `${a.aplicare} · ${a.temei}`}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-[0.9375rem]">
        <Link href="/evidenta-orelor-de-munca" className="underline underline-offset-4">
          Tot ce cere art. 119, cu toate amenzile
        </Link>
        .
      </p>
    </Banda>
  );
}
```

- [ ] **Pasul 4: Rulează testele, trec**

Rulează aceeași comandă ca la Pasul 2. Rezultatul așteptat: `intrebari-pontaj.test.ts` are 6 teste trecute, `ce-cere-itm.test.tsx` 1, `intrebari-unealta.test.tsx` 1. Testul ITM caută „de începere și de sfârșit”, fiindcă `EVIDENTA_ORELOR.raspunsScurt[0]` spune „cu evidențierea orelor de începere și de sfârșit ale programului”.

- [ ] **Pasul 5: Lanțul complet**, plus `prettier --check` pe cele șase fișiere. Componentele nu sunt încă folosite de nicio pagină (E13/E14 le montează), iar exporturile nefolosite nu sunt erori de lint.

- [ ] **Commit** — căi: `src/content/landing/intrebari-pontaj.ts src/content/landing/intrebari-pontaj.test.ts "src/app/(marketing)/_componente/ce-cere-itm.tsx" "src/app/(marketing)/_componente/ce-cere-itm.test.tsx" "src/app/(marketing)/_componente/intrebari-unealta.tsx" "src/app/(marketing)/_componente/intrebari-unealta.test.tsx"`. Mesaj: `feat(unelte): ce cere ITM și întrebările foii de pontaj și ale condicii, din pagina evidenței orelor`.

---
### Task E8: Foaia colectivă și fișa individuală ca documente PDF/Word

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts`. `foaieCaDocument` (în forma lui B4/B7: `foaieCaDocument(foaie, notaAngajati = null)`, cu `textNorma`) RĂMÂNE până la E10, fiindcă ruta veche o folosește. Codul nou se adaugă dedesubt.
- Test: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.test.ts`. Se ADAUGĂ blocuri; cele două `describe` existente rămân până la E10.

**Interfețe:**
- Consumă: `Pontaj`, `AngajatPontaj`, `angajatiPentruFise`, `etichetaProgram`, `normaLunara`, `oreScurt`, `rezumatNorma`, `parametriPontaj`, `construiestePontaj` (E3); `randAntetFirma` (E1); `CODURI_ABSENTA`, `TEXT_LEGENDA` (E2); `type Coloana`, `type DocumentTabelar` (document-tabelar.ts); `cuDe`; `oreFoaie` din `./foaie` (B7); `Pontaj.notaAngajati` (E3, nota lui B4); în test: `latimiColoane`, `randeazaPdfMultiplu` (E4), `pornesteDocument` din `@/lib/pdf/document`.
- Produce:
  ```ts
  export const COLOANE_TOTAL_COLECTIVA: readonly Coloana[];
  export const COLOANE_FISA: readonly Coloana[];
  export const NOTA_COLECTIVA_119: string;
  export const NOTA_FISA_119: string;
  export function notaSarbatori(p: Pontaj): string;
  export function pontajColectivCaDocument(p: Pontaj): DocumentTabelar;
  export function fisaIndividualaCaDocument(p: Pontaj, a: AngajatPontaj): DocumentTabelar;
  export function documenteleFoii(p: Pontaj): readonly [DocumentTabelar, ...DocumentTabelar[]];
  ```

- [ ] **Pasul 1: Scrie testul care pică.** Adaugă la sfârșitul lui `foaie-document.test.ts` blocurile de mai jos, iar în capul fișierului importurile suplimentare:

```ts
// în capul fișierului, după importurile existente:
import { pornesteDocument } from "@/lib/pdf/document";
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";
import { latimiColoane, randeazaPdfMultiplu } from "@/lib/unelte/pdf";
import { PDFDocument } from "pdf-lib";

import {
  documenteleFoii,
  fisaIndividualaCaDocument,
  pontajColectivCaDocument,
} from "./foaie-document";
import { construiestePontaj, parametriPontaj } from "./pontaj";
```

(Ordinea importurilor o aranjează prettier. `foaieCaDocument` rămâne în importul existent din `./foaie-document`, deci cele două importuri din același modul se unesc într-unul singur.)

```ts
const pontaj = (q: Record<string, string>) =>
  construiestePontaj(parametriPontaj(new URLSearchParams({ an: "2026", luna: "12", ...q })));

/**
 * Lățimile se aleg pe fontul REAL (DejaVu 8 pt): `taie` taie la `w − 4`, iar o
 * etichetă tăiată („Ore\nnoap…”) e un cap de tabel pe care nu-l mai citește
 * nimeni. Întoarce lista celor care nu încap, ca eșecul să le numească.
 */
async function prealungi(
  d: DocumentTabelar,
  corp: Readonly<Record<number, readonly string[]>>,
): Promise<string[]> {
  const { fonturi } = await pornesteDocument("proba", "proba");
  const latimi = latimiColoane(d);
  const prea: string[] = [];
  d.coloane.forEach((c, i) => {
    const loc = (latimi[i] ?? 0) - 4;
    for (const linie of c.eticheta.split("\n")) {
      if (fonturi.aldin.widthOfTextAtSize(linie, 8) > loc) prea.push(`antet „${linie}”`);
    }
    for (const text of corp[i] ?? []) {
      if (fonturi.normal.widthOfTextAtSize(text, 8) > loc) prea.push(`coloana ${String(i)}: „${text}”`);
    }
  });
  return prea;
}

describe("foaia colectivă", () => {
  it("are numele, h/zi, o coloană pe zi și totalurile pe ore și pe coduri", () => {
    const d = pontajColectivCaDocument(pontaj({ angajati: "Popa Ion\nIlie Maria | 4" }));
    expect(d.coloane).toHaveLength(2 + 31 + 8);
    expect(d.coloane.slice(-8).map((c) => c.eticheta)).toEqual([
      "Ore\nlucr.",
      "Ore\nsupl.",
      "Ore\nnoapte",
      "CO",
      "CM",
      "CFS",
      "AN",
      "D",
    ]);
    expect(d.coloane[2]?.eticheta).toBe("1\nM");
    const [popa, ilie] = d.randuri;
    expect(popa?.slice(0, 2)).toEqual(["Popa Ion", "8"]);
    expect(ilie?.slice(0, 2)).toEqual(["Ilie Maria", "4"]);
    expect(ilie?.[2]).toBe("SL"); // 1 decembrie
    expect(ilie?.[3]).toBe(""); // 2 decembrie, miercuri
    expect(ilie?.[6]).toBe("L"); // 5 decembrie, sâmbătă
    expect(d.umbrite).toContain(2);
    expect(d.umbrite).toContain(6);
    expect(d.umbrite).not.toContain(3);
    expect(d.subtitlu).toContain("21 de zile lucrătoare");
    expect(d.note.join(" ")).toMatch(/Crăciunul/u);
    expect(d.note.join(" ")).toMatch(/CFS = concediu fără salariu/u);
    expect(d.numeFisier).toBe("pontaj-2026-12");
  });

  it("antetul firmei stă în subtitlu, înaintea normei", () => {
    const d = pontajColectivCaDocument(pontaj({ firma: "Construct SRL", cui: "14399840" }));
    expect(d.subtitlu?.startsWith("Construct SRL · CUI 14399840 — 21 de zile")).toBe(true);
  });

  it("pe ture nu se umbrește și nu se pune nimic dinainte", () => {
    const d = pontajColectivCaDocument(pontaj({ program: "ture", angajati: "Popa Ion" }));
    expect(d.umbrite).toEqual([]);
    expect(d.randuri[0]?.slice(2, 33).every((c) => c === "")).toBe(true);
  });

  it("foaia goală are rânduri fără nume și fără h/zi, de completat de mână", () => {
    const d = pontajColectivCaDocument(pontaj({}));
    expect(d.randuri).toHaveLength(10);
    expect(d.randuri[0]?.slice(0, 2)).toEqual(["", ""]);
  });

  it("nicio etichetă și niciun conținut tipic nu se taie în PDF, pe o lună de 31 de zile", async () => {
    const d = pontajColectivCaDocument(pontaj({ angajati: "Țăranu Ioana-Maria | 10:30" }));
    const zile = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 2, ["SL", "L", "12"]]));
    expect(await prealungi(d, { 0: ["Țăranu Ioana-Maria"], 1: ["10:30"], ...zile })).toEqual([]);
  });
});

describe("fișa individuală", () => {
  it("are fiecare zi a lunii, cu ziua, codul pus dinainte și sărbătoarea la observații", () => {
    const d = fisaIndividualaCaDocument(pontaj({}), { nume: "Popa Ion", oreZi: 4 });
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Data",
      "Ziua",
      "Ora\nînceput",
      "Ora\nsfârșit",
      "Pauză\n(min)",
      "Ore\nlucrate",
      "Ore\nsupl.",
      "Ore\nnoapte",
      "Cod",
      "Semnătura",
      "Observații",
    ]);
    expect(d.randuri).toHaveLength(31 + 1);
    expect(d.randuri[0]).toEqual([
      "01.12", "Ma", "", "", "", "", "", "", "SL", "", "Ziua Națională a României",
    ]);
    expect(d.randuri[4]?.[8]).toBe("L"); // 5 decembrie, sâmbătă
    expect(d.randuri[31]?.[0]).toBe("Total");
    expect(d.campuri).toEqual([
      { eticheta: "Angajat", valoare: "Popa Ion" },
      {
        eticheta: "Normă",
        valoare: "4 h/zi × 21 de zile lucrătoare = 84 h · program luni–vineri",
      },
    ]);
    expect(d.orientare).toBe("portret");
  });

  it("varianta individuală dă câte o fișă pe om; fără nume, una necompletată", () => {
    const trei = documenteleFoii(
      pontaj({ varianta: "individuala", angajati: "Popa Ion\nIlie Maria | 4\nRadu Andrei" }),
    );
    expect(trei.map((d) => d.campuri[0]?.valoare)).toEqual(["Popa Ion", "Ilie Maria", "Radu Andrei"]);
    const goala = documenteleFoii(pontaj({ varianta: "individuala" }));
    expect(goala).toHaveLength(1);
    expect(goala[0].campuri[0]?.valoare).toBe("");
    expect(documenteleFoii(pontaj({}))).toHaveLength(1); // colectiva: un singur document
  });

  it("nota lui B4 de listă tăiată: ultima pe foaia colectivă, pe prima fișă din teanc", () => {
    const multi = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");
    const NOTA = "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.";
    expect(pontajColectivCaDocument(pontaj({ angajati: multi })).note.at(-1)).toBe(NOTA);
    const fise = documenteleFoii(pontaj({ varianta: "individuala", angajati: multi }));
    expect(fise).toHaveLength(60);
    expect(fise[0].note.at(-1)).toBe(NOTA);
    expect(fise[1]?.note).not.toContain(NOTA);
    expect(pontajColectivCaDocument(pontaj({ angajati: "Popa Ion" })).note.join(" ")).not.toMatch(
      /nu apar aici/u,
    );
  });

  it("fiecare fișă încape pe O pagină A4, chiar și pe 31 de zile cu antetul cel mai lung", async () => {
    const lunga = "Societatea de Construcții și Instalații Moldova-Nord SRL ".repeat(3);
    const documente = documenteleFoii(
      pontaj({
        varianta: "individuala",
        firma: lunga,
        cui: "RO 14399840",
        compartiment: "Producție și întreținere utilaje, schimbul de noapte",
        angajati: "Popa Ion\nIlie Maria | 4\nȚăranu Ioana-Maria | 6:30",
      }),
    );
    const pdf = await PDFDocument.load(await randeazaPdfMultiplu(documente));
    expect(pdf.getPageCount()).toBe(3);
  });

  it("nicio etichetă și niciun conținut tipic nu se taie în PDF", async () => {
    const d = fisaIndividualaCaDocument(pontaj({}), { nume: "Popa Ion", oreZi: 8 });
    expect(
      await prealungi(d, { 0: ["01.12", "28.02"], 1: ["Sâ", "Du", "Mi"], 8: ["CFS", "SL"] }),
    ).toEqual([]);
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.test.ts"`. Rezultatul așteptat: `pontajColectivCaDocument is not a function` / „does not provide an export named”.

- [ ] **Pasul 3: Implementarea minimă.** În `foaie-document.ts`, importurile vechi (forma lăsată de B7):

```ts
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { textNorma, type Foaie } from "./foaie";
```

devin:

```ts
import { cuDe } from "@/content/legal/zile-libere";
import { randAntetFirma } from "@/lib/unelte/antet-firma";
import { CODURI_ABSENTA, TEXT_LEGENDA } from "@/lib/unelte/coduri-pontaj";
import type { Coloana, DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { oreFoaie, textNorma, type Foaie } from "./foaie";
import {
  angajatiPentruFise,
  etichetaProgram,
  normaLunara,
  oreScurt,
  rezumatNorma,
  type AngajatPontaj,
  type Pontaj,
} from "./pontaj";
```

La sfârșitul fișierului, după `foaieCaDocument`, adaugă:

```ts
/*
 * ── LĂȚIMILE, ÎN PUNCTE PDF ───────────────────────────────────────────────
 * Alese pe fontul real (DejaVu 8 pt, măsurat pe 8 oct 2026): „31” aldin are
 * 11,1 pt, „noapte” aldin 31,6 pt, „Țăranu Ioana-Maria” 77,9 pt; `taie` taie
 * la `w − 4`. Suma pe o lună de 31 de zile e 761,2 pt, lățimea utilă A4 peisaj
 * e 761,89 — deci zilele au 15,2 pt și nu se mai lățesc, iar testul
 * „nicio etichetă nu se taie” le apără. „Normă” e DOAR în Excel: în PDF ar fi
 * lăsat numelui 64 pt; norma omului se vede din „h/zi”, cea a lunii din subtitlu.
 */
const LATIME_NUME = 90;
const LATIME_ORE_ZI = 28;
const LATIME_ZI = 15.2;
const LATIME_COD: Readonly<Record<string, number>> = { CO: 17, CM: 18, CFS: 21.5, AN: 17.5, D: 11 };

/** Coloanele de după zile, aceleași în PDF, în Word și pe ecran. */
export const COLOANE_TOTAL_COLECTIVA: readonly Coloana[] = [
  { eticheta: "Ore\nlucr.", latime: 24.5 },
  { eticheta: "Ore\nsupl.", latime: 26.5 },
  { eticheta: "Ore\nnoapte", latime: 36 },
  ...CODURI_ABSENTA.map((c) => ({ eticheta: c.cod, latime: LATIME_COD[c.cod] ?? 18 })),
];

/** Fișa individuală, A4 portret: suma e exact lățimea utilă (515,28 pt). */
export const COLOANE_FISA: readonly Coloana[] = [
  { eticheta: "Data", latime: 28 },
  { eticheta: "Ziua", latime: 25 },
  { eticheta: "Ora\nînceput", latime: 39 },
  { eticheta: "Ora\nsfârșit", latime: 34 },
  { eticheta: "Pauză\n(min)", latime: 32 },
  { eticheta: "Ore\nlucrate", latime: 37 },
  { eticheta: "Ore\nsupl.", latime: 27 },
  { eticheta: "Ore\nnoapte", latime: 37 },
  { eticheta: "Cod", latime: 22 },
  { eticheta: "Semnătura", latime: 70 },
  { eticheta: "Observații", latime: 164.28 },
];

export const NOTA_COLECTIVA_119 =
  "Foaia colectivă ține orele pe zi. Ora de început și cea de sfârșit, cerute zilnic de art. 119 alin. (1) din Codul muncii, se țin în fișa individuală sau în condica de prezență.";

export const NOTA_FISA_119 =
  "Ora de început și ora de sfârșit, zilnic, pentru fiecare salariat: art. 119 alin. (1) din Codul muncii.";

/** „Sărbători legale în lună: 1 Ziua Națională a României; 25 Crăciunul.” */
export function notaSarbatori(p: Pontaj): string {
  const lista = p.zile
    .filter((z) => z.sarbatoare !== null)
    .map((z) => `${String(z.zi)} ${z.sarbatoare ?? ""}`)
    .join("; ");
  return `Sărbători legale în lună: ${lista === "" ? "niciuna" : lista}.`;
}

/**
 * Foaia colectivă: un rând pe om, o celulă pe zi. Zilele din afara programului
 * poartă dinainte L sau SL — o literă rezistă la tipărirea alb-negru, nuanța nu
 * (auditul din 8 oct 2026: weekendul și sărbătoarea aveau aceeași nuanță).
 */
export function pontajColectivCaDocument(p: Pontaj): DocumentTabelar {
  const antet = randAntetFirma(p.antet);
  return {
    titlu: `Foaie colectivă de prezență — ${p.eticheta}`,
    subtitlu: antet === null ? rezumatNorma(p) : `${antet} — ${rezumatNorma(p)}`,
    campuri: [],
    paragrafe: [],
    coloane: [
      { eticheta: "Angajat", latime: LATIME_NUME },
      { eticheta: "h/zi", latime: LATIME_ORE_ZI },
      ...p.zile.map((z) => ({ eticheta: `${String(z.zi)}\n${z.litera}`, latime: LATIME_ZI })),
      ...COLOANE_TOTAL_COLECTIVA,
    ],
    randuri: p.angajati.map((a) => [
      a.nume,
      a.nume === "" ? "" : oreScurt(a.oreZi),
      ...p.zile.map((z) => z.codImplicit),
      ...COLOANE_TOTAL_COLECTIVA.map(() => ""),
    ]),
    umbrite: p.zile.flatMap((z, i) => (z.inProgram ? [] : [i + 2])),
    // Nota lui B4 la urmă: fișierul circulă fără pagină și spune singur că lista e tăiată.
    note: [
      notaSarbatori(p),
      TEXT_LEGENDA,
      NOTA_COLECTIVA_119,
      ...(p.notaAngajati === null ? [] : [p.notaAngajati]),
    ],
    semnaturi: ["Întocmit", "Verificat"],
    orientare: "peisaj",
    numeFisier: `pontaj-${String(p.an)}-${String(p.luna).padStart(2, "0")}`,
  };
}

/**
 * Fișa individuală: o pagină A4 pe om, cu ora de început și de sfârșit pe
 * fiecare zi — conținutul cerut de art. 119 alin. (1), pe care foaia colectivă
 * nu-l are. Rândurile rămân de 16 pt: la 17 pt, o lună de 31 de zile cu antetul
 * cel mai lung trecea semnăturile pe pagina a doua (calculat pe `pdf.ts`).
 */
export function fisaIndividualaCaDocument(
  p: Pontaj,
  a: AngajatPontaj,
  notaAngajati: string | null = null,
): DocumentTabelar {
  const norma = oreFoaie(normaLunara(p.zileLucratoare, a.oreZi));
  return {
    titlu: `Fișă individuală de pontaj — ${p.eticheta}`,
    subtitlu: randAntetFirma(p.antet),
    campuri: [
      { eticheta: "Angajat", valoare: a.nume },
      {
        eticheta: "Normă",
        valoare: `${oreScurt(a.oreZi)} h/zi × ${cuDe(p.zileLucratoare, "zile lucrătoare")} = ${norma} · program ${etichetaProgram(p.program)}`,
      },
    ],
    paragrafe: [],
    coloane: COLOANE_FISA,
    randuri: [
      ...p.zile.map((z) => [
        z.dataScurta,
        z.ziScurta,
        "",
        "",
        "",
        "",
        "",
        "",
        z.codImplicit,
        "",
        z.sarbatoare ?? "",
      ]),
      ["Total", "", "", "", "", "", "", "", "", "", ""],
    ],
    umbrite: [],
    note: [TEXT_LEGENDA, NOTA_FISA_119, ...(notaAngajati === null ? [] : [notaAngajati])],
    semnaturi: ["Salariat", "Întocmit", "Verificat"],
    orientare: "portret",
    numeFisier: `fisa-pontaj-${String(p.an)}-${String(p.luna).padStart(2, "0")}`,
  };
}

/** Documentele de descărcat: foaia colectivă, sau câte o fișă pe om. Niciodată zero. */
export function documenteleFoii(p: Pontaj): readonly [DocumentTabelar, ...DocumentTabelar[]] {
  if (p.varianta === "colectiva") return [pontajColectivCaDocument(p)];
  const [primul, ...restul] = angajatiPentruFise(p);
  // Nota de listă tăiată stă pe prima fișă: e prima foaie din teanc.
  return [
    fisaIndividualaCaDocument(p, primul, p.notaAngajati),
    ...restul.map((a) => fisaIndividualaCaDocument(p, a)),
  ];
}
```

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/foaie-de-pontaj/"`. Rezultatul așteptat: în `foaie-document.test.ts` trec testele vechi și cele 10 noi; `pontaj.test.ts` și `foaie.test.ts` (al lui B) trec întregi.

**Dacă „încape pe O pagină” pică** cu 4–6 pagini, rândul nu e cauza (rămâne 16 pt). Măsoară ce a crescut: `randeazaPdf(fisaIndividualaCaDocument(...))` pe un singur om trebuie să dea 1. Dacă dă 2, nota cu legenda s-a rupt pe 3 rânduri. Scurtează `NOTA_FISA_119` și reia testul, fără să atingi lățimile.
**Dacă „nicio etichetă nu se taie” pică**, mesajul numește eticheta. Lărgește doar coloana aceea cu cât lipsește și scade aceeași valoare din `LATIME_NUME`, respectiv din „Observații”, ca suma să rămână neschimbată. Lățimile se schimbă doar așa, nu „la ochi”.

- [ ] **Pasul 5: Lanțul complet**, plus `prettier --check` pe cele două fișiere.

- [ ] **Commit** — căi: `"src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.test.ts"`. Mesaj: `feat(unelte): foaia colectivă cu totaluri pe coduri și fișa individuală cu ora de început și de sfârșit`.

---

### Task E9: Foaia de pontaj în Excel, cu formule

**Fișiere:**
- Create: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-xlsx.ts`
- Test: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-xlsx.test.ts`

**Interfețe:**
- Consumă: ExcelJS 4.4.0 (`Workbook`, `Worksheet.addRow`, `getCell(r, c)`, `getColumn(c).letter`, `addConditionalFormatting`, `cell.dataValidation`, `cell.numFmt`); `pregatesteTiparXlsx`, `numeFilaSigur`, `validareCoduri`, `VALIDARE_ORA`, `VALIDARE_DURATA`, `VALIDARE_PAUZA` (E6); `CODURI_ABSENTA`, `LISTA_CODURI`, `TEXT_LEGENDA` (E2); `randAntetFirma` (E1); `amendaEvidenta`, `textAmenda` (E7); `documenteleFoii`, `notaSarbatori`, `NOTA_COLECTIVA_119`, `NOTA_FISA_119` (E8); `angajatiPentruFise`, `etichetaProgram`, `normaLunara`, `oreScurt`, `rezumatNorma`, `type Pontaj`, `type AngajatPontaj` (E3); `adresaDinFisier`, `SEMNATURA_FISIER`; `ADRESA_SITE` din `@/content/landing/contact`; `cuDe`; `oreFoaie` din `./foaie` (B7); `Pontaj.notaAngajati` (nota lui B4).
- Produce: `export async function registruPontaj(p: Pontaj): Promise<Uint8Array>;`

Așezarea (fixă; testele o citesc pe adrese):

| Foaia colectivă (`p.eticheta`, A4 peisaj)                                          | Fișa individuală (o filă pe om, A4 portret)                                                                       |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1 titlu · 2 antet firmă · 3 rezumat normă · 4 legendă                              | 1 titlu · 2 antet firmă · 3 „Angajat: …” · 4 „Normă: …” · 5 gol                                                   |
| 5 numerele zilelor, 6 inițialele (titluri repetate `5:6`; înghețat la B6)          | 6 capul de tabel (titlu repetat `6:6`; înghețat sub el)                                                           |
| 7… angajații: A nume, B h/zi, C… zilele, apoi Normă, Ore lucrate, Ore supl., Ore noapte, CO, CM, CFS, AN, D | 7…(6+n) zilele: A dată, B ziua, C început, D sfârșit, E pauză, F ore lucrate, G supl., H noapte, I cod, J observații |
| rândul TOTAL                                                                       | TOTAL, gol, Zile lucrate, Normă lunară, Diferență (ore), CO…D, [semnal timp parțial], semnături                   |

- [ ] **Pasul 1: Scrie testul care pică**

```ts
// src/app/(marketing)/unelte/foaie-de-pontaj/foaie-xlsx.test.ts
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { registruPontaj } from "./foaie-xlsx";
import { construiestePontaj, parametriPontaj } from "./pontaj";

const pontaj = (q: Record<string, string>) =>
  construiestePontaj(
    parametriPontaj(
      new URLSearchParams({ an: "2026", luna: "12", angajati: "Popa Ion\nIlie Maria | 4", ...q }),
    ),
  );

async function deschide(octeti: Uint8Array) {
  const registru = new ExcelJS.Workbook();
  // `ArrayBuffer`, nu `Buffer.from(...)`: tipul `Buffer` din exceljs extinde
  // `ArrayBuffer`, iar `Buffer<ArrayBuffer>` din Node nu-l satisface (TS2345,
  // verificat cu tsconfig-ul proiectului). Așa citește și `src/lib/import/excel.ts`.
  await registru.xlsx.load(octeti.slice().buffer);
  const zip = await JSZip.loadAsync(octeti);
  const xml = async (cale: string) => (await zip.file(cale)?.async("string")) ?? "";
  return { registru, xml };
}

/*
 * Decembrie 2026, 31 de zile: zilele sunt C…AG, apoi AH Normă, AI Ore lucrate,
 * AJ Ore supl., AK Ore noapte, AL CO, AM CM, AN CFS, AO AN, AP D.
 */
describe("Excelul foii colective", () => {
  it("are formule reale: normă, ore lucrate, COUNTIF pe fiecare cod, totaluri", async () => {
    const { registru } = await deschide(await registruPontaj(pontaj({})));
    expect(registru.worksheets.map((f) => f.name)).toEqual(["decembrie 2026"]);
    const f = registru.worksheets[0];
    if (f === undefined) throw new Error("fila lipsește");
    expect(f.getCell("A7").value).toBe("Popa Ion");
    expect(f.getCell("B7").value).toBe(8);
    expect(f.getCell("B8").value).toBe(4);
    expect(f.getCell("C7").value).toBe("SL");
    expect(f.getCell("D7").value).toBeNull();
    expect(f.getCell("G7").value).toBe("L");
    expect(f.getCell("AH7").formula).toBe("ROUND(B7*21,2)");
    expect(f.getCell("AI7").formula).toBe("SUM(C7:AG7)");
    expect(f.getCell("AL7").formula).toBe('COUNTIF(C7:AG7,"CO")');
    expect(f.getCell("AN8").formula).toBe('COUNTIF(C8:AG8,"CFS")');
    expect(f.getCell("AP8").formula).toBe('COUNTIF(C8:AG8,"D")');
    expect(f.getCell("A9").value).toBe("TOTAL");
    expect(f.getCell("C9").formula).toBe("SUM(C7:C8)");
    expect(f.getCell("AH9").formula).toBe("SUM(AH7:AH8)");
    // Colțul: suma rândului de total pe zile — dacă nu se închide cu coloana, se vede.
    expect(f.getCell("AI9").formula).toBe("SUM(C9:AG9)");
    expect(f.getCell("AL9").formula).toBe("SUM(AL7:AL8)");
    // Auditul: coloana de total n-avea lățime.
    for (let c = 1; c <= 42; c += 1) expect(f.getColumn(c).width, String(c)).toBeGreaterThan(0);
  });

  it("se tipărește pe A4 culcat, cu cele două rânduri de cap repetate", async () => {
    const { xml } = await deschide(await registruPontaj(pontaj({})));
    // ExcelJS scapă apostroful în XML: `&apos;decembrie 2026&apos;!$5:$6` (verificat pe 4.4.0).
    expect(await xml("xl/workbook.xml")).toMatch(/(&apos;|')decembrie 2026(&apos;|')!\$5:\$6/u);
    const foaie = await xml("xl/worksheets/sheet1.xml");
    expect(foaie).toMatch(/paperSize="9"/u);
    expect(foaie).toMatch(/orientation="landscape"/u);
  });

  it("celulele de zi au lista de coduri, iar orele peste norma de timp parțial se colorează", async () => {
    const { xml } = await deschide(await registruPontaj(pontaj({})));
    const foaie = await xml("xl/worksheets/sheet1.xml");
    expect(foaie).toMatch(/<formula1>(&quot;|")CO,CM,CFS,AN,D,L,SL(&quot;|")<\/formula1>/u);
    expect(foaie).toMatch(/<conditionalFormatting sqref="AI7:AI8"/u);
    expect(foaie).toMatch(/AND\(\$B7(&lt;|<)8,AI7(&gt;|>)AH7\)/u);
  });

  it("nota lui B4 de listă tăiată ajunge în Excel, doar când lista e tăiată", async () => {
    const multi = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");
    const text = async (q: Record<string, string>) => {
      const { registru } = await deschide(await registruPontaj(pontaj(q)));
      return (registru.worksheets[0]?.getSheetValues() ?? [])
        .flat()
        .filter((v): v is string => typeof v === "string")
        .join(" ");
    };
    expect(await text({ angajati: multi })).toContain("ceilalți 10 nu apar aici");
    expect(await text({})).not.toContain("nu apar aici");
  });

  it("nota de timp parțial citează amenda din pagina evidenței orelor", async () => {
    const { registru } = await deschide(await registruPontaj(pontaj({})));
    const text = (registru.worksheets[0]?.getSheetValues() ?? [])
      .flat()
      .filter((v): v is string => typeof v === "string")
      .join(" ");
    expect(text).toMatch(/10\.000 – 15\.000 lei/u);
    expect(text).toMatch(/art\. 15¹ lit\. d\)/u);
  });
});

describe("Excelul fișelor individuale", () => {
  it("are o filă pe om, cu nume sigure și dublurile deosebite", async () => {
    const { registru } = await deschide(
      await registruPontaj(
        pontaj({ varianta: "individuala", angajati: "Popa Ion\nPopa Ion\nAna/Maria | 4" }),
      ),
    );
    expect(registru.worksheets.map((f) => f.name)).toEqual(["Popa Ion", "Popa Ion (2)", "Ana Maria"]);
  });

  it("calculează orele din început, sfârșit și pauză, și peste miezul nopții", async () => {
    const { registru, xml } = await deschide(
      await registruPontaj(pontaj({ varianta: "individuala" })),
    );
    const f = registru.worksheets[1]; // Ilie Maria, 4 h/zi
    if (f === undefined) throw new Error("fila lipsește");
    const data = f.getCell("A7").value;
    expect(data instanceof Date ? data.toISOString().slice(0, 10) : data).toBe("2026-12-01");
    expect(f.getCell("B7").value).toBe("marți");
    expect(f.getCell("I7").value).toBe("SL");
    expect(f.getCell("J7").value).toBe("Ziua Națională a României");
    expect(f.getCell("I11").value).toBe("L"); // 5 decembrie
    expect(f.getCell("F7").formula).toBe(
      'IF(AND(ISNUMBER(C7),ISNUMBER(D7)),MAX(0,MOD(D7-C7,1)-N(E7)/1440),"")',
    );
    expect(f.getCell("F7").numFmt).toBe("[h]:mm");
    expect(f.getCell("C7").numFmt).toBe("hh:mm");
    expect(f.getCell("A38").value).toBe("TOTAL");
    expect(f.getCell("F38").formula).toBe("SUM(F7:F37)");
    expect(f.getCell("B40").formula).toBe("COUNT(F7:F37)");
    // 84 h = 3,5 zile Excel. Se citește din XML: la `load`, ExcelJS transformă orice
    // număr cu format de oră (`[h]:mm`) într-un `Date` (1900-01-02T12:00), nu în 3,5.
    expect(await xml("xl/worksheets/sheet2.xml")).toMatch(/<c r="B41"[^>]*><v>3\.5<\/v><\/c>/u);
    expect(f.getCell("B42").formula).toBe("ROUND((F38-B41)*24,2)");
    expect(f.getCell("B43").formula).toBe('COUNTIF(I7:I37,"CO")');
    expect(f.getCell("A48").formula).toContain("F38>B41"); // semnalul de timp parțial
    const foaie = await xml("xl/worksheets/sheet2.xml");
    expect(foaie).toMatch(/type="decimal"/u); // C/D: ora cu două puncte
    expect(foaie).toMatch(/orientation="portrait"/u);
    expect(await xml("xl/workbook.xml")).toMatch(/(&apos;|')Ilie Maria(&apos;|')!\$6:\$6/u);
  });

  it("cine are normă întreagă nu primește rândul de semnal", async () => {
    const { registru } = await deschide(
      await registruPontaj(pontaj({ varianta: "individuala", angajati: "Popa Ion" })),
    );
    const f = registru.worksheets[0];
    expect(String(f?.getCell("A48").formula ?? "")).not.toContain("F38>B41");
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-xlsx.test.ts"`. Rezultatul așteptat: `Failed to resolve import "./foaie-xlsx"`.

- [ ] **Pasul 3: Implementarea minimă**

```ts
// src/app/(marketing)/unelte/foaie-de-pontaj/foaie-xlsx.ts
import ExcelJS from "exceljs";

import { ADRESA_SITE } from "@/content/landing/contact";
import { amendaEvidenta, textAmenda } from "@/content/landing/intrebari-pontaj";
import { cuDe } from "@/content/legal/zile-libere";
import { randAntetFirma } from "@/lib/unelte/antet-firma";
import { CODURI_ABSENTA, LISTA_CODURI, TEXT_LEGENDA } from "@/lib/unelte/coduri-pontaj";
import { adresaDinFisier, SEMNATURA_FISIER } from "@/lib/unelte/document-tabelar";
import {
  numeFilaSigur,
  pregatesteTiparXlsx,
  validareCoduri,
  VALIDARE_DURATA,
  VALIDARE_ORA,
  VALIDARE_PAUZA,
} from "@/lib/unelte/tipar-xlsx";

import { oreFoaie } from "./foaie";
import { documenteleFoii, notaSarbatori, NOTA_COLECTIVA_119, NOTA_FISA_119 } from "./foaie-document";
import {
  angajatiPentruFise,
  etichetaProgram,
  normaLunara,
  oreScurt,
  rezumatNorma,
  type AngajatPontaj,
  type Pontaj,
} from "./pontaj";

/**
 * Foaia de pontaj în Excel, cu FORMULE — nu prin `randeazaXlsx`, care nu știe de
 * formule (vezi `src/lib/unelte/xlsx.ts`).
 *
 * ── CE CALCULEAZĂ ──────────────────────────────────────────────────────────
 * Foaia colectivă: norma fiecăruia (h/zi × zilele lucrătoare), orele lucrate,
 * câte zile de CO, CM, CFS, AN și D are fiecare (`COUNTIF`), totalurile pe zi și
 * colțul care le închide. Fișa individuală: orele lucrate din ora de început, cea
 * de sfârșit și pauză, ca durată (`[h]:mm`, regula ceasului din
 * `src/lib/format/ore.ts`), corect și pentru tura de peste miezul nopții
 * (`MOD(sfârșit − început, 1)`); apoi zilele lucrate, diferența față de normă și
 * absențele pe coduri.
 *
 * Auditul din 8 oct 2026: condica avea 0 formule; easyhours.ro dă gratuit
 * exact asta — `ROUND(MOD(E-C,1)*24-pauză/60)` — dar fără sărbători și fără
 * nume. Aici sunt amândouă.
 */

const SURSA = "/unelte/foaie-de-pontaj";
const UMPLERE_SARBATOARE = "FFF0E6D2";
const UMPLERE_REPAUS = "FFE6E9E6";
const UMPLERE_ALERTA = "FFFDE2E1";
/** Subțire, gri închis: chenarul „hair” de până acum dispărea la tipărire. */
const CHENAR: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF9CA3AF" } },
  left: { style: "thin", color: { argb: "FF9CA3AF" } },
  bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
  right: { style: "thin", color: { argb: "FF9CA3AF" } },
};
const GRI_TEXT = { color: { argb: "FF6B7280" } } as const;

function umple(celula: ExcelJS.Cell, argb: string): void {
  celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function legatura(fila: ExcelJS.Worksheet, adresa: string): void {
  const rand = fila.addRow([{ text: SEMNATURA_FISIER, hyperlink: adresa }]);
  rand.getCell(1).font = { ...GRI_TEXT, underline: true };
}

// ── Foaia colectivă ────────────────────────────────────────────────────────

const RAND_CAP = 5;
const RAND_LITERE = 6;
const PRIMUL_RAND = 7;

function filaColectiva(registru: ExcelJS.Workbook, p: Pontaj, adresaSursa: string): void {
  const fila = registru.addWorksheet(p.eticheta);
  const nZile = p.zile.length;
  const colZi = (i: number) => 3 + i;
  const colNorma = 3 + nZile;
  const colOre = colNorma + 1;
  const colSupl = colNorma + 2;
  const colNoapte = colNorma + 3;
  const colCod = (k: number) => colNorma + 4 + k;
  const ultimaCol = colCod(CODURI_ABSENTA.length - 1);
  const adresa = (rand: number, col: number) => fila.getCell(rand, col).address;

  fila.columns = [
    { width: 24 },
    { width: 6 },
    ...p.zile.map(() => ({ width: 3.8 })),
    { width: 8 },
    { width: 8 },
    { width: 7 },
    { width: 7 },
    ...CODURI_ABSENTA.map(() => ({ width: 5 })),
  ];

  fila.addRow([`Foaie colectivă de prezență — ${p.eticheta}`]).font = { bold: true, size: 13 };
  fila.addRow([randAntetFirma(p.antet) ?? ""]);
  fila.addRow([rezumatNorma(p)]);
  fila.addRow([TEXT_LEGENDA]).font = { ...GRI_TEXT, size: 9 };

  const cap = fila.addRow([
    "Angajat",
    "h/zi",
    ...p.zile.map((z) => z.zi),
    "Normă",
    "Ore lucrate",
    "Ore supl.",
    "Ore noapte",
    ...CODURI_ABSENTA.map((c) => c.cod),
  ]);
  const litere = fila.addRow(["", "", ...p.zile.map((z) => z.litera)]);
  for (const r of [cap, litere]) {
    r.font = { bold: true, size: 9 };
    r.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  cap.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  /** Chenar pe tot rândul; nisipiu pe sărbători, gri pe zilele din afara programului. */
  const coloreaza = (rand: ExcelJS.Row) => {
    for (let c = 1; c <= ultimaCol; c += 1) rand.getCell(c).border = CHENAR;
    p.zile.forEach((z, i) => {
      const celula = rand.getCell(colZi(i));
      if (z.sarbatoare !== null) umple(celula, UMPLERE_SARBATOARE);
      else if (!z.inProgram) umple(celula, UMPLERE_REPAUS);
    });
  };
  coloreaza(cap);
  coloreaza(litere);

  p.angajati.forEach((a, k) => {
    const r = PRIMUL_RAND + k;
    const rand = fila.addRow([
      a.nume,
      a.oreZi,
      ...p.zile.map((z) => (z.codImplicit === "" ? null : z.codImplicit)),
    ]);
    rand.height = 18;
    coloreaza(rand);
    const zile = `${adresa(r, colZi(0))}:${adresa(r, colZi(nZile - 1))}`;
    rand.getCell(colNorma).value = {
      formula: `ROUND(${adresa(r, 2)}*${String(p.zileLucratoare)},2)`,
    };
    rand.getCell(colOre).value = { formula: `SUM(${zile})` };
    rand.getCell(colOre).font = { bold: true };
    CODURI_ABSENTA.forEach((c, j) => {
      rand.getCell(colCod(j)).value = { formula: `COUNTIF(${zile},"${c.cod}")` };
    });
    // Săgeata cu coduri, fără alertă: în aceeași celulă se scriu și ore.
    p.zile.forEach((_, i) => {
      rand.getCell(colZi(i)).dataValidation = validareCoduri(LISTA_CODURI, false);
    });
    rand.getCell(2).dataValidation = {
      type: "decimal",
      operator: "between",
      allowBlank: true,
      formulae: [0.5, 24],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Normă invalidă",
      error: "Scrie orele pe zi ale angajatului, între 0,5 și 24.",
    };
  });

  const ultimul = PRIMUL_RAND + p.angajati.length - 1;
  const rTotal = ultimul + 1;
  const coloana = (c: number) => `${adresa(PRIMUL_RAND, c)}:${adresa(ultimul, c)}`;
  const total = fila.addRow(["TOTAL"]);
  total.font = { bold: true };
  coloreaza(total);
  p.zile.forEach((_, i) => {
    total.getCell(colZi(i)).value = { formula: `SUM(${coloana(colZi(i))})` };
  });
  total.getCell(colNorma).value = { formula: `SUM(${coloana(colNorma)})` };
  /*
   * Colțul — totalul general — e suma rândului de total PE ZILE, nu a coloanei
   * „Ore lucrate”: ambele dau același număr, dar așa o greșeală se vede. Dacă
   * cele două nu se închid, colțul nu se potrivește cu suma coloanei de deasupra.
   */
  total.getCell(colOre).value = {
    formula: `SUM(${adresa(rTotal, colZi(0))}:${adresa(rTotal, colZi(nZile - 1))})`,
  };
  for (const c of [colSupl, colNoapte, ...CODURI_ABSENTA.map((_, j) => colCod(j))]) {
    total.getCell(c).value = { formula: `SUM(${coloana(c)})` };
  }

  // Normă sub 8 h și ore peste norma lunii: semnal, nu verdict (art. 15¹ lit. d)).
  const ore = fila.getColumn(colOre).letter;
  const norma = fila.getColumn(colNorma).letter;
  fila.addConditionalFormatting({
    ref: coloana(colOre),
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: [`AND($B${String(PRIMUL_RAND)}<8,${ore}${String(PRIMUL_RAND)}>${norma}${String(PRIMUL_RAND)})`],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: UMPLERE_ALERTA } },
          font: { bold: true, color: { argb: "FFB42318" } },
        },
      },
    ],
  });

  fila.addRow([]);
  fila.addRow([notaSarbatori(p)]);
  fila.addRow([NOTA_COLECTIVA_119]);
  if (p.notaAngajati !== null) fila.addRow([p.notaAngajati]); // nota lui B4: lista e tăiată
  const partial = amendaEvidenta("e3");
  fila.addRow([
    `Roșu la „Ore lucrate”: un angajat cu mai puțin de 8 h pe zi a trecut de norma lunii. La timp parțial, depășirea programului din contract e muncă nedeclarată: ${textAmenda(partial)} (${partial.temei}).`,
  ]);
  fila.addRow(["Întocmit: ______________", "", "", "", "", "", "", "", "Verificat: ______________"]);
  legatura(fila, adresaSursa);

  fila.views = [{ state: "frozen", xSplit: 2, ySplit: RAND_LITERE }];
  pregatesteTiparXlsx(fila, {
    orientare: "peisaj",
    randuriTitlu: { de: RAND_CAP, pana: RAND_LITERE },
  });
}

// ── Fișa individuală ───────────────────────────────────────────────────────

const RAND_CAP_FISA = 6;
const PRIMUL_RAND_FISA = 7;
const COLOANE_FISA = 10;

function filaFisa(
  registru: ExcelJS.Workbook,
  p: Pontaj,
  a: AngajatPontaj,
  nume: string,
  adresaSursa: string,
  notaAngajati: string | null,
): void {
  const fila = registru.addWorksheet(nume);
  fila.columns = [
    { width: 11 },
    { width: 10 },
    { width: 9 },
    { width: 9 },
    { width: 8 },
    { width: 9 },
    { width: 8 },
    { width: 8 },
    { width: 6 },
    { width: 28 },
  ];
  const norma = normaLunara(p.zileLucratoare, a.oreZi);

  fila.addRow([`Fișă individuală de pontaj — ${p.eticheta}`]).font = { bold: true, size: 13 };
  fila.addRow([randAntetFirma(p.antet) ?? ""]);
  fila.addRow([`Angajat: ${a.nume === "" ? "______________________________" : a.nume}`]);
  fila.addRow([
    `Normă: ${oreScurt(a.oreZi)} h/zi × ${cuDe(p.zileLucratoare, "zile lucrătoare")} = ${oreFoaie(norma)} · program ${etichetaProgram(p.program)}`,
  ]);
  fila.addRow([]);
  const cap = fila.addRow([
    "Data",
    "Ziua",
    "Ora început",
    "Ora sfârșit",
    "Pauză (min)",
    "Ore lucrate",
    "Ore supl.",
    "Ore noapte",
    "Cod",
    "Observații",
  ]);
  cap.font = { bold: true, size: 9 };
  cap.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (let c = 1; c <= COLOANE_FISA; c += 1) cap.getCell(c).border = CHENAR;

  p.zile.forEach((z, i) => {
    const r = PRIMUL_RAND_FISA + i;
    const rand = fila.addRow([
      new Date(Date.UTC(p.an, p.luna - 1, z.zi)),
      z.numeZi,
      null,
      null,
      null,
      null,
      null,
      null,
      z.codImplicit === "" ? null : z.codImplicit,
      z.sarbatoare,
    ]);
    rand.height = 17;
    rand.getCell(1).numFmt = "dd.mm.yyyy";
    for (const c of [3, 4]) {
      rand.getCell(c).numFmt = "hh:mm";
      rand.getCell(c).dataValidation = VALIDARE_ORA;
    }
    rand.getCell(5).dataValidation = VALIDARE_PAUZA;
    // MOD(…, 1): o tură 22:00–06:00 dă 8:00, nu −16:00. MAX(0, …): o pauză mai
    // lungă decât intervalul nu dă o durată negativă (afișată „#####”).
    rand.getCell(6).value = {
      formula: `IF(AND(ISNUMBER(C${String(r)}),ISNUMBER(D${String(r)})),MAX(0,MOD(D${String(r)}-C${String(r)},1)-N(E${String(r)})/1440),"")`,
    };
    for (const c of [6, 7, 8]) rand.getCell(c).numFmt = "[h]:mm";
    for (const c of [7, 8]) rand.getCell(c).dataValidation = VALIDARE_DURATA;
    rand.getCell(9).dataValidation = validareCoduri(LISTA_CODURI, true);
    for (let c = 1; c <= COLOANE_FISA; c += 1) {
      const celula = rand.getCell(c);
      celula.border = CHENAR;
      if (z.sarbatoare !== null) umple(celula, UMPLERE_SARBATOARE);
      else if (!z.inProgram) umple(celula, UMPLERE_REPAUS);
    }
  });

  const ultim = PRIMUL_RAND_FISA + p.zile.length - 1;
  const rTotal = ultim + 1;
  const total = fila.addRow(["TOTAL"]);
  total.font = { bold: true };
  for (const [c, litera] of [
    [6, "F"],
    [7, "G"],
    [8, "H"],
  ] as const) {
    total.getCell(c).value = {
      formula: `SUM(${litera}${String(PRIMUL_RAND_FISA)}:${litera}${String(ultim)})`,
    };
    total.getCell(c).numFmt = "[h]:mm";
  }
  for (let c = 1; c <= COLOANE_FISA; c += 1) total.getCell(c).border = CHENAR;

  fila.addRow([]);
  const rNorma = rTotal + 3;
  fila.addRow(["Zile lucrate", { formula: `COUNT(F${String(PRIMUL_RAND_FISA)}:F${String(ultim)})` }]);
  // Norma ca durată (zile Excel), ca să se scadă direct din totalul `[h]:mm`.
  fila.addRow(["Normă lunară", norma / 24]).getCell(2).numFmt = "[h]:mm";
  // Diferența în ore ZECIMALE: o durată negativă se afișează „#####” în Excel.
  fila.addRow([
    "Diferență față de normă (ore)",
    { formula: `ROUND((F${String(rTotal)}-B${String(rNorma)})*24,2)` },
  ]);
  for (const c of CODURI_ABSENTA) {
    fila.addRow([
      `${c.cod} — ${c.denumire}`,
      { formula: `COUNTIF(I${String(PRIMUL_RAND_FISA)}:I${String(ultim)},"${c.cod}")` },
    ]);
  }
  if (a.oreZi < 8) {
    const semnal = fila.addRow([
      {
        formula: `IF(F${String(rTotal)}>B${String(rNorma)},"Peste norma lunii la timp parțial: verifică art. 15¹ lit. d) din Codul muncii.","")`,
      },
    ]);
    semnal.getCell(1).font = { bold: true, color: { argb: "FFB42318" } };
  }
  fila.addRow([]);
  fila.addRow(["Salariat: ______________", "", "", "Întocmit: ______________", "", "", "Verificat: ______________"]);
  fila.addRow([TEXT_LEGENDA]).font = { ...GRI_TEXT, size: 9 };
  fila.addRow([NOTA_FISA_119]).font = { ...GRI_TEXT, size: 9 };
  if (notaAngajati !== null) fila.addRow([notaAngajati]);
  legatura(fila, adresaSursa);

  fila.views = [{ state: "frozen", ySplit: RAND_CAP_FISA }];
  pregatesteTiparXlsx(fila, {
    orientare: "portret",
    randuriTitlu: { de: RAND_CAP_FISA, pana: RAND_CAP_FISA },
  });
}

export async function registruPontaj(p: Pontaj): Promise<Uint8Array> {
  const [document] = documenteleFoii(p);
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  registru.title = document.titlu;
  const adresaSursa = adresaDinFisier({ ...document, sursa: SURSA }, "xlsx", ADRESA_SITE);
  if (p.varianta === "colectiva") {
    filaColectiva(registru, p, adresaSursa);
  } else {
    const folosite = new Set<string>();
    angajatiPentruFise(p).forEach((a, i) => {
      const nume = numeFilaSigur(a.nume === "" ? `Fișă ${String(i + 1)}` : a.nume, folosite);
      filaFisa(registru, p, a, nume, adresaSursa, i === 0 ? p.notaAngajati : null);
    });
  }
  return new Uint8Array(await registru.xlsx.writeBuffer());
}
```

Verificarea adreselor din test pentru fișă: rândul 38 = TOTAL; 39 gol; 40 „Zile lucrate”; 41 „Normă lunară” (`rNorma = rTotal + 3` = 41 ✓); 42 diferența; 43–47 cele cinci coduri; 48 semnalul (doar la `oreZi < 8`).

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/foaie-de-pontaj/"`. Rezultatul așteptat: `foaie-xlsx.test.ts` are 8 teste trecute, iar restul directorului rămâne verde. Dacă `getCell(...).formula` întoarce `undefined` după `load`, ExcelJS a scris formula ca formulă partajată. Asta nu se întâmplă fiindcă fiecare celulă își primește formula proprie, dar în cazul acela citește cu `(f.getCell(a).value as { formula?: string }).formula`.

- [ ] **Pasul 5: Proba manuală a formulelor.** Niciun test nu evaluează o formulă: ExcelJS nu are motor de calcul. Descarcă fișierul și deschide-l într-un Excel sau LibreOffice real, de pe orice mașină care îl are (pe VM nu există niciunul, conform auditului). În fișa „Ilie Maria”: C8 = `22:00`, D8 = `6:00`, E8 = `30` ⇒ F8 = `7:30`. C9 = `8` ⇒ alerta „Scrie ora cu două puncte”. În foaia colectivă: B8 = `4`, iar 26 de celule de zi cu `4` ⇒ AI8 = 104, mai mare decât AH8 = 84, deci AI8 iese roșu. Pune rezultatul în mesajul de commit („probat în LibreOffice x.y”) sau scrie explicit „neprobat într-un program de calcul”.

- [ ] **Pasul 6: Lanțul complet**, plus `prettier --check` pe cele două fișiere.

- [ ] **Commit** — căi: `"src/app/(marketing)/unelte/foaie-de-pontaj/foaie-xlsx.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-xlsx.test.ts"`. Mesaj: `feat(unelte): foaia de pontaj în Excel cu formule — normă, ore, COUNTIF pe coduri, validări, fișe pe file`.

---

### Task E10: Ruta foii de pontaj servește variantele, programul și antetul

**Fișiere:**
- Modify: `src/app/api/unelte/foaie-de-pontaj/route.ts` (rescris întreg; cel vechi, de 194 de linii, a fost citit tot)
- Modify: `src/app/api/unelte/foaie-de-pontaj/route.test.ts`, creat de B4 și extins de B7 și B8. Se ADAUGĂ un bloc; testele lui B rămân neschimbate și trebuie să treacă: nota de listă tăiată în Excel și în Word, „21 de zile lucrătoare × 7:18 h = 153:18 h normă”, `format=DOCX`.
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts` (se scot `foaieCaDocument`, `textNorma` și `type Foaie` din import)
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.test.ts` (se scoate `describe("foaia de pontaj ca document", …)`; `describe("numele angajaților", …)` rămâne)

**Interfețe:**
- Consumă: `parametriPontaj`, `construiestePontaj`, `numeFisierPontaj` (E3); citirea formatului fără majuscule a lui B8; `documenteleFoii` (E8); `registruPontaj` (E9); `raspunsBinar`, `raspunsDocumente` (E5); `EroareIntrare`, `type Format` din `@/lib/unelte/document-tabelar`.
- Produce: `GET(cerere: NextRequest): Promise<Response>` (singurul export, plus `dynamic`).

- [ ] **Pasul 0:** Citește ruta și testul ei așa cum le-a lăsat B (B4, B7, B8): `citesteAngajati` și `notaOmisi`, nota adăugată în Excel, `textNorma` în rândul 2, `normalizeazaFormatFoaie` cu `trim().toLowerCase()`. Ruta nouă le acoperă pe toate prin `Pontaj`: nota e `pontaj.notaAngajati`, ajunsă în documente (E8) și în Excel (E9), iar norma e `rezumatNorma`, care începe cu textul lui `textNorma`. Formatul se citește la fel ca la B8.

- [ ] **Pasul 1: Scrie testul care pică**

În capul fișierului (importurile lui B: `JSZip`, `NextRequest`, `describe/expect/it`, `GET`) adaugă:

```ts
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
```

și la sfârșitul fișierului, după ultimul `describe` al lui B, blocul de mai jos. Folosește helper-ul `cere(interogare)` al lui B, deja definit în fișier.

```ts
const octetiDin = async (r: Response) => new Uint8Array(await r.arrayBuffer());

/** Variantele, programul și antetul din E (auditul din 8 oct 2026). */
describe("ruta foii de pontaj: variante, program, antet", () => {
  it("fără format dă tot Excelul colectiv, cu formule", async () => {
    const r = await cere("an=2026&luna=12&angajati=Popa%20Ion");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="pontaj-2026-12.xlsx"');
    const registru = new ExcelJS.Workbook();
    await registru.xlsx.load((await octetiDin(r)).slice().buffer);
    expect(registru.worksheets[0]?.getCell("AI7").formula).toBe("SUM(C7:AG7)");
  });

  it("varianta individuală în PDF: o pagină pe om, sub un singur fișier", async () => {
    const r = await cere(
      "an=2026&luna=12&varianta=individuala&format=pdf&angajati=Popa%20Ion%0AIlie%20Maria%20%7C%204%0ARadu%20Andrei",
    );
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="fise-pontaj-2026-12.pdf"',
    );
    expect((await PDFDocument.load(await octetiDin(r))).getPageCount()).toBe(3);
  });

  it("varianta individuală în Word: o secțiune pe om", async () => {
    const r = await cere(
      "an=2026&luna=12&varianta=individuala&format=docx&angajati=Popa%20Ion%0AIlie%20Maria",
    );
    const zip = await JSZip.loadAsync(await octetiDin(r));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml.match(/<w:sectPr/gu)).toHaveLength(2);
  });

  it("varianta individuală în Excel: o filă pe om", async () => {
    const r = await cere("an=2026&luna=12&varianta=individuala&angajati=Popa%20Ion%0AIlie%20Maria");
    const registru = new ExcelJS.Workbook();
    await registru.xlsx.load((await octetiDin(r)).slice().buffer);
    expect(registru.worksheets.map((f) => f.name)).toEqual(["Popa Ion", "Ilie Maria"]);
  });

  it("Word colectiv are antetul firmei, coloanele de total și sărbătorile marcate", async () => {
    const r = await cere("an=2026&luna=12&format=docx&firma=Construct%20SRL&cui=14399840");
    const zip = await JSZip.loadAsync(await octetiDin(r));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Construct SRL · CUI 14399840");
    expect(xml).toContain(">CFS<");
    expect(xml).toContain(">noapte<");
    expect(xml).toContain(">SL<");
  });

  it("programul pe ture ajunge în fișier", async () => {
    const r = await cere("an=2026&luna=12&program=ture&angajati=Popa%20Ion");
    const registru = new ExcelJS.Workbook();
    await registru.xlsx.load((await octetiDin(r)).slice().buffer);
    expect(registru.worksheets[0]?.getCell("C7").value).toBeNull(); // 1 dec: nimic dinainte
    expect(String(registru.worksheets[0]?.getCell("A3").value)).toContain("toate zilele (ture)");
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `pnpm exec vitest run src/app/api/unelte/foaie-de-pontaj/route.test.ts`. Rezultatul așteptat: testele lui B trec, cele 6 noi pică. Ruta veche nu știe de `varianta`, `program` și `firma`. Pică testele de PDF cu 3 pagini (iese 1), de Word cu 2 secțiuni, de file pe om și de antet. Testul cu `AI7` pică și el, fiindcă vechiul Excel are „Total” în AG.

- [ ] **Pasul 3: Implementarea minimă**

```ts
// src/app/api/unelte/foaie-de-pontaj/route.ts
import type { NextRequest } from "next/server";

import { documenteleFoii } from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie-document";
import { registruPontaj } from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie-xlsx";
import {
  construiestePontaj,
  numeFisierPontaj,
  parametriPontaj,
} from "@/app/(marketing)/unelte/foaie-de-pontaj/pontaj";
import { EroareIntrare, type Format } from "@/lib/unelte/document-tabelar";
import { raspunsBinar, raspunsDocumente } from "@/lib/unelte/raspuns";

/**
 * Descărcarea foii de pontaj gratuite: colectivă sau câte o fișă pe om, în
 * Excel cu formule, PDF sau Word.
 *
 * ── DE CE E RUTĂ DE API, NU SERVER ACTION ─────────────────────────────────
 * Rezultatul e un FIȘIER, iar o Server Action întoarce date, nu un răspuns cu
 * antete proprii. Ca rută, exportul e un `<form>` GET: merge fără JavaScript și
 * se poate pune la favorite, exact ca pagina care îl generează.
 *
 * ── DE CE NU CERE SESIUNE ─────────────────────────────────────────────────
 * E o unealtă publică. `src/proxy.ts` lasă `/api/` să treacă neatins, cu nota
 * că rutele „își verifică singure sesiunea” — asta decide că n-are nevoie de
 * una: nu citește și nu scrie nimic din baza de date. Intrările sunt parametri
 * din adresă, normalizați și mărginiți în `pontaj.ts` și `foaie.ts` (cel mult
 * 60 de oameni, 31 de zile, antet de 120/14/60 de caractere). Fără limitare de
 * rată: nu există nimic de epuizat în afară de CPU, iar generarea e mărginită
 * prin construcție.
 */

export const dynamic = "force-dynamic";

/**
 * `?format=pdf|docx` trece prin randările comune. Excel rămâne implicitul aici,
 * nu PDF-ul ca în restul uneltelor: linkurile vechi, fără `format`, trebuie să
 * dea tot fișierul cu formule pe care îl dădeau.
 */
function normalizeazaFormatFoaie(brut: string | null): Format {
  // Ca la B8: „DOCX” sau „ docx ” înseamnă tot Word.
  const format = brut?.trim().toLowerCase();
  return format === "pdf" || format === "docx" ? format : "xlsx";
}

export async function GET(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  try {
    const pontaj = construiestePontaj(parametriPontaj(q));
    const format = normalizeazaFormatFoaie(q.get("format"));
    const nume = numeFisierPontaj(pontaj);
    if (format === "xlsx") return raspunsBinar(await registruPontaj(pontaj), "xlsx", nume);
    const documente = documenteleFoii(pontaj).map((d) => ({
      ...d,
      sursa: "/unelte/foaie-de-pontaj",
    }));
    return await raspunsDocumente(documente, format, nume);
  } catch (eroare) {
    if (eroare instanceof EroareIntrare) return new Response(eroare.message, { status: 400 });
    throw eroare;
  }
}
```

În `foaie-document.ts`: șterge funcția `foaieCaDocument` (comentariul și corpul, în forma lăsată de B4/B7), iar importul `import { oreFoaie, textNorma, type Foaie } from "./foaie";` devine `import { oreFoaie } from "./foaie";`. Comentariul de antet al fișierului se rescrie:

```ts
/**
 * Foaia de pontaj ca `DocumentTabelar`, pentru PDF, Word și previzualizarea de
 * pe ecran: foaia colectivă sau câte o fișă individuală pe om.
 *
 * Excelul are generatorul lui (`foaie-xlsx.ts`): acolo totalurile sunt FORMULE,
 * iar modelul comun nu știe de formule. PDF-ul și Word-ul se tipăresc și se
 * completează de mână, deci totalurile sunt coloane goale.
 */
```

Pune-l imediat după importuri, înaintea comentariului „LĂȚIMILE, ÎN PUNCTE PDF”. În `foaie-document.test.ts`: șterge `describe("foaia de pontaj ca document", …)` (liniile 6–23 inițiale) și scoate `construiesteFoaie`, `foaieCaDocument` din importuri. `describe("numele angajaților", …)` rămâne, cu importul lui `normalizeazaAngajati` din `./foaie`. Ce apăra testul vechi (umbrirea de 1 și 5 decembrie, „1\nM”, peisaj, `pontaj-2026-12`) e acoperit de „foaia colectivă” din E8.

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run src/app/api/unelte/ "src/app/(marketing)/unelte/"`. Rezultatul așteptat: în `route.test.ts` al foii trec și testele lui B, și cele 6 noi; `[unealta]/route.test.ts` trece; `foaie-document.test.ts` are 1 test vechi și 10 noi, toate trecute; `foaie.test.ts` (B) trece.

- [ ] **Pasul 5: Probă pe serverul local, cu URL-urile reale.** Pornește-l **în fundal** (Bash cu `run_in_background`) și **numai pe 127.0.0.1**, fiindcă `.env.local` arată spre baza de producție:

```bash
cd /srv/apps/ERP && pnpm exec next dev -H 127.0.0.1 -p 3917
```

Așteaptă-l cu Monitor: `until curl -sf -o /dev/null http://127.0.0.1:3917/unelte; do sleep 2; done`. Apoi:

```bash
cd "$S"
B="http://127.0.0.1:3917/api/unelte/foaie-de-pontaj"
curl -sf "$B?an=2026&luna=12&angajati=Popa%20Ion%0AIlie%20Maria%20%7C%204" -o e10.xlsx
curl -sf "$B?an=2026&luna=12&varianta=individuala&format=pdf&angajati=Popa%20Ion%0AIlie%20Maria" -o e10.pdf
unzip -p e10.xlsx xl/workbook.xml | grep -o "_xlnm.Print_Titles[^<]*<[^>]*>[^<]*" | head -2
unzip -p e10.xlsx xl/worksheets/sheet1.xml | grep -o "<f>" | wc -l   # formule: trebuie > 100
"$S/venv-pdf/bin/python" -I -c "import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); print(len(d),'pagini'); d[0].render(scale=1.5).to_pil().save(sys.argv[2])" e10.pdf e10-p1.png
```

Citește `e10-p1.png` cu `Read`. Pe pagină trebuie să fie fișa „Popa Ion”, cu 31 de rânduri de zi, rândul Total, notele și cele trei linii de semnătură, toate pe o singură pagină. Oprește serverul **într-un apel Bash separat**: `pkill -f "next dev -H 127.0.0.1 -p 391[7]"`, apoi `rm -f .next/dev/types/validator.ts .next/dev/types/routes.d.ts`.

- [ ] **Pasul 6: Lanțul complet**, plus `prettier --check` pe cele patru fișiere.

- [ ] **Commit** — căi: `src/app/api/unelte/foaie-de-pontaj/route.ts src/app/api/unelte/foaie-de-pontaj/route.test.ts "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.test.ts"`. Mesaj: `feat(unelte): ruta foii de pontaj servește variantele, programul și antetul`. Pagina încă nu are câmpurile noi; ruta le primește deja din URL. E13 le pune în formular.

---
### Task E11: Condica are toate zilele lunii — sâmbete, ture, zile marcate L și SL; pauză și ore lucrate

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/condica-de-prezenta/model.ts` (rescris întreg; cel vechi, de 85 de linii, a fost citit tot)
- Test: `src/app/(marketing)/unelte/condica-de-prezenta/model.test.ts` (rescris întreg)
- Modify: `src/content/landing/harta.ts` (`actualizat` la `/unelte/condica-de-prezenta`). Pagina afișează rândurile noi fără ca `page.tsx` să se schimbe, deci data se ridică aici.

**Interfețe:**
- Consumă: `normalizeazaAn`, `normalizeazaLuna`, `LUNI`, `notaOmisi` (B4) din `../foaie-de-pontaj/foaie`; `liniiAngajati`, `normalizeazaProgram`, `zileDinLuna`, `etichetaProgram`, `type Program` (E3); `antetFirmaDinParametri`, `randAntetFirma`, `type AntetFirma` (E1); `COD_REPAUS`, `COD_SARBATOARE`, `TEXT_LEGENDA` (E2); `type Coloana`, `type DocumentTabelar`.
- Produce:
  ```ts
  export type ParametriCondica = Readonly<{ an: number; luna: number; angajati: readonly string[];
    program: Program; antet: AntetFirma; notaAngajati: string | null /* B4 */; firma: string /* până la E14 */ }>;
  export function parametriCondica(q: URLSearchParams): ParametriCondica;
  export type RandCondica =
    | Readonly<{ fel: "om"; zi: number; data: string; nume: string }>
    | Readonly<{ fel: "marcaj"; zi: number; data: string; eticheta: string; cod: string }>;
  export function randuriCondica(p: Pick<ParametriCondica, "an" | "luna" | "angajati" | "program">): readonly RandCondica[];
  export const COLOANE_CONDICA: readonly Coloana[];
  export function condicaDocument(p: ParametriCondica): DocumentTabelar;
  export function condicaDinParametri(q: URLSearchParams): DocumentTabelar;          // păstrată (registrul o folosește până la E12)
  export function construiesteCondica(an: number, luna: number, angajati: readonly string[], firma: string, notaAngajati?: string | null): DocumentTabelar; // semnătura lui B4, pentru compatibilitate; scoasă în E14
  ```

- [ ] **Pasul 0:** Citește `model.ts` și `model.test.ts` așa cum le-a lăsat B4: `ParametriCondica.notaAngajati`, `citesteAngajati` + `notaOmisi` în `parametriCondica`, al cincilea parametru `notaAngajati` în `construiesteCondica`, nota pusă ultima în `note`, plus testele „cu peste 60 de nume…” și „fără tăiere, notele rămân cele două de dinainte”. Fișierul nou păstrează toată mecanica lui B4. Al doilea test se înlocuiește, cu motivul spus în bloc: notele condicii sunt acum trei. Intenția lui (nicio notă de listă fără tăiere) rămâne testată.

- [ ] **Pasul 1: Scrie testul care pică**

```ts
// src/app/(marketing)/unelte/condica-de-prezenta/model.test.ts
import { describe, expect, it } from "vitest";

import { pornesteDocument } from "@/lib/pdf/document";
import { latimiColoane } from "@/lib/unelte/pdf";

import { condicaDinParametri, condicaDocument, parametriCondica, randuriCondica } from "./model";

/*
 * Decembrie 2026: 21 de zile lucrătoare; 1 și 25 dec sărbători în timpul
 * săptămânii, 26 dec sărbătoare într-o sâmbătă; sâmbete 5, 12, 19, 26.
 * Auditul din 8 oct 2026 (MAJOR): condica sărea toate sâmbetele, duminicile și
 * sărbătorile, deci comerțul, HoReCa și turele nu puteau trece orele de atunci.
 */
const parametri = (q: Record<string, string>) =>
  parametriCondica(
    new URLSearchParams({ an: "2026", luna: "12", angajati: "Popa Ion\nIlie Maria", ...q }),
  );
const pe = (d: { randuri: readonly (readonly string[])[] }, data: string) =>
  d.randuri.filter((r) => r[0] === data);

describe("condica de prezență", () => {
  it("luni–vineri: rânduri pe om în zilele lucrătoare, câte un rând marcat în rest", () => {
    const d = condicaDocument(parametri({}));
    expect(d.randuri).toHaveLength(21 * 2 + 10);
    expect(d.randuri[0]).toEqual([
      "01.12.2026", "Ziua Națională a României", "", "", "", "", "", "", "SL",
    ]);
    expect(d.randuri[1]?.slice(0, 2)).toEqual(["02.12.2026", "Popa Ion"]);
    expect(pe(d, "05.12.2026")).toEqual([
      ["05.12.2026", "Sâmbătă — zi de repaus", "", "", "", "", "", "", "L"],
    ]);
    expect(pe(d, "25.12.2026")).toHaveLength(1);
  });

  it("luni–sâmbătă: sâmbetele au rânduri pe om, sâmbăta de Crăciun rămâne marcată", () => {
    const d = condicaDocument(parametri({ program: "ls" }));
    expect(d.randuri).toHaveLength(24 * 2 + 7);
    expect(pe(d, "05.12.2026").map((r) => r[1])).toEqual(["Popa Ion", "Ilie Maria"]);
    expect(pe(d, "26.12.2026")).toEqual([
      ["26.12.2026", "A doua zi de Crăciun", "", "", "", "", "", "", "SL"],
    ]);
  });

  it("ture: fiecare zi are rânduri pe om, iar sărbătoarea are și un rând SL deasupra", () => {
    const d = condicaDocument(parametri({ program: "ture" }));
    expect(d.randuri).toHaveLength(31 * 2 + 3);
    expect(pe(d, "25.12.2026").map((r) => [r[1], r[8]])).toEqual([
      ["Crăciunul", "SL"],
      ["Popa Ion", ""],
      ["Ilie Maria", ""],
    ]);
    expect(pe(d, "06.12.2026").map((r) => r[1])).toEqual(["Popa Ion", "Ilie Maria"]);
  });

  it("fără nume dă câte zece rânduri pe zi lucrătoare, plus marcajele", () => {
    const d = condicaDinParametri(new URLSearchParams({ an: "2026", luna: "12" }));
    expect(d.randuri).toHaveLength(21 * 10 + 10);
  });

  it("are pauza, orele lucrate și observațiile, cu rânduri de semnătură de 22 pt", () => {
    const d = condicaDocument(parametri({}));
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Data",
      "Nume și prenume",
      "Ora\nsosirii",
      "Semnătura",
      "Ora\nplecării",
      "Semnătura",
      "Pauză\n(min)",
      "Ore\nlucrate",
      "Observații",
    ]);
    expect(d.inaltimeRand).toBe(22);
    // Nota începe cu majusculă („Art. 119 alin. (1)…”): regex sensibil la majuscule.
    expect(d.note.join(" ")).toMatch(/Art\. 119/u);
    expect(d.note.join(" ")).toMatch(/CFS = /u);
  });

  it("antetul firmei e subtitlul documentului", () => {
    const d = condicaDocument(
      parametri({ firma: "Construct SRL", cui: "14399840", compartiment: "Bucătărie" }),
    );
    expect(d.subtitlu).toBe("Construct SRL · CUI 14399840 · Compartiment: Bucătărie");
    expect(condicaDocument(parametri({})).subtitlu).toBeNull();
  });

  it("norma scrisă după nume (ca la foaia de pontaj) nu ajunge în condică", () => {
    const d = condicaDocument(parametri({ angajati: "Popa Ion | 4" }));
    expect(new Set(d.randuri.map((r) => r[1]))).toContain("Popa Ion");
    expect(d.randuri.some((r) => r[1]?.includes("|"))).toBe(false);
  });

  it("randuriCondica deosebește marcajele de rândurile pe om", () => {
    const [primul, al2lea] = randuriCondica(parametri({}));
    expect(primul).toMatchObject({ fel: "marcaj", zi: 1, cod: "SL" });
    expect(al2lea).toMatchObject({ fel: "om", zi: 2, nume: "Popa Ion" });
  });

  it("cu peste 60 de nume, documentul spune că lista e incompletă (testul lui B4, păstrat)", () => {
    const multi = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");
    const d = condicaDinParametri(new URLSearchParams({ an: "2026", luna: "12", angajati: multi }));
    expect(d.note.at(-1)).toBe(
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.",
    );
  });

  /*
   * B4 verifica aici „notele rămân cele două de dinainte”. Din E11 notele sunt
   * trei — art. 119, programul cu zilele marcate, legenda —, deci se verifică
   * ce voia B4 de fapt: fără tăiere, nicio notă de listă.
   */
  it("fără tăiere, nicio notă de listă tăiată", () => {
    const d = condicaDinParametri(new URLSearchParams({ angajati: "Popa Ion" }));
    expect(d.note).toHaveLength(3);
    expect(d.note.join(" ")).not.toMatch(/nu apar aici/u);
  });

  it("condica e mărginită la intrare enormă", () => {
    const q = new URLSearchParams({
      an: "9999",
      luna: "13",
      angajati: Array.from({ length: 10_000 }, (_, i) => `Om ${String(i)}`).join("\n"),
      firma: "F".repeat(5000),
    });
    const p = parametriCondica(q);
    expect(p.angajati.length).toBeLessThanOrEqual(60);
    expect(p.an).toBeGreaterThanOrEqual(2020);
    expect(p.an).toBeLessThanOrEqual(2035);
    expect(p.luna).toBeGreaterThanOrEqual(1);
    expect(p.luna).toBeLessThanOrEqual(12);
    expect(p.antet.firma.length).toBeLessThanOrEqual(120);
    const d = condicaDinParametri(q);
    expect(new Set(d.randuri.map((r) => r[1])).size).toBeLessThanOrEqual(60 + 31);
  });

  it("nicio etichetă și niciun conținut tipic nu se taie în PDF", async () => {
    const d = condicaDocument(parametri({}));
    const { fonturi } = await pornesteDocument("proba", "proba");
    const latimi = latimiColoane(d);
    const corp: Readonly<Record<number, readonly string[]>> = {
      0: ["31.12.2026"],
      1: ["Țăranu Ioana-Maria", "Sâmbătă — zi de repaus", "Ziua Națională a României"],
      8: ["CFS", "SL"],
    };
    const prea: string[] = [];
    d.coloane.forEach((c, i) => {
      const loc = (latimi[i] ?? 0) - 4;
      for (const linie of c.eticheta.split("\n")) {
        if (fonturi.aldin.widthOfTextAtSize(linie, 8) > loc) prea.push(`antet „${linie}”`);
      }
      for (const t of corp[i] ?? []) {
        if (fonturi.normal.widthOfTextAtSize(t, 8) > loc) prea.push(`coloana ${String(i)}: „${t}”`);
      }
    });
    expect(prea).toEqual([]);
  });
});
```

(Limita din „intrare enormă” devine `60 + 31`, fiindcă rândurile-marcaj au și ele un text în coloana a doua. Ce se verifică rămâne același lucru: cel mult 60 de oameni.)

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/condica-de-prezenta/model.test.ts"`. Rezultatul așteptat: `condicaDocument`/`randuriCondica` nu există. Dacă încarci doar `condicaDinParametri`, pică pe numărul de rânduri (21×10 în loc de 220).

- [ ] **Pasul 3: Implementarea minimă**

```ts
// src/app/(marketing)/unelte/condica-de-prezenta/model.ts
import { antetFirmaDinParametri, randAntetFirma, type AntetFirma } from "@/lib/unelte/antet-firma";
import { COD_REPAUS, COD_SARBATOARE, TEXT_LEGENDA } from "@/lib/unelte/coduri-pontaj";
import type { Coloana, DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { LUNI, normalizeazaAn, normalizeazaLuna, notaOmisi } from "../foaie-de-pontaj/foaie";
import {
  etichetaProgram,
  liniiAngajati,
  normalizeazaProgram,
  zileDinLuna,
  type Program,
} from "../foaie-de-pontaj/pontaj";

/**
 * Condica de prezență: pe fiecare zi, câte un rând pe om, cu ora sosirii, ora
 * plecării, pauza, orele lucrate și observațiile.
 *
 * ── DE CE NU E FOAIA DE PONTAJ CU ALT TITLU ───────────────────────────────
 * Foaia de pontaj are o celulă pe zi, în care se scrie „8” sau „CO”. Art. 119
 * cere însă ora de ÎNCEPERE și ora de SFÂRȘIT, zilnic — exact ce poartă o
 * condică. Zilele vin din `zileDinLuna`, deci sărbătorile (inclusiv Paștele
 * ortodox) sunt aceleași ca pe foaia de pontaj.
 *
 * ── DE CE TOATE ZILELE LUNII ──────────────────────────────────────────────
 * Până la 8 oct 2026 condica păstra doar zilele de luni până vineri fără
 * sărbători (auditul: MAJOR). Art. 119 cere orele prestate ZILNIC, iar art.
 * 141–142 prevăd munca de sărbători. Acum: la programul luni–vineri sau
 * luni–sâmbătă, o zi din afara programului e UN rând marcat L sau SL — condica
 * nu are goluri, dar nici pagini de rânduri pe care nu le semnează nimeni; la
 * „ture”, fiecare zi are rânduri pe om, iar sărbătoarea mai are un rând SL
 * deasupra (contează la spor, art. 142).
 */

export type ParametriCondica = Readonly<{
  an: number;
  luna: number;
  angajati: readonly string[];
  program: Program;
  antet: AntetFirma;
  /** Nota pentru document când lista a trecut de 60 de nume; `null` altfel (B4). */
  notaAngajati: string | null;
  /** Egal cu `antet.firma`. Rămâne doar cât pagina îl citește direct (până la E14). */
  firma: string;
}>;

/** Intrările din adresă, cu aceleași limite ca foaia de pontaj. */
export function parametriCondica(q: URLSearchParams): ParametriCondica {
  const acum = new Date();
  const antet = antetFirmaDinParametri(q);
  // Aceleași linii ca la foaia de pontaj (deci aceleași reguli de nume ale lui B):
  // „Ilie Maria | 4” dă „Ilie Maria”, norma n-are ce căuta într-o condică.
  const linii = liniiAngajati(q.get("angajati") ?? undefined, 8);
  return {
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    angajati: linii.angajati.map((a) => a.nume),
    program: normalizeazaProgram(q.get("program")),
    antet,
    notaAngajati: notaOmisi(linii.lista),
    firma: antet.firma,
  };
}

export type RandCondica =
  | Readonly<{ fel: "om"; zi: number; data: string; nume: string }>
  | Readonly<{ fel: "marcaj"; zi: number; data: string; eticheta: string; cod: string }>;

function majuscula(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Rândurile condicii, în ordine. Le citesc și documentul, și Excelul (`condica-xlsx.ts`). */
export function randuriCondica(
  p: Pick<ParametriCondica, "an" | "luna" | "angajati" | "program">,
): readonly RandCondica[] {
  const randuri: RandCondica[] = [];
  for (const z of zileDinLuna(p.an, p.luna, p.program)) {
    if (!z.inProgram || z.sarbatoare !== null) {
      randuri.push({
        fel: "marcaj",
        zi: z.zi,
        data: z.data,
        eticheta: z.sarbatoare ?? `${majuscula(z.numeZi)} — zi de repaus`,
        cod: z.sarbatoare !== null ? COD_SARBATOARE : COD_REPAUS,
      });
    }
    if (z.inProgram) {
      for (const nume of p.angajati) randuri.push({ fel: "om", zi: z.zi, data: z.data, nume });
    }
  }
  return randuri;
}

/*
 * Lățimile, în puncte PDF, pe A4 portret: suma e exact lățimea utilă (515,28).
 * Alese pe fontul real (DejaVu 8 pt): „01.12.2026” are 45,8 pt, „plecării”
 * aldin 33,5, „Observații” aldin 46,6; `taie` taie la `w − 4`.
 */
export const COLOANE_CONDICA: readonly Coloana[] = [
  { eticheta: "Data", latime: 51 },
  { eticheta: "Nume și prenume", latime: 128.28 },
  { eticheta: "Ora\nsosirii", latime: 33 },
  { eticheta: "Semnătura", latime: 72 },
  { eticheta: "Ora\nplecării", latime: 39 },
  { eticheta: "Semnătura", latime: 72 },
  { eticheta: "Pauză\n(min)", latime: 32 },
  { eticheta: "Ore\nlucrate", latime: 37 },
  { eticheta: "Observații", latime: 51 },
];

export function condicaDocument(p: ParametriCondica): DocumentTabelar {
  const randuri = randuriCondica(p);
  const marcate = randuri.filter((r) => r.fel === "marcaj").length;
  return {
    titlu: `Condica de prezență — ${LUNI[p.luna - 1] ?? ""} ${String(p.an)}`,
    subtitlu: randAntetFirma(p.antet),
    campuri: [],
    paragrafe: [],
    coloane: COLOANE_CONDICA,
    randuri: randuri.map((r) =>
      r.fel === "om"
        ? [r.data, r.nume, "", "", "", "", "", "", ""]
        : [r.data, r.eticheta, "", "", "", "", "", "", r.cod],
    ),
    umbrite: [],
    note: [
      "Art. 119 alin. (1) din Codul muncii cere evidența orelor prestate zilnic de fiecare salariat, cu ora de începere și ora de sfârșit a programului.",
      `Program: ${etichetaProgram(p.program)}. Zile marcate cu L (repaus) sau SL (sărbătoare legală): ${String(marcate)}.`,
      TEXT_LEGENDA,
      // Nota lui B4 la urmă: fișierul circulă fără pagină.
      ...(p.notaAngajati === null ? [] : [p.notaAngajati]),
    ],
    semnaturi: ["Verificat (conducătorul locului de muncă)"],
    orientare: "portret",
    numeFisier: `condica-prezenta-${String(p.an)}-${String(p.luna).padStart(2, "0")}`,
    // Se semnează de mână pe fiecare rând: 16 pt (5,6 mm) era prea puțin.
    inaltimeRand: 22,
  };
}

export function condicaDinParametri(q: URLSearchParams): DocumentTabelar {
  return condicaDocument(parametriCondica(q));
}

/** Semnătura lui B4, pe care o mai cheamă pagina până la E14. */
export function construiesteCondica(
  an: number,
  luna: number,
  angajati: readonly string[],
  firma: string,
  notaAngajati: string | null = null,
): DocumentTabelar {
  return condicaDocument({
    an,
    luna,
    angajati,
    program: "lv",
    antet: { firma, cui: "", compartiment: "" },
    notaAngajati,
    firma,
  });
}
```

În `src/content/landing/harta.ts`, blocul cu `cale: "/unelte/condica-de-prezenta"` (în e906d2c, liniile 342–349): `actualizat: "2026-10-07"` devine `actualizat: "<data de azi, din `date +%F`>"`. Dacă altă sesiune a schimbat deja valoarea, o înlocuiești oricum cu data de azi.

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/condica-de-prezenta/" src/lib/unelte/ src/app/api/unelte/`. Rezultatul așteptat: `model.test.ts` are 12 teste trecute; `avize.test.tsx` și `tipar.test.tsx` (B) trec, fiindcă pagina condicii nu s-a schimbat; `registru.test.ts` trece (condica e încă în registru); `[unealta]/route.test.ts` trece.

- [ ] **Pasul 5: Lanțul complet** (`lastmod.mjs` trebuie să treacă după commit), plus `prettier --write` și apoi `--check` pe cele trei fișiere.

- [ ] **Commit** — căi: `"src/app/(marketing)/unelte/condica-de-prezenta/model.ts" "src/app/(marketing)/unelte/condica-de-prezenta/model.test.ts" src/content/landing/harta.ts`. Mesaj: `fix(unelte): condica are toate zilele lunii — sâmbete, ture, zile marcate L și SL; pauză și ore lucrate`.

---

### Task E12: Condica în Excel, cu ore calculate și total pe angajat; rută proprie

**Fișiere:**
- Create: `src/app/(marketing)/unelte/condica-de-prezenta/condica-xlsx.ts` + `condica-xlsx.test.ts`
- Create: `src/app/api/unelte/condica-de-prezenta/route.ts` + `route.test.ts`
- Modify: `src/lib/unelte/registru.ts` (liniile 1–21), `src/lib/unelte/registru.test.ts` (linia 7)
- Modify: `src/app/api/unelte/[unealta]/route.test.ts` (testul de cache al lui A5, care cerea condica prin ruta comună)

**Interfețe:**
- Consumă: `condicaDocument`, `randuriCondica`, `parametriCondica`, `type ParametriCondica` (E11); `pregatesteTiparXlsx`, `validareCoduri`, `VALIDARE_ORA`, `VALIDARE_PAUZA` (E6); `CODURI_ABSENTA`, `LISTA_CODURI` (E2); `randAntetFirma` (E1); `adresaDinFisier`, `SEMNATURA_FISIER`, `normalizeazaFormat`, `EroareIntrare`; `raspunsBinar`, `raspunsDocument` (E5); `LUNI`; `ADRESA_SITE`.
- Produce: `export async function registruCondica(p: ParametriCondica): Promise<Uint8Array>;` și `GET` pe `/api/unelte/condica-de-prezenta`.

- [ ] **Pasul 0:** B8 a făcut `normalizeazaFormat` (din `document-tabelar.ts`) să citească formatul fără majuscule și spații, iar ruta condicii îl folosește la fel. Ruta rămâne tolerantă, ca la B (D10): un format necunoscut dă PDF, nu 400. Dacă `git log --oneline e906d2c.. -- src/lib/unelte/registru.ts` arată intrări noi în `UNELTE`, puse de alte secțiuni, le păstrezi.

- [ ] **Pasul 1: Scrie testele care pică**

```ts
// src/app/(marketing)/unelte/condica-de-prezenta/condica-xlsx.test.ts
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { registruCondica } from "./condica-xlsx";
import { parametriCondica } from "./model";

const parametri = (q: Record<string, string>) =>
  parametriCondica(
    new URLSearchParams({ an: "2026", luna: "12", angajati: "Popa Ion\nIlie Maria", ...q }),
  );

async function deschide(octeti: Uint8Array) {
  const registru = new ExcelJS.Workbook();
  // `ArrayBuffer`, nu `Buffer.from(...)`: vezi `foaie-xlsx.test.ts` (TS2345).
  await registru.xlsx.load(octeti.slice().buffer);
  const zip = await JSZip.loadAsync(octeti);
  const xml = async (cale: string) => (await zip.file(cale)?.async("string")) ?? "";
  return { registru, xml };
}

/** Auditul din 8 oct 2026: condica în Excel avea 0 formule, date ca text și nicio repetare a capului la tipar. */
describe("Excelul condicii", () => {
  it("are date reale, rânduri-marcaj și ora calculată din sosire, plecare și pauză", async () => {
    const { registru } = await deschide(await registruCondica(parametri({})));
    expect(registru.worksheets.map((f) => f.name)).toEqual(["Condica", "Total pe angajat"]);
    const f = registru.worksheets[0];
    if (f === undefined) throw new Error("fila lipsește");
    const data = f.getCell("A6").value;
    expect(data instanceof Date ? data.toISOString().slice(0, 10) : data).toBe("2026-12-01");
    expect(f.getCell("B6").value).toBe("Ziua Națională a României");
    expect(f.getCell("I6").value).toBe("SL");
    expect(f.getCell("H6").formula).toBeUndefined(); // pe un marcaj nu se calculează nimic
    expect(f.getCell("B7").value).toBe("Popa Ion");
    expect(f.getCell("H7").formula).toBe(
      'IF(AND(ISNUMBER(C7),ISNUMBER(E7)),MAX(0,MOD(E7-C7,1)-N(G7)/1440),"")',
    );
    expect(f.getCell("H7").numFmt).toBe("[h]:mm");
    expect(f.getCell("C7").numFmt).toBe("hh:mm");
    expect(f.getCell("B57").value).toBe("Ilie Maria"); // 5 + 21×2 + 10 = rândul 57
  });

  it("a doua filă adună pe om orele și zilele pe coduri", async () => {
    const { registru } = await deschide(await registruCondica(parametri({})));
    const t = registru.getWorksheet("Total pe angajat");
    if (t === undefined) throw new Error("fila lipsește");
    expect(t.getCell("A3").value).toBe("Popa Ion");
    expect(t.getCell("A4").value).toBe("Ilie Maria");
    expect(t.getCell("B3").formula).toBe(
      'COUNTIFS(Condica!$B$6:$B$57,A3,Condica!$H$6:$H$57,">0")',
    );
    expect(t.getCell("C3").formula).toBe("SUMIF(Condica!$B$6:$B$57,A3,Condica!$H$6:$H$57)");
    expect(t.getCell("D3").formula).toBe(
      'COUNTIFS(Condica!$B$6:$B$57,A3,Condica!$I$6:$I$57,"CO")',
    );
    expect(t.getCell("H4").formula).toBe(
      'COUNTIFS(Condica!$B$6:$B$57,A4,Condica!$I$6:$I$57,"D")',
    );
  });

  it("fără nume nu există fila de total, care n-ar avea pe cine aduna", async () => {
    const { registru } = await deschide(
      await registruCondica(parametri({ angajati: "" })),
    );
    expect(registru.worksheets.map((f) => f.name)).toEqual(["Condica"]);
  });

  it("se tipărește pe A4 portret, cu capul repetat, și validează orele", async () => {
    const { xml } = await deschide(await registruCondica(parametri({})));
    // ExcelJS scapă apostroful: `&apos;Condica&apos;!$5:$5` (verificat pe 4.4.0).
    expect(await xml("xl/workbook.xml")).toMatch(/(&apos;|')Condica(&apos;|')!\$5:\$5/u);
    const foaie = await xml("xl/worksheets/sheet1.xml");
    expect(foaie).toMatch(/paperSize="9"/u);
    expect(foaie).toMatch(/orientation="portrait"/u);
    expect(foaie).toMatch(/type="decimal"/u);
    expect(foaie).toMatch(/<formula1>(&quot;|")CO,CM,CFS,AN,D,L,SL(&quot;|")<\/formula1>/u);
  });

  it("la ture, prima zi are marcajul SL și apoi rândurile oamenilor", async () => {
    const { registru } = await deschide(await registruCondica(parametri({ program: "ture" })));
    const f = registru.worksheets[0];
    const data = f?.getCell("A7").value;
    expect(data instanceof Date ? data.toISOString().slice(0, 10) : data).toBe("2026-12-01");
    expect(f?.getCell("B7").value).toBe("Popa Ion");
  });
});
```

```ts
// src/app/api/unelte/condica-de-prezenta/route.test.ts
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { constructorPentru } from "@/lib/unelte/registru";

import { GET } from "./route";

const cere = (q: string) =>
  GET(new NextRequest(`http://localhost/api/unelte/condica-de-prezenta?${q}`));

describe("ruta condicii", () => {
  it("Excelul vine din generatorul cu formule, cu numele pe lună", async () => {
    const r = await cere("an=2026&luna=12&format=xlsx&angajati=Popa%20Ion");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="condica-prezenta-2026-12.xlsx"',
    );
    const registru = new ExcelJS.Workbook();
    await registru.xlsx.load(await r.arrayBuffer());
    expect(registru.worksheets[0]?.name).toBe("Condica");
  });

  // Cu un nume, nu cu lista goală: zece rânduri goale × 21 de zile înseamnă 220 de
  // rânduri, iar PDF + Word pe ele au trecut de 5 s (măsurat: 1,8 s + 1,4 s singure).
  it("fără format dă PDF, ca înainte; „DOCX” e tot Word (B8); cache privat (A5)", async () => {
    const r = await cere("an=2026&luna=12&angajati=Popa%20Ion");
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const w = await cere("an=2026&luna=12&format=DOCX&angajati=Popa%20Ion");
    expect(w.headers.get("content-type")).toContain("wordprocessingml");
  });

  it("Word are coloanele noi", async () => {
    const r = await cere("an=2026&luna=12&format=docx&program=ls&angajati=Popa%20Ion");
    const zip = await JSZip.loadAsync(new Uint8Array(await r.arrayBuffer()));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain(">Observații<");
    expect(xml).toContain(">lucrate<");
  });

  it("condica nu mai trece prin ruta comună", () => {
    expect(constructorPentru("condica-de-prezenta")).toBeUndefined();
  });
});
```

În `src/lib/unelte/registru.test.ts`, linia veche

```ts
    expect(constructorPentru("condica-de-prezenta")).toBeTypeOf("function");
```

devine

```ts
    expect(constructorPentru("foaie-de-parcurs")).toBeTypeOf("function");
```

În `src/app/api/unelte/[unealta]/route.test.ts`, testul pus de A5 cere condica PRIN ruta comună; după ce condica iese din `UNELTE` ar primi 404 (verificat pe o copie a repo-ului cu A5 + E12: `expected 404 to be 200`). Antetul de cache al condicii îl verifică acum `condica-de-prezenta/route.test.ts` de mai sus, deci testul lui A5 trece pe o unealtă care rămâne în registru. Blocul vechi:

```ts
    const r = await cere(
      "/api/unelte/condica-de-prezenta?luna=10&an=2026&firma=Firma+Test&format=pdf",
      "condica-de-prezenta",
    );
```

devine:

```ts
    // Condica are rută statică din E12; ruta comună se verifică pe o unealtă din `UNELTE`.
    const r = await cere("/api/unelte/fisa-evaluare?format=pdf", "fisa-evaluare");
```

- [ ] **Pasul 2: Rulează testele și vezi-le picând**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/condica-de-prezenta/condica-xlsx.test.ts" src/app/api/unelte/condica-de-prezenta/route.test.ts`. Rezultatul așteptat: `Failed to resolve import "./condica-xlsx"` și `"./route"`.

- [ ] **Pasul 3: Implementarea minimă**

```ts
// src/app/(marketing)/unelte/condica-de-prezenta/condica-xlsx.ts
import ExcelJS from "exceljs";

import { ADRESA_SITE } from "@/content/landing/contact";
import { randAntetFirma } from "@/lib/unelte/antet-firma";
import { CODURI_ABSENTA, LISTA_CODURI } from "@/lib/unelte/coduri-pontaj";
import { adresaDinFisier, SEMNATURA_FISIER } from "@/lib/unelte/document-tabelar";
import {
  pregatesteTiparXlsx,
  validareCoduri,
  VALIDARE_ORA,
  VALIDARE_PAUZA,
} from "@/lib/unelte/tipar-xlsx";

import { LUNI } from "../foaie-de-pontaj/foaie";
import { condicaDocument, randuriCondica, type ParametriCondica } from "./model";

/**
 * Condica în Excel, cu orele calculate.
 *
 * Auditul din 8 oct 2026: 0 formule, date ca text, fără rânduri de titlu
 * repetate. Acum: data e dată, ora sosirii și a plecării sunt ore (validate:
 * „8” fără două puncte e oprit), orele lucrate = plecare − sosire − pauză,
 * corect și peste miezul nopții, iar a doua filă adună pe om orele și zilele pe
 * coduri — exact ce trebuia recopiat de mână pentru salarii.
 */

const FILA = "Condica";
const RAND_CAP = 5;
const PRIMUL = 6;
const COLOANE = 9;
const CHENAR: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF9CA3AF" } },
  left: { style: "thin", color: { argb: "FF9CA3AF" } },
  bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
  right: { style: "thin", color: { argb: "FF9CA3AF" } },
};

export async function registruCondica(p: ParametriCondica): Promise<Uint8Array> {
  const d = condicaDocument(p);
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  registru.title = d.titlu;
  const fila = registru.addWorksheet(FILA);
  fila.columns = [
    { width: 12 },
    { width: 30 },
    { width: 9 },
    { width: 16 },
    { width: 9 },
    { width: 16 },
    { width: 8 },
    { width: 9 },
    { width: 14 },
  ];

  fila.addRow([d.titlu]).font = { bold: true, size: 13 };
  fila.addRow([randAntetFirma(p.antet) ?? ""]);
  fila.addRow([
    "Orele se scriu cu două puncte (8:00). Ore lucrate = plecarea − sosirea − pauza; tura de peste miezul nopții se socotește corect.",
  ]).font = { size: 9, color: { argb: "FF6B7280" } };
  fila.addRow([]);
  const cap = fila.addRow(d.coloane.map((c) => c.eticheta.replace("\n", " ")));
  cap.font = { bold: true, size: 9 };
  cap.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (let c = 1; c <= COLOANE; c += 1) cap.getCell(c).border = CHENAR;

  const randuri = randuriCondica(p);
  randuri.forEach((r, i) => {
    const n = PRIMUL + i;
    const data = new Date(Date.UTC(p.an, p.luna - 1, r.zi));
    if (r.fel === "marcaj") {
      const rand = fila.addRow([data, r.eticheta, null, null, null, null, null, null, r.cod]);
      rand.font = { italic: true, color: { argb: "FF6B7280" } };
      for (let c = 1; c <= COLOANE; c += 1) {
        rand.getCell(c).border = CHENAR;
        rand.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E9E6" } };
      }
      rand.getCell(1).numFmt = "dd.mm.yyyy";
      return;
    }
    const rand = fila.addRow([data, r.nume]);
    rand.height = 22;
    rand.getCell(1).numFmt = "dd.mm.yyyy";
    for (const c of [3, 5]) {
      rand.getCell(c).numFmt = "hh:mm";
      rand.getCell(c).dataValidation = VALIDARE_ORA;
    }
    rand.getCell(7).dataValidation = VALIDARE_PAUZA;
    rand.getCell(8).value = {
      formula: `IF(AND(ISNUMBER(C${String(n)}),ISNUMBER(E${String(n)})),MAX(0,MOD(E${String(n)}-C${String(n)},1)-N(G${String(n)})/1440),"")`,
    };
    rand.getCell(8).numFmt = "[h]:mm";
    // Observațiile primesc și text liber („delegație Cluj”): lista fără alertă.
    rand.getCell(9).dataValidation = validareCoduri(LISTA_CODURI, false);
    for (let c = 1; c <= COLOANE; c += 1) rand.getCell(c).border = CHENAR;
  });
  const ultim = PRIMUL + randuri.length - 1;

  fila.addRow([]);
  for (const nota of d.note) fila.addRow([nota]).font = { size: 9, color: { argb: "FF6B7280" } };
  fila.addRow(["Verificat (conducătorul locului de muncă): ______________"]);
  const legatura = fila.addRow([
    {
      text: SEMNATURA_FISIER,
      hyperlink: adresaDinFisier({ ...d, sursa: "/unelte/condica-de-prezenta" }, "xlsx", ADRESA_SITE),
    },
  ]);
  legatura.getCell(1).font = { color: { argb: "FF6B7280" }, underline: true };

  fila.views = [{ state: "frozen", ySplit: RAND_CAP }];
  pregatesteTiparXlsx(fila, { orientare: "portret", randuriTitlu: { de: RAND_CAP, pana: RAND_CAP } });

  const oameni = [...new Set(p.angajati.filter((a) => a !== ""))];
  if (oameni.length > 0) filaTotal(registru, p, oameni, ultim);

  return new Uint8Array(await registru.xlsx.writeBuffer());
}

/** Pe om: zilele cu ore, orele lucrate și zilele pe fiecare cod de absență. */
function filaTotal(
  registru: ExcelJS.Workbook,
  p: ParametriCondica,
  oameni: readonly string[],
  ultim: number,
): void {
  const fila = registru.addWorksheet("Total pe angajat");
  fila.columns = [{ width: 30 }, { width: 11 }, { width: 11 }, ...CODURI_ABSENTA.map(() => ({ width: 6 }))];
  fila.addRow([`Total pe angajat — ${LUNI[p.luna - 1] ?? ""} ${String(p.an)}`]).font = {
    bold: true,
    size: 13,
  };
  fila.addRow(["Angajat", "Zile cu ore", "Ore lucrate", ...CODURI_ABSENTA.map((c) => c.cod)]).font = {
    bold: true,
  };
  const coloana = (litera: string) =>
    `${FILA}!$${litera}$${String(PRIMUL)}:$${litera}$${String(ultim)}`;
  const [nume, ore, observatii] = [coloana("B"), coloana("H"), coloana("I")];
  oameni.forEach((om, k) => {
    const r = 3 + k;
    const rand = fila.addRow([
      om,
      { formula: `COUNTIFS(${nume},A${String(r)},${ore},">0")` },
      { formula: `SUMIF(${nume},A${String(r)},${ore})` },
      ...CODURI_ABSENTA.map((c) => ({
        formula: `COUNTIFS(${nume},A${String(r)},${observatii},"${c.cod}")`,
      })),
    ]);
    rand.getCell(3).numFmt = "[h]:mm";
  });
  pregatesteTiparXlsx(fila, { orientare: "portret", randuriTitlu: { de: 2, pana: 2 } });
}
```

```ts
// src/app/api/unelte/condica-de-prezenta/route.ts
import type { NextRequest } from "next/server";

import { registruCondica } from "@/app/(marketing)/unelte/condica-de-prezenta/condica-xlsx";
import {
  condicaDocument,
  parametriCondica,
} from "@/app/(marketing)/unelte/condica-de-prezenta/model";
import { EroareIntrare, normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { raspunsBinar, raspunsDocument } from "@/lib/unelte/raspuns";

/**
 * Descărcarea condicii: `/api/unelte/condica-de-prezenta?format=pdf|docx|xlsx&…`.
 *
 * Rută statică, ca a foii de pontaj, și din același motiv: Excelul are
 * generatorul lui, cu formule (`condica-xlsx.ts`), pe care ruta comună
 * `[unealta]` nu-l știe. O rută statică are prioritate față de segmentul
 * dinamic, deci condica a ieșit din `UNELTE`. PDF-ul și Word-ul trec prin
 * randările comune. Fără sesiune și fără bază, ca toate uneltele publice.
 */
export const dynamic = "force-dynamic";

export async function GET(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  try {
    const p = parametriCondica(q);
    const format = normalizeazaFormat(q.get("format"));
    const d = { ...condicaDocument(p), sursa: "/unelte/condica-de-prezenta" };
    if (format === "xlsx") return raspunsBinar(await registruCondica(p), "xlsx", d.numeFisier);
    return await raspunsDocument(d, format);
  } catch (eroare) {
    if (eroare instanceof EroareIntrare) return new Response(eroare.message, { status: 400 });
    throw eroare;
  }
}
```

În `src/lib/unelte/registru.ts`, blocul vechi:

```ts
import { cerereDinParametri } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-document";
import { condicaDinParametri } from "@/app/(marketing)/unelte/condica-de-prezenta/model";
import { foaieParcursDinParametri } from "@/app/(marketing)/unelte/foaie-de-parcurs/model";
```

devine:

```ts
import { cerereDinParametri } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-document";
import { foaieParcursDinParametri } from "@/app/(marketing)/unelte/foaie-de-parcurs/model";
```

iar blocul vechi:

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

devine:

```ts
/**
 * Uneltele servite de `/api/unelte/[unealta]`. Foaia de pontaj și condica NU
 * sunt aici: au rute statice, cu Excel pe formule, iar ruta statică are
 * prioritate față de segmentul dinamic.
 */
export const UNELTE: Readonly<Record<string, Constructor>> = {
  "fisa-evaluare": fisaEvaluareDinParametri,
  "fisa-instruire-ssm": fisaSsmDinParametri,
  "foaie-de-parcurs": foaieParcursDinParametri,
  "cerere-concediu": cerereDinParametri,
};
```

Dacă altă secțiune a adăugat între timp intrări în `UNELTE`, păstrează-le și scoate doar linia condicii.

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/condica-de-prezenta/" src/app/api/unelte/ src/lib/unelte/`. Rezultatul așteptat: `condica-xlsx.test.ts` are 5 teste trecute, `condica-de-prezenta/route.test.ts` 4, `registru.test.ts` 2, `[unealta]/route.test.ts` întreg (inclusiv testul de cache al lui A5, mutat pe `fisa-evaluare`), iar restul rămâne verde.

- [ ] **Pasul 5: Probă pe serverul local.** Pornește serverul ca la E10 Pasul 5, apoi:

```bash
cd "$S"
curl -sf "http://127.0.0.1:3917/api/unelte/condica-de-prezenta?an=2026&luna=4&format=xlsx&angajati=Popa%20Ion%0AIlie%20Maria&program=ls" -o e12.xlsx
unzip -p e12.xlsx xl/worksheets/sheet1.xml | grep -o "<f>" | wc -l   # 2 oameni × 24 de zile (L–S, fără 10 și 13 aprilie) = 48
curl -sf "http://127.0.0.1:3917/api/unelte/condica-de-prezenta?an=2026&luna=4&format=pdf&firma=Construct%20SRL&angajati=Popa%20Ion%0AIlie%20Maria" -o e12.pdf
"$S/venv-pdf/bin/python" -I -c "import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); print(len(d),'pagini'); [d[i].render(scale=1.5).to_pil().save(f'{sys.argv[2]}-{i+1}.png') for i in range(min(2,len(d)))]" e12.pdf e12
```

Aprilie 2026 la program luni–sâmbătă: 26 de zile de luni până sâmbătă, minus Vinerea Mare (10) și a doua zi de Paște (13), dau 24 de zile în program. Numărătoarea trebuie să dea **48**, adică o formulă pe fiecare rând pe om. Citește `e12-1.png` și `e12-2.png` și verifică: rândurile înalte, chenarul vizibil, „04.04.2026 — Sâmbătă — zi de repaus” cu L la programul implicit (PDF-ul e cerut fără `program`), „10.04.2026 Vinerea Mare … SL”, pe pagina 2 antetul „Condica de prezență — aprilie 2026 · Construct SRL” și „Pagina 2 din N”. Oprește serverul într-un apel separat (`pkill -f "next dev -H 127.0.0.1 -p 391[7]"`) și rulează `rm -f .next/dev/types/validator.ts .next/dev/types/routes.d.ts`.

- [ ] **Pasul 6: Lanțul complet**, plus `prettier --write`/`--check` pe cele șapte fișiere.

- [ ] **Commit** — căi: `"src/app/(marketing)/unelte/condica-de-prezenta/condica-xlsx.ts" "src/app/(marketing)/unelte/condica-de-prezenta/condica-xlsx.test.ts" src/app/api/unelte/condica-de-prezenta/route.ts src/app/api/unelte/condica-de-prezenta/route.test.ts src/lib/unelte/registru.ts src/lib/unelte/registru.test.ts "src/app/api/unelte/[unealta]/route.test.ts"`. Mesaj: `feat(unelte): condica în Excel cu ore calculate și total pe angajat; rută proprie`.

---
### Task E13: Pagina foii de pontaj — variante, program, normă pe angajat, antet, ITM, întrebări

**Fișiere:**
- Create: `src/app/(marketing)/unelte/foaie-de-pontaj/tabel-colectiv.tsx` + `tabel-colectiv.test.tsx`
- Create: `src/app/(marketing)/unelte/foaie-de-pontaj/pagina.test.ts`
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx` (rescris întreg; cel vechi, de 373 de linii, a fost citit tot)
- Modify: `src/content/landing/unelte.ts` (`ANTET_FOAIE_PONTAJ.lead`, linia 14)
- Modify: `src/app/(marketing)/unelte/page.tsx` (`nota` de la `/unelte/foaie-de-pontaj`, linia 46)
- Modify: `src/app/llms.txt/route.ts` (descrierea de la `/unelte/foaie-de-pontaj`, liniile 126–129)
- Modify: `src/content/landing/harta.ts` (`actualizat` la `/unelte/foaie-de-pontaj` și la `/unelte`)

**Interfețe:**
- Consumă: tot ce produc E1–E10; din E7: `CeCereItm`, `IntrebariUnealta`, `ACOPERIRE_FOAIE`, `INTREBARI_FOAIE_PONTAJ`; din B: `AvizCorectari` (`../../_componente/aviz-corectari`, B4), `avizAngajati` (B4) și `avizeParametri` (B8) din `./foaie`, prop-ul `data-tipar` al lui `Banda` (B5), contractul `data-tipar-pagina="peisaj"` (B6); componentele existente `AntetSecundar`, `Banda`, `Cadru`, `Descarcari`, `JsonLd`, `metadatePagina`, `nodUnealta`, `PeAcelasiSubiect`, `PrevizualizareDocument` (toate din `../../_componente/`, citite); `calendarulAnului`, `cuDe`; `LEGATURI_CONEXE`; `RO`; `ANTET_FOAIE_PONTAJ`.
- Produce: `export function TabelColectiv(p: Readonly<{ pontaj: Pontaj; document: DocumentTabelar }>): JSX.Element;` și pagina.

- [ ] **Pasul 0:** Citește pagina așa cum au lăsat-o B4, B6, B7 și B8. Fișierul nou păstrează tot ce au adus ei:
  - `AvizCorectari` cu `avizeParametri(…)` și `avizAngajati(lista)`, aici în aceeași listă cu avizele lui E (norma necitită, CUI-ul). Pe pagină rămâne UN SINGUR `role="status"`, fiindcă `avize.test.tsx` îl caută cu `getByRole("status")`.
  - `<Banda inaltime="scurta" data-tipar="ascunde">` pe banda formularului (B6).
  - `data-tipar-pagina="peisaj"` pe figura foii colective (B6).
  - norma scrisă cu `oreFoaie`, prin `rezumatNorma` (B7).

  Dacă B a pus și altceva (de exemplu, un comentariu de tipar), îl muți în fișierul nou. `textarea` primește `maxLength` aici (B îl lăsase în afara secțiunii lui, D-„În afara secțiunii”).

- [ ] **Pasul 1: Scrie testele care pică**

```tsx
// src/app/(marketing)/unelte/foaie-de-pontaj/tabel-colectiv.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { documenteleFoii } from "./foaie-document";
import { construiestePontaj, parametriPontaj } from "./pontaj";
import { TabelColectiv } from "./tabel-colectiv";

/**
 * Auditul din 8 oct 2026: pe web, coloanele de zi aveau lățimi inegale — 1–9
 * cam 22 px, 10–31 cam 35 px — iar PDF-ul le avea egale. Tabelul de pe ecran
 * vine acum din ACELAȘI `DocumentTabelar` ca PDF-ul, cu `table-fixed`.
 */
describe("tabelul foii colective pe ecran", () => {
  const pontaj = construiestePontaj(
    parametriPontaj(
      new URLSearchParams({ an: "2026", luna: "12", angajati: "Popa Ion\nIlie Maria | 4" }),
    ),
  );
  const [document] = documenteleFoii(pontaj);

  it("are coloanele de zi fixe și egale", () => {
    const { container } = render(<TabelColectiv pontaj={pontaj} document={document} />);
    expect(container.querySelector("table")?.className).toContain("table-fixed");
    const latimi = [...container.querySelectorAll("col")].map((c) => c.getAttribute("style"));
    expect(latimi).toHaveLength(document.coloane.length);
    expect(new Set(latimi.slice(2, 2 + 31)).size).toBe(1);
  });

  it("marchează sărbătoarea în cap și arată aceleași celule ca PDF-ul", () => {
    const { container } = render(<TabelColectiv pontaj={pontaj} document={document} />);
    expect(container.querySelector('th[data-zi="1"]')?.getAttribute("title")).toBe(
      "Ziua Națională a României",
    );
    expect(container.querySelectorAll("th[data-zi]")).toHaveLength(31);
    const randuri = container.querySelectorAll("tbody tr");
    expect(randuri).toHaveLength(2);
    const celule = (i: number) =>
      [...(randuri[i]?.querySelectorAll("td") ?? [])].map((c) => c.textContent);
    expect(randuri[1]?.querySelector("th")?.textContent).toBe("Ilie Maria");
    expect(celule(1).slice(0, 2)).toEqual(["4", "SL"]); // h/zi, 1 decembrie
    expect(celule(0)[5]).toBe("L"); // 5 decembrie
  });
});
```

```ts
// src/app/(marketing)/unelte/foaie-de-pontaj/pagina.test.ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Paginile n-au teste unitare (CLAUDE.md, „Datorie cunoscută”); proiectul le
 * apără citind sursa, ca `descarcari.test.tsx`. Aici: formularul trimite toți
 * parametrii pe care îi citește ruta, iar pagina are benzile noi.
 */
const SURSA = readFileSync("src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx", "utf8");

describe("pagina foii de pontaj", () => {
  it("formularul trimite fiecare parametru pe care îl citește ruta", () => {
    for (const camp of [
      "an",
      "luna",
      "ore",
      "program",
      "varianta",
      "firma",
      "cui",
      "compartiment",
      "angajati",
    ]) {
      expect(SURSA, camp).toContain(`name="${camp}"`);
    }
  });

  it("are tabelul fix, banda ITM și întrebările, fără promisiunea falsă despre adunare", () => {
    expect(SURSA).toContain("<TabelColectiv");
    expect(SURSA).toContain("<CeCereItm");
    expect(SURSA).toContain("<IntrebariUnealta");
    // Auditul: pagina spunea că foaia „nu adună singură orele”, iar Excelul adună.
    expect(SURSA).not.toMatch(/nu adună singură orele/u);
  });
});
```

- [ ] **Pasul 2: Rulează testele și vezi-le picând**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/foaie-de-pontaj/tabel-colectiv.test.tsx" "src/app/(marketing)/unelte/foaie-de-pontaj/pagina.test.ts"`. Rezultatul așteptat: `Failed to resolve import "./tabel-colectiv"`. `pagina.test.ts` pică pe `name="program"`, `<TabelColectiv` și „nu adună singură orele”.

- [ ] **Pasul 3: Implementarea minimă**

```tsx
// src/app/(marketing)/unelte/foaie-de-pontaj/tabel-colectiv.tsx
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import type { Pontaj } from "./pontaj";

/** Puncte PDF → pixeli: coloana de zi de 15,2 pt iese de 24 px, la fel ca în PDF, proporțional. */
const PX_PE_PUNCT = 1.6;
/** Indicele primei coloane de zi în `document.coloane` (după „Angajat” și „h/zi”). */
const PRIMA_ZI = 2;

/**
 * Foaia colectivă pe ecran, din ACELAȘI `DocumentTabelar` ca PDF-ul și Word-ul
 * — ce vede omul e ce descarcă.
 *
 * `table-fixed` cu `<col>` de lățime fixă: fără ele, browserul lățea coloanele
 * după conținut, iar zilele 1–9 ieșeau mai înguste decât 10–31 (auditul din
 * 8 oct 2026). `relative` pe containerul derulabil: fără el, `sr-only` din
 * `<caption>` scapă și târăște pagina lateral (capcana documentată).
 */
export function TabelColectiv({
  pontaj,
  document: d,
}: Readonly<{ pontaj: Pontaj; document: DocumentTabelar }>) {
  const latimi = d.coloane.map((c) => Math.round(c.latime * PX_PE_PUNCT));
  const total = latimi.reduce((s, w) => s + w, 0);
  const ziua = (j: number) => (j >= PRIMA_ZI ? pontaj.zile[j - PRIMA_ZI] : undefined);
  const fundal = (j: number) => {
    const z = ziua(j);
    if (z === undefined) return "";
    if (z.sarbatoare !== null) return "bg-mk-sl-hartie";
    return z.inProgram ? "" : "bg-mk-weekend-hartie";
  };

  return (
    <div className="border-mk-rigla relative mt-3 overflow-x-auto border">
      <table
        className="table-fixed border-collapse text-left"
        style={{ width: `${String(total)}px` }}
      >
        <caption className="sr-only">{d.titlu}, necompletată.</caption>
        <colgroup>
          {latimi.map((w, j) => (
            <col key={`${String(j)}-${String(w)}`} style={{ width: `${String(w)}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-mk-rigla border-b">
            {d.coloane.map((c, j) => {
              const z = ziua(j);
              return (
                <th
                  key={`${String(j)}-${c.eticheta}`}
                  scope="col"
                  data-zi={z === undefined ? undefined : String(z.zi)}
                  title={z?.sarbatoare ?? undefined}
                  className={`border-mk-liniatura font-mk-date border-r px-0.5 py-1.5 text-center text-[0.6875rem] leading-tight font-medium whitespace-pre-line ${j === 0 ? "text-left" : ""} ${fundal(j)}`}
                >
                  {c.eticheta}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {d.randuri.map((r, i) => (
            <tr
              key={`${String(i)}-${r[0] ?? ""}`}
              className="border-mk-liniatura border-b last:border-b-0"
            >
              {d.coloane.map((c, j) =>
                j === 0 ? (
                  <th
                    key={`${String(j)}-${c.eticheta}`}
                    scope="row"
                    className="border-mk-liniatura h-8 truncate border-r px-2 text-left text-[0.8125rem] font-normal"
                  >
                    {r[0] ?? ""}
                  </th>
                ) : (
                  <td
                    key={`${String(j)}-${c.eticheta}`}
                    className={`border-mk-liniatura font-mk-date border-r text-center text-[0.6875rem] ${fundal(j)}`}
                  >
                    {r[j] ?? ""}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { ACOPERIRE_FOAIE, INTREBARI_FOAIE_PONTAJ } from "@/content/landing/intrebari-pontaj";
import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_FOAIE_PONTAJ } from "@/content/landing/unelte";
import { calendarulAnului, cuDe } from "@/content/legal/zile-libere";
import { avertismentCui, MAX_COMPARTIMENT, MAX_CUI, MAX_FIRMA } from "@/lib/unelte/antet-firma";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { AvizCorectari } from "../../_componente/aviz-corectari";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { CeCereItm } from "../../_componente/ce-cere-itm";
import { Descarcari } from "../../_componente/descarcari";
import { IntrebariUnealta } from "../../_componente/intrebari-unealta";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import {
  AN_MAX,
  AN_MIN,
  avizAngajati,
  avizeParametri,
  LUNI,
  MAX_ANGAJATI,
  MAX_LUNGIME_NUME,
} from "./foaie";
import { documenteleFoii } from "./foaie-document";
import {
  CHEI_PONTAJ,
  construiestePontaj,
  parametriPontaj,
  PROGRAME,
  rezumatNorma,
  VARIANTE,
} from "./pontaj";
import { TabelColectiv } from "./tabel-colectiv";

/**
 * Foaie de pontaj lunară, gratuită, fără cont: colectivă sau câte o fișă pe om.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * „Foaie de pontaj lunar excel” e una dintre puținele căutări din zona asta cu
 * intenție clară și cu concurență slabă: rezultatele sunt șabloane statice, cu
 * sărbătorile scrise de mână pentru anul în care au fost făcute. Aici
 * sărbătorile se CALCULEAZĂ, inclusiv Paștele ortodox — același cod care ține
 * calendarul aplicației.
 *
 * ── CE A ADUS AUDITUL DIN 8 OCT 2026 ──────────────────────────────────────
 * Utilitate 3/5: lipseau ora de început și de sfârșit (art. 119), codurile,
 * totalurile pe absențe, antetul firmei, norma pe angajat, tipărirea Excelului.
 * Acum: varianta individuală (art. 119), programul pe ture, `Nume | normă`,
 * coduri ca în aplicație, Excel cu formule și A4 cu capul repetat.
 *
 * ── DE CE FORMULAR GET, FĂRĂ JAVASCRIPT ───────────────────────────────────
 * Parametrii stau în adresă: foaia se pune la favorite și se trimite pe e-mail
 * gata completată. Merge cu JavaScript oprit, iar descărcările sunt butoane de
 * trimitere spre `/api/unelte/foaie-de-pontaj` (vezi `Descarcari`).
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Foaie de pontaj Excel cu formule, PDF și Word",
  descriere:
    "Foaie de pontaj pentru orice lună: colectivă sau individuală, cu ora de început și de sfârșit, normă pe angajat. Excel cu formule, PDF, Word, fără cont.",
  cale: "/unelte/foaie-de-pontaj",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_ETICHETA = "text-[0.875rem] font-medium";
const CLASA_AJUTOR = "text-mk-text-slab text-[0.8125rem]";

/** Loc pentru „ | 7:30” după fiecare nume și pentru linia nouă: 60 × (80 + 9). */
const MAX_TEXT_ANGAJATI = MAX_ANGAJATI * (MAX_LUNGIME_NUME + 9);

export default async function PaginaFoaieDePontaj({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI_PONTAJ) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const parametri = parametriPontaj(q);
  const pontaj = construiestePontaj(parametri);
  const [primul, ...restul] = documenteleFoii(pontaj);
  const calendar = calendarulAnului(pontaj.an);
  const brutAngajati = unul(p.angajati) ?? "";
  // Un singur aviz pe pagină (`AvizCorectari`, B4): ce a corectat B din adresă și
  // din listă, apoi ce a corectat E — norma care nu se citește, CUI-ul.
  const avize = [
    ...avizeParametri(
      { an: unul(p.an), luna: unul(p.luna), ore: unul(p.ore) },
      { an: pontaj.an, luna: pontaj.luna },
    ),
    ...avizAngajati(parametri.linii.lista),
    ...parametri.linii.avertismente,
    avertismentCui(parametri.antet),
  ].filter((a): a is string => a !== null);
  const cuNormaProprie = pontaj.angajati.filter(
    (a) => a.nume !== "" && a.oreZi !== pontaj.oreZi,
  ).length;

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/foaie-de-pontaj",
          nume: ANTET_FOAIE_PONTAJ.titlu,
          descriere: ANTET_FOAIE_PONTAJ.lead,
        })}
      />
      {/* `data-tipar="ascunde"` e convenția proiectului: la tipărire rămâne doar
          `#documentul` (secțiunea B: `Antet`, `Subsol`, bara de cookie-uri, `Banda`). */}
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_FOAIE_PONTAJ}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Foaie de pontaj", href: "/unelte/foaie-de-pontaj" },
          ]}
        />
      </div>

      {/* Toată banda formularului rămâne pe ecran (B6): altfel umplutura și rigla
          ei se tipăreau goale deasupra documentului. */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Luna</span>
            <select name="luna" defaultValue={String(pontaj.luna)} className={CLASA_CAMP}>
              {LUNI.map((nume, i) => (
                <option key={nume} value={String(i + 1)}>
                  {nume}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Anul</span>
            <input
              type="number"
              name="an"
              min={AN_MIN}
              max={AN_MAX}
              defaultValue={String(pontaj.an)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Ore pe zi</span>
            <input
              type="number"
              name="ore"
              min={1}
              max={24}
              step="0.5"
              defaultValue={String(pontaj.oreZi)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Program</span>
            <select name="program" defaultValue={pontaj.program} className={CLASA_CAMP}>
              {PROGRAME.map((o) => (
                <option key={o.valoare} value={o.valoare}>
                  {o.eticheta}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={CLASA_ETICHETA}>Varianta</span>
            <select name="varianta" defaultValue={pontaj.varianta} className={CLASA_CAMP}>
              {VARIANTE.map((o) => (
                <option key={o.valoare} value={o.valoare}>
                  {o.eticheta}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={CLASA_ETICHETA}>Firma (opțional)</span>
            <input
              type="text"
              name="firma"
              maxLength={MAX_FIRMA}
              defaultValue={parametri.antet.firma}
              autoComplete="organization"
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>CUI (opțional)</span>
            <input
              type="text"
              name="cui"
              maxLength={MAX_CUI}
              defaultValue={parametri.antet.cui}
              inputMode="text"
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Compartiment (opțional)</span>
            <input
              type="text"
              name="compartiment"
              maxLength={MAX_COMPARTIMENT}
              defaultValue={parametri.antet.compartiment}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              data-umami-event="foaie-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Generează
            </button>
          </div>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className={CLASA_ETICHETA}>Angajați</span>
            <span className={CLASA_AJUTOR}>
              Câte un nume pe rând. Cine are altă normă decât cea de sus primește orele după o
              bară: „Ilie Maria | 4”. Poți lipi direct două coloane din Excel, numele și orele. Lasă
              gol pentru foaia de completat cu pixul.
            </span>
            <textarea
              name="angajati"
              rows={5}
              maxLength={MAX_TEXT_ANGAJATI}
              defaultValue={brutAngajati}
              placeholder={"Popa Ion\nIlie Maria | 4\nRadu Andrei"}
              className={CLASA_CAMP}
            />
          </label>
          <Descarcari actiune="/api/unelte/foaie-de-pontaj" eveniment="foaie" />
        </form>

        <AvizCorectari avize={avize} />
        <p className="text-mk-text-slab mt-6 text-[0.9375rem]" data-tipar="ascunde">
          {rezumatNorma(pontaj)}
          {cuNormaProprie > 0 &&
            ` · ${cuNormaProprie === 1 ? "un angajat" : cuDe(cuNormaProprie, "angajați")} cu normă proprie`}
        </p>
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        {pontaj.varianta === "colectiva" ? (
          <figure className="mk-foaie" data-tipar-pagina="peisaj">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="font-mk-date text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
                {primul.titlu}
              </p>
              {primul.subtitlu !== null && (
                <p className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.04em]">
                  {primul.subtitlu}
                </p>
              )}
            </figcaption>
            <TabelColectiv pontaj={pontaj} document={primul} />
            {primul.note.map((n) => (
              <p key={n} className="text-mk-text-slab mt-3 text-[0.8125rem] leading-[1.6]">
                {n}
              </p>
            ))}
          </figure>
        ) : (
          <>
            <PrevizualizareDocument document={primul} />
            {restul.length > 0 && (
              <p className="text-mk-text-slab mt-4 text-[0.875rem]">
                {restul.length === 1 ? "Încă o fișă" : `Încă ${cuDe(restul.length, "fișe")}`},
                câte una pe pagină, în fișierul descărcat.
              </p>
            )}
          </>
        )}
      </Banda>

      <div data-tipar="ascunde">
        <CeCereItm acoperire={ACOPERIRE_FOAIE} />
      </div>

      {/* Zilele lucrătoare și norma pe luni, pentru anul ales — din același calcul
          ca ghidul zilelor libere (auditul din 7 oct 2026). */}
      <div data-tipar="ascunde">
        <Banda
          id="zile-lucratoare"
          inaltime="medie"
          titlu={`Zile lucrătoare și ore normă în ${String(pontaj.an)}`}
          lead={`Pentru normă întreagă de 8 ore pe zi. ${String(pontaj.an)} are ${cuDe(calendar.zileLucratoare, "zile lucrătoare")}, adică ${cuDe(calendar.zileLucratoare * 8, "ore")}.`}
        >
          <div className="relative mt-6 max-w-xl overflow-x-auto">
            <table className="w-full border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr className="border-mk-rigla border-b">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Luna
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Zile lucrătoare
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Ore normă
                  </th>
                </tr>
              </thead>
              <tbody>
                {calendar.luni.map((l) => (
                  <tr key={l.luna} className="border-mk-rigla/40 border-b">
                    <td className="py-2 pr-4 capitalize">{l.luna}</td>
                    <td className="font-mk-date py-2 pr-4 tabular-nums">{l.zileLucratoare}</td>
                    <td className="font-mk-date py-2 tabular-nums">{l.zileLucratoare * 8}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-mk-text-slab mt-4 text-[0.9375rem] leading-[1.6]">
            Sărbătorile legale ale anului, cu ziua în care cade fiecare:{" "}
            <Link href="/ghid/zile-libere" className="underline underline-offset-4">
              zilele libere legale
            </Link>
            .
          </p>
        </Banda>
      </div>

      <div data-tipar="ascunde">
        <IntrebariUnealta
          titlu="Ce se mai întreabă despre foaia de pontaj"
          intrebari={INTREBARI_FOAIE_PONTAJ}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="medie" titlu="De ce sărbătorile de aici sunt corecte">
          <div className="mt-6 max-w-[68ch] space-y-4">
            <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
              Un șablon de foaie de calcul descărcat de pe internet are sărbătorile scrise de mână,
              pentru anul în care a fost făcut. Anul următor arată exact la fel și e greșit — iar
              Paștele ortodox, Vinerea Mare și Rusaliile se mută în fiecare an.
            </p>
            <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
              Aici zilele se calculează exact ca în calendarul aplicației. Dacă alegi 2031, primești
              sărbătorile lui 2031, nu pe ale lui 2026.
            </p>
            <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
              Pe hârtie, foaia nu face socoteli; fișierul Excel adună orele și numără codurile pe
              fiecare om. Tot nu știe cine a fost în concediu și nu poate dovedi peste șase luni
              cine a modificat-o. Pentru astea e nevoie de un loc în care datele să stea, nu de un
              fișier mai bun.
            </p>
            {/*
              Nota asta rămâne, chiar dacă scade conversia: foaia COLECTIVĂ are o
              căsuță pe zi, iar art. 119 cere ora de începere ȘI de sfârșit. O
              unealtă care lasă impresia că te pune în legalitate, când nu te pune,
              e mai rea decât una care lipsește. Din 8 oct 2026 nota trimite la
              varianta care chiar acoperă cerința.
            */}
            <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
              Foaia colectivă are o căsuță pe zi, adică numărul de ore. Art. 119 din Codul muncii
              cere ora de începere <em>și</em> ora de sfârșit, zilnic, ținute la locul de muncă.
              Pentru asta alege{" "}
              <a href="?varianta=individuala#documentul" className="underline underline-offset-4">
                fișa individuală
              </a>{" "}
              sau{" "}
              <Link href="/unelte/condica-de-prezenta" className="underline underline-offset-4">
                condica de prezență
              </Link>
              ;{" "}
              <Link href="/evidenta-orelor-de-munca" className="underline underline-offset-4">
                ce cere exact art. 119
              </Link>
              .
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={RO.hero.ctaPrimar.href}
              data-umami-event="cta-foaie-pontaj"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              {RO.hero.ctaPrimar.eticheta}
            </Link>
            <Link
              href="/comparatie/excel"
              className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
            >
              Excel sau aplicație
            </Link>
          </div>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/foaie-de-pontaj"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
```

Celelalte fișiere ale taskului:

`src/content/landing/unelte.ts`, linia 14 veche:

```ts
  lead: "Model de foaie de pontaj lunar: alegi luna și scrii numele. Weekendurile și sărbătorile legale se marchează singure — inclusiv Paștele ortodox și zilele care depind de el. Se tipărește sau se descarcă în PDF, Word ori Excel, fără cont.",
```

devine:

```ts
  lead: "Alegi luna și programul, scrii numele — cu norma fiecăruia, dacă lucrează cu timp parțial. Weekendurile și sărbătorile legale se marchează singure, inclusiv Paștele ortodox. Primești foaia colectivă sau câte o fișă pe om, cu ora de început și de sfârșit, în Excel cu formule, PDF sau Word, fără cont.",
```

`src/app/(marketing)/unelte/page.tsx`, linia 46 veche:

```ts
    nota: `${AN_MIN}–${AN_MAX} · până la ${MAX_ANGAJATI} de angajați · fără cont`,
```

devine:

```ts
    nota: `${AN_MIN}–${AN_MAX} · colectivă sau individuală · normă pe angajat · Excel cu formule · până la ${MAX_ANGAJATI} de angajați`,
```

`src/app/llms.txt/route.ts`, intrarea veche:

```ts
  [
    "/unelte/foaie-de-pontaj",
    "Unealtă gratuită: generează o foaie de pontaj lunară cu sărbătorile legale calculate, descărcabilă în PDF, Word sau Excel. Fără cont.",
  ],
```

devine:

```ts
  [
    "/unelte/foaie-de-pontaj",
    "Unealtă gratuită: foaie de pontaj lunară cu sărbătorile legale calculate, colectivă sau câte o fișă individuală pe angajat cu ora de început și de sfârșit (art. 119 Codul muncii). Program luni–vineri, luni–sâmbătă sau ture, normă proprie pe angajat (timp parțial), codurile CO, CM, CFS, AN, D, L, SL, antetul firmei. Excel cu formule (ore, normă, COUNTIF pe coduri, A4 cu capul repetat), PDF sau Word. Fără cont.",
  ],
```

`src/content/landing/harta.ts`: în blocurile cu `cale: "/unelte/foaie-de-pontaj"` și `cale: "/unelte"`, `actualizat` primește data de azi (`date +%F`).

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run "src/app/(marketing)/"`. Rezultatul așteptat: `tabel-colectiv.test.tsx` are 2 teste trecute și `pagina.test.ts` 2. Testele lui B pe pagina randată trec și ele: `unelte/avize.test.tsx` (avizul „Am păstrat primii 60 din 70…” și niciun `status` fără corecturi) și `unelte/tipar.test.tsx` (la tipar rămâne doar `#documentul`; figura are `data-tipar-pagina="peisaj"`). `descarcari.test.tsx` trece, adică `<Descarcari` e în `<form`. `descrieri.test.ts` trece cu descrierea de 152 de caractere, între 70 și 160. `metadate.test.ts` trece cu titlul de 45 de caractere, sub 48.

- [ ] **Pasul 5: Verificarea headless, la 360 px și la 1366 px.** Scriptul stă în scratchpad, nu în repo. Pornește serverul ca la E10 Pasul 5 (`next dev -H 127.0.0.1 -p 3917`, în fundal, așteptat cu Monitor), apoi:

```bash
cat > "$S/verifica-unelte.mjs" <<'EOF'
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";
const [cale, eticheta] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
});
for (const latime of [360, 1366]) {
  const pagina = await browser.newPage({ viewport: { width: latime, height: 900 } });
  await pagina.goto(`http://127.0.0.1:3917${cale}`, { waitUntil: "load" });
  const m = await pagina.evaluate(() => {
    const zile = [...document.querySelectorAll("#documentul th[data-zi]")].map(
      (th) => Math.round(th.getBoundingClientRect().width * 10) / 10,
    );
    const tabel = document.querySelector("#documentul table");
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      zile: zile.length,
      latimiZile: [...new Set(zile)],
      tabelDerulabil: tabel ? tabel.parentElement.scrollWidth > tabel.parentElement.clientWidth : null,
      avertismente: [...document.querySelectorAll('[role="status"] li')].map((li) => li.textContent),
    };
  });
  console.log(latime, JSON.stringify(m));
  await pagina.screenshot({ path: `${process.env.S}/${eticheta}-${latime}.png`, fullPage: true });
  await pagina.close();
}
await browser.close();
EOF
cd "$S"
S="$S" node verifica-unelte.mjs "/unelte/foaie-de-pontaj?an=2026&luna=12&firma=Construct%20SRL&cui=14399841&angajati=Popa%20Ion%0AIlie%20Maria%20%7C%204%0ARadu%20Andrei%20%7C%20patru" e13-colectiva
S="$S" node verifica-unelte.mjs "/unelte/foaie-de-pontaj?an=2026&luna=12&varianta=individuala&program=ture&angajati=Popa%20Ion%0AIlie%20Maria" e13-individuala
```

Ce trebuie să iasă. La ambele lățimi și ambele variante, `scrollWidth === clientWidth`, adică pagina nu se mișcă lateral. Pe varianta colectivă, `zile: 31` și `latimiZile` cu o singură valoare (24 px), iar `tabelDerulabil: true` la 360 px. `avertismente` (lista din `AvizCorectari`) conține exact două mesaje: unul pentru „patru” (Radu Andrei) și unul pentru CUI-ul cu cifra de control greșită. Pe varianta individuală, `zile: 0` (nu există tabel colectiv) și textul „Încă o fișă, câte una pe pagină”. Citește cu `Read` capturile `e13-colectiva-1366.png`, `e13-colectiva-360.png`, `e13-individuala-360.png` și verifică: L/SL în celule, coloanele de total, formularul pe o coloană la 360 px și banda „Ce cere inspectorul de muncă” cu cele două amenzi. Oprește serverul într-un apel separat: `pkill -f "next dev -H 127.0.0.1 -p 391[7]"`, apoi `rm -f .next/dev/types/validator.ts .next/dev/types/routes.d.ts`. Hidratarea nu se verifică aici (`next dev` nu hidratează din sesiune, conform memoriei), dar pagina n-are nimic care să depindă de ea.

- [ ] **Pasul 6: Lanțul complet** (`lastmod.mjs` după commit), plus `prettier --write` și apoi `--check` pe cele nouă fișiere.

- [ ] **Commit** — căi: `"src/app/(marketing)/unelte/foaie-de-pontaj/tabel-colectiv.tsx" "src/app/(marketing)/unelte/foaie-de-pontaj/tabel-colectiv.test.tsx" "src/app/(marketing)/unelte/foaie-de-pontaj/pagina.test.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx" src/content/landing/unelte.ts "src/app/(marketing)/unelte/page.tsx" src/app/llms.txt/route.ts src/content/landing/harta.ts`. Mesaj: `feat(unelte): pagina foii de pontaj — variante, program, normă pe angajat, antet, ITM și întrebări`.

---

### Task E14: Pagina condicii — program pe ture, antet, ITM, întrebări; fără compatibilitatea veche

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/condica-de-prezenta/page.tsx` (rescris întreg; cel vechi, de 229 de linii, a fost citit tot)
- Create: `src/app/(marketing)/unelte/condica-de-prezenta/pagina.test.ts`
- Modify: `src/app/(marketing)/unelte/condica-de-prezenta/model.ts`: se scot `construiesteCondica` și câmpul `firma` din `ParametriCondica`, plus atribuirea lui din `parametriCondica`
- Modify: `src/content/landing/unelte.ts` (`ANTET_CONDICA.lead`), `src/app/(marketing)/unelte/page.tsx` (`nota` condicii, linia 52), `src/app/llms.txt/route.ts` (intrarea condicii), `src/content/landing/harta.ts` (`/unelte/condica-de-prezenta` și `/unelte`)

**Interfețe:**
- Consumă: `parametriCondica`, `condicaDocument` (E11); `PROGRAME`, `liniiAngajati` (E3); `AvizCorectari` (B4), `avizAngajati` (B4), `avizeParametri` (B8); `avertismentCui`, `MAX_FIRMA`, `MAX_CUI`, `MAX_COMPARTIMENT` (E1); `CeCereItm`, `IntrebariUnealta`, `ACOPERIRE_CONDICA`, `INTREBARI_CONDICA` (E7); `MAX_ANGAJATI`, `MAX_LUNGIME_NUME`, `AN_MIN`, `AN_MAX`, `LUNI`.
- Produce: pagina; `ParametriCondica` fără `firma`.

- [ ] **Pasul 0:** Citește pagina condicii așa cum au lăsat-o B4, B6 și B8: `AvizCorectari` cu `avizeParametri({ an, luna }, ales)` și `avizAngajati(citesteAngajati(…))`, plus `data-tipar="ascunde"` pe banda formularului. Fișierul nou le păstrează, iar lista lui B o ia din `liniiAngajati`, adică aceeași citire ca în `parametriCondica`. Figura condicii (portret) NU poartă `data-tipar-pagina`: `tipar.test.tsx` verifică asta.

- [ ] **Pasul 1: Scrie testul care pică**

```ts
// src/app/(marketing)/unelte/condica-de-prezenta/pagina.test.ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as model from "./model";

const SURSA = readFileSync("src/app/(marketing)/unelte/condica-de-prezenta/page.tsx", "utf8");

describe("pagina condicii", () => {
  it("formularul trimite programul și antetul firmei", () => {
    for (const camp of ["an", "luna", "program", "firma", "cui", "compartiment", "angajati"]) {
      expect(SURSA, camp).toContain(`name="${camp}"`);
    }
  });

  it("are banda ITM și întrebările comune", () => {
    expect(SURSA).toContain("<CeCereItm");
    expect(SURSA).toContain("<IntrebariUnealta");
    expect(SURSA).not.toContain("construiesteCondica(");
  });

  it("compatibilitatea de dinainte de 8 oct 2026 a plecat din model", () => {
    expect("construiesteCondica" in model).toBe(false);
    const p = model.parametriCondica(new URLSearchParams({ firma: "X" }));
    expect("firma" in p).toBe(false);
    expect(p.antet.firma).toBe("X");
    expect(p.notaAngajati).toBeNull(); // mecanica lui B4 rămâne
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

Rulează `pnpm exec vitest run "src/app/(marketing)/unelte/condica-de-prezenta/pagina.test.ts"`. Rezultatul așteptat: 3 teste eșuate (`name="program"` lipsește, `construiesteCondica(` e încă în pagină și încă exportat).

- [ ] **Pasul 3: Implementarea minimă**

```tsx
// src/app/(marketing)/unelte/condica-de-prezenta/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { ACOPERIRE_CONDICA, INTREBARI_CONDICA } from "@/content/landing/intrebari-pontaj";
import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_CONDICA } from "@/content/landing/unelte";
import { avertismentCui, MAX_COMPARTIMENT, MAX_CUI, MAX_FIRMA } from "@/lib/unelte/antet-firma";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { AvizCorectari } from "../../_componente/aviz-corectari";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { CeCereItm } from "../../_componente/ce-cere-itm";
import { Descarcari } from "../../_componente/descarcari";
import { IntrebariUnealta } from "../../_componente/intrebari-unealta";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import {
  AN_MAX,
  AN_MIN,
  avizAngajati,
  avizeParametri,
  LUNI,
  MAX_ANGAJATI,
  MAX_LUNGIME_NUME,
} from "../foaie-de-pontaj/foaie";
import { liniiAngajati, PROGRAME } from "../foaie-de-pontaj/pontaj";
import { condicaDocument, parametriCondica } from "./model";

/**
 * Condica de prezență, gratuită.
 *
 * Keyword Planner, 2 oct 2026: „condica de prezență model word” are 100–1.000
 * de căutări pe lună, cu „este obligatorie” printre cele mai sugerate. Pagina
 * răspunde întâi la întrebare (banda „Pe scurt”), apoi dă fișierul.
 *
 * Auditul din 8 oct 2026 (MAJOR): condica sărea sâmbetele, duminicile și
 * sărbătorile. Acum are programul luni–vineri, luni–sâmbătă sau ture, rânduri
 * marcate L/SL pentru zilele nelucrate, pauză, ore lucrate și observații, iar
 * Excelul calculează orele.
 *
 * Formular GET: starea stă în adresă, pagina merge fără JavaScript, iar
 * descărcările sunt butoane de trimitere spre `/api/unelte/condica-de-prezenta`.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Condica de prezență: model Word, PDF și Excel",
  descriere:
    "Condica de prezență pentru orice lună, cu sâmbete și ture, ora sosirii și a plecării, pauza și orele calculate în Excel. Word, PDF sau Excel, gratuit.",
  cale: "/unelte/condica-de-prezenta",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_ETICHETA = "text-[0.875rem] font-medium";

const CHEI_CONDICA = ["an", "luna", "program", "firma", "cui", "compartiment", "angajati"] as const;
const MAX_TEXT_ANGAJATI = MAX_ANGAJATI * (MAX_LUNGIME_NUME + 9);

export default async function PaginaCondica({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI_CONDICA) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const ales = parametriCondica(q);
  const document = condicaDocument(ales);
  const brutAngajati = unul(p.angajati) ?? "";
  // Un singur aviz pe pagină (`AvizCorectari`, B4/B8), plus CUI-ul (E).
  const avize = [
    ...avizeParametri({ an: q.get("an") ?? undefined, luna: q.get("luna") ?? undefined }, ales),
    ...avizAngajati(liniiAngajati(q.get("angajati") ?? undefined, 8).lista),
    avertismentCui(ales.antet),
  ].filter((a): a is string => a !== null);

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/condica-de-prezenta",
          nume: ANTET_CONDICA.titlu,
          descriere: ANTET_CONDICA.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_CONDICA}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Condica de prezență", href: "/unelte/condica-de-prezenta" },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Pe scurt" titlu="Condica de prezență e obligatorie?">
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Legea nu cere un registru numit „condică”. Cere evidența orelor prestate zilnic de
              fiecare salariat, cu ora de începere și ora de sfârșit a programului — art. 119 alin.
              (1) din Codul muncii. Condica pe hârtie e felul cel mai vechi de a o ține; o aplicație
              de pontaj e altul.
            </p>
            <p>
              Ce se cere exact, unde se ține și ce amenzi sunt, cu articolul lângă fiecare:{" "}
              <Link href="/evidenta-orelor-de-munca" className="underline underline-offset-4">
                evidența orelor de muncă
              </Link>
              .
            </p>
          </div>
        </Banda>
      </div>

      <Banda inaltime="scurta" data-tipar="ascunde">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Luna</span>
            <select name="luna" defaultValue={String(ales.luna)} className={CLASA_CAMP}>
              {LUNI.map((nume, i) => (
                <option key={nume} value={String(i + 1)}>
                  {nume}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Anul</span>
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
            <span className={CLASA_ETICHETA}>Program</span>
            <select name="program" defaultValue={ales.program} className={CLASA_CAMP}>
              {PROGRAME.map((o) => (
                <option key={o.valoare} value={o.valoare}>
                  {o.eticheta}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="condica-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Generează
            </button>
          </div>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={CLASA_ETICHETA}>Firma (opțional)</span>
            <input
              type="text"
              name="firma"
              maxLength={MAX_FIRMA}
              defaultValue={ales.antet.firma}
              autoComplete="organization"
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>CUI (opțional)</span>
            <input
              type="text"
              name="cui"
              maxLength={MAX_CUI}
              defaultValue={ales.antet.cui}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Compartiment (opțional)</span>
            <input
              type="text"
              name="compartiment"
              maxLength={MAX_COMPARTIMENT}
              defaultValue={ales.antet.compartiment}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className={CLASA_ETICHETA}>Angajați</span>
            <span className="text-mk-text-slab text-[0.8125rem]">
              Câte un nume pe rând. Gol = câte zece rânduri pe zi, de completat cu pixul. La
              „Luni–vineri”, sâmbetele, duminicile și sărbătorile apar câte un rând, marcat cu L sau
              SL; dacă lucrați atunci, alege „Luni–sâmbătă” sau „Toate zilele (ture)”.
            </span>
            <textarea
              name="angajati"
              rows={4}
              maxLength={MAX_TEXT_ANGAJATI}
              defaultValue={brutAngajati}
              placeholder={"Popa Ion\nIlie Maria\nRadu Andrei"}
              className={CLASA_CAMP}
            />
          </label>
          <Descarcari
            actiune="/api/unelte/condica-de-prezenta"
            eveniment="condica"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
        <AvizCorectari avize={avize} />
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <CeCereItm acoperire={ACOPERIRE_CONDICA} />
      </div>

      <div data-tipar="ascunde">
        <IntrebariUnealta titlu="Ce se mai întreabă despre condică" intrebari={INTREBARI_CONDICA} />
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Fără hârtie" titlu="Când condica devine prea mult">
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            Cu o aplicație, ora sosirii și a plecării se scriu de pe telefonul omului, iar luna se
            închide fără să recopiezi nimic.{" "}
            <Link href="/module/pontaj" className="underline underline-offset-4">
              Cum arată modulul de pontaj
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/condica-de-prezenta"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
```

În `model.ts`, blocul vechi din `ParametriCondica`:

```ts
  /** Nota pentru document când lista a trecut de 60 de nume; `null` altfel (B4). */
  notaAngajati: string | null;
  /** Egal cu `antet.firma`. Rămâne doar cât pagina îl citește direct (până la E14). */
  firma: string;
}>;
```

devine:

```ts
  /** Nota pentru document când lista a trecut de 60 de nume; `null` altfel (B4). */
  notaAngajati: string | null;
}>;
```

În `parametriCondica` se șterge linia `firma: antet.firma,`. Funcția `construiesteCondica`, cu comentariul ei, se șterge întreagă.

`src/content/landing/unelte.ts`, linia veche a lui `ANTET_CONDICA.lead`:

```ts
  lead: "Alege luna și scrie numele: primești condica cu fiecare zi lucrătoare, ora sosirii, ora plecării și semnătura. Sărbătorile legale se scot singure. Descarci în Word, PDF sau Excel, fără cont.",
```

devine:

```ts
  lead: "Alege luna și programul, scrie numele: primești condica cu fiecare zi a lunii, ora sosirii, ora plecării, pauza și semnătura — și pentru sâmbete sau ture. Sărbătorile legale se marchează singure, iar în Excel orele lucrate se calculează. Word, PDF sau Excel, fără cont.",
```

`src/app/(marketing)/unelte/page.tsx`, linia veche:

```ts
    nota: "ora sosirii și a plecării, pe fiecare zi lucrătoare · Word, PDF, Excel",
```

devine:

```ts
    nota: "toate zilele, inclusiv ture · ore lucrate calculate în Excel · Word, PDF, Excel",
```

`src/app/llms.txt/route.ts`, intrarea veche:

```ts
  [
    "/unelte/condica-de-prezenta",
    "Unealtă gratuită: condica de prezență pentru orice lună, cu un rând pe om pe fiecare zi lucrătoare, ora sosirii, ora plecării și semnătura. Word, PDF sau Excel, fără cont. Plus răspunsul la „e obligatorie?” (art. 119 Codul muncii).",
  ],
```

devine:

```ts
  [
    "/unelte/condica-de-prezenta",
    "Unealtă gratuită: condica de prezență pentru orice lună, pe program luni–vineri, luni–sâmbătă sau ture; un rând pe om pe fiecare zi, cu ora sosirii, ora plecării, pauza, orele lucrate și observațiile, iar zilele nelucrate marcate L sau SL. Antetul firmei (CUI, compartiment). Excel cu orele calculate și total pe angajat, Word sau PDF, fără cont. Plus răspunsul la „e obligatorie?” și amenda din art. 260 alin. (1) lit. m) Codul muncii.",
  ],
```

`harta.ts`: `actualizat` cu data de azi la `/unelte/condica-de-prezenta` și la `/unelte`.

- [ ] **Pasul 4: Rulează testele, trec**

Rulează `pnpm exec vitest run "src/app/(marketing)/" src/app/api/unelte/ src/lib/unelte/`. Rezultatul așteptat: `pagina.test.ts` al condicii are 3 teste trecute; `model.test.ts` trece întreg (nu folosește `construiesteCondica`); `descrieri.test.ts` trece cu 150 de caractere; `descarcari.test.tsx` trece; `unelte/avize.test.tsx` („condica la fel”) și `unelte/tipar.test.tsx` (condica fără `data-tipar-pagina`) trec.

- [ ] **Pasul 5: Verificarea headless**, cu scriptul din E13 (`$S/verifica-unelte.mjs`) și același server:

```bash
cd "$S"
S="$S" node verifica-unelte.mjs "/unelte/condica-de-prezenta?an=2026&luna=4&program=ls&firma=Construct%20SRL&cui=14399840&angajati=Popa%20Ion%0AIlie%20Maria" e14-ls
S="$S" node verifica-unelte.mjs "/unelte/condica-de-prezenta?an=2026&luna=4" e14-gol
```

Ce trebuie să iasă: `scrollWidth === clientWidth` la 360 px și la 1366 px, pe ambele adrese. Citește cu `Read` capturile `e14-ls-360.png` și `e14-ls-1366.png`. Pe 04.04.2026 (sâmbătă) trebuie să fie rânduri pentru Popa Ion și Ilie Maria; 05.04 trebuie să fie un singur rând „Duminică — zi de repaus” cu L; 10.04 un rând „Vinerea Mare” cu SL. Banda ITM trebuie să aibă cele două amenzi, iar lista de întrebări 5 întrebări. Oprește serverul ca la E13.

- [ ] **Pasul 6: Lanțul complet** (`lastmod.mjs` după commit), plus `prettier --write` și apoi `--check` pe cele șapte fișiere.

- [ ] **Commit** — căi: `"src/app/(marketing)/unelte/condica-de-prezenta/page.tsx" "src/app/(marketing)/unelte/condica-de-prezenta/pagina.test.ts" "src/app/(marketing)/unelte/condica-de-prezenta/model.ts" src/content/landing/unelte.ts "src/app/(marketing)/unelte/page.tsx" src/app/llms.txt/route.ts src/content/landing/harta.ts`. Mesaj: `feat(unelte): pagina condicii — program pe ture, antet, ITM și întrebări`.

- [ ] **După E14 — livrarea.** Cele 14 commit-uri sunt pe `origin/main`, dar pe producție nu ajunge nimic fără deploy. Deploy-ul se face prin `./administrativo.sh` (vezi `erp-deploy-productie.md`) și **numai cu confirmarea explicită a utilizatorului**. Taskul se oprește aici și raportează: commit-urile, rezultatele lanțului (cu ieșirea comenzilor) și capturile headless. După deploy, aceleași `curl`-uri din E10/E12 se rulează pe `https://administrativo.ro/api/unelte/…`.

---

**Review Focus** — condiții pe care nu le prinde niciun test unitar de mai sus și care ar mușca un utilizator real. Fiecare are, între paranteze, testul sau proba adăugată în taskul care deține codul.

1. **Lista de angajați lipită din Excel, cu CRLF, TAB final și trei coloane („Radu⇥Andrei⇥6”), dar și „Popa⇥Ion” fără normă.** Regula lui B face din TAB un spațiu, iar a lui E citește norma după TAB. Puse cap la cap fără grijă, ori pierd norma, ori rup numele („Popa” cu norma „Ion”). (E3: „acceptă două coloane lipite din Excel, cu CRLF și TAB final” și „„Popa⇥Ion”, fără număr după TAB, rămâne un singur om”.)
2. **O lună de 31 de zile, cu antetul de firmă cel mai lung, în fișa individuală.** Orice centimetru în plus (un rând de notă care se rupe, un rând de 17 pt) trimite semnăturile pe pagina a doua, iar „o pagină pe om” se pierde tocmai la firmele cu nume lungi. (E8: „fiecare fișă încape pe O pagină A4…”; E10 îl repetă pe ruta reală, cu 3 pagini pentru 3 oameni.)
3. **Nume de filă care rup ExcelJS: doi „Popa Ion”, „Ana/Maria”, „O'Neil”, „History”, un nume de 36 de caractere.** Fără curățare, `addWorksheet` aruncă și ruta dă 500 exact pe firmele cu omonimi. (E6: „orice nume produs e acceptat de ExcelJS”; E9: „are o filă pe om, cu nume sigure și dublurile deosebite”.)
4. **Formulele Excel nu sunt evaluate de niciun test**, fiindcă ExcelJS nu are motor de calcul: tura 22:00–06:00, pauza mai lungă decât intervalul, „8” tastat fără două puncte. Testele fixează forma exactă a formulei (`MOD(D7-C7,1)`, `MAX(0,…)`, `N(E7)`) și validarea `decimal` 0–0,99999. Calculul însuși se probează manual într-un program de calcul (E9 Pasul 5, cu rezultatul scris în mesajul de commit; dacă nu s-a putut, se scrie că n-a fost probat).
5. **Norma per angajat scrisă „7,5”, „4h” sau „6:30”, ori greșit („patru”, „30”).** Varianta greșită nu trebuie să oprească foaia și nici să treacă tăcut: omul primește norma comună, iar pagina îl numește într-un avertisment. (E3: „oreDinText acceptă 4, 4h, 7,5, 7.25 și 6:30, refuză restul” și „o normă care nu se citește păstrează omul…”; E13 Pasul 5 verifică avertismentul randat pe pagină.)
