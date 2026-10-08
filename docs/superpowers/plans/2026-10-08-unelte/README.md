# Uneltele gratuite: reparații, rangul cel mai bun, utilizatori — plan de implementare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cele șapte unelte de pe `/unelte` nu mai scurg datele scrise în formulare, dau documente corecte juridic și fiscal, devin cele mai complete variante gratuite din România pe termenul lor și aduc conturi măsurabile în aplicație. Pe drum se repară motorul de salarizare din aplicație.

**Architecture:** unsprezece secțiuni (A–K), câte un fișier fiecare, executate în patru valuri. Infrastructura comună a documentelor (`src/lib/unelte/*`: modelul `DocumentTabelar` și cele trei randări) se extinde o singură dată (B, E4–E6), apoi fiecare unealtă își mută constructorul pe rută statică proprie (E12, F12, G6, I7). Calendarul și salarizarea rămân în `src/domain/`, iar uneltele le refolosesc fără dublură (B1, D6′).

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript strict, Vitest, `pdf-lib` + DejaVu, `docx`, `exceljs`, playwright-core pentru porțile live, nginx pe edge-ul partajat, Umami 3.3.1, GA4 cu Consent Mode.

**Spec:** auditul live din 8 oct 2026 (18 agenți, fiecare defect trecut prin verificator adversarial). Rezultatul brut, cu dovezi, a stat în scratchpad-ul sesiunii. Constatările care contează sunt rezumate mai jos și citate cu cifre în secțiunea „De ce” a fiecărui fișier.

## Ce a găsit auditul (pe scurt)

- **Funcționează tehnic:** 8 pagini × formate, fișiere valide sub 0,5 s, niciun 500 la intrări ostile, sărbătorile corecte pentru 2024–2035, calculatorul corect pe 65 de cazuri.
- **Practic nu le folosește nimeni:** 0 descărcări umane în 35 de zile, 32 de impresii, 2 clicuri. Singurul om care a folosit o unealtă și-a făcut cont în 3 minute. E singura înscriere organică documentată de pe site.
- **Utilitate:** 3/5 pentru pontaj, condică, cerere de concediu și calculator; 2/5 pentru foaia de parcurs, fișa SSM (neconformă cu anexa 11) și fișa de evaluare (nu calculează nimic).
- **Defecte cu risc real:** datele din formulare ajung la GA4 chiar fără consimțământ; „5.000” e citit ca 5 lei; motorul aplicației nu are suma neimpozabilă de 200 de lei.

## ⚠ Urgent, găsit la redactare și reconfirmat pe producție pe 9 oct 2026, 00:05

Funcția `public.payroll_scrie_rezultate` (ultima definiție: `0146_bani_si_timp.sql`) **nu scrie `rest_de_plata`, `baza_cas` și alte 11 coloane calculate**. În `pg_get_functiondef`, `position('rest_de_plata')` dă `0`. Exportul bancar (`src/app/api/export/salarizare/bancar/route.ts`) și fluturașul PDF citesc exact `rest_de_plata`.

Pe producție, firma `solemtrix-hardware-software-s-r-l`, creată pe 8 oct, are deja rânduri calculate cu **brut 500, net 292,50, rest de plată 0, `baza_cas` 0**. Firma `wise` (31 de contracte) are octombrie 2026 în ciornă, încă necalculat. Reparația e taskul **D2**, iar migrarea se aplică pe producție doar cu confirmarea explicită a utilizatorului.

## Fișierele planului

| Fișier | Secțiune | Taskuri |
| --- | --- | --- |
| [A-confidentialitate.md](A-confidentialitate.md) | Datele din formulare nu mai pleacă la GA4, Umami, nginx; cache privat; promisiunea și politica rescrise | A1–A9 |
| [B-robustete-comuna.md](B-robustete-comuna.md) | Sărbătorile din ziua intrării în vigoare, Word valid, nume doar pe rând nou, aviz peste 60, tipărire pe o pagină, norma fără virgulă mobilă, avize de parametri | B1–B9 |
| [C-calculator-salariu.md](C-calculator-salariu.md) | „4.500” ca mii, perioadele 2026, net→brut corect, deduceri complete, tichete, timp parțial, handicap, legătura de trimis, ancore SEO | C1–C11 |
| [D-motor-salarizare.md](D-motor-salarizare.md) | Rest de plată 0 (migrare), facilitatea de 200 de lei în motor, fluturaș, D112, paritatea calculator ↔ motor | D1–D8 (D6 → D6′) |
| [E-pontaj-condica.md](E-pontaj-condica.md) | Antet de firmă, coduri, program pe ture, normă per angajat, Excel cu formule, condica cu toate zilele, ITM | E1–E14 |
| [F-cerere-concediu.md](F-cerere-concediu.md) | Paștele gregorian și cultele, citire strictă, 8 variante, scrisoare A4, calculator de zile cuvenite | F1–F15 |
| [G-foaie-parcurs.md](G-foaie-parcurs.md) | Cele 4 elemente minime, 1–4 curse pe zi, alimentări, Excel cu formule, 50%/100% cu temei | G1–G9 |
| [H-fisa-ssm.md](H-fisa-ssm.md) | Fișa completă după anexa 11, rânduri după periodicitate, doar Word/PDF | H1–H8 |
| [I-fisa-evaluare.md](I-fisa-evaluare.md) | Pondere, notă și calificativ calculate, seturi de criterii, Excel cu SUMPRODUCT, temei legal | I1–I10 |
| [J-masurare-conversie.md](J-masurare-conversie.md) | Descărcările numărate pe server fără date personale, sursa contului, îndemnul de după document, raport săptămânal | J1–J8 |
| [K-seo-unelte-noi.md](K-seo-unelte-noi.md) | Titluri pe intenție, hub pe categorii, interlinking, 4 unelte noi, „model completat”, gtag după Accept, distribuție | K1–K14 |

