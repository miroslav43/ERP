---
tip: modul
titlu: Cursuri — biblioteca de materiale
cai:
  - "src/app/(app)/cursuri/biblioteca/**"
  - "src/app/(app)/cursuri/actions.ts"
  - "src/lib/queries/cursuri.ts"
  - "src/lib/media/cale.ts"
  - "src/lib/storage/semnatura.ts"
  - "src/lib/storage/primii-octeti.ts"
  - "src/lib/storage/urca-semnat.ts"
  - "src/lib/documents/cale.ts"
  - "supabase/migrations/0077_cursuri_test_grila.sql"
tabele: [courses, course_materials, course_material_versions, course_items, course_answer_keys]
permisiuni: [courses:read, courses:create, courses:update]
capcane: [17, 53]
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul, hr]
---

# Cursuri — biblioteca de materiale

Secțiune extrasă din [[modul/cursuri]]: cum urcă octeții unui material, asistentul de
material nou, unde stă cheia de răspuns a testului și ce folosește un material.

## Octeții fișierelor nu trec prin server

`pregatesteIncarcareMaterial` întoarce `{ cale, urlSemnat }` — adresa semnată întreagă
(`data.signedUrl`), nu jetonul din ea —, iar octeții urcă direct în `BUCKET_CURSURI` cu un
`PUT` binar prin `urcaPeUrlSemnat` (`src/lib/storage/urca-semnat.ts`), nu prin
`uploadToSignedUrl` din SDK: tokenul din adresă E autorizația, verificată la semnare sub
sesiunea apelantului, deci `incarcare-versiune.tsx` și `asistent-material.tsx` nu mai țin
un client Supabase în browser. Funcția întoarce `boolean` — rețea căzută, CORS sau filă
închisă înseamnă același lucru pentru ecran.

Nici MIME-ul declarat de browser, nici `fel`-ul din formular nu sunt crezute la salvare:
`salveazaVersiuneFisier` ia `fel` din RÂNDUL materialului și îl trece prin
`verificaMaterial` (`src/lib/media/cale.ts`) înainte de a atinge obiectul, abia apoi
verifică primii octeți urcați cu `potrivesteSemnatura`. Pregătirea validase plafoanele pe
`fel`-ul venit de la client, iar materialul se putea schimba între timp — altfel un film
devenea versiunea curentă a unui material „document". Ce nu trece se șterge din bucket
prin clientul admin, ca să nu rămână obiect orfan. — `actions-versiuni.test.ts`

