---
tip: modul
titlu: Mentenanță — ciclul de viață al echipamentului
aliases: [echipamente-ciclu, casare echipament, stare echipament, valoare echipament]
cai:
  - "src/app/(app)/mentenanta/echipamente/**"
  - "src/app/(app)/mentenanta/contoare/**"
  - "src/app/api/export/mentenanta/**"
  - "src/app/(portal)/portal/sesizari/echipamentele-mele.tsx"
  - "supabase/migrations/0182_echipamente_ciclu.sql"
  - "tests/rls/proba-echipamente-ciclu.sql"
  - "supabase/migrations/0232_mentenanta_costuri_echipament.sql"
tabele:
  [
    equipment,
    equipment_costuri,
    equipment_meters,
    maintenance_plans,
    iscir_authorizations,
    maintenance_settings,
    puncte_lucru,
    fault_reports,
    expirables,
  ]
permisiuni:
  [
    maintenance:read,
    maintenance:create,
    maintenance:update,
    maintenance:delete,
    maintenance:export,
    departments:read,
    employees:read,
    ssm:read,
    audit:read,
  ]
feature: maintenance
capcane: [17, 34, 35, 48, 52, 57]
neverificat:
  - "/mentenanta/echipamente/nou — rută ȘTEARSĂ, citată anume ca să nu fie recreată"
citeste_daca:
  - "casarea sau ștergerea unui utilaj e refuzată → „Ce refuză baza tăcut”"
  - "contor necitit, lot parțial, responsabil fără drept → [[modul/mentenanta/echipamente/contoare]]"
  - "link lipsă pe fișă sau etichetă tipărită greșit → [[modul/mentenanta/echipamente/fisa-si-etichete]]"
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul, operations]
---

# Mentenanță — ciclul de viață al echipamentului

Extrasă din [[modul/mentenanta]]. Din `0182`, un echipament are categorie, punct de lucru
(FK compusă pe firmă), garanție cu scadență proprie, service de garanție, părinte
(componente), casare cu motiv, marcaj CE, risc specific, folosire în afara sediului și
observații. Stările: `in_functiune`, `in_reparatie`, `in_conservare`, `casat`.

## Paginile modulului

Pagina asta ține rutele, scrierile de stare și ce refuză baza. Restul s-a spart pe
subpagini (`.claude/docs/meta/conventii.md`).

| Pagină                                            | Ce ține                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- |
| [[modul/mentenanta/echipamente/contoare]]         | ecranul contoarelor, citirea în lot, resetarea, responsabilul |
| [[modul/mentenanta/echipamente/fisa-si-etichete]] | drumurile per rând ale fișei, documentele, eticheta QR        |

## Rute

