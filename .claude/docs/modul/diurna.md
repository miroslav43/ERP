---
tip: modul
titlu: Diurnă
aliases: [per_diem, deplasari, delegatii]
cai:
  - "src/app/(app)/diurna/**"
  - "src/app/(portal)/portal/diurna-mea/**"
  - "src/lib/queries/per-diem.ts"
  - "src/schemas/per-diem.ts"
  - "supabase/migrations/0015_per_diem.sql"
  - "supabase/migrations/0060_salarizare_diurna.sql"
  - "supabase/migrations/0147_diurna_valori_legale.sql"
  - "supabase/migrations/0156_diurna_zile_calendaristice.sql"
  - "supabase/migrations/0233_oracol_intre_firme.sql"
tabele:
  [
    business_trips,
    business_trip_legs,
    trip_expenses,
    per_diem_calculations,
    per_diem_policies,
    per_diem_country_rates,
    per_diem_valori_legale,
    countries,
  ]
permisiuni: [per_diem:read, per_diem:create, per_diem:update, per_diem:delete, per_diem:approve]
feature: per_diem
capcane: [16, 17, 54]
citeste_daca:
  - "aprobare respinsă cu 42501 → [[rol/manager]]"
  - "diurnă care nu apare în statul de plată → [[modul/salarizare]]"
scris_pe: cd77c37564a0a2474dda087e9d2ec85035b57e46
scris_la: 2026-10-25
tags: [modul, hr]
---

# Diurnă

Deplasări în țară și în străinătate, cu diurna calculată pe **țară și pe zi**, decont de
cheltuieli și o politică a firmei versionată în timp. Modulul își calculează singur
plafonul zilnic și împărțirea impozabil / neimpozabil; salarizarea preia rezultatul, nu-l
reface.

## Paginile modulului

Trunchiul ține ce e modulul, rutele și **ce refuză baza** — secțiunea pentru care se
deschide pagina dintr-un bug. Restul s-a spart pe subpagini (`.claude/docs/meta/conventii.md`).

| Pagină                    | Ce ține                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------- |
| [[modul/diurna/actiuni]]  | scrierile și citirile modulului, vehiculul de serviciu, ora României, erorile pe câmp |
| [[modul/diurna/legaturi]] | politica firmei și valorile legale, cum se numără zilele, salarizarea, notificările   |

## Rute și cine ajunge

| Rută                    | Poartă                                                            |
| ----------------------- | ----------------------------------------------------------------- |
| `/diurna`               | `per_diem:read` own; scope-ul filtrează lista                     |
| `/diurna/noua`          | `per_diem:create` own; alegerea altui angajat cere `all`          |
| `/diurna/[id]`          | `per_diem:read` own                                               |
| `/diurna/[id]/editeaza` | `per_diem:update` own                                             |
| `/diurna/[id]/decont`   | `per_diem:read` own                                               |
| `/diurna/aprobari`      | `per_diem:approve` team                                           |
| `/diurna/politica`      | `per_diem:read` own ca să vadă; `per_diem:update` all ca să scrie |

Toate trec prin `requireFeature(tenant.organizationId, "per_diem")` — dar pornit în
`Promise.all` alături de `getPermissionMap`, nu înaintea lui, cum arată preambulul
canonic. Poarta rămâne întreagă: `requireFeature` cheamă `notFound()`, iar aruncarea
respinge `Promise.all`-ul înainte să se ajungă la `can()`. Cele două citiri sunt
independente, pe tabele diferite, și toate paginile modulului o fac la fel;
readusă la serial, ordinea „canonică" plătește un dus-întors de rețea în plus, fără să
verifice nimic în plus. Angajatul are și `/portal/diurna-mea`, revalidată de fiecare
acțiune prin `CAI_PORTAL_DIURNA`.

**Decontul e un document comun cu portalul.** Tot documentul stă în
`[id]/decont/continut-decont.tsx`; `/diurna/[id]/decont` și `/portal/diurna-mea/[id]/decont`
păstrează fiecare preambulul său și diferă prin `caleFisa`. Rolul `employee` e dus în
portal, deci fără componenta comună nu-și putea tipări propriul decont. Cheltuielile
neaprobate se tipăresc separat, în afara totalului: altfel diferența dintre teancul de
bonuri și sumă nu se poate explica.

**Scrierile de pe fișă cer confirmare.** „Trimite spre aprobare” și „Șterge ciorna” sunt
`ButonConfirmare` (`src/components/ui/buton-confirmare.tsx`): după trimitere, plecarea,
sosirea și angajatul devin ale aprobatorului, iar ștergerea scoate ciorna de pe ecran.
Aprobarea și respingerea trec prin `ConfirmareActiune`, cu omul, intervalul și avansul gata
formatate pe server de `rezumatDecizie` (`src/app/(app)/diurna/rezumat-decizie.ts`) —
aceleași valori ca pe card, nicio citire în plus —, iar reușita se spune prin toast, nu se
deduce din dispariția rândului din coadă (QA oct 2026: MGR-018, FLX-009).
`DecizieDeplasare` e montată și pe fișă, și în `/diurna/aprobari`: se schimbă pentru
amândouă deodată. Fișa arată în plus numărul de înregistrare, dacă există — `NumarRegistru`
(`src/components/registru/numar-registru.tsx`), lăsat sau ascuns de RLS.

