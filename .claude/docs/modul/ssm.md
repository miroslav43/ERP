---
tip: modul
titlu: SSM și PSI
aliases: [ssm, psi, protectia-muncii]
cai:
  - "src/app/(app)/ssm/**"
  - "src/lib/queries/ssm.ts"
  - "src/schemas/ssm.ts"
  - "src/domain/ssm/**"
  - "supabase/migrations/0011_ssm.sql"
  - "supabase/migrations/0021_fix_instruiri_ssm.sql"
tabele:
  [
    ssm_trainings,
    ssm_training_types,
    ssm_training_type_periods,
    occupational_health_exams,
    employee_work_restrictions,
    work_accidents,
    ppe_issuances,
    fire_extinguishers,
    fire_extinguisher_checks,
    personnel_authorizations,
    ssm_legal_parameters,
  ]
permisiuni: [ssm:read, ssm:create, ssm:update]
feature: ssm
capcane: [26, 32]
citeste_daca:
  - "listă goală fără eroare la scadențe → [[rol/hr]]"
  - "instruire periodică respinsă la salvare → [[modul/ssm/instruiri]]"
  - "listă goală cu `?scadenta=` în adresă → „Ce refuză baza tăcut”"
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul, hr]
---

# SSM și PSI

Instruiri periodice, medicina muncii cu restricții de aptitudine, accidente de muncă și
comunicarea lor la ITM, echipament individual de protecție, stingătoare cu verificări, și
autorizații nominale. Rolul care îl administrează e `hr` — care, tocmai de asta, are aici
cele mai multe refuzuri tăcute din proiect.

## Paginile modulului

| Pagină                  | Ce ține                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| [[modul/ssm/actiuni]]   | Server Actions + refuzurile tăcute de pe calea de scriere          |
| [[modul/ssm/erori]]     | ce coduri traduce `erori.ts` și ce aruncă mai departe; etichetele  |
| [[modul/ssm/instruiri]] | defectul `0021`: cheia de scadență cu două puncte, și cum a scăpat |

## Rute și cine ajunge

| Rută                                        | Poartă                                               |
| ------------------------------------------- | ---------------------------------------------------- |
| `/ssm`                                      | `ssm:read` own ca să intre; fiecare card cere `team` |
| `/ssm/instruiri`                            | `ssm:read` team **ȘI** `employees:read` team         |
| `/ssm/instruiri/noua`                       | `ssm:create` team                                    |
| `/ssm/medicina-muncii`                      | `ssm:read` team                                      |
| `/ssm/medicina-muncii/noua`                 | `ssm:create` team                                    |
| `/ssm/accidente`, `/ssm/accidente/[id]`     | `ssm:read` team                                      |
| `/ssm/accidente/nou`                        | `ssm:create` team                                    |
| `/ssm/eip`                                  | `ssm:read` team                                      |
| `/ssm/stingatoare`, `/ssm/stingatoare/[id]` | `ssm:read` team                                      |
| `/ssm/stingatoare/nou`                      | `ssm:create` team                                    |
| `/ssm/stingatoare/[id]/editeaza`            | `ssm:update` team                                    |
| `/ssm/autorizatii`                          | `ssm:read` team                                      |

Pragul de intrare e `own`, dar tot ce e dincolo de propriul dosar cere `team`. Un
`employee` ajunge deci pe pagină și o vede aproape goală — starea e corectă, nu un defect.

`/ssm/instruiri` e singura rută din modul cu poartă dublă: matricea are o coloană
„Angajat", deci fără `employees:read` team nu se poate compune, iar pagina refuză din
start în loc să afișeze o coloană goală; `/ssm` aplică de acum ACEEAȘI poartă dublă
cardurilor de instruiri, iar starea goală a listelor oferă butonul de adăugare doar cu
`ssm:create` — înainte amândouă duceau în refuz pe cine n-are a doua cheie.
`/ssm/stingatoare/[id]/editeaza` e singura care cere `ssm:update`.

Listele acceptă filtre de INTRARE, puse din alt ecran: `?angajat=<uuid>` (medicina
muncii, accidente, EIP, autorizații), `?scadenta=` (aceleași, din cardurile lui `/ssm`),
`?departament=<uuid>` și `?domeniu=` pe instruiri. Autorizațiile și matricea își
validează valoarea cu un tipar de UUID în `page.tsx`, restul prin `filtreDinUrl`; pe
ambele căi valoarea nepotrivită e IGNORATĂ, deci adresa stricată dă lista nefiltrată.

Preambulul paginilor rulează `requireFeature` și `getPermissionMap` în `Promise.all`, nu
înlănțuite: sunt două citiri independente, pe tabele diferite, iar înlănțuite costau două
dus-întorsuri seriale spre PostgREST; `/ssm/autorizatii` are acolo o a treia citire,
`getEnabledFeatures`, cerută de `poateDeschide` pentru coloana de echipamente ISCIR.
Ordinea logică a porții nu se schimbă — dacă funcționalitatea `ssm` e stinsă,
`requireFeature` cheamă `notFound()`, respingerea propagă prin `Promise.all` și `can()`
nu mai apucă să fie evaluat; singura diferență e că harta de permisiuni se citește și
atunci degeaba.

