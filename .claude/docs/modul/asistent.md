---
tip: modul
titlu: Asistent AI
aliases: [asistent, chat, bula]
cai:
  - "src/lib/asistent/**"
  - "src/components/asistent/**"
  - "src/app/api/asistent/route.ts"
  - "src/schemas/asistent.ts"
tabele: [features, organization_features]
permisiuni: [leave:read, employees:read]
feature: asistent
capcane: []
citeste_daca:
  - "bula nu apare nicăieri → verifică ÎNTÂI cele două comutatoare, secțiunea „Ce refuză baza tăcut”"
  - "o pastilă duce în 404 → imposibil prin construcție; citește „Lista închisă”"
scris_pe: 719e27247b2dd149e7fac3e45c3116e95b4eeddd
scris_la: 2026-08-31
tags: [modul, nucleu]
---

# Asistent AI

Bulă flotantă în dreapta-jos, în ambele zone. Răspunde la „unde se face X?”, explică
drumul de click și dă butonul care duce acolo dintr-un singur clic. Pentru trei clase de
întrebări citește și date reale, sub RLS-ul celui care întreabă.

**Read-only, prin proiectare.** Nu depune cereri, nu aprobă, nu șterge. Explică și
trimite; omul apasă. Asta scoate din discuție toată clasa de defecte „modelul a apăsat
butonul greșit”, și e motivul pentru care modulul n-are nicio Server Action.

## Lista închisă — de ce nu poate trimite într-un 404

Miezul arhitecturii, și singurul lucru din pagina asta care nu se deduce din cod la o
citire rapidă.

Modelul **nu are voie să scrie o adresă**. Nu primește niciun href în prompt
(`prompt.test.ts` verifică exact asta). Primește o listă de identificatori și poate doar
să aleagă unul, scriindu-l ca marcaj — forma exactă e în `src/lib/asistent/marcaje.ts`.
Href-ul, eticheta, iconița și drumul de click le desenează aplicația, din `NAV_ITEMS`.

Un identificator inventat nu produce un link greșit: `marcaje.ts` nu-l găsește în index și
**aruncă marcajul tăcut**. Cel mai rău rezultat posibil al unei halucinații e o frază fără
pastilă lângă ea. Regexul de marcaj e permisiv la potrivire tocmai ca un identificator
scris greșit — majuscule, gol — să fie tot înghițit, nu randat ca text brut sub ochii
omului.

`destinatii.ts` ține indexul, scris de mână fiindcă `descriere` — „ce faci pe ecranul
ăsta” — nu se poate genera. Împotriva îmbătrânirii tăcute stă `destinatii.test.ts`:
parcurge arborele de rute de pe disc și cere ca fiecare rută statică să fie ori în index,
ori în `EXCLUSE` cu motiv scris.

## Rute și cine ajunge

Modulul n-are pagini proprii. Are o singură rută de API și două puncte de montare.

| Rută            | Poartă                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------- |
| `/api/asistent` | cheie de mediu → `resolveTenant` → modul `asistent` → limite de rată → Zod → hartă de permisiuni |

Ordinea nu e negociabilă și e comentată în `src/app/api/asistent/route.ts`: cheia lipsă
răspunde **404 înaintea autentificării** (o rută oprită nu-și anunță existența), iar
limitele vin înaintea oricărui apel extern, altfel exact abuzul pe care ar trebui să-l
oprească e cel care costă bani.

Zona nu se ia pe cuvânt de la client: rolul `employee` e forțat pe `portal`, restul pe
`app`. Poarta din layout-uri, repetată — fiindcă layout-ul nu e o barieră de securitate.

## Filtrarea pe permisiuni

`filtreaza.ts` taie din index tot ce omul nu poate deschide, cu **aceeași** `meetsScope`
pe care o cheamă `buildNavigation()`. Nu e o copie a regulii: e regula. O a doua
implementare ar fi divergat de meniu la prima ajustare de prag, iar asistentul ar fi
început să ofere exact ce sidebar-ul ascunde.

Ascunderea de aici nu e barieră de securitate — pagina verifică din nou, RLS respinge
rândul oricum. E o barieră de **utilitate** (nu trimite pe cineva într-un ecran de refuz)
și de **discreție** (enumerarea rutelor e o hartă a firmei).

## Uneltele de date

