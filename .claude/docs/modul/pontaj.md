---
tip: modul
titlu: Pontaj
aliases: [attendance, prezenta]
cai:
  - "src/app/(app)/pontaj/**"
  - "src/lib/queries/attendance.ts"
  - "src/schemas/attendance.ts"
  - "src/domain/attendance/**"
tabele:
  [
    attendance_periods,
    attendance_entries,
    attendance_settings,
    attendance_approval_batches,
    attendance_week_submissions,
    attendance_week_submission_days,
    setari_pontare_rapida,
    puncte_lucru,
  ]
permisiuni: [attendance:read, attendance:create, attendance:update, attendance:approve]
feature: attendance
capcane: [2, 6, 7, 9, 17]
citeste_daca:
  - "buton de aprobare care nu apare → [[rol/manager]]"
  - "tranziție de perioadă respinsă → [[date/pontaj]]"
scris_pe: 2e9e70f178c4a0c33ce2e8ad0a4d0f7f9e3a4d68
scris_la: 2026-08-31
tags: [modul, hr]
---

# Pontaj

Evidența zilnică a prezenței, pe perioade lunare care se deschid, se aprobă în loturi și
se blochează. Are trei fluxuri paralele: **ziua** (`attendance_entries`, interval
completat de mână prin `salveazaZiPontaj`), **săptămâna planificată**
(`attendance_week_submissions`, trimisă de angajat și decisă de manager) și
**pontarea rapidă** (`0096_pontaj_rapid.sql` — ceas „Am intrat"/„Am ieșit" sau
confirmarea zilei standard, apăsate din portal, scrise tot în `attendance_entries` cu
`sursa = pontare_rapida`).

## Paginile modulului

Pagina asta e trunchiul: ce e modulul, cine ajunge unde, cum arată cele trei vizualizări
și ce refuză baza fără să spună. Restul s-a spart pe subarborele de rute, fiindcă trecuse
de plafonul dur de 12 KB al convenției (`.claude/docs/meta/conventii.md`).

| Pagină                     | Ce ține                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| [[modul/pontaj/actiuni]]   | cele treisprezece Server Actions, citirile din `queries/attendance.ts`, ce se mișcă împreună la o schimbare de formă |
| [[modul/pontaj/saptamana]] | planul săptămânal, RPC-ul care face `delete` + reinserare, legătura plan ↔ fapt |
| [[modul/pontaj/setari]]    | pontarea rapidă (0115), aprobarea ca alegere a firmei (0118), limitele legale |

## Rute și cine ajunge

