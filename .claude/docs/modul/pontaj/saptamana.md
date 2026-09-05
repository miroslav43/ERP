---
tip: modul
titlu: Pontaj — planul săptămânii
aliases: [pontaj-saptamana, plan-saptamanal]
cai:
  - "src/app/(app)/pontaj/saptamana/**"
  - "src/app/(portal)/portal/pontajul-meu/saptamana/**"
  - "src/domain/attendance/plan-si-fapt.ts"
tabele: [attendance_week_submissions, attendance_week_submission_days, attendance_entries]
permisiuni: [attendance:create, attendance:approve]
feature: attendance
capcane: [17]
scris_pe: b32cfef59471a67b3a39ff3e5d3108cf04c7366c
scris_la: 2026-09-05
tags: [modul, hr]
---

# Pontaj — planul săptămânii

`attendance_week_submissions` + `_days`: ce PLANIFICĂ omul, spre deosebire de
`attendance_entries`, care e ce a lucrat. Singurul drum de scriere e RPC-ul
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
noi se declară OBLIGATORII, ca să oblige compilatorul.

## Planul se leagă de fapt la CITIRE, niciodată printr-o a doua scriere

`src/domain/attendance/plan-si-fapt.ts` (pur, cu teste) — `ziuaInitialaPlan(data,
planificata, pontata)`. Îl folosesc AMÂNDOUĂ ecranele planului: `/pontaj/saptamana` și
`/portal/pontajul-meu/saptamana`.

O scriere ar fi modificat, după fapt, planul unei săptămâni deja trimise sau aprobate —
adică ar fi rescris ce a decis cineva, fără urmă.

Precedența e pe **CÂMP, nu pe rând**, și ăsta e cazul purtător al modulului: o zi deschisă
cu „Am intrat" și neînchisă are `ora_sfarsit` null. Copiată peste plan, ar fi golit
intervalul planificat — iar `trimite_saptamana_pontaj` face `delete` + reinserare (0084),
deci următoarea trimitere l-ar fi șters și din bază, fără nicio eroare. Observația NU se
preia deloc: nota zilei lucrate și nota intenției sunt două texte diferite.

Citirea e `intrariLuna(org, [fisa], …)`, **nu** `intrariProprii` — a doua nu filtrează pe
`employee_id` și se bazează pe RLS, care pentru scope `all` nu îngustează nimic.

## Ziua cu concediu aprobat nu se planifică — se SARE peste ea

Pontajul se scrie pe două drumuri, iar garda de concediu stătea doar pe unul:
`salveazaZiPontaj` refuza ziua din `0013` încoace, `trimite_saptamana_pontaj` verifica
luna deschisă, ziua de luni, modulul activ și angajatul din organizație, dar nu și dacă
ziua e deja concediu. `0133` o pune și pe drumul săptămânii.

Nu refuză săptămâna întreagă — ar fi cerut omului să ghicească ziua care deranjează:
zilele cu concediu se omit din reinserare, restul se salvează, iar funcția întoarce
datele omise în `zile_sarite`. Dovada e `attendance_entries` cu `leave_request_id`
completat, **nu** `leave_requests`: aceeași coloană pe care o citește garda din
`salveazaZiPontaj`, deci două verificări pe aceeași dovadă, nu pe două surse care pot
diverge.

**Omisiunea e tăcută în bază** — ziua pur și simplu nu apare în
`attendance_week_submission_days`, fără nicio eroare. Vizibilă o face doar lanțul de
deasupra: `zileSarite` din `RezultatCuAvertismente`
(`src/app/(app)/pontaj/avertismente.ts`) și rândul `role="alert"` din
`FormularSaptamana`. Rupt oriunde pe drum, omul crede că a planificat cinci zile când în
plan sunt trei și află abia la aprobare. Rândul stă în formularul PARTAJAT, deci ajunge
pe amândouă ecranele fără nimic de duplicat.

Citirea rezultatului în acțiune e defensivă deliberat: RPC-ul e tipat `Json`, iar o formă
neașteptată n-are voie să arunce peste un plan care S-A SALVAT deja — de aceea `id` cade
pe șirul gol, nu pe excepție. `conflictSuspendare` și `avertismentReluare` rămân `null`:
planul e în viitor, iar suspendarea pentru absențe se constată din pontajul realizat.

Poarta pozitivă e `tests/rls/proba-saptamana-concediu.sql`, pe bancul local: nu că ziua
de concediu e blocată, ci că restul săptămânii chiar se salvează, că ziua sărită e
raportată, că rândul de concediu din pontaj rămâne neatins și că o săptămână fără
concediu nu raportează nimic.

Ce rămâne descoperit: o cerere aprobată a cărei sincronizare cu pontajul a căzut n-are
rând în `attendance_entries`, deci n-o vede nici garda asta, nici cea de zi. Recuperarea
e `sincronizeazaConcediile` — vezi [[modul/concedii]].
