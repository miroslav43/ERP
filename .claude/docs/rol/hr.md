---
tip: rol
titlu: HR
aliases: [hr, personal, resurse-umane]
cai:
  - "supabase/migrations/0002_authz.sql"
  - "supabase/migrations/0056_concedii_hr_nu_aproba.sql"
  - "supabase/migrations/0067_pontaj_aprobare_pe_zi.sql"
  - "supabase/migrations/0099_invitatia_leaga_fisa.sql"
tabele: [role_permissions, organization_members, employees]
permisiuni: [employees:invite, attendance:approve, leave:approve, compliance:read]
capcane: [26, 32]
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [rol]
---

# HR

Rolul care **administrează dosarul de personal, dar nu decide pe el**. Are `all` pe
aproape tot domeniul de personal și, în același timp, `none` explicit pe cele două
aprobări care par firești pentru el. Distincția e proiectată, nu o scăpare: HR pregătește
și corectează, managerul direct decide.

## Ce are

| Resursă                                                                                  | Acțiuni                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `employees`, `departments`, `ssm`, `inventory`, `checklists`, `payroll`, `announcements` | toate, scope `all`                                |
| `attendance`, `leave`                                                                    | toate **fără `approve`**, scope `all`             |
| `employees:invite`                                                                       | `all` (0099)                                      |
| `courses`                                                                                | `read`, `create`, `update`, `export` — all (0075) |
| `evaluations`                                                                            | `read`, `create`, `update` — all (0070)           |
| `reges`                                                                                  | tot, inclusiv `configure` — all (0087)            |
| `tickets`                                                                                | `read`, `create`, `update` — **own** (0046)       |
| `audit`                                                                                  | _none_ — refuz EXPLICIT                           |

`reges:configure` merge la HR fiindcă specialistul de personal e cel care obține cheile
din portalul REGES; strângerea lui la `org_admin` se face per firmă, dintr-un rând în
`role_permissions`, fără deploy.

`tickets` la scope `own` nu e o omisiune: HR e solicitant în ticketing, nu operator IT.

## Cele două aprobări pe care NU le are

- **`leave:approve = none`** (`0056_concedii_hr_nu_aproba.sql`). Absența rândului ar fi
  avut același efect; `none` spune INTENȚIA — cineva s-a gândit la HR și a decis că nu
  aprobă, spre deosebire de „nu s-a configurat niciodată".
- **`attendance:approve = none`** (`0067_pontaj_aprobare_pe_zi.sql`). HR păstrează
  `read`, `create` și `update`: administrează pontajul, nu-l decide.

Consecința pe ecran: HR ajunge pe listele de cereri și pe foaia de prezență, le poate
corecta, dar butonul de decizie se ascunde cu `can()`. Un `AccesRestrictionat` acolo ar fi
greșit — pagina îi e deschisă, doar decizia nu.

## Ce nu există deloc pentru HR

`compliance`, `users`, `vehicles`, `trip_sheets`, `per_diem`, `maintenance`, `roles`,
`organizations`, `features`, `branding` — niciun rând. Absența permisiunii ESTE refuzul,
iar refuzul trece prin RLS fără nicio eroare.

- **`compliance:read` lipsă înseamnă `public.expirables` gol.** Politica ei cere ȘI
  `poate_vedea_expirabil`, ȘI `compliance:read`, acordat în seed doar lui `super_admin` și
  `org_admin`. Pentru HR — care administrează tot SSM-ul — tabela întoarce zero rânduri,
  tăcut. Scadențele se calculează din tabelele sursă, iar `src/lib/queries/ssm.ts` o spune
  în antet. — capcana #26
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
  a managerului, plata trece prin salarizare.

## Precedența, când o firmă vrea altfel

Tabelul e implicitul global. **Rândul membrului** bate **rândul organizației**, care bate
implicitul (`app.has_permission`, extinsă de `0063_permisiuni_per_angajat.sql`; oglinda ei
în TypeScript e `getPermissionMap` din `src/lib/auth/permissions.ts`). O firmă care chiar
vrea ca HR-ul ei să aprobe concediile inserează un rând pe organizație — fără deploy și
fără să atingă seed-ul.

## Când NU e suficientă pagina asta

- Ce refuză baza într-un modul anume: `modul/<directorul din src/app/(app)/>`.
- Decizia pe cereri și pe pontaj: [[rol/manager]].