Formularul deplasării noi ține selecturi CONTROLATE (țara, datele, cursul, avansul hrănesc
previzualizarea), deci depinde de `<Formular>` ca să le repună după un refuz: `form.reset()`
din React 19 duce un `<select>` controlat pe prima opțiune, iar cine corecta doar câmpurile
marcate salva deplasarea pe persoana greșită — capcana #54, găsită pe `/diurna/noua`.

## Ce refuză baza

- **Aprobarea unui manager e respinsă cu 42501.** `business_trips_update` acceptă în
  `USING` ramura de aprobare, dar `WITH CHECK` cere `poate_accesa_deplasare(..., 'update')`
  pe **ambele** ramuri. Rolul `manager` are `per_diem:approve = team` și
  `per_diem:read = team`, dar niciun `per_diem:update` — deci `has_permission` întoarce
  `none` la verificarea de scriere. Merge pentru `org_admin` și `super_admin`, sau după ce
  firma adaugă rândul de `per_diem:update` pe organizație. Identic la `trip_expenses`.
  — capcana #16, v. [[rol/manager]]
- **Fără politică valabilă la data plecării, nu se poate crea nimic.**
  `internal.valideaza_deplasare` cere un rând din `app.per_diem_politica(org, data)` și
  ridică P0001 cu data în mesaj. Politica e versionată: se adaugă un rând nou, nu se
  editează cel vechi. Ecranele o spun înaintea refuzului: `/diurna/noua` și starea goală
  din `/diurna` oferă politica drept „Pasul 1 din 2”, cu buton doar pentru cine o poate
  configura (`per_diem:update = all`); fără drept, textul trimite la administratorul
  organizației, în loc să îndemne „Adăugați prima deplasare” (UX-037).
- **`decontata` și `anulata` sunt terminale.** Orice schimbare de stare din ele ridică
  P0001.
- **După intrarea în aprobare, datele de bază sunt ale aprobatorului.** Modificarea lui
  `plecare_la`, `sosire_la` sau `employee_id` pe o deplasare care nu mai e `ciorna` ori
  `respinsa` cere drept de aprobare — altfel P0001.
- **Politica se datează după lege, nu înaintea ei — iar valorile legale nu se aleg.**
  `internal.aplica_valori_legale_diurna` (`0147_diurna_valori_legale.sql`) caută rândul din
  `per_diem_valori_legale` valabil la `valabil_de_la`; fără el, P0001 cu data în mesaj. Pe
  același trigger `before insert or update`, tăcut: `diurna_baza_legala_interna`,
  `multiplu_plafon_neimpozabil` și `plafon_salarii_baza_luna` trimise din aplicație sunt
  înlocuite cu rândul de lege, fără eroare. Nomenclatorul îl scrie doar administratorul de
  platformă (`app.is_platform_admin()` în INSERT și UPDATE).
- **Vehiculul trebuie să fie al organizației.** P0001, verificat în trigger, nu prin cheie
  străină.
- **Sumă externă fixă în altă monedă decât baremul → calcul incomplet, nu eroare.**
  `app.recalculeaza_diurna` (`0147_diurna_valori_legale.sql`) și oglinda ei TS din
  `src/domain/per-diem/sume.ts` marchează `curs_incomplet` și lasă sumele în lei NULL pe
  toată deplasarea: există un singur `curs_diurna`, iar plafonul rămâne în moneda baremului
  țării. Al doilea curs nu se inventează; ecranul arată un calcul fără sume.
- **Tranzițiile fac `.select()` după `.update()`.** `decideDeplasare` filtrează pe
  `status = "in_aprobare"`, `deconteazaDeplasare` pe `status = "aprobata"`; rezultatul gol
  devine un mesaj de conflict, nu „succes". — capcana #17

Mesajele P0001 ale modulului sunt scrise pentru utilizatorul final, în română, cu cifre
din bază — de aceea `src/app/(app)/diurna/erori.ts` le lasă să treacă pe ecran, tăiate la
300 de caractere, în loc să le înlocuiască cu textul generic.

## Ce NU e aici

Foaia de parcurs și vehiculul în sine sunt la [[modul/flota]]; diurna doar alege un
`vehicle_id` din parc, verificat pe organizație — v. [[modul/diurna/actiuni]] și
[[modul/flota/soferi]]. Politica firmei, calculul zilelor și drumul spre statul de plată
sunt în [[modul/diurna/legaturi]]. Plata efectivă și impozitarea intră în
[[modul/salarizare]].

## Când NU e suficientă pagina asta

- Calculul zilelor și al plafoanelor: `src/domain/per-diem/`, cu teste.
- De ce un rol vede lista dar nu poate aproba: [[rol/manager]].
- Lotul 7g: `?angajat=` preselectat pe deplasarea nouă, „decontul” pe cardurile aprobate, politica aplicată și pontajul lunii pe fișă, politica legată din previzualizare și din listă, starea cheltuielilor în portal, rândurile de diurnă din fluturaș → deplasările omului: [[strat/navigare]].
