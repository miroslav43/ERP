---
tip: date
titlu: Perioade și tranziții de stare
aliases: [perioade, tranzitii, luna-de-pontaj]
cai:
  - "supabase/migrations/0013_attendance.sql"
  - "supabase/migrations/0026_payroll.sql"
  - "supabase/migrations/0009_leave.sql"
  - "supabase/migrations/0079_concedii_anulare_dupa_aprobare.sql"
  - "supabase/migrations/0132_pontaj_luni_deschise_implicit.sql"
  - "supabase/migrations/0146_bani_si_timp.sql"
  - "supabase/migrations/0233_oracol_intre_firme.sql"
tabele: [attendance_periods, attendance_entries, payroll_periods, leave_requests, approval_tasks]
permisiuni: [attendance:approve, payroll:create, payroll:update, payroll:approve]
capcane: [6, 7, 9, 12, 17]
scris_pe: daa23bafd3b2f07d33e50bb968134ab39c11c965
scris_la: 2026-11-02
tags: [date]
---

# Perioade și tranziții de stare

**Luna e obiectul care leagă pontajul, concediile și salarizarea.** Trei mașini de stări
separate, care se blochează una pe alta într-o ordine fixă. Cine caută „de ce nu se aplică
tranziția" ajunge aproape întotdeauna la una dintre cele trei, iar mecanismul refuzului e
diferit la fiecare.

## Lanțul

```
attendance_periods: deschisa → in_aprobare → blocata
                                                 └── abia acum payroll_periods poate ieși din draft
leave_requests în ('trimisa','in_aprobare') suprapuse peste lună → BLOCHEAZĂ calculul
```

Luna de pontaj **nu mai trebuie deschisă de nimeni**: din
`0132_pontaj_luni_deschise_implicit.sql` se naște singură, în `deschisa`, la prima scriere
din luna aceea — `internal.pontaj_perioada_lunii`, `security definer`, deci fără nicio
politică lărgită (`attendance_periods_insert` cere tot `attendance:create = all` pentru un
INSERT direct). `internal.pontaj_intrare_pregateste`, în forma curentă din
`0146_bani_si_timp.sql`, ridică P0001 doar în două cazuri: nașterea a eșuat, sau luna e
`blocata`. Din `0146` e refuzată și mutarea unei zile **dintr-o** lună `blocata` în alta —
garda se uită acum și la luna sursă, nu doar la cea în care aterizează ziua.

Refuzul pe `blocata` are scutire `app.is_service_context()` în trigger, deci sincronizarea
concediilor scrie și într-o lună sigilată; butonul „Sincronizează concediile"
(`app.sincronizeaza_pontaj_concedii`) nu are scutirea și refuză luna `blocata`.
Sincronizarea rămâne best-effort, iar o aprobare de concediu rămâne dată chiar când
scrierea în pontaj pică — v. [[modul/concedii]].

## Perioada de pontaj — trei stări, tranzițiile enumerate

`attendance_period_status` = `deschisa`, `in_aprobare`, `blocata`
(`0013_attendance.sql`). Permise, exact acestea:

| Din           | În                       |
| ------------- | ------------------------ |
| `deschisa`    | `in_aprobare`, `blocata` |
| `in_aprobare` | `deschisa`, `blocata`    |
| `blocata`     | `deschisa`               |

Orice altceva — inclusiv `blocata` → `in_aprobare` — ridică **P0001**. Redeschiderea duce
mereu în `deschisa`, niciodată înapoi în `in_aprobare`.

Intrarea sau ieșirea din `blocata` cere în plus `attendance:approve` la scope **`all`**;
un manager cu `team` primește **42501**. Butonul se ascunde cu `can(..., "all")` în loc să
fie lăsat să eșueze. — capcana #9

`an`, `luna`, `data_inceput` și `data_sfarsit` se calculează la INSERT și se **rescriu din
OLD** la fiecare UPDATE: trimise de client, sunt ignorate tăcut, nu respinse. La fel
`blocata_la`/`blocata_de`. — capcana #6

## Cererea de concediu — șapte stări, refuz de două feluri

`leave_request_status` = `ciorna`, `trimisa`, `in_aprobare`, `aprobata`, `respinsa`,
`anulata`, `intrerupta` (`0009_leave.sql`).

