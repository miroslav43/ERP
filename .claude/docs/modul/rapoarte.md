---
tip: modul
titlu: Rapoarte
aliases: [rapoarte, statistici, grafice]
cai:
  - "src/app/(app)/rapoarte/**"
  - "src/lib/queries/rapoarte.ts"
tabele: [payroll_periods, payroll_entries, employees, organization_features]
permisiuni: [payroll:read, payroll:create, employees:read, attendance:read, leave:read]
feature: rapoarte
capcane: [2]
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul]
---

# Rapoarte

Statistici anuale peste perioadele de salarizare — evoluție lunară, structura costului,
ore. Un singur ecran, fără nicio scriere.

## Modul propriu la poartă, salarizare la permisiune

`/rapoarte` cere `requireFeature(..., "rapoarte")` — cheia lui proprie din `FEATURE_KEYS`
(`src/config/features.ts`), nu a salarizării. Poarta era `payroll` până la
`0123_module_rapoarte_si_kpi.sql`: ecranul se vindea separat în ofertă, dar nu s-ar fi
deschis fără modulul-părinte. Guard-ul, `getPermissionMap` și `getEnabledFeatures` rulează
într-un singur `Promise.all` — dus-întorsuri independente, nu înlănțuite. Al treilea nu
costă nimic: `getEnabledFeatures` e `cache()`-uit (`src/lib/auth/features.ts`) și
`requireFeature` îl cheamă pe el, deci e același apel, nu unul în plus.

**Permisiunea nu s-a mutat**: tot `payroll:read` la scope **`all`**, și în pagină, și pe
intrarea de meniu din `src/config/navigation.ts` (`featureKey: "rapoarte"`,
`permission: "payroll:read"`, `minScope: "all"`). Separarea e comercială, la nivel de
modul; controlul de acces a rămas al salarizării. Nu există resursă `reports:*` folosită
de vreo politică — cheia `reports:read` există în vocabularul din
`src/config/permissions.ts`, dar niciun consumator nu o citește.

Consecința practică: **cine nu vede salariile nu vede nici rapoartele**, iar un `manager`
n-are `payroll` deloc (`none` explicit în seed).

## Ieșirile cer poarta paginii-țintă, nu a rapoartelor

Ecranul nu se citește doar, se și părăsește: fiecare link spre alt modul e păzit de un
boolean calculat pe server din **modul ȘI permisiune**, ale destinației, nu ale
rapoartelor. Un link care duce la 404 e mai rău decât un link absent, iar
`requireFeature` dă exact 404.

| Boolean                    | Modul        | Permisiune                  |
| -------------------------- | ------------ | --------------------------- |
| `poateDeschideSalarizarea` | `payroll`    | `payroll:create` la `all`   |
| `poateDeschidePontajul`    | `attendance` | `attendance:read` la `team` |
| `poateDeschideConcediile`  | `leave`      | `leave:read` la `team`      |
| `poateDeschideFisa`        | —            | `employees:read` la `all`   |

`poateDeschideFisa` n-are verificare de modul fiindcă fișa de angajat stă în `nucleu`,
care e `isCore` și nu se poate dezactiva (`src/config/features.ts`). Cere însă `all`
exact: cu `employees:read = team` (suprascriere de membru) un angajat din afara echipei
ar da 404 pe fișă.

`poateDeschideSalarizarea` verifică modulul tocmai pentru că rapoartele se cumpără fără
salarizare — separarea din `0123` a făcut posibilă combinația „are `payroll:create` din
seed, dar firma n-are rândul `payroll`".

## Citiri

`src/lib/queries/rapoarte.ts` (`server-only`): `aniCuPerioade` (anii pentru care există
perioade) și `statisticiAnuale`. Ambele agregă peste perioade închise sau calculate; nu
recalculează nimic — sumele sunt cele scrise de [[modul/salarizare]].

`statisticiAnuale` întoarce, pe lângă totaluri, și identificatorii de care au nevoie
legăturile: `periodId` pe fiecare `StatisticaLuna` și `perioadeNecalculate` (`id` + `luna`)
pentru lunile fără calcul valabil — ecranul duce la perioada de calculat, nu la lista
perioadelor. `StatisticaAngajat.exista` spune dacă fișa mai e vizibilă.

## Ce refuză baza tăcut

- **`max_rows = 1000` din `supabase/config.toml`: PostgREST TRUNCHIAZĂ TĂCUT.** Orice
  agregare care se apropie de prag trebuie paginată explicit, sau citită în buclă cât timp
  vin exact 1000 de rânduri. Un raport anual peste o firmă mare e exact forma care lovește
  pragul fără să se plângă. — capcana #2
- **Rândurile unei perioade `draft` NU intră în totaluri (HR-027).** `payroll_entries`
  cu `status = "calculat"` pot sta pe o perioadă rămasă `draft` — fie redeschisă
  (`payroll.period.reopen` duce `calculat` → `draft` fără să atingă intrările,
  `0026:346-357`), fie orfane după un calcul pe care triggerul l-a refuzat DUPĂ scriere.
  `statisticiAnuale` le sare și le trece în `luniInCiorna`, iar luna apare și în
  `luniNecalculate`: ecranul perioadei le ascunde deja, raportul nu poate aduna ce
  perioada nu arată. Callout-ul a devenit `informativ` („Luni redeschise"), nu `atenție`
  — nu e nimic de reparat. — `src/lib/queries/rapoarte.ts`,
  `src/app/(app)/salarizare/actions.ts`
- **Un angajat șters sau ascuns de RLS rămâne în cifre, fără link.** Intrarea de
  salarizare nu dispare cu fișa, deci rândul se afișează cu „Angajat șters" și
  `exista: false` — iar `href`-ul rândului devine `null`. Fără asta, linkul ducea la 404.
  — `src/lib/queries/rapoarte.ts`
- **Feliile inelului se rotunjesc la ban (HR-028).** `766,88 − 750` în virgulă mobilă dă
  `16.879999999999995`, iar cifra ajungea neatinsă în tabelul citit de cititorul de ecran.
  `rotunjesteLaBani` (`src/domain/bani.ts`) o taie; în schimb suma feliilor poate diferi
  cu un ban de `costTotalAngajator`, și centrul inelului scrie suma feliilor, nu totalul.
  — `src/app/(app)/rapoarte/page.tsx`
- **Un an fără perioade nu e o eroare.** `aniCuPerioade` întoarce listă goală, iar
  `statisticiAnuale` iese devreme cu toate totalurile pe zero; ecranul arată starea goală
  — nu se confundă cu „datele nu s-au încărcat". — `src/lib/queries/rapoarte.ts`
- **Modul dezactivat ⇒ 404, nu 403.** `requireFeature` cheamă `notFound()`
  (`src/lib/auth/features.ts`), deci o firmă fără rând `rapoarte` în
  `organization_features` primește pagină inexistentă, nu `AccesRestrictionat`. Firmele
  care aveau `payroll` au primit rândul prin copiere, cu `enabled` preluat din
  rândul-părinte, nu pus `true` orbește — `0123:58-62`.

## Când NU e suficientă pagina asta

- Cum se calculează sumele: [[modul/salarizare]] și `src/domain/payroll/`.
- De ce o perioadă nu se recalculează: [[date/pontaj]].
- Lunile graficului, celulele CO/ore și „pe luni” ca linkuri; intrarea din salarizare: [[strat/navigare]].
