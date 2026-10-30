---
tip: modul
titlu: Concedii — configurarea firmei
aliases: [concedii-setari, grile-concediu, drepturi-concediu]
cai:
  - "src/app/(app)/concedii/setari/**"
  - "supabase/migrations/0035_reguli_concediu.sql"
  - "supabase/migrations/0037_fix_grile_pe_tip_reglementat.sql"
  - "supabase/migrations/0193_concediu_proportional_cu_lunile.sql"
tabele:
  [
    leave_types,
    leave_type_variants,
    leave_entitlement_rules,
    leave_balances,
    organizations,
    employees,
    approval_tasks,
  ]
permisiuni: [leave:read, leave:create, leave:update, leave:approve, employees:read]
feature: leave
capcane: [17]
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, hr]
---

# Concedii — configurarea firmei

Ce poate regla o firmă la concedii și ce îi refuză legea. Trei obiecte, cu ritmuri
diferite: **tipurile** (`leave_types`, unele blocate de lege), **grilele** de zile
suplimentare (`leave_entitlement_rules`, criteriu → zile) și **zilele de bază** de
odihnă, care stau pe organizație, nu pe tipul de concediu.

Trunchiul modulului — cererea, aprobarea, soldul — e [[modul/concedii]].

## Ruta și cine ajunge

`/concedii/setari` cere `leave:update` cu scope `all`. În seed-ul din `0002_authz.sql`,
`hr` are `leave` pe `all`, iar `manager` îl are pe `team` cu doar `{read,approve}` — deci
pagina nu e ascunsă de manager, e refuzată prin `AccesRestrictionat`.