Fiecare fișier are, în ordine: **Scop**, **De ce** (cu cifrele auditului), **Decizii luate**, **Harta fișierelor**, apoi taskurile cu cod complet și **Review Focus**.

## Valurile, în ordinea de execuție

Ordinea vine de la criticul de completitudine, care a citit toate secțiunile împreună. Conflictele pe fișiere comune sunt rezolvate deja în texte, prin blocurile „Pasul 0” și liniile de ordine.

**Valul 1 — riscul real (≈ 3–4 sesiuni).**
A1 → A2 → A3 → A4, A5, A6 → A7 · D1 → D2 · D3 → D4 → D5, D7, D8 · C1 · A8 (staging, apoi producție cu confirmare, împreună cu D5 și C1) · A9 (blocat pe decizia ta).
A5 vine înaintea lui B2, fiindcă ambele modifică `raspuns.ts`.

**Valul 2 — robustețea comună (≈ 3 sesiuni).**
B1, B9, B2, B3, B4, B5, B6, B7, B8 · E1, E2, E4, E5, E6 (infrastructura pe care sunt scrise H și I) · deploy cu confirmare.

**Valul 3 — uneltele aduse la rangul cel mai bun (≈ 11–13 sesiuni).**
C2–C11, apoi D6′ · E3, E7–E14 · F1–F15 (F3 după B2) · G1–G9 · H1–H8 · I1–I10.
Pe fișierele comune (`pdf.ts`, `document-tabelar.ts`, `docx.ts`) ordinea e fixă: E4–E6 → G1–G4 → H1–H5 → I3–I5. Deploy-ul se face per unealtă, cu confirmare; F12 și F14 merg în același deploy.

**Valul 4 — unelte noi, SEO, măsurare, distribuție (≈ 5–6 sesiuni).**
K1–K4, K6–K13 · J1, J2, J3 și J4 (doar dacă accepți numărarea pe server), J5–J7, J8 · apoi K5 (indexare) și K14 (distribuție).
J1, J6 și J7 nu depind de nimic. Se pot muta în valul 2, ca să existe o linie de bază din Umami înaintea îmbunătățirilor.

**Total:** ~22–26 sesiuni de lucru, fără timpul de răspuns al contabilului și al juristului.

## Global Constraints

- Româna, cu ș/ț cu virgulă (U+0219/U+021B), în text, comentarii și identificatori de domeniu. Mesajele de eroare se termină cu punct.
- Titlul paginii (`metadatePagina({ titlu })`) are cel mult 48 de caractere. O pagină publică nouă primește, în același commit: `metadatePagina`, o intrare în `src/content/landing/harta.ts`, una în `src/app/llms.txt/route.ts`, un rând în hub-ul `/unelte` și `lastmod`.
- Uneltele publice nu citesc și nu scriu baza de date și nu cer sesiune.
- Nicio cifră legală sau fiscală fără temei (articol + act), verificat pe forma consolidată de pe legislatie.just.ro descărcată cu `curl`. Ce rămâne de confirmat stă cu ⚠ în `NOTES.md`.
- Lanțul fiecărui task: `pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs`, plus `prettier --check` pe fișierele atinse. **Fără `pnpm build`.**
- Migrări: numărul se ia la execuție (`ls supabase/migrations | tail`). Pe 9 oct, 0184 și 0185 sunt deja ocupate, iar planul de mentenanță își rezervase și el 0184–0186, deci „0187” din D2 se poate muta. Aplicarea se face prin `psql`, byte-exact, după `banc-migrare.sh`. Producția cere confirmarea explicită a utilizatorului.
- Git: `git status --short -- <căi>`, `git fetch origin main`, `git commit --only -- <căi>`, `git merge origin/main`, `git push origin main`. Niciodată `-A`, rebase sau ramură nouă.
- Deploy-urile pe producție (`./administrativo.sh`) cer „da”-ul explicit al utilizatorului de fiecare dată. Un „da” anterior nu acoperă deploy-ul următor.
- Directorul ăsta e exclus din prettier (`.prettierignore`). Blocurile „vechi” sunt ancore exacte, iar prettier rescrie codul din blocurile markdown.

