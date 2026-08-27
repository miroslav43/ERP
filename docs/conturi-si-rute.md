# Conturi și rute

Inventar generat din baza de dezvoltare (`nybmhorngsajoqaxjlbr`) și din arborele
de fișiere, la **27.08.2026**, pe commit-ul `e08063d`.

> Se strică singur. Conturile se schimbă din aplicație, rutele la fiecare
> `page.tsx` nou. Nu-l trata ca sursă de adevăr — sursa rămâne baza și
> `src/app/`. Comanda de regenerare e la coada fișierului.

---

## Conturi

**7 conturi** în `auth.users`. Toate cele demo au parola **`12345678`**
— e cea din `scripts/demo/seed-demo.mjs:60`, deci nu e un secret nou expus aici.
Toate au adresa confirmată.

| E-mail                        | Firmă                                   | Rol         | Admin platformă | Marca    | Fișă de angajat                                 | Creat | Ultima intrare |
| ----------------------------- | --------------------------------------- | ----------- | --------------- | -------- | ----------------------------------------------- | ----- | -------------- |
| `scoala.ai43@gmail.com`       | —                                       | —           | **DA**          | —        | —                                               | 22.08 | niciodată      |
| `demo_admin@gmail.com`        | Administrativo Demo SRL + Beta Demo SRL | `org_admin` | **DA**          | 0001     | Mihai Demo (administrator platformă) · candidat | 18.08 | 25.08          |
| `demo_orgadmin@gmail.com`     | Administrativo Demo SRL                 | `org_admin` | nu              | DEMO-001 | Ionescu Ana · activ                             | 18.08 | 27.08          |
| `demo_hr@gmail.com`           | Administrativo Demo SRL                 | `hr`        | nu              | DEMO-002 | Marin Elena · activ                             | 18.08 | 25.08          |
| `demo_manager@gmail.com`      | Administrativo Demo SRL                 | `manager`   | nu              | DEMO-003 | Pop Radu · activ                                | 18.08 | 26.08          |
| `demo_employee@gmail.com`     | Administrativo Demo SRL                 | `employee`  | nu              | DEMO-004 | Georgescu Ioana · activ                         | 18.08 | 26.08          |
| `razvan.smartclass@gmail.com` | — (niciun membru)                       | —           | nu              | —        | —                                               | 21.08 | 22.08          |

Trei lucruri care nu se citesc din tabel:

- **`demo_admin` e singurul cont din două firme.** Fiind și administrator de
  platformă, la intrare nu i se rezolvă automat firma — trece obligatoriu prin
  `/alege-organizatia`. Celelalte conturi, cu o singură apartenență, intră direct.
- **`scoala.ai43@gmail.com` (contul tău) n-a intrat niciodată în aplicație.** E
  administrator de platformă, deci `/super-admin/*` îi e deschis, dar nu e membru
  în nicio firmă: `/concedii`, `/pontaj` și restul îl trimit la alegerea firmei,
  unde n-are ce alege.
- **`razvan.smartclass@gmail.com` n-are nici firmă, nici drept de platformă.** A
  intrat o dată, pe 22.08. Contul e practic gol — nu vede niciun ecran de lucru.

### Firme

| Firmă                   | `slug`      | Stare  | Plan       | Locuri | Membri | Fișe | Module active |
| ----------------------- | ----------- | ------ | ---------- | ------ | ------ | ---- | ------------- |
| Administrativo Demo SRL | `demo`      | activă | trial      | 10     | 5      | 9    | 15            |
| Beta Demo SRL           | `beta-demo` | activă | trial      | 10     | 1      | 1    | 2             |
| Firma Test              | `firmatest` | activă | enterprise | 10     | 0      | 0    | 2             |

Doar **Administrativo Demo SRL** e populată. Celelalte două au 2 module active
(nucleul), deci majoritatea rutelor dau 404 acolo prin `requireFeature`.

### Cele cinci roluri

