---
tip: modul
titlu: Angajați — importul și refuzurile care nu deosebesc firmele
aliases: [import angajati, import_uploads, hr_read_sensitive, oracol de existenta]
cai:
  - "src/app/(app)/angajati/import/**"
  - "src/lib/import/incarcare.ts"
  - "supabase/migrations/0226_securitate_reziduala.sql"
  - "tests/rls/proba-securitate-reziduala.sql"
  - "supabase/migrations/0233_oracol_intre_firme.sql"
  - "tests/rls/proba-oracol-intre-firme.sql"
tabele: [import_uploads, employees, employee_sensitive_data, leave_balances, employment_contracts]
permisiuni: [employees:read, employees:create, employees:update]
capcane: []
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, hr, nucleu]
---

# Angajați — importul și refuzurile care nu deosebesc firmele

Secțiune extrasă din [[modul/angajati]] (pagina principală e la plafon): regulile pe
care baza le aplică fișei de angajat fără să deosebească firmele — cele două din 0226
(X2), cu proba lor în `tests/rls/proba-securitate-reziduala.sql`, și trecerea
sistematică din `supabase/migrations/0233_oracol_intre_firme.sql`, cu
`tests/rls/proba-oracol-intre-firme.sql`.

## Lotul de import e emis de bază

`pregatesteIncarcareaImportului` scrie lotul în `public.import_uploads` (`resursa =
'employees'`) ÎNAINTEA URL-ului semnat, FĂRĂ id: `internal.import_uploads_inainte` dă un
id nou și mută calea sub folderul lui, păstrând doar numele fișierului. Acțiunea semnează
exact `id, cale` întoarse de `.select()`. `analizeazaImportAngajati` descarcă fișierul,
apoi CONSUMĂ rândul — un UPDATE cu `.select()` pe id, firmă, resursă, cale, `created_by =
apelantul`, `consumat_la is null` — și abia atunci șterge sursa cu clientul admin. Zero
rânduri = CONFLICT, nimic șters.

De ce: segmentul 3 al unei căi `{org}/employees/…` e de obicei id-ul unei FIȘE. Cu
`batchId` = id-ul unui angajat și calea unui document al lui, prefixul trecea, iar
clientul de serviciu ștergea contractul sau buletinul scanat, ocolind orice politică.
Id-ul NU poate veni de la client nici în registru: tabela se scrie și direct prin
PostgREST, iar cu id-ul păstrat un hr înregistra `id` = fișa, `cale` = contractul, și
consumul trecea (proba (3g)).
Helperii sunt în `src/lib/import/incarcare.ts`; importul extraselor de card folosește
aceeași poartă, pe `vehicles` ([[modul/flota/carduri]]), și o cere încă o dată la aplicare
(`incarcareAnalizata`). `aplicaImportAngajati` citește lotul JSON din Storage
(`caleLotImport`), sub RLS-ul apelantului, nu registrul.

Ce refuză baza: lotul altui utilizator (și al unui coleg org_admin) e invizibil (politica
cere `created_by = auth.uid()`); o cale în afara lotului dă 23514 (`iup_cale_ck`); rolul
fără `<resursă>:create = all` primește 42501; consumul nu se rescrie (P0001).

## Un singur răspuns pentru „nu există” și „e în altă firmă”

`hr_read_sensitive`, `hr_write_sensitive`, `seed_leave_balances` și triggerul lanțului de
manageri (`tg_employees_manager_path`) caută fișa DOAR în firmele apelantului. Înainte
spuneau „aparține altei organizații” pentru un id din altă firmă și „nu există” pentru
unul inventat: orice utilizator autentificat afla, id cu id, ce angajați au celelalte
firme. Acum toate trei cazurile (inexistentă, ștearsă, străină) dau același P0001.

La un trigger, căutarea în firma rândului nu ajunge: BEFORE rulează înaintea WITH CHECK,
deci un rând pus pe firma VICTIMEI trecea când managerul exista acolo (apoi 42501 de la
politică) și primea P0001 când nu. `tg_employees_manager_path` începe de aceea cu garda de
firmă (42501 neutru, proba (1f)); fiind primul BEFORE pe `employees`, îi acoperă și pe
ceilalți.

Garda se scrie `not coalesce(org = any (current_org_ids()), false)`: pe `organization_id`
null, forma fără `coalesce` e NULL și nu ridică, iar NOT NULL se judecă abia după WITH
CHECK (0233 §3, proba-oracol-intre-firme §n). Forma veche nu mai e nicăieri: verificarea
§11 a lui 0233 citește, la aplicare, definițiile tuturor funcțiilor vii din `public`,
`internal` și `app` și oprește migrarea dacă mai găsește o gardă fără `coalesce`.

Tot din 0233 (§8), contractul (`tg_contracts_validari`) caută angajatul doar în firma lui,
după aceeași gardă: un singur P0001, „Angajatul indicat nu există în organizația
dumneavoastră.”, în locul perechii cu „aparțin unor organizații diferite”. Proba rulează
aceeași scriere de două ori — cu un angajat care există în firma vecină și cu un id
inventat — și cere răspunsuri identice: 42501 neutru pe un contract pus pe firma vecină
(g26), același 42501 pe un contract lăsat fără firmă (n12, locul unde garda fără
`coalesce` trecea) și același P0001 pe un contract al firmei proprii (h5). Poarta pozitivă
e p9: cu garda pusă, un `hr` întocmește în continuare contractul unui angajat al firmei
lui.

Cheile străine COMPUSE spre `employees` (`(employee_id, organization_id)`) nu sunt o
sondă: id-ul inventat și cel din altă firmă dau același 23503, cu același mesaj (proba (8)),
iar pe un rând al altei firme RLS-ul refuză înaintea cheii. Un trigger care caută angajatul
ÎNAINTE de cheie trebuie să înceapă cu garda de firmă.