## Review Focus (transversal)

Riscurile care traversează secțiunile. Fiecare e prins de testul numit:

1. **Un nume de angajat ajunge la un terț pe o cale nouă**, de exemplu printr-un buton `formAction`, o redirecționare 303 sau un câmp adăugat în valul 3. Testul: poarta live `scripts/checks/unelte-fara-scurgeri.mjs` (A1), rulată din nou în fiecare task de deploy (A8, E13, F15, G9, H8, I10, J8), plus testul din A2 care citește numele câmpurilor din toate paginile.
2. **Calculatorul și motorul diverg din nou.** Testul: `src/lib/unelte/salariu.paritate.test.ts` (D6′), pe aceeași lună de o zi. Calculatorul nu trimite `lunaVenituri` motorului, ca suma să nu se scadă de două ori.
3. **Sărbătorile din TypeScript și seed-ul SQL `public_holidays` se despart.** Testul: `sarbatori.paritate-sql.test.ts` (B9), pe 2024–2040.
4. **O unealtă mutată pe rută statică își pierde cache-ul privat sau curățarea textului.** Testul: cel de cache din A5, mutat de I7 pe fișa SSM, plus poarta lui J3 pe rutele noi.
5. **Documentul de semnat se întinde pe mai multe pagini la tipărirea din browser.** Testul: sonda `page.pdf` din B6, cu număr de pagini fix, rulată din nou la E13, F14, G7, H7 și I9.

## Decizii care sunt ale tale

Planul se oprește la fiecare dintre ele. Restul deciziilor sunt luate și argumentate în secțiunea „Decizii luate” din fiecare fișier.

1. **Salarizarea (D), cu firmele reale:**
   - Aplic migrarea din D2 pe producție?
   - Facem deploy cu motorul reparat înainte ca `wise` să calculeze octombrie?
   - Îi spunem lui `wise` să aștepte?
   - Dacă D1 găsește state deja calculate greșit: recalculare cu D112 rectificativă, regularizare în luna curentă, sau notificare?
2. **Rotunjirea în virgulă mobilă din motor** (`calc.ts:367-377`, CAS/CASS cu 1 leu mai mic) și ⚠-urile contabilului din `NOTES.md` §3: le aplicăm doar de acum înainte, sau recalculăm și lunile închise?
3. **Datele scurse înainte de reparație (A9), ștergere ireversibilă:**
   - jurnalul `administrativo.log`;
   - jurnalul docker al nginx-ului comun celor ~10 site-uri: îl trunchiem, recreăm containerul sau îl lăsăm;
   - query-urile din Umami;
   - cererea de ștergere în GA4, pe care o poți face doar tu.

   Și ce termen de păstrare declarăm pentru jurnalul de acces?
4. **Numărarea descărcărilor pe server (J3, J4)**, anonimă și inclusiv pentru cine blochează măsurarea: e acceptată? Schimbă poziția scrisă azi în `deploy/umami/docker-stack.yml`.
5. **Publicăm înainte de confirmarea juristului?** Pe rând:
   - cererea de concediu după calendarul altor culte (F);
   - rezumatul concedierii pentru necorespundere profesională (I);
   - cererea de demisie cu preavizul calculat prin analogie cu RIL 8/2024 (K8).
6. **Contabilul:** la foaia de parcurs, „categoria vehiculului” înseamnă categoria omologată (M1/N1) sau categoria de utilizare (G)?
7. **Deploy-urile:** o confirmare per val, iar în valul 3 per unealtă (propunerea), sau per task?
8. **Distribuția (K5, K14):**
   - Cine trimite mesajele de outreach, care pleacă în numele firmei și nu se mai pot retrage?
   - Pașii din Search Console, Bing și Brave îi faci tu, sau dai contului robot drept de proprietar?

## Ce nu acoperă planul, spus pe față

- **CSS-ul de 131 KB, triplat în HTML** (`experimental.inlineCss`, `next.config.ts`): măsurarea cere `pnpm build`, care nu se rulează din sesiune. gtag și bara de consimțământ se repară doar pe `/unelte*` (K12, K13).
- **URL-urile peste ~12 KB dau 520 de la Cloudflare.** Calea omului e închisă prin `maxLength` pe câmpuri, dar o adresă scrisă de mână primește tot 520, fără mesaj.
- **Formatele necunoscute pe API dau tot 200 cu PDF.** E o decizie deliberată (B, „API tolerant, pagina avertizează”). Excepția e H5: xlsx pe fișa SSM dă 400.
- **Pe staging**, redirectul 301 de pe :80 se scrie în jurnal cu query. Iar filtrele din aplicația logată (`?q=`) ajung în jurnalul nginx ca orice query. Ambele sunt în afara uneltelor publice.
- **Trei mecanisme opt-in pentru părțile de după tabel** (`tabeleSuplimentare`, `sectiuni`, `rubrici`, din G1, H1 și I3) rămân separate. E datorie, de trecut în `PROGRESS.md` la execuție.
