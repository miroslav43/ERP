---
tip: rol
titlu: HR
aliases: [hr, personal, resurse-umane]
cai:
  - "supabase/migrations/0002_authz.sql"
  - "supabase/migrations/0056_concedii_hr_nu_aproba.sql"
  - "supabase/migrations/0067_pontaj_aprobare_pe_zi.sql"
  - "supabase/migrations/0099_invitatia_leaga_fisa.sql"
  - "supabase/migrations/0204_flota_soferi.sql"
tabele: [role_permissions, organization_members, employees, driver_licenses]
permisiuni:
  - employees:invite
  - attendance:approve
  - leave:approve
  - compliance:read
  - driver_licenses:create
capcane: [26, 32]
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
tags: [rol]
---

# HR

Rolul care **administrează dosarul de personal, dar nu decide pe el**. Are `all` pe
aproape tot domeniul de personal și, în același timp, `none` explicit pe cele două
aprobări care par firești pentru el. Distincția e proiectată, nu o scăpare: HR pregătește
și corectează, managerul direct decide.

## Paginile rolului

| Pagină              | Ce ține                                           |
| ------------------- | ------------------------------------------------- |
| [[rol/hr/matricea]] | cheile din seed și precedența celor trei niveluri |

## Cele două aprobări pe care NU le are

- **`leave:approve = none`** (`0056_concedii_hr_nu_aproba.sql`). Absența rândului ar fi
  avut același efect; `none` spune INTENȚIA — cineva s-a gândit la HR și a decis că nu
  aprobă, spre deosebire de „nu s-a configurat niciodată".
- **`attendance:approve = none`** (`0067_pontaj_aprobare_pe_zi.sql`). HR păstrează
  `read`, `create` și `update`: administrează pontajul, nu-l decide.

Consecința pe ecran: HR ajunge pe listele de cereri și pe foaia de prezență, le poate
corecta, dar butonul de decizie se ascunde cu `can()`. Un `AccesRestrictionat` acolo ar fi
greșit — pagina îi e deschisă, doar decizia nu.

## Permisele șoferilor — singura cheie de flotă

`driver_licenses:read/create/update = all` (`0204_flota_soferi.sql`, decizia 3) e tot ce
are HR pe flotă, și se exercită **de pe fișa angajatului** (blocul `PermisSofer` din
`src/app/(app)/angajati/[id]/page.tsx`, doar cu modulul `fleet` pornit), nu din `/flota`,
unde poarta cere `vehicles:read` și HR primește `AccesRestrictionat`. Scrierile stau în
`src/app/(app)/flota/actions-soferi.ts`, cu `minScope: "own"`, fiindcă politica judecă pe
angajat (`app.ssm_acces`); nicio cheie `delete` — ștergerea e logică, prin `update`.

Avizul medical îl află fiindcă are SSM: `app.stare_aviz_sofer` dă `apt` / `expirat` /
`lipsa` doar cui ar fi putut citi examenul prin RLS, iar `inapt` și `inapt_temporar` nu
ies ca atare nici pentru HR — se spun „lipsă" (art. 9 GDPR).

## Ce nu există deloc pentru HR

`compliance`, `users`, `vehicles`, `trip_sheets`, `per_diem`, `maintenance`, `roles`,
`organizations`, `features`, `branding` — niciun rând. Absența permisiunii ESTE refuzul,
iar refuzul trece prin RLS fără nicio eroare.

- **`compliance:read` lipsă înseamnă `public.expirables` gol.** Politica ei cere ȘI
  `poate_vedea_expirabil`, ȘI `compliance:read`, acordat în seed doar lui `super_admin` și
  `org_admin`. Pentru HR — care administrează tot SSM-ul — tabela întoarce zero rânduri,
  tăcut. Scadențele se calculează din tabelele sursă, iar `src/lib/queries/ssm.ts` o spune
  în antet. — capcana #26
- **Nici scadența pe care o scrie el însuși.** Permisul proiectează un rând
  `driver_license` în `expirables`, iar ramura entității îi recunoaște cheia proprie
  (`0204_flota_soferi.sql`) — dar conjuncția cu `compliance:read` îl lasă invizibil: HR
  înregistrează permisul, expirarea o vede doar pe fișa angajatului. — capcana #26
- **`ssm_legal_parameters` e mapată pe resursa `compliance`, nu pe `ssm`.** Deci pragul de
  preaviz nu se poate citi din tabel de exact omul care ține modulul; e constanta
  `PRAG_SSM_AVERTIZARE_ZILE` din `src/domain/ssm/scadente.ts`. La fel
  `environmental_permits`. — capcana #32
- **`users:*` lipsă, dar invitațiile merg.** `employees:invite = all` e cheia îngustă
  creată în `0099_invitatia_leaga_fisa.sql` tocmai fiindcă poarta invitațiilor cerea
  `users:create = all`, pe care HR nu-l are. Politica de INSERT acceptă de atunci și
  varianta îngustă, dar **numai pentru rolul `employee`**: HR înrolează angajați, nu
  creează administratori.
- **`per_diem` lipsă cu totul.** Diurna nu e a HR-ului: cererea e a angajatului, aprobarea
  a managerului, plata trece prin salarizare. De aceea `verificari_soferi` îi întoarce
  `delegatie = null` — „nu se știe", exact ca atunci când modulul e oprit
  (`0204_flota_soferi.sql`).
- **Flota fără parc** (decizia 3): nici `vehicles`, nici `trip_sheets`, nici cheile
  amenzilor și ale rezervărilor. „Mașina mea” îi arată mașina alocată LUI și PV-urile la
  care e parte (0215), fără costuri (0225): [[modul/flota/roluri-si-portal]]. Singura
  excepție, deliberată: valoarea de intrare a mașinii cu folosință personală, prin
  `avantaj_natura_flota` (`payroll:read = all`), pentru avantajul în natură —
  [[modul/flota/fiscal]].

## Când NU e suficientă pagina asta

- Ce refuză baza într-un modul anume: `modul/<directorul din src/app/(app)/>`.
- Decizia pe cereri și pe pontaj: [[rol/manager]].
