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
  - "instruire periodică respinsă la salvare → 0021, secțiunea de mai jos"
scris_pe: a2cdfa5180b0b036c983f85f493fe74846b2909c
scris_la: 2026-10-06
tags: [modul, hr]
---

# SSM și PSI

Instruiri periodice, medicina muncii cu restricții de aptitudine, accidente de muncă și
comunicarea lor la ITM, echipament individual de protecție, stingătoare cu verificări, și
autorizații nominale. Rolul care îl administrează e `hr` — care, tocmai de asta, are aici
cele mai multe refuzuri tăcute din proiect.

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
start în loc să afișeze o coloană goală. `/ssm/stingatoare/[id]/editeaza` e singura care
cere `ssm:update`.

Preambulul paginilor rulează `requireFeature` și `getPermissionMap` în `Promise.all`, nu
înlănțuite: sunt două citiri independente, pe tabele diferite, iar înlănțuite costau două
dus-întorsuri seriale spre PostgREST. Ordinea logică a porții nu se schimbă — dacă
funcționalitatea `ssm` e stinsă, `requireFeature` cheamă `notFound()`, respingerea
propagă prin `Promise.all` și `can()` nu mai apucă să fie evaluat; singura diferență e că
harta de permisiuni se citește și atunci degeaba.

## Server Actions

`src/app/(app)/ssm/actions.ts` — toate pe `minScope: "team"`, în afara nomenclatorului.

| Grup            | Funcții                                                                        | Permisiune          |
| --------------- | ------------------------------------------------------------------------------ | ------------------- |
| Instruiri       | `inregistreazaInstruireBloc`                                                   | `ssm:create`        |
| Medicina muncii | `adaugaFisaAptitudine`                                                         | `ssm:create`        |
| Accidente       | `inregistreazaAccident`; `comunicaAccidentLaItm`, `finalizeazaCercetare`       | `create` / `update` |
| Stingătoare     | `adaugaStingator`, `inregistreazaVerificareStingator`; `actualizeazaStingator` | `create` / `update` |
| EIP             | `predaEip`; `marcheazaEipReturnat`, `confirmaPrimireaEip`                      | `create` / `update` |
| Autorizații     | `adaugaAutorizatieNominala`; `schimbaSuspendareaAutorizatiei`                  | `create` / `update` |
| Nomenclator     | `nomenclatorInstruiri`                                                         | `ssm:read` / own    |

`nomenclatorInstruiri` e singura pe `own` și n-are `revalidate`: o cheamă `DosarulMeu`
direct dintr-un Server Component, iar `revalidatePath` în timpul randării aruncă. E și
singura care citește prin `createAdminSupabase()`, cu filtru explicit pe
`organization_id`: `ssm_training_types` n-are coloană de angajat, deci `app.ssm_acces`
cere scope ≥ `team` și un `employee` ar vedea UUID-uri în loc de denumiri.

Contractele sunt fixate pe clientul fals: `actions-instruiri-medicina.test.ts`,
`actions-accidente.test.ts`, `actions-stingatoare.test.ts`,
`actions-eip-autorizatii.test.ts`, plus `actions-modul.test.ts`, care ia lista din
exporturile lui `./actions` și verifică pe fiecare cheia `feature` — o acțiune legată din
greșeală de alt modul trece toate celelalte teste.

## Citiri

`src/lib/queries/ssm.ts` — fără niciun filtru manual de scope. Politicile din `0011` o fac
în Postgres, prin `app.ssm_acces`, pe coloana `employee_id` a fiecărei tabele; un filtru
duplicat în TypeScript ar putea diverge tăcut de regula reală.

Politicile SELECT din `0011` **nu** conțin `deleted_at is null` — fiecare citire îl adaugă
explicit.

Fișierul începe cu `import "server-only"`: citirile SSM nu pot fi importate dintr-o
componentă client nici din greșeală. Un astfel de import pică la build, cu numele
fișierului, nu tăcut la rulare.

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
- **Coloanele pe care acțiunile NU le trimit**, fiindcă le pune un trigger BEFORE din
  `0011` și numai când primește `null`: `ssm_trainings.urmatoarea_scadenta`,
  `work_accidents.termen_comunicare_ore`, `ppe_issuances.data_inlocuirii` și cele trei
  `fire_extinguishers.scadenta_*` (rescrise integral la fiecare scriere). Trimise din
  client, periodicitatea legală configurată e ignorată fără eroare. Din triggere AFTER vin
  rândul de `employee_work_restrictions` (un INSERT manual dă 23505 pe indexul unic
  parțial) și `ultima_*` de pe stingător, după o verificare — fără un al doilea UPDATE din
  acțiune. `created_by`/`updated_by` le scrie `internal.set_actor`, altfel decât în
  [[modul/flota]]. — `actions-stingatoare.test.ts`, `actions-accidente.test.ts`
