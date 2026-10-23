---
tip: modul
titlu: Angajați — importul și refuzurile care nu deosebesc firmele
aliases: [import angajati, import_uploads, hr_read_sensitive, oracol de existenta]
cai:
  - "src/app/(app)/angajati/import/**"
  - "src/lib/import/incarcare.ts"
  - "supabase/migrations/0226_securitate_reziduala.sql"
  - "tests/rls/proba-securitate-reziduala.sql"
tabele: [import_uploads, employees, employee_sensitive_data, leave_balances]
permisiuni: [employees:read, employees:create, employees:update]
capcane: []
scris_pe: 39b722927256b17b7eb5903a5404da19db53378a
scris_la: 2026-10-23
tags: [modul, hr, nucleu]
---

# Angajați — importul și refuzurile care nu deosebesc firmele

Secțiune extrasă din [[modul/angajati]] (pagina principală e la plafon): două reguli de
securitate din 0226 (X2), cu proba lor în `tests/rls/proba-securitate-reziduala.sql`.

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

Cheile străine COMPUSE spre `employees` (`(employee_id, organization_id)`) nu sunt o
sondă: id-ul inventat și cel din altă firmă dau același 23503, cu același mesaj (proba (8)),
iar pe un rând al altei firme RLS-ul refuză înaintea cheii. Un trigger care caută angajatul
ÎNAINTE de cheie trebuie să înceapă cu garda de firmă.