Căile venite de la client (`salveazaVersiuneFisier`, inclusiv `subtitrare_cale`, și
`renuntaLaIncarcare`) trec prin `caleInPrefix` (`src/lib/documents/cale.ts`), nu prin
`startsWith`: peste prefixul organizației și al materialului se cer segmente curate — cad
segmentul gol, `.`, `..`, formele lor procent-codificate, `\` și caracterele de control,
fiindcă o cale se normalizează abia la `fetch`, adică după ce a fost deja scrisă în rând.

## Verificarea de conținut nu mai e a cursurilor

Semnăturile de început de fișier au plecat în `src/lib/storage/semnatura.ts`, de unde le
folosește orice ecran de încărcare din aplicație. Modulul e **pur**, fără `server-only`,
ca să-l poată importa și componentele client pentru pre-controlul de curtoazie; cititorul
de octeți din obiectul deja urcat stă separat, în `src/lib/storage/primii-octeti.ts`, care
E `server-only` — altfel un import din client ar cădea abia la build și la
`pnpm check:server` (capcana #53). `src/lib/media/cale.ts` re-exportă `potrivesteSemnatura`
pentru apelanții de aici: nu se putea extinde pe loc, fiindcă el importă `slugFisier` din
`src/lib/documents/cale.ts`, iar dosarul ar fi importat invers.

`salveazaVersiuneFisier` cheamă deci `citestePrimiiOcteti(ctx.supabase, …)` — cu clientul
apelantului, nu cu service_role: dacă RLS-ul de pe obiect nu-i dă dreptul să citească
înapoi ce a urcat, funcția întoarce `null`, adică refuz la salvare. Textul refuzului vine
tot din `semnatura.ts`, `MESAJ_CONTINUT_NEPOTRIVIT`, ca ecranul să nu-și scrie propria
formulare.

Refuzul pe TIP are la fel un singur text, `MESAJ_TIP_RESPINS` (`src/lib/media/cale.ts`),
pe care îl dau și `verificaMaterial`, și câmpul `IncarcareFisier` prin `mesajTipRespins`.
Fără mesajul acela pe câmp, `motivRespingerii` nu verifică tipul deloc, doar mărimea.

## „Folosit în" se citește din `course_items`

`cursuriCuMaterialul` (`src/lib/queries/cursuri.ts`) dă cursurile care au o lecție pe
material, ca o versiune nouă sau o schimbare de treaptă de dovadă să știe pe cine
afectează. Embed-ul e `courses!inner`, dar cursurile șterse se taie în JS: `deleted_at` de
pe tabela încorporată nu intră în `.is()` de pe cererea de bază, iar `course_items`
poate avea mai multe lecții pe același curs, deci rândurile se și dedublează după
`courses.id`.

## Ce refuză baza

Punerea conținutului într-un material e un PROCES, nu un câmp: rândul, apoi semnarea
încărcării, apoi octeții, apoi semnătura de fișier. Ordinea nu e negociabilă — calea din
Storage conține `material_id` —, deci regulile de aici sunt despre ce rămâne în urmă când
un pas de la mijloc cade.

- **Mutarea materialului pe versiunea nouă e un UPDATE separat, cu altă permisiune.**
  Inserția versiunii cere `courses:create`, dar `versiune_curenta_id` se scrie pe
  `course_materials`, adică sub `courses:update`. Fără `.select()` după, zero rânduri
  treceau drept succes: versiunea rămânea orfană, materialul pe cea veche. Ambele căi —
  fișier și link — raportează acum CONFLICT. — capcana #17, `actions-versiuni.test.ts`
- **Un material rămâne creat chiar dacă conținutul nu intră.** Un rând-ciornă apare în
  bibliotecă cu insigna „Lipsă" și se retrage doar prin `stergeMaterial`, adică sub altă
  permisiune decât cea a asistentului. Rândul se creează deci o singură dată
  (`asiguraMaterialul`), iar a doua apăsare continuă pe el; înainte, fiecare apăsare mai
  crea unul cu același cod și baza răspundea 23505 pe `course_materials_cod_uk`, afișat
  omului drept „codul există deja" — pentru codul pe care tocmai îl dăduse.
  — `asistent-material.test.tsx`
- **Ce se poate verifica local se verifică ÎNAINTEA creării.** `verificaMaterial` pe tipul
  și mărimea `File`-ului ales rulează înainte de `creeazaMaterial`, iar câmpul respinge
  tipul la alegere, nu la salvare: un fișier respins nu lasă în urmă nimic. Callout-ul
  spune ambele stări — ce se va întâmpla, și, după un eșec, că materialul există și se
  continuă pe el. — `asistent-material.test.tsx`
- **Pașii 1–3 se închid odată ce rândul există.** Titlul și codul sunt deja scrise în el, o
  modificare de la pasul 2 n-ar mai ajunge acolo; nici „Înapoi", nici saltul din lista
  pașilor nu mai duc înapoi. — `asistent-material.test.tsx`

## Cheia de răspuns stă în tabelă separată

RLS **n-are granularitate pe coloană**. Dacă răspunsurile corecte ar sta lângă întrebări,
orice angajat care poate citi întrebările — și trebuie să le poată citi — le-ar citi și pe
ele printr-un `select *` prin PostgREST.

Separarea într-o tabelă proprie, fără nicio politică pentru `authenticated`, e singura
barieră reală; altfel testul ar fi decorativ. Cine adaugă un ecran de administrare a
testului trece prin Server Action cu client admin, nu prin clientul utilizatorului.