| Rol           | Permisiuni acordate | Dintre ele la nivel de firmă (`all`) |
| ------------- | ------------------- | ------------------------------------ |
| `super_admin` | 121                 | 121                                  |
| `org_admin`   | 122                 | 121                                  |
| `hr`          | 64                  | 61                                   |
| `manager`     | 31                  | 2                                    |
| `employee`    | 29                  | 2                                    |

`super_admin` **nu apare niciodată** în `organization_members` — sursa lui e
`platform_admins`. Diferența dintre `manager`/`employee` și restul nu e numărul,
ci scope-ul: aproape tot ce au e `own` sau `team`.

---

## Rute

**160 pagini** și **14 rute API**.

Accesul se decide în DOUĂ trepte, iar prima e cea care surprinde:

1. **Layout-ul zonei.** `(app)/layout.tsx` cere firmă și **redirectează rolul
   `employee` în portal**; `(portal)/layout.tsx` face exact invers — îi
   redirectează în aplicație pe toți care NU sunt `employee`;
   `(platform)/super-admin/layout.tsx` cere `requirePlatformAdmin()`. De aici
   vin redirectările de 307 pe care le vezi când încerci o rută cu contul
   nepotrivit — nu sunt refuzuri de permisiune.
2. **Pagina**, cu un `can(permisiuni, …)` propriu. Doar asta e în coloana
   „permisiune suplimentară”; `—` înseamnă că poarta zonei e singura.

Coloana „modul” e argumentul lui `requireFeature` — dacă modulul e stins pentru
firmă, ruta dă **404**, nu refuz de acces.

> Segmentele `[id]`, `[data]`, `[token]` sunt dinamice. Grupurile din paranteze
> (`(app)`, `(portal)`) organizează fișierele și **nu** apar în URL.

### Public — `(marketing)` · 7 rute

**Cine intră în toată zona:** public.

Fără autentificare.

| Rută                       | Permisiune suplimentară | Modul |
| -------------------------- | ----------------------- | ----- |
| `/`                        | —                       | —     |
| `/cere-demo`               | —                       | —     |
| `/en`                      | —                       | —     |
| `/en/preturi`              | —                       | —     |
| `/legal/confidentialitate` | —                       | —     |
| `/legal/termeni`           | —                       | —     |
| `/preturi`                 | —                       | —     |

### Autentificare — `(auth)` · 5 rute

**Cine intră în toată zona:** public.

Fără sesiune, sau cu sesiune incompletă.

| Rută                 | Permisiune suplimentară | Modul |
| -------------------- | ----------------------- | ----- |
| `/alege-organizatia` | —                       | —     |
| `/autentificare`     | —                       | —     |
| `/invitatie/[token]` | —                       | —     |
| `/parola-noua`       | —                       | —     |
| `/resetare-parola`   | —                       | —     |

### Înrolarea firmei — `(onboarding)` · 2 rute

**Cine intră în toată zona:** autentificat + firmă.

Poarta e în pagină: autentificat, cu o firmă rezolvată.

| Rută                    | Permisiune suplimentară | Modul |
| ----------------------- | ----------------------- | ----- |
| `/bun-venit`            | —                       | —     |
| `/firma-in-configurare` | —                       | —     |

### Aplicația — `(app)` · 107 rute

**Cine intră în toată zona:** membru al firmei · **fără rolul `employee`**.

Poarta e în `(app)/layout.tsx`: `requireTenant()`, apoi **rolul `employee` e redirectat în portal**. Coloana de mai jos e verificarea SUPLIMENTARĂ din pagină.