## Citiri

`src/lib/queries/ssm.ts` — fără niciun filtru manual de scope. Politicile din `0011` o fac
în Postgres, prin `app.ssm_acces`, pe coloana `employee_id` a fiecărei tabele; un filtru
duplicat în TypeScript ar putea diverge tăcut de regula reală.

Politicile SELECT din `0011` **nu** conțin `deleted_at is null` — fiecare citire îl adaugă
explicit.

Fișierul începe cu `import "server-only"`: citirile SSM nu pot fi importate dintr-o
componentă client nici din greșeală. Un astfel de import pică la build, cu numele
fișierului, nu tăcut la rulare.

Filtrul `?scadenta=` nu e un predicat SQL: contoarele de pe `/ssm` se calculează în JS,
peste `stareScadentaSsm`, deci lista citește întâi id-urile cu ACEEAȘI funcție și le trece
prin `.in("id", …)`, pe rânduri ȘI pe numărătoare — cifra de pe card și rândurile de sub
ea nu pot diverge. Pe autorizații, nomenclator fără paginare keyset, filtrul se aplică în
pagină, după citire, deci numai peste rândurile aduse de plafonul explicit.

`angajatiDupaId()` citește și `deleted_at`, fiindcă `hrefFisa()` din
`src/lib/navigare/fisa.ts` decide per rând dacă numele devine link: fără coloană ar
presupune nești, iar fișa ștearsă logic ar primi un link spre `notFound()`.

`stingatoare()` scapă jokerii LIKE din căutarea după cod: `%` și `_` devin text, `*`
devine spațiu (PostgREST îl traduce oricum în `%`). Nu prin `tiparContine` — ghilimelele
lui au sens doar în gramatica `or=`, într-un `.ilike()` simplu ar fi literale. Fără
scăpare, „100%" întorcea tot ce începe cu 100, fără eroare. — `src/lib/queries/ssm.test.ts`

## Ce refuză baza tăcut

- **`public.expirables` întoarce zero rânduri pentru `hr`.** Politica ei cere ȘI
  `poate_vedea_expirabil`, ȘI `compliance:read` — pe care rolul care administrează SSM
  nu-l are. Fără eroare, fără listă. Toate scadențele se calculează din tabelele sursă.
  — capcana #26, v. [[rol/hr]]
- **`ssm_legal_parameters` e mapată pe resursa `compliance`, nu pe `ssm`.** Deci pragul de
  preaviz nu se citește din tabel: e constanta `PRAG_SSM_AVERTIZARE_ZILE` din
  `src/domain/ssm/scadente.ts`. La fel `environmental_permits`. — capcana #32
- **`app.ssm_acces` cu `p_employee` NULL sare peste ramura `own`.** Un rând fără angajat —
  un stingător, o autorizație de mediu — cere cel puțin `team`. Consecința: pentru un
  `employee` tabelele fără ancoră de angajat sunt invizibile, iar ecranul arată gol în loc
  să arate refuz.
- **Lista cu `?scadenta=` iese goală când nimic nu e scadent**, și nu fiindcă politicile
  ar fi respins ceva: `.in("id", …)` primește atunci un singur UUID imposibil, fiindcă un
  `in` gol e eroare PostgREST. Golul e corect; ce ar fi defect e un card cu cifră nenulă
  care duce într-o listă goală. — `src/lib/queries/ssm.ts`

Refuzurile tăcute de pe calea de SCRIERE — coloanele puse de triggerele lui `0011` și
allow-list-ul art. 9 GDPR al fișei de aptitudine — sunt în [[modul/ssm/actiuni]].

## Ce NU e aici

`0011_ssm.sql` creează și `equipment`, `equipment_meters`, `maintenance_plans`,
`maintenance_interventions` și `fault_reports` — dar acelea sunt modulul de mentenanță, cu
resursa de permisiune `maintenance`, nu `ssm`. Aceeași migrare, două module.

Documentele scanate ale angajatului și dosarul lui de personal: [[modul/angajati]].

## Când NU e suficientă pagina asta

- Calculul stării unei scadențe: `src/domain/ssm/scadente.ts`, cu teste.
- De ce `hr` nu vede o listă pe care o administrează: [[rol/hr]].
- Loturile 7f/7m — drumurile dintre ecrane, cu numele porților lor: celula Expirat/Lipsă
  deschide formularul precompletat, celula cu instruire se deschide pe loc, fișa expirată
  duce la reînnoire, situația SSM la data accidentului, numărul de registru pe accident,
  echipamentele ISCIR ale titularului: [[strat/navigare]].
