---
tip: modul
titlu: Asistent AI — uneltele de date și filtrarea pe permisiuni
aliases: [unelte asistent, filtreaza, poarta unealta, ContextUnealta]
cai:
  - "src/lib/asistent/unelte/**"
  - "src/lib/asistent/filtreaza.ts"
  - "src/lib/queries/flota-asistent.ts"
tabele: []
permisiuni: [attendance:update, departments:update]
feature: asistent
capcane: []
citeste_daca:
  - "asistentul oferă un ecran care apoi refuză accesul → „Filtrarea pe permisiuni”"
  - "o unealtă nu apare deloc în prompt → poarta dublă din „Uneltele de date”"
scris_pe: 773c1627da87c388355631aa7419448022014599
scris_la: 2026-10-27
tags: [modul, nucleu]
---

# Asistent AI — uneltele de date și filtrarea pe permisiuni

Secțiune extrasă din [[modul/asistent]]: cum se taie indexul de destinații pe
permisiunile celui care întreabă, uneltele care citesc date reale și citirile pe care se
sprijină. Lista închisă, poarta rutei de API și comutatoarele tăcute rămân pe pagina mamă.

## Filtrarea pe permisiuni

`filtreaza.ts` taie din index tot ce omul nu poate deschide, cu **aceeași** `meetsScope`
pe care o cheamă `buildNavigation()`. Nu e o copie a regulii: e regula — o a doua
implementare ar fi divergat de meniu și ar fi oferit exact ce sidebar-ul ascunde.

Ascunderea nu e barieră de securitate — pagina verifică din nou, RLS respinge rândul
oricum. E barieră de **utilitate** (nu trimite într-un ecran de refuz) și de **discreție**
(enumerarea rutelor e o hartă a firmei).

`permission`-ul unei intrări e al **ecranului**, nu al modulului sub care stă în meniu.
Când pagina arată un secret, poarta e a secretului: `pontaj.setari.coduri-qr` are filele
vecine pe `attendance:update`, dar cere `departments:update` — cine vede codul QR poate
ponta de oriunde. Se ia poarta reală a rutei, iar la îndoială cea strictă.

`featureKey`-ul se ia la fel, de la ecran: `evaluari.kpi` stă sub „Evaluări” în meniu, dar
pagina cere `requireFeature(…, "kpi")` — KPI e modul propriu, vândut separat.

## Uneltele de date

În `src/lib/asistent/unelte/`. Fiecare declară modul, permisiune și prag, verificate
de `poarta.ts` **înainte** de execuție — de două ori: o dată ca să decidă despre ce unelte
află modelul, a doua oară imediat înainte de a rula. Prima e igienă de context, a doua e
bariera; fără ea, autorizarea ar depinde de bunele intenții ale modelului.

Toate citesc prin clientul de sesiune, cu RLS activ. `tip.ts` impune structural trei
lucruri: organizația vine din context și nu din parametrii modelului; poarta precedă
execuția; iar `executa` întoarce **text, nu rânduri** — deci CNP-ul și IBAN-ul n-au drum
către contextul modelului, nu doar n-au intenție să ajungă acolo.

Uneltele de flotă (F12e), cu a doua cheie obligatorie (`permisiuniSuplimentare`, verificată
tot de `poarta.ts`) și precedența „cine are mașina”: `[[modul/asistent/unelte-flota]]`.

`ContextUnealta` poartă două identități distincte: `userId` — contul — și `employeeId`,
fișa lui de angajat, care poate lipsi. Ce e „al meu” se calculează din cont:
`contoarePanou` cere `userId` ca să scoată din coada de concedii cererea proprie a celui
care aprobă, și `role` fiindcă pașii de integrare se atribuie și pe rol, nu doar pe fișă.

`cauta_om` întoarce și destinații **efemere** (`fisa.<uuid>`), valabile doar în răspunsul
curent; uneltele de flotă, `vehicul.`, `foaie.` și `propune.foaie.`, cu href-ul ales după
`ContextUnealta.zona` (o foaie se deschide altfel în aplicație și în portal). Mulțimea rămâne închisă, doar că e închisă prin proveniență: acolo ajung numai
fișele întoarse de o citire pe care omul chiar avea dreptul să o facă.

## Citiri

Uneltele de personal se sprijină exclusiv pe funcții existente din
`src/lib/queries/portal.ts`, `src/lib/queries/panou.ts` și `src/lib/queries/employees.ts`.
Flota are un fișier propriu, `src/lib/queries/flota-asistent.ts`, cu filtru explicit pe firmă
în fiecare citire; ce vede fiecare rol din el numără `tests/rls/proba-asistent-flota.sql`.