| Rută                             | Permisiune suplimentară        | Modul           |
| -------------------------------- | ------------------------------ | --------------- |
| `/angajati`                      | —                              | `nucleu`        |
| `/angajati/[id]`                 | `payroll:create` ≥ `all`       | `nucleu`        |
| `/angajati/[id]/documente`       | —                              | `nucleu`        |
| `/angajati/[id]/editeaza`        | —                              | `nucleu`        |
| `/angajati/[id]/permisiuni`      | `roles:update` ≥ `team`        | —               |
| `/angajati/import`               | —                              | `nucleu`        |
| `/angajati/nou`                  | —                              | `nucleu`        |
| `/anunturi`                      | `announcements:read` ≥ `own`   | `announcements` |
| `/anunturi/[id]`                 | `announcements:read` ≥ `own`   | `announcements` |
| `/concedii`                      | `leave:read` ≥ `own`           | `leave`         |
| `/concedii/[id]`                 | `leave:read` ≥ `own`           | `leave`         |
| `/concedii/aprobari`             | `leave:approve` ≥ `team`       | `leave`         |
| `/concedii/calendar`             | `leave:read` ≥ `team`          | `leave`         |
| `/concedii/echipa`               | `leave:read` ≥ `team`          | `leave`         |
| `/concedii/noua`                 | `leave:create` ≥ `own`         | `leave`         |
| `/concedii/setari`               | `leave:update` ≥ `all`         | `leave`         |
| `/concedii/sold`                 | `leave:read` ≥ `own`           | `leave`         |
| `/cursuri`                       | `courses:read` ≥ `team`        | `courses`       |
| `/cursuri/[id]`                  | `courses:read` ≥ `team`        | `courses`       |
| `/cursuri/[id]/atribuire`        | `courses:create` ≥ `team`      | `courses`       |
| `/cursuri/[id]/reguli`           | `courses:read` ≥ `team`        | `courses`       |
| `/cursuri/[id]/stadiu`           | `courses:read` ≥ `team`        | `courses`       |
| `/cursuri/biblioteca`            | `courses:read` ≥ `team`        | `courses`       |
| `/cursuri/biblioteca/[id]`       | `courses:read` ≥ `team`        | `courses`       |
| `/cursuri/conformitate`          | `courses:read` ≥ `team`        | `courses`       |
| `/cursuri/nou`                   | `courses:create` ≥ `team`      | `courses`       |
| `/departamente`                  | `departments:create` ≥ `all`   | `nucleu`        |
| `/diurna`                        | `per_diem:read` ≥ `own`        | `per_diem`      |
| `/diurna/[id]`                   | `per_diem:read` ≥ `own`        | `per_diem`      |
| `/diurna/[id]/decont`            | `per_diem:read` ≥ `own`        | `per_diem`      |
| `/diurna/[id]/editeaza`          | `per_diem:update` ≥ `own`      | `per_diem`      |
| `/diurna/aprobari`               | `per_diem:approve` ≥ `team`    | `per_diem`      |
| `/diurna/noua`                   | `per_diem:create` ≥ `own`      | `per_diem`      |
| `/diurna/politica`               | `per_diem:read` ≥ `own`        | `per_diem`      |
| `/evaluari`                      | `evaluations:read` ≥ `team`    | `evaluations`   |
| `/evaluari/sabloane`             | `evaluations:read` ≥ `team`    | `evaluations`   |
| `/flota`                         | `vehicles:read` ≥ `own`        | `fleet`         |
| `/flota/[id]`                    | `vehicles:read` ≥ `own`        | `fleet`         |
| `/flota/anomalii`                | `vehicles:update` ≥ `team`     | `fleet`         |
| `/flota/aprobari`                | `trip_sheets:approve` ≥ `team` | `fleet`         |
| `/flota/foi`                     | `trip_sheets:read` ≥ `own`     | `fleet`         |
| `/flota/foi/[id]`                | `trip_sheets:read` ≥ `own`     | `fleet`         |
| `/flota/foi/noua`                | `trip_sheets:create` ≥ `own`   | `fleet`         |
| `/flota/nou`                     | `vehicles:create` ≥ `all`      | `fleet`         |
| `/functii`                       | `departments:create` ≥ `all`   | `nucleu`        |
| `/inventar`                      | `inventory:update` ≥ `all`     | `inventory`     |
| `/inventar/[id]`                 | `inventory:update` ≥ `all`     | `inventory`     |
| `/inventar/[id]/pv/[alocare]`    | —                              | `inventory`     |
| `/inventar/in-primire`           | `employees:read` ≥ `own`       | `inventory`     |
| `/inventar/nou`                  | —                              | `inventory`     |
| `/mentenanta`                    | `maintenance:read` ≥ `own`     | `maintenance`   |
| `/mentenanta/echipamente`        | `maintenance:read` ≥ `team`    | `maintenance`   |
| `/mentenanta/echipamente/[id]`   | `maintenance:read` ≥ `team`    | `maintenance`   |
| `/mentenanta/echipamente/nou`    | `maintenance:update` ≥ `team`  | `maintenance`   |
| `/mentenanta/interventii`        | `maintenance:read` ≥ `team`    | `maintenance`   |
| `/mentenanta/planuri`            | `maintenance:read` ≥ `team`    | `maintenance`   |
| `/mentenanta/sesizari`           | `maintenance:read` ≥ `own`     | `maintenance`   |
| `/mentenanta/sesizari/[id]`      | `maintenance:read` ≥ `own`     | `maintenance`   |
| `/mentenanta/sesizari/noua`      | `maintenance:create` ≥ `own`   | `maintenance`   |
| `/notificari`                    | —                              | —               |
| `/onboarding`                    | `checklists:read` ≥ `own`      | `onboarding`    |
| `/onboarding/[id]`               | `checklists:read` ≥ `own`      | `onboarding`    |
| `/onboarding/[id]/dovada`        | `checklists:read` ≥ `own`      | `onboarding`    |
| `/onboarding/noua`               | `checklists:create` ≥ `all`    | `onboarding`    |
| `/onboarding/sabloane`           | `checklists:read` ≥ `own`      | `onboarding`    |
| `/onboarding/sabloane/[id]`      | `checklists:read` ≥ `own`      | `onboarding`    |
| `/onboarding/sabloane/nou`       | `checklists:create` ≥ `all`    | `onboarding`    |
| `/organigrama`                   | —                              | `nucleu`        |
| `/panou`                         | `employees:create` ≥ `all`     | —               |
| `/pontaj`                        | `attendance:read` ≥ `own`      | `attendance`    |
| `/pontaj/aprobare`               | `attendance:approve` ≥ `team`  | `attendance`    |
| `/pontaj/perioade`               | `attendance:read` ≥ `own`      | `attendance`    |
| `/pontaj/perioade/[id]`          | `attendance:read` ≥ `team`     | `attendance`    |
| `/pontaj/saptamana`              | `attendance:create` ≥ `own`    | `attendance`    |
| `/pontaj/setari`                 | `attendance:update` ≥ `all`    | `attendance`    |
| `/profil`                        | —                              | —               |
| `/puncte-lucru`                  | `departments:create` ≥ `all`   | `nucleu`        |
| `/rapoarte`                      | `payroll:read` ≥ `all`         | `payroll`       |
| `/revisal`                       | —                              | `nucleu`        |
| `/salarizare`                    | `payroll:read` ≥ `all`         | `payroll`       |
| `/salarizare/[id]`               | `payroll:read` ≥ `all`         | `payroll`       |
| `/salarizare/[id]/[entryId]`     | `payroll:read` ≥ `all`         | `payroll`       |
| `/salarizare/componente`         | `payroll:create` ≥ `all`       | `payroll`       |
| `/salarizare/istoric-venituri`   | `payroll:create` ≥ `all`       | `payroll`       |
| `/salarizare/popriri`            | `payroll:create` ≥ `all`       | `payroll`       |
| `/salarizare/setari`             | `payroll:update` ≥ `all`       | `payroll`       |
| `/setari/audit`                  | —                              | —               |
| `/setari/membri`                 | —                              | —               |
| `/setari/organizatie`            | —                              | —               |
| `/ssm`                           | `ssm:read` ≥ `own`             | `ssm`           |
| `/ssm/accidente`                 | `ssm:read` ≥ `team`            | `ssm`           |
| `/ssm/accidente/[id]`            | `ssm:read` ≥ `team`            | `ssm`           |
| `/ssm/accidente/nou`             | `ssm:create` ≥ `team`          | `ssm`           |
| `/ssm/autorizatii`               | `ssm:read` ≥ `team`            | `ssm`           |
| `/ssm/eip`                       | `ssm:read` ≥ `team`            | `ssm`           |
| `/ssm/instruiri`                 | `ssm:read` ≥ `team`            | `ssm`           |
| `/ssm/instruiri/noua`            | `ssm:create` ≥ `team`          | `ssm`           |
| `/ssm/medicina-muncii`           | `ssm:read` ≥ `team`            | `ssm`           |
| `/ssm/medicina-muncii/noua`      | `ssm:create` ≥ `team`          | `ssm`           |
| `/ssm/stingatoare`               | `ssm:read` ≥ `team`            | `ssm`           |
| `/ssm/stingatoare/[id]`          | `ssm:read` ≥ `team`            | `ssm`           |
| `/ssm/stingatoare/[id]/editeaza` | `ssm:update` ≥ `team`          | `ssm`           |
| `/ssm/stingatoare/nou`           | `ssm:create` ≥ `team`          | `ssm`           |
| `/ticketing`                     | `tickets:read` ≥ `own`         | `ticketing`     |
| `/ticketing/[id]`                | `tickets:read` ≥ `own`         | `ticketing`     |
| `/ticketing/coada`               | `tickets:read` ≥ `team`        | `ticketing`     |
| `/ticketing/nou`                 | `tickets:create` ≥ `own`       | `ticketing`     |

