---
tip: modul
titlu: Mentenanță
aliases: [mentenanta, echipamente, sesizari, defecte]
cai:
  - "src/app/(app)/mentenanta/**"
  - "src/lib/queries/maintenance.ts"
  - "src/schemas/maintenance.ts"
  - "src/domain/maintenance/**"
  - "supabase/migrations/0011_ssm.sql"
  - "supabase/migrations/0180_mentenanta_integritate.sql"
  - "supabase/migrations/0181_sesizari_flux.sql"
  - "supabase/migrations/0182_echipamente_ciclu.sql"
  - "supabase/migrations/0183_planuri_scadente.sql"
tabele:
  [
    equipment,
    equipment_meters,
    maintenance_plans,
    maintenance_interventions,
    fault_reports,
    iscir_authorizations,
  ]
permisiuni:
  [maintenance:read, maintenance:create, maintenance:update, maintenance:delete, maintenance:export]
feature: maintenance
capcane: [17, 35, 50, 51]
citeste_daca:
  - "poartă de acțiune care pare prea largă → secțiunea „create nu e poarta”"
  - "sesizare care nu se mai mișcă, tehnician sau raportor refuzat → [[modul/mentenanta/sesizari]]"
  - "casare, componente, contoare, responsabil → [[modul/mentenanta/echipamente]]; scadență, amânare, grilă fixă, proiecție → [[modul/mentenanta/planuri]]"
scris_pe: f3937f52a02b737ac62ef500b1d6b42e81e7640b
scris_la: 2026-10-08
tags: [modul]
---

# Mentenanță

Echipamente cu contoare, planuri de mentenanță cu scadențe, intervenții, sesizări de
defecțiune și autorizații ISCIR. Tabelele de bază sunt create de `0011_ssm.sql`, în
aceeași buclă de politici ca SSM-ul, dar sub resursa de permisiune `maintenance` și
feature-ul `maintenance` — **aceeași migrare, alt modul**. Vezi [[modul/ssm]] pentru
cealaltă jumătate. Fluxul complet al sesizării (număr, tehnician, comentarii, fotografii,
opriri, setări — `0181`) are pagina lui: [[modul/mentenanta/sesizari]]. Ciclul de viață al
echipamentului (casare, componente, garanție, contoare în lot, etichete QR, responsabilul
— `0182`) are și el una: [[modul/mentenanta/echipamente]]. Planurile și scadențele (mod de
calcul, amânare, proiecție pe contor, fișa planului — `0183`): [[modul/mentenanta/planuri]].

## Rute și cine ajunge

| Rută                                                       | Poartă                    |
| ---------------------------------------------------------- | ------------------------- |
| `/mentenanta`                                              | `maintenance:read` own    |
| `/mentenanta/sesizari`, `/mentenanta/sesizari/[id]`        | `maintenance:read` own    |
| `/mentenanta/sesizari?sesizare=noua` (casetă)              | `maintenance:create` own  |
| `/mentenanta/echipamente`, `/mentenanta/echipamente/[id]`  | `maintenance:read` team   |
| `/mentenanta/echipamente?echipament=nou` (casetă)          | `maintenance:update` team |
| `/mentenanta/planuri`, `/mentenanta/planuri/[id]`          | `maintenance:read` team   |
| `/mentenanta/interventii`                                  | `maintenance:read` team   |
| `/mentenanta/contoare`, `/mentenanta/echipamente/etichete` | `maintenance:read` team   |
| `/mentenanta/setari`                                       | `maintenance:update` all  |

Pragul `own` pe panou și pe sesizări e intenționat: **oricine poate sesiza o defecțiune**.
Restul modulului — parcul de echipamente, planurile, intervențiile — cere `team`. Fila
„Setări” din `nav-mentenanta` apare pe un boolean calculat în pagină, nu pe harta de
permisiuni (componenta e client).

Cele două formulare de creare sunt CASETE pe listele lor (`FormularDialog`, tiparul
`?vehicul=nou` din [[modul/flota]]), nu pagini; butonul care le deschide se păzește pe
permisiunea pe care o exercită. `?echipament=nou&model=<id>` precompletează caseta din
altă fișă, fără cod și serie („Adaugă unul la fel”).

**`/mentenanta/sesizari/noua` și `/portal/sesizari/noua` există doar ca REDIRECTURI** spre
listă cu `?sesizare=noua`, păstrând `?echipament=`: autocolantele QR lipite pe utilaje codifică
adresa veche. Echipamentul din QR se rezolvă pe server (`cautaEchipament`), vine cu
`sesizare_deschisa` pentru avertismentul de duplicat, iar un id stricat ori un utilaj casat
dau o bandă de atenție în casetă, nu 404. `/mentenanta/echipamente/nou` a fost șters.

Preambulul paginilor cheamă `requireFeature` și `getPermissionMap` într-un `Promise.all`:
sunt două citiri independente, iar refuzul lui `requireFeature` ajunge tot înaintea
oricărui `can()`. Pe `/mentenanta` poarta se citește de două ori: `own` deschide pagina,
`team` decide dacă se vede panoul de organizație sau doar `SesizarileMele`.

## `create` NU e poarta pentru echipamente

Politica de INSERT generată în bucla din `0011` cere
`app.ssm_acces(org, 'maintenance', 'create', null)`. Cu `p_employee` NULL, funcția
răspunde din prima ramură: `can(..., 'all')`. Iar `manager` **și** `employee` au
`maintenance:create = all` în seed — acordat pentru sesizări.

Consecința: baza îi lasă să insereze în `equipment`, `equipment_meters`,
`maintenance_plans` și `maintenance_interventions`. **Poarta reală trebuie pusă în
aplicație**, pe `maintenance:update` cu `minScope: "team"`, și așa e scrisă azi. Doar
sesizarea rămâne pe `maintenance:create` / `own`. — capcana #35