- **Fișa de aptitudine e art. 9 GDPR în audit.** `rezultat`, `medic`, `unitate_medicala` și
  `cost` stau în afara allow-list-ului lui `adaugaFisaAptitudine`, pe ambele căi — succes
  și eșec; `observatii` nici nu e în schemă. Allow-list STRICTĂ, deci un câmp nou nu intră
  în jurnal decât adăugat explicit: nu-l adăuga. — `actions-instruiri-medicina.test.ts`

## Erori traduse

`src/app/(app)/ssm/erori.ts` dă mesaj propriu doar pentru `23505` (potrivit pe numele
constrângerii — stingător, autorizație nominală, număr intern de accident; altfel duplicat
generic), `22012`/`22003` și `P0001`, al cărui text vine din triggerele lui `0011` cu
cifre în el și se propagă neschimbat, tăiat la 300 de caractere. Orice alt cod — `42501`,
`23503`, `23514`, `PGRST116` — se aruncă MAI DEPARTE neatins, către traducerea generică
din `createAction`; la fel o eroare care nu e PostgREST, chiar cu cod `23505`.
— `erori.test.ts`

`etichete.ts` e lipit de enumurile din `src/schemas/ssm.ts` prin `Record<Enum, string>`:
tsc prinde valoarea fără text. Ce nu vede tsc e gravitatea tonului — `pericol` cade exact
pe accidentele cu comunicare la ITM. — `etichete.test.ts`

## De ce nicio instruire periodică nu se putea salva (0021)

`internal.ssm_training_sync()` compunea cheia scadenței ca `domeniu || ':' || cod` —
`ssm:periodic` — și o trimitea în `public.expirables`, unde constrângerea `expirables_kind_ck`
acceptă `^[a-z][a-z0-9_]{1,48}$`. Tiparul nu are două puncte. Deci exact cazul obișnuit —
instruirea periodică, cea cerută de ITM la control — pica la salvare cu 23514, pentru
oricine. Tipurile fără periodicitate treceau, fiindcă nu produc scadență, iar asta făcea
defectul să pară intermitent.

`0021_fix_instruiri_ssm.sql` schimbă separatorul în underscore și validează cheia în
funcție, cu mesaj propriu, înainte de a atinge tabela.

De reținut e cum a scăpat: migrarea se aplică fără eroare (constrângerea se evaluează la
INSERT, nu la crearea funcției), cele trei bariere SQL treceau, iar testul de izolare
demonstra absența accesului NEautorizat — nu prezența celui autorizat. L-a prins doar
verificarea `(l)` din `tests/rls/izolare.sql`, extinsă cu o instruire inserată ca
utilizator obișnuit.

## Ce NU e aici

`0011_ssm.sql` creează și `equipment`, `equipment_meters`, `maintenance_plans`,
`maintenance_interventions` și `fault_reports` — dar acelea sunt modulul de mentenanță, cu
resursa de permisiune `maintenance`, nu `ssm`. Aceeași migrare, două module.

Documentele scanate ale angajatului și dosarul lui de personal: [[modul/angajati]].

## Când NU e suficientă pagina asta

- Calculul stării unei scadențe: `src/domain/ssm/scadente.ts`, cu teste.
- De ce `hr` nu vede o listă pe care o administrează: [[rol/hr]].
- Lotul 7f: celulele Expirat/Lipsă deschid formularul precompletat (`?angajat=&tip=`), „Instruire nouă” poartă domeniul, `?departament=` pe matrice (din panoul departamentului), situația SSM la data accidentului, echipamentele ISCIR ale titularului: [[strat/navigare]].
- Lotul 7m: celula matricei de instruiri se deschide (durata, scadența, semnătura) și confirmă semnătura (`confirmaSemnaturaInstruire`, `ssm:update`): [[strat/navigare]].