### Portalul angajatului — `(portal)` · 29 rute

**Cine intră în toată zona:** **doar rolul `employee`**, cu fișă.

Poarta e în `(portal)/layout.tsx`: autentificat, cu firmă, și **numai rolul `employee`** — restul sunt trimiși înapoi în aplicație. Fiecare ecran cere apoi fișă de angajat.

| Rută                                     | Permisiune suplimentară      | Modul             |
| ---------------------------------------- | ---------------------------- | ----------------- |
| `/portal`                                | `leave:read` ≥ `own`         | —                 |
| `/portal/anunturi`                       | `announcements:read` ≥ `own` | `announcements`   |
| `/portal/anunturi/[id]`                  | `announcements:read` ≥ `own` | `announcements`   |
| `/portal/concediile-mele`                | `leave:read` ≥ `own`         | `leave`           |
| `/portal/concediile-mele/[id]`           | `leave:read` ≥ `own`         | `leave`           |
| `/portal/concediile-mele/noua`           | `leave:create` ≥ `own`       | `leave`           |
| `/portal/cursurile-mele`                 | `courses:read` ≥ `own`       | `courses`         |
| `/portal/cursurile-mele/[id]`            | `courses:read` ≥ `own`       | `courses`         |
| `/portal/cursurile-mele/[id]/[lectieId]` | `courses:read` ≥ `own`       | `courses`         |
| `/portal/diurna-mea`                     | `per_diem:read` ≥ `own`      | `per_diem`        |
| `/portal/diurna-mea/[id]`                | `per_diem:read` ≥ `own`      | `per_diem`        |
| `/portal/diurna-mea/noua`                | `per_diem:create` ≥ `own`    | `per_diem`        |
| `/portal/documentele-mele`               | `employees:read` ≥ `own`     | `employee_portal` |
| `/portal/echipa-mea`                     | —                            | `nucleu`          |
| `/portal/in-primirea-mea`                | `inventory:read` ≥ `own`     | `inventory`       |
| `/portal/instruirile-mele`               | `ssm:read` ≥ `own`           | `ssm`             |
| `/portal/integrarea-mea`                 | `checklists:read` ≥ `own`    | `onboarding`      |
| `/portal/integrarea-mea/[id]`            | `checklists:read` ≥ `own`    | `onboarding`      |
| `/portal/notificarile-mele`              | —                            | —                 |
| `/portal/pontajul-meu`                   | `attendance:read` ≥ `own`    | `attendance`      |
| `/portal/pontajul-meu/saptamana`         | `attendance:create` ≥ `own`  | `attendance`      |
| `/portal/pontajul-meu/zi/[data]`         | `attendance:create` ≥ `own`  | `attendance`      |
| `/portal/profilul-meu`                   | —                            | —                 |
| `/portal/salariul-meu`                   | `payroll:read` ≥ `own`       | `payroll`         |
| `/portal/sesizari`                       | `maintenance:read` ≥ `own`   | `maintenance`     |
| `/portal/sesizari/noua`                  | `maintenance:create` ≥ `own` | `maintenance`     |
| `/portal/tichetele-mele`                 | `tickets:read` ≥ `own`       | `ticketing`       |
| `/portal/tichetele-mele/[id]`            | `tickets:read` ≥ `own`       | `ticketing`       |
| `/portal/tichetele-mele/nou`             | `tickets:create` ≥ `own`     | `ticketing`       |