Trei, în `src/lib/asistent/unelte/`. Fiecare declară modul, permisiune și prag, verificate
de `poarta.ts` **înainte** de execuție — de două ori: o dată ca să decidă despre ce unelte
află modelul, a doua oară imediat înainte de a rula. Prima e igienă de context, a doua e
bariera; fără ea, autorizarea ar depinde de bunele intenții ale modelului.

Toate citesc prin clientul de sesiune, cu RLS activ. `tip.ts` impune structural trei
lucruri: organizația vine din context și nu din parametrii modelului; poarta precedă
execuția; iar `executa` întoarce **text, nu rânduri** — deci CNP-ul și IBAN-ul n-au drum
către contextul modelului, nu doar n-au intenție să ajungă acolo.

`cauta_om` întoarce și destinații **efemere** (`fisa.<uuid>`), valabile doar în răspunsul
curent. Mulțimea rămâne închisă, doar că e închisă prin proveniență: acolo ajung numai
fișele întoarse de o citire pe care omul chiar avea dreptul să o facă.

## Citiri

Niciuna nouă. Uneltele se sprijină exclusiv pe funcții existente din
`src/lib/queries/portal.ts`, `src/lib/queries/panou.ts` și `src/lib/queries/employees.ts`.
Un modul care nu adaugă interogări nu adaugă nici locuri noi în care izolarea între firme
să poată fi greșită.

## Ce refuză baza tăcut

- **Două comutatoare independente, ambele tăcute.** Modulul `asistent` stins pentru firmă
  ⇒ ruta răspunde 404 și bula nu se randează în niciun layout. `OPENROUTER_API_KEY` goală
  ⇒ același 404, indiferent ce scrie în `organization_features`. Când bula lipsește,
  ăsta e primul lucru de verificat, nu codul.
- **`Contor = number | null` din `panou.ts` NU se turtește.** `0` înseamnă „coada se arată
  și e goală”; `null` înseamnă „coada nu se arată”, fiindcă modulul e stins sau rolul n-are
  permisiunea. Confundate, asistentul ar răspunde liniștitor „nu ai nimic de aprobat”
  cuiva care de fapt nu poate vedea coada. `de-aprobat.ts` raportează doar cozile cu cifră.
- **Cont fără fișă de angajat.** Un `org_admin` pur nu are sold de concediu. Uneltele
  marcate `cereFisaProprie` refuză cu un motiv scris, nu cu zero rânduri.
- **Rol fără nicio unealtă permisă.** Secțiunea „UNELTE” lipsește cu totul din prompt: o
  listă de unelte inaccesibile e tot o hartă a aplicației.

## Ce se mișcă împreună

- **`NAV_ITEMS` și `PORTAL_NAV_ITEMS`** — drumul de click se calculează din ele. O intrare
  mutată dintr-un grup în altul schimbă automat ce spune asistentul; una **ștearsă** lasă
  destinația fără părinte, iar `destinatii.test.ts` pică.
- **Arborele de rute** — o pagină nouă în `src/app/(app)/` sau `src/app/(portal)/` pică
  același test până e adăugată în index sau exclusă cu motiv.
- **`FEATURE_KEYS`** — cheia `asistent` e și în catalogul din bază. Landing-ul
  (`src/content/landing/ro.ts`) enumeră fiecare cheie, iar
  `src/content/landing/continut.test.ts` o cere.
- **`ZonaToast`** — banda de notificări urcă peste bulă. Ambele stau pe `z-plutitor`, în
  același colț; fără decalaj, un toast apare sub butonul rotund și nu se mai poate închide.

## Ce NU e aici

- Nicio migrare de structură. `0117_modul_asistent.sql` seamănă un rând de catalog, atât.
- Nicio Server Action, nicio scriere, niciun audit propriu.
- Niciun embedding și niciun depozit vectorial: corpusul intră întreg în prompt.
- Niciun SDK de LLM și nicio librărie de markdown — vezi docblock-urile din
  `src/lib/asistent/openrouter.ts` și `src/lib/asistent/text.ts` pentru de ce.
- Nicio persistență a conversației. Trăiește în memoria filei; layout-ul `(app)` nu se
  re-randează la navigare, deci supraviețuiește saltului dintr-o pagină în alta.

## Când NU e suficientă pagina asta

- Se adaugă o unealtă care atinge date sensibile → citește și `[[modul/angajati]]`.
- Fluxul sosește dintr-o bucată în producție, nu în cadre → antetul `x-accel-buffering`
  nu a trecut de proxy; e o problemă de infrastructură, nu de cod.
