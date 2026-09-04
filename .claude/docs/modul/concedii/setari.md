---
tip: modul
titlu: Concedii — configurarea firmei
aliases: [concedii-setari, grile-concediu, drepturi-concediu]
cai:
  - "src/app/(app)/concedii/setari/**"
  - "supabase/migrations/0035_reguli_concediu.sql"
  - "supabase/migrations/0037_fix_grile_pe_tip_reglementat.sql"
tabele: [leave_types, leave_type_variants, leave_entitlement_rules, leave_balances, organizations]
permisiuni: [leave:read, leave:create, leave:update]
feature: leave
capcane: [17]
scris_pe: 711e5225e1df2ceab9324037466c87fda8abd8a0
scris_la: 2026-09-04
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

Preambulul pornește `requireFeature(..., "leave")` și `getPermissionMap` împreună, într-un
`Promise.all`, nu înlănțuite ca în tiparul canonic: sunt două citiri independente, pe
tabele diferite, iar înlănțuirea costa un dus-întors în plus, integral rețea. Ordinea
porților rămâne aceeași — `requireFeature` cheamă `notFound()`, iar `Promise.all` respinge
la prima respingere, deci un modul dezactivat dă tot 404 înainte ca harta de permisiuni să
ajungă la `can()`. Tiparul e al întregului modul, nu al acestei pagini ([[modul/concedii]]);
cine îl „repară" înapoi în formă serială reintroduce latența, nu o verificare.

Ecranul are câte o zonă per obiect: `tabel-tipuri-reglementate.tsx` și
`card-tip-adaptabil.tsx` pentru tipuri, `tabel-reguli.tsx` cu `formular-regula-noua.tsx`
pentru grile, `formular-zile-baza.tsx` pentru zilele de bază și
`buton-aplica-drepturi.tsx` pentru recalcul.

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

## Previzualizarea e o CITIRE, nu o acțiune

`public.aplica_drepturi_concediu` are parametrul `p_simulare`. Cu `true` întoarce ce S-AR
schimba și trăiește în `src/lib/queries/leave.ts` ca `previzualizeazaDrepturi`; cu `false`
scrie efectiv soldurile și e Server Action — `aplicaDrepturileConcediu`, care întoarce
numărul de rânduri atinse. Aceeași funcție SQL, două straturi: cine mută previzualizarea
în `actions.ts` pune o poartă de scriere pe o citire și ascunde butonul de cine avea voie
doar să se uite.

## Citiri

`src/lib/queries/leave.ts`: `configurareConcedii` (tipurile, grilele și zilele de bază
într-o singură trecere), `previzualizeazaDrepturi`, `coduriIndemnizatieMedicala`,
`varianteConcediu`.

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
