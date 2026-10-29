---
tip: modul
titlu: Pontaj — planul săptămânii
aliases: [pontaj-saptamana, plan-saptamanal]
cai:
  - "src/app/(app)/pontaj/saptamana/**"
  - "src/app/(portal)/portal/pontajul-meu/saptamana/**"
  - "src/domain/attendance/plan-si-fapt.ts"
tabele:
  [
    attendance_week_submissions,
    attendance_week_submission_days,
    attendance_entries,
    attendance_periods,
    setari_pontare_rapida,
  ]
permisiuni:
  [attendance:read, attendance:create, attendance:approve, attendance:update, departments:update]
feature: attendance
capcane: [17]
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul, hr]
---

# Pontaj — planul săptămânii

`attendance_week_submissions` + `_days`: ce PLANIFICĂ omul, spre deosebire de
`attendance_entries`, care e ce a lucrat — cu excepția variantei `saptamanal`, unde foaia
asta E pontajul (mai jos). Singurul drum de scriere e RPC-ul
`public.trimite_saptamana_pontaj` (șase argumente, `security definer`; corpul curent e în
`0133_saptamana_sare_peste_concediu.sql`), care face `delete` + reinserare completă a
zilelor — de aceea orice câmp golit pe ecran se ȘTERGE din bază la următoarea trimitere,
fără nicio eroare.

Din `0133` întoarce `jsonb` — `{submission_id, zile_sarite}` — nu `uuid`. Schimbarea
tipului de retur a cerut `drop` + `create`, nu `create or replace`; apelantul e unul
singur, `src/app/(app)/pontaj/saptamana/actions.ts`.

Două ecrane randează același `FormularSaptamana`: `/pontaj/saptamana` și
`/portal/pontajul-meu/saptamana`. Al doilea a rămas în urmă cel puțin o dată
(implicitele de weekend), deci orice schimbare se face în AMÂNDOUĂ, iar proprietățile
noi se declară OBLIGATORII, ca să oblige compilatorul — `blocata` și `motivBlocare` din
`ZiFormular`, și `peSaptamana` din `Proprietati`, sunt exact asta, fără implicit.

Orele se derivă pe server, din interval și setări, nu se cred de la client. Zilele cu
interval inversat nu mai ies una pe rând: `enumerare` le strânge pe TOATE într-un singur
refuz, cu data în formatul românesc (`formatDate`) — HR-015, fiindcă a doua zi greșită
apărea abia după ce o reparai pe prima.

| Pagina                              | Ce ține                                                                |
| ----------------------------------- | ---------------------------------------------------------------------- |
| [[modul/pontaj/saptamana/antet]]    | butonul de setări din antet și cele două porți ale lui                 |
| [[modul/pontaj/saptamana/concediu]] | plan/fapt la citire, ziua de concediu sărită de RPC, blocarea pe ecran |

## Pe `saptamanal` foaia nu mai e un plan, ci fișa de pontaj

Varianta firmei — [[modul/pontaj/varianta]] — ajunge la ecran ca un singur boolean,
`peSaptamana`, calculat din `configPontareRapida(setariPontareRapida(...))` în amândouă
paginile și în `trimiteSaptamanaPontaj`. Schimbă CUVINTELE, nu comportamentul: `TEXTE_PLAN`
și `TEXTE_PONTAJ` din `formular-saptamana.tsx` (al doilea e `satisfies Record<keyof typeof
TEXTE_PLAN, string>`, deci un text uitat nu compilează), titlul din `AntetPagina`,
mesajele de `AccesRestrictionat`, eticheta butonului de salvare. `metadata.title` rămâne
static „Planul săptămânii" în amândouă paginile — fila browserului minte pe `saptamanal`.

