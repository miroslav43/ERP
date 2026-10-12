---
tip: modul
titlu: Mentenanță — ISCIR și verificări legale
aliases: [ISCIR, autorizații ISCIR, VTP, RSVTI, verificări legale, dosar de control]
cai:
  - "src/app/(app)/mentenanta/iscir/**"
  - "src/app/(app)/mentenanta/echipamente/[id]/formular-iscir.tsx"
  - "src/app/(app)/mentenanta/echipamente/[id]/precompletare-plan.ts"
  - "src/app/api/export/mentenanta/verificari/route.ts"
  - "src/lib/pdf/dosar-control.ts"
  - "src/domain/maintenance/iscir.ts"
  - "src/domain/maintenance/legal.ts"
  - "supabase/migrations/0211_mentenanta_iscir_conformitate.sql"
  - "tests/rls/proba-iscir.sql"
tabele:
  [iscir_authorizations, maintenance_plans, maintenance_settings, expirables, registru_documente]
permisiuni: [maintenance:read, maintenance:update, maintenance:export]
feature: maintenance
capcane: [17, 55]
citeste_daca:
  - "autorizația nu se mai modifică sau „Reînnoiește” e refuzat → „Ce refuză baza tăcut”"
  - "cifra ISCIR de pe panou nu bate cu lista → „Semaforul”"
  - "periodicitatea sau temeiul unei verificări legale → „Categoriile legale”"
scris_pe: edd51fa9be907ae26d1faa9eceae838a5ca4d69b
scris_la: 2026-10-12
tags: [modul, operations]
---

# Mentenanță — ISCIR și verificări legale

Extrasă din [[modul/mentenanta]]. Din `0211` (faza M7) o autorizație ISCIR are
**regim** (`inregistrat` cu număr, sau `neinregistrat_rsvti` — echipament sub pragul de
înregistrare, ținut doar în evidența RSVTI, fără număr; cazul 42), **suspendare cu motiv**
și **reînnoire ca rând nou** legat prin `inlocuita_de_id`. Nimic nu blochează utilajul:
expirat sau suspendat = roșu peste tot (fișă, listă, panou), fără refuz (cazul 38).

## Rute și cine ajunge

| Rută                                    | Poartă                               |
| --------------------------------------- | ------------------------------------ |
| `/mentenanta/iscir`                     | `maintenance:read` team              |
| `/api/export/mentenanta/verificari`     | `maintenance:export` team            |
| fișa echipamentului, secțiunea `#iscir` | gesturile: `maintenance:update` team |

Lista arată doar autorizațiile CURENTE; rândul duce la fișa echipamentului, unde stau
gesturile. „Dosar de control” = autorizațiile curente + planurile active
`verificare_legala`, cu temeiul categoriei (emitentul stă la observații): PDF cu
`?format=pdf` (`src/lib/pdf/dosar-control.ts`, bloc pe rând, fără număr de registru —
e o situație internă la zi), CSV implicit. Liniile le compune o singură dată
`iscir/dosar-control.ts`, pentru ambele formate; exportul e auditat (`log_audit_event`).

## Server Actions