Preambulul pornește `requireFeature(..., "leave")`, `getPermissionMap` și
`getEnabledFeatures` împreună, într-un `Promise.all`, nu înlănțuite ca în tiparul canonic:
sunt citiri independente, pe tabele diferite, iar înlănțuirea costa câte un dus-întors în
plus, integral rețea (comentariul de deasupra lor a rămas la „două citiri"). Ordinea
porților rămâne aceeași — `requireFeature` cheamă `notFound()`, iar `Promise.all` respinge
la prima respingere, deci un modul dezactivat dă tot 404 înainte ca harta de permisiuni să
ajungă la `can()`. Tiparul e al întregului modul, nu al acestei pagini ([[modul/concedii]]);
cine îl „repară" înapoi în formă serială reintroduce latența, nu o verificare.

Ecranul are câte o zonă per obiect: `tabel-tipuri-reglementate.tsx` și
`card-tip-adaptabil.tsx` pentru tipuri, `tabel-reguli.tsx` cu `formular-regula-noua.tsx`
pentru grile, `formular-zile-baza.tsx` pentru zilele de bază și
`buton-aplica-drepturi.tsx` pentru recalcul.

## Linkurile se închid pe poarta țintei

- Criteriul „Departament: X" din `tabel-reguli.tsx` devine link spre `/departamente` doar
  dacă `poateDeschide` (`src/config/porti-ruta.ts`) trece pe ruta ȚINTĂ — de aici al
  treilea membru al `Promise.all`-ului: poarta cere și modulele active, nu doar
  permisiunile. Booleanul se calculează pe server, ca `poateDeschideDepartament`.
- Numele din previzualizare trece prin `hrefFisa(angajat, permisiuni)`
  (`src/lib/navigare/fisa.ts`) — de aceea `select`-ul pe `employees` cere și `deleted_at`:
  fără coloana aia în citire, `hrefFisa` presupune rândul nești și ar lega fișa unui
  angajat șters. `LinkEntitate` lasă text simplu când href-ul e `null` (angajat absent din
  hartă, deci ascuns de RLS, sau `employees:read` lipsă).

## Server Actions

`src/app/(app)/concedii/setari/actions.ts` — toate șase pe `minScope: "all"`.

| Funcție                                                                                 | Permisiune     |
| --------------------------------------------------------------------------------------- | -------------- |
| `actualizeazaTipConcediu`, `comutaActivTipConcediu`                                     | `leave:update` |
| `creeazaRegulaConcediu`                                                                 | `leave:create` |
| `dezactiveazaRegulaConcediu`, `seteazaZileConcediuImplicit`, `aplicaDrepturileConcediu` | `leave:update` |

Toate declară aceeași pereche de revalidare, `/concedii/setari` + `/concedii/sold`:
soldul e a doua față a oricărei schimbări de configurare, iar o pagină de setări care nu
mișcă soldul lasă omul să creadă că n-a avut efect. `seteazaZileConcediuImplicit` adaugă
`/setari/organizatie`.

Testul lor rulează pe clientul Supabase fals —
`src/app/(app)/concedii/setari/actions.test.ts`: pragul `all` pe fiecare, categoria
generată din criteriu, și P0001-ul triggerului ajuns `CONFLICT` cu textul lui.

## Ce refuză baza — tăcut și cu voce

- **Tipurile reglementate legal se pot doar activa sau dezactiva.**
  `internal.leave_types_protejeaza_reglementat` (`0035_reguli_concediu.sql`) ridică P0001
  la orice UPDATE care atinge `key`, `zile_implicite`, `scade_din_sold`,
  `necesita_document`, `se_reporteaza`, `termen_reportare`, `plafon_reportare_zile`,
  `mod_rotunjire_acumulare`, `intrerupe_alte_concedii` sau `reglementat` pe un rând cu
  `reglementat = true`. Mesajul vine gata scris în română, cu temeiul legal în el — garda
  nu se repetă în acțiune, se lasă eroarea să treacă prin `traduEroare`.
- **Grila urmează aceeași regulă ca tipul.**
  `0037_fix_grile_pe_tip_reglementat.sql` întinde protecția peste
  `leave_entitlement_rules`: o grilă care ar trimite zile suplimentare către un tip
  reglementat prin `leave_type_id` primește tot P0001. Cele două triggere se citesc
  împreună — cerința („durata tipurilor fixe nu se schimbă din aplicație") se aplică pe
  orice cale, nu doar pe cea directă.
- **`categorie` e etichetă de audit, nu cheie.** Discriminantul real al unei grile e
  `tip_criteriu` plus câmpul lui: `vechime_ani_min`, `valoare_text`, `department_id` sau
  `cod_cor`. `categorieDinRegula` o compune pe server tocmai ca să respecte
  `ler_categorie_ck` (`^[a-z][a-z0-9_]{1,40}$`, relaxat în 0035 ca să accepte `null`) —
  cerută de la om, ar pica la INSERT pe un spațiu sau pe o majusculă.
- **Comutarea și dezactivarea sunt tranziții, deci fac `.select()` după `.update()`.**
  Amândouă filtrează pe `organization_id` și `deleted_at is null`, iar rezultatul gol
  devine `notFound`. Fără pasul ăsta, un identificator din altă firmă ar întoarce
  „succes" fără nicio scriere. — capcana #17
- **Zilele de bază nu se scriu direct în `organizations`.** Trec prin RPC-ul
  `public.seteaza_zile_concediu_implicit`, ca poarta să rămână `leave:update = all` în loc
  de `organizations:update = all`: cine configurează concediile n-are nevoie de fișa
  generală a firmei. Trigger-ul din bază propagă valoarea către `leave_types.zile_implicite`
  al tipului `odihna`. Funcția stă în schema `public` fiindcă PostgREST nu expune `app`.
- **Ștergerea unei grile e logică.** `dezactiveazaRegulaConcediu` scrie `deleted_at`, iar
  auditul o consemnează ca `delete` deși în bază e un UPDATE. Tabelele concediilor primesc
  grant doar pe `select`, `insert` și `update`, cu `revoke delete` explicit
  (`0009_leave.sql`).

## Cum se calculează dreptul unui an

`app.drept_concediu` (rescrisă în `0193_concediu_proportional_cu_lunile.sql`) dă, pe un
angajat, un tip și un an:

> (baza + grilele valabile la 31 decembrie) × lunile lucrate în an / 12

- **Baza** e `employment_contracts.zile_concediu_anual` de pe contractul de BAZĂ (activ,
  altfel cel mai recent) pentru `odihna`; pentru orice alt tip, `leave_types.zile_implicite`.
  Zilele scrise pe contract nu mai sunt un override la însămânțare, sunt baza per angajat,
  iar grilele se adună peste ele.
- **Lunile lucrate** se numără cu luna de intrare și cea de ieșire ÎNTREGI (08.10 → 3 luni),
  ancorate pe `valabil_de_la` al contractului de bază cu `hired_on` ca rezervă, respectiv
  pe `employees.terminated_on` cu `incetat_la` ca rezervă. Un `terminated_on` anterior
  ancorei se IGNORĂ: la reangajare pe aceeași fișă, `creeazaContract` reactivează fișa fără
  să-l golească, iar încetarea veche ar fi dat 0 zile în anul reangajării și în toți anii
  următori (ancora e atunci contractul NOU). Suspendările nu scad lunile.
- **Rotunjirea** urmează `leave_types.mod_rotunjire_acumulare` și se aplică DOAR la an
  parțial: 21 × 3/12 = 5,25 → 6 (`zi_in_sus`), 5 (`zi_in_jos`), 5 (`matematic`). O bază
  fracționară configurată deliberat (20,5) rămâne neatinsă pe anul întreg.
- Tipurile cu `scade_din_sold = false` (medical 183, maternitate 126…) nu se
  proporționalizează.

Oglinda TypeScript e `src/domain/leave/drepturi.ts` (`calculeazaDreptAnual` →
`luniLucrateInAn` → `calculeazaDreptProportional`), cu aceleași cifre în
`drepturi.test.ts` și în `tests/rls/proba-concediu-proportional.sql`. Fișa angajatului
arată factorul „× n/12 luni” în explicația dreptului; `dreptAfisat` rămâne valoarea
scrisă în `leave_balances`.

`public.seed_leave_balances` (înrolare, contract nou) nu mai aplică
`p_zile_odihna_override` — parametrul e ignorat, iar istoricul nu mai primește un rând
„Corecție de încadrare” la fiecare înrolare.

## Previzualizarea e o CITIRE, nu o acțiune

`public.aplica_drepturi_concediu` are parametrul `p_simulare`. Cu `true` întoarce ce S-AR
schimba și trăiește în `src/lib/queries/leave.ts` ca `previzualizeazaDrepturi`; cu `false`
scrie efectiv soldurile și e Server Action — `aplicaDrepturileConcediu`, care întoarce
numărul de rânduri atinse. Aceeași funcție SQL, două straturi: cine mută previzualizarea
în `actions.ts` pune o poartă de scriere pe o citire și ascunde butonul de cine avea voie
doar să se uite.

**Soldurile deja scrise nu se rescriu de migrare.** După 0193, un intrat din toamnă cu
sold 20 rămâne la 20 pe `/concedii/sold` până când HR deschide „Aplică drepturile” pe anul
respectiv: previzualizarea arată `drept_vechi 20 → drept_nou 5`, iar cine a consumat deja
mai mult decât noul drept apare cu `ramase_dupa` negativ (permis de 0017: HR poate duce
soldul în negativ retroactiv). Funcția parcurge doar `employees.status = 'activ'`, deci
soldul unui angajat deja încetat nu se recalculează.

Reușita nu rămâne doar în tabel: `buton-aplica-drepturi.tsx` arată un toast cu acțiunea
„Vezi soldurile" spre `/concedii/sold`, iar mesajul de după o grilă nouă leagă ancora
`#aplicare` a secțiunii de aplicare, în loc să trimită omul s-o caute cu ochii.

Zilele nu sunt bani: previzualizarea și tabelele de tipuri și de grile le scriu cu
`formatNumar` din `src/lib/format/numar.ts`, nu cu `formatAmount`, care forța două
zecimale — „13,00 zile".

## Citiri

`src/lib/queries/leave.ts`: `configurareConcedii` (tipurile, grilele și zilele de bază
într-o singură trecere), `previzualizeazaDrepturi`, `coduriIndemnizatieMedicala`,
`varianteConcediu`. Plus `deAprobat`, chemată doar când `leave:approve = team` trece:
numără `approval_tasks` pentru insigna din `NavConcedii`, și de la ea vine `user` din
`requireTenant`.

## Ce se mișcă împreună

Lista tipurilor al căror act se predă pe hârtie trăiește în două limbaje —
`TIPURI_CU_ORIGINAL_FIZIC` din `src/domain/leave/documente-fizice.ts` și condiția din
`internal.leave_requests_pregateste` — fiindcă regula vine din lege, nu din politica unei
firme, deci nu e o coloană reglabilă pe `leave_types`. `documente-fizice.test.ts` citește
migrarea și pică dacă cele două se despart: altfel ecranul ar declara fișierul opțional
exact acolo unde baza îl cere la trimitere.

## Când NU e suficientă pagina asta

- Calculul propriu-zis al drepturilor și al soldului: `src/domain/leave/`.
- Cererea, aprobarea, documentul justificativ, sincronizarea în pontaj: [[modul/concedii]].