Schimbă și SĂPTĂMÂNA pe care se deschide ecranul, prin `src/domain/attendance/saptamana.ts`:
`saptamanaImplicita(peSaptamana, azi)` dă lunea viitoare pentru plan și lunea curentă
pentru fișă — cine o deschide vineri vrea săptămâna de acum. `existaSaptamanaUrmatoare`
ascunde linkul „Săptămâna următoare" pe `saptamanal`, iar `inViitor` (`saptamanaStart >
lunieaSaptamanii(azi)`) stinge butoanele formularului. Perechea de server e un
`businessRule` în `trimiteSaptamanaPontaj`, ÎNAINTEA RPC-ului: fără ea, o săptămână
neîncepută trimisă într-o firmă fără aprobare ar fi scris pe loc ore pentru zile
nelucrate.

## Linkurile se decid pe SERVER, nu în formular

Blocarea zilei de concediu stă în formular — [[modul/pontaj/saptamana/concediu]] —, dar
motivul ei numea concediul fără drum spre el. Acum ziua blocată duce la cererea ei
(`/concedii/<leave_request_id>`, din zilele pontate ale săptămânii), avertismentul zilelor
sărite capătă „Vezi cererile" pe fișa PROPRIE, lista de angajați capătă „Fișa angajatului
ales" (`hrefFisa`), iar trimiterea reușită scoate un toast cu „Vezi foaia lunii", care nu
se stinge singur fiindcă are acțiune.

Niciun link nu se desenează pe baza unei permisiuni citite în componentă: toate vin ca
proprietăți calculate pe server cu `poateDeschide` (`src/config/porti-ruta.ts`) peste
`getEnabledFeatures` + harta de permisiuni, iar `FormularSaptamana` cade pe text simplu
când primește `null` sau harta goală. Poarta uitată pierde linkul TĂCUT — alegerea e
deliberată, alternativa fiind un link care duce în refuz. Portalul își pune singur
firimitura și linkul de întoarcere, amândouă doar cu `attendance:read`, fiindcă el nu
trece prin `fileDePontaj`.

## Săptămâna devine pontaj — la aprobare, sau pe loc la trimitere

Intrarea unică e `scrieSaptamanaInPontaj` (`scrie-pontajul.ts`): citește submisia, apoi
setările de la data SĂPTĂMÂNII (`attendance_settings` are istoric pe `valabil_de_la`) și
calendarul firmei prin `zileNelucratoare(org, an, an + 1)` — anul următor fiindcă o
săptămână poate trece în el. `scriePontajulSaptamanii` a rămas nucleul, iar
`OptiuniScriere` strânge cele trei decizii ale apelantului: `aprobare` (cine și când, sau
`null`), `rescrie` și `requestId`. Eticheta `saptamana` din `public.attendance_entry_source`
e tot ce a adus `0138_saptamana_devine_pontaj.sql`; scrierea e cod.

Doi apelanți. `decideSaptamanaPontaj`, **numai** pe ramura `aprobata`, ca o respingere să
nu lase ore în salarizare. Și `trimiteSaptamanaPontaj`, când submisia iese din RPC deja
`aprobata`: triggerul din `0118` o închide singur dacă firma nu cere aprobare sau dacă cel
care trimite n-are niciun aprobator deasupra (`pas_fara_destinatar` — patronul). Starea se
CITEȘTE din bază cu clientul admin, nu se ghicește din setări: ea e decizia. Reclamat pe
6 oct 2026 — o săptămână aprobată, cu ore, lipsea din foaia de prezență;
`0167_pontaj_recupereaza_saptamanile_aprobate.sql` a refăcut ce rămăsese, iar plasa din
`0169` prinde ce cade de acum ([[modul/pontaj/varianta]]). `aprobare` rămâne `null` când
nimeni n-a aprobat nimic — zilele intră neaprobate, altfel ar reapărea în „Aprobă în bloc".

NU se calcă nicio zi care are deja rând neșters în `attendance_entries`, oricare i-ar fi
sursa, simetric cu `sincronizeazaZileleDeConcediu` — deci reaprobarea nu rescrie nimic.
EXCEPȚIA e `rescrie`, adevărat în varianta săptămânală: acolo foaia e singura cale de
pontare, deci retrimiterea trebuie să corecteze, iar rândurile `sursa = 'saptamana'` ale
săptămânii se șterg logic întâi; celelalte surse rămân neatinse. Ștergerea și inserarea nu
sunt o tranzacție, deci identificatorii șterși se păstrează și se pun la loc (`deleted_at`
pe `null`) dacă inserarea cade — altfel retrimiterea ar fi golit TĂCUT pontajul
săptămânii, cu eroarea oprită în jurnal. Găsit de revizia adversarială.

Luna `blocata` nu se atinge: triggerul care o apără scutește contextul de serviciu
(`0132:146`), iar clientul de aici e cel admin, deci garda stă în cod — zilele se taie pe
`attendance_periods`, și o săptămână întreagă într-o lună blocată nu atinge deloc pontajul.
Nu devin pontaj nici zilele fără interval complet — o zi goală înseamnă „n-am lucrat", iar
un rând la zero ore e altă afirmație decât un rând lipsă — nici cele pentru care
`oreleZilei` întoarce `null`.

Două capcane tăcute la scriere. Postgres întoarce `time` ca `08:30:00`, iar `minuteDinOra`
cere exact `HH:MM`: fără tăierea din `ora()`, `oreleZilei` dă `null` și un `?? 0` ar scrie
zero ore — s-a și întâmplat pe date reale, cinci zile cu interval corect și zero ore. Iar
`tip_zi` se derivă de APELANT, cu `tipZiAutomat`, fiindcă triggerul BEFORE îl pune doar
când vine `null` — lăsat bazei, totul ar fi intrat `lucratoare`, fără sporul de repaus.

Eșecul e tăcut deliberat: funcția NU aruncă, decizia sau trimiterea fiind deja înregistrată
(tiparul din `decideCerere`); ce n-a mers intră într-un `console.error` cu `requestId`.
Numerele n-ajung oricum nicăieri — acțiunea e tipată `Readonly<{ id: string }>`, deci
`scrise`/`pastrate` trec rețeaua fără să existe pentru TypeScript, iar
`lista-saptamani-de-aprobat.tsx` face doar `router.refresh()`.

Verificarea: `actions.test.ts` (cele două acțiuni, cu refuzul săptămânii în avans și
scrierea pe loc la trimitere) și `scrie-pontajul-varianta.test.ts` (forma interogărilor, pe
clientul fals — fără RLS, fără triggere); poarta pozitivă e
`tests/rls/proba-pontaj-saptamanal.sql`.

Vocabularul s-a pus la punct între timp: `saptamana` e acum și în `SURSE_INTRARE`
(`src/schemas/attendance.ts`) și în `ETICHETE_SURSA` (`src/app/(app)/pontaj/etichete.ts`,
„Din fișa săptămânii"), nu doar în enumul SQL și în `src/types/database.ts`. Oglinda dintre
liste e manuală și se rupe TĂCUT — cât timp a lipsit, un rând scris aici trecea de bază și
cădea la validare în aplicație; regula celor trei locuri e în [[modul/pontaj/actiuni]].
