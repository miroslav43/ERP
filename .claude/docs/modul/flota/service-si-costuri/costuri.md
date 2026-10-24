---
tip: modul
titlu: Flotă — service, costuri, anvelope — costul vehiculului
aliases: [vehicle_costuri, vehicle_document_costuri, cost pe km, valoare de achiziție]
cai:
  - "supabase/migrations/0225_flota_costuri_ascunse.sql"
  - "src/app/(app)/flota/[id]/fila-costuri.tsx"
  - "src/domain/fleet/costuri.ts"
  - "src/lib/queries/fleet-service.ts"
  - "tests/rls/proba-costuri-compatibilitate.sql"
tabele: [vehicle_costuri, vehicle_document_costuri, vehicle_expenses, vehicles]
permisiuni: [vehicles:read, vehicles:update, vehicles:create, trip_sheets:read, payroll:read]
feature: fleet
capcane: []
scris_pe: c1ad3b039681d8b4d5f1f466c0c2a4e7f3ab67f8
scris_la: 2026-10-24
tags: [modul, operations]
---

# Flotă — costul vehiculului

Secțiune extrasă din [[modul/flota/service-si-costuri]], care ajunsese la plafonul de corp
al convenției vault-ului (`.claude/docs/meta/conventii.md`): totalul de pe fila Costuri și
valorile de cost scoase de pe rândul vizibil (0225). Service-ul, anvelopele, acțiunile și
restul lui „ce refuză baza tăcut” rămân acolo; pagina de modul e [[modul/flota]].

## Ce refuză baza tăcut

- **Valoarea de achiziție și costul documentelor NU stau pe rândul vizibil** (0225, X1).
  Erau coloane pe `vehicles` / `vehicle_documents`, rânduri pe care le văd șoferul (mașina
  lui, pool), managerul (pool) și hr-ul cu mașină (0215): RLS-ul nu taie coloane. Acum
  stau în `vehicle_costuri` și `vehicle_document_costuri` (1:1, fără `deleted_at`, unic
  TOTAL pe părinte — `on_conflict` nu poate numi un index parțial, 42P10), citite prin
  `app.poate_vedea_costurile_vehiculului` — aceeași funcție ca planurile, intervențiile și
  cheltuielile (definită în 0203, 0225 n-o rescrie). Excepție deliberată:
  `avantaj_natura_flota` (`payroll:read = all`) dă și lui hr valoarea de intrare (art. 76
  Cod fiscal). Restul primește embed-ul `null`, fără eroare; fișa ascunde rândul „Valoare” și coloana „Cost”. Aplicația scrie explicit
  (insert la creare doar cu valoare, upsert la corectură, și cu `null`, ca golirea să golească).
- **Coloanele vechi sunt goale, nu aruncate** (aplicația veche le citește până la deploy).
  O valoare NENULĂ scrisă în ele (aplicația veche, scripturi, fixture-uri) se mută în
  tabela de costuri în aceeași instrucțiune (BEFORE, cheie străină DEFERRABLE); `null` se
  ignoră, ca o corectură din aplicația veche să nu șteargă costul mutat. CHECK `is null`
  e plasa dacă triggerul e oprit (23514). Citirea lor e oprită de `coloane.test.ts`.
  Mutarea pe date existente o verifică `proba-migrari-pe-date.sql` (11) și (10l).
- **Triggerul de mutare rulează ÎNAINTEA conflictului** din
  `INSERT … ON CONFLICT DO NOTHING` (upsert-ul PostgREST cu `ignore-duplicates`): cu id-ul
  unui rând al altei firme, WITH CHECK trecea pe rândul propus, iar costul străin era
  rescris. Acum un id care EXISTĂ golește coloana fără mutare, `do update` atinge doar
  rândul aceleiași firme (altfel P0001), iar `vc_inainte` / `vdc_inainte` verifică firma
  părintelui și cu steagul `app.flota_cost_mutat` pus. Garda de firmă e PRIMA în ele: un
  rând pe firma altcuiva ia 42501 orice id ar purta (fără sondă de existență). Proba:
  `proba-costuri-compatibilitate.sql` (1).
- **Inserarea costului cere `vehicles:update = all`**; `create = all` singur o face DOAR
  pe vehiculul / documentul creat de el în ultimele 5 minute
  (`app.vehicul_creat_de_apelant`, `app.document_creat_de_apelant`), adică valoarea
  inițială, din a doua cerere a acțiunii. `created_at`-ul lor îl scrie baza la INSERT
  (`internal.flota_creat_acum`), deci fereastra nu se mută. Corectura (`do update`) îi
  rămâne refuzată. Proba: (1l), (1m).

## Costuri

Totalul adună patru surse, fiecare cu originea ei, ca nimic să nu fie numărat de două
ori: service (`cost_total`), combustibilul de pe foile APROBATE, cheltuielile fără foaie
(inclusiv „combustibil fără foaie”) și costul documentelor cu valabilitatea începută în
perioadă (din `vehicle_document_costuri`, embed `!inner`). Costul pe km și consumul real se împart la kilometrii foilor aprobate din
aceeași perioadă; fără foi, cifra lipsește (și ecranul spune de ce), nu devine „0 lei/km”.
Combustibilul fără foaie nu intră în consum: n-are kilometri cu care să fie pereche.
Adunările trec prin bani întregi (`sumaLei`).

**Foile se citesc sub alt drept decât service-ul.** Service-ul, cheltuielile și documentele
sunt COMPLETE pentru orice vehicul cu filele deschise (`vehicles:read >= team`); foile și alimentările
se citesc sub `trip_sheets:read`, iar la `team` (managerul) RLS le taie TĂCUT la foile
șoferilor echipei, pe un vehicul pe care îl conduc și alții. De aceea `FilaCosturi` primește
`vedeToateFoile = can(trip_sheets:read, all)`: fără el foile nu se interoghează, totalul
exclude combustibilul de pe foi (și se numește „fără foi”), iar kilometrii, costul pe km și
consumul nu se afișează, cu motivul scris pe ecran. Un cost pe km împărțit la kilometri
parțiali ar ieși umflat, fără eroare.

## Când NU e suficientă pagina asta

Forma politicilor, a trigger-elor și a drumului de compatibilitate: migrarea
`0225_flota_costuri_ascunse.sql`. Probele: `tests/rls/proba-costuri-compatibilitate.sql`
și continuarea (l) din `tests/rls/izolare.sql`. Rapoartele lunare și pachetul pentru
contabil: [[modul/flota/rapoarte]].