## Server Actions

`src/app/(app)/mentenanta/actions.ts` (cele ale fluxului de sesizări sunt în
`sesizari/actions.ts`, vezi [[modul/mentenanta/sesizari]]).

| Funcție                                                       | Permisiune / minScope       |
| ------------------------------------------------------------- | --------------------------- |
| `creeazaSesizare`, `cautaEchipament`                          | `maintenance:create` / own  |
| `numeleEchipamentelorMele`, `rezolvaSesizare`                 | `maintenance:read` / own    |
| `creeazaEchipament`, `actualizeazaEchipament`                 | `maintenance:update` / team |
| `creeazaPlan`, `actualizeazaPlan`, `inregistreazaInterventie` | `maintenance:update` / team |
| `trieazaSesizare`, `adaugaAutorizatieIscir`                   | `maintenance:update` / team |
| `inregistreazaContor`                                         | `maintenance:read` / own    |

`cautaEchipament` e pe `create` / own fiindcă servește formularul de sesizare: cine poate
raporta trebuie să poată găsi echipamentul, fără să vadă parcul. `rezolvaSesizare` și
`inregistreazaContor` sunt pe `read` / own fiindcă le fac și tehnicianul atribuit, respectiv
responsabilul utilajului; cine poate ce decide baza. Ciclul echipamentului (stare,
ștergere, corecția citirilor, lot) e în `echipamente/actions.ts`.

`rezolvaSesizare` are **două scrieri**, în ordine obligatorie: întâi intervenția (legată de
sesizare prin `fault_report_id`), apoi sesizarea cu `intervention_id`-ul ei — garda refuză
`status = 'rezolvat'` fără intervenție. Ordinea și compensarea sunt în „Ce refuză baza tăcut”.

## Citiri

`src/lib/queries/maintenance.ts`: `listeazaEchipamente`, `citesteEchipament`,
`echipamenteDupaId`, `contoareEchipament`, `planuriEchipament`, `planuriScadente`,
`ultimeleCitiriContor`, `interventii`, `citesteInterventie`, `sesizari` (filtre
`atribuit`, `deschise`; fișa apelantului al treilea argument), `sesizariDeschise`,
`citesteSesizare`, `autorizatiiIscir`, `angajatiAutorizati`, `angajatiDupaId`,
`angajatiDupaUserId`, `optiuniAngajati`, `numarScadenteMentenanta`, plus cele ale
fluxului de sesizări.

Niciun filtru manual de scope: politicile din bucla lui `0011` și cele din `0181`
restrâng rândurile în Postgres. Ziua de business vine din `todayInBucharest()`, nu din
`new Date()`. Căutarea liberă după cod și denumire trece prin `tiparContine`
(`src/lib/queries/cursor.ts`): `%` și `_` tastate de om ar fi jokeri.

## Ce refuză baza tăcut

- **Sesizările se ancorează pe `raportat_de_employee_id` (și, din 0181, pe
  `atribuit_employee_id`), restul tabelelor pe nimic.** Un `employee` își vede sesizările
  proprii și pe cele atribuite lui — plus denumirea utilajelor de pe ele —, dar parcul îi e
  invizibil: ecran gol, fără eroare.
- **Scadențele NU se citesc din `public.expirables`.** Politica ei cere în plus
  `compliance:read`; `planuriScadente` și `numarScadenteMentenanta` calculează din tabelele
  sursă. — v. [[modul/ssm]]
- **Ștergerea e logică.** Grant pe `select`, `insert`, `update`; `revoke delete` explicit.
- **Tranzițiile se păzesc ÎN UPDATE**, prin `.in("status", STARI_DESCHISE)` și `.select()`
  după: zero rânduri înseamnă „deja închisă” sau „nu ai dreptul”, nu succes. — capcana #17
- **Rezolvarea nu e atomică, deci se compensează.** Dacă UPDATE-ul condiționat întoarce
  zero rânduri sau eroare, intervenția abia inserată se anulează logic și acțiunea
  întoarce CONFLICT. Din 0180, anularea logică a unei intervenții legate de plan îl READUCE
  la intervenția anterioară.
- **Scadența pe contor pornește de la contorul real** (0180): planul nou fără
  `ultima_citire_contor` ia ultima citire a echipamentului; schema de editare OMITE coloana.
- **Autorizația ISCIR are rândurile ei în `expirables`** (0180): `kind` fix, nu `tip`-ul
  liber; suspendarea și planul dezactivat ies din scadențe.
- **O intervenție pe planul altui echipament e refuzată** cu P0001 (0180); o corecție de
  citire nu sare peste citirea URMĂTOARE. Proba: `tests/rls/proba-mentenanta-integritate.sql`.
- **Administratorul fără fișă poate sesiza**: `raportat_de_employee_id = null`, iar garda
  reține `raportat_de_user_id`.

## Ce NU e aici

Vehiculele și foile de parcurs sunt la [[modul/flota]]. Instruirile, EIP-ul și accidentele
sunt la [[modul/ssm]], deși vin din aceeași migrare. Fluxul sesizării, cu actorii lui, e la
[[modul/mentenanta/sesizari]].

## Când NU e suficientă pagina asta

- Calculul scadenței unui plan: `src/domain/maintenance/`.
- De ce un manager poate sesiza dar nu poate administra: [[rol/manager]].
- Contractul exact al unei acțiuni: `src/app/(app)/mentenanta/actions-*.test.ts` și
  `sesizari/actions.test.ts`, pe client Supabase fals. `actions-modul.test.ts` verifică
  cheia `feature` a exporturilor din `actions.ts`.