| Rută                    | Poartă                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/pontaj`               | `attendance:read` cu scope citit prin `scopeFor`; butoanele cer `create` own/all, `approve` team, `update` all |
| `/pontaj?vizualizare=…` | aceeași poartă; vezi „Cele trei vizualizări" mai jos                                                           |
| `/pontaj/aprobare`      | `attendance:approve` team; blocarea cere `all`                                                                 |
| `/pontaj/perioade`      | `attendance:approve` team/all, `attendance:create` all                                                         |
| `/pontaj/perioade/[id]` | `attendance:read` team                                                                                         |
| `/pontaj/saptamana`     | `attendance:create` own; decizia cere `approve` team                                                           |
| `/pontaj/setari`        | `attendance:update` all — fila **Pontarea**: `mod_pontare_rapida`, `verificare_pontare`, `program_start`       |
| `/pontaj/setari/reguli` | `attendance:update` all — fila **Regulile de timp**: parametrii juridici versionați                            |

Toate trec întâi prin `requireFeature(tenant.organizationId, "attendance")`.

## Cele trei vizualizări ale lui `/pontaj`

`?vizualizare=` cu `saptamana` · `luna` · `lista`. **Implicita depinde de ROL**
(0118): `implicitaPentruScope` din `vizualizari.ts` dă `lista` pentru cine vede și
pontajul altora (`scope !== "own"` — `org_admin`, `hr`, `all`; `manager`, `team`) și
`saptamana` pentru angajat. Valoarea implicită e ștearsă din adresă de
`ComutatorVizualizare`, deci `/pontaj` curat înseamnă lucruri diferite pentru roluri
diferite — iar pagina TREBUIE să dea aceeași implicită și schemei
(`vizualizareaCeruta`), și comutatorului, altfel butonul vizualizării implicite duce
la o adresă care se citește altfel decât s-a scris.
Enumul și opțiunile stau în `vizualizari.ts`; comutarea folosește primitiva
`ComutatorVizualizare`, deci starea e în adresă și nu se livrează JavaScript pentru ea.

- **`saptamana`** — grila orară a pontajului PROPRIU, `?saptamana=<luni ISO>`.
  Implicită doar pentru `employee`: pentru un `org_admin` sau `hr` grila arată propria
  lui săptămână, deci ateriza în ea în loc să vadă firma pe care o administrează.
  Se pontează trăgând peste o zonă dintr-o zi; la eliberare se deschide `CelulaZi` cu intervalul
  precompletat (`oraInceputInitiala`/`oraSfarsitInitiala`, care BAT `intrare`). Fereastra
  e 06:00–22:00, lărgită de `intervalulGrilei` cât să cuprindă orice intrare din afara ei.
  Tragerea e doar cu mausul: pe telefon `touch-action: none` ar bloca derularea paginii,
  deci acolo atingerea deschide dialogul cu intervalul propus — aceeași cale ca tastatura.
- **`luna`** — calendar de 7 coloane cu TOȚI angajații, max 3 pe zi plus „+N alții"
  (citibili prin `sr-only`, nu prin `title`). Server Component pur, needitabil.
- **`lista`** — foaia colectivă, neschimbată.

`luna` și `lista` se hrănesc din ACELEAȘI citiri și se ramifică abia la randare
(`LunaIntreaga` din `page.tsx`); o a doua citire ar fi însemnat două ecrane care pot
arăta lucruri diferite pentru aceeași lună. Aritmetica grilei orare e în
`src/domain/attendance/grila-orara.ts`, cu teste — inclusiv cel purtător: orice tragere
produce un interval pe care `oreleZilei` îl acceptă.

Săptămâna se ancorează în luna din adresă (`an`+`luna`), iar comutatorul completează
cheia care lipsește în cealaltă direcție — altfel comutarea ar sări în altă perioadă
decât cea de pe ecran.

## Ce refuză baza tăcut

Secțiunea care justifică pagina. Fiecare rând are artefact.

- **Coloanele calculate de triggere BEFORE nu se trimit din client**:
  `attendance_periods.data_inceput`/`data_sfarsit`/`blocata_la`/`blocata_de`,
  `attendance_entries.period_id` și `tip_zi` când e null. În plus, politicile INSERT
  **cer** `approved_at`/`approved_by`/`batch_id` = NULL,
  `attendance_approval_batches.linii_aprobate` = 0, `attendance_periods.status` =
  `deschisa`. Un INSERT cu doar (organization_id, an, luna) reușește. — capcana #6
- **`.upsert()` cade cu 42P10.** `attendance_entries_zi_uq` e index unic **parțial**
  (`where deleted_at is null`), iar PostgREST nu emite predicatul în `ON CONFLICT`.
  Salvarea unei zile și sincronizarea cu concediile se fac citire-apoi-INSERT-sau-UPDATE.
  — capcana #7
- **Tranzițiile perioadei sunt exact**: `deschisa`→{`in_aprobare`, `blocata`},
  `in_aprobare`→{`deschisa`, `blocata`}, `blocata`→`deschisa`.
  `blocata`→`in_aprobare` ridică P0001. Blocarea și deblocarea cer scope **all** — un
  manager cu `team` primește 42501, deci butonul se ascunde cu
  `can(permisiuni, "attendance:approve", "all")`. — capcana #9
- **Un UPDATE respins de `USING` afectează zero rânduri, fără eroare.** Orice tranziție
  face `.select()` după `.update()` și tratează rezultatul gol drept conflict. — capcana #17
- **Foaia colectivă se paginează după ANGAJAT, nu după rânduri de pontaj.** PostgREST
  trunchiază tăcut peste `max_rows`; angajați × zile depășește pragul altfel. — capcana #2
- **O zi deschisă și neînchisă nu poate fi aprobată**: constrângerea
  `attendance_entries_aprobare_zi_incheiata_ck` (`0096_pontaj_rapid.sql`) cere ca
  `approved_at` să fie null cât timp există `ora_inceput` fără `ora_sfarsit`. 23514 NU e
  tradus de `traduEroare`, iar el ar cădea pe ÎNTREG lotul — de aceea `aprobaPontajBloc`
  filtrează zilele în curs înainte, le numără și întoarce `zileDeschise`. Constrângerea e
  plasa de sub filtru, nu invers; fără ea, „Am ieșit" de după aprobare e respins tăcut de
  `USING`. — capcana #17
- **`intrariProprii` NU filtrează pe `employee_id`** — se bazează pe RLS. Corect pentru
  un `employee`, dar pentru scope `all` (`hr`, `org_admin`) RLS nu îngustează nimic, deci
  funcția întoarce pontajul ÎNTREGII firme. Orice ecran „al meu" trebuie să rezolve fișa
  explicit și să filtreze pe ea: `sectiune-saptamana.tsx` cheamă `fisaMea` + `intrariLuna(org, [fisa], …)`.
  `fisaMea`, nu `idFisaProprie`: `app.current_employee_id()` CERE `is_primary`, în timp ce
  a doua doar sortează după el — de aici starea `fara_principala`, un cont care își vede
  marca și căruia baza îi refuză orice scriere.
- **`oraOptionala` respinge ora brută din Postgres.** Coloana `time` sosește `"08:30:00"`,
  iar schema cere `^([01]\d|2[0-3]):[0-5]\d$`. Cine deschidea o zi cu interval din foaia
  colectivă, schimba doar observația și apăsa „Salvează" primea eroare de validare pe un
  câmp neatins. Normalizarea se face o singură dată, în `intrareaClient`
  (`intrare-client.ts`), care e acum singurul constructor al formei de client — testat în
  `intrare-client.test.ts`, inclusiv perechea brut-respins / normalizat-acceptat.
- **`employee` nu-și poate citi propria fișă cu clientul autentificat**: politica
  `employees_select` (`0005_hr_rls.sql`) nu deschide drumul, deci `fisaProprie` folosește
  `createAdminSupabase()` cu filtru explicit pe `organization_id` și cere
  `is_primary = true`, cerința lui `app.current_employee_id`. Același motiv pentru
  `puncte_lucru`: `puncte_lucru_select` (`0030_onboarding_companie.sql`) cere
  `departments:read`, pe care rolul `employee` nu-l are, deci codul de pe afiș se rezolvă
  tot cu clientul admin, filtrat pe organizație. — `0096_pontaj_rapid.sql`

## Erori traduse

`src/app/(app)/pontaj/erori.ts`, funcția `traduEroare` (tip `never`, întrerupe fluxul
ca un `throw`):

- **23505** → mesaj propriu: ziua există deja pentru angajatul acela.
- **P0001** → mesajul triggerului **se propagă**, trunchiat. Deliberat: mesajele din
  `0013_attendance.sql` conțin cifrele („perioada 08.2026 este blocată"), iar traducerea
  generică le-ar înlocui cu un text fără informație. `error.details` și `error.hint` nu
  se propagă niciodată.

## Ce NU e aici

Concediile (`[[modul/concedii]]` — pontajul doar le sincronizează prin
`sincronizeazaConcediile`), sporurile și agregarea în state de plată
(`[[modul/salarizare]]`), și fișa angajatului (`[[modul/angajati]]`).

Butoanele pontării rapide nu sunt sub `/pontaj`: ecranele stau în
`src/app/(portal)/portal/`, iar afișul cu cod QR și rotirea lui `cod_pontaj` în
`src/app/(app)/puncte-lucru/`. Aici sunt doar acțiunile pe care le apelează și setările
care le pornesc.

## Când NU e suficientă pagina asta

- Calculul efectiv al orelor și al intervalului de noapte: `src/domain/attendance/` și
  `src/app/(app)/pontaj/interval-noapte.ts`.
- Forma exactă a politicilor: migrarea `0013_attendance.sql`, care e și scheletul canonic
  pentru orice migrare nouă.
- Coloanele și tipurile pontării rapide, cu motivele lor: `0096_pontaj_rapid.sql`.