| Rută                                                                             | Poartă                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/mentenanta/echipamente` (filtre categorie, punct de lucru, ISCIR, responsabil) | `maintenance:read` team; caseta și copierea `update` team                |
| `/mentenanta/echipamente/[id]`                                                   | `maintenance:read` team; scrierile `update` team; ștergerea `delete` all |
| `/mentenanta/echipamente/[id]/eticheta`, `/mentenanta/echipamente/etichete`      | `maintenance:read` team                                                  |
| `/mentenanta/contoare`                                                           | `maintenance:read` team; formularul de lot `update` team                 |
| `/api/export/mentenanta/echipamente`                                             | `maintenance:export` team                                                |
| `/portal/sesizari` → „Echipamentele în grija mea”                                | responsabilul (RLS), citire prin `inregistreazaContor`                   |

Pe cardul din portal, lângă citirea rapidă, „Raportează o defecțiune” duce la caseta de
pe aceeași pagină cu utilajul precompletat — doar cu `maintenance:create` own
(`poateRaporta`, calculat în pagină, implicit `false` în componentă).

Ruta `/mentenanta/echipamente/nou` **nu mai există**: echipamentul nou e caseta de pe
listă (`?echipament=nou`), iar „Adaugă unul la fel” o deschide precompletată din altă
fișă (`?model=<id>`, fără cod, serie, părinte și stare). `FormData` → încărcătură trece
prin `valoriEchipament()`, testată separat, nu prin componentă.

## Server Actions

`src/app/(app)/mentenanta/echipamente/actions.ts` (numele exact `actions.ts`, singurul
admis de ESLint pentru clientul admin — folosit doar la punctele de lucru):

| Funcție                                                                              | Permisiune / minScope                  |
| ------------------------------------------------------------------------------------ | -------------------------------------- |
| `schimbaStareEchipament`, `corecteazaCitire`, `anuleazaCitire`, `optiuniPuncteLucru` | `maintenance:update` / team            |
| `stergeEchipament` (codul tastat)                                                    | `maintenance:delete` / all             |
| `inregistreazaCitiri` (lot)                                                          | `maintenance:read` / own — decide baza |

`optiuniPuncteLucru` trece prin clientul admin fiindcă `puncte_lucru_select` cere
`departments:read`, pe care un responsabil de mentenanță poate să nu-l aibă — altfel
selectorul era tăcut gol (capcana #34 pentru limitele ESLint). Lotul de citiri și
`inregistreazaContor`: [[modul/mentenanta/echipamente/contoare]].

## Ce refuză baza tăcut

- **Casarea cere motiv (≥ 5 caractere) și refuză cât există sesizări deschise**, cu
  numărul lor în mesaj; completează `casat_la` cu azi; dezactivează planurile. Repunerea
  din `casat` curăță data și motivul, dar planurile rămân inactive — se repornesc explicit.
- **Ștergerea logică refuză la fel**, apoi șterge logic planurile și contoarele și
  dezleagă componentele (rămân în evidență, fără părinte). `equipment_select` nu
  filtrează `deleted_at`, deci UPDATE-ul pe `deleted_at` întoarce rândul (capcana #48 nu
  mușcă aici).
- **Părintele**: aceeași firmă, nu el însuși, fără cicluri, cel mult 5 niveluri cu tot cu
  componentele lui — P0001 cu explicația, indiferent cine scrie (integritate, și în context
  de serviciu). Aceeași clasă: responsabilul și departamentul ales sunt ale firmei.
- **Conservarea scoate planurile din `expirables`; casarea scoate și autorizațiile
  ISCIR** (`maintenance_plan_exp` și `iscir_autorizatie_exp` se uită la echipament; planul
  rămâne în scadențe doar pe `in_functiune` și `in_reparatie`). Conservarea NU scoate
  autorizația: expiră oricum, iar repunerea în funcțiune cere una valabilă. Repunerea le
  readuce prin triggerul `equipment_dupa_stare`. Garanția e un rând `equipment`/`garantie`
  (`equipment_exp`), retras când data dispare — și la casare sau ștergere.
- **Resincronizarea scadențelor la schimbarea stării se face direct prin `sync_expirable`**
  (`plan_exp_sync`, `iscir_exp_sync`), nu prin UPDATE pe planuri, iar `ssm_plan_calc`
  recalculează doar când i se schimbă intrările: o scadență restantă nu se mută în viitor
  când utilajul intră în reparație. — capcana #52
- **Punctul de lucru se citea doar prin lista de opțiuni**, iar aceea cere
  `maintenance:update`: fișa arăta „Setat” în loc de nume cuiva care doar citește. Numele
  vine acum din `numelePunctuluiDeLucru` — o citire pe `puncte_lucru`, filtrată pe firmă
  și pe rândul neșters — făcută doar când lista lipsește. Pentru cine n-are
  `departments:read` rezultatul e `null`, fără eroare, iar fișa rămâne la „Setat”. —
  capcana #57
- **Linkul spre sesizarea unei opriri apare doar dacă sesizarea a venit prin RLS**:
  oprirea se vede la scope `team`, sesizarea nu, când raportorul e din afara echipei — se
  verifică în rândurile deja citite, altfel linkul ducea într-un refuz. Același test pe
  caseta „Utilajul nu funcționează” și în istoricul opririlor.
- **Ștergerea logică cere `maintenance:delete = all` în gardă** (nu doar în acțiune), iar
  un echipament șters nu se restaurează din aplicație.
- **Valoarea de achiziție NU stă pe rândul echipamentului** (0232, Y1): îl văd și
  responsabilul și tehnicianul atribuit, iar RLS-ul nu taie coloane. Stă în
  `equipment_costuri` (1:1, fără `deleted_at`, unic total — `on_conflict`), citită de
  `app.poate_vedea_valoarea_echipamentelor`: `maintenance:update = all` sau `read >= team`
  (cheia costurilor intervențiilor). Responsabilul și tehnicianul primesc embed-ul `null`,
  fără eroare. O scrie doar `update = all`: gestionarul pe `team` nu primește câmpul, iar o
  valoare trimisă totuși de el e INTERZIS în acțiune, 42501 în bază. Coloana veche e
  goală, cu CHECK `is null`; o valoare nenulă scrisă în ea se mută (trigger BEFORE), fără
  defectul de upsert al lui 0225 (`[[modul/flota/service-si-costuri]]`). `ec_inainte`
  pune garda de firmă PRIMA: un rând pe firma altcuiva ia 42501 orice id ar purta, fără
  sondă „există echipamentul X acolo?”. Garda e scrisă `not coalesce(…, false)`: pe un
  `organization_id` lăsat gol comparația e NULL, `not NULL` nu ridică, iar `not null`-ul
  coloanei se judecă abia după `WITH CHECK` — forma fără `coalesce` ar fi redeschis sonda
  exact pe scrierea cu firma goală. `0233` caută forma veche în toate funcțiile vii și
  cade dacă o găsește. Probele: `proba-costuri-compatibilitate.sql` (2),
  `proba-migrari-pe-date.sql` (12).
- **Exportul CSV** e un eveniment de audit (`log_audit_event`, `equipment`), plafonat la
  `MAX_RANDURI` din lista filtrată — iar faptul că a tăiat intră în audit ca `trunchiat`,
  fiindcă în fișier nu se vede.

## Când NU e suficientă pagina asta

- Textul fiecărei verificări: `tests/rls/proba-echipamente-ciclu.sql`.
- Contractul acțiunilor: `echipamente/actions.test.ts`, `actions-echipamente.test.ts`.
- Maparea `FormData` → coloane (bife lipsă, `Number("")`): `valori-echipament.test.ts`.
- Sesizarea ca flux (tehnician, opriri): [[modul/mentenanta/sesizari]].
