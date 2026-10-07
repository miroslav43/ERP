---
tip: modul
titlu: Mentenanță — ciclul de viață al echipamentului
aliases: [echipamente-ciclu, casare echipament, contoare, etichete QR, responsabil echipament]
cai:
  - "src/app/(app)/mentenanta/echipamente/**"
  - "src/app/(app)/mentenanta/contoare/**"
  - "src/app/api/export/mentenanta/**"
  - "src/app/(portal)/portal/sesizari/echipamentele-mele.tsx"
  - "supabase/migrations/0182_echipamente_ciclu.sql"
  - "tests/rls/proba-echipamente-ciclu.sql"
tabele: [equipment, equipment_meters, maintenance_plans, iscir_authorizations, expirables]
permisiuni: [maintenance:read, maintenance:update, maintenance:delete, maintenance:export]
feature: maintenance
capcane: [17, 35, 48, 52]
citeste_daca:
  - "casarea sau ștergerea unui utilaj e refuzată → „Ce refuză baza tăcut”"
  - "un responsabil-angajat nu-și vede utilajul sau nu poate citi contorul → „Responsabilul”"
scris_pe: 9ea2a16b2a1238c4bcf3726661ee4b024da7167f
scris_la: 2026-10-07
tags: [modul, operations]
---

# Mentenanță — ciclul de viață al echipamentului

Extrasă din [[modul/mentenanta]]. Din `0182`, un echipament are categorie, punct de lucru
(FK compusă pe firmă), garanție cu scadență proprie, service de garanție, părinte
(componente), casare cu motiv, marcaj CE, risc specific, folosire în afara sediului și
observații. Stările: `in_functiune`, `in_reparatie`, `in_conservare`, `casat`.

## Rute

| Rută                                                                               | Poartă                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/mentenanta/echipamente` (+ filtre categorie, punct de lucru, ISCIR, responsabil) | `maintenance:read` team                                                  |
| `/mentenanta/echipamente/[id]`                                                     | `maintenance:read` team; scrierile `update` team; ștergerea `delete` all |
| `/mentenanta/echipamente/[id]/eticheta`, `/mentenanta/echipamente/etichete`        | `maintenance:read` team                                                  |
| `/mentenanta/contoare`                                                             | `maintenance:read` team; lotul `update` team                             |
| `/api/export/mentenanta/echipamente`                                               | `maintenance:export` team                                                |
| `/portal/sesizari` → „Echipamentele în grija mea”                                  | responsabilul (RLS), citire prin `inregistreazaContor`                   |

Eticheta QR codifică `/mentenanta/sesizari/noua?echipament=<id>` — forma autocolantelor
deja lipite, păstrată ca redirect. Pe utilajele „folosite în afara sediului” eticheta
poartă ultima verificare legală și scadența (planul `verificare_legala`), fără nume de
persoane: HG 1146 cere dovada, nu identitatea.

## Server Actions

`src/app/(app)/mentenanta/echipamente/actions.ts` (numele exact `actions.ts`, singurul
admis de ESLint pentru clientul admin — folosit doar la punctele de lucru):

| Funcție                                                                              | Permisiune / minScope                  |
| ------------------------------------------------------------------------------------ | -------------------------------------- |
| `schimbaStareEchipament`, `corecteazaCitire`, `anuleazaCitire`, `optiuniPuncteLucru` | `maintenance:update` / team            |
| `stergeEchipament` (codul tastat)                                                    | `maintenance:delete` / all             |
| `inregistreazaCitiri` (lot)                                                          | `maintenance:read` / own — decide baza |

`inregistreazaContor` (în `mentenanta/actions.ts`) a coborât la `read`/own: o face și
responsabilul utilajului, din portal; cine poate pe ce utilaj decide politica de INSERT.
`optiuniPuncteLucru` trece prin clientul admin fiindcă `puncte_lucru_select` cere
`departments:read`, pe care un responsabil de mentenanță poate să nu-l aibă — altfel
selectorul era tăcut gol.

## Ce refuză baza tăcut

- **Casarea cere motiv (≥ 5 caractere) și refuză cât există sesizări deschise**, cu
  numărul lor în mesaj; completează `casat_la` cu azi; dezactivează planurile. Repunerea
  din `casat` curăță data și motivul, dar planurile rămân inactive — se repornesc explicit.
- **Ștergerea logică refuză la fel**, apoi șterge logic planurile și contoarele și
  dezleagă componentele (rămân în evidență, fără părinte). `equipment_select` nu
  filtrează `deleted_at`, deci UPDATE-ul pe `deleted_at` întoarce rândul (capcana #48 nu
  mușcă aici).
- **Părintele**: aceeași firmă, nu el însuși, fără cicluri, cel mult 5 niveluri — P0001
  cu explicația, indiferent cine scrie (regulă de integritate, și în context de serviciu).
- **Conservarea scoate planurile din `expirables`; casarea scoate și autorizațiile
  ISCIR** (`maintenance_plan_exp` și `iscir_autorizatie_exp` se uită la echipament).
  Repunerea le readuce prin triggerul `equipment_dupa_stare`. Garanția e un rând
  `equipment`/`garantie`, retras când data dispare.
- **Resetarea contorului păstrează restul până la țintă**: `equipment_meters_resetare`
  mută `ultima_citire_contor` a planurilor pe acel tip cu diferența, iar `ssm_plan_calc`
  recalculează ținta. Verificat: 1000 → 1500, contor nou de la 20 → țintă 520.
- **Responsabilul** (fișa lui pe `responsabil_employee_id`) vede rândul utilajului VIU și
  citirile lui și poate insera o citire OBIȘNUITĂ — nu o resetare, care mută țintele
  planurilor. Politica de INSERT pe contoare cere `update ≥ team` (din 0150) sau
  responsabilul; pentru toți, utilajul trebuie să fie al firmei și necasat. Un angajat
  oarecare primește 42501 direct prin PostgREST.
- **Resincronizarea scadențelor la schimbarea stării se face direct prin `sync_expirable`**
  (`plan_exp_sync`, `iscir_exp_sync`), nu prin UPDATE pe planuri, iar `ssm_plan_calc`
  recalculează doar când i se schimbă intrările: o scadență restantă nu se mută în viitor
  când utilajul intră în reparație. — capcana #52
- **Ștergerea logică cere `maintenance:delete = all` în gardă** (nu doar în acțiune), iar
  un echipament șters nu se restaurează din aplicație.
- **Exportul CSV** e un eveniment de audit (`log_audit_event`, `equipment`), plafonat la
  lista filtrată.

## Când NU e suficientă pagina asta

- Textul fiecărei verificări: `tests/rls/proba-echipamente-ciclu.sql`.
- Contractul acțiunilor: `echipamente/actions.test.ts`, `actions-echipamente.test.ts`.
- Sesizarea ca flux (tehnician, opriri): [[modul/mentenanta/sesizari]].