Din `aprobata` se mai poate ieși doar spre `anulata` sau `intrerupta`
(`0079_concedii_anulare_dupa_aprobare.sql`) — restul e capăt de drum.

Aici sunt **trei** mecanisme de refuz, și se confundă ușor. Primele două vin din
`internal.leave_requests_pregateste`, a cărui formă curentă e în
`0233_oracol_intre_firme.sql`:

- **42501**, verificat primul: cererea e scrisă pe o firmă care nu e în
  `app.current_org_ids()`.
- **P0001, cu mesaj**: tip inexistent, dezactivat **sau din altă firmă** — toate trei
  primesc deliberat același mesaj, ca să nu spună dacă tipul există la vecin; angajat din
  altă organizație; document lipsă la trimiterea unui tip care-l cere; dată de început mai
  veche de doi ani. Excepția la document: `medical`, `maternitate` și `donator_sange` au
  `necesita_document`, dar originalul se predă pe hârtie, deci trimiterea nu așteaptă
  fișier — aceleași chei, în aceeași ordine, ca `TIPURI_CU_ORIGINAL_FIZIC` din
  `src/domain/leave/documente-fizice.ts`.
- **Zero rânduri, fără nicio eroare**, când politica RLS respinge tranziția prin clauza
  `USING` — cazul canonic e un angajat care încearcă `in_aprobare` → `aprobata` pe propria
  cerere. Orice acțiune de tranziție face `.select()` după `.update()` și tratează
  rezultatul gol drept conflict. — capcana #17

Ultimul e cel periculos: omul vede „succes" fără ca nimic să se fi schimbat.

## Perioada de salarizare — patru stări, `inchis` e terminal

`payroll_period_status` = `draft`, `calculat`, `aprobat`, `inchis` (`0026_payroll.sql`).
`internal.payroll_periods_tranzitie` verifică, în ordine:

| Tranziția               | Ce cere                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| orice, din `inchis`     | **imposibilă** — P0001. Corecția se face printr-o perioadă nouă, nu prin redeschidere                                          |
| fără schimbare de stare | `payroll:update = all`, altfel 42501 — și editarea totalurilor e o scriere                                                     |
| → `calculat`            | `payroll:create = all`; pontajul lunii **blocat**; **zero** cereri de concediu în `trimisa`/`in_aprobare` suprapuse peste lună |
| → `draft`               | numai din `calculat`; `payroll:update = all`; șterge `calculat_de`/`calculat_la`                                               |
| → `aprobat`             | numai din `calculat`; `payroll:approve = all`                                                                                  |
| → `inchis`              | numai din `aprobat`; `payroll:approve = all`                                                                                   |

„Perioada nu se recalculează" are deci trei cauze distincte, toate cu mesaj: pontajul nu e
blocat, există cereri de concediu în așteptare peste lună, sau perioada e deja `inchis`.

`app.is_service_context()` scurtcircuitează triggerul, la pontaj și la salarizare deopotrivă
— o migrare sau un job care rulează în context de serviciu trece prin toate verificările de
mai sus fără să le atingă.

## Rânduri care nu se schimbă și coloane care nu există

Nu toată familia are `deleted_at`. `checklist_completion_records` nu-l are, deci un
`.is("deleted_at", null)` pe ea dă **42703**, iar un trigger BEFORE refuză orice UPDATE sau
DELETE cu P0001: rândul îl scrie exclusiv triggerul de finalizare. Nicio tabelă
`attendance_*` sau `checklist_*` nu are politică DELETE — ștergerea e logică peste tot.
— capcana #12

Indexurile unice ale familiei sunt **parțiale** (`where deleted_at is null`), iar PostgREST
nu emite predicatul în `ON CONFLICT`: un `.upsert()` cade cu **42P10**. Salvarea unei zile
de pontaj și sincronizarea cu concediile se fac citire-apoi-INSERT-sau-UPDATE.
— capcana #7

## Când NU e suficientă pagina asta

- Ecranele și acțiunile care produc tranzițiile: [[modul/pontaj]], [[modul/concedii]],
  [[modul/salarizare]].
- Cine are voie să apese: [[rol/manager]], [[rol/hr]].
