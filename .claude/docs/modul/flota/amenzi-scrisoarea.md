---
tip: modul
titlu: Flotă — cine conducea, scrisoarea de la art. 39 și recuperarea de la șofer
aliases:
  [
    sofer_la,
    sofer_sugerat,
    art. 39,
    desemnarea șoferului,
    scrisoare de răspuns,
    scrisoare-desemnare,
    recuperare daune,
  ]
cai:
  - "supabase/migrations/0206_flota_amenzi_daune.sql"
  - "src/app/api/export/flota/amenzi/**"
  - "src/lib/pdf/scrisoare-desemnare.ts"
  - "src/domain/fleet/amenzi.ts"
tabele: [vehicle_fines, trip_sheet_curse, vehicle_assignments]
permisiuni: [vehicle_fines:read, vehicle_fines:create, vehicle_incidents:create, employees:read]
feature: fleet
capcane: []
scris_pe: 59875840fcf542f696cecc8982d47c68375f2596
scris_la: 2026-10-23
tags: [modul, operations, legal]
---

# Flotă — cine conducea, scrisoarea de la art. 39 și recuperarea de la șofer

Secțiuni extrase din [[modul/flota/amenzi-si-daune]] (pagina trecuse de plafonul dur al
convenției vault-ului). Temeiurile legale verificate și ce rămâne de confirmat cu juristul
(marcat ⚠️) sunt în `NOTES.md`, secțiunea „Flotă — amenzi și daune”. Pagina de modul e
[[modul/flota]].

## Cine conducea — `app.sofer_la` și `public.sofer_sugerat`

`app.sofer_la(org, vehicul, moment)` e SECURITY DEFINER și **își judecă singură apelantul**
(`vehicle_fines:create` all sau `vehicle_incidents:create` all, sau platforma); ceilalți
primesc zero rânduri. Ordinea: ÎNTÂI linia de foaie (`trip_sheet_curse`) care acoperă
momentul, pe o foaie care nu e respinsă; o linie fără sosire durează până la sfârșitul zilei
foii. APOI alocarea deschisă atunci (`vehicle_assignments`, interval semideschis). Planul
(F2) o pusese în 0173, dar acolo n-a ajuns; se naște în 0206. Prin `.rpc()` se cheamă
învelișul `public.sofer_sugerat`, fiindcă PostgREST nu expune schema `app`.

**E doar sugestie.** Selectorul din caseta de desemnare e precompletat, dar omul alege:
cineva a putut conduce mașina altuia, sau foaia n-a fost completată. Sugestia spune pe ce
se sprijină (foaia sau alocarea).

## Scrisoarea de răspuns (art. 39) — ruta cu CNP

Ruta cere TREI lucruri, în ordine: `vehicle_fines:read` all, `employees:read` all și o
amendă cu șofer desemnat. A doua poartă există fiindcă scrisoarea poartă CNP-ul întreg și îl
citește prin `hr_read_sensitive`, care cere `employees:read = all` EXACT și scrie un rând de
audit la fiecare apel; fără ea, cine vede amenzile dar nu fișele ar primi o scrisoare cu linie
goală la CNP, fără să știe de ce. Testul rutei (`route.test.ts`) probează că la 403 nu se
cheamă nici `hr_read_sensitive`.

Ce lipsește din fișă (CNP, domiciliu/reședință, serie și număr act) NU se inventează:
documentul lasă linie de completat și o spune sus, răspunsul rămâne 200. Conținutul vine din
`modelScrisoareDesemnare` (domeniu, cu teste), așezarea din `scrisoare-desemnare.ts`.
Ruta nu marchează amenda „răspuns trimis”: asta o face omul, după ce a semnat și a trimis
scrisoarea (`trimiteRaspuns`).

## Recuperarea de la șofer NU e automată

Pagina o spune pe ecran (`NOTA_RECUPERARE`, în domeniu): reținerea din salariu „cu titlu de
daune” cere o datorie scadentă, lichidă și exigibilă, constatată printr-o hotărâre
judecătorească definitivă și irevocabilă (Codul muncii art. 169 alin. (2)); recuperarea prin
acordul părților urmează art. 254 (notă de constatare și evaluare, termen de cel puțin 30 de
zile, plafon de 5 salarii minime brute). Aplicația nu calculează plafonul, nu ține nota și nu
scrie nimic pe statul de plată. Vezi `NOTES.md` pentru articolele verificate.