`iscir/actions.ts`, toate pe `maintenance:update` / team: `actualizeazaAutorizatie`,
`suspendaAutorizatie`, `reactiveazaAutorizatie`, `reinnoiesteAutorizatie`,
`stergeAutorizatie`. Înregistrarea rămâne `adaugaAutorizatieIscir` în `../actions.ts`.
Fiecare UPDATE filtrează `organization_id`, `deleted_at is null`, `inlocuita_de_id is null`
(și starea suspendării, la tranziții) și face `.select()`: zero rânduri = CONFLICT
(capcana #17). Reînnoirea citește întâi rândul vechi pe organizație (NEGASIT fără RPC),
apoi cheamă `public.reinnoieste_autorizatie_iscir`.

## Citiri

`listeazaAutorizatiiIscir` (keyset pe `valabil_pana`, apoi `id`; filtre `stare`, `regim`,
`tip`, `echipament`), `tipuriAutorizatiiIscir` (și tipurile scrise liber înainte de 0211),
`stareRsvti` (echipamente `este_iscir` necasate vs. RSVTI-ul din setări, activ),
`autorizatiiIscir` — fără echipament doar rândurile curente, pe echipament și istoricul.

## Semaforul

`stareAutorizatie` (`domain/maintenance/iscir.ts`): înlocuită › suspendată › expirată ›
expiră curând (15 zile) › valabilă, după **termenul cel mai apropiat dintre
`valabil_pana` și `scadenta_verificare_tehnica`**. În PostgREST: `min(a, b) ≤ L` se scrie
`or(a.lte.L, b.lte.L)` — aceeași formă în insigna din meniu (`numarAutorizatiiIscirScadente`),
pe panou și la filtrul `?stare=actiune`, ca cele trei să numere aceleași rânduri.

`avertismentMaximLegal`: dacă scadența din document trece de maximul categoriei (luni de
la `emis_la`), se arată un `Callout` „⚠ de confirmat cu RSVTI” — **documentul are
prioritate**, aplicația doar semnalează (cazul 40).

## Categoriile legale

`domain/maintenance/legal.ts`: 17 categorii (VTP mașini de ridicat, ascensor, cazan,
recipient; revizie ascensor; GPL; gaze — verificare/revizie; PRAM; paratrăsnet; iluminat
de siguranță; uși RF; coș de fum; F-gaz; metrologie; generator/UPS; verificare după
montare, HG 1146). `verificat: true` = periodicitatea citită pe text (sursa în cod și în
`NOTES.md` §3); `false` = temeiul pleacă în plan cu „⚠ … (de confirmat)”. Alegerea
categoriei în formularul de plan scrie direct în câmpurile necontrolate
(`precompletare-plan.ts`): tip `verificare_legala`, periodicitatea (nu golește una scrisă,
dacă categoria e pe eveniment), temeiul, denumirea doar dacă era goală. Schema refuză o
categorie pe un plan cu alt tip.

## Ce refuză baza tăcut

- **Rândul înlocuit e istoric.** Garda (`internal.iscir_garda`) refuză orice
  modificare pe el; `inlocuita_de_id` se pune doar prin funcția de reînnoire (GUC
  `app.iscir_inlocuire`, pe care PostgREST nu-l poate seta).
- **Reînnoirea e atomică doar prin funcție.** Rândul vechi se marchează ÎNAINTE de
  inserarea celui nou (indexul unic pe număr ignoră rândurile înlocuite, deci numărul se
  poate păstra), cu cheia străină `DEFERRABLE INITIALLY DEFERRED`. Funcția e SECURITY
  INVOKER: politicile apelantului se aplică întocmai; managerul primește 42501, cine nu
  vede rândul — P0001 „nu vă este accesibilă”.
- **Ștergerea logică a reînnoirii readuce rândul vechi** (trigger AFTER), cu scadențele lui.
  Dacă numărul rândului vechi a fost dat între timp altei autorizații curente, ștergerea
  e refuzată cu P0001 (pasul următor în mesaj), nu cu 23505 de la index — proba (10).
- **`reactivata_la` o pune garda** la ridicarea suspendării; motivul rămâne, ca istoric.
  Suspendarea cere motiv ≥ 5 caractere și nu poate fi în viitor — doar la TRANZIȚIE,
  rândurile vechi suspendate fără motiv rămân valide.
- **Echipamentul unei autorizații nu se schimbă** (P0001): se șterge și se adaugă pe cel corect.
- **Scadențele (`expirables`)**: `iscir_exp_sync` (de la forma din 0182) scoate și rândul
  înlocuit; eticheta folosește tipul când numărul lipsește. `kind` e un cod fix
  (`autorizatie`, `verificare_tehnica`), iar `entity_id` e autorizația, nu utilajul — tipul
  tastat de om nu ajunge niciodată în `kind`. — capcana #55
- **Registrul** primește doar `inregistrat` cu număr (condiție `when` pe trigger;
  argumentele triggerului copiate din catalog, harta din 0142 nu se regenerează).

Proba: `tests/rls/proba-iscir.sql` și blocul M7 din (l) în `tests/rls/izolare.sql`
(org_admin scrie tot, manager/hr/employee refuzați, super_admin citește). Mesajele P0001
ale gărzii sunt citite din migrare de `erori.test.ts`.

## Ce NU e aici

Autorizațiile nominale ale oamenilor (stivuitorist, RSVTI ca persoană) sunt la
[[modul/ssm]]. Desemnarea RSVTI-ului firmei e în `/mentenanta/setari`
([[modul/mentenanta/zilnic]]). Legătura accident ISCIR ↔ `work_accidents` nu există.