### Consola de platformă — `(platform)` · 10 rute

**Cine intră în toată zona:** administrator de platformă.

Poarta e în `(platform)/super-admin/layout.tsx`: `requirePlatformAdmin()`, o singură dată, pentru toate rutele de mai jos.

| Rută                                          | Permisiune suplimentară | Modul |
| --------------------------------------------- | ----------------------- | ----- |
| `/super-admin`                                | —                       | —     |
| `/super-admin/cereri-demo`                    | —                       | —     |
| `/super-admin/emailuri`                       | —                       | —     |
| `/super-admin/jurnal-audit`                   | —                       | —     |
| `/super-admin/organizatii`                    | —                       | —     |
| `/super-admin/organizatii/[orgId]`            | —                       | —     |
| `/super-admin/organizatii/[orgId]/membri`     | —                       | —     |
| `/super-admin/organizatii/[orgId]/module`     | —                       | —     |
| `/super-admin/organizatii/[orgId]/permisiuni` | —                       | —     |
| `/super-admin/organizatii/nou`                | —                       | —     |

### Rute API · 14

| Rută                                     | Zonă         |
| ---------------------------------------- | ------------ |
| `/api/anaf/firma`                        | `(rădăcină)` |
| `/api/export/audit`                      | `(rădăcină)` |
| `/api/export/salarizare/bancar`          | `(rădăcină)` |
| `/api/export/salarizare/d112`            | `(rădăcină)` |
| `/api/export/salarizare/fluturas`        | `(rădăcină)` |
| `/api/export/salarizare/nota`            | `(rădăcină)` |
| `/api/export/salarizare/stat`            | `(rădăcină)` |
| `/api/materiale/[versiuneId]`            | `(rădăcină)` |
| `/api/webhooks/resend`                   | `(rădăcină)` |
| `/auth/callback`                         | `(rădăcină)` |
| `/documente/[id]`                        | `(app)`      |
| `/healthz`                               | `(rădăcină)` |
| `/portal/cursurile-mele/[id]/adeverinta` | `(portal)`   |
| `/readyz`                                | `(rădăcină)` |

---

## Cum se regenerează

Conturile:

```bash
psql "$DATABASE_URL" -c "select u.email, o.name, m.role, e.marca, e.full_name
  from auth.users u
  left join public.organization_members m on m.user_id=u.id and m.deleted_at is null
  left join public.organizations o on o.id=m.organization_id
  left join public.employees e on e.user_id=u.id and e.organization_id=m.organization_id
  order by o.name, m.role;"
```

Rutele:

```bash
find src/app -name page.tsx -o -name route.ts | sed 's|src/app||; s|/page.tsx||;' \
  | sed -E 's|/\([^)]+\)||g' | sort
```

Parola conturilor demo și recrearea lor: `./dev.sh --seed`, respectiv
`./dev.sh --reset-demo`.
